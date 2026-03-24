import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { type AssetEntry, ASSET_TYPE_GROUPS, getAssetFileIcon, buildFolderTree, type FolderNode } from './assetUtils'
import { AssetThumbnailPopup } from './AssetThumbnailPopup'

// re-exports for backward compatibility
export type { AssetEntry, FolderNode } from './assetUtils'
export { ASSET_TYPE_GROUPS, getAssetFileIcon, buildFolderTree } from './assetUtils'
export { AssetThumbnailPopup } from './AssetThumbnailPopup'
export { TreeSearch } from './TreeSearch'

// ── 에셋 브라우저 ──────────────────────────────────────────────────────────

// R1434: 이미지 에셋 호버 → 썸네일 팝업
const THUMB_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'])

export function CCFileAssetBrowser({ assetsDir, sceneFile, saveScene, onSelectNode, showProjectWizard, setShowProjectWizard, wizardStep, setWizardStep, wizardProjectName, setWizardProjectName, wizardSavePath, setWizardSavePath, wizardCCVersion, setWizardCCVersion, wizardTemplate, setWizardTemplate, wizardCreating, wizardError, handleCreateProject, jsonCopiedName }: {
  assetsDir: string
  sceneFile?: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onSelectNode: (n: CCSceneNode | null) => void
  showProjectWizard: boolean
  setShowProjectWizard: (v: boolean) => void
  wizardStep: 1 | 2 | 3
  setWizardStep: (v: 1 | 2 | 3) => void
  wizardProjectName: string
  setWizardProjectName: (v: string) => void
  wizardSavePath: string
  setWizardSavePath: (v: string) => void
  wizardCCVersion: '2x' | '3x'
  setWizardCCVersion: (v: '2x' | '3x') => void
  wizardTemplate: 'empty' | 'ui'
  setWizardTemplate: (v: 'empty' | 'ui') => void
  wizardCreating: boolean
  wizardError: string | null
  handleCreateProject: () => void
  jsonCopiedName: string | null
}) {
  const [assets, setAssets] = useState<Record<string, AssetEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['prefab']))
  const [copied, setCopied] = useState<string | null>(null)
  // R1382: 뷰 모드 — 'group'(기존) vs 'tree'(폴더 트리)
  const [assetViewMode, setAssetViewMode] = useState<'group' | 'tree'>('group')
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(new Set())
  // R1398: 프리팹 인스턴스화 상태
  const [instantiating, setInstantiating] = useState<string | null>(null)
  // R1434: 에셋 썸네일 미리보기 상태
  const [thumbHover, setThumbHover] = useState<{ path: string; x: number; y: number } | null>(null)
  const thumbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 에셋 액션 팝업 상태
  const [actionPopup, setActionPopup] = React.useState<{
    entry: AssetEntry
    x: number
    y: number
  } | null>(null)

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
      if (typeId === scriptName) return true
    }
    return false
  }, [isScriptFile, usedScriptUuids])

  // R1444: 파일 탭에서 스크립트 열기
  const handleOpenScript = useCallback((entry: AssetEntry) => {
    window.dispatchEvent(new CustomEvent('cc:open-file', { detail: entry.path }))
  }, [])

  // 더블클릭 → 파일 열기 (cc:open-file 이벤트 → 앱이 확장자별로 라우팅)
  const handleDoubleClickAsset = useCallback((entry: AssetEntry) => {
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
      if (prefabContent.length > 5 * 1024 * 1024) {
        console.warn('[AssetBrowser] prefab too large:', entry.path)
        setInstantiating(null); return
      }
      let prefabRaw: Record<string, unknown>[]
      try {
        prefabRaw = JSON.parse(prefabContent) as Record<string, unknown>[]
      } catch (e) {
        console.warn('[AssetBrowser] prefab parse error:', entry.path, e)
        setInstantiating(null); return
      }
      if (!Array.isArray(prefabRaw)) {
        console.warn('Invalid prefab format: expected array')
        return
      }
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

  const handleItemClick = useCallback((entry: AssetEntry, e: React.MouseEvent) => {
    e.stopPropagation()
    setActionPopup({ entry, x: e.clientX, y: e.clientY })
  }, [])

  const popupItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '5px 10px', background: 'transparent', border: 'none',
    color: 'var(--text-primary)', cursor: 'pointer', fontSize: 10,
    whiteSpace: 'nowrap',
  }

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

  // R1382: 폴더 트리 데이터 — 반드시 early return 전에 호출 (Rules of Hooks)
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

  // R1382: 재귀 폴더 노드 렌더링
  const renderFolderNode = (node: FolderNode, depth: number): React.ReactNode => {
    const hasContent = node.children.length > 0 || node.files.length > 0
    if (!hasContent) return null

    // root node는 헤더 없이 children + files 바로 렌더링
    if (!node.path) {
      return (
        <React.Fragment key="root">
          {node.children.map(child => renderFolderNode(child, depth))}
          {node.files.map(file => {
            const fileName = file.relPath.split(/[\\/]/).pop() ?? file.relPath
            return (
              <div
                key={file.uuid}
                draggable={true}
                onDragStart={e => {
                  e.dataTransfer.setData('application/cc-asset', JSON.stringify({ uuid: file.uuid, path: file.path, relPath: file.relPath, type: file.type }))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onDoubleClick={e => { e.stopPropagation(); handleDoubleClickAsset(file) }}
                onContextMenu={e => { e.preventDefault(); handleItemClick(file, e) }}
                title={`${file.relPath}\n더블클릭: 파일 열기 / 우클릭: 액션 메뉴`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: `2px 4px 2px ${(depth + 1) * 12 + 22}px`,
                  cursor: 'pointer', fontSize: 10, borderRadius: 3,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
              >
                <span style={{ flexShrink: 0 }}>{getAssetFileIcon(fileName)}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
              </div>
            )
          })}
        </React.Fragment>
      )
    }

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
                  draggable={true}
                  onDragStart={e => {
                    e.dataTransfer.setData('application/cc-asset', JSON.stringify({ uuid: file.uuid, path: file.path, relPath: file.relPath, type: file.type }))
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onDoubleClick={e => { e.stopPropagation(); handleDoubleClickAsset(file) }}
                  onContextMenu={e => { e.preventDefault(); handleItemClick(file, e) }}
                  title={`${file.relPath}\n더블클릭: 파일 열기 / 우클릭: 액션 메뉴`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '2px 4px 2px 22px', marginLeft: (depth + 1) * 12,
                    cursor: 'grab', fontSize: 10, borderRadius: 3,
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
                draggable={true}
                onDragStart={e => {
                  e.dataTransfer.setData('application/cc-asset', JSON.stringify({ uuid: item.uuid, path: item.path, relPath: item.relPath, type: item.type }))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onDoubleClick={e => { e.stopPropagation(); handleDoubleClickAsset(item) }}
                onContextMenu={e => { e.preventDefault(); handleItemClick(item, e) }}
                title={`${item.relPath}\n더블클릭: 파일 열기 / 우클릭: 액션 메뉴`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 22px',
                  cursor: 'grab', fontSize: 10, borderRadius: 3,
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
      {/* R1676: JSON 복사 토스트 */}
      {jsonCopiedName && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a2e', border: '1px solid #4caf50', borderRadius: 6, padding: '6px 14px', fontSize: 11, color: '#4caf50', pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap' }}>
          📋 JSON 복사됨: {jsonCopiedName}
        </div>
      )}
      {/* 에셋 액션 팝업 */}
      {actionPopup && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setActionPopup(null)}
          />
          <div style={{
            position: 'fixed',
            left: Math.min(actionPopup.x, window.innerWidth - 180),
            top: Math.min(actionPopup.y, window.innerHeight - 200),
            zIndex: 999,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            minWidth: 170,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            fontSize: 10,
          }}>
            {/* 파일명 헤더 */}
            <div style={{ padding: '3px 10px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {actionPopup.entry.relPath.split('/').pop()}
            </div>
            {/* 편집기에서 열기 — 스크립트만 */}
            {(actionPopup.entry.type === 'script' || /\.(ts|js)$/i.test(actionPopup.entry.path)) && (
              <button
                style={popupItemStyle}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('cc:open-file', { detail: actionPopup.entry.path }))
                  setActionPopup(null)
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >✏️ 편집기에서 열기</button>
            )}
            {/* 경로 복사 */}
            <button
              style={popupItemStyle}
              onClick={() => {
                navigator.clipboard.writeText(actionPopup.entry.relPath).catch(() => {})
                setActionPopup(null)
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >📋 경로 복사</button>
            {/* UUID 복사 */}
            {actionPopup.entry.uuid && (
              <button
                style={popupItemStyle}
                onClick={() => {
                  navigator.clipboard.writeText(actionPopup.entry.uuid).catch(() => {})
                  setActionPopup(null)
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >🔑 UUID 복사</button>
            )}
            {/* 절대경로 복사 */}
            <button
              style={popupItemStyle}
              onClick={() => {
                navigator.clipboard.writeText(actionPopup.entry.path).catch(() => {})
                setActionPopup(null)
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >📁 절대경로 복사</button>
            {/* 드래그 힌트 */}
            <div style={{ padding: '4px 10px 3px', borderTop: '1px solid var(--border)', color: '#555', fontSize: 8, lineHeight: 1.4 }}>
              💡 인스펙터로 드래그하여 연결
            </div>
          </div>
        </>
      )}
    </div>
  )
}
