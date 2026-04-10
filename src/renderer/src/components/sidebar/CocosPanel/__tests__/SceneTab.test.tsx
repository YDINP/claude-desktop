import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'

// ── 모킹 (vi.mock은 호이스팅 필요 — 최상단 배치) ──────────────────────────────

vi.mock('@renderer/utils/i18n', () => ({
  t: (_key: string, fallback?: string) => fallback ?? _key,
}))

vi.mock('@renderer/components/sidebar/CocosPanel/SceneTree', () => ({
  VirtualSceneTree: () => React.createElement('div', { 'data-testid': 'virtual-scene-tree' }),
}))

vi.mock('@renderer/components/sidebar/CocosPanel/TreeSearch', () => ({
  TreeSearch: () => React.createElement('input', { 'data-testid': 'tree-search' }),
}))

vi.mock('@renderer/components/sidebar/SceneView/CCFileSceneView', () => ({
  CCFileSceneView: () => React.createElement('div', { 'data-testid': 'cc-file-scene-view' }),
}))

vi.mock('@renderer/components/sidebar/CocosPanel/BatchInspector', () => ({
  CCFileBatchInspector: () => React.createElement('div', { 'data-testid': 'batch-inspector' }),
}))

vi.mock('@renderer/components/sidebar/CocosPanel/NodeInspector', () => ({
  CCFileNodeInspector: () => React.createElement('div', { 'data-testid': 'node-inspector' }),
}))

vi.mock('@renderer/components/sidebar/CocosPanel/HierarchyPanel', () => ({
  HierarchyPanel: () => React.createElement('div', { 'data-testid': 'hierarchy-panel' }),
}))

vi.mock('@renderer/components/sidebar/CocosPanel/AssetBrowser', () => ({
  CCFileAssetBrowser: () => React.createElement('div', { 'data-testid': 'asset-browser' }),
}))

vi.mock('@renderer/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    features: { 'cc.batchInspector': true, 'cc.assetBrowser': false },
  }),
}))

// SceneTab 을 mock 설정 이후에 import
import { SceneTabContent } from '../SceneTab'

// ── localStorage mock ──────────────────────────────────────────────────────────
beforeAll(() => {
  const store: Record<string, string> = {}
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
      clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
    },
    writable: true,
    configurable: true,
  })
})

// ── helpers ────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, children: CCSceneNode[] = []): CCSceneNode {
  return {
    uuid, name: uuid, active: true,
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 }, opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [], children,
  }
}

function makeSceneFile(root: CCSceneNode): CCSceneFile {
  return {
    scenePath: '/test/scene.fire',
    projectInfo: { version: '2x', projectPath: '/test', detected: true },
    root,
  }
}

const rootNode = makeNode('root', [makeNode('child1'), makeNode('child2')])

type PartialCtx = Parameters<typeof SceneTabContent>[0]['ctx']

function makeCtx(overrides: Partial<PartialCtx> = {}): PartialCtx {
  const hDividerDragRef = { current: null as { startX: number; startW: number } | null }
  const dividerDragRef = { current: null as { startX: number; startH: number } | null }
  const assetDividerDragRef = { current: null as { startX: number; startW: number } | null }
  return {
    sceneFile: makeSceneFile(rootNode),
    saveScene: vi.fn().mockResolvedValue({ success: true }),
    hDividerDragRef,
    dividerDragRef,
    hierarchyWidth: 200,
    setHierarchyWidth: vi.fn(),
    sceneViewHeight: 400,
    setSceneViewHeight: vi.fn(),
    multiSelectedUuids: [],
    setMultiSelectedUuids: vi.fn(),
    lockedUuids: new Set<string>(),
    setLockedUuids: vi.fn(),
    lastDiffDisplay: null,
    pinnedNodes: [],
    togglePinNode: vi.fn(),
    dupeOffsetX: 20,
    dupeOffsetY: -20,
    saveDupeOffset: vi.fn(),
    pulseUuid: null,
    setPulseUuid: vi.fn(),
    inspectorScrollRef: { current: null },
    toggleLocked: vi.fn(),
    handleRenameInView: vi.fn(),
    handleReorder: vi.fn(),
    handleReorderExtreme: vi.fn(),
    handleNodeMove: vi.fn(),
    handleNodeResize: vi.fn(),
    handleNodeRotate: vi.fn(),
    handleNodeOpacity: vi.fn(),
    handleAnchorMove: vi.fn(),
    handleMultiMove: vi.fn(),
    handleMultiDelete: vi.fn(),
    handleLabelEdit: vi.fn(),
    handleAddNode: vi.fn(),
    handleDuplicate: vi.fn(),
    handleToggleActive: vi.fn(),
    handleGroupNodes: vi.fn(),
    handleAltDrag: vi.fn(),
    nodeHistory: [],
    collapsedUuids: new Set<string>(),
    showAssetPanel: false,
    assetPanelWidth: 200,
    setAssetPanelWidth: vi.fn(),
    assetDividerDragRef,
    projectInfo: { version: '2x', projectPath: '/test', detected: true, scenes: [] },
    ...overrides,
  } as unknown as PartialCtx
}

// ── sceneFile null 처리 ────────────────────────────────────────────────────────

