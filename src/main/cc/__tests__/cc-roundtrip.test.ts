/**
 * CC 파서→저장 라운드트립 통합 테스트
 *
 * 흐름: parseCCScene(raw) → 노드 편집 → saveCCScene → 저장된 JSON 재파싱 → 값 보존 확인
 * fs는 mock, 저장된 내용을 직접 캡처해 재파싱함으로써 실제 파일 I/O 없이 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// fs mock — writeFileSync 호출 내용 캡처
vi.mock('fs', () => {
  const statResult = { mtimeMs: 1000, size: 100 }
  return {
    default: {
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
      renameSync: vi.fn(),
      statSync: vi.fn(() => statResult),
      existsSync: vi.fn(() => true),
    },
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    renameSync: vi.fn(),
    statSync: vi.fn(() => statResult),
    existsSync: vi.fn(() => true),
  }
})

vi.mock('../cc-asset-resolver', () => ({
  buildUUIDMap: vi.fn(() => Promise.resolve(new Map())),
}))

import fs from 'fs'
import { parseCCScene } from '../cc-file-parser'
import { saveCCScene, clearMtimeMap } from '../cc-file-saver'
import type { CCSceneNode, CCSceneFile, CCFileProjectInfo } from '../../../shared/ipc-schema'

const mockReadFileSync = vi.mocked(fs.readFileSync)
const mockWriteFileSync = vi.mocked(fs.writeFileSync)

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

const projectInfo2x: CCFileProjectInfo = { detected: true, version: '2x' }
const projectInfo3x: CCFileProjectInfo = { detected: true, version: '3x' }

/** saveCCScene 후 writeFileSync로 쓰여진 JSON을 캡처하여 파싱 */
function captureWritten(): unknown[] {
  const calls = mockWriteFileSync.mock.calls
  const lastCall = calls[calls.length - 1]
  if (!lastCall) throw new Error('writeFileSync가 호출되지 않음')
  return JSON.parse(lastCall[1] as string)
}

/** parseCCScene → captureWritten raw → 다시 parseCCScene (재파싱) */
async function roundtrip(
  raw: unknown[],
  modifier: (root: CCSceneNode) => CCSceneNode,
  projectInfo: CCFileProjectInfo
): Promise<{ before: CCSceneFile; after: CCSceneFile }> {
  mockReadFileSync.mockReturnValue(JSON.stringify(raw))
  const before = await parseCCScene('/fake/scene.fire', projectInfo)

  const modifiedRoot = modifier(JSON.parse(JSON.stringify(before.root)) as CCSceneNode)
  const result = saveCCScene(before, modifiedRoot)
  expect(result.success).toBe(true)

  const writtenRaw = captureWritten()
  mockReadFileSync.mockReturnValue(JSON.stringify(writtenRaw))
  const after = await parseCCScene('/fake/scene.fire', projectInfo)

  return { before, after }
}

// ── 2.x 씬 픽스처 ─────────────────────────────────────────────────────────────

