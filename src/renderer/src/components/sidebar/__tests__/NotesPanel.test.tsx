import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import NotesPanel from '../NotesPanel'

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

describe('NotesPanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  // 1. 기본 렌더 — 빈 상태
  it('기본 렌더 시 노트 0개 표시', () => {
    render(<NotesPanel />)
    expect(screen.getByText(/노트 0개/)).toBeInTheDocument()
  })

  // 2. + 버튼으로 노트 추가 → 에디터 뷰 전환
  it('+ 버튼 클릭 시 에디터 뷰로 전환된다', () => {
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('새 노트'))
    expect(screen.getByDisplayValue('새 노트')).toBeInTheDocument()
  })

  // 3. 에디터 → 목록으로 돌아오면 노트 표시
  it('에디터에서 목록으로 돌아오면 노트가 표시된다', () => {
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('새 노트'))
    const titleInput = screen.getByDisplayValue('새 노트')
    fireEvent.change(titleInput, { target: { value: '테스트 노트' } })
    fireEvent.click(screen.getByText(/< 목록/i))
    expect(screen.getByText('테스트 노트')).toBeInTheDocument()
  })

  // 4. 노트 개수 카운트 업데이트
  it('노트 추가 시 개수가 업데이트된다', () => {
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('새 노트'))
    fireEvent.click(screen.getByText(/< 목록/i))
    expect(screen.getByText(/노트 1개/)).toBeInTheDocument()
  })

  // 5. 노트 삭제
  it('노트 삭제 버튼 클릭 시 목록에서 제거된다', () => {
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('새 노트'))
    const titleInput = screen.getByDisplayValue('새 노트')
    fireEvent.change(titleInput, { target: { value: '삭제할 노트' } })
    fireEvent.click(screen.getByText(/< 목록/i))
    fireEvent.click(screen.getByTitle('삭제'))
    expect(screen.queryByText('삭제할 노트')).not.toBeInTheDocument()
    expect(screen.getByText(/노트 0개/)).toBeInTheDocument()
  })

  // 6. 검색 — 제목으로 필터링 (highlight로 인해 getByText 대신 queryAllByText 또는 getByDisplayValue 불가, container 직접 확인)
  it('검색어 입력 시 제목으로 필터링된다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '리액트 가이드', content: '', pinned: false, createdAt: 1000, updatedAt: 1000 },
      { id: 'n2', title: '뷰 가이드', content: '', pinned: false, createdAt: 2000, updatedAt: 2000 },
    ]))
    const { container } = render(<NotesPanel />)
    const searchInput = screen.getByPlaceholderText('노트 검색...')
    fireEvent.change(searchInput, { target: { value: '리액트' } })
    // highlight된 경우 '리액트' + ' 가이드' 분리되므로 DOM에서 textContent로 확인
    expect(container.textContent).toContain('리액트 가이드')
    expect(container.textContent).not.toContain('뷰 가이드')
  })

  // 7. 검색 — 내용 필터링
  it('검색어가 내용에 포함된 노트도 표시한다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '일반 노트', content: 'zustand 상태관리', pinned: false, createdAt: 1000, updatedAt: 1000 },
      { id: 'n2', title: '다른 노트', content: 'redux toolkit', pinned: false, createdAt: 2000, updatedAt: 2000 },
    ]))
    const { container } = render(<NotesPanel />)
    const searchInput = screen.getByPlaceholderText('노트 검색...')
    fireEvent.change(searchInput, { target: { value: 'zustand' } })
    expect(container.textContent).toContain('일반 노트')
    expect(container.textContent).not.toContain('다른 노트')
  })

  // 8. 검색어 ESC로 초기화
  it('검색창에서 ESC 키 입력 시 검색어가 초기화된다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '노트1', content: '', pinned: false, createdAt: 1, updatedAt: 1 },
      { id: 'n2', title: '노트2', content: '', pinned: false, createdAt: 2, updatedAt: 2 },
    ]))
    const { container } = render(<NotesPanel />)
    const searchInput = screen.getByPlaceholderText('노트 검색...')
    fireEvent.change(searchInput, { target: { value: '노트1' } })
    expect(container.textContent).not.toContain('노트2')
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(container.textContent).toContain('노트2')
  })

  // 9. 검색 결과 없으면 '검색 결과 없음' 표시
  it('검색 결과 없으면 검색 결과 없음 메시지가 표시된다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '노트', content: '', pinned: false, createdAt: 1, updatedAt: 1 },
    ]))
    render(<NotesPanel />)
    const searchInput = screen.getByPlaceholderText('노트 검색...')
    fireEvent.change(searchInput, { target: { value: 'xyz없는검색어' } })
    expect(screen.getByText('검색 결과 없음')).toBeInTheDocument()
  })

  // 10. 핀 고정
  it('핀 버튼 클릭 시 노트가 핀 고정된다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '핀 테스트', content: '', pinned: false, createdAt: 1, updatedAt: 1 },
    ]))
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('핀 고정'))
    expect(screen.getByTitle('핀 해제')).toBeInTheDocument()
  })

  // 11. 핀 해제
  it('핀 고정된 노트의 핀 버튼 클릭 시 해제된다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '핀 노트', content: '', pinned: true, createdAt: 1, updatedAt: 1 },
    ]))
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('핀 해제'))
    expect(screen.getByTitle('핀 고정')).toBeInTheDocument()
  })

  // 12. 핀 고정된 노트는 목록 상단에 표시
  it('핀 고정된 노트는 목록 상단에 표시된다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '일반 노트', content: '', pinned: false, createdAt: 1, updatedAt: 1 },
      { id: 'n2', title: '핀 노트', content: '', pinned: true, createdAt: 2, updatedAt: 2 },
    ]))
    const { container } = render(<NotesPanel />)
    const text = container.textContent ?? ''
    const pinPos = text.indexOf('핀 노트')
    const normalPos = text.indexOf('일반 노트')
    expect(pinPos).toBeLessThan(normalPos)
  })

  // 13. 노트 클릭 시 에디터 열림
  it('노트 클릭 시 에디터 뷰로 전환된다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '클릭 노트', content: '내용입니다', pinned: false, createdAt: 1, updatedAt: 1 },
    ]))
    render(<NotesPanel />)
    fireEvent.click(screen.getByText('클릭 노트'))
    expect(screen.getByDisplayValue('클릭 노트')).toBeInTheDocument()
    expect(screen.getByDisplayValue('내용입니다')).toBeInTheDocument()
  })

  // 14. 에디터에서 내용 수정
  it('에디터에서 내용을 수정할 수 있다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '수정 노트', content: '원래 내용', pinned: false, createdAt: 1, updatedAt: 1 },
    ]))
    render(<NotesPanel />)
    fireEvent.click(screen.getByText('수정 노트'))
    const textarea = screen.getByDisplayValue('원래 내용')
    fireEvent.change(textarea, { target: { value: '새 내용' } })
    expect(screen.getByDisplayValue('새 내용')).toBeInTheDocument()
  })

  // 15. 글자 수 표시
  it('에디터에서 글자수/단어수/줄수를 표시한다', () => {
    localStorageMock.setItem('claude-desktop-notes', JSON.stringify([
      { id: 'n1', title: '노트', content: 'hello world', pinned: false, createdAt: 1, updatedAt: 1 },
    ]))
    render(<NotesPanel />)
    fireEvent.click(screen.getByText('노트'))
    // 11자 · 2단어 · 1줄
    expect(screen.getByText(/11.*자.*2.*단어.*1.*줄/)).toBeInTheDocument()
  })

  // 16. localStorage에 노트 저장
  it('노트 추가 시 localStorage에 저장된다', () => {
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('새 노트'))
    fireEvent.click(screen.getByText(/< 목록/i))
    const stored = JSON.parse(localStorageMock.getItem('claude-desktop-notes') ?? '[]')
    expect(stored.length).toBeGreaterThan(0)
  })

  // 17. 템플릿 버튼 토글
  it('템플릿 버튼 클릭 시 템플릿 목록이 표시된다', () => {
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('템플릿'))
    expect(screen.getByText('미팅 노트')).toBeInTheDocument()
    expect(screen.getByText('할일 목록')).toBeInTheDocument()
  })

  // 18. 템플릿으로 노트 생성
  it('미팅 노트 템플릿 클릭 시 미팅 노트가 생성된다', () => {
    render(<NotesPanel />)
    fireEvent.click(screen.getByTitle('템플릿'))
    fireEvent.click(screen.getByText('미팅 노트'))
    expect(screen.getByDisplayValue('미팅 노트')).toBeInTheDocument()
  })
})
