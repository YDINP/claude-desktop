import { useEffect, useRef, useState } from 'react'
import { playCompletionSound } from '../../utils/sound'
import { applyCustomCSS } from '../../utils/css'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import type { FeatureFlags } from '../../hooks/useFeatureFlags'
import { FEATURE_GROUP_MAP } from '../../../../shared/feature-types'
import type { FeatureGroup } from '../../../../shared/feature-types'
import { t, setLanguage, getCurrentLanguage } from '../../utils/i18n'
import type { SupportedLang } from '../../utils/i18n'

function trapFocus(container: HTMLElement, e: React.KeyboardEvent) {
  if (e.key !== 'Tab') return
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}

interface SettingsData {
  theme: string
  fontSize: number
  maxTokensPerRequest: number
  temperature: number
  showTimestamps: boolean
  selectedModel: string
  accentColor: string
  compactMode: boolean
  soundEnabled: boolean
  customCSS: string
  anthropicApiKey?: string
}

const ACCENT_PRESETS = [
  { name: '파랑', color: '#527bff' },
  { name: '보라', color: '#9b59b6' },
  { name: '초록', color: '#27ae60' },
  { name: '주황', color: '#e67e22' },
  { name: '빨강', color: '#e74c3c' },
  { name: '분홍', color: '#e91e8c' },
  { name: '하늘', color: '#00bcd4' },
]

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// accent-color 적용 + localStorage 캐시 저장 (미리보기 전용)
// 실제 영속 저장은 handleSave()의 settingsSave()에서 electron-store에 기록됨
function applyAccentColor(color: string) {
  document.documentElement.style.setProperty('--accent', color)
  try {
    document.documentElement.style.setProperty('--accent-rgb', hexToRgb(color))
  } catch {
    // ignore invalid hex
  }
  localStorage.setItem('accent-color', color) // 캐시 (폴백용)
  window.dispatchEvent(new CustomEvent('accent-change', { detail: { color } }))
}

const MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

const SHORTCUTS = [
  { key: 'Ctrl+P', desc: '커맨드 팔레트 열기 (설정/Git/검색/북마크 등)' },
  { key: 'Ctrl+K / Ctrl+N', desc: '새 채팅 시작' },
  { key: 'Ctrl+B', desc: '사이드바 토글' },
  { key: 'Ctrl+T', desc: '터미널 토글' },
  { key: 'Ctrl+Shift+F', desc: '포커스 모드 (사이드바·터미널 숨김)' },
  { key: 'Ctrl+F', desc: '터미널 검색' },
  { key: 'Ctrl+W', desc: '현재 탭 닫기' },
  { key: 'Ctrl+Tab', desc: '다음 탭으로 이동' },
  { key: 'Ctrl+Shift+Tab', desc: '이전 탭으로 이동' },
  { key: 'Ctrl+Alt+←/→', desc: '워크스페이스 탭 전환' },
  { key: 'Ctrl+Shift+W', desc: '현재 워크스페이스 탭 닫기' },
  { key: '/', desc: '슬래시 명령어 목록' },
  { key: 'Enter', desc: '메시지 전송' },
  { key: 'Shift+Enter', desc: '줄바꿈' },
  { key: '↑/↓', desc: '입력 히스토리 탐색' },
  { key: '@파일명', desc: '파일 멘션 자동완성' },
  { key: 'Ctrl+1', desc: 'Claude Opus 4.6으로 전환' },
  { key: 'Ctrl+2', desc: 'Claude Sonnet 4.6으로 전환' },
  { key: 'Ctrl+3', desc: 'Claude Haiku 4.5으로 전환' },
  { key: 'Ctrl+H', desc: 'FileViewer 찾기/바꾸기' },
  { key: 'Ctrl+±', desc: '채팅 폰트 크기 조절' },
  { key: 'Ctrl+0', desc: '채팅 폰트 크기 초기화' },
  { key: 'Ctrl+Enter', desc: '세션 노트 저장 (노트 편집 중)' },
  { key: 'Ctrl+,', desc: '설정 열기' },
  { key: 'Ctrl+?', desc: '단축키 도움말' },
  { key: 'F12', desc: 'DevTools 토글' },
]

