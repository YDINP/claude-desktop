import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import type { CCSceneFile, CCSceneNode } from '@shared/ipc-schema'

// ── 무거운 의존성 mock ──────────────────────────────────────────────────────────

vi.mock('../AssetThumbnailPopup', () => ({
  AssetThumbnailPopup: () => null,
}))

vi.mock('../TreeSearch', () => ({
  TreeSearch: () => null,
}))

import { CCFileAssetBrowser } from '../AssetBrowser'

// ── helpers ────────────────────────────────────────────────────────────────────

type AssetMap = Record<string, { uuid: string; path: string; relPath: string; type: string }>

function makeAssets(): AssetMap {
  return {
    uuid1: { uuid: 'uuid1', path: '/proj/assets/ui/bg.png', relPath: 'ui/bg.png', type: 'texture' },
    uuid2: { uuid: 'uuid2', path: '/proj/assets/prefabs/Enemy.prefab', relPath: 'prefabs/Enemy.prefab', type: 'prefab' },
    uuid3: { uuid: 'uuid3', path: '/proj/assets/scripts/Player.ts', relPath: 'scripts/Player.ts', type: 'script' },
    uuid4: { uuid: 'uuid4', path: '/proj/assets/scenes/Main.fire', relPath: 'scenes/Main.fire', type: 'scene' },
    uuid5: { uuid: 'uuid5', path: '/proj/assets/audio/bgm.mp3', relPath: 'audio/bgm.mp3', type: 'audio' },
  }
}

// prefab 그룹만 있는 에셋 (기본 expanded = prefab)
function makePrefabOnlyAssets(): AssetMap {
  return {
    uuid2: { uuid: 'uuid2', path: '/proj/assets/prefabs/Enemy.prefab', relPath: 'prefabs/Enemy.prefab', type: 'prefab' },
    uuid6: { uuid: 'uuid6', path: '/proj/assets/prefabs/Boss.prefab', relPath: 'prefabs/Boss.prefab', type: 'prefab' },
  }
}

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

function makeSceneFile(): CCSceneFile {
  return {
    scenePath: '/proj/scenes/Main.fire',
    projectInfo: { version: '2x', projectPath: '/proj', detected: true },
    root: makeNode(),
  }
}

const defaultProps = {
  assetsDir: '/proj/assets',
  saveScene: vi.fn().mockResolvedValue({ success: true }),
  onSelectNode: vi.fn(),
  showProjectWizard: false,
  setShowProjectWizard: vi.fn(),
  wizardStep: 1 as const,
  setWizardStep: vi.fn(),
  wizardProjectName: '',
  setWizardProjectName: vi.fn(),
  wizardSavePath: '',
  setWizardSavePath: vi.fn(),
  wizardCCVersion: '2x' as const,
  setWizardCCVersion: vi.fn(),
  wizardTemplate: 'empty' as const,
  setWizardTemplate: vi.fn(),
  wizardCreating: false,
  wizardError: null,
  handleCreateProject: vi.fn(),
  jsonCopiedName: null,
}

// ── window.api mock ─────────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: {
      ccFileBuildUUIDMap: vi.fn(),
      readFile: vi.fn(),
    },
    writable: true,
    configurable: true,
  })
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ── helper: waitFor prefab group to be visible ─────────────────────────────────
// prefab 그룹은 기본 expanded 상태

