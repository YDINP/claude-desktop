import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettingsSync, hexToRgb } from '../useSettingsSync'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../utils/css', () => ({ applyCustomCSS: vi.fn() }))

const mockApi = {
  settingsGet: vi.fn().mockResolvedValue({}),
  settingsSave: vi.fn().mockResolvedValue(undefined),
  getNativeTheme: vi.fn().mockResolvedValue({ isDark: false }),
  onNativeThemeChanged: vi.fn().mockReturnValue(() => {}),
  onFontSizeShortcut: vi.fn().mockReturnValue(() => {}),
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true })
  // clean up localStorage
  localStorage.clear()
  // clean up documentElement attrs / styles
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-compact')
  document.documentElement.style.removeProperty('--accent')
  document.documentElement.style.removeProperty('--accent-rgb')
  document.documentElement.style.removeProperty('--chat-font-size')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── hexToRgb (pure util exported from hook) ───────────────────────────────────

describe('hexToRgb', () => {
  it('converts #ffffff to 255,255,255', () => {
    expect(hexToRgb('#ffffff')).toBe('255,255,255')
  })

  it('converts #000000 to 0,0,0', () => {
    expect(hexToRgb('#000000')).toBe('0,0,0')
  })

  it('converts #1a2b3c correctly', () => {
    expect(hexToRgb('#1a2b3c')).toBe('26,43,60')
  })
})

// ── toggleTheme ───────────────────────────────────────────────────────────────

