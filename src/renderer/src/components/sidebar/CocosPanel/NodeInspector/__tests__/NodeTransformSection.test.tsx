import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { NodeTransformSection } from '../NodeTransformSection'
import type { useNodeInspector } from '../useNodeInspector'

// ── ctx mock builder ───────────────────────────────────────────────────────────

function makeNode(overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return {
    uuid: 'n1', name: 'TestNode', active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [], children: [],
    ...overrides,
  }
}

function makeCtx(overrides: Partial<ReturnType<typeof useNodeInspector>> = {}): ReturnType<typeof useNodeInspector> {
  const draft = makeNode()
  const applyAndSave = vi.fn()
  return {
    draft,
    origSnapRef: { current: draft } as React.MutableRefObject<CCSceneNode | null>,
    applyAndSave,
    numInput: (label: string, value: number, _onChange: (v: number) => void) => (
      <div>
        <span>{label}</span>
        <input type="number" defaultValue={value} aria-label={label} onChange={e => _onChange(parseFloat(e.target.value) || 0)} />
      </div>
    ),
    rotation: 0,
    collapsed: {},
    secHeader: (_key: string, label: string) => (
      <div data-testid={`sec-${_key}`}>{label}</div>
    ),
    transformClipboard: { current: null },
    transformClipFilled: false, setTransformClipFilled: vi.fn(),
    posClipboard: { current: null },
    posClipFilled: false, setPosClipFilled: vi.fn(),
    sizeClipboard: { current: null },
    sizeClipFilled: false, setSizeClipFilled: vi.fn(),
    colorClipboard: { current: null },
    colorClipFilled: false, setColorClipFilled: vi.fn(),
    rotClipboard: { current: null },
    rotClipFilled: false, setRotClipFilled: vi.fn(),
    scaleClipboard: { current: null },
    scaleClipFilled: false, setScaleClipFilled: vi.fn(),
    opacityClipboard: { current: null },
    opacityClipFilled: false, setOpacityClipFilled: vi.fn(),
    anchorCompensate: false, setAnchorCompensate: vi.fn(),
    worldPos: null,
    lockScale: false, setLockScale: vi.fn(),
    lockSize: false, setLockSize: vi.fn(),
    showPct: false, setShowPct: vi.fn(),
    tintHexInput: '', setTintHexInput: vi.fn(),
    tintHexFocused: false, setTintHexFocused: vi.fn(),
    zOrderInfo: null,
    // required stubs
    nodeMemo: '', saveNodeMemo: vi.fn(), recentAddedComps: [], trackAddComp: vi.fn(),
    origSnapUuidRef: { current: null },
    setDraft: vi.fn(), msg: null, setMsg: vi.fn(), saving: false, setSaving: vi.fn(),
    isDirty: false, setIsDirty: vi.fn(), savedToast: false, setSavedToast: vi.fn(),
    undoStack: [], setUndoStack: vi.fn(),
    compOrder: [], setCompOrder: vi.fn(),
    draggedComp: null, setDraggedComp: vi.fn(),
    colorPickerProp: null, setColorPickerProp: vi.fn(),
    changeHistory: [], setChangeHistory: vi.fn(),
    showHistory: false, setShowHistory: vi.fn(),
    redoStack: [], setRedoStack: vi.fn(),
    setCollapsed: vi.fn(), collapsedComps: new Set(), setCollapsedComps: vi.fn(),
    expandedArrayProps: new Set(), setExpandedArrayProps: vi.fn(),
    jsonEditMode: false, setJsonEditMode: vi.fn(),
    jsonEditText: '', setJsonEditText: vi.fn(),
    jsonEditErr: '', setJsonEditErr: vi.fn(),
    sceneDepsTree: {}, setSceneDepsTree: vi.fn(),
    showSceneDepsTree: false, setShowSceneDepsTree: vi.fn(),
    handleAddChild: vi.fn(), handleDelete: vi.fn(), handleDuplicate: vi.fn(),
    propSearch: '', setPropSearch: vi.fn(),
    showPropSearch: false, setShowPropSearch: vi.fn(),
    dupeCount: 1, setDupeCount: vi.fn(),
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
    handleUndo: vi.fn(), handleRedo: vi.fn(),
    jsonCopyDone: false, handleCopyNodeJson: vi.fn(),
    copyDone: false, handleCopyTransform: vi.fn(), handlePasteTransform: vi.fn(),
    applyStylePreset: vi.fn(), applyNodePreset: vi.fn(),
    nodePath: [], siblings: [], inactiveAncestors: [],
    totalDescendants: 0,
    sameNameNodes: [], sameNameCount: 0, showSameNameMenu: false, setShowSameNameMenu: vi.fn(),
    compTypeCountMap: {}, handleZOrder: vi.fn(), handleZOrderEdge: vi.fn(),
    zOrderEditing: false, setZOrderEditing: vi.fn(),
    zOrderInputVal: '', setZOrderInputVal: vi.fn(), handleZOrderTo: vi.fn(),
    flushSave: vi.fn(),
    // from useNodePresets
    nodePresets: [], nodePresetOpen: false, setNodePresetOpen: vi.fn(),
    favoriteNodes: [], setFavoriteNodes: vi.fn(),
    favoritesOpen: false, setFavoritesOpen: vi.fn(),
    stylePresets: [], presetDropdownOpen: false, setPresetDropdownOpen: vi.fn(),
    saveStylePreset: vi.fn(), deleteStylePreset: vi.fn(),
    saveNodePreset: vi.fn(), deleteNodePreset: vi.fn(),
    toggleFavoriteNode: vi.fn(),
    propHistory: [], setPropHistory: vi.fn(),
    // favProps
    favProps: new Set(), toggleFavProp: vi.fn(),
    typeMatchedComps: null,
    ...overrides,
  } as unknown as ReturnType<typeof useNodeInspector>
}

