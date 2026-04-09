import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import TasksPanel from '../TasksPanel'

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

// downloadFile mock — jsdom에 Blob/URL 없음
vi.mock('../../../utils/download', () => ({
  downloadFile: vi.fn(),
}))

const STORAGE_KEY = 'claude-desktop-tasks'

function addTask(text: string) {
  const input = screen.getByPlaceholderText(/새 태스크|New task/i)
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('TasksPanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  // 1. 기본 렌더 — 태스크 0개
  it('기본 렌더 시 태스크 0개 표시', () => {
    render(<TasksPanel />)
    expect(screen.getByText(/태스크 0개/)).toBeInTheDocument()
  })

  // 2. 태스크 추가 후 개수 증가
  it('태스크 추가 시 목록에 표시된다', () => {
    render(<TasksPanel />)
    addTask('첫 번째 태스크')
    expect(screen.getByText('첫 번째 태스크')).toBeInTheDocument()
    expect(screen.getByText(/태스크 1개/)).toBeInTheDocument()
  })

  // 3. + 버튼으로 태스크 추가
  it('+ 버튼 클릭으로 태스크를 추가할 수 있다', () => {
    render(<TasksPanel />)
    const input = screen.getByPlaceholderText(/새 태스크|New task/i)
    fireEvent.change(input, { target: { value: '버튼 추가 태스크' } })
    fireEvent.click(screen.getByTitle(/추가|addBtn/i))
    expect(screen.getByText('버튼 추가 태스크')).toBeInTheDocument()
  })

  // 4. 빈 텍스트로는 태스크 추가 불가
  it('빈 텍스트로는 태스크를 추가할 수 없다', () => {
    render(<TasksPanel />)
    fireEvent.keyDown(screen.getByPlaceholderText(/새 태스크|New task/i), { key: 'Enter' })
    expect(screen.getByText(/태스크 0개/)).toBeInTheDocument()
  })

  // 5. 태스크 완료 토글 — 체크박스
  it('체크박스 클릭 시 태스크가 완료 처리된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '완료 태스크', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  // 6. 완료 → 미완료 재토글
  it('완료된 태스크를 다시 클릭하면 미완료로 돌아온다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '토글 태스크', done: true, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  // 7. 태스크 삭제
  it('삭제 버튼 클릭 시 태스크가 제거된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '삭제할 태스크', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    fireEvent.click(screen.getByTitle(/삭제/i))
    expect(screen.queryByText('삭제할 태스크')).not.toBeInTheDocument()
    expect(screen.getByText(/태스크 0개/)).toBeInTheDocument()
  })

  // 8. 더블클릭으로 편집 모드 진입
  it('태스크 텍스트 더블클릭 시 편집 input이 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '편집 태스크', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    fireEvent.dblClick(screen.getByText('편집 태스크'))
    expect(screen.getByDisplayValue('편집 태스크')).toBeInTheDocument()
  })

  // 9. 편집 완료 (Enter)
  it('편집 중 Enter 키로 저장된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '원래 텍스트', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    fireEvent.dblClick(screen.getByText('원래 텍스트'))
    const editInput = screen.getByDisplayValue('원래 텍스트')
    fireEvent.change(editInput, { target: { value: '수정된 텍스트' } })
    fireEvent.keyDown(editInput, { key: 'Enter' })
    expect(screen.getByText('수정된 텍스트')).toBeInTheDocument()
  })

  // 10. 편집 ESC 취소
  it('편집 중 Escape 키로 취소된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '취소 텍스트', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    fireEvent.dblClick(screen.getByText('취소 텍스트'))
    const editInput = screen.getByDisplayValue('취소 텍스트')
    fireEvent.change(editInput, { target: { value: '바뀐 텍스트' } })
    fireEvent.keyDown(editInput, { key: 'Escape' })
    expect(screen.getByText('취소 텍스트')).toBeInTheDocument()
  })

  // 11. 검색 필터링
  it('검색어 입력 시 태스크가 필터링된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '리액트 작업', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
      { id: 't2', text: '뷰 작업', done: false, priority: 'medium', dueDate: null, createdAt: 2 },
    ]))
    render(<TasksPanel />)
    fireEvent.change(screen.getByPlaceholderText(/태스크 검색|Search task/i), { target: { value: '리액트' } })
    expect(screen.getByText('리액트 작업')).toBeInTheDocument()
    expect(screen.queryByText('뷰 작업')).not.toBeInTheDocument()
  })

  // 12. 검색어 ESC 초기화
  it('검색창에서 ESC 입력 시 검색어가 초기화된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '태스크A', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
      { id: 't2', text: '태스크B', done: false, priority: 'medium', dueDate: null, createdAt: 2 },
    ]))
    render(<TasksPanel />)
    const searchInput = screen.getByPlaceholderText(/태스크 검색|Search task/i)
    fireEvent.change(searchInput, { target: { value: '태스크A' } })
    expect(screen.queryByText('태스크B')).not.toBeInTheDocument()
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(screen.getByText('태스크B')).toBeInTheDocument()
  })

  // 13. 검색 결과 없음 메시지
  it('검색 결과 없으면 결과없음 메시지가 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '태스크', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    fireEvent.change(screen.getByPlaceholderText(/태스크 검색|Search task/i), { target: { value: 'xyz없음' } })
    expect(screen.getByText(/검색 결과 없음|No results|noResults/i)).toBeInTheDocument()
  })

  // 14. 진행률 표시
  it('완료된 태스크 비율로 진행률을 표시한다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '완료', done: true, priority: 'medium', dueDate: null, createdAt: 1 },
      { id: 't2', text: '미완료', done: false, priority: 'medium', dueDate: null, createdAt: 2 },
    ]))
    render(<TasksPanel />)
    expect(screen.getByText(/진행률 50%|50%/)).toBeInTheDocument()
  })

  // 15. 전부 완료 시 배너 표시
  it('모든 태스크 완료 시 전부 완료 배너가 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '완료', done: true, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    expect(screen.getByText(/전부 완료|allDone/)).toBeInTheDocument()
  })

  // 16. 모두 완료 버튼
  it('✓ 전부 버튼 클릭 시 미완료 태스크가 모두 완료된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '미완료1', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
      { id: 't2', text: '미완료2', done: false, priority: 'medium', dueDate: null, createdAt: 2 },
    ]))
    render(<TasksPanel />)
    fireEvent.click(screen.getByTitle(/모두 완료 처리|markAllDone/i))
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(cb => expect(cb).toBeChecked())
  })

  // 17. 우선순위 순 정렬
  it('정렬 버튼 클릭 시 우선순위 순으로 정렬된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '낮은우선순위', done: false, priority: 'low', dueDate: null, createdAt: 1 },
      { id: 't2', text: '높은우선순위', done: false, priority: 'high', dueDate: null, createdAt: 2 },
    ]))
    const { container } = render(<TasksPanel />)
    fireEvent.click(screen.getByTitle(/정렬/i))
    const text = container.textContent ?? ''
    expect(text.indexOf('높은우선순위')).toBeLessThan(text.indexOf('낮은우선순위'))
  })

  // 18. localStorage에 태스크 저장
  it('태스크 추가 시 localStorage에 저장된다', () => {
    render(<TasksPanel />)
    addTask('저장 테스트')
    const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) ?? '[]')
    expect(stored.length).toBe(1)
    expect(stored[0].text).toBe('저장 테스트')
  })

  // 19. 내보내기 버튼 클릭 시 downloadFile 호출
  it('내보내기 버튼 클릭 시 downloadFile이 호출된다', async () => {
    const { downloadFile } = await import('../../../utils/download')
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '내보낼 태스크', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    fireEvent.click(screen.getByTitle(/Markdown으로 내보내기|export/i))
    expect(downloadFile).toHaveBeenCalled()
  })

  // 20. 메모 토글 — 메모 textarea 표시
  it('메모 버튼 클릭 시 메모 textarea가 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      { id: 't1', text: '메모 태스크', done: false, priority: 'medium', dueDate: null, createdAt: 1 },
    ]))
    render(<TasksPanel />)
    fireEvent.click(screen.getByTitle(/메모|memo/i))
    expect(screen.getByPlaceholderText(/메모 입력|memo/i)).toBeInTheDocument()
  })
})
