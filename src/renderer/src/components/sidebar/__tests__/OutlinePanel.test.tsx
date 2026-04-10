import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OutlinePanel } from '../OutlinePanel'

// clipboard mock
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

type Role = 'user' | 'assistant'

function makeMsg(id: string, text: string, role: Role = 'assistant', timestamp = 1000) {
  return { id, text, role, timestamp, bookmarked: false }
}

const MESSAGES = [
  makeMsg('m1', '# 제목 1\n본문 텍스트', 'assistant'),
  makeMsg('m2', '## 소제목 2\n내용\n### 하위 섹션 3', 'assistant'),
  makeMsg('m3', '사용자 메시지', 'user'),
  makeMsg('m4', '# 또 다른 제목', 'assistant'),
]

describe('OutlinePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. 빈 메시지 - 헤딩 없음 표시
  it('메시지가 없으면 헤딩 없음이 표시된다', () => {
    render(<OutlinePanel messages={[]} />)
    expect(screen.getByText(/헤딩 없음/)).toBeInTheDocument()
  })

  // 2. 헤딩 추출 및 표시
  it('assistant 메시지의 헤딩이 표시된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    expect(screen.getByText('제목 1')).toBeInTheDocument()
    expect(screen.getByText('소제목 2')).toBeInTheDocument()
    expect(screen.getByText('하위 섹션 3')).toBeInTheDocument()
    expect(screen.getByText('또 다른 제목')).toBeInTheDocument()
  })

  // 3. user 메시지는 헤딩 추출 안 함
  it('user 메시지의 헤딩 패턴은 추출하지 않는다', () => {
    const userMsgWithHeader = [makeMsg('u1', '# 유저 헤딩', 'user')]
    render(<OutlinePanel messages={userMsgWithHeader} />)
    expect(screen.getByText(/헤딩 없음/)).toBeInTheDocument()
  })

  // 4. 헤딩 개수 표시
  it('헤딩 총 개수가 표시된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    expect(screen.getByText('4개')).toBeInTheDocument()
  })

  // 5. 검색 입력창 표시
  it('검색 입력창이 표시된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    expect(screen.getByPlaceholderText(/헤딩 검색/)).toBeInTheDocument()
  })

  // 6. 검색 필터링
  it('검색어 입력 시 일치하는 헤딩만 표시된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    const searchInput = screen.getByPlaceholderText(/헤딩 검색/)
    fireEvent.change(searchInput, { target: { value: '제목 1' } })
    expect(screen.getByText('제목 1')).toBeInTheDocument()
    expect(screen.queryByText('소제목 2')).not.toBeInTheDocument()
  })

  // 7. 검색 결과 없음
  it('검색 결과가 없으면 검색 결과 없음이 표시된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    fireEvent.change(screen.getByPlaceholderText(/헤딩 검색/), { target: { value: '존재하지않는헤딩' } })
    expect(screen.getByText(/검색 결과 없음/)).toBeInTheDocument()
  })

  // 8. Escape 키로 검색 초기화
  it('검색창에서 Escape 키 누르면 검색어가 초기화된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    const searchInput = screen.getByPlaceholderText(/헤딩 검색/)
    fireEvent.change(searchInput, { target: { value: '제목' } })
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(searchInput).toHaveValue('')
  })

  // 9. 헤딩 클릭 시 onScrollToMsg 호출
  it('헤딩 클릭 시 onScrollToMsg가 호출된다', () => {
    const onScrollToMsg = vi.fn()
    render(<OutlinePanel messages={MESSAGES} onScrollToMsg={onScrollToMsg} />)
    fireEvent.click(screen.getByText('제목 1'))
    expect(onScrollToMsg).toHaveBeenCalledWith(0) // msgIndex = 0
  })

  // 10. 아웃라인 전체 복사 버튼
  it('아웃라인 복사 버튼 클릭 시 클립보드에 복사된다', async () => {
    render(<OutlinePanel messages={MESSAGES} />)
    const copyBtn = screen.getByTitle(/아웃라인 복사/)
    fireEvent.click(copyBtn)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(copied).toContain('# 제목 1')
    expect(copied).toContain('## 소제목 2')
  })

  // 11. H1/H2/H3 레벨 필터 버튼 표시
  it('H1/H2/H3 레벨 필터 버튼이 표시된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    // title 속성으로 버튼 확인
    expect(screen.getByTitle(/H1만 보기/)).toBeInTheDocument()
    expect(screen.getByTitle(/H2만 보기/)).toBeInTheDocument()
    expect(screen.getByTitle(/H3만 보기/)).toBeInTheDocument()
  })

  // 12. H1 필터 적용 시 H1 헤딩만 표시
  it('H1 필터 클릭 시 H1 헤딩만 표시된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    fireEvent.click(screen.getByTitle(/H1만 보기/))
    expect(screen.getByText('제목 1')).toBeInTheDocument()
    expect(screen.getByText('또 다른 제목')).toBeInTheDocument()
    expect(screen.queryByText('소제목 2')).not.toBeInTheDocument()
    expect(screen.queryByText('하위 섹션 3')).not.toBeInTheDocument()
  })

  // 13. H1 필터 재클릭 시 해제
  it('H1 필터 버튼 재클릭 시 필터가 해제된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    const h1Btn = screen.getByTitle(/H1만 보기/)
    fireEvent.click(h1Btn)
    fireEvent.click(h1Btn)
    expect(screen.getByText('소제목 2')).toBeInTheDocument()
  })

  // 14. 역순 정렬 버튼
  it('↓ 버튼 클릭 시 헤딩이 역순으로 표시된다', () => {
    render(<OutlinePanel messages={MESSAGES} />)
    const reverseBtn = screen.getByTitle(/최신 항목 먼저/)
    fireEvent.click(reverseBtn)
    const items = screen.getAllByText(/제목|소제목|하위 섹션/)
    // 역순이면 마지막 헤딩이 먼저 나와야 함
    expect(items[0]).toHaveTextContent('또 다른 제목')
  })

  // 15. 헤딩별 개별 복사 버튼 (호버 시 표시)
  it('헤딩 개별 복사 버튼 클릭 시 클립보드에 복사된다', async () => {
    render(<OutlinePanel messages={MESSAGES} />)
    // 헤딩 복사 버튼 (title="헤딩 복사")
    const headingCopyBtns = screen.getAllByTitle(/헤딩 복사/)
    fireEvent.click(headingCopyBtns[0])
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# 제목 1'))
  })

  // 16. 헤딩 클릭 시 onScrollToMsg 호출로 활성화 확인
  it('헤딩 클릭 시 활성화되고 onScrollToMsg가 호출된다', () => {
    const onScrollToMsg = vi.fn()
    render(<OutlinePanel messages={MESSAGES} onScrollToMsg={onScrollToMsg} />)
    fireEvent.click(screen.getByText('소제목 2'))
    expect(onScrollToMsg).toHaveBeenCalledWith(1) // msgIndex = 1
  })
})
