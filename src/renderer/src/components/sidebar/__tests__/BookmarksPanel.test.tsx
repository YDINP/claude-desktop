import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BookmarksPanel } from '../BookmarksPanel'

// clipboard mock
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

// downloadFile mock
vi.mock('../../../utils/download', () => ({
  downloadFile: vi.fn(),
}))

type Role = 'user' | 'assistant'

function makeMsg(id: string, text: string, role: Role = 'assistant', timestamp = 1000) {
  return { id, text, role, bookmarked: true, timestamp }
}

const MSGS = [
  makeMsg('m1', '안녕하세요', 'user', 1000),
  makeMsg('m2', 'Claude 응답입니다', 'assistant', 2000),
]

describe('BookmarksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. 빈 상태
  it('북마크가 없으면 빈 상태 메시지가 표시된다', () => {
    render(<BookmarksPanel messages={[]} />)
    expect(screen.getByText(/북마크된 메시지 없음/)).toBeInTheDocument()
  })

  // 2. 북마크 표시
  it('북마크된 메시지 목록이 표시된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    expect(screen.getByText('안녕하세요')).toBeInTheDocument()
    expect(screen.getByText('Claude 응답입니다')).toBeInTheDocument()
  })

  // 3. 북마크 개수
  it('북마크 개수가 헤더에 표시된다', () => {
    const { container } = render(<BookmarksPanel messages={MSGS} />)
    // "북마크 2" — 텍스트 노드가 분리되므로 container 전체에서 확인
    expect(container.textContent).toContain('2')
  })

  // 4. 검색 필터링
  it('검색어 입력 시 일치하는 메시지만 표시된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    fireEvent.change(screen.getByPlaceholderText(/북마크 검색/i), { target: { value: '안녕' } })
    expect(screen.getByText('안녕하세요')).toBeInTheDocument()
    expect(screen.queryByText('Claude 응답입니다')).not.toBeInTheDocument()
  })

  // 5. 검색 결과 없음
  it('검색 결과가 없으면 결과없음 메시지가 표시된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    fireEvent.change(screen.getByPlaceholderText(/북마크 검색/i), { target: { value: 'zzz없음' } })
    expect(screen.getByText(/검색 결과 없음/)).toBeInTheDocument()
  })

  // 6. Escape 검색 초기화
  it('검색창에서 Escape 입력 시 검색어가 초기화된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    const input = screen.getByPlaceholderText(/북마크 검색/i)
    fireEvent.change(input, { target: { value: '안녕' } })
    expect(screen.queryByText('Claude 응답입니다')).not.toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByText('Claude 응답입니다')).toBeInTheDocument()
  })

  // 7. 필터된 개수/전체 개수 표시
  it('검색 중에는 필터된수/전체수 형식으로 표시된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    fireEvent.change(screen.getByPlaceholderText(/북마크 검색/i), { target: { value: '안녕' } })
    expect(screen.getByText(/1/)).toBeInTheDocument()
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  // 8. 정렬 버튼 클릭
  it('정렬 버튼 클릭 시 sortOrder가 변경된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    const sortBtn = screen.getByTitle(/정렬/)
    fireEvent.click(sortBtn)
    // 최신순 아이콘으로 변경됨
    expect(screen.getByTitle(/정렬/)).toBeInTheDocument()
  })

  // 9. 역할 필터 클릭
  it('역할 필터 버튼 클릭 시 역할 필터가 변경된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    const roleBtn = screen.getByTitle(/역할 필터/)
    fireEvent.click(roleBtn)
    // 필터 후 user 메시지만 표시
    expect(screen.getByText('안녕하세요')).toBeInTheDocument()
  })

  // 10. 내보내기 버튼 존재
  it('내보내기 버튼이 표시된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    expect(screen.getByTitle(/마크다운으로 내보내기/)).toBeInTheDocument()
  })

  // 11. 내보내기 클릭 시 downloadFile 호출
  it('내보내기 클릭 시 downloadFile이 호출된다', async () => {
    const { downloadFile } = await import('../../../utils/download')
    render(<BookmarksPanel messages={MSGS} />)
    fireEvent.click(screen.getByTitle(/마크다운으로 내보내기/))
    expect(downloadFile).toHaveBeenCalled()
  })

  // 12. onScrollToMessage 콜백
  it('메시지 클릭 시 onScrollToMessage가 호출된다', () => {
    const handler = vi.fn()
    render(<BookmarksPanel messages={MSGS} onScrollToMessage={handler} />)
    fireEvent.click(screen.getByText('안녕하세요'))
    expect(handler).toHaveBeenCalledWith('m1')
  })

  // 13. 펼치기 버튼
  it('펼치기 버튼 클릭 시 접기 버튼으로 바뀐다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    const expandBtns = screen.getAllByTitle(/펼치기/)
    fireEvent.click(expandBtns[0])
    expect(screen.getAllByTitle(/접기/).length).toBeGreaterThan(0)
  })

  // 14. 전체 복사 버튼 존재
  it('전체 복사 버튼이 표시된다', () => {
    render(<BookmarksPanel messages={MSGS} />)
    expect(screen.getByTitle(/전체 클립보드/i)).toBeInTheDocument()
  })

  // 15. bookmarked=false 메시지는 표시 안 됨
  it('bookmarked=false 인 메시지는 목록에 표시되지 않는다', () => {
    const msgs = [
      { id: 'x1', text: '북마크 없는 메시지', role: 'user' as Role, bookmarked: false, timestamp: 1000 },
      ...MSGS,
    ]
    render(<BookmarksPanel messages={msgs} />)
    expect(screen.queryByText('북마크 없는 메시지')).not.toBeInTheDocument()
  })
})
