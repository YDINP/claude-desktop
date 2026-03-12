import { useState, useEffect } from 'react'
import type { ToolUseItem } from '../../stores/chat-store'

interface SessionMeta {
  id: string
  title?: string
  model?: string
  updatedAt: number
  inputTokens?: number
  outputTokens?: number
}

interface AgentBayProps {
  sessions?: SessionMeta[]
  activeSessionId: string | null
  isStreaming?: boolean
  toolUses?: ToolUseItem[]
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onToggleHQ?: () => void
}

function AgentCard({ session, isActive, isStreaming, onClick }: {
  session: SessionMeta
  isActive: boolean
  isStreaming: boolean
  onClick: () => void
}) {
  const title = session.title || `AGENT-${session.id.slice(-3).toUpperCase()}`
  const tokens = (session.inputTokens ?? 0) + (session.outputTokens ?? 0)
  const tokStr = tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`

  const state = isStreaming && isActive ? 'active' : isActive ? 'selected' : 'idle'

  const borderColor = {
    active: 'rgba(0,152,255,0.6)',
    selected: 'rgba(0,152,255,0.4)',
    idle: 'rgba(255,255,255,0.08)',
  }[state]

  const glow = {
    active: '0 0 20px rgba(0,152,255,0.25)',
    selected: '0 0 10px rgba(0,152,255,0.15)',
    idle: 'none',
  }[state]

  const eyeColor = state === 'active' ? '#00d4ff' : '#888'

  const timeAgo = () => {
    const d = Date.now() - session.updatedAt
    if (d < 60000) return 'just now'
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
    return `${Math.floor(d / 3600000)}h ago`
  }

  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        boxShadow: glow,
        transition: 'all 0.2s ease',
        background: isActive ? 'rgba(0,152,255,0.05)' : 'rgba(255,255,255,0.02)',
      }}
    >
      {/* 로봇 눈 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <svg width="16" height="12" viewBox="0 0 16 12">
          <ellipse cx="4" cy="6" rx="4" ry="6" fill={eyeColor}
            style={{ animation: state === 'active' ? 'hq-blink 0.5s ease infinite' : 'hq-blink 2s ease infinite' }} />
          <ellipse cx="12" cy="6" rx="4" ry="6" fill={eyeColor}
            style={{ animation: state === 'active' ? 'hq-blink 0.5s ease infinite 0.1s' : 'hq-blink 2s ease infinite 0.3s' }} />
        </svg>
        <div style={{
          flex: 1, height: 2, alignSelf: 'center',
          background: state === 'active' ? '#00d4ff' : '#444',
          borderRadius: 1,
        }} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>

      {/* 토큰 게이지 */}
      {tokens > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{
            height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, tokens / 1000)}%`,
              background: tokens > 100000 ? '#f85149' : tokens > 50000 ? '#ffa500' : '#0098ff',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{tokStr} tok</div>
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo()}</div>
    </div>
  )
}

export function AgentBay({ sessions = [], activeSessionId, isStreaming = false, onSelectSession, onNewSession, onToggleHQ }: AgentBayProps) {
  const [localSessions, setLocalSessions] = useState<SessionMeta[]>(sessions)

  useEffect(() => {
    if (sessions.length === 0) {
      window.api.sessionList?.().then((list: SessionMeta[]) => setLocalSessions(list ?? [])).catch(() => {})
    } else {
      setLocalSessions(sessions)
    }
  }, [sessions])

  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRight: '1px solid var(--border)',
      background: 'radial-gradient(rgba(100,100,160,0.15) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundColor: 'var(--bg-primary)',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
          AGENT BAY
        </span>
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 8,
          background: 'rgba(0,152,255,0.15)', color: '#0098ff',
        }}>
          ● {localSessions.length}
        </span>
        <button
          onClick={onToggleHQ}
          title="기본 모드로 전환"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
        >
          ✕
        </button>
      </div>

      {/* 카드 리스트 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
        {localSessions.map(s => (
          <AgentCard
            key={s.id}
            session={s}
            isActive={s.id === activeSessionId}
            isStreaming={!!(isStreaming && s.id === activeSessionId)}
            onClick={() => onSelectSession(s.id)}
          />
        ))}
      </div>

      {/* SPAWN AGENT 버튼 */}
      <button
        onClick={onNewSession}
        style={{
          margin: '8px 10px',
          padding: '8px',
          border: '1px dashed rgba(0,152,255,0.4)',
          borderRadius: 6,
          background: 'transparent',
          color: '#0098ff',
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.5px',
          flexShrink: 0,
        }}
      >
        + SPAWN AGENT
      </button>
    </div>
  )
}
