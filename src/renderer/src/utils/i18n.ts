// 경량 i18n 유틸 — 라이브러리 없이 자체 구현
// 현재는 한국어만 동작, English는 key 그대로 표시 (향후 확장용)

const ko: Record<string, string> = {
  'settings.tab.general':    '일반',
  'settings.tab.appearance': '외관',
  'settings.tab.ai':         'AI',
  'settings.tab.shortcuts':  '단축키',
  'settings.tab.advanced':   '고급',
  'settings.tab.features':   '기능 관리',
  'settings.title':          '설정',
  'settings.lang.label':     '언어',
  'settings.lang.ko':        '한국어',
  'settings.lang.en':        'English',
}

const en: Record<string, string> = {
  'settings.tab.general':    'General',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.ai':         'AI',
  'settings.tab.shortcuts':  'Shortcuts',
  'settings.tab.advanced':   'Advanced',
  'settings.tab.features':   'Features',
  'settings.title':          'Settings',
  'settings.lang.label':     'Language',
  'settings.lang.ko':        '한국어',
  'settings.lang.en':        'English',
}

export type SupportedLang = 'ko' | 'en'

let currentLang: SupportedLang = ((): SupportedLang => {
  const stored = localStorage.getItem('app-language')
  return stored === 'en' ? 'en' : 'ko'
})()

export function t(key: string, fallback?: string): string {
  const dict = currentLang === 'ko' ? ko : en
  return dict[key] ?? fallback ?? key
}

export function setLanguage(lang: SupportedLang): void {
  currentLang = lang
  localStorage.setItem('app-language', lang)
  window.dispatchEvent(new CustomEvent('language-change', { detail: { lang } }))
}

export function getCurrentLanguage(): SupportedLang {
  return currentLang
}
