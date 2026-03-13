import { useState, useEffect, memo } from 'react'
import type { ToolUseItem } from '../../stores/chat-store'

function formatToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return String(input ?? '')
  const inp = input as Record<string, unknown>
  switch (name) {
    case 'Read':
      return String(inp.file_path ?? inp.path ?? '').split('/').pop() ?? JSON.stringify(input)
    case 'Write':
    case 'Edit':
      return String(inp.file_path ?? inp.path ?? '').split('/').pop() ?? JSON.stringify(input)
    case 'Bash':
      return String(inp.command ?? '').slice(0, 80)
    case 'Glob':
      return String(inp.pattern ?? '')
    case 'Grep':
      return `"${String(inp.pattern ?? '')}"` + (inp.path ? ` in ${String(inp.path).split('/').pop()}` : '')
    case 'WebSearch':
      return String(inp.query ?? '')
    case 'WebFetch':
      return String(inp.url ?? '').replace(/^https?:\/\//, '').slice(0, 60)
    case 'Agent':
      return String(inp.description ?? inp.prompt ?? '').slice(0, 60)
    default:
      return JSON.stringify(input, null, 2)
  }
}

function InlineDiff({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const oldLines = oldStr.split('\n')
  const newLines = newStr.split('\n')
  const maxLines = 30
  const rows: { type: 'del' | 'add' | 'ctx'; text: string }[] = []

  oldLines.slice(0, maxLines).forEach(l => rows.push({ type: 'del', text: l }))
  newLines.slice(0, maxLines).forEach(l => rows.push({ type: 'add', text: l }))

  const truncated = oldLines.length > maxLines || newLines.length > maxLines

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      lineHeight: 1.5,
      background: 'var(--bg-tertiary)',
      borderRadius: 3,
      padding: '4px 0',
      overflow: 'auto',
      maxHeight: 180,
      marginTop: 6,
    }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          padding: '0 8px',
          background: r.type === 'del' ? 'rgba(255,80,80,0.12)' : 'rgba(80,220,80,0.12)',
          color: r.type === 'del' ? '#ff8a8a' : '#7ddb7d',
          whiteSpace: 'pre',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {r.type === 'del' ? '- ' : '+ '}{r.text}
        </div>
      ))}
      {truncated && (
        <div style={{ padding: '2px 8px', color: 'var(--text-muted)', fontSize: 10 }}>
          … (truncated)
        </div>
      )}
    </div>
  )
}

export const ToolUseIndicator = memo(function ToolUseIndicator({ tool }: { tool: ToolUseItem }) {
  const [collapsed, setCollapsed] = useState(tool.status === 'done')

  useEffect(() => {
    if (tool.status === 'running') {
      setCollapsed(false)
    }
  }, [tool.status])

  const statusColor = {
    running: 'var(--warning)',
    done: 'var(--success)',
    error: 'var(--error)',
  }[tool.status]

  const statusIcon = { running: '\u27F3', done: '\u2713', error: '\u2717' }[tool.status]

  const inp = tool.input as Record<string, unknown> | null
  const showDiff = !collapsed && tool.status === 'done' &&
    tool.name === 'Edit' && inp &&
    typeof inp.old_string === 'string' && typeof inp.new_string === 'string'

  return (
    <div style={{
      background: 'var(--tool-bg)',
      border: '1px solid var(--tool-border)',
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: 'var(--radius-sm)',
      padding: '6px 10px',
      marginTop: 6,
      fontSize: 12,
    }}>
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: statusColor, fontSize: 11 }}>{statusIcon}</span>
        <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{tool.name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {tool.status === 'running' ? 'running...' : tool.status}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto' }}>
          {collapsed ? '\u25B8' : '\u25BE'}
        </span>
      </div>
      {tool.status === 'running' && (
        <div className="tool-progress-bar" />
      )}
      {!collapsed && !!tool.input && (() => {
        const summary = formatToolInput(tool.name, tool.input)
        const isJson = tool.name !== 'Read' && tool.name !== 'Write' && tool.name !== 'Edit' &&
                       tool.name !== 'Bash' && tool.name !== 'Glob' && tool.name !== 'Grep' &&
                       tool.name !== 'WebSearch' && tool.name !== 'WebFetch' && tool.name !== 'Agent'
        return isJson ? (
          <pre style={{
            color: 'var(--text-secondary)',
            fontSize: 11,
            marginTop: 6,
            overflow: 'auto',
            maxHeight: 120,
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-tertiary)',
            padding: '4px 6px',
            borderRadius: 3,
          }}>
            {summary}
          </pre>
        ) : (
          <div style={{
            color: 'var(--text-secondary)',
            fontSize: 11,
            marginTop: 4,
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {summary}
          </div>
        )
      })()}
      {showDiff && (
        <InlineDiff
          oldStr={String(inp!.old_string)}
          newStr={String(inp!.new_string)}
        />
      )}
      {!collapsed && !showDiff && tool.output && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Output</div>
          <pre style={{
            color: tool.status === 'error' ? 'var(--error)' : 'var(--text-secondary)',
            fontSize: 11,
            overflow: 'auto',
            maxHeight: 160,
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-tertiary)',
            padding: '4px 6px',
            borderRadius: 3,
          }}>
            {tool.output.length > 2000 ? tool.output.slice(0, 2000) + '\n… (truncated)' : tool.output}
          </pre>
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  return prev.tool.id === next.tool.id && prev.tool.status === next.tool.status && prev.tool.output === next.tool.output
})