// ── 기본 렌더링 ────────────────────────────────────────────────────────────────

describe('NodeTransformSection — 기본 렌더링', () => {
  it('"위치 / 크기 / 회전" 섹션 헤더가 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByText('위치 / 크기 / 회전')).toBeTruthy()
  })

  it('복사/붙여넣기 버튼 T↑복사가 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByTitle('트랜스폼 복사 (위치·크기·회전·스케일)')).toBeTruthy()
  })

  it('위치 X/Y numInput 라벨이 렌더링된다 (mock)', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    // X, Y 라벨이 여러 개 있음 (위치 X/Y + 스케일 X/Y)
    const xLabels = screen.getAllByText('X')
    const yLabels = screen.getAllByText('Y')
    expect(xLabels.length).toBeGreaterThanOrEqual(1)
    expect(yLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('회전 섹션 레이블 "회전"이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByText('회전')).toBeTruthy()
  })

  it('크기 섹션 레이블 "크기"가 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByText('크기')).toBeTruthy()
  })

  it('스케일 섹션 레이블 "스케일"이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByText('스케일')).toBeTruthy()
  })

  it('앵커/불투명도 섹션 헤더가 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    // secHeader mock이 "앵커 / 불투명도"를 반환
    expect(screen.getByText('앵커 / 불투명도')).toBeTruthy()
  })

  it('앵커 aX/aY numInput 라벨이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByText('aX')).toBeTruthy()
    expect(screen.getByText('aY')).toBeTruthy()
  })

  it('불투명도 섹션이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    // 불투명도 레이블은 div 내 텍스트로 표시됨
    expect(screen.queryByText('불투명도') ?? screen.queryByText('앵커 / 불투명도')).toBeTruthy()
  })
})

// ── position 편집 ──────────────────────────────────────────────────────────────

