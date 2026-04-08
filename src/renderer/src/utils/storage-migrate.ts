/**
 * localStorage 키 마이그레이션 헬퍼
 * 앱 시작 시 1회 실행 — 구 키 → 신 키 자동 이전 후 구 키 삭제
 *
 * 1차 마이그레이션 대상 (2026-04-08):
 *   sv-locked-uuids   → cd-sv-locked-nodes   (CCFileSceneView 노드 잠금)
 *   scene-locked      → cd-scene-locked       (SceneViewPanel/useNodeSelection 노드 잠금)
 *   cc-pinned-nodes   → cd-cc-pinned          (useNodeSelection 핀 노드)
 *   scene-pinned      → cd-scene-pinned       (SceneViewPanel 핀 노드)
 *   searchHistory     → cd-search-history     (SearchPanel 검색 히스토리)
 *   smart-input       → cd-smart-input        (InputBar 스마트 입력)
 *   settings:openaiApiKey → cd-settings-openai-key (SettingsPanel API 키)
 */

const MIGRATIONS: Array<{ from: string; to: string }> = [
  { from: 'sv-locked-uuids', to: 'cd-sv-locked-nodes' },
  { from: 'scene-locked', to: 'cd-scene-locked' },
  { from: 'cc-pinned-nodes', to: 'cd-cc-pinned' },
  { from: 'scene-pinned', to: 'cd-scene-pinned' },
  { from: 'searchHistory', to: 'cd-search-history' },
  { from: 'smart-input', to: 'cd-smart-input' },
  { from: 'settings:openaiApiKey', to: 'cd-settings-openai-key' },
]

const MIGRATION_DONE_KEY = 'cd-storage-migrated-v1'

export function runStorageMigration(): void {
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return
  for (const { from, to } of MIGRATIONS) {
    const value = localStorage.getItem(from)
    if (value !== null) {
      // 신 키에 값이 없을 때만 이전 (이미 신 키로 저장된 데이터 보호)
      if (localStorage.getItem(to) === null) {
        localStorage.setItem(to, value)
      }
      localStorage.removeItem(from)
    }
  }
  localStorage.setItem(MIGRATION_DONE_KEY, '1')
}
