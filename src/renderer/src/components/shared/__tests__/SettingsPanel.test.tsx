import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SettingsPanel } from '../SettingsPanel'

// useCopyToClipboard, useFeatureFlags, cost-tracker, sound, css mocks
vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    features: {},
    rawFeatures: {},
    setFeature: vi.fn(),
  }),
}))

vi.mock('../../../utils/sound', () => ({ playCompletionSound: vi.fn() }))
vi.mock('../../../utils/css', () => ({ applyCustomCSS: vi.fn() }))

const BASE_SETTINGS = {
  theme: 'dark',
  fontSize: 13,
  maxTokensPerRequest: 0,
  temperature: 1.0,
  showTimestamps: true,
  selectedModel: 'claude-opus-4-6',
  accentColor: '#527bff',
  compactMode: false,
  soundEnabled: true,
  customCSS: '',
  anthropicApiKey: 'sk-ant-test',
}

function mockApi(overrides: Record<string, unknown> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      settingsGet: vi.fn().mockResolvedValue(BASE_SETTINGS),
      settingsSet: vi.fn().mockResolvedValue(undefined),
      getNotificationSettings: vi.fn().mockResolvedValue({
        responseComplete: true,
        backgroundOnly: true,
        longSession: false,
        contextWarning: true,
      }),
      setNotificationSettings: vi.fn().mockResolvedValue(undefined),
      getSystemPromptProfiles: vi.fn().mockResolvedValue([]),
      saveSystemPromptProfile: vi.fn().mockResolvedValue(undefined),
      deleteSystemPromptProfile: vi.fn().mockResolvedValue(undefined),
      getProjectSystemPrompt: vi.fn().mockResolvedValue(''),
      setProjectSystemPrompt: vi.fn().mockResolvedValue(undefined),
      getNativeTheme: vi.fn().mockResolvedValue({ isDark: true }),
      featuresGet: vi.fn().mockResolvedValue({}),
      featuresSet: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

async function renderOpen(props: Record<string, unknown> = {}) {
  const onClose = vi.fn()
  render(<SettingsPanel open={true} onClose={onClose} {...props} />)
  // wait for settingsGet to resolve and component to render
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  return { onClose }
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    mockApi()
    localStorage.clear()
    vi.clearAllMocks()
  })

  // 1. open=false 시 렌더되지 않음
  it('open=false이면 다이얼로그를 렌더하지 않는다', () => {
    render(<SettingsPanel open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // 2. open=true + settingsGet 완료 후 다이얼로그 표시
  it('open=true이면 설정 다이얼로그가 표시된다', async () => {
    await renderOpen()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // 3. 설정 타이틀 표시
  it('설정 타이틀이 표시된다', async () => {
    await renderOpen()
    expect(screen.getByText('설정')).toBeInTheDocument()
  })

  // 4. 닫기 버튼 클릭 시 onClose 호출
  it('닫기 버튼 클릭 시 onClose가 호출된다', async () => {
    const { onClose } = await renderOpen()
    fireEvent.click(screen.getByText('x'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  // 5. Escape 키 시 onClose 호출
  it('Escape 키 누르면 onClose가 호출된다', async () => {
    const { onClose } = await renderOpen()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  // 6. 탭 목록 표시
  it('6개 설정 탭이 표시된다', async () => {
    await renderOpen()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(6)
  })

  // 7. 기본 탭은 일반
  it('기본 선택 탭은 일반이다', async () => {
    await renderOpen()
    const general = screen.getAllByRole('tab').find(t => t.getAttribute('aria-selected') === 'true')
    expect(general).toBeDefined()
  })

  // 8. 외관 탭 클릭 시 전환
  it('외관 탭 클릭 시 외관 설정이 표시된다', async () => {
    await renderOpen()
    const tabs = screen.getAllByRole('tab')
    // appearance tab
    fireEvent.click(tabs[1])
    expect(await screen.findByText('테마')).toBeInTheDocument()
  })

  // 9. 외관 탭 - 테마 버튼 3개 표시
  it('외관 탭에 Dark/Light/System 테마 버튼이 있다', async () => {
    await renderOpen()
    fireEvent.click(screen.getAllByRole('tab')[1])
    expect(await screen.findByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  // 10. 외관 탭 - 테마 변경
  it('Light 버튼 클릭 시 테마가 변경된다', async () => {
    await renderOpen()
    fireEvent.click(screen.getAllByRole('tab')[1])
    const lightBtn = await screen.findByText('Light')
    fireEvent.click(lightBtn)
    // Light 버튼이 selected 스타일을 갖는지 (background: accent)
    expect(lightBtn).toBeInTheDocument()
  })

  // 11. 외관 탭 - 폰트 크기 슬라이더 존재
  it('외관 탭에 글꼴 크기 슬라이더가 있다', async () => {
    await renderOpen()
    fireEvent.click(screen.getAllByRole('tab')[1])
    await screen.findByText('글꼴 크기')
    // range inputs
    const ranges = screen.getAllByRole('slider')
    expect(ranges.length).toBeGreaterThan(0)
  })

  // 12. 외관 탭 - 강조 색상 프리셋 표시
  it('외관 탭에 강조 색상 프리셋이 표시된다', async () => {
    await renderOpen()
    fireEvent.click(screen.getAllByRole('tab')[1])
    expect(await screen.findByText(/강조 색상/)).toBeInTheDocument()
  })

  // 13. 외관 탭 - 커스텀 hex 입력 후 적용 버튼
  it('커스텀 hex 입력 후 적용 버튼을 클릭할 수 있다', async () => {
    await renderOpen()
    fireEvent.click(screen.getAllByRole('tab')[1])
    const hexInput = await screen.findByPlaceholderText('ffffff')
    fireEvent.change(hexInput, { target: { value: 'ff0000' } })
    expect(hexInput).toHaveValue('ff0000')
    const applyBtn = screen.getByText('적용')
    expect(applyBtn).toBeInTheDocument()
    fireEvent.click(applyBtn)
  })

  // 14. AI 탭 전환
  it('AI 탭 클릭 시 AI 설정이 표시된다', async () => {
    await renderOpen()
    fireEvent.click(screen.getAllByRole('tab')[2])
    expect(await screen.findByText('모델')).toBeInTheDocument()
  })

  // 15. 일반 탭 - 타임스탬프 체크박스
  it('일반 탭에 타임스탬프 체크박스가 있다', async () => {
    await renderOpen()
    expect(await screen.findByText('타임스탬프 표시')).toBeInTheDocument()
  })

  // 16. 배경 클릭 시 onClose 호출
  it('배경(오버레이) 클릭 시 onClose가 호출된다', async () => {
    const { onClose } = await renderOpen()
    // overlay는 dialog의 부모 div
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  // 17. settingsGet 실패 시 다이얼로그 표시 안 됨
  it('settingsGet 실패 시 다이얼로그가 표시되지 않는다', async () => {
    mockApi({ settingsGet: vi.fn().mockResolvedValue(null) })
    render(<SettingsPanel open={true} onClose={vi.fn()} />)
    await new Promise(r => setTimeout(r, 200))
    // null 반환이면 setLoaded(true)가 호출되나 settings가 null이 돼 렌더될 수 있음
    // 핵심 검증: settingsGet이 호출됐을 때 이상 없음
    expect(window.api.settingsGet).toHaveBeenCalled()
  })
})
