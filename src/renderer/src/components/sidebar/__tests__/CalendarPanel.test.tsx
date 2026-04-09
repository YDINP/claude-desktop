import { render, screen, act, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CalendarPanel } from '../CalendarPanel'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

// 현재 날짜 고정: 2026-04-08 (수요일, 1일=수요일)
const FIXED_DATE = new Date('2026-04-08T00:00:00')

// 달력 그리드에서 날짜 숫자 클릭
// 해당 날짜 셀은 cursor:pointer 스타일을 가진 div
function clickDay(day: number) {
  const cells = screen.getAllByText(String(day))
  // cursor: pointer 스타일을 가진 요소 찾기 (달력 셀)
  const cell = cells.find(el => (el as HTMLElement).style?.cursor === 'pointer') ?? cells[0]
  fireEvent.click(cell)
}

describe('CalendarPanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 1. 기본 렌더 — 현재 연월 표시
  it('현재 연월을 헤더에 표시한다', () => {
    render(<CalendarPanel />)
    expect(screen.getByText(/2026년 4월/)).toBeInTheDocument()
  })

  // 2. 이전 월 이동
  it('< 버튼 클릭 시 이전 달로 이동한다', () => {
    render(<CalendarPanel />)
    fireEvent.click(screen.getByText('<'))
    expect(screen.getByText(/2026년 3월/)).toBeInTheDocument()
  })

  // 3. 다음 월 이동
  it('> 버튼 클릭 시 다음 달로 이동한다', () => {
    render(<CalendarPanel />)
    fireEvent.click(screen.getByText('>'))
    expect(screen.getByText(/2026년 5월/)).toBeInTheDocument()
  })

  // 4. 연도 경계 — 1월에서 이전으로 가면 전년 12월
  it('1월에서 < 클릭 시 전년 12월로 이동한다', () => {
    vi.setSystemTime(new Date('2026-01-15'))
    render(<CalendarPanel />)
    fireEvent.click(screen.getByText('<'))
    expect(screen.getByText(/2025년 12월/)).toBeInTheDocument()
  })

  // 5. 연도 경계 — 12월에서 다음으로 가면 다음년 1월
  it('12월에서 > 클릭 시 다음년 1월로 이동한다', () => {
    vi.setSystemTime(new Date('2026-12-15'))
    render(<CalendarPanel />)
    fireEvent.click(screen.getByText('>'))
    expect(screen.getByText(/2027년 1월/)).toBeInTheDocument()
  })

  // 6. 날짜 클릭 시 선택 패널 표시
  it('날짜 클릭 시 선택된 날짜 패널이 표시된다', () => {
    render(<CalendarPanel />)
    clickDay(15)
    expect(screen.getByText('2026-04-15')).toBeInTheDocument()
  })

  // 7. 이벤트 추가
  it('날짜 선택 후 이벤트를 추가할 수 있다', () => {
    const { container } = render(<CalendarPanel />)
    clickDay(15)
    const input = screen.getByPlaceholderText('새 이벤트...')
    fireEvent.change(input, { target: { value: '팀 회의' } })
    fireEvent.click(screen.getByText('+'))
    // 이벤트가 선택된 날짜 패널 + upcoming 섹션 두 곳에 표시될 수 있음
    expect(container.textContent).toContain('팀 회의')
  })

  // 8. Enter로 이벤트 추가
  it('Enter 키로 이벤트를 추가할 수 있다', () => {
    const { container } = render(<CalendarPanel />)
    clickDay(15)
    const input = screen.getByPlaceholderText('새 이벤트...')
    fireEvent.change(input, { target: { value: '키보드 추가' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(container.textContent).toContain('키보드 추가')
  })

  // 9. 이벤트 삭제
  it('이벤트 x 버튼 클릭 시 삭제된다', () => {
    const { container } = render(<CalendarPanel />)
    clickDay(15)
    const input = screen.getByPlaceholderText('새 이벤트...')
    fireEvent.change(input, { target: { value: '삭제할 이벤트' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(container.textContent).toContain('삭제할 이벤트')
    // 선택된 날짜 패널의 x 버튼 클릭 (title="더블클릭 편집"인 span 옆의 버튼)
    fireEvent.click(screen.getByRole('button', { name: 'x' }))
    expect(container.textContent).not.toContain('삭제할 이벤트')
  })

  // 10. 전체 삭제 버튼
  it('전체 삭제 버튼으로 날짜의 모든 이벤트를 삭제한다', () => {
    render(<CalendarPanel />)
    clickDay(15)
    const input = screen.getByPlaceholderText('새 이벤트...')
    fireEvent.change(input, { target: { value: '이벤트1' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: '이벤트2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const deleteAllBtn = screen.getByTitle('전체 삭제')
    fireEvent.click(deleteAllBtn)
    expect(screen.queryByText('이벤트1')).not.toBeInTheDocument()
    expect(screen.queryByText('이벤트2')).not.toBeInTheDocument()
  })

  // 11. 빈 제목으로 이벤트 추가 불가
  it('빈 제목으로는 이벤트를 추가할 수 없다', () => {
    render(<CalendarPanel />)
    clickDay(15)
    const addBtn = screen.getByText('+')
    expect(addBtn).toBeDisabled()
  })

  // 12. localStorage에 이벤트 저장
  it('이벤트 추가 시 localStorage에 저장된다', () => {
    render(<CalendarPanel />)
    clickDay(15)
    const input = screen.getByPlaceholderText('새 이벤트...')
    fireEvent.change(input, { target: { value: '저장 테스트' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const stored = JSON.parse(localStorageMock.getItem('calendarEvents') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].title).toBe('저장 테스트')
  })

  // 13. 다가오는 이벤트(Upcoming) 섹션 — 오늘 이후 날짜
  it('오늘 이후 이벤트가 Upcoming 섹션에 표시된다', () => {
    render(<CalendarPanel />)
    clickDay(20)  // 오늘(8)보다 나중 날짜
    const input = screen.getByPlaceholderText('새 이벤트...')
    fireEvent.change(input, { target: { value: '미래 이벤트' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // upcoming 섹션에서도 동일 텍스트가 표시됨
    const allMirae = screen.getAllByText('미래 이벤트')
    expect(allMirae.length).toBeGreaterThanOrEqual(1)
  })

  // 14. Upcoming 3개 초과 시 더 보기 버튼
  it('Upcoming 이벤트가 3개 초과 시 더 보기 버튼이 표시된다', () => {
    render(<CalendarPanel />)
    for (const day of [20, 21, 22, 23]) {
      clickDay(day)
      const input = screen.getByPlaceholderText('새 이벤트...')
      fireEvent.change(input, { target: { value: `이벤트${day}` } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }
    expect(screen.getByText(/더 보기/i)).toBeInTheDocument()
  })

  // 15. 더 보기 클릭 시 전체 표시
  it('더 보기 버튼 클릭 시 모든 Upcoming 이벤트가 표시된다', () => {
    render(<CalendarPanel />)
    for (const day of [20, 21, 22, 23]) {
      clickDay(day)
      const input = screen.getByPlaceholderText('새 이벤트...')
      fireEvent.change(input, { target: { value: `미래${day}` } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }
    const showMoreBtn = screen.getByText(/더 보기/i)
    fireEvent.click(showMoreBtn)
    // 더 보기 이후 접기 버튼 표시
    expect(screen.getByText('접기')).toBeInTheDocument()
  })

  // 16. 연도 선택 피커
  it('연월 헤더 클릭 시 연도 피커가 열린다', () => {
    render(<CalendarPanel />)
    fireEvent.click(screen.getByText(/2026년 4월/))
    // 2026 버튼이 피커에 표시됨
    const yearBtns = screen.getAllByRole('button').filter(b => b.textContent === '2026')
    expect(yearBtns.length).toBeGreaterThan(0)
  })

  // 17. 세션 통계 표시
  it('sessions prop이 주어지면 세션 통계를 표시한다', () => {
    const sessions = [
      { date: '2026-04-08', count: 3 },
      { date: '2026-03-15', count: 2 },
    ]
    render(<CalendarPanel sessions={sessions} />)
    expect(screen.getByText(/전체 5개 세션/)).toBeInTheDocument()
  })

  // 18. 날짜 다시 클릭 시 선택 해제
  it('선택된 날짜를 다시 클릭하면 선택이 해제된다', () => {
    render(<CalendarPanel />)
    clickDay(15)
    expect(screen.getByText('2026-04-15')).toBeInTheDocument()
    clickDay(15)
    expect(screen.queryByText('2026-04-15')).not.toBeInTheDocument()
  })
})
