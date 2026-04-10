/**
 * useCCFileProject — CC 파일 기반 프로젝트 훅 단위 테스트
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { CCFileProjectInfo, CCSceneFile, CCSceneNode } from '@shared/ipc-schema'
import { useCCFileProject } from '../useCCFileProject'

// ── helpers ────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, children: CCSceneNode[] = []): CCSceneNode {
  return {
    uuid, name: uuid, active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [], children,
  }
}

function makeProjectInfo(overrides: Partial<CCFileProjectInfo> = {}): CCFileProjectInfo {
  return {
    detected: true,
    version: '2x',
    projectPath: '/test/project',
    assetsDir: '/test/project/assets',
    scenes: ['/test/project/assets/scenes/Main.fire'],
    ...overrides,
  }
}

function makeSceneFile(root?: CCSceneNode): CCSceneFile {
  return {
    scenePath: '/test/project/assets/scenes/Main.fire',
    projectInfo: makeProjectInfo(),
    root: root ?? makeNode('root', [makeNode('child1'), makeNode('child2')]),
    _raw: [],
    scriptNames: {},
  }
}

// ── window.api mock ────────────────────────────────────────────────────────────

const mockApi = {
  ccFileOpenProject: vi.fn(),
  ccFileDetect: vi.fn(),
  ccFileReadScene: vi.fn(),
  ccFileSaveScene: vi.fn(),
  ccFileRestoreBackup: vi.fn(),
  ccFileForceOverwrite: vi.fn(),
  ccFileWatch: vi.fn().mockResolvedValue({ watching: 1 }),
  ccFileUnwatch: vi.fn().mockResolvedValue({ watching: 0 }),
  ccReloadScene: vi.fn().mockResolvedValue(undefined),
  onCCFileChanged: vi.fn().mockReturnValue(() => {}),
}

// localStorage mock
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
}

beforeAll(() => {
  Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  mockApi.ccFileWatch.mockResolvedValue({ watching: 1 })
  mockApi.ccFileUnwatch.mockResolvedValue({ watching: 0 })
  mockApi.ccReloadScene.mockResolvedValue(undefined)
  mockApi.onCCFileChanged.mockReturnValue(() => {})
})

// ── openProject ────────────────────────────────────────────────────────────────

describe('useCCFileProject — openProject', () => {
  it('ccFileOpenProject 성공 시 projectInfo 설정', async () => {
    const info = makeProjectInfo()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.openProject() })

    expect(result.current.projectInfo).toEqual(info)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('detected=false 이면 projectInfo 미설정 + 에러 없음', async () => {
    mockApi.ccFileOpenProject.mockResolvedValue({ detected: false })
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.openProject() })

    // detected=false → error 설정됨
    expect(result.current.projectInfo).toBeNull()
    expect(result.current.error).not.toBeNull()
  })

  it('ccFileOpenProject 반환 null 이면 에러 없음, projectInfo null', async () => {
    mockApi.ccFileOpenProject.mockResolvedValue(null)
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.openProject() })

    expect(result.current.projectInfo).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('projectPath가 있으면 localStorage에 저장', async () => {
    const info = makeProjectInfo({ projectPath: '/test/project' })
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.openProject() })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('cc-last-project-path', '/test/project')
  })

  it('ccFileOpenProject throw 시 error 상태 설정', async () => {
    mockApi.ccFileOpenProject.mockRejectedValue(new Error('dialog canceled'))
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.openProject() })

    expect(result.current.error).toContain('dialog canceled')
    expect(result.current.loading).toBe(false)
  })
})

// ── detectProject ──────────────────────────────────────────────────────────────

describe('useCCFileProject — detectProject', () => {
  it('ccFileDetect 성공 시 projectInfo 설정', async () => {
    const info = makeProjectInfo()
    mockApi.ccFileDetect.mockResolvedValue(info)
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.detectProject('/test/project') })

    expect(mockApi.ccFileDetect).toHaveBeenCalledWith('/test/project')
    expect(result.current.projectInfo).toEqual(info)
  })

  it('빈 문자열 경로 전달 시 API 미호출', async () => {
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.detectProject('') })

    expect(mockApi.ccFileDetect).not.toHaveBeenCalled()
  })

  it('detected=false 이면 projectInfo 변경 안 됨', async () => {
    mockApi.ccFileDetect.mockResolvedValue({ detected: false })
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.detectProject('/bad/path') })

    expect(result.current.projectInfo).toBeNull()
  })

  it('ccFileDetect throw 시 error 상태 설정', async () => {
    mockApi.ccFileDetect.mockRejectedValue(new Error('no such directory'))
    const { result } = renderHook(() => useCCFileProject())

    await act(async () => { await result.current.detectProject('/bad/path') })

    expect(result.current.error).toContain('no such directory')
  })
})

// ── 마운트 시 localStorage 자동 로드 ──────────────────────────────────────────

describe('useCCFileProject — 마운트 자동 로드 (ISSUE-06)', () => {
  it('localStorage에 경로가 있으면 마운트 시 ccFileDetect 호출', async () => {
    store['cc-last-project-path'] = '/saved/project'
    const info = makeProjectInfo({ projectPath: '/saved/project' })
    mockApi.ccFileDetect.mockResolvedValue(info)

    const { result } = renderHook(() => useCCFileProject())

    await waitFor(() => {
      expect(result.current.projectInfo).toEqual(info)
    })
    expect(mockApi.ccFileDetect).toHaveBeenCalledWith('/saved/project')
  })

  it('localStorage 경로 없으면 ccFileDetect 미호출', async () => {
    // store 비어있음
    renderHook(() => useCCFileProject())
    // 마운트 후 약간 대기
    await new Promise(r => setTimeout(r, 10))
    expect(mockApi.ccFileDetect).not.toHaveBeenCalled()
  })

  it('마운트 시 ccFileDetect 실패해도 에러 무시', async () => {
    store['cc-last-project-path'] = '/old/path'
    mockApi.ccFileDetect.mockRejectedValue(new Error('not found'))

    const { result } = renderHook(() => useCCFileProject())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    // 마운트 에러는 무시되므로 error 상태 null
    expect(result.current.error).toBeNull()
  })
})

// ── loadScene ──────────────────────────────────────────────────────────────────

describe('useCCFileProject — loadScene', () => {
  it('ccFileReadScene 성공 시 sceneFile 설정', async () => {
    const info = makeProjectInfo()
    const sf = makeSceneFile()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    mockApi.ccFileReadScene.mockResolvedValue(sf)

    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.openProject() })
    await act(async () => { await result.current.loadScene('/test/project/assets/scenes/Main.fire') })

    expect(result.current.sceneFile).toEqual(sf)
    expect(result.current.error).toBeNull()
  })

  it('ccFileReadScene가 error 객체 반환 시 error 상태 설정', async () => {
    const info = makeProjectInfo()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    mockApi.ccFileReadScene.mockResolvedValue({ error: 'parse failed' })

    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.openProject() })
    await act(async () => { await result.current.loadScene('/test/project/assets/scenes/Main.fire') })

    expect(result.current.error).toBe('parse failed')
    expect(result.current.sceneFile).toBeNull()
  })

  it('ccFileReadScene null 반환 시 로드 실패 에러', async () => {
    const info = makeProjectInfo()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    mockApi.ccFileReadScene.mockResolvedValue(null)

    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.openProject() })
    await act(async () => { await result.current.loadScene('/test/project/assets/scenes/Main.fire') })

    expect(result.current.error).not.toBeNull()
  })

  it('projectInfo null이면 loadScene 무반응', async () => {
    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.loadScene('/some/scene.fire') })
    expect(mockApi.ccFileReadScene).not.toHaveBeenCalled()
  })

  it('ccFileReadScene throw 시 error 설정', async () => {
    const info = makeProjectInfo()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    mockApi.ccFileReadScene.mockRejectedValue(new Error('IO error'))

    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.openProject() })
    await act(async () => { await result.current.loadScene('/test/project/assets/scenes/Main.fire') })

    expect(result.current.error).toContain('IO error')
  })
})

// ── saveScene & undo/redo ──────────────────────────────────────────────────────

describe('useCCFileProject — saveScene + undo/redo', () => {
  async function setupWithScene() {
    const info = makeProjectInfo()
    const sf = makeSceneFile()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    mockApi.ccFileReadScene.mockResolvedValue(sf)
    mockApi.ccFileSaveScene.mockResolvedValue({ success: true, backupPath: '/test.bak' })

    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.openProject() })
    await act(async () => { await result.current.loadScene(sf.scenePath) })
    return { result, sf }
  }

  it('saveScene 호출 시 ccFileSaveScene 호출 + canUndo=true', async () => {
    const { result, sf } = await setupWithScene()
    const newRoot = makeNode('root', [makeNode('child1')])

    await act(async () => { await result.current.saveScene(newRoot) })

    expect(mockApi.ccFileSaveScene).toHaveBeenCalledWith(sf, newRoot)
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
    expect(result.current.undoCount).toBeGreaterThanOrEqual(1)
  })

  it('saveScene 후 undo 호출 시 이전 상태로 복원', async () => {
    const { result } = await setupWithScene()
    const modifiedRoot = makeNode('root', [makeNode('child1')])

    await act(async () => { await result.current.saveScene(modifiedRoot) })

    // undo 후에도 ccFileSaveScene이 다시 호출되어야 함 (prev 저장)
    mockApi.ccFileSaveScene.mockResolvedValue({ success: true })
    mockApi.ccFileReadScene.mockResolvedValue(makeSceneFile())
    await act(async () => { await result.current.undo() })

    // undo 스택이 비었으면 canUndo=false
    expect(result.current.canRedo).toBe(true)
  })

  it('canUndo=false 이면 undo 호출해도 saveScene 미호출', async () => {
    const { result } = renderHook(() => useCCFileProject())
    // sceneFile null 상태에서 undo
    await act(async () => { await result.current.undo() })
    expect(mockApi.ccFileSaveScene).not.toHaveBeenCalled()
  })

  it('undo → redo 후 canRedo=false', async () => {
    const { result } = await setupWithScene()
    const modRoot = makeNode('root')

    mockApi.ccFileSaveScene.mockResolvedValue({ success: true })
    mockApi.ccFileReadScene.mockResolvedValue(makeSceneFile())

    await act(async () => { await result.current.saveScene(modRoot) })
    await act(async () => { await result.current.undo() })
    expect(result.current.canRedo).toBe(true)

    await act(async () => { await result.current.redo() })
    expect(result.current.canRedo).toBe(false)
    expect(result.current.canUndo).toBe(true)
  })

  it('saveScene 실패 (conflict) 시 conflictInfo 설정', async () => {
    const { result } = await setupWithScene()
    mockApi.ccFileSaveScene.mockResolvedValue({ success: false, conflict: true, error: 'file changed' })

    const newRoot = makeNode('root')
    await act(async () => { await result.current.saveScene(newRoot) })

    expect(result.current.conflictInfo).not.toBeNull()
  })

  it('undoCount가 50 초과 시 스택 50개 제한', async () => {
    const info = makeProjectInfo()
    const sf = makeSceneFile()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    mockApi.ccFileReadScene.mockResolvedValue(sf)
    mockApi.ccFileSaveScene.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.openProject() })
    await act(async () => { await result.current.loadScene(sf.scenePath) })

    for (let i = 0; i < 55; i++) {
      await act(async () => { await result.current.saveScene(makeNode('root')) })
    }

    expect(result.current.undoCount).toBeLessThanOrEqual(50)
  })
})

// ── clearProject ───────────────────────────────────────────────────────────────

describe('useCCFileProject — clearProject', () => {
  it('clearProject 호출 시 projectInfo/sceneFile/error 초기화', async () => {
    const info = makeProjectInfo()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.openProject() })

    expect(result.current.projectInfo).not.toBeNull()

    act(() => { result.current.clearProject() })

    expect(result.current.projectInfo).toBeNull()
    expect(result.current.sceneFile).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

// ── forceOverwrite ─────────────────────────────────────────────────────────────

describe('useCCFileProject — forceOverwrite (R1437)', () => {
  it('conflictInfo 없으면 forceOverwrite 에러 반환', async () => {
    const { result } = renderHook(() => useCCFileProject())
    let res: { success: boolean; error?: string } = { success: true }
    await act(async () => { res = await result.current.forceOverwrite() })
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('sceneFile 없으면 forceOverwrite 에러 반환', async () => {
    const { result } = renderHook(() => useCCFileProject())
    let res: { success: boolean; error?: string } = { success: true }
    await act(async () => { res = await result.current.forceOverwrite() })
    expect(res.success).toBe(false)
  })
})

// ── restoreBackup ──────────────────────────────────────────────────────────────

describe('useCCFileProject — restoreBackup', () => {
  it('sceneFile 없으면 restoreBackup 실패 반환', async () => {
    const { result } = renderHook(() => useCCFileProject())
    let res: { success: boolean; error?: string } = { success: true }
    await act(async () => { res = await result.current.restoreBackup() })
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('sceneFile 있으면 ccFileRestoreBackup 호출', async () => {
    const info = makeProjectInfo()
    const sf = makeSceneFile()
    mockApi.ccFileOpenProject.mockResolvedValue(info)
    mockApi.ccFileReadScene.mockResolvedValue(sf)
    mockApi.ccFileRestoreBackup.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useCCFileProject())
    await act(async () => { await result.current.openProject() })
    await act(async () => { await result.current.loadScene(sf.scenePath) })

    let res: { success: boolean; error?: string } = { success: false }
    await act(async () => { res = await result.current.restoreBackup() })

    expect(mockApi.ccFileRestoreBackup).toHaveBeenCalledWith(sf.scenePath)
    expect(res.success).toBe(true)
  })
})

// ── 반환값 검증 ────────────────────────────────────────────────────────────────

describe('useCCFileProject — 초기 상태', () => {
  it('초기 상태: 모두 null/false', () => {
    const { result } = renderHook(() => useCCFileProject())
    expect(result.current.projectInfo).toBeNull()
    expect(result.current.sceneFile).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(result.current.undoCount).toBe(0)
    expect(result.current.redoCount).toBe(0)
    expect(result.current.conflictInfo).toBeNull()
    expect(result.current.externalChange).toBeNull()
  })

  it('반환 함수들이 모두 존재', () => {
    const { result } = renderHook(() => useCCFileProject())
    expect(typeof result.current.openProject).toBe('function')
    expect(typeof result.current.detectProject).toBe('function')
    expect(typeof result.current.loadScene).toBe('function')
    expect(typeof result.current.saveScene).toBe('function')
    expect(typeof result.current.undo).toBe('function')
    expect(typeof result.current.redo).toBe('function')
    expect(typeof result.current.restoreBackup).toBe('function')
    expect(typeof result.current.forceOverwrite).toBe('function')
    expect(typeof result.current.clearProject).toBe('function')
  })
})
