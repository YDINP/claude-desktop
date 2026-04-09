import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConnectionPanel } from '../ConnectionPanel'

// clipboard mock
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

const SERVERS = [
  { name: 'qmd', command: 'qmd', args: ['mcp'], configFile: '/config.json' },
  { name: 'github', command: 'gh', args: ['mcp', 'server'], configFile: '/config.json' },
]

function mockApi(overrides: Record<string, unknown> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      getMcpServers: vi.fn().mockResolvedValue({
        servers: SERVERS,
        configFile: '/home/.config/mcp.json',
      }),
      pingMcpServer: vi.fn().mockResolvedValue({ alive: true, latency: 42 }),
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

describe('ConnectionPanel', () => {
  beforeEach(() => {
    mockApi()
    vi.clearAllMocks()
  })

  // 1. 서버 목록 로드 후 표시
  it('서버 목록이 로드되어 표시된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getAllByText('qmd').length).toBeGreaterThan(0))
    expect(screen.getAllByText('github').length).toBeGreaterThan(0)
  })

  // 2. 서버 개수 배지 표시
  it('서버 개수 배지가 표시된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getAllByText('qmd').length).toBeGreaterThan(0))
    // 배지에 '2' 표시
    const badge = await screen.findByText('2')
    expect(badge).toBeInTheDocument()
  })

  // 3. 빈 서버 목록 메시지
  it('서버가 없으면 빈 메시지가 표시된다', async () => {
    mockApi({ getMcpServers: vi.fn().mockResolvedValue({ servers: [], configFile: null }) })
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getByText(/MCP 서버가 설정되지/)).toBeInTheDocument())
  })

  // 4. 새로고침 버튼 클릭 시 getMcpServers 재호출
  it('새로고침 버튼 클릭 시 getMcpServers가 다시 호출된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getAllByText('qmd').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('새로고침'))
    await waitFor(() => expect(window.api.getMcpServers).toHaveBeenCalledTimes(2))
  })

  // 5. 개별 서버 ping 버튼
  it('ping 버튼 클릭 시 pingMcpServer가 호출된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getAllByText('qmd').length).toBeGreaterThan(0))
    const pingBtns = screen.getAllByText('ping')
    fireEvent.click(pingBtns[0])
    await waitFor(() => expect(window.api.pingMcpServer).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'qmd' })
    ))
  })

  // 6. ping 성공 후 활성 상태 표시
  it('ping 성공 시 활성 상태와 레이턴시가 표시된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getAllByText('qmd').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('ping')[0])
    await waitFor(() => expect(screen.getAllByText(/활성/).length).toBeGreaterThan(0))
    expect(screen.getByText(/42ms/)).toBeInTheDocument()
  })

  // 7. ping 실패 시 응답 없음 표시
  it('ping 실패 시 응답 없음이 표시된다', async () => {
    mockApi({ pingMcpServer: vi.fn().mockResolvedValue({ alive: false, latency: undefined }) })
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getAllByText('qmd').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('ping')[0])
    await waitFor(() => expect(screen.getAllByText(/응답 없음/).length).toBeGreaterThan(0))
  })

  // 8. 모두 핑 버튼
  it('모두 핑 버튼 클릭 시 모든 서버에 ping이 호출된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getAllByText('qmd').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('모두 핑'))
    await waitFor(() => expect(window.api.pingMcpServer).toHaveBeenCalledTimes(2))
  })

  // 9. 설정 파일 경로 표시
  it('설정 파일 경로가 표시된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getByText(/mcp\.json/)).toBeInTheDocument())
  })

  // 10. 설정 파일 경로 복사 버튼
  it('설정 파일 경로 복사 버튼 클릭 시 클립보드에 복사된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => screen.getByText(/mcp\.json/))
    // footer 복사 버튼
    const footer = screen.getByText(/설정 파일/).closest('div')!
    const copyBtn = footer.querySelector('button')!
    fireEvent.click(copyBtn)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/home/.config/mcp.json'))
  })

  // 11. 명령어 복사 버튼
  it('명령어 복사 버튼 클릭 시 클립보드에 명령어가 복사된다', async () => {
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.getAllByText('qmd').length).toBeGreaterThan(0))
    // 첫 번째 서버의 copy 버튼 (📋)
    const copyBtns = screen.getAllByTitle(/명령어 복사/)
    fireEvent.click(copyBtns[0])
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('qmd mcp'))
  })

  // 12. getMcpServers 실패 시 빈 상태
  it('getMcpServers 실패 시 서버 목록이 비어있다', async () => {
    mockApi({ getMcpServers: vi.fn().mockRejectedValue(new Error('fail')) })
    render(<ConnectionPanel />)
    await waitFor(() => expect(screen.queryByText('qmd')).not.toBeInTheDocument())
  })

  // 13. 서버 4개 이상 시 검색창 표시
  it('서버가 4개 이상이면 검색창이 표시된다', async () => {
    const manyServers = Array.from({ length: 4 }, (_, i) => ({
      name: `server${i}`,
      command: `cmd${i}`,
      args: [],
      configFile: '/cfg',
    }))
    mockApi({ getMcpServers: vi.fn().mockResolvedValue({ servers: manyServers, configFile: '/cfg' }) })
    render(<ConnectionPanel />)
    await waitFor(() => screen.getByText('server0'))
    expect(screen.getByPlaceholderText(/서버 검색/)).toBeInTheDocument()
  })

  // 14. 서버 검색 필터링
  it('서버 검색 입력 시 일치하는 서버만 표시된다', async () => {
    const manyServers = Array.from({ length: 4 }, (_, i) => ({
      name: `server${i}`,
      command: `cmd${i}`,
      args: [],
      configFile: '/cfg',
    }))
    mockApi({ getMcpServers: vi.fn().mockResolvedValue({ servers: manyServers, configFile: '/cfg' }) })
    render(<ConnectionPanel />)
    await waitFor(() => screen.getByText('server0'))
    const searchInput = screen.getByPlaceholderText(/서버 검색/)
    fireEvent.change(searchInput, { target: { value: 'server1' } })
    expect(screen.getByText('server1')).toBeInTheDocument()
    expect(screen.queryByText('server0')).not.toBeInTheDocument()
  })
})
