export interface SessionMeta {
  id: string
  title: string
  cwd: string
  model: string
  updatedAt: number
  createdAt: number
  messageCount: number
  pinned?: boolean
  tags?: string[]
  locked?: boolean
  collection?: string
  forkedFrom?: string
}

export const TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const
export type TagColor = typeof TAG_COLORS[number]

export const TAG_CSS: Record<TagColor, string> = {
  red:    '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green:  '#22c55e',
  blue:   '#3b82f6',
  purple: '#a855f7',
}

export type ViewMode = 'list' | 'timeline'

export interface SessionStats {
  totalMessages?: number
  userMessages?: number
  assistantMessages?: number
  estimatedTokens?: number
  createdAt?: string | null
  updatedAt?: string | null
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export function formatHHMM(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function groupSessionsByDate(sessions: SessionMeta[]): Array<{ label: string; dateStr: string; sessions: SessionMeta[] }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const todayStr = toDateStr(today)
  const groups: Array<{ label: string; dateStr: string; sessions: SessionMeta[] }> = [
    { label: '오늘', dateStr: todayStr, sessions: [] },
    { label: '어제', dateStr: toDateStr(yesterday), sessions: [] },
    { label: '이번 주', dateStr: '', sessions: [] },
    { label: '지난 달', dateStr: '', sessions: [] },
    { label: '이전', dateStr: '', sessions: [] },
  ]

  for (const s of sessions) {
    const ts = s.updatedAt ?? s.createdAt ?? 0
    const t = new Date(ts)
    t.setHours(0, 0, 0, 0)
    if (t.getTime() >= today.getTime()) groups[0].sessions.push(s)
    else if (t.getTime() >= yesterday.getTime()) groups[1].sessions.push(s)
    else if (t.getTime() > weekAgo.getTime()) groups[2].sessions.push(s)
    else if (t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth()) groups[3].sessions.push(s)
    else groups[4].sessions.push(s)
  }

  return groups.filter(g => g.sessions.length > 0)
}

export function groupSessions(sessions: SessionMeta[]): Array<{ label: string; items: SessionMeta[] }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const weekAgo = today - 7 * 86400000
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const groups: { label: string; items: SessionMeta[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: '이번 주', items: [] },
    { label: '이번 달', items: [] },
    { label: '이전', items: [] },
  ]

  for (const s of sessions) {
    const ts = s.updatedAt ?? s.createdAt ?? 0
    if (ts >= today) groups[0].items.push(s)
    else if (ts >= yesterday) groups[1].items.push(s)
    else if (ts >= weekAgo) groups[2].items.push(s)
    else if (ts >= monthStart) groups[3].items.push(s)
    else groups[4].items.push(s)
  }

  return groups.filter(g => g.items.length > 0)
}

export function formatRelativeTime(ts: string | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return '방금'
  if (diffMins < 60) return `${diffMins}분 전`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}시간 전`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function formatCharCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}
