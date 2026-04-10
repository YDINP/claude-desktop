/**
 * cc-file-saver — 엣지 케이스 테스트
 * - 빈 트리 저장 (children 0개)
 * - 새 노드만 있는 트리 (기존 raw 없음 → _raw 필수)
 * - rawIndex 중복
 * - 저장 중 파일 삭제됨 (statSync 실패)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => {
  return {
    default: {
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
      renameSync: vi.fn(),
      statSync: vi.fn(() => ({ mtimeMs: 1000, size: 100 })),
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      unlinkSync: vi.fn(),
    },
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    renameSync: vi.fn(),
    statSync: vi.fn(() => ({ mtimeMs: 1000, size: 100 })),
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn(() => []),
    unlinkSync: vi.fn(),
  }
})

import fs from 'fs'
import {
  saveCCScene,
  validateCCScene,
  clearMtimeMap,
  recordSceneMtime,
  forceOverwriteScene,
} from '../cc-file-saver'
import type { CCSceneNode, CCSceneFile } from '../../../shared/ipc-schema'

const mockWriteFileSync = vi.mocked(fs.writeFileSync)
const mockCopyFileSync = vi.mocked(fs.copyFileSync)
const mockRenameSync = vi.mocked(fs.renameSync)
const mockStatSync = vi.mocked(fs.statSync)

function makeNode(overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return {
    uuid: 'root-uuid',
    name: 'Root',
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
    _rawIndex: 0,
    ...overrides,
  }
}

function makeSceneFile(
  root: CCSceneNode,
  raw?: Record<string, unknown>[],
  version: '2x' | '3x' = '2x'
): CCSceneFile {
  return {
    projectInfo: { detected: true, version },
    scenePath: '/fake/scene.fire',
    root,
    _raw: raw ?? [
      {
        __type__: 'cc.Node',
        _name: 'Root',
        _active: true,
        _children: [],
        _components: [],
        _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
        _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ],
  }
}

// ── 빈 트리 저장 ──────────────────────────────────────────────────────────────

describe('cc-file-saver edge — 빈 트리 저장', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMtimeMap()
    mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
  })

  it('children 0개인 루트만 있는 트리 정상 저장', () => {
    const root = makeNode({ children: [] })
    const sceneFile = makeSceneFile(root)

    const result = saveCCScene(sceneFile, root)

    expect(result.success).toBe(true)
    expect(mockWriteFileSync).toHaveBeenCalledOnce()
    expect(mockRenameSync).toHaveBeenCalledOnce()
  })

  it('빈 트리 저장 시 _raw의 루트 노드 이름이 패치됨', () => {
    const root = makeNode({ name: 'RenamedRoot', children: [] })
    const sceneFile = makeSceneFile(root)

    saveCCScene(sceneFile, root)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string)
    expect(written[0]._name).toBe('RenamedRoot')
  })

  it('components 0개인 노드 저장 — _components 빈 배열로 패치', () => {
    const root = makeNode({ children: [], components: [] })
    const raw = [{
      __type__: 'cc.Node',
      _name: 'Root',
      _active: true,
      _children: [],
      _components: [{ __id__: 99 }], // 기존에 있던 컴포넌트 refs
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { width: 100, height: 100 },
      _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255,
      _color: { r: 255, g: 255, b: 255, a: 255 },
    }]
    const sceneFile = makeSceneFile(root, raw)

    saveCCScene(sceneFile, root)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string)
    expect(written[0]._components).toEqual([])
  })
})

// ── 새 노드만 있는 트리 (기존 raw 없음) ──────────────────────────────────────

describe('cc-file-saver edge — _raw 없으면 즉시 에러', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMtimeMap()
  })

  it('_raw가 undefined이면 success=false, error에 _raw 언급', () => {
    const root = makeNode()
    const sceneFile: CCSceneFile = {
      projectInfo: { detected: true, version: '2x' },
      scenePath: '/fake/no-raw.fire',
      root,
      // _raw 없음
    }

    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/_raw/)
  })

  it('_raw가 undefined면 파일 I/O 호출 없음', () => {
    const root = makeNode()
    const sceneFile: CCSceneFile = {
      projectInfo: { detected: true, version: '2x' },
      scenePath: '/fake/no-raw.fire',
      root,
    }

    saveCCScene(sceneFile, root)

    expect(mockWriteFileSync).not.toHaveBeenCalled()
    expect(mockCopyFileSync).not.toHaveBeenCalled()
    expect(mockRenameSync).not.toHaveBeenCalled()
  })
})

// ── rawIndex 중복 ─────────────────────────────────────────────────────────────

describe('cc-file-saver edge — rawIndex 중복', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMtimeMap()
    mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
  })

  it('두 형제 노드가 같은 _rawIndex를 가지면 validateCCScene는 통과하지만 패치 시 마지막 노드가 덮어씀', () => {
    // validateCCScene는 UUID 중복을 확인, rawIndex 중복은 별도 검사 없음
    // 동일 rawIndex를 가진 두 노드가 있으면 두 번 패치 → 마지막 패치 값이 남음
    const child1 = makeNode({
      uuid: 'child1-uuid',
      name: 'Child1',
      _rawIndex: 1,
      position: { x: 10, y: 20, z: 0 },
      children: [],
    })
    const child2 = makeNode({
      uuid: 'child2-uuid',
      name: 'Child2',
      _rawIndex: 1, // child1과 동일한 rawIndex
      position: { x: 99, y: 88, z: 0 },
      children: [],
    })
    const root = makeNode({
      children: [child1, child2],
    })
    const raw = [
      {
        __type__: 'cc.Node',
        _name: 'Root',
        _active: true,
        _children: [{ __id__: 1 }, { __id__: 1 }],
        _components: [],
        _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
        _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
      {
        __type__: 'cc.Node',
        _name: 'SharedSlot',
        _active: true,
        _children: [],
        _components: [],
        _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
        _contentSize: { width: 50, height: 50 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ]
    const sceneFile = makeSceneFile(root, raw)

    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(true)

    // 마지막으로 패치된 노드(child2)의 이름이 남음
    const written = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string)
    expect(written[1]._name).toBe('Child2')
  })

  it('validateCCScene — UUID 중복 시 errors 배열에 포함', () => {
    const child1 = makeNode({ uuid: 'dup-uuid', name: 'Child1', _rawIndex: 1 })
    const child2 = makeNode({ uuid: 'dup-uuid', name: 'Child2', _rawIndex: 2 }) // 중복 UUID
    const root = makeNode({ children: [child1, child2] })

    const result = validateCCScene(root)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('중복 UUID'))).toBe(true)
  })

  it('validateCCScene — _rawIndex null인 노드는 warnings에 포함', () => {
    const child = makeNode({
      uuid: 'no-raw-idx',
      name: 'NoRawIdx',
      _rawIndex: undefined as unknown as number,
    })
    const root = makeNode({ children: [child] })

    const result = validateCCScene(root)
    expect(result.valid).toBe(true) // error는 아님
    expect(result.warnings.some(w => w.includes('_rawIndex'))).toBe(true)
  })

  it('validateCCScene — 정상 트리는 valid=true, 에러/경고 없음', () => {
    const child = makeNode({ uuid: 'child-ok', name: 'Child', _rawIndex: 1 })
    const root = makeNode({ children: [child] })

    const result = validateCCScene(root)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })
})

// ── 저장 중 파일 삭제됨 ───────────────────────────────────────────────────────

describe('cc-file-saver edge — 저장 중 파일 삭제/쓰기 실패', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMtimeMap()
  })

  it('copyFileSync 실패 시 success=false, error 메시지 포함', () => {
    mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
    mockCopyFileSync.mockImplementation(() => { throw new Error('ENOENT: no such file') })

    const root = makeNode()
    const sceneFile = makeSceneFile(root)

    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(false)
    expect(result.error).toContain('ENOENT')
  })

  it('writeFileSync 실패 시 success=false', () => {
    mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
    mockCopyFileSync.mockReturnValue(undefined)
    mockWriteFileSync.mockImplementation(() => { throw new Error('ENOSPC: no space left') })

    const root = makeNode()
    const sceneFile = makeSceneFile(root)

    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(false)
    expect(result.error).toContain('ENOSPC')
  })

  it('statSync이 throw해도 (파일 삭제된 경우) 저장 진행됨', () => {
    // mtime 기록이 있는 상태에서 statSync이 에러 → conflict 없이 저장 진행
    recordSceneMtime('/fake/scene.fire')
    // 이후 statSync (충돌 체크 시)가 에러 던짐
    mockStatSync.mockImplementation(() => { throw new Error('ENOENT') })
    // 하지만 그 이후 writeFileSync/renameSync/statSync (mtime 갱신)도 호출되므로
    // 저장 자체를 성공시키기 위해 copyFileSync만 통과, write/rename도 허용
    mockCopyFileSync.mockReturnValue(undefined)
    mockWriteFileSync.mockReturnValue(undefined)
    mockRenameSync.mockReturnValue(undefined)

    const root = makeNode()
    const sceneFile = makeSceneFile(root)

    // statSync가 에러 → 충돌 감지 try/catch에서 무시되어 저장 진행
    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(true)
  })
})

// ── clearMtimeMap / recordSceneMtime ─────────────────────────────────────────

describe('cc-file-saver edge — clearMtimeMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMtimeMap()
  })

  it('clearMtimeMap() — 전체 클리어 후 conflict 감지 안 됨', () => {
    mockStatSync
      .mockReturnValueOnce({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>) // recordSceneMtime
      .mockReturnValue({ mtimeMs: 9999, size: 100 } as ReturnType<typeof fs.statSync>)     // 이후 statSync

    recordSceneMtime('/fake/scene.fire')
    clearMtimeMap() // 전체 클리어

    // mtime이 달라도 기록이 없으니 conflict 없음
    mockCopyFileSync.mockReturnValue(undefined)
    mockWriteFileSync.mockReturnValue(undefined)
    mockRenameSync.mockReturnValue(undefined)

    const root = makeNode()
    const sceneFile = makeSceneFile(root)
    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(true)
    expect(result.conflict).toBeUndefined()
  })

  it('clearMtimeMap(projectPath) — 해당 경로만 클리어', () => {
    mockStatSync
      .mockReturnValueOnce({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
      .mockReturnValue({ mtimeMs: 9999, size: 100 } as ReturnType<typeof fs.statSync>)

    recordSceneMtime('/fake/scene.fire')
    clearMtimeMap('/fake') // 해당 경로 클리어

    mockCopyFileSync.mockReturnValue(undefined)
    mockWriteFileSync.mockReturnValue(undefined)
    mockRenameSync.mockReturnValue(undefined)

    const root = makeNode()
    const sceneFile = makeSceneFile(root)
    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(true)
  })

  it('forceOverwriteScene — mtime 충돌 상황에서도 저장 성공', () => {
    mockStatSync
      .mockReturnValueOnce({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>) // recordSceneMtime
      .mockReturnValue({ mtimeMs: 9999, size: 100 } as ReturnType<typeof fs.statSync>)     // 이후 호출

    recordSceneMtime('/fake/scene.fire')
    // 일반 save는 conflict 감지
    mockCopyFileSync.mockReturnValue(undefined)
    mockWriteFileSync.mockReturnValue(undefined)
    mockRenameSync.mockReturnValue(undefined)

    const root = makeNode()
    const sceneFile = makeSceneFile(root)

    const normalResult = saveCCScene(sceneFile, root)
    expect(normalResult.conflict).toBe(true)

    // forceOverwrite는 성공
    const forceResult = forceOverwriteScene(sceneFile, root)
    expect(forceResult.success).toBe(true)
    expect(forceResult.conflict).toBeUndefined()
  })
})

// ── 새 노드 추가 (rawIndex 없음) ──────────────────────────────────────────────

describe('cc-file-saver edge — 새 노드 자동 정규화', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMtimeMap()
    mockStatSync.mockReturnValue({ mtimeMs: 1000, size: 100 } as ReturnType<typeof fs.statSync>)
  })

  it('_rawIndex 없는 새 노드가 있으면 raw 배열에 항목 추가됨', () => {
    const newChild = makeNode({
      uuid: 'new-child-uuid',
      name: 'NewChild',
      _rawIndex: undefined as unknown as number, // 새 노드
      children: [],
    })
    const root = makeNode({ children: [newChild] })
    const sceneFile = makeSceneFile(root, [
      {
        __type__: 'cc.Node',
        _name: 'Root',
        _active: true,
        _children: [],
        _components: [],
        _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
        _contentSize: { width: 100, height: 100 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255,
        _color: { r: 255, g: 255, b: 255, a: 255 },
      },
    ])

    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(true)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string)
    // 기존 raw 1개 + 새 노드 1개 = 2개
    expect(written).toHaveLength(2)
    expect(written[1]._name).toBe('NewChild')
    expect(written[1].__type__).toBe('cc.Node')
  })

  it('3x에서 _rawIndex 없는 새 노드는 cc.UITransform도 함께 추가됨', () => {
    const newChild = makeNode({
      uuid: 'new-3x-child',
      name: 'New3xChild',
      _rawIndex: undefined as unknown as number,
      children: [],
      size: { x: 300, y: 150 },
    })
    const root = makeNode({ children: [newChild] })

    const raw3x = [
      {
        __type__: 'cc.Scene',
        _name: 'Root',
        _active: true,
        _id: '3x-root',
        _children: [],
        _components: [],
        _lpos: { x: 0, y: 0, z: 0 },
        _lrot: { x: 0, y: 0, z: 0, w: 1 },
        _lscale: { x: 1, y: 1, z: 1 },
        _uiProps: { _localOpacity: 1 },
        _color: { r: 255, g: 255, b: 255, a: 255 },
        layer: 33554432,
      },
    ]
    const sceneFile: CCSceneFile = {
      projectInfo: { detected: true, version: '3x' },
      scenePath: '/fake/scene.scene',
      root: makeNode({ _rawIndex: 0 }),
      _raw: raw3x,
    }

    const result = saveCCScene(sceneFile, root)
    expect(result.success).toBe(true)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string)
    // raw 1개(root) + new node 1개 + UITransform 1개 = 3개
    expect(written).toHaveLength(3)
    const uit = written.find((e: Record<string, unknown>) => e.__type__ === 'cc.UITransform')
    expect(uit).toBeDefined()
    expect(uit._contentSize).toEqual({ width: 300, height: 150 })
  })
})
