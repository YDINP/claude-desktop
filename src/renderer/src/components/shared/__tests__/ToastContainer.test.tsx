import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ToastContainer } from '../ToastContainer'
import { toast, subscribe, unsubscribe } from '../../../utils/toast'

// ToastContainer는 requestAnimationFrame으로 visible 상태를 업데이트한다.
// fake timers가 rAF를 막으므로 실제 타이머를 사용한다.
// 자동 사라짐 테스트는 짧은 duration(50ms)을 직접 지정해 실제 타이머로 검증한다.

describe('ToastContainer', () => {
  // 1. 기본 렌더 — 토스트 없으면 null 반환
  it('토스트 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })

  // 2. info 토스트 표시
  it('info 토스트 메시지를 표시한다', async () => {
    render(<ToastContainer />)
    act(() => { toast('안녕하세요', 'info') })
    expect(await screen.findByText('안녕하세요')).toBeInTheDocument()
  })

  // 3. success 토스트 표시
  it('success 토스트를 표시한다', async () => {
    render(<ToastContainer />)
    act(() => { toast('저장 완료', 'success') })
    expect(await screen.findByText('저장 완료')).toBeInTheDocument()
  })

  // 4. error 토스트 표시
  it('error 토스트를 표시한다', async () => {
    render(<ToastContainer />)
    act(() => { toast('오류 발생', 'error') })
    expect(await screen.findByText('오류 발생')).toBeInTheDocument()
  })

  // 5. warning 토스트 표시
  it('warning 토스트를 표시한다', async () => {
    render(<ToastContainer />)
    act(() => { toast('경고', 'warning') })
    expect(await screen.findByText('경고')).toBeInTheDocument()
  })

  // 6. 여러 토스트 동시 표시
  it('여러 토스트를 동시에 표시한다', async () => {
    render(<ToastContainer />)
    act(() => {
      toast('첫 번째', 'info')
      toast('두 번째', 'success')
      toast('세 번째', 'error')
    })
    expect(await screen.findByText('첫 번째')).toBeInTheDocument()
    expect(screen.getByText('두 번째')).toBeInTheDocument()
    expect(screen.getByText('세 번째')).toBeInTheDocument()
  })

  // 7. MAX_TOASTS(5) 초과 시 오래된 토스트 제거
  it('토스트가 5개 초과하면 오래된 것을 제거한다', async () => {
    render(<ToastContainer />)
    act(() => {
      for (let i = 1; i <= 6; i++) toast(`메시지${i}`, 'info')
    })
    await waitFor(() => {
      expect(screen.queryByText('메시지1')).not.toBeInTheDocument()
    })
    expect(screen.getByText('메시지6')).toBeInTheDocument()
  })

  // 8. 클릭으로 토스트 닫기 (duration 충분히 길게 → 자동 사라짐 전에 클릭)
  it('클릭하면 토스트가 사라진다', async () => {
    render(<ToastContainer />)
    act(() => { toast('클릭 테스트', 'info', 60000) })
    const toastEl = await screen.findByText('클릭 테스트')
    fireEvent.click(toastEl)
    await waitFor(() => {
      expect(screen.queryByText('클릭 테스트')).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })

  // 9. 자동 사라짐 — duration 50ms로 지정해 빠르게 검증
  it('지정한 duration 후 자동으로 사라진다', async () => {
    render(<ToastContainer />)
    act(() => { toast('빠른 사라짐', 'info', 50) })
    expect(await screen.findByText('빠른 사라짐')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('빠른 사라짐')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  // 10. unmount 후 toast 발행해도 에러 없음
  it('컴포넌트 unmount 시 리스너가 해제된다', () => {
    const { unmount } = render(<ToastContainer />)
    unmount()
    expect(() => { act(() => { toast('언마운트 후', 'info') }) }).not.toThrow()
  })

  // 11. × 닫기 버튼이 렌더된다
  it('토스트에 × 닫기 버튼이 표시된다', async () => {
    render(<ToastContainer />)
    act(() => { toast('닫기 버튼', 'success') })
    await screen.findByText('닫기 버튼')
    expect(screen.getByText('×')).toBeInTheDocument()
  })

  // 12. subscribe/unsubscribe가 올바르게 동작한다 (직접 테스트)
  it('subscribe로 등록한 핸들러가 toast 발행 시 호출된다', () => {
    const handler = vi.fn()
    subscribe(handler)
    toast('핸들러 테스트', 'info')
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ message: '핸들러 테스트', type: 'info' }))
    unsubscribe(handler)
  })

  // 13. 두 번째 토스트도 표시된다
  it('순차적으로 두 토스트를 발행하면 둘 다 표시된다', async () => {
    render(<ToastContainer />)
    act(() => { toast('토스트A', 'success') })
    act(() => { toast('토스트B', 'error') })
    expect(await screen.findByText('토스트A')).toBeInTheDocument()
    expect(await screen.findByText('토스트B')).toBeInTheDocument()
  })

  // 14. 토스트 컨테이너가 고정 포지션으로 렌더된다
  it('토스트 컨테이너가 fixed position으로 렌더된다', async () => {
    const { container } = render(<ToastContainer />)
    act(() => { toast('포지션 테스트', 'info') })
    await screen.findByText('포지션 테스트')
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.position).toBe('fixed')
  })
})
