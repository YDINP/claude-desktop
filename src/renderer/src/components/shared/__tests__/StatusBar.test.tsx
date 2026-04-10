import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatusBar } from '../StatusBar'

// cost-tracker mock
vi.mock('../../../utils/cost-tracker', () => ({
  getTodayCost: vi.fn().mockReturnValue(0),
  getMonthlyCost: vi.fn().mockReturnValue(0),
}))

const BASE_PROPS = {
  model: 'claude-sonnet-4-6',
  totalCost: 0,
  cwd: null,
}

function mockApi() {
  Object.defineProperty(window, 'api', {
    value: {
      getMemoryUsage: vi.fn().mockResolvedValue({ rss: 100 * 1024 * 1024 }),
      onMemoryUpdate: vi.fn().mockReturnValue(vi.fn()),
      onCpuUpdate: vi.fn().mockReturnValue(vi.fn()),
    },
    writable: true,
    configurable: true,
  })
}

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi()
  })

  // 1. 기본 렌더 - 모델 레이블 표시
  it('모델 레이블이 표시된다', () => {
    render(<StatusBar {...BASE_PROPS} />)
    expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument()
  })

  // 2. cwd가 있으면 경로가 표시된다
  it('cwd가 있으면 경로가 표시된다', () => {
    render(<StatusBar {...BASE_PROPS} cwd="/home/user/myproject" />)
    expect(screen.getByText(/myproject/)).toBeInTheDocument()
  })

  // 3. cwd가 null이면 경로 미표시
  it('cwd가 null이면 경로를 표시하지 않는다', () => {
    const { container } = render(<StatusBar {...BASE_PROPS} cwd={null} />)
    // null cwd는 경로 span 자체가 없음
    const spans = container.querySelectorAll('span')
    const pathSpan = Array.from(spans).find(s => s.textContent?.includes('/'))
    expect(pathSpan).toBeUndefined()
  })

  // 4. 토큰 표시 - inputTokens > 0 이면 토큰 카운터 표시
  it('inputTokens가 있으면 토큰 카운터가 표시된다', () => {
    render(<StatusBar {...BASE_PROPS} inputTokens={500} outputTokens={100} />)
    expect(screen.getByText(/500↑/)).toBeInTheDocument()
    expect(screen.getByText(/100↓/)).toBeInTheDocument()
  })

  // 5. 토큰 1000 이상이면 k 단위로 표시
  it('1000 이상 토큰은 k 단위로 표시된다', () => {
    render(<StatusBar {...BASE_PROPS} inputTokens={2500} outputTokens={1200} />)
    expect(screen.getByText(/2\.5k↑/)).toBeInTheDocument()
    expect(screen.getByText(/1\.2k↓/)).toBeInTheDocument()
  })

  // 6. inputTokens=0이면 토큰 카운터 미표시
  it('inputTokens가 0이면 토큰 카운터가 표시되지 않는다', () => {
    render(<StatusBar {...BASE_PROPS} inputTokens={0} />)
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument()
  })

  // 7. 세션 경과 시간 - sessionCreatedAt 있으면 타이머 표시
  it('sessionCreatedAt이 있으면 경과 시간이 표시된다', () => {
    const createdAt = Date.now() - 5000 // 5초 전
    render(<StatusBar {...BASE_PROPS} sessionCreatedAt={createdAt} />)
    expect(screen.getByText(/⏱/)).toBeInTheDocument()
  })

  // 8. sessionCreatedAt 없으면 타이머 미표시
  it('sessionCreatedAt이 없으면 경과 시간이 표시되지 않는다', () => {
    render(<StatusBar {...BASE_PROPS} />)
    expect(screen.queryByText(/⏱/)).not.toBeInTheDocument()
  })

  // 9. contextUsage가 있으면 컨텍스트 바가 표시된다
  it('contextUsage가 있으면 컨텍스트 게이지가 표시된다', () => {
    render(<StatusBar {...BASE_PROPS} contextUsage={0.5} messageCount={10} />)
    expect(screen.getByText(/10msg/)).toBeInTheDocument()
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })

  // 10. contextUsage=0 이면 컨텍스트 바 미표시
  it('contextUsage가 0이면 컨텍스트 게이지가 표시되지 않는다', () => {
    render(<StatusBar {...BASE_PROPS} contextUsage={0} messageCount={0} />)
    expect(screen.queryByText(/msg/)).not.toBeInTheDocument()
  })

  // 11. ℹ 버튼 클릭 시 세션 정보 팝업 토글
  it('ℹ 버튼 클릭 시 세션 정보 팝업이 열린다', () => {
    render(<StatusBar {...BASE_PROPS} sessionTitle="테스트 세션" />)
    fireEvent.click(screen.getByTitle(/세션 정보/))
    expect(screen.getByText('테스트 세션')).toBeInTheDocument()
  })

  // 12. 세션 정보 팝업 닫기 버튼
  it('세션 정보 팝업의 닫기 버튼으로 팝업이 닫힌다', () => {
    render(<StatusBar {...BASE_PROPS} sessionTitle="테스트 세션" />)
    fireEvent.click(screen.getByTitle(/세션 정보/))
    expect(screen.getByText('테스트 세션')).toBeInTheDocument()
    fireEvent.click(screen.getByText('닫기'))
    expect(screen.queryByText('테스트 세션')).not.toBeInTheDocument()
  })

  // 13. onShowShortcuts 제공 시 ? 버튼 표시
  it('onShowShortcuts 제공 시 단축키 버튼이 표시된다', () => {
    const handler = vi.fn()
    render(<StatusBar {...BASE_PROPS} onShowShortcuts={handler} />)
    expect(screen.getByTitle(/키보드 단축키/)).toBeInTheDocument()
  })

  // 14. 단축키 버튼 클릭
  it('단축키 버튼 클릭 시 onShowShortcuts가 호출된다', () => {
    const handler = vi.fn()
    render(<StatusBar {...BASE_PROPS} onShowShortcuts={handler} />)
    fireEvent.click(screen.getByTitle(/키보드 단축키/))
    expect(handler).toHaveBeenCalledOnce()
  })

  // 15. 폰트 크기 - 기본값(14)이면 미표시
  it('chatFontSize=14(기본값)이면 폰트 크기를 표시하지 않는다', () => {
    render(<StatusBar {...BASE_PROPS} chatFontSize={14} />)
    expect(screen.queryByText('14px')).not.toBeInTheDocument()
  })

  // 16. 폰트 크기가 기본값이 아니면 표시
  it('chatFontSize가 기본값(14)이 아니면 폰트 크기가 표시된다', () => {
    render(<StatusBar {...BASE_PROPS} chatFontSize={16} />)
    expect(screen.getByText('16px')).toBeInTheDocument()
  })

  // 17. totalCost > 0 이면 비용이 표시된다
  it('totalCost > 0 이면 누적 비용이 표시된다', () => {
    render(<StatusBar {...BASE_PROPS} totalCost={0.0123} />)
    expect(screen.getByText(/\$0\.0123/)).toBeInTheDocument()
  })
})
