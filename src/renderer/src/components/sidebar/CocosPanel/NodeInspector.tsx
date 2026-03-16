import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { BoolToggle, ScrubLabel } from './utils'
import { type TransformSnapshot } from './types'

export function SpriteThumb({ sfUuid, assetsDir }: { sfUuid: string; assetsDir: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    window.api.ccFileResolveTexture?.(sfUuid, assetsDir).then(u => u && setUrl(u))
  }, [sfUuid, assetsDir])
  if (!url) return null
  return (
    <img
      src={url}
      title="스프라이트 텍스처 미리보기"
      style={{ width: 36, height: 36, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 3, background: 'rgba(0,0,0,0.4)', flexShrink: 0 }}
    />
  )
}

// R2330: 컴포넌트 타입별 아이콘 (Inspector 헤더 + hover panel 공유)
export const COMP_ICONS: Record<string, string> = {
  'cc.Label': 'T', 'cc.RichText': 'T',
  'cc.Sprite': '🖼', 'cc.TiledMap': '🗺', 'cc.VideoPlayer': '▷',
  'cc.Button': '⬜', 'cc.Toggle': '☑', 'cc.Slider': '⊟',
  'cc.Widget': '⚓', 'cc.Layout': '▤', 'cc.SafeArea': '📱',
  'cc.ScrollView': '⊠', 'cc.PageView': '⊟',
  'cc.EditBox': '✏', 'cc.ProgressBar': '▰',
  'cc.Animation': '▶', 'sp.Skeleton': '🦴', 'dragonBones.ArmatureDisplay': '🐉',
  'cc.AudioSource': '♪',
  'cc.RigidBody': '⚙', 'cc.BoxCollider': '⬡', 'cc.CircleCollider': '○', 'cc.PolygonCollider': '⬠',
  'cc.Camera': '📷', 'cc.Canvas': '🎨',
  'cc.BlockInputEvents': '🚫', 'cc.Mask': '◰', 'cc.ParticleSystem': '✦',
  'cc.MotionStreak': '〰', 'cc.GraphicsComponent': '✏',
}

// R2328: 컴포넌트 타입별 간단 설명 (Inspector 헤더 tooltip)
export const COMP_DESCRIPTIONS: Record<string, string> = {
  'cc.Label': '텍스트 레이블 — 문자열 렌더링',
  'cc.RichText': '리치텍스트 — HTML 태그 지원 텍스트',
  'cc.Sprite': '스프라이트 — 이미지/텍스처 렌더링',
  'cc.TiledMap': '타일맵 — TMX 기반 맵 렌더링',
  'cc.VideoPlayer': '비디오 플레이어 — 동영상 재생',
  'cc.Button': '버튼 — 클릭/탭 이벤트 처리',
  'cc.Toggle': '토글 — 체크박스 형태 스위치',
  'cc.Slider': '슬라이더 — 값 범위 입력',
  'cc.Widget': '위젯 — 부모 기준 앵커/스트레치 레이아웃',
  'cc.Layout': '레이아웃 — 자식 노드 자동 정렬',
  'cc.SafeArea': '세이프에리어 — 노치/홈바 회피 레이아웃',
  'cc.ScrollView': '스크롤뷰 — 스크롤 가능한 컨텐츠 영역',
  'cc.PageView': '페이지뷰 — 페이지 슬라이드 컨테이너',
  'cc.EditBox': '에디트박스 — 텍스트 입력 필드',
  'cc.Animation': '애니메이션 — 클립 기반 프레임 애니메이션',
  'sp.Skeleton': 'Spine 스켈레톤 — Spine 2D 애니메이션',
  'dragonBones.ArmatureDisplay': 'DragonBones — DragonBones 2D 애니메이션',
  'cc.AudioSource': '오디오소스 — 사운드 재생',
  'cc.RigidBody': '리지드바디 — 물리 시뮬레이션 바디',
  'cc.BoxCollider': '박스콜라이더 — 사각형 충돌 영역',
  'cc.CircleCollider': '원형콜라이더 — 원 충돌 영역',
  'cc.PolygonCollider': '폴리곤콜라이더 — 다각형 충돌 영역',
  'cc.Camera': '카메라 — 뷰 렌더링 시점',
  'cc.Canvas': '캔버스 — 씬 루트 렌더링 컨테이너',
  'cc.BlockInputEvents': '입력차단 — 하위 터치 이벤트 차단',
  'cc.ProgressBar': '프로그레스바 — 진행률 표시',
  'cc.Mask': '마스크 — 자식 렌더링 클리핑',
  'cc.ParticleSystem': '파티클시스템 — 입자 효과',
  'cc.MotionStreak': '모션스트릭 — 잔상 트레일 효과',
  'cc.GraphicsComponent': '그래픽스 — 벡터 드로잉',
}

