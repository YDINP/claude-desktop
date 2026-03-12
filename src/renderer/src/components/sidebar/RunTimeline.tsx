import { useState, useEffect } from 'react'
import { aguiSubscribe } from '../../utils/agui-store'
import type { AguiRun } from '../../utils/agui-store'

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function RunCard({ run }: { run: AguiRun }) {
  const now = Date.now()
  const elapsed = run.finishedAt ? run.finishedAt - run.startedAt : now - run.startedAt
  const isActive = !run.finishedAt
  const [expanded, setExpanded] = useState(isActive || run.steps.length <= 3)

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 6,
      marginBottom: 8,
      fontSize: 12,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => run.steps.length > 0 && setExpanded(v => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', color: 'var(--text-muted)', cursor: run.steps.length > 0 ? 'pointer' : 'default' }}
      >
        <span style={{ fontFamily: 'monospace' }}>
          {isActive ? '⟳ ' : ''}run/{run.id.slice(0, 8)}
          {run.steps.length > 0 && (
            <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.6 }}>{expanded ? '▾' : `▸${run.steps.length}`}</span>
          )}
        </span>
        <span>
          {fmtMs(elapsed)}
          {run.costUsd ? ` · $${run.costUsd.toFixed(4)}` : ''}
        </span>
      </div>
      {expanded && (
        <div style={{ padding: '0 10px 8px' }}>
          {run.steps.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>도구 호출 없음</div>
          ) : run.steps.map(step => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <span style={{ color: step.status === 'done' ? '#4ade80' : step.status === 'error' ? '#f87171' : '#60a5fa', fontSize: 11 }}>
                {step.status === 'running' ? '⟳' : step.status === 'done' ? '✓' : '✗'}
              </span>
              <span style={{ flex: 1, color: step.status === 'error' ? '#f87171' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {step.name}
              </span>
              {step.finishedAt && (
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{fmtMs(step.finishedAt - step.startedAt)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RunTimeline() {
  const [runs, setRuns] = useState<AguiRun[]>([])
  const [clearedAt, setClearedAt] = useState(0)

  useEffect(() => {
    return aguiSubscribe(setRuns)
  }, [])

  const allRuns = [...runs].reverse()
  const displayRuns = allRuns.filter(r => !r.finishedAt || r.finishedAt > clearedAt)
  const finishedRuns = displayRuns.filter(r => r.finishedAt)
  const totalCostUsd = finishedRuns.reduce((s, r) => s + (r.costUsd ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      {displayRuns.length > 0 && (
        <div style={{ padding: '4px 10px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span>런 {displayRuns.length}건 · 완료 {finishedRuns.length}건</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {totalCostUsd > 0 && <span style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>총 ${totalCostUsd.toFixed(4)}</span>}
            {finishedRuns.length > 0 && (
              <button
                onClick={() => setClearedAt(Date.now())}
                title="완료된 런 지우기"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: 0 }}
              >🗑</button>
            )}
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {displayRuns.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
            아직 실행된 런이 없습니다
          </div>
        ) : displayRuns.map(run => <RunCard key={run.id} run={run} />)}
      </div>
    </div>
  )
}
