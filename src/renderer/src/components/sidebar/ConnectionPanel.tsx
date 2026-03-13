import { useEffect, useState, useCallback, useRef } from 'react'

interface McpServer {
  name: string
  command: string
  args: string[]
  status: 'unknown' | 'alive' | 'dead' | 'checking'
  configFile: string
  latency?: number
}

const DOT_STYLE: React.CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  marginRight: 6,
  flexShrink: 0,
}

function StatusDot({ status }: { status: McpServer['status'] }) {
  const color =
    status === 'alive' ? '#4ade80' :
    status === 'dead' ? '#f87171' :
    status === 'checking' ? '#facc15' :
    '#6b7280'
  return <span style={{ ...DOT_STYLE, background: color }} />
}

function statusLabel(server: McpServer): string {
  if (server.status === 'checking') return '확인 중...'
  if (server.status === 'alive') return `활성 (${server.latency}ms)`
  if (server.status === 'dead') return '응답 없음'
  return '알 수 없음'
}

export function ConnectionPanel() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [configFile, setConfigFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoPing, setAutoPing] = useState(false)
  const [autoReconnect, setAutoReconnect] = useState(false)
  const [cfgCopied, setCfgCopied] = useState(false)
  const [copiedServerIdx, setCopiedServerIdx] = useState<number | null>(null)
  const autoPingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoReconnectRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pingAllRef = useRef<() => void>(() => {})
  const pingServerRef = useRef<(index: number) => void>(() => {})
  const [serverSearch, setServerSearch] = useState('')

  const loadServers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.getMcpServers()
      setConfigFile(result.configFile)
      setServers(
        result.servers.map((s) => ({ ...s, status: 'unknown' as const }))
      )
    } catch {
      setServers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  const pingAll = useCallback(async () => {
    setServers(prev => prev.map(s => ({ ...s, status: 'checking' as const })))
    await Promise.all(servers.map(async (server, index) => {
      try {
        const result = await window.api.pingMcpServer({ name: server.name, command: server.command, args: server.args })
        setServers(prev => prev.map((s, i) => i === index ? { ...s, status: result.alive ? 'alive' : 'dead', latency: result.latency } : s))
      } catch {
        setServers(prev => prev.map((s, i) => i === index ? { ...s, status: 'dead' } : s))
      }
    }))
  }, [servers])

  // Keep pingAllRef updated
  useEffect(() => { pingAllRef.current = pingAll }, [pingAll])

  // Auto-ping interval
  useEffect(() => {
    if (autoPingRef.current) { clearInterval(autoPingRef.current); autoPingRef.current = null }
    if (autoPing && servers.length > 0) {
      autoPingRef.current = setInterval(() => pingAllRef.current(), 30000)
    }
    return () => { if (autoPingRef.current) { clearInterval(autoPingRef.current); autoPingRef.current = null } }
  }, [autoPing, servers.length])

  const serversRef = useRef(servers)
  useEffect(() => { serversRef.current = servers }, [servers])

  // Auto-reconnect interval
  useEffect(() => {
    if (autoReconnectRef.current) { clearInterval(autoReconnectRef.current); autoReconnectRef.current = null }
    if (autoReconnect && servers.length > 0) {
      autoReconnectRef.current = setInterval(() => {
        serversRef.current.forEach((s, i) => {
          if (s.status !== 'alive') pingServerRef.current(i)
        })
      }, 10000)
    }
    return () => { if (autoReconnectRef.current) { clearInterval(autoReconnectRef.current); autoReconnectRef.current = null } }
  }, [autoReconnect, servers.length])

  const pingServer = useCallback(async (index: number) => {
    const server = servers[index]
    if (!server) return
    setServers((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'checking' } : s))
    )
    try {
      const result = await window.api.pingMcpServer({
        name: server.name,
        command: server.command,
        args: server.args,
      })
      setServers((prev) =>
        prev.map((s, i) =>
          i === index
            ? { ...s, status: result.alive ? 'alive' : 'dead', latency: result.latency }
            : s
        )
      )
    } catch {
      setServers((prev) =>
        prev.map((s, i) => (i === index ? { ...s, status: 'dead' } : s))
      )
    }
  }, [servers])

  // Keep pingServerRef updated
  useEffect(() => { pingServerRef.current = pingServer }, [pingServer])

  const truncateArgs = (args: string[]) => {
    const joined = args.join(' ')
    return joined.length > 40 ? joined.slice(0, 37) + '...' : joined
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>MCP 서버</span>
          {servers.length > 0 && servers.some(s => s.status !== 'unknown') && (() => {
            const pinged = servers.filter(s => s.status !== 'unknown' && s.status !== 'checking').length
            const alive = servers.filter(s => s.status === 'alive').length
            if (pinged === 0) return null
            const bg = alive === pinged ? '#16a34a' : alive === 0 ? '#dc2626' : '#ca8a04'
            return (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: bg, color: '#fff', fontWeight: 600 }}>
                {alive}/{pinged}
              </span>
            )
          })()}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {servers.length > 0 && (
            <button
              onClick={() => setAutoPing(v => !v)}
              title={autoPing ? '자동 핑 끄기 (30초 간격)' : '자동 핑 켜기 (30초 간격)'}
              style={{
                fontSize: 11, padding: '2px 6px',
                background: autoPing ? 'var(--accent)' : 'var(--bg-input)',
                color: autoPing ? '#fff' : 'var(--text-muted)',
                border: `1px solid ${autoPing ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              {autoPing ? '⟳ ON' : '⟳'}
            </button>
          )}
          {servers.length > 0 && (
            <button
              onClick={() => setAutoReconnect(v => !v)}
              title={autoReconnect ? '자동 재연결 끄기 (10초 간격)' : '자동 재연결 켜기 (10초 간격)'}
              style={{
                fontSize: 11, padding: '2px 6px',
                background: autoReconnect ? '#16a34a' : 'var(--bg-input)',
                color: autoReconnect ? '#fff' : 'var(--text-muted)',
                border: `1px solid ${autoReconnect ? '#16a34a' : 'var(--border)'}`,
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              {autoReconnect ? '⚡ ON' : '⚡'}
            </button>
          )}
          {servers.length > 0 && (
            <button
              onClick={pingAll}
              disabled={servers.some(s => s.status === 'checking')}
              title="모든 서버 핑"
              style={{
                fontSize: 11, padding: '2px 8px',
                background: 'var(--bg-input)', color: 'var(--accent)',
                border: '1px solid var(--accent)', borderRadius: 4,
                cursor: servers.some(s => s.status === 'checking') ? 'wait' : 'pointer',
              }}
            >
              모두 핑
            </button>
          )}
          <button
            onClick={loadServers}
            disabled={loading}
            style={{
              fontSize: 11, padding: '2px 8px',
              background: 'var(--bg-input)', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 4,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '로딩...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* Server search */}
      {servers.length > 3 && (
        <div style={{ padding: '4px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            value={serverSearch}
            onChange={e => setServerSearch(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setServerSearch('')}
            placeholder="서버 검색..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
          />
        </div>
      )}

      {/* Server list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {servers.length === 0 && !loading && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            MCP 서버가 설정되지 않았습니다
          </div>
        )}

        {servers.filter(s => !serverSearch.trim() || s.name.toLowerCase().includes(serverSearch.toLowerCase())).map((server) => {
          const index = servers.indexOf(server)
          return (
          <div
            key={server.name}
            style={{
              borderBottom: '1px solid var(--border)',
              padding: '8px 10px',
            }}
          >
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <StatusDot status={server.status} />
                <span
                  style={{
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {server.name}
                </span>
              </div>
              <button
                onClick={() => pingServer(index)}
                disabled={server.status === 'checking'}
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  background: 'transparent',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  borderRadius: 3,
                  cursor: server.status === 'checking' ? 'wait' : 'pointer',
                  flexShrink: 0,
                  marginLeft: 6,
                }}
              >
                ping
              </button>
            </div>

            {/* Command */}
            <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 10, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {server.command}
                {server.args.length > 0 && (
                  <span style={{ opacity: 0.7 }}> {truncateArgs(server.args)}</span>
                )}
              </span>
              <button
                onClick={() => {
                  const cmd = [server.command, ...server.args].join(' ')
                  navigator.clipboard.writeText(cmd).then(() => {
                    setCopiedServerIdx(index)
                    setTimeout(() => setCopiedServerIdx(i => i === index ? null : i), 1500)
                  })
                }}
                title="명령어 복사"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '0 2px', color: copiedServerIdx === index ? '#4caf50' : 'var(--border)', flexShrink: 0 }}
              >
                {copiedServerIdx === index ? '✓' : '📋'}
              </button>
            </div>

            {/* Status */}
            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              상태: {statusLabel(server)}
            </div>
          </div>
        )})}
      </div>

      {/* Footer */}
      {configFile && (
        <div style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: 10,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            설정 파일: {configFile}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(configFile).then(() => { setCfgCopied(true); setTimeout(() => setCfgCopied(false), 1500) })}
            title="경로 복사"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: cfgCopied ? '#4caf50' : 'var(--text-muted)', flexShrink: 0, padding: '0 2px' }}
          >
            {cfgCopied ? '✓' : '📋'}
          </button>
        </div>
      )}
    </div>
  )
}
