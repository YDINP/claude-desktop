import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { NodeInspectorHeader } from '../NodeInspectorHeader'
import type { useNodeInspector } from '../useNodeInspector'

beforeAll(() => {
  Object.defineProperty(window, 'navigator', {
    value: {
      ...window.navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    },
    writable: true,
  })
})

// ── helpers ────────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return {
    uuid: 'test-uuid-1234', name: 'TestNode', active: true,
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 }, opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [], children: [],
    ...overrides,
  }
}

function makeSceneFile(root?: CCSceneNode): CCSceneFile {
  return {
    projectInfo: { detected: true, version: '2x', assetsDir: '/fake' },
    scenePath: '/fake/scene.fire',
    root: root ?? makeNode(),
  }
}

function makeCtx(node: CCSceneNode, overrides: Partial<ReturnType<typeof useNodeInspector>> = {}): ReturnType<typeof useNodeInspector> {
  return {
    draft: node,
    applyAndSave: vi.fn(),
    origSnapRef: { current: node } as React.MutableRefObject<CCSceneNode | null>,
    nodeMemo: '', saveNodeMemo: vi.fn(),
    msg: null, setMsg: vi.fn(),
    saving: false, setSaving: vi.fn(),
    isDirty: false, setIsDirty: vi.fn(),
    savedToast: false, setSavedToast: vi.fn(),
    undoStack: [], setUndoStack: vi.fn(),
    redoStack: [], setRedoStack: vi.fn(),
    copyDone: false, handleCopyTransform: vi.fn(), handlePasteTransform: vi.fn(),
    jsonCopyDone: false, handleCopyNodeJson: vi.fn(),
    handleUndo: vi.fn(), handleRedo: vi.fn(),
    handleAddChild: vi.fn(), handleDelete: vi.fn(), handleDuplicate: vi.fn(),
    propSearch: '', setPropSearch: vi.fn(),
    showPropSearch: false, setShowPropSearch: vi.fn(),
    dupeCount: 1, setDupeCount: vi.fn(),
    collapsed: {}, setCollapsed: vi.fn(),
    collapsedComps: new Set(), setCollapsedComps: vi.fn(),
    expandedArrayProps: new Set(), setExpandedArrayProps: vi.fn(),
    jsonEditMode: false, setJsonEditMode: vi.fn(),
    jsonEditText: '', setJsonEditText: vi.fn(),
    jsonEditErr: '', setJsonEditErr: vi.fn(),
    lockScale: false, setLockScale: vi.fn(),
    lockSize: false, setLockSize: vi.fn(),
    anchorCompensate: false, setAnchorCompensate: vi.fn(),
    sceneDepsTree: {}, setSceneDepsTree: vi.fn(),
    worldPos: null,
    showSceneDepsTree: false, setShowSceneDepsTree: vi.fn(),
    secHeader: (_key: string, label: string) => <div>{label}</div>,
    numInput: (_label: string, _val: number) => <div />,
    nodePath: [{ name: 'Root', uuid: 'root-uuid' }, { name: node.name, uuid: node.uuid }],
    siblings: [], inactiveAncestors: [],
    zOrderInfo: null,
    totalDescendants: 0,
    sameNameNodes: [node], sameNameCount: 1,
    showSameNameMenu: false, setShowSameNameMenu: vi.fn(),
    compTypeCountMap: {},
    handleZOrder: vi.fn(), handleZOrderEdge: vi.fn(),
    zOrderEditing: false, setZOrderEditing: vi.fn(),
    zOrderInputVal: '', setZOrderInputVal: vi.fn(), handleZOrderTo: vi.fn(),
    recentAddedComps: [], trackAddComp: vi.fn(),
    origSnapUuidRef: { current: null },
    setDraft: vi.fn(),
    compOrder: [], setCompOrder: vi.fn(),
    draggedComp: null, setDraggedComp: vi.fn(),
    colorPickerProp: null, setColorPickerProp: vi.fn(),
    changeHistory: [], setChangeHistory: vi.fn(),
    showHistory: false, setShowHistory: vi.fn(),
    depMap: {}, setDepMap: vi.fn(),
    compFilter: '', setCompFilter: vi.fn(),
    compFilterFocus: false, setCompFilterFocus: vi.fn(),
    scriptLogs: [], setScriptLogs: vi.fn(),
    changeNotifications: [], setChangeNotifications: vi.fn(),
    exportedTemplates: [], setExportedTemplates: vi.fn(),
    previewCache: {}, setPreviewCache: vi.fn(),
    showRichPreview: false, setShowRichPreview: vi.fn(),
    loadProgress: 0, setLoadProgress: vi.fn(),
    sceneDeps: [], setSceneDeps: vi.fn(),
    showSceneDeps: false, setShowSceneDeps: vi.fn(),
    prefabInstances: [], setPrefabInstances: vi.fn(),
    showPrefabStats: false, setShowPrefabStats: vi.fn(),
    profilerData: null, setProfilerData: vi.fn(),
    showProfiler: false, setShowProfiler: vi.fn(),
    rootNodes: [], setRootNodes: vi.fn(),
    selectedRootNode: null, setSelectedRootNode: vi.fn(),
    compDependencies: [], setCompDependencies: vi.fn(),
    showCompDeps: false, setShowCompDeps: vi.fn(),
    loadingScene: false, setLoadingScene: vi.fn(),
    assetSearch: '', setAssetSearch: vi.fn(),
    previewLoading: false, setPreviewLoading: vi.fn(),
    templateExportOpen: false, setTemplateExportOpen: vi.fn(),
    notifDismissed: new Set(), setNotifDismissed: vi.fn(),
    showScriptLogs: false, setShowScriptLogs: vi.fn(),
    showDepMap: false, setShowDepMap: vi.fn(),
    copiedCompRef: { current: null },
    compCopied: false, setCompCopied: vi.fn(),
    draggingIdx: null, setDraggingIdx: vi.fn(),
    dragOverIdx: null, setDragOverIdx: vi.fn(),
    sameCompPopup: null, setSameCompPopup: vi.fn(),
    applyStylePreset: vi.fn(), applyNodePreset: vi.fn(),
    transformClipboard: { current: null },
    transformClipFilled: false, setTransformClipFilled: vi.fn(),
    posClipboard: { current: null }, posClipFilled: false, setPosClipFilled: vi.fn(),
    sizeClipboard: { current: null }, sizeClipFilled: false, setSizeClipFilled: vi.fn(),
    colorClipboard: { current: null }, colorClipFilled: false, setColorClipFilled: vi.fn(),
    rotClipboard: { current: null }, rotClipFilled: false, setRotClipFilled: vi.fn(),
    scaleClipboard: { current: null }, scaleClipFilled: false, setScaleClipFilled: vi.fn(),
    opacityClipboard: { current: null }, opacityClipFilled: false, setOpacityClipFilled: vi.fn(),
    tintHexInput: '', setTintHexInput: vi.fn(),
    tintHexFocused: false, setTintHexFocused: vi.fn(),
    showPct: false, setShowPct: vi.fn(),
    rotation: 0,
    flushSave: vi.fn(),
    nodePresets: [], nodePresetOpen: false, setNodePresetOpen: vi.fn(),
    favoriteNodes: [], setFavoriteNodes: vi.fn(),
    favoritesOpen: false, setFavoritesOpen: vi.fn(),
    stylePresets: [], presetDropdownOpen: false, setPresetDropdownOpen: vi.fn(),
    saveStylePreset: vi.fn(), deleteStylePreset: vi.fn(),
    saveNodePreset: vi.fn(), deleteNodePreset: vi.fn(),
    toggleFavoriteNode: vi.fn(),
    propHistory: [], setPropHistory: vi.fn(),
    favProps: new Set(), toggleFavProp: vi.fn(),
    typeMatchedComps: null,
    ...overrides,
  } as unknown as ReturnType<typeof useNodeInspector>
}

