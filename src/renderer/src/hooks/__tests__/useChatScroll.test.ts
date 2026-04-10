import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatScroll } from '../useChatScroll'
import type { ChatMessage } from '../../domains/chat/domain'

function makeMsg(id: string, role: 'user' | 'assistant' = 'assistant'): ChatMessage {
  return { id, role, text: 'hello', toolUses: [], timestamp: Date.now() }
}

function makeScrollRef(overrides: Partial<HTMLDivElement> = {}): React.RefObject<HTMLDivElement> {
  const el = {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 500,
    ...overrides,
  } as HTMLDivElement
  return { current: el }
}

describe('useChatScroll', () => {
  let scrollToIndex: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    scrollToIndex = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(
    overrides: Partial<Parameters<typeof useChatScroll>[0]> = {},
    scrollRefOverrides: Partial<HTMLDivElement> = {},
  ) {
    const msgs = overrides.messages ?? [makeMsg('m1')]
    const scrollContainerRef = makeScrollRef(scrollRefOverrides)
    return renderHook(() =>
      useChatScroll({
        sessionId: 'sess1',
        messages: msgs,
        messageCount: msgs.length,
        isStreaming: false,
        scrollContainerRef,
        scrollToIndex,
        ...overrides,
      }),
    )
  }

  it('초기 상태: showScrollBtn=false, showTopBtn=false', () => {
    const { result } = setup()
    expect(result.current.showScrollBtn).toBe(false)
    expect(result.current.showTopBtn).toBe(false)
  })

  it('초기 상태: isAtBottomRef=true', () => {
    const { result } = setup()
    expect(result.current.isAtBottomRef.current).toBe(true)
  })

  it('메시지 있으면 마운트 시 scrollToIndex 호출', () => {
    setup()
    expect(scrollToIndex).toHaveBeenCalledWith(0, { align: 'end', behavior: 'smooth' })
  })

  it('handleScroll: dist < 100이면 isAtBottomRef=true', () => {
    // scrollHeight=600, scrollTop=490, clientHeight=100 → dist=10
    const scrollContainerRef = makeScrollRef({ scrollHeight: 600, scrollTop: 490, clientHeight: 100 } as HTMLDivElement)
    const msgs = [makeMsg('m1')]
    const { result } = renderHook(() =>
      useChatScroll({
        sessionId: 'sess1',
        messages: msgs,
        messageCount: msgs.length,
        isStreaming: false,
        scrollContainerRef,
        scrollToIndex,
      }),
    )

    act(() => { result.current.handleScroll() })
    expect(result.current.isAtBottomRef.current).toBe(true)
  })

  it('handleScroll: dist > 150이면 showScrollBtn=true (50ms 후)', () => {
    // scrollHeight=1000, scrollTop=0, clientHeight=300 → dist=700
    const scrollContainerRef = makeScrollRef({ scrollHeight: 1000, scrollTop: 0, clientHeight: 300 } as HTMLDivElement)
    const msgs = [makeMsg('m1')]
    const { result } = renderHook(() =>
      useChatScroll({
        sessionId: 'sess1',
        messages: msgs,
        messageCount: msgs.length,
        isStreaming: false,
        scrollContainerRef,
        scrollToIndex,
      }),
    )

    act(() => { result.current.handleScroll() })
    // 50ms 디바운스 전
    expect(result.current.showScrollBtn).toBe(false)

    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current.showScrollBtn).toBe(true)
  })

  it('handleScroll: scrollTop > 500이면 showTopBtn=true (50ms 후)', () => {
    const scrollContainerRef = makeScrollRef({ scrollHeight: 2000, scrollTop: 600, clientHeight: 300 } as HTMLDivElement)
    const msgs = [makeMsg('m1')]
    const { result } = renderHook(() =>
      useChatScroll({
        sessionId: 'sess1',
        messages: msgs,
        messageCount: msgs.length,
        isStreaming: false,
        scrollContainerRef,
        scrollToIndex,
      }),
    )

    act(() => { result.current.handleScroll() })
    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current.showTopBtn).toBe(true)
  })

  it('scrollToBottom: scrollToIndex 호출 + showScrollBtn=false', () => {
    const msgs = [makeMsg('m1'), makeMsg('m2')]
    const scrollContainerRef = makeScrollRef()
    const { result } = renderHook(() =>
      useChatScroll({
        sessionId: 'sess1',
        messages: msgs,
        messageCount: msgs.length,
        isStreaming: false,
        scrollContainerRef,
        scrollToIndex,
      }),
    )

    scrollToIndex.mockClear()
    act(() => { result.current.scrollToBottom() })
    expect(scrollToIndex).toHaveBeenCalledWith(1, { align: 'end', behavior: 'smooth' })
    expect(result.current.showScrollBtn).toBe(false)
    expect(result.current.isAtBottomRef.current).toBe(true)
  })

  it('scrollToBottom: messageCount=0이면 scrollToIndex 호출 안 함', () => {
    const { result } = setup({ messages: [], messageCount: 0 })
    scrollToIndex.mockClear()
    act(() => { result.current.scrollToBottom() })
    expect(scrollToIndex).not.toHaveBeenCalled()
  })

  it('minimapScroll 초기값', () => {
    const { result } = setup()
    const { scrollTop, clientHeight, totalScrollHeight } = result.current.minimapScroll
    expect(scrollTop).toBe(0)
    expect(clientHeight).toBeGreaterThanOrEqual(0)
    expect(totalScrollHeight).toBeGreaterThanOrEqual(0)
  })
})
