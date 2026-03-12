import { useState, useEffect, useCallback } from 'react'

interface Task {
  id: string
  text: string
  done: boolean
  createdAt: number
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  memo?: string
}

const PRIORITY_COLORS = { high: '#f44336', medium: '#ff9800', low: '#4caf50' }
const PRIORITY_CYCLE: Record<string, 'low' | 'medium' | 'high'> = { low: 'medium', medium: 'high', high: 'low' }

export function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')
  const [sortBy, setSortBy] = useState<'created' | 'priority' | 'due'>('created')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [expandedMemoId, setExpandedMemoId] = useState<string | null>(null)

  const updateMemo = (id: string, memo: string) => save(tasks.map(t => t.id === id ? { ...t, memo } : t))
  const cyclePriority = (id: string, cur: 'low' | 'medium' | 'high' | undefined) =>
    save(tasks.map(t => t.id === id ? { ...t, priority: PRIORITY_CYCLE[cur ?? 'medium'] } : t))

  useEffect(() => {
    window.api.getTasks().then(setTasks)
  }, [])

  const save = useCallback((next: Task[]) => {
    setTasks(next)
    window.api.saveTasks(next)
  }, [])

  const addTask = () => {
    if (!input.trim()) return
    const task: Task = { id: Date.now().toString(), text: input.trim(), done: false, createdAt: Date.now(), priority, dueDate: dueDate || undefined }
    save([task, ...tasks])
    setInput('')
    setDueDate('')
  }

  const toggleDone = (id: string) => {
    save(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const deleteTask = (id: string) => {
    save(tasks.filter(t => t.id !== id))
  }

  const clearDone = () => save(tasks.filter(t => !t.done))

  const startEdit = (task: Task) => { setEditingId(task.id); setEditDraft(task.text) }
  const commitEdit = (id: string) => {
    if (editDraft.trim()) save(tasks.map(t => t.id === id ? { ...t, text: editDraft.trim() } : t))
    setEditingId(null)
  }

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
  const searchLower = taskSearch.trim().toLowerCase()
  const filtered = (filter === 'all' ? tasks : filter === 'active' ? tasks.filter(t => !t.done) : tasks.filter(t => t.done))
    .filter(t => !searchLower || t.text.toLowerCase().includes(searchLower))
    .slice().sort((a, b) => {
      if (sortBy === 'priority') return (PRIORITY_ORDER[a.priority ?? 'medium'] - PRIORITY_ORDER[b.priority ?? 'medium']) || (b.createdAt - a.createdAt)
      if (sortBy === 'due') {
        const ad = a.dueDate ?? '9999', bd = b.dueDate ?? '9999'
        return ad < bd ? -1 : ad > bd ? 1 : b.createdAt - a.createdAt
      }
      return b.createdAt - a.createdAt
    })
  const doneCount = tasks.filter(t => t.done).length

  const progressPct = tasks.length > 0 ? Math.round(doneCount / tasks.length * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
      {/* 진행률 바 */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>
            <span>진행률</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{doneCount}/{tasks.length} ({progressPct}%)</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: progressPct === 100 ? '#4ade80' : 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      {/* Input area */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          style={{ padding: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', fontSize: 11 }}>
          <option value="high">🔴</option>
          <option value="medium">🟡</option>
          <option value="low">🟢</option>
        </select>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="새 할 일..."
          style={{ flex: 1, padding: '4px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', fontSize: 12 }}
        />
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          title="마감일 (선택)"
          style={{ padding: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', fontSize: 10, width: 32, cursor: 'pointer', opacity: 0.7 }} />
        <button onClick={addTask} style={{ padding: '4px 8px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}>+</button>
      </div>

      {/* 검색 필터 */}
      {tasks.length > 3 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, alignItems: 'center' }}>
          <input
            value={taskSearch}
            onChange={e => setTaskSearch(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setTaskSearch('')}
            placeholder="태스크 검색..."
            style={{ flex: 1, padding: '3px 6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', fontSize: 11, outline: 'none' }}
          />
          {taskSearch && <button onClick={() => setTaskSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>×</button>}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['all', 'active', 'done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)',
              background: filter === f ? 'var(--accent)' : 'var(--bg-secondary)',
              color: filter === f ? '#fff' : 'var(--text-muted)' }}>
            {f === 'all' ? `전체 ${tasks.length}` : f === 'active' ? `진행 ${tasks.length - doneCount}` : `완료 ${doneCount}`}
          </button>
        ))}
        <button onClick={() => setSortBy(s => s === 'created' ? 'priority' : s === 'priority' ? 'due' : 'created')}
          title={`정렬: ${sortBy === 'created' ? '최신순' : sortBy === 'priority' ? '우선순위' : '마감일'}`}
          style={{ marginLeft: 'auto', fontSize: 10, background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', padding: '1px 6px' }}>
          {sortBy === 'created' ? '⏱' : sortBy === 'priority' ? '🔴' : '📅'}
        </button>
        {doneCount > 0 && <button onClick={clearDone} style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>완료 정리</button>}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 32, fontSize: 12 }}>할 일이 없습니다</div>}
        {filtered.map(task => (
          <div key={task.id} style={{ borderBottom: '1px solid var(--border)', padding: '4px 4px 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div onClick={() => cyclePriority(task.id, task.priority)} title="클릭: 우선순위 변경" style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: PRIORITY_COLORS[task.priority ?? 'medium'], cursor: 'pointer' }} />
            <input type="checkbox" checked={task.done} onChange={() => toggleDone(task.id)} style={{ cursor: 'pointer' }} />
            {editingId === task.id ? (
              <input
                autoFocus
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                onBlur={() => commitEdit(task.id)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(task.id); else if (e.key === 'Escape') setEditingId(null) }}
                style={{ flex: 1, fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: 3, color: 'var(--text-primary)', padding: '1px 4px', outline: 'none' }}
              />
            ) : (
              <span
                onDoubleClick={() => startEdit(task)}
                title="더블클릭하여 편집"
                style={{ flex: 1, fontSize: 12, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--text-muted)' : 'var(--text-primary)', wordBreak: 'break-word', cursor: 'text' }}
              >
                {task.text}
              </span>
            )}
            {task.dueDate && !task.done && (() => {
              const today = new Date().toISOString().slice(0, 10)
              const overdue = task.dueDate < today
              return <span style={{ fontSize: 9, color: overdue ? '#f87171' : 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }} title={overdue ? '마감 초과' : '마감일'}>{overdue ? '⚠' : '📅'}{task.dueDate.slice(5)}</span>
            })()}
            <button onClick={() => setExpandedMemoId(expandedMemoId === task.id ? null : task.id)}
              title="메모" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, flexShrink: 0, color: task.memo ? '#fbbf24' : 'var(--text-muted)', opacity: 0.7 }}>📝</button>
            <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>×</button>
          </div>
          {expandedMemoId === task.id && (
            <textarea value={task.memo ?? ''} onChange={e => updateMemo(task.id, e.target.value)}
              placeholder="메모 추가..."
              style={{ width: '100%', marginTop: 3, fontSize: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', padding: '3px 6px', outline: 'none', resize: 'none', boxSizing: 'border-box', minHeight: 48, lineHeight: 1.4 }} />
          )}
          </div>
        ))}
      </div>
    </div>
  )
}
