import { useEffect, useState, useCallback } from 'react'

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

      {/* Server list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {servers.length === 0 && !loading && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            MCP 서버가 설정되지 않았습니다
          </div>
        )}

        {servers.map((server, index) => (
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
            <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 10, marginBottom: 2 }}>
              {server.command}
              {server.args.length > 0 && (
                <span style={{ opacity: 0.7 }}> {truncateArgs(server.args)}</span>
              )}
            </div>

            {/* Status */}
            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              상태: {statusLabel(server)}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {configFile && (
        <div style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: 10,
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          설정 파일: {configFile}
        </div>
      )}
    </div>
  )
}