describe('SceneTabContent — 기본 렌더링', () => {
  it('sceneFile null 이면 null 반환', () => {
    const ctx = makeCtx({ sceneFile: null })
    const { container } = render(
      <SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('씬 파일이 있으면 HierarchyPanel이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByTestId('hierarchy-panel')).toBeTruthy()
  })

  it('씬 파일이 있으면 CCFileSceneView가 렌더링된다', () => {
    const ctx = makeCtx()
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByTestId('cc-file-scene-view')).toBeTruthy()
  })
})

// ── lastDiffDisplay ────────────────────────────────────────────────────────────

describe('SceneTabContent — lastDiffDisplay 배너', () => {
  it('lastDiffDisplay가 있으면 배너가 표시된다', () => {
    const ctx = makeCtx({ lastDiffDisplay: '2개 변경됨' })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/2개 변경됨/)).toBeTruthy()
  })

  it('lastDiffDisplay null이면 배너 없음', () => {
    const ctx = makeCtx({ lastDiffDisplay: null })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByText(/변경됨/)).toBeNull()
  })
})

// ── 핀 노드 바 (R2474) ────────────────────────────────────────────────────────

describe('SceneTabContent — 핀 노드 바 (R2474)', () => {
  it('pinnedNodes가 있으면 📌 바가 표시된다', () => {
    const ctx = makeCtx({ pinnedNodes: [{ uuid: 'p1', name: 'PinnedNode' }] })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText('📌')).toBeTruthy()
    expect(screen.getByText('PinnedNode')).toBeTruthy()
  })

  it('pinnedNodes가 없으면 📌 바 없음', () => {
    const ctx = makeCtx({ pinnedNodes: [] })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByText('📌')).toBeNull()
  })

  it('핀 노드 클릭 시 해당 노드로 onSelectNode 호출', () => {
    const onSelectNode = vi.fn()
    const sceneFile = makeSceneFile(rootNode)
    const ctx = makeCtx({
      sceneFile,
      pinnedNodes: [{ uuid: 'child1', name: 'child1' }],
    })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={onSelectNode} />)
    fireEvent.click(screen.getByText('child1'))
    expect(onSelectNode).toHaveBeenCalledWith(rootNode.children[0])
  })
})

// ── Inspector 패널 ────────────────────────────────────────────────────────────

describe('SceneTabContent — Inspector 패널', () => {
  it('selectedNode가 있으면 NodeInspector가 표시된다', () => {
    const ctx = makeCtx()
    render(
      <SceneTabContent ctx={ctx} selectedNode={rootNode.children[0]} onSelectNode={vi.fn()} />
    )
    expect(screen.getByTestId('node-inspector')).toBeTruthy()
  })

  it('selectedNode null이면 NodeInspector 없음', () => {
    const ctx = makeCtx()
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByTestId('node-inspector')).toBeNull()
  })

  it('multiSelectedUuids > 1이면 BatchInspector 표시', () => {
    const ctx = makeCtx({ multiSelectedUuids: ['child1', 'child2'] })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByTestId('batch-inspector')).toBeTruthy()
  })

  it('multiSelectedUuids <= 1이면 BatchInspector 없음', () => {
    const ctx = makeCtx({ multiSelectedUuids: ['child1'] })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.queryByTestId('batch-inspector')).toBeNull()
  })
})

// ── 복제 오프셋 바 (R2488) ────────────────────────────────────────────────────

describe('SceneTabContent — 복제 오프셋 바 (R2488)', () => {
  it('복제 오프셋 X/Y 입력 필드가 렌더링된다', () => {
    const ctx = makeCtx({ dupeOffsetX: 30, dupeOffsetY: -15 })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
    const xInput = inputs.find(i => Number(i.value) === 30)
    const yInput = inputs.find(i => Number(i.value) === -15)
    expect(xInput).toBeTruthy()
    expect(yInput).toBeTruthy()
  })

  it('복제 오프셋 X 변경 시 saveDupeOffset 호출', () => {
    const saveDupeOffset = vi.fn()
    const ctx = makeCtx({ dupeOffsetX: 20, dupeOffsetY: -20, saveDupeOffset })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
    const xInput = inputs.find(i => Number(i.value) === 20)!
    fireEvent.change(xInput, { target: { value: '50' } })
    expect(saveDupeOffset).toHaveBeenCalledWith(50, -20)
  })

  it('프리셋 0 버튼이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByTitle('Δ0px')).toBeTruthy()
  })

  it('프리셋 20 버튼 클릭 시 saveDupeOffset(20, 20) 호출', () => {
    const saveDupeOffset = vi.fn()
    const ctx = makeCtx({ saveDupeOffset })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Δ20px'))
    expect(saveDupeOffset).toHaveBeenCalledWith(20, 20)
  })
})

// ── 리사이즈 핸들 ─────────────────────────────────────────────────────────────

describe('SceneTabContent — 리사이즈 핸들', () => {
  it('선택된 노드가 있으면 Inspector 리사이즈 핸들이 표시된다', () => {
    const ctx = makeCtx()
    const { container } = render(
      <SceneTabContent ctx={ctx} selectedNode={rootNode.children[0]} onSelectNode={vi.fn()} />
    )
    const handles = container.querySelectorAll('[style*="ew-resize"]')
    expect(handles.length).toBeGreaterThan(0)
  })
})

// ── 최근 노드 히스토리 (선택 없을 때) ────────────────────────────────────────

describe('SceneTabContent — 최근 노드 히스토리', () => {
  it('nodeHistory > 1이고 selectedNode null이면 최근 선택 패널 표시', () => {
    const ctx = makeCtx({
      nodeHistory: ['child1', 'child2'],
    })
    render(<SceneTabContent ctx={ctx} selectedNode={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/최근 선택/)).toBeTruthy()
  })

  it('selectedNode가 있으면 최근 선택 패널 없음', () => {
    const ctx = makeCtx({ nodeHistory: ['child1', 'child2'] })
    render(
      <SceneTabContent ctx={ctx} selectedNode={rootNode.children[0]} onSelectNode={vi.fn()} />
    )
    expect(screen.queryByText(/최근 선택/)).toBeNull()
  })
})
