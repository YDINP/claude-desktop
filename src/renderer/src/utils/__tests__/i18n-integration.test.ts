/**
 * i18n 통합 테스트
 * setLanguage → t() 반환값 변경 + language-change 이벤트 dispatch 확인
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// i18n.ts는 모듈 초기화 시 localStorage를 읽어 currentLang을 설정한다.
// vi.resetModules() + 재import으로 각 테스트가 독립된 모듈 상태를 갖는다.

describe('i18n 통합', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // ── 1. setLanguage('en') → t() 영어 반환 ─────────────────────────────────

  it("setLanguage('en') 후 t()가 영어를 반환한다", async () => {
    localStorage.setItem('app-language', 'ko')
    vi.resetModules()
    const { t, setLanguage } = await import('../i18n')

    expect(t('settings.tab.general')).toBe('일반')

    setLanguage('en')

    expect(t('settings.tab.general')).toBe('General')
    expect(t('settings.title')).toBe('Settings')
    expect(t('welcome.openFolder')).toBe('Open Folder')
  })

  // ── 2. setLanguage('ko') → t() 한국어 반환 ───────────────────────────────

  it("setLanguage('ko') 후 t()가 한국어를 반환한다", async () => {
    localStorage.setItem('app-language', 'en')
    vi.resetModules()
    const { t, setLanguage } = await import('../i18n')

    expect(t('settings.tab.general')).toBe('General')

    setLanguage('ko')

    expect(t('settings.tab.general')).toBe('일반')
    expect(t('settings.title')).toBe('설정')
    expect(t('welcome.openFolder')).toBe('폴더 열기')
  })

  // ── 3. 언어 변경 이벤트 dispatch ─────────────────────────────────────────

  it("setLanguage('en') → 'language-change' 이벤트가 dispatch된다", async () => {
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

  it("setLanguage('ko') → 'language-change' 이벤트 detail.lang이 'ko'", async () => {
    localStorage.setItem('app-language', 'en')
    vi.resetModules()
    const { setLanguage } = await import('../i18n')

    const handler = vi.fn()
    window.addEventListener('language-change', handler)
    setLanguage('ko')
    window.removeEventListener('language-change', handler)

    expect(handler).toHaveBeenCalledOnce()
    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({ lang: 'ko' })
  })

  it("setLanguage 두 번 연속 호출 → 이벤트가 두 번 발생한다", async () => {
    localStorage.setItem('app-language', 'ko')
    vi.resetModules()
    const { setLanguage } = await import('../i18n')

    const handler = vi.fn()
    window.addEventListener('language-change', handler)
    setLanguage('en')
    setLanguage('ko')
    window.removeEventListener('language-change', handler)

    expect(handler).toHaveBeenCalledTimes(2)
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ lang: 'en' })
    expect((handler.mock.calls[1][0] as CustomEvent).detail).toEqual({ lang: 'ko' })
  })

  // ── 4. localStorage 지속성 ───────────────────────────────────────────────

  it("setLanguage 후 localStorage에 언어가 저장된다", async () => {
    localStorage.setItem('app-language', 'ko')
    vi.resetModules()
    const { setLanguage } = await import('../i18n')

    setLanguage('en')
    expect(localStorage.getItem('app-language')).toBe('en')

    setLanguage('ko')
    expect(localStorage.getItem('app-language')).toBe('ko')
  })

  // ── 5. 앱 재시작(모듈 재로딩) 시 localStorage 값 복원 ─────────────────────

  it("localStorage에 'en' 저장 후 모듈 재로딩 → t()가 영어를 반환한다", async () => {
    localStorage.setItem('app-language', 'en')
    vi.resetModules()
    const { t } = await import('../i18n')

    expect(t('settings.tab.general')).toBe('General')
    expect(t('settings.tab.appearance')).toBe('Appearance')
  })

  it("localStorage에 값 없으면 기본 언어(ko)로 초기화된다", async () => {
    // localStorage.clear() in beforeEach
    vi.resetModules()
    const { t, getCurrentLanguage } = await import('../i18n')

    expect(getCurrentLanguage()).toBe('ko')
    expect(t('settings.title')).toBe('설정')
  })

  // ── 6. getCurrentLanguage 동기화 ────────────────────────────────────────

  it("setLanguage 후 getCurrentLanguage가 새 언어를 반환한다", async () => {
    localStorage.setItem('app-language', 'ko')
    vi.resetModules()
    const { setLanguage, getCurrentLanguage } = await import('../i18n')

    expect(getCurrentLanguage()).toBe('ko')
    setLanguage('en')
    expect(getCurrentLanguage()).toBe('en')
    setLanguage('ko')
    expect(getCurrentLanguage()).toBe('ko')
  })

  // ── 7. 알 수 없는 key → fallback / key 자체 반환 ─────────────────────────

  it("영어 모드에서 알 수 없는 key → fallback 반환", async () => {
    localStorage.setItem('app-language', 'en')
    vi.resetModules()
    const { t } = await import('../i18n')

    expect(t('no.such.key', 'default text')).toBe('default text')
    expect(t('no.such.key')).toBe('no.such.key')
  })

  it("한국어 모드에서 알 수 없는 key → key 자체 반환", async () => {
    localStorage.setItem('app-language', 'ko')
    vi.resetModules()
    const { t } = await import('../i18n')

    expect(t('unknown.key')).toBe('unknown.key')
  })
})
