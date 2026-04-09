import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatSearch } from '../useChatSearch'
import type { ChatMessage } from '../../domains/chat/domain'

function makeMsg(id: string, text: string): ChatMessage {
  return { id, role: 'assistant', text, toolUses: [], timestamp: Date.now() }
}

const MSGS: ChatMessage[] = [
  makeMsg('m1', 'Hello world'),
  makeMsg('m2', 'Goodbye world'),
  makeMsg('m3', 'Hello again'),
  makeMsg('m4', 'No match here'),
]

function setup(overrides: Partial<Parameters<typeof useChatSearch>[0]> = {}) {
  const setShowOnlyBookmarks = vi.fn()
  const setChatViewMode = vi.fn()
  const onScrollToMatch = vi.fn()
  const { result, rerender } = renderHook(
    (props: Parameters<typeof useChatSearch>[0]) => useChatSearch(props),
    {
      initialProps: {
        messages: MSGS,
        setShowOnlyBookmarks,
        setChatViewMode,
        onScrollToMatch,
        ...overrides,
      },
    },
  )
  return { result, rerender, setShowOnlyBookmarks, setChatViewMode, onScrollToMatch }
}

describe('useChatSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('초기 상태: showSearch=false, searchQuery=""', () => {
    const { result } = setup()
    expect(result.current.showSearch).toBe(false)
    expect(result.current.searchQuery).toBe('')
    expect(result.current.matchCount).toBe(0)
  })

  it('setShowSearch(true) → showSearch=true', () => {
    const { result } = setup()
    act(() => { result.current.setShowSearch(true) })
    expect(result.current.showSearch).toBe(true)
  })

  it('showSearch false로 닫으면 searchQuery 초기화', () => {
    const { result } = setup()
    act(() => { result.current.setShowSearch(true) })
    act(() => { result.current.handleSearchChange('hello') })
    act(() => { result.current.setShowSearch(false) })
    expect(result.current.searchQuery).toBe('')
    expect(result.current.matchCount).toBe(0)
  })

  it('handleSearchChange: 매치 카운트 계산', async () => {
    const { result } = setup()
    act(() => { result.current.handleSearchChange('hello') })
    // useTransition 내부이므로 flush
    await act(async () => {})
    expect(result.current.matchCount).toBe(2) // "Hello world", "Hello again"
    expect(result.current.matchedMessageIds.has('m1')).toBe(true)
    expect(result.current.matchedMessageIds.has('m3')).toBe(true)
  })

  it('검색어 대소문자 무시', async () => {
    const { result } = setup()
    act(() => { result.current.handleSearchChange('WORLD') })
    await act(async () => {})
    expect(result.current.matchCount).toBe(2) // "Hello world", "Goodbye world"
  })

  it('검색어 공백이면 matchCount=0', async () => {
    const { result } = setup()
    act(() => { result.current.handleSearchChange('  ') })
    await act(async () => {})
    expect(result.current.matchCount).toBe(0)
  })

  it('handleSearchNext: matchIdx 증가 (순환)', async () => {
    const { result } = setup()
    act(() => { result.current.handleSearchChange('hello') })
    await act(async () => {})

    expect(result.current.safeMatchIdx).toBe(0)
    act(() => { result.current.handleSearchNext() })
    expect(result.current.safeMatchIdx).toBe(1)
    // 순환: matchCount=2이므로 다시 0
    act(() => { result.current.handleSearchNext() })
    expect(result.current.safeMatchIdx).toBe(0)
  })

  it('handleSearchPrev: matchIdx 감소 (순환)', async () => {
    const { result } = setup()
    act(() => { result.current.handleSearchChange('hello') })
    await act(async () => {})

    act(() => { result.current.handleSearchPrev() })
    // (0 - 1 + 2) % 2 = 1
    expect(result.current.safeMatchIdx).toBe(1)
  })

  it('handleSearchKeyDown Enter → next, Shift+Enter → prev', async () => {
    const { result } = setup()
    act(() => { result.current.handleSearchChange('hello') })
    await act(async () => {})

    act(() => {
      result.current.handleSearchKeyDown({ key: 'Enter', shiftKey: false, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>)
    })
    expect(result.current.safeMatchIdx).toBe(1)

    act(() => {
      result.current.handleSearchKeyDown({ key: 'Enter', shiftKey: true, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>)
    })
    expect(result.current.safeMatchIdx).toBe(0)
  })

  it('handleSearchKeyDown Escape → showSearch=false', () => {
    const { result } = setup()
    act(() => { result.current.setShowSearch(true) })
    act(() => {
      result.current.handleSearchKeyDown({ key: 'Escape', shiftKey: false, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>)
    })
    expect(result.current.showSearch).toBe(false)
  })

  it('currentMatchId: 현재 매치 메시지 id 반환', async () => {
    const { result } = setup()
    act(() => { result.current.handleSearchChange('hello') })
    await act(async () => {})
    expect(result.current.currentMatchId).toBe('m1')
  })

  it('matchCount=0이면 currentMatchId=null', () => {
    const { result } = setup()
    expect(result.current.currentMatchId).toBeNull()
  })

  it('searchTrigger 변화 시 showSearch=true', () => {
    const { result, rerender } = setup({ searchTrigger: 0 })
    expect(result.current.showSearch).toBe(false)

    rerender({
      messages: MSGS,
      searchTrigger: 1,
      setShowOnlyBookmarks: vi.fn(),
      setChatViewMode: vi.fn(),
      onScrollToMatch: vi.fn(),
    })
    expect(result.current.showSearch).toBe(true)
  })

  it('키보드 Escape: showSearch 닫힘', () => {
    const { result } = setup()
    act(() => { result.current.setShowSearch(true) })

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(result.current.showSearch).toBe(false)
  })

  it('키보드 ?: showShortcutsOverlay 토글', () => {
    const { result } = setup()
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    })
    expect(result.current.showShortcutsOverlay).toBe(true)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    })
    expect(result.current.showShortcutsOverlay).toBe(false)
  })
})
