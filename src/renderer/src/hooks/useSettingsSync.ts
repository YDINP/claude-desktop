import { useState, useEffect, useRef, useCallback } from 'react'
import { applyCustomCSS } from '../utils/css'

// ── Accent color helper ───────────────────────────────────────────────────────

export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveAgent {
  id: string
  description: string
  status: 'running' | 'completed' | 'error'
  startTime: number
  output?: string
}

export interface SettingsSync {
  hqMode: boolean
  setHqMode: React.Dispatch<React.SetStateAction<boolean>>
  handleToggleHQ: (onSwitchToChat?: () => void) => void
  activeAgents: ActiveAgent[]
  setActiveAgents: React.Dispatch<React.SetStateAction<ActiveAgent[]>>
  focusMode: boolean
  setFocusMode: React.Dispatch<React.SetStateAction<boolean>>
  theme: 'dark' | 'light' | 'system'
  setTheme: React.Dispatch<React.SetStateAction<'dark' | 'light' | 'system'>>
  toggleTheme: () => void
  soundEnabled: boolean
  soundEnabledRef: React.MutableRefObject<boolean>
  handleToggleSound: () => Promise<void>
  compactMode: boolean
  handleToggleCompact: () => Promise<void>
  chatFontSize: number
  setChatFontSize: React.Dispatch<React.SetStateAction<number>>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSettingsSync(): SettingsSync {
  // ── HQ mode ──
  const [hqMode, setHqMode] = useState(false)
  const [activeAgents, setActiveAgents] = useState<ActiveAgent[]>([])

  useEffect(() => {
    window.api?.settingsGet().then((s: Record<string, unknown>) => {
      if (s?.hqMode) setHqMode(true)
    }).catch(() => {})
  }, [])

  const handleToggleHQ = useCallback((onSwitchToChat?: () => void) => {
    setHqMode(prev => {
      const next = !prev
      if (next) onSwitchToChat?.()
      window.api?.settingsGet().then(settings => {
        window.api?.settingsSave({ ...settings, hqMode: next })
      }).catch(() => {})
      return next
    })
  }, [])

  // ── Focus mode ──
  const [focusMode, setFocusMode] = useState(false)

  // ── Theme toggle ──
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() =>
    (localStorage.getItem('theme') as 'dark' | 'light' | 'system') ?? 'dark'
  )

