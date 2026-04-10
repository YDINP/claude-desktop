import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── eventBus mock ─────────────────────────────────────────────────────────────
// eventBus 모듈을 mock해서 on() 호출 캡처
import { eventBus } from '../../../kernel/eventBus'
import { initTerminalAdapter } from '../adapter'
import { useTerminalStore } from '../store'

describe('initTerminalAdapter', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      tabs: [],
      activeTabId: null,
      outputHistory: {},
    })
    eventBus.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── 등록 ──────────────────────────────────────────────────────────────────

  it('eventBus에 terminal:data 리스너를 등록한다', () => {
    const onSpy = vi.spyOn(eventBus, 'on')
    initTerminalAdapter()
    expect(onSpy).toHaveBeenCalledWith('terminal:data', expect.any(Function))
  })

  // ── store.appendOutput 호출 ───────────────────────────────────────────────

  it('terminal:data 이벤트 수신 시 store.appendOutput을 호출한다', () => {
    initTerminalAdapter()
    eventBus.emit({ type: 'terminal:data', payload: { id: 'tab-1', data: 'hello\n' } })
    expect(useTerminalStore.getState().outputHistory['tab-1']).toEqual(['hello\n'])
  })

  it('같은 탭에 여러 데이터가 누적된다', () => {
    initTerminalAdapter()
    eventBus.emit({ type: 'terminal:data', payload: { id: 'tab-1', data: 'line1\n' } })
    eventBus.emit({ type: 'terminal:data', payload: { id: 'tab-1', data: 'line2\n' } })
    expect(useTerminalStore.getState().outputHistory['tab-1']).toEqual(['line1\n', 'line2\n'])
  })

  it('서로 다른 탭 ID는 독립적으로 기록된다', () => {
    initTerminalAdapter()
    eventBus.emit({ type: 'terminal:data', payload: { id: 'tab-a', data: 'a\n' } })
    eventBus.emit({ type: 'terminal:data', payload: { id: 'tab-b', data: 'b\n' } })
    const history = useTerminalStore.getState().outputHistory
    expect(history['tab-a']).toEqual(['a\n'])
    expect(history['tab-b']).toEqual(['b\n'])
  })

  // ── cleanup ───────────────────────────────────────────────────────────────

  it('cleanup 함수 호출 후에는 이벤트를 처리하지 않는다', () => {
    const cleanup = initTerminalAdapter()
    cleanup()
    eventBus.emit({ type: 'terminal:data', payload: { id: 'tab-1', data: 'after-cleanup\n' } })
    expect(useTerminalStore.getState().outputHistory['tab-1']).toBeUndefined()
  })

  it('cleanup 함수는 throw 없이 호출된다', () => {
    const cleanup = initTerminalAdapter()
    expect(() => cleanup()).not.toThrow()
  })
})
