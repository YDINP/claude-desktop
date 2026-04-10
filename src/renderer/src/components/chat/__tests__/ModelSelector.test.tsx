import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ModelSelector, MODEL_DEFS } from '../ModelSelector'

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

// i18n mock — 키 그대로 반환
vi.mock('../../../utils/i18n', () => ({
  t: (key: string, fallback?: string) => fallback ?? key,
}))

describe('ModelSelector', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  // 1. 현재 선택 모델 표시
  it('현재 선택된 모델 레이블이 버튼에 표시된다', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument()
  })

  // 2. 드롭다운 닫힌 상태 — 모델 목록 미표시
  it('초기 상태에서 드롭다운이 닫혀 있다', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    expect(screen.queryByText('Opus 4.6')).not.toBeInTheDocument()
  })

  // 3. 버튼 클릭 시 드롭다운 열림
  it('버튼 클릭 시 모델 목록이 표시된다', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    expect(screen.getByText('Opus 4.6')).toBeInTheDocument()
    expect(screen.getByText('Haiku 4.5')).toBeInTheDocument()
  })

  // 4. 모델 선택 시 onChange 호출
  it('모델 클릭 시 onChange가 해당 id로 호출된다', () => {
    const onChange = vi.fn()
    render(<ModelSelector value="claude-sonnet-4-6" onChange={onChange} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    fireEvent.click(screen.getByText('Opus 4.6'))
    expect(onChange).toHaveBeenCalledWith('claude-opus-4-6')
  })

  // 5. 선택 후 드롭다운 닫힘
  it('모델 선택 후 드롭다운이 닫힌다', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    fireEvent.click(screen.getByText('Opus 4.6'))
    expect(screen.queryByText('Haiku 4.5')).not.toBeInTheDocument()
  })

  // 6. 선택 시 localStorage 저장
  it('모델 선택 시 localStorage에 recent-model이 저장된다', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    fireEvent.click(screen.getByText('Haiku 4.5'))
    expect(localStorageMock.getItem('recent-model')).toBe('claude-haiku-4-5-20251001')
  })

  // 7. 최근 사용 모델 상단 정렬
  it('최근 모델이 드롭다운 상단에 표시된다', () => {
    localStorageMock.setItem('recent-model', 'claude-haiku-4-5-20251001')
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    // 드롭다운의 모든 모델 행 중 첫 번째가 Haiku인지 확인
    // 각 행은 icon + label + desc 구조; '최근' 뱃지가 있는 행이 첫 번째여야 함
    const recentBadge = screen.getByText('최근')
    const firstRow = recentBadge.closest('div[style*="cursor: pointer"]') as HTMLElement
    expect(firstRow).toContainElement(screen.getByText('Haiku 4.5'))
  })

  // 8. 최근 모델에 '최근' 뱃지 표시
  it('최근 모델에 최근 뱃지가 표시된다', () => {
    localStorageMock.setItem('recent-model', 'claude-haiku-4-5-20251001')
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    expect(screen.getByText('최근')).toBeInTheDocument()
  })

  // 9. 현재 선택 모델에 체크 표시
  it('현재 선택된 모델에 체크 표시가 있다', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  // 10. 현재 선택 모델은 최근 뱃지 없음
  it('현재 선택된 모델이 recent-model과 같으면 최근 뱃지가 없다', () => {
    localStorageMock.setItem('recent-model', 'claude-sonnet-4-6')
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    expect(screen.queryByText('최근')).not.toBeInTheDocument()
  })

  // 11. 외부 클릭 시 드롭다운 닫힘
  it('외부 클릭 시 드롭다운이 닫힌다', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTitle('모델 선택'))
    expect(screen.getByText('Opus 4.6')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Opus 4.6')).not.toBeInTheDocument()
  })

  // 12. MODEL_DEFS 3개 정의
  it('MODEL_DEFS에 3개 모델이 정의되어 있다', () => {
    expect(MODEL_DEFS).toHaveLength(3)
  })

  // 13. Opus 모델 정의 확인
  it('MODEL_DEFS에 Opus 모델이 포함된다', () => {
    const opus = MODEL_DEFS.find(m => m.id === 'claude-opus-4-6')
    expect(opus).toBeDefined()
    expect(opus?.label).toBe('Opus 4.6')
  })

  // 14. ▾ 화살표 표시
  it('버튼에 드롭다운 화살표(▾)가 표시된다', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    expect(screen.getByText('▾')).toBeInTheDocument()
  })

  // 15. 알 수 없는 value는 기본값(Sonnet) 표시
  it('알 수 없는 value이면 기본 모델이 표시된다', () => {
    render(<ModelSelector value="unknown-model" onChange={vi.fn()} />)
    // MODEL_DEFS[1] = Sonnet
    expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument()
  })
})
