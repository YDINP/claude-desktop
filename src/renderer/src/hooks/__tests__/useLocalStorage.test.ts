import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '../useLocalStorage'

// localStorage mock
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('저장된 값이 없으면 defaultValue를 반환한다', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 42))
    expect(result.current[0]).toBe(42)
  })

  it('localStorage에 기존 값이 있으면 그 값을 로드한다', () => {
    store['saved-key'] = JSON.stringify({ count: 7 })
    const { result } = renderHook(() => useLocalStorage('saved-key', { count: 0 }))
    expect(result.current[0]).toEqual({ count: 7 })
  })

  it('setValue 후 state와 localStorage가 동기화된다', async () => {
    const { result } = renderHook(() => useLocalStorage('sync-key', 'initial'))

    act(() => {
      result.current[1]('updated')
    })

    expect(result.current[0]).toBe('updated')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('sync-key', JSON.stringify('updated'))
  })

  it('JSON parse 에러 시 defaultValue로 폴백한다', () => {
    store['bad-key'] = 'not-valid-json{{'
    const { result } = renderHook(() => useLocalStorage('bad-key', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('함수형 업데이트가 동작한다', () => {
    const { result } = renderHook(() => useLocalStorage('fn-key', 10))

    act(() => {
      result.current[1](prev => prev + 5)
    })

    expect(result.current[0]).toBe(15)
  })

  it('배열 타입도 정상 직렬화/역직렬화된다', () => {
    store['arr-key'] = JSON.stringify([1, 2, 3])
    const { result } = renderHook(() => useLocalStorage<number[]>('arr-key', []))
    expect(result.current[0]).toEqual([1, 2, 3])
  })
})
