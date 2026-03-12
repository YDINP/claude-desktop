import type { ToolUseItem } from '../../stores/chat-store'

interface OpsFeedProps {
  toolUses?: ToolUseItem[]
  isStreaming?: boolean
  onToolClick?: (toolId: string) => void
}

export function OpsFeed({ toolUses = [], isStreaming = false, onToolClick }: OpsFeedProps) {
  if (toolUses.length === 0 && !isStreaming) return null

  const statusIcon = { running: '↻', done: '✓', error: '✗' }
  const statusColor = { running: '#ffa500', done: 'var(--success, #3fb950)', error: 'var(--error, #f85149)' }

  return (
    <div style={{
      height: 36,
      background: '#080810',
      borderTop: '1px solid rgba(0,152,255,0.15)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 0,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <span style={{ color: '#0098ff', fontSize: 10, fontFamily: 'var(--font-mono)', marginRight: 10, flexShrink: 0 }}>
        OPS ▶
      </span>
      <div style={{ display: 'flex', gap: 0, overflow: 'hidden', alignItems: 'center' }}>
        {toolUses.slice(-8).map((tool, i) => (
          <span
            key={tool.id}
            onClick={() => onToolClick?.(tool.id)}
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: statusColor[tool.status],
              padding: '2px 8px',
              borderRadius: 3,
              background: `${statusColor[tool.status]}15`,
              marginRight: 6,
              whiteSpace: 'nowrap',
              animation: i === toolUses.length - 1 ? 'hq-slide-in 0.2s ease' : undefined,
              flexShrink: 0,
              cursor: onToolClick ? 'pointer' : undefined,
            }}
          >
            [{statusIcon[tool.status]} {tool.name}]
          </span>
        ))}
        {isStreaming && toolUses.length === 0 && (
          <span style={{ fontSize: 10, color: '#0098ff', fontFamily: 'var(--font-mono)' }}>
            ···
          </span>
        )}
      </div>
    </div>
  )
}
