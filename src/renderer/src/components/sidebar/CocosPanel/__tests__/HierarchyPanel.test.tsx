import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { HierarchyPanel } from '../HierarchyPanel'

// ── 모킹 ───────────────────────────────────────────────────────────────────────

vi.mock('../../../utils/i18n', () => ({
  t: (_key: string, fallback?: string) => fallback ?? _key,
}))

vi.mock('../SceneTree', () => ({
  VirtualSceneTree: () => <div data-testid="virtual-scene-tree" />,
}))

vi.mock('../TreeSearch', () => ({
  TreeSearch: ({ onQueryChange }: { onQueryChange?: (q: string) => void }) => (
    <input
      data-testid="tree-search"
      onChange={e => onQueryChange?.(e.target.value)}
    />
  ),
}))

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: { shellExec: vi.fn() },
    writable: true,
    configurable: true,
  })
})

// ── helpers ────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, extra: Partial<CCSceneNode> = {}, children: CCSceneNode[] = []): CCSceneNode {
  return {
    uuid, name: uuid, active: true,
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 }, opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [], children,
    ...extra,
  }
}

function makeSceneFile(root: CCSceneNode, scenePath = '/test/scene.fire'): CCSceneFile {
  return {
    scenePath,
    projectInfo: { version: '2x', projectPath: '/test', detected: true },
    root,
  }
}

type PartialCtx = Parameters<typeof HierarchyPanel>[0]['ctx']

function makeCtx(overrides: Partial<PartialCtx> = {}): PartialCtx {
  const root = makeNode('root', {}, [makeNode('child1'), makeNode('child2')])
  return {
    sceneFile: makeSceneFile(root),
    projectInfo: { version: '2x', projectPath: '/test', detected: true, scenes: [] },
    prefabPickerOpen: false,
    setPrefabPickerOpen: vi.fn(),
    insertingPrefab: false,
    handleInsertPrefab: vi.fn(),
    expandAll: vi.fn(),
    collapseAll: vi.fn(),
    collapseToDepth: vi.fn(),
    hideInactive: false,
    setHideInactive: vi.fn(),
    nodeColors: {},
    colorTagFilter: null,
    setColorTagFilter: vi.fn(),
    nodeFilters: [],
    setNodeFilters: vi.fn(),
    showNodeFilters: false,
    setShowNodeFilters: vi.fn(),
    showLabelReplace: false,
    setShowLabelReplace: vi.fn(),
    labelFindText: '',
    setLabelFindText: vi.fn(),
    labelReplaceText: '',
    setLabelReplaceText: vi.fn(),
    labelReplaceMatches: [],
    handleLabelReplaceAll: vi.fn(),
    treeHighlightQuery: '',
    setTreeHighlightQuery: vi.fn(),
    recentNodes: [],
    nodeMap: new Map(),
    nodeBookmarks: {},
    setNodeBookmarks: vi.fn(),
    filteredRoot: null,
    favorites: new Set<string>(),
    toggleFavorite: vi.fn(),
    lockedUuids: new Set<string>(),
    toggleLocked: vi.fn(),
    collapsedUuids: new Set<string>(),
    setCollapsedUuids: vi.fn(),
    multiSelectedUuids: [],
    setMultiSelectedUuids: vi.fn(),
    outOfCanvasUuids: new Set<string>(),
    handleNodeColorChange: vi.fn(),
    handleReparent: vi.fn(),
    handleTreeAddChild: vi.fn(),
    handleTreeDelete: vi.fn(),
    handleTreeDuplicate: vi.fn(),
    handleTreeToggleActive: vi.fn(),
    handleReorder: vi.fn(),
    handleSortChildren: vi.fn(),
    handleRenameInView: vi.fn(),
    handleSaveAsPrefab: vi.fn(),
    showSceneStats: false,
    setShowSceneStats: vi.fn(),
    ...overrides,
  } as unknown as PartialCtx
}

// ── sceneFile null 처리 ────────────────────────────────────────────────────────

describe('HierarchyPanel — 기본 렌더링', () => {
  it('sceneFile null 이면 null 반환', () => {
    const ctx = makeCtx({ sceneFile: null })
    const { container } = render(
      <HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('씬 파일이 있으면 VirtualSceneTree가 렌더링된다', () => {
    const ctx = makeCtx()
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByTestId('virtual-scene-tree')).toBeTruthy()
  })

  it('TreeSearch가 렌더링된다', () => {
    const ctx = makeCtx()
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByTestId('tree-search')).toBeTruthy()
  })
})

// ── 씬 헤더 ────────────────────────────────────────────────────────────────────

describe('HierarchyPanel — 씬 헤더', () => {
  it('.scene 파일이면 "계층" 헤더가 표시된다', () => {
    const root = makeNode('root', {}, [])
    const ctx = makeCtx({ sceneFile: makeSceneFile(root, '/test/main.scene') })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/계층/)).toBeTruthy()
  })

  it('.prefab 파일이면 프리팹 배지가 표시된다', () => {
    const root = makeNode('root', {}, [])
    const ctx = makeCtx({ sceneFile: makeSceneFile(root, '/test/player.prefab') })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/프리팹/)).toBeTruthy()
  })
})

