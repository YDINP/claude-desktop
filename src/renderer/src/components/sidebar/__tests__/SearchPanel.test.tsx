import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SearchPanel } from '../SearchPanel'

// clipboard mock
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

const SEARCH_RESULTS = [
  { filePath: 'C:/proj/src/index.ts', lineNum: 10, lineContent: 'const hello = "world"', relPath: 'src/index.ts' },
  { filePath: 'C:/proj/src/index.ts', lineNum: 20, lineContent: 'export const hello2 = true', relPath: 'src/index.ts' },
  { filePath: 'C:/proj/src/utils.ts', lineNum: 5, lineContent: 'function helloUtil() {}', relPath: 'src/utils.ts' },
]

function mockApi(overrides: Record<string, unknown> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      grepSearch: vi.fn().mockResolvedValue({ results: SEARCH_RESULTS, error: null }),
      readFile: vi.fn().mockResolvedValue('file content'),
      writeTextFile: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

const DEFAULT_PROPS = {
  rootPath: 'C:/proj',
  onFileClick: vi.fn(),
}

describe('SearchPanel', () => {
  beforeEach(() => {
    mockApi()
    localStorage.clear()
    vi.clearAllMocks()
  })

  // 1. 기본 렌더
  it('검색 입력창이 표시된다', () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    expect(screen.getByPlaceholderText(/프로젝트 검색/)).toBeInTheDocument()
  })

  // 2. 체크박스 옵션 3개 표시 (Aa, .*, Ww)
  it('Aa, .*, Ww 체크박스가 표시된다', () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('Aa')).toBeInTheDocument()
    expect(screen.getByText('.*')).toBeInTheDocument()
    expect(screen.getByText('Ww')).toBeInTheDocument()
  })

  // 3. 검색어 2자 미만이면 검색하지 않음
  it('검색어가 1자이면 grepSearch가 호출되지 않는다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    fireEvent.change(screen.getByPlaceholderText(/프로젝트 검색/), { target: { value: 'a' } })
    await new Promise(r => setTimeout(r, 500))
    expect(window.api.grepSearch).not.toHaveBeenCalled()
  })

  // 4. Enter 키로 검색 실행
  it('Enter 키 입력 시 grepSearch가 호출된다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(window.api.grepSearch).toHaveBeenCalledWith(
      'C:/proj',
      'hello',
      expect.objectContaining({ caseSensitive: false })
    ))
  })

  // 5. 검색 결과 파일명 표시
  it('검색 결과 파일명이 표시된다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('index.ts')).toBeInTheDocument())
    expect(screen.getByText('utils.ts')).toBeInTheDocument()
  })

  // 6. 검색 결과 라인 번호 표시
  it('검색 결과 라인 번호가 표시된다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument())
  })

  // 7. 파일 헤더 클릭 시 onFileClick 호출
  it('파일명 클릭 시 onFileClick이 호출된다', async () => {
    const onFileClick = vi.fn()
    render(<SearchPanel rootPath="C:/proj" onFileClick={onFileClick} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByText('index.ts'))
    fireEvent.click(screen.getByText('index.ts'))
    expect(onFileClick).toHaveBeenCalledWith('C:/proj/src/index.ts')
  })

  // 8. 라인 클릭 시 onFileClick에 라인 번호 포함
  it('라인 클릭 시 onFileClick에 라인 번호가 전달된다', async () => {
    const onFileClick = vi.fn()
    render(<SearchPanel rootPath="C:/proj" onFileClick={onFileClick} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByText('10'))
    fireEvent.click(screen.getByText('10'))
    expect(onFileClick).toHaveBeenCalledWith('C:/proj/src/index.ts', 10)
  })

  // 9. 대소문자 체크박스 토글
  it('Aa 체크박스 체크 시 caseSensitive 옵션이 true가 된다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    // Aa 레이블의 체크박스
    const aaLabel = screen.getByText('Aa').closest('label')!
    const aaCheckbox = aaLabel.querySelector('input[type="checkbox"]')!
    fireEvent.click(aaCheckbox)
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(window.api.grepSearch).toHaveBeenCalledWith(
      'C:/proj',
      'hello',
      expect.objectContaining({ caseSensitive: true })
    ))
  })

  // 10. 단어단위(Ww) 체크박스 토글
  it('Ww 체크박스 체크 시 단어단위 검색으로 쿼리가 수정된다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    const wwLabel = screen.getByText('Ww').closest('label')!
    const wwCheckbox = wwLabel.querySelector('input[type="checkbox"]')!
    fireEvent.click(wwCheckbox)
    await waitFor(() => expect(window.api.grepSearch).toHaveBeenCalledWith(
      'C:/proj',
      expect.stringContaining('hello'),
      expect.anything()
    ))
  })

  // 11. 검색 결과 없을 때 메시지 표시
  it('검색 결과가 없으면 결과 없음 메시지가 표시된다', async () => {
    mockApi({ grepSearch: vi.fn().mockResolvedValue({ results: [], error: null }) })
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'notfound' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText(/결과 없음/)).toBeInTheDocument())
  })

  // 12. 검색 에러 표시
  it('grepSearch 오류 시 에러 메시지가 표시된다', async () => {
    mockApi({ grepSearch: vi.fn().mockResolvedValue({ results: [], error: '오류 발생' }) })
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText(/오류 발생/)).toBeInTheDocument())
  })

  // 13. 히스토리 저장 후 표시
  it('검색 후 히스토리에 저장되고 포커스 시 표시된다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'myquery' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(window.api.grepSearch).toHaveBeenCalled())
    // blur then focus again
    fireEvent.blur(input)
    await act(async () => { await new Promise(r => setTimeout(r, 200)) })
    fireEvent.focus(input)
    await waitFor(() => expect(screen.getByText('myquery')).toBeInTheDocument())
  })

  // 14. 매치 건수 표시
  it('검색 결과 건수가 표시된다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const input = screen.getByPlaceholderText(/프로젝트 검색/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText(/3건/)).toBeInTheDocument())
  })

  // 15. 바꾸기 모드 토글 버튼
  it('⇄ 버튼 클릭 시 바꾸기 모드가 활성화된다', async () => {
    render(<SearchPanel {...DEFAULT_PROPS} />)
    const replaceBtn = screen.getByTitle(/바꾸기 모드/)
    fireEvent.click(replaceBtn)
    expect(await screen.findByPlaceholderText(/바꿀 텍스트/)).toBeInTheDocument()
  })
})
