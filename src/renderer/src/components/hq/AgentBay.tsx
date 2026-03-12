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

type AgentState = 'idle' | 'active' | 'tool_running' | 'error' | 'selected'

function AgentCard({ session, isActive, isStreaming, lastToolName, hasError, onClick }: {
  session: SessionMeta
  isActive: boolean
  isStreaming: boolean
  lastToolName?: string
  hasError?: boolean
  onClick: () => void
}) {
  const title = session.title || `AGENT-${session.id.slice(-3).toUpperCase()}`
  const tokens = (session.inputTokens ?? 0) + (session.outputTokens ?? 0)
  const tokStr = tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`

  const state: AgentState = hasError && isActive ? 'error'
    : isStreaming && isActive && lastToolName ? 'tool_running'
    : isStreaming && isActive ? 'active'
    : isActive ? 'selected'
    : 'idle'

  const borderColor: Record<AgentState, string> = {
    active: 'rgba(0,152,255,0.4)',
    tool_running: 'rgba(220,220,170,0.4)',
    error: 'rgba(244,71,71,0.4)',
    selected: 'rgba(0,152,255,0.6)',
    idle: 'rgba(255,255,255,0.08)',
  }

  const glowColor: Record<AgentState, string> = {
    active: '0 0 20px rgba(0,152,255,0.25)',
    tool_running: '0 0 16px rgba(220,220,170,0.2)',
    error: '0 0 16px rgba(244,71,71,0.2)',
    selected: '0 0 10px rgba(0,152,255,0.15)',
    idle: 'none',
  }

  const eyeColor: Record<AgentState, string> = {
    active: '#00d4ff',
    tool_running: '#d4d46e',
    error: '#f44747',
    selected: '#5299ff',
    idle: '#555',
  }

  const blinkSpeed = state === 'active' ? '0.4s' : state === 'tool_running' ? '1s' : '3s'

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
        border: `1px solid ${borderColor[state]}`,
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        boxShadow: glowColor[state],
        transition: 'all 0.2s ease',
        background: isActive ? 'rgba(0,152,255,0.05)' : 'rgba(255,255,255,0.02)',
      }}
    >
      {/* 로봇 눈 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        {state === 'error' ? (
          <svg width="28" height="12" viewBox="0 0 28 12">
            <text x="2" y="10" fill="#f44747" fontSize="12" fontFamily="monospace">×</text>
            <text x="16" y="10" fill="#f44747" fontSize="12" fontFamily="monospace">×</text>
          </svg>
        ) : (
          <svg width="28" height="12" viewBox="0 0 28 12">
            <ellipse cx="6" cy="6" rx="5" ry="6" fill={eyeColor[state]}
              style={{
                filter: state === 'active' || state === 'tool_running' ? `drop-shadow(0 0 3px ${eyeColor[state]})` : undefined,
                animation: `hq-blink ${blinkSpeed} ease infinite`,
              }} />
            <ellipse cx="22" cy="6" rx="5" ry="6" fill={eyeColor[state]}
              style={{
                filter: state === 'active' || state === 'tool_running' ? `drop-shadow(0 0 3px ${eyeColor[state]})` : undefined,
                animation: `hq-blink ${blinkSpeed} ease infinite 0.2s`,
              }} />
          </svg>
        )}

        {/* 입 (상태별) */}
        {state === 'error' && (
          <div style={{ flex: 1, fontSize: 9, color: '#f44747', letterSpacing: 2 }}>∧∧∧∧∧</div>
        )}
        {state === 'tool_running' && (
          <div style={{ flex: 1, fontSize: 9, color: '#d4d46e', letterSpacing: 2, overflow: 'hidden' }}>
            <span className="hq-dots-scroll">·····</span>
          </div>
        )}
        {state === 'active' && (
          <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                width: 3, height: 6,
                background: '#00d4ff',
                borderRadius: 1,
                animation: `hq-bounce 0.5s ease infinite ${i * 0.1}s`,
              }} />
            ))}
          </div>
        )}
        {(state === 'idle' || state === 'selected') && (
          <div style={{ flex: 1, height: 2, background: state === 'selected' ? '#5299ff55' : '#333', borderRadius: 1 }} />
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>

      {state === 'tool_running' && lastToolName && (
        <div style={{ fontSize: 9, color: '#d4d46e', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          ↻ {lastToolName}
        </div>
      )}

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

export function AgentBay({ sessions = [], activeSessionId, isStreaming = false, toolUses, onSelectSession, onNewSession, onToggleHQ }: AgentBayProps) {
  const [localSessions, setLocalSessions] = useState<SessionMeta[]>(sessions)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      if (sessions.length > 0) {
        setLocalSessions(sessions)
        return
      }
      window.api.sessionList?.()
        .then((list: SessionMeta[]) => {
          if (!cancelled) setLocalSessions(list ?? [])
        })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessions, activeSessionId])

  const runningTool = toolUses?.find(t => t.status === 'running')
  const hasActiveError = toolUses?.some(t => t.status === 'error') ?? false

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
            lastToolName={s.id === activeSessionId ? runningTool?.name : undefined}
            hasError={s.id === activeSessionId && hasActiveError}
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
