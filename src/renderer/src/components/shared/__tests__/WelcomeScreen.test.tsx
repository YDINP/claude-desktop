import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WelcomeScreen } from '../WelcomeScreen'

function mockApi(overrides: Partial<typeof window.api> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      settingsGet: vi.fn().mockResolvedValue({ anthropicApiKey: 'test-key' }),
      getRecentProjects: vi.fn().mockResolvedValue([]),
      sessionList: vi.fn().mockResolvedValue([]),
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockApi()
  })

  // 1. 기본 렌더
  it('Claude Desktop 타이틀을 렌더한다', () => {
    render(<WelcomeScreen />)
    expect(screen.getByText('Claude Desktop')).toBeInTheDocument()
  })

  // 2. 폴더 열기 버튼
  it('폴더 열기 버튼이 표시된다', () => {
    render(<WelcomeScreen />)
    expect(screen.getByText('폴더 열기')).toBeInTheDocument()
  })

  // 3. 폴더 열기 클릭 콜백
  it('폴더 열기 버튼 클릭 시 onOpenFolder 호출된다', () => {
    const handler = vi.fn()
    render(<WelcomeScreen onOpenFolder={handler} />)
    fireEvent.click(screen.getByText('폴더 열기'))
    expect(handler).toHaveBeenCalledOnce()
  })

  // 4. API 키 있으면 경고 배너 미표시
  it('API 키가 있으면 경고 배너를 표시하지 않는다', async () => {
    mockApi({ settingsGet: vi.fn().mockResolvedValue({ anthropicApiKey: 'sk-test' }) })
    render(<WelcomeScreen />)
    await waitFor(() => {
      expect(screen.queryByText('API 키 미설정')).not.toBeInTheDocument()
    })
  })

  // 5. API 키 없으면 경고 배너 표시
  it('API 키가 없으면 경고 배너를 표시한다', async () => {
    mockApi({ settingsGet: vi.fn().mockResolvedValue({ anthropicApiKey: '' }) })
    render(<WelcomeScreen />)
    await waitFor(() => {
      expect(screen.getByText('API 키 미설정')).toBeInTheDocument()
    })
  })

  // 6. 경고 배너의 설정에서 입력 버튼
  it('경고 배너에 설정에서 입력 버튼이 있다', async () => {
    mockApi({ settingsGet: vi.fn().mockResolvedValue({ anthropicApiKey: '' }) })
    render(<WelcomeScreen />)
    await waitFor(() => {
      expect(screen.getByText('설정에서 입력')).toBeInTheDocument()
    })
  })

  // 7. settingsGet 실패해도 경고 배너 없음
  it('settingsGet 실패 시 경고 배너를 표시하지 않는다', async () => {
    mockApi({ settingsGet: vi.fn().mockRejectedValue(new Error('fail')) })
    render(<WelcomeScreen />)
    await waitFor(() => {
      expect(screen.queryByText('API 키 미설정')).not.toBeInTheDocument()
    })
  })

  // 8. 최근 프로젝트 목록 표시
  it('최근 프로젝트 목록을 표시한다', async () => {
    mockApi({
      getRecentProjects: vi.fn().mockResolvedValue([
        'C:/Projects/my-app',
        'C:/Projects/another-project',
      ]),
    })
    render(<WelcomeScreen />)
    await waitFor(() => {
      expect(screen.getByText('최근 프로젝트')).toBeInTheDocument()
    })
    expect(screen.getByText('my-app')).toBeInTheDocument()
    expect(screen.getByText('another-project')).toBeInTheDocument()
  })

  // 9. 최근 프로젝트 클릭 시 onOpenPath 호출
  it('최근 프로젝트 클릭 시 onOpenPath가 호출된다', async () => {
    const handler = vi.fn()
    mockApi({
      getRecentProjects: vi.fn().mockResolvedValue(['C:/Projects/test-app']),
    })
    render(<WelcomeScreen onOpenPath={handler} />)
    await waitFor(() => screen.getByText('test-app'))
    fireEvent.click(screen.getByText('test-app'))
    expect(handler).toHaveBeenCalledWith('C:/Projects/test-app')
  })

  // 10. 최근 프로젝트 최대 6개 표시
  it('최근 프로젝트는 최대 6개만 표시한다', async () => {
    const projects = Array.from({ length: 8 }, (_, i) => `C:/p/proj${i + 1}`)
    mockApi({ getRecentProjects: vi.fn().mockResolvedValue(projects) })
    render(<WelcomeScreen />)
    await waitFor(() => screen.getByText('proj1'))
    expect(screen.getByText('proj6')).toBeInTheDocument()
    expect(screen.queryByText('proj7')).not.toBeInTheDocument()
  })

  // 11. 최근 세션 표시
  it('최근 세션을 표시한다', async () => {
    mockApi({
      sessionList: vi.fn().mockResolvedValue([
        { id: 's1', title: '세션 제목', cwd: 'C:/Projects/myapp', updatedAt: Date.now() },
      ]),
    })
    render(<WelcomeScreen />)
    await waitFor(() => {
      expect(screen.getByText('최근 대화')).toBeInTheDocument()
    })
    expect(screen.getByText('세션 제목')).toBeInTheDocument()
  })

  // 12. 세션 제목 없으면 기본값 '대화' 표시
  it('세션 제목이 없으면 대화로 표시한다', async () => {
    mockApi({
      sessionList: vi.fn().mockResolvedValue([
        { id: 's1', title: '', cwd: 'C:/Projects/app', updatedAt: Date.now() },
      ]),
    })
    render(<WelcomeScreen />)
    await waitFor(() => screen.getByText('최근 대화'))
    expect(screen.getByText('대화')).toBeInTheDocument()
  })

  // 13. 세션 클릭 시 onOpenSession 호출
  it('세션 클릭 시 onOpenSession이 호출된다', async () => {
    const handler = vi.fn()
    mockApi({
      sessionList: vi.fn().mockResolvedValue([
        { id: 'session-abc', title: '내 세션', cwd: 'C:/Projects/app', updatedAt: 1000 },
      ]),
    })
    render(<WelcomeScreen onOpenSession={handler} />)
    await waitFor(() => screen.getByText('내 세션'))
    fireEvent.click(screen.getByText('내 세션'))
    expect(handler).toHaveBeenCalledWith('session-abc', 'C:/Projects/app')
  })

  // 14. 최근 세션 최대 4개 표시 (updatedAt 내림차순 정렬 후 4개)
  it('최근 세션은 최대 4개만 표시한다', async () => {
    const sessions = Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      title: `세션${i + 1}`,
      cwd: `C:/p/app${i}`,
      updatedAt: i * 1000,
    }))
    mockApi({ sessionList: vi.fn().mockResolvedValue(sessions) })
    render(<WelcomeScreen />)
    // updatedAt 내림차순 → 세션6, 5, 4, 3 (4개)
    await waitFor(() => screen.getByText('세션6'))
    expect(screen.getByText('세션5')).toBeInTheDocument()
    expect(screen.queryByText('세션1')).not.toBeInTheDocument()
    expect(screen.queryByText('세션2')).not.toBeInTheDocument()
  })

  // 15. 유효하지 않은 세션 항목은 필터링
  it('필수 필드 없는 세션은 표시하지 않는다', async () => {
    mockApi({
      sessionList: vi.fn().mockResolvedValue([
        { id: 's1', title: '정상 세션', cwd: 'C:/p', updatedAt: 1000 },
        { id: 's2', title: '필드 없음', updatedAt: 1000 },
        { cwd: 'C:/p', updatedAt: 1000 },
      ]),
    })
    render(<WelcomeScreen />)
    await waitFor(() => screen.getByText('정상 세션'))
    expect(screen.queryByText('필드 없음')).not.toBeInTheDocument()
  })

  // 16. 프로젝트 없으면 최근 프로젝트 섹션 미표시
  it('최근 프로젝트가 없으면 섹션을 표시하지 않는다', async () => {
    mockApi({ getRecentProjects: vi.fn().mockResolvedValue([]) })
    render(<WelcomeScreen />)
    await waitFor(() => {
      expect(screen.queryByText('최근 프로젝트')).not.toBeInTheDocument()
    })
  })

  // 17. 세션 없으면 최근 대화 섹션 미표시
  it('최근 세션이 없으면 섹션을 표시하지 않는다', async () => {
    mockApi({ sessionList: vi.fn().mockResolvedValue([]) })
    render(<WelcomeScreen />)
    await waitFor(() => {
      expect(screen.queryByText('최근 대화')).not.toBeInTheDocument()
    })
  })

  // 18. subtitle 표시
  it('AI 코딩 어시스턴트 부제목이 표시된다', () => {
    render(<WelcomeScreen />)
    expect(screen.getByText('AI 코딩 어시스턴트')).toBeInTheDocument()
  })
})