describe('toggleTheme', () => {
  it('dark → light', async () => {
    localStorage.setItem('theme', 'dark')
    const { result } = renderHook(() => useSettingsSync())

    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('light')
  })

  it('light → dark', async () => {
    localStorage.setItem('theme', 'light')
    const { result } = renderHook(() => useSettingsSync())

    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('system → dark', async () => {
    localStorage.setItem('theme', 'system')
    const { result } = renderHook(() => useSettingsSync())

    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('saves to localStorage on change', () => {
    const { result } = renderHook(() => useSettingsSync())
    act(() => result.current.toggleTheme())
    expect(localStorage.getItem('theme')).toBeTruthy()
  })

  it('calls settingsSave when theme changes', async () => {
    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { result.current.toggleTheme() })
    expect(mockApi.settingsSave).toHaveBeenCalled()
  })
})

// ── setTheme ──────────────────────────────────────────────────────────────────

describe('setTheme', () => {
  it('sets data-theme attribute on documentElement for dark', async () => {
    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { result.current.setTheme('dark') })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('sets data-theme=light for light theme', async () => {
    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { result.current.setTheme('light') })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('calls getNativeTheme for system theme', async () => {
    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { result.current.setTheme('system') })
    expect(mockApi.getNativeTheme).toHaveBeenCalled()
  })
})

// ── electron-store priority (startup settingsGet) ─────────────────────────────

describe('electron-store priority on startup', () => {
  it('overrides localStorage theme with electron-store value', async () => {
    localStorage.setItem('theme', 'dark')
    // Use mockResolvedValue (not Once) — multiple effects call settingsGet on mount
    mockApi.settingsGet.mockResolvedValue({ theme: 'light' })

    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    expect(result.current.theme).toBe('light')
  })

  it('sets soundEnabled=false when electron-store has soundEnabled:false', async () => {
    mockApi.settingsGet.mockResolvedValue({ soundEnabled: false })

    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    expect(result.current.soundEnabled).toBe(false)
    expect(result.current.soundEnabledRef.current).toBe(false)
  })

  it('sets compactMode=true and data-compact attr when electron-store has compactMode:true', async () => {
    mockApi.settingsGet.mockResolvedValue({ compactMode: true })

    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    expect(result.current.compactMode).toBe(true)
    expect(document.documentElement.getAttribute('data-compact')).toBe('true')
  })

  it('applies accentColor CSS variable from electron-store', async () => {
    mockApi.settingsGet.mockResolvedValue({ accentColor: '#ff0000' })

    renderHook(() => useSettingsSync())
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ff0000')
  })
})

// ── chatFontSize ──────────────────────────────────────────────────────────────

describe('chatFontSize', () => {
  it('defaults to 14', () => {
    const { result } = renderHook(() => useSettingsSync())
    expect(result.current.chatFontSize).toBe(14)
  })

  it('reads from localStorage', () => {
    localStorage.setItem('chat-font-size', '16')
    const { result } = renderHook(() => useSettingsSync())
    expect(result.current.chatFontSize).toBe(16)
  })

  it('sets --chat-font-size CSS variable', async () => {
    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { result.current.setChatFontSize(16) })
    expect(document.documentElement.style.getPropertyValue('--chat-font-size')).toBe('16px')
  })

  it('persists to localStorage on change', async () => {
    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { result.current.setChatFontSize(18) })
    expect(localStorage.getItem('chat-font-size')).toBe('18')
  })

  it('responds to font-size-change CustomEvent', async () => {
    const { result } = renderHook(() => useSettingsSync())

    await act(async () => {
      window.dispatchEvent(new CustomEvent('font-size-change', { detail: { size: 15 } }))
    })

    expect(result.current.chatFontSize).toBe(15)
  })
})

// ── handleToggleSound ─────────────────────────────────────────────────────────

describe('handleToggleSound', () => {
  it('toggles soundEnabled from true to false', async () => {
    mockApi.settingsGet.mockResolvedValue({ soundEnabled: true })
    const { result } = renderHook(() => useSettingsSync())
    // Start with soundEnabled=true (default)
    await act(async () => { await result.current.handleToggleSound() })

    expect(result.current.soundEnabled).toBe(false)
    expect(result.current.soundEnabledRef.current).toBe(false)
  })

  it('dispatches settings:changed event', async () => {
    mockApi.settingsGet.mockResolvedValue({ soundEnabled: true })
    const { result } = renderHook(() => useSettingsSync())
    const handler = vi.fn()
    window.addEventListener('settings:changed', handler)

    await act(async () => { await result.current.handleToggleSound() })
    window.removeEventListener('settings:changed', handler)

    expect(handler).toHaveBeenCalledOnce()
  })
})

// ── handleToggleCompact ───────────────────────────────────────────────────────

describe('handleToggleCompact', () => {
  it('toggles compactMode and data-compact attribute', async () => {
    mockApi.settingsGet.mockResolvedValue({ compactMode: false })
    const { result } = renderHook(() => useSettingsSync())

    await act(async () => { await result.current.handleToggleCompact() })

    expect(result.current.compactMode).toBe(true)
    expect(document.documentElement.getAttribute('data-compact')).toBe('true')
  })

  it('removes data-compact attribute when toggling off', async () => {
    // Set up compactMode=true via settings:changed event
    mockApi.settingsGet.mockResolvedValue({ compactMode: true })
    const { result } = renderHook(() => useSettingsSync())
    await act(async () => { await Promise.resolve() }) // flush startup settingsGet

    // Now toggle off
    mockApi.settingsGet.mockResolvedValue({ compactMode: true })
    await act(async () => { await result.current.handleToggleCompact() })

    expect(result.current.compactMode).toBe(false)
    expect(document.documentElement.getAttribute('data-compact')).toBeNull()
  })
})

// ── settings:changed event listener ──────────────────────────────────────────

describe('settings:changed event', () => {
  it('updates soundEnabled from external event', async () => {
    // Ensure startup settingsGet returns soundEnabled:false so it doesn't race-override the event
    mockApi.settingsGet.mockResolvedValue({ soundEnabled: false })

    const { result } = renderHook(() => useSettingsSync())
    // Wait for startup effects to settle
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    // At this point soundEnabled should be false from startup; event dispatch also sets false
    await act(async () => {
      window.dispatchEvent(new CustomEvent('settings:changed', { detail: { soundEnabled: false } }))
      await new Promise(r => setTimeout(r, 0))
    })

    expect(result.current.soundEnabled).toBe(false)
    expect(result.current.soundEnabledRef.current).toBe(false)
  })

  it('updates theme from external event', async () => {
    const { result } = renderHook(() => useSettingsSync())

    await act(async () => {
      window.dispatchEvent(new CustomEvent('settings:changed', { detail: { theme: 'light' } }))
    })

    expect(result.current.theme).toBe('light')
  })
})
