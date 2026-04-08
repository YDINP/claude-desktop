import { useCallback, useEffect, useMemo, useState } from 'react'

// --- Types ---

interface CalendarEvent {
  id: string
  date: string        // YYYY-MM-DD
  title: string
  color: string
  createdAt: number
}

interface SessionInfo {
  date: string
  count: number
}

// --- Constants ---

const STORAGE_KEY = 'calendarEvents'
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const EVENT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6']

// --- Helpers ---

function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveEvents(events: CalendarEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function todayStr(): string {
  const d = new Date()
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

// --- Component ---

export function CalendarPanel({ sessions = [] }: { sessions?: SessionInfo[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(loadEvents)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const [eventsCopied, setEventsCopied] = useState(false)

  // Persist events
  useEffect(() => { saveEvents(calendarEvents) }, [calendarEvents])

  // --- Session stats ---
  const totalSessions = sessions.reduce((s, x) => s + x.count, 0)
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthSessions = sessions.filter(s => s.date.startsWith(monthPrefix))
  const monthSessionCount = monthSessions.reduce((s, x) => s + x.count, 0)
  const monthEventCount = calendarEvents.filter(e => e.date.startsWith(monthPrefix)).length

  // --- Calendar grid ---
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const weeks = useMemo(() => {
    const rows: (number | null)[][] = []
    let row: (number | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) {
      row.push(d)
      if (row.length === 7) { rows.push(row); row = [] }
    }
    if (row.length > 0) {
      while (row.length < 7) row.push(null)
      rows.push(row)
    }
    return rows
  }, [year, month, daysInMonth, firstDay])

  // --- Events for selected day ---
  const dayEvents = useMemo(
    () => calendarEvents.filter(e => e.date === selectedDay),
    [calendarEvents, selectedDay],
  )

  // --- Upcoming events ---
  const today = todayStr()
  const upcomingEvents = useMemo(
    () => calendarEvents
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [calendarEvents, today],
  )
  const visibleUpcoming = showAllUpcoming ? upcomingEvents : upcomingEvents.slice(0, 3)

  // --- Handlers ---

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const goToday = () => {
    const d = new Date()
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelectedDay(todayStr())
  }

  const addEvent = useCallback(() => {
    if (!selectedDay || !newEventTitle.trim()) return
    const ev: CalendarEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: selectedDay,
      title: newEventTitle.trim(),
      color: EVENT_COLORS[0],
      createdAt: Date.now(),
    }
    setCalendarEvents(prev => [...prev, ev])
    setNewEventTitle('')
  }, [selectedDay, newEventTitle])

  const removeEvent = (id: string) => {
    setCalendarEvents(prev => prev.filter(e => e.id !== id))
  }

  const deleteAllDayEvents = () => {
    if (!selectedDay) return
    // 이 날짜 이벤트 전체 삭제
    setCalendarEvents(prev => prev.filter(e => e.date !== selectedDay))
  }

  // 클릭: 색상 변경
  const nextColor = (id: string) => {
    setCalendarEvents(prev => prev.map(e => {
      if (e.id !== id) return e
      const idx = EVENT_COLORS.indexOf(e.color)
      return { ...e, color: EVENT_COLORS[(idx + 1) % EVENT_COLORS.length] }
    }))
  }

  // 더블클릭 편집
  const startEdit = (ev: CalendarEvent) => {
    setEditingEventId(ev.id)
    setEditingText(ev.title)
  }

  const commitEventEdit = () => {
    if (!editingEventId) return
    setCalendarEvents(prev => prev.map(e =>
      e.id === editingEventId ? { ...e, title: editingText.trim() || e.title } : e
    ))
    setEditingEventId(null)
    setEditingText('')
  }

  // 이벤트 목록 복사
  const copyUpcomingEvents = () => {
    const text = upcomingEvents
      .map(e => `${e.date} - ${e.title}`)
      .join('\n')
    navigator.clipboard.writeText(text || '(없음)').then(() => {
      setEventsCopied(true)
      setTimeout(() => setEventsCopied(false), 1500)
    })
  }

  const setYearDirect = (y: number) => {
    setYear(y)
    setYearPickerOpen(false)
  }

  // --- Cell helpers ---
  const eventsForDate = (dateStr: string) =>
    calendarEvents.filter(e => e.date === dateStr)

  const sessionsForDate = (dateStr: string) =>
    sessions.filter(s => s.date === dateStr).reduce((sum, s) => sum + s.count, 0)

  // --- Render ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header: month nav */}
      <div style={{
        padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <button onClick={prevMonth} style={navBtnStyle} title="이전 달">&lt;</button>
        <span
          style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
          onClick={() => setYearPickerOpen(v => !v)}
          title="연도 빠른 이동"
        >
          {year}년 {month + 1}월
        </span>
        <button onClick={nextMonth} style={navBtnStyle} title="다음 달">&gt;</button>
        <button onClick={goToday} style={{ ...navBtnStyle, fontSize: 10 }} title="오늘으로 이동">
          오늘로 이동
        </button>
      </div>

      {/* Year picker */}
      {yearPickerOpen && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0,
        }}>
          {Array.from({ length: 11 }, (_, i) => year - 5 + i).map(y => (
            <button
              key={y}
              onClick={() => setYearDirect(y)}
              style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                background: y === year ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: y === year ? '#fff' : 'var(--text-muted)',
                border: 'none',
              }}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Session & event stats */}
      <div style={{
        padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8,
      }}>
        <span>전체 {totalSessions}개 세션</span>
        <span>이번 달: {monthSessionCount}개 세션 / {monthEventCount}개 이벤트</span>
      </div>

      {/* Calendar grid */}
      <div style={{ padding: '4px 6px', flexShrink: 0 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: 9, color: 'var(--text-muted)',
              padding: '2px 0', fontWeight: 600,
            }}>{d}</div>
          ))}
        </div>
        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {week.map((day, di) => {
              if (day === null) return <div key={`e-${di}`} />
              const dateStr = toDateStr(year, month, day)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDay
              const evCount = eventsForDate(dateStr).length
              const sesCount = sessionsForDate(dateStr)
              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                  style={{
                    textAlign: 'center', fontSize: 10, padding: '3px 0',
                    cursor: 'pointer', borderRadius: 4, position: 'relative',
                    background: isSelected ? 'var(--accent)' : isToday ? 'var(--bg-tertiary)' : 'transparent',
                    color: isSelected ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: isToday ? 700 : 400,
                  }}
                >
                  {day}
                  {(evCount > 0 || sesCount > 0) && (
                    <div style={{
                      position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                      display: 'flex', gap: 1,
                    }}>
                      {evCount > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#3b82f6' }} />}
                      {sesCount > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#22c55e' }} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selected day events */}
      {selectedDay && (
        <div style={{
          borderTop: '1px solid var(--border)', padding: '6px 8px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
              {selectedDay}
            </span>
            {dayEvents.length > 0 && (
              <button
                onClick={deleteAllDayEvents}
                title="이 날짜 이벤트 전체 삭제"
                style={{
                  padding: '1px 6px', background: 'transparent',
                  color: 'var(--error, #f87171)', borderRadius: 4, fontSize: 9,
                  border: '1px solid var(--error, #f87171)', cursor: 'pointer',
                }}
              >
                전체 삭제
              </button>
            )}
          </div>
          {/* Event list */}
          {dayEvents.map(ev => (
            <div
              key={ev.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                onClick={() => nextColor(ev.id)}
                title="클릭: 색상 변경"
                style={{
                  width: 8, height: 8, borderRadius: '50%', background: ev.color,
                  cursor: 'pointer', flexShrink: 0,
                }}
              />
              {editingEventId === ev.id ? (
                <input
                  autoFocus
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  onBlur={commitEventEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEventEdit(); if (e.key === 'Escape') setEditingEventId(null) }}
                  style={{
                    flex: 1, fontSize: 11, padding: '1px 4px',
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 4, outline: 'none',
                  }}
                />
              ) : (
                <span
                  onDoubleClick={() => startEdit(ev)}
                  title="더블클릭 편집"
                  style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)', cursor: 'default' }}
                >
                  {ev.title}
                </span>
              )}
              <button
                onClick={() => removeEvent(ev.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 11, padding: '0 2px',
                }}
              >
                x
              </button>
            </div>
          ))}
          {/* Add event */}
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <input
              value={newEventTitle}
              onChange={e => setNewEventTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEvent()}
              placeholder="새 이벤트..."
              style={{
                flex: 1, fontSize: 11, padding: '3px 6px',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 4, outline: 'none',
              }}
            />
            <button
              onClick={addEvent}
              disabled={!newEventTitle.trim()}
              style={{
                padding: '3px 8px', background: 'var(--accent)', color: '#fff',
                borderRadius: 4, fontSize: 10, cursor: 'pointer',
                opacity: !newEventTitle.trim() ? 0.5 : 1,
                border: 'none',
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Upcoming events */}
      <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            다음 이벤트 ({upcomingEvents.length})
          </span>
          <button
            onClick={copyUpcomingEvents}
            title="이벤트 목록 복사"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: eventsCopied ? '#4ade80' : 'var(--text-muted)', fontSize: 11,
              padding: '0 4px',
            }}
          >
            {eventsCopied ? '✓' : '📋'}
          </button>
        </div>
        {upcomingEvents.length === 0 ? (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
            예정된 이벤트 없음
          </div>
        ) : (
          <>
            {visibleUpcoming.map(ev => (
              <div
                key={ev.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px', borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, width: 70 }}>
                  {ev.date}
                </span>
                <span style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.title}
                </span>
              </div>
            ))}
            {upcomingEvents.length > 3 && (
              <button
                onClick={() => setShowAllUpcoming(v => !v)}
                style={{
                  width: '100%', padding: '4px 0', background: 'none',
                  border: 'none', cursor: 'pointer', fontSize: 10,
                  color: 'var(--accent)', textAlign: 'center',
                }}
              >
                {showAllUpcoming ? '접기' : `더 보기 (${upcomingEvents.length - 3})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  padding: '2px 6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
  borderRadius: 4, fontSize: 12, cursor: 'pointer', border: 'none', flexShrink: 0,
}