async function waitForPrefab() {
  await waitFor(() => screen.getByText('Enemy.prefab'))
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('CCFileAssetBrowser', () => {
  it('shows loading state while scanning', () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    render(<CCFileAssetBrowser {...defaultProps} />)
    expect(screen.getByText(/에셋 스캔 중/)).toBeTruthy()
  })

  it('shows empty state when no assets', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue({})
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/에셋을 찾을 수 없습니다/)).toBeTruthy()
    })
  })

  it('renders asset group headers after loading', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Prefab')).toBeTruthy()
      expect(screen.getByText('Texture')).toBeTruthy()
      expect(screen.getByText('Script')).toBeTruthy()
    })
  })

  it('renders prefab items (default expanded group)', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitForPrefab()
    expect(screen.getByText('Enemy.prefab')).toBeTruthy()
  })

  it('shows total asset count', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/5개 에셋/)).toBeTruthy()
    })
  })

  it('search filters assets by name (prefab visible by default)', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitForPrefab()

    const searchInput = screen.getByPlaceholderText('에셋 검색...')
    fireEvent.change(searchInput, { target: { value: 'Enemy' } })

    // Enemy.prefab stays, Boss.prefab removed (not in makeAssets), other groups hidden
    expect(screen.getByText('Enemy.prefab')).toBeTruthy()
    // texture, audio groups should disappear from results
    expect(screen.queryByText('Audio')).toBeNull()
  })

  it('search is case insensitive', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitForPrefab()

    const searchInput = screen.getByPlaceholderText('에셋 검색...')
    fireEvent.change(searchInput, { target: { value: 'ENEMY' } })

    expect(screen.getByText('Enemy.prefab')).toBeTruthy()
  })

  it('search clear restores all groups', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitForPrefab()

    const searchInput = screen.getByPlaceholderText('에셋 검색...')
    fireEvent.change(searchInput, { target: { value: 'Enemy' } })
    // Audio group gone
    expect(screen.queryByText('Audio')).toBeNull()

    fireEvent.change(searchInput, { target: { value: '' } })
    await waitFor(() => {
      expect(screen.getByText('Audio')).toBeTruthy()
    })
  })

  it('can switch to tree view mode', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitForPrefab()

    const treeBtn = screen.getByTitle('폴더 트리 뷰로 전환')
    fireEvent.click(treeBtn)
    // Tree mode shows folder icons
    expect(document.body.textContent).toContain('폴더별')
  })

  it('group toggle collapses the prefab group', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makePrefabOnlyAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitFor(() => screen.getByText('Enemy.prefab'))

    // Click group header to collapse
    const prefabHeader = screen.getByText('Prefab')
    fireEvent.click(prefabHeader)
    expect(screen.queryByText('Enemy.prefab')).toBeNull()

    // Click again to expand
    fireEvent.click(screen.getByText('Prefab'))
    await waitFor(() => {
      expect(screen.getByText('Enemy.prefab')).toBeTruthy()
    })
  })

  it('filters out .meta files from asset list', async () => {
    const assetsWithMeta = {
      ...makeAssets(),
      meta1: { uuid: 'meta1', path: '/proj/assets/ui/bg.png.meta', relPath: 'ui/bg.png.meta', type: 'texture' },
    }
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(assetsWithMeta)
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitForPrefab()

    // bg.png.meta should not appear in the list (even if texture group opened)
    expect(screen.queryByText('bg.png.meta')).toBeNull()
  })

  it('renders with sceneFile — prefab + button visible', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} sceneFile={makeSceneFile()} />)
    await waitForPrefab()
    // + button for instantiate appears
    expect(screen.getByText('Enemy.prefab')).toBeTruthy()
    const plusBtn = screen.getByTitle('씬에 추가')
    expect(plusBtn).toBeTruthy()
  })

  it('dispatches cc:open-file event on double click', async () => {
    ;(window.api.ccFileBuildUUIDMap as ReturnType<typeof vi.fn>).mockResolvedValue(makeAssets())
    render(<CCFileAssetBrowser {...defaultProps} />)
    await waitForPrefab()

    const dispatched: string[] = []
    const handler = (e: Event) => { dispatched.push((e as CustomEvent).detail) }
    window.addEventListener('cc:open-file', handler)

    try {
      const itemEl = screen.getByText('Enemy.prefab').closest('[draggable]')!
      fireEvent.dblClick(itemEl)
      expect(dispatched.length).toBe(1)
      expect(dispatched[0]).toContain('Enemy.prefab')
    } finally {
      window.removeEventListener('cc:open-file', handler)
    }
  })
})
