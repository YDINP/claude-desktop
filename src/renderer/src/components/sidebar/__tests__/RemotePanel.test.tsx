import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RemotePanel } from '../RemotePanel'

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

// window.api.listSshHosts mock
const mockListSshHosts = vi.fn()
Object.defineProperty(window, 'api', {
  value: { listSshHosts: mockListSshHosts },
  writable: true,
})

const SAVED_HOSTS_KEY = 'claude-remote-saved-hosts'

function makeSavedHost(savedId: string, name: string, host: string, user: string, port = 22, lastUsed = Date.now()) {
  return { savedId, name, host, port, user, lastUsed }
}

describe('RemotePanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    mockListSshHosts.mockResolvedValue([])
  })

  // 1. 기본 렌더 — 헤더 표시
  it('기본 렌더 시 원격 호스트 헤더가 표시된다', async () => {
    render(<RemotePanel />)
    expect(await screen.findByText(/원격 호스트|Remote Hosts/i)).toBeInTheDocument()
  })

  // 2. SSH 호스트 없을 때 빈 상태 메시지
  it('호스트가 없으면 빈 상태 메시지가 표시된다', async () => {
    render(<RemotePanel />)
    expect(await screen.findByText(/등록된 호스트가 없습니다|No.*host/i)).toBeInTheDocument()
  })

  // 3. SSH Config 호스트 목록 표시
  it('SSH Config 호스트가 있으면 목록에 표시된다', async () => {
    mockListSshHosts.mockResolvedValue([
      { alias: 'myserver', hostname: '192.168.0.1', port: 22, user: 'ubuntu' },
    ])
    render(<RemotePanel />)
    expect(await screen.findByText('myserver')).toBeInTheDocument()
  })

  // 4. SSH Config 섹션 헤더 표시
  it('SSH Config 호스트가 있으면 SSH Config 섹션 헤더가 표시된다', async () => {
    mockListSshHosts.mockResolvedValue([
      { alias: 'srv1', hostname: '10.0.0.1', port: 22, user: 'root' },
    ])
    render(<RemotePanel />)
    expect(await screen.findByText(/SSH Config/i)).toBeInTheDocument()
  })

  // 5. SSH 명령어 복사 버튼
  it('SSH 복사 버튼 클릭 시 clipboard.writeText가 호출된다', async () => {
    mockListSshHosts.mockResolvedValue([
      { alias: 'myhost', hostname: '10.0.0.5', port: 22, user: 'admin' },
    ])
    render(<RemotePanel />)
    await screen.findByText('myhost')
    fireEvent.click(screen.getByTitle('SSH 명령어 복사'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ssh admin@10.0.0.5')
  })

  // 6. 비기본 포트 SSH 명령어에 -p 포함
  it('포트가 22가 아니면 SSH 명령어에 -p 옵션이 포함된다', async () => {
    mockListSshHosts.mockResolvedValue([
      { alias: 'custport', hostname: '10.0.0.6', port: 2222, user: 'ubuntu' },
    ])
    render(<RemotePanel />)
    await screen.findByText('custport')
    fireEvent.click(screen.getByTitle('SSH 명령어 복사'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ssh ubuntu@10.0.0.6 -p 2222')
  })

  // 7. 호스트 검색 필터링 (SSH Config)
  it('검색어 입력 시 이름으로 SSH Config 호스트가 필터링된다', async () => {
    mockListSshHosts.mockResolvedValue([
      { alias: 'webserver', hostname: '10.0.0.1', port: 22, user: 'ubuntu' },
      { alias: 'dbserver', hostname: '10.0.0.2', port: 22, user: 'root' },
    ])
    render(<RemotePanel />)
    await screen.findByText('webserver')
    fireEvent.change(screen.getByPlaceholderText(/검색|search/i), { target: { value: 'web' } })
    expect(screen.getByText('webserver')).toBeInTheDocument()
    expect(screen.queryByText('dbserver')).not.toBeInTheDocument()
  })

  // 8. ESC로 검색어 초기화
  it('검색창에서 ESC 입력 시 검색어가 초기화된다', async () => {
    mockListSshHosts.mockResolvedValue([
      { alias: 'alpha', hostname: '1.1.1.1', port: 22, user: 'u' },
      { alias: 'beta', hostname: '2.2.2.2', port: 22, user: 'u' },
    ])
    render(<RemotePanel />)
    await screen.findByText('alpha')
    const searchInput = screen.getByPlaceholderText(/검색|search/i)
    fireEvent.change(searchInput, { target: { value: 'alpha' } })
    expect(screen.queryByText('beta')).not.toBeInTheDocument()
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(screen.getByText('beta')).toBeInTheDocument()
  })

  // 9. + 버튼 클릭 시 호스트 추가 폼 표시
  it('+ 버튼 클릭 시 호스트 추가 폼이 표시된다', async () => {
    render(<RemotePanel />)
    await screen.findByText(/원격 호스트|Remote Hosts/i)
    fireEvent.click(screen.getByTitle('호스트 추가'))
    expect(screen.getByPlaceholderText('이름')).toBeInTheDocument()
  })

  // 10. 호스트 추가 폼 — 필수 필드 비어있으면 저장 버튼 비활성화
  it('필수 필드가 비어있으면 저장 버튼이 비활성화된다', async () => {
    render(<RemotePanel />)
    await screen.findByText(/원격 호스트|Remote Hosts/i)
    fireEvent.click(screen.getByTitle('호스트 추가'))
    expect(screen.getByText(/저장|save/i)).toBeDisabled()
  })

  // 11. 호스트 추가 후 목록에 표시
  it('호스트 추가 후 저장된 호스트 섹션에 표시된다', async () => {
    render(<RemotePanel />)
    await screen.findByText(/원격 호스트|Remote Hosts/i)
    fireEvent.click(screen.getByTitle('호스트 추가'))
    fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '새 서버' } })
    fireEvent.change(screen.getByPlaceholderText(/호스트/i), { target: { value: '192.168.1.100' } })
    fireEvent.change(screen.getByPlaceholderText('사용자'), { target: { value: 'admin' } })
    fireEvent.click(screen.getByText(/저장|save/i))
    expect(screen.getByText('새 서버')).toBeInTheDocument()
  })

  // 12. 추가 후 폼이 닫힘
  it('호스트 저장 후 추가 폼이 닫힌다', async () => {
    render(<RemotePanel />)
    await screen.findByText(/원격 호스트|Remote Hosts/i)
    fireEvent.click(screen.getByTitle('호스트 추가'))
    fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '서버A' } })
    fireEvent.change(screen.getByPlaceholderText(/호스트/i), { target: { value: '10.0.0.1' } })
    fireEvent.change(screen.getByPlaceholderText('사용자'), { target: { value: 'root' } })
    fireEvent.click(screen.getByText(/저장|save/i))
    expect(screen.queryByPlaceholderText('이름')).not.toBeInTheDocument()
  })

  // 13. 취소 버튼으로 폼 닫힘
  it('취소 버튼 클릭 시 추가 폼이 닫힌다', async () => {
    render(<RemotePanel />)
    await screen.findByText(/원격 호스트|Remote Hosts/i)
    fireEvent.click(screen.getByTitle('호스트 추가'))
    fireEvent.click(screen.getByText(/취소|cancel/i))
    expect(screen.queryByPlaceholderText('이름')).not.toBeInTheDocument()
  })

  // 14. 저장된 호스트 localStorage 저장
  it('호스트 추가 시 localStorage에 저장된다', async () => {
    render(<RemotePanel />)
    await screen.findByText(/원격 호스트|Remote Hosts/i)
    fireEvent.click(screen.getByTitle('호스트 추가'))
    fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '저장테스트' } })
    fireEvent.change(screen.getByPlaceholderText(/호스트/i), { target: { value: '192.168.0.99' } })
    fireEvent.change(screen.getByPlaceholderText('사용자'), { target: { value: 'ubuntu' } })
    fireEvent.click(screen.getByText(/저장|save/i))
    const stored = JSON.parse(localStorageMock.getItem(SAVED_HOSTS_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('저장테스트')
  })

  // 15. 저장된 호스트 삭제
  it('× 버튼 클릭 시 저장된 호스트가 삭제된다', async () => {
    localStorageMock.setItem(SAVED_HOSTS_KEY, JSON.stringify([
      makeSavedHost('s1', '삭제서버', '10.0.0.1', 'root'),
    ]))
    render(<RemotePanel />)
    await screen.findByText('삭제서버')
    fireEvent.click(screen.getByTitle('삭제'))
    expect(screen.queryByText('삭제서버')).not.toBeInTheDocument()
  })

  // 16. 저장된 호스트 SSH 복사
  it('저장된 호스트의 복사 버튼 클릭 시 SSH 명령어가 복사된다', async () => {
    localStorageMock.setItem(SAVED_HOSTS_KEY, JSON.stringify([
      makeSavedHost('s1', '복사서버', '10.0.0.2', 'ubuntu'),
    ]))
    render(<RemotePanel />)
    await screen.findByText('복사서버')
    fireEvent.click(screen.getByTitle('SSH 명령어 복사'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ssh ubuntu@10.0.0.2')
  })

  // 17. 저장된 호스트 섹션 헤더 표시
  it('저장된 호스트가 있으면 저장된 호스트 섹션 헤더가 표시된다', async () => {
    localStorageMock.setItem(SAVED_HOSTS_KEY, JSON.stringify([
      makeSavedHost('s1', '섹션테스트', '10.0.0.3', 'admin'),
    ]))
    render(<RemotePanel />)
    expect(await screen.findByText(/저장된 호스트/i)).toBeInTheDocument()
  })

  // 18. 호스트 수 배지 표시
  it('총 호스트 수가 배지로 표시된다', async () => {
    localStorageMock.setItem(SAVED_HOSTS_KEY, JSON.stringify([
      makeSavedHost('s1', '서버1', '10.0.0.1', 'root'),
      makeSavedHost('s2', '서버2', '10.0.0.2', 'root'),
    ]))
    render(<RemotePanel />)
    expect(await screen.findByText(/2개/)).toBeInTheDocument()
  })

  // 19. 검색으로 저장된 호스트 필터링
  it('검색어 입력 시 저장된 호스트도 필터링된다', async () => {
    localStorageMock.setItem(SAVED_HOSTS_KEY, JSON.stringify([
      makeSavedHost('s1', 'prod-server', '10.0.0.1', 'admin'),
      makeSavedHost('s2', 'dev-server', '10.0.0.2', 'admin'),
    ]))
    render(<RemotePanel />)
    await screen.findByText('prod-server')
    fireEvent.change(screen.getByPlaceholderText(/검색|search/i), { target: { value: 'prod' } })
    expect(screen.getByText('prod-server')).toBeInTheDocument()
    expect(screen.queryByText('dev-server')).not.toBeInTheDocument()
  })

  // 20. 로딩 중 메시지
  it('SSH 설정 로딩 중에 로딩 메시지가 표시된다', () => {
    // never-resolving promise — loading state stays
    mockListSshHosts.mockReturnValue(new Promise(() => {}))
    render(<RemotePanel />)
    expect(screen.getByText(/SSH 설정 로딩 중|Loading SSH/i)).toBeInTheDocument()
  })
})
