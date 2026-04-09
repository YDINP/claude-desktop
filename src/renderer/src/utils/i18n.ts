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

  // SettingsPanel — 일반 탭
  'settings.section.chat':              '채팅',
  'settings.chat.timestamps':           '타임스탬프 표시',
  'settings.chat.tokenBudget':          '토큰 예산',
  'settings.chat.tokenBudgetHint':      '0 = 무제한',
  'settings.chat.soundLabel':           '응답 완료 사운드',
  'settings.chat.soundDesc':            'Claude 응답이 끝날 때 알림음 재생',
  'settings.chat.soundTest':            '테스트',
  'settings.section.notifications':     '알림 설정',
  'settings.notif.responseComplete':    '응답 완료 시 알림',
  'settings.notif.backgroundOnly':      '백그라운드에서만 알림',
  'settings.notif.longSession':         '긴 세션 경고 (30개+)',
  'settings.notif.contextWarning':      '컨텍스트 한도 80% 경고',

  // SettingsPanel — 외관 탭
  'settings.section.appearance':        '외관',
  'settings.appearance.theme':          '테마',
  'settings.appearance.fontSize':       '글꼴 크기',
  'settings.appearance.chatFontSize':   '채팅 글꼴 크기',
  'settings.appearance.fontSmall':      '작게 (12px)',
  'settings.appearance.fontLarge':      '크게 (20px)',
  'settings.appearance.fontDefault':    '기본값 (14px)',
  'settings.appearance.accentColor':    '강조 색상',
  'settings.appearance.apply':          '적용',
  'settings.appearance.compactMode':    '컴팩트 모드',
  'settings.appearance.compactDesc':    '메시지 간격을 줄여 더 많은 대화를 표시',
  'settings.section.customCSS':         '커스텀 CSS',
  'settings.customCSS.desc':            'CSS 변수 오버라이드 또는 추가 스타일 입력 (저장 시 즉시 적용)',
  'settings.customCSS.reset':           '초기화',

  // SettingsPanel — AI 탭
  'settings.section.model':             '모델',
  'settings.model.tempPrecise':         '정밀 (0.0)',
  'settings.model.tempCreative':        '창의적 (1.0)',
  'settings.section.globalPrompt':      '글로벌 시스템 프롬프트',
  'settings.globalPrompt.desc':         '모든 채팅에 공통으로 적용되는 시스템 프롬프트입니다. 채팅창 상단 ⚙ 버튼으로도 편집 가능합니다.',
  'settings.globalPrompt.placeholder':  'Claude에게 항상 전달할 전역 지침을 입력하세요...',
  'settings.globalPrompt.reset':        '초기화',
  'settings.section.aiBehavior':        'AI 동작 설정',
  'settings.ai.responseLang':           '응답 언어',
  'settings.ai.langAuto':               '자동',
  'settings.section.apiSettings':       'API 설정',
  'settings.api.anthropicKeySet':       '✓ API 키가 설정되어 있습니다.',
  'settings.api.anthropicKeyMissing':   '미설정 — 환경변수 ANTHROPIC_API_KEY 사용 중 (또는 미설정)',
  'settings.api.showKey':               '표시',
  'settings.api.hideKey':               '숨기기',
  'settings.api.resetKey':              '초기화',
  'settings.section.openaiKey':         'OpenAI API Key',
  'settings.openai.desc':               'OpenAI 모델(gpt-4o, o3-mini 등) 사용 시 필요합니다.',
  'settings.projectPrompt.profileName': '프로필 이름',
  'settings.projectPrompt.save':        '저장',
  'settings.projectPrompt.placeholder': '이 프로젝트에서 Claude에게 항상 전달할 지침을 입력하세요...',
  'settings.projectPrompt.hint':        'Claude가 이 프로젝트에서 답변할 때 항상 이 내용이 컨텍스트로 추가됩니다.',

  // SettingsPanel — 단축키 탭
  'settings.shortcuts.readonly':        '읽기 전용 — 단축키는 앱 코드에서 설정됩니다.',

  // SettingsPanel — 고급 탭
  'settings.section.management':        '설정 관리',
  'settings.management.export':         '📤 내보내기',
  'settings.management.import':         '📥 가져오기',
  'settings.section.about':             '정보',

  // SettingsPanel — 기능 관리 탭
  'settings.features.groupDesc':        '그룹을 OFF하면 하위 기능이 모두 비활성화됩니다. 변경 사항은 즉시 반영됩니다.',

  // SettingsPanel — Footer
  'settings.footer.cancel':             '취소',
  'settings.footer.save':               '저장',

  // InputBar
  'input.pauseLabel':             '작업 저장됨',
  'input.resume':                 '▶ 재개',
  'input.cancel':                 '✕ 취소',
  'input.dropFiles':              '📎 파일을 여기에 놓으세요',
  'input.placeholder.multiline':  'Message Claude... (Enter: 줄바꿈, Ctrl+Enter: 전송, Shift+Enter: 일반 모드)',
  'input.placeholder.default':    'Message Claude... (/ commands, @file, Enter to send, Shift+Enter: 멀티라인 모드)',
  'input.tokens':                 '토큰',
  'input.title.stopRecording':    '녹음 중지',
  'input.title.voiceInput':       '음성 입력',
  'input.title.multilineOn':      '멀티라인 모드 켜기 (Shift+Enter)',
  'input.title.multilineOff':     '멀티라인 모드 끄기 (일반 모드로 전환)',
  'input.title.templates':        '메시지 템플릿',
  'input.title.smartOn':          '스마트 입력 켜기 (선택 후 " 또는 ( 입력 시 자동 감싸기)',
  'input.title.smartOff':         '스마트 입력 끄기 (선택 후 " 또는 ( 입력 시 자동 감싸기)',
  'input.title.enhance':          '프롬프트 개선 (AI)',
  'input.title.modelSelect':      '전송에 사용할 모델',
  'input.title.resume':           '재개 (Resume)',
  'input.title.pause':            '일시정지 (Pause)',
  'input.title.stop':             '중지 (Stop / Esc)',
  'input.title.promptChain':      'PromptChain 열기',

  // AppLayout — panel icon bar
  'panel.icon.bookmarks':   '북마크',
  'panel.icon.stats':       '통계',
  'panel.icon.snippets':    '스니펫',
  'panel.icon.outline':     '아웃라인',
  'panel.icon.plugins':     '플러그인',
  'panel.icon.connections': 'MCP 연결',
  'panel.icon.agent':       '에이전트',
  'hq.disabled':            'HQ Mode (비활성화됨)',
  'hq.switchDefault':       '기본 모드로 전환 (Ctrl+Shift+H)',
  'hq.switchHQ':            'HQ Mode (Ctrl+Shift+H)',
  'focusMode.exit':         '🎯 포커스 모드 (Ctrl+Shift+F)',
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

  // SettingsPanel — General tab
  'settings.section.chat':              'Chat',
  'settings.chat.timestamps':           'Show Timestamps',
  'settings.chat.tokenBudget':          'Token Budget',
  'settings.chat.tokenBudgetHint':      '0 = unlimited',
  'settings.chat.soundLabel':           'Completion Sound',
  'settings.chat.soundDesc':            'Play a sound when Claude finishes responding',
  'settings.chat.soundTest':            'Test',
  'settings.section.notifications':     'Notifications',
  'settings.notif.responseComplete':    'Notify on response complete',
  'settings.notif.backgroundOnly':      'Background only',
  'settings.notif.longSession':         'Long session warning (30+)',
  'settings.notif.contextWarning':      'Context limit 80% warning',

  // SettingsPanel — Appearance tab
  'settings.section.appearance':        'Appearance',
  'settings.appearance.theme':          'Theme',
  'settings.appearance.fontSize':       'Font Size',
  'settings.appearance.chatFontSize':   'Chat Font Size',
  'settings.appearance.fontSmall':      'Small (12px)',
  'settings.appearance.fontLarge':      'Large (20px)',
  'settings.appearance.fontDefault':    'Default (14px)',
  'settings.appearance.accentColor':    'Accent Color',
  'settings.appearance.apply':          'Apply',
  'settings.appearance.compactMode':    'Compact Mode',
  'settings.appearance.compactDesc':    'Reduce message spacing to show more',
  'settings.section.customCSS':         'Custom CSS',
  'settings.customCSS.desc':            'Override CSS variables or add custom styles (applied on save)',
  'settings.customCSS.reset':           'Reset',

  // SettingsPanel — AI tab
  'settings.section.model':             'Model',
  'settings.model.tempPrecise':         'Precise (0.0)',
  'settings.model.tempCreative':        'Creative (1.0)',
  'settings.section.globalPrompt':      'Global System Prompt',
  'settings.globalPrompt.desc':         'Applied to all chats. Also editable via the ⚙ button at the top of the chat.',
  'settings.globalPrompt.placeholder':  'Enter global instructions for Claude...',
  'settings.globalPrompt.reset':        'Reset',
  'settings.section.aiBehavior':        'AI Behavior',
  'settings.ai.responseLang':           'Response Language',
  'settings.ai.langAuto':               'Auto',
  'settings.section.apiSettings':       'API Settings',
  'settings.api.anthropicKeySet':       '✓ API key is set.',
  'settings.api.anthropicKeyMissing':   'Not set — using env ANTHROPIC_API_KEY (or not set)',
  'settings.api.showKey':               'Show',
  'settings.api.hideKey':               'Hide',
  'settings.api.resetKey':              'Reset',
  'settings.section.openaiKey':         'OpenAI API Key',
  'settings.openai.desc':               'Required for OpenAI models (gpt-4o, o3-mini, etc.).',
  'settings.projectPrompt.profileName': 'Profile name',
  'settings.projectPrompt.save':        'Save',
  'settings.projectPrompt.placeholder': 'Enter project-specific instructions for Claude...',
  'settings.projectPrompt.hint':        'This content is always added as context when Claude answers in this project.',

  // SettingsPanel — Shortcuts tab
  'settings.shortcuts.readonly':        'Read-only — shortcuts are configured in app code.',

  // SettingsPanel — Advanced tab
  'settings.section.management':        'Settings Management',
  'settings.management.export':         '📤 Export',
  'settings.management.import':         '📥 Import',
  'settings.section.about':             'About',

  // SettingsPanel — Features tab
  'settings.features.groupDesc':        'Turning a group OFF disables all features in it. Changes apply immediately.',

  // SettingsPanel — Footer
  'settings.footer.cancel':             'Cancel',
  'settings.footer.save':               'Save',

  // InputBar
  'input.pauseLabel':             'Task saved',
  'input.resume':                 '▶ Resume',
  'input.cancel':                 '✕ Cancel',
  'input.dropFiles':              '📎 Drop files here',
  'input.placeholder.multiline':  'Message Claude... (Enter: newline, Ctrl+Enter: send, Shift+Enter: normal mode)',
  'input.placeholder.default':    'Message Claude... (/ commands, @file, Enter to send, Shift+Enter: multiline mode)',
  'input.tokens':                 'tokens',
  'input.title.stopRecording':    'Stop recording',
  'input.title.voiceInput':       'Voice input',
  'input.title.multilineOn':      'Enable multiline mode (Shift+Enter)',
  'input.title.multilineOff':     'Disable multiline mode (switch to normal)',
  'input.title.templates':        'Message templates',
  'input.title.smartOn':          'Enable smart input (auto-wrap with " or ( after selection)',
  'input.title.smartOff':         'Disable smart input (auto-wrap with " or ( after selection)',
  'input.title.enhance':          'Enhance prompt (AI)',
  'input.title.modelSelect':      'Model for sending',
  'input.title.resume':           'Resume',
  'input.title.pause':            'Pause',
  'input.title.stop':             'Stop / Esc',
  'input.title.promptChain':      'Open PromptChain',

  // AppLayout — panel icon bar
  'panel.icon.bookmarks':   'Bookmarks',
  'panel.icon.stats':       'Stats',
  'panel.icon.snippets':    'Snippets',
  'panel.icon.outline':     'Outline',
  'panel.icon.plugins':     'Plugins',
  'panel.icon.connections': 'MCP Connections',
  'panel.icon.agent':       'Agent',
  'hq.disabled':            'HQ Mode (disabled)',
  'hq.switchDefault':       'Switch to default mode (Ctrl+Shift+H)',
  'hq.switchHQ':            'HQ Mode (Ctrl+Shift+H)',
  'focusMode.exit':         '🎯 Focus Mode (Ctrl+Shift+F)',
}

export type SupportedLang = 'ko' | 'en'

let currentLang: SupportedLang = ((): SupportedLang => {
  const stored = localStorage.getItem('app-language')
  return stored === 'en' ? 'en' : 'ko'
})()

/** Translate a key to the current language. Falls back to `fallback` or the key itself. */
export function t(key: string, fallback?: string): string {
  const dict = currentLang === 'ko' ? ko : en
  return dict[key] ?? fallback ?? key
}

/** Switch the active language and persist to localStorage. Dispatches a `language-change` event. */
export function setLanguage(lang: SupportedLang): void {
  currentLang = lang
  localStorage.setItem('app-language', lang)
  window.dispatchEvent(new CustomEvent('language-change', { detail: { lang } }))
}

export function getCurrentLanguage(): SupportedLang {
  return currentLang
}
