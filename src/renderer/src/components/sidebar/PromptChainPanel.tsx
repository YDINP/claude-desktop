import { useState, useEffect, useCallback } from 'react'

interface ChainStep {
  id: string
  prompt: string
  label?: string
  result?: string
  status: 'idle' | 'running' | 'done' | 'error'
  elapsed?: number
}

interface PromptChain {
  id: string
  name: string
  steps: ChainStep[]
  lastRun?: number
}

const STORAGE_KEY = 'prompt-chains'

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'inherit',
  fontSize: 12,
  boxSizing: 'border-box',
  width: '100%',
}

const btnBase: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
}

const STATUS_COLOR: Record<ChainStep['status'], string> = {
  idle: 'var(--text-muted)',
  running: '#60a5fa',
  done: '#4ade80',
  error: '#f87171',
}

const STATUS_LABEL: Record<ChainStep['status'], string> = {
  idle: '대기',
  running: '실행 중',
  done: '완료',
  error: '오류',
}

function makeChain(name: string): PromptChain {
  return {
    id: `chain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    steps: [makeStep()],
  }
}

function makeStep(): ChainStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    prompt: '',
    status: 'idle',
  }
}

function loadChains(): PromptChain[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PromptChain[]
  } catch {
    return []
  }
}

function saveChains(chains: PromptChain[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chains))
}

export function PromptChainPanel() {
  const [chains, setChains] = useState<PromptChain[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    const loaded = loadChains()
    setChains(loaded)
    if (loaded.length > 0) setSelectedId(loaded[0].id)
  }, [])

  const persist = useCallback((next: PromptChain[]) => {
    setChains(next)
    saveChains(next)
  }, [])

  const selectedChain = chains.find(c => c.id === selectedId) ?? null

  // ── Chain CRUD ──────────────────────────────────────────────────────────
  const addChain = () => {
    const name = prompt('체인 이름:')?.trim()
    if (!name) return
    const chain = makeChain(name)
    const next = [...chains, chain]
    persist(next)
    setSelectedId(chain.id)
  }

  const deleteChain = (id: string) => {
    if (chains.length <= 1) {
      alert('마지막 체인은 삭제할 수 없습니다.')
      return
    }
    const next = chains.filter(c => c.id !== id)
    persist(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  const renameChain = (id: string) => {
    const chain = chains.find(c => c.id === id)
    if (!chain) return
    const name = prompt('새 이름:', chain.name)?.trim()
    if (!name) return
    persist(chains.map(c => c.id === id ? { ...c, name } : c))
  }

  // ── Step helpers ────────────────────────────────────────────────────────
  const updateChain = (chainId: string, updater: (c: PromptChain) => PromptChain) => {
    persist(chains.map(c => c.id === chainId ? updater(c) : c))
  }

  const addStep = (chainId: string) => {
    updateChain(chainId, c => ({ ...c, steps: [...c.steps, makeStep()] }))
  }

  const deleteStep = (chainId: string, stepId: string) => {
    updateChain(chainId, c => ({ ...c, steps: c.steps.filter(s => s.id !== stepId) }))
  }

  const updateStep = (chainId: string, stepId: string, patch: Partial<ChainStep>) => {
    updateChain(chainId, c => ({
      ...c,
      steps: c.steps.map(s => s.id === stepId ? { ...s, ...patch } : s),
    }))
  }

  const moveStep = (chainId: string, stepId: string, dir: -1 | 1) => {
    updateChain(chainId, c => {
      const idx = c.steps.findIndex(s => s.id === stepId)
      if (idx < 0) return c
      const next = [...c.steps]
      const target = idx + dir
      if (target < 0 || target >= next.length) return c
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return { ...c, steps: next }
    })
  }

  const clearResults = (chainId: string) => {
    updateChain(chainId, c => ({
      ...c,
      steps: c.steps.map(s => ({ ...s, status: 'idle' as const, result: undefined, elapsed: undefined })),
    }))
  }

  // ── Execution ───────────────────────────────────────────────────────────
  const runChain = async (chainId: string) => {
    if (isRunning) return
    const chain = chains.find(c => c.id === chainId)
    if (!chain) return

    setIsRunning(true)
    const context: Record<string, string> = {}

    // reset all steps to idle first
    persist(chains.map(c => c.id === chainId
      ? { ...c, steps: c.steps.map(s => ({ ...s, status: 'idle' as const, result: undefined, elapsed: undefined })), lastRun: Date.now() }
      : c
    ))

    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i]
      const stepKey = `step${i + 1}`

      let resolvedPrompt = step.prompt
      Object.entries(context).forEach(([k, v]) => {
        resolvedPrompt = resolvedPrompt.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
      })

      // mark running (need to update chains ref via functional update)
      setChains(prev => {
        const next = prev.map(c => c.id === chainId
          ? { ...c, steps: c.steps.map(s => s.id === step.id ? { ...s, status: 'running' as const } : s) }
          : c
        )
        saveChains(next)
        return next
      })

      const startTs = Date.now()
      try {
        const res = await (window.api as unknown as {
          summarizeSession: (opts: { messages: Array<{ role: string; content: string }> }) => Promise<{ summary?: string; error?: string }>
        }).summarizeSession({ messages: [{ role: 'user', content: resolvedPrompt }] })

        const output = res.error ?? res.summary ?? ''
        context[stepKey] = output

        setChains(prev => {
          const next = prev.map(c => c.id === chainId
            ? {
                ...c,
                steps: c.steps.map(s => s.id === step.id ? {
                  ...s,
                  status: (res.error ? 'error' : 'done') as ChainStep['status'],
                  result: output,
                  elapsed: Date.now() - startTs,
                } : s),
              }
            : c
          )
          saveChains(next)
          return next
        })

        if (res.error) break
      } catch (err) {
        setChains(prev => {
          const next = prev.map(c => c.id === chainId
            ? {
                ...c,
                steps: c.steps.map(s => s.id === step.id ? {
                  ...s,
                  status: 'error' as const,
                  result: String(err),
                  elapsed: Date.now() - startTs,
                } : s),
              }
            : c
          )
          saveChains(next)
          return next
        })
        break
      }
    }

    setIsRunning(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>프롬프트 체이닝</span>
        <button
          onClick={addChain}
          style={{ ...btnBase, padding: '3px 8px', background: 'var(--accent)', color: '#fff' }}
        >
          + 새 체인
        </button>
      </div>

      {/* Chain selector tabs */}
      {chains.length > 0 && (
        <div style={{
          display: 'flex', gap: 4, padding: '4px 8px', overflowX: 'auto', flexShrink: 0,
          borderBottom: '1px solid var(--border)', scrollbarWidth: 'none',
        }}>
          {chains.map(c => (
            <div
              key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
            >
              <button
                onClick={() => setSelectedId(c.id)}
                style={{
                  ...btnBase,
                  padding: '2px 8px', fontSize: 11,
                  background: selectedId === c.id ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: selectedId === c.id ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                title={c.name}
                onDoubleClick={() => renameChain(c.id)}
              >
                {c.name}
              </button>
              <button
                onClick={() => deleteChain(c.id)}
                style={{
                  ...btnBase, padding: '2px 4px', fontSize: 10,
                  background: 'transparent', color: 'var(--text-muted)',
                }}
                title="체인 삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chain body */}
      {selectedChain ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chain toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            gap: 4,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {selectedChain.name}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => clearResults(selectedChain.id)}
                style={{
                  ...btnBase, padding: '3px 7px', fontSize: 10,
                  background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                title="결과 초기화"
              >
                초기화
              </button>
              <button
                onClick={() => runChain(selectedChain.id)}
                disabled={isRunning || selectedChain.steps.length === 0}
                style={{
                  ...btnBase, padding: '3px 10px',
                  background: isRunning ? 'var(--bg-secondary)' : 'var(--accent)',
                  color: isRunning ? 'var(--text-muted)' : '#fff',
                  border: '1px solid var(--border)',
                  opacity: (isRunning || selectedChain.steps.length === 0) ? 0.6 : 1,
                }}
              >
                {isRunning ? '실행 중...' : '▶ 실행'}
              </button>
            </div>
          </div>

          {/* Steps */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedChain.steps.map((step, idx) => (
              <StepCard
                key={step.id}
                step={step}
                index={idx}
                total={selectedChain.steps.length}
                chainId={selectedChain.id}
                onUpdate={(patch) => updateStep(selectedChain.id, step.id, patch)}
                onDelete={() => deleteStep(selectedChain.id, step.id)}
                onMoveUp={() => moveStep(selectedChain.id, step.id, -1)}
                onMoveDown={() => moveStep(selectedChain.id, step.id, 1)}
              />
            ))}

            <button
              onClick={() => addStep(selectedChain.id)}
              style={{
                ...btnBase, padding: '6px', width: '100%',
                background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                border: '1px dashed var(--border)', fontSize: 12,
              }}
            >
              + 스텝 추가
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            + 새 체인 버튼으로 체인을 만드세요
          </span>
        </div>
      )}
    </div>
  )
}

// ── StepCard sub-component ─────────────────────────────────────────────────

interface StepCardProps {
  step: ChainStep
  index: number
  total: number
  chainId: string
  onUpdate: (patch: Partial<ChainStep>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function StepCard({ step, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }: StepCardProps) {
  const statusColor = STATUS_COLOR[step.status]

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 6,
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
    }}>
      {/* Step header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 6px', borderBottom: '1px solid var(--border)',
      }}>
        {/* Step number badge */}
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#fff',
          background: statusColor, borderRadius: 3,
          padding: '1px 5px', flexShrink: 0, transition: 'background 0.3s',
        }}>
          {index + 1}
        </span>

        {/* Label input */}
        <input
          value={step.label ?? ''}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder={`Step ${index + 1}`}
          style={{
            flex: 1, padding: '2px 6px',
            background: 'transparent', border: '1px solid transparent',
            borderRadius: 3, color: 'var(--text-primary)', fontSize: 11,
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.border = '1px solid var(--border)' }}
          onBlur={e => { e.currentTarget.style.border = '1px solid transparent' }}
        />

        {/* Status indicator */}
        <span style={{ fontSize: 10, color: statusColor, flexShrink: 0 }}>
          {STATUS_LABEL[step.status]}
          {step.elapsed !== undefined && step.status !== 'idle' && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 3 }}>
              {(step.elapsed / 1000).toFixed(1)}s
            </span>
          )}
        </span>

        {/* Move buttons */}
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          style={{
            ...btnBase, padding: '1px 4px', fontSize: 10,
            background: 'transparent', color: 'var(--text-muted)',
            opacity: index === 0 ? 0.3 : 1,
          }}
          title="위로"
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          style={{
            ...btnBase, padding: '1px 4px', fontSize: 10,
            background: 'transparent', color: 'var(--text-muted)',
            opacity: index === total - 1 ? 0.3 : 1,
          }}
          title="아래로"
        >
          ↓
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          style={{
            ...btnBase, padding: '1px 4px', fontSize: 11,
            background: 'transparent', color: '#f87171',
          }}
          title="스텝 삭제"
        >
          ×
        </button>
      </div>

      {/* Prompt textarea */}
      <div style={{ padding: '6px' }}>
        <textarea
          value={step.prompt}
          onChange={e => onUpdate({ prompt: e.target.value })}
          placeholder={index > 0
            ? `프롬프트 입력... (예: {{step${index}}} 결과를 분석해줘)`
            : '프롬프트 입력...'}
          rows={3}
          style={{
            ...inputStyle,
            resize: 'vertical',
            fontFamily: 'monospace',
            fontSize: 11,
            outline: 'none',
          }}
        />

        {/* Placeholder hint */}
        {index > 0 && (
          <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Array.from({ length: index }, (_, i) => (
              <button
                key={i}
                onClick={() => onUpdate({ prompt: step.prompt + `{{step${i + 1}}}` })}
                style={{
                  ...btnBase, padding: '1px 5px', fontSize: 10,
                  background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                title={`step${i + 1} 결과 삽입`}
              >
                {'{{'}step{i + 1}{'}}'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result */}
      {(step.status === 'done' || step.status === 'error') && step.result !== undefined && (
        <div style={{
          padding: '4px 6px 6px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
            결과
          </div>
          <div style={{
            fontSize: 11,
            color: step.status === 'error' ? '#f87171' : 'var(--text-primary)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 6px',
            maxHeight: 80,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
          }}>
            {step.result.length > 300 ? step.result.slice(0, 300) + '…' : step.result}
          </div>
        </div>
      )}

      {/* Running indicator */}
      {step.status === 'running' && (
        <div style={{
          padding: '4px 8px', borderTop: '1px solid var(--border)',
          fontSize: 10, color: '#60a5fa', fontStyle: 'italic',
        }}>
          처리 중...
        </div>
      )}
    </div>
  )
}
