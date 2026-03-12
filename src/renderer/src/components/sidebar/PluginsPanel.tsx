import { useEffect, useState, useMemo } from 'react'

interface PluginMeta {
  filename: string
  name: string
  description: string
  version: string
  author: string
  path: string
}

export function PluginsPanel() {
  const [plugins, setPlugins] = useState<PluginMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [enabledSet, setEnabledSet] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('enabled-plugins')
      return new Set(stored ? JSON.parse(stored) : [])
    } catch {
      return new Set()
    }
  })
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [codeContent, setCodeContent] = useState<Record<string, string>>({})
  const [sortMode, setSortMode] = useState<'default' | 'name' | 'enabled'>('default')
  const [pluginSearch, setPluginSearch] = useState('')

  const sortedPlugins = useMemo(() => {
    const q = pluginSearch.trim().toLowerCase()
    let list = q
      ? plugins.filter(p =>
          (p.name || p.filename).toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.author?.toLowerCase().includes(q)
        )
      : [...plugins]
    if (sortMode === 'name') list.sort((a, b) => (a.name || a.filename).localeCompare(b.name || b.filename))
    else if (sortMode === 'enabled') list.sort((a, b) => (enabledSet.has(b.filename) ? 1 : 0) - (enabledSet.has(a.filename) ? 1 : 0))
    return list
  }, [plugins, sortMode, enabledSet, pluginSearch])

  const load = async () => {
    setLoading(true)
    const result = await window.api.pluginsList()
    setPlugins(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const saveEnabled = (next: Set<string>) => {
    setEnabledSet(next)
    localStorage.setItem('enabled-plugins', JSON.stringify([...next]))
  }

  const toggleEnabled = (filename: string) => {
    const next = new Set(enabledSet)
    if (next.has(filename)) next.delete(filename)
    else next.add(filename)
    saveEnabled(next)
  }

  const toggleCode = async (plugin: PluginMeta) => {
    if (expandedCode === plugin.filename) {
      setExpandedCode(null)
      return
    }
    if (!codeContent[plugin.filename]) {
      const content = await window.api.pluginsReadFile(plugin.path)
      setCodeContent(prev => ({ ...prev, [plugin.filename]: content }))
    }
    setExpandedCode(plugin.filename)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>플러그인</span>
          {plugins.length > 0 && (
            <span style={{
              fontSize: 10, color: 'var(--text-muted)',
              background: 'var(--bg-hover)', borderRadius: 8, padding: '1px 6px',
            }}>
              {plugins.filter(p => enabledSet.has(p.filename)).length}/{plugins.length} 활성
            </span>
          )}
        </div>
        {plugins.length > 1 && (
          <button
            onClick={() => setSortMode(m => m === 'default' ? 'name' : m === 'name' ? 'enabled' : 'default')}
            title={`정렬: ${sortMode === 'default' ? '기본' : sortMode === 'name' ? '이름순' : '활성 먼저'}`}
            style={{ background: sortMode !== 'default' ? 'var(--accent-dim)' : 'var(--bg-hover)', color: sortMode !== 'default' ? 'var(--accent)' : 'var(--text-muted)', border: `1px solid ${sortMode !== 'default' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}
          >{sortMode === 'default' ? '↕' : sortMode === 'name' ? 'A↓' : '●↑'}</button>
        )}
        <button
          onClick={() => window.api.pluginsOpenFolder()}
          style={{
            background: 'var(--bg-hover)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 4,
            padding: '3px 8px', fontSize: 11, cursor: 'pointer',
          }}
        >
          📂 폴더 열기
        </button>
      </div>

      {/* Info banner */}
      <div style={{
        padding: '6px 10px', background: 'rgba(99,102,241,0.08)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
        color: 'var(--text-muted)', fontSize: 11,
      }}>
        ℹ 플러그인 폴더에 .js 파일을 추가하세요
      </div>

      {/* Search */}
      {plugins.length > 2 && (
        <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            value={pluginSearch}
            onChange={e => setPluginSearch(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setPluginSearch('')}
            placeholder="플러그인 검색..."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '3px 6px',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 3, color: 'var(--text-primary)', fontSize: 11, outline: 'none',
            }}
          />
        </div>
      )}

      {/* Plugin list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 16, color: 'var(--text-muted)' }}>로딩 중...</div>
        ) : plugins.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🧩</div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>플러그인 없음</div>
            <div style={{ fontSize: 11, lineHeight: 1.6 }}>
              &quot;📂 폴더 열기&quot;를 클릭해 플러그인 폴더를 열고<br />
              .js 파일을 추가한 후 새로고침하세요.
            </div>
          </div>
        ) : (
          sortedPlugins.map(plugin => {
            const enabled = enabledSet.has(plugin.filename)
            const codeOpen = expandedCode === plugin.filename
            return (
              <div key={plugin.filename} style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: enabled ? '#4caf50' : '#666',
                        display: 'inline-block',
                      }} />
                      <span style={{
                        fontWeight: 500, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {plugin.name || plugin.filename}
                        {plugin.version && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
                            v{plugin.version}
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => toggleEnabled(plugin.filename)}
                        style={{
                          padding: '2px 7px', fontSize: 10, cursor: 'pointer', borderRadius: 3,
                          background: enabled ? 'rgba(76,175,80,0.15)' : 'var(--bg-hover)',
                          color: enabled ? '#4caf50' : 'var(--text-muted)',
                          border: `1px solid ${enabled ? '#4caf50' : 'var(--border)'}`,
                        }}
                      >
                        {enabled ? '비활성화' : '활성화'}
                      </button>
                      <button
                        onClick={() => toggleCode(plugin)}
                        style={{
                          padding: '2px 7px', fontSize: 10, cursor: 'pointer', borderRadius: 3,
                          background: codeOpen ? 'var(--accent)' : 'var(--bg-hover)',
                          color: codeOpen ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${codeOpen ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                      >
                        코드 보기
                      </button>
                    </div>
                  </div>
                  {(plugin.description || plugin.author) && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3, paddingLeft: 14 }}>
                      {plugin.description}
                      {plugin.description && plugin.author ? ' — ' : ''}
                      {plugin.author && `by ${plugin.author}`}
                    </div>
                  )}
                </div>
                {codeOpen && (
                  <div style={{
                    margin: '0 10px 8px', borderRadius: 4,
                    border: '1px solid var(--border)', overflow: 'auto',
                    maxHeight: 240, background: 'var(--bg-secondary)',
                  }}>
                    <pre style={{
                      margin: 0, padding: '8px 10px', fontSize: 10,
                      color: 'var(--text-primary)', fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                      {codeContent[plugin.filename] ?? '로딩 중...'}
                    </pre>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Refresh button */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={load}
          style={{
            width: '100%', padding: '5px 0', background: 'var(--bg-hover)',
            color: 'var(--text-primary)', border: '1px solid var(--border)',
            borderRadius: 4, fontSize: 11, cursor: 'pointer',
          }}
        >
          새로고침
        </button>
      </div>
    </div>
  )
}
