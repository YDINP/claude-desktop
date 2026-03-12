import { useState, useEffect, useCallback } from 'react'

interface Task {
  id: string
  text: string
  done: boolean
  createdAt: number
  priority?: 'low' | 'medium' | 'high'
}

const PRIORITY_COLORS = { high: '#f44336', medium: '#ff9800', low: '#4caf50' }

export function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  useEffect(() => {
    window.api.getTasks().then(setTasks)
  }, [])

  const save = useCallback((next: Task[]) => {
    setTasks(next)
    window.api.saveTasks(next)
  }, [])

  const addTask = () => {
    if (!input.trim()) return
    const task: Task = { id: Date.now().toString(), text: input.trim(), done: false, createdAt: Date.now(), priority }
    save([task, ...tasks])
    setInput('')
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

  const filtered = filter === 'all' ? tasks : filter === 'active' ? tasks.filter(t => !t.done) : tasks.filter(t => t.done)
  const doneCount = tasks.filter(t => t.done).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
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
        <button onClick={addTask} style={{ padding: '4px 8px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}>+</button>
      </div>

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
        {doneCount > 0 && <button onClick={clearDone} style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>완료 정리</button>}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 32, fontSize: 12 }}>할 일이 없습니다</div>}
        {filtered.map(task => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: PRIORITY_COLORS[task.priority ?? 'medium'] }} />
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
            <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
