import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import type { CCSceneFile, CCSceneNode } from '@shared/ipc-schema'
import type { UseCCFileProjectUIReturn } from '../useCCFileProjectUI'
import { ProjectHeaderSection } from '../ProjectHeader'
import { ProjectToolbarSection } from '../ProjectToolbar'

// ── window.api mock ─────────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: {
      ccFileListBakFiles: vi.fn().mockResolvedValue([]),
      ccFileRestoreFromBak: vi.fn().mockResolvedValue({ success: true }),
      ccFileDeleteAllBakFiles: vi.fn().mockResolvedValue(undefined),
      ccFileSaveAs: vi.fn(),
      writeTextFile: vi.fn(),
    },
    writable: true,
    configurable: true,
  })
})

// ── helpers ────────────────────────────────────────────────────────────────────

function makeNode(uuid = 'root'): CCSceneNode {
  return {
    uuid, name: uuid, active: true,
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 }, opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [], children: [],
  }
}

function makeSceneFile(overrides: Partial<CCSceneFile> = {}): CCSceneFile {
  return {
    scenePath: '/proj/scenes/Main.fire',
    projectInfo: { version: '2x', projectPath: '/proj', detected: true },
    root: makeNode(),
    ...overrides,
  }
}

type PartialCtx = UseCCFileProjectUIReturn

function makeCtx(overrides: Partial<PartialCtx> = {}): PartialCtx {
  return {
    projectInfo: { version: '2x', projectPath: '/proj', detected: true, scenes: [] },
    sceneFile: null,
    loading: false,
    error: null,
    externalChange: false,
    conflictInfo: null,
    detectProject: vi.fn(),
    loadScene: vi.fn(),
    saveScene: vi.fn().mockResolvedValue({ success: true }),
    undo: vi.fn(),
    redo: vi.fn(),
    forceOverwrite: vi.fn(),
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
    favProjects: [],
    isFav: vi.fn().mockReturnValue(false),
    toggleFav: vi.fn(),
    saveMsg: null,
    setSaveMsg: vi.fn(),
    saving: false,
    handleSave: vi.fn(),
    handleRestore: vi.fn(),
    bannerHidden: false,
    setBannerHidden: vi.fn(),
    autoReload: false,
    setAutoReload: vi.fn(),
    showNewSceneForm: false,
    setShowNewSceneForm: vi.fn(),
    newSceneName: '',
    setNewSceneName: vi.fn(),
    newSceneTemplate: 'empty',
    setNewSceneTemplate: vi.fn(),
    handleCreateScene: vi.fn(),
    showProjectSettings: false,
    setShowProjectSettings: vi.fn(),
    projectSettings: {},
    globalSearchOpen: false,
    setGlobalSearchOpen: vi.fn(),
    globalSearchQuery: '',
    setGlobalSearchQuery: vi.fn(),
    globalSearchResults: [],
    setGlobalSearchResults: vi.fn(),
    globalSearchInputRef: { current: null },
    globalSearchCompFilter: '',
    setGlobalSearchCompFilter: vi.fn(),
    filteredGlobalResults: [],
    runGlobalSearch: vi.fn(),
    expandToNode: vi.fn(),
    multiSelectedUuids: [],
    setMultiSelectedUuids: vi.fn(),
    sceneHistoryTimeline: [],
    showFullHistory: false,
    setShowFullHistory: vi.fn(),
    wizardProjectName: '',
    setWizardProjectName: vi.fn(),
    wizardSavePath: '',
    setWizardSavePath: vi.fn(),
    wizardCCVersion: '2x',
    setWizardCCVersion: vi.fn(),
    wizardTemplate: 'empty',
    setWizardTemplate: vi.fn(),
    wizardCreating: false,
    wizardError: null,
    handleCreateProject: vi.fn(),
    ...overrides,
  } as unknown as PartialCtx
}

// ════════════════════════════════════════════════════════════════════════════════
// ProjectHeaderSection
// ════════════════════════════════════════════════════════════════════════════════

