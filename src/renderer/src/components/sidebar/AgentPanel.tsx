import { useState, useEffect, useCallback, useRef } from 'react'

type AgentTask = {
  id: string
  name: string
  prompt: string
  schedule: 'manual' | 'onStart' | 'hourly' | 'daily'
  lastRun?: number
  lastResult?: string
  status: 'idle' | 'running' | 'done' | 'error'
  enabled: boolean
}

const STORAGE_KEY = 'agent-tasks'

const STATUS_ICON: Record<AgentTask['status'], string> = {
  idle: '○',
  running: '⟳',
  done: '✓',
  error: '✗',
}

const STATUS_COLOR: Record<AgentTask['status'], string> = {
  idle: 'var(--text-muted)',
  running: '#60a5fa',
  done: '#4ade80',
  error: '#f87171',
}

const SCHEDULE_LABELS: Record<AgentTask['schedule'], string> = {
  manual: '수동',
  onStart: '시작 시',
  hourly: '매시간',
  daily: '매일',
}

function loadTasks(): AgentTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AgentTask[]) : []
  } catch {
    return []
  }
}

function saveTasks(tasks: AgentTask[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

function relativeTime(ts?: number): string {
  if (!ts) return '없음'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export function AgentPanel() {
  const [tasks, setTasks] = useState<AgentTask[]>(loadTasks)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPrompt, setFormPrompt] = useState('')
  const [formSchedule, setFormSchedule] = useState<AgentTask['schedule']>('manual')
  const onStartRanRef = useRef(false)

  const updateTasks = useCallback((next: AgentTask[]) => {
    setTasks(next)
    saveTasks(next)
  }, [])

  const runTask = useCallback(async (id: string) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, status: 'running' as const } : t)
      saveTasks(next)
      return next
    })

    const current = loadTasks().find(t => t.id === id)
    if (!current) return

    try {
      const result = await window.api.summarizeSession({
        messages: [{ role: 'user', content: current.prompt }],
      })
      setTasks(prev => {
        const next = prev.map(t =>
          t.id === id
            ? {
                ...t,
                status: result.error ? ('error' as const) : ('done' as const),
                lastRun: Date.now(),
                lastResult: result.error ?? result.summary,
              }
            : t
        )
        saveTasks(next)
        return next
      })
    } catch (err) {
      setTasks(prev => {
        const next = prev.map(t =>
          t.id === id
            ? { ...t, status: 'error' as const, lastRun: Date.now(), lastResult: String(err) }
            : t
        )
        saveTasks(next)
        return next
      })
    }
  }, [])

  // onStart auto-run
  useEffect(() => {
    if (onStartRanRef.current) return
    onStartRanRef.current = true
    const toRun = tasks.filter(t => t.enabled && t.schedule === 'onStart')
    toRun.forEach(t => runTask(t.id))
  }, []) // intentionally empty — run once on mount

  // hourly/daily scheduler (checks every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setTasks(prev => {
        let changed = false
        const toRun: string[] = []
        const next = prev.map(t => {
          if (!t.enabled || t.status === 'running') return t
          if (t.schedule === 'hourly') {
            const elapsed = now - (t.lastRun ?? 0)
            if (elapsed >= 60 * 60 * 1000) {
              toRun.push(t.id)
              changed = true
            }
          } else if (t.schedule === 'daily') {
            const elapsed = now - (t.lastRun ?? 0)
            if (elapsed >= 24 * 60 * 60 * 1000) {
              toRun.push(t.id)
              changed = true
            }
          }
          return t
        })
        if (changed) toRun.forEach(id => runTask(id))
        return changed ? next : prev
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [runTask])

  const addTask = () => {
    if (!formName.trim() || !formPrompt.trim()) return
    const task: AgentTask = {
      id: Date.now().toString(),
      name: formName.trim(),
      prompt: formPrompt.trim(),
      schedule: formSchedule,
      status: 'idle',
      enabled: true,
    }
    updateTasks([task, ...tasks])
    setFormName('')
    setFormPrompt('')
    setFormSchedule('manual')
    setShowForm(false)
  }

  const toggleEnabled = (id: string) => {
    updateTasks(tasks.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t))
  }

  const deleteTask = (id: string) => {
    updateTasks(tasks.filter(t => t.id !== id))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'inherit',
    fontSize: 12,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>에이전트 태스크</span>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            padding: '3px 8px',
            background: showForm ? 'var(--bg-secondary)' : 'var(--accent)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: showForm ? 'var(--text-muted)' : '#fff',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {showForm ? '취소' : '+ 새 태스크'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: 8, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="태스크 이름"
            style={inputStyle}
          />
          <textarea
            value={formPrompt}
            onChange={e => setFormPrompt(e.target.value)}
            placeholder="실행할 프롬프트"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <select
            value={formSchedule}
            onChange={e => setFormSchedule(e.target.value as AgentTask['schedule'])}
            style={{ ...inputStyle }}
          >
            <option value="manual">수동 실행</option>
            <option value="onStart">앱 시작 시</option>
            <option value="hourly">매시간</option>
            <option value="daily">매일</option>
          </select>
          <button
            onClick={addTask}
            style={{ padding: '4px 0', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, cursor: 'pointer' }}
          >
            저장
          </button>
        </div>
      )}

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 32, fontSize: 12 }}>
            태스크가 없습니다
          </div>
        )}
        {tasks.map(task => (
          <div
            key={task.id}
            style={{
              borderBottom: '1px solid var(--border)',
              padding: '8px 4px',
              opacity: task.enabled ? 1 : 0.5,
            }}
          >
            {/* Row 1: name + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{ fontSize: 13, color: STATUS_COLOR[task.status], flexShrink: 0, width: 14, textAlign: 'center' }}
                title={task.status}
              >
                {STATUS_ICON[task.status]}
              </span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.name}
              </span>
              <button
                onClick={() => runTask(task.id)}
                disabled={task.status === 'running'}
                title="실행"
                style={{ background: 'none', border: 'none', cursor: task.status === 'running' ? 'default' : 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 2px', flexShrink: 0 }}
              >
                ▶
              </button>
              <button
                onClick={() => toggleEnabled(task.id)}
                title={task.enabled ? '비활성화' : '활성화'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: task.enabled ? 'var(--accent)' : 'var(--text-muted)', fontSize: 13, padding: '0 2px', flexShrink: 0 }}
              >
                {task.enabled ? '●' : '○'}
              </button>
              <button
                onClick={() => deleteTask(task.id)}
                title="삭제"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 2px', flexShrink: 0 }}
              >
                ×
              </button>
            </div>

            {/* Row 2: prompt preview */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, paddingLeft: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{task.prompt.slice(0, 60)}{task.prompt.length > 60 ? '…' : ''}"
            </div>

            {/* Row 3: meta */}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, paddingLeft: 18 }}>
              마지막: {relativeTime(task.lastRun)} / {SCHEDULE_LABELS[task.schedule]}
            </div>

            {/* Row 4: result preview */}
            {task.lastResult && (
              <div
                style={{
                  fontSize: 11,
                  color: task.status === 'error' ? STATUS_COLOR.error : 'var(--text-secondary, var(--text-muted))',
                  marginTop: 4,
                  paddingLeft: 18,
                  wordBreak: 'break-word',
                }}
              >
                {task.lastResult.slice(0, 100)}{task.lastResult.length > 100 ? '…' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
