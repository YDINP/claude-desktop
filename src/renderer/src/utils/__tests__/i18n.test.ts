import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── environment setup ─────────────────────────────────────────────────────────
// i18n.ts reads localStorage at module init and calls window.dispatchEvent.
// jsdom provides both; we just need to reset state between tests.

describe('i18n', () => {
  beforeEach(() => {
    // Reset localStorage before each test so module re-import picks clean state
    localStorage.clear()
    // Clear any language-change event listeners
    vi.restoreAllMocks()
  })

  // Re-import the module fresh for each test group by using dynamic imports
  // with vi.resetModules() so the module-level currentLang is re-evaluated.

  describe('t()', () => {
    it('returns Korean translation when lang is ko', async () => {
      localStorage.setItem('app-language', 'ko')
      vi.resetModules()
      const { t } = await import('../i18n')
      expect(t('settings.tab.general')).toBe('일반')
      expect(t('settings.title')).toBe('설정')
    })

    it('returns English translation when lang is en', async () => {
      localStorage.setItem('app-language', 'en')
      vi.resetModules()
      const { t } = await import('../i18n')
      expect(t('settings.tab.general')).toBe('General')
      expect(t('settings.title')).toBe('Settings')
    })

    it('returns provided fallback when key is missing', async () => {
      localStorage.setItem('app-language', 'ko')
      vi.resetModules()
      const { t } = await import('../i18n')
      expect(t('nonexistent.key', 'fallback text')).toBe('fallback text')
    })

    it('returns key itself when key is missing and no fallback provided', async () => {
      localStorage.setItem('app-language', 'ko')
      vi.resetModules()
      const { t } = await import('../i18n')
      expect(t('some.unknown.key')).toBe('some.unknown.key')
    })
  })

  describe('setLanguage()', () => {
    it('switches translation output after setLanguage call', async () => {
      localStorage.setItem('app-language', 'ko')
      vi.resetModules()
      const { t, setLanguage } = await import('../i18n')

      expect(t('settings.tab.general')).toBe('일반')
      setLanguage('en')
      expect(t('settings.tab.general')).toBe('General')
    })

    it('persists language to localStorage', async () => {
      localStorage.setItem('app-language', 'ko')
      vi.resetModules()
      const { setLanguage } = await import('../i18n')

      setLanguage('en')
      expect(localStorage.getItem('app-language')).toBe('en')
    })

    it('dispatches language-change CustomEvent on window', async () => {
      localStorage.setItem('app-language', 'ko')
      vi.resetModules()
      const { setLanguage } = await import('../i18n')

      const handler = vi.fn()
      window.addEventListener('language-change', handler)
      setLanguage('en')
      window.removeEventListener('language-change', handler)

      expect(handler).toHaveBeenCalledOnce()
      const event = handler.mock.calls[0][0] as CustomEvent
      expect(event.detail).toEqual({ lang: 'en' })
    })
  })

  describe('getCurrentLanguage()', () => {
    it('returns ko by default when nothing is stored', async () => {
      // localStorage is cleared in beforeEach
      vi.resetModules()
      const { getCurrentLanguage } = await import('../i18n')
      expect(getCurrentLanguage()).toBe('ko')
    })

    it('returns en when app-language is set to en', async () => {
      localStorage.setItem('app-language', 'en')
      vi.resetModules()
      const { getCurrentLanguage } = await import('../i18n')
      expect(getCurrentLanguage()).toBe('en')
    })

    it('reflects language after setLanguage call', async () => {
      localStorage.setItem('app-language', 'ko')
      vi.resetModules()
      const { setLanguage, getCurrentLanguage } = await import('../i18n')

      setLanguage('en')
      expect(getCurrentLanguage()).toBe('en')

      setLanguage('ko')
      expect(getCurrentLanguage()).toBe('ko')
    })
  })
})
