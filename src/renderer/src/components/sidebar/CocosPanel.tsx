import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useCCFileProject } from '../../hooks/useCCFileProject'
import { CCFileSceneView } from './SceneView/CCFileSceneView'
import type { CCSceneNode, CCSceneFile } from '../../../../shared/ipc-schema'
import { updateCCFileContext } from '../../hooks/useCCFileContext'

function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const [checked, setChecked] = useState(value)
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 16, flexShrink: 0, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => {
          setChecked(e.target.checked)
          onChange(e.target.checked)
        }}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <span style={{
        position: 'absolute', inset: 0,
        background: checked ? '#4caf50' : '#555',
        borderRadius: 16,
        transition: 'background 0.2s ease',
      }} />
      <span style={{
        position: 'absolute',
        top: 2, left: checked ? 18 : 2,
        width: 12, height: 12,
        background: '#fff',
        borderRadius: '50%',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }} />
    </label>
  )
}

// Round 635: Inspector Transform 복사/붙여넣기 — module-level fallback
type TransformSnapshot = {
  position: CCSceneNode['position']
  rotation: CCSceneNode['rotation']
  scale: CCSceneNode['scale']
  size: CCSceneNode['size']
  anchor: CCSceneNode['anchor']
  opacity: number
}
let transformClipboard: TransformSnapshot | null = null

// R1418: 씬 유효성 검사 (Lint)
interface ValidationIssue {
  level: 'error' | 'warning'
  message: string
  nodeUuid?: string
  nodeName?: string
}

// R1441: 최적화 제안 인터페이스 (cc-file-parser와 동기화)
interface OptimizationSuggestion {
  type: 'performance' | 'memory' | 'structure'
  severity: 'high' | 'medium' | 'low'
  message: string
  affectedUuids?: string[]
}

function validateScene(root: CCSceneNode): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seenUuids = new Map<string, string>() // uuid → name
  let hasCanvas = false

  function walk(node: CCSceneNode, depth: number, parentActive: boolean): void {
    // UUID 중복 체크
    if (seenUuids.has(node.uuid)) {
      issues.push({ level: 'error', message: `UUID 중복: "${node.name}" 와 "${seenUuids.get(node.uuid)}" (${node.uuid.slice(0, 8)}...)`, nodeUuid: node.uuid, nodeName: node.name })
    } else {
      seenUuids.set(node.uuid, node.name)
    }

    // 이름 빈 노드
    if (node.name === '') {
      issues.push({ level: 'warning', message: `이름 빈 노드 (uuid: ${node.uuid.slice(0, 8)}...)`, nodeUuid: node.uuid, nodeName: '(empty)' })
    }

    // Canvas 감지
    if (node.components.some(c => c.type === 'cc.Canvas')) hasCanvas = true

    // 비활성 부모 아래 활성 자식
    if (!parentActive && node.active) {
      issues.push({ level: 'warning', message: `비활성 부모 아래 활성 자식: "${node.name}"`, nodeUuid: node.uuid, nodeName: node.name })
    }

    // 깊이 경고
    if (depth > 8) {
      issues.push({ level: 'warning', message: `계층 깊이 ${depth}: "${node.name}" (8 초과)`, nodeUuid: node.uuid, nodeName: node.name })
    }

    for (const child of node.children) {
      walk(child, depth + 1, node.active)
    }
  }

  walk(root, 0, true)

  // Canvas 없는 씬 경고 (루트가 Scene인 경우)
  if (!hasCanvas && root.children.length > 0) {
    issues.push({ level: 'warning', message: 'Canvas 컴포넌트가 없는 씬 (CC 2.x에서 UI가 표시되지 않을 수 있음)' })
  }

  return issues
}

export function CocosPanel() {
  const fileProject = useCCFileProject()
  const [selectedNode, setSelectedNode] = useState<CCSceneNode | null>(null)
  const [pluginList, setPluginList] = useState<string[]>([])
  const [showPluginManager, setShowPluginManager] = useState(false)
  const [hotReload, setHotReload] = useState(false)
  const [hotReloadInterval, setHotReloadInterval] = useState(1000)
  const [buildWarnings, setBuildWarnings] = useState<string[]>([])
  const [showWarningsPanel, setShowWarningsPanel] = useState(false)
  const [assetBundles, setAssetBundles] = useState<string[]>([])
  const [showBundlePanel, setShowBundlePanel] = useState(false)
  const [buildTarget, setBuildTarget] = useState<string>('web-mobile')
  const [showTargetPanel, setShowTargetPanel] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugOverlay, setDebugOverlay] = useState<string>('none')
  const [assetFilter, setAssetFilter] = useState('')
  const [assetFilterType, setAssetFilterType] = useState<string>('all')
  const [performanceStats, setPerformanceStats] = useState<Record<string, number>>({})
  const [showPerfPanel, setShowPerfPanel] = useState(false)
  const [buildLog, setBuildLog] = useState<string[]>([])
  const [showBuildLog, setShowBuildLog] = useState(false)
  const [remoteDebug, setRemoteDebug] = useState(false)
  const [remoteDebugPort, setRemoteDebugPort] = useState(9222)
  const [scriptTemplates, setScriptTemplates] = useState<string[]>([])
  const [showScriptTemplates, setShowScriptTemplates] = useState(false)
  const [editorTheme, setEditorTheme] = useState<string>('default')
  const [showEditorTheme, setShowEditorTheme] = useState(false)
  const [buildNotify, setBuildNotify] = useState(true)
  const [buildNotifyConfig, setBuildNotifyConfig] = useState<Record<string, boolean>>({})
  const [nodeTemplate, setNodeTemplate] = useState<string>('')
  const [showNodeTemplates, setShowNodeTemplates] = useState(false)
  const [buildSchedule, setBuildSchedule] = useState<string>('')
  const [buildScheduleEnabled, setBuildScheduleEnabled] = useState(false)
  const [assetBundle, setAssetBundle] = useState(false)
  const [assetBundleConfig, setAssetBundleConfig] = useState('')
  const [editorPlugins, setEditorPlugins] = useState<string[]>([])
  const [showPluginPanel, setShowPluginPanel] = useState(false)
  const [buildPresets, setBuildPresets] = useState<string[]>([])
  const [activeBuildPreset, setActiveBuildPreset] = useState('')
  const [sceneListFilter, setSceneListFilter] = useState('')
  const [sceneFilterActive, setSceneFilterActive] = useState(false)
  return (
    <CCFileProjectUI
      fileProject={fileProject}
      selectedNode={selectedNode}
      onSelectNode={setSelectedNode}
    />
  )
}