describe('ProjectHeaderSection', () => {
  it('renders without crashing (no sceneFile, no externalChange)', () => {
    render(
      <ProjectHeaderSection
        ctx={makeCtx()}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    // No error thrown — component renders empty/minimal
  })

  it('shows external change banner when externalChange=true and sceneFile present', () => {
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ externalChange: true, sceneFile: makeSceneFile(), bannerHidden: false })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    expect(screen.getByText(/파일이 외부에서 수정됨/)).toBeTruthy()
  })

  it('hides external change banner when bannerHidden=true', () => {
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ externalChange: true, sceneFile: makeSceneFile(), bannerHidden: true })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    expect(screen.queryByText(/파일이 외부에서 수정됨/)).toBeNull()
  })

  it('calls loadScene when reload button clicked', () => {
    const loadScene = vi.fn()
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ externalChange: true, sceneFile: makeSceneFile(), bannerHidden: false, loadScene })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('다시 로드'))
    expect(loadScene).toHaveBeenCalledWith('/proj/scenes/Main.fire')
  })

  it('calls setBannerHidden when close banner button clicked', () => {
    const setBannerHidden = vi.fn()
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ externalChange: true, sceneFile: makeSceneFile(), bannerHidden: false, setBannerHidden })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    // close button is 'x'
    const closeBtn = screen.getAllByText('x').find(el => el.tagName === 'BUTTON')
    fireEvent.click(closeBtn!)
    expect(setBannerHidden).toHaveBeenCalledWith(true)
  })

  it('shows conflict dialog when conflictInfo present', () => {
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ conflictInfo: { path: '/proj/scenes/Main.fire' }, sceneFile: makeSceneFile() })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    expect(screen.getByText(/파일이 외부에서 변경됨/)).toBeTruthy()
    expect(screen.getByText('덮어쓰기')).toBeTruthy()
  })

  it('calls forceOverwrite when 덮어쓰기 clicked', () => {
    const forceOverwrite = vi.fn()
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ conflictInfo: { path: '/proj/scenes/Main.fire' }, sceneFile: makeSceneFile(), forceOverwrite })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('덮어쓰기'))
    expect(forceOverwrite).toHaveBeenCalledTimes(1)
  })

  it('renders favorite project tabs', () => {
    render(
      <ProjectHeaderSection
        ctx={makeCtx({
          favProjects: ['/proj/GameA', '/proj/GameB'],
          projectInfo: { version: '2x', projectPath: '/proj/GameA', detected: true, scenes: [] },
        })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    expect(screen.getByText('GameA')).toBeTruthy()
    expect(screen.getByText('GameB')).toBeTruthy()
  })

  it('calls detectProject when inactive favorite tab clicked', () => {
    const detectProject = vi.fn()
    render(
      <ProjectHeaderSection
        ctx={makeCtx({
          favProjects: ['/proj/GameA', '/proj/GameB'],
          projectInfo: { version: '2x', projectPath: '/proj/GameA', detected: true, scenes: [] },
          detectProject,
        })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('GameB'))
    expect(detectProject).toHaveBeenCalledWith('/proj/GameB')
  })

  it('shows global search overlay when globalSearchOpen=true', () => {
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ globalSearchOpen: true })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText(/노드 이름/)).toBeTruthy()
  })

  it('calls setGlobalSearchOpen(false) on Escape in search', () => {
    const setGlobalSearchOpen = vi.fn()
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ globalSearchOpen: true, setGlobalSearchOpen })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    fireEvent.keyDown(screen.getByPlaceholderText(/노드 이름/), { key: 'Escape' })
    expect(setGlobalSearchOpen).toHaveBeenCalledWith(false)
  })

  it('shows extension installed banner', () => {
    render(
      <ProjectHeaderSection
        ctx={makeCtx({
          projectInfo: {
            version: '2x', projectPath: '/proj', detected: true, scenes: [],
            extensionStatus: 'installed', extensionVersion: '1.2.3',
          },
        })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    expect(screen.getByText(/익스텐션.*설치.*완료/)).toBeTruthy()
  })

  it('shows new scene form when showNewSceneForm=true', () => {
    render(
      <ProjectHeaderSection
        ctx={makeCtx({ showNewSceneForm: true, projectInfo: { version: '2x', projectPath: '/proj', detected: true, scenes: [] } })}
        selectedNode={null}
        onSelectNode={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('씬 이름')).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// ProjectToolbarSection
// ════════════════════════════════════════════════════════════════════════════════

describe('ProjectToolbarSection', () => {
  it('renders nothing for save/undo buttons when sceneFile has no root', () => {
    const ctx = makeCtx({ sceneFile: { scenePath: '/proj/scenes/Main.fire', projectInfo: { version: '2x', projectPath: '/proj', detected: true } } as CCSceneFile })
    render(<ProjectToolbarSection ctx={ctx} />)
    expect(screen.queryByText(/저장/)).toBeNull()
  })

  it('renders save and undo/redo buttons when sceneFile.root exists', () => {
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile() })} />)
    expect(screen.getByTitle(/씬 파일 저장/)).toBeTruthy()
    expect(screen.getByTitle(/실행 취소/)).toBeTruthy()
    expect(screen.getByTitle(/다시 실행/)).toBeTruthy()
  })

  it('calls handleSave on save button click', () => {
    const handleSave = vi.fn()
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), handleSave })} />)
    fireEvent.click(screen.getByTitle(/씬 파일 저장/))
    expect(handleSave).toHaveBeenCalledTimes(1)
  })

  it('disables save button when saving=true', () => {
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), saving: true })} />)
    const saveBtn = screen.getByTitle(/씬 파일 저장/) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })

  it('calls undo on undo button click', () => {
    const undo = vi.fn()
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), canUndo: true, undo })} />)
    fireEvent.click(screen.getByTitle(/실행 취소/))
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('disables undo button when canUndo=false', () => {
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), canUndo: false })} />)
    const btn = screen.getByTitle(/실행 취소/) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('calls redo on redo button click', () => {
    const redo = vi.fn()
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), canRedo: true, redo })} />)
    fireEvent.click(screen.getByTitle(/다시 실행/))
    expect(redo).toHaveBeenCalledTimes(1)
  })

  it('shows saveMsg text when saveMsg is set', () => {
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), saveMsg: { ok: true, text: '저장 완료!' } })} />)
    expect(screen.getByText('저장 완료!')).toBeTruthy()
  })

  it('shows error text when error is set', () => {
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), error: '씬 로드 실패' })} />)
    expect(screen.getByText('씬 로드 실패')).toBeTruthy()
  })

  it('shows undo count when undoCount > 0', () => {
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), canUndo: true, undoCount: 5 })} />)
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('shows redo count when redoCount > 0', () => {
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), canRedo: true, redoCount: 3 })} />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('shows scene history timeline when entries exist', () => {
    const timeline = [
      { timestamp: Date.now() - 60000, nodeCount: 10, size: 2048, snapshotKey: 'snap-1' },
    ]
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), sceneHistoryTimeline: timeline })} />)
    expect(screen.getByText('저장 이력')).toBeTruthy()
    expect(screen.getByText(/10N/)).toBeTruthy()
  })

  it('shows "더 보기" button when timeline has more than 5 entries', () => {
    const timeline = Array.from({ length: 8 }, (_, i) => ({
      timestamp: Date.now() - i * 60000,
      nodeCount: i,
      size: 1024,
      snapshotKey: `snap-${i}`,
    }))
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile(), sceneHistoryTimeline: timeline })} />)
    expect(screen.getByText(/더 보기 \(8\)/)).toBeTruthy()
  })

  it('BackupManager renders inside toolbar when scenePath present', () => {
    render(<ProjectToolbarSection ctx={makeCtx({ sceneFile: makeSceneFile() })} />)
    // BackupManager renders the toggle button
    expect(screen.getByText(/백업 파일/)).toBeTruthy()
  })
})
