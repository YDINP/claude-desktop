import { useEffect, useMemo, useRef, useState } from 'react'
import { getTodayCost, getMonthlyCost } from '../../utils/cost-tracker'

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
}

interface StatusBarProps {
  model: string
  totalCost: number
  totalInputTokens?: number
  totalOutputTokens?: number
  inputTokens?: number
  outputTokens?: number
  cwd: string | null
  onShowShortcuts?: () => void
  contextUsage?: number
  messageCount?: number
  chatFontSize?: number
  sessionId?: string
  sessionTitle?: string
  sessionCreatedAt?: number
}

const MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
]

export function StatusBar({ model, totalCost, totalInputTokens = 0, totalOutputTokens = 0, inputTokens, outputTokens, cwd, onShowShortcuts, contextUsage, messageCount, chatFontSize, sessionId, sessionTitle, sessionCreatedAt }: StatusBarProps) {
  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model

  const costUsd = useMemo(() => {
    if (!model || !inputTokens) return null
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-6']
    const inCost = (inputTokens / 1_000_000) * pricing.input
    const outCost = ((outputTokens ?? 0) / 1_000_000) * pricing.output
    return inCost + outCost
  }, [model, inputTokens, outputTokens])
  const [gitInfo, setGitInfo] = useState<{ branch: string | null; changed: number } | null>(null)
  const [memMB, setMemMB] = useState<number | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [showSessionInfo, setShowSessionInfo] = useState(false)
  const [todayCost, setTodayCost] = useState(0)
  const [monthlyCost, setMonthlyCost] = useState(0)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!cwd) { setGitInfo(null); return }
    const fetch = () => window.api?.gitStatus(cwd).then(setGitInfo).catch(() => {})
    fetch()
    const id = setInterval(fetch, 5000)
    return () => clearInterval(id)
  }, [cwd])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!showSessionInfo) return
    setTodayCost(getTodayCost())
    setMonthlyCost(getMonthlyCost())
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSessionInfo(false) }
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowSessionInfo(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [showSessionInfo])

  useEffect(() => {
    window.api.getMemoryUsage?.().then(({ rss }) => setMemMB(Math.round(rss / 1024 / 1024)))
    const unsub = window.api.onMemoryUpdate?.((data) => setMemMB(Math.round(data.rss / 1024 / 1024)))
    return () => unsub?.()
  }, [])

  return (
    <div style={{
      height: 'var(--statusbar-height)',
      background: 'var(--accent)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      gap: 12,
      fontSize: 11,
      color: '#fff',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <span>{modelLabel}</span>
      {cwd && <span style={{ opacity: 0.8 }}>{cwd.split(/[\\/]/).slice(-2).join('/')}</span>}
      {gitInfo?.branch && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ opacity: 0.6 }}>⎇</span>
          <span>{gitInfo.branch}</span>
          {gitInfo.changed > 0 && (
            <span style={{ color: 'var(--warning)', fontSize: 10 }}>+{gitInfo.changed}</span>
          )}
        </span>
      )}
      {contextUsage !== undefined && contextUsage > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <div style={{
            width: 60, height: 4,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(contextUsage * 100, 100)}%`,
              height: '100%',
              background: contextUsage > 0.8 ? '#ff5f5f'
                        : contextUsage > 0.5 ? '#ffb347'
                        : 'rgba(255,255,255,0.9)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 10, opacity: 0.8 }}>
            {messageCount}msg · {Math.round(contextUsage * 100)}%
          </span>
        </div>
      )}
      {costUsd !== null && costUsd > 0 && (
        <span
          onClick={() => setShowSessionInfo(v => !v)}
          style={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}
          title="클릭하여 세션 정보 보기"
        >
          <span>💰</span>
          <span>${costUsd.toPrecision(4)}</span>
        </span>
      )}
      {(totalCost > 0 || totalInputTokens > 0) && (
        <span
          style={{ marginLeft: (contextUsage !== undefined && contextUsage > 0) ? 0 : 'auto', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 8 }}
          title={`입력: ${totalInputTokens.toLocaleString()} / 출력: ${totalOutputTokens.toLocaleString()} 토큰`}
        >
          {totalInputTokens > 0 && (
            <span style={{ opacity: 0.7, fontSize: 10 }}>
              {totalInputTokens > 1000 ? `${(totalInputTokens / 1000).toFixed(1)}k` : totalInputTokens}↑
              {' '}
              {totalOutputTokens > 1000 ? `${(totalOutputTokens / 1000).toFixed(1)}k` : totalOutputTokens}↓
            </span>
          )}
          {totalCost > 0 && <span>${totalCost.toFixed(4)}</span>}
        </span>
      )}
      {chatFontSize !== undefined && chatFontSize !== 13 && (
        <span
          title="채팅 폰트 크기 (Ctrl+0으로 초기화)"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}
        >
          {chatFontSize}px
        </span>
      )}
      {memMB !== null && (
        <span
          style={{
            fontSize: 10,
            color: memMB > 500 ? 'var(--warning)' : 'rgba(255,255,255,0.6)',
            cursor: 'default',
          }}
          title={`메모리 사용량: ${memMB}MB`}
        >
          {memMB}MB
        </span>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          title={online ? '온라인' : '오프라인'}
          style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: online ? '#4caf50' : '#f44336',
            marginRight: 4, flexShrink: 0,
          }}
        />
        {!online && <span style={{ color: '#f44336', fontSize: 11 }}>오프라인</span>}
      </span>
      <button
        onClick={() => setShowSessionInfo(v => !v)}
        title="세션 정보"
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
          fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
        }}
      >ℹ</button>
      {onShowShortcuts && (
        <button
          onClick={onShowShortcuts}
          title="키보드 단축키 (Ctrl+?)"
          style={{
            marginLeft: (totalCost > 0 || (contextUsage !== undefined && contextUsage > 0)) ? 0 : 'auto',
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
            fontSize: 13, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
          }}
        >?</button>
      )}
      {showSessionInfo && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed', bottom: 32, right: 16, zIndex: 9000,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 16, minWidth: 260,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.3)', fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            세션 정보
          </div>
          {sessionTitle && (
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
              {sessionTitle}
            </div>
          )}
          {sessionId && (
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)', fontSize: 10, opacity: 0.7 }}>
              ID: {sessionId}
            </div>
          )}
          {sessionCreatedAt && (
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
              생성: {new Date(sessionCreatedAt).toLocaleString('ko-KR')}
            </div>
          )}
          {messageCount !== undefined && (
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
              메시지 {messageCount}개
            </div>
          )}
          {inputTokens !== undefined && (
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
              입력 {inputTokens?.toLocaleString()} / 출력 {outputTokens?.toLocaleString()} 토큰
            </div>
          )}
          {costUsd !== null && costUsd !== undefined && (
            <div style={{ marginBottom: 4, color: 'var(--accent)' }}>
              예상 비용: ${costUsd.toPrecision(4)}
            </div>
          )}
          {(totalCost > 0) && (
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)', fontSize: 11 }}>
              누적 비용: ${totalCost.toFixed(4)}
            </div>
          )}
          {todayCost > 0 && (
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)', fontSize: 11 }}>
              오늘 사용: ${todayCost.toFixed(4)}
            </div>
          )}
          {monthlyCost > 0 && (
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)', fontSize: 11 }}>
              이번달 합계: ${monthlyCost.toFixed(4)}
            </div>
          )}
          <button
            onClick={() => setShowSessionInfo(false)}
            style={{
              marginTop: 8, width: '100%', padding: '4px',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11,
            }}
          >
            닫기
          </button>
        </div>
      )}
    </div>
  )
}
