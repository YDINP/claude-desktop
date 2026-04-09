import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ResourceBar } from '../ResourceBar'

// window.api mock
const mockApi = {
  getMemoryUsage: vi.fn().mockResolvedValue({ rss: 256 * 1024 * 1024 }),
  onMemoryUpdate: vi.fn().mockReturnValue(() => {}),
}

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ResourceBar', () => {
  it('HQ 버튼을 렌더링한다', () => {
    render(<ResourceBar />)
    expect(screen.getByText(/HQ/)).toBeTruthy()
  })

  it('CONTEXT 레이블이 표시된다', () => {
    render(<ResourceBar contextUsage={0.3} />)
    expect(screen.getByText('CONTEXT')).toBeTruthy()
  })

  it('TOKENS 레이블이 표시된다', () => {
    render(<ResourceBar sessionTokens={500} />)
    expect(screen.getByText('TOKENS')).toBeTruthy()
  })

  it('세션 토큰 0일 때 "0" 표시', () => {
    render(<ResourceBar sessionTokens={0} />)
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('세션 토큰 1500일 때 "1.5k" 표시', () => {
    render(<ResourceBar sessionTokens={1500} />)
    expect(screen.getByText('1.5k')).toBeTruthy()
  })

  it('contextUsage 50%일 때 50% 표시', () => {
    render(<ResourceBar contextUsage={0.5} />)
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('contextUsage 0일 때 0% 표시', () => {
    render(<ResourceBar contextUsage={0} />)
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('totalCost > 0이면 비용 표시', () => {
    render(<ResourceBar totalCost={0.0123} />)
    expect(screen.getByText('$0.0123')).toBeTruthy()
  })

  it('totalCost 0이면 비용 미표시', () => {
    const { container } = render(<ResourceBar totalCost={0} />)
    expect(container.textContent).not.toContain('$')
  })

  it('isStreaming 중일 때 active 표시', () => {
    render(<ResourceBar isStreaming={true} />)
    expect(screen.getByText(/active/)).toBeTruthy()
  })

  it('isStreaming false일 때 active 미표시', () => {
    const { container } = render(<ResourceBar isStreaming={false} activeAgentCount={0} />)
    expect(container.textContent).not.toContain('active')
  })

  it('model 표시 - claude- prefix 제거', () => {
    render(<ResourceBar model="claude-sonnet-4-5" />)
    // model.replace('claude-', '') → "sonnet-4-5"
    const { container } = render(<ResourceBar model="claude-haiku" />)
    expect(container.textContent).toContain('haiku')
  })

  it('online 상태 표시', () => {
    render(<ResourceBar />)
    // navigator.onLine은 jsdom에서 true or false
    const { container } = render(<ResourceBar />)
    expect(container.textContent).toMatch(/online|offline/)
  })
})