  const applyTheme = useCallback((t: 'dark' | 'light' | 'system', isDark?: boolean) => {
    const effective = t === 'system'
      ? (isDark !== undefined ? isDark : window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark' : 'light'
      : t
    document.documentElement.setAttribute('data-theme', effective)
  }, [])

  useEffect(() => {
    localStorage.setItem('theme', theme)
    if (theme !== 'system') {
      applyTheme(theme)
      return
    }
    // system: 초기값 + 변경 구독
    window.api?.getNativeTheme?.().then(({ isDark }) => applyTheme('system', isDark))
    const unsub = window.api?.onNativeThemeChanged?.((isDark) => applyTheme('system', isDark))
    return () => unsub?.()
  }, [theme, applyTheme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : t === 'light' ? 'dark' : 'dark')

  // ── Sound enabled ref + state for palette display ──
  const soundEnabledRef = useRef(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [compactMode, setCompactMode] = useState(false)

  // ── Chat font size (Ctrl+=/- shortcut) ──
  const [chatFontSize, setChatFontSize] = useState(() =>
    Number(localStorage.getItem('chat-font-size') ?? '13')
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--chat-font-size', `${chatFontSize}px`)
    localStorage.setItem('chat-font-size', String(chatFontSize))
  }, [chatFontSize])

  useEffect(() => {
    const unsub = window.api?.onFontSizeShortcut?.((delta, reset) => {
      setChatFontSize(prev => {
        if (reset) return 13
        return Math.min(18, Math.max(11, prev + delta))
      })
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    const onFontSizeChange = (e: Event) => {
      const { size } = (e as CustomEvent).detail as { size: number }
      setChatFontSize(size)
    }
    window.addEventListener('font-size-change', onFontSizeChange)
    return () => window.removeEventListener('font-size-change', onFontSizeChange)
  }, [])

  // ── Apply saved accent color + compact mode on startup ──
  useEffect(() => {
    const savedAccent = localStorage.getItem('accent-color')
    if (savedAccent) {
      document.documentElement.style.setProperty('--accent', savedAccent)
      try { document.documentElement.style.setProperty('--accent-rgb', hexToRgb(savedAccent)) } catch { /* ignore */ }
    }
    window.api?.settingsGet().then(settings => {
      if (settings.accentColor) {
        document.documentElement.style.setProperty('--accent', settings.accentColor)
        try { document.documentElement.style.setProperty('--accent-rgb', hexToRgb(settings.accentColor)) } catch { /* ignore */ }
      }
      const compact = !!settings.compactMode
      if (compact) document.documentElement.setAttribute('data-compact', 'true')
      setCompactMode(compact)
      const sound = settings.soundEnabled !== false
      soundEnabledRef.current = sound
      setSoundEnabled(sound)
      if (settings.customCSS) {
        applyCustomCSS(settings.customCSS)
      }
    })
  }, [])

  // ── Sync accent color from SettingsPanel ──
  useEffect(() => {
    const onAccentChange = (e: Event) => {
      const { color } = (e as CustomEvent).detail as { color: string }
      document.documentElement.style.setProperty('--accent', color)
      try { document.documentElement.style.setProperty('--accent-rgb', hexToRgb(color)) } catch { /* ignore */ }
    }
    window.addEventListener('accent-change', onAccentChange)
    return () => window.removeEventListener('accent-change', onAccentChange)
  }, [])

  // ── Sync soundEnabledRef when settings are saved ──
  useEffect(() => {
    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { soundEnabled?: boolean; compactMode?: boolean; theme?: string }
      const sound = detail.soundEnabled !== false
      soundEnabledRef.current = sound
      setSoundEnabled(sound)
      if (detail.compactMode !== undefined) setCompactMode(!!detail.compactMode)
      if (detail.theme) setTheme(detail.theme as 'dark' | 'light' | 'system')
    }
    window.addEventListener('settings:changed', onSettingsChanged)
    return () => window.removeEventListener('settings:changed', onSettingsChanged)
  }, [])

  // ── Sound toggle (from palette) ──
  const handleToggleSound = async () => {
    const settings = await window.api?.settingsGet()
    if (!settings) return
    const newVal = !soundEnabledRef.current
    await window.api?.settingsSave({ ...settings, soundEnabled: newVal })
    soundEnabledRef.current = newVal
    setSoundEnabled(newVal)
    window.dispatchEvent(new CustomEvent('settings:changed', { detail: { ...settings, soundEnabled: newVal } }))
  }

  // ── Compact mode toggle (from palette) ──
  const handleToggleCompact = async () => {
    const settings = await window.api?.settingsGet()
    if (!settings) return
    const newVal = !compactMode
    await window.api?.settingsSave({ ...settings, compactMode: newVal })
    if (newVal) {
      document.documentElement.setAttribute('data-compact', 'true')
    } else {
      document.documentElement.removeAttribute('data-compact')
    }
    setCompactMode(newVal)
    window.dispatchEvent(new CustomEvent('settings:changed', { detail: { ...settings, compactMode: newVal } }))
  }

  return {
    hqMode,
    setHqMode,
    handleToggleHQ,
    activeAgents,
    setActiveAgents,
    focusMode,
    setFocusMode,
    theme,
    setTheme,
    toggleTheme,
    soundEnabled,
    soundEnabledRef,
    handleToggleSound,
    compactMode,
    handleToggleCompact,
    chatFontSize,
    setChatFontSize,
  }
}
