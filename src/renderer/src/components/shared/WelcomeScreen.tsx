import { useState } from 'react'

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void
  recentSessions?: Array<{ id: string; title: string }>
  onSelectSession?: (id: string) => void
}

const QUICK_CARDS = [
  {
    icon: '📝',
    title: '코드 작성 도움받기',
    desc: '코드 리뷰, 디버깅, 최적화',
    prompt: '코드 리뷰를 부탁드립니다',
  },
  {
    icon: '🔍',
    title: '문서 분석하기',
    desc: '파일을 드래그하거나 내용을 붙여넣으세요',
    prompt: '이 문서를 분석해주세요',
  },
  {
    icon: '💡',
    title: '아이디어 탐구하기',
    desc: '브레인스토밍, 글쓰기, 분석',
    prompt: '다음 아이디어에 대한 피드백을 주세요:',
  },
]

const SHORTCUTS = [
  { key: 'Ctrl+N', label: '새 세션' },
  { key: 'Ctrl+K', label: '커맨드' },
  { key: 'Ctrl+/', label: '단축키' },
]

export function WelcomeScreen({ onSelectPrompt, recentSessions, onSelectSession }: WelcomeScreenProps) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [hoveredSession, setHoveredSession] = useState<number | null>(null)

  const visibleSessions = recentSessions?.slice(0, 3) ?? []

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100%',
      padding: '40px 24px',
      gap: 32,
      boxSizing: 'border-box',
    }}>
      {/* Logo + title */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontSize: 48,
          background: 'linear-gradient(135deg, #528BFF 0%, #9B6DFF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1,
          userSelect: 'none',
        }}>
          ✦
        </div>
        <div style={{
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.3px',
        }}>
          Claude Desktop
        </div>
        <div style={{
          fontSize: 14,
          color: '#888',
          marginTop: 2,
        }}>
          AI와 함께 더 스마트하게 작업하세요
        </div>
      </div>

      {/* Quick start cards */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 700,
        width: '100%',
      }}>
        {QUICK_CARDS.map((card, i) => (
          <button
            key={i}
            onClick={() => onSelectPrompt(card.prompt)}
            onMouseEnter={() => setHoveredCard(i)}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: hoveredCard === i
                ? 'rgba(82,139,255,0.08)'
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${hoveredCard === i ? 'rgba(82,139,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              textAlign: 'left',
              flex: '1 1 180px',
              minWidth: 160,
              maxWidth: 220,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              transition: 'background 0.15s, border-color 0.15s',
              outline: 'none',
            }}
          >
            <span style={{ fontSize: 20 }}>{card.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {card.title}
            </span>
            <span style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>
              {card.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Recent sessions */}
      {visibleSessions.length > 0 && onSelectSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480, width: '100%' }}>
          <div style={{ fontSize: 11, color: '#666', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            최근 세션
          </div>
          {visibleSessions.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              onMouseEnter={() => setHoveredSession(i)}
              onMouseLeave={() => setHoveredSession(null)}
              style={{
                background: hoveredSession === i ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-secondary)',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background 0.12s',
                outline: 'none',
              }}
            >
              <span style={{ fontSize: 14, opacity: 0.5 }}>💬</span>
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {s.title}
              </span>
              <span style={{ fontSize: 11, opacity: 0.4 }}>→</span>
            </button>
          ))}
        </div>
      )}

      {/* Keyboard shortcut hints */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 4,
      }}>
        {SHORTCUTS.map(({ key, label }) => (
          <span key={key} style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 5 }}>
            <kbd style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#888',
            }}>
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