describe('NodeTransformSection — position 편집', () => {
  it('위치 리셋 ↺ 클릭 시 applyAndSave({ position: {x:0, y:0} }) 호출', () => {
    const applyAndSave = vi.fn()
    const draft = makeNode({ position: { x: 50, y: 30, z: 0 } })
    const ctx = makeCtx({ draft, applyAndSave })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    const resetBtn = screen.getAllByTitle('위치 리셋 (0,0)')[0]
    fireEvent.click(resetBtn)
    expect(applyAndSave).toHaveBeenCalled()
    const arg = applyAndSave.mock.calls[0][0]
    expect(arg.position.x).toBe(0)
    expect(arg.position.y).toBe(0)
  })

  it('위치 스텝 X+1 클릭 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const draft = makeNode({ position: { x: 10, y: 0, z: 0 } })
    const ctx = makeCtx({ draft, applyAndSave })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    fireEvent.click(screen.getByTitle('X +1'))
    expect(applyAndSave).toHaveBeenCalled()
    const arg = applyAndSave.mock.calls[0][0]
    expect(arg.position.x).toBe(11)
  })

  it('위치 스텝 Y-10 클릭 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const draft = makeNode({ position: { x: 0, y: 20, z: 0 } })
    const ctx = makeCtx({ draft, applyAndSave })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    fireEvent.click(screen.getByTitle('Y -10'))
    expect(applyAndSave).toHaveBeenCalled()
    const arg = applyAndSave.mock.calls[0][0]
    expect(arg.position.y).toBe(10)
  })

  it('(0,0) 원점 리셋 버튼이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByTitle('위치 원점 (0, 0) 리셋')).toBeTruthy()
  })

  it('위치 그리드 스냅 ⊹8 버튼이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByTitle('위치 ×8 그리드 스냅')).toBeTruthy()
  })
})

// ── rotation 편집 ──────────────────────────────────────────────────────────────

describe('NodeTransformSection — rotation 편집', () => {
  it('회전 리셋 ↺ 클릭 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const ctx = makeCtx({ applyAndSave, rotation: 45 })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    const resetBtn = screen.getByTitle('회전 리셋 (0°)')
    fireEvent.click(resetBtn)
    expect(applyAndSave).toHaveBeenCalled()
  })

  it('회전 스텝 +15° 버튼이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByTitle('회전 +15°')).toBeTruthy()
  })

  it('회전 스텝 -90° 클릭 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const ctx = makeCtx({ applyAndSave, rotation: 0 })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    fireEvent.click(screen.getByTitle('회전 -90°'))
    expect(applyAndSave).toHaveBeenCalled()
    const arg = applyAndSave.mock.calls[0][0]
    expect(arg.rotation.z).toBe(-90)
  })

  it('Z° 입력 라벨이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByText('Z°')).toBeTruthy()
  })

  it('rotation > 180 이면 normalize 버튼이 렌더링된다', () => {
    const ctx = makeCtx({ rotation: 270 })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.queryByText('normalize')).toBeTruthy()
  })

  it('rotation ≤ 180 이면 normalize 버튼이 없다', () => {
    const ctx = makeCtx({ rotation: 45 })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.queryByText('normalize')).toBeNull()
  })
})

// ── scale 편집 ─────────────────────────────────────────────────────────────────

describe('NodeTransformSection — scale 편집', () => {
  it('스케일 리셋 ↺ 클릭 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const draft = makeNode({ scale: { x: 2, y: 2, z: 1 } })
    const ctx = makeCtx({ draft, applyAndSave })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    const resetBtn = screen.getByTitle('스케일 리셋 (1,1)')
    fireEvent.click(resetBtn)
    expect(applyAndSave).toHaveBeenCalled()
    const arg = applyAndSave.mock.calls[0][0]
    expect(arg.scale.x).toBe(1)
    expect(arg.scale.y).toBe(1)
  })

  it('X 반전 ↔ 버튼 클릭 시 scale.x 부호 반전', () => {
    const applyAndSave = vi.fn()
    const draft = makeNode({ scale: { x: 1, y: 1, z: 1 } })
    const ctx = makeCtx({ draft, applyAndSave })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    fireEvent.click(screen.getByTitle('X 반전 (scaleX 부호 반전)'))
    expect(applyAndSave).toHaveBeenCalled()
    const arg = applyAndSave.mock.calls[0][0]
    expect(arg.scale.x).toBe(-1)
  })

  it('scale.x !== scale.y 이면 균등 스케일 버튼이 렌더링된다', () => {
    const draft = makeNode({ scale: { x: 1, y: 2, z: 1 } })
    const ctx = makeCtx({ draft })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.queryByTitle(/균등 스케일/)).toBeTruthy()
  })

  it('scale.x === scale.y 이면 균등 스케일 버튼이 없다', () => {
    const draft = makeNode({ scale: { x: 1, y: 1, z: 1 } })
    const ctx = makeCtx({ draft })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.queryByTitle(/균등 스케일/)).toBeNull()
  })
})

