import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCopyToClipboard } from '../useCopyToClipboard'

const writeTextMock = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: writeTextMock } },
  writable: true,
})

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    writeTextMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('copy 호출 후 copiedKey가 설정된다', async () => {
    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await result.current.copy('hello', 'key1')
    })

    expect(result.current.copiedKey).toBe('key1')
    expect(writeTextMock).toHaveBeenCalledWith('hello')
  })

  it('key 미지정 시 copiedKey가 "default"로 설정된다', async () => {
    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await result.current.copy('text')
    })

    expect(result.current.copiedKey).toBe('default')
  })

  it('timeout 후 copiedKey가 null로 리셋된다', async () => {
    const { result } = renderHook(() => useCopyToClipboard(1500))

    await act(async () => {
      await result.current.copy('text', 'key1')
    })

    expect(result.current.copiedKey).toBe('key1')

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.copiedKey).toBeNull()
  })

  it('isCopied — 일치하는 key면 true, 다른 key면 false', async () => {
    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await result.current.copy('text', 'key1')
    })

    expect(result.current.isCopied('key1')).toBe(true)
    expect(result.current.isCopied('key2')).toBe(false)
  })

  it('다중 키를 구분한다 — 마지막 복사 키만 active', async () => {
    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await result.current.copy('a', 'keyA')
    })
    await act(async () => {
      await result.current.copy('b', 'keyB')
    })

    expect(result.current.isCopied('keyA')).toBe(false)
    expect(result.current.isCopied('keyB')).toBe(true)
  })

  it('타이머 만료 전에 다른 키로 복사하면 이전 타이머가 현재 키를 리셋하지 않는다', async () => {
    const { result } = renderHook(() => useCopyToClipboard(1000))

    await act(async () => {
      await result.current.copy('a', 'keyA')
    })

    // 500ms 경과 후 다른 키 복사
    act(() => { vi.advanceTimersByTime(500) })

    await act(async () => {
      await result.current.copy('b', 'keyB')
    })

    // keyA 타이머 만료
    act(() => { vi.advanceTimersByTime(600) })

    // keyB는 살아 있어야 함
    expect(result.current.copiedKey).toBe('keyB')
  })
})
