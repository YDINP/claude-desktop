import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizeHandlers } from '../useResizeHandlers'

// ── localStorage mock ─────────────────────────────────────────────────────────

const localStorageMock: Record<string, string> = {}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => localStorageMock[key] ?? null,
    setItem: (key: string, value: string) => { localStorageMock[key] = value },
    removeItem: (key: string) => { delete localStorageMock[key] },
    clear: () => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]) },
  })
  Object.keys(localStorageMock).forEach(k => delete localStorageMock[k])
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── 초기 상태 ─────────────────────────────────────────────────────────────────

describe('useResizeHandlers 초기 상태', () => {
  it('terminalOpen이 false이다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.terminalOpen).toBe(false)
  })

  it('bottomHeight 기본값은 240이다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.bottomHeight).toBe(240)
  })

  it('isDragging 초기값은 false이다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.isDragging).toBe(false)
  })

  it('sidebarCollapsed 초기값은 false이다 (localStorage 미설정 시)', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.sidebarCollapsed).toBe(false)
  })

  it('sidebarWidth 기본값은 220이다 (localStorage 미설정 시)', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.sidebarWidth).toBe(220)
  })

  it('isSidebarDragging 초기값은 false이다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.isSidebarDragging).toBe(false)
  })

  it('agentBayWidth 기본값은 260이다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.agentBayWidth).toBe(260)
  })

  it('isAgentBayDragging 초기값은 false이다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.isAgentBayDragging).toBe(false)
  })

  it('agentBayDragStartX ref가 존재한다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.agentBayDragStartX).toBeDefined()
    expect(result.current.agentBayDragStartX.current).toBe(0)
  })

  it('agentBayDragStartW ref가 존재한다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.agentBayDragStartW).toBeDefined()
    expect(result.current.agentBayDragStartW.current).toBe(0)
  })
})

// ── localStorage 복원 ─────────────────────────────────────────────────────────

describe('localStorage 복원', () => {
  it('sidebar-collapsed=true이면 sidebarCollapsed가 true로 초기화된다', () => {
    localStorageMock['sidebar-collapsed'] = 'true'
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.sidebarCollapsed).toBe(true)
  })

  it('sidebar-width=350이면 sidebarWidth가 350으로 초기화된다', () => {
    localStorageMock['sidebar-width'] = '350'
    const { result } = renderHook(() => useResizeHandlers())
    expect(result.current.sidebarWidth).toBe(350)
  })
})

// ── 상태 변경 ─────────────────────────────────────────────────────────────────

describe('상태 변경', () => {
  it('setTerminalOpen(true) → terminalOpen이 true가 된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    act(() => { result.current.setTerminalOpen(true) })
    expect(result.current.terminalOpen).toBe(true)
  })

  it('setSidebarCollapsed(true) → localStorage에 저장된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    act(() => { result.current.setSidebarCollapsed(true) })
    expect(result.current.sidebarCollapsed).toBe(true)
    expect(localStorageMock['sidebar-collapsed']).toBe('true')
  })

  it('setSidebarWidth(300) → localStorage에 저장된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    act(() => { result.current.setSidebarWidth(300) })
    expect(result.current.sidebarWidth).toBe(300)
    expect(localStorageMock['sidebar-width']).toBe('300')
  })

  it('setAgentBayWidth(400) → agentBayWidth가 업데이트된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    act(() => { result.current.setAgentBayWidth(400) })
    expect(result.current.agentBayWidth).toBe(400)
  })

  it('setIsAgentBayDragging(true) → isAgentBayDragging이 true가 된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    act(() => { result.current.setIsAgentBayDragging(true) })
    expect(result.current.isAgentBayDragging).toBe(true)
  })
})

// ── Splitter 드래그 ───────────────────────────────────────────────────────────