// ── 노드 통계 ──────────────────────────────────────────────────────────────────

describe('HierarchyPanel — 노드 통계', () => {
  it('노드 수와 컴포넌트 수가 표시된다', () => {
    const root = makeNode('root', {}, [makeNode('child1'), makeNode('child2')])
    const ctx = makeCtx({ sceneFile: makeSceneFile(root) })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    // 3N/0C 형태 (root + child1 + child2 = 3 nodes, 0 comps)
    expect(screen.getByText(/\d+N\/\d+C/)).toBeTruthy()
  })

  it('200개 이상 노드이면 경고 배지가 표시된다', () => {
    const children = Array.from({ length: 201 }, (_, i) => makeNode(`n${i}`))
    const root = makeNode('root', {}, children)
    const ctx = makeCtx({ sceneFile: makeSceneFile(root) })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByTitle(/노드 수 과다/)).toBeTruthy()
  })
})

// ── 헤더 버튼 ──────────────────────────────────────────────────────────────────

describe('HierarchyPanel — 헤더 버튼', () => {
  it('expandAll 버튼 클릭 시 expandAll 호출', () => {
    const expandAll = vi.fn()
    const ctx = makeCtx({ expandAll })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    const btn = screen.getByTitle(/전체 펼치기/)
    fireEvent.click(btn)
    expect(expandAll).toHaveBeenCalledOnce()
  })

  it('collapseAll 버튼 클릭 시 collapseAll 호출', () => {
    const collapseAll = vi.fn()
    const ctx = makeCtx({ collapseAll })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    const btn = screen.getByTitle(/전체 접기/)
    fireEvent.click(btn)
    expect(collapseAll).toHaveBeenCalledOnce()
  })

  it('D1/D2/D3 버튼이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText('D1')).toBeTruthy()
    expect(screen.getByText('D2')).toBeTruthy()
    expect(screen.getByText('D3')).toBeTruthy()
  })

  it('D2 버튼 클릭 시 collapseToDepth(2) 호출', () => {
    const collapseToDepth = vi.fn()
    const ctx = makeCtx({ collapseToDepth })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    fireEvent.click(screen.getByText('D2'))
    expect(collapseToDepth).toHaveBeenCalledWith(2)
  })

  it('hideInactive 토글 버튼이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    // ● 버튼 (hideInactive=false)
    const btn = screen.getByTitle(/비활성 노드/)
    expect(btn).toBeTruthy()
  })

  it('hideInactive 버튼 클릭 시 setHideInactive 호출', () => {
    const setHideInactive = vi.fn()
    const ctx = makeCtx({ setHideInactive })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    const btn = screen.getByTitle(/비활성 노드/)
    fireEvent.click(btn)
    expect(setHideInactive).toHaveBeenCalledOnce()
  })
})

// ── 컴포넌트 필터 ──────────────────────────────────────────────────────────────

describe('HierarchyPanel — 컴포넌트 필터', () => {
  it('showNodeFilters=true 이면 필터 패널이 표시된다', () => {
    const ctx = makeCtx({ showNodeFilters: true })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    // Label, Sprite 등 필터 칩 표시
    expect(screen.getByText('Label')).toBeTruthy()
    expect(screen.getByText('Sprite')).toBeTruthy()
  })

  it('showNodeFilters=false 이면 필터 패널이 없다', () => {
    const ctx = makeCtx({ showNodeFilters: false })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByText('Label')).toBeNull()
  })

  it('활성 필터가 있으면 초기화 버튼(✕)이 표시된다', () => {
    const ctx = makeCtx({ showNodeFilters: true, nodeFilters: ['cc.Label'] })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    // ✕ 초기화 버튼 title
    expect(screen.getByTitle(/필터 초기화/)).toBeTruthy()
  })
})

// ── Label Find & Replace 패널 ─────────────────────────────────────────────────

