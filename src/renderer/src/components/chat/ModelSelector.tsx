import React, { useEffect, useRef, useState, useMemo } from 'react'

export const MODEL_DEFS = [
  {
    id: 'claude-opus-4-6',
    label: 'Opus 4.6',
    icon: '🧠',
    desc: '가장 강력',
    color: '#c084fc',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    icon: '⚖️',
    desc: '균형',
    color: '#60a5fa',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    icon: '⚡',
    desc: '빠름',
    color: '#34d399',
  },
] as const

export function ModelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // recent-model localStorage 동기화
  const [recentId, setRecentId] = useState<string | null>(() =>
    localStorage.getItem('recent-model'),
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (id: string) => {
    onChange(id)
    localStorage.setItem('recent-model', id)
    setRecentId(id)
    setOpen(false)
  }

  // 최근 모델을 상단으로 정렬
  const sorted = useMemo(() => {
    if (!recentId || recentId === value) return MODEL_DEFS
    const idx = MODEL_DEFS.findIndex((m) => m.id === recentId)
    if (idx <= 0) return MODEL_DEFS
    const arr = [...MODEL_DEFS]
    const [item] = arr.splice(idx, 1)
    return [item, ...arr]
  }, [recentId, value])

  const current = MODEL_DEFS.find((m) => m.id === value) ?? MODEL_DEFS[1]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="모델 선택"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '2px 8px 2px 6px',
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--text-primary)',
        }}
      >
        <span>{current.icon}</span>
        <span style={{ color: current.color, fontWeight: 600 }}>{current.label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 9999,
            minWidth: 170,
            overflow: 'hidden',
          }}
        >
          {sorted.map((m, i) => {
            const isSelected = m.id === value
            const isRecent = m.id === recentId && m.id !== value
            return (
              <div
                key={m.id}
                onClick={() => handleSelect(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--bg-hover, rgba(137,180,250,0.12))' : 'transparent',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) =>
                  !isSelected &&
                  ((e.currentTarget as HTMLDivElement).style.background =
                    'var(--bg-hover, rgba(255,255,255,0.06))')
                }
                onMouseLeave={(e) =>
                  !isSelected &&
                  ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                }
              >
                <span style={{ fontSize: 15 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: m.color, fontWeight: 600, fontSize: 12 }}>{m.label}</span>
                    {isRecent && (
                      <span
                        style={{
                          fontSize: 9,
                          background: 'rgba(255,255,255,0.1)',
                          color: 'var(--text-muted)',
                          borderRadius: 3,
                          padding: '1px 4px',
                        }}
                      >
                        최근
                      </span>
                    )}
                    {isSelected && (
                      <span style={{ fontSize: 10, color: m.color }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{m.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
