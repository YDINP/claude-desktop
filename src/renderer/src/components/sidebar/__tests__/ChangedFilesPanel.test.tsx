import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChangedFilesPanel, type ChangedFile } from '../ChangedFilesPanel'

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

const FILES: ChangedFile[] = [
  { path: 'C:/proj/src/index.ts', op: 'write', ts: 1700000000000 },
  { path: 'C:/proj/src/utils.ts', op: 'edit', ts: 1700000001000 },
  { path: 'C:/proj/src/app.ts', op: 'write', ts: 1700000002000 },
]

const DEFAULT_PROPS = {
  files: FILES,
  onFileClick: vi.fn(),
  onClear: vi.fn(),
}

describe('ChangedFilesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. 빈 상태 메시지
  it('files가 빈 배열이면 빈 상태 메시지가 표시된다', () => {
    render(<ChangedFilesPanel files={[]} onFileClick={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByText(/변경된 파일 없음/)).toBeInTheDocument()
  })

  // 2. 빈 상태 힌트 메시지
  it('빈 상태에서 힌트 메시지가 표시된다', () => {
    render(<ChangedFilesPanel files={[]} onFileClick={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByText(/여기에 표시됩니다/)).toBeInTheDocument()
  })

  // 3. 파일 목록 표시
  it('파일 이름이 목록에 표시된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('index.ts')).toBeInTheDocument()
    expect(screen.getByText('utils.ts')).toBeInTheDocument()
    expect(screen.getByText('app.ts')).toBeInTheDocument()
  })

  // 4. 파일 개수 표시
  it('파일 개수가 표시된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText(/3개/)).toBeInTheDocument()
  })

  // 5. W/E 뱃지 표시
  it('Write 파일에 W 뱃지, Edit 파일에 E 뱃지가 표시된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    const wBadges = screen.getAllByText('W')
    const eBadges = screen.getAllByText('E')
    // W:2건 버튼 + 실제 뱃지 포함
    expect(wBadges.length).toBeGreaterThanOrEqual(1)
    expect(eBadges.length).toBeGreaterThanOrEqual(1)
  })

  // 6. 파일 클릭 시 onFileClick 호출
  it('파일 항목 클릭 시 onFileClick이 호출된다', () => {
    const onFileClick = vi.fn()
    render(<ChangedFilesPanel {...DEFAULT_PROPS} onFileClick={onFileClick} />)
    fireEvent.click(screen.getByText('index.ts'))
    expect(onFileClick).toHaveBeenCalledWith('C:/proj/src/index.ts')
  })

  // 7. 지우기 버튼 클릭 시 onClear 호출
  it('지우기 버튼 클릭 시 onClear가 호출된다', () => {
    const onClear = vi.fn()
    render(<ChangedFilesPanel {...DEFAULT_PROPS} onClear={onClear} />)
    fireEvent.click(screen.getByText(/지우기/))
    expect(onClear).toHaveBeenCalled()
  })

  // 8. 전체 경로 복사 버튼
  it('전체 경로 복사 버튼 클릭 시 clipboard.writeText가 호출된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByTitle(/전체 경로 복사/))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      FILES.map(f => f.path).join('\n')
    )
  })

  // 9. Write 필터 버튼
  it('W 필터 클릭 시 write 파일만 표시된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByTitle('Write 필터'))
    expect(screen.queryByText('utils.ts')).not.toBeInTheDocument()
    expect(screen.getByText('index.ts')).toBeInTheDocument()
  })

  // 10. Edit 필터 버튼
  it('E 필터 클릭 시 edit 파일만 표시된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByTitle('Edit 필터'))
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument()
    expect(screen.getByText('utils.ts')).toBeInTheDocument()
  })

  // 11. 필터 토글 해제
  it('활성 필터 버튼 재클릭 시 필터가 해제된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByTitle('Write 필터'))
    fireEvent.click(screen.getByTitle('Write 필터'))
    expect(screen.getByText('utils.ts')).toBeInTheDocument()
  })

  // 12. 정렬 토글 — 오름차순
  it('정렬 버튼 클릭 시 오래된 순으로 정렬된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    const sortBtn = screen.getByTitle(/오래된 순|최신 순/)
    fireEvent.click(sortBtn)
    const items = screen.getAllByText(/\.ts$/)
    // 첫 번째 아이템은 가장 오래된 index.ts
    expect(items[0].textContent).toBe('index.ts')
  })

  // 13. 개별 경로 복사 버튼 (기본 최신순이므로 첫 번째는 app.ts)
  it('개별 경로 복사 버튼 클릭 시 해당 경로가 복사된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    const copyBtns = screen.getAllByTitle('경로 복사')
    fireEvent.click(copyBtns[0])
    // 최신순(reverse) → 첫 번째 = app.ts (ts=2)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('C:/proj/src/app.ts')
  })

  // 14. 전체 경로 표시
  it('전체 파일 경로가 표시된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('C:/proj/src/index.ts')).toBeInTheDocument()
  })

  // 15. W:N / E:N 카운트 버튼 표시
  it('Write/Edit 개수가 헤더에 표시된다', () => {
    render(<ChangedFilesPanel {...DEFAULT_PROPS} />)
    expect(screen.getByTitle('Write 필터')).toHaveTextContent('W:2')
    expect(screen.getByTitle('Edit 필터')).toHaveTextContent('E:1')
  })
})