describe('HierarchyPanel — Label Find & Replace', () => {
  it('showLabelReplace=true 이면 찾기/바꿈 입력 필드가 표시된다', () => {
    const ctx = makeCtx({ showLabelReplace: true })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/찾기/)).toBeTruthy()
    expect(screen.getByText(/바꿈/)).toBeTruthy()
  })

  it('showLabelReplace=false 이면 패널이 없다', () => {
    const ctx = makeCtx({ showLabelReplace: false })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByText(/바꿈/)).toBeNull()
  })

  it('labelReplaceMatches가 있으면 전체 교체 버튼이 표시된다', () => {
    const ctx = makeCtx({
      showLabelReplace: true,
      labelFindText: 'test',
      labelReplaceMatches: [{ uuid: 'n1', original: 'test', replaced: 'new' }],
    })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/전체 교체/)).toBeTruthy()
  })

  it('전체 교체 버튼 클릭 시 handleLabelReplaceAll 호출', () => {
    const handleLabelReplaceAll = vi.fn()
    const ctx = makeCtx({
      showLabelReplace: true,
      labelFindText: 'hello',
      labelReplaceMatches: [{ uuid: 'n1', original: 'hello', replaced: 'world' }],
      handleLabelReplaceAll,
    })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    fireEvent.click(screen.getByText(/전체 교체/))
    expect(handleLabelReplaceAll).toHaveBeenCalledOnce()
  })
})

// ── 즐겨찾기 ───────────────────────────────────────────────────────────────────

describe('HierarchyPanel — 즐겨찾기', () => {
  it('favorites가 비어있으면 즐겨찾기 섹션 없음', () => {
    const ctx = makeCtx({ favorites: new Set() })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByText(/★ 즐겨찾기/)).toBeNull()
  })

  it('favorites에 uuid 있고 nodeMap에 있으면 즐겨찾기 표시', () => {
    const root = makeNode('root', {}, [makeNode('fav1')])
    const nodeMap = new Map<string, CCSceneNode>([
      ['fav1', root.children[0]],
    ])
    const ctx = makeCtx({
      sceneFile: makeSceneFile(root),
      favorites: new Set(['fav1']),
      nodeMap,
    })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/★ 즐겨찾기/)).toBeTruthy()
    expect(screen.getByText('fav1')).toBeTruthy()
  })

  it('즐겨찾기 노드 클릭 시 onSelectNode 호출', () => {
    const onSelectNode = vi.fn()
    const root = makeNode('root', {}, [makeNode('fav1')])
    const nodeMap = new Map<string, CCSceneNode>([['fav1', root.children[0]]])
    const ctx = makeCtx({
      sceneFile: makeSceneFile(root),
      favorites: new Set(['fav1']),
      nodeMap,
    })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={onSelectNode} />)
    fireEvent.click(screen.getByText('fav1'))
    expect(onSelectNode).toHaveBeenCalledWith(root.children[0])
  })
})

// ── 최근 노드 히스토리 ────────────────────────────────────────────────────────

describe('HierarchyPanel — 최근 노드 히스토리', () => {
  it('recentNodes > 1이면 히스토리 표시', () => {
    const root = makeNode('root', {}, [makeNode('n1'), makeNode('n2')])
    const nodeMap = new Map<string, CCSceneNode>([
      ['n1', root.children[0]],
      ['n2', root.children[1]],
    ])
    const ctx = makeCtx({
      sceneFile: makeSceneFile(root),
      recentNodes: [{ uuid: 'n2', name: 'n2' }, { uuid: 'n1', name: 'n1' }],
      nodeMap,
    })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    // ◷ 아이콘과 히스토리 칩 (slice(1)이므로 n1만 표시)
    expect(screen.getByText('◷')).toBeTruthy()
    expect(screen.getByText('n1')).toBeTruthy()
  })

  it('recentNodes <= 1이면 히스토리 없음', () => {
    const ctx = makeCtx({ recentNodes: [{ uuid: 'n1', name: 'n1' }] })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByText('◷')).toBeNull()
  })
})

// ── 노드 북마크 ────────────────────────────────────────────────────────────────

describe('HierarchyPanel — 노드 북마크 (R2345)', () => {
  it('북마크가 없으면 북마크 바 없음', () => {
    const ctx = makeCtx({ nodeBookmarks: {} })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByText('🔖')).toBeNull()
  })

  it('북마크 있으면 북마크 바 표시', () => {
    const root = makeNode('root', {}, [makeNode('bm1')])
    const nodeMap = new Map<string, CCSceneNode>([['bm1', root.children[0]]])
    const ctx = makeCtx({
      sceneFile: makeSceneFile(root),
      nodeBookmarks: { '1': 'bm1' },
      nodeMap,
    })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText('🔖')).toBeTruthy()
  })
})

// ── ab 버튼 (showLabelReplace 토글) ───────────────────────────────────────────

describe('HierarchyPanel — ab 버튼', () => {
  it('"ab" 버튼 클릭 시 setShowLabelReplace 호출', () => {
    const setShowLabelReplace = vi.fn()
    const ctx = makeCtx({ setShowLabelReplace })
    render(<HierarchyPanel ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    fireEvent.click(screen.getByText('ab'))
    expect(setShowLabelReplace).toHaveBeenCalledOnce()
  })
})
