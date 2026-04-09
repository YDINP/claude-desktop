import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClipboardPanel } from '../ClipboardPanel'

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
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
})

const STORAGE_KEY = 'clipboardHistory'
const PINNED_KEY = 'clipboardPinnedIds'

function makeEntry(id: string, text: string, timestamp = Date.now()) {
  return { id, text, timestamp }
}

describe('ClipboardPanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  // 1. 기본 렌더 — 빈 상태
  it('기본 렌더 시 빈 상태 메시지가 표시된다', () => {
    render(<ClipboardPanel />)
    expect(screen.getByText(/클립보드 기록 없음|No clipboard/i)).toBeInTheDocument()
  })

  // 2. 저장된 항목이 있으면 목록 표시
  it('localStorage에 저장된 항목이 있으면 목록에 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', '복사된 텍스트', 1000),
    ]))
    render(<ClipboardPanel />)
    expect(screen.getByText('복사된 텍스트')).toBeInTheDocument()
  })

  // 3. 항목 개수 통계 표시
  it('항목 개수가 통계 영역에 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', '텍스트1', 1000),
      makeEntry('cb2', '텍스트2', 2000),
    ]))
    render(<ClipboardPanel />)
    expect(screen.getByText(/2건/)).toBeInTheDocument()
  })

  // 4. 검색 필터링
  it('검색어 입력 시 텍스트로 필터링된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', 'hello world', 1000),
      makeEntry('cb2', 'foo bar', 2000),
    ]))
    render(<ClipboardPanel />)
    fireEvent.change(screen.getByPlaceholderText(/클립보드 검색|Search clipboard/i), { target: { value: 'hello' } })
    expect(screen.getByText(/hello world/)).toBeInTheDocument()
    expect(screen.queryByText('foo bar')).not.toBeInTheDocument()
  })

  // 5. 검색 결과 없으면 noResults 메시지
  it('검색 결과 없으면 결과없음 메시지가 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', '텍스트', 1000),
    ]))
    render(<ClipboardPanel />)
    fireEvent.change(screen.getByPlaceholderText(/클립보드 검색|Search clipboard/i), { target: { value: 'zzz없음' } })
    expect(screen.getByText(/검색 결과 없음|No results/i)).toBeInTheDocument()
  })

  // 6. 검색어 ESC 초기화
  it('검색창에서 ESC 입력 시 검색어가 초기화된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', 'aaa', 1000),
      makeEntry('cb2', 'bbb', 2000),
    ]))
    render(<ClipboardPanel />)
    const searchInput = screen.getByPlaceholderText(/클립보드 검색|Search clipboard/i)
    fireEvent.change(searchInput, { target: { value: 'aaa' } })
    expect(screen.queryByText('bbb')).not.toBeInTheDocument()
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(screen.getByText('bbb')).toBeInTheDocument()
  })

  // 7. 검색 중 필터 개수 표시
  it('검색 중에는 필터된수/전체수 형식으로 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', 'hello', 1000),
      makeEntry('cb2', 'world', 2000),
    ]))
    render(<ClipboardPanel />)
    fireEvent.change(screen.getByPlaceholderText(/클립보드 검색|Search clipboard/i), { target: { value: 'hello' } })
    expect(screen.getByText(/1\/2건/)).toBeInTheDocument()
  })

  // 8. 핀 고정
  it('핀 버튼 클릭 시 항목이 핀 고정된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', '고정할 텍스트', 1000),
    ]))
    render(<ClipboardPanel />)
    // 핀 버튼은 '○' 텍스트
    fireEvent.click(screen.getByTitle('고정'))
    expect(screen.getByTitle('고정 해제')).toBeInTheDocument()
  })

  // 9. 핀 해제
  it('핀 고정된 항목의 핀 버튼 클릭 시 해제된다', () => {
    const entries = [makeEntry('cb1', '고정된 텍스트', 1000)]
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(entries))
    localStorageMock.setItem(PINNED_KEY, JSON.stringify(['cb1']))
    render(<ClipboardPanel />)
    fireEvent.click(screen.getByTitle('고정 해제'))
    expect(screen.getByTitle('고정')).toBeInTheDocument()
  })

  // 10. 핀 개수 통계 표시
  it('핀 고정된 항목이 있으면 통계에 개수가 표시된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', '고정됨', 1000),
    ]))
    localStorageMock.setItem(PINNED_KEY, JSON.stringify(['cb1']))
    render(<ClipboardPanel />)
    expect(screen.getByText(/📌.*1개 고정|1개 고정/)).toBeInTheDocument()
  })

  // 11. 항목 삭제
  it('x 버튼 클릭 시 항목이 삭제된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', '삭제할 텍스트', 1000),
    ]))
    render(<ClipboardPanel />)
    fireEvent.click(screen.getByText('x'))
    expect(screen.queryByText('삭제할 텍스트')).not.toBeInTheDocument()
  })

  // 12. 전체 삭제 (비핀만)
  it('삭제 버튼 클릭 시 비핀 항목이 모두 삭제된다', () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', '일반 항목', 1000),
      makeEntry('cb2', '핀 항목', 2000),
    ]))
    localStorageMock.setItem(PINNED_KEY, JSON.stringify(['cb2']))
    render(<ClipboardPanel />)
    // 전체/비핀 삭제 버튼
    const clearBtn = screen.getByTitle(/비핀 삭제|전체 삭제/i)
    fireEvent.click(clearBtn)
    expect(screen.queryByText('일반 항목')).not.toBeInTheDocument()
    expect(screen.getByText('핀 항목')).toBeInTheDocument()
  })

  // 13. 복사 버튼 클릭 시 navigator.clipboard.writeText 호출
  it('복사 버튼 클릭 시 clipboard.writeText가 호출된다', async () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', '복사 텍스트', 1000),
    ]))
    render(<ClipboardPanel />)
    fireEvent.click(screen.getByTitle('클립보드에 복사'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('복사 텍스트')
  })

  // 14. 긴 텍스트는 150자로 잘려서 표시
  it('150자 초과 텍스트는 잘려서 표시된다', () => {
    const longText = 'A'.repeat(200)
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', longText, 1000),
    ]))
    const { container } = render(<ClipboardPanel />)
    expect(container.textContent).toContain('...')
  })

  // 15. 펼치기 버튼으로 전체 텍스트 표시
  it('▼ 펼치기 클릭 시 접기 버튼으로 바뀐다', () => {
    const longText = 'B'.repeat(200)
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
      makeEntry('cb1', longText, 1000),
    ]))
    render(<ClipboardPanel />)
    fireEvent.click(screen.getByText(/펼치기/))
    expect(screen.getByText(/접기/)).toBeInTheDocument()
  })
})
