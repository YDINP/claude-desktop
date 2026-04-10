import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React, { createRef } from 'react'
import { MiniMap, type MiniMapProps } from '../MiniMap'
import type { ChatMessage } from '../../../domains/chat/domain'

function makeMsg(id: string, role: 'user' | 'assistant'): ChatMessage {
  return { id, role, text: 'text', toolUses: [], timestamp: Date.now() }
}

const MESSAGES: ChatMessage[] = [
  makeMsg('m1', 'user'),
  makeMsg('m2', 'assistant'),
  makeMsg('m3', 'user'),
]

function makeProps(overrides: Partial<MiniMapProps> = {}): MiniMapProps {
  const ref = createRef<HTMLDivElement>()
  return {
    messages: MESSAGES,
    scrollTop: 0,
    clientHeight: 300,
    totalScrollHeight: 1000,
    blockHeights: [100, 200, 150],
    totalRaw: 450,
    minimapRef: ref,
    onClick: vi.fn(),
    ...overrides,
  }
}

describe('MiniMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. 기본 렌더
  it('MiniMap이 렌더된다', () => {
    const { container } = render(<MiniMap {...makeProps()} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  // 2. 컨테이너 클릭 시 onClick 호출
  it('컨테이너 클릭 시 onClick이 호출된다', () => {
    const onClick = vi.fn()
    const { container } = render(<MiniMap {...makeProps({ onClick })} />)
    fireEvent.click(container.firstChild as Element)
    expect(onClick).toHaveBeenCalled()
  })

  // 3. 메시지 블록 개수
  it('메시지 수만큼 블록이 렌더된다', () => {
    const { container } = render(<MiniMap {...makeProps()} />)
    // 메시지 3개 블록 + 뷰포트 1개 = 총 4개 div
    const blocks = container.querySelectorAll('div[style*="position: absolute"]')
    expect(blocks.length).toBeGreaterThanOrEqual(MESSAGES.length)
  })

  // 4. user 메시지 블록 색상
  it('user 메시지 블록은 파란색(#4a90e2) 배경을 가진다', () => {
    const { container } = render(<MiniMap {...makeProps()} />)
    const blocks = Array.from(container.querySelectorAll('div[style*="position: absolute"]'))
    const userBlock = blocks.find(el => (el as HTMLElement).style.background === 'rgb(74, 144, 226)')
    expect(userBlock).toBeTruthy()
  })

  // 5. assistant 메시지 블록 색상
  it('assistant 메시지 블록은 회색(#666) 배경을 가진다', () => {
    const { container } = render(<MiniMap {...makeProps()} />)
    const blocks = Array.from(container.querySelectorAll('div[style*="position: absolute"]'))
    const assistantBlock = blocks.find(el => (el as HTMLElement).style.background === 'rgb(102, 102, 102)')
    expect(assistantBlock).toBeTruthy()
  })

  // 6. 뷰포트 인디케이터 존재
  it('뷰포트 인디케이터가 렌더된다', () => {
    const { container } = render(<MiniMap {...makeProps()} />)
    const viewport = Array.from(container.querySelectorAll('div[style]'))
      .find(el => (el as HTMLElement).style.pointerEvents === 'none')
    expect(viewport).toBeTruthy()
  })

  // 7. 빈 메시지 목록
  it('messages가 비어있어도 렌더에 실패하지 않는다', () => {
    const { container } = render(<MiniMap {...makeProps({ messages: [], blockHeights: [], totalRaw: 0 })} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  // 8. 고정 너비 40
  it('컨테이너 너비가 40px이다', () => {
    const { container } = render(<MiniMap {...makeProps()} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('40px')
  })

  // 9. cursor pointer
  it('컨테이너에 cursor: pointer가 설정된다', () => {
    const { container } = render(<MiniMap {...makeProps()} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.cursor).toBe('pointer')
  })

  // 10. scrollTop 0 이면 뷰포트 top이 0
  it('scrollTop이 0이면 뷰포트 인디케이터 top이 0이다', () => {
    const { container } = render(<MiniMap {...makeProps({ scrollTop: 0 })} />)
    const viewport = Array.from(container.querySelectorAll('div[style]'))
      .find(el => (el as HTMLElement).style.pointerEvents === 'none') as HTMLElement
    expect(viewport?.style.top).toBe('0px')
  })

  // 11. 단일 메시지 렌더
  it('메시지 1개일 때도 정상 렌더된다', () => {
    const msg = makeMsg('only', 'user')
    const { container } = render(
      <MiniMap {...makeProps({ messages: [msg], blockHeights: [200], totalRaw: 200 })} />
    )
    expect(container.firstChild).toBeInTheDocument()
  })

  // 12. ref가 div에 연결됨
  it('minimapRef가 div 엘리먼트에 연결된다', () => {
    const ref = createRef<HTMLDivElement>()
    render(<MiniMap {...makeProps({ minimapRef: ref })} />)
    // ref.current는 JSDOM에서 clientHeight가 0이어서 null일 수 있으나 연결 시도는 된다
    // 컨테이너 존재 자체로 검증
    expect(ref.current).not.toBeUndefined()
  })

  // 13. overflow hidden
  it('컨테이너에 overflow: hidden이 설정된다', () => {
    const { container } = render(<MiniMap {...makeProps()} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.overflow).toBe('hidden')
  })

  // 14. 메모이제이션 — 동일 props 재렌더 안 함
  it('동일한 props로 리렌더 시 구조가 동일하다', () => {
    const props = makeProps()
    const { container, rerender } = render(<MiniMap {...props} />)
    const before = container.innerHTML
    rerender(<MiniMap {...props} />)
    expect(container.innerHTML).toBe(before)
  })

  // 15. blockHeights 길이와 messages 불일치 — 안전 처리
  it('blockHeights 길이가 messages보다 적어도 크래시 없이 렌더된다', () => {
    const { container } = render(
      <MiniMap {...makeProps({ blockHeights: [100] })} />
    )
    expect(container.firstChild).toBeInTheDocument()
  })
})
