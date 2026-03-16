import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'

// ── 에셋 브라우저 ──────────────────────────────────────────────────────────

export type AssetEntry = { uuid: string; path: string; relPath: string; type: string }

export const ASSET_TYPE_GROUPS: { key: string; icon: string; label: string; types: string[] }[] = [
  { key: 'texture', icon: '🖼', label: 'Texture', types: ['texture', 'sprite-atlas'] },
  { key: 'prefab', icon: '📦', label: 'Prefab', types: ['prefab'] },
  { key: 'scene', icon: '🎬', label: 'Scene', types: ['scene'] },
  { key: 'script', icon: '📜', label: 'Script', types: ['script'] },
  { key: 'audio', icon: '🔊', label: 'Audio', types: ['audio'] },
  { key: 'font', icon: '🔤', label: 'Font', types: ['font'] },
]

// R1382: 에셋 파일 타입 아이콘 매핑
export function getAssetFileIcon(filename: string): string {
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
export type FolderNode = { name: string; path: string; children: FolderNode[]; files: AssetEntry[] }

export function buildFolderTree(entries: AssetEntry[]): FolderNode {
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

export function AssetThumbnailPopup({ path: filePath, anchorX, anchorY }: { path: string; anchorX: number; anchorY: number }) {
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
      {/* R1676: JSON 복사 토스트 */}
      {jsonCopiedName && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a2e', border: '1px solid #4caf50', borderRadius: 6, padding: '6px 14px', fontSize: 11, color: '#4caf50', pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap' }}>
          📋 JSON 복사됨: {jsonCopiedName}
        </div>
      )}
    </div>
  )
}

// ── 노드 트리 검색 ──────────────────────────────────────────────────────────

export function TreeSearch({ root, onSelect, onQueryChange }: { root: CCSceneNode; onSelect: (n: CCSceneNode | null) => void; onQueryChange?: (q: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CCSceneNode[]>([])
  const [totalFound, setTotalFound] = useState(0)
  const [open, setOpen] = useState(false)
  // R1558: 키보드 탐색
  const [activeIdx, setActiveIdx] = useState(-1)
  // R1679: 더 보기 (페이지 크기 증가)
  const [pageSize, setPageSize] = useState(12)
  // R1694: 최근 검색어 히스토리
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tree-search-history') ?? '[]') } catch { return [] }
  })

  const search = useCallback((q: string, ps?: number) => {
    setQuery(q)
    setActiveIdx(-1)
    onQueryChange?.(q)
    if (!q.trim()) { setResults([]); setTotalFound(0); setOpen(false); setPageSize(12); return }
    // R2498: /regex/ 구문 지원 — 슬래시로 시작하면 정규식으로 파싱
    let regex: RegExp | null = null
    if (q.startsWith('/') && q.length > 1) {
      try { regex = new RegExp(q.slice(1), 'i') } catch { /* invalid regex — fall back to literal */ }
    }
    const ql = q.toLowerCase()
    const found: CCSceneNode[] = []
    function walk(n: CCSceneNode) {
      // R1558: 이름 + 컴포넌트 타입 모두 검색
      const nameMatch = regex ? regex.test(n.name) : n.name.toLowerCase().includes(ql)
      const compMatch = !regex && n.components.some(c => c.type.toLowerCase().includes(ql))
      if (nameMatch || compMatch) found.push(n)
      n.children.forEach(walk)
    }
    walk(root)
    const limit = ps ?? pageSize
    setTotalFound(found.length)
    setResults(found.slice(0, limit))
    setOpen(true)
  }, [root, pageSize])

  const addToHistory = (q: string) => {
    if (!q.trim()) return
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, 8)
      localStorage.setItem('tree-search-history', JSON.stringify(next))
      return next
    })
  }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        value={query}
        onChange={e => search(e.target.value)}
        onFocus={() => { if (!query.trim() && searchHistory.length > 0) setOpen(true) }}
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
            if (results[idx]) { addToHistory(query); onSelect(results[idx]); setQuery(''); setOpen(false) }
          }
          else if (e.key === 'Escape') { setOpen(false); setQuery('') }
        }}
        style={{
          width: '100%', background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 10, boxSizing: 'border-box',
        }}
      />
      {/* R1694: 빈 검색 + 포커스 → 최근 검색어 드롭다운 */}
      {open && !query.trim() && searchHistory.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border)',
          borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>최근 검색</div>
          {searchHistory.map((h, i) => (
            <div
              key={i}
              onMouseDown={() => { search(h); addToHistory(h) }}
              style={{ padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>🕐 {h}</span>
              <span onMouseDown={e => { e.stopPropagation(); setSearchHistory(prev => { const next = prev.filter((_, j) => j !== i); localStorage.setItem('tree-search-history', JSON.stringify(next)); return next }) }} style={{ color: '#555', fontSize: 9 }}>×</span>
            </div>
          ))}
        </div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border)',
          borderRadius: 4, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {results.map((n, i) => (
            <div
              key={n.uuid}
              onMouseDown={() => { addToHistory(query); onSelect(n); setQuery(''); setOpen(false) }}
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
          {/* R1679: 전체 결과 수 + 더 보기 */}
          <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{results.length < totalFound ? `${results.length} / ${totalFound}개` : `${totalFound}개`}</span>
            {results.length < totalFound && (
              <span
                onMouseDown={e => { e.preventDefault(); const np = pageSize + 12; setPageSize(np); search(query, np) }}
                style={{ cursor: 'pointer', color: '#58a6ff', fontSize: 8 }}
              >더 보기 ▾</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
