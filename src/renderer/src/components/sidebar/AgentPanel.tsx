import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component } from 'react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import type { ReactNode } from 'react'
import { saveRun, loadRuns } from '../../utils/work-history'
import type { WorkRun } from '../../utils/work-history'
import { RunTimeline } from './RunTimeline'

// Lazy load to avoid circular deps
const PromptChainPanel = lazy(() =>
  import('./PromptChainPanel').then(m => ({ default: m.PromptChainPanel }))
)

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentTab = 'tasks' | 'chains' | 'history' | 'timeline'

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

type WorkStep = {
  label: string
  output?: string
  elapsed?: number
  status: 'running' | 'done' | 'error'
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Storage ──────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Error Boundary ───────────────────────────────────────────────────────────

type EBState = { hasError: boolean }
class ChainErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontSize: 12, color: '#f87171', textAlign: 'center' }}>
          체이닝 패널 로딩 실패
        </div>
      )
    }
    return this.props.children
  }
}

// ─── History Entry ────────────────────────────────────────────────────────────

function HistoryEntry({ run }: { run: WorkRun }) {
  const duration = run.endTime ? `${((run.endTime - run.startTime) / 1000).toFixed(1)}s` : '—'
  const date = new Date(run.startTime).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '6px 4px' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span
          style={{
            fontSize: 11,
            color: run.success ? '#4ade80' : '#f87171',
            flexShrink: 0,
          }}
        >
          {run.success ? '✓' : '✗'}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {run.taskName}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          {duration}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 15 }}>{date}</div>
      {run.error && (
        <div style={{ fontSize: 10, color: '#f87171', paddingLeft: 15, marginTop: 2 }}>
          {run.error.slice(0, 80)}
        </div>
      )}
    </div>
  )
}

// ─── Step Timeline ────────────────────────────────────────────────────────────

