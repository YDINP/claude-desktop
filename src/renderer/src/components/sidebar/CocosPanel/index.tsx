import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useCCFileProject } from '../../../hooks/useCCFileProject'
import { CCFileSceneView } from '../SceneView/CCFileSceneView'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { updateCCFileContext } from '../../../hooks/useCCFileContext'
import { validateScene, extractPrefabEntries, deepCopyNodeWithNewUuids, type ValidationIssue } from '../cocos-utils'
import { BoolToggle } from './utils'
import { BackupManager } from './BackupManager'
import { GroupPanel, CCFileSceneTree } from './SceneTree'
import { CCFileBatchInspector } from './BatchInspector'
import { CCFileNodeInspector } from './NodeInspector'
import { CCFileAssetBrowser, TreeSearch } from './AssetBrowser'
import type { CCFileProjectUIProps, OptimizationSuggestion } from './types'

export function CocosPanel() {
  const fileProject = useCCFileProject()
  const [selectedNode, setSelectedNode] = useState<CCSceneNode | null>(null)
  return (
    <CCFileProjectUI
      fileProject={fileProject}
      selectedNode={selectedNode}
      onSelectNode={setSelectedNode}
    />
  )
}

function CCFileProjectUI({ fileProject, selectedNode, onSelectNode }: CCFileProjectUIProps) {
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
  type SceneHistoryEntry = { timestamp: number; nodeCount: number; size: number; snapshotKey?: string }
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
  // R1406: CC 빌드 트리거 UI
  const [buildPlatform, setBuildPlatform] = useState<'web-mobile' | 'web-desktop' | 'android' | 'ios'>('web-mobile')
  const [buildRunning, setBuildRunning] = useState(false)
  const [buildResult, setBuildResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const CC_EDITOR_PATHS: Record<string, string> = {
    '2.4.13': 'C:/ProgramData/cocos/editors/Creator/2.4.13/CocosCreator.exe',
    '2.4.5': 'C:/ProgramData/cocos/editors/Creator/2.4.5/CocosCreator.exe',
    '3.6.1': 'C:/ProgramData/cocos/editors/Creator/3.6.1/CocosCreator.exe',
    '3.7.1': 'C:/ProgramData/cocos/editors/Creator/3.7.1/CocosCreator.exe',
    '3.8.2': 'C:/ProgramData/cocos/editors/Creator/3.8.2/CocosCreator.exe',
    '3.8.6': 'C:/ProgramData/cocos/editors/Creator/3.8.6/CocosCreator.exe',
  }
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
  type DepEntry = { uuid: string; path: string; type: string; missing: boolean }
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

  return (
    <div
      style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
      onDrop={e => {
        e.preventDefault(); e.stopPropagation()
        const file = e.dataTransfer.files[0]
        if (!file) return
        const filePath = (file as File & { path?: string }).path
        if (!filePath) return
        if (/\.(fire|scene|prefab)$/i.test(filePath)) { loadScene(filePath); addRecent(filePath); addRecentScene(filePath) }
      }}
    >
      {/* R1430: 전역 노드 검색 오버레이 */}
      {globalSearchOpen && (
        <div style={{
          position: 'relative', zIndex: 50, borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary, #0d0d1a)', padding: '4px 8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, flexShrink: 0 }}>🔍</span>
            <input
              ref={globalSearchInputRef}
              value={globalSearchQuery}
              onChange={e => runGlobalSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setGlobalSearchOpen(false); setGlobalSearchQuery(''); setGlobalSearchResults([]) }
              }}
              placeholder="노드 이름 / 컴포넌트 / UUID(#) / 텍스트(text:) 검색... (Esc 닫기)"
              style={{
                flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', borderRadius: 3, padding: '3px 6px', fontSize: 10, boxSizing: 'border-box',
              }}
            />
            <span
              onClick={() => { setGlobalSearchOpen(false); setGlobalSearchQuery(''); setGlobalSearchResults([]) }}
              style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}
            >x</span>
          </div>
          {globalSearchResults.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {/* R1734: 컴포넌트 타입 필터 */}
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                {['', 'cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Layout', 'cc.ScrollView'].map(ct => (
                  <span
                    key={ct || 'all'}
                    onClick={() => setGlobalSearchCompFilter(ct)}
                    style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${globalSearchCompFilter === ct ? '#58a6ff' : 'var(--border)'}`, background: globalSearchCompFilter === ct ? 'rgba(88,166,255,0.15)' : 'transparent', color: globalSearchCompFilter === ct ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                  >{ct ? ct.replace('cc.', '') : '전체'}</span>
                ))}
              </div>
              {/* R1719: 검색 결과 "모두 선택" 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{filteredGlobalResults.length}개 결과{globalSearchCompFilter ? ` (${globalSearchCompFilter.replace('cc.', '')} 필터)` : ''}</span>
                <span
                  title="검색 결과 노드 모두 선택 (다중 선택)"
                  onClick={() => {
                    const uuids = filteredGlobalResults.map(r => r.node.uuid)
                    if (uuids.length > 0) {
                      onSelectNode(filteredGlobalResults[0].node)
                      setMultiSelectedUuids(uuids)
                    }
                  }}
                  style={{ fontSize: 9, cursor: 'pointer', color: '#58a6ff', padding: '1px 5px', border: '1px solid rgba(88,166,255,0.4)', borderRadius: 3 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >모두 선택</span>
              </div>
            <div style={{
              maxHeight: 200, overflowY: 'auto',
              borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)',
            }}>
              {filteredGlobalResults.map(({ node: n, path }) => (
                <div
                  key={n.uuid}
                  onClick={() => {
                    onSelectNode(n)
                    // R2455: 계층 트리 자동 펼치기 (reveal in hierarchy)
                    expandToNode(n.uuid)
                    // R1481: SceneView 자동 포커스
                    window.dispatchEvent(new CustomEvent('cc-focus-node', { detail: { uuid: n.uuid } }))
                    setGlobalSearchOpen(false)
                    setGlobalSearchQuery('')
                    setGlobalSearchResults([])
                  }}
                  style={{
                    padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text-primary)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span style={{ fontSize: 10, flexShrink: 0 }}>
                    {n.components.length > 0 ? n.components[0].type.replace('cc.', '')[0] : '□'}
                  </span>
                  <span style={{ fontWeight: 500, flexShrink: 0 }}>{n.name || '(unnamed)'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {path}
                  </span>
                  {n.components.length > 0 && (
                    <span style={{ fontSize: 8, color: 'var(--accent)', flexShrink: 0 }}>
                      {n.components.map(c => c.type.replace('cc.', '')).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
            </div>
          )}
          {globalSearchQuery && globalSearchResults.length === 0 && (
            <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-muted)', padding: '2px 4px' }}>
              검색 결과 없음
            </div>
          )}
        </div>
      )}

      {/* 외부 파일 변경 감지 배너 (R1389: 5초 자동 숨김 / R2458: 자동 리로드 토글) */}
      {externalChange && sceneFile && !bannerHidden && (
        <div style={{
          padding: '5px 10px', background: '#2d1a00', borderBottom: '1px solid #ff9944',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#ff9944', flex: 1 }}>
            파일이 외부에서 수정됨
          </span>
          <label style={{ fontSize: 9, color: '#ff9944', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={autoReload} onChange={e => {
              const v = e.target.checked
              setAutoReload(v)
              try { localStorage.setItem('cc-auto-reload', String(v)) } catch {}
            }} style={{ cursor: 'pointer' }} />
            자동
          </label>
          <button
            onClick={() => loadScene(sceneFile.scenePath)}
            style={{
              padding: '2px 6px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
              background: '#ff9944', color: '#000', border: 'none',
            }}
          >
            다시 로드
          </button>
          <button
            onClick={() => setBannerHidden(true)}
            style={{
              padding: '0 4px', fontSize: 11, borderRadius: 2, cursor: 'pointer',
              background: 'none', color: '#ff9944', border: 'none', lineHeight: 1,
            }}
            title="닫기"
          >
            x
          </button>
        </div>
      )}

      {/* R1437: 충돌 감지 다이얼로그 */}
      {conflictInfo && (
        <div style={{
          padding: '6px 10px', background: '#2d0a0a', borderBottom: '1px solid #ef4444',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#ef4444', flex: 1 }}>
            파일이 외부에서 변경됨. 덮어쓸까요?
          </span>
          <button
            onClick={() => forceOverwrite()}
            style={{
              padding: '2px 6px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
              background: '#ef4444', color: '#fff', border: 'none',
            }}
          >
            덮어쓰기
          </button>
          <button
            onClick={() => sceneFile && loadScene(sceneFile.scenePath)}
            style={{
              padding: '2px 6px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
              background: 'none', color: '#ef4444', border: '1px solid #ef4444',
            }}
          >
            다시 로드
          </button>
        </div>
      )}

      {/* 프로젝트 열기 섹션 */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <button
            onClick={openProject}
            disabled={loading}
            style={{
              flex: 1, padding: '4px 8px', background: 'var(--accent)', color: '#fff',
              borderRadius: 4, fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '로드 중...' : projectInfo?.detected ? '📂 다른 프로젝트 열기' : '📂 CC 프로젝트 열기'}
          </button>
          {/* R2317/ISSUE-011: 즐겨찾기 토글 버튼 */}
          <button
            title={isFav ? '즐겨찾기 해제' : (projectInfo?.projectPath ? '즐겨찾기 추가' : '')}
            onClick={() => { if (projectInfo?.projectPath) toggleFav() }}
            disabled={!projectInfo?.projectPath}
            style={{ padding: '4px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, cursor: projectInfo?.projectPath ? 'pointer' : 'default', color: isFav ? '#fbbf24' : 'var(--text-muted)', opacity: projectInfo?.projectPath ? 1 : 0.4 }}
          >{isFav ? '★' : '☆'}</button>
          {/* R1461: 새 프로젝트 생성 마법사 */}
          <button
            onClick={() => { setShowProjectWizard(true); setWizardStep(1); setWizardError(null) }}
            style={{
              padding: '4px 8px', background: 'rgba(96,165,250,0.12)', color: 'var(--accent)',
              border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, fontSize: 10,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {'🆕'} 새 프로젝트
          </button>
        </div>

        {/* ISSUE-011: 즐겨찾기 프로젝트 탭 바 — 클릭 시 해당 프로젝트 전환 + 마지막 씬 자동 로드 */}
        {favProjects.length > 0 && (
          <div style={{ display: 'flex', gap: 0, marginTop: 6, marginBottom: 4, overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            {favProjects.map(path => {
              const isActive = projectInfo?.projectPath === path
              const label = path.split(/[\\/]/).pop() ?? path
              return (
                <button key={path}
                  onClick={() => { if (!isActive) detectProject?.(path) }}
                  title={path}
                  style={{
                    padding: '4px 10px', fontSize: 10, border: 'none', cursor: isActive ? 'default' : 'pointer',
                    background: isActive ? 'var(--bg-primary)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'color 0.15s, border-bottom 0.15s',
                  }}
                >{label}</button>
              )
            })}
          </div>
        )}

        {/* 감지된 프로젝트 정보 */}
        {projectInfo?.detected && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>
              {projectInfo.name}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                CC {projectInfo.version} ({projectInfo.creatorVersion})
              </span>
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={projectInfo.projectPath}>
              {projectInfo.projectPath}
            </div>
            <div style={{ marginTop: 2 }}>
              씬 파일: <strong>{(projectInfo.scenes?.filter(s => !s.endsWith('.prefab'))?.length ?? 0)}개</strong>
              {(projectInfo.scenes?.filter(s => s.endsWith('.prefab'))?.length ?? 0) > 0 && (
                <span style={{ marginLeft: 6 }}>프리팹: <strong>{projectInfo.scenes?.filter(s => s.endsWith('.prefab'))?.length}개</strong></span>
              )}
            </div>
          </div>
        )}

        {/* R1390: 프로젝트 설정 뷰어 */}
        {projectInfo?.detected && (
          <div style={{ marginTop: 6 }}>
            <div
              onClick={() => setShowProjectSettings(v => !v)}
              style={{
                fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 0', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 9, transform: showProjectSettings ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>{'>'}</span>
              <span>{'⚙'} 프로젝트 설정</span>
            </div>
            {showProjectSettings && projectSettings && (
              <div style={{
                fontSize: 9, color: 'var(--text-muted)', padding: '4px 6px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 4, marginTop: 2,
                border: '1px solid var(--border)', lineHeight: 1.8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 64, flexShrink: 0 }}>디자인 해상도</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
                    {projectSettings.designWidth} x {projectSettings.designHeight}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 64, flexShrink: 0 }}>물리 엔진</span>
                  <span style={{
                    color: projectSettings.physicsEngine === 'none' ? 'var(--text-muted)' : 'var(--accent)',
                    fontFamily: 'monospace',
                  }}>
                    {projectSettings.physicsEngine || 'none'}
                  </span>
                </div>
                {projectSettings.buildTargets && projectSettings.buildTargets.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <span style={{ width: 64, flexShrink: 0 }}>빌드 타겟</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {projectSettings.buildTargets.map(t => (
                        <span key={t} style={{
                          fontSize: 8, padding: '1px 5px', borderRadius: 8,
                          background: 'rgba(96,165,250,0.15)', color: 'var(--accent)',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 64, flexShrink: 0 }}>CC 버전</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {projectInfo.version} ({projectInfo.creatorVersion})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* R1459: 씬 메타데이터 표시 */}
        {sceneFile && (() => {
          const meta = sceneFile._sceneMeta as { version?: string; canvasSize?: { width: number; height: number }; nodeCount?: number; scriptUuids?: string[]; textureUuids?: string[]; audioUuids?: string[]; hasPhysics?: boolean; hasTween?: boolean; hasAnimation?: boolean } | undefined
          if (!meta) return null
          return (
            <div style={{
              fontSize: 9, color: 'var(--text-muted)', padding: '4px 6px', marginTop: 4,
              background: 'rgba(255,255,255,0.03)', borderRadius: 4,
              border: '1px solid var(--border)', lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-primary)', marginBottom: 2 }}>{'📊'} 씬 메타</div>
              <div>노드: <b>{meta.nodeCount ?? 0}</b></div>
              <div>캔버스: {meta.canvasSize?.width}x{meta.canvasSize?.height}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {meta.hasPhysics && <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Physics</span>}
                {meta.hasAnimation && <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 8, background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>Animation</span>}
                {meta.hasTween && <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 8, background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Tween</span>}
              </div>
              {(meta.scriptUuids?.length ?? 0) > 0 && <div>스크립트: {meta.scriptUuids?.length}개</div>}
              {(meta.textureUuids?.length ?? 0) > 0 && <div>텍스처: {meta.textureUuids?.length}개</div>}
              {(meta.audioUuids?.length ?? 0) > 0 && <div>오디오: {meta.audioUuids?.length}개</div>}
            </div>
          )
        })()}

        {/* R1394: 새 씬 만들기 버튼 + 인라인 폼 */}
        {projectInfo?.detected && (
          <div style={{ marginTop: 6 }}>
            {!showNewSceneForm ? (
              <button
                onClick={() => setShowNewSceneForm(true)}
                style={{
                  padding: '3px 8px', fontSize: 10, cursor: 'pointer',
                  background: 'rgba(96,165,250,0.12)', color: 'var(--accent)',
                  border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 12, lineHeight: 1 }}>+</span> 새 씬 만들기
              </button>
            ) : (
              <div style={{
                padding: '6px 8px', background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)', borderRadius: 4,
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <input
                  value={newSceneName}
                  onChange={e => setNewSceneName(e.target.value)}
                  placeholder="씬 이름"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateScene(); if (e.key === 'Escape') setShowNewSceneForm(false) }}
                  autoFocus
                  style={{
                    padding: '3px 6px', fontSize: 10,
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 3,
                  }}
                />
                <div style={{ display: 'flex', gap: 4, fontSize: 9 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <input type="radio" name="scnTpl" checked={newSceneTemplate === 'empty'} onChange={() => setNewSceneTemplate('empty')} style={{ margin: 0 }} />
                    빈 씬
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <input type="radio" name="scnTpl" checked={newSceneTemplate === 'canvas'} onChange={() => setNewSceneTemplate('canvas')} style={{ margin: 0 }} />
                    Canvas 포함
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={handleCreateScene}
                    disabled={!newSceneName.trim()}
                    style={{
                      flex: 1, padding: '3px 6px', fontSize: 10, cursor: 'pointer',
                      background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 3,
                      opacity: newSceneName.trim() ? 1 : 0.5,
                    }}
                  >생성</button>
                  <button
                    onClick={() => setShowNewSceneForm(false)}
                    style={{
                      padding: '3px 6px', fontSize: 10, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: 3,
                    }}
                  >취소</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ISSUE-011: 씬/프리팹 별도 드롭다운 */}
        {projectInfo?.scenes && projectInfo.scenes.filter(s => !s.endsWith('.prefab')).length > 0 && (
          <select
            value={selectedScene.endsWith('.prefab') ? '' : selectedScene}
            onChange={e => handleSceneChange(e.target.value)}
            style={{
              width: '100%', marginTop: 6, padding: '3px 6px', fontSize: 10,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4,
            }}
          >
            <option value="">씬 선택...</option>
            {projectInfo.scenes.filter(s => !s.endsWith('.prefab')).map(s => (
              <option key={s} value={s}>{s.split(/[\\/]/).pop()}</option>
            ))}
          </select>
        )}
        {projectInfo?.scenes && projectInfo.scenes.filter(s => s.endsWith('.prefab')).length > 0 && (
          <select
            value={selectedScene.endsWith('.prefab') ? selectedScene : ''}
            onChange={e => handleSceneChange(e.target.value)}
            style={{
              width: '100%', marginTop: 4, padding: '3px 6px', fontSize: 10,
              background: 'var(--bg-input)', color: '#a78bfa',
              border: '1px solid rgba(167,139,250,0.3)', borderRadius: 4,
            }}
          >
            <option value="" style={{ color: 'var(--text-primary)' }}>프리팹 선택...</option>
            {projectInfo.scenes.filter(s => s.endsWith('.prefab')).map(s => (
              <option key={s} value={s}>{s.split(/[\\/]/).pop()}</option>
            ))}
          </select>
        )}

        {/* R1366+R1370+R1466: 최근 씬 파일 목록 (최대 8개, 현재 씬 체크 표시, 썸네일) */}
        {recentSceneFiles.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>최근 씬</div>
            {recentSceneFiles.map(p => {
              const isCurrent = sceneFile?.scenePath === p
              const thumbKey = p.replace(/[\\/]/g, '_')
              const thumb = sceneThumbnails[thumbKey]
              return (
                <div
                  key={p}
                  onClick={() => { loadScene(p); addRecentScene(p) }}
                  style={{ fontSize: 11, cursor: 'pointer', color: isCurrent ? 'var(--success)' : 'var(--accent)', padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
                  title={p}
                >
                  {/* R1466: 씬 썸네일 (80x60 base64) */}
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: 24, height: 18, borderRadius: 2, flexShrink: 0, objectFit: 'cover', border: '1px solid var(--border)' }} />
                  ) : (
                    <span style={{ fontSize: 10, flexShrink: 0, width: 24, textAlign: 'center' }}>{'\uD83D\uDCC4'}</span>
                  )}
                  {isCurrent && <span style={{ fontSize: 10, flexShrink: 0 }}>{'✓'}</span>}
                  <span>{p.split(/[\\/]/).pop()}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* R1376: Claude 컨텍스트 주입 토글 */}
        {sceneFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '3px 0' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>Claude 컨텍스트 주입</span>
            <BoolToggle value={ccCtxInject} onChange={v => { setCcCtxInject(v); localStorage.setItem('cc-ctx-inject', String(v)) }} />
          </div>
        )}

        {/* 저장 / undo/redo / 백업 복원 버튼 */}
        {sceneFile?.root && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              title="씬 파일 저장 (.bak 자동 백업)"
              style={{
                flex: 1, padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: saving ? 'not-allowed' : 'pointer',
                background: 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중...' : '💾 저장'}
            </button>
            {/* R2327: 다른 이름으로 저장 */}
            <button
              onClick={async () => {
                if (!sceneFile?.root) return
                const result = await window.api.ccFileSaveAs?.(sceneFile, sceneFile.root)
                if (result?.success) setSaveMsg({ ok: true, text: `저장: ${result.savedPath?.split(/[\\/]/).pop()}` })
                else if (!result?.canceled) setSaveMsg({ ok: false, text: result?.error ?? '저장 실패' })
              }}
              title="다른 이름으로 저장 (Save As)"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >💾⬆</button>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3,
                cursor: canUndo ? 'pointer' : 'not-allowed',
                background: 'none', border: '1px solid var(--border)',
                color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: canUndo ? 1 : 0.4,
              }}
            >
              {/* R2321: undo 카운터 */}
              ↩{undoCount && undoCount > 0 ? <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.7 }}>{undoCount}</span> : null}
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Y)"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3,
                cursor: canRedo ? 'pointer' : 'not-allowed',
                background: 'none', border: '1px solid var(--border)',
                color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: canRedo ? 1 : 0.4,
              }}
            >
              {/* R2321: redo 카운터 */}
              ↪{redoCount && redoCount > 0 ? <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.7 }}>{redoCount}</span> : null}
            </button>
            <button
              onClick={handleRestore}
              title=".bak 백업 파일에서 복원"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >
              .bak
            </button>
          </div>
        )}
        {saveMsg && (
          <div style={{
            marginTop: 4, fontSize: 10, padding: '3px 6px', borderRadius: 3,
            background: saveMsg.ok ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
            color: saveMsg.ok ? 'var(--success, #3fb950)' : 'var(--error, #f85149)',
          }}>
            {saveMsg.text}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--error, #f85149)', lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        {/* R1423: 백업 파일 관리 섹션 */}
        {sceneFile?.scenePath && <BackupManager scenePath={sceneFile.scenePath} onRestored={() => loadScene(sceneFile.scenePath)} />}

        {/* R1418: 씬 유효성 검사 버튼 */}
        {sceneFile?.root && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => {
                const issues = validateScene(sceneFile.root)
                setValidationIssues(issues)
                setShowValidationResults(true)
                // R1441: 최적화 제안 생성
                let totalN = 0, activeN = 0, maxD = 0
                const compCounts: Record<string, number> = {}
                function walk(n: CCSceneNode, d: number) {
                  totalN++; if (n.active) activeN++; if (d > maxD) maxD = d
                  for (const c of n.components) compCounts[c.type] = (compCounts[c.type] ?? 0) + 1
                  for (const ch of n.children) walk(ch, d + 1)
                }
                walk(sceneFile.root, 0)
                const dcTypes = ['cc.Label', 'cc.Sprite', 'cc.Sprite2D', 'cc.RichText', 'cc.Graphics']
                const dc = dcTypes.reduce((s, t) => s + (compCounts[t] ?? 0), 0)
                const sug: OptimizationSuggestion[] = []
                if (dc > 50) sug.push({ type: 'performance', severity: dc > 100 ? 'high' : 'medium', message: `Draw Call이 ${dc}개입니다. Sprite Atlas 사용 권장` })
                if (totalN > 500) sug.push({ type: 'memory', severity: totalN > 1000 ? 'high' : 'medium', message: `노드가 너무 많습니다 (${totalN}개). 오브젝트 풀링 고려` })
                if (maxD > 10) sug.push({ type: 'structure', severity: maxD > 20 ? 'high' : 'medium', message: `씬 계층이 깊습니다 (최대 ${maxD}). 구조 단순화 권장` })
                const inact = totalN - activeN; const ratio = totalN > 0 ? inact / totalN : 0
                if (ratio > 0.3) sug.push({ type: 'memory', severity: ratio > 0.5 ? 'high' : 'medium', message: `비활성 노드 비율이 높습니다 (${Math.round(ratio * 100)}%). 불필요한 노드 정리 권장` })
                setOptimizationSuggestions(sug)
              }}
              style={{
                width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: 'pointer', background: 'none',
                border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >
              {'\uD83D\uDD0D'} 씬 검사
            </button>
            {showValidationResults && (
              <div style={{ marginTop: 4, maxHeight: 160, overflowY: 'auto', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                {validationIssues.length === 0 ? (
                  <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--success, #3fb950)' }}>
                    {'\u2705'} 문제 없음
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{validationIssues.filter(i => i.level === 'error').length} 오류 / {validationIssues.filter(i => i.level === 'warning').length} 경고</span>
                      <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowValidationResults(false)}>x</span>
                    </div>
                    {validationIssues.map((issue, i) => (
                      <div key={i} style={{
                        padding: '3px 8px', fontSize: 9, borderBottom: '1px solid rgba(255,255,255,0.04)',
                        color: issue.level === 'error' ? 'var(--error, #f85149)' : '#fbbf24',
                        display: 'flex', alignItems: 'flex-start', gap: 4,
                      }}>
                        <span style={{ flexShrink: 0 }}>{issue.level === 'error' ? '\uD83D\uDD34' : '\uD83D\uDFE1'}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={issue.message}>{issue.message}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* R1441: 최적화 제안 표시 */}
        {showValidationResults && optimizationSuggestions.length > 0 && (
          <div style={{ marginTop: 4, borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
              {'\uD83D\uDCA1'} 최적화 제안 ({optimizationSuggestions.length})
            </div>
            {optimizationSuggestions.map((s, i) => (
              <div key={i} style={{
                padding: '3px 8px', fontSize: 9, borderBottom: '1px solid rgba(255,255,255,0.04)',
                color: s.severity === 'high' ? '#f87171' : s.severity === 'medium' ? '#fbbf24' : '#94a3b8',
                display: 'flex', alignItems: 'flex-start', gap: 4,
              }}>
                <span style={{ flexShrink: 0, fontSize: 8, padding: '1px 3px', borderRadius: 2, background: s.type === 'performance' ? 'rgba(239,68,68,0.15)' : s.type === 'memory' ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.15)', color: s.type === 'performance' ? '#fca5a5' : s.type === 'memory' ? '#fde68a' : '#93c5fd' }}>
                  {s.type === 'performance' ? 'PERF' : s.type === 'memory' ? 'MEM' : 'STRUCT'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.message}>{s.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* R1684: 씬 컴포넌트 통계 */}
        {sceneFile?.root && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => setShowSceneStats(v => !v)}
              style={{ width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3, cursor: 'pointer', background: showSceneStats ? 'rgba(88,166,255,0.1)' : 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >📊 씬 통계</button>
            {showSceneStats && (() => {
              const counts: Record<string, number> = {}
              let total = 0, active = 0
              function walkStats(n: CCSceneNode) {
                total++; if (n.active !== false) active++
                n.components.forEach(c => { counts[c.type] = (counts[c.type] ?? 0) + 1 })
                n.children.forEach(walkStats)
              }
              walkStats(sceneFile.root)
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15)
              const maxCount = sorted[0]?.[1] ?? 1
              const totalComps = Object.values(counts).reduce((s, v) => s + v, 0)
              // R2344: 컴포넌트 타입별 색상 (바 시각화)
              const barColor = (type: string) => {
                if (type.startsWith('cc.Label') || type.startsWith('cc.RichText')) return '#58a6ff'
                if (type.startsWith('cc.Sprite')) return '#4ade80'
                if (type.startsWith('cc.Button') || type.startsWith('cc.Toggle') || type.startsWith('cc.Slider')) return '#fb923c'
                if (type.startsWith('cc.Layout') || type.startsWith('cc.Widget')) return '#a78bfa'
                if (type.startsWith('cc.Animation') || type.startsWith('sp.') || type.startsWith('dragonBones.')) return '#f472b6'
                if (type.startsWith('cc.AudioSource')) return '#facc15'
                if (type.startsWith('cc.ScrollView') || type.startsWith('cc.PageView')) return '#34d399'
                if (type.startsWith('cc.RigidBody') || type.startsWith('cc.BoxCollider') || type.startsWith('cc.CircleCollider')) return '#f87171'
                return '#94a3b8'
              }
              return (
                <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', fontSize: 9 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>노드: <span style={{ color: '#c9d1d9' }}>{total}</span> (활성 {active}) · 컴포넌트 <span style={{ color: '#c9d1d9' }}>{totalComps}</span></span>
                    <span style={{ cursor: 'pointer', color: '#555' }} onClick={() => setShowSceneStats(false)}>✕</span>
                  </div>
                  {sorted.map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: 88, flexShrink: 0 }} title={type}>{type.includes('.') ? type.split('.').pop() : type}</span>
                      {/* R2344: 인라인 바 시각화 */}
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 2, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(count / maxCount * 100)}%`, height: '100%', background: barColor(type), borderRadius: 2, transition: 'width 0.2s' }} />
                      </div>
                      <span style={{ color: barColor(type), flexShrink: 0, width: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* R1454: 씬 일괄 처리 */}
        {sceneFile?.root && (
          <div style={{ marginTop: 4, position: 'relative' }}>
            <button
              onClick={() => setShowBatchMenu(v => !v)}
              style={{
                width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: 'pointer', background: showBatchMenu ? 'rgba(96,165,250,0.15)' : 'none',
                border: '1px solid var(--border)', color: showBatchMenu ? '#93c5fd' : 'var(--text-muted)',
              }}
            >
              {'\uD83D\uDD27'} 일괄 처리
            </button>
            {showBatchMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}>
                <button
                  onClick={handleBatchFontSize}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >모든 Label 폰트 크기 통일</button>
                <button
                  onClick={handleBatchRemoveInactive}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,81,73,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >모든 비활성 노드 삭제</button>
                <button
                  onClick={handleBatchNormalizeName}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >모든 노드 이름 정규화</button>
              </div>
            )}
            {batchToast && (
              <div style={{
                position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
                padding: '3px 10px', borderRadius: 4, background: 'rgba(96,165,250,0.9)',
                color: '#fff', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                pointerEvents: 'none', zIndex: 999,
              }}>{batchToast}</div>
            )}
          </div>
        )}

        {/* R1448: 씬 의존성 분석 */}
        {sceneFile?.root && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={handleAnalyzeDeps}
              disabled={depsLoading}
              style={{
                width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: depsLoading ? 'wait' : 'pointer', background: 'none',
                border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >
              {depsLoading ? '분석 중...' : '\uD83D\uDCE6 의존성 분석'}
            </button>
            {showDepsAnalysis && (
              <div style={{ marginTop: 4, maxHeight: 200, overflowY: 'auto', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{depsEntries.length} 에셋 참조 ({depsEntries.filter(d => d.missing).length} 누락)</span>
                  <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowDepsAnalysis(false)}>x</span>
                </div>
                {(() => {
                  // R1448: 타입별 그룹화
                  const TYPE_LABELS: Record<string, string> = { image: '\uD83D\uDDBC 이미지', font: '\uD83D\uDD24 폰트', audio: '\uD83D\uDD0A 오디오', script: '\uD83D\uDCDC 스크립트', unknown: '\u2753 기타' }
                  const groups: Record<string, DepEntry[]> = {}
                  for (const d of depsEntries) {
                    const group = d.missing ? 'missing' : (d.type in TYPE_LABELS ? d.type : 'unknown')
                    if (!groups[group]) groups[group] = []
                    groups[group].push(d)
                  }
                  return (
                    <>
                      {groups['missing'] && groups['missing'].length > 0 && (
                        <div>
                          <div style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, color: '#f87171', background: 'rgba(248,81,73,0.1)' }}>
                            {'\u274C'} 누락 ({groups['missing'].length})
                          </div>
                          {groups['missing'].map(d => (
                            <div key={d.uuid} style={{ padding: '2px 8px', fontSize: 9, color: '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.uuid}>
                              {d.uuid.slice(0, 12)}...
                            </div>
                          ))}
                        </div>
                      )}
                      {Object.entries(groups).filter(([k]) => k !== 'missing').map(([type, items]) => (
                        <div key={type}>
                          <div style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)' }}>
                            {TYPE_LABELS[type] ?? type} ({items.length})
                          </div>
                          {items.slice(0, 20).map(d => (
                            <div key={d.uuid} style={{ padding: '2px 8px', fontSize: 9, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.path}>
                              {d.path || d.uuid.slice(0, 12)}
                            </div>
                          ))}
                          {items.length > 20 && (
                            <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-muted)' }}>...+{items.length - 20}</div>
                          )}
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* R1414: 씬 저장 이력 타임라인 */}
        {sceneHistoryTimeline.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>저장 이력</span>
              {sceneHistoryTimeline.length > 5 && (
                <button
                  onClick={() => setShowFullHistory(v => !v)}
                  style={{ fontSize: 8, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >{showFullHistory ? '접기' : `더 보기 (${sceneHistoryTimeline.length})`}</button>
              )}
            </div>
            {(showFullHistory ? sceneHistoryTimeline : sceneHistoryTimeline.slice(0, 5)).map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, padding: '1px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span style={{ color: 'var(--text-primary)', flexShrink: 0 }}>{entry.nodeCount}N</span>
                <span style={{ color: '#555', fontSize: 8 }}>{(entry.size / 1024).toFixed(1)}KB</span>
                <button
                  disabled={!entry.snapshotKey}
                  title={entry.snapshotKey ? '이 시점으로 씬 복원' : '스냅샷 없음 (이전 방식 저장됨)'}
                  onClick={async () => {
                    if (!entry.snapshotKey || !sceneFile?.scenePath) return
                    const snap = localStorage.getItem(entry.snapshotKey)
                    if (!snap) { alert('스냅샷 데이터가 없습니다.'); return }
                    const timeStr = new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    if (!window.confirm(`${timeStr} 시점으로 씬을 복원하시겠습니까?\n현재 저장되지 않은 변경사항이 손실됩니다.`)) return
                    try {
                      const formatted = JSON.stringify(JSON.parse(snap), null, 2)
                      const res = await window.api.writeTextFile?.(sceneFile.scenePath, formatted)
                      if (res && 'error' in res) { alert('복원 실패: ' + res.error); return }
                      loadScene(sceneFile.scenePath)
                    } catch (e) { alert('복원 오류: ' + String(e)) }
                  }}
                  style={{ marginLeft: 'auto', fontSize: 8, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: entry.snapshotKey ? 'var(--accent)' : 'var(--text-muted)', cursor: entry.snapshotKey ? 'pointer' : 'default', opacity: entry.snapshotKey ? 1 : 0.4 }}
                >복원</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 씬/에셋 탭 바 */}
      {projectInfo?.detected && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['scene', 'groups', 'assets', 'build'] as const).map(t => (
            <button key={t} onClick={() => setMainTab(t)}
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, border: 'none', cursor: 'pointer',
                background: mainTab === t ? 'var(--bg-primary)' : 'transparent',
                color: mainTab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: mainTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: mainTab === t ? 600 : 400,
              }}
            >{t === 'scene' ? '🎬 씬' : t === 'groups' ? '📦 그룹' : t === 'assets' ? '📁 에셋' : '🔨 빌드'}</button>
          ))}
        </div>
      )}

      {/* 씬 파싱 결과 — SceneView + TreeView + Inspector */}
      {/* R1470: Cocos 에디터 레이아웃 — 좌(계층) | 우(씬뷰+인스펙터) 수평 분할 */}
      {mainTab === 'scene' && sceneFile?.root && (
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, userSelect: hDividerDragRef.current || dividerDragRef.current ? 'none' : undefined }}
          onMouseMove={e => {
            if (hDividerDragRef.current) {
              const dx = e.clientX - hDividerDragRef.current.startX
              const newW = Math.max(100, Math.min(400, hDividerDragRef.current.startW + dx))
              setHierarchyWidth(newW)
              localStorage.setItem('cc-hierarchy-width', String(newW))
            }
            if (dividerDragRef.current) {
              const dy = e.clientY - dividerDragRef.current.startY
              setSceneViewHeight(Math.max(120, Math.min(500, dividerDragRef.current.startH - dy)))
            }
          }}
          onMouseUp={() => { hDividerDragRef.current = null; dividerDragRef.current = null }}
          onMouseLeave={() => { hDividerDragRef.current = null; dividerDragRef.current = null }}
        >
          {/* ── 좌: 계층(Hierarchy) 패널 ── */}
          <div style={{ width: hierarchyWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            {/* 헤더 */}
            <div style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
              {/* R1472: 프리팹 편집 모드 배지 */}
              <span style={{ fontSize: 9, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: sceneFile.scenePath.endsWith('.prefab') ? '#f0a' : 'var(--text-muted)' }}>
                {sceneFile.scenePath.endsWith('.prefab') ? '🧩 프리팹' : '계층'}
              </span>
              {(() => {
                let nodes = 0; let inactive = 0; let comps = 0
                const typeMap: Record<string, number> = {}
                function count(n: CCSceneNode) { nodes++; if (!n.active) inactive++; comps += n.components.length; n.components.forEach(c => { typeMap[c.type] = (typeMap[c.type] ?? 0) + 1 }); n.children.forEach(count) }
                count(sceneFile.root)
                // R1625: Top 3 컴포넌트 타입 칩
                const topTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).slice(0, 3)
                // R1627: 씬 성능 경고
                const warns: string[] = []
                if (nodes > 200) warns.push(`노드 수 과다 (${nodes})`)
                if (comps > 500) warns.push(`컴포넌트 수 과다 (${comps})`)
                if (inactive > nodes * 0.5 && nodes > 10) warns.push(`비활성 노드 과다 (${inactive}/${nodes})`)
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#555', flexShrink: 0 }} title={`노드 ${nodes}개 / 비활성 ${inactive}개 / 컴포넌트 ${comps}개`}>
                    {nodes}N/{comps}C
                    {/* R1639: 컴포넌트 칩 클릭 → 첫 번째 해당 타입 노드 선택 */}
                    {topTypes.map(([type, cnt]) => (
                      <span key={type}
                        onClick={() => {
                          const walk = (n: CCSceneNode): CCSceneNode | null => {
                            if (n.components?.some(c => c.type === type)) return n
                            for (const child of n.children) { const found = walk(child); if (found) return found }
                            return null
                          }
                          const found = walk(sceneFile.root)
                          if (found) onSelectNode(found)
                        }}
                        style={{ background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.25)', borderRadius: 3, padding: '0 3px', color: '#58a6ff', fontSize: 8, cursor: 'pointer' }} title={`${type} — 클릭: 첫 번째 노드 선택`}>
                        {type.replace('cc.', '')}:{cnt}
                      </span>
                    ))}
                    {warns.length > 0 && (
                      <span style={{ background: 'rgba(255,153,0,0.12)', border: '1px solid rgba(255,153,0,0.35)', borderRadius: 3, padding: '0 3px', color: '#ff9900', fontSize: 8, cursor: 'default' }} title={warns.join('\n')}>
                        ⚠{warns.length}
                      </span>
                    )}
                  </span>
                )
              })()}
              {/* R1514: 프리팹 삽입 버튼 */}
              {projectInfo.scenes.some(s => s.endsWith('.prefab')) && (
                <span
                  onClick={() => setPrefabPickerOpen(p => !p)}
                  title="프리팹 삽입 (🧩)"
                  style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: prefabPickerOpen ? '#a78bfa' : '#666', position: 'relative' }}
                >
                  {insertingPrefab ? '⟳' : '🧩'}
                  {prefabPickerOpen && (
                    <div style={{
                      position: 'absolute', top: 18, right: 0, zIndex: 999,
                      background: 'var(--panel-bg, #16213e)', border: '1px solid var(--border)',
                      borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: 180, maxHeight: 200, overflowY: 'auto',
                    }}
                    onMouseLeave={() => setPrefabPickerOpen(false)}
                    >
                      <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>프리팹 선택</div>
                      {projectInfo.scenes.filter(s => s.endsWith('.prefab')).map(p => (
                        <div
                          key={p}
                          onClick={e => { e.stopPropagation(); handleInsertPrefab(p) }}
                          style={{ padding: '5px 10px', fontSize: 10, cursor: 'pointer', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.15)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          title={p}
                        >
                          🧩 {p.replace(/\\/g, '/').split('/').pop()}
                        </div>
                      ))}
                    </div>
                  )}
                </span>
              )}
              <span onClick={expandAll} title="전체 펼치기" style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: '#666' }}>⊞</span>
              <span onClick={collapseAll} title="전체 접기" style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: '#666' }}>⊟</span>
              {/* R1710: 씬 트리 구조 텍스트 복사 */}
              <span
                title="씬 트리 구조 텍스트 복사 (R1710)"
                onClick={() => {
                  if (!sceneFile?.root) return
                  const lines: string[] = []
                  function walk(n: CCSceneNode, depth: number) {
                    const indent = '  '.repeat(depth)
                    const comps = n.components.length > 0 ? ` (${n.components.map(c => c.type.includes('.') ? c.type.split('.').pop() : c.type).join(', ')})` : ''
                    lines.push(`${indent}${n.active ? '' : '◌ '}${n.name || '(unnamed)'}${comps}`)
                    n.children.forEach(c => walk(c, depth + 1))
                  }
                  walk(sceneFile.root, 0)
                  navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
                }}
                style={{ cursor: 'pointer', fontSize: 9, flexShrink: 0, color: '#666' }}
              >⎘</span>
              {/* R1655: 깊이 N까지 펼치기 */}
              {([1, 2, 3] as const).map(d => (
                <span key={d} onClick={() => collapseToDepth(d)} title={`깊이 ${d}까지 펼치기`} style={{ cursor: 'pointer', fontSize: 9, flexShrink: 0, color: '#666', fontWeight: 700 }}>D{d}</span>
              ))}
              <span
                onClick={() => setHideInactive(h => !h)}
                title={hideInactive ? '비활성 노드 표시' : '비활성 노드 숨기기'}
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: hideInactive ? '#58a6ff' : '#666' }}
              >{hideInactive ? '◑' : '●'}</span>
              {/* R1715: 색상 태그 필터 */}
              {Object.values(nodeColors).length > 0 && (() => {
                const usedColors = [...new Set(Object.values(nodeColors).filter(Boolean))]
                return usedColors.map(color => (
                  <span key={color}
                    title={`색상 태그 필터: ${color === colorTagFilter ? '해제' : color}`}
                    onClick={() => setColorTagFilter(colorTagFilter === color ? null : color)}
                    style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', cursor: 'pointer', flexShrink: 0, border: colorTagFilter === color ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)', boxSizing: 'border-box' }}
                  />
                ))
              })()}
              {/* R1654: 컴포넌트 필터 토글 버튼 */}
              <span
                onClick={() => setShowNodeFilters(v => !v)}
                title={nodeFilters.length > 0 ? `컴포넌트 필터 활성 (${nodeFilters.length})` : '컴포넌트 타입 필터'}
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: nodeFilters.length > 0 ? '#58a6ff' : showNodeFilters ? '#aaa' : '#666' }}
              >⊳</span>
              {/* R1729: cc.Label Find & Replace 토글 */}
              <span
                onClick={() => setShowLabelReplace(v => !v)}
                title="cc.Label 텍스트 찾기/바꾸기 (R1729)"
                style={{ cursor: 'pointer', fontSize: 9, flexShrink: 0, color: showLabelReplace ? '#58a6ff' : '#666', fontWeight: showLabelReplace ? 700 : 400, letterSpacing: -0.5 }}
              >ab</span>
            </div>
            {/* 검색 */}
            <div style={{ padding: '2px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <TreeSearch root={sceneFile.root} onSelect={onSelectNode} onQueryChange={setTreeHighlightQuery} />
            </div>
            {/* R1678: 최근 선택 노드 히스토리 칩 */}
            {recentNodes.length > 1 && (
              <div style={{ padding: '2px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: '#444', flexShrink: 0 }}>◷</span>
                {recentNodes.slice(1).map(r => {
                  const n = nodeMap.get(r.uuid)
                  if (!n) return null
                  return (
                    <span
                      key={r.uuid}
                      onClick={() => onSelectNode(n)}
                      title={r.name}
                      style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'none', userSelect: 'none', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                    >{r.name || '(unnamed)'}</span>
                  )
                })}
              </div>
            )}
            {/* R2345: 노드 북마크 퀵액세스 바 (Ctrl+1-9 설정, 1-9 이동) */}
            {Object.keys(nodeBookmarks).length > 0 && (
              <div style={{ padding: '2px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: '#444', flexShrink: 0 }}>🔖</span>
                {Object.entries(nodeBookmarks).sort(([a], [b]) => a.localeCompare(b)).map(([key, uuid]) => {
                  const n = nodeMap.get(uuid)
                  if (!n) return null
                  const isSelected = selectedNode?.uuid === uuid
                  return (
                    <span
                      key={key}
                      onClick={() => { const found = nodeMap.get(uuid); if (found) onSelectNode(found) }}
                      onContextMenu={e => { e.preventDefault(); setNodeBookmarks(prev => { const next = { ...prev }; delete next[key]; return next }) }}
                      title={`[${key}] ${n.name} — 클릭: 이동, 우클릭: 북마크 제거`}
                      style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${isSelected ? '#f472b6' : 'rgba(244,114,182,0.3)'}`, color: isSelected ? '#f472b6' : 'rgba(244,114,182,0.7)', background: isSelected ? 'rgba(244,114,182,0.1)' : 'none', userSelect: 'none', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    ><span style={{ opacity: 0.6, fontWeight: 700 }}>{key}</span>{n.name || '(unnamed)'}</span>
                  )
                })}
              </div>
            )}
            {/* R1654: 컴포넌트 필터 패널 */}
            {showNodeFilters && (
              <div style={{ padding: '3px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                  {(['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.Widget', 'cc.Layout', 'cc.Animation', 'cc.AudioSource', 'cc.ScrollView'] as const).map(ct => {
                    const active = nodeFilters.includes(ct)
                    return (
                      <span
                        key={ct}
                        onClick={() => setNodeFilters(prev => active ? prev.filter(f => f !== ct) : [...prev, ct])}
                        style={{
                          fontSize: 8, padding: '1px 4px', borderRadius: 2, cursor: 'pointer',
                          border: `1px solid ${active ? '#58a6ff' : 'var(--border)'}`,
                          color: active ? '#58a6ff' : 'var(--text-muted)',
                          background: active ? 'rgba(88,166,255,0.1)' : 'none', userSelect: 'none',
                        }}
                      >{ct.split('.').pop()}</span>
                    )
                  })}
                  {nodeFilters.length > 0 && (
                    <span onClick={() => setNodeFilters([])} title="필터 초기화" style={{ fontSize: 9, cursor: 'pointer', color: '#f85149', userSelect: 'none' }}>✕</span>
                  )}
                </div>
                {/* R1667: custom type 입력 */}
                <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                  <input
                    placeholder="custom type (예: MyScript)"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = (e.currentTarget.value ?? '').trim()
                        if (val && !nodeFilters.includes(val)) setNodeFilters(prev => [...prev, val])
                        e.currentTarget.value = ''
                      }
                    }}
                    style={{ flex: 1, fontSize: 8, padding: '1px 4px', background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                  />
                </div>
                {nodeFilters.filter(f => !['cc.Label','cc.Sprite','cc.Button','cc.Toggle','cc.Slider','cc.Widget','cc.Layout','cc.Animation','cc.AudioSource','cc.ScrollView'].includes(f)).map(ct => (
                  <span key={ct} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 8, marginTop: 2, padding: '1px 4px', border: '1px solid #a78bfa', borderRadius: 2, color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }}>
                    {ct}
                    <span onClick={() => setNodeFilters(prev => prev.filter(f => f !== ct))} style={{ cursor: 'pointer', color: '#f85149' }}>✕</span>
                  </span>
                ))}
              </div>
            )}
            {/* R1729: cc.Label Find & Replace 패널 */}
            {showLabelReplace && (
              <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>찾기</span>
                  <input
                    value={labelFindText}
                    onChange={e => setLabelFindText(e.target.value)}
                    placeholder="찾을 텍스트..."
                    style={{ flex: 1, fontSize: 10, padding: '2px 4px', background: 'var(--input-bg, rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, flexShrink: 0 }}>바꿈</span>
                  <input
                    value={labelReplaceText}
                    onChange={e => setLabelReplaceText(e.target.value)}
                    placeholder="바꿀 텍스트..."
                    style={{ flex: 1, fontSize: 10, padding: '2px 4px', background: 'var(--input-bg, rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', flex: 1 }}>
                    {labelFindText.trim() ? `${labelReplaceMatches.length}개 매칭` : 'cc.Label 텍스트 일괄 치환'}
                  </span>
                  {labelReplaceMatches.length > 0 && (
                    <span
                      onClick={handleLabelReplaceAll}
                      title={`${labelReplaceMatches.length}개 cc.Label에서 "${labelFindText}" → "${labelReplaceText}" 교체`}
                      style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, cursor: 'pointer', background: 'rgba(88,166,255,0.15)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.3)', userSelect: 'none' }}
                    >전체 교체 ({labelReplaceMatches.length})</span>
                  )}
                </div>
              </div>
            )}
            {/* R1559: 씬 파일명 + 통계 */}
            {(() => {
              const statsMap: Record<string, number> = {}
              // R1731: 컴포넌트별 노드 uuid 맵
              const compNodeUuids: Record<string, string[]> = {}
              let nodeCount = 0
              // R1718: 비활성 노드 카운트
              let inactiveCount = 0
              const inactiveUuids: string[] = []
              const walkStats = (n: CCSceneNode) => {
                nodeCount++
                if (!n.active) { inactiveCount++; inactiveUuids.push(n.uuid) }
                n.components.forEach(c => {
                  statsMap[c.type] = (statsMap[c.type] ?? 0) + 1
                  // R1731: uuid 수집
                  if (!compNodeUuids[c.type]) compNodeUuids[c.type] = []
                  compNodeUuids[c.type].push(n.uuid)
                })
                n.children.forEach(walkStats)
              }
              walkStats(sceneFile.root)
              const topComps = Object.entries(statsMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
              return (
                <div style={{ padding: '2px 6px', fontSize: 9, color: '#555', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  {/* R2322: 클릭으로 파일 탐색기에서 열기 */}
                  <div
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    title={`탐색기에서 열기: ${sceneFile.scenePath}`}
                    onClick={() => {
                      const winPath = sceneFile.scenePath.replace(/\//g, '\\')
                      window.api.shellExec?.(`explorer /select,"${winPath}"`)
                    }}
                  >
                    {sceneFile.scenePath.split(/[\\/]/).pop()}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 1 }}>
                    <span style={{ color: '#58a6ff' }}>{nodeCount}nodes</span>
                    {/* R1718: 비활성 노드 배지 */}
                    {inactiveCount > 0 && (
                      <span
                        // R1731: 클릭으로 비활성 노드 모두 선택
                        onClick={() => {
                          const first = nodeMap.get(inactiveUuids[0])
                          if (first) { onSelectNode(first); setMultiSelectedUuids(inactiveUuids) }
                        }}
                        style={{ color: '#888', cursor: 'pointer' }} title={`비활성 노드 ${inactiveCount}개 — 클릭으로 모두 선택`}
                      >{inactiveCount}◌</span>
                    )}
                    {topComps.map(([type, cnt]) => (
                      // R1731: 클릭으로 해당 컴포넌트 노드 모두 선택
                      <span
                        key={type}
                        onClick={() => {
                          const uuids = compNodeUuids[type] ?? []
                          const first = uuids.length > 0 ? nodeMap.get(uuids[0]) : null
                          if (first) { onSelectNode(first); setMultiSelectedUuids(uuids) }
                        }}
                        title={`${type} 보유 노드 ${cnt}개 — 클릭으로 모두 선택 (R1731)`}
                        style={{ color: '#666', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                      >{type.split('.').pop()}×{cnt}</span>
                    ))}
                  </div>
                </div>
              )
            })()}
            {/* 즐겨찾기 */}
            {favorites.size > 0 && (
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 2, flexShrink: 0 }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', padding: '1px 6px' }}>★ 즐겨찾기</div>
                {[...favorites].map(uuid => {
                  const favNode = nodeMap.get(uuid)
                  if (!favNode) return null
                  return (
                    <div key={uuid} style={{ paddingLeft: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} onClick={() => onSelectNode(favNode)}>
                      <span style={{ color: '#fbbf24', fontSize: 9 }}>★</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{favNode.name}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {/* 씬 트리 */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <CCFileSceneTree
                node={filteredRoot ?? sceneFile.root}
                depth={0}
                selected={selectedNode}
                onSelect={onSelectNode}
                onReparent={handleReparent}
                onAddChild={handleTreeAddChild}
                onDelete={handleTreeDelete}
                onDuplicate={handleTreeDuplicate}
                onToggleActive={handleTreeToggleActive}
                hideInactive={hideInactive}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                lockedUuids={lockedUuids}
                onToggleLocked={toggleLocked}
                nodeColors={nodeColors}
                onNodeColorChange={handleNodeColorChange}
                collapsedUuids={collapsedUuids}
                onToggleCollapse={(uuid) => setCollapsedUuids(prev => {
                  const next = new Set(prev)
                  if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
                  return next
                })}
                highlightQuery={treeHighlightQuery}
                nodeBookmarks={nodeBookmarks}
                onReorder={handleReorder}
                multiSelectedUuids={multiSelectedUuids}
                onCtrlSelect={uuid => setMultiSelectedUuids(prev =>
                  prev.includes(uuid) ? prev.filter(u => u !== uuid) : [...prev, uuid]
                )}
                onSortChildren={handleSortChildren}
                onRename={handleRenameInView}
                onSaveAsPrefab={handleSaveAsPrefab}
                outOfCanvasUuids={outOfCanvasUuids}
              />
            </div>
          </div>

          {/* 수평 리사이즈 핸들 */}
          <div
            style={{ width: 4, cursor: 'ew-resize', background: 'var(--border)', flexShrink: 0, opacity: 0.4, transition: 'opacity 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
            onMouseLeave={e => { if (!hDividerDragRef.current) { (e.currentTarget as HTMLElement).style.opacity = '0.4'; (e.currentTarget as HTMLElement).style.background = 'var(--border)' } }}
            onMouseDown={e => { e.preventDefault(); hDividerDragRef.current = { startX: e.clientX, startW: hierarchyWidth } }}
          />

          {/* ── 우: SceneView(상) + Inspector(하) ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* R1501: 마지막 저장 diff 알림 배너 */}
            {lastDiffDisplay && (
              <div style={{
                fontSize: 9, padding: '2px 8px', background: 'rgba(74,222,128,0.08)', borderBottom: '1px solid rgba(74,222,128,0.2)',
                color: '#4ade80', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                ✓ {lastDiffDisplay}
              </div>
            )}
            {/* R2474: 핀 노드 빠른 선택 바 */}
            {pinnedNodes.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(251,191,36,0.05)', borderBottom: '1px solid rgba(251,191,36,0.2)', flexShrink: 0, flexWrap: 'wrap', maxHeight: 36, overflow: 'hidden' }}>
                <span style={{ fontSize: 8, color: '#fbbf24', flexShrink: 0 }}>📌</span>
                {pinnedNodes.map(p => (
                  <span
                    key={p.uuid}
                    onClick={() => {
                      const fn = sceneFile?.root && (function find(n: CCSceneNode): CCSceneNode | null { if (n.uuid === p.uuid) return n; for (const c of n.children) { const f = find(c); if (f) return f } return null })(sceneFile.root)
                      if (fn) onSelectNode(fn)
                    }}
                    onContextMenu={e => { e.preventDefault(); togglePinNode(p.uuid, p.name) }}
                    title={`${p.name} 선택 / 우클릭: 핀 해제 (R2474)`}
                    style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,191,36,0.4)', background: selectedNode?.uuid === p.uuid ? 'rgba(251,191,36,0.2)' : 'none', color: selectedNode?.uuid === p.uuid ? '#fbbf24' : '#a88a44', flexShrink: 0, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >{p.name}</span>
                ))}
              </div>
            )}
            {/* R2488: 복제 오프셋 설정 바 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border)', flexShrink: 0, fontSize: 9, color: 'var(--text-muted)' }}>
              <span title="복제(Ctrl+D) 위치 오프셋 (R2488)" style={{ flexShrink: 0 }}>Δ복제</span>
              <span>X</span>
              <input type="number" value={dupeOffsetX} onChange={e => saveDupeOffset(parseInt(e.target.value) || 0, dupeOffsetY)}
                style={{ width: 38, fontSize: 9, padding: '0 3px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                title="복제 X 오프셋 (R2488)" />
              <span>Y</span>
              <input type="number" value={dupeOffsetY} onChange={e => saveDupeOffset(dupeOffsetX, parseInt(e.target.value) || 0)}
                style={{ width: 38, fontSize: 9, padding: '0 3px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                title="복제 Y 오프셋 (R2488)" />
              <span style={{ color: 'var(--border)', fontSize: 10 }}>|</span>
              {([0, 10, 20, 50] as const).map(v => (
                <span key={v} onClick={() => saveDupeOffset(v, v)} title={`Δ${v}px`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '0 3px', borderRadius: 2, border: '1px solid var(--border)', color: dupeOffsetX === v && dupeOffsetY === v ? '#58a6ff' : 'var(--text-muted)' }}
                >{v}</span>
              ))}
            </div>
            {/* SceneView — flex:1 (남은 공간 전부) */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <CCFileSceneView
                sceneFile={sceneFile}
                selectedUuid={selectedNode?.uuid ?? null}
                onMove={handleNodeMove}
                onResize={handleNodeResize}
                onRename={handleRenameInView}
                onRotate={handleNodeRotate}
                onMultiMove={handleMultiMove}
                onMultiDelete={handleMultiDelete}
                onLabelEdit={handleLabelEdit}
                onAddNode={handleAddNode}
                onDuplicate={handleDuplicate}
                onToggleActive={handleToggleActive}
                onReorder={handleReorder}
                onAnchorMove={handleAnchorMove}
                onMultiSelectChange={setMultiSelectedUuids}
                onGroupNodes={handleGroupNodes}
                onOpacity={handleNodeOpacity}
                onReorderExtreme={handleReorderExtreme}
                onAltDrag={handleAltDrag}
                pulseUuid={pulseUuid}
                onSelect={uuid => {
                  if (!uuid) { onSelectNode(null); return }
                  const findNode = (n: CCSceneNode): CCSceneNode | null => {
                    if (n.uuid === uuid) return n
                    for (const c of n.children) { const f = findNode(c); if (f) return f }
                    return null
                  }
                  onSelectNode(findNode(sceneFile.root))
                }}
              />
            </div>
            {/* 세로 리사이즈 핸들 (인스펙터 높이) */}
            {selectedNode && (
              <div
                style={{ height: 4, cursor: 'ns-resize', background: 'var(--border)', flexShrink: 0, opacity: 0.4, transition: 'opacity 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
                onMouseLeave={e => { if (!dividerDragRef.current) { (e.currentTarget as HTMLElement).style.opacity = '0.4'; (e.currentTarget as HTMLElement).style.background = 'var(--border)' } }}
                onMouseDown={e => { e.preventDefault(); dividerDragRef.current = { startY: e.clientY, startH: sceneViewHeight } }}
              />
            )}
            {/* Inspector — 고정 높이 (sceneViewHeight 재사용) */}
            {/* R1516: 다중 선택 배치 편집 패널 */}
            {multiSelectedUuids.length > 1 && sceneFile?.root && (
              <div style={{ height: sceneViewHeight, flexShrink: 0, overflow: 'auto', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <CCFileBatchInspector
                  uuids={multiSelectedUuids}
                  sceneFile={sceneFile}
                  saveScene={saveScene}
                  onSelectNode={onSelectNode}
                  onMultiSelectChange={setMultiSelectedUuids}
                  lockedUuids={lockedUuids}
                  onSetLockedUuids={setLockedUuids}
                />
              </div>
            )}
            {/* R1595: 최근 선택 노드 히스토리 */}
            {nodeHistory.length > 1 && !selectedNode && (
              <div style={{ padding: '4px 8px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>최근 선택</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {nodeHistory.slice(0, 8).map(uuid => {
                    const fn = sceneFile?.root ? (() => {
                      const walk = (n: CCSceneNode): CCSceneNode | null => {
                        if (n.uuid === uuid) return n
                        for (const c of n.children) { const f = walk(c); if (f) return f }
                        return null
                      }
                      return walk(sceneFile.root)
                    })() : null
                    if (!fn) return null
                    return (
                      <span key={uuid}
                        onClick={() => onSelectNode(fn)}
                        style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-muted)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        title={fn.name}
                      >{fn.name}</span>
                    )
                  })}
                </div>
              </div>
            )}
            {multiSelectedUuids.length <= 1 && selectedNode && (
              <div ref={inspectorScrollRef} style={{ height: sceneViewHeight, flexShrink: 0, overflow: 'auto', borderTop: 'none' }}>
                <CCFileNodeInspector
                  node={selectedNode}
                  sceneFile={sceneFile}
                  saveScene={saveScene}
                  onUpdate={onSelectNode}
                  lockedUuids={lockedUuids}
                  onToggleLocked={toggleLocked}
                  onPulse={uuid => { setPulseUuid(uuid); setTimeout(() => setPulseUuid(null), 1400) }}
                  pinnedUuids={new Set(pinnedNodes.map(p => p.uuid))}
                  onTogglePin={togglePinNode}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 그룹 탭 */}
      {mainTab === 'groups' && sceneFile?.root && (
        <GroupPanel
          root={sceneFile.root}
          selectedNode={selectedNode}
          onSelectNode={onSelectNode}
          onRenameGroup={handleRenameInView}
          onToggleGroupActive={handleTreeToggleActive}
        />
      )}
      {mainTab === 'groups' && !sceneFile?.root && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>씬을 먼저 로드하세요.</div>
      )}

      {/* 에셋 탭 */}
      {mainTab === 'assets' && projectInfo?.detected && (
        projectInfo.assetsDir
          ? <CCFileAssetBrowser assetsDir={projectInfo.assetsDir} sceneFile={sceneFile ?? undefined} saveScene={saveScene} onSelectNode={onSelectNode} />
          : <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>assetsDir를 감지할 수 없습니다.</div>
      )}

      {/* R1406: 빌드 탭 */}
      {mainTab === 'build' && projectInfo?.detected && (
        <div style={{ padding: 12, fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>CC 빌드 트리거</div>
          {/* 프로젝트 경로 */}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
            프로젝트: {projectInfo.projectPath ?? '(경로 미감지)'}
          </div>
          {/* CC 버전 */}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8 }}>
            CC 버전: {projectInfo.version ?? 'auto-detect'}
          </div>
          {/* 플랫폼 선택 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 50, flexShrink: 0 }}>플랫폼</span>
            <select
              value={buildPlatform}
              onChange={e => setBuildPlatform(e.target.value as typeof buildPlatform)}
              style={{
                flex: 1, fontSize: 10, background: 'var(--bg-primary)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 3, padding: '3px 6px',
              }}
            >
              <option value="web-mobile">web-mobile</option>
              <option value="web-desktop">web-desktop</option>
              <option value="android">android</option>
              <option value="ios">ios</option>
            </select>
          </div>
          {/* 빌드 경로 */}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8 }}>
            출력 경로: {projectInfo.projectPath ? projectInfo.projectPath.replace(/\\/g, '/') + '/build/' + buildPlatform : '(미설정)'}
          </div>
          {/* 빌드 버튼 */}
          <button
            disabled={buildRunning || !projectInfo.projectPath}
            onClick={async () => {
              // R2312: window.api.shellExec으로 CocosCreator CLI 빌드 실제 실행 (백그라운드)
              setBuildRunning(true)
              setBuildResult(null)
              const version = projectInfo.version ?? '2.4.13'
              const editorPath = CC_EDITOR_PATHS[version] ?? CC_EDITOR_PATHS['2.4.13']
              const projPath = (projectInfo.projectPath ?? '').replace(/\//g, '\\')
              const editorWinPath = editorPath.replace(/\//g, '\\')
              const isCC3 = version.startsWith('3')
              const flagAndPath = isCC3
                ? `--project "${projPath}" --build "platform=${buildPlatform}"`
                : `--path "${projPath}" --build "platform=${buildPlatform}"`
              // start /B: 백그라운드 실행 (블로킹 없이 즉시 반환)
              const startCmd = `start /B "" "${editorWinPath}" ${flagAndPath}`
              try {
                const res = await window.api.shellExec?.(startCmd)
                setBuildRunning(false)
                if (res && !res.ok && res.output) {
                  setBuildResult({ ok: false, msg: res.output.slice(0, 300) })
                } else {
                  setBuildResult({ ok: true, msg: `빌드 시작됨 (${buildPlatform}) — CocosCreator가 백그라운드에서 빌드 중입니다.` })
                }
              } catch (e) {
                setBuildRunning(false)
                setBuildResult({ ok: false, msg: String(e) })
              }
            }}
            style={{
              width: '100%', padding: '6px 0', fontSize: 11, fontWeight: 600, cursor: buildRunning ? 'wait' : 'pointer',
              background: buildRunning ? 'var(--border)' : 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 4, opacity: buildRunning ? 0.6 : 1,
            }}
          >
            {buildRunning ? '빌드 중...' : '🔨 빌드 실행'}
          </button>
          {/* 빌드 결과 */}
          {buildResult && (
            <div style={{
              marginTop: 8, padding: '6px 8px', borderRadius: 4, fontSize: 10,
              background: buildResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: buildResult.ok ? 'var(--success)' : 'var(--error)',
              border: `1px solid ${buildResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              {buildResult.ok ? '✅' : '❌'} {buildResult.msg}
            </div>
          )}
          {/* CLI 명령 미리보기 */}
          <div style={{ marginTop: 12, padding: '6px 8px', borderRadius: 4, background: 'var(--bg-primary)', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
            {(() => {
              const version = projectInfo.version ?? '2.4.13'
              const editorPath = CC_EDITOR_PATHS[version] ?? CC_EDITOR_PATHS['2.4.13']
              const projPath = (projectInfo.projectPath ?? '').replace(/\\/g, '/')
              const isCC3 = version.startsWith('3')
              return isCC3
                ? `"${editorPath}" --project "${projPath}" --build "platform=${buildPlatform}"`
                : `"${editorPath}" --path "${projPath}" --build "platform=${buildPlatform}"`
            })()}
          </div>
        </div>
      )}
      {mainTab === 'build' && !projectInfo?.detected && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>프로젝트를 먼저 열어주세요.</div>
      )}

      {/* 안내 (프로젝트 미선택) */}
      {!projectInfo?.detected && !loading && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>파일 직접 편집 모드</div>
          <div>CC Extension 없이 .fire / .scene 파일을 직접 파싱·편집합니다.</div>
          <div style={{ marginTop: 6, fontSize: 10 }}>
            • CC 2.x (.fire) / CC 3.x (.scene) 모두 지원<br />
            • 에디터 미실행 상태에서도 씬 트리 조회 가능<br />
            • 저장 시 원본 파일 직접 수정 (자동 백업)
          </div>
          {recentFiles.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>최근 파일</div>
              {recentFiles.map(f => (
                <div
                  key={f}
                  onClick={() => handleSceneChange(f)}
                  title={f}
                  style={{
                    fontSize: 10, padding: '3px 6px', borderRadius: 3, cursor: 'pointer',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--accent)', marginBottom: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {f.split(/[\\/]/).pop()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
