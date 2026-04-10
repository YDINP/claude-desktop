import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GlobalSearchPanel } from '../GlobalSearchPanel'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

const RESULTS = [
  { sessionId: 's1', sessionTitle: '세션 A', messageIndex: 0, role: 'user', excerpt: 'hello world', updatedAt: 1700000000000 },
  { sessionId: 's1', sessionTitle: '세션 A', messageIndex: 1, role: 'assistant', excerpt: 'hello response', updatedAt: 1700000001000 },
  { sessionId: 's2', sessionTitle: '세션 B', messageIndex: 0, role: 'user', excerpt: 'another message', updatedAt: 1600000000000 },
]

function mockApi(overrides: Record<string, unknown> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      sessionSearchAll: vi.fn().mockResolvedValue(RESULTS),
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

const DEFAULT_PROPS = { onSelectSession: vi.fn() }

describe('GlobalSearchPanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    mockApi()
  })

  // 1. 기본 렌더
  it('검색 입력창이 표시된다', () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    expect(screen.getByPlaceholderText(/전체 세션 검색/)).toBeInTheDocument()
  })

  // 2. 빈 상태 — 결과 없음 메시지 미표시
  it('초기 상태에서 결과 없음 메시지가 보이지 않는다', () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    expect(screen.queryByText(/결과 없음/)).not.toBeInTheDocument()
  })

  // 3. 1자 입력 시 검색 미호출
  it('검색어 1자이면 sessionSearchAll이 호출되지 않는다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    fireEvent.change(screen.getByPlaceholderText(/전체 세션 검색/), { target: { value: 'a' } })
    await new Promise(r => setTimeout(r, 600))
    expect(window.api.sessionSearchAll).not.toHaveBeenCalled()
  })

  // 4. Enter 키로 즉시 검색
  it('Enter 키 입력 시 sessionSearchAll이 호출된다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(window.api.sessionSearchAll).toHaveBeenCalledWith('hello'))
  })

  // 5. 검색 결과 세션 제목 표시
  it('검색 결과 세션 제목이 표시된다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getAllByText('세션 A').length).toBeGreaterThan(0))
  })

  // 6. 검색 결과 발췌 표시 (highlightQuery로 텍스트가 분리되므로 partial match 사용)
  it('검색 결과 발췌 텍스트가 표시된다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText(/world/)).toBeInTheDocument())
  })

  // 7. 결과 클릭 시 onSelectSession 호출
  it('결과 항목 클릭 시 onSelectSession이 호출된다', async () => {
    const onSelectSession = vi.fn()
    render(<GlobalSearchPanel onSelectSession={onSelectSession} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByText(/world/))
    // 세션 제목 클릭
    fireEvent.click(screen.getAllByText('세션 A')[0].closest('div[style*="cursor"]')!)
    expect(onSelectSession).toHaveBeenCalledWith('s1')
  })

  // 8. 결과 없을 때 메시지
  it('검색 결과가 없으면 결과 없음 메시지가 표시된다', async () => {
    mockApi({ sessionSearchAll: vi.fn().mockResolvedValue([]) })
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'noresult' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText(/결과 없음/)).toBeInTheDocument())
  })

  // 9. role 필터 — Claude(assistant) 필터링
  it('Claude 필터 클릭 시 assistant 결과만 표시된다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByText(/world/))
    // 필터 버튼의 'Claude' 클릭 (role 표시 'Claude'와 구분: 필터버튼은 버튼 엘리먼트)
    const claudeFilterBtn = screen.getAllByText('Claude').find(el => el.tagName === 'BUTTON')!
    fireEvent.click(claudeFilterBtn)
    // user 결과 ' world'는 사라지고 'response'는 남음
    expect(screen.queryByText(/world/)).not.toBeInTheDocument()
    expect(screen.getByText(/response/)).toBeInTheDocument()
  })

  // 10. role 필터 — 나(user) 필터링
  it('나 필터 클릭 시 user 결과만 표시된다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByText(/world/))
    const naFilterBtn = screen.getAllByText('나').find(el => el.tagName === 'BUTTON')!
    fireEvent.click(naFilterBtn)
    // assistant result 'response' 사라짐
    expect(screen.queryByText(/response/)).not.toBeInTheDocument()
    expect(screen.getByText(/world/)).toBeInTheDocument()
  })

  // 11. 결과 건수 표시
  it('검색 결과 건수가 표시된다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText(/3건/)).toBeInTheDocument())
  })

  // 12. 날짜순 정렬 토글
  it('정렬 버튼 클릭 시 날짜순으로 바뀐다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByTitle(/날짜순으로 정렬/))
    fireEvent.click(screen.getByTitle(/날짜순으로 정렬/))
    expect(screen.getByTitle(/관련성순으로 정렬/)).toBeInTheDocument()
  })

  // 13. Escape 키로 초기화
  it('Escape 키 입력 시 쿼리와 결과가 초기화된다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByText(/world/))
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText(/world/)).not.toBeInTheDocument()
  })

  // 14. 검색 후 히스토리에 저장
  it('검색 후 포커스 시 히스토리가 표시된다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'myquery' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(window.api.sessionSearchAll).toHaveBeenCalled())
    // blur → focus
    fireEvent.blur(input)
    await act(async () => { await new Promise(r => setTimeout(r, 200)) })
    // clear input then focus to show history
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.focus(input)
    await waitFor(() => expect(screen.getByText('myquery')).toBeInTheDocument())
  })

  // 15. 히스토리 전체 삭제
  it('최근 검색 전체 삭제 버튼 클릭 시 히스토리가 비워진다', async () => {
    render(<GlobalSearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/전체 세션 검색/)
    fireEvent.change(input, { target: { value: 'saved' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(window.api.sessionSearchAll).toHaveBeenCalled())
    fireEvent.blur(input)
    await act(async () => { await new Promise(r => setTimeout(r, 200)) })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.focus(input)
    await waitFor(() => screen.getByText('전체 삭제'))
    fireEvent.click(screen.getByText('전체 삭제'))
    expect(screen.queryByText('saved')).not.toBeInTheDocument()
  })
})
