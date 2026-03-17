import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { updateCCFileContext } from '../../../hooks/useCCFileContext'
import { validateScene, extractPrefabEntries, deepCopyNodeWithNewUuids, type ValidationIssue } from '../cocos-utils'
import type { CCFileProjectUIProps, OptimizationSuggestion } from './types'

type SceneHistoryEntry = { timestamp: number; nodeCount: number; size: number; snapshotKey?: string }
export type DepEntry = { uuid: string; path: string; type: string; missing: boolean }

export function useCCFileProjectUI({ fileProject, selectedNode, onSelectNode }: CCFileProjectUIProps) {
  const { projectInfo, sceneFile, loading, error, externalChange, canUndo, canRedo, undoCount, redoCount, conflictInfo, openProject, detectProject, loadScene, saveScene, undo, redo, restoreBackup, forceOverwrite } = fileProject
  // R2317: 즐겨찾기 프로젝트 목록
  const CC_FAV_KEY = 'cc-favorite-projects'
  const [favProjects, setFavProjects] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(CC_FAV_KEY) ?? '[]') } catch { return [] }
  })
  // ISSUE-011: showFavMenu removed — favProjects now shown as tab bar
  const isFav = projectInfo?.projectPath ? favProjects.includes(projectInfo.projectPath) : false
  const toggleFav = () => {
    const path = projectInfo?.projectPath
    if (!path) return
    const next = isFav ? favProjects.filter(p => p !== path) : [...favProjects, path]
    setFavProjects(next)
    localStorage.setItem(CC_FAV_KEY, JSON.stringify(next))
  }
  const [selectedScene, setSelectedScene] = useState<string>('')
  // R2452: sceneFile 변경 시 드롭다운 sync (자동 로드 후 표시 정합성)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (sceneFile?.scenePath) setSelectedScene(sceneFile.scenePath) }, [sceneFile?.scenePath])
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // R1501: 마지막 저장 diff 로컬 상태
  const [lastDiffDisplay, setLastDiffDisplay] = useState<string | null>(null)
  // R1466: 씬 썸네일 자동 생성
  const [sceneThumbnails, setSceneThumbnails] = useState<Record<string, string>>(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('scene-thumb-'))
      const thumbs: Record<string, string> = {}
      for (const k of keys) {
        const name = k.replace('scene-thumb-', '')
        thumbs[name] = localStorage.getItem(k) ?? ''
      }
      return thumbs
    } catch { return {} }
  })
  const clipboardRef = useRef<CCSceneNode | null>(null)
  // R2323: Inspector 자동 스크롤 — 노드 전환 시 상단으로
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { inspectorScrollRef.current?.scrollTo(0, 0) }, [selectedNode?.uuid])
  const [hideInactive, setHideInactive] = useState(false)
  const [collapsedUuids, setCollapsedUuids] = useState<Set<string>>(() => new Set())
  const expandAll = useCallback(() => setCollapsedUuids(new Set()), [])
  // R2455: 특정 노드까지의 경로 모두 펼치기 (검색 결과 클릭 시 reveal in hierarchy)
  const expandToNode = useCallback((targetUuid: string) => {
    if (!sceneFile?.root) return
    const ancestors = new Set<string>()
    function findAncestors(n: CCSceneNode, path: string[]): boolean {
      if (n.uuid === targetUuid) { path.forEach(u => ancestors.add(u)); return true }
      for (const c of n.children) {
        if (findAncestors(c, [...path, n.uuid])) return true
      }
      return false
    }
    findAncestors(sceneFile.root, [])
    setCollapsedUuids(prev => { const next = new Set(prev); ancestors.forEach(u => next.delete(u)); return next })
  }, [sceneFile?.root])
  // R1655: 깊이 N까지 펼치기
  const collapseToDepth = useCallback((maxDepth: number) => {
    if (!sceneFile?.root) return
    const uuids = new Set<string>()
    function walk(n: CCSceneNode, depth: number) {
      if (depth >= maxDepth && n.children.length > 0) { uuids.add(n.uuid) }
      else { n.children.forEach(c => walk(c, depth + 1)) }
    }
    walk(sceneFile.root, 0)
    setCollapsedUuids(uuids)
  }, [sceneFile?.root])
  const collapseAll = useCallback(() => {
    if (!sceneFile?.root) return
    const uuids = new Set<string>()
    function collectParents(n: CCSceneNode) {
      if (n.children.length > 0) { uuids.add(n.uuid); n.children.forEach(collectParents) }
    }
    collectParents(sceneFile.root)
    setCollapsedUuids(uuids)
  }, [sceneFile?.root])
  // R1707: 씬 경로별 collapsed 상태 localStorage 저장/복원
  const collapsedPersistKey = sceneFile?.scenePath ? `tree-collapsed:${sceneFile.scenePath}` : null
  useEffect(() => {
    if (!collapsedPersistKey) return
    try {
      const saved = localStorage.getItem(collapsedPersistKey)
      if (saved) setCollapsedUuids(new Set(JSON.parse(saved) as string[]))
      else setCollapsedUuids(new Set())
    } catch { setCollapsedUuids(new Set()) }
  }, [collapsedPersistKey])
  useEffect(() => {
    if (!collapsedPersistKey) return
    try { localStorage.setItem(collapsedPersistKey, JSON.stringify([...collapsedUuids])) } catch {}
  }, [collapsedPersistKey, collapsedUuids])
  // R1644: 선택 노드 트리 자동 스크롤 + R2497: 조상 노드 자동 펼치기 (씬뷰 클릭 포함)
  useEffect(() => {
    if (!selectedNode) return
    expandToNode(selectedNode.uuid)
    requestAnimationFrame(() => {
      const el = document.getElementById(`tree-node-${selectedNode.uuid}`)
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [selectedNode?.uuid])
  const [sceneViewHeight, setSceneViewHeight] = useState(240)
  // R1470: Cocos 에디터 레이아웃 — 계층 패널 너비 (좌우 분할)
  const [hierarchyWidth, setHierarchyWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('cc-hierarchy-width') ?? '160') } catch { return 160 }
  })
  const hDividerDragRef = useRef<{ startX: number; startW: number } | null>(null)
  // R1414: 씬 저장 이력 타임라인
  // R2312: snapshotKey 추가 (복원 기능용 localStorage 스냅샷 키)
  const sceneHistoryKey = sceneFile?.scenePath ? `scene-history-${sceneFile.scenePath.replace(/[\\/]/g, '_')}` : null
  const [sceneHistoryTimeline, setSceneHistoryTimeline] = useState<SceneHistoryEntry[]>(() => {
    try { return sceneHistoryKey ? JSON.parse(localStorage.getItem(sceneHistoryKey) ?? '[]') : [] } catch { return [] }
  })
  const [showFullHistory, setShowFullHistory] = useState(false)
  // R1418: 씬 유효성 검사 상태
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [showValidationResults, setShowValidationResults] = useState(false)
  // R1441: 최적화 제안 상태
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<OptimizationSuggestion[]>([])
  // R1684: 씬 통계 패널
  const [showSceneStats, setShowSceneStats] = useState(false)
  const [mainTab, setMainTab] = useState<'scene' | 'assets' | 'groups' | 'build'>('scene')
  const dividerDragRef = useRef<{ startY: number; startH: number } | null>(null)
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cc-recent-files') ?? '[]') } catch { return [] }
  })
  // R1366: 최근 씬 파일 목록
  const [recentSceneFiles, setRecentSceneFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('recent-scene-files') ?? '[]') } catch { return [] }
  })
  const FAV_KEY = 'scene-tree-favorites'
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-tree-favorites') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleFavorite = useCallback((uuid: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])
  const [lockedUuids, setLockedUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-locked') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleLocked = useCallback((uuid: string) => {
    setLockedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('scene-locked', JSON.stringify([...next]))
      return next
    })
  }, [])
  const [nodeColors, setNodeColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('node-colors') ?? '{}') } catch { return {} }
  })
  // R2474: 핀 노드 — 빠른 선택을 위한 노드 고정 목록 (localStorage 영속화)
  const [pinnedNodes, setPinnedNodes] = useState<Array<{ uuid: string; name: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('cc-pinned-nodes') ?? '[]') } catch { return [] }
  })
  const togglePinNode = useCallback((uuid: string, name: string) => {
    setPinnedNodes(prev => {
      const exists = prev.some(p => p.uuid === uuid)
      const next = exists ? prev.filter(p => p.uuid !== uuid) : [...prev, { uuid, name }]
      localStorage.setItem('cc-pinned-nodes', JSON.stringify(next))
      return next
    })
  }, [])
  // R2488: 복제 오프셋
  const [dupeOffsetX, setDupeOffsetX] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem('cc-dupe-offset') ?? '[20,20]')[0] } catch { return 20 }
  })
  const [dupeOffsetY, setDupeOffsetY] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem('cc-dupe-offset') ?? '[20,20]')[1] } catch { return 20 }
  })
  const saveDupeOffset = (x: number, y: number) => {
    setDupeOffsetX(x); setDupeOffsetY(y)
    localStorage.setItem('cc-dupe-offset', JSON.stringify([x, y]))
  }
  // R1184: node filters
  const [nodeFilters, setNodeFilters] = useState<string[]>([])
  const [showNodeFilters, setShowNodeFilters] = useState(false)
  // R1715: 색상 태그 필터
  const [colorTagFilter, setColorTagFilter] = useState<string | null>(null)
  // R1664: 씬 트리 이름 하이라이트
  const [treeHighlightQuery, setTreeHighlightQuery] = useState('')
  // R1190: scene validation
  const [showValidation, setShowValidation] = useState(false)
  // R1390: CC 프로젝트 설정 뷰어
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [projectSettings, setProjectSettings] = useState<{
    designWidth?: number; designHeight?: number; physicsEngine?: string; buildTargets?: string[]
  } | null>(null)
  // R1406: CC 빌드 트리거 UI — state moved to BuildTab.tsx
  // R1389: 외부 변경 배너 자동 숨김
  const [bannerHidden, setBannerHidden] = useState(false)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // R2458: 외부 변경 자동 리로드 토글
  const [autoReload, setAutoReload] = useState(() => localStorage.getItem('cc-auto-reload') === 'true')
  // R1394: 씬 템플릿 생성
  const [showNewSceneForm, setShowNewSceneForm] = useState(false)
  const [newSceneName, setNewSceneName] = useState('NewScene')
  const [newSceneTemplate, setNewSceneTemplate] = useState<'empty' | 'canvas'>('canvas')
  // R1461: 새 CC 프로젝트 생성 마법사 상태
  const [showProjectWizard, setShowProjectWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [wizardProjectName, setWizardProjectName] = useState('NewProject')
  const [wizardSavePath, setWizardSavePath] = useState('')
  const [wizardCCVersion, setWizardCCVersion] = useState<'2x' | '3x'>('2x')
  const [wizardTemplate, setWizardTemplate] = useState<'empty' | 'ui'>('empty')
  const [wizardCreating, setWizardCreating] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)
  // R1514: 프리팹 인스턴스화
  const [prefabPickerOpen, setPrefabPickerOpen] = useState(false)
  const [insertingPrefab, setInsertingPrefab] = useState(false)
  // R1516: 다중 선택 노드 공통 속성 배치 편집
  const [multiSelectedUuids, setMultiSelectedUuids] = useState<string[]>([])
  // R1666: 선택 노드 pulse 미리보기
  const [pulseUuid, setPulseUuid] = useState<string | null>(null)
  // R1672: 노드 북마크 (1-9키 → uuid 매핑)
  const [nodeBookmarks, setNodeBookmarks] = useState<Record<string, string>>({}) // key(1-9) → uuid
  // R1676: JSON 복사 토스트 피드백
  const [jsonCopiedName, setJsonCopiedName] = useState<string | null>(null)
  // R1678: 최근 선택 노드 히스토리 (최대 8개)
  const [recentNodes, setRecentNodes] = useState<{ uuid: string; name: string }[]>([])
  useEffect(() => {
    if (!selectedNode) return
    setRecentNodes(prev => {
      const filtered = prev.filter(r => r.uuid !== selectedNode.uuid)
      return [{ uuid: selectedNode.uuid, name: selectedNode.name }, ...filtered].slice(0, 8)
    })
  }, [selectedNode?.uuid])
  const handleNodeColorChange = useCallback((uuid: string, color: string | null) => {
    setNodeColors(prev => {
      const next = { ...prev }
      if (color === null) delete next[uuid]
      else next[uuid] = color
      localStorage.setItem('node-colors', JSON.stringify(next))
      return next
    })
  }, [])
  const nodeMap = useMemo(() => {
    const map = new Map<string, CCSceneNode>()
    if (!sceneFile?.root) return map
    function walk(n: CCSceneNode) { map.set(n.uuid, n); n.children.forEach(walk) }
    walk(sceneFile.root)
    return map
  }, [sceneFile?.root])

  // R1658: 부모 노드 맵 (uuid → parent uuid)
  const parentMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!sceneFile?.root) return map
    function walk(n: CCSceneNode, parentUuid: string | null) {
      if (parentUuid) map.set(n.uuid, parentUuid)
      n.children.forEach(c => walk(c, n.uuid))
    }
    walk(sceneFile.root, null)
    return map
  }, [sceneFile?.root])

  // R2493: 캔버스 범위 초과 노드 UUID Set (계층 트리 경고 뱃지용)
  const outOfCanvasUuids = useMemo(() => {
    const uuids = new Set<string>()
    if (!sceneFile?.root || !projectSettings) return uuids
    const dW = projectSettings.designWidth ?? 960
    const dH = projectSettings.designHeight ?? 640
    function walk(n: CCSceneNode, px: number, py: number) {
      const lx = n.position?.x ?? 0
      const ly = n.position?.y ?? 0
      const effX = px + lx
      const effY = py + ly
      const w = n.size?.width ?? 0
      const h = n.size?.height ?? 0
      if (n.position && w > 0 && h > 0) {
        const isOut = effX + w / 2 < -dW / 2 || effX - w / 2 > dW / 2 || effY + h / 2 < -dH / 2 || effY - h / 2 > dH / 2
        if (isOut) uuids.add(n.uuid)
      }
      n.children.forEach(c => walk(c, effX, effY))
    }
    walk(sceneFile.root, 0, 0)
    return uuids
  }, [sceneFile?.root, projectSettings])

  // R1654: 컴포넌트 필터 적용 트리
  const filteredRoot = useMemo(() => {
    if (!sceneFile?.root) return null
    if (nodeFilters.length === 0 && !colorTagFilter) return sceneFile.root
    function keep(n: CCSceneNode): CCSceneNode | null {
      // R1667: 정확 일치 OR custom 타입 부분 문자열 매칭
      const compMatch = nodeFilters.length === 0 || n.components.some(c => nodeFilters.some(f => c.type === f || c.type.toLowerCase().includes(f.toLowerCase())))
      // R1715: 색상 태그 필터
      const colorMatch = !colorTagFilter || nodeColors[n.uuid] === colorTagFilter
      const filteredChildren = n.children.map(keep).filter(Boolean) as CCSceneNode[]
      if (!(compMatch && colorMatch) && filteredChildren.length === 0) return null
      return { ...n, children: filteredChildren }
    }
    const result = keep(sceneFile.root)
    return result ?? { ...sceneFile.root, children: [] }
  }, [sceneFile?.root, nodeFilters, colorTagFilter, nodeColors])

  // R1448: 씬 의존성 분석
  const [showDepsAnalysis, setShowDepsAnalysis] = useState(false)
  const [depsLoading, setDepsLoading] = useState(false)
  const [depsEntries, setDepsEntries] = useState<DepEntry[]>([])
  const handleAnalyzeDeps = useCallback(async () => {
    if (!sceneFile?._raw || !projectInfo?.projectPath) return
    setDepsLoading(true)
    setShowDepsAnalysis(true)
    try {
      const raw = sceneFile._raw as Record<string, unknown>[]
      // 씬 내 모든 UUID 참조 추출
      const referencedUuids = new Set<string>()
      function extractRefs(obj: unknown): void {
        if (!obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) { for (const item of obj) extractRefs(item); return }
        const rec = obj as Record<string, unknown>
        if (typeof rec.__uuid__ === 'string') { referencedUuids.add(rec.__uuid__); return }
        for (const val of Object.values(rec)) {
          if (val && typeof val === 'object') extractRefs(val)
        }
      }
      for (const entry of raw) extractRefs(entry)

      // 에셋 맵 빌드 (이미 로드된 경우 캐시 사용 가능)
      const assetsDir = projectInfo.projectPath + '/assets'
      const assetMap = await window.api.ccFileBuildUUIDMap(assetsDir)

      // UUID 매칭
      const entries: DepEntry[] = []
      for (const uuid of referencedUuids) {
        const asset = assetMap[uuid]
        if (asset) {
          entries.push({ uuid, path: asset.relPath, type: asset.type, missing: false })
        } else {
          entries.push({ uuid, path: '', type: 'unknown', missing: true })
        }
      }
      // 타입별 정렬 (누락 → 이미지 → 폰트 → 오디오 → 스크립트 → 기타)
      entries.sort((a, b) => {
        if (a.missing !== b.missing) return a.missing ? -1 : 1
        return a.type.localeCompare(b.type)
      })
      setDepsEntries(entries)
    } catch {
      setDepsEntries([])
    } finally {
      setDepsLoading(false)
    }
  }, [sceneFile, projectInfo])

  // R1454: 씬 일괄 처리
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const [batchToast, setBatchToast] = useState<string | null>(null)
  const batchToastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showBatchToast = useCallback((msg: string) => {
    setBatchToast(msg)
    if (batchToastRef.current) clearTimeout(batchToastRef.current)
    batchToastRef.current = setTimeout(() => setBatchToast(null), 2500)
  }, [])

  // R1461: 프로젝트 생성 핸들러
  const handleCreateProject = useCallback(async () => {
    if (!wizardProjectName.trim() || !wizardSavePath.trim()) {
      setWizardError('프로젝트 이름과 저장 위치를 입력하세요')
      return
    }
    setWizardCreating(true)
    setWizardError(null)
    try {
      const projectPath = `${wizardSavePath}/${wizardProjectName}`
      // assets/scenes 폴더 구조 생성
      await window.api.createDir(projectPath, 'assets')
      await window.api.createDir(`${projectPath}/assets`, 'scenes')

      // 씬 파일 생성
      if (wizardCCVersion === '2x') {
        const sceneContent = wizardTemplate === 'ui'
          ? JSON.stringify([
            { "__type__": "cc.SceneAsset", "_name": "", "scene": { "__id__": 1 } },
            { "__type__": "cc.Scene", "_name": "Main", "_active": true, "_children": [{ "__id__": 2 }], "_components": [], "_id": "scene-root" },
            { "__type__": "cc.Node", "_name": "Canvas", "_active": true, "_children": [], "_components": [{ "__id__": 3 }, { "__id__": 4 }], "_contentSize": { "width": 960, "height": 640 }, "_anchorPoint": { "x": 0.5, "y": 0.5 }, "_trs": { "__type__": "TypedArray", "ctor": "Float64Array", "array": [0,0,0,0,0,0,1,1,1,1] }, "_id": "canvas-node" },
            { "__type__": "cc.Canvas", "_designResolution": { "width": 960, "height": 640 }, "node": { "__id__": 2 } },
            { "__type__": "cc.Widget", "isAlignTop": true, "isAlignBottom": true, "isAlignLeft": true, "isAlignRight": true, "node": { "__id__": 2 } }
          ], null, 2)
          : JSON.stringify([
            { "__type__": "cc.SceneAsset", "_name": "", "scene": { "__id__": 1 } },
            { "__type__": "cc.Scene", "_name": "Main", "_active": true, "_children": [], "_components": [], "_id": "scene-root" }
          ], null, 2)
        await window.api.createFile(`${projectPath}/assets/scenes`, 'Main.fire')
        await window.api.writeTextFile?.(`${projectPath}/assets/scenes/Main.fire`, sceneContent)
        // project.json
        const projJson = JSON.stringify({ engine: "cocos-creator-js", packages: "packages://", id: wizardProjectName }, null, 2)
        await window.api.createFile(projectPath, 'project.json')
        await window.api.writeTextFile?.(`${projectPath}/project.json`, projJson)
      } else {
        // 3.x
        const sceneContent = wizardTemplate === 'ui'
          ? JSON.stringify([
            { "__type__": "cc.SceneAsset", "_name": "", "scene": { "__id__": 1 } },
            { "__type__": "cc.Scene", "_name": "Main", "_active": true, "_children": [{ "__id__": 2 }], "_components": [], "_id": "scene-root" },
            { "__type__": "cc.Node", "_name": "Canvas", "_active": true, "_children": [], "_components": [{ "__id__": 3 }, { "__id__": 4 }], "_lpos": { "x": 0, "y": 0, "z": 0 }, "_lrot": { "x": 0, "y": 0, "z": 0 }, "_lscale": { "x": 1, "y": 1, "z": 1 }, "_id": "canvas-node" },
            { "__type__": "cc.UITransform", "_contentSize": { "width": 960, "height": 640 }, "_anchorPoint": { "x": 0.5, "y": 0.5 }, "node": { "__id__": 2 } },
            { "__type__": "cc.Canvas", "node": { "__id__": 2 } }
          ], null, 2)
          : JSON.stringify([
            { "__type__": "cc.SceneAsset", "_name": "", "scene": { "__id__": 1 } },
            { "__type__": "cc.Scene", "_name": "Main", "_active": true, "_children": [], "_components": [], "_id": "scene-root" }
          ], null, 2)
        await window.api.createFile(`${projectPath}/assets/scenes`, 'Main.scene')
        await window.api.writeTextFile?.(`${projectPath}/assets/scenes/Main.scene`, sceneContent)
        const pkgJson = JSON.stringify({ name: wizardProjectName, uuid: crypto.randomUUID?.() ?? 'temp-uuid', creator: { version: "3.8.0" } }, null, 2)
        await window.api.createFile(projectPath, 'package.json')
        await window.api.writeTextFile?.(`${projectPath}/package.json`, pkgJson)
      }

      setShowProjectWizard(false)
      // 생성 후 프로젝트 열기 — 직접 경로 지정
      showBatchToast(`프로젝트 "${wizardProjectName}" 생성 완료`)
    } catch (err) {
      setWizardError((err as Error).message ?? '프로젝트 생성 실패')
    } finally {
      setWizardCreating(false)
    }
  }, [wizardProjectName, wizardSavePath, wizardCCVersion, wizardTemplate, showBatchToast])

  const handleBatchFontSize = useCallback(() => {
    if (!sceneFile?.root) return
    const sizeStr = prompt('모든 Label에 적용할 fontSize 값:', '24')
    if (!sizeStr) return
    const fontSize = parseInt(sizeStr)
    if (isNaN(fontSize) || fontSize <= 0) return
    let count = 0
    function walkFont(node: CCSceneNode) {
      for (const comp of node.components) {
        if (comp.type === 'cc.Label' && comp.props) {
          (comp.props as Record<string, unknown>).fontSize = fontSize
          ;(comp.props as Record<string, unknown>)._fontSize = fontSize
          ;(comp.props as Record<string, unknown>)._N$fontSize = fontSize
          count++
        }
      }
      node.children.forEach(walkFont)
    }
    walkFont(sceneFile.root)
    showBatchToast(`${count}개 Label 폰트 크기 → ${fontSize}`)
    setShowBatchMenu(false)
  }, [sceneFile, showBatchToast])

  const handleBatchRemoveInactive = useCallback(() => {
    if (!sceneFile?.root) return
    if (!confirm('모든 비활성(active=false) 노드를 삭제합니다. 계속하시겠습니까?')) return
    let count = 0
    function walkRemove(node: CCSceneNode): CCSceneNode {
      const filteredChildren = node.children
        .filter(child => {
          if (!child.active) { count++; return false }
          return true
        })
        .map(walkRemove)
      return { ...node, children: filteredChildren }
    }
    const newRoot = walkRemove(sceneFile.root)
    sceneFile.root = newRoot
    showBatchToast(`${count}개 비활성 노드 삭제됨`)
    setShowBatchMenu(false)
  }, [sceneFile, showBatchToast])

  const handleBatchNormalizeName = useCallback(() => {
    if (!sceneFile?.root) return
    let count = 0
    function walkName(node: CCSceneNode) {
      const original = node.name
      const normalized = original.replace(/[^a-zA-Z0-9가-힣_\- ]/g, '')
      if (normalized !== original) {
        node.name = normalized
        count++
      }
      node.children.forEach(walkName)
    }
    walkName(sceneFile.root)
    showBatchToast(`${count}개 노드 이름 정규화됨`)
    setShowBatchMenu(false)
  }, [sceneFile, showBatchToast])

  const addRecent = useCallback((path: string) => {
    setRecentFiles(prev => {
      const next = [path, ...prev.filter(f => f !== path)].slice(0, 6)
      localStorage.setItem('cc-recent-files', JSON.stringify(next))
      return next
    })
  }, [])

  // R1366: 최근 씬 파일 업데이트
  const addRecentScene = useCallback((path: string) => {
    setRecentSceneFiles(prev => {
      const next = [path, ...prev.filter(p => p !== path)].slice(0, 8)
      localStorage.setItem('recent-scene-files', JSON.stringify(next))
      return next
    })
  }, [])

  // R1376: Claude 컨텍스트 자동 주입
  const [ccCtxInject, setCcCtxInject] = useState(() => localStorage.getItem('cc-ctx-inject') !== 'false')
  // R1477: 씬 변경 diff 계산을 위한 이전 씬 루트 스냅샷
  const prevSceneRootRef = useRef<CCSceneNode | null>(null)
  useEffect(() => {
    if (!ccCtxInject) { updateCCFileContext(null); return }
    const sceneName = sceneFile?.scenePath?.replace(/\\/g, '/').split('/').pop() ?? '(없음)'
    const version = projectInfo?.version ?? '?'
    updateCCFileContext({
      sceneName,
      version,
      selectedNodeName: selectedNode?.name,
      selectedNodeUuid: selectedNode?.uuid,
      components: selectedNode?.components?.map(c => c.type) ?? [],
    })
  }, [ccCtxInject, sceneFile?.scenePath, projectInfo?.version, selectedNode?.uuid, selectedNode?.name, selectedNode?.components])

  // R2452: 프로젝트 로드 후 마지막 씬 자동 열기
  useEffect(() => {
    if (!projectInfo?.projectPath || sceneFile) return
    const lastScene = localStorage.getItem(`cc-last-scene-${projectInfo.projectPath}`)
    if (lastScene && projectInfo.scenes?.includes(lastScene)) {
      loadScene(lastScene)
    } else {
      const match = recentSceneFiles.find(p => projectInfo.scenes?.includes(p))
      if (match) loadScene(match)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectInfo?.projectPath])

  // R1390: 프로젝트 설정 로드
  useEffect(() => {
    if (!projectInfo?.projectPath) { setProjectSettings(null); return }
    const loadSettings = async () => {
      try {
        const projPath = projectInfo.projectPath
        // project.json 읽기
        const projJsonPath = projPath + '/project.json'
        const content = await window.api.fsReadFile?.(projJsonPath) as string | null
        let designWidth = 960, designHeight = 640
        let physicsEngine = 'none'
        const buildTargets: string[] = []
        if (content) {
          try {
            const pj = JSON.parse(content) as Record<string, unknown>
            const designRes = pj['design-resolution'] as { width?: number; height?: number } | undefined
            if (designRes) { designWidth = designRes.width ?? 960; designHeight = designRes.height ?? 640 }
            // CC3.x: packages.builder
            const pkgs = pj.packages as Record<string, unknown> | undefined
            const builder = pkgs?.builder as Record<string, unknown> | undefined
            if (builder?.buildSettings) {
              const bs = builder.buildSettings as Record<string, unknown>
              Object.keys(bs).forEach(k => buildTargets.push(k))
            }
            // physics engine
            const physics = pj.physics as Record<string, unknown> | undefined
            if (physics?.type) physicsEngine = String(physics.type)
          } catch { /* ignore parse errors */ }
        }
        // settings/project.json (CC3.x)
        try {
          const settingsPath = projPath + '/settings/project.json'
          const settingsContent = await window.api.fsReadFile?.(settingsPath) as string | null
          if (settingsContent) {
            const sj = JSON.parse(settingsContent) as Record<string, unknown>
            const generalObj = sj.general as Record<string, unknown> | undefined
            if (generalObj?.designResolution) {
              const dr = generalObj.designResolution as { width?: number; height?: number }
              if (dr.width) designWidth = dr.width
              if (dr.height) designHeight = dr.height
            }
            const physicsObj = sj.physics as Record<string, unknown> | undefined
            if (physicsObj?.type) physicsEngine = String(physicsObj.type)
          }
        } catch { /* settings/project.json 없으면 무시 */ }
        setProjectSettings({ designWidth, designHeight, physicsEngine, buildTargets })
      } catch { setProjectSettings(null) }
    }
    loadSettings()
  }, [projectInfo?.projectPath])

  // R1389: 외부 변경 배너 5초 후 자동 숨김 / R2458: 자동 리로드
  useEffect(() => {
    if (externalChange) {
      if (autoReload && sceneFile) {
        loadScene(sceneFile.scenePath)
        return
      }
      setBannerHidden(false)
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = setTimeout(() => setBannerHidden(true), 5000)
    } else {
      setBannerHidden(false)
    }
    return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalChange, autoReload])

  // R1394: 새 씬 파일 생성
  const handleCreateScene = useCallback(async () => {
    if (!projectInfo?.projectPath || !newSceneName.trim()) return
    const safeName = newSceneName.trim().replace(/[<>:"/\\|?*]/g, '_')
    const ext = projectInfo.version === '3x' ? '.scene' : '.fire'
    const scenePath = projectInfo.projectPath.replace(/\\/g, '/') + '/assets/' + safeName + ext
    // CC 2.x 최소 씬 구조
    let sceneJson: unknown[]
    if (newSceneTemplate === 'canvas') {
      sceneJson = [
        { __type__: 'cc.SceneAsset', _name: '', _objFlags: 0, _native: '', scene: { __id__: 1 } },
        { __type__: 'cc.Scene', _objFlags: 0, _parent: null, _children: [{ __id__: 2 }], _active: true, _level: 0, _components: [], _prefab: null, _opacity: 255, _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 }, _contentSize: { __type__: 'cc.Size', width: 0, height: 0 }, _anchorPoint: { __type__: 'cc.Vec2', x: 0, y: 0 }, _id: 'scene-' + Date.now(), _name: safeName, autoReleaseAssets: false },
        { __type__: 'cc.Node', _name: 'Canvas', _objFlags: 0, _parent: { __id__: 1 }, _children: [], _active: true, _components: [{ __id__: 3 }], _prefab: null, _opacity: 255, _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 }, _contentSize: { __type__: 'cc.Size', width: 960, height: 640 }, _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 }, _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] }, _id: 'canvas-' + Date.now() },
        { __type__: 'cc.Canvas', _name: '', _objFlags: 0, node: { __id__: 2 }, _enabled: true, _N$designResolution: { __type__: 'cc.Size', width: 960, height: 640 }, _N$fitWidth: false, _N$fitHeight: true },
      ]
    } else {
      sceneJson = [
        { __type__: 'cc.SceneAsset', _name: '', _objFlags: 0, _native: '', scene: { __id__: 1 } },
        { __type__: 'cc.Scene', _objFlags: 0, _parent: null, _children: [], _active: true, _level: 0, _components: [], _prefab: null, _opacity: 255, _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 }, _contentSize: { __type__: 'cc.Size', width: 0, height: 0 }, _anchorPoint: { __type__: 'cc.Vec2', x: 0, y: 0 }, _id: 'scene-' + Date.now(), _name: safeName, autoReleaseAssets: false },
      ]
    }
    const content = JSON.stringify(sceneJson, null, 2)
    try {
      const result = await window.api.writeTextFile(scenePath, content)
      if (result?.error) { console.error('씬 생성 실패:', result.error); return }
      setShowNewSceneForm(false)
      setNewSceneName('NewScene')
      // 생성 후 자동으로 열기
      await loadScene(scenePath)
      addRecentScene(scenePath)
    } catch (e) { console.error('씬 생성 오류:', e) }
  }, [projectInfo, newSceneName, newSceneTemplate, loadScene, addRecentScene])

  const handleSceneChange = useCallback(async (path: string) => {
    setSelectedScene(path)
    if (path) {
      await loadScene(path); addRecent(path); addRecentScene(path)
      // R2452: 프로젝트별 마지막 씬 저장
      if (projectInfo?.projectPath) localStorage.setItem(`cc-last-scene-${projectInfo.projectPath}`, path)
    }
  }, [loadScene, addRecent, addRecentScene, projectInfo?.projectPath])

  const handleTreeDelete = useCallback(async (nodeUuid: string) => {
    if (!sceneFile?.root || sceneFile.root.uuid === nodeUuid) return
    function removeNode(n: CCSceneNode): CCSceneNode {
      return { ...n, children: n.children.filter(c => c.uuid !== nodeUuid).map(removeNode) }
    }
    await saveScene(removeNode(sceneFile.root))
    if (selectedNode?.uuid === nodeUuid) onSelectNode(null)
  }, [sceneFile, saveScene, selectedNode, onSelectNode])

  const handleTreeDuplicate = useCallback(async (nodeUuid: string) => {
    if (!sceneFile?.root) return
    const findNode = (n: CCSceneNode): CCSceneNode | null => {
      if (n.uuid === nodeUuid) return n
      for (const c of n.children) { const f = findNode(c); if (f) return f }
      return null
    }
    const orig = findNode(sceneFile.root)
    if (!orig) return
    // R1476: 딥복사 + UUID 자동 재생성 (자식 포함 모두 새 UUID)
    // R1533: 복제 시 position +20 offset (겹침 방지)
    const baseNode = deepCopyNodeWithNewUuids(orig, '_Copy')
    const origPos = orig.position as { x?: number; y?: number; z?: number } | undefined
    const dupNode = { ...baseNode, position: { ...(origPos ?? {}), x: (origPos?.x ?? 0) + 20, y: (origPos?.y ?? 0) - 20 } }
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === nodeUuid)
      if (idx >= 0) {
        const ch = [...n.children]
        ch.splice(idx + 1, 0, dupNode)
        return { ...n, children: ch }
      }
      return { ...n, children: n.children.map(insertAfter) }
    }
    await saveScene(insertAfter(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleSave = useCallback(async () => {
    if (!sceneFile?.root) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const result = await saveScene(sceneFile.root)
      setSaveMsg(result.success
        ? { ok: true, text: '저장 완료' }
        : { ok: false, text: result.error ?? '저장 실패' }
      )
      // R1466: 씬 썸네일 자동 생성 (저장 완료 후 비동기)
      if (result.success && sceneFile.scenePath) {
        requestAnimationFrame(() => {
          try {
            const svgEl = document.querySelector('.scene-view-svg') as SVGSVGElement | null
            if (!svgEl) return
            const serializer = new XMLSerializer()
            const svgStr = serializer.serializeToString(svgEl)
            const canvas = document.createElement('canvas')
            canvas.width = 80; canvas.height = 60
            const ctx2 = canvas.getContext('2d')
            if (!ctx2) return
            const img = new Image()
            img.onload = () => {
              ctx2.drawImage(img, 0, 0, 80, 60)
              const base64 = canvas.toDataURL('image/png')
              const sceneName = sceneFile.scenePath.replace(/[\\/]/g, '_')
              try { localStorage.setItem(`scene-thumb-${sceneName}`, base64) } catch { /* ignore */ }
              setSceneThumbnails(prev => ({ ...prev, [sceneName]: base64 }))
            }
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
          } catch { /* 썸네일 생성 실패는 무시 */ }
        })
      }
      // R1414: 저장 이력 추가 / R2312: 스냅샷 저장 (복원 기능)
      if (result.success && sceneHistoryKey) {
        let count = 0
        const countNodesLocal = (n: CCSceneNode) => { count++; n.children.forEach(countNodesLocal) }
        countNodesLocal(sceneFile.root)
        const ts = Date.now()
        const snapKey = `${sceneHistoryKey}-snap-${ts}`
        try { localStorage.setItem(snapKey, JSON.stringify(sceneFile._raw ?? sceneFile.root)) } catch { /* storage full — skip */ }
        const entry: SceneHistoryEntry = { timestamp: ts, nodeCount: count, size: JSON.stringify(sceneFile._raw ?? sceneFile.root).length, snapshotKey: snapKey }
        setSceneHistoryTimeline(prev => {
          const combined = [entry, ...prev]
          const next = combined.slice(0, 5)
          combined.slice(5).forEach(e => { if (e.snapshotKey) try { localStorage.removeItem(e.snapshotKey) } catch { /* ignore */ } })
          try { localStorage.setItem(sceneHistoryKey!, JSON.stringify(next)) } catch { /* ignore */ }
          return next
        })
      }
      setTimeout(() => setSaveMsg(null), 3000)
      // R1477: 씬 변경 → Claude 컨텍스트 자동 diff 주입
      if (result.success && ccCtxInject && sceneFile.scenePath) {
        const flattenUuids = (n: CCSceneNode, acc: Map<string, string> = new Map()): Map<string, string> => {
          acc.set(n.uuid, n.name); n.children.forEach(c => flattenUuids(c, acc)); return acc
        }
        const prevMap = prevSceneRootRef.current ? flattenUuids(prevSceneRootRef.current) : new Map<string, string>()
        const newMap = flattenUuids(sceneFile.root)
        const added: string[] = []; const removed: string[] = []; const renamed: string[] = []
        for (const [uuid, name] of newMap) {
          if (!prevMap.has(uuid)) added.push(name)
          else if (prevMap.get(uuid) !== name) renamed.push(`${prevMap.get(uuid)} → ${name}`)
        }
        for (const [uuid, name] of prevMap) { if (!newMap.has(uuid)) removed.push(name) }
        if (added.length || removed.length || renamed.length) {
          const changes: string[] = []
          if (added.length) changes.push(`추가: ${added.slice(0, 3).join(', ')}${added.length > 3 ? ` 외 ${added.length - 3}개` : ''}`)
          if (removed.length) changes.push(`삭제: ${removed.slice(0, 3).join(', ')}${removed.length > 3 ? ` 외 ${removed.length - 3}개` : ''}`)
          if (renamed.length) changes.push(`이름변경: ${renamed.slice(0, 2).join(', ')}`)
          const diffStr = changes.join(' | ')
          const sceneName = sceneFile.scenePath.replace(/\\/g, '/').split('/').pop() ?? ''
          updateCCFileContext({
            sceneName,
            version: projectInfo?.version ?? '?',
            selectedNodeName: selectedNode?.name,
            selectedNodeUuid: selectedNode?.uuid,
            components: selectedNode?.components?.map(c => c.type) ?? [],
            lastSaveDiff: diffStr,
          })
          // R1501: 로컬 diff 표시 (5초 후 자동 사라짐)
          if (diffStr) {
            setLastDiffDisplay(diffStr)
            setTimeout(() => setLastDiffDisplay(null), 5000)
          }
        }
        prevSceneRootRef.current = sceneFile.root
      }
    } finally {
      setSaving(false)
    }
  }, [sceneFile, saveScene, sceneHistoryKey, ccCtxInject, projectInfo?.version, selectedNode])

  // 키보드 단축키: Ctrl+Z/Y, Delete, Ctrl+D, Arrow keys
  useEffect(() => {
    if (!sceneFile) return
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      // 입력 필드 포커스 시 무시
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (ctrl && e.key === 's') { e.preventDefault(); handleSave(); return }
      if (ctrl && e.key === 'z' && canUndo) { e.preventDefault(); undo(); return }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedo) { e.preventDefault(); redo(); return }
      // R1658: Escape → 부모 노드 선택 (루트에서는 선택 해제)
      if (e.key === 'Escape' && !isInput) {
        if (selectedNode && parentMap.has(selectedNode.uuid)) {
          const parentUuid = parentMap.get(selectedNode.uuid)!
          onSelectNode(nodeMap.get(parentUuid) ?? null)
        } else {
          onSelectNode(null)
        }
        return
      }

      if (isInput) return

      // Ctrl+C: 선택 노드 클립보드 복사
      if (ctrl && e.key === 'c' && selectedNode) {
        e.preventDefault()
        clipboardRef.current = selectedNode
        // R2320: cross-scene paste — localStorage에도 직렬화 저장
        try { localStorage.setItem('cc-node-clipboard', JSON.stringify(selectedNode)) } catch {}
        // R1676: Ctrl+Shift+C → JSON 시스템 클립보드 복사
        if (e.shiftKey) {
          const json = JSON.stringify(selectedNode, null, 2)
          navigator.clipboard.writeText(json).catch(() => {})
          setJsonCopiedName(selectedNode.name || selectedNode.uuid.slice(0, 8))
          setTimeout(() => setJsonCopiedName(null), 2000)
        }
        return
      }
      // Ctrl+V: 클립보드 노드 붙여넣기 — R2320: clipboardRef 없으면 localStorage 복원
      if (ctrl && e.key === 'v' && sceneFile?.root) {
        if (!clipboardRef.current) {
          try {
            const raw = localStorage.getItem('cc-node-clipboard')
            if (raw) clipboardRef.current = JSON.parse(raw) as CCSceneNode
          } catch {}
        }
      }
      if (ctrl && e.key === 'v' && clipboardRef.current && sceneFile?.root) {
        e.preventDefault()
        const srcNode = clipboardRef.current
        // R1476: 딥복사 + UUID 자동 재생성 (자식 포함) / R1650: 붙여넣기 위치 오프셋
        const pasteNode = deepCopyNodeWithNewUuids(srcNode, '_Paste')
        // R1650: 붙여넣기 시 20px 오프셋 적용 (원본과 겹치지 않도록)
        if (pasteNode.position) {
          const p = pasteNode.position as { x: number; y: number; z?: number }
          pasteNode.position = { ...p, x: p.x + 20, y: p.y - 20 }
        }
        const parentUuid = selectedNode?.uuid ?? sceneFile.root.uuid
        function addToParent(n: CCSceneNode): CCSceneNode {
          if (n.uuid === parentUuid) return { ...n, children: [...n.children, pasteNode] }
          return { ...n, children: n.children.map(addToParent) }
        }
        try {
          await saveScene(addToParent(sceneFile.root))
        } catch { /* ignore */ }
        return
      }

      // Delete/Backspace: 선택 노드 삭제
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && sceneFile.root?.uuid !== selectedNode.uuid) {
        e.preventDefault()
        handleTreeDelete(selectedNode.uuid)
        return
      }
      // R1688: Ctrl+A — 씬 전체 노드 다중 선택
      if (ctrl && e.key === 'a' && !e.shiftKey && sceneFile.root) {
        e.preventDefault()
        const all: string[] = []
        function collectAll(n: CCSceneNode) { all.push(n.uuid); n.children.forEach(collectAll) }
        sceneFile.root.children.forEach(collectAll)
        setMultiSelectedUuids(all)
        return
      }
      // Ctrl+D: 선택 노드 복제
      if (ctrl && e.key === 'd' && selectedNode) {
        e.preventDefault()
        handleTreeDuplicate(selectedNode.uuid)
        return
      }
      // R1399: Ctrl+G — 선택 노드를 새 "Group" 부모로 그룹화
      if (ctrl && e.key === 'g' && !e.shiftKey && selectedNode && sceneFile.root && sceneFile._raw) {
        e.preventDefault()
        const raw = sceneFile._raw as Record<string, unknown>[]
        const version = sceneFile.projectInfo.version ?? '2x'
        const groupId = 'group-' + Date.now()
        const groupIdx = raw.length
        const pos = selectedNode.position as { x: number; y: number; z: number }
        // 새 Group raw 엔트리
        const groupRaw: Record<string, unknown> = version === '3x' ? {
          __type__: 'cc.Node', _id: groupId, _name: 'Group', _active: true,
          _children: [], _components: [],
          _lpos: { x: pos.x, y: pos.y, z: pos.z }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
          _uiProps: { _localOpacity: 1 },
        } : {
          __type__: 'cc.Node', _id: groupId, _name: 'Group', _active: true,
          _children: [], _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [pos.x, pos.y, pos.z, 0, 0, 0, 1, 1, 1, 1] },
          _contentSize: { width: 0, height: 0 }, _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
        }
        raw.push(groupRaw)
        // 선택 노드를 0,0으로 이동 (부모 기준)
        const childNode: CCSceneNode = { ...selectedNode, position: { x: 0, y: 0, z: pos.z } }
        const groupNode: CCSceneNode = {
          uuid: groupId, name: 'Group', active: true,
          position: pos,
          rotation: version === '3x' ? { x: 0, y: 0, z: 0 } : 0,
          scale: { x: 1, y: 1, z: 1 }, size: { x: 0, y: 0 }, anchor: { x: 0.5, y: 0.5 },
          opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 },
          components: [], children: [childNode], _rawIndex: groupIdx,
        }
        // 선택 노드를 Group으로 교체
        function wrapNode(n: CCSceneNode): CCSceneNode {
          const newChildren = n.children.map(c => {
            if (c.uuid === selectedNode!.uuid) return groupNode
            return wrapNode(c)
          })
          return { ...n, children: newChildren }
        }
        const result = await saveScene(wrapNode(sceneFile.root))
        if (result.success) onSelectNode(groupNode)
        else raw.pop()
        return
      }
      // R1399: Ctrl+Shift+G — 그룹 해제 (자식을 부모로 올리고 빈 부모 삭제)
      if (ctrl && e.key === 'G' && e.shiftKey && selectedNode && sceneFile.root && selectedNode.children.length > 0) {
        e.preventDefault()
        const ungroupUuid = selectedNode.uuid
        const parentPos = selectedNode.position as { x: number; y: number; z: number }
        // 자식 노드들의 위치를 부모 기준으로 재계산
        const promotedChildren = selectedNode.children.map(child => {
          const cp = child.position as { x: number; y: number; z: number }
          return { ...child, position: { x: cp.x + parentPos.x, y: cp.y + parentPos.y, z: cp.z + parentPos.z } }
        })
        function ungroupNode(n: CCSceneNode): CCSceneNode {
          const idx = n.children.findIndex(c => c.uuid === ungroupUuid)
          if (idx >= 0) {
            const newChildren = [...n.children]
            newChildren.splice(idx, 1, ...promotedChildren)
            return { ...n, children: newChildren }
          }
          return { ...n, children: n.children.map(ungroupNode) }
        }
        const result = await saveScene(ungroupNode(sceneFile.root))
        if (result.success && promotedChildren.length > 0) onSelectNode(promotedChildren[0])
        return
      }
      // R1518: Ctrl+Up/Down — 형제 노드 순서 변경
      if (ctrl && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedNode && sceneFile.root) {
        e.preventDefault()
        const dir = e.key === 'ArrowUp' ? -1 : 1
        function reorderInParent(n: CCSceneNode): CCSceneNode {
          const idx = n.children.findIndex(c => c.uuid === selectedNode!.uuid)
          if (idx >= 0) {
            const newIdx = idx + dir
            if (newIdx < 0 || newIdx >= n.children.length) return n
            const ch = [...n.children]
            const [moved] = ch.splice(idx, 1)
            ch.splice(newIdx, 0, moved)
            return { ...n, children: ch }
          }
          return { ...n, children: n.children.map(reorderInParent) }
        }
        saveScene(reorderInParent(sceneFile.root))
        return
      }
      // Arrow keys: 선택 노드 1px 이동
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selectedNode && sceneFile.root) {
        e.preventDefault()
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
        const dy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
        const step = e.shiftKey ? 10 : 1
        const pos = selectedNode.position as { x: number; y: number; z: number }
        function moveNode(n: CCSceneNode): CCSceneNode {
          if (n.uuid === selectedNode!.uuid) {
            return { ...n, position: { ...pos, x: pos.x + dx * step, y: pos.y + dy * step } }
          }
          return { ...n, children: n.children.map(moveNode) }
        }
        saveScene(moveNode(sceneFile.root))
        return
      }
      // R1657: [ / ] 키 — 형제 노드 순환 선택
      if ((e.key === '[' || e.key === ']') && selectedNode && sceneFile.root && !isInput) {
        e.preventDefault()
        function findSiblings(n: CCSceneNode): CCSceneNode[] | null {
          const idx = n.children.findIndex(c => c.uuid === selectedNode!.uuid)
          if (idx >= 0) return n.children
          for (const child of n.children) {
            const found = findSiblings(child)
            if (found) return found
          }
          return null
        }
        const siblings = findSiblings(sceneFile.root)
        if (siblings && siblings.length > 1) {
          const idx = siblings.findIndex(c => c.uuid === selectedNode.uuid)
          const next = e.key === ']' ? siblings[(idx + 1) % siblings.length] : siblings[(idx - 1 + siblings.length) % siblings.length]
          onSelectNode(next)
        }
        return
      }
      // R1672: Ctrl+1-9 → 북마크 설정, 1-9 → 북마크 이동
      if (!isInput && /^[1-9]$/.test(e.key)) {
        if (ctrl && selectedNode) {
          e.preventDefault()
          setNodeBookmarks(prev => ({ ...prev, [e.key]: selectedNode.uuid }))
        } else if (!ctrl && nodeBookmarks[e.key]) {
          e.preventDefault()
          const uuid = nodeBookmarks[e.key]
          const found = nodeMap.get(uuid)
          if (found) onSelectNode(found)
        }
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sceneFile, canUndo, canRedo, undo, redo, selectedNode, handleTreeDelete, handleTreeDuplicate, saveScene, handleSave, onSelectNode, parentMap, nodeMap, nodeBookmarks])

  // R1729: cc.Label Find & Replace 상태
  const [showLabelReplace, setShowLabelReplace] = useState(false)
  const [labelFindText, setLabelFindText] = useState('')
  const [labelReplaceText, setLabelReplaceText] = useState('')

  // R1430: 전역 노드 검색 상태
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<Array<{ node: CCSceneNode; path: string }>>([])
  const globalSearchInputRef = useRef<HTMLInputElement>(null)
  // R1734: 검색 결과 컴포넌트 타입 필터
  const [globalSearchCompFilter, setGlobalSearchCompFilter] = useState('')

  // R1729: 매칭 cc.Label 목록
  const labelReplaceMatches = useMemo(() => {
    if (!showLabelReplace || !labelFindText.trim() || !sceneFile?.root) return []
    const matches: Array<{ node: CCSceneNode; current: string }> = []
    function walk(n: CCSceneNode) {
      const labelComp = n.components.find(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
      if (labelComp) {
        const p = labelComp.props as Record<string, unknown>
        const str = String(p._string ?? p.string ?? '')
        if (str.includes(labelFindText)) matches.push({ node: n, current: str })
      }
      n.children.forEach(walk)
    }
    walk(sceneFile.root)
    return matches
  }, [showLabelReplace, labelFindText, sceneFile])

  // R1734: 컴포넌트 타입 필터 적용
  const filteredGlobalResults = useMemo(() => {
    if (!globalSearchCompFilter) return globalSearchResults
    return globalSearchResults.filter(r => r.node.components.some(c => c.type === globalSearchCompFilter))
  }, [globalSearchResults, globalSearchCompFilter])

  // R1430: Ctrl+F 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setGlobalSearchOpen(true)
        setTimeout(() => globalSearchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape' && globalSearchOpen) {
        setGlobalSearchOpen(false)
        setGlobalSearchQuery('')
        setGlobalSearchResults([])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [globalSearchOpen])

  // R1430: 검색 실행
  const runGlobalSearch = useCallback((q: string) => {
    setGlobalSearchQuery(q)
    if (!q.trim() || !sceneFile?.root) { setGlobalSearchResults([]); return }
    const lq = q.toLowerCase()
    // R2325: UUID 검색 지원 — `#uuid-prefix` 또는 순수 hex+dash 패턴으로 UUID 부분 매칭
    const uuidQuery = q.startsWith('#') ? q.slice(1).toLowerCase() : (/^[0-9a-f\-]{6,}$/i.test(q) ? lq : null)
    // R2469: text: 또는 t: 접두어로 Label 텍스트 검색 모드
    const textQuery = q.startsWith('text:') ? q.slice(5).toLowerCase() : q.startsWith('t:') ? q.slice(2).toLowerCase() : null
    const found: Array<{ node: CCSceneNode; path: string }> = []
    function walk(n: CCSceneNode, parentPath: string): void {
      const currentPath = parentPath ? `${parentPath}/${n.name}` : n.name
      const nameMatch = !textQuery && n.name.toLowerCase().includes(lq)
      const compMatch = !textQuery && n.components.some(c => c.type.toLowerCase().includes(lq))
      const uuidMatch = !textQuery && (uuidQuery ? n.uuid.toLowerCase().startsWith(uuidQuery) || n.uuid.toLowerCase().includes(uuidQuery) : false)
      // R2469: Label/RichText 텍스트 내용 검색
      const effectiveTextQ = textQuery ?? lq
      const labelMatch = n.components.some(c => {
        if (!c.type.includes('Label') && !c.type.includes('Text')) return false
        const str = String(c.props.string ?? c.props['_N$string'] ?? c.props.text ?? '')
        return str.toLowerCase().includes(effectiveTextQ)
      })
      if (nameMatch || compMatch || uuidMatch || (textQuery ? labelMatch : false)) found.push({ node: n, path: currentPath })
      for (const child of n.children) walk(child, currentPath)
    }
    walk(sceneFile.root, '')
    setGlobalSearchResults(found.slice(0, 50))
  }, [sceneFile])

  // sceneFile 재로드 시 선택 노드 동기화 (uuid 기반 재탐색)
  useEffect(() => {
    if (!sceneFile?.root || !selectedNode) return
    const find = (n: CCSceneNode): CCSceneNode | null => {
      if (n.uuid === selectedNode.uuid) return n
      for (const c of n.children) { const f = find(c); if (f) return f }
      return null
    }
    const fresh = find(sceneFile.root)
    if (fresh) onSelectNode(fresh)
  }, [sceneFile])

  // R1595: 최근 선택 노드 히스토리 업데이트 (최대 8개)
  useEffect(() => {
    if (!selectedNode) return
    setNodeHistory(prev => {
      const filtered = prev.filter(id => id !== selectedNode.uuid)
      return [selectedNode.uuid, ...filtered].slice(0, 8)
    })
  }, [selectedNode?.uuid])

  const patchNodes = useCallback(
    async (patcher: (n: CCSceneNode) => CCSceneNode, _label?: string) => {
      if (!sceneFile?.root) return
      function walk(n: CCSceneNode): CCSceneNode {
        return { ...patcher(n), children: n.children.map(walk) }
      }
      await saveScene(walk(sceneFile.root))
    },
    [sceneFile, saveScene]
  )

  const handleNodeMove = useCallback(async (uuid: string, x: number, y: number) => {
    await patchNodes(n => n.uuid === uuid ? { ...n, position: { ...n.position, x, y } } : n, 'position')
  }, [patchNodes])

  const handleNodeResize = useCallback(async (uuid: string, w: number, h: number) => {
    await patchNodes(n => n.uuid === uuid ? { ...n, size: { x: Math.round(w), y: Math.round(h) } } : n, 'size')
  }, [patchNodes])

  const handleNodeRotate = useCallback(async (uuid: string, angle: number) => {
    const rounded = Math.round(angle * 10) / 10
    await patchNodes(n => {
      if (n.uuid !== uuid) return n
      const rot = typeof n.rotation === 'number' ? rounded : { ...(n.rotation as object), z: rounded }
      return { ...n, rotation: rot }
    }, 'rotation')
  }, [patchNodes])

  // R2476: 씬뷰 HUD opacity 인라인 편집
  const handleNodeOpacity = useCallback(async (uuid: string, opacity: number) => {
    await patchNodes(n => n.uuid === uuid ? { ...n, opacity } : n, 'opacity')
  }, [patchNodes])

  // R1506: 앵커 포인트 드래그 편집 (SceneView ◇ 핸들)
  const handleAnchorMove = useCallback(async (uuid: string, ax: number, ay: number) => {
    const clamped = { x: Math.max(0, Math.min(1, Math.round(ax * 100) / 100)), y: Math.max(0, Math.min(1, Math.round(ay * 100) / 100)) }
    await patchNodes(n => n.uuid === uuid ? { ...n, anchor: clamped } : n, 'anchor')
  }, [patchNodes])

  const handleMultiMove = useCallback(async (moves: Array<{ uuid: string; x: number; y: number }>) => {
    if (!sceneFile?.root) return
    function updateAll(n: CCSceneNode): CCSceneNode {
      const m = moves.find(mv => mv.uuid === n.uuid)
      if (m) return { ...n, position: { ...n.position, x: m.x, y: m.y } }
      return { ...n, children: n.children.map(updateAll) }
    }
    await saveScene(updateAll(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1483: 다중 선택 일괄 삭제
  const handleMultiDelete = useCallback(async (uuids: string[]) => {
    if (!sceneFile?.root) return
    const uuidSet = new Set(uuids)
    // 루트 노드 보호
    uuidSet.delete(sceneFile.root.uuid)
    if (uuidSet.size === 0) return
    function removeNodes(n: CCSceneNode): CCSceneNode {
      return { ...n, children: n.children.filter(c => !uuidSet.has(c.uuid)).map(removeNodes) }
    }
    await saveScene(removeNodes(sceneFile.root))
    onSelectNode(null)
  }, [sceneFile, saveScene, onSelectNode])

  // R1491: Label 텍스트 인라인 편집 (SceneView 더블클릭)
  const handleLabelEdit = useCallback(async (uuid: string, text: string) => {
    if (!sceneFile?.root) return
    function patchLabel(n: CCSceneNode): CCSceneNode {
      if (n.uuid !== uuid) return { ...n, children: n.children.map(patchLabel) }
      const labelComp = n.components.find(c => c.type === 'cc.Label' || c.type === 'Label' || c.type === 'cc.RichText')
      if (!labelComp) return n
      const propKey = ('_string' in labelComp.props) ? '_string' : 'string'
      return {
        ...n,
        components: n.components.map(c =>
          c === labelComp ? { ...c, props: { ...c.props, [propKey]: text } } : c
        ),
      }
    }
    await saveScene(patchLabel(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1729: cc.Label 전체 교체
  const handleLabelReplaceAll = useCallback(async () => {
    if (!sceneFile?.root || !labelFindText.trim() || labelReplaceMatches.length === 0) return
    const uuidSet = new Set(labelReplaceMatches.map(m => m.node.uuid))
    function patchAll(n: CCSceneNode): CCSceneNode {
      const children = n.children.map(patchAll)
      if (!uuidSet.has(n.uuid)) return { ...n, children }
      const updatedComps = n.components.map(c => {
        if (c.type !== 'cc.Label' && c.type !== 'cc.RichText') return c
        const p = c.props as Record<string, unknown>
        const propKey = '_string' in p ? '_string' : 'string'
        const current = String(p[propKey] ?? '')
        const replaced = current.split(labelFindText).join(labelReplaceText)
        return { ...c, props: { ...c.props, [propKey]: replaced } }
      })
      return { ...n, components: updatedComps, children }
    }
    await saveScene(patchAll(sceneFile.root))
    setLabelFindText('')
    setLabelReplaceText('')
  }, [sceneFile, saveScene, labelFindText, labelReplaceText, labelReplaceMatches])

  // R1504: 새 노드 추가 (SceneView "+" 버튼 또는 Ctrl+N)
  const handleAddNode = useCallback(async (parentUuid: string | null, pos?: { x: number; y: number }) => {
    if (!sceneFile?.root) return
    const version = projectInfo?.version ?? '2x'
    const newUuid = version === '3x'
      ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14))
      : Math.random().toString(36).slice(2, 14)
    const newNode: CCSceneNode = {
      uuid: newUuid,
      name: 'NewNode',
      active: true,
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0, z: 0 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      size: { x: 100, y: 100 },
      anchor: { x: 0.5, y: 0.5 },
      opacity: 255,
      color: { r: 255, g: 255, b: 255, a: 255 },
      components: [],
      children: [],
      // _rawIndex undefined → cc-file-saver normalizeTree가 자동 생성
    }
    const targetParentUuid = parentUuid ?? sceneFile.root.uuid
    function insertInto(n: CCSceneNode): CCSceneNode {
      if (n.uuid === targetParentUuid) return { ...n, children: [...n.children, newNode] }
      return { ...n, children: n.children.map(insertInto) }
    }
    const result = await saveScene(insertInto(sceneFile.root))
    if (result?.success !== false) {
      // 추가된 노드를 선택
      const findAdded = (root: CCSceneNode): CCSceneNode | null => {
        if (root.uuid === newUuid) return root
        for (const c of root.children) { const f = findAdded(c); if (f) return f }
        return null
      }
      // sceneFile이 갱신된 후 선택 — 약간 지연 후 처리
      setTimeout(() => {
        if (sceneFile?.root) {
          const added = findAdded(sceneFile.root)
          if (added) onSelectNode(added)
        }
      }, 100)
    }
  }, [sceneFile, saveScene, projectInfo, onSelectNode])

  // R1567: Ctrl+↑↓ — 형제 순서 변경
  const handleReorder = useCallback(async (uuid: string, direction: 1 | -1) => {
    if (!sceneFile?.root) return
    function reorder(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === uuid)
      if (idx !== -1) {
        const newIdx = idx - direction  // direction=1(위) → idx 감소
        if (newIdx < 0 || newIdx >= n.children.length) return n
        const arr = [...n.children]
        const [item] = arr.splice(idx, 1)
        arr.splice(newIdx, 0, item)
        return { ...n, children: arr }
      }
      return { ...n, children: n.children.map(reorder) }
    }
    await saveScene(reorder(sceneFile.root))
  }, [sceneFile, saveScene])

  // R2549: 형제 순서 맨 앞/뒤 이동
  const handleReorderExtreme = useCallback(async (uuid: string, to: 'first' | 'last') => {
    if (!sceneFile?.root) return
    function reorderEx(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === uuid)
      if (idx !== -1) {
        const arr = [...n.children]
        const [item] = arr.splice(idx, 1)
        if (to === 'first') arr.unshift(item)
        else arr.push(item)
        return { ...n, children: arr }
      }
      return { ...n, children: n.children.map(reorderEx) }
    }
    await saveScene(reorderEx(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1736: 자식 알파벳순 정렬
  const handleSortChildren = useCallback(async (uuid: string) => {
    if (!sceneFile?.root) return
    function sort(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) return { ...n, children: [...n.children].sort((a, b) => a.name.localeCompare(b.name)).map(sort) }
      return { ...n, children: n.children.map(sort) }
    }
    await saveScene(sort(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1565: H — 선택 노드 active 토글
  const handleToggleActive = useCallback(async (uuid: string) => {
    await patchNodes(n => n.uuid === uuid ? { ...n, active: !n.active } : n, 'active')
  }, [patchNodes])

  // R1563: Ctrl+D — 선택 노드 + 하위 트리 복제 (새 UUID 부여)
  const handleDuplicate = useCallback(async (uuid: string) => {
    if (!sceneFile?.root) return
    const is3x = projectInfo?.version === '3x'
    const genId = () => is3x
      ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14))
      : Math.random().toString(36).slice(2, 14)
    let isRoot = true
    function deepClone(n: CCSceneNode): CCSceneNode {
      // R2488: 최상위 복제 노드에만 offset 적용
      const applyOffset = isRoot; isRoot = false
      const pos = applyOffset && n.position ? { ...n.position, x: (n.position.x ?? 0) + dupeOffsetX, y: (n.position.y ?? 0) + dupeOffsetY } : n.position
      return { ...n, uuid: genId(), name: n.name + '_copy', position: pos, children: n.children.map(deepClone) }
    }
    // 원본 찾아서 부모 children에 clone 삽입 (원본 바로 다음)
    let clonedNode: CCSceneNode | null = null
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === uuid)
      if (idx !== -1) {
        const clone = deepClone(n.children[idx])
        clonedNode = clone
        const newChildren = [...n.children.slice(0, idx + 1), clone, ...n.children.slice(idx + 1)]
        return { ...n, children: newChildren }
      }
      return { ...n, children: n.children.map(insertAfter) }
    }
    const newRoot = insertAfter(sceneFile.root)
    if (!clonedNode) return
    const result = await saveScene(newRoot)
    if (result?.success !== false && clonedNode) {
      const c = clonedNode
      setTimeout(() => { onSelectNode(c) }, 100)
    }
  }, [sceneFile, saveScene, projectInfo, onSelectNode])

  // R2705: Alt+drag 복제 — 원본 uuid 위치에 deepCopy 삽입 후 x/y 이동
  const handleAltDrag = useCallback(async (uuid: string, x: number, y: number) => {
    if (!sceneFile?.root) return
    const is3x = projectInfo?.version === '3x'
    const genId = () => is3x
      ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14))
      : Math.random().toString(36).slice(2, 14)
    let isRoot = true
    function deepClone(n: CCSceneNode): CCSceneNode {
      const applyPos = isRoot; isRoot = false
      const position = applyPos ? { ...(n.position ?? { x: 0, y: 0, z: 0 }), x, y } : n.position
      return { ...n, uuid: genId(), name: n.name + '_copy', position, children: n.children.map(deepClone) }
    }
    let clonedNode: CCSceneNode | null = null
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === uuid)
      if (idx !== -1) {
        const clone = deepClone(n.children[idx])
        clonedNode = clone
        return { ...n, children: [...n.children.slice(0, idx + 1), clone, ...n.children.slice(idx + 1)] }
      }
      return { ...n, children: n.children.map(insertAfter) }
    }
    const newRoot = insertAfter(sceneFile.root)
    if (!clonedNode) return
    const result = await saveScene(newRoot)
    if (result?.success !== false && clonedNode) {
      const c = clonedNode
      setTimeout(() => { onSelectNode(c) }, 100)
    }
  }, [sceneFile, saveScene, projectInfo, onSelectNode])

  const handleReparent = useCallback(async (dragUuid: string, dropUuid: string) => {
    if (!sceneFile?.root || dragUuid === dropUuid || sceneFile.root.uuid === dragUuid) return
    // 사이클 방지: drop 대상이 drag 노드의 하위인지 확인
    function isDesc(n: CCSceneNode, target: string): boolean {
      if (n.uuid === target) return true
      return n.children.some(c => isDesc(c, target))
    }
    const findNode = (n: CCSceneNode): CCSceneNode | null => {
      if (n.uuid === dragUuid) return n
      for (const c of n.children) { const f = findNode(c); if (f) return f }
      return null
    }
    const dragged = findNode(sceneFile.root)
    if (!dragged || isDesc(dragged, dropUuid)) return

    let moved: CCSceneNode | null = null
    function remove(n: CCSceneNode): CCSceneNode {
      const ch = n.children.filter(c => { if (c.uuid === dragUuid) { moved = c; return false } return true })
      return { ...n, children: ch.map(remove) }
    }
    function insert(n: CCSceneNode): CCSceneNode {
      if (n.uuid === dropUuid) return { ...n, children: [...n.children, moved!] }
      return { ...n, children: n.children.map(insert) }
    }
    const reduced = remove(sceneFile.root)
    if (!moved) return
    await saveScene(insert(reduced))
  }, [sceneFile, saveScene])

  // R2466: 다중 선택 노드 그룹화
  const handleGroupNodes = useCallback(async (uuids: string[]) => {
    if (!sceneFile?.root || !sceneFile._raw || uuids.length < 2) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const version = sceneFile.projectInfo.version ?? '2x'
    const uuidSet = new Set(uuids)
    // 선택 노드 수집
    const collected: CCSceneNode[] = []
    function findSelected(n: CCSceneNode) {
      if (uuidSet.has(n.uuid)) collected.push(n)
      n.children.forEach(findSelected)
    }
    findSelected(sceneFile.root)
    if (collected.length === 0) return
    // 평균 위치 계산
    const avgX = Math.round(collected.reduce((s, n) => s + ((n.position as { x: number }).x ?? 0), 0) / collected.length)
    const avgY = Math.round(collected.reduce((s, n) => s + ((n.position as { y: number }).y ?? 0), 0) / collected.length)
    // 새 Group 노드 raw 엔트리
    const groupId = 'grp-' + Date.now()
    const groupIdx = raw.length
    raw.push(version === '3x' ? {
      __type__: 'cc.Node', _id: groupId, _name: 'Group', _active: true,
      _children: [], _components: [],
      _lpos: { x: avgX, y: avgY, z: 0 }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
    } : {
      __type__: 'cc.Node', _id: groupId, _name: 'Group', _active: true,
      _children: [], _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [avgX, avgY, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { width: 100, height: 100 }, _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
    })
    const groupNode: CCSceneNode = {
      uuid: groupId, name: 'Group', active: true,
      position: { x: avgX, y: avgY, z: 0 }, size: { x: 100, y: 100 },
      scale: { x: 1, y: 1, z: 1 }, anchor: { x: 0.5, y: 0.5 }, rotation: 0,
      opacity: 255, color: null, components: [], children: [], _rawIndex: groupIdx,
    }
    // 선택 노드를 트리에서 제거
    function removeSelected(n: CCSceneNode): CCSceneNode {
      const children = n.children.filter(c => !uuidSet.has(c.uuid))
      return { ...n, children: children.map(removeSelected) }
    }
    const reduced = removeSelected(sceneFile.root)
    // group 노드에 수집된 노드 추가 (위치를 group 기준 로컬 좌표로 변환)
    const groupWithChildren: CCSceneNode = {
      ...groupNode,
      children: collected.map(c => ({
        ...c,
        position: { x: ((c.position as { x: number }).x ?? 0) - avgX, y: ((c.position as { y: number }).y ?? 0) - avgY, z: 0 },
      })),
    }
    // root 직속 자식으로 group 노드 추가
    const newRoot = { ...reduced, children: [...reduced.children, groupWithChildren] }
    await saveScene(newRoot)
  }, [sceneFile, saveScene])

  // R1514: 프리팹 삽입 핸들러
  const handleInsertPrefab = useCallback(async (prefabPath: string) => {
    if (!sceneFile?.root || !projectInfo) return
    setInsertingPrefab(true)
    setPrefabPickerOpen(false)
    try {
      const result = await window.api.ccFileReadScene(prefabPath, projectInfo)
      if (!result || result.error || !result.root) {
        console.error('[R1514] 프리팹 로드 실패:', result?.error)
        return
      }
      const prefabRoot: CCSceneNode = result.root
      const instNode = deepCopyNodeWithNewUuids(prefabRoot, '')
      // 이름 중복 방지: 파일명 기반
      const prefabName = prefabPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.prefab$/i, '') ?? 'PrefabInst'
      const namedInst = { ...instNode, name: prefabName, _rawIndex: undefined }
      const targetUuid = selectedNode?.uuid ?? sceneFile.root.uuid
      function insertInto(n: CCSceneNode): CCSceneNode {
        if (n.uuid === targetUuid) return { ...n, children: [...n.children, namedInst] }
        return { ...n, children: n.children.map(insertInto) }
      }
      await saveScene(insertInto(sceneFile.root))
    } catch (e) {
      console.error('[R1514] 프리팹 삽입 오류:', e)
    } finally {
      setInsertingPrefab(false)
    }
  }, [sceneFile, projectInfo, selectedNode, saveScene])

  // 트리 컨텍스트 메뉴용 핸들러들
  const handleTreeAddChild = useCallback(async (parentUuid: string) => {
    if (!sceneFile?.root || !sceneFile._raw) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const version = sceneFile.projectInfo.version ?? '2x'
    const newId = 'ctx-' + Date.now()
    const newIdx = raw.length
    raw.push(version === '3x' ? {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
    } : {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
      _contentSize: { width: 100, height: 100 }, _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
    })
    const newNode: CCSceneNode = {
      uuid: newId, name: 'NewNode', active: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: version === '3x' ? { x: 0, y: 0, z: 0 } : 0,
      scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 },
      opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 },
      components: [], children: [], _rawIndex: newIdx,
    }
    function addChild(n: CCSceneNode): CCSceneNode {
      if (n.uuid === parentUuid) return { ...n, children: [...n.children, newNode] }
      return { ...n, children: n.children.map(addChild) }
    }
    try {
      const result = await saveScene(addChild(sceneFile.root))
      if (!result.success) raw.pop()
    } catch {
      raw.pop()
    }
  }, [sceneFile, saveScene])

  const handleTreeToggleActive = useCallback(async (nodeUuid: string) => {
    await patchNodes(n => n.uuid === nodeUuid ? { ...n, active: !n.active } : n, 'active')
  }, [patchNodes])

  const handleRenameInView = useCallback(async (nodeUuid: string, newName: string) => {
    if (!newName.trim()) return
    await patchNodes(n => n.uuid === nodeUuid ? { ...n, name: newName.trim() } : n, 'rename')
  }, [patchNodes])

  // R2463: 노드를 프리팹 파일로 저장
  const handleSaveAsPrefab = useCallback(async (uuid: string) => {
    if (!sceneFile?._raw || !projectInfo?.projectPath) return
    function findNode(n: CCSceneNode): CCSceneNode | null {
      if (n.uuid === uuid) return n
      for (const c of n.children) { const f = findNode(c); if (f) return f }
      return null
    }
    const node = findNode(sceneFile.root)
    if (!node || node._rawIndex == null) return
    const safeName = (node.name || 'Prefab').replace(/[<>:"/\\|?*]/g, '_')
    const prefabName = window.prompt('프리팹 파일 이름 (확장자 제외):', safeName)
    if (!prefabName?.trim()) return
    const prefabEntries = extractPrefabEntries(sceneFile._raw, node._rawIndex)
    const prefabJson = JSON.stringify(prefabEntries, null, 2)
    const sceneDir = sceneFile.scenePath.replace(/[\\/][^\\/]+$/, '').replace(/\\/g, '/')
    const prefabPath = `${sceneDir}/${prefabName.trim()}.prefab`
    const res = await window.api.writeTextFile?.(prefabPath, prefabJson)
    if (res && 'error' in res) { alert(`프리팹 저장 실패: ${(res as { error: string }).error}`); return }
    await detectProject?.(projectInfo.projectPath)
    setSaveMsg({ ok: true, text: `🧩 ${prefabName.trim()}.prefab 저장 완료` })
    setTimeout(() => setSaveMsg(null), 3000)
  }, [sceneFile, projectInfo, detectProject])

  const handleRestore = useCallback(async () => {
    if (!sceneFile) return
    const result = await restoreBackup()
    setSaveMsg(result.success
      ? { ok: true, text: '백업 복원 완료' }
      : { ok: false, text: result.error ?? '복원 실패' }
    )
    setTimeout(() => setSaveMsg(null), 3000)
  }, [sceneFile, restoreBackup])

  // nodeHistory state (R1595)
  const [nodeHistory, setNodeHistory] = useState<string[]>([])

  return {
    // Destructured from fileProject
    projectInfo, sceneFile, loading, error, externalChange, canUndo, canRedo,
    undoCount, redoCount, conflictInfo, openProject, detectProject, loadScene,
    saveScene, undo, redo, restoreBackup, forceOverwrite,
    // Favorites
    favProjects, isFav, toggleFav,
    // Scene selection
    selectedScene, setSelectedScene, handleSceneChange,
    // Save state
    saveMsg, setSaveMsg, saving, handleSave,
    // Diff display
    lastDiffDisplay,
    // Thumbnails
    sceneThumbnails,
    // Refs
    clipboardRef, inspectorScrollRef, hDividerDragRef, dividerDragRef,
    bannerTimerRef, prevSceneRootRef,
    // Tree state
    hideInactive, setHideInactive,
    collapsedUuids, setCollapsedUuids,
    expandAll, expandToNode, collapseToDepth, collapseAll,
    // Layout
    sceneViewHeight, setSceneViewHeight,
    hierarchyWidth, setHierarchyWidth,
    // History
    sceneHistoryTimeline, showFullHistory, setShowFullHistory, sceneHistoryKey,
    // Validation
    validationIssues, setValidationIssues,
    showValidationResults, setShowValidationResults,
    optimizationSuggestions, setOptimizationSuggestions,
    // Stats
    showSceneStats, setShowSceneStats,
    // Tabs
    mainTab, setMainTab,
    // Recent files
    recentFiles, recentSceneFiles, addRecent, addRecentScene,
    // Node favorites
    favorites, toggleFavorite,
    // Locked nodes
    lockedUuids, setLockedUuids, toggleLocked,
    // Node colors
    nodeColors, handleNodeColorChange,
    // Pinned nodes
    pinnedNodes, togglePinNode,
    // Dupe offset
    dupeOffsetX, dupeOffsetY, saveDupeOffset,
    // Filters
    nodeFilters, setNodeFilters, showNodeFilters, setShowNodeFilters,
    colorTagFilter, setColorTagFilter,
    // Tree highlight
    treeHighlightQuery, setTreeHighlightQuery,
    // Validation view
    showValidation, setShowValidation,
    // Project settings
    showProjectSettings, setShowProjectSettings, projectSettings,
    // Banner
    bannerHidden, setBannerHidden,
    autoReload, setAutoReload,
    // New scene form
    showNewSceneForm, setShowNewSceneForm,
    newSceneName, setNewSceneName,
    newSceneTemplate, setNewSceneTemplate,
    handleCreateScene,
    // Project wizard
    showProjectWizard, setShowProjectWizard,
    wizardStep, setWizardStep,
    wizardProjectName, setWizardProjectName,
    wizardSavePath, setWizardSavePath,
    wizardCCVersion, setWizardCCVersion,
    wizardTemplate, setWizardTemplate,
    wizardCreating, wizardError, setWizardError,
    handleCreateProject,
    // Prefab
    prefabPickerOpen, setPrefabPickerOpen,
    insertingPrefab, handleInsertPrefab,
    // Multi-select
    multiSelectedUuids, setMultiSelectedUuids,
    // Pulse
    pulseUuid, setPulseUuid,
    // Bookmarks
    nodeBookmarks, setNodeBookmarks,
    // JSON copy
    jsonCopiedName,
    // Recent nodes
    recentNodes,
    // Node/parent maps
    nodeMap, parentMap,
    // Canvas bounds
    outOfCanvasUuids,
    // Filtered tree
    filteredRoot,
    // Deps analysis
    showDepsAnalysis, setShowDepsAnalysis,
    depsLoading, depsEntries,
    handleAnalyzeDeps,
    // Batch menu
    showBatchMenu, setShowBatchMenu,
    batchToast, showBatchToast,
    handleBatchFontSize, handleBatchRemoveInactive, handleBatchNormalizeName,
    // Context inject
    ccCtxInject, setCcCtxInject,
    // Scene handlers
    handleTreeDelete, handleTreeDuplicate,
    handleTreeAddChild, handleTreeToggleActive,
    handleRenameInView, handleSaveAsPrefab,
    handleRestore,
    // Node handlers
    patchNodes,
    handleNodeMove, handleNodeResize, handleNodeRotate,
    handleNodeOpacity, handleAnchorMove,
    handleMultiMove, handleMultiDelete,
    handleLabelEdit, handleLabelReplaceAll,
    handleAddNode, handleDuplicate, handleToggleActive,
    handleReorder, handleReorderExtreme, handleSortChildren,
    handleReparent, handleGroupNodes, handleAltDrag,
    // Label replace
    showLabelReplace, setShowLabelReplace,
    labelFindText, setLabelFindText,
    labelReplaceText, setLabelReplaceText,
    labelReplaceMatches,
    // Global search
    globalSearchOpen, setGlobalSearchOpen,
    globalSearchQuery, setGlobalSearchQuery,
    globalSearchResults, setGlobalSearchResults,
    globalSearchInputRef,
    globalSearchCompFilter, setGlobalSearchCompFilter,
    filteredGlobalResults,
    runGlobalSearch,
    // Node history
    nodeHistory, setNodeHistory,
  }
}

export type UseCCFileProjectUIReturn = ReturnType<typeof useCCFileProjectUI>
