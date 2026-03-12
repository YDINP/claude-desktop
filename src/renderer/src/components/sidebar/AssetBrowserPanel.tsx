import { useState, useEffect, useCallback } from 'react'

interface AssetItem {
  path: string
  name: string
  type: string
  children?: AssetItem[]
}

interface AssetBrowserPanelProps {
  connected: boolean
  port: number
}

// File type → emoji icon
const ASSET_ICONS: Record<string, string> = {
  folder: '📁',
  script: '📝',
  prefab: '🧩',
  texture: '🖼',
  scene: '🎬',
  audio: '🔊',
  atlas: '🗂',
  font: '🔤',
  json: '{ }',
  text: '📃',
  animation: '🎞',
  material: '🎨',
  file: '📄',
}

export function AssetBrowserPanel({ connected, port }: AssetBrowserPanelProps) {
  const [tree, setTree] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    setError(null)
    try {
      const result = await (window.api as any).ccGetAssets?.(port)
      if (result?.error) setError(result.error)
      else setTree(result?.tree ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [connected, port])

  useEffect(() => {
    if (connected) refresh()
    else { setTree([]); setError(null) }
  }, [connected, refresh])

  const toggleFolder = (path: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(`db://assets/${path}`).catch(() => {})
    setCopied(path)
    setTimeout(() => setCopied(null), 1500)
  }

  // Flatten tree for search
  const flattenTree = (items: AssetItem[], depth = 0): Array<{ item: AssetItem; depth: number }> => {
    const result: Array<{ item: AssetItem; depth: number }> = []
    for (const item of items) {
      result.push({ item, depth })
      if (item.type === 'folder' && item.children && (openFolders.has(item.path) || search)) {
        result.push(...flattenTree(item.children, depth + 1))
      }
    }
    return result
  }

  const filtered = search.trim()
    ? flattenTree(tree).filter(({ item }) =>
        item.name.toLowerCase().includes(search.toLowerCase()) && item.type !== 'folder'
      )
    : flattenTree(tree)

  if (!connected) {
    return (
      <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
        CC 연결 후 에셋을 확인할 수 있습니다
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>에셋</span>
        <button
          onClick={refresh}
          disabled={loading}
          title="새로고침"
          style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '0 2px' }}
        >
          {loading ? '⟳' : '↺'}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="에셋 검색..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg-input, var(--bg-secondary))',
            border: '1px solid var(--border)',
            borderRadius: 3, color: 'var(--text-primary)',
            fontSize: 10, padding: '2px 6px', outline: 'none',
          }}
        />
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', fontSize: 11 }}>
        {error && (
          <div style={{ padding: '8px 6px', color: '#f87171', fontSize: 10 }}>{error}</div>
        )}
        {!loading && !error && tree.length === 0 && (
          <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 10, textAlign: 'center' }}>
            에셋 없음
          </div>
        )}
        {filtered.map(({ item, depth }) => (
          <div
            key={item.path}
            onClick={() => item.type === 'folder' ? toggleFolder(item.path) : copyPath(item.path)}
            title={item.type !== 'folder' ? `클릭하여 경로 복사\ndb://assets/${item.path}` : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              paddingLeft: 6 + depth * 12,
              paddingRight: 6,
              paddingTop: 2, paddingBottom: 2,
              cursor: 'pointer',
              borderRadius: 2,
              background: copied === item.path ? 'rgba(99,179,237,0.15)' : 'transparent',
              color: item.type === 'folder' ? 'var(--text-primary)' : 'var(--text-secondary, var(--text-muted))',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, var(--bg-secondary))' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = copied === item.path ? 'rgba(99,179,237,0.15)' : 'transparent' }}
          >
            <span style={{ fontSize: 10, flexShrink: 0 }}>
              {item.type === 'folder'
                ? (openFolders.has(item.path) ? '▾' : '▸')
                : ASSET_ICONS[item.type] ?? '📄'}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: 11 }}>
              {item.name}
            </span>
            {copied === item.path && (
              <span style={{ fontSize: 9, color: '#60a5fa', flexShrink: 0 }}>복사됨!</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
