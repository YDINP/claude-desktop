import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandPalette } from '../CommandPalette'

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

function mockApi() {
  Object.defineProperty(window, 'api', {
    value: {
      sessionList: vi.fn().mockResolvedValue([]),
      searchFiles: vi.fn().mockResolvedValue([]),
      sessionGlobalSearch: vi.fn().mockResolvedValue([]),
    },
    writable: true,
    configurable: true,
  })
}

const BASE_PROPS = {
  onClose: vi.fn(),
  openTabs: [] as string[],
  onSelectSession: vi.fn(),
  onSelectTab: vi.fn(),
  onSelectFile: vi.fn(),
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockApi()
  })

  // 1. 기본 렌더 - 검색 입력창
  it('검색 입력창이 렌더된다', () => {
    render(<CommandPalette {...BASE_PROPS} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  // 2. dialog role
  it('dialog role로 렌더된다', () => {
    render(<CommandPalette {...BASE_PROPS} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // 3. 기본 액션 목록 표시
  it('기본 액션 목록이 표시된다', () => {
    render(<CommandPalette {...BASE_PROPS} />)
    expect(screen.getByText(/새 세션 시작/)).toBeInTheDocument()
  })

  // 4. Escape 키로 닫기
  it('Escape 키 입력 시 onClose가 호출된다', () => {
    const onClose = vi.fn()
    render(<CommandPalette {...BASE_PROPS} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  // 5. 오버레이 클릭으로 닫기
  it('배경 오버레이 클릭 시 onClose가 호출된다', () => {
    const onClose = vi.fn()
    render(<CommandPalette {...BASE_PROPS} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  // 6. 검색어 입력 시 필터링
  it('검색어 입력 시 매칭 결과가 표시된다', () => {
    render(<CommandPalette {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '설정' } })
    expect(screen.getByText(/설정 열기/)).toBeInTheDocument()
  })

  // 7. ">" 접두어 - 액션 모드
  it('> 입력 시 액션 모드로 전환된다', () => {
    render(<CommandPalette {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '>' } })
    // 액션들이 표시됨
    expect(screen.getByText(/새 세션 시작/)).toBeInTheDocument()
  })

  // 8. 매칭 없으면 No results — 액션 모드(>)에서 매칭 없을 때
  it('매칭 결과가 없으면 No results가 표시된다', () => {
    render(<CommandPalette {...BASE_PROPS} />)
    // ">" 접두어 액션 모드에서 검색 → AI suggest 없으므로 No results
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '>zzz없음없음없음' } })
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  // 9. 새 세션 액션 선택
  it('새 세션 액션 클릭 시 onNewChat가 호출된다', () => {
    const onNewChat = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette {...BASE_PROPS} onClose={onClose} onNewChat={onNewChat} />)
    fireEvent.click(screen.getByText(/새 세션 시작/))
    expect(onNewChat).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  // 10. 설정 액션 선택
  it('설정 열기 액션 클릭 시 onOpenSettings가 호출된다', () => {
    const onOpenSettings = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette {...BASE_PROPS} onClose={onClose} onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByText(/설정 열기/))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  // 11. ArrowDown/Up 키보드 탐색
  it('ArrowDown 키 입력 시 다음 결과가 선택된다', () => {
    render(<CommandPalette {...BASE_PROPS} />)
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // aria-selected가 1번 인덱스로 이동
    const options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
  })

  // 12. Enter 키로 선택
  it('Enter 키 입력 시 선택된 항목이 실행된다', () => {
    const onNewChat = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette {...BASE_PROPS} onClose={onClose} onNewChat={onNewChat} />)
    const input = screen.getByRole('combobox')
    // 검색해서 새 세션만 표시
    fireEvent.change(input, { target: { value: '새 세션' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNewChat).toHaveBeenCalledOnce()
  })

  // 13. openTabs 표시
  it('openTabs가 있으면 탭 결과가 표시된다', () => {
    render(<CommandPalette {...BASE_PROPS} openTabs={['/path/to/App.tsx']} />)
    expect(screen.getByText('App.tsx')).toBeInTheDocument()
  })

  // 14. 탭 클릭 시 onSelectTab 호출
  it('탭 항목 클릭 시 onSelectTab이 호출된다', () => {
    const onSelectTab = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette {...BASE_PROPS} onClose={onClose} onSelectTab={onSelectTab} openTabs={['/path/to/App.tsx']} />)
    fireEvent.click(screen.getByText('App.tsx'))
    expect(onSelectTab).toHaveBeenCalledWith('/path/to/App.tsx')
  })

  // 15. # 접두어 - 글로벌 검색 모드
  it('# 입력 시 대화 내 검색 헤더가 표시된다', () => {
    render(<CommandPalette {...BASE_PROPS} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '# ' } })
    expect(screen.getByText(/대화 내 검색/)).toBeInTheDocument()
  })
})