describe('handleSplitterMouseDown', () => {
  it('handleSplitterMouseDown 호출 시 isDragging이 true가 된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientY: 400 } as React.MouseEvent
    act(() => { result.current.handleSplitterMouseDown(fakeEvent) })
    expect(result.current.isDragging).toBe(true)
  })

  it('mouseup 이벤트 후 isDragging이 false로 돌아온다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientY: 400 } as React.MouseEvent
    act(() => { result.current.handleSplitterMouseDown(fakeEvent) })
    expect(result.current.isDragging).toBe(true)

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'))
    })
    expect(result.current.isDragging).toBe(false)
  })

  it('mousemove로 bottomHeight가 변경된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    // 현재 bottomHeight = 240, dragStartY = 400
    const fakeEvent = { clientY: 400 } as React.MouseEvent
    act(() => { result.current.handleSplitterMouseDown(fakeEvent) })

    // 50px 위로 드래그 → delta=50 → 240+50=290
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 350 }))
    })
    expect(result.current.bottomHeight).toBe(290)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })

  it('bottomHeight는 최소 80 이하로 내려가지 않는다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientY: 100 } as React.MouseEvent
    act(() => { result.current.handleSplitterMouseDown(fakeEvent) })

    // 현재 dragStartH=240, 드래그 down → delta 음수
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 500 }))
    })
    expect(result.current.bottomHeight).toBeGreaterThanOrEqual(80)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })

  it('bottomHeight는 최대 600 이상으로 올라가지 않는다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientY: 1000 } as React.MouseEvent
    act(() => { result.current.handleSplitterMouseDown(fakeEvent) })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 0 }))
    })
    expect(result.current.bottomHeight).toBeLessThanOrEqual(600)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })
})

// ── Sidebar 드래그 ────────────────────────────────────────────────────────────

describe('handleSidebarDragMouseDown', () => {
  it('handleSidebarDragMouseDown 호출 시 isSidebarDragging이 true가 된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientX: 220, preventDefault: vi.fn() } as unknown as React.MouseEvent
    act(() => { result.current.handleSidebarDragMouseDown(fakeEvent) })
    expect(result.current.isSidebarDragging).toBe(true)
  })

  it('mouseup 후 isSidebarDragging이 false로 돌아온다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientX: 220, preventDefault: vi.fn() } as unknown as React.MouseEvent
    act(() => { result.current.handleSidebarDragMouseDown(fakeEvent) })
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
    expect(result.current.isSidebarDragging).toBe(false)
  })

  it('mousemove로 sidebarWidth가 변경된다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientX: 220, preventDefault: vi.fn() } as unknown as React.MouseEvent
    act(() => { result.current.handleSidebarDragMouseDown(fakeEvent) })

    // 50px 오른쪽으로 드래그 → 220+50=270
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 270 }))
    })
    expect(result.current.sidebarWidth).toBe(270)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })

  it('sidebarWidth는 최소 160 이하로 내려가지 않는다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientX: 220, preventDefault: vi.fn() } as unknown as React.MouseEvent
    act(() => { result.current.handleSidebarDragMouseDown(fakeEvent) })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }))
    })
    expect(result.current.sidebarWidth).toBeGreaterThanOrEqual(160)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })

  it('sidebarWidth는 최대 500 이상으로 올라가지 않는다', () => {
    const { result } = renderHook(() => useResizeHandlers())
    const fakeEvent = { clientX: 220, preventDefault: vi.fn() } as unknown as React.MouseEvent
    act(() => { result.current.handleSidebarDragMouseDown(fakeEvent) })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }))
    })
    expect(result.current.sidebarWidth).toBeLessThanOrEqual(500)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })
})

// ── AgentBay 드래그 ───────────────────────────────────────────────────────────

describe('AgentBay 드래그', () => {
  it('isAgentBayDragging=true 상태에서 mousemove로 agentBayWidth가 변경된다', () => {
    const { result } = renderHook(() => useResizeHandlers())

    act(() => {
      result.current.agentBayDragStartX.current = 260
      result.current.agentBayDragStartW.current = 260
      result.current.setIsAgentBayDragging(true)
    })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 310 }))
    })
    expect(result.current.agentBayWidth).toBe(310)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })

  it('agentBayWidth는 최소 180 이하로 내려가지 않는다', () => {
    const { result } = renderHook(() => useResizeHandlers())

    act(() => {
      result.current.agentBayDragStartX.current = 260
      result.current.agentBayDragStartW.current = 260
      result.current.setIsAgentBayDragging(true)
    })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }))
    })
    expect(result.current.agentBayWidth).toBeGreaterThanOrEqual(180)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })

  it('agentBayWidth는 최대 480 이상으로 올라가지 않는다', () => {
    const { result } = renderHook(() => useResizeHandlers())

    act(() => {
      result.current.agentBayDragStartX.current = 260
      result.current.agentBayDragStartW.current = 260
      result.current.setIsAgentBayDragging(true)
    })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }))
    })
    expect(result.current.agentBayWidth).toBeLessThanOrEqual(480)

    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
  })

  it('mouseup 후 isAgentBayDragging이 false로 돌아온다', () => {
    const { result } = renderHook(() => useResizeHandlers())

    act(() => { result.current.setIsAgentBayDragging(true) })
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })
    expect(result.current.isAgentBayDragging).toBe(false)
  })
})

// React import for type reference
import type React from 'react'