function StepTimeline({ steps }: { steps: WorkStep[] }) {
  if (steps.length === 0) return null
  return (
    <div
      style={{
        marginTop: 6,
        paddingLeft: 18,
        borderLeft: '2px solid var(--border)',
        marginLeft: 7,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span
            style={{
              fontSize: 10,
              flexShrink: 0,
              marginTop: 1,
              color:
                step.status === 'running'
                  ? '#60a5fa'
                  : step.status === 'done'
                    ? '#4ade80'
                    : '#f87171',
            }}
          >
            {step.status === 'running' ? '⟳' : step.status === 'done' ? '✓' : '✗'}
          </span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary, var(--text-muted))' }}>
              {step.label}
            </span>
            {step.elapsed !== undefined && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                {step.elapsed}ms
              </span>
            )}
            {step.output && (
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  marginTop: 1,
                  wordBreak: 'break-word',
                }}
              >
                {step.output.slice(0, 120)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AgentPanel() {
  const [activeTab, setActiveTab] = useState<AgentTab>('tasks')
  const [tasks, setTasks] = useState<AgentTask[]>(loadTasks)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPrompt, setFormPrompt] = useState('')
  const [formSchedule, setFormSchedule] = useState<AgentTask['schedule']>('manual')
  const [runningSteps, setRunningSteps] = useState<Record<string, WorkStep[]>>({})
  const [runs, setRuns] = useState<WorkRun[]>([])
  const [taskSearch, setTaskSearch] = useState('')
  const { copiedKey: copiedResultId, copy: copyResult } = useCopyToClipboard()
  const onStartRanRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const handler = () => setActiveTab('chains')
    window.addEventListener('open-prompt-chain', handler)
    return () => window.removeEventListener('open-prompt-chain', handler)
  }, [])

  const updateTasks = useCallback((next: AgentTask[]) => {
    setTasks(next)
    saveTasks(next)
  }, [])

  const runTask = useCallback(async (id: string) => {
    const startTs = Date.now()

    setTasks(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, status: 'running' as const } : t))
      saveTasks(next)
      return next
    })

    // Add initial running step
    setRunningSteps(prev => ({
      ...prev,
      [id]: [{ label: '실행 중…', status: 'running' }],
    }))

    const current = loadTasks().find(t => t.id === id)
    if (!current) return

    try {
      const result = await window.api.summarizeSession({
        messages: [{ role: 'user', content: current.prompt }],
      })

      const success = !result.error
      const finalStep: WorkStep = {
        label: success ? '완료' : '오류',
        output: result.error ?? result.summary,
        elapsed: Date.now() - startTs,
        status: success ? 'done' : 'error',
      }

      if (!mountedRef.current) return
      setRunningSteps(prev => ({
        ...prev,
        [id]: [finalStep],
      }))

      setTasks(prev => {
        const next = prev.map(t =>
          t.id === id
            ? {
                ...t,
                status: success ? ('done' as const) : ('error' as const),
                lastRun: Date.now(),
                lastResult: result.error ?? result.summary,
              }
            : t
        )
        saveTasks(next)
        return next
      })

      const run: WorkRun = {
        id: Date.now().toString(),
        taskId: id,
        taskName: current.name,
        startTime: startTs,
        endTime: Date.now(),
        steps: [],
        success,
        error: result.error,
      }
      saveRun(run)
      if (mountedRef.current) setRuns(loadRuns())
    } catch (err) {
      if (!mountedRef.current) return
      const errMsg = String(err)
      setRunningSteps(prev => ({
        ...prev,
        [id]: [{ label: '오류', output: errMsg, elapsed: Date.now() - startTs, status: 'error' }],
      }))

      setTasks(prev => {
        const next = prev.map(t =>
          t.id === id
            ? { ...t, status: 'error' as const, lastRun: Date.now(), lastResult: errMsg }
            : t
        )
        saveTasks(next)
        return next
      })

      saveRun({
        id: Date.now().toString(),
        taskId: id,
        taskName: current.name,
        startTime: startTs,
        endTime: Date.now(),
        steps: [],
        success: false,
        error: errMsg,
      })
      if (mountedRef.current) setRuns(loadRuns())
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
      // Compute which tasks to run outside setTasks updater
      setTasks(prev => {
        let changed = false
        const next = prev.map(t => {
          if (!t.enabled || t.status === 'running') return t
          if (t.schedule === 'hourly') {
            const elapsed = now - (t.lastRun ?? 0)
            if (elapsed >= 60 * 60 * 1000) { changed = true }
          } else if (t.schedule === 'daily') {
            const elapsed = now - (t.lastRun ?? 0)
            if (elapsed >= 24 * 60 * 60 * 1000) { changed = true }
          }
          return t
        })
        return changed ? next : prev
      })
      // Run tasks in a separate step to keep updater pure
      const snapshot = loadTasks()
      snapshot.forEach(t => {
        if (!t.enabled || t.status === 'running') return
        if (t.schedule === 'hourly') {
          const elapsed = now - (t.lastRun ?? 0)
          if (elapsed >= 60 * 60 * 1000) runTask(t.id)
        } else if (t.schedule === 'daily') {
          const elapsed = now - (t.lastRun ?? 0)
          if (elapsed >= 24 * 60 * 60 * 1000) runTask(t.id)
        }
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [runTask])

  // Load history on mount and when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      setRuns(loadRuns())
    }
  }, [activeTab])

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
    updateTasks(tasks.map(t => (t.id === id ? { ...t, enabled: !t.enabled } : t)))
  }

  const deleteTask = (id: string) => {
    updateTasks(tasks.filter(t => t.id !== id))
    setRunningSteps(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const clearHistory = () => {
    try {
      localStorage.removeItem('work-history-runs')
    } catch {
      // ignore
    }
    setRuns([])
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

  const enabledCount = tasks.filter(t => t.enabled).length
  const visibleTasks = taskSearch.trim()
    ? tasks.filter(t => t.name.toLowerCase().includes(taskSearch.toLowerCase()) || t.prompt.toLowerCase().includes(taskSearch.toLowerCase()))
    : tasks

  const tabs: { id: AgentTab; label: string; badge?: number }[] = [
    { id: 'tasks', label: '태스크', badge: tasks.length > 0 ? enabledCount : undefined },
    { id: 'chains', label: '체이닝' },
    { id: 'history', label: '히스토리', badge: runs.length > 0 ? runs.length : undefined },
    { id: 'timeline', label: '런타임' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '6px 0',
              background: activeTab === tab.id ? 'var(--bg-primary, transparent)' : 'transparent',
              border: 'none',
              borderBottom:
                activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 11,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{
                marginLeft: 3, fontSize: 9, padding: '0 4px', borderRadius: 6,
                background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-hover)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                verticalAlign: 'middle',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* ── Tasks tab ── */}
        {activeTab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                에이전트 태스크
              </span>
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
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 8,
                  marginBottom: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
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
                  style={{
                    padding: '4px 0',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  저장
                </button>
              </div>
            )}

            {/* Search */}
            {tasks.length > 0 && (
              <input
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
                placeholder="태스크 검색..."
                style={{ ...inputStyle, marginBottom: 8, fontSize: 11, padding: '3px 7px' }}
              />
            )}

            {/* Task list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tasks.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    marginTop: 32,
                    fontSize: 12,
                  }}
                >
                  태스크가 없습니다
                </div>
              )}
              {taskSearch.trim() && visibleTasks.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 16, fontSize: 11 }}>검색 결과 없음</div>
              )}
              {visibleTasks.map(task => (
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
                      style={{
                        fontSize: 13,
                        color: STATUS_COLOR[task.status],
                        flexShrink: 0,
                        width: 14,
                        textAlign: 'center',
                      }}
                      title={task.status}
                    >
                      {STATUS_ICON[task.status]}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.name}
                    </span>
                    <button
                      onClick={() => runTask(task.id)}
                      disabled={task.status === 'running'}
                      title="실행"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: task.status === 'running' ? 'default' : 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        padding: '0 2px',
                        flexShrink: 0,
                      }}
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => toggleEnabled(task.id)}
                      title={task.enabled ? '비활성화' : '활성화'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: task.enabled ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize: 13,
                        padding: '0 2px',
                        flexShrink: 0,
                      }}
                    >
                      {task.enabled ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      title="삭제"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        padding: '0 2px',
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Row 2: prompt preview */}
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      paddingLeft: 18,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    &ldquo;{task.prompt.slice(0, 60)}
                    {task.prompt.length > 60 ? '…' : ''}&rdquo;
                  </div>

                  {/* Row 3: meta */}
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      paddingLeft: 18,
                    }}
                  >
                    마지막: {relativeTime(task.lastRun)} / {SCHEDULE_LABELS[task.schedule]}
                  </div>

                  {/* Row 4: last result (colored by status) */}
                  {task.lastResult && task.status !== 'running' && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 4, paddingLeft: 18 }}>
                      <div
                        style={{
                          flex: 1,
                          fontSize: 11,
                          color: task.status === 'error' ? STATUS_COLOR.error : 'var(--text-secondary, var(--text-muted))',
                          wordBreak: 'break-word',
                        }}
                      >
                        {task.lastResult.slice(0, 100)}
                        {task.lastResult.length > 100 ? '…' : ''}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); copyResult(task.lastResult!, task.id) }}
                        title="결과 전체 복사"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: copiedResultId === task.id ? '#4ade80' : 'var(--text-muted)', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                      >{copiedResultId === task.id ? '✓' : '📋'}</button>
                    </div>
                  )}

                  {/* Row 5: step timeline (live while running, last step after done) */}
                  {runningSteps[task.id] && runningSteps[task.id].length > 0 && (
                    <StepTimeline steps={runningSteps[task.id]} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Chains tab ── */}
        {activeTab === 'chains' && (
          <ChainErrorBoundary>
            <Suspense
              fallback={
                <div
                  style={{
                    padding: 16,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  로딩 중…
                </div>
              }
            >
              <PromptChainPanel />
            </Suspense>
          </ChainErrorBoundary>
        )}

        {/* ── History tab ── */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                실행 히스토리
              </span>
              {runs.length > 0 && (
                <button
                  onClick={clearHistory}
                  style={{
                    padding: '2px 6px',
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-muted)',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  전체 삭제
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {runs.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    marginTop: 32,
                    fontSize: 12,
                  }}
                >
                  실행 기록이 없습니다
                </div>
              ) : (
                [...runs].reverse().map(run => <HistoryEntry key={run.id} run={run} />)
              )}
            </div>
          </div>
        )}

        {/* ── Timeline tab ── */}
        {activeTab === 'timeline' && <RunTimeline />}
      </div>
    </div>
  )
}
