import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ChatMessage } from '../../../domains/chat/domain'
import {
  getMsgPosition,
  formatElapsed,
  formatTimeSep,
  ACTION_PROMPTS,
  CONTEXT_WINDOW,
  foldThreshold,
} from '../chatUtils'

// -----------------------------------------------------------------------
// 헬퍼
// -----------------------------------------------------------------------

let msgId = 0
function makeMsg(role: 'user' | 'assistant', timestamp: number, extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id: `m${++msgId}`,
    role,
    text: 'hello',
    toolUses: [],
    timestamp,
    ...extra,
  }
}

// -----------------------------------------------------------------------
// 상수
// -----------------------------------------------------------------------

describe('constants', () => {
  it('CONTEXT_WINDOW = 200000', () => {
    expect(CONTEXT_WINDOW).toBe(200_000)
  })

  it('foldThreshold = 20', () => {
    expect(foldThreshold).toBe(20)
  })
})

// -----------------------------------------------------------------------
// getMsgPosition
// -----------------------------------------------------------------------

describe('getMsgPosition', () => {
  const BASE = 1_000_000

  it('메시지 1개 → solo', () => {
    const msgs = [makeMsg('user', BASE)]
    expect(getMsgPosition(msgs, 0)).toBe('solo')
  })

  it('연속 같은 역할, 2분 이내 — 첫 번째 → first', () => {
    const msgs = [
      makeMsg('user', BASE),
      makeMsg('user', BASE + 60_000),
    ]
    expect(getMsgPosition(msgs, 0)).toBe('first')
  })

  it('연속 같은 역할, 2분 이내 — 두 번째 → last', () => {
    const msgs = [
      makeMsg('user', BASE),
      makeMsg('user', BASE + 60_000),
    ]
    expect(getMsgPosition(msgs, 1)).toBe('last')
  })

  it('연속 같은 역할 3개 — 중간 → middle', () => {
    const msgs = [
      makeMsg('user', BASE),
      makeMsg('user', BASE + 30_000),
      makeMsg('user', BASE + 90_000),
    ]
    expect(getMsgPosition(msgs, 1)).toBe('middle')
  })

  it('역할이 다르면 solo', () => {
    const msgs = [
      makeMsg('user', BASE),
      makeMsg('assistant', BASE + 30_000),
    ]
    expect(getMsgPosition(msgs, 0)).toBe('solo')
    expect(getMsgPosition(msgs, 1)).toBe('solo')
  })

  it('같은 역할이라도 2분 초과 간격 → solo', () => {
    const msgs = [
      makeMsg('user', BASE),
      makeMsg('user', BASE + 3 * 60_000), // 3분 뒤
    ]
    expect(getMsgPosition(msgs, 0)).toBe('solo')
    expect(getMsgPosition(msgs, 1)).toBe('solo')
  })
})

// -----------------------------------------------------------------------
// formatElapsed
// -----------------------------------------------------------------------

describe('formatElapsed', () => {
  it('59초 → "59s"', () => {
    expect(formatElapsed(59)).toBe('59s')
  })

  it('0초 → "0s"', () => {
    expect(formatElapsed(0)).toBe('0s')
  })

  it('60초 → "1m 0s"', () => {
    expect(formatElapsed(60)).toBe('1m 0s')
  })

  it('90초 → "1m 30s"', () => {
    expect(formatElapsed(90)).toBe('1m 30s')
  })

  it('125초 → "2m 5s"', () => {
    expect(formatElapsed(125)).toBe('2m 5s')
  })
})

// -----------------------------------------------------------------------
// formatTimeSep
// -----------------------------------------------------------------------

describe('formatTimeSep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('오늘 타임스탬프 → "오늘 HH:MM" 형식 포함', () => {
    const ts = new Date('2024-06-15T09:30:00').getTime()
    const result = formatTimeSep(ts)
    expect(result).toContain('오늘')
  })

  it('어제 타임스탬프 → "어제" 포함', () => {
    const ts = new Date('2024-06-14T10:00:00').getTime()
    const result = formatTimeSep(ts)
    expect(result).toContain('어제')
  })

  it('다른 날 → toLocaleDateString 포함 (오늘/어제 없음)', () => {
    const ts = new Date('2024-06-10T08:00:00').getTime()
    const result = formatTimeSep(ts)
    expect(result).not.toContain('오늘')
    expect(result).not.toContain('어제')
  })
})

// -----------------------------------------------------------------------
// ACTION_PROMPTS
// -----------------------------------------------------------------------

describe('ACTION_PROMPTS', () => {
  it('explain — 언어와 코드가 포함된다', () => {
    const result = ACTION_PROMPTS.explain('typescript', 'const x = 1')
    expect(result).toContain('typescript')
    expect(result).toContain('const x = 1')
    expect(result).toContain('설명')
  })

  it('optimize — 최적화 키워드 포함', () => {
    const result = ACTION_PROMPTS.optimize('javascript', 'for(;;){}')
    expect(result).toContain('javascript')
    expect(result).toContain('최적화')
  })

  it('fix — 버그 키워드 포함', () => {
    const result = ACTION_PROMPTS.fix('python', 'print x')
    expect(result).toContain('python')
    expect(result).toContain('버그')
  })

  it('코드 블록 마크다운 형식 포함', () => {
    const result = ACTION_PROMPTS.explain('js', 'alert(1)')
    expect(result).toContain('```js')
    expect(result).toContain('```')
  })
})
