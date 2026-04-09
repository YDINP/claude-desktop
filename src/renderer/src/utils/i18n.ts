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

  // WelcomeScreen
  'welcome.openFolder':      '폴더 열기',
  'welcome.recentSessions':  '최근 대화',
  'welcome.recentProjects':  '최근 프로젝트',
  'welcome.defaultTitle':    '대화',
  'welcome.settingsInput':   '설정에서 입력',
  'welcome.apiKeyMissing':   'API 키 미설정',
  'welcome.subtitle':        'AI 코딩 어시스턴트',

  // Sidebar — PANEL_TITLES
  'panel.files':       'Files',
  'panel.search':      'Search',
  'panel.sessions':    'History',
  'panel.changes':     'Changes',
  'panel.globalsearch':'Global Search',
  'panel.bookmarks':   'Bookmarks',
  'panel.stats':       'Stats',
  'panel.snippets':    'Snippets',
  'panel.outline':     'Outline',
  'panel.plugins':     'Plugins',
  'panel.connections': 'Connections',
  'panel.agent':       'Agent',
  'panel.calendar':    '캘린더',
  'panel.tasks':       '작업',
  'panel.notes':       '노트',
  'panel.clipboard':   '클립보드',
  'panel.diff':        'Diff',
  'panel.remote':      '리모트',

  // Sidebar — misc
  'sidebar.fileSearch':       '파일 검색...',
  'sidebar.noResults':        '결과 없음',
  'sidebar.noFolder':         'No folder open',
  'sidebar.newChat':          '+ New Chat',
  'sidebar.statsDisabled':    '통계 기능이 비활성화되었습니다.',
  'sidebar.outlineDisabled':  '아웃라인 기능이 비활성화되었습니다.',
  'sidebar.pluginsDisabled':  '플러그인 기능이 비활성화되었습니다.',
  'sidebar.connDisabled':     'MCP 연결 기능이 비활성화되었습니다.',
  'sidebar.tabsLabel':        '사이드바 탭',
  'sidebar.extraTabsLabel':   '사이드바 추가 탭',
  'sidebar.featureTabsLabel': '사이드바 기능 탭',

  // StatusBar
  'status.sessionInfo':    '세션 정보',
  'status.close':          '닫기',
  'status.costDetail':     '비용 상세',
  'status.session':        '세션',
  'status.today':          '오늘',
  'status.monthly':        '이달',
  'status.inputRate':      '입력',
  'status.outputRate':     '출력',
  'status.online':         '온라인',
  'status.offline':        '오프라인',
  'status.createdAt':      '생성',
  'status.messages':       '메시지',
  'status.inputTokens':    '입력',
  'status.outputTokens':   '출력',
  'status.estimatedCost':  '예상 비용',
  'status.totalCost':      '누적 비용',
  'status.todayCost':      '오늘 사용',
  'status.monthlyCost':    '이번달 합계',

  // StatusBar — tooltips
  'status.memUsage': '메모리 사용량',
  'status.cpuUsage': 'CPU 사용률',
  'status.fontSize': '채팅 폰트 크기 (Ctrl+0으로 초기화)',
  'status.shortcuts': '키보드 단축키 (Ctrl+?)',

  // ChatPanel
  'chat.close': '닫기',
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

  // WelcomeScreen
  'welcome.openFolder':      'Open Folder',
  'welcome.recentSessions':  'Recent Chats',
  'welcome.recentProjects':  'Recent Projects',
  'welcome.defaultTitle':    'Chat',
  'welcome.settingsInput':   'Enter in Settings',
  'welcome.apiKeyMissing':   'API Key Missing',
  'welcome.subtitle':        'AI Coding Assistant',

  // Sidebar — PANEL_TITLES
  'panel.files':       'Files',
  'panel.search':      'Search',
  'panel.sessions':    'History',
  'panel.changes':     'Changes',
  'panel.globalsearch':'Global Search',
  'panel.bookmarks':   'Bookmarks',
  'panel.stats':       'Stats',
  'panel.snippets':    'Snippets',
  'panel.outline':     'Outline',
  'panel.plugins':     'Plugins',
  'panel.connections': 'Connections',
  'panel.agent':       'Agent',
  'panel.calendar':    'Calendar',
  'panel.tasks':       'Tasks',
  'panel.notes':       'Notes',
  'panel.clipboard':   'Clipboard',
  'panel.diff':        'Diff',
  'panel.remote':      'Remote',

  // Sidebar — misc
  'sidebar.fileSearch':       'Search files...',
  'sidebar.noResults':        'No results',
  'sidebar.noFolder':         'No folder open',
  'sidebar.newChat':          '+ New Chat',
  'sidebar.statsDisabled':    'Stats feature is disabled.',
  'sidebar.outlineDisabled':  'Outline feature is disabled.',
  'sidebar.pluginsDisabled':  'Plugins feature is disabled.',
  'sidebar.connDisabled':     'MCP connections feature is disabled.',
  'sidebar.tabsLabel':        'Sidebar tabs',
  'sidebar.extraTabsLabel':   'Sidebar extra tabs',
  'sidebar.featureTabsLabel': 'Sidebar feature tabs',

  // StatusBar
  'status.sessionInfo':    'Session Info',
  'status.close':          'Close',
  'status.costDetail':     'Cost Details',
  'status.session':        'Session',
  'status.today':          'Today',
  'status.monthly':        'Month',
  'status.inputRate':      'Input',
  'status.outputRate':     'Output',
  'status.online':         'Online',
  'status.offline':        'Offline',
  'status.createdAt':      'Created',
  'status.messages':       'messages',
  'status.inputTokens':    'Input',
  'status.outputTokens':   'Output',
  'status.estimatedCost':  'Est. Cost',
  'status.totalCost':      'Total Cost',
  'status.todayCost':      'Today',
  'status.monthlyCost':    'This Month',

  // StatusBar — tooltips
  'status.memUsage': 'Memory Usage',
  'status.cpuUsage': 'CPU Usage',
  'status.fontSize': 'Chat font size (Ctrl+0 to reset)',
  'status.shortcuts': 'Keyboard shortcuts (Ctrl+?)',

  // ChatPanel
  'chat.close': 'Close',
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
