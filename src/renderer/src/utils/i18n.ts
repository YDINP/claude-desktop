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

  // Common actions
  'common.add':     '추가',
  'common.delete':  '삭제',
  'common.save':    '저장',
  'common.cancel':  '취소',
  'common.search':  '검색',
  'common.export':  '내보내기',
  'common.import':  '가져오기',
  'common.copy':    '복사',
  'common.close':   '닫기',
  'common.confirm': '확인',
  'common.reset':   '초기화',
  'common.noResults': '검색 결과 없음',

  // CalendarPanel
  'calendar.prevMonth':    '이전 달',
  'calendar.nextMonth':    '다음 달',
  'calendar.goToday':      '오늘로 이동',
  'calendar.deleteAll':    '전체 삭제',
  'calendar.newEvent':     '새 이벤트...',
  'calendar.upcoming':     '다음 이벤트',
  'calendar.noUpcoming':   '예정된 이벤트 없음',
  'calendar.collapse':     '접기',
  'calendar.showMore':     '더 보기',

  // TasksPanel
  'tasks.empty':        '태스크가 없습니다.',
  'tasks.searchPlaceholder': '태스크 검색...',
  'tasks.newPlaceholder':    '새 태스크...',
  'tasks.quickDueDate': '빠른 마감일:',
  'tasks.today':        '오늘',
  'tasks.tomorrow':     '내일',
  'tasks.in7days':      '7일',

  // NotesPanel
  'notes.empty':        '노트가 없습니다. + 버튼으로 추가하세요.',
  'notes.searchPlaceholder': '노트 검색...',
  'notes.backToList':   '< 목록',

  // ClipboardPanel
  'clipboard.empty':           '클립보드 기록 없음',
  'clipboard.searchPlaceholder': '클립보드 검색...',

  // DiffPanel
  'diff.title':          'Diff 비교',
  'diff.noHistory':      '비교 히스토리가 없습니다',
  'diff.placeholder':    '파일 경로를 입력하고 비교 버튼을 클릭하세요',
  'diff.comparing':      '비교 중...',
  'diff.compare':        '비교',
  'diff.originalPath':   '원본 파일 경로',
  'diff.modifiedPath':   '수정 파일 경로',

  // RemotePanel
  'remote.title':        '원격 호스트',
  'remote.loading':      'SSH 설정 로딩 중...',
  'remote.empty':        '등록된 호스트가 없습니다',

  // MessageBubble actions
  'msg.copy':           '복사',
  'msg.copyCode':       '코드 블록 복사',
  'msg.delete':         '삭제',
  'msg.regenerate':     '재생성',
  'msg.edit':           '편집',
  'msg.unpin':          '핀 해제',
  'msg.pin':            '핀 고정',
  'msg.unbookmark':     '북마크 해제',
  'msg.bookmark':       '북마크',
  'msg.fork':           '분기',
  'msg.retry':          '재시도',
  'msg.copyAll':        '메시지 전체 복사',
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

  // Common actions
  'common.add':     'Add',
  'common.delete':  'Delete',
  'common.save':    'Save',
  'common.cancel':  'Cancel',
  'common.search':  'Search',
  'common.export':  'Export',
  'common.import':  'Import',
  'common.copy':    'Copy',
  'common.close':   'Close',
  'common.confirm': 'Confirm',
  'common.reset':   'Reset',
  'common.noResults': 'No results',

  // CalendarPanel
  'calendar.prevMonth':    'Previous month',
  'calendar.nextMonth':    'Next month',
  'calendar.goToday':      'Go to today',
  'calendar.deleteAll':    'Delete all',
  'calendar.newEvent':     'New event...',
  'calendar.upcoming':     'Upcoming',
  'calendar.noUpcoming':   'No upcoming events',
  'calendar.collapse':     'Collapse',
  'calendar.showMore':     'Show more',

  // TasksPanel
  'tasks.empty':        'No tasks.',
  'tasks.searchPlaceholder': 'Search tasks...',
  'tasks.newPlaceholder':    'New task...',
  'tasks.quickDueDate': 'Quick due:',
  'tasks.today':        'Today',
  'tasks.tomorrow':     'Tomorrow',
  'tasks.in7days':      '7 days',

  // NotesPanel
  'notes.empty':        'No notes. Press + to add.',
  'notes.searchPlaceholder': 'Search notes...',
  'notes.backToList':   '< List',

  // ClipboardPanel
  'clipboard.empty':           'No clipboard history',
  'clipboard.searchPlaceholder': 'Search clipboard...',

  // DiffPanel
  'diff.title':          'Diff',
  'diff.noHistory':      'No diff history',
  'diff.placeholder':    'Enter file paths and click Compare',
  'diff.comparing':      'Comparing...',
  'diff.compare':        'Compare',
  'diff.originalPath':   'Original file path',
  'diff.modifiedPath':   'Modified file path',

  // RemotePanel
  'remote.title':        'Remote Hosts',
  'remote.loading':      'Loading SSH config...',
  'remote.empty':        'No hosts registered',

  // MessageBubble actions
  'msg.copy':           'Copy',
  'msg.copyCode':       'Copy code block',
  'msg.delete':         'Delete',
  'msg.regenerate':     'Regenerate',
  'msg.edit':           'Edit',
  'msg.unpin':          'Unpin',
  'msg.pin':            'Pin',
  'msg.unbookmark':     'Unbookmark',
  'msg.bookmark':       'Bookmark',
  'msg.fork':           'Fork',
  'msg.retry':          'Retry',
  'msg.copyAll':        'Copy message',
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