function makeProps(node: CCSceneNode, ctxOverrides: Partial<ReturnType<typeof useNodeInspector>> = {}) {
  return {
    ctx: makeCtx(node, ctxOverrides),
    node,
    sceneFile: makeSceneFile(node),
    onUpdate: vi.fn(),
    saveScene: vi.fn().mockResolvedValue({ success: true }),
  }
}

// ── 노드 이름 표시 ─────────────────────────────────────────────────────────────

describe('NodeInspectorHeader — 노드 이름', () => {
  it('노드 이름이 input defaultValue로 렌더링된다', () => {
    const node = makeNode({ name: 'PlayerNode' })
    const { container } = render(<NodeInspectorHeader {...makeProps(node)} />)
    const nameInput = container.querySelector('input[style*="font-weight: 600"]') as HTMLInputElement
      ?? container.querySelector('input:not([type])') as HTMLInputElement
    // name input이 존재하고 defaultValue가 노드 이름
    const inputs = container.querySelectorAll('input') as NodeListOf<HTMLInputElement>
    const nameInputEl = Array.from(inputs).find(i => i.defaultValue === 'PlayerNode')
    expect(nameInputEl).toBeTruthy()
  })

  it('이름 입력 blur 시 applyAndSave({ name: ... }) 호출', () => {
    const node = makeNode({ name: 'OldName' })
    const applyAndSave = vi.fn()
    const ctx = makeCtx(node, { applyAndSave, draft: node })
    const { container } = render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile(node)} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    const inputs = container.querySelectorAll('input') as NodeListOf<HTMLInputElement>
    const nameInput = Array.from(inputs).find(i => i.defaultValue === 'OldName')
    expect(nameInput).toBeTruthy()
    fireEvent.blur(nameInput!, { target: { value: 'NewName' } })
    expect(applyAndSave).toHaveBeenCalledWith({ name: 'NewName' })
  })

  it('이름 입력 Enter 키 시 applyAndSave 호출', () => {
    const node = makeNode({ name: 'TestNode' })
    const applyAndSave = vi.fn()
    const ctx = makeCtx(node, { applyAndSave, draft: node })
    const { container } = render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile(node)} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    const inputs = container.querySelectorAll('input') as NodeListOf<HTMLInputElement>
    const nameInput = Array.from(inputs).find(i => i.defaultValue === 'TestNode')
    expect(nameInput).toBeTruthy()
    fireEvent.keyDown(nameInput!, { key: 'Enter', target: { value: 'NewName' } })
    expect(applyAndSave).toHaveBeenCalled()
  })
})

