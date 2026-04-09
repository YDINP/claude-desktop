import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SnippetPanel } from '../SnippetPanel'

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

interface Snippet {
  id: string
  name: string
  content: string
  language?: string
  category?: string
  shortcut?: string
  createdAt: number
}

function makeSnippet(id: string, name: string, content: string, opts: Partial<Snippet> = {}): Snippet {
  return { id, name, content, createdAt: Date.now(), ...opts }
}

const SNIPPETS: Snippet[] = [
  makeSnippet('s1', 'Hello World', 'console.log("hello")', { category: '일반', language: 'javascript' }),
  makeSnippet('s2', 'TypeScript Interface', 'interface Foo {}', { category: 'TypeScript', language: 'typescript' }),
]

function mockApi(snippets: Snippet[] = []) {
  Object.defineProperty(window, 'api', {
    value: {
      snippetList: vi.fn().mockResolvedValue(snippets),
      snippetSave: vi.fn().mockResolvedValue(undefined),
      snippetDelete: vi.fn().mockResolvedValue(undefined),
      suggestSnippets: vi.fn().mockResolvedValue([]),
    },
    writable: true,
    configurable: true,
  })
}

describe('SnippetPanel', () => {
  const onInsert = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi(SNIPPETS)
  })

  // 1. 빈 상태
  it('스니펫이 없으면 빈 상태 메시지가 표시된다', async () => {
    mockApi([])
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => {
      expect(screen.getByText(/스니펫이 없습니다/)).toBeInTheDocument()
    })
  })

  // 2. 스니펫 목록 표시
  it('스니펫 목록이 표시된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument()
      expect(screen.getByText('TypeScript Interface')).toBeInTheDocument()
    })
  })

  // 3. 카테고리 퀵 필터 표시
  it('2개 이상 카테고리가 있으면 카테고리 필터가 표시된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => {
      // 카테고리 퀵 필터 버튼: "일반 (1)" 형태
      expect(screen.getByText(/일반 \(1\)/)).toBeInTheDocument()
      expect(screen.getByText(/TypeScript \(1\)/)).toBeInTheDocument()
    })
  })

  // 4. 카테고리 필터 클릭 - 해당 카테고리만 표시
  it('카테고리 필터 클릭 시 해당 카테고리 스니펫만 표시된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    // 일반 카테고리만 (1건)
    const catBtn = screen.getByText(/일반 \(1\)/)
    fireEvent.click(catBtn)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
    expect(screen.queryByText('TypeScript Interface')).not.toBeInTheDocument()
  })

  // 5. 검색 필터링
  it('검색어 입력 시 이름/내용/카테고리로 필터링된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    fireEvent.change(screen.getByPlaceholderText(/스니펫 검색/i), { target: { value: 'Hello' } })
    expect(screen.getByText('Hello World')).toBeInTheDocument()
    expect(screen.queryByText('TypeScript Interface')).not.toBeInTheDocument()
  })

  // 6. 검색 결과 없음
  it('검색 결과가 없으면 결과없음 메시지가 표시된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    fireEvent.change(screen.getByPlaceholderText(/스니펫 검색/i), { target: { value: 'zzz없는검색어' } })
    expect(screen.getByText(/검색 결과 없음/)).toBeInTheDocument()
  })

  // 7. Escape 검색 초기화
  it('검색창에서 Escape 입력 시 검색어가 초기화된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    const input = screen.getByPlaceholderText(/스니펫 검색/i)
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByText('TypeScript Interface')).toBeInTheDocument()
  })

  // 8. + 버튼 클릭 시 폼 표시
  it('+ 버튼 클릭 시 추가 폼이 표시된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    fireEvent.click(screen.getByTitle(/새 스니펫/))
    expect(screen.getByPlaceholderText(/이름/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/내용/)).toBeInTheDocument()
  })

  // 9. 저장 버튼 비활성화 - 이름/내용 비어있을 때
  it('이름이나 내용이 없으면 저장 버튼이 비활성화된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    fireEvent.click(screen.getByTitle(/새 스니펫/))
    const saveBtn = screen.getByText('저장')
    expect(saveBtn).toBeDisabled()
  })

  // 10. 스니펫 저장
  it('이름과 내용 입력 후 저장 시 snippetSave가 호출된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    fireEvent.click(screen.getByTitle(/새 스니펫/))
    fireEvent.change(screen.getByPlaceholderText(/이름/), { target: { value: '새 스니펫' } })
    fireEvent.change(screen.getByPlaceholderText(/내용/), { target: { value: 'const x = 1' } })
    fireEvent.click(screen.getByText('저장'))
    await waitFor(() => {
      expect(window.api.snippetSave).toHaveBeenCalled()
    })
  })

  // 11. 취소 버튼
  it('취소 버튼 클릭 시 폼이 닫힌다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    fireEvent.click(screen.getByTitle(/새 스니펫/))
    expect(screen.getByPlaceholderText(/이름/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('취소'))
    expect(screen.queryByPlaceholderText(/이름/)).not.toBeInTheDocument()
  })

  // 12. 삭제 버튼
  it('삭제 버튼 클릭 시 snippetDelete가 호출된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    const deleteBtns = screen.getAllByText('삭제')
    fireEvent.click(deleteBtns[0])
    expect(window.api.snippetDelete).toHaveBeenCalledWith('s1')
  })

  // 13. 삽입 버튼 클릭 시 onInsert 호출
  it('삽입 버튼 클릭 시 onInsert가 스니펫 내용으로 호출된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    const insertBtns = screen.getAllByText('삽입')
    fireEvent.click(insertBtns[0])
    expect(onInsert).toHaveBeenCalledWith('console.log("hello")')
  })

  // 14. 복사 버튼 클릭
  it('복사 버튼 클릭 시 clipboard.writeText가 호출된다', async () => {
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    const copyBtns = screen.getAllByTitle(/클립보드에 복사/)
    fireEvent.click(copyBtns[0])
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("hello")')
  })

  // 15. 내보내기 버튼
  it('내보내기 버튼 클릭 시 downloadFile이 호출된다', async () => {
    const { downloadFile } = await import('../../../utils/download')
    render(<SnippetPanel onInsert={onInsert} />)
    await waitFor(() => screen.getByText('Hello World'))
    fireEvent.click(screen.getByTitle(/스니펫 내보내기/))
    expect(downloadFile).toHaveBeenCalled()
  })
})
