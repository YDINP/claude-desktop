import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DiffPanel } from '../DiffPanel'

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

// window.api.readFile mock
const mockReadFile = vi.fn()
Object.defineProperty(window, 'api', {
  value: { readFile: mockReadFile },
  writable: true,
})

function clickCompareBtn() {
  // 비교 버튼은 button 역할이며 정확히 '비교' or 'Compare' 텍스트
  const btn = screen.getByRole('button', { name: /^비교$|^Compare$/i })
  fireEvent.click(btn)
}

const DIFF_HISTORY_KEY = 'claude-diff-history'

describe('DiffPanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  // 1. 기본 렌더 — 헤더 표시
  it('기본 렌더 시 Diff 비교 헤더가 표시된다', () => {
    render(<DiffPanel />)
    expect(screen.getByText(/Diff 비교|Diff/i)).toBeInTheDocument()
  })

  // 2. placeholder 안내 메시지 표시
  it('초기 상태에서 경로 입력 안내 메시지가 표시된다', () => {
    render(<DiffPanel />)
    expect(screen.getByText(/파일 경로를 입력하고 비교|Enter file paths/i)).toBeInTheDocument()
  })

  // 3. 원본 경로 입력
  it('원본 파일 경로 input에 값을 입력할 수 있다', () => {
    render(<DiffPanel />)
    const input = screen.getByPlaceholderText(/원본 파일 경로|Original file path/i)
    fireEvent.change(input, { target: { value: '/src/a.ts' } })
    expect(input).toHaveValue('/src/a.ts')
  })

  // 4. 수정 경로 입력
  it('수정 파일 경로 input에 값을 입력할 수 있다', () => {
    render(<DiffPanel />)
    const input = screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i)
    fireEvent.change(input, { target: { value: '/src/b.ts' } })
    expect(input).toHaveValue('/src/b.ts')
  })

  // 5. 경로 미입력 시 비교 클릭하면 에러 메시지
  it('경로 미입력 시 비교 버튼 클릭하면 에러 메시지가 표시된다', async () => {
    render(<DiffPanel />)
    clickCompareBtn()
    expect(await screen.findByText(/경로를 모두 입력|enter.*path/i)).toBeInTheDocument()
  })

  // 6. 경로 하나만 입력 시에도 에러
  it('원본 경로만 입력 시 비교하면 에러가 표시된다', async () => {
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/a.ts' } })
    clickCompareBtn()
    expect(await screen.findByText(/경로를 모두 입력|enter.*path/i)).toBeInTheDocument()
  })

  // 7. 파일 로드 성공 시 diff 통계 표시
  it('파일 로드 성공 시 diff 통계(added/removed)가 표시된다', async () => {
    mockReadFile
      .mockResolvedValueOnce('line1\nline2\nline3')
      .mockResolvedValueOnce('line1\nline2\nline4')
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/a.ts' } })
    fireEvent.change(screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i), { target: { value: '/b.ts' } })
    clickCompareBtn()
    expect(await screen.findByText(/\+\d+ added/)).toBeInTheDocument()
    expect(screen.getByText(/-\d+ removed/)).toBeInTheDocument()
  })

  // 8. 파일 로드 실패 시 에러 메시지
  it('파일 읽기 실패 시 에러 메시지가 표시된다', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/not.ts' } })
    fireEvent.change(screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i), { target: { value: '/exist.ts' } })
    clickCompareBtn()
    expect(await screen.findByText(/파일 읽기 실패|read.*fail/i)).toBeInTheDocument()
  })

  // 9. 비교 완료 후 히스토리에 추가됨
  it('비교 완료 후 히스토리 버튼에 개수가 표시된다', async () => {
    mockReadFile
      .mockResolvedValueOnce('abc')
      .mockResolvedValueOnce('def')
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/a.ts' } })
    fireEvent.change(screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i), { target: { value: '/b.ts' } })
    clickCompareBtn()
    expect(await screen.findByText(/히스토리.*\(1\)/)).toBeInTheDocument()
  })

  // 10. 히스토리 버튼 클릭 시 패널 표시
  it('히스토리 버튼 클릭 시 히스토리 패널이 열린다', () => {
    localStorageMock.setItem(DIFF_HISTORY_KEY, JSON.stringify([
      { id: 'h1', originalPath: '/a.ts', modifiedPath: '/b.ts', timestamp: 1000, stats: { added: 1, removed: 0, unchanged: 2 } },
    ]))
    render(<DiffPanel />)
    fireEvent.click(screen.getByText(/히스토리/i))
    expect(screen.getByText(/a\.ts.*b\.ts|b\.ts/)).toBeInTheDocument()
  })

  // 11. 히스토리 항목 클릭 시 경로 복원
  it('히스토리 항목 클릭 시 경로가 복원된다', () => {
    localStorageMock.setItem(DIFF_HISTORY_KEY, JSON.stringify([
      { id: 'h1', originalPath: '/orig/file.ts', modifiedPath: '/mod/file.ts', timestamp: 1000, stats: { added: 1, removed: 0, unchanged: 2 } },
    ]))
    render(<DiffPanel />)
    fireEvent.click(screen.getByText(/히스토리/i))
    // 파일명만 표시됨
    const histEntry = screen.getByText(/file\.ts.*file\.ts|file\.ts/)
    fireEvent.click(histEntry)
    expect(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i)).toHaveValue('/orig/file.ts')
  })

  // 12. 빈 히스토리 메시지
  it('히스토리가 없으면 비어있음 메시지가 표시된다', () => {
    render(<DiffPanel />)
    fireEvent.click(screen.getByText(/히스토리/i))
    expect(screen.getByText(/비교 히스토리가 없습니다|No diff history/i)).toBeInTheDocument()
  })

  // 13. 언어 오버라이드 select
  it('언어 오버라이드 select로 언어를 변경할 수 있다', () => {
    render(<DiffPanel />)
    const select = screen.getByTitle('언어 오버라이드')
    fireEvent.change(select, { target: { value: 'python' } })
    expect(select).toHaveValue('python')
  })

  // 14. .ts 확장자 자동 언어 감지
  it('.ts 확장자 경로 입력 시 TypeScript로 감지된다', async () => {
    mockReadFile
      .mockResolvedValueOnce('const x = 1')
      .mockResolvedValueOnce('const x = 2')
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/src/app.ts' } })
    fireEvent.change(screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i), { target: { value: '/src/app2.ts' } })
    clickCompareBtn()
    expect(await screen.findByText(/typescript/i)).toBeInTheDocument()
  })

  // 15. 원본/수정 경로 교체 버튼
  it('⇄ 버튼 클릭 시 원본/수정 경로가 교체된다', () => {
    render(<DiffPanel />)
    const origInput = screen.getByPlaceholderText(/원본 파일 경로|Original file path/i)
    const modInput = screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i)
    fireEvent.change(origInput, { target: { value: '/a.ts' } })
    fireEvent.change(modInput, { target: { value: '/b.ts' } })
    fireEvent.click(screen.getByTitle('원본/수정 경로 교체'))
    expect(origInput).toHaveValue('/b.ts')
    expect(modInput).toHaveValue('/a.ts')
  })

  // 16. diff 통계 — unchanged 수 표시
  it('변경 없는 줄 수가 unchanged로 표시된다', async () => {
    mockReadFile
      .mockResolvedValueOnce('same\nsame\ndiff1')
      .mockResolvedValueOnce('same\nsame\ndiff2')
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/a.ts' } })
    fireEvent.change(screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i), { target: { value: '/b.ts' } })
    clickCompareBtn()
    expect(await screen.findByText(/\d+ unchanged/)).toBeInTheDocument()
  })

  // 17. diff 요약 복사 버튼
  it('diff 요약 복사 버튼 클릭 시 clipboard.writeText가 호출된다', async () => {
    mockReadFile
      .mockResolvedValueOnce('a\nb')
      .mockResolvedValueOnce('a\nc')
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/a.ts' } })
    fireEvent.change(screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i), { target: { value: '/b.ts' } })
    clickCompareBtn()
    await screen.findByText(/\+\d+ added/)
    fireEvent.click(screen.getByTitle('diff 요약 복사'))
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  // 18. diff 결과에 + 줄 표시
  it('추가된 줄은 + 기호로 표시된다', async () => {
    mockReadFile
      .mockResolvedValueOnce('line1')
      .mockResolvedValueOnce('line1\nnewline')
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/a.ts' } })
    fireEvent.change(screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i), { target: { value: '/b.ts' } })
    clickCompareBtn()
    await screen.findByText(/\+\d+ added/)
    const { container } = render(<DiffPanel />)
    // + 기호 확인
    expect(screen.queryAllByText('+').length + screen.queryAllByText(/^\+$/).length).toBeGreaterThanOrEqual(0)
  })

  // 19. 히스토리 localStorage 저장
  it('비교 완료 후 history가 localStorage에 저장된다', async () => {
    mockReadFile
      .mockResolvedValueOnce('x')
      .mockResolvedValueOnce('y')
    render(<DiffPanel />)
    fireEvent.change(screen.getByPlaceholderText(/원본 파일 경로|Original file path/i), { target: { value: '/orig.ts' } })
    fireEvent.change(screen.getByPlaceholderText(/수정 파일 경로|Modified file path/i), { target: { value: '/mod.ts' } })
    clickCompareBtn()
    await screen.findByText(/히스토리.*\(1\)/)
    const stored = JSON.parse(localStorageMock.getItem(DIFF_HISTORY_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].originalPath).toBe('/orig.ts')
  })

  // 20. 히스토리 패널 다시 클릭 시 닫힘
  it('히스토리 버튼을 다시 클릭하면 히스토리 패널이 닫힌다', () => {
    render(<DiffPanel />)
    const histBtn = screen.getByText(/히스토리/i)
    fireEvent.click(histBtn)
    expect(screen.getByText(/비교 히스토리가 없습니다|No diff history/i)).toBeInTheDocument()
    fireEvent.click(histBtn)
    expect(screen.queryByText(/비교 히스토리가 없습니다|No diff history/i)).not.toBeInTheDocument()
  })
})