// ── size 편집 ─────────────────────────────────────────────────────────────────

describe('NodeTransformSection — size 편집', () => {
  it('W/H 라벨이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByText('W')).toBeTruthy()
    expect(screen.getByText('H')).toBeTruthy()
  })

  it('크기 스텝 W+10 버튼이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByTitle('W +10')).toBeTruthy()
  })

  it('크기 배율 ×2 클릭 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const draft = makeNode({ size: { x: 100, y: 50 } })
    const ctx = makeCtx({ draft, applyAndSave })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    fireEvent.click(screen.getByTitle('크기 ×2'))
    expect(applyAndSave).toHaveBeenCalled()
    const arg = applyAndSave.mock.calls[0][0]
    expect(arg.size.x).toBe(200)
  })

  it('크기 int 정수화 버튼이 렌더링된다', () => {
    const ctx = makeCtx()
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getAllByTitle('크기 정수화 (소수점 제거)')[0]).toBeTruthy()
  })
})

// ── anchor 편집 ───────────────────────────────────────────────────────────────

describe('NodeTransformSection — anchor 편집', () => {
  it('앵커 9-point 프리셋 버튼 9개가 렌더링된다', () => {
    const ctx = makeCtx()
    const { container } = render(<NodeTransformSection ctx={ctx} is3x={false} />)
    // 앵커 프리셋 그리드 버튼 (title="앵커 (x, y)" 형태)
    const anchorBtns = container.querySelectorAll('[title^="앵커 ("]')
    expect(anchorBtns.length).toBeGreaterThanOrEqual(9)
  })

  it('앵커 프리셋 클릭 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const ctx = makeCtx({ applyAndSave })
    const { container } = render(<NodeTransformSection ctx={ctx} is3x={false} />)
    const anchorBtns = container.querySelectorAll('[title^="앵커 ("]')
    expect(anchorBtns.length).toBeGreaterThan(0)
    fireEvent.click(anchorBtns[0])
    expect(applyAndSave).toHaveBeenCalled()
  })
})

// ── T↑복사/T↓붙여넣기 ─────────────────────────────────────────────────────────

describe('NodeTransformSection — 트랜스폼 클립보드', () => {
  it('T↑복사 클릭 시 setTransformClipFilled(true) 호출', () => {
    const setTransformClipFilled = vi.fn()
    const transformClipboard = { current: null }
    const ctx = makeCtx({ transformClipboard, setTransformClipFilled })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    fireEvent.click(screen.getByTitle('트랜스폼 복사 (위치·크기·회전·스케일)'))
    expect(setTransformClipFilled).toHaveBeenCalledWith(true)
  })

  it('T↓붙여넣기는 transformClipFilled=false 이면 비활성 색상', () => {
    const ctx = makeCtx({ transformClipFilled: false })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    const pasteBtn = screen.getByTitle('복사된 트랜스폼 없음')
    expect(pasteBtn).toBeTruthy()
  })
})

// ── origSnap 변경 감지 (T↩원복) ───────────────────────────────────────────────

describe('NodeTransformSection — 원복 버튼', () => {
  it('위치 변경 시 T↩원복 버튼이 나타난다', () => {
    const origNode = makeNode({ position: { x: 0, y: 0, z: 0 } })
    const draft = makeNode({ position: { x: 100, y: 50, z: 0 } })
    const ctx = makeCtx({
      draft,
      origSnapRef: { current: origNode } as React.MutableRefObject<CCSceneNode | null>,
    })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.getByTitle('선택 시 원래값으로 트랜스폼 복원')).toBeTruthy()
  })

  it('위치 미변경 시 T↩원복 버튼이 없다', () => {
    const node = makeNode({ position: { x: 0, y: 0, z: 0 } })
    const ctx = makeCtx({
      draft: node,
      origSnapRef: { current: node } as React.MutableRefObject<CCSceneNode | null>,
    })
    render(<NodeTransformSection ctx={ctx} is3x={false} />)
    expect(screen.queryByTitle('선택 시 원래값으로 트랜스폼 복원')).toBeNull()
  })
})
