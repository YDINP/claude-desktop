import { useState, useEffect, useMemo } from 'react'

interface SessionMeta {
  id: string
  title: string
  updatedAt?: number
  createdAt?: number
}

interface CalendarPanelProps {
  onSelectSession?: (id: string) => void
}

export function CalendarPanel({ onSelectSession }: CalendarPanelProps) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    window.api.sessionList().then(list => setSessions(list as SessionMeta[]))
  }, [])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionMeta[]>()
    for (const s of sessions) {
      const ts = s.updatedAt ?? s.createdAt
      if (!ts) continue
      const d = new Date(ts)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [sessions])

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ date: string | null; day: number | null }> = []
  for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: key, day: d })
  }

  const today = new Date().toISOString().slice(0, 10)

  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  const selectedSessions = selectedDay ? (sessionsByDate.get(selectedDay) ?? []) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, fontSize: 12 }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}>‹</button>
        <span style={{ fontWeight: 600 }}>{year}년 {MONTHS[month]}</span>
        <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['일','월','화','수','목','금','토'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} />
          const count = sessionsByDate.get(cell.date)?.length ?? 0
          const isToday = cell.date === today
          const isSelected = cell.date === selectedDay
          return (
            <div
              key={cell.date}
              onClick={() => setSelectedDay(d => d === cell.date ? null : cell.date)}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: 4, cursor: count > 0 ? 'pointer' : 'default',
                background: isSelected ? 'var(--accent)' : isToday ? 'var(--bg-secondary)' : 'transparent',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                position: 'relative'
              }}
              onMouseEnter={e => count > 0 && ((e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--accent)' : 'var(--bg-hover, #2a2a2a)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--accent)' : isToday ? 'var(--bg-secondary)' : 'transparent')}
            >
              <span style={{ fontSize: 11, color: isSelected ? '#fff' : 'var(--text-primary)' }}>{cell.day}</span>
              {count > 0 && (
                <div style={{ width: Math.min(count * 2 + 4, 12), height: 3, borderRadius: 2, background: isSelected ? '#fff' : 'var(--accent)', marginTop: 1 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day sessions */}
      {selectedDay && selectedSessions.length > 0 && (
        <div style={{ marginTop: 12, flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{selectedDay}</div>
          {selectedSessions.map(s => (
            <div
              key={s.id}
              onClick={() => onSelectSession?.(s.id)}
              style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', marginBottom: 2, background: 'var(--bg-secondary)', fontSize: 12 }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, #2a2a2a)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)')}
            >
              {s.title || '(제목 없음)'}
            </div>
          ))}
        </div>
      )}
      {selectedDay && selectedSessions.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>이 날짜에 세션이 없습니다</div>
      )}
    </div>
  )
}
