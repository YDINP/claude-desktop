import { useState, useEffect } from 'react'
import { t } from '../../utils/i18n'

interface ThinkingPanelProps {
  text: string
  isStreaming?: boolean
}

export function ThinkingPanel({ text, isStreaming = false }: ThinkingPanelProps) {
  const [collapsed, setCollapsed] = useState(!isStreaming)

  useEffect(() => {
    if (isStreaming) setCollapsed(false)
  }, [isStreaming])

  if (!text) return null

  return (
    <div style={{
      margin: '6px 0',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 'var(--radius-sm)',
      background: 'rgba(82,139,255,0.04)',
      fontSize: 11,
    }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', cursor: 'pointer', userSelect: 'none',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: 13 }}>🧠</span>
        <span style={{ fontSize: 10, fontWeight: 500 }}>
          {isStreaming ? t('thinking.streaming', '생각 중...') : `Thinking (${Math.ceil(text.length / 4)}tok)`}
        </span>
        {isStreaming && (
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)', marginLeft: 2,
            animation: 'blink 1s ease infinite',
          }} />
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <div style={{
          padding: '0 10px 8px',
          color: 'var(--text-muted)',
          fontSize: 11,
          lineHeight: 1.6,
          fontStyle: 'italic',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 300,
          overflow: 'auto',
        }}>
          {text}
        </div>
      )}
    </div>
  )
}
