/**
 * history plugin 순수 로직 테스트
 * localStorage 기반 편집 이력 저장/조회/삭제 + relativeTime + findNodeByUuid 검증
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CCSceneNode } from '../../../../../../shared/ipc-schema'

// ── 타입 정의 (history.tsx에서 복제) ─────────────────────────────────────────

type HistoryEntry = { uuid: string; name: string; timestamp: number; op: string }

const HISTORY_KEY = 'cc-batch-edit-history'
const MAX_HISTORY = 20

// ── 순수 로직 복제 ───────────────────────────────────────────────────────────

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

function findNodeByUuid(root: CCSceneNode, uuid: string): CCSceneNode | null {
  if (root.uuid === uuid) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeByUuid(child, uuid)
      if (found) return found
    }
  }
  return null
}

function recordEntries(prev: HistoryEntry[], newEntries: HistoryEntry[]): HistoryEntry[] {
  const updated = [...newEntries, ...prev].slice(0, MAX_HISTORY)
  saveHistory(updated)
  return updated
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return {
    uuid,
    name: uuid,
    active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [],
    children: [],
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('loadHistory — localStorage 기반 영속', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('localStorage가 비어 있으면 빈 배열 반환', () => {
    expect(loadHistory()).toEqual([])
  })

  it('저장된 이력을 불러온다', () => {
    const entries: HistoryEntry[] = [
      { uuid: 'u1', name: 'Node1', timestamp: 1000, op: '수동' },
    ]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
    expect(loadHistory()).toEqual(entries)
  })

  it('localStorage에 잘못된 JSON이 있으면 빈 배열 반환', () => {
    localStorage.setItem(HISTORY_KEY, '{{invalid')
    expect(loadHistory()).toEqual([])
  })
})

describe('saveHistory / recordEntries — 이력 기록', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('항목을 저장하면 localStorage에 반영된다', () => {
    const entries: HistoryEntry[] = [{ uuid: 'u1', name: 'N', timestamp: 1, op: '수동' }]
    saveHistory(entries)
    expect(loadHistory()).toEqual(entries)
  })

  it('새 항목이 앞에 추가된다 (최신 순)', () => {
    const old: HistoryEntry[] = [{ uuid: 'old', name: 'Old', timestamp: 100, op: '수동' }]
    const newE: HistoryEntry[] = [{ uuid: 'new', name: 'New', timestamp: 200, op: '수동' }]
    const result = recordEntries(old, newE)
    expect(result[0].uuid).toBe('new')
    expect(result[1].uuid).toBe('old')
  })

  it(`MAX_HISTORY(${MAX_HISTORY}) 초과 시 오래된 항목이 잘린다`, () => {
    const old: HistoryEntry[] = Array.from({ length: MAX_HISTORY }, (_, i) => ({
      uuid: `u${i}`, name: `N${i}`, timestamp: i, op: '수동',
    }))
    const newE: HistoryEntry[] = [{ uuid: 'extra', name: 'Extra', timestamp: 9999, op: '수동' }]
    const result = recordEntries(old, newE)
    expect(result).toHaveLength(MAX_HISTORY)
    expect(result[0].uuid).toBe('extra')
    expect(result[MAX_HISTORY - 1].uuid).not.toBe(`u${MAX_HISTORY - 1}`)
  })

  it('빈 배열 저장 후 불러오면 빈 배열', () => {
    saveHistory([])
    expect(loadHistory()).toEqual([])
  })

  it('여러 노드를 한 번에 기록한다', () => {
    const now = Date.now()
    const newEntries: HistoryEntry[] = [
      { uuid: 'u1', name: 'N1', timestamp: now, op: '자동' },
      { uuid: 'u2', name: 'N2', timestamp: now, op: '자동' },
    ]
    const result = recordEntries([], newEntries)
    expect(result).toHaveLength(2)
    expect(result[0].uuid).toBe('u1')
    expect(result[1].uuid).toBe('u2')
  })
})

describe('relativeTime — 상대 시간 표시', () => {
  it('60초 미만이면 "방금 전"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))
    expect(relativeTime(9001)).toBe('방금 전')  // diff = 0 seconds
    vi.useRealTimers()
  })

  it('60초 이상 3599초 미만이면 "N분 전"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10 * 60 * 1000))  // 10분
    expect(relativeTime(0)).toBe('10분 전')
    vi.useRealTimers()
  })

  it('3600초 이상이면 "N시간 전"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(3 * 3600 * 1000))  // 3시간
    expect(relativeTime(0)).toBe('3시간 전')
    vi.useRealTimers()
  })

  it('정확히 60초이면 "1분 전"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(60000))
    expect(relativeTime(0)).toBe('1분 전')
    vi.useRealTimers()
  })

  it('정확히 3600초이면 "1시간 전"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(3600000))
    expect(relativeTime(0)).toBe('1시간 전')
    vi.useRealTimers()
  })
})

describe('findNodeByUuid — 노드 트리 탐색', () => {
  it('루트가 일치하면 루트를 반환한다', () => {
    const root = makeNode('root')
    expect(findNodeByUuid(root, 'root')).toBe(root)
  })

  it('자식에서 일치하면 자식을 반환한다', () => {
    const child = makeNode('child')
    const root = makeNode('root', { children: [child] })
    expect(findNodeByUuid(root, 'child')).toBe(child)
  })

  it('중첩된 자식(손자)에서 탐색한다', () => {
    const grandchild = makeNode('grandchild')
    const child = makeNode('child', { children: [grandchild] })
    const root = makeNode('root', { children: [child] })
    expect(findNodeByUuid(root, 'grandchild')).toBe(grandchild)
  })

  it('일치하는 노드가 없으면 null 반환', () => {
    const root = makeNode('root', { children: [makeNode('child')] })
    expect(findNodeByUuid(root, 'not-exist')).toBeNull()
  })

  it('children이 비어 있는 리프 노드에서 탐색 시 null 반환', () => {
    const root = makeNode('root')
    expect(findNodeByUuid(root, 'anything')).toBeNull()
  })

  it('여러 자식 중 두 번째 자식을 정확히 찾는다', () => {
    const c1 = makeNode('c1')
    const c2 = makeNode('c2')
    const c3 = makeNode('c3')
    const root = makeNode('root', { children: [c1, c2, c3] })
    expect(findNodeByUuid(root, 'c2')).toBe(c2)
  })
})
