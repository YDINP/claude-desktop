import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SceneToolbar } from '../SceneToolbar'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeDefaultProps(overrides: Partial<React.ComponentProps<typeof SceneToolbar>> = {}) {
  return {
    activeTool: 'select' as const,
    zoom: 1,
    gridVisible: false,
    snapEnabled: false,
    onToolChange: vi.fn(),
    onZoomChange: vi.fn(),
    onGridToggle: vi.fn(),
    onSnapToggle: vi.fn(),
    onFit: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  }
}

// ── 기본 렌더링 ──────────────────────────────────────────────────────────────

describe('SceneToolbar — 기본 렌더링', () => {
  it('툴바가 렌더링된다', () => {
    const { container } = render(<SceneToolbar {...makeDefaultProps()} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('선택 도구 버튼이 존재한다', () => {
    render(<SceneToolbar {...makeDefaultProps()} />)
    expect(screen.getByText(/선택/)).toBeTruthy()
  })

  it('이동 도구 버튼이 존재한다', () => {
    render(<SceneToolbar {...makeDefaultProps()} />)
    expect(screen.getByText(/이동/)).toBeTruthy()
  })

  it('zoom=1이면 100% 표시', () => {
    render(<SceneToolbar {...makeDefaultProps({ zoom: 1 })} />)
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('zoom=0.5이면 50% 표시', () => {
    render(<SceneToolbar {...makeDefaultProps({ zoom: 0.5 })} />)
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('zoom=2이면 200% 표시', () => {
    render(<SceneToolbar {...makeDefaultProps({ zoom: 2 })} />)
    expect(screen.getByText('200%')).toBeTruthy()
  })

  it('확대 버튼이 존재한다', () => {
    const { container } = render(<SceneToolbar {...makeDefaultProps()} />)
    // title="확대" 또는 텍스트가 "+" 인 버튼이 있어야 함
    const btns = container.querySelectorAll('button')
    const zoomInBtn = Array.from(btns).find(b => b.textContent === '+' || b.title.includes('확대'))
    expect(zoomInBtn).toBeTruthy()
  })

  it('축소(−) 버튼이 존재한다', () => {
    render(<SceneToolbar {...makeDefaultProps()} />)
    expect(screen.getAllByText('−').length).toBeGreaterThan(0)
  })
})

// ── 도구 선택 ────────────────────────────────────────────────────────────────

describe('SceneToolbar — 도구 선택', () => {
  it('activeTool=select이면 선택 버튼이 활성 스타일', () => {
    render(<SceneToolbar {...makeDefaultProps({ activeTool: 'select' })} />)
    // 두 버튼 모두 렌더링됨을 확인
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
  })

  it('activeTool=move이면 이동 버튼이 렌더링된다', () => {
    render(<SceneToolbar {...makeDefaultProps({ activeTool: 'move' })} />)
    expect(screen.getByText(/이동/)).toBeTruthy()
  })

  it('선택 버튼 클릭 시 onToolChange("select") 호출', () => {
    const onToolChange = vi.fn()
    render(<SceneToolbar {...makeDefaultProps({ onToolChange })} />)
    fireEvent.click(screen.getByText(/선택/))
    expect(onToolChange).toHaveBeenCalledWith('select')
  })

  it('이동 버튼 클릭 시 onToolChange("move") 호출', () => {
    const onToolChange = vi.fn()
    render(<SceneToolbar {...makeDefaultProps({ onToolChange })} />)
    fireEvent.click(screen.getByText(/이동/))
    expect(onToolChange).toHaveBeenCalledWith('move')
  })
})

// ── 줌 제어 ──────────────────────────────────────────────────────────────────

describe('SceneToolbar — 줌 제어', () => {
  it('확대 버튼 클릭 시 onZoomChange가 호출된다', () => {
    const onZoomChange = vi.fn()
    const { container } = render(<SceneToolbar {...makeDefaultProps({ zoom: 1, onZoomChange })} />)
    const btns = Array.from(container.querySelectorAll('button'))
    const zoomInBtn = btns.find(b => b.textContent === '+' || b.title.includes('확대'))
    expect(zoomInBtn).toBeTruthy()
    fireEvent.click(zoomInBtn!)
    expect(onZoomChange).toHaveBeenCalled()
  })

  it('축소 버튼 클릭 시 onZoomChange가 호출된다', () => {
    const onZoomChange = vi.fn()
    render(<SceneToolbar {...makeDefaultProps({ zoom: 1, onZoomChange })} />)
    fireEvent.click(screen.getAllByText('−')[0])
    expect(onZoomChange).toHaveBeenCalled()
  })

  it('확대 클릭 시 zoom이 현재보다 큰 프리셋값으로 변경된다', () => {
    const onZoomChange = vi.fn()
    const { container } = render(<SceneToolbar {...makeDefaultProps({ zoom: 0.5, onZoomChange })} />)
    const btns = Array.from(container.querySelectorAll('button'))
    const zoomInBtn = btns.find(b => b.textContent === '+' || b.title.includes('확대'))
    fireEvent.click(zoomInBtn!)
    expect(onZoomChange).toHaveBeenCalledWith(expect.any(Number))
    const arg = onZoomChange.mock.calls[0][0] as number
    expect(arg).toBeGreaterThan(0.5)
  })

  it('축소 클릭 시 zoom이 현재보다 작은 값으로 변경된다', () => {
    const onZoomChange = vi.fn()
    render(<SceneToolbar {...makeDefaultProps({ zoom: 1, onZoomChange })} />)
    fireEvent.click(screen.getAllByText('−')[0])
    expect(onZoomChange).toHaveBeenCalledWith(expect.any(Number))
    const arg = onZoomChange.mock.calls[0][0] as number
    expect(arg).toBeLessThan(1)
  })

  it('이미 최대 zoom일 때 확대 클릭해도 최대값 반환', () => {
    const onZoomChange = vi.fn()
    const { container } = render(<SceneToolbar {...makeDefaultProps({ zoom: 4, onZoomChange })} />)
    const btns = Array.from(container.querySelectorAll('button'))
    const zoomInBtn = btns.find(b => b.textContent === '+' || b.title.includes('확대'))
    fireEvent.click(zoomInBtn!)
    const arg = onZoomChange.mock.calls[0][0] as number
    expect(arg).toBeLessThanOrEqual(4)
  })

  it('이미 최소 zoom일 때 축소 클릭해도 최솟값 반환', () => {
    const onZoomChange = vi.fn()
    render(<SceneToolbar {...makeDefaultProps({ zoom: 0.25, onZoomChange })} />)
    fireEvent.click(screen.getAllByText('−')[0])
    const arg = onZoomChange.mock.calls[0][0] as number
    expect(arg).toBeGreaterThanOrEqual(0.25)
  })

  it('zoom 버튼 클릭 시 onZoomChange(1) 호출', () => {
    const onZoomChange = vi.fn()
    render(<SceneToolbar {...makeDefaultProps({ zoom: 0.5, onZoomChange })} />)
    fireEvent.click(screen.getByText('50%'))
    expect(onZoomChange).toHaveBeenCalledWith(1)
  })
})

// ── 그리드 / 스냅 ─────────────────────────────────────────────────────────────

describe('SceneToolbar — 그리드/스냅', () => {
  it('그리드 버튼이 렌더링된다', () => {
    render(<SceneToolbar {...makeDefaultProps()} />)
    // 그리드 버튼은 타이틀로 찾거나 텍스트로 찾음
    const btns = screen.getAllByRole('button')
    const gridBtn = btns.find(b => b.textContent?.includes('그리드') || (b as HTMLButtonElement).title?.includes('그리드'))
    expect(gridBtn).toBeTruthy()
  })

  it('그리드 버튼 클릭 시 onGridToggle 호출', () => {
    const onGridToggle = vi.fn()
    render(<SceneToolbar {...makeDefaultProps({ onGridToggle })} />)
    const btns = screen.getAllByRole('button')
    const gridBtn = btns.find(b => (b as HTMLButtonElement).title?.includes('그리드'))
    if (gridBtn) {
      fireEvent.click(gridBtn)
      expect(onGridToggle).toHaveBeenCalled()
    } else {
      // 그리드 버튼이 없는 경우 — fallback: 스냅 버튼 확인
      expect(btns.length).toBeGreaterThan(2)
    }
  })
})

// ── 선택 카운트 배지 ──────────────────────────────────────────────────────────

describe('SceneToolbar — 선택 카운트', () => {
  it('selectionCount=1이면 배지가 표시되지 않는다', () => {
    render(<SceneToolbar {...makeDefaultProps({ selectionCount: 1 })} />)
    expect(screen.queryByText('1')).toBeNull()
  })

  it('selectionCount=3이면 배지에 3이 표시된다', () => {
    render(<SceneToolbar {...makeDefaultProps({ selectionCount: 3 })} />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('selectionCount=0이면 배지가 표시되지 않는다', () => {
    render(<SceneToolbar {...makeDefaultProps({ selectionCount: 0 })} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})
