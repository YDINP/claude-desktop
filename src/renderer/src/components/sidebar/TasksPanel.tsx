import { useState, useMemo, useCallback, useRef } from 'react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { downloadFile } from '../../utils/download'

interface Task {
  id: string
  text: string
  done: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
  memo?: string
  createdAt: number
}

const STORAGE_KEY = 'claude-desktop-tasks'

const PRIORITY_CYCLE: Record<Task['priority'], Task['priority']> = {
  low: 'medium',
  medium: 'high',
  high: 'low',
}

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  high: 'var(--error)',
  medium: '#fbbf24',
  low: '#60a5fa',
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  const due = new Date(dueDate)
  due.setHours(23, 59, 59, 999)
  return due.getTime() < Date.now()
}

function getDDayLabel(dueDate: string | null): string {
  if (!dueDate) return ''
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000)
  if (diffDays === 0) return 'D-Day'
  if (diffDays > 0) return `D-${diffDays}`
  return `D+${Math.abs(diffDays)}`
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [newTaskText, setNewTaskText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const { copiedKey: copiedTaskId, copy: copyClip } = useCopyToClipboard()
  const [taskSearch, setTaskSearch] = useState('')
  const [sortBy, setSortBy] = useState<'created' | 'priority' | 'dueDate'>('created')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [expandedMemoId, setExpandedMemoId] = useState<string | null>(null)
  const [newDueDate, setNewDueDate] = useState<string>('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const persist = useCallback((updated: Task[]) => {
    setTasks(updated)
    saveTasks(updated)
  }, [])

  const addTask = () => {
    if (!newTaskText.trim()) return
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: newTaskText.trim(),
      done: false,
      priority: 'medium',
      dueDate: newDueDate || null,
      createdAt: Date.now(),
    }
    persist([task, ...tasks])
    setNewTaskText('')
    setNewDueDate('')
  }

  const toggleDone = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)
    persist(updated)
  }

  const deleteTask = (id: string) => {
    persist(tasks.filter(t => t.id !== id))
  }

  const startEdit = (task: Task) => {
    setEditingId(task.id)
    setEditingText(task.text)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }

  const finishEdit = () => {
    if (editingId && editingText.trim()) {
      const updated = tasks.map(t => t.id === editingId ? { ...t, text: editingText.trim() } : t)
      persist(updated)
    }
    setEditingId(null)
    setEditingText('')
  }

  const cyclePriority = (id: string) => {
    const updated = tasks.map(t =>
      t.id === id ? { ...t, priority: PRIORITY_CYCLE[t.priority] } : t
    )
    persist(updated)
  }

  const copyTaskText = (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    copyClip(task.text, id)
  }

  const markAllDone = () => {
    const updated = tasks.map(t => ({ ...t, done: true }))
    persist(updated)
  }

  const updateDueDate = (id: string, dueDate: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, dueDate: dueDate || null } : t)
    persist(updated)
  }

  const setQuickDueDate = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setNewDueDate(d.toISOString().slice(0, 10))
  }

  const updateMemo = (id: string, memo: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, memo: memo || undefined } : t)
    persist(updated)
  }

  const exportTasks = () => {
    const md = tasks.map(t => {
      const check = t.done ? '[x]' : '[ ]'
      const prio = `[${t.priority}]`
      const due = t.dueDate ? ` (마감일: ${t.dueDate})` : ''
      const overdue = isOverdue(t.dueDate) && !t.done ? ' **기한 초과**' : ''
      return `- ${check} ${prio} ${t.text}${due}${overdue}`
    }).join('\n')
    downloadFile(`# 태스크 목록\n\n${md}\n`, `tasks-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown')
  }

  // filters & sort
  const searchLower = taskSearch.toLowerCase()
  const overdueCount = tasks.filter(t => !t.done && isOverdue(t.dueDate)).length

  const filteredTasks = useMemo(() => {
    let list = tasks
    if (showOverdueOnly) list = list.filter(t => !t.done && isOverdue(t.dueDate))
    if (searchLower) list = list.filter(t => t.text.toLowerCase().includes(searchLower))
    return list
  }, [tasks, searchLower, showOverdueOnly])

  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks]
    if (sortBy === 'priority') {
      sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    } else if (sortBy === 'dueDate') {
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
    } else {
      sorted.sort((a, b) => b.createdAt - a.createdAt)
    }
    return sorted
  }, [filteredTasks, sortBy])

  // progress
  const doneCount = tasks.filter(t => t.done).length
  const progressPct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div className="panel-header" style={{ gap: 4 }}>
        <span className="panel-header-label" style={{ flex: 1 }}>
          태스크 {tasks.length}개
        </span>
        {tasks.filter(t => !t.done).length > 0 && (
          <button onClick={markAllDone} title="모두 완료 처리"
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 9, padding: '1px 5px' }}>
            ✓ 전부
          </button>
        )}
        <button
          onClick={() => setShowOverdueOnly(v => !v)}
          title={showOverdueOnly ? '전체 보기' : '기한 초과만'}
          style={{
            background: showOverdueOnly ? '#f8717133' : 'none',
            border: `1px solid ${showOverdueOnly ? '#f87171' : 'transparent'}`,
            borderRadius: 4, cursor: 'pointer',
            color: overdueCount > 0 ? '#f87171' : 'var(--text-muted)',
            fontSize: 9, padding: '1px 5px',
          }}
        >
          {overdueCount > 0 ? `${overdueCount}건 초과` : '초과 0'}
        </button>
        <button
          onClick={() => setSortBy(s => s === 'created' ? 'priority' : s === 'priority' ? 'dueDate' : 'created')}
          title={`정렬: ${sortBy === 'created' ? '생성순' : sortBy === 'priority' ? '우선순위' : '마감일'}`}
          style={{ background: 'none', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '1px 4px' }}>
          {sortBy === 'created' ? '↕' : sortBy === 'priority' ? '🔴' : '📅'}
        </button>
        <button onClick={exportTasks} title="Markdown으로 내보내기"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px' }}>
          📤
        </button>
      </div>

      {/* progress bar */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
          <span>진행률 {progressPct}%</span>
          <span style={{ fontSize: 9 }}>{doneCount}/{tasks.length}</span>
        </div>
        <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, marginTop: 2 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: progressPct === 100 ? '#4ade80' : 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* completion banner */}
      {progressPct === 100 && tasks.length > 0 && (
        <div style={{ padding: '6px 8px', background: '#4ade8022', textAlign: 'center', fontSize: 12, color: '#4ade80', borderBottom: '1px solid var(--border)' }}>
          🎉 전부 완료
        </div>
      )}

      {/* search */}
      <div style={{ padding: '6px 8px' }}>
        <input
          type="text"
          placeholder="태스크 검색..."
          value={taskSearch}
          onChange={e => setTaskSearch(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setTaskSearch('')}
          className="panel-search"
          style={{ background: 'var(--bg-secondary)', boxSizing: 'border-box' }}
        />
      </div>

      {/* new task input */}
      <div style={{ padding: '0 8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type="text"
            placeholder="새 태스크..."
            value={newTaskText}
            onChange={e => setNewTaskText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            className="panel-search"
            style={{ flex: 1, background: 'var(--bg-secondary)', boxSizing: 'border-box' }}
          />
          <button onClick={addTask} title="추가"
            style={{ padding: '4px 10px', background: 'var(--accent)', color: '#fff', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: 'none' }}>
            +
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>빠른 마감일:</span>
          <button onClick={() => setQuickDueDate(0)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 9, padding: '0 4px' }}>
            오늘
          </button>
          <button onClick={() => setQuickDueDate(1)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 9, padding: '0 4px' }}>
            내일
          </button>
          <button onClick={() => setQuickDueDate(7)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 9, padding: '0 4px' }}>
            7일
          </button>
          <input
            type="date"
            value={newDueDate}
            onChange={e => setNewDueDate(e.target.value)}
            style={{
              marginLeft: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 4, color: 'var(--text-primary)', fontSize: 9, padding: '0 4px', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* task list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sortedTasks.length === 0 ? (
          <div className="panel-empty">
            {tasks.length === 0 ? '태스크가 없습니다.' : '검색 결과 없음'}
          </div>
        ) : sortedTasks.map(t => {
          const overdue = !t.done && isOverdue(t.dueDate)
          const dday = getDDayLabel(t.dueDate)
          const diffDays = t.dueDate ? Math.round((new Date(t.dueDate).getTime() - Date.now()) / 86400000) : null

          return (
            <div key={t.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* checkbox */}
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleDone(t.id)}
                  style={{ margin: 0, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                {/* priority dot */}
                <span
                  onClick={() => cyclePriority(t.id)}
                  title="클릭: 우선순위 변경"
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: PRIORITY_COLORS[t.priority],
                    cursor: 'pointer', flexShrink: 0,
                  }}
                />
                {/* task text */}
                {editingId === t.id ? (
                  <input
                    ref={editInputRef}
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={finishEdit}
                    onKeyDown={e => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') { setEditingId(null) } }}
                    style={{
                      flex: 1, padding: '2px 4px', background: 'var(--bg-secondary)',
                      border: '1px solid var(--accent)', borderRadius: 4,
                      color: 'var(--text-primary)', fontSize: 11, outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => startEdit(t)}
                    title="더블클릭하여 편집"
                    style={{
                      flex: 1, fontSize: 11, color: t.done ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: t.done ? 'line-through' : 'none',
                      cursor: 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {t.text}
                  </span>
                )}
                {/* copy */}
                <button onClick={() => copyTaskText(t.id)} title="태스크 텍스트 복사"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedTaskId === t.id ? '#4ade80' : 'var(--text-muted)', fontSize: 10, padding: '1px 3px' }}>
                  {copiedTaskId === t.id ? '✓' : '📋'}
                </button>
                {/* memo toggle */}
                <button onClick={() => setExpandedMemoId(id => id === t.id ? null : t.id)} title="메모"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.memo ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, padding: '1px 3px' }}>
                  {t.memo ? '📝' : '💬'}
                </button>
                {/* delete */}
                <button onClick={() => deleteTask(t.id)} title="삭제"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error, #f87171)', fontSize: 10, padding: '1px 3px' }}>
                  🗑
                </button>
              </div>
              {/* due date row */}
              {(t.dueDate || overdue) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, marginLeft: 20 }}>
                  <span style={{ fontSize: 9, color: overdue ? '#f87171' : 'var(--text-muted)' }}>
                    마감일: {t.dueDate}
                  </span>
                  {dday && (
                    <span style={{
                      fontSize: 9, fontWeight: 600,
                      color: overdue ? '#f87171' : diffDays !== null && diffDays <= 1 ? '#fbbf24' : 'var(--text-muted)',
                    }}>
                      {dday}
                    </span>
                  )}
                  <input
                    type="date"
                    value={t.dueDate || ''}
                    onChange={e => updateDueDate(t.id, e.target.value)}
                    style={{
                      marginLeft: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: 4, color: 'var(--text-primary)', fontSize: 9, padding: '0 3px', outline: 'none',
                    }}
                  />
                </div>
              )}
              {/* memo */}
              {expandedMemoId === t.id && (
                <div style={{ marginTop: 4, marginLeft: 20 }}>
                  <textarea
                    value={t.memo || ''}
                    onChange={e => updateMemo(t.id, e.target.value)}
                    placeholder="메모 입력..."
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '4px 6px',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: 4, color: 'var(--text-primary)', fontSize: 10,
                      resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TasksPanel
