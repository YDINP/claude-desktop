import React, { useState, useEffect, memo } from 'react'
import type { ChatMessage } from '../../domains/chat/domain'

export const CONTEXT_WINDOW = 200000
export const foldThreshold = 20

export type MsgPosition = 'solo' | 'first' | 'middle' | 'last'

export function getMsgPosition(messages: ChatMessage[], index: number): MsgPosition {
  const msg = messages[index]
  const prev = messages[index - 1]
  const next = messages[index + 1]

  const sameRoleAsPrev = prev && prev.role === msg.role &&
    Math.abs((msg.timestamp ?? 0) - (prev.timestamp ?? 0)) < 2 * 60 * 1000
  const sameRoleAsNext = next && next.role === msg.role &&
    Math.abs((next.timestamp ?? 0) - (msg.timestamp ?? 0)) < 2 * 60 * 1000

  if (!sameRoleAsPrev && !sameRoleAsNext) return 'solo'
  if (!sameRoleAsPrev && sameRoleAsNext) return 'first'
  if (sameRoleAsPrev && sameRoleAsNext) return 'middle'
  return 'last'
}

export const ACTION_PROMPTS = {
  explain: (lang: string, code: string) => `다음 ${lang} 코드를 단계별로 설명해줘:\n\`\`\`${lang}\n${code}\n\`\`\``,
  optimize: (lang: string, code: string) => `다음 ${lang} 코드의 성능을 최적화해줘. 변경 이유를 설명해줘:\n\`\`\`${lang}\n${code}\n\`\`\``,
  fix: (lang: string, code: string) => `다음 ${lang} 코드의 버그를 찾아 수정해줘:\n\`\`\`${lang}\n${code}\n\`\`\``,
}

export function ContextUsageIndicator({ messages }: { messages: ChatMessage[] }) {
  if (!messages.length) return null
  const totalChars = messages.reduce((sum, m) => sum + m.text.length, 0)
  const estimatedTokens = Math.round(totalChars / 4)
  const ratio = estimatedTokens / CONTEXT_WINDOW
  if (ratio < 0.8) return null
  const nK = Math.round(estimatedTokens / 1000)
  const isError = ratio >= 0.95
  return React.createElement('span', {
    style: {
      fontSize: 11,
      color: isError ? 'var(--error, #f87171)' : 'var(--warning, #fbbf24)',
      fontVariantNumeric: 'tabular-nums',
    },
  }, isError ? '🔴' : '⚠', ` ~${nK}K tokens`)
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const StreamingSpinner = memo(function StreamingSpinner() {
  const [frameIdx, setFrameIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrameIdx(i => (i + 1) % SPINNER_FRAMES.length), 100)
    return () => clearInterval(id)
  }, [])
  return React.createElement('span', {
    style: { fontSize: 13, color: 'var(--warning)', marginLeft: 'auto', fontFamily: 'monospace' },
  }, SPINNER_FRAMES[frameIdx])
})

export function TypingIndicator() {
  return React.createElement('div', { className: 'typing-indicator' },
    React.createElement('span'),
    React.createElement('span'),
    React.createElement('span'),
  )
}

export function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export const formatTimeSep = (ts: number) => {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `오늘 ${timeStr}`
  if (d.toDateString() === yesterday.toDateString()) return `어제 ${timeStr}`
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) + ' ' + timeStr
}

export const MSG_LABEL_KINDS = ['중요', '질문', '답변', '코드', '오류'] as const
export const MSG_LABEL_COLORS: Record<string, string> = {
  '중요': '#f87171', '질문': '#60a5fa', '답변': '#34d399', '코드': '#c084fc', '오류': '#fbbf24',
}
