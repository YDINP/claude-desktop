import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { updateCCFileContext } from '../../../hooks/useCCFileContext'
import type { ValidationIssue } from '../cocos-utils'
import type { CCFileProjectUIProps, OptimizationSuggestion } from './types'
import { useHierarchyPanel } from './useHierarchyPanel'
import { useNodeSelection } from './useNodeSelection'
import { useNodeOperations } from './useNodeOperations'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useSceneActions, type DepEntry } from './useSceneActions'

export type { DepEntry }

type SceneHistoryEntry = { timestamp: number; nodeCount: number; size: number; snapshotKey?: string }

export function useCCFileProjectUI({ fileProject, selectedNode, onSelectNode }: CCFileProjectUIProps) {
  const { projectInfo, sceneFile, loading, error, externalChange, canUndo, canRedo, undoCount, redoCount, conflictInfo, openProject, detectProject, loadScene, saveScene, undo, redo, restoreBackup, forceOverwrite } = fileProject
  // R2317: 즐겨찾기 프로젝트 목록
  const CC_FAV_KEY = 'cc-favorite-projects'
  const [favProjects, setFavProjects] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(CC_FAV_KEY) ?? '[]') } catch { return [] }
  })
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
  const [lastDiffDisplay, setLastDiffDisplay] = useState<string | null>(null)
  // R1466: 씬 썸네일 자동 생성
  const [sceneThumbnails, setSceneThumbnails] = useState<Record<string, string>>(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('scene-thumb-'))
      const thumbs: Record<string, string> = {}
      for (const k of keys) { const name = k.replace('scene-thumb-', ''); thumbs[name] = localStorage.getItem(k) ?? '' }
      return thumbs
    } catch { return {} }
  })
  const clipboardRef = useRef<CCSceneNode | null>(null)
  // R2323: Inspector 자동 스크롤 — 노드 전환 시 상단으로
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { inspectorScrollRef.current?.scrollTo(0, 0) }, [selectedNode?.uuid])

  // --- Sub-hooks ---
  const hierarchy = useHierarchyPanel({ sceneFile, selectedNode })
  const selection = useNodeSelection({ sceneFile, nodeColors: {} })
  const nodeOps = useNodeOperations({
    sceneFile, projectInfo, saveScene, loadScene, detectProject,
    selectedNode, onSelectNode,
    dupeOffsetX: selection.dupeOffsetX, dupeOffsetY: selection.dupeOffsetY,
    setSaveMsg,
  })

  const addRecent = useCallback((path: string) => {
    setRecentFiles(prev => {
      const next = [path, ...prev.filter(f => f !== path)].slice(0, 6)
      localStorage.setItem('cc-recent-files', JSON.stringify(next))
      return next
    })
  }, [])

  const addRecentScene = useCallback((path: string) => {
    setRecentSceneFiles(prev => {
      const next = [path, ...prev.filter(p => p !== path)].slice(0, 8)
      localStorage.setItem('recent-scene-files', JSON.stringify(next))
      return next
    })
  }, [])

  const sceneActions = useSceneActions({ sceneFile, projectInfo, loadScene, addRecentScene })

  // R1414: 씬 저장 이력 타임라인
  const sceneHistoryKey = sceneFile?.scenePath ? `scene-history-${sceneFile.scenePath.replace(/[\\/]/g, '_')}` : null
  const [sceneHistoryTimeline, setSceneHistoryTimeline] = useState<SceneHistoryEntry[]>(() => {
    try { return sceneHistoryKey ? JSON.parse(localStorage.getItem(sceneHistoryKey) ?? '[]') : [] } catch { return [] }
  })
  const [showFullHistory, setShowFullHistory] = useState(false)
  // R1418: 씬 유효성 검사 상태
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [showValidationResults, setShowValidationResults] = useState(false)
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<OptimizationSuggestion[]>([])
  const [showSceneStats, setShowSceneStats] = useState(false)
  const [mainTab, setMainTab] = useState<'scene' | 'assets' | 'groups' | 'build'>('scene')
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cc-recent-files') ?? '[]') } catch { return [] }
  })
  const [recentSceneFiles, setRecentSceneFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('recent-scene-files') ?? '[]') } catch { return [] }
  })
  const [showValidation, setShowValidation] = useState(false)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [projectSettings, setProjectSettings] = useState<{
    designWidth?: number; designHeight?: number; physicsEngine?: string; buildTargets?: string[]
  } | null>(null)
  const [bannerHidden, setBannerHidden] = useState(false)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoReload, setAutoReload] = useState(() => localStorage.getItem('cc-auto-reload') === 'true')
  // Scene creation + Project wizard state → useSceneActions
  // R1666: 선택 노드 pulse 미리보기
  const [pulseUuid, setPulseUuid] = useState<string | null>(null)
  // R1672: 노드 북마크 (1-9키 → uuid 매핑)
  const [nodeBookmarks, setNodeBookmarks] = useState<Record<string, string>>({})
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

  const nodeMap = useMemo(() => {
    const map = new Map<string, CCSceneNode>()
    if (!sceneFile?.root) return map
    function walk(n: CCSceneNode) { map.set(n.uuid, n); n.children.forEach(walk) }
    walk(sceneFile.root)
    return map
  }, [sceneFile?.root])

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

  // Deps, batch, scene creation, project wizard → useSceneActions

  // R1376: Claude 컨텍스트 자동 주입
  const [ccCtxInject, setCcCtxInject] = useState(() => localStorage.getItem('cc-ctx-inject') !== 'false')
  const prevSceneRootRef = useRef<CCSceneNode | null>(null)
  useEffect(() => {
    if (!ccCtxInject) { updateCCFileContext(null); return }
    const sceneName = sceneFile?.scenePath?.replace(/\\/g, '/').split('/').pop() ?? '(없음)'
    const version = projectInfo?.version ?? '?'
    updateCCFileContext({
      sceneName, version,
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
            const pkgs = pj.packages as Record<string, unknown> | undefined
            const builder = pkgs?.builder as Record<string, unknown> | undefined
            if (builder?.buildSettings) {
              const bs = builder.buildSettings as Record<string, unknown>
              Object.keys(bs).forEach(k => buildTargets.push(k))
            }
            const physics = pj.physics as Record<string, unknown> | undefined
            if (physics?.type) physicsEngine = String(physics.type)
          } catch { /* ignore parse errors */ }
        }
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

  const handleSceneChange = useCallback(async (path: string) => {
    setSelectedScene(path)
    if (path) {
      await loadScene(path); addRecent(path); addRecentScene(path)
      if (projectInfo?.projectPath) localStorage.setItem(`cc-last-scene-${projectInfo.projectPath}`, path)
    }
  }, [loadScene, addRecent, addRecentScene, projectInfo?.projectPath])

  const handleSave = useCallback(async () => {
    if (!sceneFile?.root) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const result = await saveScene(sceneFile.root)
      setSaveMsg(result.success ? { ok: true, text: '저장 완료' } : { ok: false, text: result.error ?? '저장 실패' })
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
      // R1414: 저장 이력 추가
      if (result.success && sceneHistoryKey) {
        let count = 0
        const countNodesLocal = (n: CCSceneNode) => { count++; n.children.forEach(countNodesLocal) }
        countNodesLocal(sceneFile.root)
        const ts = Date.now()
        const snapKey = `${sceneHistoryKey}-snap-${ts}`
        try { localStorage.setItem(snapKey, JSON.stringify(sceneFile._raw ?? sceneFile.root)) } catch { /* storage full */ }
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
            sceneName, version: projectInfo?.version ?? '?',
            selectedNodeName: selectedNode?.name,
            selectedNodeUuid: selectedNode?.uuid,
            components: selectedNode?.components?.map(c => c.type) ?? [],
            lastSaveDiff: diffStr,
          })
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

  // 키보드 단축키 (useKeyboardShortcuts로 분리)
  useKeyboardShortcuts({
    sceneFile, saveScene, canUndo, canRedo, undo, redo,
    selectedNode, onSelectNode, handleSave, nodeOps,
    setMultiSelectedUuids: selection.setMultiSelectedUuids,
    parentMap, nodeMap, clipboardRef,
    nodeBookmarks, setNodeBookmarks, setJsonCopiedName,
  })

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
    selection.setNodeHistory(prev => {
      const filtered = prev.filter(id => id !== selectedNode.uuid)
      return [selectedNode.uuid, ...filtered].slice(0, 8)
    })
  }, [selectedNode?.uuid])

  const handleRestore = useCallback(async () => {
    if (!sceneFile) return
    const result = await restoreBackup()
    setSaveMsg(result.success ? { ok: true, text: '백업 복원 완료' } : { ok: false, text: result.error ?? '복원 실패' })
    setTimeout(() => setSaveMsg(null), 3000)
  }, [sceneFile, restoreBackup])

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
    clipboardRef, inspectorScrollRef, hDividerDragRef: hierarchy.hDividerDragRef, dividerDragRef: hierarchy.dividerDragRef,
    bannerTimerRef, prevSceneRootRef,
    // Tree state (from useHierarchyPanel)
    hideInactive: hierarchy.hideInactive, setHideInactive: hierarchy.setHideInactive,
    collapsedUuids: hierarchy.collapsedUuids, setCollapsedUuids: hierarchy.setCollapsedUuids,
    expandAll: hierarchy.expandAll, expandToNode: hierarchy.expandToNode,
    collapseToDepth: hierarchy.collapseToDepth, collapseAll: hierarchy.collapseAll,
    // Layout (from useHierarchyPanel)
    sceneViewHeight: hierarchy.sceneViewHeight, setSceneViewHeight: hierarchy.setSceneViewHeight,
    hierarchyWidth: hierarchy.hierarchyWidth, setHierarchyWidth: hierarchy.setHierarchyWidth,
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
    // Node favorites (from useNodeSelection)
    favorites: selection.favorites, toggleFavorite: selection.toggleFavorite,
    // Locked nodes (from useNodeSelection)
    lockedUuids: selection.lockedUuids, setLockedUuids: selection.setLockedUuids, toggleLocked: selection.toggleLocked,
    // Node colors (from useNodeSelection)
    nodeColors: selection.nodeColors, handleNodeColorChange: selection.handleNodeColorChange,
    // Pinned nodes (from useNodeSelection)
    pinnedNodes: selection.pinnedNodes, togglePinNode: selection.togglePinNode,
    // Dupe offset (from useNodeSelection)
    dupeOffsetX: selection.dupeOffsetX, dupeOffsetY: selection.dupeOffsetY, saveDupeOffset: selection.saveDupeOffset,
    // Filters (from useNodeSelection)
    nodeFilters: selection.nodeFilters, setNodeFilters: selection.setNodeFilters,
    showNodeFilters: selection.showNodeFilters, setShowNodeFilters: selection.setShowNodeFilters,
    colorTagFilter: selection.colorTagFilter, setColorTagFilter: selection.setColorTagFilter,
    // Tree highlight (from useNodeSelection)
    treeHighlightQuery: selection.treeHighlightQuery, setTreeHighlightQuery: selection.setTreeHighlightQuery,
    // Validation view
    showValidation, setShowValidation,
    // Project settings
    showProjectSettings, setShowProjectSettings, projectSettings,
    // Banner
    bannerHidden, setBannerHidden,
    autoReload, setAutoReload,
    // New scene form (from useSceneActions)
    showNewSceneForm: sceneActions.showNewSceneForm, setShowNewSceneForm: sceneActions.setShowNewSceneForm,
    newSceneName: sceneActions.newSceneName, setNewSceneName: sceneActions.setNewSceneName,
    newSceneTemplate: sceneActions.newSceneTemplate, setNewSceneTemplate: sceneActions.setNewSceneTemplate,
    handleCreateScene: sceneActions.handleCreateScene,
    // Project wizard (from useSceneActions)
    showProjectWizard: sceneActions.showProjectWizard, setShowProjectWizard: sceneActions.setShowProjectWizard,
    wizardStep: sceneActions.wizardStep, setWizardStep: sceneActions.setWizardStep,
    wizardProjectName: sceneActions.wizardProjectName, setWizardProjectName: sceneActions.setWizardProjectName,
    wizardSavePath: sceneActions.wizardSavePath, setWizardSavePath: sceneActions.setWizardSavePath,
    wizardCCVersion: sceneActions.wizardCCVersion, setWizardCCVersion: sceneActions.setWizardCCVersion,
    wizardTemplate: sceneActions.wizardTemplate, setWizardTemplate: sceneActions.setWizardTemplate,
    wizardCreating: sceneActions.wizardCreating, wizardError: sceneActions.wizardError, setWizardError: sceneActions.setWizardError,
    handleCreateProject: sceneActions.handleCreateProject,
    // Prefab (from useNodeOperations)
    prefabPickerOpen: nodeOps.prefabPickerOpen, setPrefabPickerOpen: nodeOps.setPrefabPickerOpen,
    insertingPrefab: nodeOps.insertingPrefab, handleInsertPrefab: nodeOps.handleInsertPrefab,
    // Multi-select (from useNodeSelection)
    multiSelectedUuids: selection.multiSelectedUuids, setMultiSelectedUuids: selection.setMultiSelectedUuids,
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
    // Filtered tree (from useNodeSelection)
    filteredRoot: selection.filteredRoot,
    // Deps analysis (from useSceneActions)
    showDepsAnalysis: sceneActions.showDepsAnalysis, setShowDepsAnalysis: sceneActions.setShowDepsAnalysis,
    depsLoading: sceneActions.depsLoading, depsEntries: sceneActions.depsEntries,
    handleAnalyzeDeps: sceneActions.handleAnalyzeDeps,
    // Batch menu (from useSceneActions)
    showBatchMenu: sceneActions.showBatchMenu, setShowBatchMenu: sceneActions.setShowBatchMenu,
    batchToast: sceneActions.batchToast, showBatchToast: sceneActions.showBatchToast,
    handleBatchFontSize: sceneActions.handleBatchFontSize, handleBatchRemoveInactive: sceneActions.handleBatchRemoveInactive, handleBatchNormalizeName: sceneActions.handleBatchNormalizeName,
    // Context inject
    ccCtxInject, setCcCtxInject,
    // Scene handlers (from useNodeOperations)
    handleTreeDelete: nodeOps.handleTreeDelete, handleTreeDuplicate: nodeOps.handleTreeDuplicate,
    handleTreeAddChild: nodeOps.handleTreeAddChild, handleTreeToggleActive: nodeOps.handleTreeToggleActive,
    handleRenameInView: nodeOps.handleRenameInView, handleSaveAsPrefab: nodeOps.handleSaveAsPrefab,
    handleRestore,
    // Node handlers (from useNodeOperations)
    patchNodes: nodeOps.patchNodes,
    handleNodeMove: nodeOps.handleNodeMove, handleNodeResize: nodeOps.handleNodeResize,
    handleNodeRotate: nodeOps.handleNodeRotate,
    handleNodeOpacity: nodeOps.handleNodeOpacity, handleAnchorMove: nodeOps.handleAnchorMove,
    handleMultiMove: nodeOps.handleMultiMove, handleMultiDelete: nodeOps.handleMultiDelete,
    handleLabelEdit: nodeOps.handleLabelEdit, handleLabelReplaceAll: nodeOps.handleLabelReplaceAll,
    handleAddNode: nodeOps.handleAddNode, handleDuplicate: nodeOps.handleDuplicate,
    handleToggleActive: nodeOps.handleToggleActive,
    handleReorder: nodeOps.handleReorder, handleReorderExtreme: nodeOps.handleReorderExtreme,
    handleSortChildren: nodeOps.handleSortChildren,
    handleReparent: nodeOps.handleReparent, handleGroupNodes: nodeOps.handleGroupNodes,
    handleAltDrag: nodeOps.handleAltDrag,
    // Label replace (from useNodeOperations)
    showLabelReplace: nodeOps.showLabelReplace, setShowLabelReplace: nodeOps.setShowLabelReplace,
    labelFindText: nodeOps.labelFindText, setLabelFindText: nodeOps.setLabelFindText,
    labelReplaceText: nodeOps.labelReplaceText, setLabelReplaceText: nodeOps.setLabelReplaceText,
    labelReplaceMatches: nodeOps.labelReplaceMatches,
    // Global search (from useNodeOperations)
    globalSearchOpen: nodeOps.globalSearchOpen, setGlobalSearchOpen: nodeOps.setGlobalSearchOpen,
    globalSearchQuery: nodeOps.globalSearchQuery, setGlobalSearchQuery: nodeOps.setGlobalSearchQuery,
    globalSearchResults: nodeOps.globalSearchResults, setGlobalSearchResults: nodeOps.setGlobalSearchResults,
    globalSearchInputRef: nodeOps.globalSearchInputRef,
    globalSearchCompFilter: nodeOps.globalSearchCompFilter, setGlobalSearchCompFilter: nodeOps.setGlobalSearchCompFilter,
    filteredGlobalResults: nodeOps.filteredGlobalResults,
    runGlobalSearch: nodeOps.runGlobalSearch,
    // Node history (from useNodeSelection)
    nodeHistory: selection.nodeHistory, setNodeHistory: selection.setNodeHistory,
  }
}

export type UseCCFileProjectUIReturn = ReturnType<typeof useCCFileProjectUI>
