import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'

interface DirEntry { name: string; path: string; isDir: boolean }

const VIEWABLE_EXT = new Set(['md', 'json', 'ts', 'tsx', 'js', 'jsx', 'css', 'html', 'py', 'rs', 'go', 'java', 'sh', 'yaml', 'yml', 'toml', 'txt', 'gitignore', 'env', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])
const BINARY_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg', 'pdf', 'zip', 'tar', 'gz', 'exe', 'dll', 'so', 'dylib', 'wasm', 'mp3', 'mp4', 'wav', 'ogg', 'ttf', 'woff', 'woff2', 'eot'])

interface ContextMenuState { x: number; y: number; path: string; isDir: boolean }

interface FileNodeProps {
  entry: DirEntry
  depth: number
  onFileClick: (path: string) => void
  activeFilePath?: string
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void
  favorites: Set<string>
  onToggleFavorite: (path: string) => void
  expandedDirs: Set<string>
  onToggleDir: (path: string, children: DirEntry[]) => void
  childrenMap: Map<string, DirEntry[]>
  focusedPath: string | null
  hideHidden?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const FileNode = memo(function FileNode({ entry, depth, onFileClick, activeFilePath, onContextMenu, favorites, onToggleFavorite, expandedDirs, onToggleDir, childrenMap, focusedPath, hideHidden }: FileNodeProps) {
  const expanded = expandedDirs.has(entry.path)
  const rawChildren = childrenMap.get(entry.path) ?? []
  const children = hideHidden ? rawChildren.filter(c => !c.name.startsWith('.')) : rawChildren
  const isActive = !entry.isDir && entry.path === activeFilePath
  const isFocused = entry.path === focusedPath

  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  const isViewable = !entry.isDir && VIEWABLE_EXT.has(ext)

  const toggle = async () => {
    if (!entry.isDir) {
      if (isViewable) onFileClick(entry.path)
      return
    }
    let kids = children
    if (!expanded && kids.length === 0) {
      kids = (await window.api.readDir(entry.path)) as DirEntry[]
    }
    onToggleDir(entry.path, kids)
  }

  const icon = entry.isDir ? (expanded ? '▾' : '▸') : '·'
  const isFav = !entry.isDir && favorites.has(entry.path)
  const [hovered, setHovered] = useState(false)
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' })
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [preview, setPreview] = useState<{ visible: boolean; y: number; content: string | null; fileName: string } | null>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hidePreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewCancelledRef = useRef<boolean>(false)

  const isBinary = BINARY_EXT.has(ext)

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      if (hidePreviewTimerRef.current) clearTimeout(hidePreviewTimerRef.current)
      previewCancelledRef.current = true
    }
  }, [])

  const showPreview = async (itemY: number) => {
    if (entry.isDir) return
    previewCancelledRef.current = false
    const info = await window.api.fsStat(entry.path)
    if (previewCancelledRef.current || !info || info.isDirectory) return
    if (info.size > 100 * 1024) {
      setPreview({ visible: true, y: itemY, content: null, fileName: entry.name })
      return
    }
    if (isBinary) {
      setPreview({ visible: true, y: itemY, content: '(binary)', fileName: entry.name })
      return
    }
    try {
      const text = await window.api.readFile(entry.path)
      if (previewCancelledRef.current) return
      const lines = text.split('\n').slice(0, 20)
      setPreview({ visible: true, y: itemY, content: lines.join('\n'), fileName: entry.name })
    } catch {
      if (!previewCancelledRef.current) setPreview({ visible: true, y: itemY, content: null, fileName: entry.name })
    }
  }

  return (
    <div>
      {tooltip.visible && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '3px 8px',
          fontSize: 10,
          color: 'var(--text-muted)',
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {tooltip.text}
        </div>
      )}
      {preview?.visible && (
        <div
          onMouseEnter={() => {
            if (hidePreviewTimerRef.current) clearTimeout(hidePreviewTimerRef.current)
          }}
          onMouseLeave={() => {
            hidePreviewTimerRef.current = setTimeout(() => {
              setPreview(p => p ? { ...p, visible: false } : null)
            }, 200)
          }}
          style={{
            position: 'fixed',
            left: 240,
            top: preview.y,
            width: 400,
            maxHeight: 300,
            overflow: 'hidden',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            zIndex: 100,
          }}
        >
          <div style={{
            padding: '6px 10px',
            borderBottom: '1px solid var(--border)',
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>📄</span>
            <span>{preview.fileName}</span>
          </div>
          <div style={{ padding: '4px 0', overflowX: 'auto' }}>
            {preview.content === null ? (
              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                파일이 너무 큽니다 (&gt;100KB)
              </div>
            ) : preview.content === '(binary)' ? (
              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                바이너리 파일
              </div>
            ) : (
              <div style={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre', color: 'var(--text-primary)' }}>
                {preview.content.split('\n').map((line, i) => (
                  <div key={i} style={{ display: 'flex', lineHeight: '18px' }}>
                    <span style={{
                      width: '3ch',
                      textAlign: 'right',
                      color: 'var(--text-muted)',
                      borderRight: '1px solid var(--border)',
                      paddingRight: 6,
                      marginRight: 8,
                      flexShrink: 0,
                      userSelect: 'none',
                    }}>{i + 1}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div
        role="treeitem"
        aria-expanded={entry.isDir ? expanded : undefined}
        onClick={toggle}
        onContextMenu={(e) => onContextMenu(e, entry.path, entry.isDir)}
        onMouseEnter={async (e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
          setHovered(true)
          if (!entry.isDir) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
            tooltipTimerRef.current = setTimeout(async () => {
              const info = await window.api.fsStat(entry.path)
              if (!info || info.isDirectory) return
              setTooltip({
                visible: true,
                x: rect.right + 8,
                y: rect.top,
                text: `${formatFileSize(info.size)}  •  ${formatDate(info.mtime)}`,
              })
            }, 500)
            if (hidePreviewTimerRef.current) clearTimeout(hidePreviewTimerRef.current)
            if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
            previewCancelledRef.current = true
            previewTimerRef.current = setTimeout(() => {
              showPreview(rect.top)
            }, 600)
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
          setHovered(false)
          if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
          setTooltip(t => ({ ...t, visible: false }))
          if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
          previewCancelledRef.current = true
          hidePreviewTimerRef.current = setTimeout(() => {
            setPreview(p => p ? { ...p, visible: false } : null)
          }, 200)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: `2px 8px 2px ${8 + depth * 12}px`,
          cursor: (entry.isDir || isViewable) ? 'pointer' : 'default',
          color: isActive ? 'var(--accent)' : entry.isDir ? 'var(--text-secondary)' : 'var(--text-primary)',
          background: isActive ? 'var(--bg-hover)' : 'transparent',
          fontSize: 12,
          lineHeight: '20px',
          userSelect: 'none',
          ...(isFocused && !isActive ? { outline: '1px solid var(--accent)', outlineOffset: -1, background: 'var(--bg-hover)' } : {}),
        }}
      >
        <span style={{ fontSize: entry.isDir ? 10 : 14, width: 10, flexShrink: 0, textAlign: 'center', color: entry.isDir ? 'var(--text-muted)' : 'var(--border)' }}>{icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {entry.name}
        </span>
        {!entry.isDir && (isFav || hovered) && (
          <span
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.path) }}
            title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            style={{
              cursor: 'pointer',
              color: isFav ? '#e5a50a' : 'var(--text-muted)',
              fontSize: 11,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {isFav ? '★' : '☆'}
          </span>
        )}
      </div>
      {expanded && children.map((c) => (
        <FileNode key={c.path} entry={c} depth={depth + 1} onFileClick={onFileClick} activeFilePath={activeFilePath} onContextMenu={onContextMenu} favorites={favorites} onToggleFavorite={onToggleFavorite} expandedDirs={expandedDirs} onToggleDir={onToggleDir} childrenMap={childrenMap} focusedPath={focusedPath} hideHidden={hideHidden} />
      ))}
    </div>
  )
}, (prev, next) => {
  return prev.entry.path === next.entry.path &&
    prev.activeFilePath === next.activeFilePath &&
    prev.depth === next.depth &&
    prev.favorites === next.favorites &&
    prev.expandedDirs === next.expandedDirs &&
    prev.childrenMap === next.childrenMap &&
    prev.focusedPath === next.focusedPath &&
    prev.hideHidden === next.hideHidden
})


export function FileTree({ rootPath, onFileClick, activeFilePath, onOpenInSplit }: { rootPath: string; onFileClick: (path: string) => void; activeFilePath?: string; onOpenInSplit?: (path: string) => void }) {
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [showRecent, setShowRecent] = useState(true)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [inlineInput, setInlineInput] = useState<{
    mode: 'createFile' | 'createDir' | 'rename'
    targetPath: string
    isDir: boolean
    defaultName: string
  } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ name: string; path: string; relPath: string }[]>([])
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lifted dir expansion state
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [childrenMap, setChildrenMap] = useState<Map<string, DirEntry[]>>(new Map())

  // Keyboard focus state
  const [focusedPath, setFocusedPath] = useState<string | null>(null)

  const [hideHidden, setHideHidden] = useState(true)

  const refresh = useCallback(() => {
    window.api.readDir(rootPath).then(items => setEntries(items as DirEntry[]))
  }, [rootPath])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  useEffect(() => {
    window.api.watchDir(rootPath)

    const unsubscribe = window.api.onDirChanged((data) => {
      if (data.dirPath === rootPath) {
        setRefreshKey(k => k + 1)
      }
    })

    return () => {
      window.api.unwatchDir(rootPath)
      unsubscribe()
    }
  }, [rootPath])

  useEffect(() => {
    window.api.recentFiles().then(files => setRecentFiles(files))
  }, [])

  useEffect(() => {
    window.api.getFavorites().then(files => setFavorites(new Set(files)))
  }, [])

  const handleToggleFavorite = useCallback(async (path: string) => {
    const { isFavorite } = await window.api.toggleFavorite(path)
    setFavorites(prev => {
      const next = new Set(prev)
      if (isFavorite) next.add(path)
      else next.delete(path)
      return next
    })
  }, [])

  const handleFileClick = useCallback((path: string) => {
    window.api.addRecentFile(path)
    setRecentFiles(prev => [path, ...prev.filter(f => f !== path)].slice(0, 15))
    onFileClick(path)
  }, [onFileClick])

  const handleToggleDir = useCallback((path: string, kids: DirEntry[]) => {
    setChildrenMap(prev => {
      const next = new Map(prev)
      next.set(path, kids)
      return next
    })
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    searchDebounceRef.current = setTimeout(() => {
      window.api.searchFiles(rootPath, searchQuery).then(results => setSearchResults(results))
    }, 200)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery, rootPath])

  const handleContextMenu = (e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, path, isDir })
  }

  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // Build flat ordered list of visible tree items for keyboard nav
  const flatItems = useMemo(() => {
    const items: string[] = []
    const collect = (nodes: DirEntry[]) => {
      for (const node of nodes) {
        if (hideHidden && node.name.startsWith('.')) continue
        items.push(node.path)
        if (node.isDir && expandedDirs.has(node.path)) {
          collect(childrenMap.get(node.path) ?? [])
        }
      }
    }
    collect(entries)
    return items
  }, [entries, expandedDirs, childrenMap, hideHidden])

  // Find a DirEntry by path (search root entries + childrenMap)
  const findEntry = useCallback((path: string): DirEntry | undefined => {
    const search = (nodes: DirEntry[]): DirEntry | undefined => {
      for (const node of nodes) {
        if (node.path === path) return node
        if (node.isDir) {
          const found = search(childrenMap.get(node.path) ?? [])
          if (found) return found
        }
      }
      return undefined
    }
    return search(entries)
  }, [entries, childrenMap])

  const menuItemStyle: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: 12,
    cursor: 'pointer',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  }

  const isSearching = searchQuery.length >= 2

  return (
    <div>
      {/* Header with refresh */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px 2px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {rootPath.split(/[\\/]/).pop()}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span title="파일 변경 자동 감지 중" style={{ fontSize: 9, color: 'var(--success, #22c55e)' }}>●</span>
          <button
            onClick={() => setHideHidden(v => !v)}
            title={hideHidden ? '숨김 파일 표시' : '숨김 파일 숨기기'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '1px 4px', lineHeight: 1,
              color: hideHidden ? 'var(--text-muted)' : 'var(--accent)',
            }}
          >.</button>
          {expandedDirs.size > 0 && (
            <button
              onClick={() => { setExpandedDirs(new Set()); setChildrenMap(new Map()) }}
              title="전체 접기"
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: 11, padding: '1px 4px', lineHeight: 1,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >⊖</button>
          )}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            title="새로고침"
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 12, padding: '1px 4px', lineHeight: 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
          >
            ↺
          </button>
        </div>
      </div>
      {/* Favorites */}
      {favorites.size > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '2px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', userSelect: 'none' }}>
            ★ 즐겨찾기
          </div>
          {[...favorites].map(fp => {
            const name = fp.split(/[/\\]/).pop() ?? fp
            return (
              <div
                key={fp}
                onClick={() => handleFileClick(fp)}
                style={{
                  padding: '2px 8px 2px 16px', fontSize: 11, cursor: 'pointer',
                  color: fp === activeFilePath ? 'var(--accent)' : 'var(--text-secondary)',
                  background: fp === activeFilePath ? 'var(--bg-hover)' : 'transparent',
                  display: 'flex', gap: 6, alignItems: 'center',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (fp !== activeFilePath) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (fp !== activeFilePath) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                title={fp}
              >
                <span style={{ fontSize: 10, color: '#e5a50a' }}>★</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{name}</span>
                <span
                  onClick={e => { e.stopPropagation(); handleToggleFavorite(fp) }}
                  title="즐겨찾기 해제"
                  style={{ cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}
                >
                  ×
                </span>
              </div>
            )
          })}
        </div>
      )}
      {/* Recent files */}
      {showRecent && recentFiles.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '2px 8px',
          }}>
            <span
              onClick={() => setShowRecent(false)}
              style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}
            >
              최근 파일 ▾
            </span>
            <button
              onClick={() => { window.api.clearRecentFiles(); setRecentFiles([]) }}
              title="최근 파일 목록 지우기"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '1px 3px' }}
            >
              ×
            </button>
          </div>
          {recentFiles.slice(0, 8).map(fp => {
            const name = fp.split(/[/\\]/).pop() ?? fp
            return (
              <div
                key={fp}
                onClick={() => handleFileClick(fp)}
                style={{
                  padding: '2px 8px 2px 16px', fontSize: 11, cursor: 'pointer',
                  color: fp === activeFilePath ? 'var(--accent)' : 'var(--text-secondary)',
                  background: fp === activeFilePath ? 'var(--bg-hover)' : 'transparent',
                  display: 'flex', gap: 6, alignItems: 'center',
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}
                onMouseEnter={e => { if (fp !== activeFilePath) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (fp !== activeFilePath) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                title={fp}
              >
                <span style={{ fontSize: 10, color: 'var(--border)' }}>·</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              </div>
            )
          })}
        </div>
      )}
      {!showRecent && recentFiles.length > 0 && (
        <div style={{ padding: '2px 8px', borderBottom: '1px solid var(--border)' }}>
          <span
            onClick={() => setShowRecent(true)}
            style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}
          >
            최근 파일 ▸
          </span>
        </div>
      )}
      {/* Search input */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setSearchQuery('')}
          placeholder="파일 검색..."
          style={{
            width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px',
            fontSize: 11, outline: 'none', boxSizing: 'border-box',
          }}
        />
        {isSearching && (
          <div style={{ fontSize: 9, color: searchResults.length > 0 ? 'var(--accent)' : '#f87171', marginTop: 2, paddingLeft: 2 }}>
            {searchResults.length > 0 ? `${searchResults.length}개 파일` : '파일 없음'}
          </div>
        )}
      </div>
      {inlineInput && (
        <div style={{ padding: '4px 8px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            defaultValue={inlineInput.defaultName}
            placeholder={inlineInput.mode === 'rename' ? '새 이름' : inlineInput.mode === 'createFile' ? '파일명.ts' : '폴더명'}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                const name = (e.target as HTMLInputElement).value.trim()
                if (!name) { setInlineInput(null); return }
                if (inlineInput.mode === 'createFile') {
                  await window.api.createFile(inlineInput.targetPath, name)
                } else if (inlineInput.mode === 'createDir') {
                  await window.api.createDir(inlineInput.targetPath, name)
                } else if (inlineInput.mode === 'rename') {
                  await window.api.renameFile(inlineInput.targetPath, name)
                }
                setInlineInput(null)
                setRefreshKey(k => k + 1)
              }
              if (e.key === 'Escape') setInlineInput(null)
            }}
            onBlur={() => setInlineInput(null)}
            style={{
              width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--accent)', borderRadius: 3, padding: '3px 6px',
              fontSize: 11, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}
      {/* File tree with keyboard navigation */}
      <div
        role="tree"
        aria-label="파일 트리"
        tabIndex={0}
        style={{ paddingTop: 4, outline: 'none' }}
        onKeyDown={async (e) => {
          if (!flatItems.length) return
          const idx = focusedPath ? flatItems.indexOf(focusedPath) : -1

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setFocusedPath(flatItems[Math.min(idx + 1, flatItems.length - 1)])
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setFocusedPath(flatItems[Math.max(idx - 1, 0)])
          } else if (e.key === 'Enter' && focusedPath) {
            e.preventDefault()
            const entry = findEntry(focusedPath)
            if (entry?.isDir) {
              let kids = childrenMap.get(focusedPath) ?? []
              if (!expandedDirs.has(focusedPath) && kids.length === 0) {
                kids = (await window.api.readDir(focusedPath)) as DirEntry[]
              }
              handleToggleDir(focusedPath, kids)
            } else if (entry) {
              handleFileClick(focusedPath)
            }
          } else if (e.key === 'ArrowRight' && focusedPath) {
            e.preventDefault()
            const entry = findEntry(focusedPath)
            if (entry?.isDir && !expandedDirs.has(focusedPath)) {
              let kids = childrenMap.get(focusedPath) ?? []
              if (kids.length === 0) {
                kids = (await window.api.readDir(focusedPath)) as DirEntry[]
              }
              handleToggleDir(focusedPath, kids)
            }
          } else if (e.key === 'ArrowLeft' && focusedPath) {
            e.preventDefault()
            const entry = findEntry(focusedPath)
            if (entry?.isDir && expandedDirs.has(focusedPath)) {
              handleToggleDir(focusedPath, childrenMap.get(focusedPath) ?? [])
            }
          } else if (e.key === 'F2' && focusedPath) {
            e.preventDefault()
            const entry = findEntry(focusedPath)
            if (entry) {
              const currentName = focusedPath.split(/[/\\]/).pop() ?? ''
              setInlineInput({ mode: 'rename', targetPath: focusedPath, isDir: entry.isDir, defaultName: currentName })
            }
          } else if (e.key === 'Escape') {
            setFocusedPath(null)
          }
        }}
      >
        {isSearching ? (
          searchResults.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>결과 없음</div>
          ) : (
            searchResults.map(f => (
              <div
                key={f.path}
                onClick={() => handleFileClick(f.path)}
                style={{
                  display: 'flex', flexDirection: 'column', padding: '3px 12px',
                  cursor: 'pointer', fontSize: 12,
                  background: f.path === activeFilePath ? 'var(--bg-hover)' : 'transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (f.path !== activeFilePath) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.relPath}</span>
              </div>
            ))
          )
        ) : (
          entries.filter(e => !hideHidden || !e.name.startsWith('.')).map((e) => (
            <FileNode key={e.path} entry={e} depth={0} onFileClick={handleFileClick} activeFilePath={activeFilePath} onContextMenu={handleContextMenu} favorites={favorites} onToggleFavorite={handleToggleFavorite} expandedDirs={expandedDirs} onToggleDir={handleToggleDir} childrenMap={childrenMap} focusedPath={focusedPath} hideHidden={hideHidden} />
          ))
        )}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 9999,
            minWidth: 140,
            padding: '4px 0',
          }}
        >
          {!contextMenu.isDir && (
            <div
              style={menuItemStyle}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              onClick={() => {
                handleFileClick(contextMenu.path)
                setContextMenu(null)
              }}
            >
              파일 열기
            </div>
          )}
          {!contextMenu.isDir && (
            <div
              style={menuItemStyle}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              onClick={() => {
                handleToggleFavorite(contextMenu.path)
                setContextMenu(null)
              }}
            >
              {favorites.has(contextMenu.path) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가'}
            </div>
          )}
          {!contextMenu.isDir && onOpenInSplit && (
            <div
              style={menuItemStyle}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              onClick={() => {
                onOpenInSplit(contextMenu.path)
                setContextMenu(null)
              }}
            >
              분할 뷰에서 열기
            </div>
          )}
          <div
            style={menuItemStyle}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.path)
              setContextMenu(null)
            }}
          >
            경로 복사
          </div>
          <div
            style={menuItemStyle}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            onClick={() => {
              window.api.revealInExplorer(contextMenu.path)
              setContextMenu(null)
            }}
          >
            탐색기에서 열기
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {contextMenu.isDir && (
            <>
              <div
                style={menuItemStyle}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                onClick={() => {
                  setInlineInput({ mode: 'createFile', targetPath: contextMenu.path, isDir: false, defaultName: '' })
                  setContextMenu(null)
                }}
              >
                새 파일...
              </div>
              <div
                style={menuItemStyle}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                onClick={() => {
                  setInlineInput({ mode: 'createDir', targetPath: contextMenu.path, isDir: true, defaultName: '' })
                  setContextMenu(null)
                }}
              >
                새 폴더...
              </div>
            </>
          )}
          <div
            style={menuItemStyle}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            onClick={() => {
              const currentName = contextMenu.path.split(/[/\\]/).pop() ?? ''
              setInlineInput({ mode: 'rename', targetPath: contextMenu.path, isDir: contextMenu.isDir, defaultName: currentName })
              setContextMenu(null)
            }}
          >
            이름 바꾸기
          </div>
          <div
            style={{ ...menuItemStyle, color: 'var(--error, #e55)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            onClick={async () => {
              const name = contextMenu.path.split(/[/\\]/).pop()
              if (!window.confirm(`"${name}" 을(를) 삭제하시겠습니까? 복구할 수 없습니다.`)) return
              await window.api.deleteFile(contextMenu.path, contextMenu.isDir)
              setContextMenu(null)
              setRefreshKey(k => k + 1)
            }}
          >
            삭제
          </div>
        </div>
      )}
    </div>
  )
}
