import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { OpsFeed } from '../OpsFeed'
import type { ToolUseItem } from '../../../domains/chat'

function makeTool(override: Partial<ToolUseItem> = {}): ToolUseItem {
  return {
    id: `tool-${Math.random()}`,
    name: 'Bash',
    input: { command: 'ls -la' },
    status: 'done',
    result: null,
    ...override,
  }
}

describe('OpsFeed', () => {
  it('toolUses 없고 isStreaming false면 null 렌더링', () => {
    const { container } = render(<OpsFeed />)
    expect(container.firstChild).toBeNull()
  })

  it('isStreaming=true이면 렌더링됨', () => {
    const { container } = render(<OpsFeed isStreaming={true} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('toolUses가 있으면 렌더링됨', () => {
    const tools = [makeTool({ name: 'Read', status: 'done' })]
    const { container } = render(<OpsFeed toolUses={tools} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('OPS ▶ 레이블이 표시된다', () => {
    const tools = [makeTool()]
    render(<OpsFeed toolUses={tools} />)
    expect(screen.getByText('OPS ▶')).toBeTruthy()
  })

  it('툴 이름이 표시된다', () => {
    const tools = [makeTool({ name: 'Read', status: 'done' })]
    render(<OpsFeed toolUses={tools} />)
    expect(screen.getByText(/Read/)).toBeTruthy()
  })

  it('running 상태 툴이 표시된다', () => {
    const tools = [makeTool({ name: 'Bash', status: 'running' })]
    render(<OpsFeed toolUses={tools} />)
    expect(screen.getByText(/Bash/)).toBeTruthy()
  })

  it('error 상태 툴이 표시된다', () => {
    const tools = [makeTool({ name: 'Write', status: 'error' })]
    render(<OpsFeed toolUses={tools} />)
    expect(screen.getByText(/Write/)).toBeTruthy()
  })

  it('isStreaming=true이고 toolUses 없으면 ... 표시', () => {
    render(<OpsFeed isStreaming={true} toolUses={[]} />)
    expect(screen.getByText('···')).toBeTruthy()
  })

  it('최대 8개 툴만 표시한다', () => {
    const tools = Array.from({ length: 12 }, (_, i) =>
      makeTool({ id: `t${i}`, name: 'Bash', status: 'done' })
    )
    const { container } = render(<OpsFeed toolUses={tools} />)
    // 최대 8개 span (툴 아이템)
    const spans = container.querySelectorAll('[style*="font-family: var(--font-mono)"]')
    // OPS label + 최대 8 items = 전체 검증
    const toolSpans = Array.from(spans).filter(s => s.textContent?.includes('Bash'))
    expect(toolSpans.length).toBeLessThanOrEqual(8)
  })

  it('onToolClick 클릭 시 호출된다', () => {
    const onClick = vi.fn()
    const tools = [makeTool({ id: 'click-tool', name: 'Read', status: 'done' })]
    render(<OpsFeed toolUses={tools} onToolClick={onClick} />)
    const el = screen.getByText(/Read/)
    fireEvent.click(el)
    expect(onClick).toHaveBeenCalledWith('click-tool')
  })

  it('sessionId 변경 시 재렌더링 (visible reset)', () => {
    const tools = [makeTool({ name: 'Glob', status: 'done' })]
    const { rerender } = render(<OpsFeed toolUses={tools} sessionId="s1" />)
    rerender(<OpsFeed toolUses={tools} sessionId="s2" />)
    // 렌더링 에러 없이 통과하면 OK
    expect(screen.getByText(/Glob/)).toBeTruthy()
  })
})
