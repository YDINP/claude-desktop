// 그룹 키 타입
export type FeatureGroup = 'layout' | 'chat' | 'sidebar' | 'cc'

// 전체 인터페이스
export interface FeatureFlags {
  // ── 그룹 (ON/OFF가 자식 전체를 제어) ──
  'group.layout': boolean
  'group.chat': boolean
  'group.sidebar': boolean
  'group.cc': boolean

  // ── 레이아웃 자식 ──
  hqMode: boolean
  terminal: boolean
  webPreview: boolean
  splitView: boolean

  // ── 채팅 자식 ──
  sessionFork: boolean
  sessionExport: boolean
  contextCompress: boolean
  autoResume: boolean
  voiceInput: boolean

  // ── 사이드바 패널 자식 ──
  plugins: boolean
  connections: boolean
  outline: boolean
  stats: boolean
  sceneview: boolean
  git: boolean

  // ── CCEditor 자식 ──
  'cc.assetBrowser': boolean
  'cc.buildTab': boolean
  'cc.groupPanel': boolean
  'cc.backupManager': boolean
  'cc.batchInspector': boolean
  'cc.sceneValidation': boolean
}

// 그룹 → 자식 매핑
export const FEATURE_GROUP_MAP: Record<FeatureGroup, (keyof FeatureFlags)[]> = {
  layout:  ['hqMode', 'terminal', 'webPreview', 'splitView'],
  chat:    ['sessionFork', 'sessionExport', 'contextCompress', 'autoResume', 'voiceInput'],
  sidebar: ['plugins', 'connections', 'outline', 'stats', 'sceneview', 'git'],
  cc:      ['cc.assetBrowser', 'cc.buildTab', 'cc.groupPanel', 'cc.backupManager', 'cc.batchInspector', 'cc.sceneValidation'],
}

export const DEFAULT_FEATURES: FeatureFlags = {
  'group.layout': true,
  'group.chat': true,
  'group.sidebar': true,
  'group.cc': true,
  hqMode: true,
  terminal: true,
  webPreview: true,
  splitView: true,
  sessionFork: true,
  sessionExport: true,
  contextCompress: true,
  autoResume: true,
  voiceInput: false,
  plugins: true,
  connections: true,
  outline: true,
  stats: true,
  sceneview: true,
  git: true,
  'cc.assetBrowser': true,
  'cc.buildTab': true,
  'cc.groupPanel': true,
  'cc.backupManager': true,
  'cc.batchInspector': true,
  'cc.sceneValidation': true,
}
