import type { ToolUseItem } from '../../stores/chat-store'

interface ResourceBarProps {
  contextUsage?: number
  sessionTokens?: number
  totalCost?: number
  isStreaming?: boolean
  model?: string
  gitBranch?: string
  gitChanged?: number
  memMB?: number
  hqMode?: boolean
  onToggleHQ?: () => void
  activeAgentCount?: number
}

export function ResourceBar({
  contextUsage = 0,
  sessionTokens = 0,
  totalCost = 0,
  isStreaming = false,
  model = '',
  gitBranch,
  gitChanged,
  memMB,
  hqMode = true,
  onToggleHQ,
  activeAgentCount = 0,
}: ResourceBarProps) {
  const ctxPct = Math.round(contextUsage * 100)
  const ctxColor = ctxPct > 80 ? '#f85149' : ctxPct > 50 ? '#ffa500' : '#0098ff'
  const tokStr = sessionTokens > 1000 ? `${(sessionTokens / 1000).toFixed(1)}k` : `${sessionTokens}`

  return (
    <div style={{
      height: 32,
      background: '#0a0a1a',
      borderBottom: '1px solid rgba(0,152,255,0.2)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 16,
      flexShrink: 0,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    }}>
      {/* HQ toggle */}
      <button
        onClick={onToggleHQ}
        style={{
          background: 'rgba(0,152,255,0.15)',
          border: '1px solid rgba(0,152,255,0.3)',
          borderRadius: 4,
          color: '#0098ff',
          fontSize: 11,
          padding: '1px 8px',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}
      >
        ⬡ HQ
      </button>

      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

      {/* Context gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>CONTEXT</span>
        <div style={{ width: 80, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${ctxPct}%`, height: '100%', background: ctxColor, transition: 'width 0.3s, background 0.3s' }} />
        </div>
        <span style={{ color: ctxColor, fontSize: 10 }}>{ctxPct}%</span>
      </div>

      {/* Tokens */}
      <span style={{ color: 'var(--text-muted)' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginRight: 4 }}>TOKENS</span>
        {tokStr}
      </span>

      {/* Cost */}
      {totalCost > 0 && (
        <span style={{ color: 'var(--text-muted)' }}>
          ${totalCost.toFixed(4)}
        </span>
      )}

      {/* Active agents */}
      {(isStreaming || activeAgentCount > 0) && (
        <span style={{ color: '#00d4ff', fontSize: 10 }}>
          ● {activeAgentCount || 1} active
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Git */}
      {gitBranch && (
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          ⎇ {gitBranch}{gitChanged ? ` +${gitChanged}` : ''}
        </span>
      )}

      {/* Memory */}
      {memMB && (
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{memMB}MB</span>
      )}

      {/* Model */}
      {model && (
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
          {model.replace('claude-', '').replace('-4-', ' 4.')}
        </span>
      )}
    </div>
  )
}
