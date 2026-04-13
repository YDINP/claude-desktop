/**
 * CC 파서 대형 씬 성능 테스트
 *
 * 실제 파일 I/O 없이 인메모리 픽스처로 파싱/저장 시간을 측정한다.
 * vitest 환경(jsdom + Node) 기준이므로 실제 Electron 대비 느릴 수 있음.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import type { CCFileProjectInfo } from '../../../shared/ipc-schema'

const mockReadFileSync = vi.mocked(fs.readFileSync)

const projectInfo2x: CCFileProjectInfo = { detected: true, version: '2x' }
const projectInfo3x: CCFileProjectInfo = { detected: true, version: '3x' }

// ── 대형 씬 픽스처 생성기 ──────────────────────────────────────────────────────

/**
 * CC 2.x 평탄 씬 생성 — nodeCount개의 자식을 cc.Scene 아래에 붙임
 */
function makeLarge2xScene(nodeCount: number): unknown[] {
  const entries: unknown[] = []

  // [0] SceneAsset
  entries.push({ __type__: 'cc.SceneAsset', scene: { __id__: 1 } })

  // [1] cc.Scene (root)
  const childRefs = Array.from({ length: nodeCount }, (_, i) => ({ __id__: i * 2 + 2 }))
  entries.push({
    __type__: 'cc.Scene',
    _name: 'LargeScene',
    _active: true,
    _id: 'large-scene-uuid',
    _children: childRefs,
    _components: [],
    _trs: {
      __type__: 'TypedArray',
      ctor: 'Float64Array',
      array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    },
    _contentSize: { width: 1920, height: 1080 },
    _anchorPoint: { x: 0.5, y: 0.5 },
    _opacity: 255,
    _color: { r: 255, g: 255, b: 255, a: 255 },
  })

  // 노드마다 Node + Label 컴포넌트 2 엔트리
  for (let i = 0; i < nodeCount; i++) {
    const nodeIdx = i * 2 + 2
    const compIdx = nodeIdx + 1

    entries.push({
      __type__: 'cc.Node',
      _name: `Node_${i}`,
      _active: true,
      _id: `node-uuid-${i}`,
      _children: [],
      _components: [{ __id__: compIdx }],
      _trs: {
        __type__: 'TypedArray',
        ctor: 'Float64Array',
        array: [i * 10, i * 5, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      _contentSize: { width: 100 + i, height: 50 + i },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255,
      _color: { r: 255, g: 255, b: 255, a: 255 },
    })

    entries.push({
      __type__: 'cc.Label',
      node: { __id__: nodeIdx },
      _enabled: true,
      _N$string: `Label_${i}`,
      _N$fontSize: 20,
      _N$lineHeight: 24,
      _N$horizontalAlign: 1,
    })
  }

  return entries
}

/**
 * CC 3.x 평탄 씬 생성 — nodeCount개의 자식 + UITransform 포함
 */
function makeLarge3xScene(nodeCount: number): unknown[] {
  const entries: unknown[] = []

  // [0] SceneAsset
  entries.push({ __type__: 'cc.SceneAsset', scene: { __id__: 1 } })

  // [1] cc.Scene
  const childRefs = Array.from({ length: nodeCount }, (_, i) => ({ __id__: i * 3 + 2 }))
  entries.push({
    __type__: 'cc.Scene',
    _name: 'LargeScene3x',
    _active: true,
    _id: 'large-3x-uuid',
    _children: childRefs,
    _components: [],
    _lpos: { x: 0, y: 0, z: 0 },
    _lrot: { x: 0, y: 0, z: 0, w: 1 },
    _lscale: { x: 1, y: 1, z: 1 },
    _uiProps: { _localOpacity: 1 },
    _color: { r: 255, g: 255, b: 255, a: 255 },
    layer: 33554432,
  })

  // 노드마다 Node + UITransform + Label 컴포넌트 3 엔트리
  for (let i = 0; i < nodeCount; i++) {
    const nodeIdx = i * 3 + 2
    const uitIdx = nodeIdx + 1
    const compIdx = nodeIdx + 2

    entries.push({
      __type__: 'cc.Node',
      _name: `Node3x_${i}`,
      _active: true,
      _id: `node-3x-uuid-${i}`,
      _children: [],
      _components: [{ __id__: compIdx }],
      _lpos: { x: i * 10, y: i * 5, z: 0 },
      _lrot: { x: 0, y: 0, z: 0, w: 1 },
      _lscale: { x: 1, y: 1, z: 1 },
      _uiProps: { _localOpacity: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 },
      layer: 33554432,
    })

    entries.push({
      __type__: 'cc.UITransform',
      node: { __id__: nodeIdx },
      _contentSize: { width: 100 + i, height: 50 + i },
      _anchorPoint: { x: 0.5, y: 0.5 },
    })

    entries.push({
      __type__: 'cc.Label',
      node: { __id__: nodeIdx },
      _enabled: true,
      _string: `Label3x_${i}`,
      _fontSize: 20,
      _lineHeight: 24,
    })
  }

  return entries
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe('cc-performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMtimeMap()
  })

  describe('파싱 시간', () => {
    it('100노드 2.x 씬 파싱 시간 < 100ms', async () => {
      const raw = makeLarge2xScene(100)
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const start = performance.now()
      const result = await parseCCScene('/fake/large.fire', projectInfo2x)
      const elapsed = performance.now() - start

      expect(result.root.children).toHaveLength(100)
      expect(elapsed).toBeLessThan(100)
    }, 3000)

    it('500노드 2.x 씬 파싱 시간 < 500ms', async () => {
      const raw = makeLarge2xScene(500)
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const start = performance.now()
      const result = await parseCCScene('/fake/large.fire', projectInfo2x)
      const elapsed = performance.now() - start

      expect(result.root.children).toHaveLength(500)
      expect(elapsed).toBeLessThan(500)
    }, 5000)

    it('100노드 3.x 씬 파싱 시간 < 100ms', async () => {
      const raw = makeLarge3xScene(100)
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const start = performance.now()
      const result = await parseCCScene('/fake/large.scene', projectInfo3x)
      const elapsed = performance.now() - start

      expect(result.root.children).toHaveLength(100)
      expect(elapsed).toBeLessThan(100)
    }, 3000)

    it('500노드 3.x 씬 파싱 시간 < 500ms', async () => {
      const raw = makeLarge3xScene(500)
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const start = performance.now()
      const result = await parseCCScene('/fake/large.scene', projectInfo3x)
      const elapsed = performance.now() - start

      expect(result.root.children).toHaveLength(500)
      expect(elapsed).toBeLessThan(500)
    }, 5000)
  })

  describe('Widget 해결 시간', () => {
    it('Widget 컴포넌트 100개 씬 resolveWidgetLayout < 50ms (파싱 내 포함)', async () => {
      // Widget 포함 씬 생성
      const raw = makeLarge2xScene(100) as Record<string, unknown>[]
      // 각 Label 컴포넌트를 Widget으로 교체
      for (let i = 0; i < 100; i++) {
        const compIdx = i * 2 + 3  // Label 위치
        if (raw[compIdx]) {
          raw[compIdx] = {
            __type__: 'cc.Widget',
            node: { __id__: i * 2 + 2 },
            _enabled: true,
            _N$isAlignTop: true,
            _N$isAlignBottom: false,
            _N$isAlignLeft: true,
            _N$isAlignRight: false,
            _N$top: 10,
            _N$bottom: 0,
            _N$left: 10,
            _N$right: 0,
            _N$isAbsTop: true,
            _N$isAbsBottom: true,
            _N$isAbsLeft: true,
            _N$isAbsRight: true,
          }
        }
      }

      mockReadFileSync.mockReturnValue(JSON.stringify(raw))

      const start = performance.now()
      const result = await parseCCScene('/fake/widget.fire', projectInfo2x)
      const elapsed = performance.now() - start

      expect(result.root.children).toHaveLength(100)
      // Widget 해결 포함 파싱이 50ms 미만
      expect(elapsed).toBeLessThan(50)
    }, 3000)
  })

  describe('저장 시간', () => {
    it('100노드 2.x 씬 저장 시간 < 100ms', async () => {
      const raw = makeLarge2xScene(100)
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))
      const sceneFile = await parseCCScene('/fake/large.fire', projectInfo2x)

      const start = performance.now()
      const result = saveCCScene(sceneFile, sceneFile.root)
      const elapsed = performance.now() - start

      expect(result.success).toBe(true)
      expect(elapsed).toBeLessThan(100)
    }, 3000)

    it('100노드 3.x 씬 저장 시간 < 100ms', async () => {
      const raw = makeLarge3xScene(100)
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))
      const sceneFile = await parseCCScene('/fake/large.scene', projectInfo3x)

      const start = performance.now()
      const result = saveCCScene(sceneFile, sceneFile.root)
      const elapsed = performance.now() - start

      expect(result.success).toBe(true)
      expect(elapsed).toBeLessThan(100)
    }, 3000)

    it('500노드 2.x 씬 저장 시간 < 500ms', async () => {
      const raw = makeLarge2xScene(500)
      mockReadFileSync.mockReturnValue(JSON.stringify(raw))
      const sceneFile = await parseCCScene('/fake/large.fire', projectInfo2x)

      const start = performance.now()
      const result = saveCCScene(sceneFile, sceneFile.root)
      const elapsed = performance.now() - start

      expect(result.success).toBe(true)
      expect(elapsed).toBeLessThan(500)
    }, 5000)
  })

  describe('반복 파싱 — 메모리/속도 회귀 없음', () => {
    it('동일 100노드 씬을 10회 연속 파싱해도 각 회차 < 100ms', async () => {
      const raw = makeLarge2xScene(100)
      const rawStr = JSON.stringify(raw)

      for (let run = 0; run < 10; run++) {
        mockReadFileSync.mockReturnValue(rawStr)
        const start = performance.now()
        await parseCCScene('/fake/large.fire', projectInfo2x)
        const elapsed = performance.now() - start
        expect(elapsed).toBeLessThan(100)
      }
    }, 10000)
  })
})