type SettingsTab = 'general' | 'appearance' | 'ai' | 'shortcuts' | 'advanced' | 'features'

const TAB_DEFS: { id: SettingsTab; key: string }[] = [
  { id: 'general',    key: 'settings.tab.general' },
  { id: 'appearance', key: 'settings.tab.appearance' },
  { id: 'ai',         key: 'settings.tab.ai' },
  { id: 'shortcuts',  key: 'settings.tab.shortcuts' },
  { id: 'advanced',   key: 'settings.tab.advanced' },
  { id: 'features',   key: 'settings.tab.features' },
]

export function SettingsPanel({ open, onClose, currentProject }: { open: boolean; onClose: () => void; currentProject?: string }) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const { features, setFeature, rawFeatures } = useFeatureFlags()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('settings-collapsed-groups') ?? '{}')
    } catch {
      return {}
    }
  })
  const [chatFontSize, setChatFontSize] = useState<number>(() =>
    Number(localStorage.getItem('chat-font-size') || '14')
  )
  const [settings, setSettings] = useState<SettingsData>({
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
  })
  const [loaded, setLoaded] = useState(false)
  const [customHex, setCustomHex] = useState('')
  const [localSystemPrompt, setLocalSystemPrompt] = useState('')
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState('auto')
  const [notifSettings, setNotifSettings] = useState({ responseComplete: true, backgroundOnly: true, longSession: false, contextWarning: true })
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string; content: string }>>([])
  const [profileName, setProfileName] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [appLanguage, setAppLanguage] = useState<SupportedLang>(getCurrentLanguage)

  const handleLanguageChange = (lang: SupportedLang) => {
    setLanguage(lang)
    setAppLanguage(lang)
  }

  useEffect(() => {
    if (!open) { setLoaded(false); return }
    window.api?.settingsGet().then(data => {
      setSettings(data)
      setAnthropicApiKey(data.anthropicApiKey ?? '')
      setLoaded(true)
    })
    window.api?.getNotificationSettings().then(s => s && setNotifSettings(s))
    if (currentProject) {
      window.api?.getProjectSystemPrompt(currentProject).then(p => setLocalSystemPrompt(p))
    } else {
      setLocalSystemPrompt('')
    }
    window.api?.getSystemPromptProfiles().then(setProfiles)
    setGlobalSystemPrompt(localStorage.getItem('custom-system-prompt') ?? '')
    setPreferredLanguage(localStorage.getItem('preferred-language') ?? 'auto')
    setOpenaiApiKey(localStorage.getItem('cd-settings-openai-key') ?? '')
    setTimeout(() => modalRef.current?.querySelector<HTMLElement>('button, input')?.focus(), 50)
  }, [open, currentProject])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !loaded) return null

  const patch = (key: keyof SettingsData, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    await window.api?.settingsSet(settings)
    if (currentProject) {
      await window.api?.setProjectSystemPrompt(currentProject, localSystemPrompt)
    }
    // Apply theme
    localStorage.setItem('theme', settings.theme)
    if (settings.theme === 'system') {
      window.api?.getNativeTheme?.().then(({ isDark }) => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
      }).catch(() => {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
      })
    } else {
      document.documentElement.setAttribute('data-theme', settings.theme)
    }
    // Apply font size
    document.documentElement.style.setProperty('--font-size-base', settings.fontSize + 'px')
    // Apply accent color
    applyAccentColor(settings.accentColor)
    // Apply compact mode
    if (settings.compactMode) {
      document.documentElement.setAttribute('data-compact', 'true')
    } else {
      document.documentElement.removeAttribute('data-compact')
    }
    // Apply custom CSS
    applyCustomCSS(settings.customCSS)
    // Save global system prompt and language preference
    localStorage.setItem('custom-system-prompt', globalSystemPrompt)
    localStorage.setItem('preferred-language', preferredLanguage)
    // Save OpenAI API key
    if (openaiApiKey) {
      localStorage.setItem('cd-settings-openai-key', openaiApiKey)
      await window.api?.settingsSet({ openaiApiKey })
    } else {
      localStorage.removeItem('cd-settings-openai-key')
      await window.api?.settingsSet({ openaiApiKey: '' })
    }
    // Save Anthropic API key
    await window.api?.settingsSet({ anthropicApiKey })
    // Dispatch event so App can sync model state
    window.dispatchEvent(new CustomEvent('settings:changed', { detail: settings }))
    onClose()
  }

  const saveProfile = async () => {
    if (!profileName.trim() || !localSystemPrompt.trim()) return
    const existing = profiles.find(p => p.name === profileName.trim())
    const profile = { id: existing?.id ?? Date.now().toString(), name: profileName.trim(), content: localSystemPrompt }
    await window.api?.saveSystemPromptProfile(profile)
    setProfiles(prev => [...prev.filter(p => p.name !== profile.name), profile])
    setProfileName('')
  }

  const loadProfile = (profile: { content: string }) => {
    setLocalSystemPrompt(profile.content)
  }

  const deleteProfile = async (id: string) => {
    await window.api?.deleteSystemPromptProfile(id)
    setProfiles(prev => prev.filter(p => p.id !== id))
  }

  const updateNotifSetting = async (key: keyof typeof notifSettings, val: boolean) => {
    const next = { ...notifSettings, [key]: val }
    setNotifSettings(next)
    await window.api?.setNotificationSettings(next)
  }

  const exportSettings = () => {
    const data = {
      ...settings,
      exportedAt: new Date().toISOString(),
      version: 1,
    }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claude-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importSettings = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        if (data.version !== 1) throw new Error('버전 불일치')
        const { exportedAt: _ea, version: _v, ...rest } = data
        setSettings(prev => ({ ...prev, ...rest }))
        alert('설정을 가져왔습니다. 저장 버튼을 눌러 적용하세요.')
      } catch (err: unknown) {
        alert('설정 파일 오류: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    input.click()
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border)',
  }
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    fontSize: 13,
    color: 'var(--text-secondary)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="설정"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (modalRef.current) trapFocus(modalRef.current, e) }}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          width: 520,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.title', '설정')}</div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 18, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
            }}
          >x</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {TAB_DEFS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                borderBottom: settingsTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: settingsTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {t(tab.key)}
            </button>
          ))}
        </div>

        {/* Tab: 일반 */}
        {settingsTab === 'general' && (
          <div>
            {/* Language */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>{t('settings.lang.label', '언어')}</div>
              <div style={rowStyle}>
                <span style={labelStyle}>{t('settings.lang.label', '언어')}</span>
                <select
                  value={appLanguage}
                  onChange={e => handleLanguageChange(e.target.value as SupportedLang)}
                  style={{
                    padding: '4px 8px', fontSize: 12, borderRadius: 4,
                    border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                  }}
                >
                  <option value="ko">{t('settings.lang.ko', '한국어')}</option>
                  <option value="en">{t('settings.lang.en', 'English')}</option>
                </select>
              </div>
            </div>

            {/* Chat */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>채팅</div>
              <div style={rowStyle}>
                <span style={labelStyle}>타임스탬프 표시</span>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.showTimestamps}
                    onChange={e => patch('showTimestamps', e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>토큰 예산</span>
                <input
                  type="number"
                  min={0}
                  max={200000}
                  value={settings.maxTokensPerRequest}
                  onChange={e => patch('maxTokensPerRequest', Number(e.target.value))}
                  placeholder="0 = 무제한"
                  style={{
                    width: 110,
                    padding: '4px 8px',
                    fontSize: 12,
                    borderRadius: 4,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>응답 완료 사운드</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Claude 응답이 끝날 때 알림음 재생</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => playCompletionSound()}
                    style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: 'pointer' }}
                  >
                    테스트
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.soundEnabled}
                      onChange={e => patch('soundEnabled', e.target.checked)}
                      style={{ margin: 0, accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>알림 설정</div>
              {[
                { key: 'responseComplete' as const, label: '응답 완료 시 알림', icon: '🔔' },
                { key: 'backgroundOnly' as const, label: '백그라운드에서만 알림', icon: '📵' },
                { key: 'longSession' as const, label: '긴 세션 경고 (30개+)', icon: '⚠️' },
                { key: 'contextWarning' as const, label: '컨텍스트 한도 80% 경고', icon: '📊' },
              ].map(({ key, label, icon }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{icon} {label}</span>
                  <input
                    type="checkbox"
                    checked={notifSettings[key]}
                    onChange={e => updateNotifSetting(key, e.target.checked)}
                    style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--accent)' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: 외관 */}
        {settingsTab === 'appearance' && (
          <div>
            {/* Appearance */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>외관</div>
              <div style={rowStyle}>
                <span style={labelStyle}>테마</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['dark', 'light', 'system'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => patch('theme', t)}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: settings.theme === t ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: settings.theme === t ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'System'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>글꼴 크기</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min={12}
                    max={18}
                    value={settings.fontSize}
                    onChange={e => patch('fontSize', Number(e.target.value))}
                    style={{ width: 100, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
                    {settings.fontSize}px
                  </span>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={labelStyle}>채팅 글꼴 크기</span>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace' }}>{chatFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={20}
                  step={1}
                  value={chatFontSize}
                  onChange={e => {
                    const val = Number(e.target.value)
                    setChatFontSize(val)
                    document.documentElement.style.setProperty('--chat-font-size', val + 'px')
                    localStorage.setItem('chat-font-size', String(val))
                    window.dispatchEvent(new CustomEvent('font-size-change', { detail: { size: val } }))
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span>작게 (12px)</span>
                  <span>크게 (20px)</span>
                </div>
                {chatFontSize !== 14 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      onClick={() => {
                        setChatFontSize(14)
                        document.documentElement.style.setProperty('--chat-font-size', '14px')
                        localStorage.setItem('chat-font-size', '14')
                        window.dispatchEvent(new CustomEvent('font-size-change', { detail: { size: 14 } }))
                      }}
                      style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      기본값 (14px)
                    </button>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>🎨 강조 색상</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {ACCENT_PRESETS.map(preset => (
                    <div
                      key={preset.color}
                      onClick={() => patch('accentColor', preset.color)}
                      title={preset.name}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: preset.color,
                        cursor: 'pointer',
                        border: settings.accentColor === preset.color ? '2px solid white' : '2px solid transparent',
                        boxShadow: settings.accentColor === preset.color ? `0 0 0 3px ${preset.color}` : 'none',
                        transition: 'transform 0.1s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>#</span>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="ffffff"
                    value={customHex}
                    onChange={e => setCustomHex(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
                    style={{
                      width: 80,
                      padding: '3px 6px',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono, monospace)',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      letterSpacing: '0.5px',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customHex.length === 6) {
                        patch('accentColor', `#${customHex}`)
                      }
                    }}
                    style={{
                      padding: '3px 10px',
                      fontSize: 12,
                      borderRadius: 4,
                      border: 'none',
                      background: 'var(--accent)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    적용
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>컴팩트 모드</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>메시지 간격을 줄여 더 많은 대화를 표시</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.compactMode}
                    onChange={e => patch('compactMode', e.target.checked)}
                    style={{ margin: 0, accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                  />
                </label>
              </div>
            </div>

            {/* Custom CSS */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>커스텀 CSS</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                CSS 변수 오버라이드 또는 추가 스타일 입력 (저장 시 즉시 적용)
              </div>
              <textarea
                value={settings.customCSS}
                onChange={e => {
                  patch('customCSS', e.target.value)
                  applyCustomCSS(e.target.value)
                }}
                placeholder={`/* 예시 */\n:root {\n  --accent: #ff6b35;\n  --radius-sm: 8px;\n}`}
                rows={8}
                style={{
                  width: '100%',
                  background: 'var(--bg-input, var(--bg-tertiary))',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '8px',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono, monospace)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => { patch('customCSS', ''); applyCustomCSS('') }}
                  style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: AI */}
        {settingsTab === 'ai' && (
          <div>
            {/* Model */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>모델</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Temperature</div>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace' }}>{settings.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.temperature}
                  onChange={e => patch('temperature', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span>정밀 (0.0)</span>
                  <span>창의적 (1.0)</span>
                </div>
              </div>
              {MODELS.map(m => (
                <label
                  key={m.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 0', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
                  }}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.value}
                    checked={settings.selectedModel === m.value}
                    onChange={() => patch('selectedModel', m.value)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  {m.label}
                </label>
              ))}
            </div>

            {/* Global System Prompt */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>글로벌 시스템 프롬프트</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                모든 채팅에 공통으로 적용되는 시스템 프롬프트입니다. 채팅창 상단 ⚙ 버튼으로도 편집 가능합니다.
              </div>
              <textarea
                value={globalSystemPrompt}
                onChange={e => setGlobalSystemPrompt(e.target.value.slice(0, 2000))}
                placeholder="Claude에게 항상 전달할 전역 지침을 입력하세요..."
                rows={5}
                style={{
                  width: '100%', background: 'var(--bg-input, var(--bg-tertiary))', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', borderRadius: 4, padding: '6px 10px',
                  fontSize: 12, resize: 'vertical', fontFamily: 'var(--font-ui, inherit)',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: globalSystemPrompt.length >= 2000 ? 'var(--color-error, #e74c3c)' : 'var(--text-muted)' }}>
                  {globalSystemPrompt.length} / 2000
                </span>
                <button
                  onClick={() => setGlobalSystemPrompt('')}
                  style={{
                    fontSize: 10, padding: '3px 8px',
                    border: '1px solid var(--border)', borderRadius: 3,
                    background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                >
                  초기화
                </button>
              </div>
            </div>

            {/* AI Behavior */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>AI 동작 설정</div>
              <div style={rowStyle}>
                <span style={labelStyle}>응답 언어</span>
                <select
                  value={preferredLanguage}
                  onChange={e => setPreferredLanguage(e.target.value)}
                  style={{
                    padding: '4px 8px', fontSize: 12, borderRadius: 4,
                    border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                  }}
                >
                  {[
                    { value: 'auto', label: '자동' },
                    { value: 'ko',   label: '한국어' },
                    { value: 'en',   label: 'English' },
                    { value: 'ja',   label: '日本語' },
                    { value: 'zh',   label: '中文' },
                  ].map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Anthropic API Key */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>API 설정</div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Anthropic API Key</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {anthropicApiKey
                    ? '✓ API 키가 설정되어 있습니다.'
                    : '미설정 — 환경변수 ANTHROPIC_API_KEY 사용 중 (또는 미설정)'}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type={showAnthropicKey ? 'text' : 'password'}
                    value={anthropicApiKey}
                    onChange={e => setAnthropicApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    style={{
                      flex: 1, padding: '6px 10px', background: 'var(--bg-input, var(--bg-tertiary))',
                      border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)',
                      fontSize: 12, fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={() => setShowAnthropicKey(v => !v)}
                    style={{
                      padding: '6px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                      borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, flexShrink: 0,
                    }}
                  >
                    {showAnthropicKey ? '숨기기' : '표시'}
                  </button>
                  {anthropicApiKey && (
                    <button
                      onClick={() => setAnthropicApiKey('')}
                      style={{
                        padding: '6px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                        borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, flexShrink: 0,
                      }}
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* OpenAI API Key */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>OpenAI API Key</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                OpenAI 모델(gpt-4o, o3-mini 등) 사용 시 필요합니다.
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiApiKey}
                  onChange={e => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  style={{
                    flex: 1, padding: '6px 10px', background: 'var(--bg-input, var(--bg-tertiary))',
                    border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)',
                    fontSize: 12, fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => setShowOpenaiKey(v => !v)}
                  style={{
                    padding: '6px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, flexShrink: 0,
                  }}
                >
                  {showOpenaiKey ? '숨기기' : '표시'}
                </button>
              </div>
            </div>

            {/* Project System Prompt */}
            {currentProject && (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  시스템 프롬프트 ({currentProject.split(/[/\\]/).pop()})
                </div>
                {profiles.length > 0 && (
                  <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {profiles.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '2px 6px', border: '1px solid var(--border)' }}>
                        <button onClick={() => loadProfile(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, padding: 0 }}>
                          {p.name}
                        </button>
                        <button onClick={() => deleteProfile(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '0 2px' }}>x</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input
                    placeholder="프로필 이름"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    style={{ flex: 1, padding: '4px 6px', background: 'var(--bg-input, var(--bg-tertiary))', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', fontSize: 12 }}
                  />
                  <button
                    onClick={saveProfile}
                    style={{ padding: '4px 8px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}
                  >
                    저장
                  </button>
                </div>
                <textarea
                  value={localSystemPrompt}
                  onChange={e => setLocalSystemPrompt(e.target.value)}
                  placeholder="이 프로젝트에서 Claude에게 항상 전달할 지침을 입력하세요..."
                  rows={4}
                  style={{
                    width: '100%', background: 'var(--bg-input, var(--bg-tertiary))', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 4, padding: '6px 10px',
                    fontSize: 12, resize: 'vertical', fontFamily: 'var(--font-ui, inherit)',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Claude가 이 프로젝트에서 답변할 때 항상 이 내용이 컨텍스트로 추가됩니다.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: 단축키 */}
        {settingsTab === 'shortcuts' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              읽기 전용 — 단축키는 앱 코드에서 설정됩니다.
            </div>
            {SHORTCUTS.map(s => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {s.key}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', marginLeft: 12 }}>{s.desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab: 고급 */}
        {settingsTab === 'advanced' && (
          <div>
            {/* Settings Management */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>설정 관리</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={exportSettings}
                  style={{ flex: 1, padding: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'inherit', fontSize: 12 }}
                >
                  📤 내보내기
                </button>
                <button
                  onClick={importSettings}
                  style={{ flex: 1, padding: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'inherit', fontSize: 12 }}
                >
                  📥 가져오기
                </button>
              </div>
            </div>

            {/* About */}
            <div style={{ marginBottom: 20 }}>
              <div style={sectionTitleStyle}>정보</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <div>Claude Desktop <span style={{ color: 'var(--text-secondary)' }}>v0.6.0</span></div>
                <div>Anthropic Claude API 기반 데스크톱 클라이언트</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: 기능 관리 */}
        {settingsTab === 'features' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              그룹을 OFF하면 하위 기능이 모두 비활성화됩니다. 변경 사항은 즉시 반영됩니다.
            </div>
            {([
              {
                group: 'layout' as FeatureGroup,
                groupLabel: '레이아웃',
                items: [
                  { key: 'hqMode' as keyof FeatureFlags, label: 'HQ 모드', desc: 'AgentBay, ResourceBar, OpsFeed 전체 영역' },
                  { key: 'terminal' as keyof FeatureFlags, label: '터미널 패널', desc: '하단 터미널 패널' },
                  { key: 'webPreview' as keyof FeatureFlags, label: '웹 프리뷰 탭', desc: '빌드 결과 웹 미리보기 탭' },
                  { key: 'splitView' as keyof FeatureFlags, label: '파일 분할 뷰', desc: '파일 뷰어 좌우 분할 기능' },
                ],
              },
              {
                group: 'chat' as FeatureGroup,
                groupLabel: '채팅',
                items: [
                  { key: 'sessionFork' as keyof FeatureFlags, label: '세션 포크', desc: '메시지 분기 복사 버튼' },
                  { key: 'sessionExport' as keyof FeatureFlags, label: '내보내기', desc: 'MD / HTML / PDF 내보내기 버튼' },
                  { key: 'contextCompress' as keyof FeatureFlags, label: '컨텍스트 압축', desc: '긴 대화 압축 버튼' },
                  { key: 'autoResume' as keyof FeatureFlags, label: '자동 세션 재개', desc: '앱 시작 시 마지막 세션 자동 재개' },
                  { key: 'voiceInput' as keyof FeatureFlags, label: '음성 입력', desc: '마이크로 음성 인식 입력' },
                ],
              },
              {
                group: 'sidebar' as FeatureGroup,
                groupLabel: '사이드바 패널',
                items: [
                  { key: 'plugins' as keyof FeatureFlags, label: '플러그인', desc: '플러그인 패널 -- 설치된 플러그인 확인 및 관리' },
                  { key: 'connections' as keyof FeatureFlags, label: 'MCP 연결', desc: 'MCP 서버 연결 목록 및 ping 확인' },
                  { key: 'outline' as keyof FeatureFlags, label: '아웃라인', desc: '대화 메시지를 목차 형식으로 탐색' },
                  { key: 'stats' as keyof FeatureFlags, label: '통계', desc: '세션별 토큰 사용량 및 활동 통계' },
                  { key: 'sceneview' as keyof FeatureFlags, label: '씬 뷰어', desc: 'Cocos Creator 씬 구조 시각화 패널' },
                  { key: 'git' as keyof FeatureFlags, label: 'Git', desc: 'Git 변경 사항 추적 및 커밋 관리' },
                ],
              },
              {
                group: 'cc' as FeatureGroup,
                groupLabel: 'CCEditor',
                items: [
                  { key: 'cc.assetBrowser' as keyof FeatureFlags, label: '에셋 브라우저', desc: '에셋 탐색 및 관리 패널' },
                  { key: 'cc.buildTab' as keyof FeatureFlags, label: '빌드 탭', desc: '프로젝트 빌드 메뉴' },
                  { key: 'cc.groupPanel' as keyof FeatureFlags, label: '그룹 패널', desc: '노드 그룹 관리 탭' },
                  { key: 'cc.backupManager' as keyof FeatureFlags, label: '백업 관리', desc: '씬 백업 및 복원 관리' },
                  { key: 'cc.batchInspector' as keyof FeatureFlags, label: '일괄 편집', desc: '다중 선택 노드 배치 편집' },
                  { key: 'cc.sceneValidation' as keyof FeatureFlags, label: '씬 통계/검사', desc: '씬 검사 및 통계 분석' },
                ],
              },
            ]).map(({ group, groupLabel, items }) => {
              const groupKey = `group.${group}` as keyof FeatureFlags
              const groupOn = rawFeatures[groupKey]
              const collapsed = collapsedGroups[group] ?? false
              return (
                <div key={group} style={sectionStyle}>
                  {/* 그룹 헤더: 라벨 클릭 접기/펼치기, 토글은 그룹 ON/OFF */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 12 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        const next = { ...collapsedGroups, [group]: !collapsed }
                        setCollapsedGroups(next)
                        localStorage.setItem('settings-collapsed-groups', JSON.stringify(next))
                      }}
                    >
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
                      <span style={{ ...sectionTitleStyle, marginBottom: 0 }}>{groupLabel}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({items.length})</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0, gap: 6 }}>
                      <span style={{ fontSize: 10, color: groupOn ? 'var(--accent)' : 'var(--text-muted)' }}>{groupOn ? 'ON' : 'OFF'}</span>
                      <input
                        type="checkbox"
                        checked={groupOn}
                        onChange={e => setFeature(groupKey, e.target.checked)}
                        style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </label>
                  </div>
                  {/* 자식 항목 (접힌 상태면 숨김) */}
                  {!collapsed && items.map(({ key, label, desc }) => (
                    <div
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 0 8px 20px', borderBottom: '1px solid var(--border)',
                        opacity: groupOn ? 1 : 0.5,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: groupOn ? 'pointer' : 'not-allowed', flexShrink: 0, marginLeft: 12 }}>
                        <input
                          type="checkbox"
                          checked={rawFeatures[key]}
                          disabled={!groupOn}
                          onChange={e => setFeature(key, e.target.checked)}
                          style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: groupOn ? 'pointer' : 'not-allowed' }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', fontSize: 12, borderRadius: 4,
              border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 20px', fontSize: 12, borderRadius: 4,
              border: 'none', background: 'var(--accent)',
              color: '#fff', cursor: 'pointer', fontWeight: 500,
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
