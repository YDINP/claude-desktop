import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatTime,
  formatRelativeTime,
  formatCharCount,
  groupSessionsByDate,
  groupSessions,
} from '../sessionUtils'
import type { SessionMeta } from '../sessionUtils'

// -----------------------------------------------------------------------
// 헬퍼
// -----------------------------------------------------------------------

function makeSession(override: Partial<SessionMeta> & { id: string }): SessionMeta {
  return {
    title: 'Test Session',
    cwd: '/tmp',
    model: 'claude-3',
    updatedAt: Date.now(),
    createdAt: Date.now(),
    messageCount: 0,
    ...override,
  }
}

// -----------------------------------------------------------------------
// formatTime
// -----------------------------------------------------------------------

describe('formatTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('30초 전 → "just now"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatTime(now - 30_000)).toBe('just now')
  })

  it('5분 전 → "5m ago"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatTime(now - 5 * 60_000)).toBe('5m ago')
  })

  it('2시간 전 → "2h ago"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatTime(now - 2 * 3600_000)).toBe('2h ago')
  })

  it('3일 전 → "3d ago"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatTime(now - 3 * 86400_000)).toBe('3d ago')
  })

  it('8일 전 → toLocaleDateString 형식', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const ts = now - 8 * 86400_000
    const result = formatTime(ts)
    expect(result).toBe(new Date(ts).toLocaleDateString())
  })
})

// -----------------------------------------------------------------------
// formatRelativeTime
// -----------------------------------------------------------------------

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('null → 빈 문자열', () => {
    expect(formatRelativeTime(null)).toBe('')
  })

  it('undefined → 빈 문자열', () => {
    expect(formatRelativeTime(undefined)).toBe('')
  })

  it('30초 전 → "방금"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatRelativeTime(new Date(now - 30_000).toISOString())).toBe('방금')
  })

  it('10분 전 → "10분 전"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatRelativeTime(new Date(now - 10 * 60_000).toISOString())).toBe('10분 전')
  })

  it('3시간 전 → "3시간 전"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatRelativeTime(new Date(now - 3 * 3600_000).toISOString())).toBe('3시간 전')
  })

  it('1일 전 → "어제"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatRelativeTime(new Date(now - 25 * 3600_000).toISOString())).toBe('어제')
  })

  it('4일 전 → "4일 전"', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(formatRelativeTime(new Date(now - 4 * 86400_000).toISOString())).toBe('4일 전')
  })

  it('8일 전 → 날짜 문자열 (toLocaleDateString)', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const ts = now - 8 * 86400_000
    const result = formatRelativeTime(new Date(ts).toISOString())
    expect(result).toBe(new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }))
  })
})

// -----------------------------------------------------------------------
// formatCharCount
// -----------------------------------------------------------------------

describe('formatCharCount', () => {
  it('999 → "999"', () => {
    expect(formatCharCount(999)).toBe('999')
  })

  it('1000 → "1.0K"', () => {
    expect(formatCharCount(1000)).toBe('1.0K')
  })

  it('1500 → "1.5K"', () => {
    expect(formatCharCount(1500)).toBe('1.5K')
  })

  it('10000 → "1.0만"', () => {
    expect(formatCharCount(10000)).toBe('1.0만')
  })

  it('25000 → "2.5만"', () => {
    expect(formatCharCount(25000)).toBe('2.5만')
  })

  it('0 → "0"', () => {
    expect(formatCharCount(0)).toBe('0')
  })
})

// -----------------------------------------------------------------------
// groupSessionsByDate
// -----------------------------------------------------------------------

describe('groupSessionsByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 고정된 현재 시각: 2024-06-15 12:00:00
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('빈 배열 → 빈 그룹 반환', () => {
    expect(groupSessionsByDate([])).toHaveLength(0)
  })

  it('오늘 세션 → "오늘" 그룹', () => {
    const s = makeSession({ id: 's1', updatedAt: new Date('2024-06-15T09:00:00').getTime() })
    const groups = groupSessionsByDate([s])
    expect(groups[0].label).toBe('오늘')
    expect(groups[0].sessions).toHaveLength(1)
  })

  it('어제 세션 → "어제" 그룹', () => {
    const s = makeSession({ id: 's2', updatedAt: new Date('2024-06-14T10:00:00').getTime() })
    const groups = groupSessionsByDate([s])
    expect(groups[0].label).toBe('어제')
  })

  it('3일 전 세션 → "이번 주" 그룹', () => {
    const s = makeSession({ id: 's3', updatedAt: new Date('2024-06-12T10:00:00').getTime() })
    const groups = groupSessionsByDate([s])
    expect(groups[0].label).toBe('이번 주')
  })

  it('같은 달 과거 세션 → "지난 달" 그룹', () => {
    const s = makeSession({ id: 's4', updatedAt: new Date('2024-06-01T10:00:00').getTime() })
    const groups = groupSessionsByDate([s])
    expect(groups[0].label).toBe('지난 달')
  })

  it('오래된 세션 → "이전" 그룹', () => {
    const s = makeSession({ id: 's5', updatedAt: new Date('2023-01-01T10:00:00').getTime() })
    const groups = groupSessionsByDate([s])
    expect(groups[0].label).toBe('이전')
  })

  it('세션 없는 그룹은 필터링된다', () => {
    const s = makeSession({ id: 's6', updatedAt: new Date('2024-06-15T08:00:00').getTime() })
    const groups = groupSessionsByDate([s])
    const labels = groups.map(g => g.label)
    expect(labels).not.toContain('어제')
    expect(labels).not.toContain('이번 주')
  })
})

// -----------------------------------------------------------------------
// groupSessions (영문 레이블)
// -----------------------------------------------------------------------

describe('groupSessions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('오늘 세션 → "Today" 그룹', () => {
    const s = makeSession({ id: 'g1', updatedAt: new Date('2024-06-15T08:00:00').getTime() })
    const groups = groupSessions([s])
    expect(groups[0].label).toBe('Today')
  })

  it('어제 세션 → "Yesterday" 그룹', () => {
    const s = makeSession({ id: 'g2', updatedAt: new Date('2024-06-14T08:00:00').getTime() })
    const groups = groupSessions([s])
    expect(groups[0].label).toBe('Yesterday')
  })

  it('빈 그룹은 반환하지 않는다', () => {
    const groups = groupSessions([])
    expect(groups).toHaveLength(0)
  })
})
