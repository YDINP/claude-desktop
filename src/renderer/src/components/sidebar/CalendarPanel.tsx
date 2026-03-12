import { useState, useEffect, useMemo, useCallback } from 'react'

interface CalendarEvent {
  id: string
  date: string
  title: string
  color: string
}

const EVENT_COLORS = ['#60a5fa', '#f87171', '#4ade80', '#fbbf24', '#a78bfa', '#fb923c']
const STORAGE_KEY = 'calendarEvents'

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
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
  })
  const [eventInput, setEventInput] = useState('')
  const [eventColor, setEventColor] = useState(EVENT_COLORS[0])
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingEventDraft, setEditingEventDraft] = useState('')
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)

  const commitEventEdit = (id: string) => {
    if (editingEventDraft.trim()) saveEvents(events.map(e => e.id === id ? { ...e, title: editingEventDraft.trim() } : e))
    setEditingEventId(null)
  }

  const saveEvents = useCallback((next: CalendarEvent[]) => {
    setEvents(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const addEvent = () => {
    if (!eventInput.trim() || !selectedDay) return
    saveEvents([...events, { id: Date.now().toString(), date: selectedDay, title: eventInput.trim(), color: eventColor }])
    setEventInput('')
  }

  const deleteEvent = (id: string) => saveEvents(events.filter(e => e.id !== id))

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

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthEventCount = useMemo(
    () => events.filter(e => e.date.startsWith(monthPrefix)).length,
    [events, monthPrefix]
  )

  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [events, today])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, fontSize: 12 }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <button
            onClick={() => setYearPickerOpen(v => !v)}
            title="연도 선택"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)', fontSize: 12, padding: 0 }}
          >
            {year}년
          </button>
          <span style={{ fontWeight: 600 }}>{MONTHS[month]}</span>
          {yearPickerOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              padding: 4, display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2,
            }}>
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                <button key={y} onClick={() => { setViewDate(new Date(y, month)); setYearPickerOpen(false) }}
                  style={{
                    background: y === year ? 'var(--accent)' : 'none',
                    color: y === year ? '#fff' : 'var(--text-primary)',
                    border: 'none', borderRadius: 4, padding: '3px 12px',
                    cursor: 'pointer', fontSize: 11, textAlign: 'left',
                  }}
                >{y}년</button>
              ))}
            </div>
          )}
          {(year !== new Date().getFullYear() || month !== new Date().getMonth()) && (
            <button
              onClick={() => { setViewDate(new Date()); setSelectedDay(today) }}
              title="오늘로 이동"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 3, cursor: 'pointer', color: 'var(--accent)', fontSize: 9, padding: '1px 5px', lineHeight: '14px' }}
            >
              오늘
            </button>
          )}
        </div>
        <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}>›</button>
      </div>
      {/* 세션 수 합계 */}
      {sessions.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>
          전체 {sessions.length}개 세션 · 이번 달 {
            [...sessionsByDate.entries()]
              .filter(([k]) => k.startsWith(monthPrefix))
              .reduce((s, [, v]) => s + v.length, 0)
          }개{monthEventCount > 0 && <> · <span style={{ color: 'var(--accent)' }}>이벤트 {monthEventCount}개</span></>}
        </div>
      )}

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
          const dayEvents = events.filter(e => e.date === cell.date)
          const isToday = cell.date === today
          const isSelected = cell.date === selectedDay
          return (
            <div
              key={cell.date}
              onClick={() => setSelectedDay(d => d === cell.date ? null : cell.date)}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: 4, cursor: 'pointer',
                background: isSelected ? 'var(--accent)' : isToday ? 'var(--bg-secondary)' : 'transparent',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                position: 'relative'
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--accent)' : 'var(--bg-hover, #2a2a2a)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--accent)' : isToday ? 'var(--bg-secondary)' : 'transparent')}
            >
              <span style={{ fontSize: 11, color: isSelected ? '#fff' : 'var(--text-primary)' }}>{cell.day}</span>
              <div style={{ display: 'flex', gap: 1, marginTop: 1, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 14 }}>
                {count > 0 && <div style={{ width: Math.min(count * 2 + 4, 12), height: 3, borderRadius: 2, background: isSelected ? '#fff' : 'var(--accent)' }} />}
                {dayEvents.slice(0, 3).map(ev => <div key={ev.id} style={{ width: 4, height: 4, borderRadius: '50%', background: ev.color }} />)}
              </div>
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

      {/* 다음 이벤트 미리보기 (날짜 미선택 시) */}
      {!selectedDay && upcomingEvents.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>다음 이벤트</span>
            {upcomingEvents.length > 3 && (
              <button onClick={() => setShowAllUpcoming(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--accent)', padding: 0 }}>
                {showAllUpcoming ? '접기' : `더 보기 (${upcomingEvents.length - 3}개)`}
              </button>
            )}
          </div>
          {(showAllUpcoming ? upcomingEvents : upcomingEvents.slice(0, 3)).map(ev => (
            <div
              key={ev.id}
              onClick={() => setSelectedDay(ev.date)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px',
                borderRadius: 4, cursor: 'pointer', marginBottom: 2,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 8, color: ev.color, flexShrink: 0 }}>●</span>
              <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{ev.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 커스텀 이벤트 */}
      {selectedDay && (
        <div style={{ marginTop: 8 }}>
          {events.filter(e => e.date === selectedDay).length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>이벤트 {events.filter(e => e.date === selectedDay).length}개</span>
              <button
                onClick={() => saveEvents(events.filter(e => e.date !== selectedDay))}
                title="이 날짜 이벤트 전체 삭제"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--text-muted)', padding: '0 2px' }}
              >전체 삭제</button>
            </div>
          )}
          {events.filter(e => e.date === selectedDay).map(ev => (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', marginBottom: 2, borderRadius: 3, background: 'var(--bg-secondary)', borderLeft: `3px solid ${ev.color}` }}>
              <div
                onClick={() => {
                  const idx = EVENT_COLORS.indexOf(ev.color)
                  const nextColor = EVENT_COLORS[(idx + 1) % EVENT_COLORS.length]
                  saveEvents(events.map(e => e.id === ev.id ? { ...e, color: nextColor } : e))
                }}
                title="클릭: 색상 변경"
                style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, cursor: 'pointer', flexShrink: 0 }}
              />
              {editingEventId === ev.id ? (
                <input autoFocus value={editingEventDraft} onChange={e => setEditingEventDraft(e.target.value)}
                  onBlur={() => commitEventEdit(ev.id)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEventEdit(ev.id); else if (e.key === 'Escape') setEditingEventId(null) }}
                  style={{ flex: 1, fontSize: 11, background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: 2, color: 'inherit', padding: '1px 3px', outline: 'none' }} />
              ) : (
                <span onDoubleClick={() => { setEditingEventId(ev.id); setEditingEventDraft(ev.title) }} title="더블클릭 편집"
                  style={{ flex: 1, fontSize: 11, cursor: 'text' }}>{ev.title}</span>
              )}
              <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {EVENT_COLORS.map(c => (
              <div key={c} onClick={() => setEventColor(c)}
                style={{ width: 10, height: 10, borderRadius: '50%', background: c, cursor: 'pointer', outline: eventColor === c ? `2px solid ${c}` : 'none', outlineOffset: 1 }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <input
              value={eventInput} onChange={e => setEventInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEvent()}
              placeholder="이벤트 추가..."
              style={{ flex: 1, fontSize: 11, padding: '3px 6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, color: 'inherit' }}
            />
            <button onClick={addEvent} style={{ padding: '3px 8px', background: 'var(--accent)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer', fontSize: 11 }}>+</button>
          </div>
        </div>
      )}
    </div>
  )
}