// R1423: 백업 파일 관리 컴포넌트
function BackupManager({ scenePath, onRestored }: { scenePath: string; onRestored: () => void }) {
  const [bakFiles, setBakFiles] = useState<Array<{ name: string; path: string; size: number; mtime: number }>>([])
  const [showBakSection, setShowBakSection] = useState(false)
  const [maxBackups, setMaxBackups] = useState(() => {
    try { return parseInt(localStorage.getItem('bak-max-count') ?? '5') } catch { return 5 }
  })
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  const refreshBaks = useCallback(async () => {
    try {
      const files = await window.api.ccFileListBakFiles(scenePath)
      setBakFiles(files)
    } catch { setBakFiles([]) }
  }, [scenePath])

  useEffect(() => {
    if (showBakSection) refreshBaks()
  }, [showBakSection, refreshBaks])

  useEffect(() => {
    try { localStorage.setItem('bak-max-count', String(maxBackups)) } catch { /* ignore */ }
  }, [maxBackups])

  const handleRestore = useCallback(async (bakPath: string) => {
    try {
      const result = await window.api.ccFileRestoreFromBak(bakPath, scenePath)
      if (result.success) { onRestored(); refreshBaks() }
    } catch { /* ignore */ }
  }, [scenePath, onRestored, refreshBaks])

  const handleDeleteAll = useCallback(async () => {
    try {
      await window.api.ccFileDeleteAllBakFiles(scenePath)
      setBakFiles([])
      setConfirmDeleteAll(false)
    } catch { /* ignore */ }
  }, [scenePath])

  return (
    <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => setShowBakSection(v => !v)}
          style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >{showBakSection ? '▾' : '▸'} 백업 파일 ({bakFiles.length})</button>
        {showBakSection && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>max</span>
            <select
              value={maxBackups}
              onChange={e => setMaxBackups(Number(e.target.value))}
              style={{ fontSize: 8, background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 2, padding: '0 2px' }}
            >
              {[3, 5, 10, 20].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}
      </div>
      {showBakSection && (
        <div style={{ marginTop: 4 }}>
          {bakFiles.length === 0 && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px 0' }}>백업 파일이 없습니다</div>
          )}
          {bakFiles.map((bak, i) => (
            <div key={bak.path} style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 0',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {new Date(bak.mtime).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ color: '#555', fontSize: 8 }}>{(bak.size / 1024).toFixed(1)}KB</span>
              <button
                onClick={() => handleRestore(bak.path)}
                style={{ marginLeft: 'auto', fontSize: 8, padding: '1px 5px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 2, color: 'var(--accent)', cursor: 'pointer' }}
              >복원</button>
            </div>
          ))}
          {bakFiles.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
              {confirmDeleteAll ? (
                <>
                  <span style={{ fontSize: 8, color: '#f87171' }}>전체 삭제?</span>
                  <button onClick={handleDeleteAll} style={{ fontSize: 8, padding: '1px 5px', background: 'rgba(248,81,73,0.2)', border: '1px solid #f85149', borderRadius: 2, color: '#f85149', cursor: 'pointer' }}>확인</button>
                  <button onClick={() => setConfirmDeleteAll(false)} style={{ fontSize: 8, padding: '1px 5px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                </>
              ) : (
                <button onClick={() => setConfirmDeleteAll(true)} style={{ fontSize: 8, padding: '1px 5px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}>모두 삭제</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CC 파일 모드 UI ──────────────────────────────────────────────────────────

interface CCFileProjectUIProps {
  fileProject: {
    projectInfo: import('../../../../shared/ipc-schema').CCFileProjectInfo | null
    sceneFile: import('../../../../shared/ipc-schema').CCSceneFile | null
    loading: boolean
    error: string | null
    externalChange: { path: string; timestamp: number } | null
    canUndo: boolean
    canRedo: boolean
    openProject: () => Promise<void>
    loadScene: (scenePath: string) => Promise<void>
    saveScene: (root: import('../../../../shared/ipc-schema').CCSceneNode) => Promise<{ success: boolean; error?: string }>
    undo: () => Promise<{ success: boolean; error?: string } | undefined>
    redo: () => Promise<{ success: boolean; error?: string } | undefined>
    restoreBackup: () => Promise<{ success: boolean; error?: string }>
  }
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
}

// R1476: 노드 딥복사 + UUID 자동 재생성 (재귀, crypto.randomUUID)
function deepCopyNodeWithNewUuids(node: CCSceneNode, suffix = '_Copy'): CCSceneNode {
  const genUuid = () => (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  function deepCopy(n: CCSceneNode, isToplevel: boolean): CCSceneNode {
    return {
      ...n,
      uuid: genUuid(),
      name: isToplevel ? n.name + suffix : n.name,
      components: n.components.map(c => ({ ...c, props: { ...c.props } })),
      children: n.children.map(c => deepCopy(c, false)),
      _rawIndex: undefined,
    }
  }
  return deepCopy(node, true)
}

function CCFileProjectUI({ fileProject, selectedNode, onSelectNode }: CCFileProjectUIProps) {
  const { projectInfo, sceneFile, loading, error, externalChange, canUndo, canRedo, conflictInfo, openProject, loadScene, saveScene, undo, redo, restoreBackup, forceOverwrite } = fileProject
  const [selectedScene, setSelectedScene] = useState<string>('')
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
  const [hideInactive, setHideInactive] = useState(false)
  const [collapsedUuids, setCollapsedUuids] = useState<Set<string>>(() => new Set())
  const expandAll = useCallback(() => setCollapsedUuids(new Set()), [])
  const collapseAll = useCallback(() => {
    if (!sceneFile?.root) return
    const uuids = new Set<string>()
    function collectParents(n: CCSceneNode) {
      if (n.children.length > 0) { uuids.add(n.uuid); n.children.forEach(collectParents) }
    }
    collectParents(sceneFile.root)
    setCollapsedUuids(uuids)
  }, [sceneFile?.root])
  // R1644: 선택 노드 트리 자동 스크롤
  useEffect(() => {
    if (!selectedNode) return
    const el = document.getElementById(`tree-node-${selectedNode.uuid}`)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedNode?.uuid])
  const [sceneViewHeight, setSceneViewHeight] = useState(240)
  // R1470: Cocos 에디터 레이아웃 — 계층 패널 너비 (좌우 분할)
  const [hierarchyWidth, setHierarchyWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('cc-hierarchy-width') ?? '160') } catch { return 160 }
  })
  const hDividerDragRef = useRef<{ startX: number; startW: number } | null>(null)
  // R1414: 씬 저장 이력 타임라인
  type SceneHistoryEntry = { timestamp: number; nodeCount: number; size: number }
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
  const [nodeLayers, setNodeLayers] = useState<Record<string, number>>({})
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [nodeSearchHistory, setNodeSearchHistory] = useState<string[]>([])
  const [showNodeSearchHistory, setShowNodeSearchHistory] = useState(false)
  const [previewCacheSize, setPreviewCacheSize] = useState(0)
  const [showCacheManager, setShowCacheManager] = useState(false)
  const [batchEditMode, setBatchEditMode] = useState(false)
  const [batchEditTargets, setBatchEditTargets] = useState<string[]>([])
  const [compSearchFilter, setCompSearchFilter] = useState('')
  const [compSearchResults, setCompSearchResults] = useState<string[]>([])
  const [nodeTagFilter, setNodeTagFilter] = useState<string[]>([])
  const [showNodeTagFilter, setShowNodeTagFilter] = useState(false)
  const [nodeCopyHistory, setNodeCopyHistory] = useState<Array<{ uuid: string; name: string; ts: number }>>([])
  const [showCopyHistory, setShowCopyHistory] = useState(false)
  const [nodeGroups, setNodeGroups] = useState<Record<string, string[]>>({})
  const [showGroupPanel, setShowGroupPanel] = useState(false)
  const [prefabSearch, setPrefabSearch] = useState('')
  const [prefabSearchResults, setPrefabSearchResults] = useState<string[]>([])
  const [sceneHistory, setSceneHistory] = useState<string[]>([])
  const [showSceneHistory, setShowSceneHistory] = useState(false)
  const [animationPreview, setAnimationPreview] = useState(false)
  const [previewAnimation, setPreviewAnimation] = useState<string | null>(null)
  const [nodeEventLog, setNodeEventLog] = useState<Array<{ uuid: string; event: string; ts: number }>>([])
  const [showEventLog, setShowEventLog] = useState(false)
  const [materialInspector, setMaterialInspector] = useState<string | null>(null)
  const [showMaterialPanel, setShowMaterialPanel] = useState(false)
  const [physicsDebug, setPhysicsDebug] = useState(false)
  const [physicsDebugOptions, setPhysicsDebugOptions] = useState<{ showColliders: boolean; showJoints: boolean }>({ showColliders: true, showJoints: false })
  const [scriptEditorOpen, setScriptEditorOpen] = useState(false)
  const [editingScript, setEditingScript] = useState<string | null>(null)
  const [spriteEditorOpen, setSpriteEditorOpen] = useState(false)
  const [editingSprite, setEditingSprite] = useState<string | null>(null)
  const [particleEditorOpen, setParticleEditorOpen] = useState(false)
  const [editingParticle, setEditingParticle] = useState<string | null>(null)
  const [audioEditorOpen, setAudioEditorOpen] = useState(false)
  const [editingAudio, setEditingAudio] = useState<string | null>(null)
  const [tileMapEditorOpen, setTileMapEditorOpen] = useState(false)
  const [editingTileMap, setEditingTileMap] = useState<string | null>(null)
  const [sceneGraph, setSceneGraph] = useState<Record<string, unknown>>({})
  const [showSceneGraph, setShowSceneGraph] = useState(false)
  const [lockedNodes, setLockedNodes] = useState<string[]>([])
  const [showLockPanel, setShowLockPanel] = useState(false)
  const [assetFavorites, setAssetFavorites] = useState<string[]>([])
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false)
  const [nodeHistory, setNodeHistory] = useState<string[]>([])
  const [showNodeHistory, setShowNodeHistory] = useState(false)
  const [sceneSnapshots, setSceneSnapshots] = useState<string[]>([])
  const [showSnapshotList, setShowSnapshotList] = useState(false)
  const [resourcePreview, setResourcePreview] = useState<string | null>(null)
  const [showResourcePreview, setShowResourcePreview] = useState(false)
  const [buildSettings, setBuildSettings] = useState<Record<string, unknown>>({})
  const [showBuildSettings, setShowBuildSettings] = useState(false)
  const [plugins, setPlugins] = useState<string[]>([])
  const [renderSettings, setRenderSettings] = useState<Record<string, unknown>>({})
  const [showRenderSettings, setShowRenderSettings] = useState(false)
  const [sceneFilter, setSceneFilter] = useState('')
  const [sceneFilterResults, setSceneFilterResults] = useState<string[]>([])
  const [nodeSortMode, setNodeSortMode] = useState<'name' | 'type' | 'index'>('index')
  const [nodeSortOrder, setNodeSortOrder] = useState<'asc' | 'desc'>('asc')
  const [sceneTags, setSceneTags] = useState<string[]>([])
  const [showSceneTagEditor, setShowSceneTagEditor] = useState(false)
  const [assetVersion, setAssetVersion] = useState<Record<string, number>>({})
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [nodeAnnotations, setNodeAnnotations] = useState<Record<string, string>>({})
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false)
  const [sceneLockMode, setSceneLockMode] = useState(false)
  const [lockedScenes, setLockedScenes] = useState<string[]>([])
  const [assetDeps, setAssetDeps] = useState<Record<string, string[]>>({})
  const [showDepsPanel, setShowDepsPanel] = useState(false)
  const [nodeAdvSearch, setNodeAdvSearch] = useState(false)
  const [nodeSearchField, setNodeSearchField] = useState<'name' | 'tag' | 'uuid'>('name')
  const [sceneSnapshot, setSceneSnapshot] = useState<string | null>(null)
  const [showSnapshotPanel, setShowSnapshotPanel] = useState(false)
  const [nodeLayer, setNodeLayer] = useState<string>('all')
  const [showLayerFilter, setShowLayerFilter] = useState(false)
  const [sceneTemplates, setSceneTemplates] = useState<string[]>([])
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [nodeStats, setNodeStats] = useState<Record<string, number>>({})
  const [showNodeStats, setShowNodeStats] = useState(false)
  const [sceneValidation, setSceneValidation] = useState<string[]>([])
  const [showValidationPanel, setShowValidationPanel] = useState(false)
  const [compSearch, setCompSearch] = useState('')
  const [showCompSearch, setShowCompSearch] = useState(false)
  const [autoSave, setAutoSave] = useState(false)
  const [autoSaveInterval, setAutoSaveInterval] = useState(30)
  const [prefabPreview, setPrefabPreview] = useState<string | null>(null)
  const [showPrefabPreview, setShowPrefabPreview] = useState(false)
  const [sceneExportPath, setSceneExportPath] = useState('')
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [favNodes, setFavNodes] = useState<string[]>([])
  const [showFavNodes, setShowFavNodes] = useState(false)
  const [nodeLock, setNodeLock] = useState<string[]>([])
  const [compareMode, setCompareMode] = useState(false)
  const [compareTarget, setCompareTarget] = useState<string | null>(null)
  const [assetTags, setAssetTags] = useState<Record<string, string[]>>({})
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [importSource, setImportSource] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [sceneOpHistory, setSceneOpHistory] = useState<string[]>([])
  const [showOpHistory, setShowOpHistory] = useState(false)
  const [scenePerms, setScenePerms] = useState<Record<string, string>>({})
  const [showPermPanel, setShowPermPanel] = useState(false)
  const [assetPreview, setAssetPreview] = useState<string | null>(null)
  const [assetPreviewType, setAssetPreviewType] = useState<'image' | 'audio' | 'other'>('image')
  // R1148: build queue
  const [buildQueue, setBuildQueue] = useState<string[]>([])
  const [showBuildQueue, setShowBuildQueue] = useState(false)
  // R1160: build errors
  const [buildErrors, setBuildErrors] = useState<string[]>([])
  const [showBuildErrors, setShowBuildErrors] = useState(false)
  // R1166: asset search
  const [assetSearchQuery, setAssetSearchQuery] = useState('')
  const [assetSearchResults, setAssetSearchResults] = useState<string[]>([])
  // R1172: scene bookmarks
  const [sceneBookmarks, setSceneBookmarks] = useState<string[]>([])
  const [showSceneBookmarks, setShowSceneBookmarks] = useState(false)
  // R1178: component search
  const [componentSearch, setComponentSearch] = useState('')
  const [componentSearchResults, setComponentSearchResults] = useState<string[]>([])
  // R1184: node filters
  const [nodeFilters, setNodeFilters] = useState<string[]>([])
  const [showNodeFilters, setShowNodeFilters] = useState(false)
  // R1190: scene validation
  const [showValidation, setShowValidation] = useState(false)
  // R1196: resource usage
  const [resourceUsage, setResourceUsage] = useState<Record<string, number>>({})
  const [showResourcePanel, setShowResourcePanel] = useState(false)
  // R1202: build history
  const [buildHistory, setBuildHistory] = useState<string[]>([])
  const [showBuildHistory, setShowBuildHistory] = useState(false)
  // R1208: deploy config
  const [deployConfig, setDeployConfig] = useState<Record<string, string>>({})
  const [showDeployPanel, setShowDeployPanel] = useState(false)
  // R1220: scene export
  const [sceneExportFormat, setSceneExportFormat] = useState<'json' | 'prefab' | 'fbx'>('json')
  const [showExportScene, setShowExportScene] = useState(false)
  // R1226: node tree view
  const [nodeTreeExpanded, setNodeTreeExpanded] = useState<Set<string>>(new Set())
  const [nodeTreeFilter, setNodeTreeFilter] = useState('')
  // R1238: build profiles
  const [buildProfiles, setBuildProfiles] = useState<Record<string, object>>({})
  const [activeBuildProfile, setActiveBuildProfile] = useState<string | null>(null)
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

  // R1389: 외부 변경 배너 5초 후 자동 숨김
  useEffect(() => {
    if (externalChange) {
      setBannerHidden(false)
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = setTimeout(() => setBannerHidden(true), 5000)
    } else {
      setBannerHidden(false)
    }
    return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current) }
  }, [externalChange])

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
    if (path) { await loadScene(path); addRecent(path); addRecentScene(path) }
  }, [loadScene, addRecent, addRecentScene])

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
      // R1414: 저장 이력 추가
      if (result.success && sceneHistoryKey) {
        let count = 0
        function countNodes(n: CCSceneNode) { count++; n.children.forEach(countNodes) }
        countNodes(sceneFile.root)
        const entry: SceneHistoryEntry = { timestamp: Date.now(), nodeCount: count, size: JSON.stringify(sceneFile._raw ?? sceneFile.root).length }
        setSceneHistoryTimeline(prev => {
          const next = [entry, ...prev].slice(0, 20)
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
      if (e.key === 'Escape' && !isInput) { onSelectNode(null); return }

      if (isInput) return

      // Ctrl+C: 선택 노드 클립보드 복사
      if (ctrl && e.key === 'c' && selectedNode) {
        e.preventDefault()
        clipboardRef.current = selectedNode
        return
      }
      // Ctrl+V: 클립보드 노드 붙여넣기 (선택 노드의 자식으로 / 없으면 루트 자식으로)
      if (ctrl && e.key === 'v' && clipboardRef.current && sceneFile?.root) {
        e.preventDefault()
        const srcNode = clipboardRef.current
        // R1476: 딥복사 + UUID 자동 재생성 (자식 포함)
        const pasteNode = deepCopyNodeWithNewUuids(srcNode, '_Paste')
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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sceneFile, canUndo, canRedo, undo, redo, selectedNode, handleTreeDelete, handleTreeDuplicate, saveScene, handleSave, onSelectNode])

  // R1430: 전역 노드 검색 상태
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<Array<{ node: CCSceneNode; path: string }>>([])
  const globalSearchInputRef = useRef<HTMLInputElement>(null)

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
    const found: Array<{ node: CCSceneNode; path: string }> = []
    function walk(n: CCSceneNode, parentPath: string): void {
      const currentPath = parentPath ? `${parentPath}/${n.name}` : n.name
      const nameMatch = n.name.toLowerCase().includes(lq)
      const compMatch = n.components.some(c => c.type.toLowerCase().includes(lq))
      if (nameMatch || compMatch) found.push({ node: n, path: currentPath })
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

  const handleNodeMove = useCallback(async (uuid: string, x: number, y: number) => {
    if (!sceneFile?.root) return
    function updatePos(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) return { ...n, position: { ...n.position, x, y } }
      return { ...n, children: n.children.map(updatePos) }
    }
    await saveScene(updatePos(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleNodeResize = useCallback(async (uuid: string, w: number, h: number) => {
    if (!sceneFile?.root) return
    function updateSize(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) return { ...n, size: { x: Math.round(w), y: Math.round(h) } }
      return { ...n, children: n.children.map(updateSize) }
    }
    await saveScene(updateSize(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleNodeRotate = useCallback(async (uuid: string, angle: number) => {
    if (!sceneFile?.root) return
    const rounded = Math.round(angle * 10) / 10
    function updateRot(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) {
        const rot = typeof n.rotation === 'number'
          ? rounded
          : { ...(n.rotation as object), z: rounded }
        return { ...n, rotation: rot }
      }
      return { ...n, children: n.children.map(updateRot) }
    }
    await saveScene(updateRot(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1506: 앵커 포인트 드래그 편집 (SceneView ◇ 핸들)
  const handleAnchorMove = useCallback(async (uuid: string, ax: number, ay: number) => {
    if (!sceneFile?.root) return
    const clamped = { x: Math.max(0, Math.min(1, Math.round(ax * 100) / 100)), y: Math.max(0, Math.min(1, Math.round(ay * 100) / 100)) }
    function updateAnchor(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) return { ...n, anchor: clamped }
      return { ...n, children: n.children.map(updateAnchor) }
    }
    await saveScene(updateAnchor(sceneFile.root))
  }, [sceneFile, saveScene])

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

  // R1565: H — 선택 노드 active 토글
  const handleToggleActive = useCallback(async (uuid: string) => {
    if (!sceneFile?.root) return
    function toggle(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) return { ...n, active: !n.active }
      return { ...n, children: n.children.map(toggle) }
    }
    await saveScene(toggle(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1563: Ctrl+D — 선택 노드 + 하위 트리 복제 (새 UUID 부여)
  const handleDuplicate = useCallback(async (uuid: string) => {
    if (!sceneFile?.root) return
    const is3x = projectInfo?.version === '3x'
    const genId = () => is3x
      ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14))
      : Math.random().toString(36).slice(2, 14)
    function deepClone(n: CCSceneNode): CCSceneNode {
      return { ...n, uuid: genId(), name: n.name + '_copy', children: n.children.map(deepClone) }
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
    if (!sceneFile?.root) return
    function toggle(n: CCSceneNode): CCSceneNode {
      if (n.uuid === nodeUuid) return { ...n, active: !n.active }
      return { ...n, children: n.children.map(toggle) }
    }
    await saveScene(toggle(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleRenameInView = useCallback(async (nodeUuid: string, newName: string) => {
    if (!sceneFile?.root || !newName.trim()) return
    function rename(n: CCSceneNode): CCSceneNode {
      if (n.uuid === nodeUuid) return { ...n, name: newName.trim() }
      return { ...n, children: n.children.map(rename) }
    }
    await saveScene(rename(sceneFile.root))
  }, [sceneFile, saveScene])

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
              placeholder="노드 이름 또는 컴포넌트 타입으로 검색... (Esc 닫기)"
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
            <div style={{
              marginTop: 4, maxHeight: 200, overflowY: 'auto',
              borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)',
            }}>
              {globalSearchResults.map(({ node: n, path }) => (
                <div
                  key={n.uuid}
                  onClick={() => {
                    onSelectNode(n)
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
          )}
          {globalSearchQuery && globalSearchResults.length === 0 && (
            <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-muted)', padding: '2px 4px' }}>
              검색 결과 없음
            </div>
          )}
        </div>
      )}

      {/* 외부 파일 변경 감지 배너 (R1389: 5초 자동 숨김) */}
      {externalChange && sceneFile && !bannerHidden && (
        <div style={{
          padding: '5px 10px', background: '#2d1a00', borderBottom: '1px solid #ff9944',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#ff9944', flex: 1 }}>
            파일이 외부에서 수정됨
          </span>
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
              📁 {projectInfo.projectPath}
            </div>
            <div style={{ marginTop: 2 }}>
              씬 파일: <strong>{projectInfo.scenes?.length ?? 0}개</strong>
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

        {/* 씬 선택 드롭다운 */}
        {projectInfo?.scenes && projectInfo.scenes.length > 0 && (
          <select
            value={selectedScene}
            onChange={e => handleSceneChange(e.target.value)}
            style={{
              width: '100%', marginTop: 6, padding: '3px 6px', fontSize: 10,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4,
            }}
          >
            <option value="">씬/프리팹 선택...</option>
            {/* R1472: 씬/프리팹 그룹 분리 */}
            {projectInfo.scenes.filter(s => !s.endsWith('.prefab')).length > 0 && (
              <optgroup label="씬">
                {projectInfo.scenes.filter(s => !s.endsWith('.prefab')).map(s => (
                  <option key={s} value={s}>{s.split(/[\\/]/).pop()}</option>
                ))}
              </optgroup>
            )}
            {projectInfo.scenes.filter(s => s.endsWith('.prefab')).length > 0 && (
              <optgroup label="🧩 프리팹">
                {projectInfo.scenes.filter(s => s.endsWith('.prefab')).map(s => (
                  <option key={s} value={s}>{s.split(/[\\/]/).pop()}</option>
                ))}
              </optgroup>
            )}
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
              ↩
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
              ↪
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
                  disabled
                  title="복원 기능은 추후 구현 예정 (TODO)"
                  style={{ marginLeft: 'auto', fontSize: 8, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'default', opacity: 0.4 }}
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
              const newW = Math.max(100, Math.min(320, hDividerDragRef.current.startW + dx))
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
              <span
                onClick={() => setHideInactive(h => !h)}
                title={hideInactive ? '비활성 노드 표시' : '비활성 노드 숨기기'}
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: hideInactive ? '#58a6ff' : '#666' }}
              >{hideInactive ? '◑' : '●'}</span>
            </div>
            {/* 검색 */}
            <div style={{ padding: '2px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <TreeSearch root={sceneFile.root} onSelect={onSelectNode} />
            </div>
            {/* R1559: 씬 파일명 + 통계 */}
            {(() => {
              const statsMap: Record<string, number> = {}
              let nodeCount = 0
              const walkStats = (n: CCSceneNode) => {
                nodeCount++
                n.components.forEach(c => { statsMap[c.type] = (statsMap[c.type] ?? 0) + 1 })
                n.children.forEach(walkStats)
              }
              walkStats(sceneFile.root)
              const topComps = Object.entries(statsMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
              return (
                <div style={{ padding: '2px 6px', fontSize: 9, color: '#555', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sceneFile.scenePath.split(/[\\/]/).pop()}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 1 }}>
                    <span style={{ color: '#58a6ff' }}>{nodeCount}nodes</span>
                    {topComps.map(([type, cnt]) => (
                      <span key={type} style={{ color: '#666' }}>{type.split('.').pop()}×{cnt}</span>
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
                node={sceneFile.root}
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
              <div style={{ height: sceneViewHeight, flexShrink: 0, overflow: 'auto', borderTop: 'none' }}>
                <CCFileNodeInspector
                  node={selectedNode}
                  sceneFile={sceneFile}
                  saveScene={saveScene}
                  onUpdate={onSelectNode}
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
              // R1406: TODO — window.api.runCommand 또는 window.api.shellExec이 구현되면 실제 CLI 빌드 실행
              // 현재는 빌드 명령 미리보기 + UI 시뮬레이션
              setBuildRunning(true)
              setBuildResult(null)
              const version = projectInfo.version ?? '2.4.13'
              const editorPath = CC_EDITOR_PATHS[version] ?? CC_EDITOR_PATHS['2.4.13']
              const projPath = (projectInfo.projectPath ?? '').replace(/\\/g, '/')
              const isCC3 = version.startsWith('3')
              const cmd = isCC3
                ? `"${editorPath}" --project "${projPath}" --build "platform=${buildPlatform}"`
                : `"${editorPath}" --path "${projPath}" --build "platform=${buildPlatform}"`
              console.log('[R1406] Build command:', cmd)
              // 시뮬레이션: 2초 후 완료 (실제 실행은 IPC 구현 시)
              setTimeout(() => {
                setBuildRunning(false)
                setBuildResult({ ok: true, msg: `빌드 명령 준비됨 (${buildPlatform}). IPC 실행 대기 중.` })
              }, 1500)
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

const NODE_COLOR_PALETTE: { color: string; label: string }[] = [
  { color: '#f87171', label: '빨강' },
  { color: '#fb923c', label: '주황' },
  { color: '#facc15', label: '노랑' },
  { color: '#4ade80', label: '초록' },
  { color: '#60a5fa', label: '파랑' },
  { color: '#a78bfa', label: '보라' },
]

/** 그룹 패널 — 자식이 있는 노드를 그룹으로 표시 */
function GroupPanel({
  root,
  selectedNode,
  onSelectNode,
  onRenameGroup,
  onToggleGroupActive,
}: {
  root: CCSceneNode
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
  onRenameGroup: (uuid: string, name: string) => Promise<void>
  onToggleGroupActive: (uuid: string) => Promise<void>
}) {
  // 자식이 있는 노드를 재귀적으로 수집 (루트 제외)
  const groups = useMemo(() => {
    const result: CCSceneNode[] = []
    function collect(n: CCSceneNode, depth: number) {
      if (depth > 0 && n.children.length > 0) result.push(n)
      n.children.forEach(c => collect(c, depth + 1))
    }
    collect(root, 0)
    return result
  }, [root])

  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement | null>(null)

  // F2로 인라인 편집 시작
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && selectedNode && selectedNode.children.length > 0) {
        e.preventDefault()
        setEditingUuid(selectedNode.uuid)
        setEditValue(selectedNode.name)
      }
      if (e.key === 'Escape' && editingUuid) {
        setEditingUuid(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNode, editingUuid])

  useEffect(() => {
    if (editingUuid && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingUuid])

  const commitRename = async (uuid: string) => {
    if (editValue.trim()) await onRenameGroup(uuid, editValue.trim())
    setEditingUuid(null)
  }

  const [hiddenUuids, setHiddenUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('group-panel-hidden') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleHidden = (uuid: string) => {
    setHiddenUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('group-panel-hidden', JSON.stringify([...next]))
      return next
    })
    onToggleGroupActive(uuid)
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>
        자식 노드가 있는 그룹 노드가 없습니다.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>그룹 노드 (자식 포함)</span>
        <span style={{ fontSize: 9, color: '#555', marginLeft: 'auto' }}>{groups.length}개</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {groups.map(g => {
          const isSelected = selectedNode?.uuid === g.uuid
          return (
            <div
              key={g.uuid}
              onClick={() => onSelectNode(isSelected ? null : g)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-subtle, rgba(88,166,255,0.1))' : 'transparent',
                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                opacity: g.active ? 1 : 0.45,
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              {/* 가시성 토글 (눈 아이콘) */}
              <span
                onClick={e => { e.stopPropagation(); toggleHidden(g.uuid) }}
                title={g.active ? '숨기기' : '표시'}
                style={{
                  fontSize: 11, cursor: 'pointer', flexShrink: 0, userSelect: 'none',
                  color: g.active ? 'var(--text-muted)' : '#555',
                }}
              >
                {g.active ? '👁' : '🙈'}
              </span>

              {/* 인라인 이름 편집 */}
              {editingUuid === g.uuid ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitRename(g.uuid)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(g.uuid) }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingUuid(null) }
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 1, fontSize: 11, background: 'var(--bg-input, #1a1a2e)',
                    border: '1px solid var(--accent)', borderRadius: 3,
                    color: 'var(--text-primary)', padding: '1px 4px',
                  }}
                />
              ) : (
                <span
                  onDoubleClick={e => {
                    e.stopPropagation()
                    setEditingUuid(g.uuid)
                    setEditValue(g.name)
                  }}
                  style={{
                    flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', color: 'var(--text-primary)', userSelect: 'none',
                  }}
                  title={`${g.name} — 자식 ${g.children.length}개 (더블클릭 또는 F2로 이름 편집)`}
                >
                  {g.name}
                </span>
              )}

              {/* 자식 수 배지 */}
              <span style={{
                fontSize: 9, color: 'var(--text-muted)', flexShrink: 0,
                background: 'rgba(255,255,255,0.07)', borderRadius: 8,
                padding: '1px 5px',
              }}>
                {g.children.length}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '4px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: '#444', flexShrink: 0 }}>
        클릭: 선택 | 더블클릭/F2: 이름 편집 | 눈 아이콘: 가시성 토글
      </div>
    </div>
  )
}

/** 파싱된 CCSceneNode 트리 렌더링 */
function CCFileSceneTree({
  node, depth, selected, onSelect, onReparent, onAddChild, onDelete, onDuplicate, onToggleActive, hideInactive, favorites, onToggleFavorite, lockedUuids, onToggleLocked, nodeColors, onNodeColorChange, collapsedUuids, onToggleCollapse,
}: {
  node: CCSceneNode
  depth: number
  selected: CCSceneNode | null
  onSelect: (n: CCSceneNode | null) => void
  onReparent?: (dragUuid: string, dropUuid: string) => void
  onAddChild?: (uuid: string) => void
  onDelete?: (uuid: string) => void
  onDuplicate?: (uuid: string) => void
  onToggleActive?: (uuid: string) => void
  hideInactive?: boolean
  favorites?: Set<string>
  onToggleFavorite?: (uuid: string) => void
  lockedUuids?: Set<string>
  onToggleLocked?: (uuid: string) => void
  nodeColors?: Record<string, string>
  onNodeColorChange?: (uuid: string, color: string | null) => void
  collapsedUuids?: Set<string>
  onToggleCollapse?: (uuid: string) => void
}) {
  const [localCollapsed, setLocalCollapsed] = useState(depth > 2)
  const collapsed = collapsedUuids ? collapsedUuids.has(node.uuid) : localCollapsed
  const setCollapsed = onToggleCollapse
    ? (_updater: boolean | ((prev: boolean) => boolean)) => onToggleCollapse(node.uuid)
    : setLocalCollapsed
  const [isDragOver, setIsDragOver] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; showColorPicker?: boolean } | null>(null)
  const hasChildren = node.children.length > 0
  const isSelected = selected?.uuid === node.uuid
  const isRoot = depth === 0

  // 비활성 숨기기 (루트 제외)
  if (hideInactive && !node.active && !isRoot && !isSelected) return null

  return (
    <div>
      {ctxMenu && (
        <div
          style={{
            position: 'fixed', zIndex: 9999, left: ctxMenu.x, top: ctxMenu.y,
            background: 'var(--panel-bg, #16213e)', border: '1px solid var(--border)',
            borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: 120,
          }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          {[
            { label: '자식 추가', action: () => { setCtxMenu(null); onAddChild?.(node.uuid) } },
            ...(!isRoot ? [
              { label: node.active ? '비활성화' : '활성화', action: () => { setCtxMenu(null); onToggleActive?.(node.uuid) } },
              { label: '복제', action: () => { setCtxMenu(null); onDuplicate?.(node.uuid) } },
              { label: '삭제', action: () => { setCtxMenu(null); onDelete?.(node.uuid) } },
            ] : []),
          ].map(item => (
            <div key={item.label}
              onClick={item.action}
              style={{
                padding: '6px 12px', fontSize: 11, cursor: 'pointer',
                color: item.label === '삭제' ? '#ff6b6b' : 'var(--text-primary)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </div>
          ))}
          {/* 색상 태그 팔레트 */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '5px 8px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>색상 태그</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {NODE_COLOR_PALETTE.map(({ color, label }) => (
                <div
                  key={color}
                  title={label}
                  onClick={() => { onNodeColorChange?.(node.uuid, color); setCtxMenu(null) }}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', background: color, cursor: 'pointer',
                    border: nodeColors?.[node.uuid] === color ? '2px solid #fff' : '2px solid transparent',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
              <div
                title="초기화"
                onClick={() => { onNodeColorChange?.(node.uuid, null); setCtxMenu(null) }}
                style={{
                  width: 16, height: 16, borderRadius: '50%', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'var(--text-muted)', boxSizing: 'border-box',
                }}
              >✕</div>
            </div>
          </div>
        </div>
      )}
      <div
        id={`tree-node-${node.uuid}`}
        className="tree-node-row"
        draggable={!isRoot}
        onClick={() => { setCtxMenu(null); onSelect(isSelected ? null : node) }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onSelect(node); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', node.uuid) }}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault(); e.stopPropagation(); setIsDragOver(false)
          const dragUuid = e.dataTransfer.getData('text/plain')
          if (dragUuid) onReparent?.(dragUuid, node.uuid)
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 2,
          padding: `2px 6px 2px ${8 + depth * 14}px`,
          cursor: isRoot ? 'default' : 'grab', fontSize: 11,
          background: isDragOver ? 'rgba(88,166,255,0.18)' : isSelected ? 'var(--accent-subtle, rgba(88,166,255,0.1))' : nodeColors?.[node.uuid] ? `${nodeColors[node.uuid]}26` : 'transparent',
          color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
          userSelect: 'none',
          outline: isDragOver ? '1px dashed #58a6ff' : 'none',
          borderLeft: depth > 0 ? `1px solid ${nodeColors?.[node.uuid] ?? 'rgba(255,255,255,0.05)'}` : 'none',
        }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setCollapsed(c => !c) }}
            style={{ fontSize: 9, width: 12, textAlign: 'center', flexShrink: 0 }}
          >
            {collapsed ? '▸' : '▾'}
          </span>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        {nodeColors?.[node.uuid] && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: nodeColors[node.uuid], flexShrink: 0, display: 'inline-block' }} />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {node.name || '(unnamed)'}
        </span>
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleActive?.(node.uuid) }}
            title={node.active ? '비활성화' : '활성화'}
            style={{ fontSize: 9, color: node.active ? 'var(--text-muted)' : '#555', cursor: 'pointer', flexShrink: 0, paddingLeft: 2 }}
          >
            {node.active ? '●' : '○'}
          </span>
        )}
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleFavorite?.(node.uuid) }}
            title={favorites?.has(node.uuid) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            style={{
              fontSize: 10, cursor: 'pointer', flexShrink: 0,
              color: '#fbbf24',
              opacity: favorites?.has(node.uuid) ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
            className={favorites?.has(node.uuid) ? 'fav-star is-fav' : 'fav-star'}
          >★</span>
        )}
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleLocked?.(node.uuid) }}
            title={lockedUuids?.has(node.uuid) ? '잠금 해제' : '잠금'}
            style={{
              fontSize: 9, cursor: 'pointer', flexShrink: 0,
              color: '#f87171',
              opacity: lockedUuids?.has(node.uuid) ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
            className={lockedUuids?.has(node.uuid) ? 'lock-icon is-locked' : 'lock-icon'}
          >🔒</span>
        )}
        {node.components.length > 0 && (() => {
          const typeIconMap: Record<string, string> = {
            'cc.Sprite': '🖼', 'cc.Label': 'T', 'cc.RichText': 'T',
            'cc.Button': '⊕', 'cc.Canvas': '⊞', 'cc.Layout': '⊟',
            'cc.ScrollView': '⊠', 'cc.Camera': '📷', 'cc.Animation': '▶',
            'cc.AudioSource': '♪', 'cc.ParticleSystem': '✦',
          }
          const icons = node.components
            .map(c => typeIconMap[c.type])
            .filter(Boolean)
          const label = icons.length > 0
            ? icons.join('')
            : node.components[0].type.replace('cc.', '').slice(0, 6)
          return (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }} title={node.components.map(c => c.type).join(', ')}>
              {label}
            </span>
          )
        })()}
      </div>
      {!collapsed && hasChildren && node.children.map(child => (
        <CCFileSceneTree
          key={child.uuid}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
          onReparent={onReparent}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onToggleActive={onToggleActive}
          hideInactive={hideInactive}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          lockedUuids={lockedUuids}
          onToggleLocked={onToggleLocked}
          nodeColors={nodeColors}
          onNodeColorChange={onNodeColorChange}
          collapsedUuids={collapsedUuids}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </div>
  )
}

/** 스크러빙 라벨: 마우스 좌우 드래그로 숫자 값 조절 */
function ScrubLabel({ label, value, onChange, step = 1, inputRef }: { label: string; value: number; onChange: (v: number) => void; step?: number; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const startRef = useRef<{ x: number; v: number; moved: boolean } | null>(null)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startRef.current = { x: e.clientX, v: value, moved: false }
    const sensitivity = e.shiftKey ? 0.05 : 0.5
    const onMove = (me: MouseEvent) => {
      if (!startRef.current) return
      startRef.current.moved = true
      const dx = me.clientX - startRef.current.x
      const raw = startRef.current.v + dx * sensitivity * step
      onChange(Math.round(raw / step) * step)
    }
    const onUp = (ue: MouseEvent) => {
      const wasDrag = startRef.current?.moved ?? false
      startRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!wasDrag) {
        // 클릭으로 처리: input에 포커스
        inputRef?.current?.focus()
        inputRef?.current?.select()
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  return (
    <span
      onMouseDown={handleMouseDown}
      title={`드래그로 ${label} 조절 (Shift: 미세 조절)`}
      style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, cursor: 'ew-resize', userSelect: 'none' }}
    >{label}</span>
  )
}

/** R1516: 다중 노드 공통 속성 배치 편집 패널 */
function CCFileBatchInspector({
  uuids, sceneFile, saveScene, onSelectNode,
}: {
  uuids: string[]
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onSelectNode: (n: CCSceneNode | null) => void
}) {
  const [batchOpacity, setBatchOpacity] = useState<string>('')
  const [batchActive, setBatchActive] = useState<'active' | 'inactive' | ''>('')
  const [batchDx, setBatchDx] = useState<string>('')
  const [batchDy, setBatchDy] = useState<string>('')
  // R1553: 스케일/사이즈 일괄 편집
  const [batchScaleX, setBatchScaleX] = useState<string>('')
  const [batchScaleY, setBatchScaleY] = useState<string>('')
  const [batchSizeW, setBatchSizeW] = useState<string>('')
  const [batchSizeH, setBatchSizeH] = useState<string>('')
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  // R1575: 색상 일괄 편집
  const [batchColor, setBatchColor] = useState<string>('')

  const uuidSet = useMemo(() => new Set(uuids), [uuids])

  // 공통 opacity / active 값 감지
  const commonValues = useMemo(() => {
    if (!sceneFile.root) return null
    const nodes: CCSceneNode[] = []
    function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) nodes.push(n); n.children.forEach(collect) }
    collect(sceneFile.root)
    if (nodes.length === 0) return null
    const opacities = [...new Set(nodes.map(n => n.opacity))]
    const actives = [...new Set(nodes.map(n => n.active))]
    return {
      opacity: opacities.length === 1 ? opacities[0] : null,
      active: actives.length === 1 ? actives[0] : null,
      count: nodes.length,
    }
  }, [sceneFile.root, uuidSet])

  const applyBatch = useCallback(async () => {
    if (!sceneFile.root) return
    const opacity = batchOpacity !== '' ? Math.max(0, Math.min(255, parseInt(batchOpacity))) : null
    const active = batchActive !== '' ? batchActive === 'active' : null
    const dx = batchDx !== '' ? parseFloat(batchDx) : null
    const dy = batchDy !== '' ? parseFloat(batchDy) : null
    // R1553: 스케일/사이즈
    const scaleX = batchScaleX !== '' ? parseFloat(batchScaleX) : null
    const scaleY = batchScaleY !== '' ? parseFloat(batchScaleY) : null
    const sizeW = batchSizeW !== '' ? parseFloat(batchSizeW) : null
    const sizeH = batchSizeH !== '' ? parseFloat(batchSizeH) : null
    // R1575: 색상
    let colorRgb: { r: number; g: number; b: number; a: number } | null = null
    if (batchColor) {
      const m = batchColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
      if (m) colorRgb = { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), a: 255 }
    }
    if (opacity == null && active == null && dx == null && dy == null && scaleX == null && scaleY == null && sizeW == null && sizeH == null && !colorRgb) { setBatchMsg('변경 항목 없음'); return }

    function applyNode(n: CCSceneNode): CCSceneNode {
      if (uuidSet.has(n.uuid)) {
        let updated = { ...n }
        if (opacity != null) updated = { ...updated, opacity }
        if (active != null) updated = { ...updated, active }
        if (dx != null || dy != null) {
          const pos = n.position as { x: number; y: number; z?: number }
          updated = { ...updated, position: { ...pos, x: pos.x + (dx ?? 0), y: pos.y + (dy ?? 0) } }
        }
        if (scaleX != null || scaleY != null) {
          const sc = n.scale as { x?: number; y?: number; z?: number } | undefined
          updated = { ...updated, scale: { x: scaleX ?? sc?.x ?? 1, y: scaleY ?? sc?.y ?? 1, z: sc?.z ?? 1 } }
        }
        if (sizeW != null || sizeH != null) {
          const sz = n.size as { x?: number; y?: number } | undefined
          updated = { ...updated, size: { x: sizeW ?? sz?.x ?? 0, y: sizeH ?? sz?.y ?? 0 } }
        }
        if (colorRgb) updated = { ...updated, color: colorRgb }
        return { ...updated, children: n.children.map(applyNode) }
      }
      return { ...n, children: n.children.map(applyNode) }
    }
    const result = await saveScene(applyNode(sceneFile.root))
    setBatchMsg(result.success ? `✓ ${uuids.length}개 노드 적용` : `✗ ${result.error ?? '오류'}`)
    setTimeout(() => setBatchMsg(null), 2500)
  }, [sceneFile.root, uuidSet, batchOpacity, batchActive, batchDx, batchDy, batchScaleX, batchScaleY, batchSizeW, batchSizeH, batchColor, uuids.length, saveScene])

  return (
    <div style={{ padding: '8px 10px', fontSize: 11 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>⊕ {uuids.length}개 선택 — 일괄 편집</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}>
          {commonValues?.opacity != null ? `opacity:${commonValues.opacity}` : ''}
          {commonValues?.active != null ? ` ${commonValues.active ? '활성' : '비활성'}` : ''}
        </span>
      </div>
      {/* Active 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>Active</span>
        {(['active', 'inactive', ''] as const).map(v => (
          <button
            key={v || 'none'}
            onClick={() => setBatchActive(v)}
            style={{
              fontSize: 9, padding: '1px 6px', cursor: 'pointer', borderRadius: 3,
              background: batchActive === v ? (v === 'active' ? 'rgba(74,222,128,0.25)' : v === 'inactive' ? 'rgba(248,81,73,0.2)' : 'rgba(255,255,255,0.1)') : 'transparent',
              border: batchActive === v ? `1px solid ${v === 'active' ? '#4ade80' : v === 'inactive' ? '#f85149' : '#666'}` : '1px solid transparent',
              color: v === 'active' ? '#4ade80' : v === 'inactive' ? '#f85149' : 'var(--text-muted)',
            }}
          >{v === '' ? '(변경 안 함)' : v === 'active' ? '활성화' : '비활성화'}</button>
        ))}
      </div>
      {/* Opacity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>Opacity</span>
        <input
          type="number" min={0} max={255} placeholder={commonValues?.opacity != null ? String(commonValues.opacity) : '혼합'}
          value={batchOpacity}
          onChange={e => setBatchOpacity(e.target.value)}
          style={{ width: 56, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
        />
        <input type="range" min={0} max={255}
          value={batchOpacity !== '' ? parseInt(batchOpacity) || 0 : commonValues?.opacity ?? 255}
          onChange={e => setBatchOpacity(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      {/* Position delta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>위치 ±</span>
        <input type="number" placeholder="dX" value={batchDx} onChange={e => setBatchDx(e.target.value)}
          style={{ width: 50, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }} />
        <input type="number" placeholder="dY" value={batchDy} onChange={e => setBatchDy(e.target.value)}
          style={{ width: 50, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }} />
      </div>
      {/* R1553: Scale 일괄 설정 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>스케일</span>
        <input type="number" placeholder="X" value={batchScaleX} onChange={e => setBatchScaleX(e.target.value)} step={0.1}
          style={{ width: 50, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }} />
        <input type="number" placeholder="Y" value={batchScaleY} onChange={e => setBatchScaleY(e.target.value)} step={0.1}
          style={{ width: 50, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }} />
      </div>
      {/* R1553: Size 일괄 설정 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>사이즈</span>
        <input type="number" placeholder="W" value={batchSizeW} onChange={e => setBatchSizeW(e.target.value)} min={0}
          style={{ width: 50, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }} />
        <input type="number" placeholder="H" value={batchSizeH} onChange={e => setBatchSizeH(e.target.value)} min={0}
          style={{ width: 50, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }} />
      </div>
      {/* R1575: 색상 일괄 설정 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>색상</span>
        <input type="color"
          value={batchColor || '#ffffff'}
          onChange={e => setBatchColor(e.target.value)}
          style={{ width: 28, height: 22, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
          title="모든 선택 노드 색상 일괄 변경"
        />
        <input type="text" placeholder="#rrggbb (비워두면 유지)"
          value={batchColor}
          onChange={e => setBatchColor(e.target.value)}
          style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
        />
        {batchColor && <button onClick={() => setBatchColor('')} style={{ fontSize: 9, padding: '1px 4px', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)' }}>✕</button>}
      </div>
      {/* 적용 버튼 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={applyBatch}
          style={{ fontSize: 10, padding: '3px 12px', background: 'rgba(167,139,250,0.2)', border: '1px solid #a78bfa', borderRadius: 3, color: '#a78bfa', cursor: 'pointer' }}
        >일괄 적용</button>
        <button
          onClick={() => onSelectNode(null)}
          style={{ fontSize: 10, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer' }}
        >선택 해제</button>
        {batchMsg && <span style={{ fontSize: 9, color: batchMsg.startsWith('✓') ? '#4ade80' : '#f85149' }}>{batchMsg}</span>}
      </div>
    </div>
  )
}

/** CCSceneNode 프로퍼티 인스펙터 — 노드 선택 시 표시 */
function CCFileNodeInspector({
  node, sceneFile, saveScene, onUpdate,
}: {
  node: CCSceneNode
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onUpdate: (n: CCSceneNode | null) => void
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const COLLAPSED_COMPS_KEY = 'collapsed-comps'
  const [collapsedComps, setCollapsedComps] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_COMPS_KEY) ?? '[]')) }
    catch { return new Set() }
  })
  const [expandedArrayProps, setExpandedArrayProps] = useState<Set<string>>(new Set())
  const [lockScale, setLockScale] = useState(false)
  const [lockSize, setLockSize] = useState(false)  // R1593: 크기 비율 잠금
  // R1617: 트랜스폼 복사/붙여넣기 클립보드
  const transformClipboard = useRef<{ position: CCSceneNode['position']; rotation: CCSceneNode['rotation']; scale: CCSceneNode['scale']; size: CCSceneNode['size'] } | null>(null)
  const [transformClipFilled, setTransformClipFilled] = useState(false)
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
    <div onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
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

  // 노드 복제 (부모 아래에 형제로 추가)
  const handleDuplicate = useCallback(async () => {
    if (!sceneFile.root || !sceneFile._raw || sceneFile.root.uuid === node.uuid) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const newId = 'dup-' + Date.now()
    const origRaw = node._rawIndex != null ? { ...raw[node._rawIndex] } : {}
    const newIdx = raw.length
    raw.push({ ...origRaw, _id: newId, _name: node.name + '_Copy', _children: [] })
    const dupNode: CCSceneNode = { ...node, uuid: newId, name: node.name + '_Copy', children: [], _rawIndex: newIdx }
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === node.uuid)
      if (idx >= 0) { const ch = [...n.children]; ch.splice(idx + 1, 0, dupNode); return { ...n, children: ch } }
      return { ...n, children: n.children.map(insertAfter) }
    }
    setSaving(true)
    try {
      const result = await saveScene(insertAfter(sceneFile.root))
      if (result.success) onUpdate(dupNode)
      else { raw.pop(); setMsg({ ok: false, text: result.error ?? '복제 실패' }) }
    } catch {
      raw.pop()
      setMsg({ ok: false, text: '복제 실패' })
    } finally {
      setSaving(false)
    }
  }, [node, sceneFile, saveScene, onUpdate])

  const [propSearch, setPropSearch] = useState('')
  const [showPropSearch, setShowPropSearch] = useState(false)

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

  // 노드 교체 시 draft + 컴포넌트 접힘 상태 + propSearch 초기화
  useMemo(() => { setDraft({ ...node }); setExpandedArrayProps(new Set()); setPropSearch(''); setShowPropSearch(false) }, [node.uuid])
  const copiedCompRef = useRef<{ type: string; props: Record<string, unknown> } | null>(null)
  const [compCopied, setCompCopied] = useState<string | null>(null) // 복사된 comp type 표시용
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

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
    transformClipboard = snap
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
    if (!snap && transformClipboard) snap = transformClipboard
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

  // 노드 경로 계산 (root → 선택 노드)
  const nodePath = useMemo(() => {
    const path: string[] = []
    function find(n: CCSceneNode, target: string): boolean {
      if (n.uuid === target) { path.push(n.name); return true }
      for (const c of n.children) {
        path.push(n.name)
        if (find(c, target)) return true
        path.pop()
      }
      return false
    }
    find(sceneFile.root, node.uuid)
    return path
  }, [sceneFile.root, node.uuid])

  // Z-order 정보 (같은 부모 내 인덱스, 형제 수)
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
    return { idx, total: parent.children.length }
  }, [sceneFile.root, node.uuid])

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

  return (
    <div style={{
      flexShrink: 0, borderTop: '1px solid var(--border)',
      padding: '6px 10px', background: 'var(--bg-secondary, #0d0d1a)', maxHeight: 420, overflowY: 'auto',
    }}>
      {nodePath.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={nodePath.join(' / ')}>
            {nodePath.slice(0, -1).map((p, i) => (
              <span key={i}><span>{p}</span><span style={{ margin: '0 3px' }}>/</span></span>
            ))}
            <span style={{ color: 'var(--accent)' }}>{nodePath[nodePath.length - 1]}</span>
          </div>
          {/* R1488: 노드 통계 뱃지 — 깊이/자식/컴포넌트 수 */}
          <div style={{ display: 'flex', gap: 3, flexShrink: 0, alignItems: 'center' }}>
            {nodePath.length > 1 && <span style={{ fontSize: 8, color: '#556', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title="깊이 (루트=0)">d{nodePath.length - 1}</span>}
            {draft.children.length > 0 && <span style={{ fontSize: 8, color: '#565', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title={`자식 노드 ${draft.children.length}개`}>▸{draft.children.length}</span>}
            {draft.components.length > 0 && <span style={{ fontSize: 8, color: '#556a', padding: '1px 3px', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} title={`컴포넌트 ${draft.components.length}개`}>⊕{draft.components.length}</span>}
            {/* R1492: 경로 복사 버튼 */}
            <span
              title={`경로 복사: ${nodePath.join(' / ')}`}
              onClick={() => navigator.clipboard.writeText(nodePath.join(' / '))
                .then(() => { /* silent */ })
                .catch(() => { /* silent */ })}
              style={{ fontSize: 8, color: '#445', padding: '1px 3px', borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#88aacc')}
              onMouseLeave={e => (e.currentTarget.style.color = '#445')}
            >⎘</span>
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
              onClick={() => onSelectNode(nextNode)}
              style={{ fontSize: 8, background: 'rgba(255,153,0,0.12)', border: '1px solid rgba(255,153,0,0.35)', borderRadius: 3, padding: '0 4px', color: '#ff9900', cursor: 'pointer' }}
              title={`씬 내 "${draft.name}" 이름의 노드 ${dupes.length}개 — 클릭: 다음 노드 선택`}>⚠ 중복 이름 ×{dupes.length} ›</span>
          </div>
        )
      })()}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <input
          defaultValue={draft.name}
          onBlur={e => applyAndSave({ name: e.target.value })}
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
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={e => applyAndSave({ active: e.target.checked })}
              style={{ margin: 0 }}
            />
            활성
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
                <span style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  Z: {zOrderInfo.idx + 1} / {zOrderInfo.total}
                </span>
              )}
              <button onClick={() => handleZOrderEdge('first')} disabled={!zOrderInfo || zOrderInfo.idx === 0} title="맨 앞으로" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === 0 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === 0 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === 0 ? '#333' : '#555'}`, lineHeight: 1.4 }}>⤒</button>
              <button onClick={() => handleZOrder(-1)} disabled={!zOrderInfo || zOrderInfo.idx === 0} title="앞으로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === 0 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === 0 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === 0 ? '#333' : '#555'}`, lineHeight: 1.4 }}>↑</button>
              <button onClick={() => handleZOrder(1)} disabled={!zOrderInfo || zOrderInfo.idx === zOrderInfo.total - 1} title="뒤로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === zOrderInfo?.total - 1 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#333' : '#555'}`, lineHeight: 1.4 }}>↓</button>
              <button onClick={() => handleZOrderEdge('last')} disabled={!zOrderInfo || zOrderInfo.idx === zOrderInfo.total - 1} title="맨 뒤로" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === zOrderInfo?.total - 1 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#333' : '#555'}`, lineHeight: 1.4 }}>⤓</button>
              <button
                onClick={handleDuplicate}
                title="노드 복제"
                style={{
                  padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                  background: 'transparent', color: '#58a6ff', border: '1px solid #58a6ff',
                  lineHeight: 1.4,
                }}
              >
                복제
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
            </div>
            {numInput('X', draft.position.x, v => applyAndSave({ position: { ...draft.position, x: v } }))}
            {numInput('Y', draft.position.y, v => applyAndSave({ position: { ...draft.position, y: v } }))}
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
            </div>
            {numInput('Z°', rotation, v => {
              const r = typeof draft.rotation === 'number' ? v : { ...(draft.rotation as object), z: v } as CCSceneNode['rotation']
              applyAndSave({ rotation: r })
            })}
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              크기
              {/* R1592: 크기 정수 반올림 버튼 */}
              <span title="크기 정수 반올림 (Round to integer)" onClick={() => applyAndSave({ size: { x: Math.round(draft.size.x), y: Math.round(draft.size.y) } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⌊⌉</span>
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
            </div>
            {numInput('X', draft.scale.x, v => {
              const ratio = draft.scale.x !== 0 ? v / draft.scale.x : 1
              applyAndSave({ scale: lockScale ? { x: v, y: draft.scale.y * ratio, z: draft.scale.z ?? 1 } : { ...draft.scale, x: v } })
            }, 0.01)}
            {numInput('Y', draft.scale.y, v => {
              const ratio = draft.scale.y !== 0 ? v / draft.scale.y : 1
              applyAndSave({ scale: lockScale ? { x: draft.scale.x * ratio, y: v, z: draft.scale.z ?? 1 } : { ...draft.scale, y: v } })
            }, 0.01)}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          {numInput('aX', draft.anchor.x, v => applyAndSave({ anchor: { ...draft.anchor, x: v } }), 0.01)}
          {numInput('aY', draft.anchor.y, v => applyAndSave({ anchor: { ...draft.anchor, y: v } }), 0.01)}
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
          {((draft.color?.r ?? 255) !== 255 || (draft.color?.g ?? 255) !== 255 || (draft.color?.b ?? 255) !== 255) && (
            <span
              title="tint 초기화 (흰색)"
              onClick={() => applyAndSave({ color: { r: 255, g: 255, b: 255, a: draft.color?.a ?? 255 } })}
              style={{ fontSize: 9, color: '#555', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >↺</span>
          )}
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
        {/* 앵커 9-point grid 프리셋 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 14px)', gap: 1, marginTop: 4, justifyContent: 'start' }}>
          {([0, 0.5, 1] as const).flatMap(ay => ([0, 0.5, 1] as const).map(ax => {
            const isActive = Math.abs(draft.anchor.x - ax) < 0.01 && Math.abs(draft.anchor.y - ay) < 0.01
            return (
              <div
                key={`${ax}-${ay}`}
                title={`앵커 (${ax}, ${ay})`}
                onClick={() => applyAndSave({ anchor: { x: ax, y: ay } })}
                style={{
                  width: 14, height: 14, borderRadius: 2, cursor: 'pointer',
                  background: isActive ? '#58a6ff' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            )
          }))}
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
            </>
          )}
        </div>
      )}

      {/* 컴포넌트 props */}
      {secHeader('comps', `컴포넌트 (${draft.components.length})`)}
      {/* R1536: PropSearch 키 하이라이트 헬퍼 */}
      {!collapsed['comps'] && (() => {
        const skipTypes = ['cc.UITransform', 'cc.Canvas', 'cc.PrefabInfo', 'cc.CompPrefabInfo', 'cc.SceneGlobals', 'cc.AmbientInfo', 'cc.ShadowsInfo', 'cc.FogInfo', 'cc.OctreeInfo', 'cc.SkyboxInfo']
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
            <span style={{ flex: 1, opacity: comp.props.enabled === false ? 0.5 : 1 }}>
              {isCustomScript(comp.type) ? '📝 ' : ''}{comp.type.includes('.') ? comp.type.split('.').pop() : comp.type}
            </span>
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
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select value={layoutType}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: v, layoutType: v } } : c)
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
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resizeMode: v } } : c)
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
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        placeholder={label as string}
                        style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>pad</span>
                    {[['L', pLeft, 'paddingLeft'], ['R', pRight, 'paddingRight'], ['T', pTop, 'paddingTop'], ['B', pBottom, 'paddingBottom']].map(([label, val, key]) => (
                      <input key={key as string} type="number" defaultValue={val as number} step={1}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        placeholder={label as string}
                        style={{ width: 32, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    ))}
                  </div>
                  {layoutType === 3 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={autoWrap}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoWrap: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />autoWrap
                    </label>
                  )}
                </div>
              )
            }
            // R1590: cc.Graphics Quick Edit
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>lineWidth</label>
                      <input type="number" min={0} value={Number(p.lineWidth ?? 1)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'lineWidth', Number(ev.target.value))} />
                    </div>
                    <div />
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>fillColor</label>
                      <input type="color" value={toHex(p.fillColor as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'fillColor', fromHex(ev.target.value, 255))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>strokeColor</label>
                      <input type="color" value={toHex(p.strokeColor as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'strokeColor', fromHex(ev.target.value, 255))} />
                    </div>
                  </div>
                </div>
              )
            }
            // R1589: cc.Sprite / cc.Sprite2D Quick Edit
            if (comp.type === 'cc.Sprite' || comp.type === 'cc.Sprite2D') {
              const SPRITE_TYPE = ['Simple', 'Sliced', 'Tiled', 'Filled']
              const SIZE_MODE = ['Custom', 'Trimmed', 'Raw']
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>type</label>
                      <select value={Number(p.type ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'type', Number(ev.target.value))}>
                        {SPRITE_TYPE.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>sizeMode</label>
                      <select value={Number(p.sizeMode ?? 1)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'sizeMode', Number(ev.target.value))}>
                        {SIZE_MODE.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <input type="checkbox" checked={!!(p.trim ?? true)}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'trim', ev.target.checked)} />
                      trim
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <input type="checkbox" checked={!!(p.grayscale ?? false)}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'grayscale', ev.target.checked)} />
                      grayscale
                    </label>
                  </div>
                </div>
              )
            }
            // R1588: cc.LabelOutline / cc.LabelShadow Quick Edit
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
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {comp.type === 'cc.LabelOutline' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11 }}>width</label>
                      <input type="number" min={0} max={20} value={Number(p.width ?? 0)}
                        style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'width', Number(ev.target.value))} />
                      <label style={{ fontSize: 11 }}>color</label>
                      <input type="color" value={toHex(p.color as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: 36, height: 22, border: 'none', background: 'none', cursor: 'pointer' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'color', fromHex(ev.target.value))} />
                    </div>
                  )}
                  {comp.type === 'cc.LabelShadow' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>offsetX</label>
                        <input type="number" value={Number((p.offset as { x?: number })?.x ?? 2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onChange={ev => onPropChange?.(node.uuid, comp.type, 'offsetX', Number(ev.target.value))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>offsetY</label>
                        <input type="number" value={Number((p.offset as { y?: number })?.y ?? -2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onChange={ev => onPropChange?.(node.uuid, comp.type, 'offsetY', Number(ev.target.value))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>blur</label>
                        <input type="number" min={0} max={20} value={Number(p.blur ?? 2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onChange={ev => onPropChange?.(node.uuid, comp.type, 'blur', Number(ev.target.value))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>color</label>
                        <input type="color" value={toHex(p.color as { r?: number; g?: number; b?: number } | undefined)}
                          style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                          onChange={ev => onPropChange?.(node.uuid, comp.type, 'color', fromHex(ev.target.value))} />
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            // R1587: cc.Toggle / cc.ToggleContainer Quick Edit
            if (comp.type === 'cc.Toggle' || comp.type === 'cc.ToggleContainer') {
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {comp.type === 'cc.Toggle' && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.isChecked ?? false)}
                          onChange={ev => onPropChange?.(node.uuid, comp.type, 'isChecked', ev.target.checked)} />
                        isChecked
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.interactable ?? true)}
                          onChange={ev => onPropChange?.(node.uuid, comp.type, 'interactable', ev.target.checked)} />
                        interactable
                      </label>
                    </>
                  )}
                  {comp.type === 'cc.ToggleContainer' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <input type="checkbox" checked={!!(p.allowSwitchOff ?? false)}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'allowSwitchOff', ev.target.checked)} />
                      allowSwitchOff
                    </label>
                  )}
                </div>
              )
            }
            // R1586: cc.EditBox — 텍스트 입력 필드 Quick Edit
            if (comp.type === 'cc.EditBox') {
              const INPUT_MODE = ['Any', 'EmailAddr', 'Numeric', 'PhoneNumber', 'URL', 'Decimal', 'SingleLine']
              const INPUT_FLAG = ['Default', 'Password', 'Sensitive', 'InitialCapsWord', 'InitialCapsSentence', 'InitialCapsAllChars']
              const RETURN_TYPE = ['Default', 'Done', 'Send', 'Search', 'Go', 'Next']
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>string (초기값)</label>
                    <input type="text" value={String(p.string ?? '')}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onChange={ev => onPropChange?.(node.uuid, comp.type, 'string', ev.target.value)} />
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>placeholder</label>
                    <input type="text" value={String(p.placeholder ?? '')}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onChange={ev => onPropChange?.(node.uuid, comp.type, 'placeholder', ev.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>maxLength</label>
                      <input type="number" value={Number(p.maxLength ?? 20)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'maxLength', Number(ev.target.value))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>fontSize</label>
                      <input type="number" value={Number(p.fontSize ?? 20)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'fontSize', Number(ev.target.value))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>inputMode</label>
                      <select value={Number(p.inputMode ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'inputMode', Number(ev.target.value))}>
                        {INPUT_MODE.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>inputFlag</label>
                      <select value={Number(p.inputFlag ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'inputFlag', Number(ev.target.value))}>
                        {INPUT_FLAG.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>returnType</label>
                    <select value={Number(p.returnType ?? 0)}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onChange={ev => onPropChange?.(node.uuid, comp.type, 'returnType', Number(ev.target.value))}>
                      {RETURN_TYPE.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                    </select>
                  </div>
                </div>
              )
            }
            // R1585: cc.RichText — 서식 텍스트 Quick Edit
            if (comp.type === 'cc.RichText') {
              const HALIGN = ['Left', 'Center', 'Right']
              const OVERFLOW = ['None', 'Clamp', 'Shrink', 'Resize']
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>내용 (HTML 태그 지원)</label>
                    <textarea
                      value={String(p.string ?? '')}
                      rows={3}
                      style={{ width: '100%', fontSize: 11, resize: 'vertical', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', boxSizing: 'border-box' }}
                      onChange={ev => onPropChange?.(node.uuid, comp.type, 'string', ev.target.value)}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>fontSize</label>
                      <input type="number" value={Number(p.fontSize ?? 40)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'fontSize', Number(ev.target.value))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>lineHeight</label>
                      <input type="number" value={Number(p.lineHeight ?? 40)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'lineHeight', Number(ev.target.value))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>maxWidth (0=무제한)</label>
                      <input type="number" value={Number(p.maxWidth ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'maxWidth', Number(ev.target.value))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>horizontalAlign</label>
                      <select value={Number(p.horizontalAlign ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'horizontalAlign', Number(ev.target.value))}>
                        {HALIGN.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>overflow</label>
                    <select value={Number(p.overflow ?? 0)}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onChange={ev => onPropChange?.(node.uuid, comp.type, 'overflow', Number(ev.target.value))}>
                      {OVERFLOW.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                    </select>
                  </div>
                </div>
              )
            }
            // R1582: cc.Widget — align flags + offsets Quick Edit
            if (comp.type === 'cc.Widget') {
              const isTop = !!(p.isAlignTop ?? false)
              const isBottom = !!(p.isAlignBottom ?? false)
              const isLeft = !!(p.isAlignLeft ?? false)
              const isRight = !!(p.isAlignRight ?? false)
              const alignMode = Number(p.alignMode ?? 1)
              const edges = [
                ['top', isTop, 'isAlignTop', 'top'],
                ['bottom', isBottom, 'isAlignBottom', 'bottom'],
                ['left', isLeft, 'isAlignLeft', 'left'],
                ['right', isRight, 'isAlignRight', 'right'],
              ] as const
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 50, flexShrink: 0 }}>mode</span>
                    <select value={alignMode}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, alignMode: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Once</option>
                      <option value={1}>Always</option>
                      <option value={2}>Editor</option>
                    </select>
                  </div>
                </div>
              )
            }
            // R1581: cc.Button — transition 타입 + state 색상 미리보기
            if (comp.type === 'cc.Button') {
              const transition = Number(p.transition ?? 0)
              const interactable = !!(p.interactable ?? true)
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
                  {transition === 1 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {stateColors.map(([label, val]) => (
                        <div key={label as string} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <input type="color" value={toHex(val)}
                            onChange={e => {
                              const hex = e.target.value
                              const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
                              const colorKey = `${label as string}Color`
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [colorKey]: { r, g, b, a: 255 }, [`_N$${colorKey}`]: { r, g, b, a: 255 } } } : c)
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
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, zoomScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={interactable}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, interactable: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />interactable
                  </label>
                </div>
              )
            }
            if (comp.type === 'cc.Toggle') {
              const checked = !!(p.isChecked ?? false)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 4px 2px' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>isChecked</span>
                  <input type="checkbox" checked={checked}
                    onChange={e => {
                      const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isChecked: e.target.checked } } : c)
                      applyAndSave({ components: updated })
                    }}
                  />
                  <span style={{ fontSize: 9, color: checked ? '#4ade80' : '#888' }}>{checked ? '✓ checked' : '○ unchecked'}</span>
                </div>
              )
            }
            if (comp.type === 'cc.ProgressBar') {
              const progress = Number(p.progress ?? 0)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0 4px 2px' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>progress</span>
                  <input type="range" min={0} max={1} step={0.01} value={progress}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, progress: v } } : c)
                      applyAndSave({ components: updated })
                    }}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Math.round(progress * 100)}%</span>
                </div>
              )
            }
            if (comp.type === 'cc.AudioSource') {
              const volume = Number(p.volume ?? 1)
              const loop = !!(p.loop ?? false)
              const playOnLoad = !!(p.playOnLoad ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>volume</span>
                    <input type="range" min={0} max={1} step={0.01} value={volume}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: parseFloat(e.target.value) } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={playOnLoad}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> playOnLoad
                    </label>
                  </div>
                </div>
              )
            }
            // R1620: cc.Label — 텍스트 Quick Edit (string + fontSize)
            if (comp.type === 'cc.Label') {
              const str = String(p.string ?? p.String ?? p._string ?? '')
              const fs = Number(p.fontSize ?? p._fontSize ?? p._N$fontSize ?? 24)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0, marginTop: 2 }}>string</span>
                    <textarea
                      defaultValue={str}
                      rows={2}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value, _string: e.target.value, _N$string: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, boxSizing: 'border-box', fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>fontSize</span>
                    <input type="number" defaultValue={fs} min={1} max={200}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || fs
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 60, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.RichText') {
              const str = String(p.string ?? p.String ?? '')
              return (
                <div style={{ padding: '2px 0 4px 2px' }}>
                  <textarea
                    defaultValue={str}
                    rows={2}
                    onBlur={e => {
                      const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value } } : c)
                      applyAndSave({ components: updated })
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', resize: 'vertical' }}
                  />
                </div>
              )
            }
            // R1538: cc.EditBox — 텍스트/플레이스홀더/maxLength 편집
            if (comp.type === 'cc.EditBox') {
              const str = String(p.string ?? '')
              const placeholder = String(p.placeholder ?? '')
              const maxLength = Number(p.maxLength ?? -1)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>string</span>
                    <input type="text" defaultValue={str}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>placeholder</span>
                    <input type="text" defaultValue={placeholder}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholder: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 3, padding: '1px 4px', fontStyle: 'italic' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>maxLength</span>
                    <input type="number" defaultValue={maxLength} min={-1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxLength: parseInt(e.target.value) || -1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{maxLength < 0 ? '(unlimited)' : `≤${maxLength}`}</span>
                  </div>
                </div>
              )
            }
            // R1524: cc.Animation — 클립 드롭다운 + defaultClip 표시
            if (comp.type === 'cc.Animation') {
              const clips = (p._resolvedClips as Array<{ name: string }> | undefined) ?? []
              const defaultClipName = p._defaultClipName as string | undefined
              if (clips.length === 0) return null
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', paddingLeft: 62 }}>{clips.length} clip{clips.length !== 1 ? 's' : ''}</span>
                </div>
              )
            }
            // R1562: cc.Slider — progress + direction Quick Edit
            if (comp.type === 'cc.Slider') {
              const progress = Number(p.progress ?? p._N$progress ?? 0)
              const direction = Number(p.direction ?? p._N$direction ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>progress</span>
                    <input type="range" min={0} max={1} step={0.01} value={progress}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, progress: v, _N$progress: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Math.round(progress * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>direction</span>
                    <select value={direction}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Horizontal</option>
                      <option value={1}>Vertical</option>
                    </select>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>remoteURL</span>
                    <input type="text" defaultValue={url}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, remoteURL: e.target.value, _N$remoteURL: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>playbackRate</span>
                    <input type="number" defaultValue={playbackRate} min={0} max={4} step={0.25}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playbackRate: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={muted}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, muted: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> muted
                    </label>
                  </div>
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
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedRatio: v, _speedRatio: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={playOnLoad}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked } } : c)
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0 4px 2px' }}>
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
              )
            }
            // R1572: cc.Mask — type/inverted/alphaThreshold Quick Edit
            if (comp.type === 'cc.Mask') {
              const maskType = Number(p._type ?? p.type ?? 0)
              const inverted = !!(p._inverted ?? p.inverted ?? false)
              const alphaThreshold = Number(p._alphaThreshold ?? p.alphaThreshold ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _inverted: e.target.checked, inverted: e.target.checked } } : c)
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
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>direction</span>
                    <select value={direction}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Horizontal</option>
                      <option value={1}>Vertical</option>
                    </select>
                  </div>
                  {[['scrollThreshold', scrollThreshold], ['autoTurning', autoThreshold]].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>{label as string}</span>
                      <input type="range" min={0} max={1} step={0.05} value={val as number}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          const k = label === 'scrollThreshold' ? 'scrollThreshold' : 'autoPageTurningThreshold'
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [k]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{(val as number).toFixed(2)}</span>
                    </div>
                  ))}
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
                </div>
              )
            }
            // R1566: cc.ParticleSystem / cc.ParticleSystem2D — Quick Edit
            if (comp.type === 'cc.ParticleSystem' || comp.type === 'cc.ParticleSystem2D') {
              const duration = Number(p.duration ?? -1)
              const maxParticles = Number(p.maxParticles ?? 150)
              const durKey = comp.type === 'cc.ParticleSystem2D' ? '_N$duration' : '_duration'
              const maxKey = comp.type === 'cc.ParticleSystem2D' ? '_N$totalParticles' : '_N$maxParticles'
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>duration</span>
                    <input type="number" defaultValue={duration} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || -1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, duration: v, [durKey]: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 60, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{duration === -1 ? '(loop)' : 's'}</span>
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
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      ['horizontal', horizontal, 'horizontal'],
                      ['vertical', vertical, 'vertical'],
                      ['inertia', inertia, 'inertia'],
                      ['elastic', elastic, 'elastic'],
                    ].map(([label, val, key]) => (
                      <label key={key as string} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={val as boolean}
                          onChange={e => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: e.target.checked } } : c)
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
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, brake: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{brake.toFixed(2)}</span>
                  </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>layerName</span>
                    <input type="text" defaultValue={layerName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, layerName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>opacity</span>
                    <input type="number" defaultValue={layerOpacity} min={0} max={1} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, opacity: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={visible}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, visible: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#4ade80' }}
                    />visible
                  </label>
                </div>
              )
            }
            // R1591: cc.BoxCollider/BoxCollider2D + cc.CircleCollider/CircleCollider2D Quick Edit
            if (comp.type === 'cc.BoxCollider' || comp.type === 'cc.BoxCollider2D') {
              const off = p.offset as { x?: number; y?: number } | undefined
              const sz = p.size as { width?: number; height?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset X</label>
                      <input type="number" value={Number(off?.x ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'offset', { ...(off ?? {}), x: Number(ev.target.value) })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset Y</label>
                      <input type="number" value={Number(off?.y ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'offset', { ...(off ?? {}), y: Number(ev.target.value) })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>width</label>
                      <input type="number" min={0} value={Number(sz?.width ?? 100)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'size', { ...(sz ?? {}), width: Number(ev.target.value) })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>height</label>
                      <input type="number" min={0} value={Number(sz?.height ?? 100)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'size', { ...(sz ?? {}), height: Number(ev.target.value) })} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <input type="checkbox" checked={!!(p.sensor ?? false)}
                      onChange={ev => onPropChange?.(node.uuid, comp.type, 'sensor', ev.target.checked)} />
                    sensor
                  </label>
                </div>
              )
            }
            if (comp.type === 'cc.CircleCollider' || comp.type === 'cc.CircleCollider2D') {
              const off = p.offset as { x?: number; y?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset X</label>
                      <input type="number" value={Number(off?.x ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'offset', { ...(off ?? {}), x: Number(ev.target.value) })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset Y</label>
                      <input type="number" value={Number(off?.y ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'offset', { ...(off ?? {}), y: Number(ev.target.value) })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>radius</label>
                      <input type="number" min={0} value={Number(p.radius ?? 50)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => onPropChange?.(node.uuid, comp.type, 'radius', Number(ev.target.value))} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <input type="checkbox" checked={!!(p.sensor ?? false)}
                          onChange={ev => onPropChange?.(node.uuid, comp.type, 'sensor', ev.target.checked)} />
                        sensor
                      </label>
                    </div>
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
              const gravityScale = Number(p.gravityScale ?? 1)
              const fixedRotation = !!(p.fixedRotation ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>type</span>
                    <select defaultValue={rbType}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: parseInt(e.target.value) } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      {rbTypes.map((t, i) => <option key={i} value={i}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>mass</span>
                    <input type="number" defaultValue={mass} min={0} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mass: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>gravityScale</span>
                    <input type="number" defaultValue={gravityScale} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravityScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>linearDamp</span>
                    <input type="number" defaultValue={linearDamping} min={0} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearDamping: parseFloat(e.target.value) || 0 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={fixedRotation}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fixedRotation: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#58a6ff' }}
                    />fixedRotation
                  </label>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>armature</span>
                    <input type="text" defaultValue={armatureName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, armatureName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>animation</span>
                    <input type="text" defaultValue={animationName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, animationName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>timeScale</span>
                    <input type="number" defaultValue={timeScale} step={0.1} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>playTimes</span>
                    <input type="number" defaultValue={playTimes} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playTimes: parseInt(e.target.value) || 0 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{playTimes === 0 ? '(loop∞)' : `×${playTimes}`}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={loop}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#4ade80' }}
                    />loop
                  </label>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>skin</span>
                    <input type="text" defaultValue={defaultSkin}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, defaultSkin: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>animation</span>
                    <input type="text" defaultValue={defaultAnimation}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, defaultAnimation: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>timeScale</span>
                    <input type="number" defaultValue={timeScale} step={0.1} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#4ade80' }}
                      />loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={paused}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, paused: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#f87171' }}
                      />paused
                    </label>
                  </div>
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
            // R1536: propSearch 매칭 시 키 이름 하이라이트
            const propKeyLabel = (key: string): React.ReactNode => {
              if (!propSearch) return key
              const lk = key.toLowerCase(), lq = propSearch.toLowerCase()
              const idx = lk.indexOf(lq)
              if (idx < 0) return key
              return <>{key.slice(0, idx)}<mark style={{ background: 'rgba(250,204,21,0.25)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{key.slice(idx, idx + propSearch.length)}</mark>{key.slice(idx + propSearch.length)}</>
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
        return (
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', padding: '3px 0' }}>
              + 컴포넌트 추가
            </summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {compTypes.map(ct => (
                <span
                  key={ct}
                  onClick={() => applyAndSave({ components: [...draft.components, { type: ct, props: {} }] })}
                  style={{
                    fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                    border: '1px solid var(--border)', color: 'var(--text-muted)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {ct.split('.').pop()}
                </span>
              ))}
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
      {/* R1497: Raw JSON 뷰 */}
      {secHeader('rawJson', 'Raw JSON')}
      {!collapsed['rawJson'] && (
        <div style={{ marginTop: 4 }}>
          <pre style={{
            fontSize: 8, fontFamily: 'monospace', color: '#556', background: 'rgba(0,0,0,0.2)',
            borderRadius: 3, padding: '4px 6px', overflowX: 'auto', maxHeight: 160, overflowY: 'auto',
            userSelect: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {JSON.stringify({
              uuid: draft.uuid,
              name: draft.name,
              active: draft.active,
              position: draft.position,
              rotation: draft.rotation,
              scale: draft.scale,
              size: draft.size,
              anchor: draft.anchor,
              opacity: draft.opacity,
              color: draft.color,
              components: draft.components.map(c => ({ type: c.type, props: c.props })),
            }, null, 2)}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(draft, null, 2)).catch(() => {})}
            style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', marginTop: 3, background: 'transparent', border: '1px solid #444', color: '#666' }}
          >
            JSON 복사
          </button>
        </div>
      )}
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

/** 씬 트리 노드 이름 검색 + 선택 */

function TreeSearch({ root, onSelect }: { root: CCSceneNode; onSelect: (n: CCSceneNode | null) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CCSceneNode[]>([])
  const [open, setOpen] = useState(false)
  // R1558: 키보드 탐색
  const [activeIdx, setActiveIdx] = useState(-1)

  const search = useCallback((q: string) => {
    setQuery(q)
    setActiveIdx(-1)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    const ql = q.toLowerCase()
    const found: CCSceneNode[] = []
    function walk(n: CCSceneNode) {
      // R1558: 이름 + 컴포넌트 타입 모두 검색
      const nameMatch = n.name.toLowerCase().includes(ql)
      const compMatch = n.components.some(c => c.type.toLowerCase().includes(ql))
      if (nameMatch || compMatch) found.push(n)
      n.children.forEach(walk)
    }
    walk(root)
    setResults(found.slice(0, 12))
    setOpen(true)
  }, [root])

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        value={query}
        onChange={e => search(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="노드/컴포넌트 검색..."
        onKeyDown={e => {
          // R1558: ↑↓ 탐색, Enter 선택, Escape 닫기
          if (!open || results.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') {
            e.preventDefault()
            const idx = activeIdx >= 0 ? activeIdx : 0
            if (results[idx]) { onSelect(results[idx]); setQuery(''); setOpen(false) }
          }
          else if (e.key === 'Escape') { setOpen(false); setQuery('') }
        }}
        style={{
          width: '100%', background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 10, boxSizing: 'border-box',
        }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border)',
          borderRadius: 4, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {results.map((n, i) => (
            <div
              key={n.uuid}
              onMouseDown={() => { onSelect(n); setQuery(''); setOpen(false) }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: '4px 8px', fontSize: 10, cursor: 'pointer',
                color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                background: i === activeIdx ? 'rgba(88,166,255,0.15)' : 'transparent',
              }}
            >
              {n.name || '(unnamed)'}
              {n.components.length > 0 && (
                <span style={{ marginLeft: 4, color: '#58a6ff', fontSize: 8 }}>
                  {n.components.map(c => c.type.split('.').pop()).join(' · ')}
                </span>
              )}
              {!n.active && <span style={{ marginLeft: 4, fontSize: 8, color: '#f85149' }}>◌</span>}
            </div>
          ))}
          <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-muted)' }}>
            {results.length}개 결과 {results.length === 12 ? '(최대 12개)' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 에셋 브라우저 ──────────────────────────────────────────────────────────

type AssetEntry = { uuid: string; path: string; relPath: string; type: string }

const ASSET_TYPE_GROUPS: { key: string; icon: string; label: string; types: string[] }[] = [
  { key: 'texture', icon: '🖼', label: 'Texture', types: ['texture', 'sprite-atlas'] },
  { key: 'prefab', icon: '📦', label: 'Prefab', types: ['prefab'] },
  { key: 'scene', icon: '🎬', label: 'Scene', types: ['scene'] },
  { key: 'script', icon: '📜', label: 'Script', types: ['script'] },
  { key: 'audio', icon: '🔊', label: 'Audio', types: ['audio'] },
  { key: 'font', icon: '🔤', label: 'Font', types: ['font'] },
]

// R1382: 에셋 파일 타입 아이콘 매핑
function getAssetFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['fire', 'scene'].includes(ext)) return '🎬'
  if (['prefab'].includes(ext)) return '📦'
  if (['ts', 'js', 'coffee'].includes(ext)) return '📜'
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg'].includes(ext)) return '🖼'
  if (['mp3', 'ogg', 'wav', 'aac'].includes(ext)) return '🔊'
  if (['ttf', 'otf', 'woff', 'fnt', 'bmfont'].includes(ext)) return '🔤'
  if (['json', 'plist'].includes(ext)) return '📋'
  if (['anim', 'clip'].includes(ext)) return '🎞'
  return '📄'
}

// R1382: 폴더 트리 빌드
type FolderNode = { name: string; path: string; children: FolderNode[]; files: AssetEntry[] }

function buildFolderTree(entries: AssetEntry[]): FolderNode {
  const root: FolderNode = { name: 'assets', path: '', children: [], files: [] }
  const folderMap = new Map<string, FolderNode>()
  folderMap.set('', root)

  const getOrCreateFolder = (dirPath: string): FolderNode => {
    if (folderMap.has(dirPath)) return folderMap.get(dirPath)!
    const parts = dirPath.split('/')
    const parentPath = parts.slice(0, -1).join('/')
    const parent = getOrCreateFolder(parentPath)
    const folder: FolderNode = { name: parts[parts.length - 1], path: dirPath, children: [], files: [] }
    parent.children.push(folder)
    folderMap.set(dirPath, folder)
    return folder
  }

  for (const entry of entries) {
    const parts = entry.relPath.split(/[\\/]/)
    const dirParts = parts.slice(0, -1)
    const dirPath = dirParts.join('/')
    const folder = getOrCreateFolder(dirPath)
    folder.files.push(entry)
  }

  // sort children alphabetically
  const sortFolder = (f: FolderNode) => {
    f.children.sort((a, b) => a.name.localeCompare(b.name))
    f.files.sort((a, b) => a.relPath.localeCompare(b.relPath))
    f.children.forEach(sortFolder)
  }
  sortFolder(root)
  return root
}

// R1434: 에셋 썸네일 미리보기 팝업
const THUMB_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'])

function AssetThumbnailPopup({ path: filePath, anchorX, anchorY }: { path: string; anchorX: number; anchorY: number }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setSrc(null)
    window.api.readFileBase64(filePath).then(b64 => {
      if (cancelled) return
      if (!b64) { setLoadError(true); setLoading(false); return }
      const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : ext === 'bmp' ? 'image/bmp' : 'image/png'
      setSrc(`data:${mime};base64,${b64}`)
      setFileSize(Math.round((b64.length * 3 / 4) / 1024))
      setLoading(false)
    }).catch(() => { if (!cancelled) { setLoadError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [filePath])

  // 팝업 위치: 커서 우측, 화면 가장자리 넘지 않도록
  const popupW = 140
  const popupH = 160
  const left = anchorX + popupW > window.innerWidth ? anchorX - popupW - 8 : anchorX + 12
  const top = anchorY + popupH > window.innerHeight ? window.innerHeight - popupH - 8 : anchorY

  return (
    <div style={{
      position: 'fixed', left, top, width: popupW, zIndex: 9999,
      background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)', padding: 6, pointerEvents: 'none',
    }}>
      <div style={{ width: 128, height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden' }}>
        {loading && <span style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>...</span>}
        {loadError && <span style={{ fontSize: 24 }}>📄</span>}
        {src && <img src={src} alt={fileName} style={{ maxWidth: 128, maxHeight: 128, objectFit: 'contain' }} />}
      </div>
      <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
      {fileSize != null && <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{fileSize} KB</div>}
    </div>
  )
}

function CCFileAssetBrowser({ assetsDir, sceneFile, saveScene, onSelectNode }: {
  assetsDir: string
  sceneFile?: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onSelectNode: (n: CCSceneNode | null) => void
}) {
  const [assets, setAssets] = useState<Record<string, AssetEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  // R1382: 뷰 모드 — 'group'(기존) vs 'tree'(폴더 트리)
  const [assetViewMode, setAssetViewMode] = useState<'group' | 'tree'>('group')
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(new Set())
  // R1398: 프리팹 인스턴스화 상태
  const [instantiating, setInstantiating] = useState<string | null>(null)
  // R1434: 에셋 썸네일 미리보기 상태
  const [thumbHover, setThumbHover] = useState<{ path: string; x: number; y: number } | null>(null)
  const thumbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // R1444: 씬에서 사용 중인 스크립트 UUID 집합
  const usedScriptUuids = useMemo(() => {
    const used = new Set<string>()
    if (!sceneFile?.root || !assets) return used
    // 씬의 모든 컴포넌트 타입에서 __uuid__ 참조 추출
    function walkNode(node: CCSceneNode): void {
      for (const comp of node.components) {
        // 커스텀 스크립트 타입은 __type__에 UUID가 포함됨
        if (comp.type && !comp.type.startsWith('cc.')) {
          used.add(comp.type)
        }
        // props에서 __uuid__ 참조 확인
        if (comp.props) {
          for (const val of Object.values(comp.props)) {
            if (val && typeof val === 'object') {
              const r = val as Record<string, unknown>
              if (typeof r.__uuid__ === 'string') used.add(r.__uuid__)
            }
          }
        }
      }
      for (const child of node.children) walkNode(child)
    }
    walkNode(sceneFile.root)
    return used
  }, [sceneFile?.root, assets])

  // R1444: 스크립트 파일인지 확인
  const isScriptFile = useCallback((entry: AssetEntry) => {
    const ext = entry.path.split('.').pop()?.toLowerCase() ?? ''
    return ['ts', 'js'].includes(ext) || entry.type === 'script'
  }, [])

  // R1444: 스크립트가 씬에서 사용 중인지 확인
  const isScriptUsed = useCallback((entry: AssetEntry) => {
    if (!isScriptFile(entry)) return false
    // UUID로 직접 매핑 또는 relPath 기반 매핑
    if (usedScriptUuids.has(entry.uuid)) return true
    // 스크립트 이름으로 유추 (UUID가 다를 수 있으므로)
    const scriptName = entry.relPath.split(/[\\/]/).pop()?.replace(/\.(ts|js)$/, '') ?? ''
    for (const typeId of usedScriptUuids) {
      if (typeId.includes(scriptName)) return true
    }
    return false
  }, [isScriptFile, usedScriptUuids])

  // R1444: 파일 탭에서 스크립트 열기
  const handleOpenScript = useCallback((entry: AssetEntry) => {
    window.dispatchEvent(new CustomEvent('cc:open-file', { detail: entry.path }))
  }, [])

  // R1398: .prefab 파일을 현재 씬에 인스턴스화
  const handleInstantiatePrefab = useCallback(async (entry: AssetEntry) => {
    if (!sceneFile?.root || !sceneFile._raw) return
    setInstantiating(entry.uuid)
    try {
      // prefab 파일 읽기 + 파싱 (readFile → JSON parse → 루트 노드 추출)
      const prefabContent = await window.api.readFile(entry.path)
      if (!prefabContent) { setInstantiating(null); return }
      const prefabRaw = JSON.parse(prefabContent) as Record<string, unknown>[]
      // Prefab 루트 노드 찾기: cc.Prefab.data → __id__
      let rootIdx = -1
      for (const e of prefabRaw) {
        if (e.__type__ === 'cc.Prefab') {
          const dataRef = e.data as { __id__?: number } | undefined
          if (dataRef?.__id__ != null) { rootIdx = dataRef.__id__; break }
        }
      }
      if (rootIdx < 0) rootIdx = prefabRaw.findIndex(e => e.__type__ === 'cc.Node')
      if (rootIdx < 0) { setInstantiating(null); return }

      const prefabEntry = prefabRaw[rootIdx]
      const raw = sceneFile._raw as Record<string, unknown>[]
      const version = sceneFile.projectInfo.version ?? '2x'
      const newId = 'prefab-' + Date.now()
      const newIdx = raw.length
      const prefabName = (prefabEntry._name as string) ?? entry.relPath.split(/[\\/]/).pop()?.replace('.prefab', '') ?? 'Prefab'

      // 새 raw 엔트리 생성
      const newRawEntry: Record<string, unknown> = version === '3x' ? {
        __type__: 'cc.Node', _id: newId, _name: prefabName, _active: true,
        _children: [], _components: [],
        _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
        _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
        _uiProps: { _localOpacity: 1 },
      } : {
        __type__: 'cc.Node', _id: newId, _name: prefabName, _active: true,
        _children: [], _components: [],
        _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
        _contentSize: { width: (prefabEntry._contentSize as { width?: number })?.width ?? 100, height: (prefabEntry._contentSize as { height?: number })?.height ?? 100 },
        _anchorPoint: { x: 0.5, y: 0.5 },
        _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
      }
      raw.push(newRawEntry)

      const cs = prefabEntry._contentSize as { width?: number; height?: number } | undefined
      const newNode: CCSceneNode = {
        uuid: newId, name: prefabName, active: true,
        position: { x: 0, y: 0, z: 0 },
        rotation: version === '3x' ? { x: 0, y: 0, z: 0 } : 0,
        scale: { x: 1, y: 1, z: 1 },
        size: { x: cs?.width ?? 100, y: cs?.height ?? 100 },
        anchor: { x: 0.5, y: 0.5 },
        opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 },
        components: [], children: [], _rawIndex: newIdx,
      }

      // Canvas 자식으로 추가 (Canvas 없으면 루트 자식)
      function findCanvas(n: CCSceneNode): CCSceneNode | null {
        if (n.components.some(c => c.type === 'cc.Canvas')) return n
        for (const ch of n.children) { const f = findCanvas(ch); if (f) return f }
        return null
      }
      const canvas = findCanvas(sceneFile.root)
      const parentUuid = canvas?.uuid ?? sceneFile.root.uuid

      function addToParent(n: CCSceneNode): CCSceneNode {
        if (n.uuid === parentUuid) return { ...n, children: [...n.children, newNode] }
        return { ...n, children: n.children.map(addToParent) }
      }

      const result = await saveScene(addToParent(sceneFile.root))
      if (result.success) {
        onSelectNode(newNode)
      } else {
        raw.pop()
      }
    } catch {
      // parse error — ignore
    } finally {
      setInstantiating(null)
    }
  }, [sceneFile, saveScene, onSelectNode])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.api.ccFileBuildUUIDMap(assetsDir).then(map => {
      if (!cancelled) { setAssets(map); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [assetsDir])

  const grouped = useMemo(() => {
    if (!assets) return []
    const entries = Object.values(assets)
    const lowerQ = search.toLowerCase()
    const filtered = lowerQ
      ? entries.filter(e => e.relPath.toLowerCase().includes(lowerQ))
      : entries

    const groups: { key: string; icon: string; label: string; items: AssetEntry[] }[] = []
    const assigned = new Set<string>()

    for (const g of ASSET_TYPE_GROUPS) {
      const items = filtered.filter(e => g.types.includes(e.type))
      if (items.length > 0) {
        groups.push({ key: g.key, icon: g.icon, label: g.label, items })
        items.forEach(i => assigned.add(i.uuid))
      }
    }

    const others = filtered.filter(e => !assigned.has(e.uuid))
    if (others.length > 0) {
      groups.push({ key: 'other', icon: '📄', label: '기타', items: others })
    }

    return groups
  }, [assets, search])

  const handleCopy = useCallback((entry: AssetEntry) => {
    navigator.clipboard.writeText(entry.relPath).catch(() => {})
    setCopied(entry.uuid)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  // R1434: 이미지 에셋 호버 → 썸네일 팝업
  const handleThumbEnter = useCallback((entry: AssetEntry, e: React.MouseEvent) => {
    const ext = entry.path.split('.').pop()?.toLowerCase() ?? ''
    if (!THUMB_IMAGE_EXTS.has(ext)) return
    if (thumbTimerRef.current) clearTimeout(thumbTimerRef.current)
    thumbTimerRef.current = setTimeout(() => {
      setThumbHover({ path: entry.path, x: e.clientX, y: e.clientY })
    }, 300)
  }, [])
  const handleThumbLeave = useCallback(() => {
    if (thumbTimerRef.current) { clearTimeout(thumbTimerRef.current); thumbTimerRef.current = null }
    setThumbHover(null)
  }, [])
  const handleThumbMove = useCallback((e: React.MouseEvent) => {
    setThumbHover(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
        에셋 스캔 중...
      </div>
    )
  }

  if (!assets || Object.keys(assets).length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
        에셋을 찾을 수 없습니다
      </div>
    )
  }

  // R1382: 폴더 트리 데이터
  const folderTree = useMemo(() => {
    if (!assets) return null
    const entries = Object.values(assets)
    const lowerQ = search.toLowerCase()
    const filtered = lowerQ ? entries.filter(e => e.relPath.toLowerCase().includes(lowerQ)) : entries
    return buildFolderTree(filtered)
  }, [assets, search])

  const toggleTreeFolder = useCallback((path: string) => {
    setTreeExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // R1382: 재귀 폴더 노드 렌더링
  const renderFolderNode = (node: FolderNode, depth: number): React.ReactNode => {
    const hasContent = node.children.length > 0 || node.files.length > 0
    if (!hasContent) return null
    const isOpen = treeExpanded.has(node.path)
    return (
      <div key={node.path || 'root'} style={{ marginLeft: depth * 12 }}>
        <div
          onClick={() => toggleTreeFolder(node.path)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px',
            cursor: 'pointer', borderRadius: 3, fontSize: 10,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
        >
          <span style={{ fontSize: 8, color: 'var(--text-muted)', width: 10 }}>{isOpen ? '▾' : '▸'}</span>
          <span>{isOpen ? '📂' : '📁'}</span>
          <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500 }}>{node.name || 'assets'}</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{node.files.length + node.children.length}</span>
        </div>
        {isOpen && (
          <>
            {node.children.map(child => renderFolderNode(child, depth + 1))}
            {node.files.map(file => {
              const fileName = file.relPath.split(/[\\/]/).pop() ?? file.relPath
              return (
                <div
                  key={file.uuid}
                  onClick={() => handleCopy(file)}
                  title={`${file.relPath}\n클릭하여 경로 복사`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '2px 4px 2px 22px', marginLeft: (depth + 1) * 12,
                    cursor: 'pointer', fontSize: 10, borderRadius: 3,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.08)'; handleThumbEnter(file, e) }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; handleThumbLeave() }}
                  onMouseMove={handleThumbMove}
                >
                  {/* R1444: 스크립트 사용 상태 dot */}
                  {isScriptFile(file) && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: isScriptUsed(file) ? '#22c55e' : '#6b7280',
                    }} title={isScriptUsed(file) ? '씬에서 사용 중' : '미사용'} />
                  )}
                  <span style={{ flexShrink: 0 }}>{getAssetFileIcon(fileName)}</span>
                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: copied === file.uuid ? 'var(--accent)' : 'var(--text-primary)',
                  }}>
                    {copied === file.uuid ? '✓ 복사됨' : fileName}
                  </span>
                  {/* R1444: 스크립트 편집 버튼 */}
                  {isScriptFile(file) && (
                    <button
                      onClick={e => { e.stopPropagation(); handleOpenScript(file) }}
                      onDoubleClick={e => { e.stopPropagation(); handleOpenScript(file) }}
                      title="파일 탭에서 편집"
                      style={{
                        fontSize: 9, padding: '0 4px', background: 'none', border: '1px solid var(--accent)',
                        borderRadius: 3, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0, lineHeight: '16px',
                      }}
                    >{'\u270F\uFE0F'}</button>
                  )}
                  {/* R1398: .prefab 트리 뷰 인스턴스화 버튼 */}
                  {file.type === 'prefab' && sceneFile?.root && (
                    <button
                      onClick={e => { e.stopPropagation(); handleInstantiatePrefab(file) }}
                      disabled={instantiating === file.uuid}
                      title="씬에 추가"
                      style={{
                        fontSize: 10, padding: '0 4px', background: 'none', border: '1px solid var(--accent)',
                        borderRadius: 3, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0, lineHeight: '16px',
                        opacity: instantiating === file.uuid ? 0.5 : 1,
                      }}
                    >{instantiating === file.uuid ? '...' : '+'}
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 검색 + 뷰 모드 토글 */}
      <div style={{ padding: '6px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="에셋 검색..."
            style={{
              flex: 1, fontSize: 11, padding: '4px 8px', boxSizing: 'border-box',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4,
            }}
          />
          {/* R1382: 뷰 모드 토글 */}
          <button
            onClick={() => setAssetViewMode(v => v === 'group' ? 'tree' : 'group')}
            title={assetViewMode === 'group' ? '폴더 트리 뷰로 전환' : '타입 그룹 뷰로 전환'}
            style={{
              fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)',
              borderRadius: 4, cursor: 'pointer', flexShrink: 0,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
            }}
          >
            {assetViewMode === 'group' ? '📁' : '📊'}
          </button>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
          전체 {Object.keys(assets).length}개 에셋 ({assetViewMode === 'group' ? '타입별' : '폴더별'})
        </div>
      </div>

      {/* R1382: 폴더 트리 뷰 */}
      {assetViewMode === 'tree' && folderTree && (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
          {renderFolderNode(folderTree, 0)}
        </div>
      )}

      {/* 그룹 리스트 (기존) */}
      {assetViewMode === 'group' && (
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
        {grouped.length === 0 && (
          <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 10, textAlign: 'center' }}>
            검색 결과 없음
          </div>
        )}
        {grouped.map(g => (
          <div key={g.key} style={{ marginBottom: 2 }}>
            {/* 그룹 헤더 */}
            <div
              onClick={() => toggleGroup(g.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 4px',
                cursor: 'pointer', userSelect: 'none', borderRadius: 3,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontSize: 8, color: 'var(--text-muted)', width: 10 }}>
                {expanded.has(g.key) ? '▾' : '▸'}
              </span>
              <span style={{ fontSize: 11 }}>{g.icon}</span>
              <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>
                {g.label}
              </span>
              <span style={{
                fontSize: 9, color: 'var(--text-muted)', padding: '0 5px',
                background: 'rgba(255,255,255,0.06)', borderRadius: 8,
              }}>
                {g.items.length}
              </span>
            </div>
            {/* 그룹 항목 */}
            {expanded.has(g.key) && g.items.map(item => (
              <div
                key={item.uuid}
                onClick={() => handleCopy(item)}
                title={`${item.relPath}\n클릭하여 경로 복사`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 22px',
                  cursor: 'pointer', fontSize: 10, borderRadius: 3,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.08)'; handleThumbEnter(item, e) }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; handleThumbLeave() }}
                onMouseMove={handleThumbMove}
              >
                {/* R1444: 스크립트 사용 상태 dot (그룹 뷰) */}
                {isScriptFile(item) && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: isScriptUsed(item) ? '#22c55e' : '#6b7280',
                  }} title={isScriptUsed(item) ? '씬에서 사용 중' : '미사용'} />
                )}
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: copied === item.uuid ? 'var(--accent)' : 'var(--text-primary)',
                }}>
                  {copied === item.uuid ? '✓ 복사됨' : item.relPath.split(/[\\/]/).pop()}
                </span>
                <span style={{
                  fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%',
                  direction: 'rtl', textAlign: 'left',
                }}>
                  {item.relPath.split(/[\\/]/).slice(0, -1).join('/')}
                </span>
                {/* R1444: 스크립트 편집 버튼 (그룹 뷰) */}
                {isScriptFile(item) && (
                  <button
                    onClick={e => { e.stopPropagation(); handleOpenScript(item) }}
                    onDoubleClick={e => { e.stopPropagation(); handleOpenScript(item) }}
                    title="파일 탭에서 편집"
                    style={{
                      fontSize: 9, padding: '0 4px', background: 'none', border: '1px solid var(--accent)',
                      borderRadius: 3, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0, lineHeight: '16px',
                    }}
                  >{'\u270F\uFE0F'}</button>
                )}
                {/* R1398: .prefab 인스턴스화 버튼 */}
                {item.type === 'prefab' && sceneFile?.root && (
                  <button
                    onClick={e => { e.stopPropagation(); handleInstantiatePrefab(item) }}
                    disabled={instantiating === item.uuid}
                    title="씬에 추가"
                    style={{
                      fontSize: 10, padding: '0 4px', background: 'none', border: '1px solid var(--accent)',
                      borderRadius: 3, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0, lineHeight: '16px',
                      opacity: instantiating === item.uuid ? 0.5 : 1,
                    }}
                  >{instantiating === item.uuid ? '...' : '+'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      )}
      {/* R1434: 에셋 썸네일 미리보기 팝업 */}
      {thumbHover && <AssetThumbnailPopup path={thumbHover.path} anchorX={thumbHover.x} anchorY={thumbHover.y} />}
      {/* R1461: 프로젝트 생성 마법사 모달 */}
      {showProjectWizard && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 8, padding: 16,
            minWidth: 280, maxWidth: 340, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
              {'🆕'} 새 CC 프로젝트 (Step {wizardStep}/3)
            </div>
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>프로젝트 이름</label>
                <input
                  value={wizardProjectName}
                  onChange={e => setWizardProjectName(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>저장 위치</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    value={wizardSavePath}
                    onChange={e => setWizardSavePath(e.target.value)}
                    placeholder="C:/Users/.../Projects"
                    style={{ flex: 1, padding: '4px 8px', fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                  <button
                    onClick={async () => {
                      const path = await window.api.openFolder()
                      if (path) setWizardSavePath(path)
                    }}
                    style={{ padding: '4px 8px', fontSize: 10, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4 }}
                  >{'...'}</button>
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>CC 버전 선택</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['2x', '3x'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setWizardCCVersion(v)}
                      style={{
                        flex: 1, padding: '8px 0', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                        background: wizardCCVersion === v ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                        color: wizardCCVersion === v ? '#fff' : 'var(--text-primary)',
                        border: wizardCCVersion === v ? 'none' : '1px solid var(--border)',
                        fontWeight: wizardCCVersion === v ? 600 : 400,
                      }}
                    >CC {v === '2x' ? '2.x' : '3.x'}</button>
                  ))}
                </div>
              </div>
            )}
            {wizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>프로젝트 템플릿</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([{ key: 'empty' as const, label: '빈 프로젝트' }, { key: 'ui' as const, label: 'UI 프로젝트' }]).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setWizardTemplate(t.key)}
                      style={{
                        flex: 1, padding: '8px 0', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                        background: wizardTemplate === t.key ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                        color: wizardTemplate === t.key ? '#fff' : 'var(--text-primary)',
                        border: wizardTemplate === t.key ? 'none' : '1px solid var(--border)',
                        fontWeight: wizardTemplate === t.key ? 600 : 400,
                      }}
                    >{t.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                  {wizardProjectName}/{wizardCCVersion === '2x' ? 'assets/scenes/Main.fire' : 'assets/scenes/Main.scene'}
                </div>
              </div>
            )}
            {wizardError && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 6 }}>{wizardError}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowProjectWizard(false)}
                style={{ padding: '4px 12px', fontSize: 10, borderRadius: 4, cursor: 'pointer', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >취소</button>
              {wizardStep > 1 && (
                <button
                  onClick={() => setWizardStep((wizardStep - 1) as 1 | 2 | 3)}
                  style={{ padding: '4px 12px', fontSize: 10, borderRadius: 4, cursor: 'pointer', background: 'none', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >이전</button>
              )}
              {wizardStep < 3 ? (
                <button
                  onClick={() => setWizardStep((wizardStep + 1) as 1 | 2 | 3)}
                  style={{ padding: '4px 12px', fontSize: 10, borderRadius: 4, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: '#fff' }}
                >다음</button>
              ) : (
                <button
                  onClick={handleCreateProject}
                  disabled={wizardCreating}
                  style={{ padding: '4px 12px', fontSize: 10, borderRadius: 4, cursor: wizardCreating ? 'wait' : 'pointer', background: '#22c55e', border: 'none', color: '#fff', opacity: wizardCreating ? 0.6 : 1 }}
                >{wizardCreating ? '생성 중...' : '생성'}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
