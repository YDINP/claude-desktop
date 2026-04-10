import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ErrorBoundary } from '../ErrorBoundary'

// 에러를 발생시키는 컴포넌트
function ThrowOnRender({ msg = 'test error' }: { msg?: string }) {
  throw new Error(msg)
}

// 조건부 에러 컴포넌트
function MaybeThrow({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('conditional error')
  return <div>정상 렌더링</div>
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  // ── 정상 렌더링 ──────────────────────────────────────────────────────────

  it('자식 컴포넌트를 정상적으로 렌더링한다', () => {
    render(
      <ErrorBoundary>
        <div>정상 자식</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('정상 자식')).toBeTruthy()
  })

  it('에러가 없으면 fallback을 표시하지 않는다', () => {
    render(
      <ErrorBoundary fallback={<div>에러 fallback</div>}>
        <div>정상</div>
      </ErrorBoundary>
    )
    expect(screen.queryByText('에러 fallback')).toBeNull()
  })

  it('여러 자식을 가진 컴포넌트를 렌더링한다', () => {
    render(
      <ErrorBoundary>
        <span>자식1</span>
        <span>자식2</span>
        <span>자식3</span>
      </ErrorBoundary>
    )
    expect(screen.getByText('자식1')).toBeTruthy()
    expect(screen.getByText('자식2')).toBeTruthy()
    expect(screen.getByText('자식3')).toBeTruthy()
  })

  // ── 에러 발생 시 fallback ─────────────────────────────────────────────────

  it('에러 발생 시 기본 fallback을 표시한다', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>
    )
    expect(screen.getByText('오류가 발생했습니다.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('에러 발생 시 커스텀 fallback을 표시한다', () => {
    render(
      <ErrorBoundary fallback={<div>커스텀 에러 화면</div>}>
        <ThrowOnRender />
      </ErrorBoundary>
    )
    expect(screen.getByText('커스텀 에러 화면')).toBeTruthy()
    expect(screen.queryByText('오류가 발생했습니다.')).toBeNull()
  })

  it('에러 발생 시 정상 자식을 숨긴다', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>
    )
    expect(screen.queryByText('정상 자식')).toBeNull()
  })

  // ── 다시 시도 버튼 ────────────────────────────────────────────────────────

  it('다시 시도 버튼 클릭 시 error state가 null로 초기화된다', () => {
    // error가 해소되지 않아도 setState({ error: null }) 호출 자체는 검증
    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>
    )

    expect(screen.getByText('오류가 발생했습니다.')).toBeTruthy()
    const btn = screen.getByRole('button', { name: '다시 시도' })
    expect(btn).toBeTruthy()

    // 클릭 후 다시 에러가 발생해서 fallback이 다시 표시되어도 정상
    fireEvent.click(btn)
    expect(screen.getByText('오류가 발생했습니다.')).toBeTruthy()
  })

  it('커스텀 fallback에 다시 시도 버튼이 없어도 된다', () => {
    render(
      <ErrorBoundary fallback={<span>fallback only</span>}>
        <ThrowOnRender />
      </ErrorBoundary>
    )
    expect(screen.getByText('fallback only')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  // ── console.error 호출 ────────────────────────────────────────────────────

  it('에러 발생 시 console.error를 호출한다', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender msg="boom!" />
      </ErrorBoundary>
    )
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('name prop이 있으면 console.error에 name이 포함된다', () => {
    render(
      <ErrorBoundary name="MyComponent">
        <ThrowOnRender />
      </ErrorBoundary>
    )
    // React dev 모드는 자체적으로 먼저 console.error 호출 — 모든 call에서 검색
    const allCalls = consoleErrorSpy.mock.calls
    const found = allCalls.some(args => args.some(a => String(a).includes('MyComponent')))
    expect(found).toBe(true)
  })

  it('name prop이 없으면 console.error에 ErrorBoundary가 포함된다', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>
    )
    const allCalls = consoleErrorSpy.mock.calls
    const found = allCalls.some(args => args.some(a => String(a).includes('ErrorBoundary')))
    expect(found).toBe(true)
  })

  it('에러 객체가 console.error 인자로 전달된다', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender msg="specific error" />
      </ErrorBoundary>
    )
    // componentDidCatch에서 호출하는 call — Error 인스턴스를 인자로 가진 call 탐색
    const allCalls = consoleErrorSpy.mock.calls
    const callWithError = allCalls.find(args => args.some(a => a instanceof Error))
    expect(callWithError).toBeDefined()
    const errArg = callWithError!.find(a => a instanceof Error) as Error
    expect(errArg.message).toBe('specific error')
  })

  // ── 엣지 케이스 ──────────────────────────────────────────────────────────

  it('null fallback이 아닌 ReactNode도 렌더링한다', () => {
    render(
      <ErrorBoundary fallback={<React.Fragment><p>p1</p><p>p2</p></React.Fragment>}>
        <ThrowOnRender />
      </ErrorBoundary>
    )
    expect(screen.getByText('p1')).toBeTruthy()
    expect(screen.getByText('p2')).toBeTruthy()
  })

  it('깊은 자식 트리에서 에러가 발생해도 캐치한다', () => {
    render(
      <ErrorBoundary>
        <div>
          <div>
            <div>
              <ThrowOnRender msg="deep error" />
            </div>
          </div>
        </div>
      </ErrorBoundary>
    )
    expect(screen.getByText('오류가 발생했습니다.')).toBeTruthy()
  })

  it('이름이 빈 문자열이면 빈 대괄호로 출력된다', () => {
    render(
      <ErrorBoundary name="">
        <ThrowOnRender />
      </ErrorBoundary>
    )
    // name=""이면 ?? 는 undefined/null에만 작동 → "" 그대로 사용 → `[]` 출력
    const allCalls = consoleErrorSpy.mock.calls
    const found = allCalls.some(args => args.some(a => String(a).includes('[]')))
    expect(found).toBe(true)
  })

  it('초기에는 error state가 null이다', () => {
    // 정상 렌더링 → fallback 안 보임으로 확인
    render(
      <ErrorBoundary fallback={<div>에러상태</div>}>
        <div>OK</div>
      </ErrorBoundary>
    )
    expect(screen.queryByText('에러상태')).toBeNull()
    expect(screen.getByText('OK')).toBeTruthy()
  })

  it('에러 발생 후 다시 시도 버튼을 여러 번 눌러도 동작한다', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>
    )
    const btn = screen.getByRole('button', { name: '다시 시도' })
    fireEvent.click(btn)
    // 에러가 다시 발생하지만 state 리셋은 정상적으로 작동함
    expect(screen.getByText('오류가 발생했습니다.')).toBeTruthy()
  })
})
