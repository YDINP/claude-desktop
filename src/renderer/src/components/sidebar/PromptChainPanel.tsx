import { useState, useEffect, useCallback } from 'react'

const PRESET_TEMPLATES = [
  {
    id: 'code-review',
    name: '코드 리뷰',
    desc: '코드 분석 → 버그 탐지 → 개선안',
    steps: [
      { label: '코드 분석', prompt: '다음 코드를 분석해줘:\n\n{{코드를 여기에 붙여넣기}}' },
      { label: '버그 탐지', prompt: '위 분석({{step1}})을 바탕으로 버그와 잠재적 문제를 나열해줘.' },
      { label: '개선안 작성', prompt: '{{step2}}를 참고해 문제를 해결하는 개선된 코드를 작성해줘.' },
    ],
  },
  {
    id: 'debug-flow',
    name: '디버깅 플로우',
    desc: '에러 분석 → 원인 파악 → 수정 코드',
    steps: [
      { label: '에러 분석', prompt: '다음 에러를 분석해줘:\n\n{{에러 메시지를 여기에 붙여넣기}}' },
      { label: '원인 파악', prompt: '{{step1}}를 바탕으로 이 에러의 근본 원인은 무엇인가?' },
      { label: '수정 코드', prompt: '{{step2}}를 참고해 이 문제를 수정하는 코드를 제공해줘.' },
    ],
  },
  {
    id: 'content-draft',
    name: '콘텐츠 작성',
    desc: '아이디어 → 개요 → 초안',
    steps: [
      { label: '아이디어', prompt: '{{주제}}에 대한 글 아이디어 5개를 제안해줘.' },
      { label: '개요 작성', prompt: '{{step1}}에서 가장 좋은 아이디어로 상세 개요를 만들어줘.' },
      { label: '초안 작성', prompt: '{{step2}} 개요를 바탕으로 1000자 분량의 초안을 작성해줘.' },
    ],
  },
  {
    id: 'translation-polish',
    name: '번역 + 다듬기',
    desc: '초벌 번역 → 자연스럽게 → 최종 검토',
    steps: [
      { label: '초벌 번역', prompt: '다음 텍스트를 한국어로 번역해줘:\n\n{{원문}}' },
      { label: '자연스럽게', prompt: '{{step1}} 위 번역을 더 자연스러운 한국어로 다듬어줘.' },
      { label: '최종 검토', prompt: '{{step2}} 번역의 정확성과 자연스러움을 검토하고 최종본을 제공해줘.' },
    ],
  },
  {
    id: 'feature-spec',
    name: '기능 명세 작성',
    desc: '요구사항 분석 → 기술 설계 → 태스크 분해',
    steps: [
      { label: '요구사항 분석', prompt: '다음 기능 아이디어를 분석하고 요구사항을 정리해줘:\n\n{{기능 아이디어}}' },
      { label: '기술 설계', prompt: '{{step1}} 요구사항을 구현하기 위한 기술 설계를 작성해줘.' },
      { label: '태스크 분해', prompt: '{{step2}} 설계를 개발 태스크 목록으로 분해해줘.' },
    ],
  },
] as const

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
  const [showTemplates, setShowTemplates] = useState(false)

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

  const importTemplate = (t: typeof PRESET_TEMPLATES[number]) => {
    const chain: PromptChain = {
      id: `chain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: t.name,
      steps: t.steps.map(s => ({
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        prompt: s.prompt,
        label: s.label,
        status: 'idle' as const,
      })),
    }
    const next = [...chains, chain]
    persist(next)
    setSelectedId(chain.id)
    setShowTemplates(false)
  }

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

  const duplicateChain = (id: string) => {
    const chain = chains.find(c => c.id === id)
    if (!chain) return
    const ts = Date.now()
    const copy: PromptChain = {
      id: `chain-${ts}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${chain.name} (복사)`,
      steps: chain.steps.map(s => ({
        ...s,
        id: `step-${ts}-${Math.random().toString(36).slice(2, 6)}`,
        status: 'idle' as const,
        result: undefined,
        elapsed: undefined,
      })),
    }
    const next = [...chains, copy]
    persist(next)
    setSelectedId(copy.id)
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>프롬프트 체이닝</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowTemplates(true)}
            style={{ ...btnBase, padding: '3px 8px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            title="템플릿 라이브러리"
          >
            📚
          </button>
          <button
            onClick={addChain}
            style={{ ...btnBase, padding: '3px 8px', background: 'var(--accent)', color: '#fff' }}
          >
            + 새 체인
          </button>
        </div>
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
                onClick={() => duplicateChain(c.id)}
                style={{
                  ...btnBase, padding: '2px 4px', fontSize: 10,
                  background: 'transparent', color: 'var(--text-muted)',
                }}
                title="체인 복제"
              >
                📋
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
              }}>
                {selectedChain.name}
              </span>
              {selectedChain.lastRun && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  마지막 실행: {relativeTime(selectedChain.lastRun)} · {selectedChain.steps.length}단계
                </span>
              )}
            </div>
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

      {showTemplates && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'var(--bg-primary)', overflowY: 'auto', padding: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>📚 템플릿 라이브러리</span>
            <button
              onClick={() => setShowTemplates(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
            >×</button>
          </div>
          {PRESET_TEMPLATES.map(t => (
            <div key={t.id} style={{
              border: '1px solid var(--border)', borderRadius: 6, padding: 10,
              marginBottom: 8, background: 'var(--bg-secondary)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t.desc}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                {t.steps.map((s, i) => (
                  <span key={i}>{i > 0 ? ' → ' : ''}{s.label}</span>
                ))}
              </div>
              <button
                onClick={() => importTemplate(t)}
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                }}
              >가져오기</button>
            </div>
          ))}
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
  const [resultCopied, setResultCopied] = useState(false)

  const copyResult = () => {
    if (!step.result) return
    navigator.clipboard.writeText(step.result).then(() => {
      setResultCopied(true)
      setTimeout(() => setResultCopied(false), 1500)
    })
  }

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
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>결과</span>
            <button onClick={copyResult} title="결과 복사"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: resultCopied ? '#4ade80' : 'var(--text-muted)', padding: '0 2px' }}>
              {resultCopied ? '✓' : '📋'}
            </button>
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
