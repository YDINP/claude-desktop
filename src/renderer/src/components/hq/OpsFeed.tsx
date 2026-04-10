import { useRef, useEffect, useState } from 'react'
import type { ToolUseItem } from '../../domains/chat'

interface OpsFeedProps {
  toolUses?: ToolUseItem[]
  isStreaming?: boolean
  onToolClick?: (toolId: string) => void
  sessionId?: string
}

function summarizeToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const inp = input as Record<string, unknown>
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const p = String(inp.file_path ?? inp.path ?? '')
      const filename = p.split(/[/\\]/).pop() ?? ''
      return filename ? ` ${filename}` : ''
    }
    case 'Bash':
      return ` ${String(inp.command ?? '').slice(0, 20)}`
    case 'Glob':
      return ` ${String(inp.pattern ?? '').slice(0, 20)}`
    case 'Grep':
      return ` "${String(inp.pattern ?? '').slice(0, 15)}"`
    case 'WebSearch':
      return ` ${String(inp.query ?? '').slice(0, 20)}`
    case 'WebFetch':
      return ` ${String(inp.url ?? '').replace(/^https?:\/\//, '').slice(0, 20)}`
    default:
      return ''
  }
}

export function OpsFeed({ toolUses = [], isStreaming = false, onToolClick, sessionId }: OpsFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(t)
  }, [sessionId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [toolUses.length])

  if (toolUses.length === 0 && !isStreaming) return null

  const statusIcon = { running: '↻', done: '✓', error: '✗' }
  const statusColor = { running: '#ffa500', done: 'var(--success, #3fb950)', error: 'var(--error, #f85149)' }

  return (
    <div className="hq-ops-feed" style={{
      height: 36,
      background: '#080810',
      borderTop: '1px solid rgba(0,152,255,0.15)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 0,
      overflow: 'hidden',
      flexShrink: 0,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.15s ease',
    }}>
      <span style={{ color: '#0098ff', fontSize: 10, fontFamily: 'var(--font-mono)', marginRight: 10, flexShrink: 0 }}>
        OPS ▶
      </span>
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 0,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          alignItems: 'center',
        }}
      >
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
            [{statusIcon[tool.status]} {tool.name}]{summarizeToolInput(tool.name, tool.input)}
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