// ── 경로 표시 ─────────────────────────────────────────────────────────────────

describe('NodeInspectorHeader — 경로 표시', () => {
  it('nodePath 길이 > 1 이면 부모 이름이 breadcrumb에 표시된다', () => {
    const node = makeNode({ name: 'Child' })
    const ctx = makeCtx(node, {
      nodePath: [
        { name: 'Root', uuid: 'root-uuid' },
        { name: 'Parent', uuid: 'parent-uuid' },
        { name: 'Child', uuid: node.uuid },
      ],
    })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    expect(screen.getByText('Root')).toBeTruthy()
    expect(screen.getByText('Parent')).toBeTruthy()
  })

  it('현재 노드 이름이 accent 색상으로 강조 표시된다', () => {
    const node = makeNode({ name: 'CurrentNode' })
    const ctx = makeCtx(node, {
      nodePath: [
        { name: 'Root', uuid: 'root-uuid' },
        { name: 'CurrentNode', uuid: node.uuid },
      ],
    })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    const accents = document.querySelectorAll('[style*="accent"]')
    const currentLabel = screen.getByText('CurrentNode')
    expect(currentLabel).toBeTruthy()
  })

  it('nodePath 길이 > 1 이면 cc.find() 복사 버튼이 렌더링된다', () => {
    const node = makeNode({ name: 'Child' })
    const ctx = makeCtx(node, {
      nodePath: [
        { name: 'Root', uuid: 'root-uuid' },
        { name: 'Child', uuid: node.uuid },
      ],
    })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    const ccFindBtn = screen.queryByTitle(/cc\.find\(/)
    expect(ccFindBtn).toBeTruthy()
  })

  it('nodePath 길이 = 1 이면 breadcrumb 영역이 렌더링되지 않는다', () => {
    const node = makeNode({ name: 'Root' })
    const ctx = makeCtx(node, {
      nodePath: [{ name: 'Root', uuid: node.uuid }],
    })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    expect(screen.queryByTitle(/cc\.find\(/)).toBeNull()
  })
})

// ── UUID 표시 ──────────────────────────────────────────────────────────────────

describe('NodeInspectorHeader — UUID 버튼', () => {
  it('UUID 복사 버튼(#)이 렌더링된다', () => {
    const node = makeNode({ uuid: 'abc-def-1234' })
    const ctx = makeCtx(node, {
      nodePath: [{ name: 'Root', uuid: 'root' }, { name: node.name, uuid: node.uuid }],
    })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    const uuidBtn = screen.getByTitle(`UUID 복사: abc-def-1234`)
    expect(uuidBtn).toBeTruthy()
  })
})

// ── active 토글 ───────────────────────────────────────────────────────────────

describe('NodeInspectorHeader — active 토글', () => {
  it('active=true 이면 활성 체크박스가 checked', () => {
    const node = makeNode({ active: true })
    const { container } = render(<NodeInspectorHeader {...makeProps(node)} />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>
    const activeCheckbox = Array.from(checkboxes).find(cb => cb.checked)
    expect(activeCheckbox).toBeTruthy()
  })

  it('active=false 이면 활성 체크박스가 unchecked', () => {
    const node = makeNode({ active: false })
    const { container } = render(<NodeInspectorHeader {...makeProps(node)} />)
    // draft.active가 false인 체크박스가 있어야 함
    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>
    const unchecked = Array.from(checkboxes).find(cb => !cb.checked)
    expect(unchecked).toBeTruthy()
  })

  it('활성 체크박스 변경 시 applyAndSave 호출', () => {
    const node = makeNode({ active: true })
    const applyAndSave = vi.fn()
    const ctx = makeCtx(node, { applyAndSave, draft: node })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    const activeLabel = screen.getByTitle('노드 활성/비활성 토글 (단축키: H)')
    const checkbox = activeLabel.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox).toBeTruthy()
    // fireEvent.click으로 label 클릭하여 onChange 트리거
    fireEvent.click(activeLabel)
    expect(applyAndSave).toHaveBeenCalled()
  })
})

// ── 통계 배지 ─────────────────────────────────────────────────────────────────

describe('NodeInspectorHeader — 통계 배지', () => {
  it('자식이 있으면 자식 수 배지가 렌더링된다', () => {
    const child = makeNode({ uuid: 'child-1', name: 'Child1' })
    const node = makeNode({ children: [child] })
    const ctx = makeCtx(node, {
      draft: node,
      nodePath: [{ name: 'Root', uuid: 'root' }, { name: node.name, uuid: node.uuid }],
    })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    expect(screen.getByTitle('자식 노드 1개')).toBeTruthy()
  })

  it('컴포넌트가 있으면 컴포넌트 수 배지가 렌더링된다', () => {
    const node = makeNode({ components: [{ type: 'cc.Label', props: {} }] })
    const ctx = makeCtx(node, {
      draft: node,
      nodePath: [{ name: 'Root', uuid: 'root' }, { name: node.name, uuid: node.uuid }],
    })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    expect(screen.getByTitle('컴포넌트 1개')).toBeTruthy()
  })

  it('nodePath 길이 > 1 이면 깊이 배지(d{N})가 렌더링된다', () => {
    const node = makeNode()
    const ctx = makeCtx(node, {
      nodePath: [{ name: 'Root', uuid: 'root' }, { name: node.name, uuid: node.uuid }],
    })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    expect(screen.getByTitle('깊이 (루트=0)')).toBeTruthy()
  })
})

// ── Undo/Redo 버튼 ─────────────────────────────────────────────────────────────

describe('NodeInspectorHeader — Undo/Redo', () => {
  it('undoStack이 비어있으면 Undo 버튼이 disabled', () => {
    const node = makeNode()
    const { container } = render(<NodeInspectorHeader {...makeProps(node, { undoStack: [] })} />)
    const undoBtn = screen.getByTitle('실행 취소 (Undo)') as HTMLButtonElement
    expect(undoBtn.disabled).toBe(true)
  })

  it('undoStack이 있으면 Undo 버튼이 활성화된다', () => {
    const node = makeNode()
    const props = makeProps(node, {
      undoStack: [{ position: { x: 0, y: 0, z: 0 } }],
    })
    render(<NodeInspectorHeader {...props} />)
    const undoBtn = screen.getByTitle('실행 취소 (Undo)') as HTMLButtonElement
    expect(undoBtn.disabled).toBe(false)
  })

  it('Undo 버튼 클릭 시 handleUndo 호출', () => {
    const handleUndo = vi.fn()
    const node = makeNode()
    const props = makeProps(node, {
      undoStack: [{ position: { x: 0, y: 0, z: 0 } }],
      handleUndo,
    })
    render(<NodeInspectorHeader {...props} />)
    fireEvent.click(screen.getByTitle('실행 취소 (Undo)'))
    expect(handleUndo).toHaveBeenCalled()
  })

  it('redoStack이 있으면 Redo 버튼이 활성화된다', () => {
    const node = makeNode()
    const props = makeProps(node, {
      redoStack: [{ position: { x: 50, y: 0, z: 0 } }],
    })
    render(<NodeInspectorHeader {...props} />)
    const redoBtn = screen.getByTitle('다시 실행 (Redo)') as HTMLButtonElement
    expect(redoBtn.disabled).toBe(false)
  })
})

// ── 저장 상태 배지 ─────────────────────────────────────────────────────────────

describe('NodeInspectorHeader — 저장 상태 배지', () => {
  it('saving=true 이면 ⏳ 표시', () => {
    const node = makeNode()
    render(<NodeInspectorHeader {...makeProps(node, { saving: true })} />)
    expect(screen.getByTitle('저장 중')).toBeTruthy()
  })

  it('isDirty=true 이면 미저장 배지 표시', () => {
    const node = makeNode()
    render(<NodeInspectorHeader {...makeProps(node, { isDirty: true })} />)
    expect(screen.getByTitle('미저장 변경')).toBeTruthy()
  })

  it('savedToast=true 이면 저장 완료 배지 표시', () => {
    const node = makeNode()
    render(<NodeInspectorHeader {...makeProps(node, { savedToast: true })} />)
    expect(screen.getByTitle('저장 완료')).toBeTruthy()
  })
})

// ── 비활성 조상 경고 ───────────────────────────────────────────────────────────

describe('NodeInspectorHeader — 비활성 조상 경고', () => {
  it('inactiveAncestors가 있으면 경고 배너가 렌더링된다', () => {
    const node = makeNode()
    const ctx = makeCtx(node, { inactiveAncestors: ['ParentNode'] })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    expect(screen.getByText(/비활성 조상: ParentNode/)).toBeTruthy()
  })

  it('inactiveAncestors가 비어있으면 경고 배너가 없다', () => {
    const node = makeNode()
    const ctx = makeCtx(node, { inactiveAncestors: [] })
    render(<NodeInspectorHeader ctx={ctx} node={node} sceneFile={makeSceneFile()} onUpdate={vi.fn()} saveScene={vi.fn().mockResolvedValue({ success: true })} />)
    expect(screen.queryByText(/비활성 조상/)).toBeNull()
  })
})

// ── 잠금/핀/펄스 버튼 ─────────────────────────────────────────────────────────

describe('NodeInspectorHeader — 잠금/핀/펄스 버튼', () => {
  it('onToggleLocked가 있으면 잠금 버튼이 렌더링된다', () => {
    const node = makeNode()
    render(<NodeInspectorHeader
      {...makeProps(node)}
      onToggleLocked={vi.fn()}
      lockedUuids={new Set()}
    />)
    expect(screen.getByTitle(/잠금/)).toBeTruthy()
  })

  it('onPulse가 있으면 pulse 버튼이 렌더링된다', () => {
    const node = makeNode()
    render(<NodeInspectorHeader
      {...makeProps(node)}
      onPulse={vi.fn()}
    />)
    expect(screen.getByTitle('SceneView에서 노드 위치 강조 (pulse)')).toBeTruthy()
  })

  it('onTogglePin이 있으면 핀 버튼이 렌더링된다', () => {
    const node = makeNode()
    render(<NodeInspectorHeader
      {...makeProps(node)}
      onTogglePin={vi.fn()}
      pinnedUuids={new Set()}
    />)
    expect(screen.getByTitle(/씬뷰 핀 바에 고정/)).toBeTruthy()
  })

  it('잠금 버튼 클릭 시 onToggleLocked(node.uuid) 호출', () => {
    const node = makeNode({ uuid: 'lock-test-uuid' })
    const onToggleLocked = vi.fn()
    render(<NodeInspectorHeader
      {...makeProps(node)}
      onToggleLocked={onToggleLocked}
      lockedUuids={new Set()}
    />)
    const lockBtn = screen.getByTitle(/잠금/)
    fireEvent.click(lockBtn)
    expect(onToggleLocked).toHaveBeenCalledWith('lock-test-uuid')
  })
})
