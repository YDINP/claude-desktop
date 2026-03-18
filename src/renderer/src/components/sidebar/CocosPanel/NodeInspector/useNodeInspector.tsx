import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { type TransformSnapshot } from '../types'
import { NOTES_KEY, RECENT_COMPS_KEY, INSPECTOR_COLLAPSED_KEY, COLLAPSED_COMPS_KEY, PROP_HISTORY_KEY } from './constants'
import { ScrubLabel, WheelInput } from '../utils'
import { useNodeClipboards } from './useNodeClipboards'
import { useNodePresets, type StylePreset } from './useNodePresets'

interface UseNodeInspectorProps {
  node: CCSceneNode
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onUpdate: (n: CCSceneNode | null) => void
}

export function useNodeInspector({ node, sceneFile, saveScene, onUpdate }: UseNodeInspectorProps) {
  // R1597: 노드 커스텀 메모 (localStorage 기반)
  const [nodeMemo, setNodeMemo] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}')[node.uuid] ?? '' }
    catch { return '' }
  })
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}')
      setNodeMemo(all[node.uuid] ?? '')
    } catch { setNodeMemo('') }
  }, [node.uuid])
  const saveNodeMemo = (memo: string) => {
    setNodeMemo(memo)
    try {
      const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}')
      if (memo.trim()) all[node.uuid] = memo.trim()
      else delete all[node.uuid]
      localStorage.setItem(NOTES_KEY, JSON.stringify(all))
    } catch { /* silent */ }
  }
  // R2502: 최근 추가 컴포넌트 이력 (localStorage 공유)
  const [recentAddedComps, setRecentAddedComps] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_COMPS_KEY) ?? '[]') } catch { return [] }
  })
  const trackAddComp = (ct: string) => {
    setRecentAddedComps(prev => {
      const next = [ct, ...prev.filter(c => c !== ct)].slice(0, 5)
      try { localStorage.setItem(RECENT_COMPS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }
  // 편집 중인 로컬 상태 (노드 변경 시 초기화)
  // R1633: 노드 선택 시 초기값 스냅샷 (변경 인디케이터용)
  const origSnapUuidRef = useRef<string | null>(null)
  const origSnapRef = useRef<CCSceneNode | null>(null)
  if (origSnapUuidRef.current !== node.uuid) {
    origSnapUuidRef.current = node.uuid
    origSnapRef.current = JSON.parse(JSON.stringify(node))
  }
  const [draft, setDraft] = useState<CCSceneNode>(() => ({ ...node }))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // Round 643: 저장 상태 + Undo/Redo
  const [isDirty, setIsDirty] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [undoStack, setUndoStack] = useState<Partial<CCSceneNode>[]>([])
  const [compOrder, setCompOrder] = useState<string[]>([])
  const [draggedComp, setDraggedComp] = useState<string | null>(null)
  const [colorPickerProp, setColorPickerProp] = useState<string | null>(null)
  const [changeHistory, setChangeHistory] = useState<Array<{ timestamp: number; prop: string; oldVal: unknown; newVal: unknown }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const [redoStack, setRedoStack] = useState<Partial<CCSceneNode>[]>([])
  // R2454: Inspector 섹션 접힘 상태 localStorage 영속화
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(INSPECTOR_COLLAPSED_KEY) ?? '{}') } catch { return {} }
  })
  const [collapsedComps, setCollapsedComps] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_COMPS_KEY) ?? '[]')) }
    catch { return new Set() }
  })
  const [expandedArrayProps, setExpandedArrayProps] = useState<Set<string>>(new Set())
  // R2487: Raw JSON 인라인 편집 상태
  const [jsonEditMode, setJsonEditMode] = useState(false)
  const [jsonEditText, setJsonEditText] = useState('')
  const [jsonEditErr, setJsonEditErr] = useState('')
  const [lockScale, setLockScale] = useState(false)
  const [lockSize, setLockSize] = useState(false)  // R1593: 크기 비율 잠금
  // R2554: 앵커 변경 시 position 자동 보정 토글
  const [anchorCompensate, setAnchorCompensate] = useState(false)
  const [sceneDepsTree, setSceneDepsTree] = useState<Record<string, string[]>>({})

  // R1484: World Transform — 부모 체인 누산 좌표
  const worldPos = useMemo(() => {
    if (!sceneFile.root) return null
    function findChain(n: CCSceneNode, target: string, acc: CCSceneNode[]): CCSceneNode[] | null {
      if (n.uuid === target) return [...acc, n]
      for (const c of n.children) {
        const r = findChain(c, target, [...acc, n])
        if (r) return r
      }
      return null
    }
    const chain = findChain(sceneFile.root, node.uuid, [])
    if (!chain) return null
    let wx = 0, wy = 0
    for (const n of chain) { wx += (n.position?.x ?? 0); wy += (n.position?.y ?? 0) }
    return { x: Math.round(wx * 100) / 100, y: Math.round(wy * 100) / 100 }
  }, [sceneFile.root, node.uuid, draft.position])
  const [showSceneDepsTree, setShowSceneDepsTree] = useState(false)
  // R1508: Quick Edit CLI 상태 (Rules of Hooks: IIFE 밖 선언 필수)
  const [cliVal, setCliVal] = useState('')
  const [cliMsg, setCliMsg] = useState<string | null>(null)
  const secHeader = (key: string, label: string, modified?: boolean) => (
    <div onClick={() => setCollapsed(c => { const next = { ...c, [key]: !c[key] }; try { localStorage.setItem(INSPECTOR_COLLAPSED_KEY, JSON.stringify(next)) } catch {} return next })}
      style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', marginTop: 5, marginBottom: 3, userSelect: 'none' }}>
      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{collapsed[key] ? '▸' : '▾'}</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      {/* R1633: 변경 인디케이터 */}
      {modified && <span style={{ fontSize: 8, color: '#ff9944', lineHeight: 1 }} title="이 세션에서 변경됨">●</span>}
    </div>
  )

  // 자식 노드 추가
  const handleAddChild = useCallback(async () => {
    if (!sceneFile.root || !sceneFile._raw) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const version = sceneFile.projectInfo.version ?? '2x'
    const newId = 'new-' + Date.now()
    const newIdx = raw.length

    const newRawEntry: Record<string, unknown> = version === '3x' ? {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
      _uiProps: { _localOpacity: 1 },
    } : {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
      _contentSize: { width: 100, height: 100 }, _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
    }
    raw.push(newRawEntry)

    const newNode: CCSceneNode = {
      uuid: newId, name: 'NewNode', active: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: version === '3x' ? { x: 0, y: 0, z: 0 } : 0,
      scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 },
      opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 },
      components: [], children: [], _rawIndex: newIdx,
    }

    function addChild(n: CCSceneNode): CCSceneNode {
      if (n.uuid === node.uuid) return { ...n, children: [...n.children, newNode] }
      return { ...n, children: n.children.map(addChild) }
    }

    setSaving(true)
    try {
      const result = await saveScene(addChild(sceneFile.root))
      if (result.success) onUpdate(newNode)
      else { raw.pop(); setMsg({ ok: false, text: result.error ?? '추가 실패' }) }
    } catch {
      raw.pop()
      setMsg({ ok: false, text: '추가 실패' })
    } finally {
      setSaving(false)
    }
  }, [node.uuid, sceneFile, saveScene, onUpdate])

  // 노드 삭제 (루트 보호)
  const handleDelete = useCallback(async () => {
    if (!sceneFile.root || sceneFile.root.uuid === node.uuid) return
    function removeNode(n: CCSceneNode): CCSceneNode {
      return { ...n, children: n.children.filter(c => c.uuid !== node.uuid).map(removeNode) }
    }
    setSaving(true)
    const result = await saveScene(removeNode(sceneFile.root))
    setSaving(false)
    if (result.success) onUpdate(null)
    else setMsg({ ok: false, text: result.error ?? '삭제 실패' })
  }, [node.uuid, sceneFile, saveScene, onUpdate])

  // R2337: N-복제 카운트
  const [dupeCount, setDupeCount] = useState(1)

  // 노드 복제 (부모 아래에 형제로 추가) — R2337: N-복제 지원
  const handleDuplicate = useCallback(async () => {
    if (!sceneFile.root || !sceneFile._raw || sceneFile.root.uuid === node.uuid) return
    const n = Math.max(1, Math.min(20, dupeCount))
    const raw = sceneFile._raw as Record<string, unknown>[]
    const dupNodes: CCSceneNode[] = []
    const origRaw = node._rawIndex != null ? { ...raw[node._rawIndex] } : {}
    for (let i = 0; i < n; i++) {
      const newId = `dup-${Date.now()}-${i}`
      const newIdx = raw.length
      const suffix = n > 1 ? `_Copy${i + 1}` : '_Copy'
      raw.push({ ...origRaw, _id: newId, _name: node.name + suffix, _children: [] })
      dupNodes.push({ ...node, uuid: newId, name: node.name + suffix, children: [], _rawIndex: newIdx })
    }
    function insertAfterAll(root: CCSceneNode): CCSceneNode {
      const idx = root.children.findIndex(c => c.uuid === node.uuid)
      if (idx >= 0) { const ch = [...root.children]; ch.splice(idx + 1, 0, ...dupNodes); return { ...root, children: ch } }
      return { ...root, children: root.children.map(insertAfterAll) }
    }
    setSaving(true)
    try {
      const result = await saveScene(insertAfterAll(sceneFile.root))
      if (result.success) onUpdate(dupNodes[0])
      else { dupNodes.forEach(() => raw.pop()); setMsg({ ok: false, text: result.error ?? '복제 실패' }) }
    } catch {
      dupNodes.forEach(() => raw.pop())
      setMsg({ ok: false, text: '복제 실패' })
    } finally {
      setSaving(false)
    }
  }, [node, sceneFile, saveScene, onUpdate, dupeCount])

  const [propSearch, setPropSearch] = useState('')
  const [showPropSearch, setShowPropSearch] = useState(false)

  // Round 611: prop 변경 히스토리 type (orchestrator에서 직접 사용)
  type PropHistoryEntry = { id: string; propKey: string; nodeName: string; oldValue: unknown; newValue: unknown; ts: number }

  const [depMap, setDepMap] = useState<Record<string, string[]>>({})
  const [compFilter, setCompFilter] = useState('')
  const [compFilterFocus, setCompFilterFocus] = useState(false)
  const [scriptLogs, setScriptLogs] = useState<string[]>([])
  const [changeNotifications, setChangeNotifications] = useState<string[]>([])
  const [exportedTemplates, setExportedTemplates] = useState<string[]>([])
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({})
  const [showRichPreview, setShowRichPreview] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [sceneDeps, setSceneDeps] = useState<Record<string, string[]>>({})
  const [showSceneDeps, setShowSceneDeps] = useState(false)
  const [prefabInstances, setPrefabInstances] = useState<Record<string, number>>({})
  const [showPrefabStats, setShowPrefabStats] = useState(false)
  const [profilerData, setProfilerData] = useState<Record<string, { updateTime: number; callCount: number }>>({})
  const [showProfiler, setShowProfiler] = useState(false)
  const [rootNodes, setRootNodes] = useState<string[]>([])
  const [selectedRootNode, setSelectedRootNode] = useState<string | null>(null)
  const [compDependencies, setCompDependencies] = useState<Record<string, string[]>>({})
  const [showCompDeps, setShowCompDeps] = useState(false)
  const [loadingScene, setLoadingScene] = useState<string | null>(null)
  const [assetSearch, setAssetSearch] = useState('')
  const [previewLoading, setPreviewLoading] = useState<Set<string>>(new Set())
  const [templateExportOpen, setTemplateExportOpen] = useState(false)
  const [notifDismissed, setNotifDismissed] = useState<Set<number>>(new Set())
  const [showScriptLogs, setShowScriptLogs] = useState(false)
  const [showDepMap, setShowDepMap] = useState(false)

  // R2518: tint hex 텍스트 입력 로컬 상태
  const [tintHexInput, setTintHexInput] = useState<string>('')
  const [tintHexFocused, setTintHexFocused] = useState(false)

  // 노드 교체 시 draft + 컴포넌트 접힘 상태 + propSearch 초기화
  useMemo(() => { setDraft({ ...node }); setExpandedArrayProps(new Set()); setPropSearch(''); setShowPropSearch(false) }, [node.uuid])
  const copiedCompRef = useRef<{ type: string; props: Record<string, unknown> } | null>(null)
  const [compCopied, setCompCopied] = useState<string | null>(null) // 복사된 comp type 표시용
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  // R1662: 같은 컴포넌트 타입 노드 목록 팝업
  const [sameCompPopup, setSameCompPopup] = useState<string | null>(null) // 팝업을 열 comp type
  // R1670: 위치/크기 % 토글
  const [showPct, setShowPct] = useState(false)

  const rotation = typeof draft.rotation === 'number' ? draft.rotation : (draft.rotation as { z: number }).z ?? 0

  // debounce 타이머 ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ updated: CCSceneNode; root: CCSceneNode } | null>(null)

  // 실제 저장 실행 (debounced)
  const flushSave = useCallback(async () => {
    if (!pendingSaveRef.current) return
    const { updated, root } = pendingSaveRef.current
    pendingSaveRef.current = null
    setSaving(true)
    const result = await saveScene(root)
    setSaving(false)
    if (result.success) {
      setMsg({ ok: true, text: '저장됨' })
      setIsDirty(false)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 1500)
      onUpdate(updated)
    } else {
      setMsg({ ok: false, text: result.error ?? '저장 실패' })
    }
    setTimeout(() => setMsg(null), 2000)
  }, [saveScene, onUpdate])

  // useNodePresets에서 setPropHistory를 참조하기 위한 임시 ref — applyAndSave에서 사용
  const setPropHistoryRef = useRef<React.Dispatch<React.SetStateAction<PropHistoryEntry[]>> | null>(null)

  // 노드 값 패치 후 씬 저장 (draft는 즉시 반영, saveScene은 50ms debounce)
  const applyAndSave = useCallback((patch: Partial<CCSceneNode>) => {
    if (!sceneFile.root) return
    const updated = { ...draft, ...patch }
    setDraft(updated)

    // R699: changeHistory 이력 추가
    const patchKeysForHistory = Object.keys(patch)
    if (patchKeysForHistory.length > 0) {
      const historyEntry = {
        timestamp: Date.now(),
        prop: patchKeysForHistory[0],
        oldVal: (draft as Record<string, unknown>)[patchKeysForHistory[0]],
        newVal: (patch as Record<string, unknown>)[patchKeysForHistory[0]],
      }
      setChangeHistory(prev => [historyEntry, ...prev].slice(0, 20))
    }

    // Round 643: dirty + undo 스택
    setIsDirty(true)
    const patchKeys = Object.keys(patch)
    if (patchKeys.length > 0) {
      const prevPatch: Partial<CCSceneNode> = {}
      for (const k of patchKeys) {
        ;(prevPatch as Record<string, unknown>)[k] = (draft as Record<string, unknown>)[k]
      }
      setUndoStack(prev => [prevPatch, ...prev].slice(0, 10))
      setRedoStack([])
    }

    // Round 611: 히스토리 기록
    if (patchKeys.length > 0) {
      const propKey = patchKeys[0]
      const oldValue = (draft as Record<string, unknown>)[propKey]
      const newValue = (patch as Record<string, unknown>)[propKey]
      const entry: PropHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        propKey,
        nodeName: draft.name ?? draft.uuid,
        oldValue,
        newValue,
        ts: Date.now(),
      }
      if (setPropHistoryRef.current) {
        setPropHistoryRef.current(prev => {
          const next = [entry, ...prev].slice(0, 15)
          localStorage.setItem(PROP_HISTORY_KEY, JSON.stringify(next))
          return next
        })
      }
    }

    // sceneFile.root에서 uuid 찾아 교체
    function replaceNode(n: CCSceneNode): CCSceneNode {
      if (n.uuid === updated.uuid) return updated
      return { ...n, children: n.children.map(replaceNode) }
    }
    const newRoot = replaceNode(sceneFile.root)

    // debounce: 50ms 이내 연속 호출 시 마지막 것만 저장
    pendingSaveRef.current = { updated, root: newRoot }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { flushSave() }, 50)
  }, [draft, sceneFile, flushSave])

  // Round 643: Undo/Redo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const [prev, ...rest] = undoStack
    // 현재 값을 redo 스택에 보존
    const currentPatch: Partial<CCSceneNode> = {}
    for (const k of Object.keys(prev)) {
      ;(currentPatch as Record<string, unknown>)[k] = (draft as Record<string, unknown>)[k]
    }
    setRedoStack(r => [currentPatch, ...r].slice(0, 10))
    setUndoStack(rest)
    applyAndSave(prev)
  }, [undoStack, draft, applyAndSave])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const [next, ...rest] = redoStack
    setRedoStack(rest)
    applyAndSave(next)
  }, [redoStack, applyAndSave])

  // R1577: 노드 전체 JSON 복사
  const [jsonCopyDone, setJsonCopyDone] = useState(false)
  const handleCopyNodeJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2))
      setJsonCopyDone(true)
      setTimeout(() => setJsonCopyDone(false), 1500)
    } catch { /* ignore */ }
  }, [draft])

  // Round 635: Transform 복사/붙여넣기
  const [copyDone, setCopyDone] = useState(false)

  // --- Sub-hooks ---
  const clipboards = useNodeClipboards()
  const presets = useNodePresets({
    nodeUuid: node.uuid,
    nodeName: node.name,
    draft,
  })

  // setPropHistoryRef 연결 (applyAndSave에서 사용)
  setPropHistoryRef.current = presets.setPropHistory as React.Dispatch<React.SetStateAction<PropHistoryEntry[]>>

  const handleCopyTransform = useCallback(async () => {
    const snap: TransformSnapshot = {
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
    }
    clipboards.transformClipboard.current = snap
    try {
      await navigator.clipboard.writeText(JSON.stringify(snap))
    } catch { /* fallback already set */ }
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 1500)
  }, [draft, clipboards.transformClipboard])

  const handlePasteTransform = useCallback(async () => {
    let snap: TransformSnapshot | null = null
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text) as Partial<TransformSnapshot>
      if (parsed && typeof parsed === 'object' && 'position' in parsed) {
        snap = parsed as TransformSnapshot
      }
    } catch { /* ignore, try fallback */ }
    if (!snap && clipboards.transformClipboard.current) snap = clipboards.transformClipboard.current
    if (!snap) return
    applyAndSave({
      position: snap.position,
      rotation: snap.rotation,
      scale: snap.scale,
      size: snap.size,
      anchor: snap.anchor,
      opacity: snap.opacity,
    })
  }, [applyAndSave, clipboards.transformClipboard])

  // Round 631: 프리셋 적용 (applyAndSave 이후 정의)
  const applyStylePreset = useCallback((preset: StylePreset) => {
    applyAndSave({
      position: preset.position,
      rotation: preset.rotation,
      scale: preset.scale,
      size: preset.size,
      anchor: preset.anchor,
      opacity: preset.opacity,
    })
    presets.setPresetDropdownOpen(false)
  }, [applyAndSave, presets.setPresetDropdownOpen])

  // R673: 노드 프리셋 적용
  const applyNodePreset = useCallback((preset: { name: string; props: Record<string, unknown> }) => {
    applyAndSave(preset.props as Partial<CCSceneNode>)
    presets.setNodePresetOpen(false)
  }, [applyAndSave, presets.setNodePresetOpen])

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 1,
  ) => {
    const inputRef = { current: null } as React.RefObject<HTMLInputElement | null>
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <ScrubLabel label={label} value={value} onChange={onChange} step={step} inputRef={inputRef} />
        <WheelInput
          ref={inputRef}
          type="number"
          step={step}
          value={value}
          onChange={e => onChange(parseFloat((e.target as HTMLInputElement).value) || 0)}
          onBlur={e => onChange(parseFloat((e.target as HTMLInputElement).value) || 0)}
          onWheelChange={e => {
            e.preventDefault()
            const el = e.target as HTMLInputElement
            const current = parseFloat(el.value)
            if (isNaN(current)) return
            const delta = e.deltaY < 0 ? step : -step
            const multiplier = e.shiftKey ? 10 : 1
            onChange(current + delta * multiplier)
          }}
          style={{
            flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
          }}
        />
      </div>
    )
  }

  // 노드 경로 계산 (root → 선택 노드) — R1648: uuid도 포함
  const nodePath = useMemo(() => {
    const path: { name: string; uuid: string }[] = []
    function find(n: CCSceneNode, target: string): boolean {
      if (n.uuid === target) { path.push({ name: n.name, uuid: n.uuid }); return true }
      for (const c of n.children) {
        path.push({ name: n.name, uuid: n.uuid })
        if (find(c, target)) return true
        path.pop()
      }
      return false
    }
    find(sceneFile.root, node.uuid)
    return path
  }, [sceneFile.root, node.uuid])

  // R1721: 형제 노드 목록 (이전/다음 탐색용)
  const siblings = useMemo(() => {
    if (nodePath.length < 2) return []
    const parentUuid = nodePath[nodePath.length - 2].uuid
    function findParent(n: CCSceneNode): CCSceneNode | null {
      if (n.uuid === parentUuid) return n
      for (const c of n.children) { const f = findParent(c); if (f) return f }
      return null
    }
    return findParent(sceneFile.root)?.children ?? []
  }, [nodePath, sceneFile.root])

  // R1677: 비활성 조상 경고 (조상 중 active:false 노드 탐지)
  const inactiveAncestors = useMemo(() => {
    const inactive: string[] = []
    function findFull(n: CCSceneNode, target: string): CCSceneNode[] | null {
      if (n.uuid === target) return [n]
      for (const c of n.children) {
        const p = findFull(c, target)
        if (p) return [n, ...p]
      }
      return null
    }
    const path = findFull(sceneFile.root, node.uuid)
    if (path) {
      for (let i = 0; i < path.length - 1; i++) {
        if (path[i].active === false) inactive.push(path[i].name || path[i].uuid.slice(0, 8))
      }
    }
    return inactive
  }, [sceneFile.root, node.uuid])

  // Z-order 정보 (같은 부모 내 인덱스, 형제 수) + R1652: 부모 노드 크기
  const zOrderInfo = useMemo(() => {
    function findParent(n: CCSceneNode): CCSceneNode | null {
      for (const c of n.children) {
        if (c.uuid === node.uuid) return n
        const found = findParent(c)
        if (found) return found
      }
      return null
    }
    const parent = findParent(sceneFile.root)
    if (!parent) return null
    const idx = parent.children.findIndex(c => c.uuid === node.uuid)
    return { idx, total: parent.children.length, parentSize: parent.size }
  }, [sceneFile.root, node.uuid])

  // R1661: 전체 하위 노드 수 (descendants)
  const totalDescendants = useMemo(() => {
    let count = 0
    function walk(n: CCSceneNode) { n.children.forEach(c => { count++; walk(c) }) }
    walk(node)
    return count
  }, [node])

  // R2484/R2489: 씬 내 같은 이름 노드 목록
  const sameNameNodes = useMemo(() => {
    const list: CCSceneNode[] = []
    function collectName(n: CCSceneNode) { if (n.name === node.name) list.push(n); n.children.forEach(collectName) }
    collectName(sceneFile.root)
    return list
  }, [sceneFile.root, node.name])
  const sameNameCount = sameNameNodes.length
  const [showSameNameMenu, setShowSameNameMenu] = useState(false)

  // R1660: 씬 전체 컴포넌트 타입별 노드 수
  const compTypeCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    function walk(n: CCSceneNode) { n.components.forEach(c => { map[c.type] = (map[c.type] ?? 0) + 1 }); n.children.forEach(walk) }
    walk(sceneFile.root)
    return map
  }, [sceneFile.root])

  // Z-order (같은 부모 내 순서 이동)
  const handleZOrder = useCallback(async (dir: 1 | -1) => {
    if (!sceneFile.root) return
    function move(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === node.uuid)
      if (idx < 0) return { ...n, children: n.children.map(move) }
      const ch = [...n.children]
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= ch.length) return n
      ;[ch[idx], ch[newIdx]] = [ch[newIdx], ch[idx]]
      return { ...n, children: ch }
    }
    setSaving(true)
    await saveScene(move(sceneFile.root))
    setSaving(false)
  }, [node.uuid, sceneFile, saveScene])

  // Z-order 맨 앞/뒤로 이동
  const handleZOrderEdge = useCallback(async (edge: 'first' | 'last') => {
    if (!sceneFile.root) return
    function move(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === node.uuid)
      if (idx < 0) return { ...n, children: n.children.map(move) }
      const ch = [...n.children]
      const [item] = ch.splice(idx, 1)
      if (edge === 'first') ch.unshift(item)
      else ch.push(item)
      return { ...n, children: ch }
    }
    setSaving(true)
    await saveScene(move(sceneFile.root))
    setSaving(false)
  }, [node.uuid, sceneFile, saveScene])

  // R1738: Z-index 직접 입력
  const [zOrderEditing, setZOrderEditing] = useState(false)
  const [zOrderInputVal, setZOrderInputVal] = useState('')
  const handleZOrderTo = useCallback(async (targetOneBased: number) => {
    if (!sceneFile.root || !zOrderInfo) return
    const targetIdx = Math.max(0, Math.min(zOrderInfo.total - 1, targetOneBased - 1))
    if (targetIdx === zOrderInfo.idx) return
    function move(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === node.uuid)
      if (idx < 0) return { ...n, children: n.children.map(move) }
      const ch = [...n.children]
      const [item] = ch.splice(idx, 1)
      ch.splice(targetIdx, 0, item)
      return { ...n, children: ch }
    }
    setSaving(true)
    await saveScene(move(sceneFile.root))
    setSaving(false)
  }, [node.uuid, sceneFile, saveScene, zOrderInfo])


  return {
    // State
    nodeMemo, saveNodeMemo, recentAddedComps, trackAddComp,
    origSnapUuidRef, origSnapRef, draft, setDraft, msg, setMsg, saving, setSaving,
    isDirty, setIsDirty, savedToast, setSavedToast, undoStack, setUndoStack,
    compOrder, setCompOrder, draggedComp, setDraggedComp, colorPickerProp, setColorPickerProp,
    changeHistory, setChangeHistory, showHistory, setShowHistory,
    redoStack, setRedoStack, collapsed, setCollapsed, collapsedComps, setCollapsedComps,
    expandedArrayProps, setExpandedArrayProps, jsonEditMode, setJsonEditMode,
    jsonEditText, setJsonEditText, jsonEditErr, setJsonEditErr,
    lockScale, setLockScale, lockSize, setLockSize,
    anchorCompensate, setAnchorCompensate, sceneDepsTree, setSceneDepsTree,
    worldPos, showSceneDepsTree, setShowSceneDepsTree,
    cliVal, setCliVal, cliMsg, setCliMsg, secHeader,
    // Handlers
    handleAddChild, handleDelete, handleDuplicate,
    propSearch, setPropSearch, showPropSearch, setShowPropSearch, dupeCount, setDupeCount,
    depMap, setDepMap, compFilter, setCompFilter, compFilterFocus, setCompFilterFocus,
    scriptLogs, setScriptLogs, changeNotifications, setChangeNotifications,
    exportedTemplates, setExportedTemplates, previewCache, setPreviewCache,
    showRichPreview, setShowRichPreview, loadProgress, setLoadProgress,
    sceneDeps, setSceneDeps, showSceneDeps, setShowSceneDeps,
    prefabInstances, setPrefabInstances, showPrefabStats, setShowPrefabStats,
    profilerData, setProfilerData, showProfiler, setShowProfiler,
    rootNodes, setRootNodes, selectedRootNode, setSelectedRootNode,
    compDependencies, setCompDependencies, showCompDeps, setShowCompDeps,
    loadingScene, setLoadingScene, assetSearch, setAssetSearch,
    previewLoading, setPreviewLoading, templateExportOpen, setTemplateExportOpen,
    notifDismissed, setNotifDismissed, showScriptLogs, setShowScriptLogs,
    showDepMap, setShowDepMap, tintHexInput, setTintHexInput, tintHexFocused, setTintHexFocused,
    copiedCompRef, compCopied, setCompCopied, draggingIdx, setDraggingIdx, dragOverIdx, setDragOverIdx,
    sameCompPopup, setSameCompPopup, showPct, setShowPct, rotation,
    applyAndSave, handleUndo, handleRedo,
    jsonCopyDone, handleCopyNodeJson, copyDone, handleCopyTransform, handlePasteTransform,
    applyStylePreset, applyNodePreset, numInput, nodePath, siblings, inactiveAncestors,
    zOrderInfo, totalDescendants, sameNameNodes, sameNameCount, showSameNameMenu, setShowSameNameMenu,
    compTypeCountMap, handleZOrder, handleZOrderEdge, zOrderEditing, setZOrderEditing,
    zOrderInputVal, setZOrderInputVal, handleZOrderTo,
    flushSave,
    // --- from useNodeClipboards ---
    ...clipboards,
    // --- from useNodePresets ---
    ...presets,
  }
}