/** CCSceneNode 프로퍼티 인스펙터 — 노드 선택 시 표시 */
export function CCFileNodeInspector({
  node, sceneFile, saveScene, onUpdate, lockedUuids, onToggleLocked, onPulse, pinnedUuids, onTogglePin,
}: {
  node: CCSceneNode
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onUpdate: (n: CCSceneNode | null) => void
  lockedUuids?: Set<string>
  onToggleLocked?: (uuid: string) => void
  onPulse?: (uuid: string) => void
  /** R2474: 핀 노드 */
  pinnedUuids?: Set<string>
  onTogglePin?: (uuid: string, name: string) => void
}) {
  // R1597: 노드 커스텀 메모 (localStorage 기반)
  const NOTES_KEY = 'cc-node-notes'
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
  const RECENT_COMPS_KEY = 'cc-recent-added-comps'
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
  const [nodePresets, setNodePresets] = useState<Array<{ name: string; props: Record<string, unknown> }>>(() => {
    try { return JSON.parse(localStorage.getItem('node-presets') ?? '[]') } catch { return [] }
  })
  const [nodePresetOpen, setNodePresetOpen] = useState(false)
  const [nodePresetCategories, setNodePresetCategories] = useState<Record<string, string[]>>({})
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<string>('all')
  const [favoriteNodes, setFavoriteNodes] = useState<Array<{ uuid: string; name: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('favorite-nodes') ?? '[]') } catch { return [] }
  })
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [favoriteTags, setFavoriteTags] = useState<string[]>(() => JSON.parse(localStorage.getItem('fav-tags') ?? '[]'))
  const [showFavTags, setShowFavTags] = useState(false)
  const [changeHistory, setChangeHistory] = useState<Array<{ timestamp: number; prop: string; oldVal: unknown; newVal: unknown }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const [redoStack, setRedoStack] = useState<Partial<CCSceneNode>[]>([])
  // R2454: Inspector 섹션 접힘 상태 localStorage 영속화
  const INSPECTOR_COLLAPSED_KEY = 'cc-inspector-collapsed'
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(INSPECTOR_COLLAPSED_KEY) ?? '{}') } catch { return {} }
  })
  const COLLAPSED_COMPS_KEY = 'collapsed-comps'
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
  // R1617: 트랜스폼 복사/붙여넣기 클립보드
  const transformClipboard = useRef<{ position: CCSceneNode['position']; rotation: CCSceneNode['rotation']; scale: CCSceneNode['scale']; size: CCSceneNode['size'] } | null>(null)
  const [transformClipFilled, setTransformClipFilled] = useState(false)
  // R2552: 위치 전용 클립보드
  const posClipboard = useRef<{ x: number; y: number } | null>(null)
  const [posClipFilled, setPosClipFilled] = useState(false)
  // R2553: 크기 전용 클립보드
  const sizeClipboard = useRef<{ w: number; h: number } | null>(null)
  const [sizeClipFilled, setSizeClipFilled] = useState(false)
  // R2562: 색상 전용 클립보드
  const colorClipboard = useRef<{ r: number; g: number; b: number } | null>(null)
  const [colorClipFilled, setColorClipFilled] = useState(false)
  // R2563: 회전 전용 클립보드
  const rotClipboard = useRef<number | null>(null)
  const [rotClipFilled, setRotClipFilled] = useState(false)
  // R2564: 스케일 전용 클립보드
  const scaleClipboard = useRef<{ x: number; y: number } | null>(null)
  const [scaleClipFilled, setScaleClipFilled] = useState(false)
  // R2574: 불투명도 전용 클립보드
  const opacityClipboard = useRef<number | null>(null)
  const [opacityClipFilled, setOpacityClipFilled] = useState(false)
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
  // R2337: N-복제 카운트
  const [dupeCount, setDupeCount] = useState(1)

  // Round 611: prop 변경 히스토리
  const PROP_HISTORY_KEY = 'prop-history'
  type PropHistoryEntry = { id: string; propKey: string; nodeName: string; oldValue: unknown; newValue: unknown; ts: number }
  const [propHistory, setPropHistory] = useState<PropHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(PROP_HISTORY_KEY) ?? '[]') }
    catch { return [] }
  })
  const [historyOpen, setHistoryOpen] = useState(false)

  // Round 631: 스타일 프리셋
  const STYLE_PRESETS_KEY = 'style-presets'
  type StylePreset = {
    id: string
    name: string
    position: CCSceneNode['position']
    rotation: CCSceneNode['rotation']
    scale: CCSceneNode['scale']
    size: CCSceneNode['size']
    anchor: CCSceneNode['anchor']
    opacity: number
  }
  const [stylePresets, setStylePresets] = useState<StylePreset[]>(() => {
    try { return JSON.parse(localStorage.getItem(STYLE_PRESETS_KEY) ?? '[]') }
    catch { return [] }
  })
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false)

  const saveStylePreset = useCallback(() => {
    const rawName = window.prompt('프리셋 이름', `${draft.name}-${Date.now()}`)
    if (rawName === null) return
    const name = rawName.trim() || `${draft.name}-${Date.now()}`
    const preset: StylePreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
    }
    setStylePresets(prev => {
      const next = [preset, ...prev].slice(0, 10)
      localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next))
      return next
    })
  }, [draft])

  const FAV_PROPS_KEY = 'fav-props'
  const [favProps, setFavProps] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_PROPS_KEY) ?? '[]')) }
    catch { return new Set() }
  })
  const toggleFavProp = useCallback((compType: string, propKey: string) => {
    const id = `${compType}:${propKey}`
    setFavProps(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(FAV_PROPS_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])
  const [showFavPropsOnly, setShowFavPropsOnly] = useState(false)
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
      setPropHistory(prev => {
        const next = [entry, ...prev].slice(0, 15)
        localStorage.setItem(PROP_HISTORY_KEY, JSON.stringify(next))
        return next
      })
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
  const handleCopyTransform = useCallback(async () => {
    const snap: TransformSnapshot = {
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
    }
    transformClipboard.current = snap
    try {
      await navigator.clipboard.writeText(JSON.stringify(snap))
    } catch { /* fallback already set */ }
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 1500)
  }, [draft])

  const handlePasteTransform = useCallback(async () => {
    let snap: TransformSnapshot | null = null
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text) as Partial<TransformSnapshot>
      if (parsed && typeof parsed === 'object' && 'position' in parsed) {
        snap = parsed as TransformSnapshot
      }
    } catch { /* ignore, try fallback */ }
    if (!snap && transformClipboard.current) snap = transformClipboard.current
    if (!snap) return
    applyAndSave({
      position: snap.position,
      rotation: snap.rotation,
      scale: snap.scale,
      size: snap.size,
      anchor: snap.anchor,
      opacity: snap.opacity,
    })
  }, [applyAndSave])

  // Round 631: 프리셋 적용 / 삭제 (applyAndSave 이후 정의)
  const applyStylePreset = useCallback((preset: StylePreset) => {
    applyAndSave({
      position: preset.position,
      rotation: preset.rotation,
      scale: preset.scale,
      size: preset.size,
      anchor: preset.anchor,
      opacity: preset.opacity,
    })
    setPresetDropdownOpen(false)
  }, [applyAndSave])

  const deleteStylePreset = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setStylePresets(prev => {
      const next = prev.filter(p => p.id !== id)
      localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // R673: 노드 프리셋 저장 / 적용 / 삭제
  const saveNodePreset = useCallback(() => {
    const rawName = window.prompt('프리셋 이름', `${draft.name}-${Date.now()}`)
    if (rawName === null) return
    const name = rawName.trim() || `${draft.name}-${Date.now()}`
    const props: Record<string, unknown> = {
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
      active: draft.active,
      color: draft.color,
    }
    setNodePresets(prev => {
      const next = [{ name, props }, ...prev].slice(0, 20)
      localStorage.setItem('node-presets', JSON.stringify(next))
      return next
    })
  }, [draft])

  const applyNodePreset = useCallback((preset: { name: string; props: Record<string, unknown> }) => {
    applyAndSave(preset.props as Partial<CCSceneNode>)
    setNodePresetOpen(false)
  }, [applyAndSave])

  const deleteNodePreset = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setNodePresets(prev => {
      const next = prev.filter((_, i) => i !== idx)
      localStorage.setItem('node-presets', JSON.stringify(next))
      return next
    })
  }, [])

  // R691: 노드 즐겨찾기 토글
  const toggleFavoriteNode = useCallback(() => {
    setFavoriteNodes(prev => {
      const exists = prev.some(f => f.uuid === node.uuid)
      const next = exists
        ? prev.filter(f => f.uuid !== node.uuid)
        : [...prev, { uuid: node.uuid, name: node.name }]
      localStorage.setItem('favorite-nodes', JSON.stringify(next))
      return next
    })
  }, [node.uuid, node.name])

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
        <input
          ref={inputRef}
          type="number"
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          onBlur={e => onChange(parseFloat(e.target.value) || 0)}
          onWheel={e => {
            e.preventDefault()
            const current = parseFloat((e.target as HTMLInputElement).value)
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

  return (
    <div style={{
      flexShrink: 0, borderTop: '1px solid var(--border)',
      padding: '6px 10px', background: 'var(--bg-secondary, #0d0d1a)', maxHeight: 420, overflowY: 'auto',
    }}>
      {nodePath.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={nodePath.map(p => p.name).join(' / ')}>
            {/* R1648: breadcrumb 클릭으로 부모 노드 선택 */}
            {nodePath.slice(0, -1).map((p, i) => (
              <span key={i}><span style={{ cursor: 'pointer' }} onClick={() => { const n = sceneFile.root && (function find(r: CCSceneNode): CCSceneNode | null { if (r.uuid === p.uuid) return r; for (const c of r.children) { const f = find(c); if (f) return f } return null })(sceneFile.root); if (n) onUpdate(n) }} onMouseEnter={e => (e.currentTarget.style.color = '#88aacc')} onMouseLeave={e => (e.currentTarget.style.color = '')}>{p.name}</span><span style={{ margin: '0 3px' }}>/</span></span>
            ))}
            <span style={{ color: 'var(--accent)' }}>{nodePath[nodePath.length - 1]?.name}</span>
          </div>
          {/* R2471: cc.find() 경로 클립보드 복사 */}
          {nodePath.length > 1 && (
            <span
              title={`cc.find("${nodePath.slice(1).map(p => p.name).join('/')}") 복사 (R2471)`}
              onClick={() => {
                const path = nodePath.slice(1).map(p => p.name).join('/')
                navigator.clipboard.writeText(`cc.find("${path}")`).catch(() => {})
              }}
              style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: '1px solid #334', color: '#556', flexShrink: 0, userSelect: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff'; (e.currentTarget as HTMLElement).style.color = '#58a6ff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#334'; (e.currentTarget as HTMLElement).style.color = '#556' }}
            >📋</span>
          )}
          {/* R1488: 노드 통계 뱃지 — 깊이/자식/컴포넌트 수 */}
          <div style={{ display: 'flex', gap: 3, flexShrink: 0, alignItems: 'center' }}>
            {nodePath.length > 1 && <span style={{ fontSize: 8, color: '#556', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title="깊이 (루트=0)">d{nodePath.length - 1}</span>}
            {draft.children.length > 0 && <span style={{ fontSize: 8, color: '#565', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title={`자식 노드 ${draft.children.length}개`}>▸{draft.children.length}</span>}
            {/* R1661: 전체 하위 노드 수 */}
            {totalDescendants > draft.children.length && <span style={{ fontSize: 8, color: '#454', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title={`전체 하위 노드 ${totalDescendants}개`}>⊲{totalDescendants}</span>}
            {draft.components.length > 0 && <span style={{ fontSize: 8, color: '#556a', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title={`컴포넌트 ${draft.components.length}개`}>⊕{draft.components.length}</span>}
            {/* R2484/R2489: 씬 내 같은 이름 노드 수 + 클릭 목록 */}
            {sameNameCount > 1 && (
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <span
                  style={{ fontSize: 8, color: '#a87', padding: '1px 3px', background: 'rgba(180,120,80,0.12)', borderRadius: 2, cursor: 'pointer', userSelect: 'none' }}
                  title={`씬 내 "${node.name}" 이름 노드 ${sameNameCount}개 — 클릭으로 목록 (R2489)`}
                  onClick={() => setShowSameNameMenu(v => !v)}
                >=×{sameNameCount}</span>
                {showSameNameMenu && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', padding: '4px 0', marginTop: 2 }}
                    onMouseLeave={() => setShowSameNameMenu(false)}
                  >
                    <div style={{ fontSize: 8, color: '#a87', padding: '2px 8px 4px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>"{node.name}" 동명 노드</div>
                    {sameNameNodes.map(n => (
                      <div key={n.uuid} onClick={() => { onUpdate(n); setShowSameNameMenu(false) }}
                        style={{ padding: '3px 8px', fontSize: 9, cursor: 'pointer', color: n.uuid === node.uuid ? '#58a6ff' : 'var(--text-primary)', background: n.uuid === node.uuid ? 'rgba(88,166,255,0.08)' : 'none' }}
                        onMouseEnter={e => { if (n.uuid !== node.uuid) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.uuid === node.uuid ? 'rgba(88,166,255,0.08)' : 'none' }}
                        title={n.uuid}
                      >{n.uuid === node.uuid ? '▸ ' : ''}{n.name} <span style={{ color: '#444', fontSize: 8 }}>{n.uuid.slice(0, 8)}</span></div>
                    ))}
                  </div>
                )}
              </span>
            )}
            {/* R1721: 형제 노드 탐색 버튼 ◀ ▶ */}
            {siblings.length > 1 && (() => {
              const idx = siblings.findIndex(s => s.uuid === node.uuid)
              const prevNode = idx > 0 ? siblings[idx - 1] : null
              const nextNode = idx < siblings.length - 1 ? siblings[idx + 1] : null
              return (
                <>
                  <span title={prevNode ? `이전 형제: ${prevNode.name}` : '이전 형제 없음'}
                    onClick={() => prevNode && onUpdate(prevNode)}
                    style={{ fontSize: 9, padding: '1px 3px', borderRadius: 2, lineHeight: 1, cursor: prevNode ? 'pointer' : 'default', color: prevNode ? '#88aacc' : '#333' }}
                  >◀</span>
                  <span style={{ fontSize: 8, color: '#333' }}>{idx + 1}/{siblings.length}</span>
                  <span title={nextNode ? `다음 형제: ${nextNode.name}` : '다음 형제 없음'}
                    onClick={() => nextNode && onUpdate(nextNode)}
                    style={{ fontSize: 9, padding: '1px 3px', borderRadius: 2, lineHeight: 1, cursor: nextNode ? 'pointer' : 'default', color: nextNode ? '#88aacc' : '#333' }}
                  >▶</span>
                </>
              )
            })()}
            {/* R1492: 경로 복사 버튼 */}
            <span
              title={`경로 복사: ${nodePath.map(p => p.name).join(' / ')}`}
              onClick={() => navigator.clipboard.writeText(nodePath.map(p => p.name).join(' / '))
                .then(() => { /* silent */ })
                .catch(() => { /* silent */ })}
              style={{ fontSize: 8, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#88aacc')}
              onMouseLeave={e => (e.currentTarget.style.color = '#445')}
            >⎘</span>
            {/* R1663: 잠금 토글 버튼 */}
            {onToggleLocked && (
              <span
                title={lockedUuids?.has(node.uuid) ? '잠금 해제 (편집 가능)' : '잠금 (SceneView 이동/리사이즈 방지)'}
                onClick={() => onToggleLocked(node.uuid)}
                style={{ fontSize: 9, color: lockedUuids?.has(node.uuid) ? '#f97316' : '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = lockedUuids?.has(node.uuid) ? '#fbbf24' : '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = lockedUuids?.has(node.uuid) ? '#f97316' : '#445')}
              >{lockedUuids?.has(node.uuid) ? '🔒' : '🔓'}</span>
            )}
            {/* R1666: pulse 미리보기 버튼 */}
            {onPulse && (
              <span
                title="SceneView에서 노드 위치 강조 (pulse)"
                onClick={() => onPulse(node.uuid)}
                style={{ fontSize: 9, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
                onMouseLeave={e => (e.currentTarget.style.color = '#445')}
              >✨</span>
            )}
            {/* R2474: 핀 토글 버튼 */}
            {onTogglePin && (
              <span
                title={pinnedUuids?.has(node.uuid) ? '핀 해제 (R2474)' : '씬뷰 핀 바에 고정 (R2474)'}
                onClick={() => onTogglePin(node.uuid, node.name)}
                style={{ fontSize: 9, color: pinnedUuids?.has(node.uuid) ? '#fbbf24' : '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
                onMouseLeave={e => (e.currentTarget.style.color = pinnedUuids?.has(node.uuid) ? '#fbbf24' : '#445')}
              >📌</span>
            )}
            {/* R1726: 노드 JSON 복사 버튼 */}
            <span
              title="노드 JSON 클립보드 복사 (R1726)"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(draft, null, 2)).catch(() => {})}
              style={{ fontSize: 8, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
              onMouseLeave={e => (e.currentTarget.style.color = '#445')}
            >{'{}'}</span>
            {/* R1607: UUID 복사 버튼 */}
            <span
              title={`UUID 복사: ${node.uuid}`}
              onClick={() => navigator.clipboard.writeText(node.uuid).then(() => { /* silent */ }).catch(() => { /* silent */ })}
              style={{ fontSize: 8, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1, fontFamily: 'monospace' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#7ee787')}
              onMouseLeave={e => (e.currentTarget.style.color = '#445')}
            >#</span>
          </div>
        </div>
      )}
      {/* R1677: 비활성 조상 경고 배너 + R1742: 일괄 활성화 버튼 */}
      {inactiveAncestors.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, padding: '2px 6px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 3 }}>
          <span style={{ fontSize: 9, color: '#fbbf24' }}>⚠</span>
          <span style={{ fontSize: 9, color: '#a8874a', flex: 1 }} title={`비활성 조상: ${inactiveAncestors.join(', ')}`}>
            비활성 조상: {inactiveAncestors.join(', ')}
          </span>
          {/* R1742: 비활성 조상 일괄 활성화 */}
          <span
            title="비활성 조상 모두 활성화"
            onClick={async () => {
              if (!sceneFile?.root) return
              function activatePath(n: CCSceneNode, targetUuid: string): { node: CCSceneNode; found: boolean } {
                if (n.uuid === targetUuid) return { node: n, found: true }
                for (let i = 0; i < n.children.length; i++) {
                  const r = activatePath(n.children[i], targetUuid)
                  if (r.found) {
                    const newChildren = [...n.children]
                    newChildren[i] = r.node
                    return { node: { ...n, active: true, children: newChildren }, found: true }
                  }
                }
                return { node: n, found: false }
              }
              const result = activatePath(sceneFile.root, node.uuid)
              if (result.found) await saveScene(result.node)
            }}
            style={{ fontSize: 8, cursor: 'pointer', color: '#fbbf24', padding: '0 4px', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 2, flexShrink: 0, userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >모두 활성화</span>
        </div>
      )}
      {/* R1637: 같은 이름 노드 자동 배지 (R1642: 클릭으로 순환 선택) */}
      {(() => {
        if (!sceneFile?.root) return null
        const dupes: CCSceneNode[] = []
        const walk = (n: CCSceneNode) => { if (n.name === draft.name) dupes.push(n); n.children.forEach(walk) }
        walk(sceneFile.root)
        if (dupes.length <= 1) return null
        const curIdx = dupes.findIndex(n => n.uuid === node.uuid)
        const nextNode = dupes[(curIdx + 1) % dupes.length]
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span
              onClick={() => onUpdate(nextNode)}
              style={{ fontSize: 8, background: 'rgba(255,153,0,0.12)', border: '1px solid rgba(255,153,0,0.35)', borderRadius: 3, padding: '0 4px', color: '#ff9900', cursor: 'pointer' }}
              title={`씬 내 "${draft.name}" 이름의 노드 ${dupes.length}개 — 클릭: 다음 노드 선택`}>⚠ 중복 이름 ×{dupes.length} ›</span>
          </div>
        )
      })()}
      {/* R1651: 씬 내 노드 이름 자동완성 datalist */}
      {(() => {
        const names = new Set<string>()
        const walkNames = (n: CCSceneNode) => { names.add(n.name); n.children.forEach(walkNames) }
        if (sceneFile?.root) walkNames(sceneFile.root)
        return (
          <datalist id={`cc-node-names-${node.uuid}`}>
            {[...names].map(n => <option key={n} value={n} />)}
          </datalist>
        )
      })()}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <input
          defaultValue={draft.name}
          list={`cc-node-names-${node.uuid}`}
          onBlur={e => applyAndSave({ name: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyAndSave({ name: (e.target as HTMLInputElement).value }); (e.target as HTMLInputElement).blur() } }}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', flex: 1, minWidth: 0 }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* R683: 프로퍼티 검색 토글 */}
          <button
            onClick={() => { setShowPropSearch(o => !o); if (showPropSearch) setPropSearch('') }}
            title="프로퍼티 검색"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
              background: showPropSearch ? 'rgba(88,166,255,0.15)' : 'transparent',
              color: showPropSearch ? '#58a6ff' : '#555',
              border: `1px solid ${showPropSearch ? '#58a6ff' : '#444'}`,
              lineHeight: 1.4,
            }}
          >
            🔍
          </button>
          {/* Round 643: 저장 상태 배지 */}
          {saving
            ? <span title="저장 중" style={{ fontSize: 10, color: '#94a3b8' }}>⏳</span>
            : isDirty
            ? <span title="미저장 변경" style={{ fontSize: 10, color: '#f97316' }}>●</span>
            : savedToast
            ? <span title="저장 완료" style={{ fontSize: 10, color: '#4ade80' }}>✓</span>
            : null}
          {msg && <span style={{ fontSize: 9, color: msg.ok ? '#4ade80' : '#f85149' }}>{msg.text}</span>}
          {/* Round 643: Undo/Redo 버튼 */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="실행 취소 (Undo)"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, lineHeight: 1.4,
              background: 'transparent', border: `1px solid ${undoStack.length === 0 ? '#333' : '#555'}`,
              color: undoStack.length === 0 ? '#333' : '#94a3b8', cursor: undoStack.length === 0 ? 'default' : 'pointer',
            }}
          >↩</button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="다시 실행 (Redo)"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, lineHeight: 1.4,
              background: 'transparent', border: `1px solid ${redoStack.length === 0 ? '#333' : '#555'}`,
              color: redoStack.length === 0 ? '#333' : '#94a3b8', cursor: redoStack.length === 0 ? 'default' : 'pointer',
            }}
          >↪</button>
          {/* R2332: active 토글 — H 키 단축키 힌트 */}
          <label title="노드 활성/비활성 토글 (단축키: H)" style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={e => applyAndSave({ active: e.target.checked })}
              style={{ margin: 0 }}
            />
            활성<span style={{ fontSize: 8, color: '#444', marginLeft: 1 }}>(H)</span>
          </label>
          {/* Round 635: Transform 복사/붙여넣기 */}
          <button
            onClick={handleCopyTransform}
            title="Transform 복사 (position/rotation/scale/size/anchor/opacity)"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: copyDone ? '#4ade80' : '#94a3b8', border: `1px solid ${copyDone ? '#4ade80' : '#94a3b8'}`,
              lineHeight: 1.4, transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            {copyDone ? '✓' : '⎘'}
          </button>
          <button
            onClick={handlePasteTransform}
            title="Transform 붙여넣기"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#94a3b8', border: '1px solid #94a3b8',
              lineHeight: 1.4,
            }}
          >
            📋
          </button>
          {/* R1577: 노드 전체 JSON 복사 */}
          <button
            onClick={handleCopyNodeJson}
            title="노드 전체 JSON 복사 (components 포함)"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: jsonCopyDone ? '#4ade80' : '#94a3b8', border: `1px solid ${jsonCopyDone ? '#4ade80' : '#94a3b8'}`,
              lineHeight: 1.4,
            }}
          >
            {jsonCopyDone ? '✓' : '{}'}
          </button>
          {/* R1600: 같은 이름 노드 찾기 버튼 */}
          <button
            onClick={() => {
              if (!sceneFile?.root) return
              const names: string[] = []
              const walk = (n: CCSceneNode) => { names.push(n.name); n.children.forEach(walk) }
              walk(sceneFile.root)
              const count = names.filter(n => n === draft.name).length
              if (count > 1) alert(`"${draft.name}" 이름의 노드가 씬에 ${count}개 있습니다.`)
              else alert(`"${draft.name}" 이름의 노드는 이 씬에 1개뿐입니다.`)
            }}
            title={`씬 내 같은 이름 노드 찾기 (${draft.name})`}
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#94a3b8', border: '1px solid #94a3b8',
              lineHeight: 1.4,
            }}
          >🔍</button>
          {/* Round 631: 프리셋 저장 / 불러오기 */}
          <button
            onClick={saveStylePreset}
            title="현재 Transform을 프리셋으로 저장"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24',
              lineHeight: 1.4,
            }}
          >
            💾
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setPresetDropdownOpen(o => !o)}
              title="저장된 프리셋 불러오기"
              style={{
                padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: presetDropdownOpen ? '#1e1e2e' : 'transparent',
                color: '#60a5fa', border: '1px solid #60a5fa',
                lineHeight: 1.4,
              }}
            >
              📂
            </button>
            {presetDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 160, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {stylePresets.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>저장된 프리셋 없음</div>
                ) : stylePresets.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => applyStylePreset(preset)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', cursor: 'pointer', fontSize: 10,
                      color: 'var(--text-primary, #ccc)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {preset.name}
                    </span>
                    <span
                      onClick={e => deleteStylePreset(preset.id, e)}
                      style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                      title="프리셋 삭제"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* R673: 노드 프리셋 저장 / 불러오기 */}
          <button
            onClick={saveNodePreset}
            title="현재 노드 프로퍼티를 프리셋으로 저장"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#34d399', border: '1px solid #34d399',
              lineHeight: 1.4,
            }}
          >
            N+
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNodePresetOpen(o => !o)}
              title="저장된 노드 프리셋 불러오기"
              style={{
                padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: nodePresetOpen ? '#1e1e2e' : 'transparent',
                color: '#34d399', border: '1px solid #34d399',
                lineHeight: 1.4,
              }}
            >
              N▾
            </button>
            {nodePresetOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 160, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {nodePresets.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>저장된 프리셋 없음</div>
                ) : nodePresets.map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => applyNodePreset(preset)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', cursor: 'pointer', fontSize: 10,
                      color: 'var(--text-primary, #ccc)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {preset.name}
                    </span>
                    <span
                      onClick={e => deleteNodePreset(idx, e)}
                      style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                      title="프리셋 삭제"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => applyAndSave({
              position: { ...draft.position, x: 0, y: 0 },
              rotation: typeof draft.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: draft.scale.z ?? 1 },
            })}
            title="Transform 리셋 (position 0,0 / rotation 0 / scale 1,1)"
            style={{
              padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#a78bfa', border: '1px solid #a78bfa',
              lineHeight: 1.4,
            }}
          >
            ⟳ Reset
          </button>
          {/* R691: 즐겨찾기 토글 버튼 + 드롭다운 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={toggleFavoriteNode}
              title={favoriteNodes.some(f => f.uuid === node.uuid) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              style={{
                padding: '1px 4px', fontSize: 12, borderRadius: 3, cursor: 'pointer',
                background: 'transparent',
                color: favoriteNodes.some(f => f.uuid === node.uuid) ? '#fbbf24' : '#555',
                border: `1px solid ${favoriteNodes.some(f => f.uuid === node.uuid) ? '#fbbf24' : '#444'}`,
                lineHeight: 1.4,
              }}
            >
              {favoriteNodes.some(f => f.uuid === node.uuid) ? '★' : '☆'}
            </button>
            <button
              onClick={() => setFavoritesOpen(o => !o)}
              title="즐겨찾기 목록"
              style={{
                padding: '1px 3px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
                background: favoritesOpen ? '#1e1e2e' : 'transparent',
                color: '#fbbf24', border: '1px solid #555',
                lineHeight: 1.4, marginLeft: 1,
              }}
            >
              ▾
            </button>
            {favoritesOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 180, maxHeight: 280, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {/* R1547: 헤더 */}
                <div style={{ padding: '4px 8px 2px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>즐겨찾기 노드 ({favoriteNodes.length})</span>
                  {favoriteNodes.length > 0 && (
                    <span style={{ cursor: 'pointer', color: '#f85149' }}
                      onClick={() => { setFavoriteNodes([]); localStorage.setItem('favorite-nodes', '[]') }}
                      title="전체 삭제"
                    >전체 삭제</span>
                  )}
                </div>
                {favoriteNodes.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>즐겨찾기 없음</div>
                ) : favoriteNodes.map(fav => {
                  // R1547: 컴포넌트 타입 배지 조회
                  const findNode = (n: CCSceneNode): CCSceneNode | null => {
                    if (n.uuid === fav.uuid) return n
                    for (const c of n.children) { const f = findNode(c); if (f) return f }
                    return null
                  }
                  const favNode = findNode(sceneFile.root)
                  const primaryComp = favNode?.components?.[0]?.type?.replace(/^cc\.|^sp\./, '') ?? null
                  return (
                    <div
                      key={fav.uuid}
                      onClick={() => {
                        if (favNode) onUpdate(favNode)
                        setFavoritesOpen(false)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 8px', cursor: favNode ? 'pointer' : 'default', fontSize: 10,
                        color: fav.uuid === node.uuid ? '#fbbf24' : favNode ? 'var(--text-primary, #ccc)' : 'var(--text-muted)',
                        opacity: favNode ? 1 : 0.5,
                      }}
                      onMouseEnter={e => { if (favNode) e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)' }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      title={favNode ? undefined : '노드를 찾을 수 없음 (삭제됨)'}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {fav.uuid === node.uuid ? '★ ' : '☆ '}{fav.name}
                      </span>
                      {primaryComp && (
                        <span style={{ marginLeft: 4, fontSize: 8, color: '#58a6ff', background: 'rgba(88,166,255,0.12)', borderRadius: 2, padding: '0 3px', flexShrink: 0 }}>
                          {primaryComp}
                        </span>
                      )}
                      <span
                        onClick={e => {
                          e.stopPropagation()
                          setFavoriteNodes(prev => {
                            const next = prev.filter(f => f.uuid !== fav.uuid)
                            localStorage.setItem('favorite-nodes', JSON.stringify(next))
                            return next
                          })
                        }}
                        style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                        title="즐겨찾기 삭제"
                      >
                        ×
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <button
            onClick={handleAddChild}
            title="자식 노드 추가"
            style={{
              padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#4ade80', border: '1px solid #4ade80',
              lineHeight: 1.4,
            }}
          >
            + 자식
          </button>
          {sceneFile.root?.uuid !== node.uuid && (
            <>
              {zOrderInfo && (
                /* R1738: Z-index 직접 입력 */
                zOrderEditing ? (
                  <input
                    autoFocus
                    type="number"
                    min={1}
                    max={zOrderInfo.total}
                    value={zOrderInputVal}
                    onChange={e => setZOrderInputVal(e.target.value)}
                    onBlur={() => { setZOrderEditing(false) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = parseInt(zOrderInputVal, 10)
                        if (!isNaN(v)) handleZOrderTo(v)
                        setZOrderEditing(false)
                      } else if (e.key === 'Escape') {
                        setZOrderEditing(false)
                      }
                    }}
                    style={{ width: 36, fontSize: 9, padding: '0 2px', background: 'var(--bg-primary, #0a0a14)', color: '#ccc', border: '1px solid #4a9eff', borderRadius: 2, textAlign: 'center' }}
                  />
                ) : (
                  <span
                    title="클릭하여 Z 위치 직접 입력"
                    onClick={() => { setZOrderInputVal(String(zOrderInfo.idx + 1)); setZOrderEditing(true) }}
                    style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap', cursor: 'text', userSelect: 'none' }}
                  >
                    Z: {zOrderInfo.idx + 1} / {zOrderInfo.total}
                  </span>
                )
              )}
              <button onClick={() => handleZOrderEdge('first')} disabled={!zOrderInfo || zOrderInfo.idx === 0} title="맨 앞으로" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === 0 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === 0 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === 0 ? '#333' : '#555'}`, lineHeight: 1.4 }}>⤒</button>
              <button onClick={() => handleZOrder(-1)} disabled={!zOrderInfo || zOrderInfo.idx === 0} title="앞으로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === 0 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === 0 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === 0 ? '#333' : '#555'}`, lineHeight: 1.4 }}>↑</button>
              <button onClick={() => handleZOrder(1)} disabled={!zOrderInfo || zOrderInfo.idx === zOrderInfo.total - 1} title="뒤로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === zOrderInfo?.total - 1 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#333' : '#555'}`, lineHeight: 1.4 }}>↓</button>
              <button onClick={() => handleZOrderEdge('last')} disabled={!zOrderInfo || zOrderInfo.idx === zOrderInfo.total - 1} title="맨 뒤로" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === zOrderInfo?.total - 1 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#333' : '#555'}`, lineHeight: 1.4 }}>⤓</button>
              {/* R2337: N-복제 — 복제 버튼 + 횟수 입력 */}
              <input
                type="number" min={1} max={20} value={dupeCount}
                onChange={e => setDupeCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                title="복제 횟수 (최대 20)"
                style={{ width: 32, fontSize: 10, textAlign: 'center', background: 'var(--bg-primary)', border: '1px solid #336', color: '#58a6ff', borderRadius: 3, padding: '1px 2px' }}
              />
              <button
                onClick={handleDuplicate}
                title={`노드 복제 ×${dupeCount}`}
                style={{
                  padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                  background: 'transparent', color: '#58a6ff', border: '1px solid #58a6ff',
                  lineHeight: 1.4,
                }}
              >
                복제{dupeCount > 1 ? `×${dupeCount}` : ''}
              </button>
              <button
                onClick={handleDelete}
                title="노드 삭제"
                style={{
                  padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                  background: 'transparent', color: '#f85149', border: '1px solid #f85149',
                  lineHeight: 1.4,
                }}
              >
                삭제
              </button>
            </>
          )}
          {/* R699: 변경 이력 토글 버튼 */}
          <button
            onClick={() => setShowHistory(o => !o)}
            title="변경 이력 보기"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
              background: showHistory ? 'rgba(88,166,255,0.15)' : 'transparent',
              color: showHistory ? '#58a6ff' : '#555',
              border: `1px solid ${showHistory ? '#58a6ff' : '#444'}`,
              lineHeight: 1.4,
            }}
          >
            📜
          </button>
        </div>
      </div>
      {/* R1702: 노드 UUID 표시 + 복사 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 8, color: '#444', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={node.uuid}>{node.uuid}</span>
        <span
          title="노드 UUID 복사"
          onClick={() => navigator.clipboard.writeText(node.uuid).catch(() => {})}
          style={{ fontSize: 8, cursor: 'pointer', color: '#444', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        >⎘</span>
        {/* R2567: 노드 JSON 복사 */}
        <span
          title="노드를 JSON으로 복사 (children 제외) — R2567"
          onClick={() => {
            const { children: _c, ...rest } = draft
            navigator.clipboard.writeText(JSON.stringify(rest, null, 2)).catch(() => {})
          }}
          style={{ fontSize: 8, cursor: 'pointer', color: '#444', flexShrink: 0, padding: '0 2px', border: '1px solid #333', borderRadius: 2 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        >{'{}'}</span>
      </div>

      {/* R699: 변경 이력 패널 */}
      {showHistory && (
        <div style={{ marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>변경 이력 ({changeHistory.length})</span>
            {changeHistory.length > 0 && (
              <span
                onClick={() => setChangeHistory([])}
                style={{ fontSize: 9, color: '#f85149', cursor: 'pointer' }}
                title="이력 지우기"
              >
                지우기
              </span>
            )}
          </div>
          {changeHistory.length === 0 ? (
            <div style={{ fontSize: 9, color: '#555', padding: '3px 0' }}>변경 이력이 없습니다.</div>
          ) : (
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {changeHistory.map((entry, i) => (
                <div key={i} style={{ fontSize: 9, display: 'flex', gap: 4, alignItems: 'flex-start', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <span style={{ color: '#555', flexShrink: 0 }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span style={{ color: '#58a6ff', flexShrink: 0 }}>{entry.prop}</span>
                  <span style={{ color: '#f85149', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }} title={JSON.stringify(entry.oldVal)}>
                    {JSON.stringify(entry.oldVal)}
                  </span>
                  <span style={{ color: '#555', flexShrink: 0 }}>→</span>
                  <span style={{ color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }} title={JSON.stringify(entry.newVal)}>
                    {JSON.stringify(entry.newVal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* R683: 프로퍼티 검색창 */}
      {showPropSearch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <input
            autoFocus
            placeholder="프로퍼티 이름 / 값 검색..."
            value={propSearch}
            onChange={e => setPropSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setPropSearch(''); setShowPropSearch(false) } }}
            style={{
              flex: 1, fontSize: 10, padding: '3px 6px', borderRadius: 3,
              background: 'var(--bg-input, #1a1a2e)', border: '1px solid var(--accent)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          {propSearch && (
            <span
              onClick={() => setPropSearch('')}
              style={{ cursor: 'pointer', color: '#888', fontSize: 12, lineHeight: 1 }}
              title="검색 초기화"
            >
              ×
            </span>
          )}
        </div>
      )}
      {/* R1603: 이벤트 핸들러 표시 */}
      {node.eventHandlers && node.eventHandlers.length > 0 && (
        <div style={{ marginBottom: 4, padding: '3px 6px', background: 'rgba(88,166,255,0.06)', borderRadius: 3, border: '1px solid rgba(88,166,255,0.12)' }}>
          <div style={{ fontSize: 8, color: '#58a6ff', marginBottom: 3 }}>📎 이벤트 핸들러</div>
          {node.eventHandlers.map((eh, i) => (
            <div key={i} style={{ fontSize: 9, display: 'flex', gap: 4, marginBottom: 1, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{eh.component}:{eh.event}</span>
              <span style={{ color: '#555' }}>→</span>
              <span style={{ color: '#7ee787', wordBreak: 'break-all' }}>{eh.handler}</span>
              {eh.target && <span style={{ color: '#555', fontSize: 8 }}>({eh.target})</span>}
            </div>
          ))}
        </div>
      )}
      {/* R1597: 노드 커스텀 메모 */}
      <div style={{ marginBottom: 4 }}>
        <textarea
          placeholder="메모 (이 노드에 대한 개인 노트)"
          value={nodeMemo}
          rows={nodeMemo ? 2 : 1}
          onChange={ev => saveNodeMemo(ev.target.value)}
          style={{ width: '100%', fontSize: 10, resize: 'vertical', background: nodeMemo ? 'rgba(255,255,100,0.05)' : 'transparent', color: '#aaa', border: `1px solid ${nodeMemo ? '#554' : 'transparent'}`, borderRadius: 3, padding: '2px 4px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => (e.currentTarget.style.border = '1px solid #665')}
          onBlur={e => (e.currentTarget.style.border = `1px solid ${nodeMemo ? '#554' : 'transparent'}`)}
        />
      </div>
      {secHeader('transform', '위치 / 크기 / 회전', (() => {
        const os = origSnapRef.current
        if (!os) return false
        const curPos = draft.position as { x?: number; y?: number }
        const osPos = os.position as { x?: number; y?: number }
        return Math.abs((curPos?.x ?? 0) - (osPos?.x ?? 0)) > 0.05 ||
          Math.abs((curPos?.y ?? 0) - (osPos?.y ?? 0)) > 0.05 ||
          Math.abs((draft.size?.x ?? 0) - (os.size?.x ?? 0)) > 0.05 ||
          Math.abs((draft.size?.y ?? 0) - (os.size?.y ?? 0)) > 0.05 ||
          Math.abs((draft.opacity ?? 255) - (os.opacity ?? 255)) > 0.5
      })())}
      {!collapsed['transform'] && (
        <>
        {/* R1617: 트랜스폼 복사/붙여넣기 버튼 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <span
            title="트랜스폼 복사 (위치·크기·회전·스케일)"
            onClick={() => { transformClipboard.current = { position: draft.position, rotation: draft.rotation, scale: draft.scale, size: draft.size }; setTransformClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >T↑복사</span>
          <span
            title={transformClipFilled ? '트랜스폼 붙여넣기 (위치·크기·회전·스케일)' : '복사된 트랜스폼 없음'}
            onClick={() => { if (transformClipboard.current) applyAndSave({ position: transformClipboard.current.position, rotation: transformClipboard.current.rotation, scale: transformClipboard.current.scale, size: transformClipboard.current.size }) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: transformClipFilled ? 'pointer' : 'default', color: transformClipFilled ? '#58a6ff' : '#333', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => { if (transformClipFilled) e.currentTarget.style.color = '#7fc6ff' }} onMouseLeave={e => { e.currentTarget.style.color = transformClipFilled ? '#58a6ff' : '#333' }}
          >T↓붙여넣기</span>
          {/* R2552: 위치 전용 복사/붙여넣기 */}
          <span
            title="위치(position) 복사 — 다른 노드에 붙여넣기 가능 (R2552)"
            onClick={() => { const pos = draft.position as { x: number; y: number }; posClipboard.current = { x: pos.x, y: pos.y }; setPosClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >P↑</span>
          <span
            title={posClipFilled ? `위치 붙여넣기 (${posClipboard.current?.x}, ${posClipboard.current?.y}) — R2552` : '복사된 위치 없음'}
            onClick={() => { if (posClipboard.current) { const pos = draft.position as { x: number; y: number; z?: number }; applyAndSave({ position: { ...pos, x: posClipboard.current.x, y: posClipboard.current.y } }) } }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: posClipFilled ? 'pointer' : 'default', color: posClipFilled ? '#4ade80' : '#333', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => { if (posClipFilled) e.currentTarget.style.color = '#86efac' }} onMouseLeave={e => { e.currentTarget.style.color = posClipFilled ? '#4ade80' : '#333' }}
          >P↓</span>
          {/* R2571: 전체 픽셀 반올림 버튼 */}
          <span
            title="위치/크기/스케일 전체를 정수 픽셀로 반올림 (R2571)"
            onClick={() => {
              const pos = draft.position as { x: number; y: number; z?: number }
              const sz = draft.size as { x: number; y: number } | undefined
              applyAndSave({
                position: { ...pos, x: Math.round(pos.x), y: Math.round(pos.y) },
                ...(sz ? { size: { x: Math.round(sz.x), y: Math.round(sz.y) } } : {}),
                scale: { x: Math.round(draft.scale.x * 100) / 100, y: Math.round(draft.scale.y * 100) / 100, z: draft.scale.z ?? 1 },
              })
            }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#64748b', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')} onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >⌊⌉All</span>
          {/* R2553: 크기 전용 복사/붙여넣기 */}
          <span
            title="크기(size) 복사 — 다른 노드에 붙여넣기 가능 (R2553)"
            onClick={() => { const sz = draft.size as { x: number; y: number } | undefined; sizeClipboard.current = { w: sz?.x ?? 0, h: sz?.y ?? 0 }; setSizeClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >S↑</span>
          <span
            title={sizeClipFilled ? `크기 붙여넣기 (${sizeClipboard.current?.w}×${sizeClipboard.current?.h}) — R2553` : '복사된 크기 없음'}
            onClick={() => { if (sizeClipboard.current) applyAndSave({ size: { x: sizeClipboard.current.w, y: sizeClipboard.current.h } }) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: sizeClipFilled ? 'pointer' : 'default', color: sizeClipFilled ? '#f472b6' : '#333', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => { if (sizeClipFilled) e.currentTarget.style.color = '#f9a8d4' }} onMouseLeave={e => { e.currentTarget.style.color = sizeClipFilled ? '#f472b6' : '#333' }}
          >S↓</span>
          {/* R1635: 세션 시작 상태로 트랜스폼 원복 */}
          {origSnapRef.current && (() => {
            const os = origSnapRef.current!
            const curPos = draft.position as { x?: number; y?: number }
            const osPos = os.position as { x?: number; y?: number }
            const changed = Math.abs((curPos?.x ?? 0) - (osPos?.x ?? 0)) > 0.05 ||
              Math.abs((curPos?.y ?? 0) - (osPos?.y ?? 0)) > 0.05 ||
              Math.abs((draft.size?.x ?? 0) - (os.size?.x ?? 0)) > 0.05 ||
              Math.abs((draft.size?.y ?? 0) - (os.size?.y ?? 0)) > 0.05
            if (!changed) return null
            return (
              <span
                title="선택 시 원래값으로 트랜스폼 복원"
                onClick={() => applyAndSave({ position: os.position, rotation: os.rotation, scale: os.scale, size: os.size })}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(255,153,68,0.4)', cursor: 'pointer', color: '#ff9944', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffb366')} onMouseLeave={e => (e.currentTarget.style.color = '#ff9944')}
              >T↩원복</span>
            )
          })()}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              위치
              <span title="위치 리셋 (0,0)" onClick={() => applyAndSave({ position: { ...draft.position, x: 0, y: 0 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
              {/* R1592: 위치 정수 반올림 버튼 */}
              <span title="위치 정수 반올림 (Round to integer)" onClick={() => applyAndSave({ position: { ...draft.position, x: Math.round(draft.position.x), y: Math.round(draft.position.y) } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⌊⌉</span>
              {/* R1682: 위치 복사 버튼 */}
              <span title="위치 클립보드 복사 (x, y)" onClick={() => navigator.clipboard.writeText(`${Math.round(draft.position.x)}, ${Math.round(draft.position.y)}`).catch(() => {})} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⎘</span>
              {/* R1670: % 토글 */}
              {zOrderInfo?.parentSize && <span title="부모 크기 기준 % 표시 토글" onClick={() => setShowPct(v => !v)} style={{ cursor: 'pointer', color: showPct ? '#58a6ff' : '#555', fontSize: 8, padding: '0 2px', border: `1px solid ${showPct ? '#58a6ff44' : 'transparent'}`, borderRadius: 2 }}>%</span>}
            </div>
            {numInput('X', draft.position.x, v => applyAndSave({ position: { ...draft.position, x: v } }))}
            {numInput('Y', draft.position.y, v => applyAndSave({ position: { ...draft.position, y: v } }))}
            {/* R1739: 위치 스텝 버튼 */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
              {([-10, -1, 1, 10] as const).map(d => (
                <span key={`px${d}`} title={`X ${d > 0 ? '+' : ''}${d}`}
                  onClick={() => applyAndSave({ position: { ...draft.position, x: draft.position.x + d } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >X{d > 0 ? '+' : ''}{d}</span>
              ))}
              {([-10, -1, 1, 10] as const).map(d => (
                <span key={`py${d}`} title={`Y ${d > 0 ? '+' : ''}${d}`}
                  onClick={() => applyAndSave({ position: { ...draft.position, y: draft.position.y + d } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >Y{d > 0 ? '+' : ''}{d}</span>
              ))}
              {/* R1752: 위치 원점 리셋 */}
              <span title="위치 원점 (0, 0) 리셋"
                onClick={() => applyAndSave({ position: { ...draft.position, x: 0, y: 0 } })}
                style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#58a6ff', userSelect: 'none', whiteSpace: 'nowrap' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#79c0ff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#58a6ff')}
              >(0,0)</span>
              {/* R1766: 스냅 그리드 / R1779: ×1 정수화 포함 */}
              {([1, 8, 16] as const).map(g => (
                <span key={`snap${g}`} title={g === 1 ? '위치 정수화 (소수점 제거)' : `위치 ×${g} 그리드 스냅`}
                  onClick={() => applyAndSave({ position: { ...draft.position, x: Math.round(draft.position.x / g) * g, y: Math.round(draft.position.y / g) * g } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
                >{g === 1 ? '⊹int' : `⊹${g}`}</span>
              ))}
            </div>
            {/* R1670: % 표시 */}
            {showPct && zOrderInfo?.parentSize && (() => {
              const pw = zOrderInfo.parentSize!.x, ph = zOrderInfo.parentSize!.y
              if (!pw || !ph) return null
              return (
                <div style={{ fontSize: 8, color: '#58a6ff', lineHeight: 1.5, marginTop: 1 }}>
                  x:{((draft.position.x / pw) * 100).toFixed(1)}% y:{((draft.position.y / ph) * 100).toFixed(1)}%
                </div>
              )
            })()}
            {/* R1656: 부모 기준 정렬 버튼 */}
            {zOrderInfo?.parentSize?.x && zOrderInfo?.parentSize?.y && (() => {
              const pw = zOrderInfo.parentSize!.x, ph = zOrderInfo.parentSize!.y
              const nw = draft.size?.x ?? 0, nh = draft.size?.y ?? 0
              const ax = draft.anchor?.x ?? 0.5, ay = draft.anchor?.y ?? 0.5
              const btns: { label: string; title: string; x?: number; y?: number }[] = [
                { label: '←', title: '부모 좌측 정렬', x: -pw / 2 + nw * ax },
                { label: '⊕', title: '부모 중앙 정렬', x: nw * (ax - 0.5), y: nh * (ay - 0.5) },
                { label: '→', title: '부모 우측 정렬', x: pw / 2 - nw * (1 - ax) },
                { label: '↑', title: '부모 상단 정렬', y: ph / 2 - nh * (1 - ay) },
                { label: '↓', title: '부모 하단 정렬', y: -ph / 2 + nh * ay },
              ]
              return (
                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                  {btns.map(b => (
                    <span key={b.label} title={b.title} onClick={() => {
                      const upd: Partial<CCSceneNode> = {}
                      if (b.x !== undefined) upd.position = { ...draft.position, x: Math.round(b.x * 10) / 10 }
                      if (b.y !== undefined) upd.position = { ...(upd.position ?? draft.position), y: Math.round(b.y * 10) / 10 }
                      applyAndSave(upd)
                    }} style={{ fontSize: 9, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >{b.label}</span>
                  ))}
                </div>
              )
            })()}
            {/* R1484: World Transform 표시 */}
            {worldPos && (
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }} title="씬 내 절대 좌표 (부모 누산)">
                <span style={{ color: '#555' }}>W </span>
                <span>{worldPos.x.toFixed(1)}, {worldPos.y.toFixed(1)}</span>
              </div>
            )}
            <div style={{ fontSize: 9, color: 'var(--text-muted)', margin: '5px 0 3px', display: 'flex', alignItems: 'center', gap: 4 }}>
              회전
              <span title="회전 리셋 (0°)" onClick={() => applyAndSave({ rotation: typeof draft.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
              {/* R1653: 회전 부호 반전 버튼 */}
              <span title="회전 부호 반전 (±)" onClick={() => { const r = typeof draft.rotation === 'number' ? -draft.rotation : { ...(draft.rotation as object), z: -(draft.rotation as {z?:number}).z! } as CCSceneNode['rotation']; applyAndSave({ rotation: r }) }} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>±</span>
              {/* R1775: 회전 정규화 버튼 (-180~180) */}
              {Math.abs(rotation) > 180 && (
                <span title={`회전 정규화: ${rotation}° → ${((((rotation % 360) + 540) % 360) - 180).toFixed(1)}°`}
                  onClick={() => {
                    const norm = ((rotation % 360) + 540) % 360 - 180
                    const r = typeof draft.rotation === 'number' ? norm : { ...(draft.rotation as object), z: norm } as CCSceneNode['rotation']
                    applyAndSave({ rotation: r })
                  }}
                  style={{ cursor: 'pointer', color: '#f87171', fontSize: 8, padding: '0 2px', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 2 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fca5a5')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#f87171')}
                >normalize</span>
              )}
              {/* R2563: 회전 클립보드 복사/붙여넣기 */}
              <span
                title="회전 복사 — 다른 노드에 붙여넣기 가능 (R2563)"
                onClick={() => { rotClipboard.current = rotation; setRotClipFilled(true) }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#a78bfa', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')} onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
              >R↑</span>
              <span
                title={rotClipFilled && rotClipboard.current !== null ? `회전 붙여넣기 (${rotClipboard.current}°) — R2563` : '복사된 회전 없음'}
                onClick={() => { if (rotClipboard.current !== null) { const r = typeof draft.rotation === 'number' ? rotClipboard.current : { ...(draft.rotation as object), z: rotClipboard.current } as CCSceneNode['rotation']; applyAndSave({ rotation: r }) } }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: rotClipFilled ? 'pointer' : 'default', color: rotClipFilled ? '#a78bfa' : '#333', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => { if (rotClipFilled) e.currentTarget.style.color = '#c4b5fd' }} onMouseLeave={e => { e.currentTarget.style.color = rotClipFilled ? '#a78bfa' : '#333' }}
              >R↓</span>
            </div>
            {numInput('Z°', rotation, v => {
              const r = typeof draft.rotation === 'number' ? v : { ...(draft.rotation as object), z: v } as CCSceneNode['rotation']
              applyAndSave({ rotation: r })
            })}
            {/* R1732: 회전 스텝 버튼 ±15°/±90° */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
              {([-90, -15, 15, 90] as const).map(delta => (
                <span
                  key={delta}
                  title={`회전 ${delta > 0 ? '+' : ''}${delta}°`}
                  onClick={() => {
                    const r = typeof draft.rotation === 'number' ? (rotation + delta) : { ...(draft.rotation as object), z: rotation + delta } as CCSceneNode['rotation']
                    applyAndSave({ rotation: r })
                  }}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >{delta > 0 ? '+' : ''}{delta}°</span>
              ))}
              {/* R2333: 회전 0° 리셋 */}
              {Math.abs(rotation) > 0.01 && (
                <span title="회전 0°으로 리셋"
                  onClick={() => {
                    const r = typeof draft.rotation === 'number' ? 0 : { ...(draft.rotation as object), z: 0 } as CCSceneNode['rotation']
                    applyAndSave({ rotation: r })
                  }}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#34d399', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#6ee7b7')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#34d399')}
                >0°</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              크기
              {/* R1592: 크기 정수 반올림 버튼 */}
              <span title="크기 정수 반올림 (Round to integer)" onClick={() => applyAndSave({ size: { x: Math.round(draft.size.x), y: Math.round(draft.size.y) } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⌊⌉</span>
              {/* R1682: 크기 복사 버튼 */}
              <span title="크기 클립보드 복사 (w × h)" onClick={() => navigator.clipboard.writeText(`${Math.round(draft.size.x)} × ${Math.round(draft.size.y)}`).catch(() => {})} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⎘</span>
              {/* R1652: 부모 크기에 맞추기 버튼 */}
              {zOrderInfo?.parentSize?.x && zOrderInfo?.parentSize?.y && (
                <span title={`부모 크기에 맞추기 (${Math.round(zOrderInfo.parentSize.x)}×${Math.round(zOrderInfo.parentSize.y)})`} onClick={() => applyAndSave({ size: { x: zOrderInfo.parentSize!.x, y: zOrderInfo.parentSize!.y } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⊞↑</span>
              )}
              {/* R1593: 크기 비율 잠금 버튼 */}
              <span
                title={lockSize ? '크기 비율 잠금 해제' : '크기 W/H 비율 잠금'}
                onClick={() => setLockSize(v => !v)}
                style={{ cursor: 'pointer', fontSize: 9, color: lockSize ? '#58a6ff' : '#555' }}
                onMouseEnter={e => (e.currentTarget.style.color = lockSize ? '#7fc6ff' : '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = lockSize ? '#58a6ff' : '#555')}
              >{lockSize ? '🔒' : '🔓'}</span>
            </div>
            {numInput('W', draft.size.x, v => {
              const ratio = draft.size.x !== 0 ? v / draft.size.x : 1
              applyAndSave({ size: lockSize ? { x: v, y: draft.size.y * ratio } : { ...draft.size, x: v } })
            })}
            {numInput('H', draft.size.y, v => {
              const ratio = draft.size.y !== 0 ? v / draft.size.y : 1
              applyAndSave({ size: lockSize ? { x: draft.size.x * ratio, y: v } : { ...draft.size, y: v } })
            })}
            {/* R1741: 크기 스텝 버튼 */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
              {([-10, -1, 1, 10] as const).map(d => (
                <span key={`sw${d}`} title={`W ${d > 0 ? '+' : ''}${d}`}
                  onClick={() => {
                    const nw = draft.size.x + d
                    const ratio = draft.size.x !== 0 ? nw / draft.size.x : 1
                    applyAndSave({ size: lockSize ? { x: nw, y: draft.size.y * ratio } : { ...draft.size, x: nw } })
                  }}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >W{d > 0 ? '+' : ''}{d}</span>
              ))}
              {([-10, -1, 1, 10] as const).map(d => (
                <span key={`sh${d}`} title={`H ${d > 0 ? '+' : ''}${d}`}
                  onClick={() => {
                    const nh = draft.size.y + d
                    const ratio = draft.size.y !== 0 ? nh / draft.size.y : 1
                    applyAndSave({ size: lockSize ? { x: draft.size.x * ratio, y: nh } : { ...draft.size, y: nh } })
                  }}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >H{d > 0 ? '+' : ''}{d}</span>
              ))}
            </div>
            {/* R1744: 크기 배율 버튼 ×0.5/×2 / R1779: int 정수화 */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
              {([0.5, 2] as const).map(mult => (
                <span key={mult} title={`크기 ×${mult}`}
                  onClick={() => applyAndSave({ size: { x: draft.size.x * mult, y: lockSize ? draft.size.y * mult : draft.size.y * mult } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >×{mult}</span>
              ))}
              <span title="크기 정수화 (소수점 제거)"
                onClick={() => applyAndSave({ size: { x: Math.round(draft.size.x), y: Math.round(draft.size.y) } })}
                style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
              >int</span>
            </div>
            {/* R1670: 크기 % 표시 */}
            {showPct && zOrderInfo?.parentSize && (() => {
              const pw = zOrderInfo.parentSize!.x, ph = zOrderInfo.parentSize!.y
              if (!pw || !ph) return null
              return (
                <div style={{ fontSize: 8, color: '#58a6ff', lineHeight: 1.5, marginTop: 1 }}>
                  w:{((draft.size.x / pw) * 100).toFixed(1)}% h:{((draft.size.y / ph) * 100).toFixed(1)}%
                </div>
              )
            })()}
            <div style={{ fontSize: 9, color: 'var(--text-muted)', margin: '5px 0 3px', display: 'flex', alignItems: 'center', gap: 4 }}>
              스케일
              <span title="스케일 리셋 (1,1)" onClick={() => applyAndSave({ scale: { x: 1, y: 1, z: draft.scale.z ?? 1 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
              <span
                title={lockScale ? '비율 잠금 해제' : '비율 잠금'}
                onClick={() => setLockScale(l => !l)}
                style={{ cursor: 'pointer', fontSize: 9, color: lockScale ? '#58a6ff' : '#555' }}
                onMouseEnter={e => (e.currentTarget.style.color = lockScale ? '#7fc6ff' : '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = lockScale ? '#58a6ff' : '#555')}
              >{lockScale ? '🔒' : '🔓'}</span>
              {/* R1645: X/Y 반전 버튼 */}
              <span title="X 반전 (scaleX 부호 반전)" onClick={() => applyAndSave({ scale: { ...draft.scale, x: -draft.scale.x } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↔</span>
              <span title="Y 반전 (scaleY 부호 반전)" onClick={() => applyAndSave({ scale: { ...draft.scale, y: -draft.scale.y } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↕</span>
              {/* R1686: 균등 스케일 (X=Y=평균) */}
              {draft.scale.x !== draft.scale.y && (
                <span title={`균등 스케일 X=Y (평균: ${((draft.scale.x + draft.scale.y) / 2).toFixed(2)})`} onClick={() => { const avg = (draft.scale.x + draft.scale.y) / 2; applyAndSave({ scale: { ...draft.scale, x: avg, y: avg } }) }} style={{ cursor: 'pointer', color: '#fbbf24', fontSize: 8, padding: '0 2px', borderRadius: 2 }} onMouseEnter={e => (e.currentTarget.style.color = '#fde68a')} onMouseLeave={e => (e.currentTarget.style.color = '#fbbf24')}>⊟</span>
              )}
              {/* R2564: 스케일 클립보드 복사/붙여넣기 */}
              <span
                title="스케일(X,Y) 복사 — 다른 노드에 붙여넣기 가능 (R2564)"
                onClick={() => { scaleClipboard.current = { x: draft.scale.x, y: draft.scale.y }; setScaleClipFilled(true) }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#34d399', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#6ee7b7')} onMouseLeave={e => (e.currentTarget.style.color = '#34d399')}
              >Sc↑</span>
              <span
                title={scaleClipFilled && scaleClipboard.current ? `스케일 붙여넣기 (${scaleClipboard.current.x}, ${scaleClipboard.current.y}) — R2564` : '복사된 스케일 없음'}
                onClick={() => { if (scaleClipboard.current) applyAndSave({ scale: { ...draft.scale, x: scaleClipboard.current.x, y: scaleClipboard.current.y } }) }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: scaleClipFilled ? 'pointer' : 'default', color: scaleClipFilled ? '#34d399' : '#333', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => { if (scaleClipFilled) e.currentTarget.style.color = '#6ee7b7' }} onMouseLeave={e => { e.currentTarget.style.color = scaleClipFilled ? '#34d399' : '#333' }}
              >Sc↓</span>
            </div>
            {numInput('X', draft.scale.x, v => {
              const ratio = draft.scale.x !== 0 ? v / draft.scale.x : 1
              applyAndSave({ scale: lockScale ? { x: v, y: draft.scale.y * ratio, z: draft.scale.z ?? 1 } : { ...draft.scale, x: v } })
            }, 0.01)}
            {numInput('Y', draft.scale.y, v => {
              const ratio = draft.scale.y !== 0 ? v / draft.scale.y : 1
              applyAndSave({ scale: lockScale ? { x: draft.scale.x * ratio, y: v, z: draft.scale.z ?? 1 } : { ...draft.scale, y: v } })
            }, 0.01)}
            {/* R1733: 스케일 스텝 버튼 ×0.5/×2 / R1782: int 정수화 */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
              {([0.5, 2] as const).map(mult => (
                <span
                  key={mult}
                  title={`스케일 ×${mult}`}
                  onClick={() => applyAndSave({ scale: { x: draft.scale.x * mult, y: draft.scale.y * mult, z: draft.scale.z ?? 1 } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >×{mult}</span>
              ))}
              <span title="스케일 정수화 (소수점 제거)"
                onClick={() => applyAndSave({ scale: { x: Math.round(draft.scale.x), y: Math.round(draft.scale.y), z: Math.round(draft.scale.z ?? 1) } })}
                style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
              >int</span>
              {/* R2333: 스케일 1:1 리셋 */}
              <span title="스케일 1:1 리셋 (X=1, Y=1)"
                onClick={() => applyAndSave({ scale: { x: 1, y: 1, z: 1 } })}
                style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#34d399', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#6ee7b7')}
                onMouseLeave={e => (e.currentTarget.style.color = '#34d399')}
              >1:1</span>
            </div>
          </div>
        </div>
        </>
      )}

      {secHeader('anchor', '앵커 / 불투명도', (() => {
        const os = origSnapRef.current
        if (!os) return false
        return Math.abs((draft.opacity ?? 255) - (os.opacity ?? 255)) > 0.5
      })())}
      {!collapsed['anchor'] && (
      <div>
        {/* R2554: 앵커 변경 시 position 자동 보정 토글 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, cursor: 'pointer', fontSize: 9, color: anchorCompensate ? '#34d399' : 'var(--text-muted)' }}>
          <input type="checkbox" checked={anchorCompensate} onChange={e => setAnchorCompensate(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#34d399' }} />
          앵커 변경 시 위치 자동 보정 (R2554)
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {numInput('aX', draft.anchor.x, v => applyAndSave({ anchor: { ...draft.anchor, x: v } }), 0.01)}
            {numInput('aY', draft.anchor.y, v => applyAndSave({ anchor: { ...draft.anchor, y: v } }), 0.01)}
          </div>
          {/* R1671: 앵커 9-point 프리셋 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 16px)', gap: 2, flexShrink: 0 }}>
            {([1, 1, 0.5, 1, 1, 1, 0, 0.5, 0.5, 0.5, 1, 0.5, 0, 0, 0.5, 0, 1, 0] as number[]).reduce<Array<[number,number]>>((acc, _, i, arr) => i % 2 === 0 ? [...acc, [arr[i], arr[i+1]]] : acc, []).map(([ax, ay]) => {
              const isActive = Math.abs((draft.anchor.x ?? 0.5) - ax) < 0.01 && Math.abs((draft.anchor.y ?? 0.5) - ay) < 0.01
              const labels: Record<string, string> = {
                '0,1': '↖', '0.5,1': '↑', '1,1': '↗',
                '0,0.5': '←', '0.5,0.5': '⊕', '1,0.5': '→',
                '0,0': '↙', '0.5,0': '↓', '1,0': '↘',
              }
              const label = labels[`${ax},${ay}`] ?? '·'
              return (
                <span
                  key={`${ax}-${ay}`}
                  title={`앵커 (${ax}, ${ay})`}
                  onClick={() => {
                    // R2554: anchorCompensate ON이면 position 자동 보정
                    if (anchorCompensate) {
                      const oldAx = draft.anchor?.x ?? 0.5, oldAy = draft.anchor?.y ?? 0.5
                      const w = draft.size?.x ?? 0, h = draft.size?.y ?? 0
                      const pos = draft.position as { x: number; y: number; z?: number }
                      const newPosX = pos.x + (oldAx - ax) * w
                      const newPosY = pos.y + (oldAy - ay) * h
                      applyAndSave({ anchor: { x: ax, y: ay }, position: { ...pos, x: newPosX, y: newPosY } })
                    } else {
                      applyAndSave({ anchor: { x: ax, y: ay } })
                    }
                  }}
                  style={{
                    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, cursor: 'pointer', borderRadius: 2, userSelect: 'none',
                    background: isActive ? 'rgba(88,166,255,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? '#58a6ff' : 'var(--border)'}`,
                    color: isActive ? '#58a6ff' : 'var(--text-muted)',
                  }}
                >{label}</span>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>α (불투명)</span>
          <input
            type="range"
            min={0}
            max={255}
            step={1}
            value={draft.opacity ?? 255}
            onChange={e => applyAndSave({ opacity: Number(e.target.value) })}
            style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
          <span style={{ width: 36, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
            {Math.round(((draft.opacity ?? 255) / 255) * 100)}%
          </span>
          {/* R2574: 불투명도 클립보드 o↑/o↓ */}
          <span
            title={`불투명도 복사 (${draft.opacity ?? 255}) — R2574`}
            onClick={() => { opacityClipboard.current = draft.opacity ?? 255; setOpacityClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#94a3b8', background: 'none', userSelect: 'none', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#cbd5e1' }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
          >o↑</span>
          <span
            title={opacityClipFilled && opacityClipboard.current !== null ? `불투명도 붙여넣기 (${opacityClipboard.current}) — R2574` : '복사된 불투명도 없음'}
            onClick={() => { if (opacityClipboard.current !== null) applyAndSave({ opacity: opacityClipboard.current }) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: opacityClipFilled ? 'pointer' : 'default', color: opacityClipFilled ? '#94a3b8' : '#333', background: 'none', userSelect: 'none', flexShrink: 0 }}
            onMouseEnter={e => { if (opacityClipFilled) e.currentTarget.style.color = '#cbd5e1' }} onMouseLeave={e => { e.currentTarget.style.color = opacityClipFilled ? '#94a3b8' : '#333' }}
          >o↓</span>
        </div>
        {/* R1647: opacity 빠른 프리셋 */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 4, marginTop: 2 }}>
          {([0, 64, 128, 191, 255] as const).map(v => (
            <span
              key={v}
              onClick={() => applyAndSave({ opacity: v })}
              title={`opacity ${Math.round(v / 255 * 100)}%`}
              style={{ fontSize: 8, padding: '0 3px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border)', color: Math.abs((draft.opacity ?? 255) - v) < 2 ? '#58a6ff' : 'var(--text-muted)', background: Math.abs((draft.opacity ?? 255) - v) < 2 ? 'rgba(88,166,255,0.12)' : 'none', userSelect: 'none' }}
            >{Math.round(v / 255 * 100)}%</span>
          ))}
        </div>
        {/* R1609: 노드 색상(tint) 피커 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>tint</span>
          <input
            type="color"
            value={(() => {
              const c = draft.color ?? { r: 255, g: 255, b: 255 }
              return `#${(c.r ?? 255).toString(16).padStart(2,'0')}${(c.g ?? 255).toString(16).padStart(2,'0')}${(c.b ?? 255).toString(16).padStart(2,'0')}`
            })()}
            onChange={e => {
              const hex = e.target.value
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              applyAndSave({ color: { r, g, b, a: draft.color?.a ?? 255 } })
            }}
            title="노드 색상 tint (흰색=기본)"
            style={{ width: 26, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
          />
          {/* R2518: hex 텍스트 직접 입력 */}
          {(() => {
            const c = draft.color ?? { r: 255, g: 255, b: 255 }
            const currentHex = `#${(c.r ?? 255).toString(16).padStart(2,'0')}${(c.g ?? 255).toString(16).padStart(2,'0')}${(c.b ?? 255).toString(16).padStart(2,'0')}`
            const displayVal = tintHexFocused ? tintHexInput : currentHex
            return (
              <input
                type="text" value={displayVal} maxLength={7}
                title="hex 코드 직접 입력 (예: #ff0000) (R2518)"
                onFocus={() => { setTintHexFocused(true); setTintHexInput(currentHex) }}
                onBlur={() => {
                  setTintHexFocused(false)
                  const m = tintHexInput.match(/^#?([0-9a-f]{6})$/i)
                  if (m) {
                    const hex = m[1]
                    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
                    applyAndSave({ color: { r, g, b, a: c.a ?? 255 } })
                  }
                }}
                onChange={e => setTintHexInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const m = tintHexInput.match(/^#?([0-9a-f]{6})$/i)
                    if (m) { const hex = m[1]; const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16); applyAndSave({ color: { r, g, b, a: c.a ?? 255 } }) }
                    e.currentTarget.blur()
                  }
                }}
                style={{ width: 52, fontSize: 8, padding: '1px 2px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}
              />
            )
          })()}
          {((draft.color?.r ?? 255) !== 255 || (draft.color?.g ?? 255) !== 255 || (draft.color?.b ?? 255) !== 255) && (
            <span
              title="tint 초기화 (흰색)"
              onClick={() => applyAndSave({ color: { r: 255, g: 255, b: 255, a: draft.color?.a ?? 255 } })}
              style={{ fontSize: 9, color: '#555', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >↺</span>
          )}
          {/* R2562: 색상 클립보드 복사/붙여넣기 */}
          <span
            title="색상(tint) 복사 — 다른 노드에 붙여넣기 가능 (R2562)"
            onClick={() => { const c = draft.color ?? { r: 255, g: 255, b: 255 }; colorClipboard.current = { r: c.r ?? 255, g: c.g ?? 255, b: c.b ?? 255 }; setColorClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#fb923c', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fdba74')} onMouseLeave={e => (e.currentTarget.style.color = '#fb923c')}
          >C↑</span>
          <span
            title={colorClipFilled && colorClipboard.current ? `색상 붙여넣기 (#${colorClipboard.current.r.toString(16).padStart(2,'0')}${colorClipboard.current.g.toString(16).padStart(2,'0')}${colorClipboard.current.b.toString(16).padStart(2,'0')}) — R2562` : '복사된 색상 없음'}
            onClick={() => { if (colorClipboard.current) { const cc = colorClipboard.current; applyAndSave({ color: { r: cc.r, g: cc.g, b: cc.b, a: draft.color?.a ?? 255 } }) } }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: colorClipFilled ? 'pointer' : 'default', color: colorClipFilled ? '#fb923c' : '#333', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => { if (colorClipFilled) e.currentTarget.style.color = '#fdba74' }} onMouseLeave={e => { e.currentTarget.style.color = colorClipFilled ? '#fb923c' : '#333' }}
          >C↓</span>
          {/* R1631: 빠른 tint 색상 프리셋 */}
          {([{ r:255,g:0,b:0 },{ r:255,g:128,b:0 },{ r:255,g:255,b:0 },{ r:0,g:255,b:0 },{ r:0,g:128,b:255 },{ r:128,g:0,b:255 },{ r:0,g:0,b:0 }] as const).map(c => (
            <div
              key={`${c.r}${c.g}${c.b}`}
              onClick={() => applyAndSave({ color: { r: c.r, g: c.g, b: c.b, a: draft.color?.a ?? 255 } })}
              title={`tint #${c.r.toString(16).padStart(2,'0')}${c.g.toString(16).padStart(2,'0')}${c.b.toString(16).padStart(2,'0')}`}
              style={{ width: 10, height: 10, borderRadius: 2, cursor: 'pointer', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)', background: `rgb(${c.r},${c.g},${c.b})` }}
            />
          ))}
        </div>
      </div>
      )}

      {/* R1479: Layer 필드 편집 (CC2.x _layer / CC3.x layer — 둘 다 지원) */}
      {draft.layer != null && (() => {
        const is3x = sceneFile.projectInfo?.version === '3x'
        const layerOptions3x: [number, string][] = [
          [1, 'DEFAULT'], [2, 'IGNORE_RAYCAST'], [4, 'GIZMOS'], [8, 'EDITOR'],
          [16, 'UI_3D'], [32, 'SCENE_GIZMO'], [64, 'PROFILER'],
          [524288, 'UI_2D'], [1073741824, 'ALL'],
        ]
        const layerOptions2x: [number, string][] = [
          [0, 'NONE'], [1, 'DEFAULT'], [2, 'IGNORE_RAYCAST'], [4, 'GIZMOS'],
          [8, 'EDITOR'], [16, 'UI'], [32, 'SCENE_GIZMO'], [33554432, '기본(0x2000000)'],
        ]
        const layerOptions = is3x ? layerOptions3x : layerOptions2x
        const isKnown = layerOptions.some(([v]) => v === draft.layer)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>layer</span>
            <select
              value={isKnown ? draft.layer : 'custom'}
              onChange={e => { if (e.target.value !== 'custom') applyAndSave({ layer: Number(e.target.value) }) }}
              style={{
                flex: 1, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px',
              }}
            >
              {layerOptions.map(([v, n]) => <option key={v} value={v}>{n} ({v})</option>)}
              {!isKnown && <option value="custom">0x{draft.layer.toString(16)}</option>}
            </select>
            <input
              type="number"
              value={draft.layer}
              onChange={e => applyAndSave({ layer: parseInt(e.target.value) || 0 })}
              style={{ width: 60, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
              title="레이어 비트마스크 직접 입력"
            />
          </div>
        )
      })()}

      {/* R2343: 노드 tag 편집 (CC2.x _tag → normalized tag) */}
      {draft.tag != null && draft.tag !== 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 26, flexShrink: 0 }}>tag</span>
          <input type="number" defaultValue={draft.tag ?? 0}
            key={`tag-${draft.tag}`}
            onBlur={e => applyAndSave({ tag: parseInt(e.target.value) || 0 })}
            style={{ width: 54, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fbbf24', borderRadius: 3, padding: '1px 3px' }}
            title="노드 태그 (CC2.x _tag) — 0은 기본값으로 숨김"
          />
          <span style={{ fontSize: 8, color: '#555' }}>_tag</span>
        </div>
      )}

      {/* R2393: cascadeOpacityEnabled + cascadeColorEnabled (CC2.x 노드 레벨) */}
      {!is3x && (
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox"
              checked={!!(draft.cascadeOpacityEnabled ?? (draft as Record<string,unknown>)._cascadeOpacityEnabled ?? true)}
              onChange={e => applyAndSave({ cascadeOpacityEnabled: e.target.checked } as Partial<CCSceneNode>)}
            />cascadeOpacity
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox"
              checked={!!(draft.cascadeColorEnabled ?? (draft as Record<string,unknown>)._cascadeColorEnabled ?? false)}
              onChange={e => applyAndSave({ cascadeColorEnabled: e.target.checked } as Partial<CCSceneNode>)}
            />cascadeColor
          </label>
        </div>
      )}
      {/* R2394: skewX / skewY (CC2.x 노드 레벨) */}
      {!is3x && (() => {
        const sx = Number((draft as Record<string,unknown>)._skewX ?? (draft as Record<string,unknown>).skewX ?? 0)
        const sy = Number((draft as Record<string,unknown>)._skewY ?? (draft as Record<string,unknown>).skewY ?? 0)
        if (sx === 0 && sy === 0) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 26, flexShrink: 0 }}>skew</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>x</span>
            <input type="number" defaultValue={sx} key={`skx-${sx}`} step={1}
              onBlur={e => applyAndSave({ _skewX: parseFloat(e.target.value) || 0 } as Partial<CCSceneNode>)}
              style={{ width: 44, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fbbf24', borderRadius: 3, padding: '1px 3px' }}
            />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
            <input type="number" defaultValue={sy} key={`sky-${sy}`} step={1}
              onBlur={e => applyAndSave({ _skewY: parseFloat(e.target.value) || 0 } as Partial<CCSceneNode>)}
              style={{ width: 44, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fbbf24', borderRadius: 3, padding: '1px 3px' }}
            />
          </div>
        )
      })()}
      {/* R2395: _rotationX / _rotationY (CC2.x 3D 회전) */}
      {!is3x && (() => {
        const rx = Number((draft as Record<string,unknown>)._rotationX ?? (draft as Record<string,unknown>).rotationX ?? 0)
        const ry = Number((draft as Record<string,unknown>)._rotationY ?? (draft as Record<string,unknown>).rotationY ?? 0)
        if (rx === 0 && ry === 0) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 26, flexShrink: 0 }}>rot3</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>x</span>
            <input type="number" defaultValue={rx} key={`rx-${rx}`} step={1}
              onBlur={e => applyAndSave({ _rotationX: parseFloat(e.target.value) || 0 } as Partial<CCSceneNode>)}
              style={{ width: 44, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fb923c', borderRadius: 3, padding: '1px 3px' }}
            />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
            <input type="number" defaultValue={ry} key={`ry-${ry}`} step={1}
              onBlur={e => applyAndSave({ _rotationY: parseFloat(e.target.value) || 0 } as Partial<CCSceneNode>)}
              style={{ width: 44, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fb923c', borderRadius: 3, padding: '1px 3px' }}
            />
          </div>
        )
      })()}

      {/* R1646: 색상 변경 인디케이터 */}
      {secHeader('color', '색상', (() => {
        const os = origSnapRef.current
        if (!os) return false
        const oc = os.color ?? { r: 255, g: 255, b: 255, a: 255 }
        const dc = draft.color
        return Math.abs((dc.r) - (oc.r ?? 255)) > 0 ||
          Math.abs((dc.g) - (oc.g ?? 255)) > 0 ||
          Math.abs((dc.b) - (oc.b ?? 255)) > 0 ||
          Math.abs((dc.a) - (oc.a ?? 255)) > 0
      })())}
      {!collapsed['color'] && (
      <div style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="color"
            value={`#${[draft.color.r, draft.color.g, draft.color.b].map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('')}`}
            onChange={e => {
              const hex = e.target.value.slice(1)
              const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
              applyAndSave({ color: { r, g, b, a: draft.color.a } })
            }}
            style={{ width: 28, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'none' }}
          />
          {numInput('A', draft.color.a, v => applyAndSave({ color: { ...draft.color, a: Math.min(255,Math.max(0,Math.round(v))) } }))}
        </div>
      </div>
      )}

      {/* R1532: Tag / Layer 편집 */}
      {(draft.tag != null || draft.layer != null) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {draft.tag != null && (
            <>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 24 }}>Tag</span>
              <input
                type="number"
                value={draft.tag}
                onChange={e => applyAndSave({ tag: parseInt(e.target.value) || 0 })}
                style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
              />
            </>
          )}
          {draft.layer != null && (
            <>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 30 }}>Layer</span>
              <input
                type="number"
                value={draft.layer}
                onChange={e => applyAndSave({ layer: parseInt(e.target.value) || 0 })}
                style={{ width: 66, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
              />
              {/* R1774: 레이어 이름 배지 */}
              {(() => {
                const layerNames: Record<number, string> = { 1: 'DEFAULT', 2: 'IGNORE_RAYCAST', 4: 'TERRAIN', 8: 'ENVIRONMENT', 16: 'UI_3D', 512: 'SCENE_GIZMO', 1024: 'EDITOR', 524288: 'UI_2D', 1073741824: 'ALL' }
                const name = layerNames[draft.layer!]
                return name ? <span style={{ fontSize: 8, color: '#a78bfa', padding: '1px 3px', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 2 }}>{name}</span> : null
              })()}
            </>
          )}
        </div>
      )}

      {/* 컴포넌트 props */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>{secHeader('comps', `컴포넌트 (${draft.components.length})`)}</div>
        {/* R1689: 컴포넌트 일괄 접기/펴기 */}
        {!collapsed['comps'] && draft.components.length > 1 && (
          <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
            <span title="모두 접기" onClick={() => { const allTypes = draft.components.map(c => c.type); setCollapsedComps(prev => { const n = new Set(prev); allTypes.forEach(t => n.add(t)); localStorage.setItem(COLLAPSED_COMPS_KEY, JSON.stringify([...n])); return n }) }} style={{ fontSize: 8, cursor: 'pointer', color: '#555', padding: '0 3px' }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>▸▸</span>
            <span title="모두 펴기" onClick={() => { const allTypes = draft.components.map(c => c.type); setCollapsedComps(prev => { const n = new Set(prev); allTypes.forEach(t => n.delete(t)); localStorage.setItem(COLLAPSED_COMPS_KEY, JSON.stringify([...n])); return n }) }} style={{ fontSize: 8, cursor: 'pointer', color: '#555', padding: '0 3px' }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>▾▾</span>
            {/* R1704: 전체 컴포넌트 enabled 토글 */}
            {(() => {
              const allEnabled = draft.components.every(c => c.props.enabled !== false)
              return (
                <span
                  title={allEnabled ? '모든 컴포넌트 비활성화 (R1704)' : '모든 컴포넌트 활성화 (R1704)'}
                  onClick={() => {
                    const updated = draft.components.map(c => ({ ...c, props: { ...c.props, enabled: !allEnabled, _enabled: !allEnabled } }))
                    applyAndSave({ components: updated })
                  }}
                  style={{ fontSize: 8, cursor: 'pointer', color: allEnabled ? '#555' : '#fbbf24', padding: '0 3px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = allEnabled ? '#aaa' : '#f59e0b')}
                  onMouseLeave={e => (e.currentTarget.style.color = allEnabled ? '#555' : '#fbbf24')}
                >{allEnabled ? '⏸' : '▶'}</span>
              )
            })()}
          </div>
        )}
      </div>
      {/* R1536: PropSearch 키 하이라이트 헬퍼 */}
      {!collapsed['comps'] && (() => {
        const skipTypes = ['cc.UITransform', 'cc.PrefabInfo', 'cc.CompPrefabInfo', 'cc.SceneGlobals', 'cc.AmbientInfo', 'cc.ShadowsInfo', 'cc.FogInfo', 'cc.OctreeInfo', 'cc.SkyboxInfo']
        // R1473: 커스텀 스크립트 컴포넌트 (cc. 접두사 없는 타입) 항상 표시
        const isCustomScript = (type: string) => !type.startsWith('cc.') && !type.startsWith('cc-') && type !== ''
        const visibleComps = draft.components.map((c, origIdx) => ({ comp: c, origIdx })).filter(({ comp: c }) => {
          if (skipTypes.includes(c.type)) return false
          if (isCustomScript(c.type)) return true // 커스텀 스크립트는 props 여부 무관 표시
          return Object.values(c.props).some(v => {
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return true
            if (v && typeof v === 'object') {
              if ('__uuid__' in (v as object)) return true
              const keys = Object.keys(v as object).filter(k => typeof (v as Record<string, unknown>)[k] === 'number')
              if (keys.length >= 2 && keys.length <= 3) return true
            }
            return false
          })
        })
        // propSearch로 컴포넌트 타입 매칭: 해당 타입은 전체 표시 (자동 펼침)
        const typeMatchedComps = propSearch
          ? visibleComps.filter(({ comp: c }) => c.type.toLowerCase().includes(propSearch.toLowerCase()))
          : null
        const showComps = typeMatchedComps ?? visibleComps
        return (
        <>
        {/* R1608: 컴포넌트 퀵점프 칩 바 */}
        {showComps.length > 3 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '2px 0 4px' }}>
            {showComps.map(({ comp, origIdx: oi }) => (
              <span key={oi}
                onClick={() => document.getElementById(`cc-comp-${node.uuid}-${oi}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                style={{ fontSize: 7, padding: '1px 4px', background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 10, cursor: 'pointer', color: '#7aacff', whiteSpace: 'nowrap' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.08)')}
              >{comp.type.replace('cc.', '')}</span>
            ))}
          </div>
        )}
        {showComps.map(({ comp, origIdx }, ci) => (
        <div
          id={`cc-comp-${node.uuid}-${origIdx}`}
          key={`${node.uuid}-${origIdx}`}
          style={{ marginTop: 6, borderTop: dragOverIdx === ci ? '2px solid var(--accent)' : '1px solid var(--border)', paddingTop: 5, opacity: draggingIdx === ci ? 0.4 : 1 }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(ci) }}
          onDragLeave={() => setDragOverIdx(null)}
          onDrop={e => {
            e.preventDefault()
            setDragOverIdx(null)
            setDraggingIdx(null)
            const fromCi = parseInt(e.dataTransfer.getData('compCi'))
            if (isNaN(fromCi) || fromCi === ci) return
            const fromOrigIdx = visibleComps[fromCi]?.origIdx
            const toOrigIdx = origIdx
            if (fromOrigIdx == null || fromOrigIdx === toOrigIdx) return
            const newComps = [...draft.components]
            const [moved] = newComps.splice(fromOrigIdx, 1)
            // splice 후 toOrigIdx 보정: from이 to보다 앞에 있으면 한 칸 앞당겨짐
            const adjustedTo = fromOrigIdx < toOrigIdx ? toOrigIdx - 1 : toOrigIdx
            newComps.splice(adjustedTo, 0, moved)
            applyAndSave({ components: newComps })
          }}
        >
          {/* R1473: 커스텀 스크립트 구분선 */}
          {ci > 0 && isCustomScript(comp.type) && !isCustomScript(visibleComps[ci - 1].comp.type) && (
            <div style={{ fontSize: 8, color: '#7cf', opacity: 0.6, marginTop: 2, marginBottom: 2, letterSpacing: 1 }}>── 커스텀 스크립트 ──</div>
          )}
          <div
            style={{ fontSize: 9, color: isCustomScript(comp.type) ? '#7cf' : 'var(--accent)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setCollapsedComps(s => {
              const n = new Set(s)
              if (n.has(comp.type)) n.delete(comp.type); else n.add(comp.type)
              localStorage.setItem(COLLAPSED_COMPS_KEY, JSON.stringify([...n]))
              return n
            })}
          >
            <span
              draggable
              onDragStart={e => { e.dataTransfer.setData('compCi', String(ci)); e.dataTransfer.effectAllowed = 'move'; setDraggingIdx(ci) }}
              onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null) }}
              onClick={e => e.stopPropagation()}
              style={{ cursor: 'grab', padding: '0 4px', opacity: 0.5, fontSize: 10, lineHeight: 1 }}
              title="드래그하여 순서 변경"
            >⠿</span>
            {/* R1541: 컴포넌트 enabled 토글 */}
            <input
              type="checkbox"
              checked={!!(comp.props.enabled ?? true)}
              onChange={e => {
                e.stopPropagation()
                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked } } : c)
                applyAndSave({ components: updated })
              }}
              onClick={e => e.stopPropagation()}
              title={`컴포넌트 ${comp.props.enabled === false ? '활성화' : '비활성화'}`}
              style={{ margin: 0, marginRight: 3, flexShrink: 0, cursor: 'pointer', accentColor: '#4ade80' }}
            />
            <span style={{ fontSize: 7, color: 'var(--text-muted)', marginRight: 3 }}>{collapsedComps.has(comp.type) ? '▸' : '▾'}</span>
            {/* R2328: 컴포넌트 타입 설명 tooltip */}
            <span title={COMP_DESCRIPTIONS[comp.type] ?? comp.type} style={{ flex: 1, opacity: comp.props.enabled === false ? 0.5 : 1, color: (() => {
              // R1680: 컴포넌트 타입별 색상 구분
              const typeColorMap: Record<string, string> = {
                'cc.Label': '#58a6ff', 'cc.RichText': '#58a6ff',
                'cc.Sprite': '#4ade80', 'cc.TiledMap': '#4ade80', 'cc.VideoPlayer': '#4ade80',
                'cc.Button': '#fb923c', 'cc.Toggle': '#fb923c', 'cc.Slider': '#fb923c',
                'cc.Widget': '#a78bfa', 'cc.Layout': '#a78bfa', 'cc.SafeArea': '#a78bfa',
                'cc.Animation': '#f472b6', 'sp.Skeleton': '#f472b6', 'dragonBones.ArmatureDisplay': '#f472b6',
                'cc.AudioSource': '#facc15',
                'cc.ScrollView': '#34d399', 'cc.PageView': '#34d399',
                'cc.RigidBody': '#f87171', 'cc.BoxCollider': '#f87171', 'cc.CircleCollider': '#f87171',
                'cc.BlockInputEvents': '#94a3b8', 'cc.ProgressBar': '#94a3b8',
              }
              return typeColorMap[comp.type] ?? (isCustomScript(comp.type) ? '#c084fc' : 'var(--text-primary)')
            })() }}>
              {/* R2330: 컴포넌트 타입 아이콘 */}
              {isCustomScript(comp.type) ? '📝 ' : COMP_ICONS[comp.type] ? <span style={{ fontSize: 9, marginRight: 3, opacity: 0.8 }}>{COMP_ICONS[comp.type]}</span> : null}{comp.type.includes('.') ? comp.type.split('.').pop() : comp.type}
            </span>
            {/* R1660/R1662: 씬 내 동일 타입 노드 수 배지 + 팝업 */}
            {(compTypeCountMap[comp.type] ?? 0) > 1 && (
              <span
                title={`씬 내 ${comp.type} 컴포넌트 보유 노드: ${compTypeCountMap[comp.type]}개 (클릭: 목록)`}
                onClick={e => { e.stopPropagation(); setSameCompPopup(sameCompPopup === comp.type ? null : comp.type) }}
                style={{ fontSize: 7, padding: '1px 3px', borderRadius: 8, background: sameCompPopup === comp.type ? 'rgba(88,166,255,0.15)' : 'rgba(255,255,255,0.06)', color: sameCompPopup === comp.type ? '#58a6ff' : '#666', marginRight: 3, flexShrink: 0, cursor: 'pointer', position: 'relative' }}
              >
                ×{compTypeCountMap[comp.type]}
                {/* R1662: 같은 타입 노드 목록 팝업 */}
                {sameCompPopup === comp.type && (() => {
                  const nodes: CCSceneNode[] = []
                  function findNodes(n: CCSceneNode) { if (n.components.some(c => c.type === comp.type)) nodes.push(n); n.children.forEach(findNodes) }
                  findNodes(sceneFile.root)
                  return (
                    <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, background: 'var(--panel-bg, #16213e)', border: '1px solid var(--border)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: 140, maxHeight: 160, overflowY: 'auto', fontSize: 9 }}>
                      <div style={{ padding: '3px 6px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontSize: 8 }}>{comp.type.split('.').pop()} 보유 노드 ({nodes.length})</div>
                      {nodes.map(n => (
                        <div key={n.uuid} onClick={() => { onUpdate(n); setSameCompPopup(null) }} style={{ padding: '4px 8px', cursor: 'pointer', color: n.uuid === node.uuid ? '#58a6ff' : 'var(--text-primary)', background: 'transparent', fontWeight: n.uuid === node.uuid ? 700 : 400 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {n.active ? '' : '◌ '}{n.name || '(unnamed)'}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </span>
            )}
            {showComps.length > 1 && (
              <span style={{ fontSize: 9, color: 'var(--text-muted)', marginRight: 4 }}>#{ci + 1}</span>
            )}
            {compCopied && copiedCompRef.current && copiedCompRef.current.type !== comp.type && (
              <span
                title={`${copiedCompRef.current.type.split('.').pop()} 붙여넣기`}
                onClick={e => {
                  e.stopPropagation()
                  if (!copiedCompRef.current) return
                  applyAndSave({ components: [...draft.components, { ...copiedCompRef.current }] })
                  setCompCopied(null)
                }}
                style={{ cursor: 'pointer', color: '#58a6ff', fontSize: 9, padding: '0 3px', lineHeight: 1 }}
              >📋</span>
            )}
            {/* R2568: 개별 컴포넌트 enabled 토글 */}
            {(() => {
              const isEnabled = comp.props.enabled !== false && comp.props._enabled !== false
              return (
                <span
                  title={isEnabled ? `${comp.type.split('.').pop()} 비활성화 (R2568)` : `${comp.type.split('.').pop()} 활성화 (R2568)`}
                  onClick={e => {
                    e.stopPropagation()
                    const newEnabled = !isEnabled
                    applyAndSave({ components: draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: newEnabled, _enabled: newEnabled } } : c) })
                  }}
                  style={{ cursor: 'pointer', color: isEnabled ? '#666' : '#fbbf24', fontSize: 9, padding: '0 2px', lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = isEnabled ? '#aaa' : '#f59e0b')}
                  onMouseLeave={e => (e.currentTarget.style.color = isEnabled ? '#666' : '#fbbf24')}
                >{isEnabled ? '⏸' : '▶'}</span>
              )
            })()}
            <span
              title="컴포넌트 복사"
              onClick={e => {
                e.stopPropagation()
                copiedCompRef.current = { type: comp.type, props: { ...comp.props } }
                setCompCopied(comp.type)
                setTimeout(() => setCompCopied(null), 3000)
              }}
              style={{ cursor: 'pointer', color: compCopied === comp.type ? '#58a6ff' : '#666', fontSize: 9, padding: '0 3px', lineHeight: 1 }}
            >{compCopied === comp.type ? '✓' : '⎘'}</span>
            {/* R1528: 컴포넌트 순서 변경 ▲▼ */}
            <span
              title="위로 이동"
              onClick={e => {
                e.stopPropagation()
                if (origIdx <= 0) return
                const comps = [...draft.components]
                const [moved] = comps.splice(origIdx, 1)
                comps.splice(origIdx - 1, 0, moved)
                applyAndSave({ components: comps })
              }}
              style={{ cursor: origIdx > 0 ? 'pointer' : 'default', color: origIdx > 0 ? '#666' : '#2a2a2a', fontSize: 9, padding: '0 2px', lineHeight: 1 }}
            >▲</span>
            <span
              title="아래로 이동"
              onClick={e => {
                e.stopPropagation()
                if (origIdx >= draft.components.length - 1) return
                const comps = [...draft.components]
                const [moved] = comps.splice(origIdx, 1)
                comps.splice(origIdx + 1, 0, moved)
                applyAndSave({ components: comps })
              }}
              style={{ cursor: origIdx < draft.components.length - 1 ? 'pointer' : 'default', color: origIdx < draft.components.length - 1 ? '#666' : '#2a2a2a', fontSize: 9, padding: '0 2px', lineHeight: 1 }}
            >▼</span>
            <span
              title="컴포넌트 삭제"
              onClick={e => { e.stopPropagation(); applyAndSave({ components: draft.components.filter((_, i) => i !== origIdx) }) }}
              style={{ cursor: 'pointer', color: '#666', fontSize: 10, padding: '0 2px', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ff6666')}
              onMouseLeave={e => (e.currentTarget.style.color = '#666')}
            >✕</span>
          </div>
          {/* R1520: 컴포넌트 전용 Quick Edit (Toggle/ProgressBar/AudioSource/RichText) */}
          {!collapsedComps.has(comp.type) && (() => {
            const p = comp.props
            // R1584: cc.Layout — type/resize/padding/spacing Quick Edit
            if (comp.type === 'cc.Layout') {
              const layoutType = Number(p.type ?? 0)
              const resizeMode = Number(p.resizeMode ?? 0)
              const spacingX = Number(p.spacingX ?? 0)
              const spacingY = Number(p.spacingY ?? 0)
              const pLeft = Number(p.paddingLeft ?? 0)
              const pRight = Number(p.paddingRight ?? 0)
              const pTop = Number(p.paddingTop ?? 0)
              const pBottom = Number(p.paddingBottom ?? 0)
              const autoWrap = !!(p.autoWrap ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2433: enabled (BatchInspector R2197) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select value={layoutType}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: v, layoutType: v, _type: v, _layoutType: v, _N$type: v, _N$layoutType: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>None</option>
                      <option value={1}>Horizontal</option>
                      <option value={2}>Vertical</option>
                      <option value={3}>Grid</option>
                    </select>
                    <select value={resizeMode}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resizeMode: v, _resizeMode: v, _N$resizeMode: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>None</option>
                      <option value={1}>Children</option>
                      <option value={2}>Container</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>space</span>
                    {[['X', spacingX, 'spacingX'], ['Y', spacingY, 'spacingY']].map(([label, val, key]) => (
                      <input key={key as string} type="number" defaultValue={val as number} step={1}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: v, [`_${key as string}`]: v, [`_N$${key as string}`]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        placeholder={label as string}
                        style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    ))}
                    {/* R1783: spacing 퀵 프리셋 */}
                    {[0, 5, 10, 20].map(v => (
                      <span key={v} title={`spacing X/Y = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingX: v, _spacingX: v, _N$spacingX: v, spacingY: v, _spacingY: v, _N$spacingY: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${spacingX === v && spacingY === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: spacingX === v && spacingY === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>pad</span>
                    {[['L', pLeft, 'paddingLeft'], ['R', pRight, 'paddingRight'], ['T', pTop, 'paddingTop'], ['B', pBottom, 'paddingBottom']].map(([label, val, key]) => (
                      <input key={key as string} type="number" defaultValue={val as number} step={1}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: v, [`_${key as string}`]: v, [`_N$${key as string}`]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        placeholder={label as string}
                        style={{ width: 32, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    ))}
                    {/* R1748: 패딩 균등 버튼 */}
                    <span
                      title="모든 패딩 동일하게 (최솟값)"
                      onClick={() => {
                        const v = Math.min(pLeft, pRight, pTop, pBottom)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, paddingLeft: v, _paddingLeft: v, _N$paddingLeft: v, paddingRight: v, _paddingRight: v, _N$paddingRight: v, paddingTop: v, _paddingTop: v, _N$paddingTop: v, paddingBottom: v, _paddingBottom: v, _N$paddingBottom: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ fontSize: 8, cursor: 'pointer', padding: '0 3px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >=</span>
                    {/* R1796: padding 퀵 프리셋 */}
                    {[0, 5, 10, 20].map(v => (
                      <span key={v} title={`padding 전체 = ${v}`}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, paddingLeft: v, _paddingLeft: v, _N$paddingLeft: v, paddingRight: v, _paddingRight: v, _N$paddingRight: v, paddingTop: v, _paddingTop: v, _N$paddingTop: v, paddingBottom: v, _paddingBottom: v, _N$paddingBottom: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${pLeft === v && pRight === v && pTop === v && pBottom === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: pLeft === v && pRight === v && pTop === v && pBottom === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1820: direction 버튼 (Horizontal/Vertical/Grid 공통) */}
                  {layoutType !== 0 && (() => {
                    const hDir = Number(p.horizontalDirection ?? p._N$horizontalDirection ?? 0)
                    const vDir = Number(p.verticalDirection ?? p._N$verticalDirection ?? 1)
                    return (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>H:</span>
                          {([['L→R', 0], ['R→L', 1]] as const).map(([l, v]) => (
                            <span key={v} title={l}
                              onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalDirection: v, _horizontalDirection: v, _N$horizontalDirection: v } } : c); applyAndSave({ components: updated }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${hDir === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: hDir === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>V:</span>
                          {([['B→T', 0], ['T→B', 1]] as const).map(([l, v]) => (
                            <span key={v} title={l}
                              onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, verticalDirection: v, _verticalDirection: v, _N$verticalDirection: v } } : c); applyAndSave({ components: updated }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${vDir === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: vDir === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  {/* R2355: childAlignment 퀵 편집 */}
                  {(() => {
                    const childAlign = Number(p.childAlignment ?? p._childAlignment ?? 0)
                    const alignNames: Record<number, string> = { 0: 'None', 1: 'LT', 2: 'CT', 3: 'RT', 4: 'LC', 5: 'C', 6: 'RC', 7: 'LB', 8: 'CB', 9: 'RB' }
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>align</span>
                        {([[0,'None'],[1,'LT'],[5,'C'],[9,'RB'],[4,'LC'],[6,'RC']] as const).map(([v, l]) => (
                          <span key={v} title={`childAlignment = ${alignNames[v] ?? v}`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, childAlignment: v, _childAlignment: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${childAlign === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: childAlign === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                          >{l}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2398: constraint + constraintNum + startAxis (Grid) */}
                  {layoutType === 3 && (() => {
                    const constraint = Number(p.constraint ?? p._constraint ?? p._N$constraint ?? 0)
                    const constraintNum = Number(p.constraintNum ?? p._constraintNum ?? p._N$constraintNum ?? 0)
                    const startAxis = Number(p.startAxis ?? p._startAxis ?? p._N$startAxis ?? 0)
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>constr</span>
                          {([['None', 0], ['Row', 1], ['Col', 2]] as const).map(([l, v]) => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, constraint: v, _constraint: v, _N$constraint: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${constraint === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: constraint === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                          <input type="number" defaultValue={constraintNum} min={0} step={1} title="constraintNum"
                            onBlur={e => { const v = parseInt(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, constraintNum: v, _constraintNum: v, _N$constraintNum: v } } : c); applyAndSave({ components: u }) }}
                            style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>axis</span>
                          {([['H→', 0], ['V↓', 1]] as const).map(([l, v]) => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startAxis: v, _startAxis: v, _N$startAxis: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${startAxis === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: startAxis === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                  {layoutType === 3 && (() => {
                    // R1709: Grid cellSize 편집
                    const cellSizeRaw = p.cellSize as { width?: number; height?: number } | undefined
                    const cellW = Number(cellSizeRaw?.width ?? 0)
                    const cellH = Number(cellSizeRaw?.height ?? 0)
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>cell</span>
                          {([['W', cellW, 'width'], ['H', cellH, 'height']] as const).map(([label, val, key]) => (
                            <input key={key} type="number" defaultValue={val} step={1} min={0}
                              onBlur={e => {
                                const v = parseFloat(e.target.value) || 0
                                const newCell = { width: key === 'width' ? v : cellW, height: key === 'height' ? v : cellH }
                                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cellSize: newCell, _cellSize: newCell, _N$cellSize: newCell } } : c)
                                applyAndSave({ components: updated })
                              }}
                              placeholder={label}
                              style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                            />
                          ))}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                          <input type="checkbox" checked={autoWrap}
                            onChange={e => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoWrap: e.target.checked, _autoWrap: e.target.checked, _N$autoWrap: e.target.checked } } : c)
                              applyAndSave({ components: updated })
                            }}
                          />autoWrap
                        </label>
                      </>
                    )
                  })()}
                  {/* R2409: affectedByScale (BatchInspector R2112) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.affectedByScale ?? p._affectedByScale ?? false)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, affectedByScale: e.target.checked, _affectedByScale: e.target.checked, _N$affectedByScale: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0, accentColor: '#818cf8' }}
                    />affectedByScale
                  </label>
                  {/* R2410: wrapMode (BatchInspector R2057) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>wrapMode</span>
                    {([['NoWrap', 0], ['Wrap', 1], ['1Line', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.wrapMode ?? p._wrapMode ?? p._N$wrapMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, wrapMode: v, _wrapMode: v, _N$wrapMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                </div>
              )
            }
            // R1590/R1813: cc.Graphics Quick Edit (applyAndSave)
            if (comp.type === 'cc.Graphics') {
              const toHex = (c: { r?: number; g?: number; b?: number } | undefined) => {
                if (!c) return '#ffffff'
                return `#${[(c.r ?? 255), (c.g ?? 255), (c.b ?? 255)].map(v => v.toString(16).padStart(2, '0')).join('')}`
              }
              const fromHex = (hex: string, a = 255) => {
                const n = parseInt(hex.replace('#', ''), 16)
                return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a }
              }
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2434: enabled (BatchInspector R2194) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>lineWidth</label>
                      <input type="number" min={0} defaultValue={Number(p.lineWidth ?? 1)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineWidth: v, _lineWidth: v, _N$lineWidth: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div />
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>fillColor</label>
                      <input type="color" value={toHex(p.fillColor as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                        onChange={ev => {
                          const col = fromHex(ev.target.value, 255)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillColor: col, _fillColor: col, _N$fillColor: col } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>strokeColor</label>
                      <input type="color" value={toHex(p.strokeColor as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                        onChange={ev => {
                          const col = fromHex(ev.target.value, 255)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, strokeColor: col, _strokeColor: col, _N$strokeColor: col } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  </div>
                  {/* R2373: lineJoin / lineCap / miterLimit / fillOpacity / strokeOpacity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>join</span>
                    {(['miter', 'round', 'bevel'] as const).map(v => (
                      <span key={v} title={`lineJoin=${v}`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineJoin: v, _lineJoin: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${(p.lineJoin ?? 'miter') === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: (p.lineJoin ?? 'miter') === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>cap</span>
                    {(['butt', 'round', 'square'] as const).map(v => (
                      <span key={v} title={`lineCap=${v}`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineCap: v, _lineCap: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${(p.lineCap ?? 'butt') === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: (p.lineCap ?? 'butt') === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10 }}>miterLmt</label>
                      <input type="number" defaultValue={Number(p.miterLimit ?? 10)} min={1} step={1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = Number(ev.target.value); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, miterLimit: v, _miterLimit: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10 }}>fillOpa</label>
                      <input type="number" defaultValue={Number(p.fillOpacity ?? p._fillOpacity ?? 255)} min={0} max={255} step={1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = Number(ev.target.value); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillOpacity: v, _fillOpacity: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10 }}>strokeOpa</label>
                      <input type="number" defaultValue={Number(p.strokeOpacity ?? p._strokeOpacity ?? 255)} min={0} max={255} step={1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = Number(ev.target.value); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, strokeOpacity: v, _strokeOpacity: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                  </div>
                </div>
              )
            }
            // R1589: cc.Sprite / cc.Sprite2D Quick Edit
            if (comp.type === 'cc.Sprite' || comp.type === 'cc.Sprite2D') {
              const SPRITE_TYPE = ['Simple', 'Sliced', 'Tiled', 'Filled']
              const SIZE_MODE = ['Custom', 'Trimmed', 'Raw']
              // R1696: spriteFrame uuid 추출
              const sfRaw = p._spriteFrame ?? p.spriteFrame
              const sfUuid = (sfRaw as Record<string,unknown> | null)?.__uuid__ as string | undefined
              const spriteTypeVal = Number(p.type ?? p._type ?? 0)
              const sizeModeVal = Number(p.sizeMode ?? p._sizeMode ?? 1)
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2433: enabled (BatchInspector R2190) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R1696: spriteFrame uuid 표시 + 복사 버튼 */}
                  {sfUuid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      {/* R2335: 텍스처 썸네일 미리보기 */}
                      <SpriteThumb sfUuid={sfUuid} assetsDir={sceneFile.projectInfo.assetsDir ?? ''} />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>sf uuid</span>
                      <span style={{ fontSize: 8, color: '#4ade80', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={sfUuid}>{sfUuid}</span>
                      <span
                        title="spriteFrame UUID 복사"
                        onClick={() => navigator.clipboard.writeText(sfUuid).catch(() => {})}
                        style={{ fontSize: 9, cursor: 'pointer', color: '#666', flexShrink: 0, padding: '0 2px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#4ade80')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                      >⎘</span>
                    </div>
                  )}
                  {/* R1788: Sprite type/sizeMode 버튼 (applyAndSave) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>type</span>
                    {SPRITE_TYPE.map((l, i) => (
                      <span key={i} title={l}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: i, _type: i } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${spriteTypeVal === i ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: spriteTypeVal === i ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>size</span>
                    {SIZE_MODE.map((l, i) => (
                      <span key={i} title={l}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sizeMode: i, _sizeMode: i } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${sizeModeVal === i ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: sizeModeVal === i ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                    {/* R2401: _isTrimmedMode CC3.x */}
                    {is3x && (() => {
                      const tm = Number(p._isTrimmedMode ?? 0)
                      return (
                        <>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 6, flexShrink: 0 }}>trim3:</span>
                          {([['T', 0], ['R', 1], ['P', 2]] as const).map(([l, v]) => (
                            <span key={v} title={['Trim','Raw','Polygon'][v]}
                              onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _isTrimmedMode: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${tm === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: tm === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <input type="checkbox" checked={!!(p.trim ?? true)}
                        onChange={ev => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, trim: ev.target.checked, _trim: ev.target.checked, _N$trim: ev.target.checked } } : c); applyAndSave({ components: updated }) }} />
                      trim
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <input type="checkbox" checked={!!(p.grayscale ?? false)}
                        onChange={ev => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, grayscale: ev.target.checked, _grayscale: ev.target.checked, _N$grayscale: ev.target.checked } } : c); applyAndSave({ components: updated }) }} />
                      grayscale
                    </label>
                  </div>
                  {/* R2402: _color CC3.x 컴포넌트 레벨 색상 */}
                  {is3x && (() => {
                    const colRaw = p._color as { r?: number; g?: number; b?: number; a?: number } | undefined
                    const toHex = (c: typeof colRaw) => `#${[(c?.r ?? 255),(c?.g ?? 255),(c?.b ?? 255)].map(v => v.toString(16).padStart(2,'0')).join('')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>color</span>
                        <input type="color" value={toHex(colRaw)}
                          onChange={e => { const n2 = parseInt(e.target.value.slice(1), 16); const col = { r: (n2>>16)&255, g: (n2>>8)&255, b: n2&255, a: colRaw?.a ?? 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _color: col } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 36, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                          title="Sprite _color (CC3.x)"
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>α</span>
                        <input type="number" defaultValue={colRaw?.a ?? 255} min={0} max={255} step={1}
                          onBlur={e => { const a = Math.max(0, Math.min(255, parseInt(e.target.value) || 255)); const col = { ...(colRaw ?? { r: 255, g: 255, b: 255 }), a }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _color: col } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1865: srcBlendFactor / dstBlendFactor 퀵 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>blend</span>
                    {([['Normal', 770, 771], ['Add', 770, 1], ['Mul', 774, 771]] as [string, number, number][]).map(([l, src, dst]) => {
                      const curSrc = Number(p.srcBlendFactor ?? p._srcBlendFactor ?? 770)
                      const curDst = Number(p.dstBlendFactor ?? p._dstBlendFactor ?? 771)
                      const active = curSrc === src && curDst === dst
                      return (
                        <span key={l} title={`srcBlend=${src} dstBlend=${dst}`}
                          onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, srcBlendFactor: src, _srcBlendFactor: src, dstBlendFactor: dst, _dstBlendFactor: dst } } : c); applyAndSave({ components: updated }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${active ? '#4ade80' : 'var(--border)'}`, borderRadius: 2, color: active ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R1827: 색조(hue) 슬라이더 — 노드 tint 색상 H 조정 */}
                  {(() => {
                    const c = draft.color ?? { r: 255, g: 255, b: 255, a: 255 }
                    const r1 = c.r/255, g1 = c.g/255, b1 = c.b/255
                    const max = Math.max(r1,g1,b1), min = Math.min(r1,g1,b1), d = max - min
                    const l = (max+min)/2
                    const s = d === 0 ? 0 : d / (1 - Math.abs(2*l - 1))
                    let h = 0
                    if (d !== 0) {
                      if (max === r1) h = ((g1-b1)/d + 6) % 6
                      else if (max === g1) h = (b1-r1)/d + 2
                      else h = (r1-g1)/d + 4
                      h = h/6*360
                    }
                    const curHue = Math.round(h)
                    const applyHue = (hDeg: number) => {
                      const hN = hDeg/360, q = l < 0.5 ? l*(1+s) : l+s-l*s, p2 = 2*l-q
                      const hue2rgb = (p3: number, q3: number, t: number) => {
                        if (t<0) t+=1; if (t>1) t-=1
                        if (t<1/6) return p3+(q3-p3)*6*t
                        if (t<1/2) return q3
                        if (t<2/3) return p3+(q3-p3)*(2/3-t)*6
                        return p3
                      }
                      const nr = Math.round(hue2rgb(p2,q,hN+1/3)*255)
                      const ng = Math.round(hue2rgb(p2,q,hN)*255)
                      const nb = Math.round(hue2rgb(p2,q,hN-1/3)*255)
                      applyAndSave({ color: { r: nr, g: ng, b: nb, a: c.a } })
                    }
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>hue</span>
                        <input type="range" min={0} max={359} step={1} value={curHue}
                          onChange={e => applyHue(parseInt(e.target.value))}
                          style={{ flex: 1,
                            background: `linear-gradient(to right,hsl(0,${s*100}%,${l*100}%),hsl(60,${s*100}%,${l*100}%),hsl(120,${s*100}%,${l*100}%),hsl(180,${s*100}%,${l*100}%),hsl(240,${s*100}%,${l*100}%),hsl(300,${s*100}%,${l*100}%),hsl(360,${s*100}%,${l*100}%))`,
                            height: 6, borderRadius: 3, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>{curHue}°</span>
                      </div>
                    )
                  })()}
                  {/* R1711/R1810: Filled 타입 — fillType/fillStart/fillRange applyAndSave 교체 */}
                  {Number(p.type ?? 0) === 3 && (
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>fillType</span>
                        <select value={Number(p.fillType ?? 0)}
                          onChange={ev => {
                            const v = parseInt(ev.target.value)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillType: v, _fillType: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                        >
                          <option value={0}>Horizontal</option>
                          <option value={1}>Vertical</option>
                          <option value={2}>Radial</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>fillStart</span>
                        <input type="range" min={0} max={1} step={0.01} value={Number(p.fillStart ?? 0)}
                          onChange={ev => {
                            const v = parseFloat(ev.target.value)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillStart: v, _fillStart: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Number(p.fillStart ?? 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>fillRange</span>
                        <input type="range" min={0} max={1} step={0.01} value={Number(p.fillRange ?? 1)}
                          onChange={ev => {
                            const v = parseFloat(ev.target.value)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillRange: v, _fillRange: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Number(p.fillRange ?? 1).toFixed(2)}</span>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!(p.fillCenter ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillCenter: ev.target.checked, _fillCenter: ev.target.checked, _N$fillCenter: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        fillCenter
                      </label>
                    </div>
                  )}
                  {/* R2363: packable + meshType */}
                  {/* R2400: _useGrayscale (CC3.x) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.packable ?? p._packable ?? true)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, packable: e.target.checked, _packable: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />packable
                    </label>
                    {is3x && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!(p._useGrayscale ?? false)}
                          onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _useGrayscale: e.target.checked } } : c); applyAndSave({ components: u }) }}
                          style={{ margin: 0, accentColor: '#818cf8' }}
                        />grayscale
                      </label>
                    )}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>mesh:</span>
                    {([['Reg', 0], ['Poly', 1]] as const).map(([l, v]) => {
                      const cur = Number(p.meshType ?? p._meshType ?? 0)
                      return (
                        <span key={v} title={`meshType=${l}(${v})`}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, meshType: v, _meshType: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '0 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#4ade80' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R1890: flipX / flipY */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>flip</span>
                    {(['X', 'Y'] as const).map(axis => {
                      const key = `flip${axis}`
                      const val = !!(p[key] ?? p[`_${key}`] ?? false)
                      return (
                        <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                          <input type="checkbox" checked={val}
                            onChange={e => {
                              const v = e.target.checked
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key]: v, [`_${key}`]: v, [`_N$${key}`]: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                          />flip{axis}
                        </label>
                      )
                    })}
                  </div>
                  {/* R1918: capInsets (Sliced 타입 전용) */}
                  {(() => {
                    const sprType = Number(p.type ?? p._type ?? 0)
                    if (sprType !== 1) return null
                    const ci = p.insetTop !== undefined
                      ? { t: Number(p.insetTop ?? 0), b: Number(p.insetBottom ?? 0), l: Number(p.insetLeft ?? 0), r: Number(p.insetRight ?? 0) }
                      : (() => {
                          const raw = (p.capInsets ?? p._capInsets ?? p._N$capInsets) as Record<string,number> | undefined
                          return { t: Number(raw?.y ?? raw?.top ?? 0), b: Number(raw?.height ?? raw?.bottom ?? 0), l: Number(raw?.x ?? raw?.left ?? 0), r: Number(raw?.width ?? raw?.right ?? 0) }
                        })()
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>inset</span>
                        {(['t', 'b', 'l', 'r'] as const).map(side => (
                          <label key={side} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{side}</span>
                            <input type="number" defaultValue={ci[side]} key={`cap-${side}-${ci[side]}`} min={0} step={1}
                              onBlur={e => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0)
                                const newCi = { ...ci, [side]: v }
                                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, insetTop: newCi.t, _insetTop: newCi.t, _N$insetTop: newCi.t, insetBottom: newCi.b, _insetBottom: newCi.b, _N$insetBottom: newCi.b, insetLeft: newCi.l, _insetLeft: newCi.l, _N$insetLeft: newCi.l, insetRight: newCi.r, _insetRight: newCi.r, _N$insetRight: newCi.r } } : c)
                                applyAndSave({ components: updated })
                              }}
                              style={{ width: 34, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                            />
                          </label>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1588/R1811: cc.LabelOutline / cc.LabelShadow Quick Edit (applyAndSave)
            if (comp.type === 'cc.LabelOutline' || comp.type === 'cc.LabelShadow') {
              const toHex = (c: { r?: number; g?: number; b?: number } | undefined) => {
                if (!c) return '#000000'
                const r = (c.r ?? 0).toString(16).padStart(2, '0')
                const g = (c.g ?? 0).toString(16).padStart(2, '0')
                const b = (c.b ?? 0).toString(16).padStart(2, '0')
                return `#${r}${g}${b}`
              }
              const fromHex = (hex: string) => {
                const n = parseInt(hex.replace('#', ''), 16)
                return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 }
              }
              const offObj = p.offset as { x?: number; y?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2437: enabled (BatchInspector R2219) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R1811: applyAndSave 교체 */}
                  {comp.type === 'cc.LabelOutline' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11 }}>width</label>
                      <input type="number" min={0} max={20} defaultValue={Number(p.width ?? p._width ?? 0)}
                        style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, width: v, _width: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                      <label style={{ fontSize: 11 }}>color</label>
                      <input type="color" value={toHex((p.color ?? p._color) as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: 36, height: 22, border: 'none', background: 'none', cursor: 'pointer' }}
                        onChange={ev => {
                          const col = { ...fromHex(ev.target.value), a: 255 }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  )}
                  {comp.type === 'cc.LabelShadow' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>offsetX</label>
                        <input type="number" defaultValue={Number(offObj?.x ?? 2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onBlur={ev => {
                            const x = Number(ev.target.value)
                            const curOff = offObj ?? {}
                            const newOff = { ...curOff, x }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                            applyAndSave({ components: updated })
                          }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>offsetY</label>
                        <input type="number" defaultValue={Number(offObj?.y ?? -2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onBlur={ev => {
                            const y = Number(ev.target.value)
                            const curOff = offObj ?? {}
                            const newOff = { ...curOff, y }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                            applyAndSave({ components: updated })
                          }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>blur</label>
                        <input type="number" min={0} max={20} defaultValue={Number(p.blur ?? p._blur ?? 2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onBlur={ev => {
                            const v = Number(ev.target.value)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, blur: v, _blur: v } } : c)
                            applyAndSave({ components: updated })
                          }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>color</label>
                        <input type="color" value={toHex((p.color ?? p._color) as { r?: number; g?: number; b?: number } | undefined)}
                          style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                          onChange={ev => {
                            const col = { ...fromHex(ev.target.value), a: 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col } } : c)
                            applyAndSave({ components: updated })
                          }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            // R1587/R1812: cc.Toggle / cc.ToggleContainer Quick Edit (applyAndSave)
            if (comp.type === 'cc.Toggle' || comp.type === 'cc.ToggleContainer') {
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {comp.type === 'cc.Toggle' && (
                    <>
                      {/* R2426: enabled (BatchInspector R2195) */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                          onChange={ev => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: ev.target.checked, _enabled: ev.target.checked } } : c); applyAndSave({ components: u }) }} />
                        enabled
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.isChecked ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isChecked: ev.target.checked, _isChecked: ev.target.checked, _N$isChecked: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        isChecked
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.interactable ?? true)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, interactable: ev.target.checked, _interactable: ev.target.checked, _N$interactable: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        interactable
                      </label>
                    </>
                  )}
                  {comp.type === 'cc.ToggleContainer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {/* R2427: ToggleContainer enabled (BatchInspector R2199) */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                          onChange={ev => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: ev.target.checked, _enabled: ev.target.checked } } : c); applyAndSave({ components: u }) }} />
                        enabled
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.allowSwitchOff ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, allowSwitchOff: ev.target.checked, _allowSwitchOff: ev.target.checked, _N$allowSwitchOff: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        allowSwitchOff
                      </label>
                      {/* R2378: autoCheckToggle */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.autoCheckToggle ?? p._autoCheckToggle ?? p._N$autoCheckToggle ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoCheckToggle: ev.target.checked, _autoCheckToggle: ev.target.checked, _N$autoCheckToggle: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        autoCheckToggle
                      </label>
                    </div>
                  )}
                </div>
              )
            }
            // R1586/R1812: cc.EditBox — 텍스트 입력 필드 Quick Edit (applyAndSave)
            if (comp.type === 'cc.EditBox') {
              const INPUT_MODE = ['Any', 'EmailAddr', 'Numeric', 'PhoneNumber', 'URL', 'Decimal', 'SingleLine']
              const INPUT_FLAG = ['Default', 'Password', 'Sensitive', 'InitialCapsWord', 'InitialCapsSentence', 'InitialCapsAllChars']
              const RETURN_TYPE = ['Default', 'Done', 'Send', 'Search', 'Go', 'Next']
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2434: enabled (BatchInspector R2198) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>string (초기값)</label>
                    <input type="text" defaultValue={String(p.string ?? '')}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: ev.target.value, _string: ev.target.value } } : c)
                        applyAndSave({ components: updated })
                      }} />
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>placeholder</label>
                    <input type="text" defaultValue={String(p.placeholder ?? '')}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholder: ev.target.value, _placeholder: ev.target.value } } : c)
                        applyAndSave({ components: updated })
                      }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>maxLength</label>
                      <input type="number" defaultValue={Number(p.maxLength ?? 20)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxLength: v, _maxLength: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>fontSize</label>
                      <input type="number" defaultValue={Number(p.fontSize ?? 20)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>inputMode</label>
                      <select value={Number(p.inputMode ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => {
                          const v = parseInt(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inputMode: v, _inputMode: v, _N$inputMode: v } } : c)
                          applyAndSave({ components: updated })
                        }}>
                        {INPUT_MODE.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>inputFlag</label>
                      <select value={Number(p.inputFlag ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => {
                          const v = parseInt(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inputFlag: v, _inputFlag: v } } : c)
                          applyAndSave({ components: updated })
                        }}>
                        {INPUT_FLAG.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>returnType</label>
                    <select value={Number(p.returnType ?? 0)}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onChange={ev => {
                        const v = parseInt(ev.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, returnType: v, _returnType: v, _N$returnType: v } } : c)
                        applyAndSave({ components: updated })
                      }}>
                      {RETURN_TYPE.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                    </select>
                  </div>
                  {/* R2352: lineCount + tabIndex */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>lineCount</label>
                      <input type="number" min={1} defaultValue={Number(p.lineCount ?? p._lineCount ?? p._N$lineCount ?? 1)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = parseInt(ev.target.value) || 1
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineCount: v, _lineCount: v, _N$lineCount: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>tabIndex</label>
                      <input type="number" min={0} defaultValue={Number(p.tabIndex ?? p._tabIndex ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = parseInt(ev.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tabIndex: v, _tabIndex: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  </div>
                  {/* R2447: placeholderFontSize + fontColor + placeholderFontColor (BatchInspector R2208) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <label style={{ fontSize: 11, flexShrink: 0, width: 100 }}>phFontSize</label>
                    <input type="number" defaultValue={Number(p.placeholderFontSize ?? p._placeholderFontSize ?? p._N$placeholderFontSize ?? 20)} min={1} step={2}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = Math.max(1, parseInt(ev.target.value) || 20); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontSize: v, _placeholderFontSize: v, _N$placeholderFontSize: v } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {(() => {
                    const fc = p.fontColor ?? p._fontColor ?? p._N$fontColor as { r?: number; g?: number; b?: number } | undefined
                    const pfc = p.placeholderFontColor ?? p._placeholderFontColor ?? p._N$placeholderFontColor as { r?: number; g?: number; b?: number } | undefined
                    const fcHex = fc ? `#${(((fc as Record<string,number>).r ?? 255) << 16 | ((fc as Record<string,number>).g ?? 255) << 8 | ((fc as Record<string,number>).b ?? 255)).toString(16).padStart(6, '0')}` : '#ffffff'
                    const pfcHex = pfc ? `#${(((pfc as Record<string,number>).r ?? 127) << 16 | ((pfc as Record<string,number>).g ?? 127) << 8 | ((pfc as Record<string,number>).b ?? 127)).toString(16).padStart(6, '0')}` : '#888888'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: 11, flexShrink: 0 }}>fontColor</label>
                        <input type="color" defaultValue={fcHex}
                          style={{ width: 26, height: 20, border: '1px solid #444', borderRadius: 2, padding: 0, cursor: 'pointer', background: 'none' }}
                          onChange={ev => { const h = ev.target.value; const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16); const col = {r,g,b,a:255}; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } } : c); applyAndSave({ components: u }) }}
                        />
                        <label style={{ fontSize: 11, flexShrink: 0 }}>phColor</label>
                        <input type="color" defaultValue={pfcHex}
                          style={{ width: 26, height: 20, border: '1px solid #444', borderRadius: 2, padding: 0, cursor: 'pointer', background: 'none' }}
                          onChange={ev => { const h = ev.target.value; const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16); const col = {r,g,b,a:255}; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontColor: col, _placeholderFontColor: col, _N$placeholderFontColor: col } } : c); applyAndSave({ components: u }) }}
                        />
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1585: cc.RichText — 서식 텍스트 Quick Edit
            if (comp.type === 'cc.RichText') {
              const HALIGN = ['Left', 'Center', 'Right']
              const OVERFLOW = ['None', 'Clamp', 'Shrink', 'Resize']
              // R1767: RichText 마크업 → HTML 변환 (미리보기용)
              const richToHtml = (src: string) => src
                .replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/&lt;color=(#[0-9a-fA-F]{3,8}|[a-z]+)&gt;(.*?)&lt;\/color&gt;/gs, '<span style="color:$1">$2</span>')
                .replace(/&lt;size=(\d+)&gt;(.*?)&lt;\/size&gt;/gs, '<span style="font-size:$1px">$2</span>')
                .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gs, '<b>$1</b>')
                .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gs, '<i>$1</i>')
                .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gs, '<u>$1</u>')
                .replace(/\n/g, '<br/>')
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontWeight: 'bold' }}>{comp.type}</span>
                    {/* R2433: enabled (BatchInspector R2192) */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0 }}
                      />enabled
                    </label>
                    {/* R1767: 미리보기 토글 */}
                    <span title={showRichPreview ? '미리보기 숨기기' : '미리보기 표시'}
                      onClick={() => setShowRichPreview(v => !v)}
                      style={{ fontSize: 9, cursor: 'pointer', color: showRichPreview ? '#58a6ff' : '#556', padding: '0 3px', border: '1px solid var(--border)', borderRadius: 2 }}
                    >{showRichPreview ? '👁 미리보기' : '👁'}</span>
                  </div>
                  {showRichPreview && (
                    <div style={{ marginBottom: 4, padding: '4px 6px', background: '#111', border: '1px solid #333', borderRadius: 3, fontSize: 11, minHeight: 24, color: '#fff', lineHeight: 1.5, wordBreak: 'break-all' }}
                      dangerouslySetInnerHTML={{ __html: richToHtml(String(p.string ?? '')) }} />
                  )}
                  {/* R1808: string applyAndSave */}
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>내용 (HTML 태그 지원)</label>
                    <textarea
                      defaultValue={String(p.string ?? '')}
                      rows={3}
                      style={{ width: '100%', fontSize: 11, resize: 'vertical', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', boxSizing: 'border-box' }}
                      onBlur={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: ev.target.value, _string: ev.target.value, _N$string: ev.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>fontSize</label>
                      <input type="number" defaultValue={Number(p.fontSize ?? 40)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                      {/* R1808: fontSize 프리셋 */}
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
                        {[12, 16, 20, 24, 32, 48].map(v => (
                          <span key={v} onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                            applyAndSave({ components: updated })
                          }} style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Number(p.fontSize ?? 40) === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: Number(p.fontSize ?? 40) === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}>{v}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>lineHeight</label>
                      <input type="number" defaultValue={Number(p.lineHeight ?? 40)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineHeight: v, _lineHeight: v, _N$lineHeight: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>maxWidth (0=무제한)</label>
                      <input type="number" defaultValue={Number(p.maxWidth ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxWidth: v, _maxWidth: v, _N$maxWidth: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>horizontalAlign</label>
                      <select value={Number(p.horizontalAlign ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => {
                          const v = parseInt(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalAlign: v, _horizontalAlign: v, _N$horizontalAlign: v } } : c)
                          applyAndSave({ components: updated })
                        }}>
                        {HALIGN.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>overflow</label>
                    <select value={Number(p.overflow ?? 0)}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onChange={ev => {
                        const v = parseInt(ev.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, overflow: v, _overflow: v, _N$overflow: v } } : c)
                        applyAndSave({ components: updated })
                      }}>
                      {OVERFLOW.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                    </select>
                  </div>
                  {/* R2353: fontColor */}
                  {(() => {
                    const fc = p.fontColor ?? p._fontColor ?? p._N$fontColor as { r?: number; g?: number; b?: number } | undefined
                    const fcR = (fc as Record<string,number> | undefined)?.r ?? 0
                    const fcG = (fc as Record<string,number> | undefined)?.g ?? 0
                    const fcB = (fc as Record<string,number> | undefined)?.b ?? 0
                    const fcHex = `#${fcR.toString(16).padStart(2,'0')}${fcG.toString(16).padStart(2,'0')}${fcB.toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <label style={{ fontSize: 11, flexShrink: 0 }}>fontColor</label>
                        <input type="color" value={fcHex}
                          onChange={e => {
                            const h = e.target.value
                            const nr = parseInt(h.slice(1,3),16), ng = parseInt(h.slice(3,5),16), nb = parseInt(h.slice(5,7),16)
                            const col = { r: nr, g: ng, b: nb, a: 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 22, border: '1px solid #444', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
                        />
                        <span style={{ fontSize: 9, color: '#ccc' }}>{fcR},{fcG},{fcB}</span>
                      </div>
                    )
                  })()}
                  {/* R2446: verticalAlign (BatchInspector R2010) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <label style={{ fontSize: 11, flexShrink: 0, marginRight: 4 }}>verticalAlign</label>
                    {([['Top', 0], ['Ctr', 1], ['Bot', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.verticalAlign ?? p._verticalAlign ?? p._N$verticalAlign ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, verticalAlign: v, _verticalAlign: v, _N$verticalAlign: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R2446: imageLineHeight (BatchInspector R2182) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <label style={{ fontSize: 11, flexShrink: 0, width: 80 }}>imgLineH</label>
                    <input type="number" defaultValue={Number(p.imageLineHeight ?? p._imageLineHeight ?? p._N$imageLineHeight ?? 40)} min={0} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || 40; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, imageLineHeight: v, _imageLineHeight: v, _N$imageLineHeight: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      title="imageLineHeight"
                    />
                  </div>
                  {/* R2446: handleTouchEvent (BatchInspector R2164) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.handleTouchEvent ?? p._handleTouchEvent ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, handleTouchEvent: e.target.checked, _handleTouchEvent: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />handleTouchEvent
                  </label>
                </div>
              )
            }
            // R1755: cc.Canvas — 해상도 + fitWidth/fitHeight 퀵 편집
            if (comp.type === 'cc.Canvas') {
              const dr = (p._N$designResolution ?? p._designResolution ?? p.designResolution ?? {}) as { width?: number; height?: number }
              const fw = !!(p._N$fitWidth ?? p.fitWidth ?? false)
              const fh = !!(p._N$fitHeight ?? p.fitHeight ?? true)
              return (
                <div key={ci} style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2444: enabled (BatchInspector R2113) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>resolution</span>
                    <input type="number" defaultValue={dr.width ?? 960} min={1}
                      onBlur={e => {
                        const w = parseInt(e.target.value) || (dr.width ?? 960)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _N$designResolution: { ...dr, width: w }, _designResolution: { ...dr, width: w } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>×</span>
                    <input type="number" defaultValue={dr.height ?? 640} min={1}
                      onBlur={e => {
                        const h = parseInt(e.target.value) || (dr.height ?? 640)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _N$designResolution: { ...dr, height: h }, _designResolution: { ...dr, height: h } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={fw}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fitWidth: e.target.checked, _fitWidth: e.target.checked, _N$fitWidth: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />fitWidth
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={fh}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fitHeight: e.target.checked, _fitHeight: e.target.checked, _N$fitHeight: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />fitHeight
                    </label>
                  </div>
                  {/* R1832: resolutionPolicy 퀵 선택 */}
                  {(() => {
                    const rp = Number(p.resolutionPolicy ?? p._N$resolutionPolicy ?? -1)
                    const opts: [string, number][] = [['SHOW_ALL', 0], ['NO_BORDER', 1], ['EXACT_FIT', 2], ['FIX_H', 3], ['FIX_W', 4]]
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>policy</span>
                        {opts.map(([l, v]) => (
                          <span key={v} title={`resolutionPolicy = ${l} (${v})`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resolutionPolicy: v, _resolutionPolicy: v, _N$resolutionPolicy: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 7, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${rp === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: rp === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                          >{l}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2387: resizeWithBrowserSize 토글 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.resizeWithBrowserSize ?? p._resizeWithBrowserSize ?? p._N$resizeWithBrowserSize ?? false)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resizeWithBrowserSize: e.target.checked, _resizeWithBrowserSize: e.target.checked, _N$resizeWithBrowserSize: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />resizeWithBrowserSize
                  </label>
                </div>
              )
            }
            // R1582: cc.Widget — align flags + offsets Quick Edit
            if (comp.type === 'cc.Widget') {
              const isTop = !!(p.isAlignTop ?? false)
              const isBottom = !!(p.isAlignBottom ?? false)
              const isLeft = !!(p.isAlignLeft ?? false)
              const isRight = !!(p.isAlignRight ?? false)
              const isHCenter = !!(p.isAlignHorizontalCenter ?? false)
              const isVCenter = !!(p.isAlignVerticalCenter ?? false)
              const alignMode = Number(p.alignMode ?? 1)
              const edges = [
                ['top', isTop, 'isAlignTop', 'top'],
                ['bottom', isBottom, 'isAlignBottom', 'bottom'],
                ['left', isLeft, 'isAlignLeft', 'left'],
                ['right', isRight, 'isAlignRight', 'right'],
              ] as const
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2434: enabled (BatchInspector R2172) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R1675: Widget 정렬 시각 다이어그램 */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                    <svg width={56} height={56} style={{ overflow: 'visible' }}>
                      {/* 외부 경계 (부모) */}
                      <rect x={0} y={0} width={56} height={56} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                      {/* 내부 노드 */}
                      <rect x={12} y={12} width={32} height={32} fill="rgba(88,166,255,0.08)" stroke="rgba(88,166,255,0.3)" strokeWidth={1} />
                      {/* 상단 연결선 */}
                      {isTop && <line x1={28} y1={0} x2={28} y2={12} stroke="#58a6ff" strokeWidth={2} />}
                      {isTop && <rect x={22} y={0} width={12} height={4} fill="#58a6ff" rx={1} />}
                      {/* 하단 연결선 */}
                      {isBottom && <line x1={28} y1={44} x2={28} y2={56} stroke="#58a6ff" strokeWidth={2} />}
                      {isBottom && <rect x={22} y={52} width={12} height={4} fill="#58a6ff" rx={1} />}
                      {/* 좌측 연결선 */}
                      {isLeft && <line x1={0} y1={28} x2={12} y2={28} stroke="#58a6ff" strokeWidth={2} />}
                      {isLeft && <rect x={0} y={22} width={4} height={12} fill="#58a6ff" rx={1} />}
                      {/* 우측 연결선 */}
                      {isRight && <line x1={44} y1={28} x2={56} y2={28} stroke="#58a6ff" strokeWidth={2} />}
                      {isRight && <rect x={52} y={22} width={4} height={12} fill="#58a6ff" rx={1} />}
                      {/* 가로 중앙선 */}
                      {isHCenter && <line x1={0} y1={28} x2={56} y2={28} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2" />}
                      {/* 세로 중앙선 */}
                      {isVCenter && <line x1={28} y1={0} x2={28} y2={56} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2" />}
                    </svg>
                  </div>
                  {edges.map(([label, isActive, flag, offsetKey]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', width: 50, flexShrink: 0 }}>
                        <input type="checkbox" checked={isActive}
                          onChange={e => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [flag]: e.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }}
                        />{label}
                      </label>
                      {isActive && (
                        <input type="number" defaultValue={Number(p[offsetKey] ?? 0)} step={1}
                          onBlur={ev => {
                            const v = parseFloat(ev.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [offsetKey]: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      )}
                    </div>
                  ))}
                  {/* R2354: isAlignHorizontalCenter / isAlignVerticalCenter 편집 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={isHCenter}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isAlignHorizontalCenter: e.target.checked, _isAlignHorizontalCenter: e.target.checked, _N$isAlignHorizontalCenter: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />H-center
                    </label>
                    {isHCenter && (
                      <input type="number" defaultValue={Number(p.horizontalCenter ?? p._N$horizontalCenter ?? 0)} step={1}
                        onBlur={ev => {
                          const v = parseFloat(ev.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalCenter: v, _horizontalCenter: v, _N$horizontalCenter: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={isVCenter}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isAlignVerticalCenter: e.target.checked, _isAlignVerticalCenter: e.target.checked, _N$isAlignVerticalCenter: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />V-center
                    </label>
                    {isVCenter && (
                      <input type="number" defaultValue={Number(p.verticalCenter ?? p._N$verticalCenter ?? 0)} step={1}
                        onBlur={ev => {
                          const v = parseFloat(ev.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, verticalCenter: v, _verticalCenter: v, _N$verticalCenter: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 50, flexShrink: 0 }}>mode</span>
                    <select value={alignMode}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, alignMode: v, _alignMode: v, _N$alignMode: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Once</option>
                      <option value={1}>Always</option>
                      <option value={2}>Editor</option>
                    </select>
                  </div>
                  {/* R2362: isAbs* 전환 버튼 (절대px / %) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 50, flexShrink: 0 }}>unit</span>
                    <span title="모든 isAbs* = true (절대 px)"
                      onClick={() => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props,
                          isAbsTop: true, _isAbsTop: true, _N$isAbsTop: true,
                          isAbsBottom: true, _isAbsBottom: true, _N$isAbsBottom: true,
                          isAbsLeft: true, _isAbsLeft: true, _N$isAbsLeft: true,
                          isAbsRight: true, _isAbsRight: true, _N$isAbsRight: true,
                          isAbsHorizontalCenter: true, _isAbsHorizontalCenter: true, _N$isAbsHorizontalCenter: true,
                          isAbsVerticalCenter: true, _isAbsVerticalCenter: true, _N$isAbsVerticalCenter: true,
                        } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#60a5fa', userSelect: 'none' }}>px</span>
                    <span title="모든 isAbs* = false (%)"
                      onClick={() => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props,
                          isAbsTop: false, _isAbsTop: false, _N$isAbsTop: false,
                          isAbsBottom: false, _isAbsBottom: false, _N$isAbsBottom: false,
                          isAbsLeft: false, _isAbsLeft: false, _N$isAbsLeft: false,
                          isAbsRight: false, _isAbsRight: false, _N$isAbsRight: false,
                          isAbsHorizontalCenter: false, _isAbsHorizontalCenter: false, _N$isAbsHorizontalCenter: false,
                          isAbsVerticalCenter: false, _isAbsVerticalCenter: false, _N$isAbsVerticalCenter: false,
                        } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}>%</span>
                  </div>
                  {/* R2411: alignMode (BatchInspector R2043) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>alignMode</span>
                    {([['Once', 0], ['Resize', 1], ['Always', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.alignMode ?? p._alignMode ?? p._N$alignMode ?? 1)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, alignMode: v, _alignMode: v, _N$alignMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R1753: Widget 프리셋 버튼 (Stretch / Center / None) */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    {[
                      { label: '⊞ Stretch', title: '4방향 모두 0 stretch', patch: { isAlignTop: true, isAlignBottom: true, isAlignLeft: true, isAlignRight: true, isAlignHorizontalCenter: false, isAlignVerticalCenter: false, top: 0, bottom: 0, left: 0, right: 0 } },
                      { label: '⊕ Center', title: '가로/세로 중앙 정렬', patch: { isAlignTop: false, isAlignBottom: false, isAlignLeft: false, isAlignRight: false, isAlignHorizontalCenter: true, isAlignVerticalCenter: true } },
                      { label: '✕ None', title: '정렬 해제', patch: { isAlignTop: false, isAlignBottom: false, isAlignLeft: false, isAlignRight: false, isAlignHorizontalCenter: false, isAlignVerticalCenter: false } },
                    ].map(({ label, title, patch }) => (
                      <span key={label} title={title}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, ...patch } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >{label}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1581: cc.Button — transition 타입 + state 색상 미리보기
            if (comp.type === 'cc.Button') {
              const btnEnabled = !!(p.enabled ?? p._enabled ?? true)
              const transition = Number(p.transition ?? 0)
              const interactable = !!(p.interactable ?? true)
              // R1725: duration (Color/Scale transition 공통)
              const duration = Number(p.duration ?? p._N$duration ?? 0.1)
              const toHex = (c: unknown) => {
                const col = c as { r?: number; g?: number; b?: number } | undefined
                if (!col) return '#ffffff'
                return `#${(col.r ?? 255).toString(16).padStart(2, '0')}${(col.g ?? 255).toString(16).padStart(2, '0')}${(col.b ?? 255).toString(16).padStart(2, '0')}`
              }
              const stateColors = [
                ['normal', p.normalColor],
                ['hover', p.hoverColor],
                ['pressed', p.pressedColor],
                ['disabled', p.disabledColor],
              ]
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2428: enabled (BatchInspector R2192) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={btnEnabled}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>transition</span>
                    <select value={transition}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, transition: v, _transition: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>None</option>
                      <option value={1}>Color</option>
                      <option value={2}>Sprite</option>
                      <option value={3}>Scale</option>
                    </select>
                  </div>
                  {/* R1840: transition 퀵 버튼 */}
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}></span>
                    {([['None',0],['Color',1],['Sprite',2],['Scale',3]] as [string,number][]).map(([label,v]) => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, transition: v, _transition: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${transition === v ? '#fb923c' : 'var(--border)'}`, color: transition === v ? '#fb923c' : 'var(--text-muted)', background: 'var(--bg-primary)' }}
                      >{label}</span>
                    ))}
                  </div>
                  {/* R1725: duration (Color/Scale) */}
                  {(transition === 1 || transition === 3) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>duration</span>
                      <input type="number" defaultValue={duration} min={0} step={0.05}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) ?? 0.1
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, duration: v, _duration: v, _N$duration: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>s</span>
                    </div>
                  )}
                  {transition === 1 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {stateColors.map(([label, val]) => (
                        <div key={label as string} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <input type="color" value={toHex(val)}
                            onChange={e => {
                              const hex = e.target.value
                              const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
                              const colorKey = `${label as string}Color`
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [colorKey]: { r, g, b, a: 255 }, [`_${colorKey}`]: { r, g, b, a: 255 }, [`_N$${colorKey}`]: { r, g, b, a: 255 } } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ width: 22, height: 18, border: '1px solid #333', borderRadius: 2, padding: 0, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 7, color: 'var(--text-muted)' }}>{label as string}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {transition === 3 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>zoomScale</span>
                      <input type="number" defaultValue={Number(p.zoomScale ?? 1.2)} min={0} step={0.05}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 1.2
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, zoomScale: v, _zoomScale: v, _N$zoomScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    </div>
                  )}
                  {/* R1763: Sprite 전환 모드 — 상태별 UUID 표시 */}
                  {transition === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {(['normal', 'hover', 'pressed', 'disabled'] as const).map(state => {
                        const key = `${state}Sprite`
                        const sf = (p[key] ?? p[`_N$${key}`]) as Record<string,unknown> | null
                        const uuid = sf?.__uuid__ as string | undefined
                        return uuid ? (
                          <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 8, color: 'var(--text-muted)', width: 44, flexShrink: 0 }}>{state}</span>
                            <span style={{ fontSize: 8, color: '#fb923c', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={uuid}>{uuid.slice(0, 12)}…</span>
                            <span title="UUID 복사" onClick={() => navigator.clipboard.writeText(uuid).catch(() => {})} style={{ fontSize: 8, cursor: 'pointer', color: '#555', flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#fb923c')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⎘</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={interactable}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, interactable: e.target.checked, _interactable: e.target.checked, _N$interactable: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />interactable
                    </label>
                    {/* R2358: autoGrayEffect */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.autoGrayEffect ?? p._autoGrayEffect ?? p._N$autoGrayEffect ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoGrayEffect: e.target.checked, _autoGrayEffect: e.target.checked, _N$autoGrayEffect: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />autoGray
                    </label>
                  </div>
                  {/* R1807: normalColor 퀵 프리셋 */}
                  {transition === 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>normal:</span>
                      {([['white', {r:255,g:255,b:255}], ['gray', {r:180,g:180,b:180}], ['dark', {r:64,g:64,b:64}], ['red', {r:255,g:80,b:80}], ['green', {r:80,g:200,b:100}]] as const).map(([l, c]) => (
                        <span key={l} title={`normalColor = ${l}`}
                          onClick={() => {
                            const col = { ...c, a: 255 }
                            const updated = draft.components.map(comp2 => comp2 === comp ? { ...comp2, props: { ...comp2.props, normalColor: col, _normalColor: col, _N$normalColor: col } } : comp2)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 16, height: 14, background: `rgb(${c.r},${c.g},${c.b})`, border: '1px solid #555', borderRadius: 2, cursor: 'pointer', display: 'inline-block' }}
                        />
                      ))}
                    </div>
                  )}
                  {/* R1823: 상태색 CC 기본값 리셋 */}
                  {transition === 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>reset:</span>
                      <span title="CC 2.x 기본값으로 모든 상태색 리셋&#10;normal=white, hover=white, pressed=gray(200), disabled=gray(120,a=200)"
                        onClick={() => {
                          const defs = {
                            normalColor: { r: 255, g: 255, b: 255, a: 255 },
                            hoverColor: { r: 255, g: 255, b: 255, a: 255 },
                            pressedColor: { r: 200, g: 200, b: 200, a: 255 },
                            disabledColor: { r: 120, g: 120, b: 120, a: 200 },
                          }
                          const updated = draft.components.map(c2 => c2 === comp ? { ...c2, props: { ...c2.props,
                            normalColor: defs.normalColor, _normalColor: defs.normalColor, _N$normalColor: defs.normalColor,
                            hoverColor: defs.hoverColor, _hoverColor: defs.hoverColor, _N$hoverColor: defs.hoverColor,
                            pressedColor: defs.pressedColor, _pressedColor: defs.pressedColor, _N$pressedColor: defs.pressedColor,
                            disabledColor: defs.disabledColor, _disabledColor: defs.disabledColor, _N$disabledColor: defs.disabledColor,
                          } } : c2)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 5px', background: '#374151', border: '1px solid #555', borderRadius: 2, cursor: 'pointer', color: '#d1d5db' }}
                      >↺ defaults</span>
                    </div>
                  )}
                </div>
              )
            }
            if (comp.type === 'cc.Toggle') {
              const checked = !!(p.isChecked ?? false)
              const interactable = !!(p.interactable ?? true)
              return (
                // R1716: isChecked + interactable 편집
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2451: enabled (BatchInspector R2195) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>isChecked</span>
                    <input type="checkbox" checked={checked}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isChecked: e.target.checked, _isChecked: e.target.checked, _N$isChecked: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />
                    <span style={{ fontSize: 9, color: checked ? '#4ade80' : '#888' }}>{checked ? '✓ checked' : '○ unchecked'}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={interactable}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, interactable: e.target.checked, _interactable: e.target.checked, _N$interactable: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />
                    <span style={{ color: interactable ? 'var(--text-muted)' : '#f85149' }}>interactable</span>
                  </label>
                </div>
              )
            }
            if (comp.type === 'cc.ProgressBar') {
              const progress = Number(p.progress ?? 0)
              // R1727: reverse + totalLength
              const reverse = !!(p.reverse ?? p._N$reverse ?? false)
              const totalLength = Number(p.totalLength ?? p._N$totalLength ?? 100)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2431: enabled (BatchInspector R2197) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>progress</span>
                    <input type="range" min={0} max={1} step={0.01} value={progress}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, progress: v, _progress: v, _N$progress: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Math.round(progress * 100)}%</span>
                  </div>
                  {/* R1770: ProgressBar progress 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 62 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(v => (
                      <span key={v}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, progress: v, _progress: v, _N$progress: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 3px', borderRadius: 2, border: `1px solid ${Math.abs(progress - v) < 0.01 ? '#58a6ff' : 'var(--border)'}`, color: Math.abs(progress - v) < 0.01 ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{Math.round(v * 100)}%</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>totalLen</span>
                    <input type="number" defaultValue={totalLength} min={0} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 100
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, totalLength: v, _totalLength: v, _N$totalLength: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 60, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={reverse}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, reverse: e.target.checked, _reverse: e.target.checked, _N$reverse: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />reverse
                    </label>
                  </div>
                  {/* R2356: ProgressBar mode 퀵 편집 (H/V/Filled) */}
                  {(() => {
                    const pbMode = Number(p.mode ?? p._mode ?? p._N$mode ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>mode</span>
                        {([['H', 0], ['V', 1], ['Fill', 2]] as const).map(([l, v]) => (
                          <span key={v} title={`mode=${l}(${v})`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mode: v, _mode: v, _N$mode: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 8, padding: '0 5px', cursor: 'pointer', border: `1px solid ${pbMode === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: pbMode === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                          >{l}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2357: ProgressBar startWidth 퀵 편집 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>startW</span>
                    <input type="number" min={0} step={1}
                      defaultValue={Number(p.startWidth ?? p._startWidth ?? p._N$startWidth ?? 0)}
                      key={`sw-${Number(p.startWidth ?? p._startWidth ?? p._N$startWidth ?? 0)}`}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startWidth: v, _startWidth: v, _N$startWidth: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[0, 1, 5, 10, 20, 50].map(v => (
                      <span key={v} title={`startWidth=${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startWidth: v, _startWidth: v, _N$startWidth: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.AudioSource') {
              const volume = Number(p.volume ?? 1)
              const loop = !!(p.loop ?? false)
              const playOnLoad = !!(p.playOnLoad ?? false)
              // R1864: pitch (CC3.x)
              const pitch = Number(p.pitch ?? p._pitch ?? 1)
              // R1701: 오디오 클립 uuid 추출
              const clipRaw = p._clip ?? p.clip
              const clipUuid = (clipRaw as Record<string,unknown> | null)?.__uuid__ as string | undefined
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2434: enabled (BatchInspector R2196) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R1701: 오디오 클립 uuid 표시 + 복사 */}
                  {clipUuid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>clip uuid</span>
                      <span style={{ fontSize: 8, color: '#facc15', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={clipUuid}>{clipUuid}</span>
                      <span
                        title="클립 UUID 복사"
                        onClick={() => navigator.clipboard.writeText(clipUuid).catch(() => {})}
                        style={{ fontSize: 9, cursor: 'pointer', color: '#555', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#facc15')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                      >⎘</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>volume</span>
                    <input type="range" min={0} max={1} step={0.01} value={volume}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: parseFloat(e.target.value), _volume: parseFloat(e.target.value), _N$volume: parseFloat(e.target.value) } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
                  </div>
                  {/* R1785: volume 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 60 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(v => (
                      <span key={v} title={`volume = ${Math.round(v * 100)}%`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: v, _volume: v, _N$volume: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(volume - v) < 0.01 ? '#facc15' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(volume - v) < 0.01 ? '#facc15' : 'var(--text-muted)', userSelect: 'none' }}
                      >{Math.round(v * 100)}%</span>
                    ))}
                  </div>
                  {/* R1864: pitch 슬라이더 (CC3.x) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>pitch</span>
                    <input type="range" min={0.5} max={2} step={0.05} value={pitch}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pitch: v, _pitch: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{pitch.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 60 }}>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
                      <span key={v} title={`pitch = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pitch: v, _pitch: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(pitch - v) < 0.01 ? '#facc15' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(pitch - v) < 0.01 ? '#facc15' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={playOnLoad}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked, _N$playOnLoad: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> playOnLoad
                    </label>
                    {/* R2361: preload */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.preload ?? p._preload ?? p._N$preload ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, preload: e.target.checked, _preload: e.target.checked, _N$preload: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> preload
                    </label>
                  </div>
                  {/* R2361: startTime + endTime */}
                  {(() => {
                    const startTime = Number(p.startTime ?? p._startTime ?? p._N$startTime ?? 0)
                    const endTime = Number(p.endTime ?? p._endTime ?? p._N$endTime ?? -1)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>time</span>
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>start</span>
                        <input type="number" min={0} step={0.1} defaultValue={startTime} key={`ast-${startTime}`}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startTime: v, _startTime: v, _N$startTime: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>end</span>
                        <input type="number" step={0.1} defaultValue={endTime} key={`aet-${endTime}`}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || -1
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endTime: v, _endTime: v, _N$endTime: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="-1 = 끝까지"
                        />
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{endTime < 0 ? '∞' : endTime + 's'}</span>
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1620: cc.Label — 텍스트 Quick Edit (string + fontSize)
            if (comp.type === 'cc.Label') {
              const str = String(p.string ?? p.String ?? p._string ?? '')
              const fs = Number(p.fontSize ?? p._fontSize ?? p._N$fontSize ?? 24)
              // R1714: 텍스트 색상
              const labelColorRaw = p.color as { r?: number; g?: number; b?: number } | undefined
              const lcR = labelColorRaw?.r ?? 255, lcG = labelColorRaw?.g ?? 255, lcB = labelColorRaw?.b ?? 255
              const lcHex = `#${lcR.toString(16).padStart(2,'0')}${lcG.toString(16).padStart(2,'0')}${lcB.toString(16).padStart(2,'0')}`
              // R1720: overflow + align
              const overflow = Number(p.overflow ?? p._overflow ?? p._N$overflow ?? 0)
              const hAlign = Number(p.horizontalAlign ?? p._N$horizontalAlign ?? 0)
              const vAlign = Number(p.verticalAlign ?? p._N$verticalAlign ?? 1)
              // R1723: lineHeight
              const lineHeight = Number(p.lineHeight ?? p._lineHeight ?? p._N$lineHeight ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2432: enabled (BatchInspector R2191) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0, marginTop: 2 }}>string</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <textarea
                        defaultValue={str}
                        rows={2}
                        onBlur={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value, _string: e.target.value, _N$string: e.target.value } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', resize: 'vertical' }}
                      />
                      {/* R1773: 텍스트 길이 배지 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
                        <span style={{ fontSize: 8, color: str.length === 0 ? '#f87171' : 'var(--text-muted)' }}>
                          {str.length === 0 ? '⚠ 빈 문자열' : `${str.length}자`}
                        </span>
                        {/* R1805: string 복사 버튼 */}
                        {str.length > 0 && (
                          <span title="텍스트 복사"
                            onClick={() => navigator.clipboard.writeText(str).catch(() => {})}
                            style={{ fontSize: 9, cursor: 'pointer', color: '#555', padding: '0 2px' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                          >⎘</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>fontSize</span>
                    <input type="number" defaultValue={fs} min={1} max={200}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || fs
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1713: fontSize 빠른 조절 버튼 */}
                    {[-10, -1, +1, +10].map(d => (
                      <span key={d}
                        title={`fontSize ${d > 0 ? '+' : ''}${d}`}
                        onClick={() => {
                          const newFs = Math.max(1, fs + d)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: newFs, _fontSize: newFs, _N$fontSize: newFs } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 3px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', flexShrink: 0 }}
                      >{d > 0 ? `+${d}` : d}</span>
                    ))}
                  </div>
                  {/* R1786: fontSize 표준 크기 프리셋 */}
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', paddingLeft: 54, marginTop: 1 }}>
                    {[12, 16, 20, 24, 32, 48, 72].map(v => (
                      <span key={v} title={`fontSize = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${fs === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: fs === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1714: 텍스트 색상 피커 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>color</span>
                    <input type="color" value={lcHex}
                      onChange={e => {
                        const h = e.target.value
                        const nr = parseInt(h.slice(1,3),16), ng = parseInt(h.slice(3,5),16), nb = parseInt(h.slice(5,7),16)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: { r: nr, g: ng, b: nb, a: 255 }, _color: { r: nr, g: ng, b: nb, a: 255 } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{lcR},{lcG},{lcB}</span>
                  </div>
                  {/* R1723: lineHeight */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>lineH</span>
                    <input type="number" defaultValue={lineHeight} min={0} step={1}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineHeight: v, _lineHeight: v, _N$lineHeight: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      placeholder="0=자동"
                    />
                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
                    {/* R1787: lineHeight 퀵 프리셋 */}
                    {([0, fs, Math.round(fs * 1.2), Math.round(fs * 1.5), Math.round(fs * 2)] as const).map((v, i) => {
                      const labels = ['0', '×1', '×1.2', '×1.5', '×2']
                      return (
                        <span key={i} title={`lineHeight = ${v}`}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineHeight: v, _lineHeight: v, _N$lineHeight: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${lineHeight === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: lineHeight === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none', flexShrink: 0 }}
                        >{labels[i]}</span>
                      )
                    })}
                  </div>
                  {/* R2404: isSystemFontUsed + platformFont (CC2.x) */}
                  {!is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!(p.isSystemFontUsed ?? p._isSystemFontUsed ?? p._N$isSystemFontUsed ?? false)}
                          onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isSystemFontUsed: e.target.checked, _isSystemFontUsed: e.target.checked, _N$isSystemFontUsed: e.target.checked } } : c); applyAndSave({ components: u }) }}
                          style={{ margin: 0, accentColor: '#a78bfa' }}
                        />sysFont
                      </label>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>platFont:</span>
                      {(['', 'system-ui', 'sans-serif', 'monospace'] as const).map(f => {
                        const cur = String(p.platformFont ?? p._platformFont ?? p._N$platformFont ?? '')
                        return (
                          <span key={f || 'def'} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, platformFont: f, _platformFont: f, _N$platformFont: f } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${cur === f ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === f ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                          >{f || 'def'}</span>
                        )
                      })}
                    </div>
                  )}
                  {/* R1757: fontFamily 입력 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>fontFam</span>
                    <input type="text" defaultValue={String(p.fontFamily ?? p._fontFamily ?? p._N$fontFamily ?? '')} placeholder="폰트 이름 (빈칸=기본)"
                      onBlur={e => {
                        const v = e.target.value.trim()
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontFamily: v, _fontFamily: v, _N$fontFamily: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1798: fontFamily 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', paddingLeft: 52 }}>
                    {(['', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New'] as const).map(ff => {
                      const curFf = String(p.fontFamily ?? p._fontFamily ?? p._N$fontFamily ?? '')
                      return (
                        <span key={ff} title={ff || '기본 (빈칸)'}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontFamily: ff, _fontFamily: ff, _N$fontFamily: ff } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${curFf === ff ? '#f59e0b' : 'var(--border)'}`, borderRadius: 2, color: curFf === ff ? '#f59e0b' : 'var(--text-muted)', userSelect: 'none', fontFamily: ff || 'inherit' }}
                        >{ff || 'default'}</span>
                      )
                    })}
                  </div>
                  {/* R2445: cacheMode (BatchInspector R1925) None/Bitmap/Char */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>cacheMode</span>
                    {([['None', 0], ['Bitmap', 1], ['Char', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.cacheMode ?? p._cacheMode ?? p._N$cacheMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cacheMode: v, _cacheMode: v, _N$cacheMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R1720: overflow + hAlign + vAlign */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>overflow</span>
                    <select value={overflow}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, overflow: v, _overflow: v, _N$overflow: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>None</option>
                      <option value={1}>Clamp</option>
                      <option value={2}>Shrink</option>
                      <option value={3}>ResizeH</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>align</span>
                    <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                      {(['L', 'C', 'R'] as const).map((lbl, i) => (
                        <span key={lbl}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalAlign: i, _horizontalAlign: i, _N$horizontalAlign: i } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 9, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: `1px solid ${hAlign === i ? '#58a6ff' : 'var(--border)'}`, color: hAlign === i ? '#58a6ff' : 'var(--text-muted)', background: hAlign === i ? 'rgba(88,166,255,0.1)' : 'transparent' }}
                        >{lbl}</span>
                      ))}
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', margin: '0 4px' }}>|</span>
                      {(['T', 'M', 'B'] as const).map((lbl, i) => (
                        <span key={lbl}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, verticalAlign: i, _verticalAlign: i, _N$verticalAlign: i } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 9, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: `1px solid ${vAlign === i ? '#58a6ff' : 'var(--border)'}`, color: vAlign === i ? '#58a6ff' : 'var(--text-muted)', background: vAlign === i ? 'rgba(88,166,255,0.1)' : 'transparent' }}
                        >{lbl}</span>
                      ))}
                    </div>
                  </div>
                  {/* R1789: enableWrapText 토글 + spacingX */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>wrap</span>
                    {(() => {
                      const wrapVal = !!(p.enableWrapText ?? p._enableWrapText ?? p._N$enableWrapText ?? true)
                      return (
                        <span title={wrapVal ? '줄바꿈 활성 (클릭시 해제)' : '줄바꿈 비활성 (클릭시 활성)'}
                          onClick={() => {
                            const nv = !wrapVal
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableWrapText: nv, _enableWrapText: nv, _N$enableWrapText: nv } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '1px 6px', cursor: 'pointer', border: `1px solid ${wrapVal ? '#4ade80' : 'var(--border)'}`, borderRadius: 2, color: wrapVal ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
                        >{wrapVal ? '✓ wrap' : '✕ wrap'}</span>
                      )
                    })()}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>spcX</span>
                    <input type="number" defaultValue={Number(p.spacingX ?? p._spacingX ?? p._N$spacingX ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingX: v, _spacingX: v, _N$spacingX: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R2364: spacingY */}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>Y</span>
                    <input type="number" defaultValue={Number(p.spacingY ?? p._spacingY ?? p._N$spacingY ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingY: v, _spacingY: v, _N$spacingY: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="spacingY (R2364)"
                    />
                  </div>
                  {/* R1743: bold / italic / underline 토글 */}
                  {(() => {
                    const bold = !!(p.isBold ?? p._isBold ?? p._N$isBold ?? false)
                    const italic = !!(p.isItalic ?? p._isItalic ?? p._N$isItalic ?? false)
                    const underline = !!(p.isUnderline ?? p._isUnderline ?? p._N$isUnderline ?? false)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>style</span>
                        {[
                          { label: 'B', title: 'Bold', key: 'isBold', val: bold },
                          { label: 'I', title: 'Italic', key: 'isItalic', val: italic },
                          { label: 'U', title: 'Underline', key: 'isUnderline', val: underline },
                        ].map(({ label, title, key, val }) => (
                          <span key={key}
                            title={title}
                            onClick={() => {
                              const nv = !val
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key]: nv, [`_${key}`]: nv, [`_N$${key}`]: nv } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 10, fontWeight: label === 'B' ? 700 : 400, fontStyle: label === 'I' ? 'italic' : 'normal', textDecoration: label === 'U' ? 'underline' : 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: `1px solid ${val ? '#58a6ff' : 'var(--border)'}`, color: val ? '#58a6ff' : 'var(--text-muted)', background: val ? 'rgba(88,166,255,0.1)' : 'transparent', userSelect: 'none' }}
                          >{label}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2350: underlineHeight (CC3.x) — isUnderline 활성 시 표시 */}
                  {!!(p.isUnderline ?? p._isUnderline ?? p._N$isUnderline ?? false) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>ulHeight</span>
                      <input type="number" defaultValue={Number(p.underlineHeight ?? p._underlineHeight ?? 2)} min={1} max={20} step={1}
                        key={`ulh-${Number(p.underlineHeight ?? p._underlineHeight ?? 2)}`}
                        onBlur={e => {
                          const v = parseInt(e.target.value) || 2
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, underlineHeight: v, _underlineHeight: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: '#93c5fd', borderRadius: 3, padding: '1px 4px' }}
                        title="밑줄 두께 (CC3.x underlineHeight, 기본 2px)"
                      />
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
                      {[1, 2, 3, 4, 6].map(v => (
                        <span key={v} title={`underlineHeight = ${v}`}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, underlineHeight: v, _underlineHeight: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Number(p.underlineHeight ?? p._underlineHeight ?? 2) === v ? '#93c5fd' : 'var(--border)'}`, borderRadius: 2, color: Number(p.underlineHeight ?? p._underlineHeight ?? 2) === v ? '#93c5fd' : 'var(--text-muted)', userSelect: 'none' }}
                        >{v}</span>
                      ))}
                    </div>
                  )}
                  {/* R2351: cc.Label strikethrough + charSpacing */}
                  {(() => {
                    const isStrike = !!(p.isStrikethrough ?? p._isStrikethrough ?? p.isStrike ?? p._isStrike ?? p._N$isStrike ?? false)
                    const charSpacing = Number(p.charSpacing ?? p._charSpacing ?? p._N$charSpacing ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          title={isStrike ? '취소선 해제' : '취소선 활성'}
                          onClick={() => {
                            const nv = !isStrike
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isStrikethrough: nv, isStrike: nv, _isStrike: nv, _N$isStrike: nv } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 10, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: `1px solid ${isStrike ? '#f472b6' : 'var(--border)'}`, color: isStrike ? '#f472b6' : 'var(--text-muted)', background: isStrike ? 'rgba(244,114,182,0.1)' : 'transparent', textDecoration: 'line-through', userSelect: 'none' }}
                        >S</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>spcX</span>
                        <input type="number" defaultValue={charSpacing} step={1}
                          key={`cs-${charSpacing}`}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, charSpacing: v, _charSpacing: v, _N$charSpacing: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="문자 간격 (charSpacing)"
                        />
                        {[-2, 0, 2, 4, 8].map(v => (
                          <span key={v} title={`charSpacing = ${v}`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, charSpacing: v, _charSpacing: v, _N$charSpacing: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${charSpacing === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: charSpacing === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                          >{v}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R1746: 텍스트 대소문자 변환 버튼 */}
                  {str && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>변환</span>
                      {[
                        { label: 'ABC', title: '모두 대문자', fn: (s: string) => s.toUpperCase() },
                        { label: 'abc', title: '모두 소문자', fn: (s: string) => s.toLowerCase() },
                        { label: 'Abc', title: '단어 첫 글자 대문자', fn: (s: string) => s.replace(/\b\w/g, c => c.toUpperCase()) },
                        /* R1759: trim */
                        { label: 'trim', title: '앞뒤 공백 제거', fn: (s: string) => s.trim() },
                      ].map(({ label, title, fn }) => (
                        <span key={label} title={title}
                          onClick={() => {
                            const newStr = fn(str)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: newStr, _string: newStr, _N$string: newStr } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 9, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >{label}</span>
                      ))}
                    </div>
                  )}
                  {/* R2372: CC3.x Label enableDashLine */}
                  {(() => {
                    const enableDashLine = !!(p.enableDashLine ?? p._enableDashLine ?? false)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>dashLine</span>
                        <span title={enableDashLine ? 'dashLine 비활성' : 'dashLine 활성'}
                          onClick={() => { const nv = !enableDashLine; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableDashLine: nv, _enableDashLine: nv } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${enableDashLine ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: enableDashLine ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{enableDashLine ? 'ON' : 'OFF'}</span>
                      </div>
                    )
                  })()}
                  {/* R2371: CC3.x Label enableGradient + colorTop + colorBottom */}
                  {(() => {
                    const enableGradient = !!(p.enableGradient ?? p._enableGradient ?? false)
                    const ct = p.colorTop ?? p._colorTop as { r?: number; g?: number; b?: number } | undefined
                    const cb = p.colorBottom ?? p._colorBottom as { r?: number; g?: number; b?: number } | undefined
                    const ctHex = ct ? `#${((ct.r ?? 255) << 16 | (ct.g ?? 255) << 8 | (ct.b ?? 255)).toString(16).padStart(6, '0')}` : '#ffffff'
                    const cbHex = cb ? `#${((cb.r ?? 0) << 16 | (cb.g ?? 0) << 8 | (cb.b ?? 0)).toString(16).padStart(6, '0')}` : '#000000'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>gradient</span>
                        <span title={enableGradient ? 'gradient 비활성' : 'gradient 활성'}
                          onClick={() => { const nv = !enableGradient; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableGradient: nv, _enableGradient: nv } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${enableGradient ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: enableGradient ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                        >{enableGradient ? 'ON' : 'OFF'}</span>
                        {enableGradient && (<>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>top</span>
                          <input type="color" defaultValue={ctHex}
                            style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                            onChange={ev => { const c2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (c2 >> 16) & 255, g: (c2 >> 8) & 255, b: c2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, colorTop: col, _colorTop: col } } : c); applyAndSave({ components: u }) }}
                            title="colorTop"
                          />
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>bot</span>
                          <input type="color" defaultValue={cbHex}
                            style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                            onChange={ev => { const c2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (c2 >> 16) & 255, g: (c2 >> 8) & 255, b: c2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, colorBottom: col, _colorBottom: col } } : c); applyAndSave({ components: u }) }}
                            title="colorBottom"
                          />
                        </>)}
                      </div>
                    )
                  })()}
                  {/* R2370: CC3.x Label enableShadow + shadowColor + shadowBlur */}
                  {/* R2385: + shadowOffset x/y */}
                  {(() => {
                    const enableShadow = !!(p.enableShadow ?? p._enableShadow ?? false)
                    const shadowBlur = Number(p.shadowBlur ?? p._shadowBlur ?? 2)
                    const sc = p.shadowColor ?? p._shadowColor as { r?: number; g?: number; b?: number } | undefined
                    const scHex = sc ? `#${((sc.r ?? 0) << 16 | (sc.g ?? 0) << 8 | (sc.b ?? 0)).toString(16).padStart(6, '0')}` : '#000000'
                    const soRaw = p.shadowOffset ?? p._shadowOffset as { x?: number; y?: number } | undefined
                    const sox = Number((soRaw as Record<string,number>|undefined)?.x ?? 2)
                    const soy = Number((soRaw as Record<string,number>|undefined)?.y ?? -2)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>shadow</span>
                          <span title={enableShadow ? 'shadow 비활성' : 'shadow 활성'}
                            onClick={() => { const nv = !enableShadow; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableShadow: nv, _enableShadow: nv } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${enableShadow ? '#818cf8' : 'var(--border)'}`, borderRadius: 2, color: enableShadow ? '#818cf8' : 'var(--text-muted)', userSelect: 'none' }}
                          >{enableShadow ? 'ON' : 'OFF'}</span>
                          {enableShadow && (<>
                            <input type="number" defaultValue={shadowBlur} min={0} max={20} step={1}
                              style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                              onBlur={ev => { const v = parseInt(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, shadowBlur: v, _shadowBlur: v } } : c); applyAndSave({ components: u }) }}
                              title="shadowBlur"
                            />
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>blur</span>
                            <input type="color" defaultValue={scHex}
                              style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                              onChange={ev => { const c2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (c2 >> 16) & 255, g: (c2 >> 8) & 255, b: c2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, shadowColor: col, _shadowColor: col } } : c); applyAndSave({ components: u }) }}
                              title="shadowColor"
                            />
                          </>)}
                        </div>
                        {enableShadow && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 52 }}>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>offset x</span>
                            <input type="number" defaultValue={sox} step={1}
                              style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                              onBlur={ev => { const x = parseFloat(ev.target.value) || 0; const so = { x, y: soy }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, shadowOffset: so, _shadowOffset: so } } : c); applyAndSave({ components: u }) }}
                              title="shadowOffset.x"
                            />
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
                            <input type="number" defaultValue={soy} step={1}
                              style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                              onBlur={ev => { const y = parseFloat(ev.target.value) || 0; const so = { x: sox, y }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, shadowOffset: so, _shadowOffset: so } } : c); applyAndSave({ components: u }) }}
                              title="shadowOffset.y"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {/* R2369: CC3.x Label enableOutline + outlineWidth + outlineColor */}
                  {(() => {
                    const enableOutline = !!(p.enableOutline ?? p._enableOutline ?? false)
                    const outlineWidth = Number(p.outlineWidth ?? p._outlineWidth ?? 2)
                    const oc = p.outlineColor ?? p._outlineColor as { r?: number; g?: number; b?: number } | undefined
                    const ocHex = oc ? `#${((oc.r ?? 0) << 16 | (oc.g ?? 0) << 8 | (oc.b ?? 0)).toString(16).padStart(6, '0')}` : '#000000'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>outline</span>
                        <span title={enableOutline ? 'outline 비활성' : 'outline 활성'}
                          onClick={() => { const nv = !enableOutline; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableOutline: nv, _enableOutline: nv } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${enableOutline ? '#f59e0b' : 'var(--border)'}`, borderRadius: 2, color: enableOutline ? '#f59e0b' : 'var(--text-muted)', userSelect: 'none' }}
                        >{enableOutline ? 'ON' : 'OFF'}</span>
                        {enableOutline && (<>
                          <input type="number" defaultValue={outlineWidth} min={1} max={20} step={1}
                            style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                            onBlur={ev => { const v = parseInt(ev.target.value) || 2; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, outlineWidth: v, _outlineWidth: v } } : c); applyAndSave({ components: u }) }}
                            title="outlineWidth"
                          />
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>px</span>
                          <input type="color" defaultValue={ocHex}
                            style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                            onChange={ev => { const c2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (c2 >> 16) & 255, g: (c2 >> 8) & 255, b: c2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, outlineColor: col, _outlineColor: col } } : c); applyAndSave({ components: u }) }}
                            title="outlineColor"
                          />
                        </>)}
                      </div>
                    )
                  })()}
                  {/* R1691: 멀티라인 텍스트 미리보기 */}
                  {(str.includes('\n') || str.includes('\\n')) && (() => {
                    const lines = str.replace(/\\n/g, '\n').split('\n')
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0, marginTop: 2 }}>미리보기</span>
                        <div style={{ flex: 1, background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 3, padding: '3px 5px', fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre', overflowX: 'auto', maxHeight: 60, overflowY: 'auto' }}>
                          {lines.map((line, i) => <div key={i}>{line || <span style={{ color: 'var(--text-muted)' }}>↵</span>}</div>)}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R2420: cc.LabelOutline — width + color (BatchInspector R1860/R1909)
            if (comp.type === 'cc.LabelOutline') {
              const width = Number(p.width ?? p._width ?? p._N$width ?? 1)
              const colRaw = p.color ?? p._color ?? p._N$color as { r?: number; g?: number; b?: number } | undefined
              const toHex = (c: typeof colRaw) => `#${[(c?.r ?? 0),(c?.g ?? 0),(c?.b ?? 0)].map(v => v.toString(16).padStart(2,'0')).join('')}`
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>width</span>
                    <input type="number" defaultValue={width} min={0} step={1}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={ev => { const v = Math.max(0, parseInt(ev.target.value) || 0); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, width: v, _width: v, _N$width: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[1, 2, 3, 4, 5, 8].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, width: v, _width: v, _N$width: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>color</span>
                    <input type="color" value={toHex(colRaw as { r?: number; g?: number; b?: number } | undefined)}
                      onChange={e => { const n2 = parseInt(e.target.value.slice(1), 16); const col = { r: (n2>>16)&255, g: (n2>>8)&255, b: n2&255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 36, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                    />
                  </div>
                </div>
              )
            }
            // R2420: cc.LabelShadow — blur + color (BatchInspector R1861/R1910)
            if (comp.type === 'cc.LabelShadow') {
              const blur = Number(p.blur ?? p._blur ?? 2)
              const colRaw = p.color ?? p._color ?? p._N$color as { r?: number; g?: number; b?: number } | undefined
              const toHex = (c: typeof colRaw) => `#${[(c?.r ?? 0),(c?.g ?? 0),(c?.b ?? 0)].map(v => v.toString(16).padStart(2,'0')).join('')}`
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>blur</span>
                    <input type="number" defaultValue={blur} min={0} step={1}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={ev => { const v = Math.max(0, parseInt(ev.target.value) || 0); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, blur: v, _blur: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[1, 2, 3, 5, 8].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, blur: v, _blur: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>color</span>
                    <input type="color" value={toHex(colRaw as { r?: number; g?: number; b?: number } | undefined)}
                      onChange={e => { const n2 = parseInt(e.target.value.slice(1), 16); const col = { r: (n2>>16)&255, g: (n2>>8)&255, b: n2&255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 36, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                    />
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.RichText') {
              const str = String(p.string ?? p.String ?? '')
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R1808: _N$string 포함 */}
                  <textarea
                    defaultValue={str}
                    rows={2}
                    onBlur={e => {
                      const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value, _string: e.target.value, _N$string: e.target.value } } : c)
                      applyAndSave({ components: updated })
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', resize: 'vertical' }}
                  />
                  {/* R2381: lineHeight + overflow + handleTouchEvent */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>lineH</span>
                    <input type="number" defaultValue={Number(p.lineHeight ?? p._lineHeight ?? p._N$lineHeight ?? 40)} min={1} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || 40; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineHeight: v, _lineHeight: v, _N$lineHeight: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="lineHeight"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>overflow</span>
                    {([['Clamp', 0], ['Shrink', 1], ['Resize', 2], ['None', 3]] as const).map(([l, v]) => (
                      <span key={v} title={`overflow=${l}(${v})`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, overflow: v, _overflow: v, _N$overflow: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${Number(p.overflow ?? p._N$overflow ?? 0) === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: Number(p.overflow ?? p._N$overflow ?? 0) === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  {/* R2392: imageLineHeight */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>imgLineH</span>
                    <input type="number" defaultValue={Number(p.imageLineHeight ?? p._imageLineHeight ?? p._N$imageLineHeight ?? 40)} min={0} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || 40; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, imageLineHeight: v, _imageLineHeight: v, _N$imageLineHeight: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="imageLineHeight"
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.handleTouchEvent ?? p._handleTouchEvent ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, handleTouchEvent: e.target.checked, _handleTouchEvent: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />handleTouchEvent
                  </label>
                  {/* R2418: horizontalAlign + fontSize + maxWidth + fontColor */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>hAlign</span>
                    {([['L', 0], ['C', 1], ['R', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.horizontalAlign ?? p._horizontalAlign ?? p._N$horizontalAlign ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalAlign: v, _horizontalAlign: v, _N$horizontalAlign: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>fontSize</span>
                    <input type="number" defaultValue={Number(p.fontSize ?? p._fontSize ?? p._N$fontSize ?? 40)} min={1} step={2}
                      onBlur={e => { const v = parseInt(e.target.value) || 40; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="fontSize"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>maxW</span>
                    <input type="number" defaultValue={Number(p.maxWidth ?? p._maxWidth ?? p._N$maxWidth ?? 0)} min={0} step={10}
                      onBlur={e => { const v = parseInt(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxWidth: v, _maxWidth: v, _N$maxWidth: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="maxWidth (0=unlimited)"
                    />
                  </div>
                  {(() => {
                    const fcRaw = p.fontColor ?? p._fontColor ?? p._N$fontColor as { r?: number; g?: number; b?: number } | undefined
                    const toHex = (c: typeof fcRaw) => `#${[(c?.r ?? 255),(c?.g ?? 255),(c?.b ?? 255)].map(v => v.toString(16).padStart(2,'0')).join('')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>fontColor</span>
                        <input type="color" value={toHex(fcRaw as { r?: number; g?: number; b?: number } | undefined)}
                          onChange={e => { const h = e.target.value; const r2 = parseInt(h.slice(1,3),16), g2 = parseInt(h.slice(3,5),16), b2 = parseInt(h.slice(5,7),16); const col = { r: r2, g: g2, b: b2, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 36, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                          title="fontColor"
                        />
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1538: cc.EditBox — 텍스트/플레이스홀더/maxLength 편집
            if (comp.type === 'cc.EditBox') {
              const str = String(p.string ?? '')
              const placeholder = String(p.placeholder ?? '')
              const maxLength = Number(p.maxLength ?? -1)
              // R1791: inputFlag
              const inputFlag = Number(p.inputFlag ?? p._inputFlag ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>string</span>
                    <input type="text" defaultValue={str}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value, _string: e.target.value, _N$string: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>placeholder</span>
                    <input type="text" defaultValue={placeholder}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholder: e.target.value, _placeholder: e.target.value, _N$placeholder: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 3, padding: '1px 4px', fontStyle: 'italic' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>maxLength</span>
                    <input type="number" defaultValue={maxLength} min={-1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxLength: parseInt(e.target.value) || -1, _maxLength: parseInt(e.target.value) || -1, _N$maxLength: parseInt(e.target.value) || -1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{maxLength < 0 ? '(unlimited)' : `≤${maxLength}`}</span>
                  </div>
                  {/* R1791: inputFlag 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>inputFlag</span>
                    {([['Any', 0], ['Passwd', 3], ['Email', 1], ['Phone', 4], ['Num', 5]] as const).map(([l, v]) => (
                      <span key={v} title={l}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inputFlag: v, _inputFlag: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${inputFlag === v ? '#f59e0b' : 'var(--border)'}`, borderRadius: 2, color: inputFlag === v ? '#f59e0b' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  {/* R2388: returnType 버튼 (CC3.x) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>returnType</span>
                    {([['Default', 0], ['Done', 1], ['Send', 2], ['Search', 3], ['Go', 4], ['Next', 5]] as const).map(([l, v]) => {
                      const cur = Number(p.returnType ?? p._returnType ?? p._N$returnType ?? 0)
                      return (
                        <span key={v} title={l}
                          onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, returnType: v, _returnType: v, _N$returnType: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${cur === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R2386: placeholderFontSize 퀵 편집 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>phFontSize</span>
                    <input type="number" defaultValue={Number(p.placeholderFontSize ?? p._placeholderFontSize ?? p._N$placeholderFontSize ?? 20)} min={1} step={2}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={ev => { const v = Math.max(1, parseInt(ev.target.value) || 20); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontSize: v, _placeholderFontSize: v, _N$placeholderFontSize: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[12, 16, 20, 24, 32, 48].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontSize: v, _placeholderFontSize: v, _N$placeholderFontSize: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2380: fontColor + placeholderFontColor */}
                  {(() => {
                    const fc = p.fontColor ?? p._fontColor ?? p._N$fontColor as { r?: number; g?: number; b?: number } | undefined
                    const pfc = p.placeholderFontColor ?? p._placeholderFontColor ?? p._N$placeholderFontColor as { r?: number; g?: number; b?: number } | undefined
                    const fcHex = fc ? `#${((fc.r ?? 255) << 16 | (fc.g ?? 255) << 8 | (fc.b ?? 255)).toString(16).padStart(6, '0')}` : '#ffffff'
                    const pfcHex = pfc ? `#${((pfc.r ?? 128) << 16 | (pfc.g ?? 128) << 8 | (pfc.b ?? 128)).toString(16).padStart(6, '0')}` : '#808080'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>fontColor</span>
                        <input type="color" defaultValue={fcHex}
                          style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                          onChange={ev => { const n2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (n2 >> 16) & 255, g: (n2 >> 8) & 255, b: n2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } } : c); applyAndSave({ components: u }) }}
                          title="fontColor"
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>phColor</span>
                        <input type="color" defaultValue={pfcHex}
                          style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                          onChange={ev => { const n2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (n2 >> 16) & 255, g: (n2 >> 8) & 255, b: n2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontColor: col, _placeholderFontColor: col, _N$placeholderFontColor: col } } : c); applyAndSave({ components: u }) }}
                          title="placeholderFontColor"
                        />
                      </div>
                    )
                  })()}
                  {/* R2419: fontSize + inputMode (BatchInspector R1943/R2085) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>fontSize</span>
                    <input type="number" defaultValue={Number(p.fontSize ?? p._fontSize ?? p._N$fontSize ?? 20)} min={1} step={2}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={ev => { const v = Math.max(1, parseInt(ev.target.value) || 20); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[12, 16, 20, 24, 32, 40].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>inputMode</span>
                    {([['Any', 0], ['Num', 2], ['Dec', 5], ['1L', 6]] as const).map(([l, v]) => {
                      const cur = Number(p.inputMode ?? p._inputMode ?? p._N$inputMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inputMode: v, _inputMode: v, _N$inputMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                </div>
              )
            }
            // R1524: cc.Animation — 클립 드롭다운 + defaultClip 표시 / R1700: 클립 목록 + 이름 복사
            if (comp.type === 'cc.Animation') {
              const clips = (p._resolvedClips as Array<{ name: string }> | undefined) ?? []
              const defaultClipName = p._defaultClipName as string | undefined
              if (clips.length === 0) return null
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2435: enabled (BatchInspector R2191) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>default</span>
                    <select
                      defaultValue={defaultClipName ?? clips[0]?.name}
                      title="R1524: 클립 목록 (read-only)"
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      {clips.map(c => (
                        <option key={c.name} value={c.name}>{c.name === defaultClipName ? `★ ${c.name}` : c.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* R2375: sample + speed */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>sample</span>
                    <input type="number" defaultValue={Number(p.sample ?? p._sample ?? 60)} min={1} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || 60; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sample: v, _sample: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="sample rate"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>speed</span>
                    <input type="number" defaultValue={Number(p.speed ?? p._speed ?? 1)} min={0} step={0.1}
                      onBlur={e => { const v = parseFloat(e.target.value) ?? 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speed: v, _speed: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="playback speed"
                    />
                  </div>
                  {/* R2417: wrapMode (BatchInspector R1984) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>wrapMode</span>
                    {([['Dflt', 0], ['Norm', 1], ['Loop', 2], ['Ping', 3], ['Clamp', 4]] as const).map(([l, v]) => {
                      const cur = Number(p.wrapMode ?? p._wrapMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, wrapMode: v, _wrapMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R2389: playOnLoad 체크박스 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.playOnLoad ?? p._playOnLoad ?? p._N$playOnLoad ?? false)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked, _N$playOnLoad: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />playOnLoad
                  </label>
                  {/* R1700: 클립 목록 + 이름 복사 */}
                  <div style={{ paddingLeft: 62 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{clips.length} clips</span>
                      <span
                        title="모든 클립명 복사"
                        onClick={() => navigator.clipboard.writeText(clips.map(c => c.name).join(', ')).catch(() => {})}
                        style={{ fontSize: 8, cursor: 'pointer', color: '#666', padding: '0 3px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f472b6')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                      >⎘ all</span>
                    </div>
                    {clips.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 1 }}>
                        <span style={{ fontSize: 8, color: c.name === defaultClipName ? '#f472b6' : 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name === defaultClipName ? '★ ' : ''}{c.name}
                        </span>
                        <span
                          title={`"${c.name}" 복사`}
                          onClick={() => navigator.clipboard.writeText(c.name).catch(() => {})}
                          style={{ fontSize: 8, cursor: 'pointer', color: '#555', flexShrink: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f472b6')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                        >⎘</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            // R1562: cc.Slider — progress + direction Quick Edit
            if (comp.type === 'cc.Slider') {
              const progress = Number(p.progress ?? p._N$progress ?? 0)
              const direction = Number(p.direction ?? p._N$direction ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2429: enabled (BatchInspector R2195) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>progress</span>
                    <input type="range" min={0} max={1} step={0.01} value={progress}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, progress: v, _progress: v, _N$progress: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Math.round(progress * 100)}%</span>
                  </div>
                  {/* R1765: progress 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 62 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(v => (
                      <span key={v}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, progress: v, _progress: v, _N$progress: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 3px', borderRadius: 2, border: `1px solid ${Math.abs(progress - v) < 0.01 ? '#58a6ff' : 'var(--border)'}`, color: Math.abs(progress - v) < 0.01 ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{Math.round(v * 100)}%</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>direction</span>
                    <select value={direction}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v, _direction: v, _N$direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Horizontal</option>
                      <option value={1}>Vertical</option>
                    </select>
                  </div>
                  {/* R1902: interactable */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.interactable ?? p._N$interactable ?? true)}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, interactable: e.target.checked, _interactable: e.target.checked, _N$interactable: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />
                    <span style={{ color: !!(p.interactable ?? p._N$interactable ?? true) ? 'var(--text-muted)' : '#f85149' }}>interactable</span>
                  </label>
                  {/* R2359: minValue / maxValue / step */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>range</span>
                    <input type="number" step={0.1}
                      defaultValue={Number(p.minValue ?? p._minValue ?? p._N$minValue ?? 0)}
                      key={`smn-${Number(p.minValue ?? p._minValue ?? 0)}`}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, minValue: v, _minValue: v, _N$minValue: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="minValue"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>~</span>
                    <input type="number" step={0.1}
                      defaultValue={Number(p.maxValue ?? p._maxValue ?? p._N$maxValue ?? 1)}
                      key={`smx-${Number(p.maxValue ?? p._maxValue ?? 1)}`}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxValue: v, _maxValue: v, _N$maxValue: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="maxValue"
                    />
                    {([[0,1],[0,10],[0,100],[-1,1]] as const).map(([mn, mx]) => (
                      <span key={`${mn}-${mx}`} title={`min=${mn} max=${mx}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, minValue: mn, maxValue: mx, _minValue: mn, _maxValue: mx, _N$minValue: mn, _N$maxValue: mx } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{mn}~{mx}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>step</span>
                    <input type="number" min={0} step={0.01}
                      defaultValue={Number(p.step ?? p._step ?? p._N$step ?? 0)}
                      key={`sst-${Number(p.step ?? p._step ?? 0)}`}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, step: v, _step: v, _N$step: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[0, 0.01, 0.05, 0.1, 0.5, 1].map(v => (
                      <span key={v} title={`step = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, step: v, _step: v, _N$step: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1562: cc.VideoPlayer — remoteURL/loop/muted/playbackRate Quick Edit
            if (comp.type === 'cc.VideoPlayer') {
              const url = String(p.remoteURL ?? p._N$remoteURL ?? '')
              const loop = !!(p.loop ?? p._N$loop ?? false)
              const muted = !!(p.muted ?? p._N$muted ?? false)
              const playbackRate = Number(p.playbackRate ?? p._N$playbackRate ?? 1)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2435: enabled (BatchInspector R2196) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R2414: resourceType (BatchInspector R2046) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>resType</span>
                    {([['Local', 0], ['Remote', 1]] as const).map(([l, v]) => {
                      const cur = Number(p.resourceType ?? p._resourceType ?? p._N$resourceType ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resourceType: v, _resourceType: v, _N$resourceType: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>remoteURL</span>
                    <input type="text" defaultValue={url}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, remoteURL: e.target.value, _remoteURL: e.target.value, _N$remoteURL: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>playbackRate</span>
                    <input type="number" defaultValue={playbackRate} min={0} max={4} step={0.25}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playbackRate: v, _playbackRate: v, _N$playbackRate: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1806: playbackRate 퀵 프리셋 */}
                    {([0.5, 1, 1.5, 2] as const).map(v => (
                      <span key={v} title={`×${v}`}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playbackRate: v, _playbackRate: v, _N$playbackRate: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${playbackRate === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: playbackRate === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >×{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={muted}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, muted: e.target.checked, _muted: e.target.checked, _N$muted: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> muted
                    </label>
                    {/* R2376: keepAspectRatio + fullScreenEnabled */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.keepAspectRatio ?? p._keepAspectRatio ?? p._N$keepAspectRatio ?? true)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, keepAspectRatio: e.target.checked, _keepAspectRatio: e.target.checked, _N$keepAspectRatio: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> ratio
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.fullScreenEnabled ?? p._fullScreenEnabled ?? p._N$fullScreenEnabled ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fullScreenEnabled: e.target.checked, _fullScreenEnabled: e.target.checked, _N$fullScreenEnabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> fullscr
                    </label>
                  </div>
                  {/* R2376: volume */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>volume</span>
                    <input type="range" min={0} max={1} step={0.05} defaultValue={Number(p.volume ?? p._volume ?? p._N$volume ?? 1)}
                      onMouseUp={e => { const v = parseFloat((e.target as HTMLInputElement).value); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: v, _volume: v, _N$volume: v } } : c); applyAndSave({ components: u }) }}
                      style={{ flex: 1 }}
                      title="volume (0~1)"
                    />
                    {[0, 0.5, 1].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: v, _volume: v, _N$volume: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2399: startTime 입력 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>startTime</span>
                    <input type="number" min={0} step={0.5} defaultValue={Number(p.startTime ?? p._startTime ?? p._N$startTime ?? 0)}
                      onBlur={e => { const v = Math.max(0, parseFloat(e.target.value) || 0); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startTime: v, _startTime: v, _N$startTime: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="startTime (초)"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>s</span>
                    {[0, 5, 10, 30].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startTime: v, _startTime: v, _N$startTime: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1892: cc.Camera — backgroundColor / clearFlags / depth
            // R1919: + fov
            if (comp.type === 'cc.Camera') {
              const bg = p.backgroundColor as { r?: number; g?: number; b?: number; a?: number } | undefined
              const bgHex = `#${((bg?.r ?? 0)).toString(16).padStart(2,'0')}${((bg?.g ?? 0)).toString(16).padStart(2,'0')}${((bg?.b ?? 0)).toString(16).padStart(2,'0')}`
              const depth = Number(p.depth ?? p._depth ?? 0)
              const clearFlags = Number(p.clearFlags ?? p._clearFlags ?? 7)
              const fov = Number(p.fov ?? p._fov ?? 60)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2438: enabled (BatchInspector R2199) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>bgColor</span>
                    <input type="color" value={bgHex}
                      onChange={e => {
                        const h = e.target.value
                        const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                        const col = { r, g, b, a: bg?.a ?? 255 }
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, backgroundColor: col, _backgroundColor: col, _N$backgroundColor: col } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>clearFlags</span>
                    {([['None',0],['Depth',2],['Color+D',7],['All',15]] as [string,number][]).map(([l,v]) => (
                      <span key={v} title={`clearFlags=${v}`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearFlags: v, _clearFlags: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${clearFlags === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: clearFlags === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>depth</span>
                    <input type="number" defaultValue={depth} step={1} key={`cdepth-${depth}`}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, depth: v, _depth: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1919: fov */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>fov</span>
                    <input type="number" defaultValue={fov} min={1} max={179} step={5} key={`cfov-${fov}`}
                      onBlur={e => {
                        const v = Math.min(179, Math.max(1, parseFloat(e.target.value) || 60))
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fov: v, _fov: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>°</span>
                  </div>
                  {/* R2442: CC3.x orthoHeight/near/far (dead block 2 props 통합) */}
                  {is3x && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>orthoH</span>
                        <input type="number" min={1} step={10}
                          defaultValue={Number(p.orthoHeight ?? p._orthoHeight ?? 540)}
                          key={`oh-${Number(p.orthoHeight ?? 540)}`}
                          onBlur={e => {
                            const v = Math.max(1, parseFloat(e.target.value) || 540)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, orthoHeight: v, _orthoHeight: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: '#93c5fd', borderRadius: 3, padding: '1px 4px' }}
                        />
                        {[360, 540, 720, 1080].map(v => (
                          <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, orthoHeight: v, _orthoHeight: v } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}>{v}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>near/far</span>
                        <input type="number" step={0.1}
                          defaultValue={Number(p.near ?? p._near ?? 1)}
                          key={`cn-${Number(p.near ?? 1)}`}
                          onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, near: v, _near: v } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="near"
                        />
                        <input type="number" step={10}
                          defaultValue={Number(p.far ?? p._far ?? 4096)}
                          key={`cf-${Number(p.far ?? 4096)}`}
                          onBlur={e => { const v = parseFloat(e.target.value) || 4096; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, far: v, _far: v } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 56, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="far"
                        />
                      </div>
                    </>
                  )}
                  {/* R2442: CC2.x zoomRatio */}
                  {!is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>zoomRatio</span>
                      <input type="number" defaultValue={Number(p.zoomRatio ?? p._zoomRatio ?? 1)} min={0.01} step={0.1}
                        onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, zoomRatio: v, _zoomRatio: v } } : c); applyAndSave({ components: u }) }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        title="zoomRatio (CC2.x)"
                      />
                    </div>
                  )}
                  {/* R2449: clearDepth (BatchInspector R2187) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>clearDepth</span>
                    <input type="number" defaultValue={Number(p.clearDepth ?? p._clearDepth ?? 1)} min={0} max={1} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearDepth: v, _clearDepth: v } } : c)
                        applyAndSave({ components: u })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[0, 0.5, 1].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearDepth: v, _clearDepth: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2449: ortho toggle (BatchInspector R2058) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>ortho</span>
                    {([['ort✓', true], ['ort✗', false]] as const).map(([l, v]) => {
                      const cur = !!(p.ortho ?? p._ortho ?? false)
                      return (
                        <span key={l} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, ortho: v, _ortho: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R2449: cullingMask (BatchInspector R1989) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>cullingMask</span>
                    {([['All', -1], ['None', 0], ['Dflt', 1]] as [string, number][]).map(([l, v]) => (
                      <span key={l} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cullingMask: v, _cullingMask: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  {/* R2405: targetDisplay */}
                  {!is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>targetDisp</span>
                      <input type="number" defaultValue={Number(p.targetDisplay ?? p._targetDisplay ?? p._N$targetDisplay ?? 0)} min={0} step={1}
                        onBlur={e => { const v = parseInt(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, targetDisplay: v, _targetDisplay: v, _N$targetDisplay: v } } : c); applyAndSave({ components: u }) }}
                        style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        title="targetDisplay (Camera)"
                      />
                      {[0, 1, 2, 3].map(v => (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, targetDisplay: v, _targetDisplay: v, _N$targetDisplay: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                        >{v}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            // R1579: cc.SkeletalAnimation — CC3.x Quick Edit
            if (comp.type === 'cc.SkeletalAnimation') {
              const speedRatio = Number(p.speedRatio ?? 1)
              const playOnLoad = !!(p.playOnLoad ?? false)
              const defaultClipName = String(p.defaultClipName ?? '')
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2437: enabled (BatchInspector R2221) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {defaultClipName && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      defaultClip: <span style={{ color: '#58a6ff' }}>{defaultClipName}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>speedRatio</span>
                    <input type="number" defaultValue={speedRatio} min={0} step={0.1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedRatio: v, _speedRatio: v, _N$speedRatio: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1814: speedRatio 퀵 프리셋 */}
                    {([0.5, 1, 1.5, 2] as const).map(v => (
                      <span key={v} title={`speedRatio = ×${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedRatio: v, _speedRatio: v, _N$speedRatio: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${speedRatio === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: speedRatio === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >×{v}</span>
                    ))}
                  </div>
                  {/* R2408: wrapMode + loop + defaultCachingMode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>wrapMode</span>
                    {([['Dflt', 1], ['Norm', 2], ['Loop', 3], ['Ping', 4], ['Rev', 8]] as const).map(([l, v]) => {
                      const cur = Number(p.wrapMode ?? p._wrapMode ?? p._N$wrapMode ?? 2)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, wrapMode: v, _wrapMode: v, _N$wrapMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.loop ?? p._loop ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#a78bfa' }}
                      />loop
                    </label>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>cache:</span>
                    {([['RT', 0], ['Sh', 1], ['Pr', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.defaultCachingMode ?? p._defaultCachingMode ?? 0)
                      return (
                        <span key={v} title={['Realtime', 'Shared', 'Private'][v]}
                          onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, defaultCachingMode: v, _defaultCachingMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={playOnLoad}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked, _N$playOnLoad: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />playOnLoad
                  </label>
                </div>
              )
            }
            // R1576: cc.DirectionalLight / cc.PointLight — intensity/color Quick Edit
            if (comp.type === 'cc.DirectionalLight' || comp.type === 'cc.PointLight') {
              const intensity = Number(p.intensity ?? 1)
              const lightColor = p.color as { r?: number; g?: number; b?: number } | undefined
              const hexColor = lightColor
                ? `#${(lightColor.r ?? 255).toString(16).padStart(2, '0')}${(lightColor.g ?? 255).toString(16).padStart(2, '0')}${(lightColor.b ?? 255).toString(16).padStart(2, '0')}`
                : '#ffffff'
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2441: enabled (BatchInspector R2221) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>intensity</span>
                    <input type="range" min={0} max={5} step={0.1} value={intensity}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, intensity: v, _intensity: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{intensity.toFixed(1)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>color</span>
                    <input type="color" value={hexColor}
                      onChange={e => {
                        const hex = e.target.value
                        const r = parseInt(hex.slice(1, 3), 16)
                        const g = parseInt(hex.slice(3, 5), 16)
                        const b = parseInt(hex.slice(5, 7), 16)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 28, height: 18, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{hexColor}</span>
                  </div>
                </div>
              )
            }
            // R1573: cc.UIOpacity — CC3.x opacity Quick Edit
            if (comp.type === 'cc.UIOpacity') {
              const uiOpacity = Number(p.opacity ?? 255)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2437: enabled (BatchInspector R2217) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>opacity</span>
                    <input type="range" min={0} max={255} step={1} value={uiOpacity}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, opacity: v, _opacity: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{uiOpacity}</span>
                  </div>
                  {/* R1794: UIOpacity 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 62 }}>
                    {([0, 64, 128, 192, 255] as const).map(v => (
                      <span key={v} title={`opacity = ${v} (${Math.round(v/255*100)}%)`}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, opacity: v, _opacity: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${uiOpacity === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: uiOpacity === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{Math.round(v/255*100)}%</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R2383: cc.UITransform — priority + anchorPoint 퀵 편집 (CC3.x)
            if (comp.type === 'cc.UITransform') {
              const priority = Number(p.priority ?? p._priority ?? 0)
              const apRaw = p.anchorPoint ?? p._anchorPoint as { x?: number; y?: number } | undefined
              const apx = Number((apRaw as Record<string,number>|undefined)?.x ?? 0.5)
              const apy = Number((apRaw as Record<string,number>|undefined)?.y ?? 0.5)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* priority */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>priority</span>
                    <input type="number" defaultValue={priority} step={1}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, priority: v, _priority: v } } : c)
                        applyAndSave({ components: u })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[-1, 0, 1, 2, 5, 10].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, priority: v, _priority: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${priority === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: priority === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* anchorPoint */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>anchor</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>x</span>
                    <input type="number" defaultValue={apx} min={0} max={1} step={0.1}
                      onBlur={e => {
                        const x = parseFloat(e.target.value) || 0; const ap = { x, y: apy }
                        const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, anchorPoint: ap, _anchorPoint: ap } } : c)
                        applyAndSave({ components: u })
                      }}
                      style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
                    <input type="number" defaultValue={apy} min={0} max={1} step={0.1}
                      onBlur={e => {
                        const y = parseFloat(e.target.value) || 0; const ap = { x: apx, y }
                        const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, anchorPoint: ap, _anchorPoint: ap } } : c)
                        applyAndSave({ components: u })
                      }}
                      style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[['TL',[0,1]],['TC',[0.5,1]],['TR',[1,1]],['CL',[0,0.5]],['CC',[0.5,0.5]],['CR',[1,0.5]],['BL',[0,0]],['BC',[0.5,0]],['BR',[1,0]]].map(([l,v]) => (
                      <span key={l as string} title={`anchor=(${(v as number[])[0]},${(v as number[])[1]})`}
                        onClick={() => { const ap = { x: (v as number[])[0], y: (v as number[])[1] }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, anchorPoint: ap, _anchorPoint: ap } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 7, padding: '1px 2px', cursor: 'pointer', border: `1px solid ${Math.abs(apx-(v as number[])[0])<0.01&&Math.abs(apy-(v as number[])[1])<0.01 ? '#38bdf8' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(apx-(v as number[])[0])<0.01&&Math.abs(apy-(v as number[])[1])<0.01 ? '#38bdf8' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1572: cc.Mask — type/inverted/alphaThreshold Quick Edit
            if (comp.type === 'cc.Mask') {
              const maskType = Number(p._type ?? p.type ?? 0)
              const inverted = !!(p._inverted ?? p.inverted ?? false)
              const alphaThreshold = Number(p._alphaThreshold ?? p.alphaThreshold ?? 0)
              const maskEnabled = !!(p.enabled ?? p._enabled ?? true)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2425: enabled (BatchInspector R2193) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={maskEnabled}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>type</span>
                    <select value={maskType}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _type: v, type: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Rect</option>
                      <option value={1}>Ellipse</option>
                      <option value={2}>Image Stencil</option>
                    </select>
                  </div>
                  {maskType === 2 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>alphaThresh</span>
                      <input type="range" min={0} max={1} step={0.01} value={alphaThreshold}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _alphaThreshold: v, alphaThreshold: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{alphaThreshold.toFixed(2)}</span>
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={inverted}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inverted: e.target.checked, _inverted: e.target.checked, _N$inverted: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />inverted
                  </label>
                </div>
              )
            }
            // R1569: cc.PageView — direction/scrollThreshold/autoPageTurningThreshold Quick Edit
            if (comp.type === 'cc.PageView') {
              const direction = Number(p.direction ?? p._N$direction ?? 0)
              const scrollThreshold = Number(p.scrollThreshold ?? p._N$scrollThreshold ?? 0.5)
              const autoThreshold = Number(p.autoPageTurningThreshold ?? p._N$autoPageTurningThreshold ?? 0.3)
              // R1847: slideDuration
              const slideDuration = Number(p.slideDuration ?? p._N$slideDuration ?? 0.3)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2435: enabled (BatchInspector R2200) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>direction</span>
                    <select value={direction}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v, _direction: v, _N$direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Horizontal</option>
                      <option value={1}>Vertical</option>
                    </select>
                  </div>
                  {/* R1847: slideDuration */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>slideDur</span>
                    <input type="number" defaultValue={slideDuration} key={`sd-${slideDuration}`} min={0} step={0.05}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0.3
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, slideDuration: v, _slideDuration: v, _N$slideDuration: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>s</span>
                    {([0.1, 0.2, 0.3, 0.5] as const).map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, slideDuration: v, _slideDuration: v, _N$slideDuration: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${slideDuration === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: slideDuration === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {[['scrollThreshold', scrollThreshold], ['autoTurning', autoThreshold]].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>{label as string}</span>
                      <input type="range" min={0} max={1} step={0.05} value={val as number}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          const k = label === 'scrollThreshold' ? 'scrollThreshold' : 'autoPageTurningThreshold'
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [k]: v, [`_${k}`]: v, [`_N$${k}`]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{(val as number).toFixed(2)}</span>
                    </div>
                  ))}
                  {/* R2377: pageTurningSpeed + effectType + autoPlay */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>turnSpd</span>
                    <input type="number" defaultValue={Number(p.pageTurningSpeed ?? p._pageTurningSpeed ?? p._N$pageTurningSpeed ?? 0.3)} min={0} step={0.05}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0.3; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pageTurningSpeed: v, _pageTurningSpeed: v, _N$pageTurningSpeed: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="pageTurningSpeed"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>effect</span>
                    {([['NONE', 0], ['SCROLL', 1], ['FADE', 2]] as const).map(([l, v]) => (
                      <span key={v} title={`effectType=${l}(${v})`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, effectType: v, _effectType: v, _N$effectType: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${Number(p.effectType ?? p._N$effectType ?? 0) === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: Number(p.effectType ?? p._N$effectType ?? 0) === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginLeft: 8 }}>
                      <input type="checkbox" checked={!!(p.autoPlay ?? p._autoPlay ?? p._N$autoPlay ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoPlay: e.target.checked, _autoPlay: e.target.checked, _N$autoPlay: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> autoPlay
                    </label>
                  </div>
                  {/* R1901: autoPageTurningInterval (0=비활성) */}
                  {(() => {
                    const interval = Number(p.autoPageTurningInterval ?? p._N$autoPageTurningInterval ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>autoPT sec</span>
                        <input type="number" defaultValue={interval} key={`apt-${interval}`} min={0} step={0.5}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoPageTurningInterval: v, _autoPageTurningInterval: v, _N$autoPageTurningInterval: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>s (0=off)</span>
                        {([0, 1, 2, 3, 5] as const).map(v => (
                          <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoPageTurningInterval: v, _autoPageTurningInterval: v, _N$autoPageTurningInterval: v } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${interval === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: interval === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                          >{v === 0 ? 'off' : v}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2402: pageTurningEventTiming + speedAmplifier */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>evtTiming</span>
                    {([['Start', 0], ['End', 1]] as const).map(([l, v]) => {
                      const cur = Number(p.pageTurningEventTiming ?? p._pageTurningEventTiming ?? p._N$pageTurningEventTiming ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pageTurningEventTiming: v, _pageTurningEventTiming: v, _N$pageTurningEventTiming: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0, marginLeft: 8 }}>speedAmp</span>
                    <input type="number" defaultValue={Number(p.speedAmplifier ?? p._speedAmplifier ?? p._N$speedAmplifier ?? 1)} min={0} step={0.1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedAmplifier: v, _speedAmplifier: v, _N$speedAmplifier: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="speedAmplifier"
                    />
                  </div>
                  {/* R2415: bounceEnabled (BatchInspector R1936) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.bounceEnabled ?? p._bounceEnabled ?? p._N$bounceEnabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceEnabled: e.target.checked, _bounceEnabled: e.target.checked, _N$bounceEnabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0, accentColor: '#34d399' }}
                    />bounceEnabled
                  </label>
                </div>
              )
            }
            // R2349: cc.PageViewIndicator — direction/spacingX/spacingY Quick Edit
            if (comp.type === 'cc.PageViewIndicator') {
              const direction = Number(p.direction ?? p._N$direction ?? 0)
              const spacingX = Number(p.spacingX ?? p._N$spacingX ?? 0)
              const spacingY = Number(p.spacingY ?? p._N$spacingY ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>direction</span>
                    {[['H', 0], ['V', 1]].map(([label, v]) => (
                      <span key={v} onClick={() => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v, _direction: v, _N$direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                        style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${direction === v ? '#34d399' : 'var(--border)'}`, color: direction === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{label}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>spacingX</span>
                    <input type="number" defaultValue={spacingX} key={`pvix-${spacingX}`} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingX: v, _spacingX: v, _N$spacingX: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>spacingY</span>
                    <input type="number" defaultValue={spacingY} key={`pviy-${spacingY}`} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingY: v, _spacingY: v, _N$spacingY: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                </div>
              )
            }
            // R2340: cc.SpotLight — intensity/range/spotAngle Quick Edit
            if (comp.type === 'cc.SpotLight') {
              const intensity = Number(p.intensity ?? 1800)
              const range = Number(p.range ?? 1)
              const spotAngle = Number(p.spotAngle ?? 30)
              const lightColor = p.color as { r?: number; g?: number; b?: number } | undefined
              const hexColor = lightColor
                ? `#${(lightColor.r ?? 255).toString(16).padStart(2, '0')}${(lightColor.g ?? 255).toString(16).padStart(2, '0')}${(lightColor.b ?? 255).toString(16).padStart(2, '0')}`
                : '#ffffff'
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2443: enabled */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>intensity</span>
                    <input type="number" defaultValue={intensity} key={`si-${intensity}`} min={0} step={100}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, intensity: v, _intensity: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 64, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>range</span>
                    <input type="number" defaultValue={range} key={`sr-${range}`} min={0} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, range: v, _range: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 64, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>spotAngle</span>
                    <input type="number" defaultValue={spotAngle} key={`sa-${spotAngle}`} min={0} max={180} step={5}
                      onBlur={e => {
                        const v = Math.max(0, Math.min(180, parseFloat(e.target.value) || 30))
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spotAngle: v, _spotAngle: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 64, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>°</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>color</span>
                    <input type="color" value={hexColor}
                      onChange={e => {
                        const hex = e.target.value
                        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 28, height: 18, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{hexColor}</span>
                  </div>
                </div>
              )
            }
            // R2341: cc.WebView — url/visibleWithMouse Quick Edit
            if (comp.type === 'cc.WebView') {
              const url = String(p.url ?? p._url ?? p._N$url ?? '')
              const visibleWithMouse = !!(p.visibleWithMouse ?? p._N$visibleWithMouse ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2435: enabled (BatchInspector R2220) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>url</span>
                    <input type="text" defaultValue={url} key={`wv-url-${url}`} placeholder="https://..."
                      onBlur={e => {
                        const v = e.target.value.trim()
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, url: v, _url: v, _N$url: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={visibleWithMouse}
                      onChange={e => {
                        const v = e.target.checked
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, visibleWithMouse: v, _N$visibleWithMouse: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#58a6ff' }}
                    />visibleWithMouse
                  </label>
                </div>
              )
            }
            // R1568: cc.Camera — depth/zoomRatio Quick Edit
            if (comp.type === 'cc.Camera') {
              const depth = Number(p.depth ?? 0)
              const zoomRatio = Number(p.zoomRatio ?? 1)
              const fov = Number(p.fov ?? 45)
              const is3x = typeof p.fov !== 'undefined'
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>depth</span>
                    <input type="number" defaultValue={depth} step={1}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, depth: v, _depth: v, _N$depth: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {!is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>zoomRatio</span>
                      <input type="number" defaultValue={zoomRatio} min={0.01} step={0.1}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 1
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, zoomRatio: v, _zoomRatio: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    </div>
                  )}
                  {is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>fov</span>
                      <input type="number" defaultValue={fov} min={1} max={180} step={1}
                        onBlur={e => {
                          const v = Math.max(1, Math.min(180, parseFloat(e.target.value) || 45))
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fov: v, _fov: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>°</span>
                    </div>
                  )}
                  {/* R2365: CC3.x orthoHeight + near/far */}
                  {is3x && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>orthoH</span>
                        <input type="number" min={1} step={10}
                          defaultValue={Number(p.orthoHeight ?? p._orthoHeight ?? 540)}
                          key={`oh-${Number(p.orthoHeight ?? 540)}`}
                          onBlur={e => {
                            const v = Math.max(1, parseFloat(e.target.value) || 540)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, orthoHeight: v, _orthoHeight: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: '#93c5fd', borderRadius: 3, padding: '1px 4px' }}
                        />
                        {[360, 540, 720, 1080].map(v => (
                          <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, orthoHeight: v, _orthoHeight: v } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}>{v}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>near/far</span>
                        <input type="number" step={0.1}
                          defaultValue={Number(p.near ?? p._near ?? 1)}
                          key={`cn-${Number(p.near ?? 1)}`}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 1
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, near: v, _near: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="near"
                        />
                        <input type="number" step={10}
                          defaultValue={Number(p.far ?? p._far ?? 4096)}
                          key={`cf-${Number(p.far ?? 4096)}`}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 4096
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, far: v, _far: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 60, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="far"
                        />
                      </div>
                    </>
                  )}
                  {/* R2412: cullingMask (BatchInspector R1989) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>cullMask</span>
                    {([['All', -1], ['Dflt', 1], ['None', 0]] as const).map(([l, v]) => {
                      const cur = Number(p.cullingMask ?? p._cullingMask ?? -1)
                      return (
                        <span key={l} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cullingMask: v, _cullingMask: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#818cf8' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#818cf8' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                    <input type="number" defaultValue={Number(p.cullingMask ?? p._cullingMask ?? -1)} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || -1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cullingMask: v, _cullingMask: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="cullingMask"
                    />
                  </div>
                  {/* R2412: clearDepth (CC3.x, BatchInspector R2187) */}
                  {is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>clearDepth</span>
                      <input type="number" defaultValue={Number(p.clearDepth ?? p._clearDepth ?? 1)} min={0} max={1} step={0.1}
                        onBlur={e => { const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 1)); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearDepth: v, _clearDepth: v } } : c); applyAndSave({ components: u }) }}
                        style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        title="clearDepth (CC3.x)"
                      />
                      {[0, 0.5, 1].map(v => (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearDepth: v, _clearDepth: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                        >{v}</span>
                      ))}
                    </div>
                  )}
                  {/* R1790: clearFlags + backgroundColor */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>clear</span>
                    {([['Color', 1], ['Depth', 2], ['None', 4]] as const).map(([l, v]) => {
                      const clearFlags = Number(p.clearFlags ?? p._clearFlags ?? 1)
                      return (
                        <span key={l} title={`clearFlags = ${l}`}
                          onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearFlags: v, _clearFlags: v } } : c); applyAndSave({ components: updated }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${clearFlags === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: clearFlags === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {(() => {
                    const bgRaw = p.backgroundColor ?? p._backgroundColor as { r?: number; g?: number; b?: number } | undefined
                    const bgR = (bgRaw as Record<string,number> | undefined)?.r ?? 0
                    const bgG = (bgRaw as Record<string,number> | undefined)?.g ?? 0
                    const bgB = (bgRaw as Record<string,number> | undefined)?.b ?? 0
                    const bgHex = `#${bgR.toString(16).padStart(2,'0')}${bgG.toString(16).padStart(2,'0')}${bgB.toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>bg color</span>
                        <input type="color" value={bgHex}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, backgroundColor: { r, g, b, a: 255 }, _backgroundColor: { r, g, b, a: 255 } } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{bgR},{bgG},{bgB}</span>
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1848: cc.MotionStreak — fade/minSeg/stroke/color 편집
            if (comp.type === 'cc.MotionStreak') {
              const fade = Number(p.fade ?? p._fade ?? p._N$fade ?? 0.5)
              const minSeg = Number(p.minSeg ?? p._minSeg ?? p._N$minSeg ?? 1)
              const stroke = Number(p.stroke ?? p._stroke ?? p._N$stroke ?? 64)
              const fastMode = !!(p.fastMode ?? false)
              const mc = p.color ?? p._N$color as { r?: number; g?: number; b?: number } | undefined
              const mr = (mc as Record<string,number>|undefined)?.r ?? 255
              const mg = (mc as Record<string,number>|undefined)?.g ?? 255
              const mb = (mc as Record<string,number>|undefined)?.b ?? 255
              const mHex = `#${mr.toString(16).padStart(2,'0')}${mg.toString(16).padStart(2,'0')}${mb.toString(16).padStart(2,'0')}`
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2436: enabled (BatchInspector R2200) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>fade</span>
                    <input type="number" defaultValue={fade} key={`mfade-${fade}`} min={0} max={10} step={0.1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0.5; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fade: v, _fade: v, _N$fade: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>s</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>minSeg</span>
                    <input type="number" defaultValue={minSeg} key={`mseg-${minSeg}`} min={0} step={1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, minSeg: v, _minSeg: v, _N$minSeg: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>stroke</span>
                    <input type="number" defaultValue={stroke} key={`mstk-${stroke}`} min={0} step={4}
                      onBlur={e => { const v = parseFloat(e.target.value) || 64; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, stroke: v, _stroke: v, _N$stroke: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>color</span>
                    <input type="color" value={mHex}
                      onChange={e => { const h = e.target.value; const r2 = parseInt(h.slice(1,3),16), g2 = parseInt(h.slice(3,5),16), b2 = parseInt(h.slice(5,7),16); const col = { r: r2, g: g2, b: b2, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 24, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>fastMode</span>
                    <input type="checkbox" checked={fastMode}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fastMode: e.target.checked, _fastMode: e.target.checked, _N$fastMode: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {/* R2374: timeToLive / speedThreshold */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>TTL</span>
                    <input type="number" defaultValue={Number(p.timeToLive ?? p._timeToLive ?? 1)} min={0} step={0.1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeToLive: v, _timeToLive: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="timeToLive (초)"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>spdThr</span>
                    <input type="number" defaultValue={Number(p.speedThreshold ?? p._speedThreshold ?? p._N$speedThreshold ?? 1)} min={0} step={0.5}
                      onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedThreshold: v, _speedThreshold: v, _N$speedThreshold: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="speedThreshold"
                    />
                  </div>
                </div>
              )
            }
            // R1566: cc.ParticleSystem / cc.ParticleSystem2D — Quick Edit
            if (comp.type === 'cc.ParticleSystem' || comp.type === 'cc.ParticleSystem2D') {
              const duration = Number(p.duration ?? -1)
              const maxParticles = Number(p.maxParticles ?? 150)
              const emitRate = Number(p.emissionRate ?? p._emissionRate ?? p._N$emissionRate ?? 10)
              const startSize = Number(p.startSize ?? p._startSize ?? p._N$startSize ?? 50)
              const endSize = Number(p.endSize ?? p._endSize ?? p._N$endSize ?? 0)
              // R1841: speed / speedVar
              const speed = Number(p.speed ?? p._speed ?? p._N$speed ?? 180)
              const speedVar = Number(p.speedVar ?? p._speedVar ?? p._N$speedVar ?? 50)
              // R1844: lifespan / lifespanVar
              const lifespan = Number(p.life ?? p._life ?? p._N$life ?? 1)
              const lifespanVar = Number(p.lifeVar ?? p._lifeVar ?? p._N$lifeVar ?? 0)
              // R1845: gravity
              const grav = p.gravity ?? p._gravity ?? p._N$gravity as { x?: number; y?: number } | undefined
              const gravX = Number((grav as Record<string,number>|undefined)?.x ?? 0)
              const gravY = Number((grav as Record<string,number>|undefined)?.y ?? 0)
              const durKey = comp.type === 'cc.ParticleSystem2D' ? '_N$duration' : '_duration'
              const maxKey = comp.type === 'cc.ParticleSystem2D' ? '_N$totalParticles' : '_N$maxParticles'
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2436: enabled (BatchInspector R2194) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>duration</span>
                    <input type="number" defaultValue={duration} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || -1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, duration: v, [durKey]: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{duration === -1 ? '(loop)' : 's'}</span>
                    {/* R1793: duration 퀵 프리셋 */}
                    {([-1, 0.5, 1, 2, 3] as const).map(v => (
                      <span key={v} title={v === -1 ? 'loop' : `${v}s`}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, duration: v, [durKey]: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${duration === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: duration === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v === -1 ? '∞' : v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>maxParticles</span>
                    <input type="number" defaultValue={maxParticles} min={1} step={10}
                      onBlur={e => {
                        const v = Math.max(1, parseInt(e.target.value) || 150)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxParticles: v, [maxKey]: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 60, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1833: startSize / endSize */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>startSize</span>
                    <input type="number" defaultValue={startSize} key={`ss-${startSize}`} min={0} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startSize: v, _startSize: v, _N$startSize: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>end</span>
                    <input type="number" defaultValue={endSize} key={`es-${endSize}`} min={0} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endSize: v, _endSize: v, _N$endSize: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R2448: startSizeVar / endSizeVar (BatchInspector R2049) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>sizeVar</span>
                    <input type="number" defaultValue={Number(p.startSizeVar ?? p._startSizeVar ?? p._N$startSizeVar ?? 0)} min={0} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startSizeVar: v, _startSizeVar: v, _N$startSizeVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>end</span>
                    <input type="number" defaultValue={Number(p.endSizeVar ?? p._endSizeVar ?? p._N$endSizeVar ?? 0)} min={0} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endSizeVar: v, _endSizeVar: v, _N$endSizeVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1815: emitRate 퀵 프리셋 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>emitRate</span>
                    <input type="number" defaultValue={emitRate} min={0.1} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 10
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, emissionRate: v, _emissionRate: v, _N$emissionRate: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[5, 10, 30, 50, 100, 200].map(v => (
                      <span key={v} title={`emitRate = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, emissionRate: v, _emissionRate: v, _N$emissionRate: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${emitRate === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: emitRate === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1845: gravity x/y */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>gravity</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>x</span>
                    <input type="number" defaultValue={gravX} key={`gx-${gravX}`} step={10}
                      onBlur={e => {
                        const x = parseFloat(e.target.value) || 0
                        const ng = { x, y: gravY }
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravity: ng, _gravity: ng, _N$gravity: ng } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>y</span>
                    <input type="number" defaultValue={gravY} key={`gy-${gravY}`} step={10}
                      onBlur={e => {
                        const y = parseFloat(e.target.value) || 0
                        const ng = { x: gravX, y }
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravity: ng, _gravity: ng, _N$gravity: ng } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1841: speed / speedVar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>speed</span>
                    <input type="number" defaultValue={speed} key={`spd-${speed}`} min={0} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speed: v, _speed: v, _N$speed: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>var</span>
                    <input type="number" defaultValue={speedVar} key={`spdv-${speedVar}`} min={0} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedVar: v, _speedVar: v, _N$speedVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1844: lifespan / lifespanVar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>lifespan</span>
                    <input type="number" defaultValue={lifespan} key={`lf-${lifespan}`} min={0} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, life: v, _life: v, _N$life: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>var</span>
                    <input type="number" defaultValue={lifespanVar} key={`lfv-${lifespanVar}`} min={0} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lifeVar: v, _lifeVar: v, _N$lifeVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>s</span>
                  </div>
                  {/* R1834: startColor / endColor */}
                  {(() => {
                    const sc = p.startColor ?? p._N$startColor as { r?: number; g?: number; b?: number } | undefined
                    const ec = p.endColor ?? p._N$endColor as { r?: number; g?: number; b?: number } | undefined
                    const sr = (sc as Record<string,number>|undefined)?.r ?? 255, sg = (sc as Record<string,number>|undefined)?.g ?? 255, sb = (sc as Record<string,number>|undefined)?.b ?? 255
                    const er = (ec as Record<string,number>|undefined)?.r ?? 255, eg = (ec as Record<string,number>|undefined)?.g ?? 0, eb = (ec as Record<string,number>|undefined)?.b ?? 0
                    const startHex = `#${sr.toString(16).padStart(2,'0')}${sg.toString(16).padStart(2,'0')}${sb.toString(16).padStart(2,'0')}`
                    const endHex = `#${er.toString(16).padStart(2,'0')}${eg.toString(16).padStart(2,'0')}${eb.toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>color S→E</span>
                        <input type="color" value={startHex}
                          onChange={e => {
                            const h = e.target.value; const r2 = parseInt(h.slice(1,3),16), g2 = parseInt(h.slice(3,5),16), b2 = parseInt(h.slice(5,7),16)
                            const col = { r: r2, g: g2, b: b2, a: 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startColor: col, _startColor: col, _N$startColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 24, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
                        <input type="color" value={endHex}
                          onChange={e => {
                            const h = e.target.value; const r2 = parseInt(h.slice(1,3),16), g2 = parseInt(h.slice(3,5),16), b2 = parseInt(h.slice(5,7),16)
                            const col = { r: r2, g: g2, b: b2, a: 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endColor: col, _endColor: col, _N$endColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 24, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1889: speed / speedVar */}
                  {(() => {
                    const speed = Number(p.speed ?? p._speed ?? p._N$speed ?? 180)
                    const speedVar = Number(p.speedVar ?? p._speedVar ?? p._N$speedVar ?? 50)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>speed</span>
                        <input type="number" defaultValue={speed} key={`spd-${speed}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speed: v, _speed: v, _N$speed: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>±var</span>
                        <input type="number" defaultValue={speedVar} key={`spdv-${speedVar}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedVar: v, _speedVar: v, _N$speedVar: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1907: startRadius / endRadius (radial mode) */}
                  {(() => {
                    const startRadius = Number(p.startRadius ?? p._startRadius ?? p._N$startRadius ?? 0)
                    const endRadius = Number(p.endRadius ?? p._endRadius ?? p._N$endRadius ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>startR</span>
                        <input type="number" defaultValue={startRadius} key={`sr-${startRadius}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startRadius: v, _startRadius: v, _N$startRadius: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>endR</span>
                        <input type="number" defaultValue={endRadius} key={`er-${endRadius}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endRadius: v, _endRadius: v, _N$endRadius: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2448: startRadiusVar / endRadiusVar (BatchInspector — Radius mode) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>startRVar</span>
                    <input type="number" defaultValue={Number(p.startRadiusVar ?? p._startRadiusVar ?? p._N$startRadiusVar ?? 0)} min={0} step={10}
                      onBlur={e => {
                        const v = Math.max(0, parseFloat(e.target.value) || 0)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startRadiusVar: v, _startRadiusVar: v, _N$startRadiusVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>endRVar</span>
                    <input type="number" defaultValue={Number(p.endRadiusVar ?? p._endRadiusVar ?? p._N$endRadiusVar ?? 0)} min={0} step={10}
                      onBlur={e => {
                        const v = Math.max(0, parseFloat(e.target.value) || 0)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endRadiusVar: v, _endRadiusVar: v, _N$endRadiusVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1905: radialAccel / tangentialAccel */}
                  {(() => {
                    const radialAccel = Number(p.radialAccel ?? p._radialAccel ?? p._N$radialAccel ?? 0)
                    const tangentialAccel = Number(p.tangentialAccel ?? p._tangentialAccel ?? p._N$tangentialAccel ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>radialAccel</span>
                        <input type="number" defaultValue={radialAccel} key={`ra-${radialAccel}`} step={10}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, radialAccel: v, _radialAccel: v, _N$radialAccel: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>tan</span>
                        <input type="number" defaultValue={tangentialAccel} key={`ta-${tangentialAccel}`} step={10}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tangentialAccel: v, _tangentialAccel: v, _N$tangentialAccel: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2448: radialAccelVar / tangentialAccelVar (BatchInspector R2050/R2051) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>rAccelVar</span>
                    <input type="number" defaultValue={Number(p.radialAccelVar ?? p._radialAccelVar ?? p._N$radialAccelVar ?? 0)} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, radialAccelVar: v, _radialAccelVar: v, _N$radialAccelVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>tanVar</span>
                    <input type="number" defaultValue={Number(p.tangentialAccelVar ?? p._tangentialAccelVar ?? p._N$tangentialAccelVar ?? 0)} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tangentialAccelVar: v, _tangentialAccelVar: v, _N$tangentialAccelVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1887: angle / angleVar */}
                  {(() => {
                    const angle = Number(p.angle ?? p._angle ?? p._N$angle ?? 90)
                    const angleVar = Number(p.angleVar ?? p._angleVar ?? p._N$angleVar ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>angle</span>
                        <input type="number" defaultValue={angle} key={`ang-${angle}`} step={1}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 90
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angle: v, _angle: v, _N$angle: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>°</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>±var</span>
                        <input type="number" defaultValue={angleVar} key={`angv-${angleVar}`} min={0} step={1}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angleVar: v, _angleVar: v, _N$angleVar: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1913: posVar x / y */}
                  {(() => {
                    const posVarRaw = p.posVar ?? p._posVar ?? p._N$posVar as Record<string,number> | undefined
                    const pvx = Number((posVarRaw as Record<string,number>|undefined)?.x ?? 0)
                    const pvy = Number((posVarRaw as Record<string,number>|undefined)?.y ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>posVar x</span>
                        <input type="number" defaultValue={pvx} key={`pvx-${pvx}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, posVar: { x: v, y: pvy }, _posVar: { x: v, y: pvy }, _N$posVar: { x: v, y: pvy } } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 14, flexShrink: 0, marginLeft: 4 }}>y</span>
                        <input type="number" defaultValue={pvy} key={`pvy-${pvy}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, posVar: { x: pvx, y: v }, _posVar: { x: pvx, y: v }, _N$posVar: { x: pvx, y: v } } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1937: startSpin / startSpinVar */}
                  {(() => {
                    const startSpin = Number(p.startSpin ?? p._startSpin ?? p._N$startSpin ?? 0)
                    const startSpinVar = Number(p.startSpinVar ?? p._startSpinVar ?? p._N$startSpinVar ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>startSpin</span>
                        <input type="number" defaultValue={startSpin} key={`ss-${startSpin}`} step={10}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startSpin: v, _startSpin: v, _N$startSpin: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>var</span>
                        <input type="number" defaultValue={startSpinVar} key={`ssv-${startSpinVar}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startSpinVar: v, _startSpinVar: v, _N$startSpinVar: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1938: endSpin / endSpinVar */}
                  {(() => {
                    const endSpin = Number(p.endSpin ?? p._endSpin ?? p._N$endSpin ?? 0)
                    const endSpinVar = Number(p.endSpinVar ?? p._endSpinVar ?? p._N$endSpinVar ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>endSpin</span>
                        <input type="number" defaultValue={endSpin} key={`es-${endSpin}`} step={10}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endSpin: v, _endSpin: v, _N$endSpin: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>var</span>
                        <input type="number" defaultValue={endSpinVar} key={`esv-${endSpinVar}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endSpinVar: v, _endSpinVar: v, _N$endSpinVar: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2384: sourcePos x/y */}
                  {(() => {
                    const spRaw = p.sourcePos ?? p._sourcePos ?? p._N$sourcePos as Record<string,number> | undefined
                    const spx = Number((spRaw as Record<string,number>|undefined)?.x ?? 0)
                    const spy = Number((spRaw as Record<string,number>|undefined)?.y ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>sourcePos</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>x</span>
                        <input type="number" defaultValue={spx} key={`spx-${spx}`} step={10}
                          onBlur={e => {
                            const x = parseFloat(e.target.value) || 0
                            const np = { x, y: spy }
                            const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sourcePos: np, _sourcePos: np, _N$sourcePos: np } } : c)
                            applyAndSave({ components: u })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
                        <input type="number" defaultValue={spy} key={`spy-${spy}`} step={10}
                          onBlur={e => {
                            const y = parseFloat(e.target.value) || 0
                            const np = { x: spx, y }
                            const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sourcePos: np, _sourcePos: np, _N$sourcePos: np } } : c)
                            applyAndSave({ components: u })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        {[0, 50, 100, -50, -100].map(v => (
                          <span key={v} onClick={() => { const np = { x: v, y: spy }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sourcePos: np, _sourcePos: np, _N$sourcePos: np } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '1px 2px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                          >{v}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2382: simulationSpace + rotationIsDir */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>simSpace</span>
                    {([['World', 0], ['Local', 1]] as const).map(([l, v]) => (
                      <span key={v} title={`simulationSpace=${l}(${v})`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, simulationSpace: v, _simulationSpace: v, _N$simulationSpace: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${Number(p.simulationSpace ?? p._N$simulationSpace ?? 0) === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: Number(p.simulationSpace ?? p._N$simulationSpace ?? 0) === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginLeft: 8 }}>
                      <input type="checkbox" checked={!!(p.rotationIsDir ?? p._rotationIsDir ?? p._N$rotationIsDir ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, rotationIsDir: e.target.checked, _rotationIsDir: e.target.checked, _N$rotationIsDir: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      />rotIsDir
                    </label>
                  </div>
                  {/* R1924: startColor / startColorVar */}
                  {(() => {
                    const scRaw = p.startColor as { r?: number; g?: number; b?: number } | undefined
                    const scHex = `#${((scRaw?.r ?? 255)).toString(16).padStart(2,'0')}${((scRaw?.g ?? 255)).toString(16).padStart(2,'0')}${((scRaw?.b ?? 255)).toString(16).padStart(2,'0')}`
                    const ecRaw = p.endColor as { r?: number; g?: number; b?: number } | undefined
                    const ecHex = `#${((ecRaw?.r ?? 255)).toString(16).padStart(2,'0')}${((ecRaw?.g ?? 255)).toString(16).padStart(2,'0')}${((ecRaw?.b ?? 255)).toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>startColor</span>
                        <input type="color" value={scHex} key={`sc-${scHex}`}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const col = { r, g, b, a: scRaw?.a ?? 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startColor: col, _startColor: col, _N$startColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>end</span>
                        <input type="color" value={ecHex} key={`ec-${ecHex}`}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const col = { r, g, b, a: ecRaw?.a ?? 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endColor: col, _endColor: col, _N$endColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2448: startColorVar / endColorVar (BatchInspector PS color variation) */}
                  {(() => {
                    const scvRaw = p.startColorVar as { r?: number; g?: number; b?: number; a?: number } | undefined
                    const ecvRaw = p.endColorVar as { r?: number; g?: number; b?: number; a?: number } | undefined
                    const scvHex = `#${((scvRaw?.r ?? 0)).toString(16).padStart(2,'0')}${((scvRaw?.g ?? 0)).toString(16).padStart(2,'0')}${((scvRaw?.b ?? 0)).toString(16).padStart(2,'0')}`
                    const ecvHex = `#${((ecvRaw?.r ?? 0)).toString(16).padStart(2,'0')}${((ecvRaw?.g ?? 0)).toString(16).padStart(2,'0')}${((ecvRaw?.b ?? 0)).toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>colorVar S</span>
                        <input type="color" value={scvHex} key={`scv-${scvHex}`}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const col = { r, g, b, a: scvRaw?.a ?? 0 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startColorVar: col, _startColorVar: col, _N$startColorVar: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>E</span>
                        <input type="color" value={ecvHex} key={`ecv-${ecvHex}`}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const col = { r, g, b, a: ecvRaw?.a ?? 0 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endColorVar: col, _endColorVar: col, _N$endColorVar: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2448: rotatePerS / rotatePerSVar (BatchInspector — Radius mode) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>rotPerS</span>
                    <input type="number" defaultValue={Number(p.rotatePerS ?? p._rotatePerS ?? p._N$rotatePerS ?? 0)} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, rotatePerS: v, _rotatePerS: v, _N$rotatePerS: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>var</span>
                    <input type="number" defaultValue={Number(p.rotatePerSVar ?? p._rotatePerSVar ?? p._N$rotatePerSVar ?? 0)} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, rotatePerSVar: v, _rotatePerSVar: v, _N$rotatePerSVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R2448: startRotation / startRotationVar + endRotation / endRotationVar (BatchInspector — Radius mode) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>startRot</span>
                    <input type="number" defaultValue={Number(p.startRotation ?? p._startRotation ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startRotation: v, _startRotation: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>var</span>
                    <input type="number" defaultValue={Number(p.startRotationVar ?? p._startRotationVar ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startRotationVar: v, _startRotationVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>endRot</span>
                    <input type="number" defaultValue={Number(p.endRotation ?? p._endRotation ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endRotation: v, _endRotation: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 40, flexShrink: 0, marginLeft: 4 }}>var</span>
                    <input type="number" defaultValue={Number(p.endRotationVar ?? p._endRotationVar ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endRotationVar: v, _endRotationVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R2421: emitterMode + autoRemoveOnFinish (BatchInspector R1981/R1979) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>emitMode</span>
                    {([['Grav', 0], ['Rad', 1]] as const).map(([l, v]) => {
                      const cur = Number(p.emitterMode ?? p._emitterMode ?? p._N$emitterMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, emitterMode: v, _emitterMode: v, _N$emitterMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginLeft: 8 }}>
                      <input type="checkbox" checked={!!(p.autoRemoveOnFinish ?? p._autoRemoveOnFinish ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoRemoveOnFinish: e.target.checked, _autoRemoveOnFinish: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0 }}
                      />autoRm
                    </label>
                  </div>
                  {/* R2440: loop + positionType + blendMode (BatchInspector R1932/R1976/R1977) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>loop</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.loop ?? p._loop ?? p._N$loop ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0 }}
                      />on
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>posType</span>
                    {([['Free', 0], ['Rel', 1], ['Grp', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.positionType ?? p._positionType ?? p._N$positionType ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, positionType: v, _positionType: v, _N$positionType: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>blend</span>
                    {([['Norm', 770, 771], ['Add', 770, 1], ['Mul', 774, 771]] as [string, number, number][]).map(([l, src, dst]) => {
                      const curSrc = Number(p.srcBlendFactor ?? p._srcBlendFactor ?? p._N$srcBlendFactor ?? 770)
                      const curDst = Number(p.dstBlendFactor ?? p._dstBlendFactor ?? p._N$dstBlendFactor ?? 771)
                      const active = curSrc === src && curDst === dst
                      return (
                        <span key={l} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, srcBlendFactor: src, _srcBlendFactor: src, _N$srcBlendFactor: src, dstBlendFactor: dst, _dstBlendFactor: dst, _N$dstBlendFactor: dst } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${active ? '#4ade80' : 'var(--border)'}`, borderRadius: 2, color: active ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                </div>
              )
            }
            // R1564: cc.ScrollView — horizontal/vertical/inertia/elastic Quick Edit
            if (comp.type === 'cc.ScrollView') {
              const horizontal = !!(p.horizontal ?? p._N$horizontal ?? false)
              const vertical = !!(p.vertical ?? p._N$vertical ?? true)
              const inertia = !!(p.inertia ?? p._N$inertia ?? true)
              const elastic = !!(p.elastic ?? p._N$elastic ?? true)
              const brake = Number(p.brake ?? p._N$brake ?? 0.75)
              // R1740: content 자식 노드 찾기 (이름 'content', 대소문자 무시)
              function findContentNode(n: CCSceneNode): CCSceneNode | null {
                for (const ch of n.children) {
                  if (ch.name.toLowerCase() === 'content') return ch
                  const found = findContentNode(ch)
                  if (found) return found
                }
                return null
              }
              const contentNode = findContentNode(draft)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2438: enabled (BatchInspector R2193) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      ['horizontal', horizontal, 'horizontal'],
                      ['vertical', vertical, 'vertical'],
                      ['inertia', inertia, 'inertia'],
                      ['elastic', elastic, 'elastic'],
                      /* R2450: bounce (BatchInspector R2065 — CC3.x) */
                      ['bounce', !!(p.bounce ?? p._bounce ?? p._N$bounce ?? false), 'bounce'],
                    ].map(([label, val, key]) => (
                      <label key={key as string} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={val as boolean}
                          onChange={e => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: e.target.checked, [`_${key as string}`]: e.target.checked, [`_N$${key as string}`]: e.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }}
                        />{label as string}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>brake</span>
                    <input type="range" min={0} max={1} step={0.05} value={brake}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, brake: v, _brake: v, _N$brake: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{brake.toFixed(2)}</span>
                  </div>
                  {/* R1784: brake 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 60 }}>
                    {[0, 0.5, 0.75, 1].map(v => (
                      <span key={v} title={`brake = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, brake: v, _brake: v, _N$brake: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(brake - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(brake - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1831: elasticDuration 편집 */}
                  {(() => {
                    const ed = Number(p.elasticDuration ?? p._N$elasticDuration ?? 0.2)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>elasticDur</span>
                        <input type="number" defaultValue={ed} key={`ed-${ed}`} min={0} max={2} step={0.05}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0.2)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, elasticDuration: v, _elasticDuration: v, _N$elasticDuration: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        {([0, 0.1, 0.2, 0.5, 1] as const).map(v => (
                          <span key={v} title={`elasticDuration = ${v}s`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, elasticDuration: v, _elasticDuration: v, _N$elasticDuration: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${Math.abs(ed - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(ed - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                          >{v}s</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2379: bounceTime + mouseWheelScrollSensitivity + hideScrollBar */}
                  {/* R2424: bounceDuration (CC2.x, BatchInspector R1949) */}
                  {(() => {
                    const bounceTime = Number(p.bounceTime ?? p._bounceTime ?? p._N$bounceTime ?? 1)
                    const bounceDuration = Number(p.bounceDuration ?? p._bounceDuration ?? p._N$bounceDuration ?? 0.2)
                    const mwSens = Number(p.mouseWheelScrollSensitivity ?? p._mouseWheelScrollSensitivity ?? p._N$mouseWheelScrollSensitivity ?? 3.5)
                    const hideBar = !!(p.hideScrollBar ?? p._hideScrollBar ?? p._N$hideScrollBar ?? false)
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>bounceT</span>
                          <input type="number" defaultValue={bounceTime} key={`bt-${bounceTime}`} min={0} step={0.1}
                            onBlur={e => { const v = Math.max(0, parseFloat(e.target.value) || 1); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceTime: v, _bounceTime: v, _N$bounceTime: v } } : c); applyAndSave({ components: u }) }}
                            style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                            title="bounceTime (CC3.x)"
                          />
                          {[0.1, 0.3, 0.5, 1].map(v => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceTime: v, _bounceTime: v, _N$bounceTime: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(bounceTime - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(bounceTime - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                            >{v}s</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>bounceDur</span>
                          <input type="number" defaultValue={bounceDuration} key={`bd-${bounceDuration}`} min={0} step={0.05}
                            onBlur={e => { const v = Math.max(0, parseFloat(e.target.value) || 0.2); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceDuration: v, _bounceDuration: v, _N$bounceDuration: v } } : c); applyAndSave({ components: u }) }}
                            style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                            title="bounceDuration (CC2.x)"
                          />
                          {[0.1, 0.2, 0.4, 0.8].map(v => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceDuration: v, _bounceDuration: v, _N$bounceDuration: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(bounceDuration - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(bounceDuration - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                            >{v}s</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>mwSens</span>
                          <input type="number" defaultValue={mwSens} key={`mws-${mwSens}`} min={0} step={0.5}
                            onBlur={e => { const v = parseFloat(e.target.value) || 3.5; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mouseWheelScrollSensitivity: v, _mouseWheelScrollSensitivity: v, _N$mouseWheelScrollSensitivity: v } } : c); applyAndSave({ components: u }) }}
                            style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                            title="mouseWheelScrollSensitivity"
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginLeft: 8 }}>
                            <input type="checkbox" checked={hideBar}
                              onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, hideScrollBar: e.target.checked, _hideScrollBar: e.target.checked, _N$hideScrollBar: e.target.checked } } : c); applyAndSave({ components: u }) }}
                            />hideBar
                          </label>
                        </div>
                      </>
                    )
                  })()}
                  {/* R2360: pagingEnabled + cancelInnerEvents + scrollDuration */}
                  {(() => {
                    const paging = !!(p.pagingEnabled ?? p._pagingEnabled ?? p._N$pagingEnabled ?? false)
                    const cancelInner = !!(p.cancelInnerEvents ?? p._cancelInnerEvents ?? p._N$cancelInnerEvents ?? true)
                    const scrollDur = Number(p.scrollDuration ?? p._scrollDuration ?? p._N$scrollDuration ?? 0.2)
                    return (
                      <>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                            <input type="checkbox" checked={paging}
                              onChange={e => {
                                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pagingEnabled: e.target.checked, _pagingEnabled: e.target.checked, _N$pagingEnabled: e.target.checked } } : c)
                                applyAndSave({ components: updated })
                              }}
                            />paging
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                            <input type="checkbox" checked={cancelInner}
                              onChange={e => {
                                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cancelInnerEvents: e.target.checked, _cancelInnerEvents: e.target.checked, _N$cancelInnerEvents: e.target.checked } } : c)
                                applyAndSave({ components: updated })
                              }}
                            />cancelInner
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>scrollDur</span>
                          <input type="number" min={0} step={0.05} defaultValue={scrollDur} key={`sd-${scrollDur}`}
                            onBlur={e => {
                              const v = Math.max(0, parseFloat(e.target.value) || 0.2)
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, scrollDuration: v, _scrollDuration: v, _N$scrollDuration: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          />
                          {[0, 0.1, 0.2, 0.5, 1].map(v => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, scrollDuration: v, _scrollDuration: v, _N$scrollDuration: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(scrollDur - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(scrollDur - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                            >{v}s</span>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                  {/* R2413: speedAmplifier (BatchInspector R1980) */}
                  {(() => {
                    const speed = Number(p.speedAmplifier ?? p._speedAmplifier ?? p._N$speedAmplifier ?? 1)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>speedAmp</span>
                        <input type="number" defaultValue={speed} key={`sa-${speed}`} min={0} step={0.1}
                          onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedAmplifier: v, _speedAmplifier: v, _N$speedAmplifier: v } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="speedAmplifier"
                        />
                        {([0.5, 1, 1.5, 2, 3] as const).map(v => (
                          <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedAmplifier: v, _speedAmplifier: v, _N$speedAmplifier: v } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(speed - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(speed - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                          >{v}x</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R1740: content 자식 노드 크기 퀵 편집 */}
                  {contentNode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 3 }}>
                      <span style={{ fontSize: 9, color: '#34d399', flexShrink: 0 }}>content</span>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>W</span>
                      <input type="number" defaultValue={Math.round(contentNode.size.x)}
                        key={`sv-cw-${contentNode.uuid}`}
                        onBlur={e => {
                          const v = parseFloat(e.target.value)
                          if (isNaN(v) || !sceneFile?.root) return
                          function patchContent(n: CCSceneNode): CCSceneNode {
                            if (n.uuid === contentNode!.uuid) return { ...n, size: { ...n.size, x: v } }
                            return { ...n, children: n.children.map(patchContent) }
                          }
                          saveScene(patchContent(sceneFile.root))
                        }}
                        style={{ width: 50, fontSize: 9, padding: '1px 3px', background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                      />
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>H</span>
                      <input type="number" defaultValue={Math.round(contentNode.size.y)}
                        key={`sv-ch-${contentNode.uuid}`}
                        onBlur={e => {
                          const v = parseFloat(e.target.value)
                          if (isNaN(v) || !sceneFile?.root) return
                          function patchContent(n: CCSceneNode): CCSceneNode {
                            if (n.uuid === contentNode!.uuid) return { ...n, size: { ...n.size, y: v } }
                            return { ...n, children: n.children.map(patchContent) }
                          }
                          saveScene(patchContent(sceneFile.root))
                        }}
                        style={{ width: 50, fontSize: 9, padding: '1px 3px', background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                      />
                    </div>
                  )}
                </div>
              )
            }
            // R2342: cc.Scrollbar — direction/enableAutoHide/autoHideTime Quick Edit
            if (comp.type === 'cc.Scrollbar') {
              const direction = Number(p.direction ?? p._direction ?? p._N$direction ?? 1)
              const enableAutoHide = !!(p.enableAutoHide ?? p._enableAutoHide ?? p._N$enableAutoHide ?? false)
              const autoHideTime = Number(p.autoHideTime ?? p._autoHideTime ?? p._N$autoHideTime ?? 1)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2430: enabled (BatchInspector R2198) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>direction</span>
                    {[['H', 0], ['V', 1]].map(([label, v]) => (
                      <span key={v} onClick={() => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v, _direction: v, _N$direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                        style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${direction === v ? '#34d399' : 'var(--border)'}`, color: direction === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{label}</span>
                    ))}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={enableAutoHide}
                      onChange={e => {
                        const v = e.target.checked
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableAutoHide: v, _enableAutoHide: v, _N$enableAutoHide: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#58a6ff' }}
                    />enableAutoHide
                  </label>
                  {enableAutoHide && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>autoHideTime</span>
                      <input type="number" defaultValue={autoHideTime} key={`sb-aht-${autoHideTime}`} min={0} step={0.1}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 1
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoHideTime: v, _autoHideTime: v, _N$autoHideTime: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>s</span>
                    </div>
                  )}
                </div>
              )
            }
            // R1556: cc.TiledMap / cc.TiledLayer Quick Edit
            if (comp.type === 'cc.TiledMap') {
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    tmxFile: <span style={{ color: '#58a6ff' }}>{typeof p.tmxFile === 'object' && p.tmxFile ? JSON.stringify(p.tmxFile).slice(0, 40) : String(p.tmxFile ?? '(없음)')}</span>
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.TiledLayer') {
              const layerName = String(p.layerName ?? '')
              const visible = !!(p.visible ?? true)
              const layerOpacity = Number(p.opacity ?? 1)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2441: enabled (BatchInspector R2222) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>layerName</span>
                    <input type="text" defaultValue={layerName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, layerName: e.target.value, _layerName: e.target.value, _N$layerName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>opacity</span>
                    <input type="number" defaultValue={layerOpacity} min={0} max={1} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, opacity: parseFloat(e.target.value) || 1, _opacity: parseFloat(e.target.value) || 1, _N$opacity: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={visible}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, visible: e.target.checked, _visible: e.target.checked, _N$visible: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#4ade80' }}
                    />visible
                  </label>
                </div>
              )
            }
            // R1591/R1813: cc.BoxCollider/BoxCollider2D + cc.CircleCollider/CircleCollider2D Quick Edit (applyAndSave)
            if (comp.type === 'cc.BoxCollider' || comp.type === 'cc.BoxCollider2D') {
              const off = p.offset as { x?: number; y?: number } | undefined
              const sz = p.size as { width?: number; height?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2439: enabled (BatchInspector R2218) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset X</label>
                      <input type="number" defaultValue={Number(off?.x ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), x: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset Y</label>
                      <input type="number" defaultValue={Number(off?.y ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), y: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>width</label>
                      <input type="number" min={0} defaultValue={Number(sz?.width ?? 100)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newSz = { ...(sz ?? {}), width: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, size: newSz, _size: newSz, _N$size: newSz } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>height</label>
                      <input type="number" min={0} defaultValue={Number(sz?.height ?? 100)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newSz = { ...(sz ?? {}), height: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, size: newSz, _size: newSz, _N$size: newSz } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <input type="checkbox" checked={!!(p.sensor ?? false)}
                      onChange={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sensor: ev.target.checked, _sensor: ev.target.checked, _N$sensor: ev.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }} />
                    sensor
                  </label>
                  {/* R1849: friction / restitution */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 2 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>friction</label>
                      <input type="number" defaultValue={Number(p.friction ?? 0.2)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, friction: v, _friction: v, _N$friction: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>restitution</label>
                      <input type="number" defaultValue={Number(p.restitution ?? 0)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, restitution: v, _restitution: v, _N$restitution: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    {/* R2367: density */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>density</label>
                      <input type="number" defaultValue={Number(p.density ?? p._density ?? 1)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, density: v, _density: v, _N$density: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                  </div>
                  {/* R2391: category + mask */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>category</label>
                    <input type="number" defaultValue={Number(p.category ?? p._category ?? p._N$category ?? 1)} min={0} step={1}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, category: v, _category: v, _N$category: v } } : c); applyAndSave({ components: u }) }}
                    />
                    <label style={{ fontSize: 10, width: 30, flexShrink: 0 }}>mask</label>
                    <input type="number" defaultValue={Number(p.mask ?? p._mask ?? p._N$mask ?? -1)} step={1}
                      style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) ?? -1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mask: v, _mask: v, _N$mask: v } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {/* R2401: tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>tag</label>
                    <input type="number" defaultValue={Number(p.tag ?? p._tag ?? 0)} min={0} step={1}
                      style={{ width: 44, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[0,1,2,3,4].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.CircleCollider' || comp.type === 'cc.CircleCollider2D') {
              const off = p.offset as { x?: number; y?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2439: enabled (BatchInspector R2220) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset X</label>
                      <input type="number" defaultValue={Number(off?.x ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), x: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset Y</label>
                      <input type="number" defaultValue={Number(off?.y ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), y: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>radius</label>
                      <input type="number" min={0} defaultValue={Number(p.radius ?? 50)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, radius: v, _radius: v, _N$radius: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <input type="checkbox" checked={!!(p.sensor ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sensor: ev.target.checked, _sensor: ev.target.checked, _N$sensor: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        sensor
                      </label>
                    </div>
                  </div>
                  {/* R1850: friction / restitution */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 2 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>friction</label>
                      <input type="number" defaultValue={Number(p.friction ?? 0.2)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, friction: v, _friction: v, _N$friction: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>restitution</label>
                      <input type="number" defaultValue={Number(p.restitution ?? 0)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, restitution: v, _restitution: v, _N$restitution: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    {/* R2367: density */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>density</label>
                      <input type="number" defaultValue={Number(p.density ?? p._density ?? 1)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, density: v, _density: v, _N$density: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                  </div>
                  {/* R2391: category + mask */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>category</label>
                    <input type="number" defaultValue={Number(p.category ?? p._category ?? p._N$category ?? 1)} min={0} step={1}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, category: v, _category: v, _N$category: v } } : c); applyAndSave({ components: u }) }}
                    />
                    <label style={{ fontSize: 10, width: 30, flexShrink: 0 }}>mask</label>
                    <input type="number" defaultValue={Number(p.mask ?? p._mask ?? p._N$mask ?? -1)} step={1}
                      style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) ?? -1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mask: v, _mask: v, _N$mask: v } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {/* R2401: tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>tag</label>
                    <input type="number" defaultValue={Number(p.tag ?? p._tag ?? 0)} min={0} step={1}
                      style={{ width: 44, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[0,1,2,3,4].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1870: cc.PolygonCollider — sensor / friction / restitution 편집
            if (comp.type === 'cc.PolygonCollider' || comp.type === 'cc.PolygonCollider2D') {
              const off = p.offset as { x?: number; y?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2439: enabled (BatchInspector R2220) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset X</label>
                      <input type="number" defaultValue={Number(off?.x ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), x: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset Y</label>
                      <input type="number" defaultValue={Number(off?.y ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), y: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginBottom: 4 }}>
                    <input type="checkbox" checked={!!(p.sensor ?? false)}
                      onChange={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sensor: ev.target.checked, _sensor: ev.target.checked, _N$sensor: ev.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }} />
                    sensor
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>friction</label>
                      <input type="number" defaultValue={Number(p.friction ?? 0.2)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, friction: v, _friction: v, _N$friction: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>restitution</label>
                      <input type="number" defaultValue={Number(p.restitution ?? 0)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, restitution: v, _restitution: v, _N$restitution: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    {/* R2367: density */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>density</label>
                      <input type="number" defaultValue={Number(p.density ?? p._density ?? 1)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, density: v, _density: v, _N$density: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                  </div>
                  {/* R2368: PolygonCollider threshold */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 11, flexShrink: 0, width: 60 }}>threshold</label>
                    <input type="number" defaultValue={Number(p.threshold ?? p._threshold ?? 1)} min={0} step={0.5}
                      style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseFloat(ev.target.value) ?? 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, threshold: v, _threshold: v, _N$threshold: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[0.5, 1, 2, 5].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, threshold: v, _threshold: v, _N$threshold: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2391: category + mask */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>category</label>
                    <input type="number" defaultValue={Number(p.category ?? p._category ?? p._N$category ?? 1)} min={0} step={1}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, category: v, _category: v, _N$category: v } } : c); applyAndSave({ components: u }) }}
                    />
                    <label style={{ fontSize: 10, width: 30, flexShrink: 0 }}>mask</label>
                    <input type="number" defaultValue={Number(p.mask ?? p._mask ?? p._N$mask ?? -1)} step={1}
                      style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) ?? -1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mask: v, _mask: v, _N$mask: v } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {/* R2401: tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>tag</label>
                    <input type="number" defaultValue={Number(p.tag ?? p._tag ?? 0)} min={0} step={1}
                      style={{ width: 44, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[0,1,2,3,4].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1551: cc.RigidBody — 물리 강체 Quick Edit
            if (comp.type === 'cc.RigidBody' || comp.type === 'cc.RigidBody2D') {
              const rbTypes = ['DYNAMIC', 'STATIC', 'KINEMATIC']
              const rbType = Number(p.type ?? 0)
              const mass = Number(p.mass ?? 1)
              const linearDamping = Number(p.linearDamping ?? 0)
              const angularDamping = Number(p.angularDamping ?? 0)
              const gravityScale = Number(p.gravityScale ?? 1)
              const fixedRotation = !!(p.fixedRotation ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2438: enabled (BatchInspector R2217) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>type</span>
                    <select defaultValue={rbType}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: parseInt(e.target.value), _type: parseInt(e.target.value), _N$type: parseInt(e.target.value) } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      {rbTypes.map((t, i) => <option key={i} value={i}>{t}</option>)}
                    </select>
                  </div>
                  {/* R1843: type 퀵 버튼 */}
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}></span>
                    {rbTypes.map((t, v) => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: v, _type: v, _N$type: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${rbType === v ? '#34d399' : 'var(--border)'}`, color: rbType === v ? '#34d399' : 'var(--text-muted)', background: 'var(--bg-primary)' }}
                      >{t[0]}{t.slice(1,3).toLowerCase()}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>mass</span>
                    <input type="number" defaultValue={mass} min={0} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mass: parseFloat(e.target.value) || 1, _mass: parseFloat(e.target.value) || 1, _N$mass: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>gravityScale</span>
                    <input type="number" defaultValue={gravityScale} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravityScale: parseFloat(e.target.value) || 1, _gravityScale: parseFloat(e.target.value) || 1, _N$gravityScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1817: gravityScale 퀵 프리셋 */}
                    {([0, 0.5, 1, 2] as const).map(v => (
                      <span key={v} title={`gravityScale = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravityScale: v, _gravityScale: v, _N$gravityScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${gravityScale === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: gravityScale === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>linearDamp</span>
                    <input type="number" defaultValue={linearDamping} min={0} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearDamping: parseFloat(e.target.value) || 0, _linearDamping: parseFloat(e.target.value) || 0, _N$linearDamping: parseFloat(e.target.value) || 0 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1829: linearDamping 퀵 프리셋 */}
                    {([0, 0.1, 0.5, 1, 5] as const).map(v => (
                      <span key={v} title={`linearDamping = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearDamping: v, _linearDamping: v, _N$linearDamping: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${linearDamping === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: linearDamping === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1830: angularDamping 편집 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>angularDamp</span>
                    <input type="number" defaultValue={angularDamping} min={0} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angularDamping: parseFloat(e.target.value) || 0, _angularDamping: parseFloat(e.target.value) || 0, _N$angularDamping: parseFloat(e.target.value) || 0 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {([0, 0.1, 1, 5] as const).map(v => (
                      <span key={v} title={`angularDamping = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angularDamping: v, _angularDamping: v, _N$angularDamping: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${angularDamping === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: angularDamping === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2390: group + rotationOffset */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>group</span>
                    <input type="number" defaultValue={Number(p.group ?? p._group ?? p._N$group ?? 0)} step={1} min={0}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={e => { const v = parseInt(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, group: v, _group: v, _N$group: v } } : c); applyAndSave({ components: u }) }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>rotOff</span>
                    <input type="number" defaultValue={Number(p.rotationOffset ?? p._rotationOffset ?? p._N$rotationOffset ?? 0)} step={1}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, rotationOffset: v, _rotationOffset: v, _N$rotationOffset: v } } : c); applyAndSave({ components: u }) }}
                      title="rotationOffset"
                    />
                  </div>
                  {/* R2366: fixedRotation + bullet + allowSleep */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={fixedRotation}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fixedRotation: e.target.checked, _fixedRotation: e.target.checked, _N$fixedRotation: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#58a6ff' }}
                      />fixedRot
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.bullet ?? p._bullet ?? p._N$bullet ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bullet: e.target.checked, _bullet: e.target.checked, _N$bullet: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#58a6ff' }}
                      />bullet
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.allowSleep ?? p._allowSleep ?? p._N$allowSleep ?? true)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, allowSleep: e.target.checked, _allowSleep: e.target.checked, _N$allowSleep: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#58a6ff' }}
                      />allowSleep
                    </label>
                  </div>
                  {/* R2403: linearVelocity + angularVelocity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>linVel x</span>
                    <input type="number" defaultValue={Number((p.linearVelocity ?? p._linearVelocity ?? p._N$linearVelocity as { x?: number } | undefined)?.x ?? 0)} step={1}
                      onBlur={e => { const x = parseFloat(e.target.value) || 0; const y = Number((p.linearVelocity as { y?: number } | undefined)?.y ?? 0); const vel = { x, y }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearVelocity: vel, _linearVelocity: vel, _N$linearVelocity: vel } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="linearVelocity.x"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>y</span>
                    <input type="number" defaultValue={Number((p.linearVelocity ?? p._linearVelocity ?? p._N$linearVelocity as { y?: number } | undefined)?.y ?? 0)} step={1}
                      onBlur={e => { const y = parseFloat(e.target.value) || 0; const x = Number((p.linearVelocity as { x?: number } | undefined)?.x ?? 0); const vel = { x, y }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearVelocity: vel, _linearVelocity: vel, _N$linearVelocity: vel } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="linearVelocity.y"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0, marginLeft: 4 }}>angVel</span>
                    <input type="number" defaultValue={Number(p.angularVelocity ?? p._angularVelocity ?? 0)} step={1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angularVelocity: v, _angularVelocity: v, _N$angularVelocity: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="angularVelocity"
                    />
                  </div>
                  {/* R2400: linearVelocityLimit + angularVelocityLimit */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>linVelLim</span>
                    <input type="number" defaultValue={Number(p.linearVelocityLimit ?? p._linearVelocityLimit ?? p._N$linearVelocityLimit ?? 0)} min={0} step={1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearVelocityLimit: v, _linearVelocityLimit: v, _N$linearVelocityLimit: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="linearVelocityLimit (0=무제한)"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0, marginLeft: 6 }}>angVelLim</span>
                    <input type="number" defaultValue={Number(p.angularVelocityLimit ?? p._angularVelocityLimit ?? p._N$angularVelocityLimit ?? 0)} min={0} step={1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angularVelocityLimit: v, _angularVelocityLimit: v, _N$angularVelocityLimit: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="angularVelocityLimit (0=무제한)"
                    />
                  </div>
                  {/* R2411: enabledContactListener (BatchInspector R2009) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', marginTop: 2 }}>
                    <input type="checkbox" checked={!!(p.enabledContactListener ?? p._enabledContactListener ?? p._N$enabledContactListener ?? false)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabledContactListener: e.target.checked, _enabledContactListener: e.target.checked, _N$enabledContactListener: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0, accentColor: '#f472b6' }}
                    />contactListener
                  </label>
                  {/* R2422: awake + sleepThreshold (BatchInspector R1975/R1997) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.awake ?? p._awake ?? p._N$awake ?? true)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, awake: e.target.checked, _awake: e.target.checked, _N$awake: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#fb923c' }}
                      />awake
                    </label>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>sleepThres</span>
                    <input type="number" defaultValue={Number(p.sleepThreshold ?? p._sleepThreshold ?? p._N$sleepThreshold ?? 0.01)} min={0} step={0.001}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0.01; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sleepThreshold: v, _sleepThreshold: v, _N$sleepThreshold: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="sleepThreshold"
                    />
                    {([0.005, 0.01, 0.02, 0.05] as const).map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sleepThreshold: v, _sleepThreshold: v, _N$sleepThreshold: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(Number(p.sleepThreshold ?? p._sleepThreshold ?? 0.01) - v) < 0.001 ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(Number(p.sleepThreshold ?? p._sleepThreshold ?? 0.01) - v) < 0.001 ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1549: dragonBones.ArmatureDisplay — DragonBones Quick Edit
            if (comp.type === 'dragonBones.ArmatureDisplay') {
              const armatureName = String(p.armatureName ?? '')
              const animationName = String(p.animationName ?? '')
              const timeScale = Number(p.timeScale ?? 1)
              const loop = !!(p.loop ?? true)
              const playTimes = Number(p.playTimes ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2436: enabled (BatchInspector R2201) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>armature</span>
                    <input type="text" defaultValue={armatureName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, armatureName: e.target.value, _armatureName: e.target.value, _N$armatureName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>animation</span>
                    <input type="text" defaultValue={animationName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, animationName: e.target.value, _animationName: e.target.value, _N$animationName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1819: timeScale 퀵 프리셋 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>timeScale</span>
                    <input type="number" defaultValue={timeScale} step={0.1} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: parseFloat(e.target.value) || 1, _timeScale: parseFloat(e.target.value) || 1, _N$timeScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {([0.5, 1, 1.5, 2] as const).map(v => (
                      <span key={v} title={`timeScale = ×${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: v, _timeScale: v, _N$timeScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${timeScale === v ? '#f472b6' : 'var(--border)'}`, borderRadius: 2, color: timeScale === v ? '#f472b6' : 'var(--text-muted)', userSelect: 'none' }}
                      >×{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>playTimes</span>
                    <input type="number" defaultValue={playTimes} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playTimes: parseInt(e.target.value) || 0, _playTimes: parseInt(e.target.value) || 0, _N$playTimes: parseInt(e.target.value) || 0 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{playTimes === 0 ? '(loop∞)' : `×${playTimes}`}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#4ade80' }}
                      />loop
                    </label>
                    {/* R2423: playOnLoad (BatchInspector R1930) */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.playOnLoad ?? p._playOnLoad ?? p._N$playOnLoad ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked, _N$playOnLoad: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#60a5fa' }}
                      />playOnLoad
                    </label>
                    {/* R2397: debugBones + enableBatch */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.debugBones ?? p._debugBones ?? p._N$debugBones ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, debugBones: e.target.checked, _debugBones: e.target.checked, _N$debugBones: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#fbbf24' }}
                      />debugBones
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.enableBatch ?? p._enableBatch ?? p._N$enableBatch ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableBatch: e.target.checked, _enableBatch: e.target.checked, _N$enableBatch: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#34d399' }}
                      />batch
                    </label>
                  </div>
                  {/* R2406: blendMode (BatchInspector R2188) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>blendMode</span>
                    {([['NORM', 0], ['ADD', 10], ['MULT', 12]] as const).map(([l, v]) => {
                      const cur = Number(p.blendMode ?? p._blendMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, blendMode: v, _blendMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#c084fc' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#c084fc' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                </div>
              )
            }
            // R1546: sp.Skeleton — Spine 애니메이션 Quick Edit
            if (comp.type === 'sp.Skeleton') {
              const defaultSkin = String(p.defaultSkin ?? 'default')
              const defaultAnimation = String(p.defaultAnimation ?? '')
              const timeScale = Number(p.timeScale ?? 1)
              const loop = !!(p.loop ?? true)
              const paused = !!(p.paused ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2436: enabled (BatchInspector R2201) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>skin</span>
                    <input type="text" defaultValue={defaultSkin}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, defaultSkin: e.target.value, _defaultSkin: e.target.value, _N$defaultSkin: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>animation</span>
                    <input type="text" defaultValue={defaultAnimation}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, defaultAnimation: e.target.value, _defaultAnimation: e.target.value, _N$defaultAnimation: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>timeScale</span>
                    <input type="number" defaultValue={timeScale} step={0.1} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: parseFloat(e.target.value) || 1, _timeScale: parseFloat(e.target.value) || 1, _N$timeScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1818: timeScale 퀵 프리셋 */}
                    {([0.5, 1, 1.5, 2] as const).map(v => (
                      <span key={v} title={`timeScale = ×${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: v, _timeScale: v, _N$timeScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${timeScale === v ? '#f472b6' : 'var(--border)'}`, borderRadius: 2, color: timeScale === v ? '#f472b6' : 'var(--text-muted)', userSelect: 'none' }}
                      >×{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#4ade80' }}
                      />loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={paused}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, paused: e.target.checked, _paused: e.target.checked, _N$paused: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#f87171' }}
                      />paused
                    </label>
                    {/* R1826: premultipliedAlpha */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.premultipliedAlpha ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, premultipliedAlpha: e.target.checked, _premultipliedAlpha: e.target.checked, _N$premultipliedAlpha: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0 }}
                      />pma
                    </label>
                    {/* R2396: useTint */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.useTint ?? p._useTint ?? p._N$useTint ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, useTint: e.target.checked, _useTint: e.target.checked, _N$useTint: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#818cf8' }}
                      />tint
                    </label>
                  </div>
                  {/* R1826: debug 옵션 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.debugSlots ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, debugSlots: e.target.checked, _debugSlots: e.target.checked, _N$debugSlots: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#fbbf24' }}
                      />debugSlots
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.debugBones ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, debugBones: e.target.checked, _debugBones: e.target.checked, _N$debugBones: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#fbbf24' }}
                      />debugBones
                    </label>
                    {/* R2407: enableBatch (BatchInspector R2188) */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.enableBatch ?? p._enableBatch ?? p._N$enableBatch ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableBatch: e.target.checked, _enableBatch: e.target.checked, _N$enableBatch: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#34d399' }}
                      />batch
                    </label>
                  </div>
                </div>
              )
            }
            // R2416: cc.BlockInputEvents — enabled 퀵 편집
            if (comp.type === 'cc.BlockInputEvents') {
              const enabled = !!(p.enabled ?? p._enabled ?? true)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enabled}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled (입력 이벤트 차단)
                  </label>
                </div>
              )
            }
            return null
          })()}
          {(!collapsedComps.has(comp.type) || typeMatchedComps !== null) && (() => {
            const HIDDEN = new Set(['objFlags', 'enabled', 'playOnLoad', 'id', 'prefab', 'compPrefabInfo', 'contentSize', 'anchorPoint', 'N$file', 'N$spriteAtlas', 'N$clips', 'N$defaultClip'])
            const allProps = Object.entries(comp.props).filter(([k]) => {
              if (HIDDEN.has(k)) return false
              return true
            })
            const showFilter = allProps.length >= 3
            // 타입 매칭 시 전체 prop 표시, 아닐 때만 prop 이름 필터
            const isTypeMatch = typeMatchedComps !== null
            const baseFiltered = (propSearch && !isTypeMatch)
              ? allProps.filter(([k]) => k.toLowerCase().includes(propSearch.toLowerCase()))
              : allProps
            // 즐겨찾기 prop을 맨 앞으로 정렬
            const filteredProps = [
              ...baseFiltered.filter(([k]) => favProps.has(`${comp.type}:${k}`)),
              ...baseFiltered.filter(([k]) => !favProps.has(`${comp.type}:${k}`)),
            ]
            return (
              <>
                {showFilter && (
                  <input
                    placeholder="Filter properties..."
                    value={propSearch}
                    onChange={e => setPropSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setPropSearch('') }}
                    style={{
                      width: '100%', boxSizing: 'border-box', marginBottom: 4,
                      background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 9,
                    }}
                  />
                )}
                {/* R1536: PropSearch 하이라이트 */}
                {filteredProps.map(([k, v]) => {
            const isFavProp = favProps.has(`${comp.type}:${k}`)
            // R1673: 원본 대비 변경된 prop 감지
            const origComp = origSnapRef.current?.components[origIdx]
            const origVal = origComp?.props[k]
            const isPropChanged = origComp !== undefined && JSON.stringify(v) !== JSON.stringify(origVal)
            // R1536: propSearch 매칭 시 키 이름 하이라이트
            const propKeyLabel = (key: string): React.ReactNode => {
              const baseLabel = (() => {
                if (!propSearch) return key
                const lk = key.toLowerCase(), lq = propSearch.toLowerCase()
                const i = lk.indexOf(lq)
                if (i < 0) return key
                return <>{key.slice(0, i)}<mark style={{ background: 'rgba(250,204,21,0.25)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{key.slice(i, i + propSearch.length)}</mark>{key.slice(i + propSearch.length)}</>
              })()
              return isPropChanged
                ? <><span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', marginRight: 3, flexShrink: 0, verticalAlign: 'middle' }} title="변경됨" />{baseLabel}</>
                : baseLabel
            }
            const favBtn = (
              <span
                key="fav"
                className={isFavProp ? 'prop-fav is-fav' : 'prop-fav'}
                title={isFavProp ? '즐겨찾기 해제' : '즐겨찾기'}
                onClick={e => { e.stopPropagation(); toggleFavProp(comp.type, k) }}
                style={{
                  cursor: 'pointer', fontSize: 9, flexShrink: 0,
                  color: '#fbbf24',
                  opacity: isFavProp ? 1 : 0,
                  transition: 'opacity 0.1s',
                  paddingLeft: 2,
                }}
              >{isFavProp ? '★' : '☆'}</span>
            )
            if (v && typeof v === 'object' && '__uuid__' in (v as object)) {
              const uuid = (v as { __uuid__: string }).__uuid__
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                  <span style={{
                    flex: 1, fontSize: 9, color: '#888', fontFamily: 'monospace',
                    background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '2px 5px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    title: uuid,
                  }} title={uuid}>
                    {uuid.slice(0, 8)}…
                  </span>
                </div>
              )
            }
            // 벡터 타입 {x,y} 또는 {x,y,z} → 인라인 숫자 인풋
            if (v && typeof v === 'object' && !('__uuid__' in (v as object)) && !('__id__' in (v as object))) {
              const vobj = v as Record<string, unknown>
              const numKeys = Object.keys(vobj).filter(k => typeof vobj[k] === 'number')
              // RGBA 컬러 피커: r/g/b 키가 모두 있는 객체 (cc.Color 포함)
              const hasRgb = ['r', 'g', 'b'].every(c => c in vobj && typeof vobj[c] === 'number')
              if (hasRgb) {
                const r = Math.round(Math.min(255, Math.max(0, Number(vobj.r ?? 0))))
                const g = Math.round(Math.min(255, Math.max(0, Number(vobj.g ?? 0))))
                const b = Math.round(Math.min(255, Math.max(0, Number(vobj.b ?? 0))))
                const hasAlpha = 'a' in vobj && typeof vobj.a === 'number'
                const a = hasAlpha ? Math.round(Math.min(255, Math.max(0, Number(vobj.a ?? 255)))) : undefined
                const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                return (
                  <div key={k} className="prop-row" style={{ marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                      <input
                        type="color"
                        value={hex}
                        onChange={e => {
                          const h = e.target.value
                          const r2 = parseInt(h.slice(1, 3), 16)
                          const g2 = parseInt(h.slice(3, 5), 16)
                          const b2 = parseInt(h.slice(5, 7), 16)
                          applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, r: r2, g: g2, b: b2 } } } : c
                            )
                          })
                        }}
                        style={{ width: 36, height: 20, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {r},{g},{b}{hasAlpha ? `,${a}` : ''}
                      </span>
                    </div>
                    {hasAlpha && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, paddingLeft: 56 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 8 }}>A</span>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={a}
                          onChange={e => {
                            const newA = Number(e.target.value)
                            applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, a: newA } } } : c
                              )
                            })
                          }}
                          style={{ flex: 1, accentColor: 'var(--accent)', height: 4 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 22, textAlign: 'right' }}>{a}</span>
                      </div>
                    )}
                  </div>
                )
              }
              const isVec2 = vobj.__type__ === 'cc.Vec2'
              const isVec3 = vobj.__type__ === 'cc.Vec3'
              const isVecType = isVec2 || isVec3
              const vecAxes = isVec2 ? ['x', 'y'] : isVec3 ? ['x', 'y', 'z'] : null
              const axisColor: Record<string, string> = { x: '#e05555', y: '#55b055', z: '#4488dd' }
              if (isVecType && vecAxes) {
                return (
                  <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                    <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                      {vecAxes.map(axis => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: axisColor[axis] ?? 'var(--text-muted)',
                            marginRight: 2, flexShrink: 0, userSelect: 'none',
                          }}>{axis.toUpperCase()}</span>
                          <input type="number" defaultValue={Number(vobj[axis])}
                            title={axis}
                            onChange={e => {
                              const val = parseFloat(e.target.value)
                              if (!isNaN(val)) applyAndSave({
                                components: draft.components.map((c, i) =>
                                  i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: val } } } : c
                                )
                              })
                            }}
                            onBlur={e => applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: parseFloat(e.target.value) || 0 } } } : c
                              )
                            })}
                            onWheel={e => {
                              e.preventDefault()
                              const el = e.target as HTMLInputElement
                              const current = parseFloat(el.value)
                              if (isNaN(current)) return
                              const delta = e.deltaY < 0 ? 1 : -1
                              const multiplier = e.shiftKey ? 10 : 1
                              const newVal = current + delta * multiplier
                              el.value = String(newVal)
                              applyAndSave({
                                components: draft.components.map((c, i) =>
                                  i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: newVal } } } : c
                                )
                              })
                            }}
                            style={{
                              flex: 1, minWidth: 0, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                              color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px', fontSize: 9,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              if (numKeys.length >= 2 && numKeys.length <= 3) {
                return (
                  <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                    <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                      {numKeys.map(axis => (
                        <input key={axis} type="number" defaultValue={Number(vobj[axis])}
                          title={axis}
                          onChange={e => {
                            const val = parseFloat(e.target.value)
                            if (!isNaN(val)) applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: val } } } : c
                              )
                            })
                          }}
                          onBlur={e => applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: parseFloat(e.target.value) || 0 } } } : c
                            )
                          })}
                          onWheel={e => {
                            e.preventDefault()
                            const el = e.target as HTMLInputElement
                            const current = parseFloat(el.value)
                            if (isNaN(current)) return
                            const delta = e.deltaY < 0 ? 1 : -1
                            const multiplier = e.shiftKey ? 10 : 1
                            const newVal = current + delta * multiplier
                            el.value = String(newVal)
                            applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: newVal } } } : c
                              )
                            })
                          }}
                          style={{
                            flex: 1, minWidth: 0, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px', fontSize: 9,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              }
              return null
            }
            // 배열 타입 — 펼치기/접기 토글 + 요소별 편집
            if (Array.isArray(v)) {
              const arrKey = `${comp.type}:${k}:${ci}`
              const isExpanded = expandedArrayProps.has(arrKey)
              const arr = v as unknown[]
              return (
                <div key={k} className="prop-row" style={{ marginBottom: 3 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setExpandedArrayProps(prev => {
                      const next = new Set(prev)
                      if (next.has(arrKey)) next.delete(arrKey)
                      else next.add(arrKey)
                      return next
                    })}
                  >
                    <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>{isExpanded ? '▾' : '▸'}</span>
                    <span style={{ width: 48, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                    <span style={{ fontSize: 9, color: '#666' }}>[{arr.length}]</span>
                  </div>
                  {isExpanded && arr.map((elem, elemIdx) => {
                    const elemLabel = `[${elemIdx}]`
                    if (elem !== null && typeof elem === 'object' && '__type__' in (elem as object)) {
                      return (
                        <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                          <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                          <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '1px 4px' }}>
                            {String((elem as Record<string, unknown>).__type__)}
                          </span>
                        </div>
                      )
                    }
                    if (typeof elem === 'number') {
                      return (
                        <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                          <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                          <input
                            type="number"
                            defaultValue={elem}
                            onBlur={e => {
                              const val = parseFloat(e.target.value)
                              if (isNaN(val)) return
                              const newArr = [...arr]
                              newArr[elemIdx] = val
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            onWheel={e => {
                              e.preventDefault()
                              const el = e.target as HTMLInputElement
                              const current = parseFloat(el.value)
                              if (isNaN(current)) return
                              const delta = e.deltaY < 0 ? 1 : -1
                              const newVal = current + delta * (e.shiftKey ? 10 : 1)
                              el.value = String(newVal)
                              const newArr = [...arr]
                              newArr[elemIdx] = newVal
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            style={{ flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 9 }}
                          />
                        </div>
                      )
                    }
                    if (typeof elem === 'string') {
                      return (
                        <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                          <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                          <input
                            type="text"
                            defaultValue={elem}
                            onBlur={e => {
                              const newArr = [...arr]
                              newArr[elemIdx] = e.target.value
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            style={{ flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 9 }}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                        <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                        <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>{JSON.stringify(elem)}</span>
                      </div>
                    )
                  })}
                </div>
              )
            }
            if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return null
            const isBool = typeof v === 'boolean'
            const isText = typeof v === 'string'
            // fontStyle → 드롭다운
            if (k === 'fontStyle' && typeof v === 'number') {
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                  <select
                    value={Number(v)}
                    onChange={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: Number(e.target.value) } } : c
                      )
                    })}
                    style={{ flex: 1, fontSize: 10, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                  >
                    <option value={0}>Normal</option>
                    <option value={1}>Bold</option>
                    <option value={2}>Italic</option>
                    <option value={3}>BoldItalic</option>
                  </select>
                </div>
              )
            }
            // 알려진 Cocos enum → 드롭다운
            const COCOS_ENUM_MAP: Record<string, Record<number, string>> = {
              overflow:        { 0: 'None', 1: 'Clamp', 2: 'Shrink', 3: 'Resize Height' },
              horizontalAlign: { 0: 'Left', 1: 'Center', 2: 'Right' },
              verticalAlign:   { 0: 'Top',  1: 'Center', 2: 'Bottom' },
              wrapMode:        { 0: 'Default', 1: 'Normal', 2: 'Loop', 3: 'PingPong', 4: 'ClampForever' },
              // R1487: cc.Button enum
              transition:      { 0: 'None', 1: 'Color', 2: 'Sprite', 3: 'Scale' },
              // R1487: cc.Layout enum
              type:            { 0: 'None', 1: 'Horizontal', 2: 'Vertical', 3: 'Grid' },
              resizeMode:      { 0: 'None', 1: 'Children', 2: 'Container' },
              axisDirection:   { 0: 'Horizontal', 1: 'Vertical' },
              verticalDirection:  { 0: 'Bottom to Top', 1: 'Top to Bottom' },
              horizontalDirection: { 0: 'Left to Right', 1: 'Right to Left' },
              // cc.Mask / cc.ScrollView
              _type:           { 0: 'Rect', 1: 'Ellipse', 2: 'Image Stencil' },
              movementType:    { 0: 'Unrestricted', 1: 'Elastic', 2: 'Clamped' },
            }
            if (k in COCOS_ENUM_MAP && typeof v === 'number') {
              const enumOptions = COCOS_ENUM_MAP[k]
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                  <select
                    value={Number(v)}
                    onChange={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: Number(e.target.value) } } : c
                      )
                    })}
                    style={{ flex: 1, fontSize: 10, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                  >
                    {Object.entries(enumOptions).map(([val, label]) => (
                      <option key={val} value={Number(val)}>{label}</option>
                    ))}
                  </select>
                </div>
              )
            }
            return (
              <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                {isBool ? (
                  <BoolToggle
                    value={Boolean(v)}
                    onChange={checked => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: checked } } : c
                      )
                    })}
                  />
                ) : isText ? (
                  (() => {
                    const strV = String(v)
                    const isColor = strV.startsWith('#') || strV.startsWith('rgb')
                    const toHex = (s: string): string => {
                      if (s.startsWith('#')) return s.slice(0, 7)
                      const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
                      if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
                      return '#000000'
                    }
                    return (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                        {isColor && (
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div
                              className="colorSwatch"
                              onClick={() => setColorPickerProp(colorPickerProp === k ? null : k)}
                              style={{
                                width: 14, height: 14, borderRadius: 2, border: '1px solid var(--border)',
                                background: strV, cursor: 'pointer', marginTop: 3, flexShrink: 0,
                              }}
                            />
                            {colorPickerProp === k && (
                              <input
                                type="color"
                                value={toHex(strV)}
                                onChange={e => applyAndSave({
                                  components: draft.components.map((c, i) =>
                                    i === origIdx ? { ...c, props: { ...c.props, [k]: e.target.value } } : c
                                  )
                                })}
                                style={{
                                  position: 'absolute', top: 18, left: 0, zIndex: 100,
                                  width: 40, height: 24, padding: 0, border: 'none', cursor: 'pointer',
                                }}
                              />
                            )}
                          </div>
                        )}
                        <textarea
                          rows={2}
                          defaultValue={strV}
                          onBlur={e => applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: e.target.value } } : c
                            )
                          })}
                          style={{
                            flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
                            resize: 'vertical', fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    )
                  })()
                ) : (
                  <input
                    type="number"
                    defaultValue={Number(v)}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) applyAndSave({
                        components: draft.components.map((c, i) =>
                          i === origIdx ? { ...c, props: { ...c.props, [k]: val } } : c
                        )
                      })
                    }}
                    onBlur={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: parseFloat(e.target.value) || 0 } } : c
                      )
                    })}
                    onWheel={e => {
                      e.preventDefault()
                      const el = e.target as HTMLInputElement
                      const current = parseFloat(el.value)
                      if (isNaN(current)) return
                      const delta = e.deltaY < 0 ? 1 : -1
                      const multiplier = e.shiftKey ? 10 : 1
                      const newVal = current + delta * multiplier
                      el.value = String(newVal)
                      applyAndSave({
                        components: draft.components.map((c, i) =>
                          i === origIdx ? { ...c, props: { ...c.props, [k]: newVal } } : c
                        )
                      })
                    }}
                    style={{
                      flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
                    }}
                  />
                )}
              </div>
            )
                })}
              </>
            )
          })()}
        </div>
      ))}
      </>
      )
      })()}
      {/* R1612: 자식 노드 빠른 탐색 */}
      {node.children.length > 0 && (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 3 }}>▸ 자식 ({node.children.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {node.children.map(child => (
              <span
                key={child.uuid}
                onClick={() => onUpdate(child)}
                style={{ fontSize: 8, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: child.active ? 'var(--text-muted)' : '#555', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                onMouseLeave={e => (e.currentTarget.style.color = child.active ? 'var(--text-muted)' : '#555')}
                title={`이동: ${child.name}${!child.active ? ' (비활성)' : ''}`}
              >{!child.active ? '◌' : ''}{child.name}</span>
            ))}
          </div>
        </div>
      )}
      {/* 씬 파일 정보 (Inspector 하단) */}
      <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 9, color: '#444', lineHeight: 1.8 }}>
        <div title={sceneFile.scenePath} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📄 {sceneFile.scenePath.split(/[\\/]/).pop()}
        </div>
        <div>CC {sceneFile.projectInfo.version === '3x' ? '3.x' : '2.x'} | {sceneFile.projectInfo.creatorVersion ?? ''}</div>
      </div>

      {!collapsed['comps'] && (() => {
        const compTypes = ['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.ScrollView', 'cc.Layout', 'cc.Widget', 'cc.Animation', 'cc.AudioSource', 'cc.RichText', 'cc.EditBox', 'cc.UIOpacity', 'cc.Mask']
        const doAddComp = (ct: string) => { applyAndSave({ components: [...draft.components, { type: ct, props: {} }] }); trackAddComp(ct) }
        return (
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', padding: '3px 0' }}>
              + 컴포넌트 추가
            </summary>
            {/* R2502: 최근 추가 이력 */}
            {recentAddedComps.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 8, color: '#555', alignSelf: 'center', flexShrink: 0 }}>최근:</span>
                {recentAddedComps.map(ct => (
                  <span key={ct} title={`최근 추가: ${ct}`}
                    onClick={() => doAddComp(ct)}
                    style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(251,146,60,0.3)')}
                  >
                    {COMP_ICONS[ct] && <span style={{ opacity: 0.7 }}>{COMP_ICONS[ct]}</span>}
                    {ct.split('.').pop()}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {compTypes.map(ct => (
                <span
                  key={ct}
                  title={COMP_DESCRIPTIONS[ct] ?? ct}
                  onClick={() => doAddComp(ct)}
                  style={{
                    fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                    border: '1px solid var(--border)', color: 'var(--text-muted)',
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {/* R2331: 컴포넌트 추가 버튼에 아이콘 표시 */}
                  {COMP_ICONS[ct] && <span style={{ opacity: 0.7 }}>{COMP_ICONS[ct]}</span>}
                  {ct.split('.').pop()}
                </span>
              ))}
            </div>
            {/* R2331: 커스텀 컴포넌트 타입 직접 입력 */}
            <div style={{ display: 'flex', gap: 4, marginTop: 5, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="커스텀 타입 입력 (예: MyScript)"
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (!val) return
                  doAddComp(val);
                  (e.target as HTMLInputElement).value = ''
                }}
                style={{ flex: 1, fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              />
              <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>↵</span>
            </div>
          </details>
        )
      })()}

      {/* Round 611: 변경 이력 트레이 */}
      {(() => {
        const fmtVal = (v: unknown): string => {
          if (v === null || v === undefined) return 'null'
          if (typeof v === 'boolean') return v ? 'true' : 'false'
          if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
          if (typeof v === 'string') return v.length > 20 ? v.slice(0, 20) + '…' : v
          return JSON.stringify(v).slice(0, 30) + (JSON.stringify(v).length > 30 ? '…' : '')
        }
        const fmtTime = (ts: number): string => {
          const d = new Date(ts)
          return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
        }
        return (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)' }}>
            <div
              onClick={() => setHistoryOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 0', cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {historyOpen ? '▾' : '▸'} 📋 변경 이력 ({propHistory.length})
              </span>
              {propHistory.length > 0 && (
                <span
                  onClick={e => {
                    e.stopPropagation()
                    setPropHistory([])
                    localStorage.removeItem(PROP_HISTORY_KEY)
                  }}
                  title="이력 지우기"
                  style={{ fontSize: 10, color: '#555', cursor: 'pointer', padding: '0 2px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f85149')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                >
                  ×
                </span>
              )}
            </div>
            {historyOpen && (
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {propHistory.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#444', padding: '4px 0' }}>이력 없음</div>
                ) : propHistory.map(h => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <span
                      title="실행 취소 (undo)"
                      onClick={() => applyAndSave({ [h.propKey]: h.oldValue } as Partial<CCSceneNode>)}
                      style={{ fontSize: 10, cursor: 'pointer', color: '#555', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                    >
                      ↩
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-primary)' }}>[{h.nodeName}]</span>{' '}
                      <span style={{ fontFamily: 'monospace' }}>{h.propKey}</span>:{' '}
                      <span style={{ fontFamily: 'monospace', color: '#f85149' }}>{fmtVal(h.oldValue)}</span>
                      {' → '}
                      <span style={{ fontFamily: 'monospace', color: '#3fb950' }}>{fmtVal(h.newValue)}</span>
                    </span>
                    <span style={{ fontSize: 10, color: '#444', flexShrink: 0 }}>{fmtTime(h.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
      {/* R1497: Raw JSON 뷰 / R2487: 인라인 편집 */}
      {secHeader('rawJson', 'Raw JSON')}
      {!collapsed['rawJson'] && (() => {
        const jsonObj = {
          uuid: draft.uuid, name: draft.name, active: draft.active,
          position: draft.position, rotation: draft.rotation, scale: draft.scale,
          size: draft.size, anchor: draft.anchor, opacity: draft.opacity,
          color: draft.color, components: draft.components.map(c => ({ type: c.type, props: c.props })),
        }
        const startEdit = () => { setJsonEditText(JSON.stringify(jsonObj, null, 2)); setJsonEditErr(''); setJsonEditMode(true) }
        const applyJson = () => {
          try {
            const parsed = JSON.parse(jsonEditText)
            const patch: Partial<CCSceneNode> = {}
            if (parsed.name !== undefined) patch.name = String(parsed.name)
            if (parsed.active !== undefined) patch.active = Boolean(parsed.active)
            if (parsed.position !== undefined) patch.position = parsed.position
            if (parsed.rotation !== undefined) patch.rotation = parsed.rotation
            if (parsed.scale !== undefined) patch.scale = parsed.scale
            if (parsed.size !== undefined) patch.size = parsed.size
            if (parsed.anchor !== undefined) patch.anchor = parsed.anchor
            if (parsed.opacity !== undefined) patch.opacity = Number(parsed.opacity)
            if (parsed.color !== undefined) patch.color = parsed.color
            if (Array.isArray(parsed.components)) patch.components = parsed.components
            applyAndSave(patch)
            setJsonEditMode(false); setJsonEditErr('')
          } catch (e) { setJsonEditErr(String(e)) }
        }
        return (
          <div style={{ marginTop: 4 }}>
            {jsonEditMode ? (
              <>
                <textarea
                  value={jsonEditText} onChange={e => { setJsonEditText(e.target.value); setJsonEditErr('') }}
                  style={{ width: '100%', minHeight: 160, fontSize: 8, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', border: `1px solid ${jsonEditErr ? '#f85149' : '#334'}`, color: '#aac', borderRadius: 3, padding: '4px 6px', boxSizing: 'border-box', resize: 'vertical' }}
                />
                {jsonEditErr && <div style={{ fontSize: 8, color: '#f85149', marginTop: 2 }}>{jsonEditErr}</div>}
                <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  <button onClick={applyJson} style={{ fontSize: 9, padding: '1px 7px', borderRadius: 3, cursor: 'pointer', background: 'rgba(88,166,255,0.15)', border: '1px solid #334a6a', color: '#58a6ff' }}>적용 (R2487)</button>
                  <button onClick={() => { setJsonEditMode(false); setJsonEditErr('') }} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', background: 'transparent', border: '1px solid #444', color: '#666' }}>취소</button>
                </div>
              </>
            ) : (
              <>
                <pre style={{ fontSize: 8, fontFamily: 'monospace', color: '#556', background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '4px 6px', overflowX: 'auto', maxHeight: 160, overflowY: 'auto', userSelect: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(jsonObj, null, 2)}
                </pre>
                <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  <button onClick={startEdit} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', background: 'transparent', border: '1px solid #334a6a', color: '#58a6ff' }}>편집 (R2487)</button>
                  <button onClick={() => navigator.clipboard.writeText(JSON.stringify(draft, null, 2)).catch(() => {})} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', background: 'transparent', border: '1px solid #444', color: '#666' }}>JSON 복사</button>
                </div>
              </>
            )}
          </div>
        )
      })()}
      {/* R1508: 빠른 편집 CLI 입력 바 */}
      {(() => {
        const runCmd = (cmd: string) => {
          const parts = cmd.trim().split(/\s+/)
          const op = parts[0]?.toLowerCase()
          const nums = parts.slice(1).map(Number)
          let patch: Partial<CCSceneNode> | null = null
          if ((op === 'pos' || op === 'position') && nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
            patch = { position: { ...draft.position, x: nums[0], y: nums[1] } }
          } else if ((op === 'size' || op === 'sz') && nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
            patch = { size: { x: nums[0], y: nums[1] } }
          } else if ((op === 'rot' || op === 'rotation') && nums.length >= 1 && !isNaN(nums[0])) {
            patch = { rotation: typeof draft.rotation === 'number' ? nums[0] : { ...(draft.rotation as object), z: nums[0] } }
          } else if ((op === 'scale' || op === 'sc') && nums.length >= 1 && !isNaN(nums[0])) {
            const sy = !isNaN(nums[1]) ? nums[1] : nums[0]
            patch = { scale: { ...draft.scale, x: nums[0], y: sy } }
          } else if ((op === 'alpha' || op === 'opacity') && nums.length >= 1 && !isNaN(nums[0])) {
            patch = { opacity: Math.max(0, Math.min(255, Math.round(nums[0]))) }
          } else if ((op === 'color' || op === 'col') && parts[1]) {
            const hex = parts[1].replace('#', '')
            if (/^[0-9a-fA-F]{6}$/.test(hex)) {
              patch = { color: { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16), a: draft.color.a } }
            }
          } else if (op === 'name' && parts.slice(1).join(' ').trim()) {
            patch = { name: parts.slice(1).join(' ').trim() }
          } else if (op === 'active' || op === 'on') {
            patch = { active: true }
          } else if (op === 'inactive' || op === 'off') {
            patch = { active: false }
          } else if (op === 'toggle') {
            patch = { active: !draft.active }
          } else if ((op === 'anchor' || op === 'ax') && nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
            patch = { anchor: { x: Math.max(0,Math.min(1,nums[0])), y: Math.max(0,Math.min(1,nums[1])) } }
          // R1560: 추가 명령어
          } else if (op === 'layer' && nums.length >= 1 && !isNaN(nums[0])) {
            patch = { layer: Math.round(nums[0]) }
          } else if (op === 'tag' && nums.length >= 1 && !isNaN(nums[0])) {
            patch = { tag: Math.round(nums[0]) }
          } else if (op === 'z' && nums.length >= 1 && !isNaN(nums[0])) {
            const pos = draft.position as { x: number; y: number; z?: number }
            patch = { position: { ...pos, z: nums[0] } }
          } else if (op === 'flip' && parts[1]) {
            const axis = parts[1].toLowerCase()
            const sc = draft.scale as { x: number; y: number; z?: number }
            if (axis === 'x') patch = { scale: { ...sc, x: -sc.x } }
            else if (axis === 'y') patch = { scale: { ...sc, y: -sc.y } }
          } else if (op === 'reset') {
            patch = { position: { x: 0, y: 0, z: 0 }, rotation: 0, scale: { x: 1, y: 1, z: 1 }, opacity: 255 }
          } else if (op === 'help' || op === '?') {
            setCliMsg('pos|size|rot|scale|alpha|color|name|active|anchor|layer|tag|z|flip x/y|reset')
            setTimeout(() => setCliMsg(null), 4000)
            setCliVal('')
            return
          }
          if (patch) {
            applyAndSave(patch)
            setCliMsg(`✓ ${op}`)
            setTimeout(() => setCliMsg(null), 1500)
            setCliVal('')
          } else {
            setCliMsg('? 알 수 없는 명령 (help/?로 목록)')
            setTimeout(() => setCliMsg(null), 2000)
          }
        }
        return (
          <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>›_</span>
              <input
                value={cliVal}
                onChange={e => setCliVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { runCmd(cliVal); e.preventDefault() } }}
                placeholder="pos X Y · size W H · rot Z · help/?로 목록"
                style={{
                  flex: 1, fontSize: 9, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', borderRadius: 3, padding: '2px 5px', fontFamily: 'monospace',
                }}
                title="R1508/R1560 Quick Edit: pos|size|rot|scale|alpha|color|name|active/inactive/toggle|anchor|layer|tag|z|flip x/y|reset|help"
              />
              {cliMsg && <span style={{ fontSize: 9, color: cliMsg.startsWith('✓') ? '#4ade80' : '#f85149', flexShrink: 0 }}>{cliMsg}</span>}
            </div>
          </div>
        )
      })()}
      {/* R1668: 유사 노드 (공통 컴포넌트 타입 기반) */}
      {sceneFile?.root && draft.components.length > 0 && (() => {
        const myTypes = new Set(draft.components.map(c => c.type))
        const similar: Array<{ node: CCSceneNode; overlap: number }> = []
        function walkSim(n: CCSceneNode) {
          if (n.uuid !== node.uuid) {
            const overlap = n.components.filter(c => myTypes.has(c.type)).length
            if (overlap > 0) similar.push({ node: n, overlap })
          }
          n.children.forEach(walkSim)
        }
        walkSim(sceneFile.root)
        similar.sort((a, b) => b.overlap - a.overlap)
        const top = similar.slice(0, 5)
        if (top.length === 0) return null
        return (
          <div style={{ marginBottom: 4, padding: '3px 6px', background: 'rgba(88,166,255,0.04)', borderRadius: 3, border: '1px solid rgba(88,166,255,0.08)' }}>
            <div style={{ fontSize: 8, color: '#445', marginBottom: 3 }}>⊞ 유사 노드 (공통 컴포넌트) — {top.length}개</div>
            {top.map(({ node: sn, overlap }) => (
              <div
                key={sn.uuid}
                onClick={() => onUpdate(sn)}
                style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between', padding: '1px 0', cursor: 'pointer', color: 'var(--text-secondary)', gap: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sn.name}</span>
                <span style={{ fontSize: 7, color: '#556', flexShrink: 0 }}>⊕×{overlap}</span>
              </div>
            ))}
          </div>
        )
      })()}
      {/* Round 643: 저장 완료 토스트 */}
      {savedToast && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: '#166534', color: '#4ade80', fontSize: 11,
          padding: '4px 10px', textAlign: 'center', borderRadius: 4,
          marginTop: 6, userSelect: 'none',
        }}>
          저장됨 ✓
        </div>
      )}
    </div>
  )
}