function make2xRaw(): unknown[] {
  return [
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    {
      __type__: 'cc.Scene',
      _name: 'TestScene',
      _active: true,
      _id: 'scene-uuid',
      _children: [{ __id__: 2 }],
      _components: [],
      _trs: {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      _contentSize: { width: 0, height: 0 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255,
      _color: { r: 255, g: 255, b: 255, a: 255 },
    },
    {
      __type__: 'cc.Node',
      _name: 'ChildNode',
      _active: true,
      _id: 'child-uuid',
      _children: [],
      _components: [{ __id__: 3 }],
      _trs: {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [100, 200, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      _contentSize: { width: 200, height: 100 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 128,
      _color: { r: 255, g: 0, b: 0, a: 255 },
    },
    {
      __type__: 'cc.Label',
      node: { __id__: 2 },
      _enabled: true,
      _N$string: 'Hello',
      _N$fontSize: 32,
      _N$lineHeight: 40,
      _N$horizontalAlign: 1,
    },
  ]
}

// ── 3.x 씬 픽스처 ─────────────────────────────────────────────────────────────

function make3xRaw(): unknown[] {
  return [
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    {
      __type__: 'cc.Scene',
      _name: 'Scene3x',
      _active: true,
      _id: 'scene-3x-uuid',
      _children: [{ __id__: 2 }],
      _components: [],
      _lpos: { x: 0, y: 0, z: 0 },
      _lrot: { x: 0, y: 0, z: 0, w: 1 },
      _lscale: { x: 1, y: 1, z: 1 },
      _uiProps: { _localOpacity: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 },
      layer: 33554432,
    },
    {
      __type__: 'cc.Node',
      _name: 'Child3x',
      _active: true,
      _id: 'child-3x-uuid',
      _children: [],
      _components: [{ __id__: 4 }],
      _lpos: { x: 50, y: 100, z: 0 },
      _lrot: { x: 0, y: 0, z: 0, w: 1 },
      _lscale: { x: 1, y: 1, z: 1 },
      _uiProps: { _localOpacity: 1 },
      _color: { r: 0, g: 255, b: 0, a: 200 },
      layer: 33554432,
    },
    {
      __type__: 'cc.UITransform',
      node: { __id__: 2 },
      _contentSize: { width: 300, height: 150 },
      _anchorPoint: { x: 0, y: 1 },
    },
    {
      __type__: 'cc.Label',
      node: { __id__: 2 },
      _enabled: true,
      _string: 'Hello 3x',
      _fontSize: 24,
      _lineHeight: 30,
    },
  ]
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe('cc-roundtrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMtimeMap()
  })

  // ── 2.x: position 변경 ───────────────────────────────────────────────────────

  describe('2.x position 변경 라운드트립', () => {
    it('position 변경 후 재파싱 시 동일 position 반환', async () => {
      const { after } = await roundtrip(
        make2xRaw(),
        root => {
          const child = root.children[0]
          child.position = { x: 300, y: 400, z: 0 }
          return root
        },
        projectInfo2x
      )

      const child = after.root.children[0]
      expect(child.position.x).toBeCloseTo(300, 1)
      expect(child.position.y).toBeCloseTo(400, 1)
      expect(child.position.z).toBeCloseTo(0, 1)
    })

    it('position 변경 후 이름/uuid 보존', async () => {
      const { after } = await roundtrip(
        make2xRaw(),
        root => {
          root.children[0].position = { x: 50, y: 50, z: 0 }
          return root
        },
        projectInfo2x
      )

      expect(after.root.children[0].name).toBe('ChildNode')
      expect(after.root.children[0].uuid).toBe('child-uuid')
    })

    it('다른 노드 속성은 position 변경에 영향받지 않음', async () => {
      const { before, after } = await roundtrip(
        make2xRaw(),
        root => {
          root.children[0].position = { x: 999, y: 999, z: 0 }
          return root
        },
        projectInfo2x
      )

      const beforeChild = before.root.children[0]
      const afterChild = after.root.children[0]
      expect(afterChild.opacity).toBe(beforeChild.opacity)
      expect(afterChild.size).toEqual(beforeChild.size)
    })
  })

  // ── 3.x: rotation 변경 ───────────────────────────────────────────────────────

  describe('3.x rotation 변경 라운드트립', () => {
    it('rotation.z 45도 변경 후 재파싱 시 euler 값 보존', async () => {
      const { after } = await roundtrip(
        make3xRaw(),
        root => {
          root.children[0].rotation = { x: 0, y: 0, z: 45 }
          return root
        },
        projectInfo3x
      )

      const child = after.root.children[0]
      // quaternion 변환 왕복 시 약간의 부동소수점 오차 허용
      expect(child.rotation.z).toBeCloseTo(45, 0)
    })

    it('rotation.z 90도 변경 후 보존', async () => {
      const { after } = await roundtrip(
        make3xRaw(),
        root => {
          root.children[0].rotation = { x: 0, y: 0, z: 90 }
          return root
        },
        projectInfo3x
      )

      expect(after.root.children[0].rotation.z).toBeCloseTo(90, 0)
    })

    it('rotation.z 0도는 0으로 보존', async () => {
      const { after } = await roundtrip(
        make3xRaw(),
        root => {
          root.children[0].rotation = { x: 0, y: 0, z: 0 }
          return root
        },
        projectInfo3x
      )

      expect(after.root.children[0].rotation.z).toBeCloseTo(0, 2)
    })
  })

  // ── UITransform size 변경 ────────────────────────────────────────────────────

  describe('UITransform size 변경 라운드트립', () => {
    it('2.x size 변경 후 재파싱 시 보존', async () => {
      const { after } = await roundtrip(
        make2xRaw(),
        root => {
          root.children[0].size = { x: 400, y: 300 }
          return root
        },
        projectInfo2x
      )

      expect(after.root.children[0].size.x).toBe(400)
      expect(after.root.children[0].size.y).toBe(300)
    })

    it('3.x UITransform size 변경 후 재파싱 시 보존', async () => {
      const { after } = await roundtrip(
        make3xRaw(),
        root => {
          root.children[0].size = { x: 500, y: 250 }
          return root
        },
        projectInfo3x
      )

      expect(after.root.children[0].size.x).toBe(500)
      expect(after.root.children[0].size.y).toBe(250)
    })

    it('2.x anchor 변경 후 보존', async () => {
      const { after } = await roundtrip(
        make2xRaw(),
        root => {
          root.children[0].anchor = { x: 0, y: 0 }
          return root
        },
        projectInfo2x
      )

      expect(after.root.children[0].anchor.x).toBe(0)
      expect(after.root.children[0].anchor.y).toBe(0)
    })
  })

  // ── 컴포넌트 props 변경 ───────────────────────────────────────────────────────

  describe('컴포넌트 props 변경 라운드트립', () => {
    it('2.x Label string 변경 후 재파싱 시 보존', async () => {
      const { after } = await roundtrip(
        make2xRaw(),
        root => {
          root.children[0].components[0].props.string = 'Updated Text'
          return root
        },
        projectInfo2x
      )

      expect(after.root.children[0].components[0].props.string).toBe('Updated Text')
    })

    it('2.x Label fontSize 변경 후 재파싱 시 보존', async () => {
      const { after } = await roundtrip(
        make2xRaw(),
        root => {
          root.children[0].components[0].props.fontSize = 48
          return root
        },
        projectInfo2x
      )

      expect(after.root.children[0].components[0].props.fontSize).toBe(48)
    })

    it('3.x Label string 변경 후 재파싱 시 보존', async () => {
      const { after } = await roundtrip(
        make3xRaw(),
        root => {
          root.children[0].components[0].props.string = 'New 3x Text'
          return root
        },
        projectInfo3x
      )

      expect(after.root.children[0].components[0].props.string).toBe('New 3x Text')
    })

    it('컴포넌트 타입은 props 변경 후에도 보존', async () => {
      const { after } = await roundtrip(
        make2xRaw(),
        root => {
          root.children[0].components[0].props.string = 'X'
          return root
        },
        projectInfo2x
      )

      expect(after.root.children[0].components[0].type).toBe('cc.Label')
    })
  })

  // ── 새 노드 추가 ──────────────────────────────────────────────────────────────

  describe('새 노드 추가 라운드트립', () => {
    it('2.x 루트에 새 자식 추가 후 재파싱 시 children 수 증가', async () => {
      const { before, after } = await roundtrip(
        make2xRaw(),
        root => {
          const newChild: CCSceneNode = {
            uuid: 'new-child-uuid',
            name: 'NewChild',
            active: true,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            size: { x: 100, y: 100 },
            anchor: { x: 0.5, y: 0.5 },
            opacity: 255,
            color: { r: 255, g: 255, b: 255, a: 255 },
            components: [],
            children: [],
            // _rawIndex 없음 → 새 노드
          }
          root.children.push(newChild)
          return root
        },
        projectInfo2x
      )

      expect(after.root.children.length).toBe(before.root.children.length + 1)
    })

    it('2.x 추가된 새 노드의 이름이 재파싱 후 보존', async () => {
      const { after } = await roundtrip(
        make2xRaw(),
        root => {
          root.children.push({
            uuid: 'extra-uuid',
            name: 'ExtraNode',
            active: true,
            position: { x: 10, y: 20, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            size: { x: 50, y: 50 },
            anchor: { x: 0.5, y: 0.5 },
            opacity: 255,
            color: { r: 255, g: 255, b: 255, a: 255 },
            components: [],
            children: [],
          })
          return root
        },
        projectInfo2x
      )

      const newNode = after.root.children.find(c => c.name === 'ExtraNode')
      expect(newNode).toBeDefined()
    })

    it('3.x 새 자식 추가 후 children 수 증가', async () => {
      const { before, after } = await roundtrip(
        make3xRaw(),
        root => {
          root.children.push({
            uuid: 'new-3x-uuid',
            name: 'NewChild3x',
            active: true,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            size: { x: 100, y: 100 },
            anchor: { x: 0.5, y: 0.5 },
            opacity: 255,
            color: { r: 255, g: 255, b: 255, a: 255 },
            components: [],
            children: [],
          })
          return root
        },
        projectInfo3x
      )

      expect(after.root.children.length).toBe(before.root.children.length + 1)
    })
  })

  // ── 변경 없이 저장/재파싱 시 원본 보존 ────────────────────────────────────────

  describe('무변경 라운드트립', () => {
    it('2.x 수정 없이 저장 후 재파싱 시 position 보존', async () => {
      const { before, after } = await roundtrip(
        make2xRaw(),
        root => root,
        projectInfo2x
      )

      expect(after.root.children[0].position.x).toBeCloseTo(before.root.children[0].position.x, 1)
      expect(after.root.children[0].position.y).toBeCloseTo(before.root.children[0].position.y, 1)
    })

    it('3.x 수정 없이 저장 후 재파싱 시 size 보존', async () => {
      const { before, after } = await roundtrip(
        make3xRaw(),
        root => root,
        projectInfo3x
      )

      expect(after.root.children[0].size.x).toBe(before.root.children[0].size.x)
      expect(after.root.children[0].size.y).toBe(before.root.children[0].size.y)
    })
  })
})
