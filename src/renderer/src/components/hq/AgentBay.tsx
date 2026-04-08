import { useState, useEffect } from 'react'
import type { ToolUseItem } from '../../domains/chat'

interface SessionMeta {
  id: string
  title?: string
  model?: string
  updatedAt: number
  inputTokens?: number
  outputTokens?: number
}

interface ActiveAgent {
  id: string
  description: string
  status: 'running' | 'completed' | 'error'
  startTime: number
  output?: string
}

interface AgentBayProps {
  sessions?: SessionMeta[]
  agents?: ActiveAgent[]
  activeSessionId: string | null
  isStreaming?: boolean
  toolUses?: ToolUseItem[]
  width?: number
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
          <div style={{ flex: 1, fontSize: 11, color: '#f44747', letterSpacing: 2 }}>∧∧∧∧∧</div>
        )}
        {state === 'tool_running' && (
          <div style={{ flex: 1, fontSize: 11, color: '#d4d46e', letterSpacing: 2, overflow: 'hidden' }}>
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

      <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f8', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>

      {state === 'tool_running' && lastToolName && (
        <div style={{ fontSize: 11, color: '#d4d46e', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
          ↻ {lastToolName}
        </div>
      )}

      {/* 토큰 게이지 */}
      {tokens > 0 && (
        <div style={{ marginTop: 6 }}>
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
          <div style={{ fontSize: 11, color: 'rgba(200,200,230,0.7)', marginTop: 3 }}>{tokStr} tok</div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'rgba(200,200,230,0.65)', marginTop: 4 }}>{timeAgo()}</div>
    </div>
  )
}

export function AgentBay({ sessions = [], agents = [], activeSessionId, isStreaming = false, toolUses, width = 260, onSelectSession, onNewSession, onToggleHQ }: AgentBayProps) {
  const [localSessions, setLocalSessions] = useState<SessionMeta[]>(sessions)

  useEffect(() => {
    if (sessions.length > 0) {
      setLocalSessions(sessions)
    }
  }, [sessions])

  const runningTool = toolUses?.find(t => t.status === 'running')
  const hasActiveError = toolUses?.some(t => t.status === 'error') ?? false

  return (
    <div className="hq-agent-bay" style={{
      width,
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
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(200,210,240,0.9)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
          AGENT BAY
        </span>
        <span style={{
          fontSize: 11, padding: '1px 6px', borderRadius: 8,
          background: 'rgba(0,152,255,0.15)', color: '#4db8ff',
        }}>
          ● {localSessions.length + agents.length}
        </span>
      </div>

      {/* 서브에이전트 카드 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
        {/* 메인 에이전트 카드 */}
        {isStreaming && (
          <div style={{
            border: `1px solid ${runningTool ? 'rgba(220,220,170,0.5)' : 'rgba(0,152,255,0.5)'}`,
            borderRadius: 6,
            padding: '10px 12px',
            marginBottom: 8,
            background: runningTool ? 'rgba(220,220,170,0.05)' : 'rgba(0,152,255,0.06)',
            boxShadow: runningTool ? '0 0 12px rgba(220,220,170,0.15)' : '0 0 12px rgba(0,152,255,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 10,
                color: runningTool ? '#d4d46e' : '#4db8ff',
                animation: 'hq-blink 0.6s infinite',
              }}>●</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#e0e8ff', letterSpacing: '0.5px' }}>
                MAIN
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(200,210,240,0.5)', fontFamily: 'var(--font-mono)' }}>
                {runningTool ? 'TOOL' : 'STREAMING'}
              </span>
            </div>
            {runningTool && (
              <div style={{ fontSize: 11, color: '#d4d46e', fontFamily: 'var(--font-mono)' }}>
                ↻ {runningTool.name}
              </div>
            )}
          </div>
        )}
        {agents.length === 0 && localSessions.length === 0 && !isStreaming && (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'rgba(200,210,240,0.65)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            <div style={{ marginBottom: 10, fontSize: 20, opacity: 0.4 }}>◌</div>
            NO ACTIVE AGENTS
            <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(200,210,240,0.5)', lineHeight: 1.6 }}>
              Claude가 Task 툴을 사용할 때<br/>서브에이전트가 여기에 표시됩니다
            </div>
          </div>
        )}
        {agents.map(agent => (
          <div
            key={agent.id}
            style={{
              border: `1px solid ${agent.status === 'running' ? 'rgba(0,152,255,0.5)' : agent.status === 'error' ? 'rgba(244,71,71,0.4)' : 'rgba(63,185,80,0.4)'}`,
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 8,
              background: agent.status === 'running' ? 'rgba(0,152,255,0.06)' : 'rgba(0,0,0,0.2)',
              boxShadow: agent.status === 'running' ? '0 0 12px rgba(0,152,255,0.2)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{
                fontSize: 10,
                color: agent.status === 'running' ? '#4db8ff' : agent.status === 'error' ? '#f44747' : '#3fb950',
                animation: agent.status === 'running' ? 'hq-blink 0.6s infinite' : 'none',
              }}>●</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#e0e8ff', letterSpacing: '0.5px' }}>
                {agent.status === 'running' ? 'RUNNING' : agent.status === 'error' ? 'ERROR' : 'DONE'}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(200,210,240,0.65)' }}>
                {Math.floor((Date.now() - agent.startTime) / 1000)}s
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(225,230,255,0.85)', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {agent.description}
            </div>
            {agent.output && agent.status !== 'running' && (
              <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(200,210,240,0.65)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                → {agent.output}
              </div>
            )}
          </div>
        ))}
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

      {/* 안내 메시지 */}
      <div style={{
        margin: '0 12px 10px',
        padding: '8px 10px',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 4,
        background: 'rgba(255,255,255,0.03)',
        fontSize: 11,
        color: 'rgba(200,210,240,0.6)',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.6,
        flexShrink: 0,
      }}>
        Claude가 Task 툴을 사용하면<br/>서브에이전트가 자동 등록됩니다
      </div>
    </div>
  )
}
