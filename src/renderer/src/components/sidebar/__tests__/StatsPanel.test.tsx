import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatsPanel } from '../StatsPanel'

// clipboard mock
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

// cost-tracker mock (localStorage 기반이라 실제 모듈 모킹)
vi.mock('../../../utils/cost-tracker', () => ({
  getDailyCosts: vi.fn().mockReturnValue([]),
  getTodayCost: vi.fn().mockReturnValue(0),
  getMonthlyCost: vi.fn().mockReturnValue(0),
}))

const BASE_STATS = {
  totalSessions: 42,
  topTags: [{ tag: 'react', count: 5 }, { tag: 'typescript', count: 3 }],
  dailyCounts: [1, 2, 3, 4, 5, 6, 7],
  dailyCountsMap: {
    [new Date(Date.now() - 86400000).toISOString().slice(0, 10)]: 3,
    [new Date().toISOString().slice(0, 10)]: 5,
  },
  recentCount: 12,
  totalMessages: 200,
  avgMessagesPerSession: 5,
  dailyMessageCounts: [10, 20, 30, 40, 50, 60, 70],
  topSessions: [
    { id: 's1', title: '세션1', messageCount: 50 },
    { id: 's2', title: '세션2', messageCount: 30 },
  ],
}

function mockApi(overrides: Record<string, unknown> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      sessionGlobalStats: vi.fn().mockResolvedValue(BASE_STATS),
      sessionList: vi.fn().mockResolvedValue([
        { title: '프로젝트 작업' },
        { title: 'React 개발' },
      ]),
      generateInsights: vi.fn().mockResolvedValue('분석 결과입니다'),
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

describe('StatsPanel', () => {
  beforeEach(() => {
    mockApi()
    localStorage.clear()
    vi.clearAllMocks()
  })

  // 1. 로딩 중 표시
  it('로딩 중 메시지가 표시된다', () => {
    // 절대 resolve 안 하는 mock
    Object.defineProperty(window, 'api', {
      value: {
        sessionGlobalStats: vi.fn().mockReturnValue(new Promise(() => {})),
        sessionList: vi.fn().mockReturnValue(new Promise(() => {})),
        generateInsights: vi.fn(),
      },
      writable: true,
      configurable: true,
    })
    render(<StatsPanel />)
    expect(screen.getByText(/로딩 중/)).toBeInTheDocument()
  })

  // 2. 전체 세션 수 표시
  it('전체 세션 수가 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
  })

  // 3. 최근 7일 세션 수 표시
  it('최근 7일 세션 수가 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText('42'))
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  // 4. 새로고침 버튼 클릭 시 재호출
  it('새로고침 버튼 클릭 시 sessionGlobalStats가 다시 호출된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText('42'))
    fireEvent.click(screen.getByTitle(/통계 새로고침/))
    await waitFor(() => expect(window.api.sessionGlobalStats).toHaveBeenCalledTimes(2))
  })

  // 5. 태그 목록 표시
  it('자주 쓰는 태그가 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText('42'))
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()
  })

  // 6. 히트맵 렌더
  it('활동 히트맵 제목이 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText(/활동 히트맵/))
  })

  // 7. 전체 메시지 수 표시
  it('전체 메시지 수가 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText('200'))
  })

  // 8. 평균 메시지 수 표시
  it('평균 메시지 수가 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => expect(screen.getAllByText('5').length).toBeGreaterThan(0))
  })

  // 9. 통계 복사 버튼
  it('통계 복사 버튼 클릭 시 클립보드에 복사된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText('42'))
    const copyBtn = screen.getByTitle(/통계 요약 복사/)
    fireEvent.click(copyBtn)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(copied).toContain('42')
  })

  // 10. AI 인사이트 섹션 토글
  it('AI 인사이트 버튼 클릭 시 섹션이 열린다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText(/AI 인사이트/))
    fireEvent.click(screen.getByText(/AI 인사이트/))
    expect(await screen.findByText('분석 생성')).toBeInTheDocument()
  })

  // 11. 분석 생성 버튼 클릭 시 generateInsights 호출
  it('분석 생성 클릭 시 generateInsights가 호출되고 결과가 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText(/AI 인사이트/))
    fireEvent.click(screen.getByText(/AI 인사이트/))
    fireEvent.click(await screen.findByText('분석 생성'))
    await waitFor(() => expect(screen.getByText('분석 결과입니다')).toBeInTheDocument())
  })

  // 12. 자주 쓴 단어 섹션 토글
  it('자주 쓴 단어 버튼 클릭 시 섹션이 열린다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText(/자주 쓴 단어/))
    fireEvent.click(screen.getByText(/자주 쓴 단어/))
    // sessionList에서 가져온 단어 표시
    await waitFor(() => expect(screen.getByText('프로젝트')).toBeInTheDocument())
  })

  // 13. TOP5 세션 섹션 토글
  it('메시지 많은 세션 버튼 클릭 시 세션 목록이 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => screen.getByText(/메시지 많은 세션/))
    fireEvent.click(screen.getByText(/메시지 많은 세션/))
    await waitFor(() => expect(screen.getByText('세션1')).toBeInTheDocument())
    expect(screen.getByText('세션2')).toBeInTheDocument()
  })

  // 14. 태그 없는 경우 메시지
  it('태그가 없으면 태그 없음이 표시된다', async () => {
    mockApi({ sessionGlobalStats: vi.fn().mockResolvedValue({ ...BASE_STATS, topTags: [] }) })
    render(<StatsPanel />)
    await waitFor(() => expect(screen.getByText(/태그 없음/)).toBeInTheDocument())
  })

  // 15. 요일별 활동 분포
  it('요일별 활동 분포 차트가 표시된다', async () => {
    render(<StatsPanel />)
    await waitFor(() => expect(screen.getByText(/요일별 활동 분포/)).toBeInTheDocument())
  })

  // 16. sessionGlobalStats 실패 시 로딩 상태 유지
  it('sessionGlobalStats 실패 시 로딩 메시지가 유지된다', async () => {
    mockApi({ sessionGlobalStats: vi.fn().mockRejectedValue(new Error('fail')) })
    render(<StatsPanel />)
    await new Promise(r => setTimeout(r, 200))
    expect(screen.getByText(/로딩 중/)).toBeInTheDocument()
  })
})
