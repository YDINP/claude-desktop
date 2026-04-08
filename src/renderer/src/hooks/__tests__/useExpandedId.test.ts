import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExpandedId } from '../useExpandedId'

describe('useExpandedId', () => {
  it('초기 상태에서 expandedId는 null이다', () => {
    const { result } = renderHook(() => useExpandedId())
    expect(result.current.expandedId).toBeNull()
  })

  it('toggle(id) 호출 시 해당 id가 expandedId로 설정된다', () => {
    const { result } = renderHook(() => useExpandedId())

    act(() => { result.current.toggle('item-1') })

    expect(result.current.expandedId).toBe('item-1')
  })

  it('같은 id를 두 번 toggle하면 null로 닫힌다', () => {
    const { result } = renderHook(() => useExpandedId())

    act(() => { result.current.toggle('item-1') })
    act(() => { result.current.toggle('item-1') })

    expect(result.current.expandedId).toBeNull()
  })

  it('다른 id를 toggle하면 expandedId가 교체된다', () => {
    const { result } = renderHook(() => useExpandedId())

    act(() => { result.current.toggle('item-1') })
    act(() => { result.current.toggle('item-2') })

    expect(result.current.expandedId).toBe('item-2')
  })

  it('isExpanded — 열린 id는 true, 다른 id는 false', () => {
    const { result } = renderHook(() => useExpandedId())

    act(() => { result.current.toggle('item-1') })

    expect(result.current.isExpanded('item-1')).toBe(true)
    expect(result.current.isExpanded('item-2')).toBe(false)
  })

  it('닫힌 후 isExpanded는 모두 false를 반환한다', () => {
    const { result } = renderHook(() => useExpandedId())

    act(() => { result.current.toggle('item-1') })
    act(() => { result.current.toggle('item-1') })

    expect(result.current.isExpanded('item-1')).toBe(false)
  })
})
