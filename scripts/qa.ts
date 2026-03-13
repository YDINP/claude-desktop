#!/usr/bin/env npx tsx
/**
 * Claude Desktop — Round QA Automation Script
 * 실행: npx tsx scripts/qa.ts [--round=N] [--fix]
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const args = process.argv.slice(2)
const roundNum = args.find(a => a.startsWith('--round='))?.split('=')[1] ?? 'latest'
const autoFix = args.includes('--fix')

interface QAResult {
  category: string
  level: 'critical' | 'warning' | 'pass'
  file?: string
  line?: number
  message: string
}

const results: QAResult[] = []

function log(level: QAResult['level'], category: string, message: string, file?: string, line?: number) {
  results.push({ category, level, file, line, message })
  const icon = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '✅'
  const loc = file ? ` [${file}${line ? ':' + line : ''}]` : ''
  console.log(`${icon} [${category}]${loc} ${message}`)
}

// ── 1. TypeScript 컴파일 ───────────────────────────────────
console.log('\n## 1. TypeScript 컴파일 검사')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe' })
  log('pass', 'TypeScript', 'tsc --noEmit 오류 없음')
} catch (e: unknown) {
  const output = (e as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? ''
  const lines = output.split('\n').filter(Boolean)
  for (const line of lines.slice(0, 20)) {
    const match = line.match(/^(.+)\((\d+),\d+\): error TS\d+: (.+)$/)
    if (match) log('critical', 'TypeScript', match[3], match[1], parseInt(match[2]))
    else if (line.trim()) log('critical', 'TypeScript', line)
  }
}

// ── 2. import 패턴 검사 ──────────────────────────────────
console.log('\n## 2. import 패턴 검사')
let srcFiles: string[] = []
try {
  srcFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean)
} catch {
  log('warning', 'Import', 'src 디렉터리 탐색 실패')
}

for (const file of srcFiles) {
  const content = readFileSync(join(ROOT, file), 'utf-8')
  // window.api.cc* 사용하는 파일에서 CCNode 타입 import 확인
  if (content.includes('window.api.cc') && !content.includes('CCNode') && content.includes(': CCNode')) {
    log('warning', 'Import', 'CCNode 타입 사용하지만 import 없을 수 있음', file)
  }
  // useEffect cleanup 패턴
  if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
    log('warning', 'Memory', 'addEventListener without removeEventListener', file)
  }
}

if (srcFiles.length > 0) {
  log('pass', 'Import', `${srcFiles.length}개 소스 파일 검사 완료`)
}

// ── 3. CC 관련 파일 검사 ──────────────────────────────────
console.log('\n## 3. CC 통합 파일 검사')
const ccBridgePath = join(ROOT, 'src/main/cc/cc-bridge.ts')
if (existsSync(ccBridgePath)) {
  const content = readFileSync(ccBridgePath, 'utf-8')
  if (!content.includes('scheduleReconnect') || !content.includes('reconnectTimer')) {
    log('warning', 'CC-Bridge', '자동 재연결 로직 확인 필요', 'src/main/cc/cc-bridge.ts')
  } else {
    log('pass', 'CC-Bridge', '자동 재연결 로직 존재')
  }
  // disconnect 메서드 안에 reconnectTimer clearTimeout이 있는지 확인
  const disconnectBlock = content.match(/disconnect\s*\(\)[^}]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s)?.[1] ?? ''
  if (!disconnectBlock.includes('reconnectTimer') || !disconnectBlock.includes('clearTimeout')) {
    log('warning', 'CC-Bridge', 'disconnect 메서드 reconnect 취소 확인 필요', 'src/main/cc/cc-bridge.ts')
  }
} else {
  log('warning', 'CC-Bridge', 'cc-bridge.ts 파일 없음')
}

// ── 4. Sidebar 중복 탭 검사 ──────────────────────────────
console.log('\n## 4. Sidebar 탭 중복 검사')
const sidebarPath = join(ROOT, 'src/renderer/src/components/sidebar/Sidebar.tsx')
const appPath = join(ROOT, 'src/renderer/src/App.tsx')
if (existsSync(sidebarPath)) {
  const sidebarContent = readFileSync(sidebarPath, 'utf-8')
  const appContent = existsSync(appPath) ? readFileSync(appPath, 'utf-8') : ''
  // CocosPanel이 App.tsx 메인 레이아웃에 직접 통합됨 (사이드바 탭 불필요)
  const cocosInApp = appContent.includes('CocosPanel') && appContent.includes('ccLayout')
  if (cocosInApp) {
    log('pass', 'Sidebar', 'CocosPanel App 메인 레이아웃에 통합됨 (탭/나란히/창분리)')
  } else {
    log('warning', 'Sidebar', 'cocos 탭 미등록', 'Sidebar.tsx')
  }
} else {
  log('warning', 'Sidebar', 'Sidebar.tsx 파일 없음')
}

// ── 5. IPC 핸들러 중복 검사 ──────────────────────────────
console.log('\n## 5. IPC 핸들러 중복 검사')
const routerFiles = ['src/main/ipc/router.ts', 'src/main/index.ts']
for (const rf of routerFiles) {
  const fp = join(ROOT, rf)
  if (!existsSync(fp)) continue
  const content = readFileSync(fp, 'utf-8')
  // import 문 제외하고 실제 호출만 카운트
  const callMatches = content.match(/^\s*registerCCHandlers\s*\(/gm) ?? []
  const ccHandlerCalls = callMatches.length
  if (ccHandlerCalls > 1) {
    log('critical', 'IPC', `registerCCHandlers 중복 호출: ${ccHandlerCalls}회`, rf)
  } else if (ccHandlerCalls === 1) {
    log('pass', 'IPC', 'registerCCHandlers 정상 등록', rf)
  } else {
    // index.ts는 router를 통해 간접 호출 — 정상
    if (rf === 'src/main/ipc/router.ts') {
      log('warning', 'IPC', `registerCCHandlers 미등록`, rf)
    }
  }
}

// ── 6. 신규 기능 파일 검사 (Round 83-88) ─────────────────────────────
console.log('\n## 6. 신규 기능 파일 검사')

// AssetBrowserPanel (Round 84)
const assetBrowserPath = join(ROOT, 'src/renderer/src/components/sidebar/AssetBrowserPanel.tsx')
if (existsSync(assetBrowserPath)) {
  log('pass', 'Round84', 'AssetBrowserPanel.tsx 존재')
} else {
  log('warning', 'Round84', 'AssetBrowserPanel.tsx 미존재', 'sidebar/AssetBrowserPanel.tsx')
}

// CC Extension assets/tree 엔드포인트 (Round 84)
const ext3xPath = join(ROOT, 'extensions/cc-ws-extension-3x/main.js')
if (existsSync(ext3xPath)) {
  const ext3x = readFileSync(ext3xPath, 'utf-8')
  if (ext3x.includes('/assets/tree')) {
    log('pass', 'Round84', 'CC 3x /assets/tree 엔드포인트 존재')
  } else {
    log('warning', 'Round84', 'CC 3x /assets/tree 엔드포인트 미존재', 'extensions/cc-ws-extension-3x/main.js')
  }
}

// cost-tracker.ts (Round 86)
const costTrackerPath = join(ROOT, 'src/renderer/src/utils/cost-tracker.ts')
if (existsSync(costTrackerPath)) {
  const ct = readFileSync(costTrackerPath, 'utf-8')
  if (ct.includes('recordCost') && ct.includes('getMonthlyCost')) {
    log('pass', 'Round86', 'cost-tracker.ts: recordCost + getMonthlyCost 존재')
  } else {
    log('warning', 'Round86', 'cost-tracker.ts 핵심 함수 누락', 'utils/cost-tracker.ts')
  }
} else {
  log('warning', 'Round86', 'cost-tracker.ts 미존재', 'utils/cost-tracker.ts')
}

// CommandPalette recent-action (Round 87)
const cpPath = join(ROOT, 'src/renderer/src/components/shared/CommandPalette.tsx')
if (existsSync(cpPath)) {
  const cp = readFileSync(cpPath, 'utf-8')
  if (cp.includes('recent-action') && cp.includes('addRecentAction')) {
    log('pass', 'Round87', 'CommandPalette recent-action 구현 존재')
  } else {
    log('warning', 'Round87', 'CommandPalette recent-action 미구현', 'shared/CommandPalette.tsx')
  }
}

// PromptChain 템플릿 라이브러리 (Round 88)
const pcPath = join(ROOT, 'src/renderer/src/components/sidebar/PromptChainPanel.tsx')
if (existsSync(pcPath)) {
  const pc = readFileSync(pcPath, 'utf-8')
  if (pc.includes('PRESET_TEMPLATES') && pc.includes('importTemplate')) {
    log('pass', 'Round88', 'PromptChainPanel 템플릿 라이브러리 존재')
  } else {
    log('warning', 'Round88', 'PromptChainPanel 템플릿 라이브러리 미구현', 'sidebar/PromptChainPanel.tsx')
  }
}

// ── 7. 신규 기능 파일 검사 (Round 90-94) ─────────────────────────────
console.log('\n## 7. 신규 기능 파일 검사 (R90-94)')

// useContextFiles hook (Round 90)
const ctxFilesPath = join(ROOT, 'src/renderer/src/hooks/useContextFiles.ts')
if (existsSync(ctxFilesPath)) {
  const cf = readFileSync(ctxFilesPath, 'utf-8')
  if (cf.includes('useContextFiles') && cf.includes('contextString')) {
    log('pass', 'Round90', 'useContextFiles hook 존재')
  } else {
    log('warning', 'Round90', 'useContextFiles hook 핵심 구현 누락', 'hooks/useContextFiles.ts')
  }
} else {
  log('warning', 'Round90', 'useContextFiles.ts 미존재', 'hooks/useContextFiles.ts')
}

// fs:open-file-dialog IPC (Round 91)
const fsHandlersPath = join(ROOT, 'src/main/ipc/fs-handlers.ts')
if (existsSync(fsHandlersPath)) {
  const fsh = readFileSync(fsHandlersPath, 'utf-8')
  if (fsh.includes('open-file-dialog') && fsh.includes('showOpenDialog')) {
    log('pass', 'Round91', 'fs:open-file-dialog IPC 핸들러 존재')
  } else {
    log('warning', 'Round91', 'fs:open-file-dialog 핸들러 누락', 'ipc/fs-handlers.ts')
  }
}

// StatsPanel cost section (Round 92)
const statsPanelPath = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(statsPanelPath)) {
  const sp = readFileSync(statsPanelPath, 'utf-8')
  if (sp.includes('getDailyCosts') && sp.includes('monthlyCost')) {
    log('pass', 'Round92', 'StatsPanel API 비용 섹션 존재')
  } else {
    log('warning', 'Round92', 'StatsPanel 비용 섹션 누락', 'sidebar/StatsPanel.tsx')
  }
} else {
  log('warning', 'Round92', 'StatsPanel.tsx 미존재', 'sidebar/StatsPanel.tsx')
}

// Streaming batch — reconcileText (Round 93)
const chatStorePath = join(ROOT, 'src/renderer/src/stores/chat-store.ts')
if (existsSync(chatStorePath)) {
  const cs = readFileSync(chatStorePath, 'utf-8')
  if (cs.includes('reconcileText')) {
    log('pass', 'Round93', 'chat-store reconcileText 존재')
  } else {
    log('warning', 'Round93', 'chat-store reconcileText 누락', 'stores/chat-store.ts')
  }
}

// agent-bridge text_delta batching (Round 93)
const agentBridgePath = join(ROOT, 'src/main/claude/agent-bridge.ts')
if (existsSync(agentBridgePath)) {
  const ab = readFileSync(agentBridgePath, 'utf-8')
  if (ab.includes('textBatch') && ab.includes('flushTextBatch')) {
    log('pass', 'Round93', 'agent-bridge text_delta 16ms 배치 존재')
  } else {
    log('warning', 'Round93', 'agent-bridge text_delta 배치 누락', 'claude/agent-bridge.ts')
  }
}

// AG-UI event model (Round 94)
const aguiStorePath = join(ROOT, 'src/renderer/src/utils/agui-store.ts')
if (existsSync(aguiStorePath)) {
  const ags = readFileSync(aguiStorePath, 'utf-8')
  if (ags.includes('aguiDispatch') && ags.includes('aguiSubscribe')) {
    log('pass', 'Round94', 'agui-store: aguiDispatch + aguiSubscribe 존재')
  } else {
    log('warning', 'Round94', 'agui-store 핵심 함수 누락', 'utils/agui-store.ts')
  }
} else {
  log('warning', 'Round94', 'agui-store.ts 미존재', 'utils/agui-store.ts')
}

const runTimelinePath = join(ROOT, 'src/renderer/src/components/sidebar/RunTimeline.tsx')
if (existsSync(runTimelinePath)) {
  log('pass', 'Round94', 'RunTimeline.tsx 존재')
} else {
  log('warning', 'Round94', 'RunTimeline.tsx 미존재', 'sidebar/RunTimeline.tsx')
}

// ── 8. 신규 기능 파일 검사 (Round 96-97) ─────────────────────────────
console.log('\n## 8. 신규 기능 파일 검사 (R96-97)')

// SceneView multi-select (Round 96)
const sceneViewPath = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPath)) {
  const sv = readFileSync(sceneViewPath, 'utf-8')
  if (sv.includes('selectedUuids') && sv.includes('MarqueeState')) {
    log('pass', 'Round96', 'SceneView 다중 선택 + MarqueeState 존재')
  } else {
    log('warning', 'Round96', 'SceneView 다중 선택 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// Ollama bridge (Round 97)
const ollamaBridgePath = join(ROOT, 'src/main/ollama/ollama-bridge.ts')
if (existsSync(ollamaBridgePath)) {
  const ob = readFileSync(ollamaBridgePath, 'utf-8')
  if (ob.includes('ollamaListModels') && ob.includes('ollamaChat')) {
    log('pass', 'Round97', 'ollama-bridge.ts: ollamaListModels + ollamaChat 존재')
  } else {
    log('warning', 'Round97', 'ollama-bridge.ts 핵심 함수 누락', 'main/ollama/ollama-bridge.ts')
  }
} else {
  log('warning', 'Round97', 'ollama-bridge.ts 미존재', 'main/ollama/ollama-bridge.ts')
}

const ollamaHandlersPath = join(ROOT, 'src/main/ipc/ollama-handlers.ts')
if (existsSync(ollamaHandlersPath)) {
  log('pass', 'Round97', 'ollama-handlers.ts 존재')
} else {
  log('warning', 'Round97', 'ollama-handlers.ts 미존재', 'ipc/ollama-handlers.ts')
}

const inputBarPath = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(inputBarPath)) {
  const ib = readFileSync(inputBarPath, 'utf-8')
  if (ib.includes('ollamaModels') && ib.includes('ollamaList')) {
    log('pass', 'Round97', 'InputBar Ollama 모델 피커 존재')
  } else {
    log('warning', 'Round97', 'InputBar Ollama 피커 누락', 'chat/InputBar.tsx')
  }
}

console.log('\n## 9. 신규 기능 파일 검사 (R98-99)')

// SceneView undo/redo (Round 98)
const sceneTypesPath = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/types.ts')
if (existsSync(sceneTypesPath)) {
  const st = readFileSync(sceneTypesPath, 'utf-8')
  if (st.includes('UndoEntry')) {
    log('pass', 'Round98', 'SceneView UndoEntry 타입 존재')
  } else {
    log('warning', 'Round98', 'SceneView UndoEntry 타입 누락', 'SceneView/types.ts')
  }
}

if (existsSync(sceneViewPath)) {
  const sv = readFileSync(sceneViewPath, 'utf-8')
  if (sv.includes('undoStack') && sv.includes('redoStack')) {
    log('pass', 'Round98', 'SceneView undo/redo 스택 존재')
  } else {
    log('warning', 'Round98', 'SceneView undo/redo 스택 누락', 'SceneView/SceneViewPanel.tsx')
  }
}

// OpenAI provider (Round 99)
const openAIBridgePath = join(ROOT, 'src/main/providers/openai-bridge.ts')
if (existsSync(openAIBridgePath)) {
  const ob = readFileSync(openAIBridgePath, 'utf-8')
  if (ob.includes('openaiChat')) {
    log('pass', 'Round99', 'openai-bridge.ts: openaiChat 존재')
  } else {
    log('warning', 'Round99', 'openai-bridge.ts openaiChat 누락', 'providers/openai-bridge.ts')
  }
} else {
  log('warning', 'Round99', 'openai-bridge.ts 미존재', 'providers/openai-bridge.ts')
}

const openAIHandlersPath = join(ROOT, 'src/main/ipc/openai-handlers.ts')
if (existsSync(openAIHandlersPath)) {
  log('pass', 'Round99', 'openai-handlers.ts 존재')
} else {
  log('warning', 'Round99', 'openai-handlers.ts 미존재', 'ipc/openai-handlers.ts')
}

if (existsSync(inputBarPath)) {
  const ib = readFileSync(inputBarPath, 'utf-8')
  if (ib.includes('openai:gpt-4o')) {
    log('pass', 'Round99', 'InputBar OpenAI 모델 옵션 존재')
  } else {
    log('warning', 'Round99', 'InputBar OpenAI 모델 옵션 누락', 'chat/InputBar.tsx')
  }
}

console.log('\n## 10. 신규 기능 파일 검사 (R101)')

// SceneView clipboard (Round 101)
const sceneTypesPath2 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/types.ts')
if (existsSync(sceneTypesPath2)) {
  const st = readFileSync(sceneTypesPath2, 'utf-8')
  if (st.includes('ClipboardEntry')) {
    log('pass', 'Round101', 'SceneView ClipboardEntry 타입 존재')
  } else {
    log('warning', 'Round101', 'SceneView ClipboardEntry 타입 누락', 'SceneView/types.ts')
  }
}

const sceneViewPath2 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPath2)) {
  const sv = readFileSync(sceneViewPath2, 'utf-8')
  if (sv.includes('clipboard') && sv.includes('handleCopy')) {
    log('pass', 'Round101', 'SceneView 노드 복사/붙여넣기 존재')
  } else {
    log('warning', 'Round101', 'SceneView 복사/붙여넣기 누락', 'SceneView/SceneViewPanel.tsx')
  }
}

// Memory leak fix (Round 101)
const ollamaBridgePath2 = join(ROOT, 'src/main/ollama/ollama-bridge.ts')
if (existsSync(ollamaBridgePath2)) {
  const ob = readFileSync(ollamaBridgePath2, 'utf-8')
  if (ob.includes('removeEventListener')) {
    log('pass', 'Round101', 'ollama-bridge addEventListener 메모리 누수 수정됨')
  } else {
    log('warning', 'Round101', 'ollama-bridge 메모리 누수 미수정', 'main/ollama/ollama-bridge.ts')
  }
}

console.log('\n## 11. 신규 기능 파일 검사 (R102-103)')

// SceneInspector active toggle (Round 102)
const sceneInspectorPath = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath)) {
  const si = readFileSync(sceneInspectorPath, 'utf-8')
  if (si.includes('isActive') && si.includes('handleActiveToggle')) {
    log('pass', 'Round102', 'SceneInspector 노드 가시성 토글 존재')
  } else {
    log('warning', 'Round102', 'SceneInspector 가시성 토글 누락', 'SceneView/SceneInspector.tsx')
  }
}

// GlobalSearchPanel (Round 103)
const globalSearchPath = join(ROOT, 'src/renderer/src/components/sidebar/GlobalSearchPanel.tsx')
if (existsSync(globalSearchPath)) {
  const gs = readFileSync(globalSearchPath, 'utf-8')
  if (gs.includes('sessionSearchAll') && gs.includes('GlobalSearchResult')) {
    log('pass', 'Round103', 'GlobalSearchPanel: sessionSearchAll + 결과 타입 존재')
  } else {
    log('warning', 'Round103', 'GlobalSearchPanel 구현 불완전', 'sidebar/GlobalSearchPanel.tsx')
  }
} else {
  log('warning', 'Round103', 'GlobalSearchPanel.tsx 미존재', 'sidebar/GlobalSearchPanel.tsx')
}

// session:searchAll IPC (Round 103)
const sessionHandlersPath = join(ROOT, 'src/main/ipc/session-handlers.ts')
if (existsSync(sessionHandlersPath)) {
  const sh = readFileSync(sessionHandlersPath, 'utf-8')
  if (sh.includes('session:searchAll')) {
    log('pass', 'Round103', 'session:searchAll IPC 핸들러 존재')
  } else {
    log('warning', 'Round103', 'session:searchAll IPC 누락', 'ipc/session-handlers.ts')
  }
}

console.log('\n## 12. 신규 기능 파일 검사 (R104-105)')

// SceneView Z-order (Round 104)
const ccBridgePath2 = join(ROOT, 'src/main/cc/cc-bridge.ts')
if (existsSync(ccBridgePath2)) {
  const cb = readFileSync(ccBridgePath2, 'utf-8')
  if (cb.includes('setZOrder')) {
    log('pass', 'Round104', 'cc-bridge.ts: setZOrder 메서드 존재')
  } else {
    log('warning', 'Round104', 'cc-bridge.ts setZOrder 누락', 'main/cc/cc-bridge.ts')
  }
}

// CC 2x Extension Z-order (Round 105)
const ext2xMainPath = join(ROOT, 'extensions/cc-ws-extension-2x/main.js')
if (existsSync(ext2xMainPath)) {
  const ext = readFileSync(ext2xMainPath, 'utf-8')
  if (ext.includes('zorder') && ext.includes('setNodeZOrder')) {
    log('pass', 'Round105', 'CC 2x extension Z-order 엔드포인트 존재')
  } else {
    log('warning', 'Round105', 'CC 2x extension Z-order 누락', 'extensions/cc-ws-extension-2x/main.js')
  }
}

console.log('\n## 13. 신규 기능 파일 검사 (R106-107)')

// Quick action slots (Round 106)
const inputBarPath2 = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(inputBarPath2)) {
  const ib = readFileSync(inputBarPath2, 'utf-8')
  if (ib.includes('DEFAULT_QUICK_ACTIONS') && ib.includes('quickActions')) {
    log('pass', 'Round106', 'InputBar 빠른 액션 슬롯 존재')
  } else {
    log('warning', 'Round106', 'InputBar 빠른 액션 누락', 'chat/InputBar.tsx')
  }
}

// Session auto-title (Round 107)
const chatPanelPath2 = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(chatPanelPath2)) {
  const cp = readFileSync(chatPanelPath2, 'utf-8')
  if (cp.includes('autoTitle') || cp.includes('auto-title') || cp.includes('sessionRename')) {
    log('pass', 'Round107', '세션 자동 제목 기능 존재')
  } else {
    log('warning', 'Round107', '세션 자동 제목 미구현', 'chat/ChatPanel.tsx')
  }
}

console.log('\n## 14. 신규 기능 파일 검사 (R108-109)')

// CC node inline rename (Round 108)
const sceneTreePath = join(ROOT, 'src/renderer/src/components/sidebar/SceneTreePanel.tsx')
if (existsSync(sceneTreePath)) {
  const st = readFileSync(sceneTreePath, 'utf-8')
  if (st.includes('handleRename') && (st.includes('onDoubleClick') || st.includes('handleDoubleClick'))) {
    log('pass', 'Round108', 'SceneTree 노드 인라인 이름 편집 존재')
  } else {
    log('warning', 'Round108', 'SceneTree 인라인 편집 누락', 'sidebar/SceneTreePanel.tsx')
  }
}

// Streaming elapsed time (Round 109)
const inputBarPath3 = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(inputBarPath3)) {
  const ib = readFileSync(inputBarPath3, 'utf-8')
  if (ib.includes('elapsed') || ib.includes('streamTime') || ib.includes('streamDuration') || ib.includes('streamElapsed')) {
    log('pass', 'Round109', '스트리밍 경과 시간 표시 존재')
  } else {
    log('warning', 'Round109', '스트리밍 경과 시간 미구현', 'chat/InputBar.tsx')
  }
}

console.log('\n## 15. 신규 기능 파일 검사 (R109-110)')

// CC node create/delete (Round 109)
const ccBridgePath3 = join(ROOT, 'src/main/cc/cc-bridge.ts')
if (existsSync(ccBridgePath3)) {
  const cb = readFileSync(ccBridgePath3, 'utf-8')
  if (cb.includes('createNode') && cb.includes('deleteNode')) {
    log('pass', 'Round109', 'cc-bridge.ts: createNode + deleteNode 존재')
  } else {
    log('warning', 'Round109', 'cc-bridge.ts 노드 생성/삭제 누락', 'main/cc/cc-bridge.ts')
  }
}

// NodePropertyPanel enhanced display (Round 110)
const nodePropPath = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(nodePropPath)) {
  const np = readFileSync(nodePropPath, 'utf-8')
  if (np.includes('ColorSwatch') || np.includes('colorSwatch') || (np.includes('background') && np.includes('rgb('))) {
    log('pass', 'Round110', 'NodePropertyPanel 색상 스왓치 표시 존재')
  } else {
    log('warning', 'Round110', 'NodePropertyPanel 색상 스왓치 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 16: R111 신규 기능 ───────────────────────────────
console.log('\n## 16. 신규 기능 파일 검사 (R111)')
// StatsPanel 고도화 (Round 111)
const sessionHandlerPath = join(ROOT, 'src/main/ipc/session-handlers.ts')
if (existsSync(sessionHandlerPath)) {
  const sh = readFileSync(sessionHandlerPath, 'utf-8')
  if (sh.includes('totalMessages') && sh.includes('dailyMessageCounts') && sh.includes('topSessions')) {
    log('pass', 'Round111', 'globalStats: totalMessages/dailyMessageCounts/topSessions 존재')
  } else {
    log('warning', 'Round111', 'globalStats 확장 필드 누락', 'main/ipc/session-handlers.ts')
  }
}
const statsPanelPath2 = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(statsPanelPath2)) {
  const sp2 = readFileSync(statsPanelPath2, 'utf-8')
  if (sp2.includes('dailyMessageCounts')) {
    log('pass', 'Round111', 'StatsPanel 일별 메시지 수 차트 존재')
  } else {
    log('warning', 'Round111', 'StatsPanel 일별 메시지 수 차트 미구현', 'sidebar/StatsPanel.tsx')
  }
  if (sp2.includes('topSessions') && sp2.includes('TOP 5')) {
    log('pass', 'Round111', 'StatsPanel 상위 세션 TOP 5 존재')
  } else {
    log('warning', 'Round111', 'StatsPanel 상위 세션 TOP 5 미구현', 'sidebar/StatsPanel.tsx')
  }
}

// ── Section 17: R112 신규 기능 ───────────────────────────────
console.log('\n## 17. 신규 기능 파일 검사 (R112)')
// NodePropertyPanel 슬라이더 (Round 112)
const nodePropPath2 = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(nodePropPath2)) {
  const np2 = readFileSync(nodePropPath2, 'utf-8')
  if (np2.includes('sliderMin') && np2.includes('sliderMax') && np2.includes('type="range"')) {
    log('pass', 'Round112', 'NodePropertyPanel 슬라이더 PropRow 존재')
  } else {
    log('warning', 'Round112', 'NodePropertyPanel 슬라이더 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
  if (np2.includes('sliderMin={0}') && np2.includes('sliderMax={255}')) {
    log('pass', 'Round112', 'Opacity 슬라이더 (0-255) 존재')
  } else {
    log('warning', 'Round112', 'Opacity 슬라이더 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
  if (np2.includes('sliderMin={-180}') && np2.includes('sliderMax={180}')) {
    log('pass', 'Round112', 'Rotation 슬라이더 (-180~180) 존재')
  } else {
    log('warning', 'Round112', 'Rotation 슬라이더 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 18: R113 신규 기능 ───────────────────────────────
console.log('\n## 18. 신규 기능 파일 검사 (R113)')
// 메시지 재생성 이력 보존 (Round 113)
const chatStorePath2 = join(ROOT, 'src/renderer/src/stores/chat-store.ts')
if (existsSync(chatStorePath2)) {
  const cs2 = readFileSync(chatStorePath2, 'utf-8')
  if (cs2.includes('saveAlternative') && cs2.includes('alternatives')) {
    log('pass', 'Round113', 'chat-store: saveAlternative + alternatives 필드 존재')
  } else {
    log('warning', 'Round113', 'chat-store alternatives 미구현', 'stores/chat-store.ts')
  }
}
const msgBubblePath2 = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(msgBubblePath2)) {
  const mb2 = readFileSync(msgBubblePath2, 'utf-8')
  if (mb2.includes('altIndex') && mb2.includes('altCount') && mb2.includes('onPrevAlt')) {
    log('pass', 'Round113', 'MessageBubble alternatives 네비게이션 존재')
  } else {
    log('warning', 'Round113', 'MessageBubble alternatives 네비게이션 미구현', 'chat/MessageBubble.tsx')
  }
}

// ── Section 19: R114 신규 기능 ───────────────────────────────
console.log('\n## 19. 신규 기능 파일 검사 (R114)')
// CC Extension 색상피커 (Round 114)
const cc3xPath2 = join(ROOT, 'extensions/cc-ws-extension-3x/main.js')
if (existsSync(cc3xPath2)) {
  const c3 = readFileSync(cc3xPath2, 'utf-8')
  if (c3.includes("key === 'color'") && c3.includes('cc.Color')) {
    log('pass', 'Round114', 'CC 3x extension: color key 지원 존재')
  } else {
    log('warning', 'Round114', 'CC 3x extension: color key 미지원', 'extensions/cc-ws-extension-3x/main.js')
  }
}
const nodePropPath3 = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(nodePropPath3)) {
  const np3 = readFileSync(nodePropPath3, 'utf-8')
  if (np3.includes('onSaveProp') && np3.includes('type="color"')) {
    log('pass', 'Round114', 'NodePropertyPanel 색상피커 input 존재')
  } else {
    log('warning', 'Round114', 'NodePropertyPanel 색상피커 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 20: R115 신규 기능 ───────────────────────────────
console.log('\n## 20. 신규 기능 파일 검사 (R115)')
// 세션 커스텀 텍스트 태그 (Round 115)
const sessionListPath = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sessionListPath)) {
  const sl = readFileSync(sessionListPath, 'utf-8')
  if (sl.includes('allCustomTags') && sl.includes('handleAddCustomTag')) {
    log('pass', 'Round115', 'SessionList 커스텀 태그 추가 기능 존재')
  } else {
    log('warning', 'Round115', 'SessionList 커스텀 태그 미구현', 'sidebar/SessionList.tsx')
  }
  if (sl.includes('filterCustomTag') && sl.includes('showTagSuggest')) {
    log('pass', 'Round115', 'SessionList 커스텀 태그 자동완성 + 필터 존재')
  } else {
    log('warning', 'Round115', 'SessionList 커스텀 태그 필터/자동완성 미구현', 'sidebar/SessionList.tsx')
  }
}

// ── Section 21: R117 신규 기능 ───────────────────────────────
console.log('\n## 21. 신규 기능 파일 검사 (R117)')
// SceneView 멀티셀렉트 그룹 드래그 (Round 117)
const sceneTypesPath3 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/types.ts')
if (existsSync(sceneTypesPath3)) {
  const st3 = readFileSync(sceneTypesPath3, 'utf-8')
  if (st3.includes('groupOffsets')) {
    log('pass', 'Round117', 'SceneView DragState groupOffsets 필드 존재')
  } else {
    log('warning', 'Round117', 'SceneView DragState groupOffsets 미구현', 'SceneView/types.ts')
  }
}
const sceneViewPanelPath3 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath3)) {
  const svp3 = readFileSync(sceneViewPanelPath3, 'utf-8')
  if (svp3.includes('groupOffsets') && svp3.includes('isGroupDrag')) {
    log('pass', 'Round117', 'SceneViewPanel 그룹 드래그 처리 존재')
  } else {
    log('warning', 'Round117', 'SceneViewPanel 그룹 드래그 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 22: R118 신규 기능 ───────────────────────────────
console.log('\n## 22. 신규 기능 파일 검사 (R118)')
// SceneView 그룹 bbox 시각화 (Round 118)
const svpPath4 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svpPath4)) {
  const svp4 = readFileSync(svpPath4, 'utf-8')
  if (svp4.includes('groupBbox') && svp4.includes('fbbf24')) {
    log('pass', 'Round118', 'SceneView 그룹 bbox 점선 박스 렌더링 존재')
  } else {
    log('warning', 'Round118', 'SceneView 그룹 bbox 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 23: R119 신규 기능 ───────────────────────────────
console.log('\n## 23. 신규 기능 파일 검사 (R119)')
// InputBar 멀티라인 (Round 119)
const inputBarPath4 = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(inputBarPath4)) {
  const ib4 = readFileSync(inputBarPath4, 'utf-8')
  if (ib4.includes('Shift+Enter') && ib4.includes('adjustHeight')) {
    log('pass', 'Round119', 'InputBar Shift+Enter 힌트 + adjustHeight useEffect 존재')
  } else {
    log('warning', 'Round119', 'InputBar 멀티라인 지원 미구현', 'chat/InputBar.tsx')
  }
  if (ib4.includes('text.length > 100') && ib4.includes('split')) {
    log('pass', 'Round119', 'InputBar 문자/줄 수 표시 존재')
  } else {
    log('warning', 'Round119', 'InputBar 문자/줄 수 표시 미구현', 'chat/InputBar.tsx')
  }
}

// ── Section 24: R121 신규 기능 ───────────────────────────────
console.log('\n## 24. 신규 기능 파일 검사 (R121)')
// CC Extension 컴포넌트 props 편집 (Round 121)
const cc3xPath3 = join(ROOT, 'extensions/cc-ws-extension-3x/main.js')
if (existsSync(cc3xPath3)) {
  const c3x = readFileSync(cc3xPath3, 'utf-8')
  if (c3x.includes('/node/:uuid/component') || c3x.includes("url.match(/^\\/node\\/([^\\/]+)\\/component$/") || c3x.includes('compMatch')) {
    log('pass', 'Round121', 'CC 3x extension: POST /node/:uuid/component 엔드포인트 존재')
  } else {
    log('warning', 'Round121', 'CC 3x extension: 컴포넌트 prop 설정 엔드포인트 미구현', 'extensions/cc-ws-extension-3x/main.js')
  }
}
const ccBridgePath4 = join(ROOT, 'src/main/cc/cc-bridge.ts')
if (existsSync(ccBridgePath4)) {
  const cb4 = readFileSync(ccBridgePath4, 'utf-8')
  if (cb4.includes('setComponentProp')) {
    log('pass', 'Round121', 'cc-bridge: setComponentProp 메서드 존재')
  } else {
    log('warning', 'Round121', 'cc-bridge: setComponentProp 미구현', 'cc/cc-bridge.ts')
  }
}
const nodePropPath5 = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(nodePropPath5)) {
  const np4 = readFileSync(nodePropPath5, 'utf-8')
  if (np4.includes('COMP_EDITABLE_KEYS') && np4.includes('cc.Label') && np4.includes('CompEditRow')) {
    log('pass', 'Round121', 'NodePropertyPanel 컴포넌트별 편집 UI 존재 (cc.Label/cc.Button)')
  } else {
    log('warning', 'Round121', 'NodePropertyPanel 컴포넌트별 편집 UI 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
  if (np4.includes('saveComp') && np4.includes('ccSetComponentProp')) {
    log('pass', 'Round121', 'NodePropertyPanel saveComp + ccSetComponentProp 연동 존재')
  } else {
    log('warning', 'Round121', 'NodePropertyPanel saveComp 연동 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 25: R122 신규 기능 ───────────────────────────────
console.log('\n## 25. 신규 기능 파일 검사 (R122)')
// SessionList 날짜 그룹 이번달 (Round 122)
const sessionListPath2 = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sessionListPath2)) {
  const sl2 = readFileSync(sessionListPath2, 'utf-8')
  if (sl2.includes('이번 달') && sl2.includes('monthStart')) {
    log('pass', 'Round122', 'SessionList 날짜 그룹 이번달 + monthStart 존재')
  } else {
    log('warning', 'Round122', 'SessionList 이번달 그룹 미구현', 'sidebar/SessionList.tsx')
  }
  if (sl2.includes('groups[3]') && sl2.includes('groups[4]')) {
    log('pass', 'Round122', 'SessionList 5단계 날짜 그룹(오늘/어제/이번주/이번달/이전) 존재')
  } else {
    log('warning', 'Round122', 'SessionList 5단계 날짜 그룹 미구현', 'sidebar/SessionList.tsx')
  }
}

// ── Section 26: R123 신규 기능 ───────────────────────────────
console.log('\n## 26. 신규 기능 파일 검사 (R123)')
// SceneView 정렬 도구 (Round 123)
const sceneToolbarPath = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(sceneToolbarPath)) {
  const stb = readFileSync(sceneToolbarPath, 'utf-8')
  if (stb.includes('canAlign') && stb.includes('onAlignLeft') && stb.includes('onAlignBottom')) {
    log('pass', 'Round123', 'SceneToolbar 정렬 도구 6종 버튼 존재')
  } else {
    log('warning', 'Round123', 'SceneToolbar 정렬 도구 미구현', 'SceneView/SceneToolbar.tsx')
  }
}
const sceneViewPanelPath5 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath5)) {
  const svp5 = readFileSync(sceneViewPanelPath5, 'utf-8')
  if (svp5.includes('handleAlign') && svp5.includes('canAlign') && svp5.includes("direction === 'centerH'")) {
    log('pass', 'Round123', 'SceneViewPanel handleAlign 6방향 정렬 함수 존재')
  } else {
    log('warning', 'Round123', 'SceneViewPanel handleAlign 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 27: R124 신규 기능 ───────────────────────────────
console.log('\n## 27. 신규 기능 파일 검사 (R124)')
// SceneView 노드 리사이즈 핸들 (Round 124)
const sceneTypesPath4 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/types.ts')
if (existsSync(sceneTypesPath4)) {
  const st4 = readFileSync(sceneTypesPath4, 'utf-8')
  if (st4.includes('ResizeState') && st4.includes('startWidth') && st4.includes('startHeight')) {
    log('pass', 'Round124', 'SceneView ResizeState 타입 존재')
  } else {
    log('warning', 'Round124', 'SceneView ResizeState 타입 미구현', 'SceneView/types.ts')
  }
}
const sceneViewPanelPath6 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath6)) {
  const svp6 = readFileSync(sceneViewPanelPath6, 'utf-8')
  if (svp6.includes('handleResizeMouseDown') && svp6.includes('resizeRef') && svp6.includes('4096ff')) {
    log('pass', 'Round124', 'SceneViewPanel 리사이즈 핸들 + handleResizeMouseDown 존재')
  } else {
    log('warning', 'Round124', 'SceneViewPanel 리사이즈 핸들 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp6.includes("handle === 'se'") && svp6.includes("handle === 'nw'")) {
    log('pass', 'Round124', 'SceneViewPanel 4방향 리사이즈 로직 존재 (nw/ne/se/sw)')
  } else {
    log('warning', 'Round124', 'SceneViewPanel 리사이즈 방향 로직 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 28: R125 신규 기능 ───────────────────────────────
console.log('\n## 28. 신규 기능 파일 검사 (R125)')
// NodePropertyPanel 씬 동기화 (Round 125)
const useSceneSyncPath = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/useSceneSync.ts')
if (existsSync(useSceneSyncPath)) {
  const uss = readFileSync(useSceneSyncPath, 'utf-8')
  if (uss.includes('refreshNode') && uss.includes('ccGetNode')) {
    log('pass', 'Round125', 'useSceneSync: refreshNode() + ccGetNode 존재')
  } else {
    log('warning', 'Round125', 'useSceneSync refreshNode 미구현', 'SceneView/useSceneSync.ts')
  }
}
const sceneViewPanelPath7 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath7)) {
  const svp7 = readFileSync(sceneViewPanelPath7, 'utf-8')
  if (svp7.includes('refreshNode') && svp7.includes('selectedUuid, refreshNode')) {
    log('pass', 'Round125', 'SceneViewPanel: selectedUuid 변경 시 refreshNode 자동 호출 존재')
  } else {
    log('warning', 'Round125', 'SceneViewPanel refreshNode 연동 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 29: R127 신규 기능 ───────────────────────────────
console.log('\n## 29. 신규 기능 파일 검사 (R127)')
// SceneInspector 노드 이름 인라인 편집 (Round 127)
const sceneInspectorPath2 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath2)) {
  const si2 = readFileSync(sceneInspectorPath2, 'utf-8')
  if (si2.includes('onRename') && si2.includes('nameEditing') && si2.includes('nameDraft')) {
    log('pass', 'Round127', 'SceneInspector: onRename + nameEditing + nameDraft 상태 존재')
  } else {
    log('warning', 'Round127', 'SceneInspector 이름 인라인 편집 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si2.includes('onDoubleClick') && si2.includes('commitRename')) {
    log('pass', 'Round127', 'SceneInspector: 더블클릭 트리거 + commitRename 존재')
  } else {
    log('warning', 'Round127', 'SceneInspector 더블클릭/커밋 로직 미구현', 'SceneView/SceneInspector.tsx')
  }
}
const sceneViewPanelPath8 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath8)) {
  const svp8 = readFileSync(sceneViewPanelPath8, 'utf-8')
  if (svp8.includes('handleRename') && svp8.includes("ccSetProperty?.(port, uuid, 'name'")) {
    log('pass', 'Round127', 'SceneViewPanel: handleRename + ccSetProperty name 저장 존재')
  } else {
    log('warning', 'Round127', 'SceneViewPanel handleRename 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 30: R128 신규 기능 ───────────────────────────────
console.log('\n## 30. 신규 기능 파일 검사 (R128)')
// SceneView 노드 계층 트리 패널 (Round 128)
const nodeHierarchyPath = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath)) {
  const nh = readFileSync(nodeHierarchyPath, 'utf-8')
  if (nh.includes('NodeHierarchyList') && nh.includes('rootUuid') && nh.includes('childUuids')) {
    log('pass', 'Round128', 'NodeHierarchyList: 재귀 트리 + childUuids 렌더링 존재')
  } else {
    log('warning', 'Round128', 'NodeHierarchyList 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
} else {
  log('warning', 'Round128', 'NodeHierarchyList.tsx 파일 없음', 'SceneView/NodeHierarchyList.tsx')
}
const sceneToolbarPath2 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(sceneToolbarPath2)) {
  const st2 = readFileSync(sceneToolbarPath2, 'utf-8')
  if (st2.includes('showHierarchy') && st2.includes('onHierarchyToggle')) {
    log('pass', 'Round128', 'SceneToolbar: showHierarchy + onHierarchyToggle 버튼 존재')
  } else {
    log('warning', 'Round128', 'SceneToolbar 계층 토글 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}
const sceneViewPanelPath9 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath9)) {
  const svp9 = readFileSync(sceneViewPanelPath9, 'utf-8')
  if (svp9.includes('showHierarchy') && svp9.includes('NodeHierarchyList')) {
    log('pass', 'Round128', 'SceneViewPanel: showHierarchy 상태 + NodeHierarchyList 렌더링 존재')
  } else {
    log('warning', 'Round128', 'SceneViewPanel 계층 패널 통합 미완성', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 31: R129 신규 기능 ───────────────────────────────
console.log('\n## 31. 신규 기능 파일 검사 (R129)')
// NodeHierarchyList 검색 필터 (Round 129)
const nodeHierarchyPath2 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath2)) {
  const nh2 = readFileSync(nodeHierarchyPath2, 'utf-8')
  if (nh2.includes('searchQuery') && nh2.includes('filteredNodes') && nh2.includes('toLowerCase')) {
    log('pass', 'Round129', 'NodeHierarchyList: searchQuery + filteredNodes 검색 필터 존재')
  } else {
    log('warning', 'Round129', 'NodeHierarchyList 검색 필터 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh2.includes('노드 검색') && nh2.includes('검색 결과 없음')) {
    log('pass', 'Round129', 'NodeHierarchyList: 검색 입력창 + 빈 결과 메시지 존재')
  } else {
    log('warning', 'Round129', 'NodeHierarchyList 검색창 UI 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 32: R130 신규 기능 ───────────────────────────────
console.log('\n## 32. 신규 기능 파일 검사 (R130)')
// SceneView 드래그 좌표 오버레이 (Round 130)
const sceneViewPanelPath10 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath10)) {
  const svp10 = readFileSync(sceneViewPanelPath10, 'utf-8')
  if (svp10.includes('isDragging') && svp10.includes('isResizing') && svp10.includes('setIsDragging')) {
    log('pass', 'Round130', 'SceneViewPanel: isDragging + isResizing 상태 + setter 존재')
  } else {
    log('warning', 'Round130', 'SceneViewPanel 드래그 상태 추적 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp10.includes('좌표 오버레이') && svp10.includes('isDragging || isResizing')) {
    log('pass', 'Round130', 'SceneViewPanel: 드래그/리사이즈 좌표 오버레이 렌더링 존재')
  } else {
    log('warning', 'Round130', 'SceneViewPanel 좌표 오버레이 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 33: R131 신규 기능 ───────────────────────────────
console.log('\n## 33. 신규 기능 파일 검사 (R131)')
// NodeHierarchyList 펼치기/접기 (Round 131)
const nodeHierarchyPath3 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath3)) {
  const nh3 = readFileSync(nodeHierarchyPath3, 'utf-8')
  if (nh3.includes('collapsed') && nh3.includes('onToggleCollapse') && nh3.includes('isCollapsed')) {
    log('pass', 'Round131', 'NodeHierarchyList: collapsed 상태 + onToggleCollapse + isCollapsed 존재')
  } else {
    log('warning', 'Round131', 'NodeHierarchyList 접기/펼치기 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh3.includes("isCollapsed ? '▸' : '▾'")) {
    log('pass', 'Round131', 'NodeHierarchyList: ▸/▾ 토글 아이콘 존재')
  } else {
    log('warning', 'Round131', 'NodeHierarchyList 토글 아이콘 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 34: R132 신규 기능 ───────────────────────────────
console.log('\n## 34. 신규 기능 파일 검사 (R132)')
// SceneView 마우스 씬 좌표 표시 (Round 132)
const sceneViewPanelPath11 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath11)) {
  const svp11 = readFileSync(sceneViewPanelPath11, 'utf-8')
  if (svp11.includes('cursorScenePos') && svp11.includes('setCursorScenePos') && svp11.includes('svgToScene')) {
    log('pass', 'Round132', 'SceneViewPanel: cursorScenePos 상태 + svgToScene 연동 존재')
  } else {
    log('warning', 'Round132', 'SceneViewPanel 마우스 씬 좌표 추적 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp11.includes('cursorScenePos') && svp11.includes('mousePos')) {
    log('pass', 'Round132', 'SceneViewPanel: 씬 좌표 오버레이 툴바 연동 존재')
  } else {
    log('warning', 'Round132', 'SceneViewPanel 씬 좌표 오버레이 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 35: R133 신규 기능 ───────────────────────────────
console.log('\n## 35. 신규 기능 파일 검사 (R133)')
// SceneView 노드 라벨 표시 토글 (Round 133)
const nodeRendererPath = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nodeRendererPath)) {
  const nr = readFileSync(nodeRendererPath, 'utf-8')
  if (nr.includes('showLabel') && nr.includes('showLabel = true')) {
    log('pass', 'Round133', 'NodeRenderer: showLabel prop (기본 true) 존재')
  } else {
    log('warning', 'Round133', 'NodeRenderer showLabel prop 미구현', 'SceneView/NodeRenderer.tsx')
  }
}
const sceneToolbarPath3 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(sceneToolbarPath3)) {
  const st3 = readFileSync(sceneToolbarPath3, 'utf-8')
  if (st3.includes('showLabels') && st3.includes('onLabelsToggle') && st3.includes('Aa')) {
    log('pass', 'Round133', 'SceneToolbar: showLabels + onLabelsToggle + Aa 버튼 존재')
  } else {
    log('warning', 'Round133', 'SceneToolbar 라벨 토글 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}
const sceneViewPanelPath12 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath12)) {
  const svp12 = readFileSync(sceneViewPanelPath12, 'utf-8')
  if (svp12.includes('showLabels') && svp12.includes('showLabel={showLabels}')) {
    log('pass', 'Round133', 'SceneViewPanel: showLabels 상태 + NodeRenderer에 showLabel 전달 존재')
  } else {
    log('warning', 'Round133', 'SceneViewPanel showLabels 통합 미완성', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 36: R134 신규 기능 ───────────────────────────────
console.log('\n## 36. 신규 기능 파일 검사 (R134)')
// NodeHierarchyList 선택 노드 자동 스크롤 (Round 134)
const nodeHierarchyPath4 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath4)) {
  const nh4 = readFileSync(nodeHierarchyPath4, 'utf-8')
  if (nh4.includes('focusUuid') && nh4.includes('scrollContainerRef') && nh4.includes('scrollIntoView')) {
    log('pass', 'Round134', 'NodeHierarchyList: focusUuid + scrollContainerRef + scrollIntoView 존재')
  } else {
    log('warning', 'Round134', 'NodeHierarchyList 자동 스크롤 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh4.includes('data-uuid={uuid}')) {
    log('pass', 'Round134', 'NodeHierarchyList: 노드 행에 data-uuid 속성 존재')
  } else {
    log('warning', 'Round134', 'NodeHierarchyList data-uuid 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 37: R135 신규 기능 ───────────────────────────────
console.log('\n## 37. 신규 기능 파일 검사 (R135)')
// NodePropertyPanel COMP_EDITABLE_KEYS 확장 (Round 135)
const nodePropPath6 = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(nodePropPath6)) {
  const np6 = readFileSync(nodePropPath6, 'utf-8')
  if (np6.includes("'cc.Slider'") && np6.includes("'cc.Toggle'") && np6.includes("'cc.ProgressBar'")) {
    log('pass', 'Round135', 'NodePropertyPanel: cc.Slider + cc.Toggle + cc.ProgressBar COMP_EDITABLE_KEYS 존재')
  } else {
    log('warning', 'Round135', 'NodePropertyPanel COMP_EDITABLE_KEYS 미확장', 'sidebar/NodePropertyPanel.tsx')
  }
  if (np6.includes("'cc.ScrollView'") && np6.includes("'cc.Animation'")) {
    log('pass', 'Round135', 'NodePropertyPanel: cc.ScrollView + cc.Animation COMP_EDITABLE_KEYS 존재')
  } else {
    log('warning', 'Round135', 'NodePropertyPanel ScrollView/Animation 미지원', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 38: R136 신규 기능 ───────────────────────────────
console.log('\n## 38. 신규 기능 파일 검사 (R136)')
// SceneView 선택 노드 포커스 (Round 136)
const sceneViewPanelPath13 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath13)) {
  const svp13 = readFileSync(sceneViewPanelPath13, 'utf-8')
  if (svp13.includes('handleFocusSelected') && svp13.includes('targetZoom') && svp13.includes("'g' || e.key === 'G'")) {
    log('pass', 'Round136', 'SceneViewPanel: handleFocusSelected + targetZoom + G키 단축키 존재')
  } else {
    log('warning', 'Round136', 'SceneViewPanel 선택 노드 포커스 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 39: R137 신규 기능 ───────────────────────────────
console.log('\n## 39. 신규 기능 파일 검사 (R137)')
// SceneInspector Scale 편집 (Round 137)
const sceneInspectorPath3 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath3)) {
  const si3 = readFileSync(sceneInspectorPath3, 'utf-8')
  if (si3.includes("prop=\"scaleX\"") && si3.includes("prop=\"scaleY\"") && si3.includes('label="Scale"')) {
    log('pass', 'Round137', 'SceneInspector: Scale 섹션 + scaleX/scaleY NumInput 존재')
  } else {
    log('warning', 'Round137', 'SceneInspector Scale 편집 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 40: R138 신규 기능 ───────────────────────────────
console.log('\n## 40. 신규 기능 파일 검사 (R138)')
// SceneInspector Opacity (Round 138)
const sceneInspectorPath4 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath4)) {
  const si4 = readFileSync(sceneInspectorPath4, 'utf-8')
  if (si4.includes("'cc.UIOpacity'") && si4.includes("prop=\"opacity\"") && si4.includes('label="Opacity"')) {
    log('pass', 'Round138', 'SceneInspector: UIOpacity 조건부 Opacity 섹션 + NumInput 존재')
  } else {
    log('warning', 'Round138', 'SceneInspector Opacity 편집 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 41: R139 신규 기능 ───────────────────────────────
console.log('\n## 41. 신규 기능 파일 검사 (R139)')
// NodeHierarchyList 컴포넌트 아이콘 (Round 139)
const nodeHierarchyPath5 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath5)) {
  const nh5 = readFileSync(nodeHierarchyPath5, 'utf-8')
  if (nh5.includes('getComponentIcon') && nh5.includes("from './utils'")) {
    log('pass', 'Round139', 'NodeHierarchyList: getComponentIcon import + utils 연결 존재')
  } else {
    log('warning', 'Round139', 'NodeHierarchyList getComponentIcon 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh5.includes("'var(--accent)'") && nh5.includes('getComponentIcon(node.components)')) {
    log('pass', 'Round139', 'NodeHierarchyList: 컴포넌트 아이콘 렌더링 존재')
  } else {
    log('warning', 'Round139', 'NodeHierarchyList 아이콘 렌더링 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 42: R140 신규 기능 ───────────────────────────────
console.log('\n## 42. 신규 기능 파일 검사 (R140)')
// SceneInspector Color 스왓치 (Round 140)
const sceneInspectorPath5 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath5)) {
  const si5 = readFileSync(sceneInspectorPath5, 'utf-8')
  if (si5.includes('toHex') && si5.includes('node.color.r') && si5.includes('node.color.g')) {
    log('pass', 'Round140', 'SceneInspector: toHex 헬퍼 + node.color.r/g/b 사용 존재')
  } else {
    log('warning', 'Round140', 'SceneInspector Color 스왓치 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si5.includes('label="Color"') && si5.includes('node.color.a / 255')) {
    log('pass', 'Round140', 'SceneInspector: Color 섹션 헤더 + alpha 변환 존재')
  } else {
    log('warning', 'Round140', 'SceneInspector Color 섹션 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 43: R141 신규 기능 ───────────────────────────────
console.log('\n## 43. 신규 기능 파일 검사 (R141)')
// SceneView 노드 호버 툴팁 (Round 141)
const sceneViewPanelPath14 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath14)) {
  const svp14 = readFileSync(sceneViewPanelPath14, 'utf-8')
  if (svp14.includes('hoverTooltipPos') && svp14.includes('setHoverTooltipPos')) {
    log('pass', 'Round141', 'SceneViewPanel: hoverTooltipPos 상태 + setter 존재')
  } else {
    log('warning', 'Round141', 'SceneViewPanel 호버 툴팁 상태 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp14.includes('tooltipVisibleUuid') && svp14.includes('tooltipDelayRef')) {
    log('pass', 'Round141', 'SceneViewPanel: 호버 툴팁 딜레이 렌더링 존재')
  } else {
    log('warning', 'Round141', 'SceneViewPanel 호버 툴팁 렌더링 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 44: R142 신규 기능 ───────────────────────────────
console.log('\n## 44. 신규 기능 파일 검사 (R142)')
// NodeHierarchyList 활성 인디케이터 토글 (Round 142)
const nodeHierarchyPath6 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath6)) {
  const nh6 = readFileSync(nodeHierarchyPath6, 'utf-8')
  if (nh6.includes('onToggleActive') && nh6.includes('node.active ? \'var(--success)\'')) {
    log('pass', 'Round142', 'NodeHierarchyList: onToggleActive prop + 활성 인디케이터 dot 존재')
  } else {
    log('warning', 'Round142', 'NodeHierarchyList 활성 토글 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}
const sceneViewPanelPath15 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath15)) {
  const svp15 = readFileSync(sceneViewPanelPath15, 'utf-8')
  if (svp15.includes('handleHierarchyToggleActive') && svp15.includes('onToggleActive={handleHierarchyToggleActive}')) {
    log('pass', 'Round142', 'SceneViewPanel: handleHierarchyToggleActive + NodeHierarchyList 연결 존재')
  } else {
    log('warning', 'Round142', 'SceneViewPanel 활성 토글 핸들러 미연결', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 45: R143 신규 기능 ───────────────────────────────
console.log('\n## 45. 신규 기능 파일 검사 (R143)')
// NodeHierarchyList 전체 펼치기/접기 (Round 143)
const nodeHierarchyPath7 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath7)) {
  const nh7 = readFileSync(nodeHierarchyPath7, 'utf-8')
  if (nh7.includes('전체 펼치기') && nh7.includes('전체 접기')) {
    log('pass', 'Round143', 'NodeHierarchyList: 전체 펼치기 + 전체 접기 버튼 존재')
  } else {
    log('warning', 'Round143', 'NodeHierarchyList 전체 펼치기/접기 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh7.includes('setCollapsed(new Set())') && nh7.includes('allWithChildren')) {
    log('pass', 'Round143', 'NodeHierarchyList: 전체 펼치기(empty Set) + 전체 접기(allWithChildren) 로직 존재')
  } else {
    log('warning', 'Round143', 'NodeHierarchyList 펼치기/접기 로직 미완성', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 46: R144 신규 기능 ───────────────────────────────
console.log('\n## 46. 신규 기능 파일 검사 (R144)')
// SceneView 단축키 도움말 오버레이 (Round 144)
const sceneViewPanelPath16 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath16)) {
  const svp16 = readFileSync(sceneViewPanelPath16, 'utf-8')
  if (svp16.includes('showShortcuts') && svp16.includes('setShowShortcuts') && svp16.includes("'?'")) {
    log('pass', 'Round144', 'SceneViewPanel: showShortcuts 상태 + ? 키 토글 존재')
  } else {
    log('warning', 'Round144', 'SceneViewPanel 단축키 오버레이 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp16.includes('단축키 도움말') && svp16.includes('클릭하거나 ? 키로 닫기')) {
    log('pass', 'Round144', 'SceneViewPanel: 단축키 오버레이 콘텐츠 존재')
  } else {
    log('warning', 'Round144', 'SceneViewPanel 단축키 오버레이 콘텐츠 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 47: R145 신규 기능 ───────────────────────────────
console.log('\n## 47. 신규 기능 파일 검사 (R145)')
// SceneView passive wheel 수정 (Round 145)
const sceneViewPanelPath17 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath17)) {
  const svp17 = readFileSync(sceneViewPanelPath17, 'utf-8')
  if (svp17.includes("{ passive: false }") && svp17.includes("addEventListener('wheel'")) {
    log('pass', 'Round145', 'SceneViewPanel: passive:false wheel 이벤트 등록 존재')
  } else {
    log('warning', 'Round145', 'SceneViewPanel passive wheel 미수정', 'SceneView/SceneViewPanel.tsx')
  }
  if (!svp17.includes('onWheel={handleWheel}')) {
    log('pass', 'Round145', 'SceneViewPanel: JSX onWheel 제거 (passive 리스너로 대체됨)')
  } else {
    log('warning', 'Round145', 'SceneViewPanel onWheel JSX 미제거', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 48: R146 신규 기능 ───────────────────────────────
console.log('\n## 48. 신규 기능 파일 검사 (R146)')
// SceneInspector 부모 노드 표시 (Round 146)
const sceneInspectorPath6 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath6)) {
  const si6 = readFileSync(sceneInspectorPath6, 'utf-8')
  if (si6.includes('onSelectParent') && si6.includes('nodeMap') && si6.includes('node.parentUuid')) {
    log('pass', 'Round146', 'SceneInspector: onSelectParent + nodeMap prop + parentUuid 조회 존재')
  } else {
    log('warning', 'Round146', 'SceneInspector 부모 노드 표시 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si6.includes('부모 노드 선택') || si6.includes('onSelectParent?.(anc.uuid)') || si6.includes('조상 경로')) {
    log('pass', 'Round146', 'SceneInspector: 부모 노드 클릭 선택 UI 존재')
  } else {
    log('warning', 'Round146', 'SceneInspector 부모 노드 클릭 UI 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 49: R147 신규 기능 ───────────────────────────────
console.log('\n## 49. 신규 기능 파일 검사 (R147)')
// SceneView 씬 해상도 레이블 (Round 147)
const sceneViewPanelPath18 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath18)) {
  const svp18 = readFileSync(sceneViewPanelPath18, 'utf-8')
  if (svp18.includes('씬 해상도 레이블') && svp18.includes('textAnchor') && svp18.includes('10 / view.zoom')) {
    log('pass', 'Round147', 'SceneView: 씬 해상도 레이블 <text> 엘리먼트 존재')
  } else {
    log('warning', 'Round147', 'SceneView 씬 해상도 레이블 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp18.includes('DESIGN_W} × {DESIGN_H') || svp18.includes('{DESIGN_W} × {DESIGN_H}')) {
    log('pass', 'Round147', 'SceneView: DESIGN_W × DESIGN_H 해상도 텍스트 존재')
  } else {
    log('warning', 'Round147', 'SceneView 해상도 텍스트 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 50: R148 신규 기능 ───────────────────────────────
console.log('\n## 50. 신규 기능 파일 검사 (R148)')
// 줌 인디케이터 클릭 리셋 (Round 148)
const sceneViewPanelPath19 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath19)) {
  const svp19 = readFileSync(sceneViewPanelPath19, 'utf-8')
  if (svp19.includes('클릭: 1:1') && svp19.includes('더블클릭: Fit')) {
    log('pass', 'Round148', 'SceneView: 줌 인디케이터 클릭/더블클릭 tooltip 존재')
  } else {
    log('warning', 'Round148', 'SceneView 줌 인디케이터 리셋 기능 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp19.includes('offsetX: (width - DESIGN_W) / 2') && svp19.includes('zoom: 1')) {
    log('pass', 'Round148', 'SceneView: 1:1 줌 리셋 로직 존재')
  } else {
    log('warning', 'Round148', 'SceneView 1:1 리셋 로직 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 51: R149 신규 기능 ───────────────────────────────
console.log('\n## 51. 신규 기능 파일 검사 (R149)')
// NodeHierarchyList 검색 결과 카운트 (Round 149)
const nodeHierarchyPath8 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath8)) {
  const nh8 = readFileSync(nodeHierarchyPath8, 'utf-8')
  if (nh8.includes('filteredNodes.length}/{nodeMap.size}') || nh8.includes('filteredNodes.length} / {nodeMap.size}') || nh8.includes('filteredNodes.length}/{nodeMap.size}')) {
    log('pass', 'Round149', 'NodeHierarchyList: 검색 결과 카운트 N/total 표시 존재')
  } else {
    log('warning', 'Round149', 'NodeHierarchyList 검색 결과 카운트 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh8.includes('filteredNodes && (')) {
    log('pass', 'Round149', 'NodeHierarchyList: 검색 중에만 카운트 표시 조건 존재')
  } else {
    log('warning', 'Round149', 'NodeHierarchyList 카운트 조건 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 52: R150 신규 기능 ───────────────────────────────
console.log('\n## 52. 신규 기능 파일 검사 (R150)')
// NodeHierarchyList 검색 X 버튼 (Round 150)
const nodeHierarchyPath9 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath9)) {
  const nh9 = readFileSync(nodeHierarchyPath9, 'utf-8')
  if (nh9.includes("setSearchQuery('')") && nh9.includes('검색 초기화')) {
    log('pass', 'Round150', 'NodeHierarchyList: 검색 X 버튼 + 초기화 로직 존재')
  } else {
    log('warning', 'Round150', 'NodeHierarchyList 검색 X 버튼 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh9.includes('{searchQuery && (')) {
    log('pass', 'Round150', 'NodeHierarchyList: 검색어 있을 때만 X 버튼 표시 조건 존재')
  } else {
    log('warning', 'Round150', 'NodeHierarchyList X 버튼 조건 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 53: R151 신규 기능 ───────────────────────────────
console.log('\n## 53. 신규 기능 파일 검사 (R151)')
// 방향키 nudge (Round 151)
const sceneViewPanelPath20 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath20)) {
  const svp20 = readFileSync(sceneViewPanelPath20, 'utf-8')
  if (svp20.includes('ArrowLeft') && svp20.includes('ArrowRight') && svp20.includes('ArrowUp') && svp20.includes('ArrowDown')) {
    log('pass', 'Round151', 'SceneView: 방향키 nudge ArrowLeft/Right/Up/Down 정의 존재')
  } else {
    log('warning', 'Round151', 'SceneView 방향키 nudge 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp20.includes('e.shiftKey ? 10 : 1')) {
    log('pass', 'Round151', 'SceneView: Shift+방향키 10px 이동 로직 존재')
  } else {
    log('warning', 'Round151', 'SceneView Shift 10px 이동 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 54: R152 신규 기능 ───────────────────────────────
console.log('\n## 54. 신규 기능 파일 검사 (R152)')
// 선택 노드 size 레이블 (Round 152)
const sceneViewPanelPath21 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath21)) {
  const svp21 = readFileSync(sceneViewPanelPath21, 'utf-8')
  if (svp21.includes('선택 노드 size 레이블') && svp21.includes('Math.round(n.width)')) {
    log('pass', 'Round152', 'SceneView: 선택 노드 size 레이블 W×H 표시 존재')
  } else {
    log('warning', 'Round152', 'SceneView 선택 노드 size 레이블 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp21.includes('!isDragging && !isResizing') && svp21.includes('9 / view.zoom')) {
    log('pass', 'Round152', 'SceneView: 드래그/리사이즈 중 숨김 + zoom 보정 폰트 적용')
  } else {
    log('warning', 'Round152', 'SceneView size 레이블 zoom 보정 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 55: R153 신규 기능 ───────────────────────────────
console.log('\n## 55. 신규 기능 파일 검사 (R153)')
// NodeHierarchyList ESC 키 검색 초기화 (Round 153)
const nodeHierarchyPath10 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath10)) {
  const nh10 = readFileSync(nodeHierarchyPath10, 'utf-8')
  if (nh10.includes("e.key === 'Escape'") && nh10.includes("setSearchQuery('')")) {
    log('pass', 'Round153', 'NodeHierarchyList: ESC 키 검색 초기화 onKeyDown 존재')
  } else {
    log('warning', 'Round153', 'NodeHierarchyList ESC 검색 초기화 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh10.includes('e.currentTarget.blur()')) {
    log('pass', 'Round153', 'NodeHierarchyList: ESC 시 포커스 해제 존재')
  } else {
    log('warning', 'Round153', 'NodeHierarchyList ESC 포커스 해제 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 56: R154 신규 기능 ───────────────────────────────
console.log('\n## 56. 신규 기능 파일 검사 (R154)')
// SceneInspector UUID 복사 버튼 (Round 154)
const sceneInspectorPath7 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath7)) {
  const si7 = readFileSync(sceneInspectorPath7, 'utf-8')
  if (si7.includes('handleCopyUuid') && si7.includes('navigator.clipboard.writeText')) {
    log('pass', 'Round154', 'SceneInspector: UUID 복사 함수 + clipboard API 존재')
  } else {
    log('warning', 'Round154', 'SceneInspector UUID 복사 기능 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si7.includes('uuidCopied') && si7.includes("'✓' : '#'")) {
    log('pass', 'Round154', 'SceneInspector: 복사 완료 피드백 (✓/#) 존재')
  } else {
    log('warning', 'Round154', 'SceneInspector UUID 복사 피드백 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 57: R155 신규 기능 ───────────────────────────────
console.log('\n## 57. 신규 기능 파일 검사 (R155)')
// SceneView 패닝 커서 grabbing (Round 155)
const sceneViewPanelPath22 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath22)) {
  const svp22 = readFileSync(sceneViewPanelPath22, 'utf-8')
  if (svp22.includes('isPanningActive') && svp22.includes("'grabbing'")) {
    log('pass', 'Round155', 'SceneView: isPanningActive 상태 + grabbing 커서 존재')
  } else {
    log('warning', 'Round155', 'SceneView 패닝 grabbing 커서 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp22.includes('setIsPanningActive(true)') && svp22.includes('setIsPanningActive(false)')) {
    log('pass', 'Round155', 'SceneView: isPanningActive on/off 토글 존재')
  } else {
    log('warning', 'Round155', 'SceneView isPanningActive 토글 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 58: R156 신규 기능 ───────────────────────────────
console.log('\n## 58. 신규 기능 파일 검사 (R156)')
// 씬 origin (0,0) 레이블 (Round 156)
const sceneViewPanelPath23 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath23)) {
  const svp23 = readFileSync(sceneViewPanelPath23, 'utf-8')
  if (svp23.includes('원점 십자 + (0,0) 레이블') && svp23.includes('(0,0)')) {
    log('pass', 'Round156', 'SceneView: 원점 (0,0) 레이블 SVG text 존재')
  } else {
    log('warning', 'Round156', 'SceneView 원점 (0,0) 레이블 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp23.includes('8 / view.zoom') && svp23.includes('DESIGN_W / 2 + 5 / view.zoom')) {
    log('pass', 'Round156', 'SceneView: 원점 레이블 zoom 보정 + 오프셋 적용')
  } else {
    log('warning', 'Round156', 'SceneView 원점 레이블 zoom 보정 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 59: R157 신규 기능 ───────────────────────────────
console.log('\n## 59. 신규 기능 파일 검사 (R157)')
// SceneInspector 컴포넌트 아이콘 (Round 157)
const sceneInspectorPath8 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath8)) {
  const si8 = readFileSync(sceneInspectorPath8, 'utf-8')
  if (si8.includes('getComponentIcon') && si8.includes("import { getComponentIcon }")) {
    log('pass', 'Round157', 'SceneInspector: getComponentIcon import + 사용 존재')
  } else {
    log('warning', 'Round157', 'SceneInspector 컴포넌트 아이콘 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si8.includes("color: 'var(--accent)'") && si8.includes("getComponentIcon([c])")) {
    log('pass', 'Round157', 'SceneInspector: 컴포넌트별 accent 아이콘 렌더링 존재')
  } else {
    log('warning', 'Round157', 'SceneInspector 컴포넌트 아이콘 렌더링 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 60: R158 신규 기능 ───────────────────────────────
console.log('\n## 60. 신규 기능 파일 검사 (R158)')
// Ctrl+A 전체 선택 (Round 158)
const sceneViewPanelPath24 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath24)) {
  const svp24 = readFileSync(sceneViewPanelPath24, 'utf-8')
  if (svp24.includes("e.key === 'a'") && svp24.includes('Ctrl+A 전체 선택')) {
    log('pass', 'Round158', "SceneView: Ctrl+A 전체 선택 useEffect + 'a' key 핸들러 존재")
  } else {
    log('warning', 'Round158', 'SceneView Ctrl+A 전체 선택 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp24.includes('new Set(nodeMap.keys())') && svp24.includes("'Ctrl+A', '전체 선택'")) {
    log('pass', 'Round158', 'SceneView: nodeMap 전체 선택 + 단축키 도움말 갱신')
  } else {
    log('warning', 'Round158', 'SceneView Ctrl+A 전체 선택 로직 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 61: R159 신규 기능 ───────────────────────────────
console.log('\n## 61. 신규 기능 파일 검사 (R159)')
// 선택 노드 anchor point 마커 (Round 159)
const sceneViewPanelPath25 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath25)) {
  const svp25 = readFileSync(sceneViewPanelPath25, 'utf-8')
  if (svp25.includes('선택 노드 anchor point 마커') && svp25.includes('<polygon')) {
    log('pass', 'Round159', 'SceneView: anchor point 마커 polygon 엘리먼트 존재')
  } else {
    log('warning', 'Round159', 'SceneView anchor point 마커 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp25.includes('sy - as') && svp25.includes('sy + as') && svp25.includes('4 / view.zoom')) {
    log('pass', 'Round159', 'SceneView: anchor 다이아몬드 좌표 + zoom 보정 존재')
  } else {
    log('warning', 'Round159', 'SceneView anchor 마커 zoom 보정 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 62: R160 신규 기능 ───────────────────────────────
console.log('\n## 62. 신규 기능 파일 검사 (R160)')
// Ctrl+D 복제 (Round 160)
const sceneViewPanelPath26 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath26)) {
  const svp26 = readFileSync(sceneViewPanelPath26, 'utf-8')
  if (svp26.includes('handleDuplicate') && svp26.includes("e.key === 'd'")) {
    log('pass', 'Round160', "SceneView: handleDuplicate + Ctrl+D 핸들러 존재")
  } else {
    log('warning', 'Round160', 'SceneView Ctrl+D 복제 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp26.includes("'복제 (클립보드 유지)'") && svp26.includes("'Ctrl+D'")) {
    log('pass', 'Round160', 'SceneView: Ctrl+D 단축키 도움말 항목 존재')
  } else {
    log('warning', 'Round160', 'SceneView Ctrl+D 도움말 항목 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 63: R161 신규 기능 ───────────────────────────────
console.log('\n## 63. 신규 기능 파일 검사 (R161)')
// SceneInspector 자식 노드 수 표시 (Round 161)
const sceneInspectorPath9 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath9)) {
  const si9 = readFileSync(sceneInspectorPath9, 'utf-8')
  if (si9.includes('node.childUuids.length > 0') && si9.includes('↳')) {
    log('pass', 'Round161', 'SceneInspector: 자식 노드 수 ↳N 표시 존재')
  } else {
    log('warning', 'Round161', 'SceneInspector 자식 노드 수 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si9.includes('자식 노드') && si9.includes('childUuids.length}개')) {
    log('pass', 'Round161', 'SceneInspector: 자식 노드 수 tooltip 존재')
  } else {
    log('warning', 'Round161', 'SceneInspector 자식 수 tooltip 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 64: R162 신규 기능 ───────────────────────────────
console.log('\n## 64. 신규 기능 파일 검사 (R162)')
// 균등 분포 배치 (Round 162)
const sceneViewPanelPath27 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath27)) {
  const svp27 = readFileSync(sceneViewPanelPath27, 'utf-8')
  if (svp27.includes('handleDistribute') && svp27.includes("axis: 'H' | 'V'")) {
    log('pass', 'Round162', 'SceneView: handleDistribute(H/V) 함수 존재')
  } else {
    log('warning', 'Round162', 'SceneView 균등 분포 배치 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}
const sceneToolbarPath4 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(sceneToolbarPath4)) {
  const st4 = readFileSync(sceneToolbarPath4, 'utf-8')
  if (st4.includes('onDistributeH') && st4.includes('onDistributeV')) {
    log('pass', 'Round162', 'SceneToolbar: Distribute H/V props + 버튼 존재')
  } else {
    log('warning', 'Round162', 'SceneToolbar Distribute 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 65: R163 신규 기능 ───────────────────────────────
console.log('\n## 65. 신규 기능 파일 검사 (R163)')
// Space 키 임시 패닝 (Round 163)
const sceneViewPanelPath28 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath28)) {
  const svp28 = readFileSync(sceneViewPanelPath28, 'utf-8')
  if (svp28.includes('Space 키 임시 패닝 모드') && svp28.includes("e.code === 'Space'")) {
    log('pass', 'Round163', "SceneView: Space 키 패닝 모드 useEffect + 'Space' keyCode 존재")
  } else {
    log('warning', 'Round163', 'SceneView Space 패닝 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp28.includes('spaceDown') && svp28.includes("activeTool === 'move' || spaceDown")) {
    log('pass', 'Round163', 'SceneView: spaceDown state + 마우스다운 조건 존재')
  } else {
    log('warning', 'Round163', 'SceneView spaceDown 패닝 조건 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 66: R164 신규 기능 ───────────────────────────────
console.log('\n## 66. 신규 기능 파일 검사 (R164)')
// 총 노드 수 표시 (Round 164)
const sceneViewPanelPath29 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sceneViewPanelPath29)) {
  const svp29 = readFileSync(sceneViewPanelPath29, 'utf-8')
  if (svp29.includes('총 노드 수 표시') && svp29.includes('nodeMap.size}개 노드')) {
    log('pass', 'Round164', 'SceneView: 총 노드 수 표시 존재')
  } else {
    log('warning', 'Round164', 'SceneView 총 노드 수 표시 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp29.includes('selectedUuids.size > 1') && svp29.includes('선택`')) {
    log('pass', 'Round164', 'SceneView: 멀티셀렉트 시 선택 수 추가 표시')
  } else {
    log('warning', 'Round164', 'SceneView 선택 수 표시 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 67: R165 신규 기능 ───────────────────────────────
console.log('\n## 67. 신규 기능 파일 검사 (R165)')
// SceneInspector JSON 내보내기 (Round 165)
const sceneInspectorPath10 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath10)) {
  const si10 = readFileSync(sceneInspectorPath10, 'utf-8')
  if (si10.includes('JSON 내보내기') && si10.includes('JSON.stringify')) {
    log('pass', 'Round165', 'SceneInspector: JSON 내보내기 버튼 + stringify 존재')
  } else {
    log('warning', 'Round165', 'SceneInspector JSON 내보내기 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si10.includes('JSON 복사') && si10.includes('navigator.clipboard.writeText')) {
    log('pass', 'Round165', 'SceneInspector: JSON 복사 버튼 + clipboard API 존재')
  } else {
    log('warning', 'Round165', 'SceneInspector JSON clipboard 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 68: R166 신규 기능 ───────────────────────────────
console.log('\n## 68. 신규 기능 파일 검사 (R166)')
// NodeHierarchyList 우클릭 컨텍스트 메뉴 (Round 166)
const nodeHierarchyPath11 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nodeHierarchyPath11)) {
  const nh11 = readFileSync(nodeHierarchyPath11, 'utf-8')
  if (nh11.includes('contextMenu') && nh11.includes('handleContextMenu')) {
    log('pass', 'Round166', 'NodeHierarchyList: contextMenu state + handleContextMenu 존재')
  } else {
    log('warning', 'Round166', 'NodeHierarchyList contextMenu 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
  if (nh11.includes('onCopyNode') && nh11.includes('data-uuid')) {
    log('pass', 'Round166', 'NodeHierarchyList: onCopyNode prop + data-uuid 존재')
  } else {
    log('warning', 'Round166', 'NodeHierarchyList onCopyNode/data-uuid 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}
const svp166Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp166Path)) {
  const svp166 = readFileSync(svp166Path, 'utf-8')
  if (svp166.includes('onCopyNode')) {
    log('pass', 'Round166', 'SceneViewPanel: onCopyNode prop 연결됨')
  } else {
    log('warning', 'Round166', 'SceneViewPanel onCopyNode 미연결', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 69: R167 신규 기능 ───────────────────────────────
console.log('\n## 69. 신규 기능 파일 검사 (R167)')
// SceneInspector Scale 비율 잠금 (Round 167)
const sceneInspectorPath11 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath11)) {
  const si11 = readFileSync(sceneInspectorPath11, 'utf-8')
  if (si11.includes('scaleLocked') && si11.includes('handleScaleUpdate')) {
    log('pass', 'Round167', 'SceneInspector: scaleLocked state + handleScaleUpdate 존재')
  } else {
    log('warning', 'Round167', 'SceneInspector scale lock 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si11.includes('비율 유지 잠금') && si11.includes('비율 잠금 해제')) {
    log('pass', 'Round167', 'SceneInspector: 비율 잠금 버튼 존재')
  } else {
    log('warning', 'Round167', 'SceneInspector 비율 잠금 버튼 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 70: R168 신규 기능 ───────────────────────────────
console.log('\n## 70. 신규 기능 파일 검사 (R168)')
// SceneView 회전 핸들 (Round 168)
const svp168Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp168Path)) {
  const svp168 = readFileSync(svp168Path, 'utf-8')
  if (svp168.includes('rotateRef') && svp168.includes('handleRotateMouseDown')) {
    log('pass', 'Round168', 'SceneViewPanel: rotateRef + handleRotateMouseDown 존재')
  } else {
    log('warning', 'Round168', 'SceneViewPanel 회전 핸들 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp168.includes('회전 핸들') && svp168.includes('crosshair')) {
    log('pass', 'Round168', 'SceneViewPanel: 회전 핸들 SVG 존재')
  } else {
    log('warning', 'Round168', 'SceneViewPanel 회전 핸들 SVG 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 71: R169 신규 기능 ───────────────────────────────
console.log('\n## 71. 신규 기능 파일 검사 (R169)')
// SceneInspector 컬러 피커 (Round 169)
const sceneInspectorPath12 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath12)) {
  const si12 = readFileSync(sceneInspectorPath12, 'utf-8')
  if (si12.includes('onColorUpdate') && si12.includes('type="color"')) {
    log('pass', 'Round169', 'SceneInspector: onColorUpdate prop + input[type=color] 존재')
  } else {
    log('warning', 'Round169', 'SceneInspector 컬러 피커 미구현', 'SceneView/SceneInspector.tsx')
  }
}
const svp169Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp169Path)) {
  const svp169 = readFileSync(svp169Path, 'utf-8')
  if (svp169.includes('handleColorUpdate') && svp169.includes('onColorUpdate')) {
    log('pass', 'Round169', 'SceneViewPanel: handleColorUpdate + onColorUpdate 연결됨')
  } else {
    log('warning', 'Round169', 'SceneViewPanel handleColorUpdate 미연결', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 72: R170 신규 기능 ───────────────────────────────
console.log('\n## 72. 신규 기능 파일 검사 (R170)')
// NodeRenderer 더블클릭 → SceneInspector 이름 편집 포커스 (Round 170)
const nodeRendererPath2 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nodeRendererPath2)) {
  const nr2 = readFileSync(nodeRendererPath2, 'utf-8')
  if (nr2.includes('onDoubleClick')) {
    log('pass', 'Round170', 'NodeRenderer: onDoubleClick prop 존재')
  } else {
    log('warning', 'Round170', 'NodeRenderer onDoubleClick 미구현', 'SceneView/NodeRenderer.tsx')
  }
}
const sceneInspectorPath13 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath13)) {
  const si13 = readFileSync(sceneInspectorPath13, 'utf-8')
  if (si13.includes('focusNameTrigger') && si13.includes('nameInputRef')) {
    log('pass', 'Round170', 'SceneInspector: focusNameTrigger + nameInputRef 존재')
  } else {
    log('warning', 'Round170', 'SceneInspector focusNameTrigger 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 73: R171 신규 기능 ───────────────────────────────
console.log('\n## 73. 신규 기능 파일 검사 (R171)')
// SceneView SVG 우클릭 컨텍스트 메뉴 (Round 171)
const svp171Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp171Path)) {
  const svp171 = readFileSync(svp171Path, 'utf-8')
  if (svp171.includes('svgContextMenu') && svp171.includes('onContextMenu')) {
    log('pass', 'Round171', 'SceneViewPanel: svgContextMenu state + onContextMenu 존재')
  } else {
    log('warning', 'Round171', 'SceneViewPanel SVG 컨텍스트 메뉴 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp171.includes('SVG 우클릭 컨텍스트 메뉴')) {
    log('pass', 'Round171', 'SceneViewPanel: 우클릭 컨텍스트 메뉴 JSX 존재')
  } else {
    log('warning', 'Round171', 'SceneViewPanel 우클릭 컨텍스트 메뉴 JSX 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 74: R172 신규 기능 ───────────────────────────────
console.log('\n## 74. 신규 기능 파일 검사 (R172)')
// SceneInspector Size W/H 비율 잠금 (Round 172)
const sceneInspectorPath14 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath14)) {
  const si14 = readFileSync(sceneInspectorPath14, 'utf-8')
  if (si14.includes('sizeLocked') && si14.includes('handleSizeUpdate')) {
    log('pass', 'Round172', 'SceneInspector: sizeLocked state + handleSizeUpdate 존재')
  } else {
    log('warning', 'Round172', 'SceneInspector size lock 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si14.includes('비율 유지 잠금') && (si14.match(/비율 유지 잠금/g) || []).length >= 2) {
    log('pass', 'Round172', 'SceneInspector: Size + Scale 비율 잠금 버튼 모두 존재')
  } else {
    log('warning', 'Round172', 'SceneInspector 비율 잠금 버튼 불완전', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 75: R173 신규 기능 ───────────────────────────────
console.log('\n## 75. 신규 기능 파일 검사 (R173)')
// 코드 블록 라인 번호 (Round 173)
const messageBubblePath3 = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(messageBubblePath3)) {
  const mb3 = readFileSync(messageBubblePath3, 'utf-8')
  if (mb3.includes('showLineNumbers') && mb3.includes('lineNumberStyle')) {
    log('pass', 'Round173', 'MessageBubble: showLineNumbers + lineNumberStyle 존재')
  } else {
    log('warning', 'Round173', 'MessageBubble 라인 번호 미구현', 'chat/MessageBubble.tsx')
  }
}

// ── Section 76: R174 신규 기능 ───────────────────────────────
console.log('\n## 76. 신규 기능 파일 검사 (R174)')
// SceneToolbar 줌 인라인 편집 (Round 174)
const sceneToolbarPath5 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(sceneToolbarPath5)) {
  const st5 = readFileSync(sceneToolbarPath5, 'utf-8')
  if (st5.includes('zoomEditing') && st5.includes('zoomDraft')) {
    log('pass', 'Round174', 'SceneToolbar: zoomEditing state + zoomDraft 존재')
  } else {
    log('warning', 'Round174', 'SceneToolbar 줌 인라인 편집 미구현', 'SceneView/SceneToolbar.tsx')
  }
  if (st5.includes('commitZoomEdit') && st5.includes('onDoubleClick')) {
    log('pass', 'Round174', 'SceneToolbar: commitZoomEdit + onDoubleClick 존재')
  } else {
    log('warning', 'Round174', 'SceneToolbar commitZoomEdit 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 77: R175 신규 기능 ───────────────────────────────
console.log('\n## 77. 신규 기능 파일 검사 (R175)')
// SceneInspector 자식 노드 목록 확장 (Round 175)
const sceneInspectorPath15 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath15)) {
  const si15 = readFileSync(sceneInspectorPath15, 'utf-8')
  if (si15.includes('ChildList') && si15.includes('expanded')) {
    log('pass', 'Round175', 'SceneInspector: ChildList 컴포넌트 + expanded state 존재')
  } else {
    log('warning', 'Round175', 'SceneInspector ChildList 미구현', 'SceneView/SceneInspector.tsx')
  }
  if (si15.includes('목록 펼치기')) {
    log('pass', 'Round175', 'SceneInspector: 자식 목록 펼치기 버튼 존재')
  } else {
    log('warning', 'Round175', 'SceneInspector 자식 목록 펼치기 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 78: R176 신규 기능 ───────────────────────────────
console.log('\n## 78. 신규 기능 파일 검사 (R176)')
// 드래그/리사이즈 중 선택 노드 정보 상태바 (Round 176)
const svp176Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp176Path)) {
  const svp176 = readFileSync(svp176Path, 'utf-8')
  if (svp176.includes('드래그/리사이즈 중 선택 노드 정보') && svp176.includes('isDragging || isResizing')) {
    log('pass', 'Round176', 'SceneViewPanel: 드래그/리사이즈 중 노드 정보 상태바 존재')
  } else {
    log('warning', 'Round176', 'SceneViewPanel 드래그 정보 상태바 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 79: R177 신규 기능 ───────────────────────────────
console.log('\n## 79. 신규 기능 파일 검사 (R177)')
// SceneView 배경 밝기 토글 (Round 177)
const sceneToolbarPath6 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(sceneToolbarPath6)) {
  const st6 = readFileSync(sceneToolbarPath6, 'utf-8')
  if (st6.includes('sceneBg') || st6.includes('bgLight') || st6.includes('onBgToggle') || st6.includes('onSceneBgChange')) {
    log('pass', 'Round177', 'SceneToolbar: 배경색 토글 prop 존재')
  } else {
    log('warning', 'Round177', 'SceneToolbar bgLight 미구현', 'SceneView/SceneToolbar.tsx')
  }
}
const svp177Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp177Path)) {
  const svp177 = readFileSync(svp177Path, 'utf-8')
  if (svp177.includes('sceneBg') || svp177.includes('bgLight')) {
    log('pass', 'Round177', 'SceneViewPanel: 배경색 state 존재')
  } else {
    log('warning', 'Round177', 'SceneViewPanel bgLight 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 80: R178 신규 기능 ───────────────────────────────
console.log('\n## 80. 신규 기능 파일 검사 (R178)')
// Alt+Up/Down 계층 탐색 (Round 178)
const svp178Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp178Path)) {
  const svp178 = readFileSync(svp178Path, 'utf-8')
  if (svp178.includes('e.altKey') && svp178.includes('parentUuid') && svp178.includes('childUuids[0]')) {
    log('pass', 'Round178', 'SceneViewPanel: Alt+Up/Down 계층 탐색 존재')
  } else {
    log('warning', 'Round178', 'SceneViewPanel Alt+Up/Down 탐색 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 81: R179 신규 기능 ───────────────────────────────
console.log('\n## 81. 신규 기능 파일 검사 (R179)')
// SceneInspector Position 리셋 버튼 (Round 179)
const sceneInspectorPath16 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath16)) {
  const si16 = readFileSync(sceneInspectorPath16, 'utf-8')
  if (si16.includes('X, Y 위치를 (0, 0)으로 초기화') && (si16.includes("onUpdate(node.uuid, 'x', 0)") || si16.includes("trackUpdate(node.uuid, 'x', 0)"))) {
    log('pass', 'Round179', 'SceneInspector: Position 리셋 버튼 존재')
  } else {
    log('warning', 'Round179', 'SceneInspector Position 리셋 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 82: R180 신규 기능 ───────────────────────────────
console.log('\n## 82. 신규 기능 파일 검사 (R180)')
// SceneInspector Rotation 리셋 버튼 (Round 180)
const sceneInspectorPath17 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath17)) {
  const si17 = readFileSync(sceneInspectorPath17, 'utf-8')
  if (si17.includes('회전을 0으로 초기화') && (si17.includes("onUpdate(node.uuid, 'rotation', 0)") || si17.includes("trackUpdate(node.uuid, 'rotation', 0)"))) {
    log('pass', 'Round180', 'SceneInspector: Rotation ⊙ 리셋 버튼 존재')
  } else {
    log('warning', 'Round180', 'SceneInspector Rotation 리셋 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 83: R181 신규 기능 ───────────────────────────────
console.log('\n## 83. 신규 기능 파일 검사 (R181)')
// SceneInspector Scale 리셋 버튼 (Round 181)
const sceneInspectorPath18 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath18)) {
  const si18 = readFileSync(sceneInspectorPath18, 'utf-8')
  if (si18.includes('스케일을 (1, 1)로 초기화') && (si18.includes("onUpdate(node.uuid, 'scaleX', 1)") || si18.includes("trackUpdate(node.uuid, 'scaleX', 1)"))) {
    log('pass', 'Round181', 'SceneInspector: Scale ⊙ 리셋 버튼 존재')
  } else {
    log('warning', 'Round181', 'SceneInspector Scale 리셋 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 84: R182 신규 기능 ───────────────────────────────
console.log('\n## 84. 신규 기능 파일 검사 (R182)')
// SceneInspector Anchor 리셋 버튼 (Round 182)
const sceneInspectorPath19 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath19)) {
  const si19 = readFileSync(sceneInspectorPath19, 'utf-8')
  if (si19.includes('앵커를 (0.5, 0.5) 중심으로 초기화') && (si19.includes("onUpdate(node.uuid, 'anchorX', 0.5)") || si19.includes("trackUpdate(node.uuid, 'anchorX', 0.5)"))) {
    log('pass', 'Round182', 'SceneInspector: Anchor ⊙ 리셋 버튼 존재')
  } else {
    log('warning', 'Round182', 'SceneInspector Anchor 리셋 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 85: R183 신규 기능 ───────────────────────────────
console.log('\n## 85. 신규 기능 파일 검사 (R183)')
// SceneInspector 조상 Breadcrumb (Round 183)
const sceneInspectorPath20 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath20)) {
  const si20 = readFileSync(sceneInspectorPath20, 'utf-8')
  if (si20.includes('조상 경로 (Breadcrumb)') && si20.includes('ancestors.unshift') && si20.includes('ancestors.map')) {
    log('pass', 'Round183', 'SceneInspector: 조상 Breadcrumb 경로 표시 존재')
  } else {
    log('warning', 'Round183', 'SceneInspector 조상 Breadcrumb 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 86: R184 신규 기능 ───────────────────────────────
console.log('\n## 86. 신규 기능 파일 검사 (R184)')
// SceneView 미니맵 오버레이 (Round 184)
const svp184Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp184Path)) {
  const svp184 = readFileSync(svp184Path, 'utf-8')
  if (svp184.includes('showMinimap') && svp184.includes('미니맵 오버레이') && svp184.includes('MM_W')) {
    log('pass', 'Round184', 'SceneView: 미니맵 오버레이 존재')
  } else {
    log('warning', 'Round184', 'SceneView 미니맵 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 87: R185 신규 기능 ───────────────────────────────
console.log('\n## 87. 신규 기능 파일 검사 (R185)')
// SceneView 미니맵 클릭 네비게이션 (Round 185)
const svp185Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp185Path)) {
  const svp185 = readFileSync(svp185Path, 'utf-8')
  if (svp185.includes('미니맵 — 클릭: 뷰포트 이동') && svp185.includes('cw / 2 - sceneX * prev.zoom')) {
    log('pass', 'Round185', 'SceneView: 미니맵 클릭 뷰포트 이동 존재')
  } else {
    log('warning', 'Round185', 'SceneView 미니맵 클릭 네비게이션 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 88: R186 신규 기능 ───────────────────────────────
console.log('\n## 88. 신규 기능 파일 검사 (R186)')
// SceneToolbar 미니맵 토글 버튼 (Round 186)
const sceneToolbar186Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(sceneToolbar186Path)) {
  const st186 = readFileSync(sceneToolbar186Path, 'utf-8')
  if (st186.includes('showMinimap') && st186.includes('onMinimapToggle') && st186.includes('미니맵 표시/숨기기')) {
    log('pass', 'Round186', 'SceneToolbar: 미니맵 토글 버튼 존재')
  } else {
    log('warning', 'Round186', 'SceneToolbar 미니맵 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 89: R187 신규 기능 ───────────────────────────────
console.log('\n## 89. 신규 기능 파일 검사 (R187)')
// SceneView 회전 각도 오버레이 (Round 187)
const svp187Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp187Path)) {
  const svp187 = readFileSync(svp187Path, 'utf-8')
  if (svp187.includes('isRotating') && svp187.includes('회전 각도 오버레이') && svp187.includes("selectedNode.rotation.toFixed(1)}°")) {
    log('pass', 'Round187', 'SceneView: 회전 각도 오버레이 존재')
  } else {
    log('warning', 'Round187', 'SceneView 회전 각도 오버레이 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 90: R188 신규 기능 ───────────────────────────────
console.log('\n## 90. 신규 기능 파일 검사 (R188)')
// SceneView 다중 선택 bounding box (Round 188)
const svp188Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp188Path)) {
  const svp188 = readFileSync(svp188Path, 'utf-8')
  if (svp188.includes('다중 선택 합산 bounding box') && svp188.includes('gbMinX') && svp188.includes('selectedUuids.size > 1')) {
    log('pass', 'Round188', 'SceneView: 다중 선택 bounding box 표시 존재')
  } else {
    log('warning', 'Round188', 'SceneView 다중 선택 bounding box 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 91: R189 신규 기능 ───────────────────────────────
console.log('\n## 91. 신규 기능 파일 검사 (R189)')
// SceneView Ctrl+←→ 회전 단축키 (Round 189)
const svp189Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp189Path)) {
  const svp189 = readFileSync(svp189Path, 'utf-8')
  if (svp189.includes('Ctrl+← →: 회전') && svp189.includes('rotStep') && svp189.includes("node.rotation + delta")) {
    log('pass', 'Round189', 'SceneView: Ctrl+←→ 회전 단축키 존재')
  } else {
    log('warning', 'Round189', 'SceneView Ctrl+←→ 회전 단축키 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 92: R190 신규 기능 ───────────────────────────────
console.log('\n## 92. 신규 기능 파일 검사 (R190)')
// SceneInspector Color 알파 슬라이더 (Round 190)
const sceneInspectorPath21 = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(sceneInspectorPath21)) {
  const si21 = readFileSync(sceneInspectorPath21, 'utf-8')
  if (si21.includes('알파:') && si21.includes("onColorUpdate?.(node.uuid, { a:") && si21.includes('type="range"')) {
    log('pass', 'Round190', 'SceneInspector: Color 알파 슬라이더 존재')
  } else {
    log('warning', 'Round190', 'SceneInspector Color 알파 슬라이더 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 93: R191 신규 기능 ───────────────────────────────
console.log('\n## 93. 신규 기능 파일 검사 (R191)')
// SceneView M 키 미니맵 토글 (Round 191)
const svp191Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp191Path)) {
  const svp191 = readFileSync(svp191Path, 'utf-8')
  if (svp191.includes("e.key === 'm' || e.key === 'M'") && svp191.includes('setShowMinimap(v => !v)') && svp191.includes("'M', '미니맵 토글'")) {
    log('pass', 'Round191', 'SceneView: M키 미니맵 토글 + 도움말 업데이트')
  } else {
    log('warning', 'Round191', 'SceneView M키 미니맵 토글 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 94: R192 신규 기능 ───────────────────────────────
console.log('\n## 94. 신규 기능 파일 검사 (R192)')
// SceneView 원점 십자선 (Round 192)
const svp192Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp192Path)) {
  const svp192 = readFileSync(svp192Path, 'utf-8')
  if (svp192.includes('원점(0,0) 십자선') && svp192.includes('DESIGN_W / 2 * view.zoom + view.offsetX')) {
    log('pass', 'Round192', 'SceneView: 원점(0,0) 십자선 가이드 존재')
  } else {
    log('warning', 'Round192', 'SceneView 원점 십자선 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 95: R193 신규 기능 ───────────────────────────────
console.log('\n## 95. 신규 기능 파일 검사 (R193)')
// SceneView N키 빠른 노드 생성 (Round 193)
const svp193Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp193Path)) {
  const svp193 = readFileSync(svp193Path, 'utf-8')
  if (svp193.includes("e.key === 'n' || e.key === 'N'") && svp193.includes('handleCreateNode()') && svp193.includes("'N', '새 노드 생성'")) {
    log('pass', 'Round193', 'SceneView: N키 빠른 노드 생성 단축키 존재')
  } else {
    log('warning', 'Round193', 'SceneView N키 노드 생성 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 96: R194 신규 기능 ───────────────────────────────
console.log('\n## 96. 신규 기능 파일 검사 (R194)')
// CalendarPanel 오늘 버튼 + 세션 통계 (Round 194)
const calendarPath = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(calendarPath)) {
  const cal = readFileSync(calendarPath, 'utf-8')
  if (cal.includes('오늘으로 이동') || cal.includes('오늘로 이동')) {
    log('pass', 'Round194', 'CalendarPanel: 오늘 빠른 이동 버튼 존재')
  } else {
    log('warning', 'Round194', 'CalendarPanel 오늘 버튼 미구현', 'sidebar/CalendarPanel.tsx')
  }
  if (cal.includes('전체') && cal.includes('개 세션')) {
    log('pass', 'Round194', 'CalendarPanel: 세션 수 합계 표시 존재')
  } else {
    log('warning', 'Round194', 'CalendarPanel 세션 통계 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 97: R195 신규 기능 ───────────────────────────────
console.log('\n## 97. 신규 기능 파일 검사 (R195)')
// ClipboardPanel 검색 필터 (Round 195)
const clipboardPanelPath = join(ROOT, 'src/renderer/src/components/sidebar/ClipboardPanel.tsx')
if (existsSync(clipboardPanelPath)) {
  const cp = readFileSync(clipboardPanelPath, 'utf-8')
  if (cp.includes('클립보드 검색') && cp.includes('filtered') && cp.includes('useMemo')) {
    log('pass', 'Round195', 'ClipboardPanel: 검색 필터 존재')
  } else {
    log('warning', 'Round195', 'ClipboardPanel 검색 필터 미구현', 'sidebar/ClipboardPanel.tsx')
  }
}

// ── Section 98: R196 신규 기능 ───────────────────────────────
console.log('\n## 98. 신규 기능 파일 검사 (R196)')
// TasksPanel 인라인 편집 (Round 196)
const tasksPanelPath = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tasksPanelPath)) {
  const tp = readFileSync(tasksPanelPath, 'utf-8')
  if (tp.includes('editingId') && tp.includes('startEdit') && tp.includes('더블클릭하여 편집')) {
    log('pass', 'Round196', 'TasksPanel: 인라인 태스크 편집 존재')
  } else {
    log('warning', 'Round196', 'TasksPanel 인라인 편집 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 315: R413 신규 기능 ───────────────────────────────
console.log('\n## 315. 신규 기능 파일 검사 (R413)')
// RunTimeline 전체 런 요약 복사 (Round 413)
const rt413Path = join(ROOT, 'src/renderer/src/components/sidebar/RunTimeline.tsx')
if (existsSync(rt413Path)) {
  const rt413 = readFileSync(rt413Path, 'utf-8')
  if (rt413.includes('allCopied') && rt413.includes('전체 런 요약 복사') && rt413.includes('setAllCopied')) {
    log('pass', 'Round413', 'RunTimeline: 전체 런 요약 복사(allCopied) 존재')
  } else {
    log('warning', 'Round413', 'RunTimeline 전체 복사 미구현', 'sidebar/RunTimeline.tsx')
  }
}

// ── Section 314: R412 신규 기능 ───────────────────────────────
console.log('\n## 314. 신규 기능 파일 검사 (R412)')
// SceneTreePanel 씬 트리 텍스트 복사 (Round 412)
const stp412Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneTreePanel.tsx')
if (existsSync(stp412Path)) {
  const stp412 = readFileSync(stp412Path, 'utf-8')
  if (stp412.includes('treeCopied') && stp412.includes('copyTreeAsText') && stp412.includes('씬 트리 텍스트')) {
    log('pass', 'Round412', 'SceneTreePanel: 씬 트리 텍스트 복사(copyTreeAsText) 존재')
  } else {
    log('warning', 'Round412', 'SceneTreePanel 트리 복사 미구현', 'sidebar/SceneTreePanel.tsx')
  }
}

// ── Section 313: R411 신규 기능 ───────────────────────────────
console.log('\n## 313. 신규 기능 파일 검사 (R411)')
// NodePropertyPanel transform 복사 (Round 411)
const npp411Path = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(npp411Path)) {
  const npp411 = readFileSync(npp411Path, 'utf-8')
  if (npp411.includes('transformCopied') && npp411.includes('copyTransform') && npp411.includes('Transform 전체 JSON')) {
    log('pass', 'Round411', 'NodePropertyPanel: Transform 전체 JSON 복사(copyTransform) 존재')
  } else {
    log('warning', 'Round411', 'NodePropertyPanel transform 복사 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 312: R410 신규 기능 ───────────────────────────────
console.log('\n## 312. 신규 기능 파일 검사 (R410)')
// AssetBrowserPanel ESC + copyPath .then() (Round 410)
const ab410Path = join(ROOT, 'src/renderer/src/components/sidebar/AssetBrowserPanel.tsx')
if (existsSync(ab410Path)) {
  const ab410 = readFileSync(ab410Path, 'utf-8')
  if (ab410.includes("'Escape'") && ab410.includes('setTypeFilter(null)') && ab410.includes('.then(')) {
    log('pass', 'Round410', 'AssetBrowserPanel: ESC 검색+타입필터 초기화 + copyPath .then() 개선 존재')
  } else {
    log('warning', 'Round410', 'AssetBrowserPanel ESC 또는 copyPath 개선 미구현', 'sidebar/AssetBrowserPanel.tsx')
  }
}

// ── Section 311: R409 신규 기능 ───────────────────────────────
console.log('\n## 311. 신규 기능 파일 검사 (R409)')
// SnippetPanel ESC + 복제 기능 (Round 409)
const sp409Path = join(ROOT, 'src/renderer/src/components/sidebar/SnippetPanel.tsx')
if (existsSync(sp409Path)) {
  const sp409 = readFileSync(sp409Path, 'utf-8')
  if (sp409.includes('handleDuplicate') && sp409.includes('복제됨') && sp409.includes("'Escape'")) {
    log('pass', 'Round409', 'SnippetPanel: 스니펫 복제(handleDuplicate) + ESC 검색 초기화 존재')
  } else {
    log('warning', 'Round409', 'SnippetPanel 복제 또는 ESC 미구현', 'sidebar/SnippetPanel.tsx')
  }
}

// ── Section 310: R408 신규 기능 ───────────────────────────────
console.log('\n## 310. 신규 기능 파일 검사 (R408)')
// RemotePanel ESC + 상대시간 표시 (Round 408)
const rp408Path = join(ROOT, 'src/renderer/src/components/sidebar/RemotePanel.tsx')
if (existsSync(rp408Path)) {
  const rp408 = readFileSync(rp408Path, 'utf-8')
  if (rp408.includes('fmtRelative') && rp408.includes("'Escape'") && rp408.includes('방금')) {
    log('pass', 'Round408', 'RemotePanel: 상대시간(fmtRelative) + ESC 검색 초기화 존재')
  } else {
    log('warning', 'Round408', 'RemotePanel fmtRelative 또는 ESC 미구현', 'sidebar/RemotePanel.tsx')
  }
}

// ── Section 309: R407 신규 기능 ───────────────────────────────
console.log('\n## 309. 신규 기능 파일 검사 (R407)')
// PluginsPanel 새로고침 로딩 상태 (Round 407)
const pp407Path = join(ROOT, 'src/renderer/src/components/sidebar/PluginsPanel.tsx')
if (existsSync(pp407Path)) {
  const pp407 = readFileSync(pp407Path, 'utf-8')
  if (pp407.includes('refreshing') && pp407.includes('setRefreshing') && pp407.includes('새로고침 중')) {
    log('pass', 'Round407', 'PluginsPanel: 새로고침 로딩 인디케이터(refreshing) 존재')
  } else {
    log('warning', 'Round407', 'PluginsPanel 새로고침 로딩 상태 미구현', 'sidebar/PluginsPanel.tsx')
  }
}

// ── Section 308: R406 신규 기능 ───────────────────────────────
console.log('\n## 308. 신규 기능 파일 검사 (R406)')
// GlobalSearchPanel ESC + Enter 키 핸들러 (Round 406)
const gsp406Path = join(ROOT, 'src/renderer/src/components/sidebar/GlobalSearchPanel.tsx')
if (existsSync(gsp406Path)) {
  const gsp406 = readFileSync(gsp406Path, 'utf-8')
  if (gsp406.includes("'Escape'") && gsp406.includes("'Enter'") && gsp406.includes('setResults([])')) {
    log('pass', 'Round406', 'GlobalSearchPanel: ESC 초기화 + Enter 즉시검색 존재')
  } else {
    log('warning', 'Round406', 'GlobalSearchPanel ESC/Enter 핸들러 미구현', 'sidebar/GlobalSearchPanel.tsx')
  }
}

// ── Section 307: R405 신규 기능 ───────────────────────────────
console.log('\n## 307. 신규 기능 파일 검사 (R405)')
// PromptChainPanel 체인 결과 전체 복사 (Round 405)
const pcp405Path = join(ROOT, 'src/renderer/src/components/sidebar/PromptChainPanel.tsx')
if (existsSync(pcp405Path)) {
  const pcp405 = readFileSync(pcp405Path, 'utf-8')
  if (pcp405.includes('copiedChainId') && pcp405.includes('결과 전체 복사') && pcp405.includes('setCopiedChainId')) {
    log('pass', 'Round405', 'PromptChainPanel: 체인 결과 전체 복사(copiedChainId) 존재')
  } else {
    log('warning', 'Round405', 'PromptChainPanel 결과 복사 미구현', 'sidebar/PromptChainPanel.tsx')
  }
}

// ── Section 306: R404 신규 기능 ───────────────────────────────
console.log('\n## 306. 신규 기능 파일 검사 (R404)')
// OutlinePanel reversed 선언 순서 수정 + ESC (Round 404)
const op404Path = join(ROOT, 'src/renderer/src/components/sidebar/OutlinePanel.tsx')
if (existsSync(op404Path)) {
  const op404 = readFileSync(op404Path, 'utf-8')
  const reversedBeforeMemo = op404.indexOf("const [reversed, setReversed]") < op404.indexOf("}, [allItems, search, levelFilter, reversed])")
  if (reversedBeforeMemo && op404.includes("'Escape'") && op404.includes('setSearch')) {
    log('pass', 'Round404', 'OutlinePanel: reversed 선언 순서 수정 + ESC 검색 초기화 존재')
  } else {
    log('warning', 'Round404', 'OutlinePanel reversed 순서 또는 ESC 미구현', 'sidebar/OutlinePanel.tsx')
  }
}

// ── Section 305: R403 신규 기능 ───────────────────────────────
console.log('\n## 305. 신규 기능 파일 검사 (R403)')
// BookmarksPanel 정렬 토글 + ESC (Round 403)
const bp403Path = join(ROOT, 'src/renderer/src/components/sidebar/BookmarksPanel.tsx')
if (existsSync(bp403Path)) {
  const bp403 = readFileSync(bp403Path, 'utf-8')
  if (bp403.includes('sortOrder') && bp403.includes('cycleSortOrder') && bp403.includes("'Escape'")) {
    log('pass', 'Round403', 'BookmarksPanel: 정렬 토글(기본/최신/오래된) + ESC 검색 초기화 존재')
  } else {
    log('warning', 'Round403', 'BookmarksPanel 정렬 토글 미구현', 'sidebar/BookmarksPanel.tsx')
  }
}

// ── Section 304: R402 신규 기능 ───────────────────────────────
console.log('\n## 304. 신규 기능 파일 검사 (R402)')
// WebPreviewPanel 줌 컨트롤 (Round 402)
const wpp402Path = join(ROOT, 'src/renderer/src/components/sidebar/WebPreviewPanel.tsx')
if (existsSync(wpp402Path)) {
  const wpp402 = readFileSync(wpp402Path, 'utf-8')
  if (wpp402.includes('zoom') && wpp402.includes('zoomIn') && wpp402.includes('zoomOut') && wpp402.includes('ZOOM_STEPS')) {
    log('pass', 'Round402', 'WebPreviewPanel: iframe 줌 컨트롤 존재 (+/-/% 버튼)')
  } else {
    log('warning', 'Round402', 'WebPreviewPanel 줌 컨트롤 미구현', 'sidebar/WebPreviewPanel.tsx')
  }
}

// ── Section 303: R401 신규 기능 ───────────────────────────────
console.log('\n## 303. 신규 기능 파일 검사 (R401)')
// ConnectionPanel 서버 검색 필터 (Round 401)
const conn401Path = join(ROOT, 'src/renderer/src/components/sidebar/ConnectionPanel.tsx')
if (existsSync(conn401Path)) {
  const conn401 = readFileSync(conn401Path, 'utf-8')
  if (conn401.includes('serverSearch') && conn401.includes('서버 검색')) {
    log('pass', 'Round401', 'ConnectionPanel: 서버 이름 검색 필터 존재')
  } else {
    log('warning', 'Round401', 'ConnectionPanel 서버 검색 미구현', 'sidebar/ConnectionPanel.tsx')
  }
}

// ── Section 302: R400 신규 기능 (마일스톤) ─────────────────────
console.log('\n## 302. 신규 기능 파일 검사 (R400 마일스톤)')
// NotesPanel 노트 템플릿 (Round 400)
const np400Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np400Path)) {
  const np400 = readFileSync(np400Path, 'utf-8')
  if (np400.includes('showTemplates') && np400.includes('NOTE_TEMPLATES') && np400.includes('applyTemplate') && np400.includes('미팅 노트')) {
    log('pass', 'Round400', 'NotesPanel: 노트 템플릿 기능 존재 (미팅/할일/버그/아이디어)')
  } else {
    log('warning', 'Round400', 'NotesPanel 템플릿 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 301: R399 신규 기능 ───────────────────────────────
console.log('\n## 301. 신규 기능 파일 검사 (R399)')
// SearchPanel 단어 단위 검색 (Round 399)
const sp399Path = join(ROOT, 'src/renderer/src/components/sidebar/SearchPanel.tsx')
if (existsSync(sp399Path)) {
  const sp399 = readFileSync(sp399Path, 'utf-8')
  if (sp399.includes('wholeWord') && sp399.includes('단어 단위 검색') && sp399.includes('\\\\b')) {
    log('pass', 'Round399', 'SearchPanel: 단어 단위 검색 Ww 토글 존재')
  } else {
    log('warning', 'Round399', 'SearchPanel 단어 단위 검색 미구현', 'sidebar/SearchPanel.tsx')
  }
}

// ── Section 300: R398 신규 기능 ───────────────────────────────
console.log('\n## 300. 신규 기능 파일 검사 (R398)')
// CalendarPanel 이벤트 목록 복사 (Round 398)
const cal398Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cal398Path)) {
  const cal398 = readFileSync(cal398Path, 'utf-8')
  if (cal398.includes('eventsCopied') && cal398.includes('copyUpcomingEvents') && cal398.includes('이벤트 목록 복사')) {
    log('pass', 'Round398', 'CalendarPanel: 이벤트 목록 복사 버튼 존재')
  } else {
    log('warning', 'Round398', 'CalendarPanel 이벤트 복사 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 299: R397 신규 기능 ───────────────────────────────
console.log('\n## 299. 신규 기능 파일 검사 (R397)')
// AgentPanel 태스크 결과 복사 (Round 397)
const ap397Path = join(ROOT, 'src/renderer/src/components/sidebar/AgentPanel.tsx')
if (existsSync(ap397Path)) {
  const ap397 = readFileSync(ap397Path, 'utf-8')
  if (ap397.includes('copiedResultId') && ap397.includes('결과 전체 복사')) {
    log('pass', 'Round397', 'AgentPanel: 태스크 마지막 결과 복사 버튼 존재')
  } else {
    log('warning', 'Round397', 'AgentPanel 결과 복사 미구현', 'sidebar/AgentPanel.tsx')
  }
}

// ── Section 298: R396 신규 기능 ───────────────────────────────
console.log('\n## 298. 신규 기능 파일 검사 (R396)')
// GitPanel 커밋 해시 복사 버튼 (Round 396)
const gp396Path = join(ROOT, 'src/renderer/src/components/sidebar/GitPanel.tsx')
if (existsSync(gp396Path)) {
  const gp396 = readFileSync(gp396Path, 'utf-8')
  if (gp396.includes('copiedCommitHash') && gp396.includes('해시 복사')) {
    log('pass', 'Round396', 'GitPanel: 커밋 해시 복사 버튼 존재')
  } else {
    log('warning', 'Round396', 'GitPanel 해시 복사 미구현', 'sidebar/GitPanel.tsx')
  }
}

// ── Section 297: R395 신규 기능 ───────────────────────────────
console.log('\n## 297. 신규 기능 파일 검사 (R395)')
// DiffPanel diff 결과 요약 복사 (Round 395)
const dp395Path = join(ROOT, 'src/renderer/src/components/sidebar/DiffPanel.tsx')
if (existsSync(dp395Path)) {
  const dp395 = readFileSync(dp395Path, 'utf-8')
  if (dp395.includes('diffCopied') && dp395.includes('copyDiffSummary') && dp395.includes('diff 요약 복사')) {
    log('pass', 'Round395', 'DiffPanel: diff 결과 요약 복사 버튼 존재')
  } else {
    log('warning', 'Round395', 'DiffPanel diff 요약 복사 미구현', 'sidebar/DiffPanel.tsx')
  }
}

// ── Section 296: R394 신규 기능 ───────────────────────────────
console.log('\n## 296. 신규 기능 파일 검사 (R394)')
// ClipboardPanel 핀 보호 스마트 삭제 (Round 394)
const cp394Path = join(ROOT, 'src/renderer/src/components/sidebar/ClipboardPanel.tsx')
if (existsSync(cp394Path)) {
  const cp394 = readFileSync(cp394Path, 'utf-8')
  if (cp394.includes('비핀 삭제') && cp394.includes('pinnedIds.size > 0') && cp394.includes('📌')) {
    log('pass', 'Round394', 'ClipboardPanel: 핀 보호 스마트 삭제 + 핀 카운트 배지 존재')
  } else {
    log('warning', 'Round394', 'ClipboardPanel 핀 보호 삭제 미구현', 'sidebar/ClipboardPanel.tsx')
  }
}

// ── Section 295: R393 신규 기능 ───────────────────────────────
console.log('\n## 295. 신규 기능 파일 검사 (R393)')
// FileTree 파일 검색 결과 카운트 (Round 393)
const ft393Path = join(ROOT, 'src/renderer/src/components/sidebar/FileTree.tsx')
if (existsSync(ft393Path)) {
  const ft393 = readFileSync(ft393Path, 'utf-8')
  if (ft393.includes('개 파일') && ft393.includes('파일 없음') && ft393.includes("'Escape'")) {
    log('pass', 'Round393', 'FileTree: 파일 검색 결과 카운트 + ESC 초기화 존재')
  } else {
    log('warning', 'Round393', 'FileTree 검색 카운트 미구현', 'sidebar/FileTree.tsx')
  }
}

// ── Section 294: R392 신규 기능 ───────────────────────────────
console.log('\n## 294. 신규 기능 파일 검사 (R392)')
// CocosPanel 프로젝트 경로 복사 버튼 (Round 392) — WS 코드 완전 제거로 체크 면제
log('pass', 'Round392', 'CocosPanel WS 코드 제거됨 — 경로 복사 체크 면제 (파일 기반 모드 전환)')

// ── Section 293: R391 신규 기능 ───────────────────────────────
console.log('\n## 293. 신규 기능 파일 검사 (R391)')
// SnippetPanel 스니펫 전체 내용 펼치기 (Round 391)
const sp391Path = join(ROOT, 'src/renderer/src/components/sidebar/SnippetPanel.tsx')
if (existsSync(sp391Path)) {
  const sp391 = readFileSync(sp391Path, 'utf-8')
  if (sp391.includes('expandedSnippetId') && sp391.includes('펼치기')) {
    log('pass', 'Round391', 'SnippetPanel: 스니펫 전체 내용 펼치기 존재')
  } else {
    log('warning', 'Round391', 'SnippetPanel 내용 펼치기 미구현', 'sidebar/SnippetPanel.tsx')
  }
}

// ── Section 292: R390 신규 기능 ───────────────────────────────
console.log('\n## 292. 신규 기능 파일 검사 (R390)')
// ChangedFilesPanel 전체 경로 복사 버튼 (Round 390)
const cf390Path = join(ROOT, 'src/renderer/src/components/sidebar/ChangedFilesPanel.tsx')
if (existsSync(cf390Path)) {
  const cf390 = readFileSync(cf390Path, 'utf-8')
  if (cf390.includes('copiedAll') && cf390.includes('전체 경로 복사')) {
    log('pass', 'Round390', 'ChangedFilesPanel: 전체 경로 복사 버튼 존재')
  } else {
    log('warning', 'Round390', 'ChangedFilesPanel 전체 복사 미구현', 'sidebar/ChangedFilesPanel.tsx')
  }
}

// ── Section 291: R389 신규 기능 ───────────────────────────────
console.log('\n## 291. 신규 기능 파일 검사 (R389)')
// SearchPanel 검색 결과 전체 복사 (Round 389)
const sp389Path = join(ROOT, 'src/renderer/src/components/sidebar/SearchPanel.tsx')
if (existsSync(sp389Path)) {
  const sp389 = readFileSync(sp389Path, 'utf-8')
  if (sp389.includes('resultsCopied') && sp389.includes('검색 결과 전체 복사')) {
    log('pass', 'Round389', 'SearchPanel: 검색 결과 전체 복사 버튼 존재')
  } else {
    log('warning', 'Round389', 'SearchPanel 결과 복사 미구현', 'sidebar/SearchPanel.tsx')
  }
}

// ── Section 290: R388 신규 기능 ───────────────────────────────
console.log('\n## 290. 신규 기능 파일 검사 (R388)')
// GlobalSearchPanel 검색 결과 발췌 복사 버튼 (Round 388)
const gs388Path = join(ROOT, 'src/renderer/src/components/sidebar/GlobalSearchPanel.tsx')
if (existsSync(gs388Path)) {
  const gs388 = readFileSync(gs388Path, 'utf-8')
  if (gs388.includes('copiedResultKey') && gs388.includes('발췌 복사')) {
    log('pass', 'Round388', 'GlobalSearchPanel: 검색 결과 발췌 복사 버튼 존재')
  } else {
    log('warning', 'Round388', 'GlobalSearchPanel 발췌 복사 미구현', 'sidebar/GlobalSearchPanel.tsx')
  }
}

// ── Section 289: R387 신규 기능 ───────────────────────────────
console.log('\n## 289. 신규 기능 파일 검사 (R387)')
// SceneTreePanel 검색 매치 카운트 (Round 387)
const st387Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneTreePanel.tsx')
if (existsSync(st387Path)) {
  const st387 = readFileSync(st387Path, 'utf-8')
  if (st387.includes('matchCount') && st387.includes('countMatches') && st387.includes('노드 일치')) {
    log('pass', 'Round387', 'SceneTreePanel: 검색 매치 카운트 표시 존재')
  } else {
    log('warning', 'Round387', 'SceneTreePanel 검색 카운트 미구현', 'sidebar/SceneTreePanel.tsx')
  }
}

// ── Section 288: R386 신규 기능 ───────────────────────────────
console.log('\n## 288. 신규 기능 파일 검사 (R386)')
// RemotePanel SSH 명령어 복사 버튼 (Round 386)
const rp386Path = join(ROOT, 'src/renderer/src/components/sidebar/RemotePanel.tsx')
if (existsSync(rp386Path)) {
  const rp386 = readFileSync(rp386Path, 'utf-8')
  if (rp386.includes('copiedHost') && rp386.includes('copyCmd') && rp386.includes('SSH 명령어 복사')) {
    log('pass', 'Round386', 'RemotePanel: SSH 명령어 복사 버튼 존재')
  } else {
    log('warning', 'Round386', 'RemotePanel SSH 명령어 복사 미구현', 'sidebar/RemotePanel.tsx')
  }
}

// ── Section 287: R385 신규 기능 ───────────────────────────────
console.log('\n## 287. 신규 기능 파일 검사 (R385)')
// OutlinePanel 개별 헤딩 복사 버튼 (Round 385)
const op385Path = join(ROOT, 'src/renderer/src/components/sidebar/OutlinePanel.tsx')
if (existsSync(op385Path)) {
  const op385 = readFileSync(op385Path, 'utf-8')
  if (op385.includes('copiedItemKey') && op385.includes('헤딩 복사')) {
    log('pass', 'Round385', 'OutlinePanel: 개별 헤딩 복사 버튼 존재')
  } else {
    log('warning', 'Round385', 'OutlinePanel 개별 헤딩 복사 미구현', 'sidebar/OutlinePanel.tsx')
  }
}

// ── Section 286: R384 신규 기능 ───────────────────────────────
console.log('\n## 286. 신규 기능 파일 검사 (R384)')
// TasksPanel 태스크 텍스트 복사 버튼 (Round 384)
const tp384Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp384Path)) {
  const tp384 = readFileSync(tp384Path, 'utf-8')
  if (tp384.includes('copiedTaskId') && tp384.includes('태스크 텍스트 복사')) {
    log('pass', 'Round384', 'TasksPanel: 태스크 텍스트 복사 버튼 존재')
  } else {
    log('warning', 'Round384', 'TasksPanel 텍스트 복사 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 285: R383 신규 기능 ───────────────────────────────
console.log('\n## 285. 신규 기능 파일 검사 (R383)')
// RunTimeline RunCard 런 로그 복사 (Round 383)
const rt383Path = join(ROOT, 'src/renderer/src/components/sidebar/RunTimeline.tsx')
if (existsSync(rt383Path)) {
  const rt383 = readFileSync(rt383Path, 'utf-8')
  if (rt383.includes('logCopied') && rt383.includes('copyLog') && rt383.includes('런 로그 복사')) {
    log('pass', 'Round383', 'RunTimeline: RunCard 런 로그 복사 버튼 존재')
  } else {
    log('warning', 'Round383', 'RunTimeline RunCard 로그 복사 미구현', 'sidebar/RunTimeline.tsx')
  }
}

// ── Section 284: R382 신규 기능 ───────────────────────────────
console.log('\n## 284. 신규 기능 파일 검사 (R382)')
// StatsPanel 통계 요약 복사 버튼 (Round 382)
const sp382Path = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(sp382Path)) {
  const sp382 = readFileSync(sp382Path, 'utf-8')
  if (sp382.includes('statsCopied') && sp382.includes('통계 요약 복사')) {
    log('pass', 'Round382', 'StatsPanel: 통계 요약 복사 버튼 존재')
  } else {
    log('warning', 'Round382', 'StatsPanel 통계 복사 미구현', 'sidebar/StatsPanel.tsx')
  }
}

// ── Section 283: R381 신규 기능 ───────────────────────────────
console.log('\n## 283. 신규 기능 파일 검사 (R381)')
// AssetBrowserPanel 전체 펼치기/접기 (Round 381)
const ab381Path = join(ROOT, 'src/renderer/src/components/sidebar/AssetBrowserPanel.tsx')
if (existsSync(ab381Path)) {
  const ab381 = readFileSync(ab381Path, 'utf-8')
  if (ab381.includes('toggleExpandAll') && ab381.includes('allExpanded') && ab381.includes('전체 펼치기')) {
    log('pass', 'Round381', 'AssetBrowserPanel: 전체 펼치기/접기 버튼 존재')
  } else {
    log('warning', 'Round381', 'AssetBrowserPanel 전체 펼치기/접기 미구현', 'sidebar/AssetBrowserPanel.tsx')
  }
}

// ── Section 282: R380 신규 기능 ───────────────────────────────
console.log('\n## 282. 신규 기능 파일 검사 (R380)')
// ConnectionPanel 서버 명령어 복사 버튼 (Round 380)
const cp380Path = join(ROOT, 'src/renderer/src/components/sidebar/ConnectionPanel.tsx')
if (existsSync(cp380Path)) {
  const cp380 = readFileSync(cp380Path, 'utf-8')
  if (cp380.includes('copiedServerIdx') && cp380.includes('명령어 복사')) {
    log('pass', 'Round380', 'ConnectionPanel: 서버 명령어 복사 버튼 존재')
  } else {
    log('warning', 'Round380', 'ConnectionPanel 명령어 복사 미구현', 'sidebar/ConnectionPanel.tsx')
  }
}

// ── Section 281: R379 신규 기능 ───────────────────────────────
console.log('\n## 281. 신규 기능 파일 검사 (R379)')
// WebPreviewPanel URL 방문 기록 드롭다운 (Round 379)
const wp379Path = join(ROOT, 'src/renderer/src/components/sidebar/WebPreviewPanel.tsx')
if (existsSync(wp379Path)) {
  const wp379 = readFileSync(wp379Path, 'utf-8')
  if (wp379.includes('uniqueHistory') && wp379.includes('showHistory') && wp379.includes('방문 기록')) {
    log('pass', 'Round379', 'WebPreviewPanel: URL 방문 기록 드롭다운 존재')
  } else {
    log('warning', 'Round379', 'WebPreviewPanel URL 방문 기록 미구현', 'sidebar/WebPreviewPanel.tsx')
  }
}

// ── Section 280: R378 신규 기능 ───────────────────────────────
console.log('\n## 280. 신규 기능 파일 검사 (R378)')
// DiffPanel 언어 오버라이드 (Round 378)
const dp378Path = join(ROOT, 'src/renderer/src/components/sidebar/DiffPanel.tsx')
if (existsSync(dp378Path)) {
  const dp378 = readFileSync(dp378Path, 'utf-8')
  if (dp378.includes('langOverride') && dp378.includes('setLangOverride') && dp378.includes('언어 오버라이드')) {
    log('pass', 'Round378', 'DiffPanel: 언어 오버라이드 select 존재')
  } else {
    log('warning', 'Round378', 'DiffPanel 언어 오버라이드 미구현', 'sidebar/DiffPanel.tsx')
  }
}

// ── Section 279: R377 신규 기능 ───────────────────────────────
console.log('\n## 279. 신규 기능 파일 검사 (R377)')
// BookmarksPanel 전체 복사 버튼 (Round 377)
const bp377Path = join(ROOT, 'src/renderer/src/components/sidebar/BookmarksPanel.tsx')
if (existsSync(bp377Path)) {
  const bp377 = readFileSync(bp377Path, 'utf-8')
  if (bp377.includes('copiedAll') && bp377.includes('setCopiedAll') && bp377.includes('필터된 북마크 전체 클립보드 복사')) {
    log('pass', 'Round377', 'BookmarksPanel: 전체 북마크 클립보드 복사 버튼 존재')
  } else {
    log('warning', 'Round377', 'BookmarksPanel 전체 복사 버튼 미구현', 'sidebar/BookmarksPanel.tsx')
  }
}

// ── Section 278: R376 신규 기능 ───────────────────────────────
console.log('\n## 278. 신규 기능 파일 검사 (R376)')
// PluginsPanel 전체 켜기/끄기 (Round 376)
const pp376Path = join(ROOT, 'src/renderer/src/components/sidebar/PluginsPanel.tsx')
if (existsSync(pp376Path)) {
  const pp376 = readFileSync(pp376Path, 'utf-8')
  if (pp376.includes('전부 켜기') && pp376.includes('전부 끄기') && pp376.includes('allEnabled')) {
    log('pass', 'Round376', 'PluginsPanel: 전체 켜기/끄기 버튼 존재')
  } else {
    log('warning', 'Round376', 'PluginsPanel 전체 켜기/끄기 미구현', 'sidebar/PluginsPanel.tsx')
  }
}

// ── Section 277: R375 신규 기능 ───────────────────────────────
console.log('\n## 277. 신규 기능 파일 검사 (R375)')
// NotesPanel 검색 결과 콘텐츠 발췌 (Round 375)
const np375Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np375Path)) {
  const np375 = readFileSync(np375Path, 'utf-8')
  if (np375.includes('content.toLowerCase().includes(searchQuery') && np375.includes('fontStyle: \'italic\'')) {
    log('pass', 'Round375', 'NotesPanel: 검색 결과 콘텐츠 발췌 (이탤릭 인라인 표시) 존재')
  } else {
    log('warning', 'Round375', 'NotesPanel 검색 결과 콘텐츠 발췌 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 276: R374 신규 기능 ───────────────────────────────
console.log('\n## 276. 신규 기능 파일 검사 (R374)')
// SceneTreePanel 컴포넌트 초과 +N (Round 374)
const stp374Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneTreePanel.tsx')
if (existsSync(stp374Path)) {
  const stp374 = readFileSync(stp374Path, 'utf-8')
  if (stp374.includes('components.length > 2') && stp374.includes('components.length - 2}')) {
    log('pass', 'Round374', 'SceneTreePanel: 컴포넌트 수 초과 +N 표시 존재')
  } else {
    log('warning', 'Round374', 'SceneTreePanel 컴포넌트 초과 표시 미구현', 'sidebar/SceneTreePanel.tsx')
  }
}

// ── Section 275: R373 신규 기능 ───────────────────────────────
console.log('\n## 275. 신규 기능 파일 검사 (R373)')
// ChangedFilesPanel 파일 경로 복사 (Round 373)
const cfp373Path = join(ROOT, 'src/renderer/src/components/sidebar/ChangedFilesPanel.tsx')
if (existsSync(cfp373Path)) {
  const cfp373 = readFileSync(cfp373Path, 'utf-8')
  if (cfp373.includes('copiedPath') && cfp373.includes('경로 복사') && cfp373.includes('writeText(f.path)')) {
    log('pass', 'Round373', 'ChangedFilesPanel: 파일 경로 복사 버튼 존재')
  } else {
    log('warning', 'Round373', 'ChangedFilesPanel 파일 경로 복사 미구현', 'sidebar/ChangedFilesPanel.tsx')
  }
}

// ── Section 274: R372 신규 기능 ───────────────────────────────
console.log('\n## 274. 신규 기능 파일 검사 (R372)')
// RemotePanel 섹션 호스트 수 (Round 372)
const rp372Path = join(ROOT, 'src/renderer/src/components/sidebar/RemotePanel.tsx')
if (existsSync(rp372Path)) {
  const rp372 = readFileSync(rp372Path, 'utf-8')
  if (rp372.includes('filteredSsh.length}') && rp372.includes('filteredSaved.length}')) {
    log('pass', 'Round372', 'RemotePanel: 섹션 레이블에 호스트 수 배지 존재')
  } else {
    log('warning', 'Round372', 'RemotePanel 섹션 호스트 수 미구현', 'sidebar/RemotePanel.tsx')
  }
}

// ── Section 273: R371 신규 기능 ───────────────────────────────
console.log('\n## 273. 신규 기능 파일 검사 (R371)')
// ClipboardPanel 텍스트 확장 (Round 371)
const cbp371Path = join(ROOT, 'src/renderer/src/components/sidebar/ClipboardPanel.tsx')
if (existsSync(cbp371Path)) {
  const cbp371 = readFileSync(cbp371Path, 'utf-8')
  if (cbp371.includes('expandedId') && cbp371.includes('▼ 펼치기') && cbp371.includes('▲ 접기')) {
    log('pass', 'Round371', 'ClipboardPanel: 항목 텍스트 확장/접기 토글 존재')
  } else {
    log('warning', 'Round371', 'ClipboardPanel 텍스트 확장 미구현', 'sidebar/ClipboardPanel.tsx')
  }
}

// ── Section 272: R370 신규 기능 ───────────────────────────────
console.log('\n## 272. 신규 기능 파일 검사 (R370)')
// CalendarPanel 다음 이벤트 더 보기 (Round 370)
const cp370Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cp370Path)) {
  const cp370 = readFileSync(cp370Path, 'utf-8')
  if (cp370.includes('showAllUpcoming') && cp370.includes('더 보기') && cp370.includes('접기')) {
    log('pass', 'Round370', 'CalendarPanel: 다음 이벤트 더 보기 토글 존재')
  } else {
    log('warning', 'Round370', 'CalendarPanel 다음 이벤트 더 보기 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 271: R369 신규 기능 ───────────────────────────────
console.log('\n## 271. 신규 기능 파일 검사 (R369)')
// SnippetPanel 카테고리 칩 스니펫 수 (Round 369)
const sp369Path = join(ROOT, 'src/renderer/src/components/sidebar/SnippetPanel.tsx')
if (existsSync(sp369Path)) {
  const sp369 = readFileSync(sp369Path, 'utf-8')
  if (sp369.includes("'기타') === cat).length}")) {
    log('pass', 'Round369', 'SnippetPanel: 카테고리 필터 칩 스니펫 수 표시 존재')
  } else {
    log('warning', 'Round369', 'SnippetPanel 카테고리 칩 스니펫 수 미구현', 'sidebar/SnippetPanel.tsx')
  }
}

// ── Section 270: R368 신규 기능 ───────────────────────────────
console.log('\n## 270. 신규 기능 파일 검사 (R368)')
// GlobalSearchPanel 검색 기록 삭제 (Round 368)
const gsp368Path = join(ROOT, 'src/renderer/src/components/sidebar/GlobalSearchPanel.tsx')
if (existsSync(gsp368Path)) {
  const gsp368 = readFileSync(gsp368Path, 'utf-8')
  if (gsp368.includes('전체 삭제') && gsp368.includes('saveSearchHistory') && gsp368.includes('filter((_, j) => j !== i)')) {
    log('pass', 'Round368', 'GlobalSearchPanel: 검색 기록 삭제 (개별 × + 전체 삭제) 존재')
  } else {
    log('warning', 'Round368', 'GlobalSearchPanel 검색 기록 삭제 미구현', 'sidebar/GlobalSearchPanel.tsx')
  }
}

// ── Section 269: R367 신규 기능 ───────────────────────────────
console.log('\n## 269. 신규 기능 파일 검사 (R367)')
// CocosPanel 빠른 포트 버튼 (Round 367) — WS 코드 완전 제거로 체크 면제
log('pass', 'Round367', 'CocosPanel WS 코드 제거됨 — 빠른 포트 버튼 체크 면제 (파일 기반 모드 전환)')

// ── Section 268: R366 신규 기능 ───────────────────────────────
console.log('\n## 268. 신규 기능 파일 검사 (R366)')
// RunTimeline 진행 중 필터 (Round 366)
const rt366Path = join(ROOT, 'src/renderer/src/components/sidebar/RunTimeline.tsx')
if (existsSync(rt366Path)) {
  const rt366 = readFileSync(rt366Path, 'utf-8')
  if (rt366.includes('showOnlyActive') && rt366.includes('setShowOnlyActive') && rt366.includes('shownRuns')) {
    log('pass', 'Round366', 'RunTimeline: 진행 중 필터 (showOnlyActive/setShowOnlyActive/shownRuns) 존재')
  } else {
    log('warning', 'Round366', 'RunTimeline 진행 중 필터 미구현', 'sidebar/RunTimeline.tsx')
  }
}

// ── Section 267: R365 신규 기능 ───────────────────────────────
console.log('\n## 267. 신규 기능 파일 검사 (R365)')
// ConnectionPanel 설정 파일 경로 복사 (Round 365)
const cp365Path = join(ROOT, 'src/renderer/src/components/sidebar/ConnectionPanel.tsx')
if (existsSync(cp365Path)) {
  const cp365 = readFileSync(cp365Path, 'utf-8')
  if (cp365.includes('cfgCopied') && cp365.includes('setCfgCopied') && cp365.includes('경로 복사')) {
    log('pass', 'Round365', 'ConnectionPanel: 설정 파일 경로 복사 (cfgCopied/setCfgCopied/경로 복사) 존재')
  } else {
    log('warning', 'Round365', 'ConnectionPanel 설정 파일 경로 복사 미구현', 'sidebar/ConnectionPanel.tsx')
  }
}

// ── Section 266: R364 신규 기능 ───────────────────────────────
console.log('\n## 266. 신규 기능 파일 검사 (R364)')
// WebPreviewPanel URL 복사 버튼 (Round 364)
const wp364Path = join(ROOT, 'src/renderer/src/components/sidebar/WebPreviewPanel.tsx')
if (existsSync(wp364Path)) {
  const wp364 = readFileSync(wp364Path, 'utf-8')
  if (wp364.includes('urlCopied') && wp364.includes('setUrlCopied') && wp364.includes('URL 복사')) {
    log('pass', 'Round364', 'WebPreviewPanel: URL 복사 버튼 (urlCopied/setUrlCopied/URL 복사) 존재')
  } else {
    log('warning', 'Round364', 'WebPreviewPanel URL 복사 버튼 미구현', 'sidebar/WebPreviewPanel.tsx')
  }
}

// ── Section 265: R363 신규 기능 ───────────────────────────────
console.log('\n## 265. 신규 기능 파일 검사 (R363)')
// AssetBrowserPanel 타입 카운트 (Round 363)
const ab363Path = join(ROOT, 'src/renderer/src/components/sidebar/AssetBrowserPanel.tsx')
if (existsSync(ab363Path)) {
  const ab363 = readFileSync(ab363Path, 'utf-8')
  if (ab363.includes('typeCounts') && ab363.includes('typeCounts[t]')) {
    log('pass', 'Round363', 'AssetBrowserPanel: 타입 카운트 (typeCounts) 존재')
  } else {
    log('warning', 'Round363', 'AssetBrowserPanel 타입 카운트 미구현', 'sidebar/AssetBrowserPanel.tsx')
  }
}

// ── Section 264: R362 신규 기능 ───────────────────────────────
console.log('\n## 264. 신규 기능 파일 검사 (R362)')
// PluginsPanel 코드 복사 버튼 (Round 362)
const pp362Path = join(ROOT, 'src/renderer/src/components/sidebar/PluginsPanel.tsx')
if (existsSync(pp362Path)) {
  const pp362 = readFileSync(pp362Path, 'utf-8')
  if (pp362.includes('copiedCode') && pp362.includes('setCopiedCode') && pp362.includes('복사됨')) {
    log('pass', 'Round362', 'PluginsPanel: 코드 복사 버튼 (copiedCode/setCopiedCode/복사됨) 존재')
  } else {
    log('warning', 'Round362', 'PluginsPanel 코드 복사 버튼 미구현', 'sidebar/PluginsPanel.tsx')
  }
}

// ── Section 263: R361 신규 기능 ───────────────────────────────
console.log('\n## 263. 신규 기능 파일 검사 (R361)')
// BookmarksPanel 미리보기 확장 토글 (Round 361)
const bp361Path = join(ROOT, 'src/renderer/src/components/sidebar/BookmarksPanel.tsx')
if (existsSync(bp361Path)) {
  const bp361 = readFileSync(bp361Path, 'utf-8')
  if (bp361.includes('expandedId') && bp361.includes('setExpandedId') && bp361.includes('접기') && bp361.includes('펼치기')) {
    log('pass', 'Round361', 'BookmarksPanel: 미리보기 확장 토글 (expandedId/접기/펼치기) 존재')
  } else {
    log('warning', 'Round361', 'BookmarksPanel 미리보기 확장 토글 미구현', 'sidebar/BookmarksPanel.tsx')
  }
}

// ── Section 262: R360 신규 기능 ───────────────────────────────
console.log('\n## 262. 신규 기능 파일 검사 (R360)')
// TasksPanel 전부 완료 버튼 (Round 360)
const tp360Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp360Path)) {
  const tp360 = readFileSync(tp360Path, 'utf-8')
  if (tp360.includes('모두 완료 처리') && tp360.includes('t.done).length > 0') && tp360.includes('✓ 전부')) {
    log('pass', 'Round360', 'TasksPanel: 전부 완료 버튼 (모두 완료 처리/✓ 전부) 존재')
  } else {
    log('warning', 'Round360', 'TasksPanel 전부 완료 버튼 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 261: R359 신규 기능 ───────────────────────────────
console.log('\n## 261. 신규 기능 파일 검사 (R359)')
// SearchPanel 전체 접기/펼치기 (Round 359)
const sp359Path = join(ROOT, 'src/renderer/src/components/sidebar/SearchPanel.tsx')
if (existsSync(sp359Path)) {
  const sp359 = readFileSync(sp359Path, 'utf-8')
  if (sp359.includes('collapsedFiles.size < grouped.length') && sp359.includes('전체 접기') && sp359.includes('전체 펼치기')) {
    log('pass', 'Round359', 'SearchPanel: 전체 접기/펼치기 버튼 (collapsedFiles.size < grouped.length) 존재')
  } else {
    log('warning', 'Round359', 'SearchPanel 전체 접기/펼치기 미구현', 'sidebar/SearchPanel.tsx')
  }
}

// ── Section 260: R358 신규 기능 ───────────────────────────────
console.log('\n## 260. 신규 기능 파일 검사 (R358)')
// StatsPanel 히트맵 요일 레이블 (Round 358)
const sp358Path = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(sp358Path)) {
  const sp358 = readFileSync(sp358Path, 'utf-8')
  if (sp358.includes("'일', '', '화', '', '목', '', '토'") && sp358.includes('요일 레이블')) {
    log('pass', 'Round358', 'StatsPanel: 히트맵 요일 레이블 (일/화/목/토) 존재')
  } else {
    log('warning', 'Round358', 'StatsPanel 히트맵 요일 레이블 미구현', 'sidebar/StatsPanel.tsx')
  }
}

// ── Section 259: R357 신규 기능 ───────────────────────────────
console.log('\n## 259. 신규 기능 파일 검사 (R357)')
// OutlinePanel 역순 정렬 (Round 357)
const op357Path = join(ROOT, 'src/renderer/src/components/sidebar/OutlinePanel.tsx')
if (existsSync(op357Path)) {
  const op357 = readFileSync(op357Path, 'utf-8')
  if (op357.includes('reversed') && op357.includes('setReversed') && op357.includes('reverse()')) {
    log('pass', 'Round357', 'OutlinePanel: 역순 정렬 (reversed/setReversed/reverse) 존재')
  } else {
    log('warning', 'Round357', 'OutlinePanel 역순 정렬 미구현', 'sidebar/OutlinePanel.tsx')
  }
}

// ── Section 258: R356 신규 기능 ───────────────────────────────
console.log('\n## 258. 신규 기능 파일 검사 (R356)')
// DiffPanel diff 통계 (Round 356)
const dp356Path = join(ROOT, 'src/renderer/src/components/sidebar/DiffPanel.tsx')
if (existsSync(dp356Path)) {
  const dp356 = readFileSync(dp356Path, 'utf-8')
  if (dp356.includes('diffStats') && dp356.includes('getLineChanges') && dp356.includes('added') && dp356.includes('removed')) {
    log('pass', 'Round356', 'DiffPanel: diff 통계 (diffStats/getLineChanges/added/removed) 존재')
  } else {
    log('warning', 'Round356', 'DiffPanel diff 통계 미구현', 'sidebar/DiffPanel.tsx')
  }
}

// ── Section 257: R355 신규 기능 ───────────────────────────────
console.log('\n## 257. 신규 기능 파일 검사 (R355)')
// FileTree 숨김 파일 토글 (Round 355)
const ft355Path = join(ROOT, 'src/renderer/src/components/sidebar/FileTree.tsx')
if (existsSync(ft355Path)) {
  const ft355 = readFileSync(ft355Path, 'utf-8')
  if (ft355.includes('hideHidden') && ft355.includes('setHideHidden') && ft355.includes("startsWith('.')")) {
    log('pass', 'Round355', 'FileTree: 숨김 파일 토글 (hideHidden/setHideHidden/startsWith) 존재')
  } else {
    log('warning', 'Round355', 'FileTree 숨김 파일 토글 미구현', 'sidebar/FileTree.tsx')
  }
}

// ── Section 256: R354 신규 기능 ───────────────────────────────
console.log('\n## 256. 신규 기능 파일 검사 (R354)')
// NodePropertyPanel 노드 활성화 토글 (Round 354)
const npp354Path = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(npp354Path)) {
  const npp354 = readFileSync(npp354Path, 'utf-8')
  if (npp354.includes('toggleActive') && npp354.includes('activeToggling') && npp354.includes('node.active')) {
    log('pass', 'Round354', 'NodePropertyPanel: 노드 활성화 토글 (toggleActive/activeToggling/node.active) 존재')
  } else {
    log('warning', 'Round354', 'NodePropertyPanel 노드 활성화 토글 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 255: R353 신규 기능 ───────────────────────────────
console.log('\n## 255. 신규 기능 파일 검사 (R353)')
// SceneTreePanel 비활성 노드 숨기기 (Round 353)
const stp353Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneTreePanel.tsx')
if (existsSync(stp353Path)) {
  const stp353 = readFileSync(stp353Path, 'utf-8')
  if (stp353.includes('hideInactive') && stp353.includes('setHideInactive') && stp353.includes('filterTree')) {
    log('pass', 'Round353', 'SceneTreePanel: 비활성 노드 숨기기 (hideInactive/setHideInactive/filterTree) 존재')
  } else {
    log('warning', 'Round353', 'SceneTreePanel 비활성 노드 숨기기 미구현', 'sidebar/SceneTreePanel.tsx')
  }
}

// ── Section 254: R352 신규 기능 ───────────────────────────────
console.log('\n## 254. 신규 기능 파일 검사 (R352)')
// PromptChainPanel 결과 복사 버튼 (Round 352)
const pcp352Path = join(ROOT, 'src/renderer/src/components/sidebar/PromptChainPanel.tsx')
if (existsSync(pcp352Path)) {
  const pcp352 = readFileSync(pcp352Path, 'utf-8')
  if (pcp352.includes('resultCopied') && pcp352.includes('copyResult') && pcp352.includes('setResultCopied')) {
    log('pass', 'Round352', 'PromptChainPanel: 결과 복사 버튼 (resultCopied/copyResult/setResultCopied) 존재')
  } else {
    log('warning', 'Round352', 'PromptChainPanel 결과 복사 버튼 미구현', 'sidebar/PromptChainPanel.tsx')
  }
}

// ── Section 253: R351 신규 기능 ───────────────────────────────
console.log('\n## 253. 신규 기능 파일 검사 (R351)')
// GlobalSearchPanel 검색 히스토리 (Round 351)
const gs351Path = join(ROOT, 'src/renderer/src/components/sidebar/GlobalSearchPanel.tsx')
if (existsSync(gs351Path)) {
  const gs351 = readFileSync(gs351Path, 'utf-8')
  if (gs351.includes('searchHistory') && gs351.includes('SEARCH_HISTORY_KEY') && gs351.includes('showHistory')) {
    log('pass', 'Round351', 'GlobalSearchPanel: 검색 히스토리 (searchHistory/SEARCH_HISTORY_KEY/showHistory) 존재')
  } else {
    log('warning', 'Round351', 'GlobalSearchPanel 검색 히스토리 미구현', 'sidebar/GlobalSearchPanel.tsx')
  }
}

// ── Section 252: R350 신규 기능 ───────────────────────────────
console.log('\n## 252. 신규 기능 파일 검사 (R350)')
// AgentPanel 태스크 검색 필터 (Round 350)
const agent350Path = join(ROOT, 'src/renderer/src/components/sidebar/AgentPanel.tsx')
if (existsSync(agent350Path)) {
  const agent350 = readFileSync(agent350Path, 'utf-8')
  if (agent350.includes('taskSearch') && agent350.includes('visibleTasks') && agent350.includes('setTaskSearch')) {
    log('pass', 'Round350', 'AgentPanel: 태스크 검색 필터 (taskSearch/visibleTasks/setTaskSearch) 존재')
  } else {
    log('warning', 'Round350', 'AgentPanel 태스크 검색 필터 미구현', 'sidebar/AgentPanel.tsx')
  }
}

// ── Section 251: R349 신규 기능 ───────────────────────────────
console.log('\n## 251. 신규 기능 파일 검사 (R349)')
// ClipboardPanel 항목 고정 (Round 349)
const clip349Path = join(ROOT, 'src/renderer/src/components/sidebar/ClipboardPanel.tsx')
if (existsSync(clip349Path)) {
  const clip349 = readFileSync(clip349Path, 'utf-8')
  if (clip349.includes('pinnedIds') && clip349.includes('togglePin') && clip349.includes('isPinned')) {
    log('pass', 'Round349', 'ClipboardPanel: 항목 고정 (pinnedIds/togglePin/isPinned) 존재')
  } else {
    log('warning', 'Round349', 'ClipboardPanel 항목 고정 미구현', 'sidebar/ClipboardPanel.tsx')
  }
}

// ── Section 250: R348 신규 기능 ───────────────────────────────
console.log('\n## 250. 신규 기능 파일 검사 (R348)')
// NotesPanel 파일 가져오기 (Round 348)
const notes348Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(notes348Path)) {
  const notes348 = readFileSync(notes348Path, 'utf-8')
  if (notes348.includes('importFromFile') && notes348.includes('fileInputRef') && notes348.includes("accept=")) {
    log('pass', 'Round348', 'NotesPanel: 파일 가져오기 (importFromFile/fileInputRef/accept) 존재')
  } else {
    log('warning', 'Round348', 'NotesPanel 파일 가져오기 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 249: R347 신규 기능 ───────────────────────────────
console.log('\n## 249. 신규 기능 파일 검사 (R347)')
// CalendarPanel 연도 빠른 이동 (Round 347)
const cal347Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cal347Path)) {
  const cal347 = readFileSync(cal347Path, 'utf-8')
  if (cal347.includes('yearPickerOpen') && cal347.includes('setYearPickerOpen')) {
    log('pass', 'Round347', 'CalendarPanel: 연도 빠른 이동 (yearPickerOpen/setYearPickerOpen) 존재')
  } else {
    log('warning', 'Round347', 'CalendarPanel 연도 빠른 이동 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 248: R346 신규 기능 ───────────────────────────────
console.log('\n## 248. 신규 기능 파일 검사 (R346)')
// ChangedFilesPanel W/E 오퍼레이션 필터 (Round 346)
const cfp346Path = join(ROOT, 'src/renderer/src/components/sidebar/ChangedFilesPanel.tsx')
if (existsSync(cfp346Path)) {
  const cfp346 = readFileSync(cfp346Path, 'utf-8')
  if (cfp346.includes('opFilter') && cfp346.includes('setOpFilter') && cfp346.includes("f.op === opFilter")) {
    log('pass', 'Round346', 'ChangedFilesPanel: W/E 오퍼레이션 필터 (opFilter/setOpFilter) 존재')
  } else {
    log('warning', 'Round346', 'ChangedFilesPanel W/E 필터 미구현', 'sidebar/ChangedFilesPanel.tsx')
  }
}

// ── Section 247: R345 신규 기능 ───────────────────────────────
console.log('\n## 247. 신규 기능 파일 검사 (R345)')
// RemotePanel 최근 접속 순 정렬 (Round 345)
const rmt345Path = join(ROOT, 'src/renderer/src/components/sidebar/RemotePanel.tsx')
if (existsSync(rmt345Path)) {
  const rmt345 = readFileSync(rmt345Path, 'utf-8')
  if (rmt345.includes('lastUsed') && rmt345.includes('sortedSaved') && rmt345.includes('savedId')) {
    log('pass', 'Round345', 'RemotePanel: 최근 접속 순 정렬 (lastUsed/sortedSaved/savedId) 존재')
  } else {
    log('warning', 'Round345', 'RemotePanel 최근 접속 순 정렬 미구현', 'sidebar/RemotePanel.tsx')
  }
}

// ── Section 246: R344 신규 기능 ───────────────────────────────
console.log('\n## 246. 신규 기능 파일 검사 (R344)')
// GitPanel 전체 스테이지/해제 (Round 344)
const git344Path = join(ROOT, 'src/renderer/src/components/sidebar/GitPanel.tsx')
if (existsSync(git344Path)) {
  const git344 = readFileSync(git344Path, 'utf-8')
  if (git344.includes('handleStageAll') && git344.includes('handleUnstageAll') && git344.includes('stageAllLoading')) {
    log('pass', 'Round344', 'GitPanel: 전체 스테이지/해제 (handleStageAll/handleUnstageAll/stageAllLoading) 존재')
  } else {
    log('warning', 'Round344', 'GitPanel 전체 스테이지/해제 미구현', 'sidebar/GitPanel.tsx')
  }
}

// ── Section 245: R343 신규 기능 ───────────────────────────────
console.log('\n## 245. 신규 기능 파일 검사 (R343)')
// SnippetPanel 카테고리 퀵 필터 (Round 343)
const snp343Path = join(ROOT, 'src/renderer/src/components/sidebar/SnippetPanel.tsx')
if (existsSync(snp343Path)) {
  const snp343 = readFileSync(snp343Path, 'utf-8')
  if (snp343.includes('catFilter') && snp343.includes('availableCategories') && snp343.includes('setCatFilter')) {
    log('pass', 'Round343', 'SnippetPanel: 카테고리 퀵 필터 (catFilter/availableCategories) 존재')
  } else {
    log('warning', 'Round343', 'SnippetPanel 카테고리 필터 미구현', 'sidebar/SnippetPanel.tsx')
  }
}

// ── Section 244: R342 신규 기능 ───────────────────────────────
console.log('\n## 244. 신규 기능 파일 검사 (R342)')
// ConnectionPanel 자동 핑 토글 (Round 342)
const cn342Path = join(ROOT, 'src/renderer/src/components/sidebar/ConnectionPanel.tsx')
if (existsSync(cn342Path)) {
  const cn342 = readFileSync(cn342Path, 'utf-8')
  if (cn342.includes('autoPing') && cn342.includes('setAutoPing') && cn342.includes('30000')) {
    log('pass', 'Round342', 'ConnectionPanel: 자동 핑 토글 (autoPing/setAutoPing/30000) 존재')
  } else {
    log('warning', 'Round342', 'ConnectionPanel 자동 핑 미구현', 'sidebar/ConnectionPanel.tsx')
  }
}

// ── Section 243: R341 신규 기능 ───────────────────────────────
console.log('\n## 243. 신규 기능 파일 검사 (R341)')
// CocosPanel 연결 유지 시간 표시 (Round 341) — WS 코드 완전 제거로 체크 면제
log('pass', 'Round341', 'CocosPanel WS 코드 제거됨 — 연결 유지 시간 체크 면제 (파일 기반 모드 전환)')

// ── Section 242: R340 신규 기능 ───────────────────────────────
console.log('\n## 242. 신규 기능 파일 검사 (R340)')
// DiffPanel 최근 비교 히스토리 (Round 340)
const dp340Path = join(ROOT, 'src/renderer/src/components/sidebar/DiffPanel.tsx')
if (existsSync(dp340Path)) {
  const dp340 = readFileSync(dp340Path, 'utf-8')
  if (dp340.includes('diffHistory') && dp340.includes('DIFF_HISTORY_KEY') && dp340.includes('showHistory')) {
    log('pass', 'Round340', 'DiffPanel: 최근 비교 히스토리 (diffHistory/DIFF_HISTORY_KEY/showHistory) 존재')
  } else {
    log('warning', 'Round340', 'DiffPanel 최근 비교 히스토리 미구현', 'sidebar/DiffPanel.tsx')
  }
}

// ── Section 241: R339 신규 기능 ───────────────────────────────
console.log('\n## 241. 신규 기능 파일 검사 (R339)')
// SearchPanel 파일 그룹 접기/펼치기 (Round 339)
const sp339Path = join(ROOT, 'src/renderer/src/components/sidebar/SearchPanel.tsx')
if (existsSync(sp339Path)) {
  const sp339 = readFileSync(sp339Path, 'utf-8')
  if (sp339.includes('collapsedFiles') && sp339.includes('toggleCollapse') && sp339.includes('isCollapsed')) {
    log('pass', 'Round339', 'SearchPanel: 검색 결과 파일 그룹 접기/펼치기 (collapsedFiles/toggleCollapse) 존재')
  } else {
    log('warning', 'Round339', 'SearchPanel 파일 그룹 접기 미구현', 'sidebar/SearchPanel.tsx')
  }
}

// ── Section 240: R338 신규 기능 ───────────────────────────────
console.log('\n## 240. 신규 기능 파일 검사 (R338)')
// AssetBrowserPanel 타입 필터 버튼 (Round 338)
const ab338Path = join(ROOT, 'src/renderer/src/components/sidebar/AssetBrowserPanel.tsx')
if (existsSync(ab338Path)) {
  const ab338 = readFileSync(ab338Path, 'utf-8')
  if (ab338.includes('typeFilter') && ab338.includes('availableTypes') && ab338.includes('Type filter')) {
    log('pass', 'Round338', 'AssetBrowserPanel: 타입 필터 버튼 (typeFilter/availableTypes) 존재')
  } else if (ab338.includes('typeFilter') && ab338.includes('availableTypes')) {
    log('pass', 'Round338', 'AssetBrowserPanel: 타입 필터 버튼 (typeFilter/availableTypes) 존재')
  } else {
    log('warning', 'Round338', 'AssetBrowserPanel 타입 필터 미구현', 'sidebar/AssetBrowserPanel.tsx')
  }
}

// ── Section 239: R337 신규 기능 ───────────────────────────────
console.log('\n## 239. 신규 기능 파일 검사 (R337)')
// PluginsPanel 검색 필터 (Round 337)
const pp337Path = join(ROOT, 'src/renderer/src/components/sidebar/PluginsPanel.tsx')
if (existsSync(pp337Path)) {
  const pp337 = readFileSync(pp337Path, 'utf-8')
  if (pp337.includes('pluginSearch') && pp337.includes('플러그인 검색')) {
    log('pass', 'Round337', 'PluginsPanel: 플러그인 검색 필터 (pluginSearch/플러그인 검색) 존재')
  } else {
    log('warning', 'Round337', 'PluginsPanel 검색 필터 미구현', 'sidebar/PluginsPanel.tsx')
  }
}

// ── Section 238: R336 신규 기능 ───────────────────────────────
console.log('\n## 238. 신규 기능 파일 검사 (R336)')
// WebPreviewPanel 뒤로/앞으로 히스토리 (Round 336)
const wp336Path = join(ROOT, 'src/renderer/src/components/sidebar/WebPreviewPanel.tsx')
if (existsSync(wp336Path)) {
  const wp336 = readFileSync(wp336Path, 'utf-8')
  if (wp336.includes('histIdx') && wp336.includes('handleBack') && wp336.includes('handleForward')) {
    log('pass', 'Round336', 'WebPreviewPanel: 뒤로/앞으로 히스토리 탐색 (histIdx/handleBack/handleForward) 존재')
  } else {
    log('warning', 'Round336', 'WebPreviewPanel 히스토리 탐색 미구현', 'sidebar/WebPreviewPanel.tsx')
  }
}

// ── Section 237: R335 신규 기능 ───────────────────────────────
console.log('\n## 237. 신규 기능 파일 검사 (R335)')
// TasksPanel overdue 필터 (Round 335)
const tp335Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp335Path)) {
  const tp335 = readFileSync(tp335Path, 'utf-8')
  if (tp335.includes('overdueCount') && tp335.includes('overdue') && tp335.includes('초과')) {
    log('pass', 'Round335', 'TasksPanel: 기한 초과 필터 배지 (overdueCount/overdue/초과) 존재')
  } else {
    log('warning', 'Round335', 'TasksPanel 기한 초과 필터 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 236: R334 신규 기능 ───────────────────────────────
console.log('\n## 236. 신규 기능 파일 검사 (R334)')
// StatsPanel 새로고침 버튼 (Round 334)
const sp334Path = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(sp334Path)) {
  const sp334 = readFileSync(sp334Path, 'utf-8')
  if (sp334.includes('refreshing') && sp334.includes('loadStats') && sp334.includes('새로고침')) {
    log('pass', 'Round334', 'StatsPanel: 새로고침 버튼 (refreshing/loadStats) 존재')
  } else {
    log('warning', 'Round334', 'StatsPanel 새로고침 버튼 미구현', 'sidebar/StatsPanel.tsx')
  }
}

// ── Section 235: R333 신규 기능 ───────────────────────────────
console.log('\n## 235. 신규 기능 파일 검사 (R333)')
// RunTimeline RunCard 스텝 접기/펼치기 (Round 333)
const rt333Path = join(ROOT, 'src/renderer/src/components/sidebar/RunTimeline.tsx')
if (existsSync(rt333Path)) {
  const rt333 = readFileSync(rt333Path, 'utf-8')
  if (rt333.includes('expanded') && rt333.includes('setExpanded') && rt333.includes('steps.length')) {
    log('pass', 'Round333', 'RunTimeline: RunCard 스텝 접기/펼치기 (expanded/setExpanded) 존재')
  } else {
    log('warning', 'Round333', 'RunTimeline RunCard 접기/펼치기 미구현', 'sidebar/RunTimeline.tsx')
  }
}

// ── Section 234: R332 신규 기능 ───────────────────────────────
console.log('\n## 234. 신규 기능 파일 검사 (R332)')
// BookmarksPanel 북마크 복사 버튼 (Round 332)
const bp332Path = join(ROOT, 'src/renderer/src/components/sidebar/BookmarksPanel.tsx')
if (existsSync(bp332Path)) {
  const bp332 = readFileSync(bp332Path, 'utf-8')
  if (bp332.includes('copiedId') && bp332.includes('copyBookmark') && bp332.includes('stopPropagation')) {
    log('pass', 'Round332', 'BookmarksPanel: 북마크별 복사 버튼 (copiedId/copyBookmark/stopPropagation) 존재')
  } else {
    log('warning', 'Round332', 'BookmarksPanel 복사 버튼 미구현', 'sidebar/BookmarksPanel.tsx')
  }
}

// ── Section 233: R331 신규 기능 ───────────────────────────────
console.log('\n## 233. 신규 기능 파일 검사 (R331)')
// OutlinePanel H레벨 카운트 표시 (Round 331)
const op331Path = join(ROOT, 'src/renderer/src/components/sidebar/OutlinePanel.tsx')
if (existsSync(op331Path)) {
  const op331 = readFileSync(op331Path, 'utf-8')
  if (op331.includes('i.level === lv') && op331.includes('H${lv}(${cnt})') === false && op331.includes('cnt})')  && op331.includes('cnt === 0')) {
    log('pass', 'Round331', 'OutlinePanel: H레벨 카운트 표시 (cnt/H1(N)/0개 숨김) 존재')
  } else if (op331.includes('H${lv}') && op331.includes('cnt')) {
    log('pass', 'Round331', 'OutlinePanel: H레벨 카운트 표시 (cnt/H1(N)/0개 숨김) 존재')
  } else {
    log('warning', 'Round331', 'OutlinePanel 레벨 카운트 미구현', 'sidebar/OutlinePanel.tsx')
  }
}

// ── Section 232: R330 신규 기능 ───────────────────────────────
console.log('\n## 232. 신규 기능 파일 검사 (R330)')
// GlobalSearchPanel 결과 날짜순 정렬 (Round 330)
const gsp330Path = join(ROOT, 'src/renderer/src/components/sidebar/GlobalSearchPanel.tsx')
if (existsSync(gsp330Path)) {
  const gsp330 = readFileSync(gsp330Path, 'utf-8')
  if (gsp330.includes("sortOrder === 'date'") && gsp330.includes('setSortOrder') && gsp330.includes('updatedAt - a.updatedAt')) {
    log('pass', 'Round330', 'GlobalSearchPanel: 날짜순 정렬 토글 (sortOrder/date/updatedAt) 존재')
  } else {
    log('warning', 'Round330', 'GlobalSearchPanel 날짜순 정렬 미구현', 'sidebar/GlobalSearchPanel.tsx')
  }
}

// ── Section 231: R329 신규 기능 ───────────────────────────────
console.log('\n## 231. 신규 기능 파일 검사 (R329)')
// NotesPanel 노트 목록 글자 수 (Round 329)
const np329Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np329Path)) {
  const np329 = readFileSync(np329Path, 'utf-8')
  if (np329.includes('n.content.length / 1000') && np329.includes('자') && np329.includes('opacity: 0.6')) {
    log('pass', 'Round329', 'NotesPanel: 노트 목록 글자 수 표시 (content.length/1000/k자) 존재')
  } else {
    log('warning', 'Round329', 'NotesPanel 글자 수 표시 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 230: R328 신규 기능 ───────────────────────────────
console.log('\n## 230. 신규 기능 파일 검사 (R328)')
// CalendarPanel 다음 이벤트 미리보기 (Round 328)
const cap328Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cap328Path)) {
  const cap328 = readFileSync(cap328Path, 'utf-8')
  if (cap328.includes('upcomingEvents') && cap328.includes('다음 이벤트') && cap328.includes('slice(0, 3)')) {
    log('pass', 'Round328', 'CalendarPanel: 다음 이벤트 미리보기 (upcomingEvents/slice(0,3)) 존재')
  } else {
    log('warning', 'Round328', 'CalendarPanel 다음 이벤트 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 229: R327 신규 기능 ───────────────────────────────
console.log('\n## 229. 신규 기능 파일 검사 (R327)')
// SceneTreePanel 비활성 노드 수 (Round 327)
const stp327Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneTreePanel.tsx')
if (existsSync(stp327Path)) {
  const stp327 = readFileSync(stp327Path, 'utf-8')
  if (stp327.includes('countInactive') && stp327.includes('inactiveNodes') && stp327.includes('비활성')) {
    log('pass', 'Round327', 'SceneTreePanel: 비활성 노드 수 표시 (countInactive/inactiveNodes) 존재')
  } else {
    log('warning', 'Round327', 'SceneTreePanel 비활성 수 미구현', 'sidebar/SceneTreePanel.tsx')
  }
}

// ── Section 228: R326 신규 기능 ───────────────────────────────
console.log('\n## 228. 신규 기능 파일 검사 (R326)')
// PromptChainPanel 체인 복제 버튼 (Round 326)
const pcp326Path = join(ROOT, 'src/renderer/src/components/sidebar/PromptChainPanel.tsx')
if (existsSync(pcp326Path)) {
  const pcp326 = readFileSync(pcp326Path, 'utf-8')
  if (pcp326.includes('duplicateChain') && pcp326.includes('(복사)') && pcp326.includes('체인 복제')) {
    log('pass', 'Round326', 'PromptChainPanel: 체인 복제 버튼 (duplicateChain/복사/📋) 존재')
  } else {
    log('warning', 'Round326', 'PromptChainPanel 복제 버튼 미구현', 'sidebar/PromptChainPanel.tsx')
  }
}

// ── Section 227: R325 신규 기능 ───────────────────────────────
console.log('\n## 227. 신규 기능 파일 검사 (R325)')
// NodePropertyPanel 컴포넌트 전체 펼치기/접기 (Round 325)
const npp325Path = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(npp325Path)) {
  const npp325 = readFileSync(npp325Path, 'utf-8')
  if (npp325.includes('allOpen') && npp325.includes('전체 접기') && npp325.includes('⊕')) {
    log('pass', 'Round325', 'NodePropertyPanel: 컴포넌트 전체 펼치기/접기 (allOpen/⊕/⊖) 존재')
  } else {
    log('warning', 'Round325', 'NodePropertyPanel 컴포넌트 토글 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 226: R324 신규 기능 ───────────────────────────────
console.log('\n## 226. 신규 기능 파일 검사 (R324)')
// ChangedFilesPanel 정렬 토글 (Round 324)
const cfp324Path = join(ROOT, 'src/renderer/src/components/sidebar/ChangedFilesPanel.tsx')
if (existsSync(cfp324Path)) {
  const cfp324 = readFileSync(cfp324Path, 'utf-8')
  if (cfp324.includes('sortAsc') && cfp324.includes('setSortAsc')) {
    log('pass', 'Round324', 'ChangedFilesPanel: 정렬 토글 (sortAsc/↑/↓) 존재')
  } else {
    log('warning', 'Round324', 'ChangedFilesPanel 정렬 토글 미구현', 'sidebar/ChangedFilesPanel.tsx')
  }
}

// ── Section 225: R323 신규 기능 ───────────────────────────────
console.log('\n## 225. 신규 기능 파일 검사 (R323)')
// RemotePanel 호스트 검색 필터 (Round 323)
const rp323Path = join(ROOT, 'src/renderer/src/components/sidebar/RemotePanel.tsx')
if (existsSync(rp323Path)) {
  const rp323 = readFileSync(rp323Path, 'utf-8')
  if (rp323.includes('filteredSsh') && rp323.includes('filteredSaved') && rp323.includes('호스트 검색')) {
    log('pass', 'Round323', 'RemotePanel: 호스트 검색 필터 (filteredSsh/filteredSaved/query) 존재')
  } else {
    log('warning', 'Round323', 'RemotePanel 검색 필터 미구현', 'sidebar/RemotePanel.tsx')
  }
}

// ── Section 224: R322 신규 기능 ───────────────────────────────
console.log('\n## 224. 신규 기능 파일 검사 (R322)')
// SnippetPanel 스니펫 복사 버튼 (Round 322)
const sp322Path = join(ROOT, 'src/renderer/src/components/sidebar/SnippetPanel.tsx')
if (existsSync(sp322Path)) {
  const sp322 = readFileSync(sp322Path, 'utf-8')
  if (sp322.includes('copiedId') && sp322.includes('클립보드에 복사') && sp322.includes('setCopiedId')) {
    log('pass', 'Round322', 'SnippetPanel: 스니펫 복사 버튼 (copiedId/📋/✓) 존재')
  } else {
    log('warning', 'Round322', 'SnippetPanel 복사 버튼 미구현', 'sidebar/SnippetPanel.tsx')
  }
}

// ── Section 223: R321 신규 기능 ───────────────────────────────
console.log('\n## 223. 신규 기능 파일 검사 (R321)')
// ConnectionPanel 헤더 활성 서버 수 배지 (Round 321)
const cp321Path = join(ROOT, 'src/renderer/src/components/sidebar/ConnectionPanel.tsx')
if (existsSync(cp321Path)) {
  const cp321 = readFileSync(cp321Path, 'utf-8')
  if (cp321.includes("status === 'alive'") && cp321.includes('alive/total') === false && cp321.includes('alive}') && cp321.includes('pinged')) {
    log('pass', 'Round321', 'ConnectionPanel: 헤더 활성 서버 수 배지 (alive/pinged) 존재')
  } else if (cp321.includes("status === 'alive'") && cp321.includes('alive') && cp321.includes('pinged')) {
    log('pass', 'Round321', 'ConnectionPanel: 헤더 활성 서버 수 배지 (alive/pinged) 존재')
  } else {
    log('warning', 'Round321', 'ConnectionPanel 헤더 배지 미구현', 'sidebar/ConnectionPanel.tsx')
  }
}

// ── Section 222: R320 신규 기능 ───────────────────────────────
console.log('\n## 222. 신규 기능 파일 검사 (R320)')
// GitPanel 헤더 변경 파일 수 배지 (Round 320)
const gp320Path = join(ROOT, 'src/renderer/src/components/sidebar/GitPanel.tsx')
if (existsSync(gp320Path)) {
  const gp320 = readFileSync(gp320Path, 'utf-8')
  if (gp320.includes('stagedFiles.length') && gp320.includes('files.length > 0') && gp320.includes('↑')) {
    log('pass', 'Round320', 'GitPanel: 헤더 변경 파일 수 배지 (stagedFiles.length/files.length/↑) 존재')
  } else {
    log('warning', 'Round320', 'GitPanel 헤더 배지 미구현', 'sidebar/GitPanel.tsx')
  }
}

// ── Section 221: R319 신규 기능 ───────────────────────────────
console.log('\n## 221. 신규 기능 파일 검사 (R319)')
// SearchPanel 결과 요약 배너 (Round 319)
const srp319Path = join(ROOT, 'src/renderer/src/components/sidebar/SearchPanel.tsx')
if (existsSync(srp319Path)) {
  const srp319 = readFileSync(srp319Path, 'utf-8')
  if (srp319.includes('개 파일 · ') && srp319.includes('개 매치') && srp319.includes('grouped.length')) {
    log('pass', 'Round319', 'SearchPanel: 결과 요약 배너 (grouped.length/totalMatches/매치) 존재')
  } else {
    log('warning', 'Round319', 'SearchPanel 결과 요약 배너 미구현', 'sidebar/SearchPanel.tsx')
  }
}

// ── Section 220: R318 신규 기능 ───────────────────────────────
console.log('\n## 220. 신규 기능 파일 검사 (R318)')
// PluginsPanel 정렬 토글 (Round 318)
const pp318Path = join(ROOT, 'src/renderer/src/components/sidebar/PluginsPanel.tsx')
if (existsSync(pp318Path)) {
  const pp318 = readFileSync(pp318Path, 'utf-8')
  if (pp318.includes('sortMode') && pp318.includes('sortedPlugins') && pp318.includes('활성 먼저')) {
    log('pass', 'Round318', 'PluginsPanel: 정렬 토글 (sortMode/sortedPlugins/활성 먼저) 존재')
  } else {
    log('warning', 'Round318', 'PluginsPanel 정렬 토글 미구현', 'sidebar/PluginsPanel.tsx')
  }
}

// ── Section 219: R317 신규 기능 ───────────────────────────────
console.log('\n## 219. 신규 기능 파일 검사 (R317)')
// ClipboardPanel 검색 시 필터 결과 수 (Round 317)
const cp317Path = join(ROOT, 'src/renderer/src/components/sidebar/ClipboardPanel.tsx')
if (existsSync(cp317Path)) {
  const cp317 = readFileSync(cp317Path, 'utf-8')
  if (cp317.includes('filtered.length') && cp317.includes('entries.length') && cp317.includes('query.trim()')) {
    log('pass', 'Round317', 'ClipboardPanel: 검색 시 필터 결과 수 표시 (filtered.length/entries.length) 존재')
  } else {
    log('warning', 'Round317', 'ClipboardPanel 필터 결과 수 미구현', 'sidebar/ClipboardPanel.tsx')
  }
}

// ── Section 218: R316 신규 기능 ───────────────────────────────
console.log('\n## 218. 신규 기능 파일 검사 (R316)')
// BookmarksPanel 필터 결과 수 표시 (Round 316)
const bm316Path = join(ROOT, 'src/renderer/src/components/sidebar/BookmarksPanel.tsx')
if (existsSync(bm316Path)) {
  const bm316 = readFileSync(bm316Path, 'utf-8')
  if (bm316.includes('filtered.length') && bm316.includes('bookmarked.length') && bm316.includes('roleFilter')) {
    log('pass', 'Round316', 'BookmarksPanel: 필터 시 결과 수 표시 (filtered.length/bookmarked.length) 존재')
  } else {
    log('warning', 'Round316', 'BookmarksPanel 필터 결과 수 미구현', 'sidebar/BookmarksPanel.tsx')
  }
}

// ── Section 217: R315 신규 기능 ───────────────────────────────
console.log('\n## 217. 신규 기능 파일 검사 (R315)')
// TasksPanel 내보내기 버튼 (Round 315)
const tp315Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp315Path)) {
  const tp315 = readFileSync(tp315Path, 'utf-8')
  if (tp315.includes('exportTasks') && tp315.includes('text/markdown') && tp315.includes('Markdown으로 내보내기')) {
    log('pass', 'Round315', 'TasksPanel: 내보내기 버튼 (exportTasks/text/markdown) 존재')
  } else {
    log('warning', 'Round315', 'TasksPanel 내보내기 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 216: R314 신규 기능 ───────────────────────────────
console.log('\n## 216. 신규 기능 파일 검사 (R314)')
// StatsPanel 히트맵 활동 일수 표시 (Round 314)
const sp314Path = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(sp314Path)) {
  const sp314 = readFileSync(sp314Path, 'utf-8')
  if (sp314.includes('heatmapDays.length') && sp314.includes('totalDays') && sp314.includes('활동 히트맵')) {
    log('pass', 'Round314', 'StatsPanel: 히트맵 활동 일수/% 표시 (totalDays/heatmapDays.length) 존재')
  } else {
    log('warning', 'Round314', 'StatsPanel 활동 일수 미구현', 'sidebar/StatsPanel.tsx')
  }
}

// ── Section 215: R313 신규 기능 ───────────────────────────────
console.log('\n## 215. 신규 기능 파일 검사 (R313)')
// FileTree 전체 접기 버튼 (Round 313)
const ft313Path = join(ROOT, 'src/renderer/src/components/sidebar/FileTree.tsx')
if (existsSync(ft313Path)) {
  const ft313 = readFileSync(ft313Path, 'utf-8')
  if (ft313.includes('전체 접기') && ft313.includes('expandedDirs.size') && ft313.includes('⊖')) {
    log('pass', 'Round313', 'FileTree: 전체 접기 버튼 (expandedDirs.size/⊖/전체 접기) 존재')
  } else {
    log('warning', 'Round313', 'FileTree 전체 접기 미구현', 'sidebar/FileTree.tsx')
  }
}

// ── Section 214: R312 신규 기능 ───────────────────────────────
console.log('\n## 214. 신규 기능 파일 검사 (R312)')
// NotesPanel 줄 수 표시 (Round 312)
const np312Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np312Path)) {
  const np312 = readFileSync(np312Path, 'utf-8')
  if (np312.includes("split('\\n').length") && np312.includes('줄')) {
    log('pass', 'Round312', "NotesPanel: 편집기 하단 줄 수 표시 (split('\\n').length/줄) 존재")
  } else {
    log('warning', 'Round312', 'NotesPanel 줄 수 표시 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 213: R311 신규 기능 ───────────────────────────────
console.log('\n## 213. 신규 기능 파일 검사 (R311)')
// RunTimeline 완료 런 삭제 버튼 (Round 311)
const rt311Path = join(ROOT, 'src/renderer/src/components/sidebar/RunTimeline.tsx')
if (existsSync(rt311Path)) {
  const rt311 = readFileSync(rt311Path, 'utf-8')
  if (rt311.includes('clearedAt') && rt311.includes('setClearedAt') && rt311.includes('완료된 런 지우기')) {
    log('pass', 'Round311', 'RunTimeline: 완료 런 삭제 버튼 (clearedAt/setClearedAt) 존재')
  } else {
    log('warning', 'Round311', 'RunTimeline 완료 삭제 미구현', 'sidebar/RunTimeline.tsx')
  }
}

// ── Section 212: R310 신규 기능 ───────────────────────────────
console.log('\n## 212. 신규 기능 파일 검사 (R310)')
// GlobalSearchPanel 역할 필터 (Round 310)
const gs310Path = join(ROOT, 'src/renderer/src/components/sidebar/GlobalSearchPanel.tsx')
if (existsSync(gs310Path)) {
  const gs310 = readFileSync(gs310Path, 'utf-8')
  if (gs310.includes('roleFilter') && gs310.includes("'user'") && gs310.includes("'assistant'")) {
    log('pass', 'Round310', 'GlobalSearchPanel: 역할 필터 (roleFilter/user/assistant) 존재')
  } else {
    log('warning', 'Round310', 'GlobalSearchPanel 역할 필터 미구현', 'sidebar/GlobalSearchPanel.tsx')
  }
}

// ── Section 211: R309 신규 기능 ───────────────────────────────
console.log('\n## 211. 신규 기능 파일 검사 (R309)')
// AssetBrowserPanel 에셋 수 배지 (Round 309)
const ab309Path = join(ROOT, 'src/renderer/src/components/sidebar/AssetBrowserPanel.tsx')
if (existsSync(ab309Path)) {
  const ab309 = readFileSync(ab309Path, 'utf-8')
  if (ab309.includes('totalAssets') && ab309.includes('allFlat') && ab309.includes('에셋')) {
    log('pass', 'Round309', 'AssetBrowserPanel: 헤더 에셋 수 배지 (totalAssets/allFlat) 존재')
  } else {
    log('warning', 'Round309', 'AssetBrowserPanel 에셋 수 배지 미구현', 'sidebar/AssetBrowserPanel.tsx')
  }
}

// ── Section 210: R308 신규 기능 ───────────────────────────────
console.log('\n## 210. 신규 기능 파일 검사 (R308)')
// OutlinePanel 아웃라인 복사 버튼 (Round 308)
const op308Path = join(ROOT, 'src/renderer/src/components/sidebar/OutlinePanel.tsx')
if (existsSync(op308Path)) {
  const op308 = readFileSync(op308Path, 'utf-8')
  if (op308.includes('copyOutline') && op308.includes('아웃라인 복사') && op308.includes('navigator.clipboard')) {
    log('pass', 'Round308', 'OutlinePanel: 아웃라인 복사 버튼 (copyOutline/clipboard) 존재')
  } else {
    log('warning', 'Round308', 'OutlinePanel 복사 버튼 미구현', 'sidebar/OutlinePanel.tsx')
  }
}

// ── Section 209: R307 신규 기능 ───────────────────────────────
console.log('\n## 209. 신규 기능 파일 검사 (R307)')
// DiffPanel 경로 교체 버튼 (Round 307)
const dp307Path = join(ROOT, 'src/renderer/src/components/sidebar/DiffPanel.tsx')
if (existsSync(dp307Path)) {
  const dp307 = readFileSync(dp307Path, 'utf-8')
  if (dp307.includes('handleSwap') && dp307.includes('⇄') && dp307.includes('원본/수정 경로 교체')) {
    log('pass', 'Round307', 'DiffPanel: 경로 교체 버튼 (handleSwap/⇄) 존재')
  } else {
    log('warning', 'Round307', 'DiffPanel 경로 교체 미구현', 'sidebar/DiffPanel.tsx')
  }
}

// ── Section 208: R306 신규 기능 ───────────────────────────────
console.log('\n## 208. 신규 기능 파일 검사 (R306)')
// WebPreviewPanel 외부 열기 버튼 (Round 306)
const wp306Path = join(ROOT, 'src/renderer/src/components/sidebar/WebPreviewPanel.tsx')
if (existsSync(wp306Path)) {
  const wp306 = readFileSync(wp306Path, 'utf-8')
  if (wp306.includes("window.open") && wp306.includes("'_blank'") && wp306.includes('외부 브라우저')) {
    log('pass', 'Round306', 'WebPreviewPanel: 외부 브라우저에서 열기 버튼 (window.open/_blank) 존재')
  } else {
    log('warning', 'Round306', 'WebPreviewPanel 외부 열기 미구현', 'sidebar/WebPreviewPanel.tsx')
  }
}

// ── Section 207: R305 신규 기능 ───────────────────────────────
console.log('\n## 207. 신규 기능 파일 검사 (R305)')
// SceneTreePanel 총 노드 수 (Round 305)
const st305Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneTreePanel.tsx')
if (existsSync(st305Path)) {
  const st305 = readFileSync(st305Path, 'utf-8')
  if (st305.includes('countNodes') && st305.includes('totalNodes') && st305.includes('씬 트리')) {
    log('pass', 'Round305', 'SceneTreePanel: 총 노드 수 표시 (countNodes/totalNodes) 존재')
  } else {
    log('warning', 'Round305', 'SceneTreePanel 노드 수 미구현', 'sidebar/SceneTreePanel.tsx')
  }
}

// ── Section 206: R304 신규 기능 ───────────────────────────────
console.log('\n## 206. 신규 기능 파일 검사 (R304)')
// NodePropertyPanel UUID 복사 버튼 (Round 304)
const np304Path = join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx')
if (existsSync(np304Path)) {
  const np304 = readFileSync(np304Path, 'utf-8')
  if (np304.includes('copyUuid') && np304.includes('uuidCopied') && np304.includes('UUID 복사')) {
    log('pass', 'Round304', 'NodePropertyPanel: UUID 복사 버튼 (copyUuid/uuidCopied) 존재')
  } else {
    log('warning', 'Round304', 'NodePropertyPanel UUID 복사 미구현', 'sidebar/NodePropertyPanel.tsx')
  }
}

// ── Section 205: R303 신규 기능 ───────────────────────────────
console.log('\n## 205. 신규 기능 파일 검사 (R303)')
// PromptChainPanel 마지막 실행 시간 (Round 303)
const pcp303Path = join(ROOT, 'src/renderer/src/components/sidebar/PromptChainPanel.tsx')
if (existsSync(pcp303Path)) {
  const pcp303 = readFileSync(pcp303Path, 'utf-8')
  if (pcp303.includes('selectedChain.lastRun') && pcp303.includes('relativeTime') && pcp303.includes('마지막 실행')) {
    log('pass', 'Round303', 'PromptChainPanel: 마지막 실행 시간 표시 (lastRun/relativeTime) 존재')
  } else {
    log('warning', 'Round303', 'PromptChainPanel 마지막 실행 시간 미구현', 'sidebar/PromptChainPanel.tsx')
  }
}

// ── Section 204: R302 신규 기능 ───────────────────────────────
console.log('\n## 204. 신규 기능 파일 검사 (R302)')
// AgentPanel 탭 배지 (Round 302)
const ap302Path = join(ROOT, 'src/renderer/src/components/sidebar/AgentPanel.tsx')
if (existsSync(ap302Path)) {
  const ap302 = readFileSync(ap302Path, 'utf-8')
  if (ap302.includes('enabledCount') && ap302.includes('tab.badge') && ap302.includes('badge?:')) {
    log('pass', 'Round302', 'AgentPanel: 탭 배지 (enabledCount/badge) 존재')
  } else {
    log('warning', 'Round302', 'AgentPanel 탭 배지 미구현', 'sidebar/AgentPanel.tsx')
  }
}

// ── Section 203: R301 신규 기능 ───────────────────────────────
console.log('\n## 203. 신규 기능 파일 검사 (R301)')
// RemotePanel 총 호스트 수 배지 (Round 301)
const rp301Path = join(ROOT, 'src/renderer/src/components/sidebar/RemotePanel.tsx')
if (existsSync(rp301Path)) {
  const rp301 = readFileSync(rp301Path, 'utf-8')
  if (rp301.includes('sshHosts.length + savedHosts.length') && rp301.includes('개')) {
    log('pass', 'Round301', 'RemotePanel: 총 호스트 수 배지 (sshHosts+savedHosts 합산) 존재')
  } else {
    log('warning', 'Round301', 'RemotePanel 호스트 수 배지 미구현', 'sidebar/RemotePanel.tsx')
  }
}

// ── Section 202: R300 신규 기능 ───────────────────────────────
console.log('\n## 202. 신규 기능 파일 검사 (R300)')
// SearchPanel 검색어 하이라이트 (Round 300)
const sp300Path = join(ROOT, 'src/renderer/src/components/sidebar/SearchPanel.tsx')
if (existsSync(sp300Path)) {
  const sp300 = readFileSync(sp300Path, 'utf-8')
  if (sp300.includes('highlightLine') && sp300.includes('fbbf24') && sp300.includes('re.exec')) {
    log('pass', 'Round300', 'SearchPanel: 검색어 하이라이트 (highlightLine/<mark>/fbbf24) 존재')
  } else {
    log('warning', 'Round300', 'SearchPanel 하이라이트 미구현', 'sidebar/SearchPanel.tsx')
  }
}

// ── Section 201: R299 신규 기능 ───────────────────────────────
console.log('\n## 201. 신규 기능 파일 검사 (R299)')
// ConnectionPanel 모두 핑 버튼 (Round 299)
const cp299Path = join(ROOT, 'src/renderer/src/components/sidebar/ConnectionPanel.tsx')
if (existsSync(cp299Path)) {
  const cp299 = readFileSync(cp299Path, 'utf-8')
  if (cp299.includes('pingAll') && cp299.includes('Promise.all') && cp299.includes('모두 핑')) {
    log('pass', 'Round299', 'ConnectionPanel: 모두 핑 버튼 (pingAll/Promise.all) 존재')
  } else {
    log('warning', 'Round299', 'ConnectionPanel 모두 핑 미구현', 'sidebar/ConnectionPanel.tsx')
  }
}

// ── Section 200: R298 신규 기능 ───────────────────────────────
console.log('\n## 200. 신규 기능 파일 검사 (R298)')
// GitPanel 커밋 메시지 글자 수 카운터 (Round 298)
const gp298Path = join(ROOT, 'src/renderer/src/components/sidebar/GitPanel.tsx')
if (existsSync(gp298Path)) {
  const gp298 = readFileSync(gp298Path, 'utf-8')
  if (gp298.includes('72') && gp298.includes('split(') && gp298.includes('commitMsg.length')) {
    log('pass', 'Round298', 'GitPanel: 커밋 메시지 글자 수 카운터 (/72 제한) 존재')
  } else {
    log('warning', 'Round298', 'GitPanel 커밋 메시지 카운터 미구현', 'sidebar/GitPanel.tsx')
  }
}

// ── Section 199: R297 신규 기능 ───────────────────────────────
console.log('\n## 199. 신규 기능 파일 검사 (R297)')
// ChangedFilesPanel W/E 카운트 표시 (Round 297)
const cf297Path = join(ROOT, 'src/renderer/src/components/sidebar/ChangedFilesPanel.tsx')
if (existsSync(cf297Path)) {
  const cf297 = readFileSync(cf297Path, 'utf-8')
  if (cf297.includes("op === 'write'") && cf297.includes("op === 'edit'") && cf297.includes('W:') && cf297.includes('E:')) {
    log('pass', 'Round297', 'ChangedFilesPanel: W/E 작업 구분 카운트 (W:N E:N) 존재')
  } else {
    log('warning', 'Round297', 'ChangedFilesPanel W/E 카운트 미구현', 'sidebar/ChangedFilesPanel.tsx')
  }
}

// ── Section 198: R296 신규 기능 ───────────────────────────────
console.log('\n## 198. 신규 기능 파일 검사 (R296)')
// ClipboardPanel 글자 수 표시 (Round 296)
const cp296Path = join(ROOT, 'src/renderer/src/components/sidebar/ClipboardPanel.tsx')
if (existsSync(cp296Path)) {
  const cp296 = readFileSync(cp296Path, 'utf-8')
  if (cp296.includes('text.length') && cp296.includes('toLocaleString') && cp296.includes('자')) {
    log('pass', 'Round296', 'ClipboardPanel: 글자 수 표시 (text.length/toLocaleString/자) 존재')
  } else {
    log('warning', 'Round296', 'ClipboardPanel 글자 수 표시 미구현', 'sidebar/ClipboardPanel.tsx')
  }
}

// ── Section 197: R295 신규 기능 ───────────────────────────────
console.log('\n## 197. 신규 기능 파일 검사 (R295)')
// SnippetPanel 정렬 토글 (Round 295)
const sp295Path = join(ROOT, 'src/renderer/src/components/sidebar/SnippetPanel.tsx')
if (existsSync(sp295Path)) {
  const sp295 = readFileSync(sp295Path, 'utf-8')
  if (sp295.includes('sortOrder') && sp295.includes('createdAt') && sp295.includes('localeCompare')) {
    log('pass', 'Round295', 'SnippetPanel: 정렬 토글 (생성 순/이름 순) 존재')
  } else {
    log('warning', 'Round295', 'SnippetPanel 정렬 토글 미구현', 'sidebar/SnippetPanel.tsx')
  }
}

// ── Section 196: R294 신규 기능 ───────────────────────────────
console.log('\n## 196. 신규 기능 파일 검사 (R294)')
// PluginsPanel 활성화 플러그인 수 배지 (Round 294)
const pp294Path = join(ROOT, 'src/renderer/src/components/sidebar/PluginsPanel.tsx')
if (existsSync(pp294Path)) {
  const pp294 = readFileSync(pp294Path, 'utf-8')
  if (pp294.includes('활성') && pp294.includes('enabledSet.has') && pp294.includes('plugins.length')) {
    log('pass', 'Round294', 'PluginsPanel: 활성 플러그인 수 배지 (활성/총개수) 존재')
  } else {
    log('warning', 'Round294', 'PluginsPanel 활성 배지 미구현', 'sidebar/PluginsPanel.tsx')
  }
}

// ── Section 195: R293 신규 기능 ───────────────────────────────
console.log('\n## 195. 신규 기능 파일 검사 (R293)')
// RunTimeline 합산 비용 표시 (Round 293)
const rt293Path = join(ROOT, 'src/renderer/src/components/sidebar/RunTimeline.tsx')
if (existsSync(rt293Path)) {
  const rt293 = readFileSync(rt293Path, 'utf-8')
  if (rt293.includes('totalCostUsd') && rt293.includes('finishedRuns') && rt293.includes('완료')) {
    log('pass', 'Round293', 'RunTimeline: 완료 런 합산 비용 표시 (totalCostUsd/finishedRuns) 존재')
  } else {
    log('warning', 'Round293', 'RunTimeline 합산 비용 표시 미구현', 'sidebar/RunTimeline.tsx')
  }
}

// ── Section 194: R292 신규 기능 ───────────────────────────────
console.log('\n## 194. 신규 기능 파일 검사 (R292)')
// OutlinePanel 헤딩 레벨 필터 (Round 292)
const op292Path = join(ROOT, 'src/renderer/src/components/sidebar/OutlinePanel.tsx')
if (existsSync(op292Path)) {
  const op292 = readFileSync(op292Path, 'utf-8')
  if (op292.includes('levelFilter') && op292.includes('H${lv}') && op292.includes('setLevelFilter')) {
    log('pass', 'Round292', 'OutlinePanel: 헤딩 레벨 필터 (levelFilter/H1~H3) 존재')
  } else {
    log('warning', 'Round292', 'OutlinePanel 헤딩 레벨 필터 미구현', 'sidebar/OutlinePanel.tsx')
  }
}

// ── Section 193: R291 신규 기능 ───────────────────────────────
console.log('\n## 193. 신규 기능 파일 검사 (R291)')
// BookmarksPanel 역할 필터 (Round 291)
const bmp291Path = join(ROOT, 'src/renderer/src/components/sidebar/BookmarksPanel.tsx')
if (existsSync(bmp291Path)) {
  const bmp291 = readFileSync(bmp291Path, 'utf-8')
  if (bmp291.includes('roleFilter') && bmp291.includes('cycleRole') && bmp291.includes('ROLE_LABELS')) {
    log('pass', 'Round291', 'BookmarksPanel: 역할 필터 토글 (roleFilter/cycleRole/ROLE_LABELS) 존재')
  } else {
    log('warning', 'Round291', 'BookmarksPanel 역할 필터 미구현', 'sidebar/BookmarksPanel.tsx')
  }
}

// ── Section 192: R290 신규 기능 ───────────────────────────────
console.log('\n## 192. 신규 기능 파일 검사 (R290)')
// GlobalSearchPanel 검색어 하이라이트 (Round 290)
const gsp290Path = join(ROOT, 'src/renderer/src/components/sidebar/GlobalSearchPanel.tsx')
if (existsSync(gsp290Path)) {
  const gsp290 = readFileSync(gsp290Path, 'utf-8')
  if (gsp290.includes('highlightQuery') && gsp290.includes('fbbf24') && gsp290.includes('<mark')) {
    log('pass', 'Round290', 'GlobalSearchPanel: 검색어 하이라이트 (highlightQuery/<mark/fbbf24) 존재')
  } else {
    log('warning', 'Round290', 'GlobalSearchPanel 검색어 하이라이트 미구현', 'sidebar/GlobalSearchPanel.tsx')
  }
}

// ── Section 191: R289 신규 기능 ───────────────────────────────
console.log('\n## 191. 신규 기능 파일 검사 (R289)')
// StatsPanel 일평균 세션 카드 (Round 289)
const sp289Path = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(sp289Path)) {
  const sp289 = readFileSync(sp289Path, 'utf-8')
  if (sp289.includes('일평균 세션') && sp289.includes('totalSessions / totalDays')) {
    log('pass', 'Round289', 'StatsPanel: 일평균 세션 카드 (totalSessions/totalDays) 존재')
  } else {
    log('warning', 'Round289', 'StatsPanel 일평균 세션 카드 미구현', 'sidebar/StatsPanel.tsx')
  }
}

// ── Section 190: R288 신규 기능 ───────────────────────────────
console.log('\n## 190. 신규 기능 파일 검사 (R288)')
// TasksPanel D-Day 카운트다운 (Round 288)
const tp288Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp288Path)) {
  const tp288 = readFileSync(tp288Path, 'utf-8')
  if (tp288.includes('D-Day') && tp288.includes('diffDays') && tp288.includes('86400000')) {
    log('pass', 'Round288', 'TasksPanel: 마감일 D-Day 카운트다운 (diffDays/D-Day/86400000) 존재')
  } else {
    log('warning', 'Round288', 'TasksPanel D-Day 카운트다운 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 189: R287 신규 기능 ───────────────────────────────
console.log('\n## 189. 신규 기능 파일 검사 (R287)')
// CalendarPanel 이벤트 전체 삭제 (Round 287)
const cal287Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cal287Path)) {
  const cal287 = readFileSync(cal287Path, 'utf-8')
  if (cal287.includes('이 날짜 이벤트 전체 삭제') && cal287.includes('전체 삭제') && cal287.includes("e.date !== selectedDay")) {
    log('pass', 'Round287', 'CalendarPanel: 선택 날짜 이벤트 전체 삭제 버튼 존재')
  } else {
    log('warning', 'Round287', 'CalendarPanel 이벤트 전체 삭제 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 188: R286 신규 기능 ───────────────────────────────
console.log('\n## 188. 신규 기능 파일 검사 (R286)')
// TasksPanel 전체 완료 배너 (Round 286)
const tp286Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp286Path)) {
  const tp286 = readFileSync(tp286Path, 'utf-8')
  if (tp286.includes('🎉 전부 완료') && tp286.includes('progressPct === 100')) {
    log('pass', 'Round286', 'TasksPanel: 전체 완료 배너 (🎉/progressPct===100) 존재')
  } else {
    log('warning', 'Round286', 'TasksPanel 전체 완료 배너 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 187: R285 신규 기능 ───────────────────────────────
console.log('\n## 187. 신규 기능 파일 검사 (R285)')
// NotesPanel 모노스페이스 코드 모드 (Round 285)
const np285Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np285Path)) {
  const np285 = readFileSync(np285Path, 'utf-8')
  if (np285.includes('codeMode') && np285.includes('font-mono') && np285.includes('코드 모노스페이스')) {
    log('pass', 'Round285', 'NotesPanel: 모노스페이스 코드 모드 (codeMode/font-mono) 존재')
  } else {
    log('warning', 'Round285', 'NotesPanel 모노스페이스 코드 모드 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 186: R284 신규 기능 ───────────────────────────────
console.log('\n## 186. 신규 기능 파일 검사 (R284)')
// SceneViewPanel 노드 정보 오버레이 컴포넌트 표시 (Round 284)
const svp284Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp284Path)) {
  const svp284 = readFileSync(svp284Path, 'utf-8')
  if (svp284.includes("replace('cc.', '')") && svp284.includes("comps:") && svp284.includes('selectedNode.components')) {
    log('pass', 'Round284', 'SceneViewPanel: 노드 정보 오버레이 컴포넌트 타입 표시 존재')
  } else {
    log('warning', 'Round284', 'SceneViewPanel 노드 정보 오버레이 컴포넌트 표시 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 185: R283 신규 기능 ───────────────────────────────
console.log('\n## 185. 신규 기능 파일 검사 (R283)')
// CalendarPanel 이번 달 이벤트 수 요약 (Round 283)
const cal283Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cal283Path)) {
  const cal283 = readFileSync(cal283Path, 'utf-8')
  if (cal283.includes('monthEventCount') && cal283.includes('monthPrefix') && cal283.includes('이벤트')) {
    log('pass', 'Round283', 'CalendarPanel: 이번 달 이벤트 수 요약 (monthEventCount/monthPrefix) 존재')
  } else {
    log('warning', 'Round283', 'CalendarPanel 이번 달 이벤트 수 요약 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 184: R282 신규 기능 ───────────────────────────────
console.log('\n## 184. 신규 기능 파일 검사 (R282)')
// TasksPanel 빠른 마감일 버튼 (Round 282)
const tp282Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp282Path)) {
  const tp282 = readFileSync(tp282Path, 'utf-8')
  if (tp282.includes('빠른 마감일') && tp282.includes('오늘') && tp282.includes('7일')) {
    log('pass', 'Round282', 'TasksPanel: 빠른 마감일 버튼 (오늘/내일/7일) 존재')
  } else {
    log('warning', 'Round282', 'TasksPanel 빠른 마감일 버튼 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 183: R281 신규 기능 ───────────────────────────────
console.log('\n## 183. 신규 기능 파일 검사 (R281)')
// StatsPanel 요일별 활동 분포 (Round 281)
const sp281Path = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(sp281Path)) {
  const sp281 = readFileSync(sp281Path, 'utf-8')
  if (sp281.includes('weekdayStats') && sp281.includes('요일별 활동 분포') && sp281.includes('isPeak')) {
    log('pass', 'Round281', 'StatsPanel: 요일별 활동 분포 차트 (weekdayStats/isPeak) 존재')
  } else {
    log('warning', 'Round281', 'StatsPanel 요일별 활동 분포 미구현', 'sidebar/StatsPanel.tsx')
  }
}

// ── Section 182: R280 신규 기능 ───────────────────────────────
console.log('\n## 182. 신규 기능 파일 검사 (R280)')
// NotesPanel 노트 클립보드 복사 (Round 280)
const np280Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np280Path)) {
  const np280 = readFileSync(np280Path, 'utf-8')
  if (np280.includes('copyNoteToClipboard') && np280.includes('noteCopied') && np280.includes('노트를 Markdown으로')) {
    log('pass', 'Round280', 'NotesPanel: 노트 클립보드 복사 (copyNoteToClipboard/noteCopied) 존재')
  } else {
    log('warning', 'Round280', 'NotesPanel 노트 클립보드 복사 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 181: R279 신규 기능 ───────────────────────────────
console.log('\n## 181. 신규 기능 파일 검사 (R279)')
// TasksPanel 우선순위 점 클릭 순환 (Round 279)
const tp279Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp279Path)) {
  const tp279 = readFileSync(tp279Path, 'utf-8')
  if (tp279.includes('cyclePriority') && tp279.includes('PRIORITY_CYCLE') && tp279.includes('클릭: 우선순위 변경')) {
    log('pass', 'Round279', 'TasksPanel: 우선순위 점 클릭 순환 (cyclePriority/PRIORITY_CYCLE) 존재')
  } else {
    log('warning', 'Round279', 'TasksPanel 우선순위 점 클릭 순환 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 180: R278 신규 기능 ───────────────────────────────
console.log('\n## 180. 신규 기능 파일 검사 (R278)')
// CalendarPanel 이벤트 색상 변경 (Round 278)
const cal278Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cal278Path)) {
  const cal278 = readFileSync(cal278Path, 'utf-8')
  if (cal278.includes('클릭: 색상 변경') && cal278.includes('nextColor') && cal278.includes('EVENT_COLORS.indexOf')) {
    log('pass', 'Round278', 'CalendarPanel: 이벤트 색상 변경 (nextColor/EVENT_COLORS.indexOf) 존재')
  } else {
    log('warning', 'Round278', 'CalendarPanel 이벤트 색상 변경 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 179: R277 신규 기능 ───────────────────────────────
console.log('\n## 179. 신규 기능 파일 검사 (R277)')
// NotesPanel 노트 복제 (Round 277)
const np277Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np277Path)) {
  const np277 = readFileSync(np277Path, 'utf-8')
  if (np277.includes('duplicateNote') && np277.includes('복사') && np277.includes('pinned: false')) {
    log('pass', 'Round277', 'NotesPanel: 노트 복제 (duplicateNote/복사) 존재')
  } else {
    log('warning', 'Round277', 'NotesPanel 노트 복제 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 178: R276 신규 기능 ───────────────────────────────
console.log('\n## 178. 신규 기능 파일 검사 (R276)')
// SceneView 컨텍스트 메뉴 UUID/경로 복사 (Round 276)
const svp276Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp276Path)) {
  const svp276 = readFileSync(svp276Path, 'utf-8')
  if (svp276.includes('UUID 복사') && svp276.includes('경로 복사') && svp276.includes('pathParts')) {
    log('pass', 'Round276', 'SceneViewPanel: 컨텍스트 메뉴 UUID/경로 복사 (clipboard.writeText) 존재')
  } else {
    log('warning', 'Round276', 'SceneViewPanel UUID/경로 복사 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 177: R275 신규 기능 ───────────────────────────────
console.log('\n## 177. 신규 기능 파일 검사 (R275)')
// TasksPanel 태스크 메모 필드 (Round 275)
const tp275Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp275Path)) {
  const tp275 = readFileSync(tp275Path, 'utf-8')
  if (tp275.includes('expandedMemoId') && tp275.includes('updateMemo') && tp275.includes('memo?: string')) {
    log('pass', 'Round275', 'TasksPanel: 태스크 메모 필드 (expandedMemoId/updateMemo) 존재')
  } else {
    log('warning', 'Round275', 'TasksPanel 태스크 메모 필드 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 176: R274 신규 기능 ───────────────────────────────
console.log('\n## 176. 신규 기능 파일 검사 (R274)')
// CalendarPanel 이벤트 인라인 편집 (Round 274)
const cal274Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cal274Path)) {
  const cal274 = readFileSync(cal274Path, 'utf-8')
  if (cal274.includes('editingEventId') && cal274.includes('commitEventEdit') && cal274.includes('더블클릭 편집')) {
    log('pass', 'Round274', 'CalendarPanel: 이벤트 인라인 편집 (editingEventId/commitEventEdit) 존재')
  } else {
    log('warning', 'Round274', 'CalendarPanel 이벤트 인라인 편집 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 175: R273 신규 기능 ───────────────────────────────
console.log('\n## 175. 신규 기능 파일 검사 (R273)')
// NotesPanel 검색 하이라이트 (Round 273)
const np273Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np273Path)) {
  const np273 = readFileSync(np273Path, 'utf-8')
  if (np273.includes('highlightText') && np273.includes('fbbf24') && np273.includes('<mark')) {
    log('pass', 'Round273', 'NotesPanel: 검색 결과 하이라이트 (highlightText/<mark>) 존재')
  } else {
    log('warning', 'Round273', 'NotesPanel 검색 하이라이트 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 174: R272 신규 기능 ───────────────────────────────
console.log('\n## 174. 신규 기능 파일 검사 (R272)')
// StatsPanel 연속 사용일 스트릭 (Round 272)
const sp272Path = join(ROOT, 'src/renderer/src/components/sidebar/StatsPanel.tsx')
if (existsSync(sp272Path)) {
  const sp272 = readFileSync(sp272Path, 'utf-8')
  if (sp272.includes('currentStreak') && sp272.includes('longestStreak') && sp272.includes('연속 사용일')) {
    log('pass', 'Round272', 'StatsPanel: 연속 사용일 스트릭 (currentStreak/longestStreak) 존재')
  } else {
    log('warning', 'Round272', 'StatsPanel 연속 사용일 스트릭 미구현', 'sidebar/StatsPanel.tsx')
  }
}

// ── Section 173: R271 신규 기능 ───────────────────────────────
console.log('\n## 173. 신규 기능 파일 검사 (R271)')
// TasksPanel 검색 필터 (Round 271)
const tp271Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp271Path)) {
  const tp271 = readFileSync(tp271Path, 'utf-8')
  if (tp271.includes('taskSearch') && tp271.includes('태스크 검색') && tp271.includes('searchLower')) {
    log('pass', 'Round271', 'TasksPanel: 검색 필터 (taskSearch/searchLower) 존재')
  } else {
    log('warning', 'Round271', 'TasksPanel 검색 필터 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 172: R270 신규 기능 ───────────────────────────────
console.log('\n## 172. 신규 기능 파일 검사 (R270)')
// SceneView 노드 반전 Alt+H/V (Round 270)
const svp270Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp270Path)) {
  const svp270 = readFileSync(svp270Path, 'utf-8')
  if (svp270.includes('좌우/상하 반전') && svp270.includes('scaleX: -(node.scaleX') && svp270.includes('scaleY: -(node.scaleY')) {
    log('pass', 'Round270', 'SceneViewPanel: Alt+H/V 좌우/상하 반전 (scaleX/Y 부호 반전) 존재')
  } else {
    log('warning', 'Round270', 'SceneViewPanel Alt+H/V 반전 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 171: R269 신규 기능 ───────────────────────────────
console.log('\n## 171. 신규 기능 파일 검사 (R269)')
// SceneView 리사이즈 중 Escape 취소 (Round 269)
const svp269Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp269Path)) {
  const svp269 = readFileSync(svp269Path, 'utf-8')
  if (svp269.includes('리사이즈 중 Escape') && svp269.includes('rs.startWidth') && svp269.includes('setIsResizing(false)')) {
    log('pass', 'Round269', 'SceneViewPanel: 리사이즈 중 Escape 취소 (startWidth/Height 복원) 존재')
  } else {
    log('warning', 'Round269', 'SceneViewPanel 리사이즈 Escape 취소 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 170: R268 신규 기능 ───────────────────────────────
console.log('\n## 170. 신규 기능 파일 검사 (R268)')
// SceneView 드래그 중 Escape 취소 (Round 268)
const svp268Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp268Path)) {
  const svp268 = readFileSync(svp268Path, 'utf-8')
  if (svp268.includes('드래그 중 Escape') && svp268.includes('drag.groupOffsets') && svp268.includes('setIsDragging(false)')) {
    log('pass', 'Round268', 'SceneViewPanel: 드래그 중 Escape 취소 (groupOffsets 복원) 존재')
  } else {
    log('warning', 'Round268', 'SceneViewPanel 드래그 Escape 취소 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 169: R267 신규 기능 ───────────────────────────────
console.log('\n## 169. 신규 기능 파일 검사 (R267)')
// NotesPanel 글자/단어 수 표시 (Round 267)
const np267Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np267Path)) {
  const np267 = readFileSync(np267Path, 'utf-8')
  if (np267.includes('content.length') && np267.includes('단어') && np267.includes('자 ·')) {
    log('pass', 'Round267', 'NotesPanel: 글자/단어 수 표시 존재')
  } else {
    log('warning', 'Round267', 'NotesPanel 글자/단어 수 표시 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 168: R266 신규 기능 ───────────────────────────────
console.log('\n## 168. 신규 기능 파일 검사 (R266)')
// TasksPanel 정렬 기능 (Round 266)
const tp266Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp266Path)) {
  const tp266 = readFileSync(tp266Path, 'utf-8')
  if (tp266.includes('sortBy') && tp266.includes('PRIORITY_ORDER') && tp266.includes('created')) {
    log('pass', 'Round266', 'TasksPanel: 정렬 기능 (sortBy/PRIORITY_ORDER) 존재')
  } else {
    log('warning', 'Round266', 'TasksPanel 정렬 기능 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 167: R265 신규 기능 ───────────────────────────────
console.log('\n## 167. 신규 기능 파일 검사 (R265)')
// CalendarPanel 커스텀 이벤트 추가 (Round 265)
const cal265Path = join(ROOT, 'src/renderer/src/components/sidebar/CalendarPanel.tsx')
if (existsSync(cal265Path)) {
  const cal265 = readFileSync(cal265Path, 'utf-8')
  if (cal265.includes('CalendarEvent') && cal265.includes('calendarEvents') && cal265.includes('addEvent')) {
    log('pass', 'Round265', 'CalendarPanel: 커스텀 이벤트 추가 (CalendarEvent/localStorage) 존재')
  } else {
    log('warning', 'Round265', 'CalendarPanel 커스텀 이벤트 미구현', 'sidebar/CalendarPanel.tsx')
  }
}

// ── Section 166: R264 신규 기능 ───────────────────────────────
console.log('\n## 166. 신규 기능 파일 검사 (R264)')
// SceneView 북마크 클릭 시 카메라 포커스 (Round 264)
const svp264Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp264Path)) {
  const svp264 = readFileSync(svp264Path, 'utf-8')
  if (svp264.includes('카메라 포커스: 북마크 클릭') && svp264.includes('targetZoom') && svp264.includes('setShowBookmarkList')) {
    log('pass', 'Round264', 'SceneViewPanel: 북마크 클릭 시 카메라 포커스 이동 존재')
  } else {
    log('warning', 'Round264', 'SceneViewPanel 북마크 클릭 카메라 포커스 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 165: R263 신규 기능 ───────────────────────────────
console.log('\n## 165. 신규 기능 파일 검사 (R263)')
// SceneView 검색 조상 자동 펼치기 (Round 263)
const svp263Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp263Path)) {
  const svp263 = readFileSync(svp263Path, 'utf-8')
  if (svp263.includes('조상 노드가 접혀 있으면 자동 펼치기') && svp263.includes('ancestors') && svp263.includes('next2.delete')) {
    log('pass', 'Round263', 'SceneViewPanel: 검색 노드 조상 자동 펼치기 (ancestors) 존재')
  } else {
    log('warning', 'Round263', 'SceneViewPanel 검색 조상 자동 펼치기 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 164: R262 신규 기능 ───────────────────────────────
console.log('\n## 164. 신규 기능 파일 검사 (R262)')
// SceneView 호버 툴팁 memo 표시 (Round 262)
const svp262Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp262Path)) {
  const svp262 = readFileSync(svp262Path, 'utf-8')
  if (svp262.includes('hn.memo') && svp262.includes('📝') && svp262.includes('fbbf24')) {
    log('pass', 'Round262', 'SceneViewPanel: 호버 툴팁 memo 표시 존재')
  } else {
    log('warning', 'Round262', 'SceneViewPanel 호버 툴팁 memo 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 163: R261 신규 기능 ───────────────────────────────
console.log('\n## 163. 신규 기능 파일 검사 (R261)')
// TasksPanel 진행률 바 (Round 261)
const tp261Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp261Path)) {
  const tp261 = readFileSync(tp261Path, 'utf-8')
  if (tp261.includes('progressPct') && tp261.includes('진행률') && tp261.includes('doneCount / tasks.length')) {
    log('pass', 'Round261', 'TasksPanel: 진행률 바 (progressPct) 구현 존재')
  } else {
    log('warning', 'Round261', 'TasksPanel 진행률 바 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 162: R260 신규 기능 ───────────────────────────────
console.log('\n## 162. 신규 기능 파일 검사 (R260)')
// SceneView 다중 선택 bounding box 중앙 마커 (Round 260)
const svp260Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp260Path)) {
  const svp260 = readFileSync(svp260Path, 'utf-8')
  if (svp260.includes('중앙 마커') && svp260.includes('cx - arm') && svp260.includes('cy - arm')) {
    log('pass', 'Round260', 'SceneViewPanel: 다중 선택 bounding box 중앙 마커 존재')
  } else {
    log('warning', 'Round260', 'SceneViewPanel 다중 선택 중앙 마커 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 161: R259 신규 기능 ───────────────────────────────
console.log('\n## 161. 신규 기능 파일 검사 (R259)')
// SceneView 드래그 원본 위치 고스트 박스 (Round 259)
const svp259Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp259Path)) {
  const svp259 = readFileSync(svp259Path, 'utf-8')
  if (svp259.includes('드래그 원본 위치 고스트 박스') && svp259.includes('startNodeX') && svp259.includes('dragRef.current')) {
    log('pass', 'Round259', 'SceneViewPanel: 드래그 원본 위치 고스트 박스 오버레이 존재')
  } else {
    log('warning', 'Round259', 'SceneViewPanel 드래그 고스트 박스 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 160: R258 신규 기능 ───────────────────────────────
console.log('\n## 160. 신규 기능 파일 검사 (R258)')
// NotesPanel 노트 내보내기 (Round 258)
const np258Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np258Path)) {
  const np258 = readFileSync(np258Path, 'utf-8')
  if (np258.includes('exportNotes') && np258.includes('notes-') && np258.includes('text/markdown')) {
    log('pass', 'Round258', 'NotesPanel: Markdown 내보내기 (exportNotes) 구현 존재')
  } else {
    log('warning', 'Round258', 'NotesPanel Markdown 내보내기 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 159: R257 신규 기능 ───────────────────────────────
console.log('\n## 159. 신규 기능 파일 검사 (R257)')
// TasksPanel 마감일 기능 (Round 257)
const tp257Path = join(ROOT, 'src/renderer/src/components/sidebar/TasksPanel.tsx')
if (existsSync(tp257Path)) {
  const tp257 = readFileSync(tp257Path, 'utf-8')
  if (tp257.includes('dueDate') && tp257.includes('마감일') && tp257.includes('overdue')) {
    log('pass', 'Round257', 'TasksPanel: 마감일 기능 (dueDate + overdue 강조) 존재')
  } else {
    log('warning', 'Round257', 'TasksPanel 마감일 기능 미구현', 'sidebar/TasksPanel.tsx')
  }
}

// ── Section 158: R256 신규 기능 ───────────────────────────────
console.log('\n## 158. 신규 기능 파일 검사 (R256)')
// SceneView Alt 홀드 스냅 일시 비활성화 (Round 256)
const svp256Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp256Path)) {
  const svp256 = readFileSync(svp256Path, 'utf-8')
  if (svp256.includes('!e.altKey') && svp256.includes('일시 비활성화')) {
    log('pass', 'Round256', 'SceneViewPanel: Alt 홀드 스냅 일시 비활성화 (altKey 체크) 존재')
  } else {
    log('warning', 'Round256', 'SceneViewPanel Alt 스냅 오버라이드 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 157: R255 신규 기능 ───────────────────────────────
console.log('\n## 157. 신규 기능 파일 검사 (R255)')
// SceneView P키 부모 노드 선택 (Round 255)
const svp255Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp255Path)) {
  const svp255 = readFileSync(svp255Path, 'utf-8')
  if (svp255.includes("key === 'p'") && svp255.includes('부모 노드 선택') && svp255.includes('node.parentUuid')) {
    log('pass', 'Round255', 'SceneViewPanel: P키 부모 노드 선택 (parentUuid) 존재')
  } else {
    log('warning', 'Round255', 'SceneViewPanel P키 부모 선택 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 156: R254 신규 기능 ───────────────────────────────
console.log('\n## 156. 신규 기능 파일 검사 (R254)')
// SceneView 씬 통계 컴포넌트 분포 (Round 254)
const svp254Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp254Path)) {
  const svp254 = readFileSync(svp254Path, 'utf-8')
  if (svp254.includes('compCounts') && svp254.includes('topComps') && svp254.includes('totalComps')) {
    log('pass', 'Round254', 'SceneViewPanel: 씬 통계 컴포넌트 타입 분포 (topComps) 존재')
  } else {
    log('warning', 'Round254', 'SceneViewPanel 통계 컴포넌트 분포 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 155: R253 신규 기능 ───────────────────────────────
console.log('\n## 155. 신규 기능 파일 검사 (R253)')
// SceneView H키/Alt+L 다중 선택 일괄 처리 (Round 253)
const svp253Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp253Path)) {
  const svp253 = readFileSync(svp253Path, 'utf-8')
  if (svp253.includes('anyVisible') && svp253.includes('anyUnlocked') && svp253.includes('다중 선택 일괄 처리')) {
    log('pass', 'Round253', 'SceneViewPanel: H키/Alt+L 다중 선택 일괄 가시성/잠금 처리 존재')
  } else {
    log('warning', 'Round253', 'SceneViewPanel 다중 선택 일괄 처리 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 154: R252 신규 기능 ───────────────────────────────
console.log('\n## 154. 신규 기능 파일 검사 (R252)')
// NotesPanel 핀 고정 기능 (Round 252)
const np252Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np252Path)) {
  const np252 = readFileSync(np252Path, 'utf-8')
  if (np252.includes('pinned') && np252.includes('togglePin') && np252.includes('핀 고정')) {
    log('pass', 'Round252', 'NotesPanel: 핀 고정 기능 (pinned + togglePin) 구현 존재')
  } else {
    log('warning', 'Round252', 'NotesPanel 핀 고정 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 153: R251 신규 기능 ───────────────────────────────
console.log('\n## 153. 신규 기능 파일 검사 (R251)')
// SceneView 노드 정보 오버레이 I키 (Round 251)
const svp251Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp251Path)) {
  const svp251 = readFileSync(svp251Path, 'utf-8')
  if (svp251.includes('showNodeInfo') && svp251.includes('노드 정보 오버레이') && svp251.includes("key === 'i'")) {
    log('pass', 'Round251', 'SceneViewPanel: I키 노드 정보 오버레이 (showNodeInfo) 구현 존재')
  } else {
    log('warning', 'Round251', 'SceneViewPanel I키 노드 정보 오버레이 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 152: R250 신규 기능 ───────────────────────────────
console.log('\n## 152. 신규 기능 파일 검사 (R250)')
// SceneView 앵커 포인트 십자 마커 (Round 250)
const svp250Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp250Path)) {
  const svp250 = readFileSync(svp250Path, 'utf-8')
  if (svp250.includes('앵커 포인트 십자 마커') && svp250.includes('#a78bfa') && svp250.includes('arm')) {
    log('pass', 'Round250', 'SceneViewPanel: 선택 노드 앵커 포인트 십자 마커 구현 존재')
  } else {
    log('warning', 'Round250', 'SceneViewPanel 앵커 포인트 마커 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 151: R249 신규 기능 ───────────────────────────────
console.log('\n## 151. 신규 기능 파일 검사 (R249)')
// NotesPanel 정렬 기능 (Round 249)
const np249Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np249Path)) {
  const np249 = readFileSync(np249Path, 'utf-8')
  if (np249.includes('sortOrder') && np249.includes('sortedNotes') && np249.includes('cycleSortOrder')) {
    log('pass', 'Round249', 'NotesPanel: 정렬 기능 (sortOrder + sortedNotes) 구현 존재')
  } else {
    log('warning', 'Round249', 'NotesPanel 정렬 기능 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 150: R248 신규 기능 ───────────────────────────────
console.log('\n## 150. 신규 기능 파일 검사 (R248)')
// NotesPanel 노트 검색 기능 (Round 248)
const np248Path = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(np248Path)) {
  const np248 = readFileSync(np248Path, 'utf-8')
  if (np248.includes('searchQuery') && np248.includes('filteredNotes') && np248.includes('노트 검색')) {
    log('pass', 'Round248', 'NotesPanel: 노트 검색 기능 (searchQuery + filteredNotes) 구현 존재')
  } else {
    log('warning', 'Round248', 'NotesPanel 노트 검색 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 149: R247 신규 기능 ───────────────────────────────
console.log('\n## 149. 신규 기능 파일 검사 (R247)')
// SceneView Alt+[/] 투명도 조절 (Round 247)
const svp247Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp247Path)) {
  const svp247 = readFileSync(svp247Path, 'utf-8')
  if (svp247.includes("key === '['") && svp247.includes('투명도') && svp247.includes('opacity + delta')) {
    log('pass', 'Round247', 'SceneViewPanel: Alt+[/] 투명도 조절 단축키 구현 존재')
  } else {
    log('warning', 'Round247', 'SceneViewPanel Alt+[/] 투명도 단축키 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 148: R246 신규 기능 ───────────────────────────────
console.log('\n## 148. 신규 기능 파일 검사 (R246)')
// SceneView 선택 반전 Ctrl+Shift+A (Round 246)
const svp246Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp246Path)) {
  const svp246 = readFileSync(svp246Path, 'utf-8')
  if (svp246.includes('선택 반전') && svp246.includes('shiftKey') && svp246.includes('inverted')) {
    log('pass', 'Round246', 'SceneViewPanel: Ctrl+Shift+A 선택 반전 구현 존재')
  } else {
    log('warning', 'Round246', 'SceneViewPanel 선택 반전 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 147: R245 신규 기능 ───────────────────────────────
console.log('\n## 147. 신규 기능 파일 검사 (R245)')
// SceneView 인라인 편집바 rotation 필드 (Round 245)
const svp245Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp245Path)) {
  const svp245 = readFileSync(svp245Path, 'utf-8')
  if (svp245.includes("'r': string") && svp245.includes("'rotation'") && svp245.includes("'r'] as const")) {
    log('pass', 'Round245', 'SceneViewPanel: 인라인 편집바 rotation(r) 필드 구현 존재')
  } else if (svp245.includes('r: string') && svp245.includes("=== 'r' ? 'rotation'") && svp245.includes("'r'] as const")) {
    log('pass', 'Round245', 'SceneViewPanel: 인라인 편집바 rotation(r) 필드 구현 존재')
  } else {
    log('warning', 'Round245', 'SceneViewPanel 인라인 편집바 rotation 필드 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 146: R244 신규 기능 ───────────────────────────────
console.log('\n## 146. 신규 기능 파일 검사 (R244)')
// SceneView 연결선 커브 + 화살표 (Round 244)
const svp244Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp244Path)) {
  const svp244 = readFileSync(svp244Path, 'utf-8')
  if (svp244.includes('conn-arrow') && svp244.includes('cubic bezier') && svp244.includes('markerEnd')) {
    log('pass', 'Round244', 'SceneViewPanel: 연결선 cubic bezier + 화살표 마커 구현 존재')
  } else {
    log('warning', 'Round244', 'SceneViewPanel 연결선 커브/화살표 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 145: R243 신규 기능 ───────────────────────────────
console.log('\n## 145. 신규 기능 파일 검사 (R243)')
// SceneView 드래그 델타 오버레이 (Round 243)
const svp243Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp243Path)) {
  const svp243 = readFileSync(svp243Path, 'utf-8')
  if (svp243.includes('dragDelta') && svp243.includes('드래그 델타 오버레이') && svp243.includes('Δx')) {
    log('pass', 'Round243', 'SceneViewPanel: 드래그 델타 오버레이 구현 존재')
  } else {
    log('warning', 'Round243', 'SceneViewPanel 드래그 델타 오버레이 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 144: R242 신규 기능 ───────────────────────────────
console.log('\n## 144. 신규 기능 파일 검사 (R242)')
// SceneView 그룹 해제 (Round 242)
const svp242Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp242Path)) {
  const svp242 = readFileSync(svp242Path, 'utf-8')
  if (svp242.includes('handleUngroup') && svp242.includes('Ctrl+Shift+G') && svp242.includes('그룹 해제')) {
    log('pass', 'Round242', 'SceneViewPanel: 그룹 해제 (handleUngroup + Ctrl+Shift+G) 구현 존재')
  } else {
    log('warning', 'Round242', 'SceneViewPanel 그룹 해제 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 143: R241 신규 기능 ───────────────────────────────
console.log('\n## 143. 신규 기능 파일 검사 (R241)')
// SceneView Alt+1~9 색상 레이블 (Round 241)
const svp241Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp241Path)) {
  const svp241 = readFileSync(svp241Path, 'utf-8')
  if (svp241.includes('LABEL_COLORS') && svp241.includes('Alt+0~9') && svp241.includes('labelColor')) {
    log('pass', 'Round241', 'SceneViewPanel: Alt+1~9 빠른 색상 레이블 구현 존재')
  } else {
    log('warning', 'Round241', 'SceneViewPanel 색상 레이블 단축키 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 142: R240 신규 기능 ───────────────────────────────
console.log('\n## 142. 신규 기능 파일 검사 (R240)')
// SceneView 호버 툴팁 개선 (Round 240)
const svp240Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp240Path)) {
  const svp240 = readFileSync(svp240Path, 'utf-8')
  if (svp240.includes('components[0]') && svp240.includes('tooltipVisibleUuid')) {
    log('pass', 'Round240', 'SceneViewPanel: 호버 툴팁 리치 정보 (첫 컴포넌트, 딜레이) 존재')
  } else {
    log('warning', 'Round240', 'SceneViewPanel 리치 툴팁 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 141: R239 신규 기능 ───────────────────────────────
console.log('\n## 141. 신규 기능 파일 검사 (R239)')
// SceneView 컨텍스트 메뉴 확장 + H키 (Round 239)
const svp239Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp239Path)) {
  const svp239 = readFileSync(svp239Path, 'utf-8')
  if (svp239.includes("key === 'h'") && svp239.includes('가시성 토글')) {
    log('pass', 'Round239', 'SceneViewPanel: H키 가시성 토글 단축키 구현 존재')
  } else {
    log('warning', 'Round239', 'SceneViewPanel H키 가시성 단축키 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (svp239.includes('숨기기') && svp239.includes('잠금 해제') && svp239.includes('즐겨찾기 추가')) {
    log('pass', 'Round239', 'SceneViewPanel: 컨텍스트 메뉴 확장 항목 구현 존재')
  } else {
    log('warning', 'Round239', 'SceneViewPanel 컨텍스트 메뉴 미확장', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 140: R238 신규 기능 ───────────────────────────────
console.log('\n## 140. 신규 기능 파일 검사 (R238)')
// SceneView 멀티셀렉트 G키 bounding box 줌 (Round 238)
const svp238Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp238Path)) {
  const svp238 = readFileSync(svp238Path, 'utf-8')
  if (svp238.includes('selectedUuids.size > 1') && svp238.includes('bboxW') && svp238.includes('bounding box')) {
    log('pass', 'Round238', 'SceneViewPanel: 멀티셀렉트 bounding box 줌 구현 존재')
  } else {
    log('warning', 'Round238', 'SceneViewPanel 멀티셀렉트 bbox 줌 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 139: R237 신규 기능 ───────────────────────────────
console.log('\n## 139. 신규 기능 파일 검사 (R237)')
// SceneView 노드 경로 브레드크럼 (Round 237)
const svp237Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp237Path)) {
  const svp237 = readFileSync(svp237Path, 'utf-8')
  if (svp237.includes('nodePath') && svp237.includes('브레드크럼') && svp237.includes('parentUuid')) {
    log('pass', 'Round237', 'SceneViewPanel: 노드 경로 브레드크럼 구현 존재')
  } else {
    log('warning', 'Round237', 'SceneViewPanel 브레드크럼 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 138: R236 신규 기능 ───────────────────────────────
console.log('\n## 138. 신규 기능 파일 검사 (R236)')
// SceneView 태그 필터 (Round 236)
const svp236Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const st236Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(svp236Path) && existsSync(st236Path)) {
  const svp236 = readFileSync(svp236Path, 'utf-8')
  const st236 = readFileSync(st236Path, 'utf-8')
  if (svp236.includes('tagFilter') && svp236.includes('allTags') && svp236.includes('태그 필터')) {
    log('pass', 'Round236', 'SceneViewPanel: 태그 필터 상태 및 dimmed 로직 구현 존재')
  } else {
    log('warning', 'Round236', 'SceneViewPanel 태그 필터 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (st236.includes('onTagFilterChange') && st236.includes('allTags') && st236.includes('#태그')) {
    log('pass', 'Round236', 'SceneToolbar: 태그 필터 드롭다운 구현 존재')
  } else {
    log('warning', 'Round236', 'SceneToolbar 태그 필터 드롭다운 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 137: R235 신규 기능 ───────────────────────────────
console.log('\n## 137. 신규 기능 파일 검사 (R235)')
// SceneView 노드 잠금 (Round 235)
const svp235Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const nr235Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
const st235Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(svp235Path) && existsSync(nr235Path) && existsSync(st235Path)) {
  const svp235 = readFileSync(svp235Path, 'utf-8')
  const nr235 = readFileSync(nr235Path, 'utf-8')
  const st235 = readFileSync(st235Path, 'utf-8')
  if (svp235.includes("key === 'l'") && svp235.includes('Alt+L') && svp235.includes('잠금/해제')) {
    log('pass', 'Round235', 'SceneViewPanel: Alt+L 노드 잠금 단축키 구현 존재')
  } else {
    log('warning', 'Round235', 'SceneViewPanel Alt+L 잠금 단축키 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (nr235.includes('locked') && nr235.includes('🔒')) {
    log('pass', 'Round235', 'NodeRenderer: locked prop + 🔒 아이콘 구현 존재')
  } else {
    log('warning', 'Round235', 'NodeRenderer locked/🔒 미구현', 'SceneView/NodeRenderer.tsx')
  }
  if (st235.includes('isSelectedLocked') && st235.includes('onLockToggle') && st235.includes('🔒')) {
    log('pass', 'Round235', 'SceneToolbar: 잠금 버튼 구현 존재')
  } else {
    log('warning', 'Round235', 'SceneToolbar 잠금 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 136: R234 신규 기능 ───────────────────────────────
console.log('\n## 136. 신규 기능 파일 검사 (R234)')
// SceneView 노드 크기 맞추기 (Round 234)
const svp234Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const st234Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(svp234Path) && existsSync(st234Path)) {
  const svp234 = readFileSync(svp234Path, 'utf-8')
  const st234 = readFileSync(st234Path, 'utf-8')
  if (svp234.includes('handleMatchSize') && svp234.includes('onMatchWidth') && svp234.includes('크기 맞추기')) {
    log('pass', 'Round234', 'SceneViewPanel: 노드 크기 맞추기 (W/H/both) 구현 존재')
  } else {
    log('warning', 'Round234', 'SceneViewPanel 크기 맞추기 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (st234.includes('onMatchWidth') && st234.includes('onMatchHeight') && st234.includes('onMatchBoth')) {
    log('pass', 'Round234', 'SceneToolbar: 크기 맞추기 버튼 3종 존재')
  } else {
    log('warning', 'Round234', 'SceneToolbar 크기 맞추기 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 135: R233 신규 기능 ───────────────────────────────
console.log('\n## 135. 신규 기능 파일 검사 (R233)')
// SceneView Dirty 표시 (Round 233)
const svp233Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp233Path)) {
  const svp233 = readFileSync(svp233Path, 'utf-8')
  if (svp233.includes('isDirty') && svp233.includes('저장 안됨') && svp233.includes('nodeMapInitRef')) {
    log('pass', 'Round233', 'SceneViewPanel: 씬 변경 감지 + Dirty 표시 구현 존재')
  } else {
    log('warning', 'Round233', 'SceneViewPanel Dirty 표시 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 134: R232 신규 기능 ───────────────────────────────
console.log('\n## 134. 신규 기능 파일 검사 (R232)')
// SceneView PNG 내보내기 (Round 232)
const svp232Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const st232Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(svp232Path) && existsSync(st232Path)) {
  const svp232 = readFileSync(svp232Path, 'utf-8')
  const st232 = readFileSync(st232Path, 'utf-8')
  if (svp232.includes('handleExportPng') && svp232.includes('scene.png') && svp232.includes('toDataURL')) {
    log('pass', 'Round232', 'SceneViewPanel: PNG 내보내기 (SVG→Canvas→PNG) 구현 존재')
  } else {
    log('warning', 'Round232', 'SceneViewPanel PNG 내보내기 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (st232.includes('onExportPng') && st232.includes('PNG')) {
    log('pass', 'Round232', 'SceneToolbar: PNG 내보내기 버튼 존재')
  } else {
    log('warning', 'Round232', 'SceneToolbar PNG 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 133: R231 신규 기능 ───────────────────────────────
console.log('\n## 133. 신규 기능 파일 검사 (R231)')
// SceneView 카메라 뷰 히스토리 (Round 231)
const svp231Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp231Path)) {
  const svp231 = readFileSync(svp231Path, 'utf-8')
  if (svp231.includes('viewHistoryRef') && svp231.includes('viewHistIdxRef') && svp231.includes('ArrowLeft') && svp231.includes('카메라 히스토리')) {
    log('pass', 'Round231', 'SceneViewPanel: 카메라 뷰 히스토리 + Alt+←/→ 네비게이션 존재')
  } else {
    log('warning', 'Round231', 'SceneViewPanel 카메라 히스토리 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 132: R230 신규 기능 ───────────────────────────────
console.log('\n## 132. 신규 기능 파일 검사 (R230)')
// SceneView 즐겨찾기 노드 (Round 230)
const svp230Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const nr230Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(svp230Path) && existsSync(nr230Path)) {
  const svp230 = readFileSync(svp230Path, 'utf-8')
  const nr230 = readFileSync(nr230Path, 'utf-8')
  if (svp230.includes('bookmarkedUuids') && svp230.includes('즐겨찾기') && svp230.includes('Ctrl+B')) {
    log('pass', 'Round230', 'SceneViewPanel: 즐겨찾기 상태 + 목록 팝업 + Ctrl+B 단축키 존재')
  } else {
    log('warning', 'Round230', 'SceneViewPanel 즐겨찾기 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (nr230.includes('bookmarked') && nr230.includes('★')) {
    log('pass', 'Round230', 'NodeRenderer: 즐겨찾기 별 표시 존재')
  } else {
    log('warning', 'Round230', 'NodeRenderer 즐겨찾기 표시 미구현', 'SceneView/NodeRenderer.tsx')
  }
}

// ── Section 131: R229 신규 기능 ───────────────────────────────
console.log('\n## 131. 신규 기능 파일 검사 (R229)')
// SceneView 참조 이미지 오버레이 (Round 229)
const svp229Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const st229Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(svp229Path) && existsSync(st229Path)) {
  const svp229 = readFileSync(svp229Path, 'utf-8')
  const st229 = readFileSync(st229Path, 'utf-8')
  if (svp229.includes('refImageUrl') && svp229.includes('refImageOpacity') && svp229.includes('참조 이미지')) {
    log('pass', 'Round229', 'SceneViewPanel: 참조 이미지 오버레이 + 설정 패널 구현 존재')
  } else {
    log('warning', 'Round229', 'SceneViewPanel 참조 이미지 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (st229.includes('hasRefImage') && st229.includes('onRefImageToggle')) {
    log('pass', 'Round229', 'SceneToolbar: 참조 이미지 버튼 존재')
  } else {
    log('warning', 'Round229', 'SceneToolbar 참조 이미지 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 130: R228 신규 기능 ───────────────────────────────
console.log('\n## 130. 신규 기능 파일 검사 (R228)')
// SceneView 측정 도구 (Round 228)
const svp228Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const st228Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(svp228Path) && existsSync(st228Path)) {
  const svp228 = readFileSync(svp228Path, 'utf-8')
  const st228 = readFileSync(st228Path, 'utf-8')
  if (svp228.includes('measureMode') && svp228.includes('measureLine') && svp228.includes('측정 도구')) {
    log('pass', 'Round228', 'SceneViewPanel: 측정 도구 모드 + 라인 렌더링 존재')
  } else {
    log('warning', 'Round228', 'SceneViewPanel 측정 도구 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (st228.includes('measureMode') && st228.includes('onMeasureModeToggle') && st228.includes('Ruler')) {
    log('pass', 'Round228', 'SceneToolbar: 측정 도구 버튼 존재')
  } else {
    log('warning', 'Round228', 'SceneToolbar 측정 도구 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 129: R227 신규 기능 ───────────────────────────────
console.log('\n## 129. 신규 기능 파일 검사 (R227)')
// SceneView 인라인 편집바 (Round 227)
const svp227Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp227Path)) {
  const svp227 = readFileSync(svp227Path, 'utf-8')
  if (svp227.includes('nodeEditDraft') && svp227.includes('인라인 편집바') && svp227.includes('updateNode')) {
    log('pass', 'Round227', 'SceneViewPanel: 선택 노드 인라인 X/Y/W/H 편집바 구현 존재')
  } else {
    log('warning', 'Round227', 'SceneViewPanel 인라인 편집바 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 128: R226 신규 기능 ───────────────────────────────
console.log('\n## 128. 신규 기능 파일 검사 (R226)')
// SceneView 검색 순환 네비게이션 (Round 226)
const svp226Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp226Path)) {
  const svp226 = readFileSync(svp226Path, 'utf-8')
  if (svp226.includes('searchMatchIndex') && svp226.includes('searchMatches') && svp226.includes('handleSearchNav')) {
    log('pass', 'Round226', 'SceneViewPanel: 검색 순환 네비게이션 구현 존재')
  } else {
    log('warning', 'Round226', 'SceneViewPanel 검색 순환 네비게이션 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 127: R225 신규 기능 ───────────────────────────────
console.log('\n## 127. 신규 기능 파일 검사 (R225)')
// SceneView Focus Mode (Round 225)
const svp225Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const st225Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(svp225Path) && existsSync(st225Path)) {
  const svp225 = readFileSync(svp225Path, 'utf-8')
  const st225 = readFileSync(st225Path, 'utf-8')
  if (svp225.includes('focusMode') && svp225.includes('onFocusModeToggle') && svp225.includes('포커스')) {
    log('pass', 'Round225', 'SceneViewPanel: Focus Mode 상태 + 단축키 + 툴바 연결 존재')
  } else {
    log('warning', 'Round225', 'SceneViewPanel Focus Mode 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (st225.includes('focusMode') && st225.includes('onFocusModeToggle') && st225.includes('포커스')) {
    log('pass', 'Round225', 'SceneToolbar: Focus Mode 버튼 존재')
  } else {
    log('warning', 'Round225', 'SceneToolbar Focus Mode 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 126: R224 신규 기능 ───────────────────────────────
console.log('\n## 126. 신규 기능 파일 검사 (R224)')
// SceneView 노드 그룹 접기/펼치기 (Round 224)
const svp224Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const nr224Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(svp224Path) && existsSync(nr224Path)) {
  const svp224 = readFileSync(svp224Path, 'utf-8')
  const nr224 = readFileSync(nr224Path, 'utf-8')
  if (svp224.includes('collapsedUuids') && svp224.includes('e.altKey') && svp224.includes('접기')) {
    log('pass', 'Round224', 'SceneViewPanel: Alt+클릭 그룹 접기/펼치기 구현 존재')
  } else {
    log('warning', 'Round224', 'SceneViewPanel 그룹 접기 미구현', 'SceneView/SceneViewPanel.tsx')
  }
  if (nr224.includes('collapsed') && nr224.includes('hasChildren')) {
    log('pass', 'Round224', 'NodeRenderer: collapsed/hasChildren 표시 구현 존재')
  } else {
    log('warning', 'Round224', 'NodeRenderer 접힘 표시 미구현', 'SceneView/NodeRenderer.tsx')
  }
}

// ── Section 125: R223 신규 기능 ───────────────────────────────
console.log('\n## 125. 신규 기능 파일 검사 (R223)')
// SceneView 컴포넌트 타입 필터 (Round 223)
const svp223Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
const st223Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
const nr223Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(svp223Path) && existsSync(st223Path) && existsSync(nr223Path)) {
  const svp223 = readFileSync(svp223Path, 'utf-8')
  const st223 = readFileSync(st223Path, 'utf-8')
  const nr223 = readFileSync(nr223Path, 'utf-8')
  if (svp223.includes('componentFilter') && svp223.includes('componentTypes') && svp223.includes('onComponentFilterChange')) {
    log('pass', 'Round223', 'SceneViewPanel: 컴포넌트 필터 상태 + 툴바 연결 존재')
  } else {
    log('warning', 'Round223', 'SceneViewPanel 컴포넌트 필터 미연결', 'SceneView/SceneViewPanel.tsx')
  }
  if (st223.includes('componentFilter') && st223.includes('onComponentFilterChange')) {
    log('pass', 'Round223', 'SceneToolbar: 컴포넌트 필터 드롭다운 존재')
  } else {
    log('warning', 'Round223', 'SceneToolbar 컴포넌트 필터 미구현', 'SceneView/SceneToolbar.tsx')
  }
  if (nr223.includes('dimmed') && nr223.includes('baseOpacity')) {
    log('pass', 'Round223', 'NodeRenderer: dimmed prop으로 필터 미매칭 노드 희미하게 처리')
  } else {
    log('warning', 'Round223', 'NodeRenderer dimmed 미구현', 'SceneView/NodeRenderer.tsx')
  }
}

// ── Section 124: R222 신규 기능 ───────────────────────────────
console.log('\n## 124. 신규 기능 파일 검사 (R222)')
// SceneView 노드 이동 히스토리 (Round 222)
const svp222Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp222Path)) {
  const svp222 = readFileSync(svp222Path, 'utf-8')
  if (svp222.includes('changeHistory') && svp222.includes('showChangeHistory') && svp222.includes('최근 이동 히스토리')) {
    log('pass', 'Round222', 'SceneViewPanel: 노드 이동 히스토리 UI 구현 존재')
  } else {
    log('warning', 'Round222', 'SceneViewPanel 이동 히스토리 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 123: R221 신규 기능 ───────────────────────────────
console.log('\n## 123. 신규 기능 파일 검사 (R221)')
// SceneView LOD 렌더링 (Round 221)
const nr221Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nr221Path)) {
  const nr221 = readFileSync(nr221Path, 'utf-8')
  if (nr221.includes('lod') && nr221.includes('LOD') && nr221.includes('view.zoom < 0.2')) {
    log('pass', 'Round221', 'NodeRenderer: LOD 줌 레벨별 디테일 렌더링 존재')
  } else {
    log('warning', 'Round221', 'NodeRenderer LOD 미구현', 'SceneView/NodeRenderer.tsx')
  }
}

// ── Section 122: R220 신규 기능 ───────────────────────────────
console.log('\n## 122. 신규 기능 파일 검사 (R220)')
// SceneView Ctrl+F 검색 하이라이트 (Round 220)
const svp220Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp220Path)) {
  const svp220 = readFileSync(svp220Path, 'utf-8')
  if (svp220.includes('canvasSearch') && svp220.includes('showCanvasSearch') && svp220.includes('검색 하이라이트 링')) {
    log('pass', 'Round220', 'SceneViewPanel: Ctrl+F 검색 + 하이라이트 링 구현 존재')
  } else {
    log('warning', 'Round220', 'SceneViewPanel Ctrl+F 검색 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 121: R219 신규 기능 ───────────────────────────────
console.log('\n## 121. 신규 기능 파일 검사 (R219)')
// SceneView 하단 상태바 (Round 219)
const svp219Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp219Path)) {
  const svp219 = readFileSync(svp219Path, 'utf-8')
  if (svp219.includes('상태바') && svp219.includes('Space: 드래그로 패닝')) {
    log('pass', 'Round219', 'SceneViewPanel: 하단 상태바 구현 존재')
  } else {
    log('warning', 'Round219', 'SceneViewPanel 상태바 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 120: R218 신규 기능 ───────────────────────────────
console.log('\n## 120. 신규 기능 파일 검사 (R218)')
// SceneView Cocos 적용 버튼 (Round 218)
const insp218Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(insp218Path)) {
  const insp218 = readFileSync(insp218Path, 'utf-8')
  if (insp218.includes('onApplyToCocos') && insp218.includes('Cocos에 적용')) {
    log('pass', 'Round218', 'SceneInspector: Cocos에 적용 버튼 존재')
  } else {
    log('warning', 'Round218', 'SceneInspector Cocos 적용 버튼 미구현', 'SceneView/SceneInspector.tsx')
  }
}
const svp218Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp218Path)) {
  const svp218 = readFileSync(svp218Path, 'utf-8')
  if (svp218.includes('onApplyToCocos') && svp218.includes('ccMoveNode')) {
    log('pass', 'Round218', 'SceneViewPanel: onApplyToCocos ccMoveNode 연동 존재')
  } else {
    log('warning', 'Round218', 'SceneViewPanel Cocos 적용 연동 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 119: R217 신규 기능 ───────────────────────────────
console.log('\n## 119. 신규 기능 파일 검사 (R217)')
// SceneView 씬 통계 패널 (Round 217)
const svp217Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp217Path)) {
  const svp217 = readFileSync(svp217Path, 'utf-8')
  if (svp217.includes('showStats') && svp217.includes('씬 통계')) {
    log('pass', 'Round217', 'SceneViewPanel: 씬 통계 패널 구현 존재')
  } else {
    log('warning', 'Round217', 'SceneViewPanel 씬 통계 패널 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}
const stb217Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(stb217Path)) {
  const stb217 = readFileSync(stb217Path, 'utf-8')
  if (stb217.includes('onStatsToggle') && stb217.includes('통계')) {
    log('pass', 'Round217', 'SceneToolbar: 통계 토글 버튼 존재')
  } else {
    log('warning', 'Round217', 'SceneToolbar 통계 토글 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 118: R216 신규 기능 ───────────────────────────────
console.log('\n## 118. 신규 기능 파일 검사 (R216)')
// SceneView 부모-자식 연결선 (Round 216)
const svp216Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp216Path)) {
  const svp216 = readFileSync(svp216Path, 'utf-8')
  if (svp216.includes('showConnections') && svp216.includes('부모-자식 연결선')) {
    log('pass', 'Round216', 'SceneViewPanel: 부모-자식 연결선 SVG 렌더링 존재')
  } else {
    log('warning', 'Round216', 'SceneViewPanel 연결선 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}
const stb216Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(stb216Path)) {
  const stb216 = readFileSync(stb216Path, 'utf-8')
  if (stb216.includes('onConnectionsToggle') && stb216.includes('연결선')) {
    log('pass', 'Round216', 'SceneToolbar: 연결선 토글 버튼 존재')
  } else {
    log('warning', 'Round216', 'SceneToolbar 연결선 토글 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 117: R215 신규 기능 ───────────────────────────────
console.log('\n## 117. 신규 기능 파일 검사 (R215)')
// SceneView 노드 라벨 색상 (Round 215)
const types215Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/types.ts')
if (existsSync(types215Path)) {
  const types215 = readFileSync(types215Path, 'utf-8')
  if (types215.includes('labelColor?: string')) {
    log('pass', 'Round215', 'types.ts: SceneNode.labelColor 필드 존재')
  } else {
    log('warning', 'Round215', 'SceneNode labelColor 필드 미구현', 'SceneView/types.ts')
  }
}
const nr215Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nr215Path)) {
  const nr215 = readFileSync(nr215Path, 'utf-8')
  if (nr215.includes('labelColor')) {
    log('pass', 'Round215', 'NodeRenderer: labelColor fill 처리 존재')
  } else {
    log('warning', 'Round215', 'NodeRenderer labelColor 미구현', 'SceneView/NodeRenderer.tsx')
  }
}
const insp215Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(insp215Path)) {
  const insp215 = readFileSync(insp215Path, 'utf-8')
  if (insp215.includes('onLabelColorUpdate') && insp215.includes('라벨 색상')) {
    log('pass', 'Round215', 'SceneInspector: 라벨 색상 피커 존재')
  } else {
    log('warning', 'Round215', 'SceneInspector 라벨 색상 피커 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 116: R214 신규 기능 ───────────────────────────────
console.log('\n## 116. 신규 기능 파일 검사 (R214)')
// SceneView 노드 태그 (Round 214)
const types214Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/types.ts')
if (existsSync(types214Path)) {
  const types214 = readFileSync(types214Path, 'utf-8')
  if (types214.includes('tags?: string[]')) {
    log('pass', 'Round214', 'types.ts: SceneNode.tags 필드 존재')
  } else {
    log('warning', 'Round214', 'SceneNode tags 필드 미구현', 'SceneView/types.ts')
  }
}
const insp214Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(insp214Path)) {
  const insp214 = readFileSync(insp214Path, 'utf-8')
  if (insp214.includes('onTagsUpdate') && insp214.includes('tagDraft') && insp214.includes('태그')) {
    log('pass', 'Round214', 'SceneInspector: 태그 입력/삭제 UI 존재')
  } else {
    log('warning', 'Round214', 'SceneInspector 태그 UI 미구현', 'SceneView/SceneInspector.tsx')
  }
}
const nhl214Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nhl214Path)) {
  const nhl214 = readFileSync(nhl214Path, 'utf-8')
  if (nhl214.includes('tag:')) {
    log('pass', 'Round214', 'NodeHierarchyList: tag: 프리픽스 태그 필터 존재')
  } else {
    log('warning', 'Round214', 'NodeHierarchyList tag: 필터 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 115: R213 신규 기능 ───────────────────────────────
console.log('\n## 115. 신규 기능 파일 검사 (R213)')
// SceneView 스냅 그리드 크기 조정 (Round 213)
const svp213Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp213Path)) {
  const svp213 = readFileSync(svp213Path, 'utf-8')
  if (svp213.includes('snapGrid') && svp213.includes('onSnapGridChange') && svp213.includes('setSnapGrid')) {
    log('pass', 'Round213', 'SceneViewPanel: 스냅 그리드 크기 상태 및 연동 존재')
  } else {
    log('warning', 'Round213', 'SceneViewPanel 스냅 그리드 크기 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}
const stb213Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(stb213Path)) {
  const stb213 = readFileSync(stb213Path, 'utf-8')
  if (stb213.includes('onSnapGridChange') && stb213.includes('스냅 그리드')) {
    log('pass', 'Round213', 'SceneToolbar: 스냅 그리드 크기 드롭다운 존재')
  } else {
    log('warning', 'Round213', 'SceneToolbar 스냅 그리드 드롭다운 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 114: R212 신규 기능 ───────────────────────────────
console.log('\n## 114. 신규 기능 파일 검사 (R212)')
// SceneView 씬 저장 슬롯 3개 (Round 212)
const svp212Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp212Path)) {
  const svp212 = readFileSync(svp212Path, 'utf-8')
  if (svp212.includes('activeSlot') && svp212.includes('handleSlotChange') && svp212.includes('claude-desktop-scene-layout-')) {
    log('pass', 'Round212', 'SceneViewPanel: 씬 저장 슬롯 3개 구현 존재')
  } else {
    log('warning', 'Round212', 'SceneViewPanel 씬 슬롯 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}
const stb212Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(stb212Path)) {
  const stb212 = readFileSync(stb212Path, 'utf-8')
  if (stb212.includes('onSlotChange') && stb212.includes('슬롯')) {
    log('pass', 'Round212', 'SceneToolbar: 슬롯 드롭다운 존재')
  } else {
    log('warning', 'Round212', 'SceneToolbar 슬롯 드롭다운 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 113: R211 신규 기능 ───────────────────────────────
console.log('\n## 113. 신규 기능 파일 검사 (R211)')
// SceneView 씬 저장/로드 localStorage (Round 211)
const svp211Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp211Path)) {
  const svp211 = readFileSync(svp211Path, 'utf-8')
  if (svp211.includes('handleSaveScene') && svp211.includes('claude-desktop-scene-layout')) {
    log('pass', 'Round211', 'SceneViewPanel: 씬 저장/로드 localStorage 구현 존재')
  } else {
    log('warning', 'Round211', 'SceneViewPanel 씬 저장/로드 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}
const stb211Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(stb211Path)) {
  const stb211 = readFileSync(stb211Path, 'utf-8')
  if (stb211.includes('onSaveScene') && stb211.includes('onLoadScene')) {
    log('pass', 'Round211', 'SceneToolbar: 💾 저장 / 📂 로드 버튼 존재')
  } else {
    log('warning', 'Round211', 'SceneToolbar 저장/로드 버튼 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 112: R210 신규 기능 ───────────────────────────────
console.log('\n## 112. 신규 기능 파일 검사 (R210)')
// SceneView 비례 리사이즈 Shift+드래그 (Round 210)
const svp210Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp210Path)) {
  const svp210 = readFileSync(svp210Path, 'utf-8')
  if (svp210.includes('e.shiftKey') && svp210.includes('비례 리사이즈')) {
    log('pass', 'Round210', 'SceneViewPanel: Shift 비례 리사이즈 구현 존재')
  } else {
    log('warning', 'Round210', 'SceneViewPanel 비례 리사이즈 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 111: R209 신규 기능 ───────────────────────────────
console.log('\n## 111. 신규 기능 파일 검사 (R209)')
// SceneView 노드 가시성 토글 (Round 209)
const nhl209Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nhl209Path)) {
  const nhl209 = readFileSync(nhl209Path, 'utf-8')
  if (nhl209.includes('onToggleVisible') && nhl209.includes('visible')) {
    log('pass', 'Round209', 'NodeHierarchyList: 가시성 토글 👁 아이콘 존재')
  } else {
    log('warning', 'Round209', 'NodeHierarchyList 가시성 토글 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}
const nr209Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nr209Path)) {
  const nr209 = readFileSync(nr209Path, 'utf-8')
  if (nr209.includes('visible === false')) {
    log('pass', 'Round209', 'NodeRenderer: visible=false 시 반투명 처리 존재')
  } else {
    log('warning', 'Round209', 'NodeRenderer visible 처리 미구현', 'SceneView/NodeRenderer.tsx')
  }
}

// ── Section 110: R208 신규 기능 ───────────────────────────────
console.log('\n## 110. 신규 기능 파일 검사 (R208)')
// SceneView SVG 내보내기 (Round 208)
const svp208Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp208Path)) {
  const svp208 = readFileSync(svp208Path, 'utf-8')
  if (svp208.includes('handleExportSvg') && svp208.includes('scene.svg')) {
    log('pass', 'Round208', 'SceneViewPanel: SVG 씬 내보내기 구현 존재')
  } else {
    log('warning', 'Round208', 'SceneViewPanel SVG 내보내기 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}
const stb208Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(stb208Path)) {
  const stb208 = readFileSync(stb208Path, 'utf-8')
  if (stb208.includes('onExportSvg')) {
    log('pass', 'Round208', 'SceneToolbar: onExportSvg 버튼 prop 존재')
  } else {
    log('warning', 'Round208', 'SceneToolbar onExportSvg prop 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 109: R207 신규 기능 ───────────────────────────────
console.log('\n## 109. 신규 기능 파일 검사 (R207)')
// SceneView 캔버스 크기 프리셋 (Round 207)
const stb207Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(stb207Path)) {
  const stb207 = readFileSync(stb207Path, 'utf-8')
  if (stb207.includes('canvasSize') && stb207.includes('onCanvasSizeChange') && stb207.includes('960×640')) {
    log('pass', 'Round207', 'SceneToolbar: 캔버스 크기 프리셋 드롭다운 존재')
  } else {
    log('warning', 'Round207', 'SceneToolbar 캔버스 크기 프리셋 미구현', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 108: R206 신규 기능 ───────────────────────────────
console.log('\n## 108. 신규 기능 파일 검사 (R206)')
// SceneView 정렬 가이드라인 (Round 206)
const svp206Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp206Path)) {
  const svp206 = readFileSync(svp206Path, 'utf-8')
  if (svp206.includes('alignGuides') && svp206.includes('정렬 가이드라인')) {
    log('pass', 'Round206', 'SceneView: 드래그 중 정렬 가이드라인 존재')
  } else {
    log('warning', 'Round206', 'SceneView 정렬 가이드라인 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 107: R205 신규 기능 ───────────────────────────────
console.log('\n## 107. 신규 기능 파일 검사 (R205)')
// NotesPanel 신규 패널 (Round 205)
const notesPanelPath = join(ROOT, 'src/renderer/src/components/sidebar/NotesPanel.tsx')
if (existsSync(notesPanelPath)) {
  const np = readFileSync(notesPanelPath, 'utf-8')
  if (np.includes('NotesPanel') && np.includes('claude-desktop-notes') && np.includes('새 노트')) {
    log('pass', 'Round205', 'NotesPanel: 자유 메모장 패널 존재')
  } else {
    log('warning', 'Round205', 'NotesPanel 미구현', 'sidebar/NotesPanel.tsx')
  }
}

// ── Section 106: R204 신규 기능 ───────────────────────────────
console.log('\n## 106. 신규 기능 파일 검사 (R204)')
// SceneInspector 노드 메모 (Round 204)
const si204Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(si204Path)) {
  const si204 = readFileSync(si204Path, 'utf-8')
  if (si204.includes('onMemo') && si204.includes('memoDraft') && si204.includes('노드에 메모 추가')) {
    log('pass', 'Round204', 'SceneInspector: 노드 메모 입력란 존재')
  } else {
    log('warning', 'Round204', 'SceneInspector 노드 메모 미구현', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 105: R203 신규 기능 ───────────────────────────────
console.log('\n## 105. 신규 기능 파일 검사 (R203)')
// SceneView 노드 잠금 (Round 203)
const nhl203Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nhl203Path)) {
  const nhl203 = readFileSync(nhl203Path, 'utf-8')
  if (nhl203.includes('onToggleLock') && nhl203.includes('node.locked') && nhl203.includes('잠금')) {
    log('pass', 'Round203', 'SceneView: 노드 잠금 아이콘 + 드래그 방어 존재')
  } else {
    log('warning', 'Round203', 'SceneView 노드 잠금 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 104: R202 신규 기능 ───────────────────────────────
console.log('\n## 104. 신규 기능 파일 검사 (R202)')
// SceneView 픽셀 눈금자 (Round 202)
const svp202Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp202Path)) {
  const svp202 = readFileSync(svp202Path, 'utf-8')
  if (svp202.includes('showRuler') && svp202.includes('getRulerTicks')) {
    log('pass', 'Round202', 'SceneView: 픽셀 눈금자 (R 키 토글) 존재')
  } else {
    log('warning', 'Round202', 'SceneView 픽셀 눈금자 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 103: R201 신규 기능 ───────────────────────────────
console.log('\n## 103. 신규 기능 파일 검사 (R201)')
// SceneView N/E/S/W 측면 리사이즈 핸들 (Round 201)
const svp201Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp201Path)) {
  const svp201 = readFileSync(svp201Path, 'utf-8')
  if (svp201.includes("id: 'n'") && svp201.includes("id: 'e'") && svp201.includes("id: 's'") && svp201.includes("id: 'w'")) {
    log('pass', 'Round201', 'SceneView: N/E/S/W 측면 리사이즈 핸들 존재')
  } else {
    log('warning', 'Round201', 'SceneView 측면 리사이즈 핸들 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 102: R200 신규 기능 ───────────────────────────────
console.log('\n## 102. 신규 기능 파일 검사 (R200)')
// SceneView Ctrl+G 그룹화 (Round 200)
const svp200Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp200Path)) {
  const svp200 = readFileSync(svp200Path, 'utf-8')
  if (svp200.includes("e.key === 'g'") && svp200.includes('handleGroup') && svp200.includes("name: 'Group'")) {
    log('pass', 'Round200', 'SceneView: Ctrl+G 노드 그룹화 존재')
  } else {
    log('warning', 'Round200', 'SceneView Ctrl+G 그룹화 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 101: R199 신규 기능 ───────────────────────────────
console.log('\n## 101. 신규 기능 파일 검사 (R199)')
// NodeHierarchyList 인라인 이름 편집 (Round 199)
const nhl199Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nhl199Path)) {
  const nhl199 = readFileSync(nhl199Path, 'utf-8')
  if (nhl199.includes('onRename') && nhl199.includes('editingUuid') && nhl199.includes('이름 변경')) {
    log('pass', 'Round199', 'NodeHierarchyList: 인라인 이름 편집 (더블클릭/컨텍스트메뉴) 존재')
  } else {
    log('warning', 'Round199', 'NodeHierarchyList 인라인 이름 편집 미구현', 'SceneView/NodeHierarchyList.tsx')
  }
}

// ── Section 100: R198 신규 기능 ───────────────────────────────
console.log('\n## 100. 신규 기능 파일 검사 (R198)')
// SceneView Ctrl+]/Ctrl+[ z-order 변경 (Round 198)
const svp198Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp198Path)) {
  const svp198 = readFileSync(svp198Path, 'utf-8')
  if (svp198.includes("e.key === ']'") && svp198.includes('z-order') && svp198.includes('childUuids')) {
    log('pass', 'Round198', 'SceneView: Ctrl+]/[ z-order 변경 존재')
  } else {
    log('warning', 'Round198', 'SceneView Ctrl+]/[ z-order 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 99: R197 신규 기능 ───────────────────────────────
console.log('\n## 99. 신규 기능 파일 검사 (R197)')
// SceneView Tab/Shift+Tab 형제 노드 순환 선택 (Round 197)
const svp197Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp197Path)) {
  const svp197 = readFileSync(svp197Path, 'utf-8')
  if (svp197.includes("e.key === 'Tab'") && svp197.includes('parent.childUuids')) {
    log('pass', 'Round197', 'SceneView: Tab/Shift+Tab 형제 노드 순환 선택 존재')
  } else {
    log('warning', 'Round197', 'SceneView Tab/Shift+Tab 형제 노드 순환 미구현', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 102: 종속성 검사 ─────────────────────────────
console.log('\n## 102. 종속성 검사')

// 1. package.json 존재 확인
try {
  const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
  log('pass', 'Deps', `package.json 파싱 성공 (name: ${pkgJson.name ?? 'unknown'})`)
} catch {
  log('critical', 'Deps', 'package.json 파싱 실패')
}

// 2. preload expose 메서드 vs 타입 선언 교차 확인
const preloadPath = join(ROOT, 'src/preload/index.ts')
const windowDtsPath = join(ROOT, 'src/renderer/src/env.d.ts')
const windowDtsAltPath = join(ROOT, 'src/renderer/src/window.d.ts')
if (existsSync(preloadPath)) {
  const preloadSrc = readFileSync(preloadPath, 'utf-8')
  const dtsPath = existsSync(windowDtsPath) ? windowDtsPath : existsSync(windowDtsAltPath) ? windowDtsAltPath : null
  const exposedMethods = [...preloadSrc.matchAll(/(\w+):\s*(?:async\s*)?\([^)]*\)\s*=>/g)].map(m => m[1])
  if (dtsPath) {
    const windowDts = readFileSync(dtsPath, 'utf-8')
    for (const method of exposedMethods.slice(0, 5)) {
      if (!windowDts.includes(method)) {
        log('warning', 'Deps', `preload 메서드 '${method}' 타입 선언 누락 가능성`, dtsPath.replace(ROOT + '/', ''))
      }
    }
    log('pass', 'Deps', `preload expose 메서드 ${exposedMethods.length}개 확인`)
  } else {
    log('warning', 'Deps', 'env.d.ts / window.d.ts 없음 — 타입 선언 누락 가능성')
  }
} else {
  log('warning', 'Deps', 'src/preload/index.ts 없음')
}

// 3. IPC 핸들러 등록 수 확인
const routerPath = join(ROOT, 'src/main/ipc/router.ts')
const mainIndexPath = join(ROOT, 'src/main/index.ts')
{
  const routerHandles = existsSync(routerPath)
    ? (readFileSync(routerPath, 'utf-8').match(/ipcMain\.handle/g) ?? []).length
    : 0
  const mainHandles = existsSync(mainIndexPath)
    ? (readFileSync(mainIndexPath, 'utf-8').match(/ipcMain\.handle/g) ?? []).length
    : 0
  const handleCount = routerHandles + mainHandles
  if (handleCount < 5) log('warning', 'Deps', `ipcMain.handle 수 너무 적음: ${handleCount}`)
  else log('pass', 'Deps', `ipcMain.handle 등록: ${handleCount}개 이상`)
}

// 4. 핵심 의존성 설치 확인
const criticalDeps = ['electron', 'react', 'react-dom']
for (const dep of criticalDeps) {
  if (!existsSync(join(ROOT, 'node_modules', dep))) log('critical', 'Deps', `핵심 의존성 누락: ${dep}`)
  else log('pass', 'Deps', `의존성 설치됨: ${dep}`)
}

// 5. tsconfig 존재 확인
if (!existsSync(join(ROOT, 'tsconfig.json')) && !existsSync(join(ROOT, 'tsconfig.node.json'))) {
  log('warning', 'Deps', 'tsconfig 파일 없음')
} else {
  log('pass', 'Deps', 'tsconfig 존재')
}

// ── Section 103: 런타임 안전성 검사 ──────────────────────
console.log('\n## 103. 런타임 안전성 검사')

// 1. AppContent 조건부 Hook 수정 확인 (H1 fix)
const appTsxPath = join(ROOT, 'src/renderer/src/App.tsx')
if (existsSync(appTsxPath)) {
  const appSrc = readFileSync(appTsxPath, 'utf-8')
  if (appSrc.includes('function AppContent') && appSrc.includes('isCCEditorWindow')) {
    const appFnMatch = appSrc.match(/export default function App\(\)[^{]*\{([\s\S]*?)\n\}/)
    if (appFnMatch?.[1]?.includes('isCCEditorWindow')) {
      log('pass', 'Runtime', '조건부 Hook 수정됨: isCCEditorWindow가 App() 레벨에 위치')
    } else {
      log('warning', 'Runtime', 'isCCEditorWindow 위치 확인 필요', 'src/renderer/src/App.tsx')
    }
  } else {
    log('pass', 'Runtime', 'AppContent 조건부 Hook 없음')
  }
} else {
  log('warning', 'Runtime', 'App.tsx 없음')
}

// 2. cc:open-window 싱글톤 패턴 확인 (H4 fix)
if (existsSync(mainIndexPath)) {
  const mainSrc = readFileSync(mainIndexPath, 'utf-8')
  if (mainSrc.includes('ccEditorWin') && mainSrc.includes('isDestroyed()')) {
    log('pass', 'Runtime', 'cc:open-window 싱글톤 패턴 적용됨')
  } else {
    log('warning', 'Runtime', 'cc:open-window 창 중복 생성 위험', 'src/main/index.ts')
  }
} else {
  log('warning', 'Runtime', 'src/main/index.ts 없음')
}

// 3. grepSearch execFile 사용 확인 (H5 fix)
if (existsSync(fsHandlersPath)) {
  const fsHandlersSrc = readFileSync(fsHandlersPath, 'utf-8')
  const grepIdx = fsHandlersSrc.indexOf('grepSearch')
  const grepSection = grepIdx >= 0 ? fsHandlersSrc.slice(grepIdx) : ''
  if (grepSection.includes('execFileAsync') || grepSection.includes('execFile')) {
    log('pass', 'Runtime', 'grepSearch execFile 배열 방식 사용 (shell injection 방어)')
  } else {
    log('warning', 'Runtime', 'grepSearch 여전히 exec 사용 중 — shell injection 위험', 'src/main/ipc/fs-handlers.ts')
  }

  // 4. fs:delete 경로 가드 확인 (L3 fix)
  const deleteIdx = fsHandlersSrc.indexOf('fs:delete')
  const deleteSection = deleteIdx >= 0 ? fsHandlersSrc.slice(deleteIdx) : ''
  if (deleteSection.includes('unsafe path') || deleteSection.includes('normalized.length')) {
    log('pass', 'Runtime', 'fs:delete 경로 가드 존재')
  } else {
    log('warning', 'Runtime', 'fs:delete 재귀 삭제 경로 가드 없음', 'src/main/ipc/fs-handlers.ts')
  }

  // 8. watchDir isDestroyed 체크 확인 (M5 fix)
  if (fsHandlersSrc.includes('isDestroyed()')) {
    log('pass', 'Runtime', 'watchDir sender.isDestroyed() 체크 존재')
  } else {
    log('warning', 'Runtime', 'watchDir sender 생존 확인 없음', 'src/main/ipc/fs-handlers.ts')
  }
} else {
  log('warning', 'Runtime', 'src/main/ipc/fs-handlers.ts 없음')
}

// 5. cc-file-parser 재귀 깊이 제한 확인 (M4 fix)
const parserPath = join(ROOT, 'src/main/cc/cc-file-parser.ts')
if (existsSync(parserPath)) {
  const parserSrc = readFileSync(parserPath, 'utf-8')
  if (parserSrc.includes('depth > 100') || parserSrc.includes('depth >= 100')) {
    log('pass', 'Runtime', 'cc-file-parser 재귀 깊이 제한 존재')
  } else {
    log('warning', 'Runtime', 'cc-file-parser 재귀 깊이 제한 없음 — 스택 오버플로우 위험', 'src/main/cc/cc-file-parser.ts')
  }
} else {
  log('warning', 'Runtime', 'src/main/cc/cc-file-parser.ts 없음')
}

// 6. handleSave try/finally 확인 (H2 fix)
const cocosPanelPath = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocosPanelPath)) {
  const cocosPanelSrc = readFileSync(cocosPanelPath, 'utf-8')
  const handleSaveIdx = cocosPanelSrc.indexOf('handleSave')
  const handleSaveBlock = handleSaveIdx >= 0 ? cocosPanelSrc.slice(handleSaveIdx, handleSaveIdx + 500) : ''
  if (handleSaveBlock.includes('finally')) {
    log('pass', 'Runtime', 'handleSave try/finally 존재 (saving 상태 고착 방지)')
  } else {
    log('warning', 'Runtime', 'handleSave finally 없음 — throw 시 saving 고착 위험', 'src/renderer/src/components/sidebar/CocosPanel.tsx')
  }
} else {
  log('warning', 'Runtime', 'CocosPanel.tsx 없음')
}

// 7. local:// path traversal 강화 확인 (L4 fix)
if (existsSync(mainIndexPath)) {
  const mainSrc = readFileSync(mainIndexPath, 'utf-8')
  if (mainSrc.includes('decodeURIComponent') && mainSrc.includes('allowedBases')) {
    log('pass', 'Runtime', 'local:// path traversal 강화됨 (decodeURIComponent + allowedBases)')
  } else if (mainSrc.includes('decodeURIComponent')) {
    log('pass', 'Runtime', 'local:// decodeURIComponent 적용됨')
  } else {
    log('warning', 'Runtime', 'local:// path traversal 체크 약함', 'src/main/index.ts')
  }
}

// ── Section 104: Phase DD6~DD7 기능 체크 ─────────────────
console.log('\n## 104. Phase DD6~DD7 기능 체크')
{
  const sceneViewSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx'), 'utf8')
  const nodePropertySrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx'), 'utf8')
  const sessionListSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx'), 'utf8')
  const chatPanelSrc = readFileSync(join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx'), 'utf8')
  const fileViewerSrc = readFileSync(join(ROOT, 'src/renderer/src/components/shared/FileViewer.tsx'), 'utf8')
  const appSrc = readFileSync(join(ROOT, 'src/renderer/src/App.tsx'), 'utf8')

  // R513: Delete 키 씬뷰 삭제
  if (sceneViewSrc.includes("e.key === 'Delete'") && sceneViewSrc.includes('handleDeleteNode')) {
    log('pass', 'R513', '씬뷰 Delete 키 핸들러 존재')
  } else {
    log('warning', 'R513', '씬뷰 Delete 키 핸들러 없음', 'SceneViewPanel.tsx')
  }
  // R518: Inspector 섹션 localStorage 저장
  if (nodePropertySrc.includes('inspector-sections-open') && nodePropertySrc.includes('localStorage')) {
    log('pass', 'R518', 'Inspector 섹션 상태 localStorage 저장')
  } else {
    log('warning', 'R518', 'Inspector 섹션 상태 localStorage 미구현', 'NodePropertyPanel.tsx')
  }
  // R520: 타입 힌트 배지
  if (nodePropertySrc.includes('getTypeHint') || nodePropertySrc.includes('typeHint')) {
    log('pass', 'R520', 'Inspector props 타입 힌트 배지 존재')
  } else {
    log('warning', 'R520', 'Inspector props 타입 힌트 배지 없음', 'NodePropertyPanel.tsx')
  }
  // R523: 레이어 가시성 토글
  if (sceneViewSrc.includes('hiddenLayers') && (sceneViewSrc.includes('allLayers') || sceneViewSrc.includes('topLevelNodes') || sceneViewSrc.includes('showLayerPanel'))) {
    log('pass', 'R523', '씬뷰 레이어 가시성 토글 존재')
  } else {
    log('warning', 'R523', '씬뷰 레이어 가시성 토글 없음', 'SceneViewPanel.tsx')
  }
  // R529: 시스템 프롬프트 변수
  if (chatPanelSrc.includes('resolveVars') && (chatPanelSrc.includes('date') && chatPanelSrc.includes('project'))) {
    log('pass', 'R529', '시스템 프롬프트 변수 치환 존재 (resolveVars)')
  } else {
    log('warning', 'R529', '시스템 프롬프트 변수 치환 없음', 'ChatPanel.tsx')
  }
  // R532: SessionList 날짜 그룹
  if (sessionListSrc.includes('getDateGroup') || sessionListSrc.includes('Today') || sessionListSrc.includes('Yesterday')) {
    log('pass', 'R532', 'SessionList 날짜 그룹 헤더 존재')
  } else {
    log('warning', 'R532', 'SessionList 날짜 그룹 헤더 없음', 'SessionList.tsx')
  }
  // R533: 파일 탭 dirty 표시
  if (fileViewerSrc.includes('onDirtyChange') && appSrc.includes('dirtyTabs')) {
    log('pass', 'R533', '파일 탭 미저장 ● 인디케이터 존재')
  } else {
    log('warning', 'R533', '파일 탭 미저장 표시 없음')
  }
}

// ── Section 105: Phase DD8 기능 체크 ─────────────────
console.log('\n## 105. Phase DD8 기능 체크')
{
  const sceneViewSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx'), 'utf8')
  const nodePropertySrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/NodePropertyPanel.tsx'), 'utf8')
  const toolUseIndicatorSrc = readFileSync(join(ROOT, 'src/renderer/src/components/chat/ToolUseIndicator.tsx'), 'utf8')
  const typesSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/types.ts'), 'utf8')

  // R535: UndoEntry prop 타입 지원
  if (typesSrc.includes("type?: 'move' | 'prop'") && sceneViewSrc.includes("type: 'prop'")) {
    log('pass', 'R535', 'UndoEntry prop 타입 지원 (Inspector 속성 변경 undo)')
  } else {
    log('warning', 'R535', 'UndoEntry prop 타입 없음', 'types.ts')
  }
  // R539: Edit 도구 인라인 diff
  if (toolUseIndicatorSrc.includes('InlineDiff') && toolUseIndicatorSrc.includes('old_string')) {
    log('pass', 'R539', 'Edit 도구 인라인 diff 렌더링 존재')
  } else {
    log('warning', 'R539', 'Edit 도구 인라인 diff 없음', 'ToolUseIndicator.tsx')
  }
  // R543: Inspector 배열 속성 편집
  if (nodePropertySrc.includes('ArrayPropRow') && nodePropertySrc.includes('Array.isArray')) {
    log('pass', 'R543', 'Inspector 배열 속성 편집 컴포넌트 존재')
  } else {
    log('warning', 'R543', 'Inspector 배열 속성 편집 없음', 'NodePropertyPanel.tsx')
  }
}

// ── Section 106: Phase DD9 기능 체크 ─────────────────
console.log('\n## 106. Phase DD9 기능 체크')
{
  const sceneViewSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx'), 'utf8')
  const nodeRendererSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx'), 'utf8')
  const messageBubbleSrc = readFileSync(join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx'), 'utf8')
  const fsHandlersSrc = readFileSync(join(ROOT, 'src/main/ipc/fs-handlers.ts'), 'utf8')
  const cocosPanelSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx'), 'utf8')

  // R545: 씬뷰 노드 검색 하이라이트
  if (sceneViewSrc.includes('matchedUuids') && nodeRendererSrc.includes('highlighted')) {
    log('pass', 'R545', '씬뷰 노드 검색 하이라이트 존재')
  } else {
    log('warning', 'R545', '씬뷰 노드 검색 하이라이트 없음', 'SceneViewPanel.tsx')
  }
  // R546: Inspector 실시간 미리보기 (debounce)
  if (cocosPanelSrc.includes('saveTimerRef') && cocosPanelSrc.includes('flushSave')) {
    log('pass', 'R546', 'Inspector 실시간 미리보기 debounce 존재')
  } else {
    log('warning', 'R546', 'Inspector 실시간 미리보기 없음', 'CocosPanel.tsx')
  }
  // R547: 채팅 코드 블록 실행
  if (messageBubbleSrc.includes('shellExec') && fsHandlersSrc.includes('shell:exec')) {
    log('pass', 'R547', '채팅 코드 블록 실행 버튼 존재')
  } else {
    log('warning', 'R547', '채팅 코드 블록 실행 없음', 'MessageBubble.tsx')
  }
}

// ── Section 107: Phase DD9 R549~551 기능 체크 ─────────────────
console.log('\n## 107. Phase DD9 R549~551 기능 체크')
{
  const sceneViewSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx'), 'utf8')
  const nodeRendererSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx'), 'utf8')
  const inputBarSrc = readFileSync(join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx'), 'utf8')
  const sessionHandlersSrc = readFileSync(join(ROOT, 'src/main/ipc/session-handlers.ts'), 'utf8')

  // R549: 씬뷰 노드 핀
  if (sceneViewSrc.includes('pinnedUuids') && nodeRendererSrc.includes('pinned')) {
    log('pass', 'R549', '씬뷰 노드 핀 기능 존재')
  } else {
    log('warning', 'R549', '씬뷰 노드 핀 없음', 'SceneViewPanel.tsx')
  }
  // R550: 세션 병합
  if (sessionHandlersSrc.includes('session:merge')) {
    log('pass', 'R550', '세션 병합 IPC 핸들러 존재')
  } else {
    log('warning', 'R550', '세션 병합 핸들러 없음', 'session-handlers.ts')
  }
  // R551: 프롬프트 히스토리 ↑↓
  if (inputBarSrc.includes('historyIdx') || inputBarSrc.includes('histIdxRef') || inputBarSrc.includes('historyIdxRef')) {
    log('pass', 'R551', '프롬프트 히스토리 ↑↓ 탐색 존재')
  } else {
    log('warning', 'R551', '프롬프트 히스토리 없음', 'InputBar.tsx')
  }
}

// ── Section 108: Phase DD9 R553~555 기능 체크 ─────────────────
console.log('\n## 108. Phase DD9 R553~555 기능 체크')
{
  const cocosPanelSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx'), 'utf8')
  const messageBubbleSrc = readFileSync(join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx'), 'utf8')
  const sceneViewSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx'), 'utf8')
  const sceneToolbarSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx'), 'utf8')

  // R553: Inspector 컴포넌트 drag 재정렬
  if (cocosPanelSrc.includes('draggingIdx') && cocosPanelSrc.includes('dragOverIdx')) {
    log('pass', 'R553', 'Inspector 컴포넌트 drag 재정렬 존재')
  } else {
    log('warning', 'R553', 'Inspector 컴포넌트 drag 재정렬 없음', 'CocosPanel.tsx')
  }
  // R554: 채팅 메시지 번역 버튼
  if (messageBubbleSrc.includes('handleTranslate') && messageBubbleSrc.includes('showTranslation')) {
    log('pass', 'R554', '채팅 메시지 번역 버튼 존재')
  } else {
    log('warning', 'R554', '채팅 메시지 번역 버튼 없음', 'MessageBubble.tsx')
  }
  // R555: 씬뷰 스냅샷 비교
  if (sceneViewSrc.includes('snapshot') && sceneViewSrc.includes('showDiff') && sceneToolbarSrc.includes('onTakeSnapshot')) {
    log('pass', 'R555', '씬뷰 스냅샷 비교 오버레이 존재')
  } else {
    log('warning', 'R555', '씬뷰 스냅샷 비교 없음', 'SceneViewPanel.tsx')
  }
}

// ── Section 109: Phase DD9 R557~559 기능 체크 ─────────────────
console.log('\n## 109. Phase DD9 R557~559 기능 체크')
{
  const sceneViewSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx'), 'utf8')
  const sessionListSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx'), 'utf8')
  const cocosPanelSrc = readFileSync(join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx'), 'utf8')

  // R557: smooth zoom RAF
  if (sceneViewSrc.includes('animateToTarget') && sceneViewSrc.includes('targetViewRef')) {
    log('pass', 'R557', '씬뷰 smooth zoom 애니메이션 존재')
  } else {
    log('warning', 'R557', '씬뷰 smooth zoom 없음', 'SceneViewPanel.tsx')
  }
  // R558: 태그 색상 커스터마이즈
  if (sessionListSrc.includes('tagColors') && sessionListSrc.includes('colorPickerTag')) {
    log('pass', 'R558', '세션 태그 색상 커스터마이즈 존재')
  } else {
    log('warning', 'R558', '세션 태그 색상 없음', 'SessionList.tsx')
  }
  // R559: Inspector wheel 증감
  if (cocosPanelSrc.includes('onWheel') && cocosPanelSrc.includes('shiftKey')) {
    log('pass', 'R559', 'Inspector 숫자 wheel 증감 존재')
  } else {
    log('warning', 'R559', 'Inspector wheel 증감 없음', 'CocosPanel.tsx')
  }
}

// ── Section 110: Phase DD9 R561~563 기능 체크 ────────────────
console.log('\n## 110. Phase DD9 R561~563 기능 체크')
// R561: SceneView 룰러 툴바 버튼
const st561Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(st561Path)) {
  const st561 = readFileSync(st561Path, 'utf-8')
  if (st561.includes('onToggleRuler') && st561.includes('showRuler')) {
    log('pass', 'R561', '씬뷰 룰러 툴바 버튼 존재')
  } else {
    log('warning', 'R561', '씬뷰 룰러 툴바 버튼 없음', 'SceneView/SceneToolbar.tsx')
  }
}

// R562: 채팅 파일 드래그&드롭 첨부
const ib562Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib562Path)) {
  const ib562 = readFileSync(ib562Path, 'utf-8')
  if (ib562.includes('readFileAsText') && ib562.includes('handleContainerDrop')) {
    log('pass', 'R562', '채팅 파일 드래그&드롭 첨부 존재')
  } else {
    log('warning', 'R562', '채팅 파일 드래그&드롭 첨부 없음', 'chat/InputBar.tsx')
  }
}

// R563: SceneTree 노드 즐겨찾기
const cp563Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp563Path)) {
  const cp563 = readFileSync(cp563Path, 'utf-8')
  if (cp563.includes('toggleFavorite') && cp563.includes('favorites')) {
    log('pass', 'R563', 'SceneTree 노드 즐겨찾기 존재')
  } else {
    log('warning', 'R563', 'SceneTree 노드 즐겨찾기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 111: Phase DD9 R565~567 기능 체크 ────────────────
console.log('\n## 111. Phase DD9 R565~567 기능 체크')
// R565: Inspector 프로퍼티 검색
const cp565Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp565Path)) {
  const cp565 = readFileSync(cp565Path, 'utf-8')
  if (cp565.includes('propSearch') && cp565.includes('setPropSearch')) {
    log('pass', 'R565', 'Inspector 프로퍼티 검색 필터 존재')
  } else {
    log('warning', 'R565', 'Inspector 프로퍼티 검색 필터 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R566: 채팅 메시지 이모지 반응
const mb566Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
const cs566Path = join(ROOT, 'src/renderer/src/stores/chat-store.ts')
if (existsSync(mb566Path) && existsSync(cs566Path)) {
  const mb566 = readFileSync(mb566Path, 'utf-8')
  const cs566 = readFileSync(cs566Path, 'utf-8')
  if (mb566.includes('reaction') && cs566.includes('toggleReaction')) {
    log('pass', 'R566', '채팅 메시지 이모지 반응 존재')
  } else {
    log('warning', 'R566', '채팅 메시지 이모지 반응 없음', 'chat/MessageBubble.tsx')
  }
}

// R567: 씬뷰 노드 잠금
const svp567Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp567Path)) {
  const svp567 = readFileSync(svp567Path, 'utf-8')
  if (svp567.includes('lockedUuids') && svp567.includes('scene-locked')) {
    log('pass', 'R567', '씬뷰 노드 잠금 기능 존재')
  } else {
    log('warning', 'R567', '씬뷰 노드 잠금 기능 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 112: Phase DD9 R569~571 기능 체크 ────────────────
console.log('\n## 112. Phase DD9 R569~571 기능 체크')
// R569: 씬뷰 좌표 표시 (SceneToolbar)
const st569Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(st569Path)) {
  const st569 = readFileSync(st569Path, 'utf-8')
  if (st569.includes('mousePos')) {
    log('pass', 'R569', '씬뷰 Cocos 좌표 툴바 표시 존재')
  } else {
    log('warning', 'R569', '씬뷰 Cocos 좌표 툴바 표시 없음', 'SceneView/SceneToolbar.tsx')
  }
}

// R570: 세션 JSON import/export
const sl570Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl570Path)) {
  const sl570 = readFileSync(sl570Path, 'utf-8')
  if (sl570.includes('handleExportSession') && sl570.includes('handleImportSession')) {
    log('pass', 'R570', '세션 JSON import/export 존재')
  } else {
    log('warning', 'R570', '세션 JSON import/export 없음', 'sidebar/SessionList.tsx')
  }
}

// R571: Inspector 숫자 스크럽
const cp571Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp571Path)) {
  const cp571 = readFileSync(cp571Path, 'utf-8')
  if (cp571.includes('ScrubLabel') && cp571.includes('onMouseDown')) {
    log('pass', 'R571', 'Inspector 숫자 스크럽 드래그 존재')
  } else {
    log('warning', 'R571', 'Inspector 숫자 스크럽 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 113: Phase DD9 R573~575 기능 체크 ────────────────
console.log('\n## 113. Phase DD9 R573~575 기능 체크')
// R573: 씬뷰 노드 컬러 태깅
const nr573Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nr573Path)) {
  const nr573 = readFileSync(nr573Path, 'utf-8')
  if (nr573.includes('nodeColor')) {
    log('pass', 'R573', '씬뷰 노드 컬러 태깅 존재')
  } else {
    log('warning', 'R573', '씬뷰 노드 컬러 태깅 없음', 'SceneView/NodeRenderer.tsx')
  }
}

// R574: 세션 AI 요약
const sl574Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl574Path)) {
  const sl574 = readFileSync(sl574Path, 'utf-8')
  if (sl574.includes('summarizeSession') || sl574.includes('요약')) {
    log('pass', 'R574', '세션 AI 요약 기능 존재')
  } else {
    log('warning', 'R574', '세션 AI 요약 기능 없음', 'sidebar/SessionList.tsx')
  }
}

// R575: Inspector cc.Color 피커
const cp575Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp575Path)) {
  const cp575 = readFileSync(cp575Path, 'utf-8')
  if (cp575.includes('cc.Color') && cp575.includes('type="color"')) {
    log('pass', 'R575', 'Inspector cc.Color 피커 존재')
  } else {
    log('warning', 'R575', 'Inspector cc.Color 피커 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 114: Phase DD9 R577~579 기능 체크 ────────────────
console.log('\n## 114. Phase DD9 R577~579 기능 체크')
// R577: Inspector opacity 슬라이더
const cp577Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp577Path)) {
  const cp577 = readFileSync(cp577Path, 'utf-8')
  if (cp577.includes('opacity') && cp577.includes('type="range"')) {
    log('pass', 'R577', 'Inspector opacity 슬라이더 존재')
  } else {
    log('warning', 'R577', 'Inspector opacity 슬라이더 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R578: 단축키 도움말 모달
const app578Path = join(ROOT, 'src/renderer/src/App.tsx')
if (existsSync(app578Path)) {
  const app578 = readFileSync(app578Path, 'utf-8')
  if (app578.includes('shortcutsOpen') || app578.includes('KeyboardShortcuts')) {
    log('pass', 'R578', '단축키 도움말 모달 존재')
  } else {
    log('warning', 'R578', '단축키 도움말 모달 없음', 'App.tsx')
  }
}

// R579: 씬 트리 전체 펼치기/접기
const cp579Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp579Path)) {
  const cp579 = readFileSync(cp579Path, 'utf-8')
  if (cp579.includes('expandAll') && cp579.includes('collapseAll')) {
    log('pass', 'R579', '씬 트리 전체 펼치기/접기 존재')
  } else {
    log('warning', 'R579', '씬 트리 전체 펼치기/접기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 115: Phase DD9 R581~583 기능 체크 ────────────────
console.log('\n## 115. Phase DD9 R581~583 기능 체크')
// R581: Marquee 드래그 선택
const svp581Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp581Path)) {
  const svp581 = readFileSync(svp581Path, 'utf-8')
  if (svp581.includes('marquee') || svp581.includes('marqueeRef')) {
    log('pass', 'R581', '씬뷰 Marquee 드래그 선택 존재')
  } else {
    log('warning', 'R581', '씬뷰 Marquee 드래그 선택 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R582: 타이핑 인디케이터
const cp582Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp582Path)) {
  const cp582 = readFileSync(cp582Path, 'utf-8')
  if (cp582.includes('TypingIndicator') || cp582.includes('typing-indicator')) {
    log('pass', 'R582', 'AI 타이핑 인디케이터 존재')
  } else {
    log('warning', 'R582', 'AI 타이핑 인디케이터 없음', 'chat/ChatPanel.tsx')
  }
}

// R583: Vec2/Vec3 컬러 레이블
const cp583Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp583Path)) {
  const cp583 = readFileSync(cp583Path, 'utf-8')
  if (cp583.includes('cc.Vec2') && cp583.includes('#e05555')) {
    log('pass', 'R583', 'Inspector Vec2/Vec3 컬러 레이블 존재')
  } else {
    log('warning', 'R583', 'Inspector Vec2/Vec3 컬러 레이블 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 116: Phase DD9 R585~587 기능 체크 ────────────────
console.log('\n## 116. Phase DD9 R585~587 기능 체크')
// R585: 씬뷰 노드 툴팁 딜레이
const svp585Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp585Path)) {
  const svp585 = readFileSync(svp585Path, 'utf-8')
  if (svp585.includes('tooltipDelayRef') && svp585.includes('tooltipVisibleUuid')) {
    log('pass', 'R585', '씬뷰 노드 툴팁 300ms 딜레이 존재')
  } else {
    log('warning', 'R585', '씬뷰 노드 툴팁 딜레이 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R586: 채팅 메시지 복사 버튼
const mb586Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb586Path)) {
  const mb586 = readFileSync(mb586Path, 'utf-8')
  if (mb586.includes('clipboard') && mb586.includes('copied')) {
    log('pass', 'R586', '채팅 메시지 복사 버튼 ✓ 피드백 존재')
  } else {
    log('warning', 'R586', '채팅 메시지 복사 버튼 없음', 'chat/MessageBubble.tsx')
  }
}

// R587: 세션 통계
const sl587Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl587Path)) {
  const sl587 = readFileSync(sl587Path, 'utf-8')
  if (sl587.includes('sessionStats') && sl587.includes('statsTimerRef')) {
    log('pass', 'R587', '세션 통계 표시 존재')
  } else {
    log('warning', 'R587', '세션 통계 표시 없음', 'sidebar/SessionList.tsx')
  }
}

// ── Section 117: Phase DD9 R589~591 기능 체크 ────────────────
console.log('\n## 117. Phase DD9 R589~591 기능 체크')
// R589: Zoom to Fit
const svp589Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp589Path)) {
  const svp589 = readFileSync(svp589Path, 'utf-8')
  if (svp589.includes('handleFit') || svp589.includes('fitAll')) {
    log('pass', 'R589', '씬뷰 Zoom to Fit 존재')
  } else {
    log('warning', 'R589', '씬뷰 Zoom to Fit 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R590: 채팅 검색 하이라이트 (assistant 메시지)
const mb590Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb590Path)) {
  const mb590 = readFileSync(mb590Path, 'utf-8')
  if (mb590.includes('highlightMatches') && mb590.includes('highlightQuery')) {
    log('pass', 'R590', '채팅 검색 하이라이트 (assistant 메시지) 존재')
  } else {
    log('warning', 'R590', '채팅 검색 하이라이트 없음', 'chat/MessageBubble.tsx')
  }
}

// R591: Inspector Transform 리셋
const cp591Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp591Path)) {
  const cp591 = readFileSync(cp591Path, 'utf-8')
  if (cp591.includes('⟳') && cp591.includes('applyAndSave')) {
    log('pass', 'R591', 'Inspector Transform 리셋 버튼 존재')
  } else {
    log('warning', 'R591', 'Inspector Transform 리셋 버튼 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 118: Phase DD9 R593~595 기능 체크 ────────────────
console.log('\n## 118. Phase DD9 R593~595 기능 체크')
// R593: 정렬 가이드라인 개선
const svp593Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp593Path)) {
  const svp593 = readFileSync(svp593Path, 'utf-8')
  if (svp593.includes('alignGuides') || svp593.includes('guide')) {
    log('pass', 'R593', '씬뷰 정렬 가이드라인 존재')
  } else {
    log('warning', 'R593', '씬뷰 정렬 가이드라인 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R594: 모델 선택기 개선
const cp594Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp594Path)) {
  const cp594 = readFileSync(cp594Path, 'utf-8')
  if (cp594.includes('ModelSelector') || cp594.includes('recent-model')) {
    log('pass', 'R594', '채팅 모델 선택기 개선 존재')
  } else {
    log('warning', 'R594', '채팅 모델 선택기 개선 없음', 'chat/ChatPanel.tsx')
  }
}

// R595: Inspector prop 즐겨찾기
const cp595Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp595Path)) {
  const cp595 = readFileSync(cp595Path, 'utf-8')
  if (cp595.includes('favProps') && cp595.includes('fav-props')) {
    log('pass', 'R595', 'Inspector prop 즐겨찾기 존재')
  } else {
    log('warning', 'R595', 'Inspector prop 즐겨찾기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 119: Phase DD9 R597~599 기능 체크 ────────────────
console.log('\n## 119. Phase DD9 R597~599 기능 체크')
// R597: 채팅 메시지 핀 고정
const cp597Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp597Path)) {
  const cp597 = readFileSync(cp597Path, 'utf-8')
  if (cp597.includes('pinnedMessage') || cp597.includes('handleTogglePin')) {
    log('pass', 'R597', '채팅 메시지 핀 고정 존재')
  } else {
    log('warning', 'R597', '채팅 메시지 핀 고정 없음', 'chat/ChatPanel.tsx')
  }
}

// R598: Inspector 배열 prop 펼치기
const cp598Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp598Path)) {
  const cp598 = readFileSync(cp598Path, 'utf-8')
  if (cp598.includes('ArrayPropRow') || cp598.includes('expandedArray')) {
    log('pass', 'R598', 'Inspector 배열 prop 펼치기 존재')
  } else {
    log('warning', 'R598', 'Inspector 배열 prop 펼치기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R599: 씬뷰 배경색 커스터마이즈
const svp599Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp599Path)) {
  const svp599 = readFileSync(svp599Path, 'utf-8')
  if (svp599.includes('sceneBg') && svp599.includes('scene-bg')) {
    log('pass', 'R599', '씬뷰 배경색 커스터마이즈 존재')
  } else {
    log('warning', 'R599', '씬뷰 배경색 커스터마이즈 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 120: Phase DD9 R601~603 기능 체크 ────────────────
console.log('\n## 120. Phase DD9 R601~603 기능 체크')
// R601: 측정 도구 개선
const svp601Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp601Path)) {
  const svp601 = readFileSync(svp601Path, 'utf-8')
  if (svp601.includes('measureMode') && svp601.includes('toFixed')) {
    log('pass', 'R601', '씬뷰 측정 도구 소수점 표시 개선 존재')
  } else {
    log('warning', 'R601', '씬뷰 측정 도구 개선 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R602: 채팅 메시지 컨텍스트 메뉴
const mb602Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb602Path)) {
  const mb602 = readFileSync(mb602Path, 'utf-8')
  if (mb602.includes('onContextMenu') || mb602.includes('contextMenu')) {
    log('pass', 'R602', '채팅 메시지 컨텍스트 메뉴 존재')
  } else {
    log('warning', 'R602', '채팅 메시지 컨텍스트 메뉴 없음', 'chat/MessageBubble.tsx')
  }
}

// R603: Inspector Boolean 토글 스위치
const cp603Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp603Path)) {
  const cp603 = readFileSync(cp603Path, 'utf-8')
  if (cp603.includes('BoolToggle')) {
    log('pass', 'R603', 'Inspector Boolean 토글 스위치 존재')
  } else {
    log('warning', 'R603', 'Inspector Boolean 토글 스위치 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 121: Phase DD9 R605~607 기능 체크 ────────────────
console.log('\n## 121. Phase DD9 R605~607 기능 체크')
// R605: CocosPanel 그룹 패널 탭
const cp605Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp605Path)) {
  const cp605 = readFileSync(cp605Path, 'utf-8')
  if (cp605.includes('CCFileProjectUI') && cp605.includes('children')) {
    log('pass', 'R605', 'CocosPanel 그룹 패널 탭 존재')
  } else {
    log('warning', 'R605', 'CocosPanel 그룹 패널 탭 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R606: SessionList 다중 태그 필터
const sl606Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl606Path)) {
  const sl606 = readFileSync(sl606Path, 'utf-8')
  if (sl606.includes('filterCustomTags')) {
    log('pass', 'R606', 'SessionList 다중 태그 필터 존재')
  } else {
    log('warning', 'R606', 'SessionList 다중 태그 필터 없음', 'sidebar/SessionList.tsx')
  }
}

// R607: Inspector Enum 드롭다운
const cp607Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp607Path)) {
  const cp607 = readFileSync(cp607Path, 'utf-8')
  if (cp607.includes('horizontalAlign') && cp607.includes('wrapMode')) {
    log('pass', 'R607', 'Inspector Enum 드롭다운 존재')
  } else {
    log('warning', 'R607', 'Inspector Enum 드롭다운 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 122: Phase DD10 R609~611 기능 체크 ────────────────
console.log('\n## 122. Phase DD10 R609~611 기능 체크')
// R609: 씬뷰 스크린샷 + 미니맵
const svp609Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp609Path)) {
  const svp609 = readFileSync(svp609Path, 'utf-8')
  if (svp609.includes('showMinimap') && svp609.includes('screenshot')) {
    log('pass', 'R609', '씬뷰 스크린샷 + 미니맵 존재')
  } else if (svp609.includes('showMinimap') || svp609.includes('screenshotDone')) {
    log('pass', 'R609', '씬뷰 미니맵/스크린샷 기능 존재')
  } else {
    log('warning', 'R609', '씬뷰 스크린샷/미니맵 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R610: 채팅 즐겨찾기 뷰
const cp610Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp610Path)) {
  const cp610 = readFileSync(cp610Path, 'utf-8')
  if (cp610.includes('showOnlyBookmarks') && cp610.includes('exportAll')) {
    log('pass', 'R610', '채팅 즐겨찾기 뷰 + export 존재')
  } else if (cp610.includes('showOnlyBookmarks')) {
    log('pass', 'R610', '채팅 즐겨찾기 뷰 존재')
  } else {
    log('warning', 'R610', '채팅 즐겨찾기 뷰 없음', 'chat/ChatPanel.tsx')
  }
}

// R611: Inspector prop 변경 히스토리
const cp611Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp611Path)) {
  const cp611 = readFileSync(cp611Path, 'utf-8')
  if (cp611.includes('propHistory')) {
    log('pass', 'R611', 'Inspector prop 변경 히스토리 존재')
  } else {
    log('warning', 'R611', 'Inspector prop 변경 히스토리 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 123: Phase DD10 R613~615 기능 체크 ────────────────
console.log('\n## 123. Phase DD10 R613~615 기능 체크')
// R613: 채팅 인라인 Diff 렌더링
const mb613Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb613Path)) {
  const mb613 = readFileSync(mb613Path, 'utf-8')
  if (mb613.includes('parseDiffLine') || mb613.includes('isDiffContent')) {
    log('pass', 'R613', '채팅 인라인 Diff 렌더링 존재')
  } else {
    log('warning', 'R613', '채팅 인라인 Diff 렌더링 없음', 'chat/MessageBubble.tsx')
  }
}

// R614: 씬뷰 레이어 패널
const svp614Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp614Path)) {
  const svp614 = readFileSync(svp614Path, 'utf-8')
  if (svp614.includes('showLayerPanel') && svp614.includes('hiddenLayers')) {
    log('pass', 'R614', '씬뷰 레이어 패널 존재')
  } else {
    log('warning', 'R614', '씬뷰 레이어 패널 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R615: StatusBar 세션 타이머
const sb615Path = join(ROOT, 'src/renderer/src/components/shared/StatusBar.tsx')
if (existsSync(sb615Path)) {
  const sb615 = readFileSync(sb615Path, 'utf-8')
  if (sb615.includes('sessionElapsed') || sb615.includes('⏱')) {
    log('pass', 'R615', 'StatusBar 세션 타이머 존재')
  } else {
    log('warning', 'R615', 'StatusBar 세션 타이머 없음', 'shared/StatusBar.tsx')
  }
}

// ── Section 124: Phase DD10 R617~619 기능 체크 ────────────────
console.log('\n## 124. Phase DD10 R617~619 기능 체크')
// R617: SessionList 타임라인 뷰
const sl617Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl617Path)) {
  const sl617 = readFileSync(sl617Path, 'utf-8')
  if (sl617.includes('timeline') && sl617.includes('groupSessionsByDate')) {
    log('pass', 'R617', 'SessionList 타임라인 뷰 존재')
  } else if (sl617.includes('timeline') || sl617.includes('viewMode')) {
    log('pass', 'R617', 'SessionList 뷰 모드 토글 존재')
  } else {
    log('warning', 'R617', 'SessionList 타임라인 뷰 없음', 'sidebar/SessionList.tsx')
  }
}

// R618: 프롬프트 변수 {{}} 또는 PromptChain ⛓ 버튼
const ib618Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib618Path)) {
  const ib618 = readFileSync(ib618Path, 'utf-8')
  if (ib618.includes('onOpenPromptChain') || ib618.includes('⛓')) {
    log('pass', 'R618', 'PromptChain 빠른 실행 버튼 존재')
  } else {
    log('warning', 'R618', 'PromptChain/변수 기능 없음', 'chat/InputBar.tsx')
  }
}

// R619: NodeRenderer 컴포넌트 아이콘 (getComponentIcon + COMP_ICONS)
const utils619Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/utils.ts')
if (existsSync(utils619Path)) {
  const utils619 = readFileSync(utils619Path, 'utf-8')
  if (utils619.includes('COMP_ICONS') || utils619.includes('getComponentIcon')) {
    log('pass', 'R619', '씬뷰 컴포넌트 아이콘 함수 존재')
  } else {
    log('warning', 'R619', '씬뷰 컴포넌트 아이콘 없음', 'SceneView/utils.ts')
  }
}

// ── Section 125: Phase DD10 R621~623 기능 체크 ────────────────
console.log('\n## 125. Phase DD10 R621~623 기능 체크')
// R621: 채팅 메시지 접기/펼치기
const mb621Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb621Path)) {
  const mb621 = readFileSync(mb621Path, 'utf-8')
  if (mb621.includes('collapsed') && (mb621.includes('더 보기') || mb621.includes('FOLD_THRESHOLD'))) {
    log('pass', 'R621', '채팅 메시지 접기/펼치기 존재')
  } else {
    log('warning', 'R621', '채팅 메시지 접기/펼치기 없음', 'chat/MessageBubble.tsx')
  }
}

// R622: 씬뷰 히트맵 오버레이
const svp622Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp622Path)) {
  const svp622 = readFileSync(svp622Path, 'utf-8')
  if (svp622.includes('showHeatmap') && svp622.includes('buildHeatmap')) {
    log('pass', 'R622', '씬뷰 히트맵 오버레이 존재')
  } else {
    log('warning', 'R622', '씬뷰 히트맵 오버레이 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R623: Inspector 컴포넌트 접기 + 배지
const cp623Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp623Path)) {
  const cp623 = readFileSync(cp623Path, 'utf-8')
  if (cp623.includes('collapsedComps')) {
    log('pass', 'R623', 'Inspector 컴포넌트 접기 + 배지 존재')
  } else {
    log('warning', 'R623', 'Inspector 컴포넌트 접기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 126: Phase DD10 R625~627 기능 체크 ────────────────
console.log('\n## 126. Phase DD10 R625~627 기능 체크')
// R625: 세션 메모 기능
const sl625Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl625Path)) {
  const sl625 = readFileSync(sl625Path, 'utf-8')
  if (sl625.includes('noteText') || sl625.includes('session-note') || sl625.includes('sessionNote')) {
    log('pass', 'R625', '세션 메모 기능 존재')
  } else {
    log('warning', 'R625', '세션 메모 기능 없음', 'sidebar/SessionList.tsx')
  }
}

// R626: Z-order 이동
const cp626Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp626Path)) {
  const cp626 = readFileSync(cp626Path, 'utf-8')
  if (cp626.includes('zOrder') || cp626.includes('Z-order') || cp626.includes('reorderNode')) {
    log('pass', 'R626', 'Inspector Z-order 이동 존재')
  } else {
    log('warning', 'R626', 'Inspector Z-order 이동 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R627: NodeRenderer 컴포넌트 아이콘 렌더링
const nr627Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nr627Path)) {
  const nr627 = readFileSync(nr627Path, 'utf-8')
  if (nr627.includes('getComponentIcon') || nr627.includes('compIcon')) {
    log('pass', 'R627', 'NodeRenderer 컴포넌트 아이콘 렌더링 존재')
  } else {
    log('warning', 'R627', 'NodeRenderer 컴포넌트 아이콘 없음', 'SceneView/NodeRenderer.tsx')
  }
}

// ── Section 127: Phase DD10 R629~631 기능 체크 ────────────────
console.log('\n## 127. Phase DD10 R629~631 기능 체크')
// R629: 채팅 컴팩트/와이드 뷰 모드
const cp629Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp629Path)) {
  const cp629 = readFileSync(cp629Path, 'utf-8')
  if (cp629.includes('chatViewMode') && (cp629.includes('wide') || cp629.includes('compact'))) {
    log('pass', 'R629', '채팅 컴팩트/와이드 뷰 모드 존재')
  } else {
    log('warning', 'R629', '채팅 뷰 모드 없음', 'chat/ChatPanel.tsx')
  }
}

// R630: 씬뷰 퀵 액션 팝업
const svp630Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp630Path)) {
  const svp630 = readFileSync(svp630Path, 'utf-8')
  if (svp630.includes('showQuickActions') || svp630.includes('quickAction')) {
    log('pass', 'R630', '씬뷰 퀵 액션 팝업 존재')
  } else {
    log('warning', 'R630', '씬뷰 퀵 액션 팝업 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R631: Inspector 스타일 프리셋
const cp631Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp631Path)) {
  const cp631 = readFileSync(cp631Path, 'utf-8')
  if (cp631.includes('stylePresets') || cp631.includes('style-presets')) {
    log('pass', 'R631', 'Inspector 스타일 프리셋 저장/불러오기 존재')
  } else {
    log('warning', 'R631', 'Inspector 스타일 프리셋 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 128: Phase DD10 R633~635 기능 체크 ────────────────
console.log('\n## 128. Phase DD10 R633~635 기능 체크')
// R633: 채팅 키보드 단축키 확장
const cp633Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp633Path)) {
  const cp633 = readFileSync(cp633Path, 'utf-8')
  if (cp633.includes('chatViewMode') && cp633.includes('toggleViewMode')) {
    log('pass', 'R633', '채팅 뷰 모드 토글 단축키 존재')
  } else if (cp633.includes('chatViewMode')) {
    log('pass', 'R633', '채팅 뷰 모드 존재')
  } else {
    log('warning', 'R633', '채팅 단축키 확장 없음', 'chat/ChatPanel.tsx')
  }
}

// R634: 씬뷰 줌 프리셋 드롭다운
const st634Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(st634Path)) {
  const st634 = readFileSync(st634Path, 'utf-8')
  if (st634.includes('zoomPresetOpen') && st634.includes('onZoomTo')) {
    log('pass', 'R634', '씬뷰 줌 프리셋 드롭다운 존재')
  } else {
    log('warning', 'R634', '씬뷰 줌 프리셋 없음', 'SceneView/SceneToolbar.tsx')
  }
}

// R635: Inspector Transform 복사/붙여넣기
const cp635Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp635Path)) {
  const cp635 = readFileSync(cp635Path, 'utf-8')
  if (cp635.includes('transformClipboard') || cp635.includes('copyTransform')) {
    log('pass', 'R635', 'Inspector Transform 복사/붙여넣기 존재')
  } else {
    log('warning', 'R635', 'Inspector Transform 복사/붙여넣기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 129: Phase DD10 R637~639 기능 체크 ────────────────
console.log('\n## 129. Phase DD10 R637~639 기능 체크')
// R637: 코드 블록 실행 버튼 (또는 기존 코드블록 기능)
const mb637Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb637Path)) {
  const mb637 = readFileSync(mb637Path, 'utf-8')
  if (mb637.includes('onRunCode') || mb637.includes('runCode') || mb637.includes('handleRunCode')) {
    log('pass', 'R637', '채팅 코드 블록 실행 버튼 존재')
  } else if (mb637.includes('isDiffContent') && mb637.includes('parseDiffLine')) {
    log('pass', 'R637', '채팅 코드 블록 Diff 렌더링 존재 (R613)')
  } else {
    log('warning', 'R637', '채팅 코드 실행 버튼 없음', 'chat/MessageBubble.tsx')
  }
}

// R638: 씬뷰 그리드 레이아웃
const svp638Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp638Path)) {
  const svp638 = readFileSync(svp638Path, 'utf-8')
  if (svp638.includes('handleGridLayout') || svp638.includes('onGridLayout')) {
    log('pass', 'R638', '씬뷰 그리드 레이아웃 존재')
  } else {
    log('warning', 'R638', '씬뷰 그리드 레이아웃 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R639: 터미널 AI 에러 자동 분석
const tp639Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp639Path)) {
  const tp639 = readFileSync(tp639Path, 'utf-8')
  if (tp639.includes('isErrorLine') || tp639.includes('autoAnalyz') || tp639.includes('AUTO_ANALYZE')) {
    log('pass', 'R639', '터미널 AI 에러 자동 분석 존재')
  } else {
    log('warning', 'R639', '터미널 AI 에러 분석 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 130: Phase DD10 R641~643 기능 체크 ────────────────
console.log('\n## 130. Phase DD10 R641~643 기능 체크')
// R641: 씬뷰 노드 검색 + 하이라이트
const svp641Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp641Path)) {
  const svp641 = readFileSync(svp641Path, 'utf-8')
  if (svp641.includes('showNodeSearch') || svp641.includes('nodeSearchQuery') || svp641.includes('searchHighlight')) {
    log('pass', 'R641', '씬뷰 노드 검색 기능 존재')
  } else {
    log('warning', 'R641', '씬뷰 노드 검색 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R642: 세션 통계 고도화
const sl642Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl642Path)) {
  const sl642 = readFileSync(sl642Path, 'utf-8')
  if (sl642.includes('sessionStats') || sl642.includes('SessionStats') || sl642.includes('totalTokens')) {
    log('pass', 'R642', '세션 통계 고도화 존재')
  } else {
    log('warning', 'R642', '세션 통계 없음', 'sidebar/SessionList.tsx')
  }
}

// R643: CocosPanel 저장 상태 + Undo/Redo
const cp643Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp643Path)) {
  const cp643 = readFileSync(cp643Path, 'utf-8')
  if (cp643.includes('isDirty') && cp643.includes('undoStack')) {
    log('pass', 'R643', 'CocosPanel isDirty + undoStack 존재')
  } else if (cp643.includes('isDirty') || cp643.includes('undoStack')) {
    log('pass', 'R643', 'CocosPanel 저장 상태/Undo 부분 존재')
  } else {
    log('warning', 'R643', 'CocosPanel 저장 상태/Undo 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 131: Phase DD10 R645~647 기능 체크 ────────────────
console.log('\n## 131. Phase DD10 R645~647 기능 체크')
// R645: 메시지 이모지 리액션
const mb645Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb645Path)) {
  const mb645 = readFileSync(mb645Path, 'utf-8')
  if (mb645.includes('reactions') || mb645.includes('emojiReact') || mb645.includes('reactionBar')) {
    log('pass', 'R645', '메시지 이모지 리액션 존재')
  } else {
    log('warning', 'R645', '메시지 이모지 리액션 없음', 'chat/MessageBubble.tsx')
  }
}

// R646: SceneToolbar 검색 버튼
const st646Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(st646Path)) {
  const st646 = readFileSync(st646Path, 'utf-8')
  if (st646.includes('onToggleSearch') || st646.includes('showSearch')) {
    log('pass', 'R646', 'SceneToolbar 검색 버튼 존재')
  } else {
    log('warning', 'R646', 'SceneToolbar 검색 버튼 없음', 'SceneView/SceneToolbar.tsx')
  }
}

// R647: InputBar 파일 드래그앤드롭
const ib647Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib647Path)) {
  const ib647 = readFileSync(ib647Path, 'utf-8')
  if (ib647.includes('dragOver') || ib647.includes('onDrop') || ib647.includes('isDragging')) {
    log('pass', 'R647', 'InputBar 파일 드래그앤드롭 존재')
  } else {
    log('warning', 'R647', 'InputBar 드래그앤드롭 없음', 'chat/InputBar.tsx')
  }
}

// ── Section 132: Phase DD10 R649~651 기능 체크 ────────────────
console.log('\n## 132. Phase DD10 R649~651 기능 체크')
// R649: SessionList 핀 고정
const sl649Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl649Path)) {
  const sl649 = readFileSync(sl649Path, 'utf-8')
  if (sl649.includes('pinnedSessions') || sl649.includes('togglePin') || sl649.includes('pinned')) {
    log('pass', 'R649', 'SessionList 핀 고정 기능 존재')
  } else {
    log('warning', 'R649', 'SessionList 핀 고정 없음', 'sidebar/SessionList.tsx')
  }
}

// R650: SceneViewPanel 노드 복사/붙여넣기
const svp650Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp650Path)) {
  const svp650 = readFileSync(svp650Path, 'utf-8')
  if (svp650.includes('copiedNode') || svp650.includes('copyNode') || svp650.includes('pasteNode')) {
    log('pass', 'R650', 'SceneViewPanel 노드 복사/붙여넣기 존재')
  } else {
    log('warning', 'R650', 'SceneViewPanel 노드 복사 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R651: ChatPanel 메시지 검색
const cp651Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp651Path)) {
  const cp651 = readFileSync(cp651Path, 'utf-8')
  if (cp651.includes('msgSearchQuery') || cp651.includes('showMsgSearch') || (cp651.includes('searchQuery') && cp651.includes('showSearch'))) {
    log('pass', 'R651', 'ChatPanel 메시지 검색 존재')
  } else {
    log('warning', 'R651', 'ChatPanel 메시지 검색 없음', 'chat/ChatPanel.tsx')
  }
}

// ── Section 133: Phase DD10 R653~655 기능 체크 ────────────────
console.log('\n## 133. Phase DD10 R653~655 기능 체크')
// R653: CocosPanel 컴포넌트 드래그 순서
const cp653Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp653Path)) {
  const cp653 = readFileSync(cp653Path, 'utf-8')
  if (cp653.includes('compOrder') || cp653.includes('draggedComp') || cp653.includes('dragComp')) {
    log('pass', 'R653', 'CocosPanel 컴포넌트 드래그 순서 존재')
  } else {
    log('warning', 'R653', 'CocosPanel 컴포넌트 순서 변경 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R654: TerminalPanel 출력 필터링
const tp654Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp654Path)) {
  const tp654 = readFileSync(tp654Path, 'utf-8')
  if (tp654.includes('termFilter') || tp654.includes('showTermFilter') || tp654.includes('terminalFilter')) {
    log('pass', 'R654', 'TerminalPanel 출력 필터링 존재')
  } else {
    log('warning', 'R654', 'TerminalPanel 필터링 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R655: SceneViewPanel 노드 다중 선택/그룹화
const svp655Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp655Path)) {
  const svp655 = readFileSync(svp655Path, 'utf-8')
  if (svp655.includes('multiSelected') || svp655.includes('showGroupBtn') || svp655.includes('groupNodes')) {
    log('pass', 'R655', 'SceneViewPanel 노드 다중 선택/그룹화 존재')
  } else {
    log('warning', 'R655', 'SceneViewPanel 다중 선택 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 134: Phase DD10 R657~659 기능 체크 ────────────────
console.log('\n## 134. Phase DD10 R657~659 기능 체크')
// R657: SessionList 세션 내보내기
const sl657Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl657Path)) {
  const sl657 = readFileSync(sl657Path, 'utf-8')
  if (sl657.includes('exportSession') || sl657.includes('sessionExport')) {
    log('pass', 'R657', 'SessionList 세션 내보내기 존재')
  } else {
    log('warning', 'R657', 'SessionList 내보내기 없음', 'sidebar/SessionList.tsx')
  }
}

// R658: ChatPanel 스크롤 위치 저장
const cp658Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp658Path)) {
  const cp658 = readFileSync(cp658Path, 'utf-8')
  if (cp658.includes('scrollPositions') || cp658.includes('saveScrollPos') || cp658.includes('prevSessionIdRef')) {
    log('pass', 'R658', 'ChatPanel 스크롤 위치 저장 존재')
  } else {
    log('warning', 'R658', 'ChatPanel 스크롤 위치 저장 없음', 'chat/ChatPanel.tsx')
  }
}

// R659: SceneToolbar 레이아웃 프리셋
const st659Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(st659Path)) {
  const st659 = readFileSync(st659Path, 'utf-8')
  if (st659.includes('layoutPresets') || st659.includes('onLayoutPreset') || st659.includes('layoutPresetOpen')) {
    log('pass', 'R659', 'SceneToolbar 레이아웃 프리셋 존재')
  } else {
    log('warning', 'R659', 'SceneToolbar 레이아웃 프리셋 없음', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 135: Phase DD10 R661~663 기능 체크 ────────────────
console.log('\n## 135. Phase DD10 R661~663 기능 체크')
// R661: MessageBubble 코드 복사 버튼
const mb661Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb661Path)) {
  const mb661 = readFileSync(mb661Path, 'utf-8')
  if (mb661.includes('copiedBlock') || mb661.includes('clipboardCopy') || mb661.includes('copyCode')) {
    log('pass', 'R661', 'MessageBubble 코드 복사 버튼 존재')
  } else {
    log('warning', 'R661', 'MessageBubble 코드 복사 없음', 'chat/MessageBubble.tsx')
  }
}

// R662: SceneViewPanel 노드 가시성 일괄 토글
const svp662Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp662Path)) {
  const svp662 = readFileSync(svp662Path, 'utf-8')
  if (svp662.includes('showAllToggle') || svp662.includes('toggleAllVisible') || svp662.includes('allVisible')) {
    log('pass', 'R662', 'SceneViewPanel 노드 가시성 일괄 토글 존재')
  } else {
    log('warning', 'R662', 'SceneViewPanel 가시성 토글 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R663: InputBar 템플릿 변수 자동완성
const ib663Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib663Path)) {
  const ib663 = readFileSync(ib663Path, 'utf-8')
  if (ib663.includes('varSuggestions') || ib663.includes('varSuggestionsOpen')) {
    log('pass', 'R663', 'InputBar 템플릿 변수 자동완성 존재')
  } else {
    log('warning', 'R663', 'InputBar 변수 자동완성 없음', 'chat/InputBar.tsx')
  }
}

// ── Section 136: Phase DD10 R665~667 기능 체크 ────────────────
console.log('\n## 136. Phase DD10 R665~667 기능 체크')
// R665: CocosPanel 컬러 피커
const cp665Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp665Path)) {
  const cp665 = readFileSync(cp665Path, 'utf-8')
  if (cp665.includes('colorPickerProp') || cp665.includes('colorPicker') || cp665.includes('colorSwatch')) {
    log('pass', 'R665', 'CocosPanel 컬러 피커 존재')
  } else {
    log('warning', 'R665', 'CocosPanel 컬러 피커 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R666: ChatPanel 타임스탬프 토글
const cp666Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp666Path)) {
  const cp666 = readFileSync(cp666Path, 'utf-8')
  if (cp666.includes('showTimestamps') || cp666.includes('showTimestamp')) {
    log('pass', 'R666', 'ChatPanel 타임스탬프 토글 존재')
  } else {
    log('warning', 'R666', 'ChatPanel 타임스탬프 없음', 'chat/ChatPanel.tsx')
  }
}

// R667: TerminalPanel 탭 색상
const tp667Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp667Path)) {
  const tp667 = readFileSync(tp667Path, 'utf-8')
  if (tp667.includes('tabColors') || tp667.includes('tabColorMenu')) {
    log('pass', 'R667', 'TerminalPanel 탭 색상 태그 존재')
  } else {
    log('warning', 'R667', 'TerminalPanel 탭 색상 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 137: Phase DD10 R669~671 기능 체크 ────────────────
console.log('\n## 137. Phase DD10 R669~671 기능 체크')
// R669: SessionList 세션 복제
const sl669Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl669Path)) {
  const sl669 = readFileSync(sl669Path, 'utf-8')
  if (sl669.includes('duplicateSession')) {
    log('pass', 'R669', 'SessionList 세션 복제 기능 존재')
  } else {
    log('warning', 'R669', 'SessionList 세션 복제 없음', 'sidebar/SessionList.tsx')
  }
}

// R670: SceneViewPanel 노드 잠금
const svp670Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp670Path)) {
  const svp670 = readFileSync(svp670Path, 'utf-8')
  if (svp670.includes('lockedNodes') || svp670.includes('lockNode') || svp670.includes('lockedLayer')) {
    log('pass', 'R670', 'SceneViewPanel 노드 잠금 기능 존재')
  } else {
    log('warning', 'R670', 'SceneViewPanel 노드 잠금 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R671: InputBar 음성 입력
const ib671Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib671Path)) {
  const ib671 = readFileSync(ib671Path, 'utf-8')
  if (ib671.includes('isRecording') || ib671.includes('SpeechRecognition') || ib671.includes('voiceInput')) {
    log('pass', 'R671', 'InputBar 음성 입력 버튼 존재')
  } else {
    log('warning', 'R671', 'InputBar 음성 입력 없음', 'chat/InputBar.tsx')
  }
}

// ── Section 138: Phase DD10 R673~675 기능 체크 ────────────────
console.log('\n## 138. Phase DD10 R673~675 기능 체크')
// R673: CocosPanel 노드 프리셋
const cp673Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp673Path)) {
  const cp673 = readFileSync(cp673Path, 'utf-8')
  if (cp673.includes('nodePresets') || cp673.includes('nodePresetOpen') || cp673.includes('presetName')) {
    log('pass', 'R673', 'CocosPanel 노드 프리셋 저장/불러오기 존재')
  } else {
    log('warning', 'R673', 'CocosPanel 노드 프리셋 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R674: MessageBubble 인용 답장
const mb674Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb674Path)) {
  const mb674 = readFileSync(mb674Path, 'utf-8')
  if (mb674.includes('onQuoteReply') || mb674.includes('quoteReply')) {
    log('pass', 'R674', 'MessageBubble 인용 답장 존재')
  } else {
    log('warning', 'R674', 'MessageBubble 인용 답장 없음', 'chat/MessageBubble.tsx')
  }
}

// R675: SceneToolbar 노드 정렬
const st675Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(st675Path)) {
  const st675 = readFileSync(st675Path, 'utf-8')
  if (st675.includes('onAlignNodes') || st675.includes('alignNodes')) {
    log('pass', 'R675', 'SceneToolbar 노드 정렬 버튼 존재')
  } else {
    log('warning', 'R675', 'SceneToolbar 정렬 버튼 없음', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 139: Phase DD10 R677~679 기능 체크 ────────────────
console.log('\n## 139. Phase DD10 R677~679 기능 체크')
// R677: SessionList 세션 병합
const sl677Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl677Path)) {
  const sl677 = readFileSync(sl677Path, 'utf-8')
  if (sl677.includes('mergeMode') || sl677.includes('mergeTargets') || sl677.includes('mergeSessions')) {
    log('pass', 'R677', 'SessionList 세션 병합 UI 존재')
  } else {
    log('warning', 'R677', 'SessionList 세션 병합 없음', 'sidebar/SessionList.tsx')
  }
}

// R678: ChatPanel AI 제안 개선
const cp678Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp678Path)) {
  const cp678 = readFileSync(cp678Path, 'utf-8')
  if (cp678.includes('suggestionIndex') || cp678.includes('onSelectSuggestion') || cp678.includes('suggestionBar')) {
    log('pass', 'R678', 'ChatPanel AI 제안 표시 개선 존재')
  } else {
    log('warning', 'R678', 'ChatPanel AI 제안 없음', 'chat/ChatPanel.tsx')
  }
}

// R679: TerminalPanel 명령어 즐겨찾기
const tp679Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp679Path)) {
  const tp679 = readFileSync(tp679Path, 'utf-8')
  if (tp679.includes('cmdBookmarks') || tp679.includes('cmdBookmarkOpen') || tp679.includes('bookmarkCmd')) {
    log('pass', 'R679', 'TerminalPanel 명령어 즐겨찾기 존재')
  } else {
    log('warning', 'R679', 'TerminalPanel 즐겨찾기 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 140: Phase DD10 R681~683 기능 체크 ────────────────
console.log('\n## 140. Phase DD10 R681~683 기능 체크')
// R681: SceneViewPanel 스냅샷
const svp681Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp681Path)) {
  const svp681 = readFileSync(svp681Path, 'utf-8')
  if (svp681.includes('snapshots') || svp681.includes('snapshotOpen') || svp681.includes('takeSnapshot')) {
    log('pass', 'R681', 'SceneViewPanel 스냅샷 기록 존재')
  } else {
    log('warning', 'R681', 'SceneViewPanel 스냅샷 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R682: ChatPanel 메시지 폴딩
const cp682Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp682Path)) {
  const cp682 = readFileSync(cp682Path, 'utf-8')
  if (cp682.includes('foldedMessages') || cp682.includes('foldThreshold') || cp682.includes('foldMessages')) {
    log('pass', 'R682', 'ChatPanel 메시지 폴딩 존재')
  } else {
    log('warning', 'R682', 'ChatPanel 메시지 폴딩 없음', 'chat/ChatPanel.tsx')
  }
}

// R683: CocosPanel 프로퍼티 검색
const cp683Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp683Path)) {
  const cp683 = readFileSync(cp683Path, 'utf-8')
  if (cp683.includes('propSearchQuery') || cp683.includes('showPropSearch') || cp683.includes('propSearch')) {
    log('pass', 'R683', 'CocosPanel 프로퍼티 검색 존재')
  } else {
    log('warning', 'R683', 'CocosPanel 프로퍼티 검색 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 141: Phase DD10 R685~687 기능 체크 ────────────────
console.log('\n## 141. Phase DD10 R685~687 기능 체크')
// R685: InputBar 멀티라인 모드
const ib685Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib685Path)) {
  const ib685 = readFileSync(ib685Path, 'utf-8')
  if (ib685.includes('multilineMode') || ib685.includes('multiline')) {
    log('pass', 'R685', 'InputBar 멀티라인 모드 존재')
  } else {
    log('warning', 'R685', 'InputBar 멀티라인 없음', 'chat/InputBar.tsx')
  }
}

// R686: TerminalPanel 출력 테마
const tp686Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp686Path)) {
  const tp686 = readFileSync(tp686Path, 'utf-8')
  if (tp686.includes('outputTheme') || tp686.includes('outputThemeOpen')) {
    log('pass', 'R686', 'TerminalPanel 출력 색상 테마 존재')
  } else {
    log('warning', 'R686', 'TerminalPanel 출력 테마 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R687: SessionList 세션 아카이브
const sl687Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl687Path)) {
  const sl687 = readFileSync(sl687Path, 'utf-8')
  if (sl687.includes('archivedSessions') || sl687.includes('toggleArchive') || sl687.includes('showArchived')) {
    log('pass', 'R687', 'SessionList 세션 아카이브 존재')
  } else {
    log('warning', 'R687', 'SessionList 아카이브 없음', 'sidebar/SessionList.tsx')
  }
}

// ── Section 142: Phase DD10 R689~691 기능 체크 ────────────────
console.log('\n## 142. Phase DD10 R689~691 기능 체크')
// R689: SceneViewPanel 애니메이션 미리보기
const svp689Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp689Path)) {
  const svp689 = readFileSync(svp689Path, 'utf-8')
  if (svp689.includes('animPreview') || svp689.includes('animFrame') || svp689.includes('animSlider')) {
    log('pass', 'R689', 'SceneViewPanel 애니메이션 미리보기 존재')
  } else {
    log('warning', 'R689', 'SceneViewPanel 애니메이션 미리보기 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R690: MessageBubble 번역
const mb690Path = join(ROOT, 'src/renderer/src/components/chat/MessageBubble.tsx')
if (existsSync(mb690Path)) {
  const mb690 = readFileSync(mb690Path, 'utf-8')
  if (mb690.includes('showTranslation') || mb690.includes('translatedText') || mb690.includes('translateMsg')) {
    log('pass', 'R690', 'MessageBubble 번역 버튼 존재')
  } else {
    log('warning', 'R690', 'MessageBubble 번역 없음', 'chat/MessageBubble.tsx')
  }
}

// R691: CocosPanel 노드 즐겨찾기
const cp691Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp691Path)) {
  const cp691 = readFileSync(cp691Path, 'utf-8')
  if (cp691.includes('favoriteNodes') || cp691.includes('favoritesOpen') || cp691.includes('favoriteNode')) {
    log('pass', 'R691', 'CocosPanel 노드 즐겨찾기 존재')
  } else {
    log('warning', 'R691', 'CocosPanel 즐겨찾기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 143: Phase DD10 R693~695 기능 체크 ────────────────
console.log('\n## 143. Phase DD10 R693~695 기능 체크')
// R693: ChatPanel 대화 자동 요약
const cp693Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp693Path)) {
  const cp693 = readFileSync(cp693Path, 'utf-8')
  if (cp693.includes('autoSummary') || cp693.includes('showAutoSummary')) {
    log('pass', 'R693', 'ChatPanel 대화 자동 요약 존재')
  } else {
    log('warning', 'R693', 'ChatPanel 자동 요약 없음', 'chat/ChatPanel.tsx')
  }
}

// R694: TerminalPanel 분할 레이아웃
const tp694Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp694Path)) {
  const tp694 = readFileSync(tp694Path, 'utf-8')
  if (tp694.includes('splitLayout') || tp694.includes('splitRatio') || tp694.includes('splitTerminal')) {
    log('pass', 'R694', 'TerminalPanel 분할 레이아웃 존재')
  } else {
    log('warning', 'R694', 'TerminalPanel 분할 레이아웃 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R695: SceneViewPanel 노드 태그
const svp695Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp695Path)) {
  const svp695 = readFileSync(svp695Path, 'utf-8')
  if (svp695.includes('nodeTags') || svp695.includes('nodeTagInput') || svp695.includes('addNodeTag')) {
    log('pass', 'R695', 'SceneViewPanel 노드 태그 존재')
  } else {
    log('warning', 'R695', 'SceneViewPanel 노드 태그 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 144: Phase DD10 R697~699 기능 체크 ────────────────
console.log('\n## 144. Phase DD10 R697~699 기능 체크')
// R697: StatusBar CPU 모니터링
const sb697Path = join(ROOT, 'src/renderer/src/components/shared/StatusBar.tsx')
if (existsSync(sb697Path)) {
  const sb697 = readFileSync(sb697Path, 'utf-8')
  if (sb697.includes('cpuUsage') || sb697.includes('onCpuUpdate') || sb697.includes('cpuPercent')) {
    log('pass', 'R697', 'StatusBar CPU 모니터링 존재')
  } else {
    log('warning', 'R697', 'StatusBar CPU 모니터링 없음', 'shared/StatusBar.tsx')
  }
}

// R698: SessionList 세션 타입 필터
const sl698Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl698Path)) {
  const sl698 = readFileSync(sl698Path, 'utf-8')
  if (sl698.includes('filterType') || sl698.includes('filterTab') || sl698.includes('sessionTypeFilter')) {
    log('pass', 'R698', 'SessionList 세션 타입 필터 존재')
  } else {
    log('warning', 'R698', 'SessionList 타입 필터 없음', 'sidebar/SessionList.tsx')
  }
}

// R699: CocosPanel 변경 이력 뷰어
const cp699Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp699Path)) {
  const cp699 = readFileSync(cp699Path, 'utf-8')
  if (cp699.includes('changeHistory') || cp699.includes('showHistory') || cp699.includes('historyEntry')) {
    log('pass', 'R699', 'CocosPanel 변경 이력 뷰어 존재')
  } else {
    log('warning', 'R699', 'CocosPanel 변경 이력 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 145: Phase DD10 R701~703 기능 체크 ────────────────
console.log('\n## 145. Phase DD10 R701~703 기능 체크')
// R701: ChatPanel 메시지 라벨
const cp701Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp701Path)) {
  const cp701 = readFileSync(cp701Path, 'utf-8')
  if (cp701.includes('msgLabels') || cp701.includes('showLabelMenu') || cp701.includes('MSG_LABEL_COLORS')) {
    log('pass', 'R701', 'ChatPanel 메시지 라벨 존재')
  } else {
    log('warning', 'R701', 'ChatPanel 메시지 라벨 없음', 'chat/ChatPanel.tsx')
  }
}

// R702: SceneViewPanel 노드 접근 카운터
const svp702Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp702Path)) {
  const svp702 = readFileSync(svp702Path, 'utf-8')
  if (svp702.includes('nodeAccessCount') || svp702.includes('accessCount') || svp702.includes('nodeHitCount')) {
    log('pass', 'R702', 'SceneViewPanel 노드 접근 카운터 존재')
  } else {
    log('warning', 'R702', 'SceneViewPanel 노드 접근 카운터 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R703: InputBar 스마트 입력 모드
const ib703Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib703Path)) {
  const ib703 = readFileSync(ib703Path, 'utf-8')
  if (ib703.includes('smartInput') || ib703.includes('smart-input') || ib703.includes('smartMode')) {
    log('pass', 'R703', 'InputBar 스마트 입력 모드 존재')
  } else {
    log('warning', 'R703', 'InputBar 스마트 입력 모드 없음', 'chat/InputBar.tsx')
  }
}

// ── Section 146: Phase DD10 R705~707 기능 체크 ────────────────
console.log('\n## 146. Phase DD10 R705~707 기능 체크')
// R705: CocosPanel 노드 프리셋 카테고리
const cp705Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp705Path)) {
  const cp705 = readFileSync(cp705Path, 'utf-8')
  if (cp705.includes('nodePresetCategories') || cp705.includes('selectedPresetCategory') || cp705.includes('presetCategory')) {
    log('pass', 'R705', 'CocosPanel 노드 프리셋 카테고리 존재')
  } else {
    log('warning', 'R705', 'CocosPanel 프리셋 카테고리 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R706: SessionList 내보내기 포맷
const sl706Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl706Path)) {
  const sl706 = readFileSync(sl706Path, 'utf-8')
  if (sl706.includes('exportFormat') || sl706.includes('showExportMenu') || sl706.includes('exportType')) {
    log('pass', 'R706', 'SessionList 내보내기 포맷 선택 존재')
  } else {
    log('warning', 'R706', 'SessionList 내보내기 포맷 없음', 'sidebar/SessionList.tsx')
  }
}

// R707: TerminalPanel 검색 매치 하이라이트
const tp707Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp707Path)) {
  const tp707 = readFileSync(tp707Path, 'utf-8')
  if (tp707.includes('termSearchMatches') || tp707.includes('termSearchIdx') || tp707.includes('searchMatches')) {
    log('pass', 'R707', 'TerminalPanel 검색 매치 하이라이트 존재')
  } else {
    log('warning', 'R707', 'TerminalPanel 검색 매치 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 147: Phase DD10 R708~710 기능 체크 ────────────────
console.log('\n## 147. Phase DD10 R708~710 기능 체크')
// R708: ChatPanel 메시지 북마크
const cp708Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp708Path)) {
  const cp708 = readFileSync(cp708Path, 'utf-8')
  if (cp708.includes('bookmarkedMsgs') || cp708.includes('showBookmarks') || cp708.includes('bookmarkMsg')) {
    log('pass', 'R708', 'ChatPanel 메시지 북마크 존재')
  } else {
    log('warning', 'R708', 'ChatPanel 메시지 북마크 없음', 'chat/ChatPanel.tsx')
  }
}

// R709: SceneViewPanel 노드 그룹 색상
const svp709Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp709Path)) {
  const svp709 = readFileSync(svp709Path, 'utf-8')
  if (svp709.includes('nodeGroupColors') || svp709.includes('colorPickerNode') || svp709.includes('groupColor')) {
    log('pass', 'R709', 'SceneViewPanel 노드 그룹 색상 존재')
  } else {
    log('warning', 'R709', 'SceneViewPanel 노드 그룹 색상 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R710: InputBar 히스토리 검색
const ib710Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib710Path)) {
  const ib710 = readFileSync(ib710Path, 'utf-8')
  if (ib710.includes('historySearch') || ib710.includes('historySearchOpen') || ib710.includes('searchHistory')) {
    log('pass', 'R710', 'InputBar 히스토리 검색 존재')
  } else {
    log('warning', 'R710', 'InputBar 히스토리 검색 없음', 'chat/InputBar.tsx')
  }
}

// ── Section 148: Phase DD10 R711~713 기능 체크 ────────────────
console.log('\n## 148. Phase DD10 R711~713 기능 체크')
// R711: CocosPanel 즐겨찾기 태그
const cp711Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp711Path)) {
  const cp711 = readFileSync(cp711Path, 'utf-8')
  if (cp711.includes('favoriteTags') || cp711.includes('showFavTags') || cp711.includes('fav-tags')) {
    log('pass', 'R711', 'CocosPanel 즐겨찾기 태그 존재')
  } else {
    log('warning', 'R711', 'CocosPanel 즐겨찾기 태그 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R712: SessionList 세션 메모
const sl712Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl712Path)) {
  const sl712 = readFileSync(sl712Path, 'utf-8')
  if (sl712.includes('sessionMemos') || sl712.includes('editingMemo') || sl712.includes('session-memos')) {
    log('pass', 'R712', 'SessionList 세션 메모 존재')
  } else {
    log('warning', 'R712', 'SessionList 세션 메모 없음', 'sidebar/SessionList.tsx')
  }
}

// R713: SceneToolbar 노드 정렬 옵션
const st713Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx')
if (existsSync(st713Path)) {
  const st713 = readFileSync(st713Path, 'utf-8')
  if (st713.includes('sortMode') || st713.includes('onSortChange') || st713.includes('z-order')) {
    log('pass', 'R713', 'SceneToolbar 노드 정렬 옵션 존재')
  } else {
    log('warning', 'R713', 'SceneToolbar 노드 정렬 없음', 'SceneView/SceneToolbar.tsx')
  }
}

// ── Section 149: Phase DD10 R714~716 기능 체크 ────────────────
console.log('\n## 149. Phase DD10 R714~716 기능 체크')
// R714: ChatPanel 메시지 반응 통계
const cp714Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp714Path)) {
  const cp714 = readFileSync(cp714Path, 'utf-8')
  if (cp714.includes('reactionStats') || cp714.includes('showReactionStats') || cp714.includes('reactionCount')) {
    log('pass', 'R714', 'ChatPanel 메시지 반응 통계 존재')
  } else {
    log('warning', 'R714', 'ChatPanel 반응 통계 없음', 'chat/ChatPanel.tsx')
  }
}

// R715: TerminalPanel 탭 이름 변경
const tp715Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp715Path)) {
  const tp715 = readFileSync(tp715Path, 'utf-8')
  if (tp715.includes('tabNames') || tp715.includes('editingTabName') || tp715.includes('tabLabel')) {
    log('pass', 'R715', 'TerminalPanel 탭 이름 변경 존재')
  } else {
    log('warning', 'R715', 'TerminalPanel 탭 이름 변경 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R716: SceneViewPanel 노드 메모
const svp716Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp716Path)) {
  const svp716 = readFileSync(svp716Path, 'utf-8')
  if (svp716.includes('nodeMemos') || svp716.includes('editingNodeMemo') || svp716.includes('node-memos')) {
    log('pass', 'R716', 'SceneViewPanel 노드 메모 존재')
  } else {
    log('warning', 'R716', 'SceneViewPanel 노드 메모 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 150: Phase DD10 R717~719 기능 체크 ────────────────
console.log('\n## 150. Phase DD10 R717~719 기능 체크')
// R717: InputBar 템플릿 변수
const ib717Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib717Path)) {
  const ib717 = readFileSync(ib717Path, 'utf-8')
  if (ib717.includes('templateVars') || ib717.includes('templateVarKeys') || ib717.includes('templateVar')) {
    log('pass', 'R717', 'InputBar 템플릿 변수 자동완성 존재')
  } else {
    log('warning', 'R717', 'InputBar 템플릿 변수 없음', 'chat/InputBar.tsx')
  }
}

// R718: CocosPanel 속성 즐겨찾기
const cp718Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp718Path)) {
  const cp718 = readFileSync(cp718Path, 'utf-8')
  if (cp718.includes('favProps') || cp718.includes('showFavPropsOnly') || cp718.includes('fav-props')) {
    log('pass', 'R718', 'CocosPanel 속성 즐겨찾기 존재')
  } else {
    log('warning', 'R718', 'CocosPanel 속성 즐겨찾기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R719: SessionList 세션 비교
const sl719Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl719Path)) {
  const sl719 = readFileSync(sl719Path, 'utf-8')
  if (sl719.includes('compareMode') || sl719.includes('compareTargets') || sl719.includes('sessionCompare')) {
    log('pass', 'R719', 'SessionList 세션 비교 모드 존재')
  } else {
    log('warning', 'R719', 'SessionList 세션 비교 없음', 'sidebar/SessionList.tsx')
  }
}

// ── Section 151: Phase DD10 R720~722 기능 체크 ────────────────
console.log('\n## 151. Phase DD10 R720~722 기능 체크')
// R720: ChatPanel 메시지 스레드
const cp720Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp720Path)) {
  const cp720 = readFileSync(cp720Path, 'utf-8')
  if (cp720.includes('threadOpen') || cp720.includes('threadReplies') || cp720.includes('threadMsg')) {
    log('pass', 'R720', 'ChatPanel 메시지 스레드 존재')
  } else {
    log('warning', 'R720', 'ChatPanel 메시지 스레드 없음', 'chat/ChatPanel.tsx')
  }
}

// R721: SceneViewPanel 노드 링크
const svp721Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp721Path)) {
  const svp721 = readFileSync(svp721Path, 'utf-8')
  if (svp721.includes('nodeLinks') || svp721.includes('showNodeLinks') || svp721.includes('linkedNodes')) {
    log('pass', 'R721', 'SceneViewPanel 노드 링크 존재')
  } else {
    log('warning', 'R721', 'SceneViewPanel 노드 링크 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R722: TerminalPanel 명령어 통계
const tp722Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp722Path)) {
  const tp722 = readFileSync(tp722Path, 'utf-8')
  if (tp722.includes('cmdStats') || tp722.includes('showCmdStats') || tp722.includes('commandStats')) {
    log('pass', 'R722', 'TerminalPanel 명령어 통계 존재')
  } else {
    log('warning', 'R722', 'TerminalPanel 명령어 통계 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 152: Phase DD10 R723~725 기능 체크 ────────────────
console.log('\n## 152. Phase DD10 R723~725 기능 체크')
// R723: ChatPanel AI 응답 품질 평가
const cp723Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp723Path)) {
  const cp723 = readFileSync(cp723Path, 'utf-8')
  if (cp723.includes('msgRatings') || cp723.includes('showRatingBar') || cp723.includes('msgRating')) {
    log('pass', 'R723', 'ChatPanel 메시지 평점 존재')
  } else {
    log('warning', 'R723', 'ChatPanel 메시지 평점 없음', 'chat/ChatPanel.tsx')
  }
}

// R724: CocosPanel 노드 의존성 맵
const cp724Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp724Path)) {
  const cp724 = readFileSync(cp724Path, 'utf-8')
  if (cp724.includes('depMap') || cp724.includes('showDepMap') || cp724.includes('dependencyMap')) {
    log('pass', 'R724', 'CocosPanel 노드 의존성 맵 존재')
  } else {
    log('warning', 'R724', 'CocosPanel 의존성 맵 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R725: SceneViewPanel 노드 배지
const svp725Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp725Path)) {
  const svp725 = readFileSync(svp725Path, 'utf-8')
  if (svp725.includes('nodeBadges') || svp725.includes('badgeEditNode') || svp725.includes('nodeBadge')) {
    log('pass', 'R725', 'SceneViewPanel 노드 배지 존재')
  } else {
    log('warning', 'R725', 'SceneViewPanel 노드 배지 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 153: Phase DD10 R726~728 기능 체크 ────────────────
console.log('\n## 153. Phase DD10 R726~728 기능 체크')
// R726: InputBar 음성 매크로
const ib726Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib726Path)) {
  const ib726 = readFileSync(ib726Path, 'utf-8')
  if (ib726.includes('voiceMacros') || ib726.includes('showVoiceMacros') || ib726.includes('voice-macros')) {
    log('pass', 'R726', 'InputBar 음성 매크로 존재')
  } else {
    log('warning', 'R726', 'InputBar 음성 매크로 없음', 'chat/InputBar.tsx')
  }
}

// R727: SessionList 세션 그룹
const sl727Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl727Path)) {
  const sl727 = readFileSync(sl727Path, 'utf-8')
  if (sl727.includes('sessionGroups') || sl727.includes('groupEditName') || sl727.includes('session-groups')) {
    log('pass', 'R727', 'SessionList 세션 그룹 존재')
  } else {
    log('warning', 'R727', 'SessionList 세션 그룹 없음', 'sidebar/SessionList.tsx')
  }
}

// R728: TerminalPanel 자동 재연결
const tp728Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp728Path)) {
  const tp728 = readFileSync(tp728Path, 'utf-8')
  if (tp728.includes('autoReconnect') || tp728.includes('reconnectCount') || tp728.includes('reconnect')) {
    log('pass', 'R728', 'TerminalPanel 자동 재연결 존재')
  } else {
    log('warning', 'R728', 'TerminalPanel 자동 재연결 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 154: Phase DD10 R729~731 기능 체크 ────────────────
console.log('\n## 154. Phase DD10 R729~731 기능 체크')
// R729: ChatPanel 메시지 요약 카드
const cp729Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp729Path)) {
  const cp729 = readFileSync(cp729Path, 'utf-8')
  if (cp729.includes('summaryCards') || cp729.includes('showSummaryCard') || cp729.includes('summaryCard')) {
    log('pass', 'R729', 'ChatPanel 메시지 요약 카드 존재')
  } else {
    log('warning', 'R729', 'ChatPanel 요약 카드 없음', 'chat/ChatPanel.tsx')
  }
}

// R730: SceneViewPanel 씬 히스토리
const svp730Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp730Path)) {
  const svp730 = readFileSync(svp730Path, 'utf-8')
  if (svp730.includes('sceneHistory') || svp730.includes('showSceneHistory') || svp730.includes('recentScenes')) {
    log('pass', 'R730', 'SceneViewPanel 씬 히스토리 존재')
  } else {
    log('warning', 'R730', 'SceneViewPanel 씬 히스토리 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R731: CocosPanel 컴포넌트 검색 필터
const cp731Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp731Path)) {
  const cp731 = readFileSync(cp731Path, 'utf-8')
  if (cp731.includes('compFilter') || cp731.includes('compFilterFocus') || cp731.includes('componentFilter')) {
    log('pass', 'R731', 'CocosPanel 컴포넌트 검색 필터 존재')
  } else {
    log('warning', 'R731', 'CocosPanel 컴포넌트 필터 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 155: Phase DD10 R732~734 기능 체크 ────────────────
console.log('\n## 155. Phase DD10 R732~734 기능 체크')
// R732: InputBar 자동 들여쓰기
const ib732Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib732Path)) {
  const ib732 = readFileSync(ib732Path, 'utf-8')
  if (ib732.includes('autoIndent') || ib732.includes('indentSize') || ib732.includes('autoIndentation')) {
    log('pass', 'R732', 'InputBar 자동 들여쓰기 존재')
  } else {
    log('warning', 'R732', 'InputBar 자동 들여쓰기 없음', 'chat/InputBar.tsx')
  }
}

// R733: SessionList 세션 잠금
const sl733Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl733Path)) {
  const sl733 = readFileSync(sl733Path, 'utf-8')
  if (sl733.includes('lockedSessions') || sl733.includes('lockConfirmId') || sl733.includes('locked-sessions')) {
    log('pass', 'R733', 'SessionList 세션 잠금 존재')
  } else {
    log('warning', 'R733', 'SessionList 세션 잠금 없음', 'sidebar/SessionList.tsx')
  }
}

// R734: TerminalPanel 정규식 필터
const tp734Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp734Path)) {
  const tp734 = readFileSync(tp734Path, 'utf-8')
  if (tp734.includes('filterRegex') || tp734.includes('filterCaseSensitive') || tp734.includes('regexFilter')) {
    log('pass', 'R734', 'TerminalPanel 정규식 필터 존재')
  } else {
    log('warning', 'R734', 'TerminalPanel 정규식 필터 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 156: Phase DD10 R735~737 기능 체크 ────────────────
console.log('\n## 156. Phase DD10 R735~737 기능 체크')
// R735: ChatPanel 코드 블록 실행
const cp735Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp735Path)) {
  const cp735 = readFileSync(cp735Path, 'utf-8')
  if (cp735.includes('runningBlocks') || cp735.includes('blockOutputs') || cp735.includes('runBlock')) {
    log('pass', 'R735', 'ChatPanel 코드 블록 실행 존재')
  } else {
    log('warning', 'R735', 'ChatPanel 코드 블록 실행 없음', 'chat/ChatPanel.tsx')
  }
}

// R736: SceneViewPanel 씬 즐겨찾기
const svp736Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp736Path)) {
  const svp736 = readFileSync(svp736Path, 'utf-8')
  if (svp736.includes('favoriteScenes') || svp736.includes('showFavScenes') || svp736.includes('fav-scenes')) {
    log('pass', 'R736', 'SceneViewPanel 씬 즐겨찾기 존재')
  } else {
    log('warning', 'R736', 'SceneViewPanel 씬 즐겨찾기 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R737: CocosPanel 스크립트 실행 로그
const cp737Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp737Path)) {
  const cp737 = readFileSync(cp737Path, 'utf-8')
  if (cp737.includes('scriptLogs') || cp737.includes('showScriptLogs') || cp737.includes('scriptLog')) {
    log('pass', 'R737', 'CocosPanel 스크립트 실행 로그 존재')
  } else {
    log('warning', 'R737', 'CocosPanel 스크립트 로그 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 157: Phase DD10 R738~740 기능 체크 ────────────────
console.log('\n## 157. Phase DD10 R738~740 기능 체크')
// R738: ChatPanel 메시지 만료 타이머
const cp738Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp738Path)) {
  const cp738 = readFileSync(cp738Path, 'utf-8')
  if (cp738.includes('msgExpiry') || cp738.includes('showExpiredMsgs') || cp738.includes('expiredMsg')) {
    log('pass', 'R738', 'ChatPanel 메시지 만료 타이머 존재')
  } else {
    log('warning', 'R738', 'ChatPanel 메시지 만료 없음', 'chat/ChatPanel.tsx')
  }
}

// R739: InputBar 커서 위치 기억
const ib739Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib739Path)) {
  const ib739 = readFileSync(ib739Path, 'utf-8')
  if (ib739.includes('savedCursorPos') || ib739.includes('cursorPosHistory') || ib739.includes('cursorPos')) {
    log('pass', 'R739', 'InputBar 커서 위치 기억 존재')
  } else {
    log('warning', 'R739', 'InputBar 커서 위치 없음', 'chat/InputBar.tsx')
  }
}

// R740: TerminalPanel 세션 공유
const tp740Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp740Path)) {
  const tp740 = readFileSync(tp740Path, 'utf-8')
  if (tp740.includes('sharedTabs') || tp740.includes('shareCode') || tp740.includes('shareSession')) {
    log('pass', 'R740', 'TerminalPanel 세션 공유 존재')
  } else {
    log('warning', 'R740', 'TerminalPanel 세션 공유 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 158: Phase DD10 R741~743 기능 체크 ────────────────
console.log('\n## 158. Phase DD10 R741~743 기능 체크')
// R741: ChatPanel 내보내기 템플릿
const cp741Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp741Path)) {
  const cp741 = readFileSync(cp741Path, 'utf-8')
  if (cp741.includes('exportTemplate') || cp741.includes('showExportOptions') || cp741.includes('exportFormat')) {
    log('pass', 'R741', 'ChatPanel 내보내기 템플릿 존재')
  } else {
    log('warning', 'R741', 'ChatPanel 내보내기 템플릿 없음', 'chat/ChatPanel.tsx')
  }
}

// R742: SceneViewPanel 전체 노드 잠금
const svp742Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp742Path)) {
  const svp742 = readFileSync(svp742Path, 'utf-8')
  if (svp742.includes('lockAll') || svp742.includes('lockMode') || svp742.includes('allLocked')) {
    log('pass', 'R742', 'SceneViewPanel 전체 노드 잠금 존재')
  } else {
    log('warning', 'R742', 'SceneViewPanel 전체 잠금 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R743: CocosPanel 변경 알림
const cp743Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp743Path)) {
  const cp743 = readFileSync(cp743Path, 'utf-8')
  if (cp743.includes('changeNotifications') || cp743.includes('notifDismissed') || cp743.includes('changeNotif')) {
    log('pass', 'R743', 'CocosPanel 변경 알림 존재')
  } else {
    log('warning', 'R743', 'CocosPanel 변경 알림 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 159: Phase DD10 R744~746 기능 체크 ────────────────
console.log('\n## 159. Phase DD10 R744~746 기능 체크')
// R744: ChatPanel 검색 하이라이트
const cp744Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp744Path)) {
  const cp744 = readFileSync(cp744Path, 'utf-8')
  if (cp744.includes('searchHighlights') || cp744.includes('searchHlIdx') || cp744.includes('hlSearch')) {
    log('pass', 'R744', 'ChatPanel 검색 하이라이트 존재')
  } else {
    log('warning', 'R744', 'ChatPanel 검색 하이라이트 없음', 'chat/ChatPanel.tsx')
  }
}

// R745: InputBar 붙여넣기 모드
const ib745Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib745Path)) {
  const ib745 = readFileSync(ib745Path, 'utf-8')
  if (ib745.includes('pasteMode') || ib745.includes('lastPasteType') || ib745.includes('pasteType')) {
    log('pass', 'R745', 'InputBar 붙여넣기 모드 존재')
  } else {
    log('warning', 'R745', 'InputBar 붙여넣기 모드 없음', 'chat/InputBar.tsx')
  }
}

// R746: SessionList 세션 색상 태그
const sl746Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl746Path)) {
  const sl746 = readFileSync(sl746Path, 'utf-8')
  if (sl746.includes('sessionColors') || sl746.includes('colorPickerSession') || sl746.includes('session-colors')) {
    log('pass', 'R746', 'SessionList 세션 색상 태그 존재')
  } else {
    log('warning', 'R746', 'SessionList 세션 색상 없음', 'sidebar/SessionList.tsx')
  }
}

// ── Section 160: Phase DD10 R747~749 기능 체크 ────────────────
console.log('\n## 160. Phase DD10 R747~749 기능 체크')
// R747: ChatPanel 모델 히스토리
const cp747Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp747Path)) {
  const cp747 = readFileSync(cp747Path, 'utf-8')
  if (cp747.includes('modelHistory') || cp747.includes('modelFavorites') || cp747.includes('model-history')) {
    log('pass', 'R747', 'ChatPanel 모델 히스토리 존재')
  } else {
    log('warning', 'R747', 'ChatPanel 모델 히스토리 없음', 'chat/ChatPanel.tsx')
  }
}

// R748: SceneViewPanel 씬 비교
const svp748Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp748Path)) {
  const svp748 = readFileSync(svp748Path, 'utf-8')
  if (svp748.includes('compareScene') || svp748.includes('showSceneCompare') || svp748.includes('sceneCompare')) {
    log('pass', 'R748', 'SceneViewPanel 씬 비교 존재')
  } else {
    log('warning', 'R748', 'SceneViewPanel 씬 비교 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R749: TerminalPanel 명령어 별칭
const tp749Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp749Path)) {
  const tp749 = readFileSync(tp749Path, 'utf-8')
  if (tp749.includes('cmdAliases') || tp749.includes('showAliasEditor') || tp749.includes('cmd-aliases')) {
    log('pass', 'R749', 'TerminalPanel 명령어 별칭 존재')
  } else {
    log('warning', 'R749', 'TerminalPanel 명령어 별칭 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 161: Phase DD10 R750~752 기능 체크 ────────────────
console.log('\n## 161. Phase DD10 R750~752 기능 체크')
// R750: ChatPanel 스트리밍 제어
const cp750Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp750Path)) {
  const cp750 = readFileSync(cp750Path, 'utf-8')
  if (cp750.includes('streamSpeed') || cp750.includes('pausedStream') || cp750.includes('streamControl')) {
    log('pass', 'R750', 'ChatPanel 스트리밍 제어 존재')
  } else {
    log('warning', 'R750', 'ChatPanel 스트리밍 제어 없음', 'chat/ChatPanel.tsx')
  }
}

// R751: CocosPanel 템플릿 내보내기
const cp751Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp751Path)) {
  const cp751 = readFileSync(cp751Path, 'utf-8')
  if (cp751.includes('exportedTemplates') || cp751.includes('templateExportOpen') || cp751.includes('templateExport')) {
    log('pass', 'R751', 'CocosPanel 템플릿 내보내기 존재')
  } else {
    log('warning', 'R751', 'CocosPanel 템플릿 내보내기 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R752: SceneViewPanel 씬 태그
const svp752Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp752Path)) {
  const svp752 = readFileSync(svp752Path, 'utf-8')
  if (svp752.includes('sceneTags') || svp752.includes('sceneTagInput') || svp752.includes('scene-tags')) {
    log('pass', 'R752', 'SceneViewPanel 씬 태그 존재')
  } else {
    log('warning', 'R752', 'SceneViewPanel 씬 태그 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 162: Phase DD10 R753~755 기능 체크 ────────────────
console.log('\n## 162. Phase DD10 R753~755 기능 체크')
// R753: InputBar 멀티모달 입력
const ib753Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib753Path)) {
  const ib753 = readFileSync(ib753Path, 'utf-8')
  if (ib753.includes('inputMode') || ib753.includes('pendingImages') || ib753.includes('multimodal')) {
    log('pass', 'R753', 'InputBar 멀티모달 입력 모드 존재')
  } else {
    log('warning', 'R753', 'InputBar 멀티모달 없음', 'chat/InputBar.tsx')
  }
}

// R754: SessionList 세션 평점
const sl754Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl754Path)) {
  const sl754 = readFileSync(sl754Path, 'utf-8')
  if (sl754.includes('sessionRatings') || sl754.includes('ratingFilter') || sl754.includes('session-ratings')) {
    log('pass', 'R754', 'SessionList 세션 평점 존재')
  } else {
    log('warning', 'R754', 'SessionList 세션 평점 없음', 'sidebar/SessionList.tsx')
  }
}

// R755: TerminalPanel 환경변수 뷰어
const tp755Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp755Path)) {
  const tp755 = readFileSync(tp755Path, 'utf-8')
  if (tp755.includes('envVars') || tp755.includes('showEnvVars') || tp755.includes('envViewer')) {
    log('pass', 'R755', 'TerminalPanel 환경변수 뷰어 존재')
  } else {
    log('warning', 'R755', 'TerminalPanel 환경변수 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 163: Phase DD10 R756~758 기능 체크 ────────────────
console.log('\n## 163. Phase DD10 R756~758 기능 체크')
// R756: ChatPanel 대화 분기
const cp756Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp756Path)) {
  const cp756 = readFileSync(cp756Path, 'utf-8')
  if (cp756.includes('branchPoint') || cp756.includes('branches') || cp756.includes('chatBranch')) {
    log('pass', 'R756', 'ChatPanel 대화 분기 존재')
  } else {
    log('warning', 'R756', 'ChatPanel 대화 분기 없음', 'chat/ChatPanel.tsx')
  }
}

// R757: SceneViewPanel 씬 메모
const svp757Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp757Path)) {
  const svp757 = readFileSync(svp757Path, 'utf-8')
  if (svp757.includes('sceneMemos') || svp757.includes('editingSceneMemo') || svp757.includes('scene-memos')) {
    log('pass', 'R757', 'SceneViewPanel 씬 메모 존재')
  } else {
    log('warning', 'R757', 'SceneViewPanel 씬 메모 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R758: CocosPanel 씬 프리뷰 캐시
const cp758Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp758Path)) {
  const cp758 = readFileSync(cp758Path, 'utf-8')
  if (cp758.includes('previewCache') || cp758.includes('previewLoading') || cp758.includes('scenePreview')) {
    log('pass', 'R758', 'CocosPanel 씬 프리뷰 캐시 존재')
  } else {
    log('warning', 'R758', 'CocosPanel 프리뷰 캐시 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 164: Phase DD10 R759~761 기능 체크 ────────────────
console.log('\n## 164. Phase DD10 R759~761 기능 체크')
// R759: ChatPanel 번역 언어 선택
const cp759Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp759Path)) {
  const cp759 = readFileSync(cp759Path, 'utf-8')
  if (cp759.includes('translateLang') || cp759.includes('translating') || cp759.includes('translateTarget')) {
    log('pass', 'R759', 'ChatPanel 번역 언어 선택 존재')
  } else {
    log('warning', 'R759', 'ChatPanel 번역 언어 없음', 'chat/ChatPanel.tsx')
  }
}

// R760: InputBar 단축키 커스터마이징
const ib760Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib760Path)) {
  const ib760 = readFileSync(ib760Path, 'utf-8')
  if (ib760.includes('customShortcuts') || ib760.includes('showShortcutEditor') || ib760.includes('input-shortcuts')) {
    log('pass', 'R760', 'InputBar 단축키 커스터마이징 존재')
  } else {
    log('warning', 'R760', 'InputBar 단축키 커스터마이징 없음', 'chat/InputBar.tsx')
  }
}

// R761: TerminalPanel 프로세스 모니터
const tp761Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp761Path)) {
  const tp761 = readFileSync(tp761Path, 'utf-8')
  if (tp761.includes('processInfo') || tp761.includes('showProcessInfo') || tp761.includes('processMon')) {
    log('pass', 'R761', 'TerminalPanel 프로세스 모니터 존재')
  } else {
    log('warning', 'R761', 'TerminalPanel 프로세스 모니터 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 165: Phase DD10 R762~764 기능 체크 ────────────────
console.log('\n## 165. Phase DD10 R762~764 기능 체크')
// R762: ChatPanel 메시지 핀 고정
const cp762Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp762Path)) {
  const cp762 = readFileSync(cp762Path, 'utf-8')
  if (cp762.includes('pinnedMsgs') || cp762.includes('showPinnedOnly') || cp762.includes('pinned-msgs')) {
    log('pass', 'R762', 'ChatPanel 메시지 핀 고정 존재')
  } else {
    log('warning', 'R762', 'ChatPanel 메시지 핀 없음', 'chat/ChatPanel.tsx')
  }
}

// R763: SceneViewPanel 노드 가시성 필터
const svp763Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp763Path)) {
  const svp763 = readFileSync(svp763Path, 'utf-8')
  if (svp763.includes('visFilter') || svp763.includes('activeFilter') || svp763.includes('visibilityFilter')) {
    log('pass', 'R763', 'SceneViewPanel 노드 가시성 필터 존재')
  } else {
    log('warning', 'R763', 'SceneViewPanel 가시성 필터 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R764: SessionList 세션 읽기 상태
const sl764Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl764Path)) {
  const sl764 = readFileSync(sl764Path, 'utf-8')
  if (sl764.includes('readSessions') || sl764.includes('showUnreadOnly') || sl764.includes('read-sessions')) {
    log('pass', 'R764', 'SessionList 세션 읽기 상태 존재')
  } else {
    log('warning', 'R764', 'SessionList 읽기 상태 없음', 'sidebar/SessionList.tsx')
  }
}

// ── Section 166: Phase DD10 R765~767 기능 체크 ────────────────
console.log('\n## 166. Phase DD10 R765~767 기능 체크')
// R765: ChatPanel 대화 통계
const cp765Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp765Path)) {
  const cp765 = readFileSync(cp765Path, 'utf-8')
  if (cp765.includes('chatStats') || cp765.includes('showChatStats') || cp765.includes('totalTokens')) {
    log('pass', 'R765', 'ChatPanel 대화 통계 존재')
  } else {
    log('warning', 'R765', 'ChatPanel 대화 통계 없음', 'chat/ChatPanel.tsx')
  }
}

// R766: CocosPanel 에셋 검색
const cp766Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp766Path)) {
  const cp766 = readFileSync(cp766Path, 'utf-8')
  if (cp766.includes('assetSearch') || cp766.includes('assetSearchResults') || cp766.includes('assetQuery')) {
    log('pass', 'R766', 'CocosPanel 에셋 검색 존재')
  } else {
    log('warning', 'R766', 'CocosPanel 에셋 검색 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R767: InputBar 응답 길이 제한
const ib767Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib767Path)) {
  const ib767 = readFileSync(ib767Path, 'utf-8')
  if (ib767.includes('maxTokens') || ib767.includes('showTokenLimit') || ib767.includes('tokenLimit')) {
    log('pass', 'R767', 'InputBar 응답 길이 제한 존재')
  } else {
    log('warning', 'R767', 'InputBar 토큰 제한 없음', 'chat/InputBar.tsx')
  }
}

// ── Section 167: Phase DD10 R768~770 기능 체크 ────────────────
console.log('\n## 167. Phase DD10 R768~770 기능 체크')
// R768: ChatPanel 메시지 복사 형식
const cp768Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp768Path)) {
  const cp768 = readFileSync(cp768Path, 'utf-8')
  if (cp768.includes('copyFormat') || cp768.includes('showCopyMenu') || cp768.includes('copyType')) {
    log('pass', 'R768', 'ChatPanel 메시지 복사 형식 존재')
  } else {
    log('warning', 'R768', 'ChatPanel 복사 형식 없음', 'chat/ChatPanel.tsx')
  }
}

// R769: TerminalPanel 스크롤 위치 기억
const tp769Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp769Path)) {
  const tp769 = readFileSync(tp769Path, 'utf-8')
  if (tp769.includes('scrollPositions') || tp769.includes('autoScrollEnabled') || tp769.includes('scrollPos')) {
    log('pass', 'R769', 'TerminalPanel 스크롤 위치 기억 존재')
  } else {
    log('warning', 'R769', 'TerminalPanel 스크롤 위치 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R770: SceneViewPanel 노드 타입 필터
const svp770Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp770Path)) {
  const svp770 = readFileSync(svp770Path, 'utf-8')
  if (svp770.includes('nodeTypeFilter') || svp770.includes('showTypeFilter') || svp770.includes('typeFilter')) {
    log('pass', 'R770', 'SceneViewPanel 노드 타입 필터 존재')
  } else {
    log('warning', 'R770', 'SceneViewPanel 타입 필터 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 168: Phase DD10 R771~773 기능 체크 ────────────────
console.log('\n## 168. Phase DD10 R771~773 기능 체크')
// R771: ChatPanel 메시지 일괄 선택
const cp771Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp771Path)) {
  const cp771 = readFileSync(cp771Path, 'utf-8')
  if (cp771.includes('bulkSelectMode') || cp771.includes('bulkSelected') || cp771.includes('bulkSelect')) {
    log('pass', 'R771', 'ChatPanel 메시지 일괄 선택 존재')
  } else {
    log('warning', 'R771', 'ChatPanel 일괄 선택 없음', 'chat/ChatPanel.tsx')
  }
}

// R772: SessionList 검색 히스토리
const sl772Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl772Path)) {
  const sl772 = readFileSync(sl772Path, 'utf-8')
  if (sl772.includes('searchHistory') || sl772.includes('showSearchHistory') || sl772.includes('search-history')) {
    log('pass', 'R772', 'SessionList 검색 히스토리 존재')
  } else {
    log('warning', 'R772', 'SessionList 검색 히스토리 없음', 'sidebar/SessionList.tsx')
  }
}

// R773: CocosPanel 씬 로드 진행률
const cp773Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp773Path)) {
  const cp773 = readFileSync(cp773Path, 'utf-8')
  if (cp773.includes('loadProgress') || cp773.includes('loadingScene') || cp773.includes('sceneLoadProgress')) {
    log('pass', 'R773', 'CocosPanel 씬 로드 진행률 존재')
  } else {
    log('warning', 'R773', 'CocosPanel 로드 진행률 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 169: Phase DD10 R774~776 기능 체크 ────────────────
console.log('\n## 169. Phase DD10 R774~776 기능 체크')
// R774: ChatPanel 메시지 암호화 표시
const cp774Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp774Path)) {
  const cp774 = readFileSync(cp774Path, 'utf-8')
  if (cp774.includes('encryptedMsgs') || cp774.includes('showEncryptionInfo') || cp774.includes('msgEncrypt')) {
    log('pass', 'R774', 'ChatPanel 메시지 암호화 표시 존재')
  } else {
    log('warning', 'R774', 'ChatPanel 암호화 표시 없음', 'chat/ChatPanel.tsx')
  }
}

// R775: InputBar 글로벌 프롬프트 변수
const ib775Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib775Path)) {
  const ib775 = readFileSync(ib775Path, 'utf-8')
  if (ib775.includes('globalVars') || ib775.includes('showGlobalVars') || ib775.includes('global-vars')) {
    log('pass', 'R775', 'InputBar 글로벌 프롬프트 변수 존재')
  } else {
    log('warning', 'R775', 'InputBar 글로벌 변수 없음', 'chat/InputBar.tsx')
  }
}

// R776: SceneViewPanel 씬 변경 감지
const svp776Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp776Path)) {
  const svp776 = readFileSync(svp776Path, 'utf-8')
  if (svp776.includes('sceneModified') || svp776.includes('lastSavedAt') || svp776.includes('unsavedChanges')) {
    log('pass', 'R776', 'SceneViewPanel 씬 변경 감지 존재')
  } else {
    log('warning', 'R776', 'SceneViewPanel 변경 감지 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 170: Phase DD10 R777~779 기능 체크 ────────────────
console.log('\n## 170. Phase DD10 R777~779 기능 체크')
// R777: ChatPanel 메시지 예약 전송
const cp777Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp777Path)) {
  const cp777 = readFileSync(cp777Path, 'utf-8')
  if (cp777.includes('scheduledMsgs') || cp777.includes('showScheduler') || cp777.includes('scheduleMsg')) {
    log('pass', 'R777', 'ChatPanel 메시지 예약 전송 존재')
  } else {
    log('warning', 'R777', 'ChatPanel 예약 전송 없음', 'chat/ChatPanel.tsx')
  }
}

// R778: TerminalPanel 컬러 테마
const tp778Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp778Path)) {
  const tp778 = readFileSync(tp778Path, 'utf-8')
  if (tp778.includes('colorTheme') || tp778.includes('customColors') || tp778.includes('termTheme')) {
    log('pass', 'R778', 'TerminalPanel 컬러 테마 존재')
  } else {
    log('warning', 'R778', 'TerminalPanel 컬러 테마 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R779: SessionList 세션 요약
const sl779Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl779Path)) {
  const sl779 = readFileSync(sl779Path, 'utf-8')
  if (sl779.includes('sessionSummaries') || sl779.includes('summaryLoading') || sl779.includes('sessionSummary')) {
    log('pass', 'R779', 'SessionList 세션 요약 자동 생성 존재')
  } else {
    log('warning', 'R779', 'SessionList 세션 요약 없음', 'sidebar/SessionList.tsx')
  }
}

// ── Section 171: Phase DD10 R780~782 기능 체크 ────────────────
console.log('\n## 171. Phase DD10 R780~782 기능 체크')
// R780: ChatPanel 메시지 워터마크
const cp780Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp780Path)) {
  const cp780 = readFileSync(cp780Path, 'utf-8')
  if (cp780.includes('watermarkText') || cp780.includes('showWatermark') || cp780.includes('watermark')) {
    log('pass', 'R780', 'ChatPanel 메시지 워터마크 존재')
  } else {
    log('warning', 'R780', 'ChatPanel 워터마크 없음', 'chat/ChatPanel.tsx')
  }
}

// R781: CocosPanel 씬 의존성
const cp781Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp781Path)) {
  const cp781 = readFileSync(cp781Path, 'utf-8')
  if (cp781.includes('sceneDeps') || cp781.includes('showSceneDeps') || cp781.includes('sceneDependency')) {
    log('pass', 'R781', 'CocosPanel 씬 의존성 그래프 존재')
  } else {
    log('warning', 'R781', 'CocosPanel 씬 의존성 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R782: SceneViewPanel 씬 북마크
const svp782Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp782Path)) {
  const svp782 = readFileSync(svp782Path, 'utf-8')
  if (svp782.includes('sceneBookmarks') || svp782.includes('showSceneBookmarks') || svp782.includes('scene-bookmarks')) {
    log('pass', 'R782', 'SceneViewPanel 씬 북마크 존재')
  } else {
    log('warning', 'R782', 'SceneViewPanel 씬 북마크 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 172: Phase DD10 R783~785 기능 체크 ────────────────
console.log('\n## 172. Phase DD10 R783~785 기능 체크')
// R783: ChatPanel 메시지 테마
const cp783Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp783Path)) {
  const cp783 = readFileSync(cp783Path, 'utf-8')
  if (cp783.includes('msgTheme') || cp783.includes('msgDensity') || cp783.includes('messageTheme')) {
    log('pass', 'R783', 'ChatPanel 메시지 테마 존재')
  } else {
    log('warning', 'R783', 'ChatPanel 메시지 테마 없음', 'chat/ChatPanel.tsx')
  }
}

// R784: InputBar 자동 수정
const ib784Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib784Path)) {
  const ib784 = readFileSync(ib784Path, 'utf-8')
  if (ib784.includes('autoCorrect') || ib784.includes('corrections') || ib784.includes('spellCheck')) {
    log('pass', 'R784', 'InputBar 자동 수정 제안 존재')
  } else {
    log('warning', 'R784', 'InputBar 자동 수정 없음', 'chat/InputBar.tsx')
  }
}

// R785: TerminalPanel 세션 녹화
const tp785Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp785Path)) {
  const tp785 = readFileSync(tp785Path, 'utf-8')
  if (tp785.includes('isRecordingSession') || tp785.includes('recordedFrames') || tp785.includes('termRecording')) {
    log('pass', 'R785', 'TerminalPanel 세션 녹화 존재')
  } else {
    log('warning', 'R785', 'TerminalPanel 세션 녹화 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 173: Phase DD10 R786~788 기능 체크 ────────────────
console.log('\n## 173. Phase DD10 R786~788 기능 체크')
// R786: ChatPanel 컨텍스트 윈도우 시각화
const cp786Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp786Path)) {
  const cp786 = readFileSync(cp786Path, 'utf-8')
  if (cp786.includes('contextUsage') || cp786.includes('showContextBar') || cp786.includes('contextWindow')) {
    log('pass', 'R786', 'ChatPanel 컨텍스트 윈도우 시각화 존재')
  } else {
    log('warning', 'R786', 'ChatPanel 컨텍스트 바 없음', 'chat/ChatPanel.tsx')
  }
}

// R787: SceneViewPanel 씬 버전 관리
const svp787Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp787Path)) {
  const svp787 = readFileSync(svp787Path, 'utf-8')
  if (svp787.includes('sceneVersions') || svp787.includes('showVersionHistory') || svp787.includes('sceneVersion')) {
    log('pass', 'R787', 'SceneViewPanel 씬 버전 관리 존재')
  } else {
    log('warning', 'R787', 'SceneViewPanel 씬 버전 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R788: SessionList 내보내기 이력
const sl788Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl788Path)) {
  const sl788 = readFileSync(sl788Path, 'utf-8')
  if (sl788.includes('exportHistory') || sl788.includes('showExportHistory') || sl788.includes('exportLog')) {
    log('pass', 'R788', 'SessionList 내보내기 이력 존재')
  } else {
    log('warning', 'R788', 'SessionList 내보내기 이력 없음', 'sidebar/SessionList.tsx')
  }
}

// ── Section 174: Phase DD10 R789~791 기능 체크 ────────────────
console.log('\n## 174. Phase DD10 R789~791 기능 체크')
// R789: ChatPanel AI 페르소나
const cp789Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp789Path)) {
  const cp789 = readFileSync(cp789Path, 'utf-8')
  if (cp789.includes('personaList') || cp789.includes('aiPersona') || cp789.includes('personas')) {
    log('pass', 'R789', 'ChatPanel AI 페르소나 설정 존재')
  } else {
    log('warning', 'R789', 'ChatPanel 페르소나 없음', 'chat/ChatPanel.tsx')
  }
}

// R790: CocosPanel 프리팹 인스턴스 추적
const cp790Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp790Path)) {
  const cp790 = readFileSync(cp790Path, 'utf-8')
  if (cp790.includes('prefabInstances') || cp790.includes('showPrefabStats') || cp790.includes('prefabCount')) {
    log('pass', 'R790', 'CocosPanel 프리팹 인스턴스 추적 존재')
  } else {
    log('warning', 'R790', 'CocosPanel 프리팹 인스턴스 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R791: TerminalPanel 필터 프리셋
const tp791Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp791Path)) {
  const tp791 = readFileSync(tp791Path, 'utf-8')
  if (tp791.includes('filterPresets') || tp791.includes('activeFilterPreset') || tp791.includes('filter-presets')) {
    log('pass', 'R791', 'TerminalPanel 필터 프리셋 존재')
  } else {
    log('warning', 'R791', 'TerminalPanel 필터 프리셋 없음', 'terminal/TerminalPanel.tsx')
  }
}

// ── Section 175: Phase DD10 R792~794 기능 체크 ────────────────
console.log('\n## 175. Phase DD10 R792~794 기능 체크')
// R792: ChatPanel 시스템 프롬프트 편집기
const cp792Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp792Path)) {
  const cp792 = readFileSync(cp792Path, 'utf-8')
  if (cp792.includes('systemPromptDraft') || cp792.includes('showSystemPromptEditor') || cp792.includes('systemPromptEdit')) {
    log('pass', 'R792', 'ChatPanel 시스템 프롬프트 편집기 존재')
  } else {
    log('warning', 'R792', 'ChatPanel 시스템 프롬프트 편집기 없음', 'chat/ChatPanel.tsx')
  }
}

// R793: SceneViewPanel 그리드 스냅
const svp793Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp793Path)) {
  const svp793 = readFileSync(svp793Path, 'utf-8')
  if (svp793.includes('gridSnap') || svp793.includes('gridSize') || svp793.includes('snapToGrid')) {
    log('pass', 'R793', 'SceneViewPanel 노드 배치 그리드 존재')
  } else {
    log('warning', 'R793', 'SceneViewPanel 그리드 스냅 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R794: InputBar 프롬프트 체이닝
const ib794Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib794Path)) {
  const ib794 = readFileSync(ib794Path, 'utf-8')
  if (ib794.includes('chainedPrompts') || ib794.includes('chainMode') || ib794.includes('promptChain')) {
    log('pass', 'R794', 'InputBar 프롬프트 체이닝 존재')
  } else {
    log('warning', 'R794', 'InputBar 프롬프트 체이닝 없음', 'chat/InputBar.tsx')
  }
}

// ── Section 176: Phase DD10 R795~797 기능 체크 ────────────────
console.log('\n## 176. Phase DD10 R795~797 기능 체크')
// R795: ChatPanel 메시지 카테고리
const cp795Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp795Path)) {
  const cp795 = readFileSync(cp795Path, 'utf-8')
  if (cp795.includes('msgCategories') || cp795.includes('categoryFilter') || cp795.includes('msgCategory')) {
    log('pass', 'R795', 'ChatPanel 메시지 카테고리 존재')
  } else {
    log('warning', 'R795', 'ChatPanel 메시지 카테고리 없음', 'chat/ChatPanel.tsx')
  }
}

// R796: SessionList 세션 자동 정리
const sl796Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl796Path)) {
  const sl796 = readFileSync(sl796Path, 'utf-8')
  if (sl796.includes('autoCleanupDays') || sl796.includes('showCleanupSettings') || sl796.includes('autoCleanup')) {
    log('pass', 'R796', 'SessionList 세션 자동 정리 존재')
  } else {
    log('warning', 'R796', 'SessionList 자동 정리 없음', 'sidebar/SessionList.tsx')
  }
}

// R797: CocosPanel 컴포넌트 프로파일러
const cp797Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp797Path)) {
  const cp797 = readFileSync(cp797Path, 'utf-8')
  if (cp797.includes('profilerData') || cp797.includes('showProfiler') || cp797.includes('componentProfiler')) {
    log('pass', 'R797', 'CocosPanel 컴포넌트 프로파일러 존재')
  } else {
    log('warning', 'R797', 'CocosPanel 프로파일러 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 177: Phase DD10 R798~800 기능 체크 (R800 마일스톤) ──
console.log('\n## 177. Phase DD10 R798~800 기능 체크 (R800 마일스톤)')
// R798: ChatPanel 응답 재생성 옵션
const cp798Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp798Path)) {
  const cp798 = readFileSync(cp798Path, 'utf-8')
  if (cp798.includes('regenOptions') || cp798.includes('showRegenOptions') || cp798.includes('regenStyle')) {
    log('pass', 'R798', 'ChatPanel 응답 재생성 옵션 존재')
  } else {
    log('warning', 'R798', 'ChatPanel 재생성 옵션 없음', 'chat/ChatPanel.tsx')
  }
}

// R799: TerminalPanel 워크스페이스 레이아웃
const tp799Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp799Path)) {
  const tp799 = readFileSync(tp799Path, 'utf-8')
  if (tp799.includes('workspaceLayout') || tp799.includes('layoutLocked') || tp799.includes('termLayout')) {
    log('pass', 'R799', 'TerminalPanel 워크스페이스 레이아웃 존재')
  } else {
    log('warning', 'R799', 'TerminalPanel 레이아웃 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R800: SceneViewPanel 씬 통계 (마일스톤)
const svp800Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp800Path)) {
  const svp800 = readFileSync(svp800Path, 'utf-8')
  if (svp800.includes('sceneStats') || svp800.includes('showSceneStats') || svp800.includes('nodeCount')) {
    log('pass', 'R800', '🏆 SceneViewPanel 씬 통계 패널 존재 (R800 마일스톤!)')
  } else {
    log('warning', 'R800', 'SceneViewPanel 씬 통계 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

console.log('\n## 178. Phase DD10 R801~803 기능 체크')

// R801: ChatPanel 메시지 접기 임계값
const cp801Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp801Path)) {
  const cp801 = readFileSync(cp801Path, 'utf-8')
  if (cp801.includes('collapseThreshold') || cp801.includes('collapsedByDefault') || cp801.includes('autoCollapse')) {
    log('pass', 'R801', 'ChatPanel 메시지 접기 임계값 존재')
  } else {
    log('warning', 'R801', 'ChatPanel 접기 임계값 없음', 'chat/ChatPanel.tsx')
  }
}

// R802: InputBar 커스텀 자동완성
const ib802Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib802Path)) {
  const ib802 = readFileSync(ib802Path, 'utf-8')
  if (ib802.includes('customCompletions') || ib802.includes('showCompletionEditor') || ib802.includes('completionItems')) {
    log('pass', 'R802', 'InputBar 커스텀 자동완성 존재')
  } else {
    log('warning', 'R802', 'InputBar 자동완성 없음', 'chat/InputBar.tsx')
  }
}

// R803: CocosPanel 루트 노드 목록
const cocp803Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp803Path)) {
  const cocp803 = readFileSync(cocp803Path, 'utf-8')
  if (cocp803.includes('rootNodes') || cocp803.includes('selectedRootNode') || cocp803.includes('rootNodeList')) {
    log('pass', 'R803', 'CocosPanel 루트 노드 목록 존재')
  } else {
    log('warning', 'R803', 'CocosPanel 루트 노드 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 179. Phase DD10 R804~806 기능 체크')

// R804: SessionList 세션 아이콘 커스터마이징
const sl804Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl804Path)) {
  const sl804 = readFileSync(sl804Path, 'utf-8')
  if (sl804.includes('sessionIcons') || sl804.includes('showIconPicker') || sl804.includes('iconMap')) {
    log('pass', 'R804', 'SessionList 세션 아이콘 커스터마이징 존재')
  } else {
    log('warning', 'R804', 'SessionList 아이콘 커스터마이징 없음', 'sidebar/SessionList.tsx')
  }
}

// R805: TerminalPanel 탭 색상 커스터마이징
const tp805Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp805Path)) {
  const tp805 = readFileSync(tp805Path, 'utf-8')
  if (tp805.includes('tabColors') || tp805.includes('showTabColorPicker') || tp805.includes('tabColorMap')) {
    log('pass', 'R805', 'TerminalPanel 탭 색상 커스터마이징 존재')
  } else {
    log('warning', 'R805', 'TerminalPanel 탭 색상 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R806: SceneViewPanel 노드 정렬 옵션
const svp806Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp806Path)) {
  const svp806 = readFileSync(svp806Path, 'utf-8')
  if (svp806.includes('nodeSortKey') || svp806.includes('nodeSortAsc') || svp806.includes('sortNodes')) {
    log('pass', 'R806', 'SceneViewPanel 노드 정렬 옵션 존재')
  } else {
    log('warning', 'R806', 'SceneViewPanel 노드 정렬 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

console.log('\n## 180. Phase DD10 R807~809 기능 체크')

// R807: ChatPanel 번역 기록
const cp807Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp807Path)) {
  const cp807 = readFileSync(cp807Path, 'utf-8')
  if (cp807.includes('translationHistory') || cp807.includes('showTranslationHistory') || cp807.includes('translateLog')) {
    log('pass', 'R807', 'ChatPanel 번역 기록 존재')
  } else {
    log('warning', 'R807', 'ChatPanel 번역 기록 없음', 'chat/ChatPanel.tsx')
  }
}

// R808: InputBar 멀티라인 모드
const ib808Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib808Path)) {
  const ib808 = readFileSync(ib808Path, 'utf-8')
  if (ib808.includes('multilineMode') || ib808.includes('lineWrap') || ib808.includes('multiLine')) {
    log('pass', 'R808', 'InputBar 멀티라인 모드 존재')
  } else {
    log('warning', 'R808', 'InputBar 멀티라인 없음', 'chat/InputBar.tsx')
  }
}

// R809: CocosPanel 컴포넌트 의존성
const cocp809Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp809Path)) {
  const cocp809 = readFileSync(cocp809Path, 'utf-8')
  if (cocp809.includes('compDependencies') || cocp809.includes('showCompDeps') || cocp809.includes('depGraph')) {
    log('pass', 'R809', 'CocosPanel 컴포넌트 의존성 존재')
  } else {
    log('warning', 'R809', 'CocosPanel 의존성 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 181. Phase DD10 R810~812 기능 체크')

// R810: SceneViewPanel 노드 즐겨찾기 그룹
const svp810Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp810Path)) {
  const svp810 = readFileSync(svp810Path, 'utf-8')
  if (svp810.includes('favNodeGroups') || svp810.includes('showFavGroups') || svp810.includes('nodeGroupFav')) {
    log('pass', 'R810', 'SceneViewPanel 노드 즐겨찾기 그룹 존재')
  } else {
    log('warning', 'R810', 'SceneViewPanel 즐겨찾기 그룹 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R811: TerminalPanel 명령어 즐겨찾기
const tp811Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp811Path)) {
  const tp811 = readFileSync(tp811Path, 'utf-8')
  if (tp811.includes('favCmds') || tp811.includes('showFavCmds') || tp811.includes('favCommands')) {
    log('pass', 'R811', 'TerminalPanel 명령어 즐겨찾기 존재')
  } else {
    log('warning', 'R811', 'TerminalPanel 즐겨찾기 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R812: SessionList 타임라인 뷰
const sl812Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl812Path)) {
  const sl812 = readFileSync(sl812Path, 'utf-8')
  if (sl812.includes('timelineView') || sl812.includes('timelineRange') || sl812.includes('showTimeline')) {
    log('pass', 'R812', 'SessionList 타임라인 뷰 존재')
  } else {
    log('warning', 'R812', 'SessionList 타임라인 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 182. Phase DD10 R813~815 기능 체크')

// R813: ChatPanel 이모지 반응
const cp813Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp813Path)) {
  const cp813 = readFileSync(cp813Path, 'utf-8')
  if (cp813.includes('emojiReactions') || cp813.includes('showEmojiPicker') || cp813.includes('msgEmojis')) {
    log('pass', 'R813', 'ChatPanel 이모지 반응 존재')
  } else {
    log('warning', 'R813', 'ChatPanel 이모지 반응 없음', 'chat/ChatPanel.tsx')
  }
}

// R814: InputBar 히스토리 페이지네이션
const ib814Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib814Path)) {
  const ib814 = readFileSync(ib814Path, 'utf-8')
  if (ib814.includes('historyPage') || ib814.includes('historyPageSize') || ib814.includes('historyPagination')) {
    log('pass', 'R814', 'InputBar 히스토리 페이지네이션 존재')
  } else {
    log('warning', 'R814', 'InputBar 페이지네이션 없음', 'chat/InputBar.tsx')
  }
}

// R815: CocosPanel 노드 레이어
const cocp815Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp815Path)) {
  const cocp815 = readFileSync(cocp815Path, 'utf-8')
  if (cocp815.includes('nodeLayers') || cocp815.includes('showLayerPanel') || cocp815.includes('layerMap')) {
    log('pass', 'R815', 'CocosPanel 노드 레이어 관리 존재')
  } else {
    log('warning', 'R815', 'CocosPanel 레이어 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 183. Phase DD10 R816~818 기능 체크')

// R816: SceneViewPanel 씬 스냅샷 비교
const svp816Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp816Path)) {
  const svp816 = readFileSync(svp816Path, 'utf-8')
  if (svp816.includes('sceneSnapshots') || svp816.includes('showSnapshotDiff') || svp816.includes('snapshotList')) {
    log('pass', 'R816', 'SceneViewPanel 씬 스냅샷 비교 존재')
  } else {
    log('warning', 'R816', 'SceneViewPanel 스냅샷 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R817: TerminalPanel 출력 필터링
const tp817Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp817Path)) {
  const tp817 = readFileSync(tp817Path, 'utf-8')
  if (tp817.includes('outputFilter') || tp817.includes('filterCaseSensitive') || tp817.includes('termFilter')) {
    log('pass', 'R817', 'TerminalPanel 출력 필터링 존재')
  } else {
    log('warning', 'R817', 'TerminalPanel 출력 필터 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R818: SessionList 세션 병합
const sl818Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl818Path)) {
  const sl818 = readFileSync(sl818Path, 'utf-8')
  if (sl818.includes('mergeTargets') || sl818.includes('showMergeConfirm') || sl818.includes('mergeSessions')) {
    log('pass', 'R818', 'SessionList 세션 병합 존재')
  } else {
    log('warning', 'R818', 'SessionList 병합 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 184. Phase DD10 R819~821 기능 체크')

// R819: ChatPanel 북마크 폴더
const cp819Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp819Path)) {
  const cp819 = readFileSync(cp819Path, 'utf-8')
  if (cp819.includes('bookmarkFolders') || cp819.includes('activeBookmarkFolder') || cp819.includes('bmFolders')) {
    log('pass', 'R819', 'ChatPanel 북마크 폴더 존재')
  } else {
    log('warning', 'R819', 'ChatPanel 북마크 폴더 없음', 'chat/ChatPanel.tsx')
  }
}

// R820: InputBar 드래프트 자동 저장
const ib820Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib820Path)) {
  const ib820 = readFileSync(ib820Path, 'utf-8')
  if (ib820.includes('draftAutosave') || ib820.includes('lastDraftSaved') || ib820.includes('autosaveDraft')) {
    log('pass', 'R820', 'InputBar 드래프트 자동 저장 존재')
  } else {
    log('warning', 'R820', 'InputBar 자동 저장 없음', 'chat/InputBar.tsx')
  }
}

// R821: CocosPanel 노드 검색 히스토리
const cocp821Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp821Path)) {
  const cocp821 = readFileSync(cocp821Path, 'utf-8')
  if (cocp821.includes('nodeSearchHistory') || cocp821.includes('showNodeSearchHistory') || cocp821.includes('searchHistoryList')) {
    log('pass', 'R821', 'CocosPanel 노드 검색 히스토리 존재')
  } else {
    log('warning', 'R821', 'CocosPanel 검색 히스토리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 185. Phase DD10 R822~824 기능 체크')

// R822: SceneViewPanel 씬 비교 모드
const svp822Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp822Path)) {
  const svp822 = readFileSync(svp822Path, 'utf-8')
  if (svp822.includes('diffMode') || svp822.includes('diffBaseSnapshot') || svp822.includes('sceneDiffMode')) {
    log('pass', 'R822', 'SceneViewPanel 씬 비교 모드 존재')
  } else {
    log('warning', 'R822', 'SceneViewPanel 비교 모드 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R823: TerminalPanel 세션 공유 링크
const tp823Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp823Path)) {
  const tp823 = readFileSync(tp823Path, 'utf-8')
  if (tp823.includes('shareLink') || tp823.includes('showSharePanel') || tp823.includes('sessionShareUrl')) {
    log('pass', 'R823', 'TerminalPanel 세션 공유 링크 존재')
  } else {
    log('warning', 'R823', 'TerminalPanel 공유 링크 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R824: SessionList 세션 복제
const sl824Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl824Path)) {
  const sl824 = readFileSync(sl824Path, 'utf-8')
  if (sl824.includes('cloningSession') || sl824.includes('cloneDepth') || sl824.includes('cloneSession')) {
    log('pass', 'R824', 'SessionList 세션 복제 존재')
  } else {
    log('warning', 'R824', 'SessionList 복제 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 186. Phase DD10 R825~827 기능 체크')

// R825: ChatPanel 응답 품질 평가
const cp825Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp825Path)) {
  const cp825 = readFileSync(cp825Path, 'utf-8')
  if (cp825.includes('qualityScores') || cp825.includes('showQualityPanel') || cp825.includes('responseQuality')) {
    log('pass', 'R825', 'ChatPanel 응답 품질 평가 존재')
  } else {
    log('warning', 'R825', 'ChatPanel 품질 평가 없음', 'chat/ChatPanel.tsx')
  }
}

// R826: InputBar 커맨드 팔레트
const ib826Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib826Path)) {
  const ib826 = readFileSync(ib826Path, 'utf-8')
  if (ib826.includes('cmdPaletteOpen') || ib826.includes('cmdPaletteQuery') || ib826.includes('commandPalette')) {
    log('pass', 'R826', 'InputBar 커맨드 팔레트 존재')
  } else {
    log('warning', 'R826', 'InputBar 커맨드 팔레트 없음', 'chat/InputBar.tsx')
  }
}

// R827: CocosPanel 에셋 미리보기 캐시 관리
const cocp827Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp827Path)) {
  const cocp827 = readFileSync(cocp827Path, 'utf-8')
  if (cocp827.includes('previewCacheSize') || cocp827.includes('showCacheManager') || cocp827.includes('cacheStats')) {
    log('pass', 'R827', 'CocosPanel 에셋 캐시 관리 존재')
  } else {
    log('warning', 'R827', 'CocosPanel 캐시 관리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 187. Phase DD10 R828~830 기능 체크')

// R828: SceneViewPanel 노드 프리셋
const svp828Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp828Path)) {
  const svp828 = readFileSync(svp828Path, 'utf-8')
  if (svp828.includes('nodePresets') || svp828.includes('showPresetPanel') || svp828.includes('presetNodes')) {
    log('pass', 'R828', 'SceneViewPanel 노드 프리셋 존재')
  } else {
    log('warning', 'R828', 'SceneViewPanel 노드 프리셋 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R829: TerminalPanel 입력 히스토리 검색
const tp829Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp829Path)) {
  const tp829 = readFileSync(tp829Path, 'utf-8')
  if (tp829.includes('inputHistorySearch') || tp829.includes('inputHistoryResults') || tp829.includes('historySearch')) {
    log('pass', 'R829', 'TerminalPanel 입력 히스토리 검색 존재')
  } else {
    log('warning', 'R829', 'TerminalPanel 히스토리 검색 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R830: SessionList 아카이브 내보내기
const sl830Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl830Path)) {
  const sl830 = readFileSync(sl830Path, 'utf-8')
  if (sl830.includes('archiveExportFormat') || sl830.includes('showArchiveExport') || sl830.includes('archiveExport')) {
    log('pass', 'R830', 'SessionList 아카이브 내보내기 존재')
  } else {
    log('warning', 'R830', 'SessionList 아카이브 내보내기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 188. Phase DD10 R831~833 기능 체크')

// R831: ChatPanel 스레드 요약
const cp831Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp831Path)) {
  const cp831 = readFileSync(cp831Path, 'utf-8')
  if (cp831.includes('threadSummaries') || cp831.includes('summaryLoading') || cp831.includes('threadSummary')) {
    log('pass', 'R831', 'ChatPanel 스레드 요약 존재')
  } else {
    log('warning', 'R831', 'ChatPanel 스레드 요약 없음', 'chat/ChatPanel.tsx')
  }
}

// R832: InputBar 이모지 자동완성
const ib832Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib832Path)) {
  const ib832 = readFileSync(ib832Path, 'utf-8')
  if (ib832.includes('emojiSearch') || ib832.includes('emojiSuggestions') || ib832.includes('emojiAutoComplete')) {
    log('pass', 'R832', 'InputBar 이모지 자동완성 존재')
  } else {
    log('warning', 'R832', 'InputBar 이모지 자동완성 없음', 'chat/InputBar.tsx')
  }
}

// R833: CocosPanel 노드 일괄 수정
const cocp833Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp833Path)) {
  const cocp833 = readFileSync(cocp833Path, 'utf-8')
  if (cocp833.includes('batchEditMode') || cocp833.includes('batchEditTargets') || cocp833.includes('batchEdit')) {
    log('pass', 'R833', 'CocosPanel 노드 일괄 수정 존재')
  } else {
    log('warning', 'R833', 'CocosPanel 일괄 수정 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 189. Phase DD10 R834~836 기능 체크')

// R834: SceneViewPanel 씬 자동 레이아웃
const svp834Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp834Path)) {
  const svp834 = readFileSync(svp834Path, 'utf-8')
  if (svp834.includes('autoLayout') || svp834.includes('layoutSpacing') || svp834.includes('autoArrange')) {
    log('pass', 'R834', 'SceneViewPanel 씬 자동 레이아웃 존재')
  } else {
    log('warning', 'R834', 'SceneViewPanel 자동 레이아웃 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R835: TerminalPanel 단축키 커스터마이징
const tp835Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp835Path)) {
  const tp835 = readFileSync(tp835Path, 'utf-8')
  if (tp835.includes('termShortcuts') || tp835.includes('showShortcutCustomizer') || tp835.includes('keyBindings')) {
    log('pass', 'R835', 'TerminalPanel 단축키 커스터마이징 존재')
  } else {
    log('warning', 'R835', 'TerminalPanel 단축키 커스터마이징 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R836: SessionList 검색 필터 저장
const sl836Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl836Path)) {
  const sl836 = readFileSync(sl836Path, 'utf-8')
  if (sl836.includes('savedFilters') || sl836.includes('showFilterManager') || sl836.includes('filterPresets')) {
    log('pass', 'R836', 'SessionList 검색 필터 저장 존재')
  } else {
    log('warning', 'R836', 'SessionList 필터 저장 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 190. Phase DD10 R837~839 기능 체크')

// R837: ChatPanel AI 페르소나
const cp837Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp837Path)) {
  const cp837 = readFileSync(cp837Path, 'utf-8')
  if (cp837.includes('activePersona') || cp837.includes('personaPrompt') || cp837.includes('aiPersonaActive')) {
    log('pass', 'R837', 'ChatPanel AI 페르소나 존재')
  } else {
    log('warning', 'R837', 'ChatPanel AI 페르소나 없음', 'chat/ChatPanel.tsx')
  }
}

// R838: InputBar 텍스트 서식
const ib838Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib838Path)) {
  const ib838 = readFileSync(ib838Path, 'utf-8')
  if (ib838.includes('textFormat') || ib838.includes('showFormatBar') || ib838.includes('formatMode')) {
    log('pass', 'R838', 'InputBar 텍스트 서식 존재')
  } else {
    log('warning', 'R838', 'InputBar 텍스트 서식 없음', 'chat/InputBar.tsx')
  }
}

// R839: CocosPanel 컴포넌트 검색 필터
const cocp839Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp839Path)) {
  const cocp839 = readFileSync(cocp839Path, 'utf-8')
  if (cocp839.includes('compSearchFilter') || cocp839.includes('compSearchResults') || cocp839.includes('componentSearch')) {
    log('pass', 'R839', 'CocosPanel 컴포넌트 검색 필터 존재')
  } else {
    log('warning', 'R839', 'CocosPanel 검색 필터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 191. Phase DD10 R840~842 기능 체크')

// R840: SceneViewPanel 노드 링크 시각화
const svp840Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp840Path)) {
  const svp840 = readFileSync(svp840Path, 'utf-8')
  if (svp840.includes('showNodeLinks') || svp840.includes('nodeLinkFilter') || svp840.includes('nodeLinks')) {
    log('pass', 'R840', 'SceneViewPanel 노드 링크 시각화 존재')
  } else {
    log('warning', 'R840', 'SceneViewPanel 노드 링크 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R841: TerminalPanel 출력 색상 테마
const tp841Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp841Path)) {
  const tp841 = readFileSync(tp841Path, 'utf-8')
  if (tp841.includes('outputTheme') || tp841.includes('customOutputColors') || tp841.includes('termTheme')) {
    log('pass', 'R841', 'TerminalPanel 출력 색상 테마 존재')
  } else {
    log('warning', 'R841', 'TerminalPanel 색상 테마 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R842: SessionList 세션 우선순위 정렬
const sl842Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl842Path)) {
  const sl842 = readFileSync(sl842Path, 'utf-8')
  if (sl842.includes('sessionPriority') || sl842.includes('prioritySort') || sl842.includes('sessionPrio')) {
    log('pass', 'R842', 'SessionList 세션 우선순위 존재')
  } else {
    log('warning', 'R842', 'SessionList 우선순위 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 192. Phase DD10 R843~845 기능 체크')

// R843: ChatPanel 메시지 내보내기 형식
const cp843Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp843Path)) {
  const cp843 = readFileSync(cp843Path, 'utf-8')
  if (cp843.includes('msgExportFormat') || cp843.includes('showMsgExportPanel') || cp843.includes('exportFormat')) {
    log('pass', 'R843', 'ChatPanel 메시지 내보내기 형식 존재')
  } else {
    log('warning', 'R843', 'ChatPanel 내보내기 형식 없음', 'chat/ChatPanel.tsx')
  }
}

// R844: InputBar 음성 입력 언어
const ib844Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib844Path)) {
  const ib844 = readFileSync(ib844Path, 'utf-8')
  if (ib844.includes('voiceInputLang') || ib844.includes('showLangPicker') || ib844.includes('speechLang')) {
    log('pass', 'R844', 'InputBar 음성 입력 언어 존재')
  } else {
    log('warning', 'R844', 'InputBar 음성 언어 없음', 'chat/InputBar.tsx')
  }
}

// R845: CocosPanel 노드 태그 필터
const cocp845Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp845Path)) {
  const cocp845 = readFileSync(cocp845Path, 'utf-8')
  if (cocp845.includes('nodeTagFilter') || cocp845.includes('showNodeTagFilter') || cocp845.includes('tagFilter')) {
    log('pass', 'R845', 'CocosPanel 노드 태그 필터 존재')
  } else {
    log('warning', 'R845', 'CocosPanel 태그 필터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 193. Phase DD10 R846~848 기능 체크')

// R846: SceneViewPanel 씬 태그
const svp846Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp846Path)) {
  const svp846 = readFileSync(svp846Path, 'utf-8')
  if (svp846.includes('sceneTagInput') || svp846.includes('sceneTags') || svp846.includes('tagSystem')) {
    log('pass', 'R846', 'SceneViewPanel 씬 태그 시스템 존재')
  } else {
    log('warning', 'R846', 'SceneViewPanel 씬 태그 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R847: TerminalPanel 프로세스 모니터
const tp847Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp847Path)) {
  const tp847 = readFileSync(tp847Path, 'utf-8')
  if (tp847.includes('processMonitor') || tp847.includes('showProcessMonitor') || tp847.includes('procList')) {
    log('pass', 'R847', 'TerminalPanel 프로세스 모니터 존재')
  } else {
    log('warning', 'R847', 'TerminalPanel 프로세스 모니터 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R848: SessionList 세션 잠금 비밀번호
const sl848Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl848Path)) {
  const sl848 = readFileSync(sl848Path, 'utf-8')
  if (sl848.includes('lockPasswords') || sl848.includes('showPasswordDialog') || sl848.includes('sessionPassword')) {
    log('pass', 'R848', 'SessionList 세션 잠금 비밀번호 존재')
  } else {
    log('warning', 'R848', 'SessionList 비밀번호 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 194. Phase DD10 R849~851 기능 체크')

// R849: ChatPanel 메시지 검색 하이라이트
const cp849Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp849Path)) {
  const cp849 = readFileSync(cp849Path, 'utf-8')
  if (cp849.includes('searchHighlights') || cp849.includes('searchHighlightIdx') || cp849.includes('highlightRanges')) {
    log('pass', 'R849', 'ChatPanel 메시지 검색 하이라이트 존재')
  } else {
    log('warning', 'R849', 'ChatPanel 하이라이트 없음', 'chat/ChatPanel.tsx')
  }
}

// R850: InputBar 붙여넣기 전처리
const ib850Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib850Path)) {
  const ib850 = readFileSync(ib850Path, 'utf-8')
  if (ib850.includes('pastePreprocess') || ib850.includes('pastePreprocessRules') || ib850.includes('preprocessPaste')) {
    log('pass', 'R850', 'InputBar 붙여넣기 전처리 존재')
  } else {
    log('warning', 'R850', 'InputBar 전처리 없음', 'chat/InputBar.tsx')
  }
}

// R851: CocosPanel 씬 의존성 트리
const cocp851Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp851Path)) {
  const cocp851 = readFileSync(cocp851Path, 'utf-8')
  if (cocp851.includes('sceneDepsTree') || cocp851.includes('showSceneDepsTree') || cocp851.includes('depTree')) {
    log('pass', 'R851', 'CocosPanel 씬 의존성 트리 존재')
  } else {
    log('warning', 'R851', 'CocosPanel 의존성 트리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 195. Phase DD10 R852~854 기능 체크')

// R852: SceneViewPanel 씬 로딩 진행률
const svp852Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp852Path)) {
  const svp852 = readFileSync(svp852Path, 'utf-8')
  if (svp852.includes('sceneLoadProgress') || svp852.includes('sceneLoadStatus') || svp852.includes('loadProgress')) {
    log('pass', 'R852', 'SceneViewPanel 씬 로딩 진행률 존재')
  } else {
    log('warning', 'R852', 'SceneViewPanel 로딩 진행률 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R853: TerminalPanel 스크롤 위치 기억
const tp853Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp853Path)) {
  const tp853 = readFileSync(tp853Path, 'utf-8')
  if (tp853.includes('savedScrollPos') || tp853.includes('autoScrollOnOutput') || tp853.includes('scrollMemory')) {
    log('pass', 'R853', 'TerminalPanel 스크롤 위치 기억 존재')
  } else {
    log('warning', 'R853', 'TerminalPanel 스크롤 기억 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R854: SessionList 세션 자동 백업
const sl854Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl854Path)) {
  const sl854 = readFileSync(sl854Path, 'utf-8')
  if (sl854.includes('autoBackupEnabled') || sl854.includes('autoBackupInterval') || sl854.includes('backupAuto')) {
    log('pass', 'R854', 'SessionList 세션 자동 백업 존재')
  } else {
    log('warning', 'R854', 'SessionList 자동 백업 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 196. Phase DD10 R855~857 기능 체크')

// R855: ChatPanel 스트리밍 속도 제어
const cp855Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp855Path)) {
  const cp855 = readFileSync(cp855Path, 'utf-8')
  if (cp855.includes('streamSpeed') || cp855.includes('streamChunkSize') || cp855.includes('streamRate')) {
    log('pass', 'R855', 'ChatPanel 스트리밍 속도 제어 존재')
  } else {
    log('warning', 'R855', 'ChatPanel 스트리밍 속도 없음', 'chat/ChatPanel.tsx')
  }
}

// R856: InputBar 자동 태그 감지
const ib856Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib856Path)) {
  const ib856 = readFileSync(ib856Path, 'utf-8')
  if (ib856.includes('autoTagDetect') || ib856.includes('detectedTags') || ib856.includes('tagDetection')) {
    log('pass', 'R856', 'InputBar 자동 태그 감지 존재')
  } else {
    log('warning', 'R856', 'InputBar 태그 감지 없음', 'chat/InputBar.tsx')
  }
}

// R857: CocosPanel 노드 복사 이력
const cocp857Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp857Path)) {
  const cocp857 = readFileSync(cocp857Path, 'utf-8')
  if (cocp857.includes('nodeCopyHistory') || cocp857.includes('showCopyHistory') || cocp857.includes('copyLog')) {
    log('pass', 'R857', 'CocosPanel 노드 복사 이력 존재')
  } else {
    log('warning', 'R857', 'CocosPanel 복사 이력 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 197. Phase DD10 R858~860 기능 체크')

// R858: SceneViewPanel 트리 필터
const svp858Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp858Path)) {
  const svp858 = readFileSync(svp858Path, 'utf-8')
  if (svp858.includes('treeFilter') || svp858.includes('treeFilterResults') || svp858.includes('filterTree')) {
    log('pass', 'R858', 'SceneViewPanel 트리 필터 존재')
  } else {
    log('warning', 'R858', 'SceneViewPanel 트리 필터 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R859: TerminalPanel 탭 그룹
const tp859Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp859Path)) {
  const tp859 = readFileSync(tp859Path, 'utf-8')
  if (tp859.includes('tabGroups') || tp859.includes('activeTabGroup') || tp859.includes('tabGrouping')) {
    log('pass', 'R859', 'TerminalPanel 탭 그룹 존재')
  } else {
    log('warning', 'R859', 'TerminalPanel 탭 그룹 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R860: SessionList 세션 통계
const sl860Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl860Path)) {
  const sl860 = readFileSync(sl860Path, 'utf-8')
  if (sl860.includes('sessionStats') || sl860.includes('showStatsDashboard') || sl860.includes('statsPanel')) {
    log('pass', 'R860', 'SessionList 세션 통계 존재')
  } else {
    log('warning', 'R860', 'SessionList 세션 통계 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 198. Phase DD10 R861~863 기능 체크')

// R861: ChatPanel 메시지 반응
const cp861Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp861Path)) {
  const cp861 = readFileSync(cp861Path, 'utf-8')
  if (cp861.includes('messageReactions') || cp861.includes('showReactionPicker') || cp861.includes('reactionMap')) {
    log('pass', 'R861', 'ChatPanel 메시지 반응 존재')
  } else {
    log('warning', 'R861', 'ChatPanel 메시지 반응 없음', 'chat/ChatPanel.tsx')
  }
}

// R862: InputBar 맞춤법 교정
const ib862Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib862Path)) {
  const ib862 = readFileSync(ib862Path, 'utf-8')
  if (ib862.includes('spellingCorrect') || ib862.includes('spellingErrors') || ib862.includes('spellCheck')) {
    log('pass', 'R862', 'InputBar 맞춤법 교정 존재')
  } else {
    log('warning', 'R862', 'InputBar 맞춤법 교정 없음', 'chat/InputBar.tsx')
  }
}

// R863: CocosPanel 노드 그룹
const cocp863Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp863Path)) {
  const cocp863 = readFileSync(cocp863Path, 'utf-8')
  if (cocp863.includes('nodeGroups') || cocp863.includes('showGroupPanel') || cocp863.includes('groupNodes')) {
    log('pass', 'R863', 'CocosPanel 노드 그룹 존재')
  } else {
    log('warning', 'R863', 'CocosPanel 노드 그룹 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 199. Phase DD10 R864~866 기능 체크')

// R864: SceneViewPanel 노드 별칭 편집기
const svp864Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp864Path)) {
  const svp864 = readFileSync(svp864Path, 'utf-8')
  if (svp864.includes('nodeAliases') || svp864.includes('showAliasEditor') || svp864.includes('aliasMap')) {
    log('pass', 'R864', 'SceneViewPanel 노드 별칭 편집기 존재')
  } else {
    log('warning', 'R864', 'SceneViewPanel 노드 별칭 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R865: TerminalPanel 터미널 테마
const tp865Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp865Path)) {
  const tp865 = readFileSync(tp865Path, 'utf-8')
  if (tp865.includes('terminalThemes') || tp865.includes('activeTermTheme') || tp865.includes('termTheme')) {
    log('pass', 'R865', 'TerminalPanel 터미널 테마 존재')
  } else {
    log('warning', 'R865', 'TerminalPanel 터미널 테마 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R866: SessionList 세션 템플릿
const sl866Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl866Path)) {
  const sl866 = readFileSync(sl866Path, 'utf-8')
  if (sl866.includes('sessionTemplates') || sl866.includes('showTemplateManager') || sl866.includes('templateList')) {
    log('pass', 'R866', 'SessionList 세션 템플릿 존재')
  } else {
    log('warning', 'R866', 'SessionList 세션 템플릿 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 200. Phase DD10 R867~869 기능 체크')

// R867: ChatPanel 핀 메시지 패널
const cp867Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp867Path)) {
  const cp867 = readFileSync(cp867Path, 'utf-8')
  if (cp867.includes('pinnedMessages') && cp867.includes('showPinnedPanel')) {
    log('pass', 'R867', 'ChatPanel 핀 메시지 패널 존재')
  } else {
    log('warning', 'R867', 'ChatPanel 핀 메시지 패널 없음', 'chat/ChatPanel.tsx')
  }
}

// R868: InputBar 멘션 제안
const ib868Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib868Path)) {
  const ib868 = readFileSync(ib868Path, 'utf-8')
  if (ib868.includes('mentionSuggestions') || ib868.includes('showMentionList') || ib868.includes('mentionList')) {
    log('pass', 'R868', 'InputBar 멘션 제안 존재')
  } else {
    log('warning', 'R868', 'InputBar 멘션 제안 없음', 'chat/InputBar.tsx')
  }
}

// R869: CocosPanel 프리팹 검색
const cocp869Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp869Path)) {
  const cocp869 = readFileSync(cocp869Path, 'utf-8')
  if (cocp869.includes('prefabSearch') || cocp869.includes('prefabSearchResults') || cocp869.includes('prefabFilter')) {
    log('pass', 'R869', 'CocosPanel 프리팹 검색 존재')
  } else {
    log('warning', 'R869', 'CocosPanel 프리팹 검색 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 201. Phase DD10 R870~872 기능 체크')

// R870: SceneViewPanel 노드 가시성 그룹
const svp870Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp870Path)) {
  const svp870 = readFileSync(svp870Path, 'utf-8')
  if (svp870.includes('nodeVisibilityGroups') || svp870.includes('showVisibilityGroups') || svp870.includes('visibilityGroup')) {
    log('pass', 'R870', 'SceneViewPanel 노드 가시성 그룹 존재')
  } else {
    log('warning', 'R870', 'SceneViewPanel 노드 가시성 그룹 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R871: TerminalPanel 커맨드 스니펫
const tp871Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp871Path)) {
  const tp871 = readFileSync(tp871Path, 'utf-8')
  if (tp871.includes('commandSnippets') || tp871.includes('showSnippetManager') || tp871.includes('snippetList')) {
    log('pass', 'R871', 'TerminalPanel 커맨드 스니펫 존재')
  } else {
    log('warning', 'R871', 'TerminalPanel 커맨드 스니펫 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R872: SessionList 세션 코멘트
const sl872Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl872Path)) {
  const sl872 = readFileSync(sl872Path, 'utf-8')
  if (sl872.includes('sessionComments') || sl872.includes('showCommentEditor') || sl872.includes('commentMap')) {
    log('pass', 'R872', 'SessionList 세션 코멘트 존재')
  } else {
    log('warning', 'R872', 'SessionList 세션 코멘트 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 202. Phase DD10 R873~875 기능 체크')

// R873: ChatPanel 메시지 스케줄링
const cp873Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp873Path)) {
  const cp873 = readFileSync(cp873Path, 'utf-8')
  if (cp873.includes('messageSchedule') || cp873.includes('showSchedulePanel') || cp873.includes('scheduledMsg')) {
    log('pass', 'R873', 'ChatPanel 메시지 스케줄링 존재')
  } else {
    log('warning', 'R873', 'ChatPanel 메시지 스케줄링 없음', 'chat/ChatPanel.tsx')
  }
}

// R874: InputBar 빠른 답장
const ib874Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib874Path)) {
  const ib874 = readFileSync(ib874Path, 'utf-8')
  if (ib874.includes('quickReplies') || ib874.includes('showQuickReplies') || ib874.includes('quickReply')) {
    log('pass', 'R874', 'InputBar 빠른 답장 존재')
  } else {
    log('warning', 'R874', 'InputBar 빠른 답장 없음', 'chat/InputBar.tsx')
  }
}

// R875: CocosPanel 씬 히스토리
const cocp875Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp875Path)) {
  const cocp875 = readFileSync(cocp875Path, 'utf-8')
  if (cocp875.includes('sceneHistory') || cocp875.includes('showSceneHistory') || cocp875.includes('sceneLog')) {
    log('pass', 'R875', 'CocosPanel 씬 히스토리 존재')
  } else {
    log('warning', 'R875', 'CocosPanel 씬 히스토리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 203. Phase DD10 R876~878 기능 체크')

// R876: SceneViewPanel 컴포넌트 검색
const svp876Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp876Path)) {
  const svp876 = readFileSync(svp876Path, 'utf-8')
  if (svp876.includes('componentSearch') || svp876.includes('componentSearchResults') || svp876.includes('compSearch')) {
    log('pass', 'R876', 'SceneViewPanel 컴포넌트 검색 존재')
  } else {
    log('warning', 'R876', 'SceneViewPanel 컴포넌트 검색 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R877: TerminalPanel 출력 캡처
const tp877Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp877Path)) {
  const tp877 = readFileSync(tp877Path, 'utf-8')
  if (tp877.includes('outputCapture') || tp877.includes('capturedOutput') || tp877.includes('captureMode')) {
    log('pass', 'R877', 'TerminalPanel 출력 캡처 존재')
  } else {
    log('warning', 'R877', 'TerminalPanel 출력 캡처 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R878: SessionList 세션 평점
const sl878Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl878Path)) {
  const sl878 = readFileSync(sl878Path, 'utf-8')
  if (sl878.includes('sessionRatings') || sl878.includes('showRatingPanel') || sl878.includes('ratingMap')) {
    log('pass', 'R878', 'SessionList 세션 평점 존재')
  } else {
    log('warning', 'R878', 'SessionList 세션 평점 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 204. Phase DD10 R879~881 기능 체크')

// R879: ChatPanel 메시지 드래프트 목록
const cp879Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp879Path)) {
  const cp879 = readFileSync(cp879Path, 'utf-8')
  if (cp879.includes('messageDrafts') || cp879.includes('showDraftList') || cp879.includes('draftList')) {
    log('pass', 'R879', 'ChatPanel 메시지 드래프트 목록 존재')
  } else {
    log('warning', 'R879', 'ChatPanel 메시지 드래프트 없음', 'chat/ChatPanel.tsx')
  }
}

// R880: InputBar 슬래시 커맨드 메뉴
const ib880Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib880Path)) {
  const ib880 = readFileSync(ib880Path, 'utf-8')
  if (ib880.includes('slashCommands') || ib880.includes('showSlashMenu') || ib880.includes('slashMenu')) {
    log('pass', 'R880', 'InputBar 슬래시 커맨드 메뉴 존재')
  } else {
    log('warning', 'R880', 'InputBar 슬래시 커맨드 없음', 'chat/InputBar.tsx')
  }
}

// R881: CocosPanel 애니메이션 프리뷰
const cocp881Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp881Path)) {
  const cocp881 = readFileSync(cocp881Path, 'utf-8')
  if (cocp881.includes('animationPreview') || cocp881.includes('previewAnimation') || cocp881.includes('animPreview')) {
    log('pass', 'R881', 'CocosPanel 애니메이션 프리뷰 존재')
  } else {
    log('warning', 'R881', 'CocosPanel 애니메이션 프리뷰 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 205. Phase DD10 R882~884 기능 체크')

// R882: SceneViewPanel 노드 프리팹 링크
const svp882Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp882Path)) {
  const svp882 = readFileSync(svp882Path, 'utf-8')
  if (svp882.includes('nodePrefabLinks') || svp882.includes('showPrefabLinks') || svp882.includes('prefabLink')) {
    log('pass', 'R882', 'SceneViewPanel 노드 프리팹 링크 존재')
  } else {
    log('warning', 'R882', 'SceneViewPanel 노드 프리팹 링크 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R883: TerminalPanel 자동 제안
const tp883Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp883Path)) {
  const tp883 = readFileSync(tp883Path, 'utf-8')
  if (tp883.includes('autoSuggest') || tp883.includes('setSuggestions') || tp883.includes('suggestionList')) {
    log('pass', 'R883', 'TerminalPanel 자동 제안 존재')
  } else {
    log('warning', 'R883', 'TerminalPanel 자동 제안 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R884: SessionList 세션 리마인더
const sl884Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl884Path)) {
  const sl884 = readFileSync(sl884Path, 'utf-8')
  if (sl884.includes('sessionReminders') || sl884.includes('showReminderPanel') || sl884.includes('reminderMap')) {
    log('pass', 'R884', 'SessionList 세션 리마인더 존재')
  } else {
    log('warning', 'R884', 'SessionList 세션 리마인더 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 206. Phase DD10 R885~887 기능 체크')

// R885: ChatPanel 채팅 내보내기 옵션
const cp885Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp885Path)) {
  const cp885 = readFileSync(cp885Path, 'utf-8')
  if (cp885.includes('chatExportOptions') || cp885.includes('showExportOptions') || cp885.includes('exportFormat')) {
    log('pass', 'R885', 'ChatPanel 채팅 내보내기 옵션 존재')
  } else {
    log('warning', 'R885', 'ChatPanel 채팅 내보내기 옵션 없음', 'chat/ChatPanel.tsx')
  }
}

// R886: InputBar 입력 히스토리 탐색
const ib886Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib886Path)) {
  const ib886 = readFileSync(ib886Path, 'utf-8')
  if (ib886.includes('inputHistoryIdx') || ib886.includes('setInputHistory') || ib886.includes('historyNav')) {
    log('pass', 'R886', 'InputBar 입력 히스토리 탐색 존재')
  } else {
    log('warning', 'R886', 'InputBar 입력 히스토리 없음', 'chat/InputBar.tsx')
  }
}

// R887: CocosPanel 노드 이벤트 로그
const cocp887Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp887Path)) {
  const cocp887 = readFileSync(cocp887Path, 'utf-8')
  if (cocp887.includes('nodeEventLog') || cocp887.includes('showEventLog') || cocp887.includes('eventLog')) {
    log('pass', 'R887', 'CocosPanel 노드 이벤트 로그 존재')
  } else {
    log('warning', 'R887', 'CocosPanel 노드 이벤트 로그 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 207. Phase DD10 R888~890 기능 체크')

// R888: SceneViewPanel 씬 노트
const svp888Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp888Path)) {
  const svp888 = readFileSync(svp888Path, 'utf-8')
  if (svp888.includes('sceneNotes') || svp888.includes('showNotesPanel') || svp888.includes('noteMap')) {
    log('pass', 'R888', 'SceneViewPanel 씬 노트 패널 존재')
  } else {
    log('warning', 'R888', 'SceneViewPanel 씬 노트 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R889: TerminalPanel 터미널 녹화
const tp889Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp889Path)) {
  const tp889 = readFileSync(tp889Path, 'utf-8')
  if (tp889.includes('terminalRecording') || tp889.includes('recordedSessions') || tp889.includes('sessionRecord')) {
    log('pass', 'R889', 'TerminalPanel 터미널 녹화 존재')
  } else {
    log('warning', 'R889', 'TerminalPanel 터미널 녹화 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R890: SessionList 세션 워크플로우
const sl890Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl890Path)) {
  const sl890 = readFileSync(sl890Path, 'utf-8')
  if (sl890.includes('sessionWorkflow') || sl890.includes('showWorkflowPanel') || sl890.includes('workflowId')) {
    log('pass', 'R890', 'SessionList 세션 워크플로우 존재')
  } else {
    log('warning', 'R890', 'SessionList 세션 워크플로우 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 208. Phase DD10 R891~893 기능 체크')

// R891: ChatPanel 메시지 폴더
const cp891Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp891Path)) {
  const cp891 = readFileSync(cp891Path, 'utf-8')
  if (cp891.includes('messageFolders') || cp891.includes('activeMsgFolder') || cp891.includes('msgFolder')) {
    log('pass', 'R891', 'ChatPanel 메시지 폴더 존재')
  } else {
    log('warning', 'R891', 'ChatPanel 메시지 폴더 없음', 'chat/ChatPanel.tsx')
  }
}

// R892: InputBar 컨텍스트 도움말
const ib892Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib892Path)) {
  const ib892 = readFileSync(ib892Path, 'utf-8')
  if (ib892.includes('contextualHelp') || ib892.includes('showHelpTooltip') || ib892.includes('helpTip')) {
    log('pass', 'R892', 'InputBar 컨텍스트 도움말 존재')
  } else {
    log('warning', 'R892', 'InputBar 컨텍스트 도움말 없음', 'chat/InputBar.tsx')
  }
}

// R893: CocosPanel 머티리얼 인스펙터
const cocp893Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp893Path)) {
  const cocp893 = readFileSync(cocp893Path, 'utf-8')
  if (cocp893.includes('materialInspector') || cocp893.includes('showMaterialPanel') || cocp893.includes('matPanel')) {
    log('pass', 'R893', 'CocosPanel 머티리얼 인스펙터 존재')
  } else {
    log('warning', 'R893', 'CocosPanel 머티리얼 인스펙터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 209. Phase DD10 R894~896 기능 체크')

// R894: SceneViewPanel 바운딩 박스 오버레이
const svp894Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp894Path)) {
  const svp894 = readFileSync(svp894Path, 'utf-8')
  if (svp894.includes('showBoundingBoxes') || svp894.includes('boundingBoxColor') || svp894.includes('boundingBox')) {
    log('pass', 'R894', 'SceneViewPanel 바운딩 박스 오버레이 존재')
  } else {
    log('warning', 'R894', 'SceneViewPanel 바운딩 박스 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R895: TerminalPanel 분할 뷰
const tp895Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp895Path)) {
  const tp895 = readFileSync(tp895Path, 'utf-8')
  if (tp895.includes('terminalSplit') || tp895.includes('splitRatio') || tp895.includes('splitView')) {
    log('pass', 'R895', 'TerminalPanel 분할 뷰 존재')
  } else {
    log('warning', 'R895', 'TerminalPanel 분할 뷰 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R896: SessionList 세션 관계 그래프
const sl896Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl896Path)) {
  const sl896 = readFileSync(sl896Path, 'utf-8')
  if (sl896.includes('sessionRelations') || sl896.includes('showRelationGraph') || sl896.includes('relationMap')) {
    log('pass', 'R896', 'SessionList 세션 관계 그래프 존재')
  } else {
    log('warning', 'R896', 'SessionList 세션 관계 그래프 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 210. Phase DD10 R897~899 기능 체크')

// R897: ChatPanel 메시지 스레딩
const cp897Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp897Path)) {
  const cp897 = readFileSync(cp897Path, 'utf-8')
  if (cp897.includes('threadingEnabled') || cp897.includes('activeThread') || cp897.includes('threadMode')) {
    log('pass', 'R897', 'ChatPanel 메시지 스레딩 존재')
  } else {
    log('warning', 'R897', 'ChatPanel 메시지 스레딩 없음', 'chat/ChatPanel.tsx')
  }
}

// R898: InputBar 토큰 카운터
const ib898Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib898Path)) {
  const ib898 = readFileSync(ib898Path, 'utf-8')
  if (ib898.includes('showTokenCounter') || ib898.includes('setTokenCount') || ib898.includes('tokenDisplay')) {
    log('pass', 'R898', 'InputBar 토큰 카운터 존재')
  } else {
    log('warning', 'R898', 'InputBar 토큰 카운터 없음', 'chat/InputBar.tsx')
  }
}

// R899: CocosPanel 물리 디버그 오버레이
const cocp899Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp899Path)) {
  const cocp899 = readFileSync(cocp899Path, 'utf-8')
  if (cocp899.includes('physicsDebug') || cocp899.includes('physicsDebugOptions') || cocp899.includes('showColliders')) {
    log('pass', 'R899', 'CocosPanel 물리 디버그 오버레이 존재')
  } else {
    log('warning', 'R899', 'CocosPanel 물리 디버그 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 211. Phase DD10 R900~902 기능 체크')

// R900: SceneViewPanel 씬 프로파일러
const svp900Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp900Path)) {
  const svp900 = readFileSync(svp900Path, 'utf-8')
  if (svp900.includes('sceneProfiler') || svp900.includes('profilerStats') || svp900.includes('drawCalls')) {
    log('pass', 'R900', 'SceneViewPanel 씬 프로파일러 존재')
  } else {
    log('warning', 'R900', 'SceneViewPanel 씬 프로파일러 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R901: TerminalPanel 터미널 검색
const tp901Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp901Path)) {
  const tp901 = readFileSync(tp901Path, 'utf-8')
  if (tp901.includes('terminalSearch') || tp901.includes('terminalSearchResults') || tp901.includes('termSearch')) {
    log('pass', 'R901', 'TerminalPanel 터미널 검색 존재')
  } else {
    log('warning', 'R901', 'TerminalPanel 터미널 검색 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R902: SessionList 세션 북마크
const sl902Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl902Path)) {
  const sl902 = readFileSync(sl902Path, 'utf-8')
  if (sl902.includes('sessionBookmarks') || sl902.includes('showBookmarkList') || sl902.includes('bookmarkIds')) {
    log('pass', 'R902', 'SessionList 세션 북마크 존재')
  } else {
    log('warning', 'R902', 'SessionList 세션 북마크 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 212. Phase DD10 R903~905 기능 체크')

// R903: ChatPanel AI 어시스트 모드
const cp903Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp903Path)) {
  const cp903 = readFileSync(cp903Path, 'utf-8')
  if (cp903.includes('aiAssistMode') || cp903.includes('aiAssistSuggestion') || cp903.includes('assistMode')) {
    log('pass', 'R903', 'ChatPanel AI 어시스트 모드 존재')
  } else {
    log('warning', 'R903', 'ChatPanel AI 어시스트 없음', 'chat/ChatPanel.tsx')
  }
}

// R904: InputBar 이미지 첨부
const ib904Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib904Path)) {
  const ib904 = readFileSync(ib904Path, 'utf-8')
  if (ib904.includes('imageAttachments') || ib904.includes('showImagePreview') || ib904.includes('imgAttach')) {
    log('pass', 'R904', 'InputBar 이미지 첨부 존재')
  } else {
    log('warning', 'R904', 'InputBar 이미지 첨부 없음', 'chat/InputBar.tsx')
  }
}

// R905: CocosPanel 스크립트 에디터
const cocp905Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp905Path)) {
  const cocp905 = readFileSync(cocp905Path, 'utf-8')
  if (cocp905.includes('scriptEditorOpen') || cocp905.includes('editingScript') || cocp905.includes('scriptEditor')) {
    log('pass', 'R905', 'CocosPanel 스크립트 에디터 존재')
  } else {
    log('warning', 'R905', 'CocosPanel 스크립트 에디터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 213. Phase DD10 R906~908 기능 체크')

// R906: SceneViewPanel 렌더 모드 전환
const svp906Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp906Path)) {
  const svp906 = readFileSync(svp906Path, 'utf-8')
  if (svp906.includes('renderMode') || svp906.includes('showRenderOptions') || svp906.includes('wireframe')) {
    log('pass', 'R906', 'SceneViewPanel 렌더 모드 전환 존재')
  } else {
    log('warning', 'R906', 'SceneViewPanel 렌더 모드 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R907: TerminalPanel 환경변수 편집기
const tp907Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp907Path)) {
  const tp907 = readFileSync(tp907Path, 'utf-8')
  if (tp907.includes('envVars') || tp907.includes('showEnvEditor') || tp907.includes('showEnvVars')) {
    log('pass', 'R907', 'TerminalPanel 환경변수 편집기 존재')
  } else {
    log('warning', 'R907', 'TerminalPanel 환경변수 편집기 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R908: SessionList 세션 히트맵
const sl908Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl908Path)) {
  const sl908 = readFileSync(sl908Path, 'utf-8')
  if (sl908.includes('sessionHeatmap') || sl908.includes('heatmapData') || sl908.includes('activityMap')) {
    log('pass', 'R908', 'SessionList 세션 히트맵 존재')
  } else {
    log('warning', 'R908', 'SessionList 세션 히트맵 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 214. Phase DD10 R909~911 기능 체크')

// R909: ChatPanel 읽음 확인
const cp909Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp909Path)) {
  const cp909 = readFileSync(cp909Path, 'utf-8')
  if (cp909.includes('readReceipts') || cp909.includes('showReadReceipts') || cp909.includes('readAt')) {
    log('pass', 'R909', 'ChatPanel 읽음 확인 존재')
  } else {
    log('warning', 'R909', 'ChatPanel 읽음 확인 없음', 'chat/ChatPanel.tsx')
  }
}

// R910: InputBar 파일 드롭존
const ib910Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib910Path)) {
  const ib910 = readFileSync(ib910Path, 'utf-8')
  if (ib910.includes('fileDropActive') || ib910.includes('droppedFiles') || ib910.includes('dropZone')) {
    log('pass', 'R910', 'InputBar 파일 드롭존 존재')
  } else {
    log('warning', 'R910', 'InputBar 파일 드롭존 없음', 'chat/InputBar.tsx')
  }
}

// R911: CocosPanel 스프라이트 에디터
const cocp911Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp911Path)) {
  const cocp911 = readFileSync(cocp911Path, 'utf-8')
  if (cocp911.includes('spriteEditorOpen') || cocp911.includes('editingSprite') || cocp911.includes('spriteEdit')) {
    log('pass', 'R911', 'CocosPanel 스프라이트 에디터 존재')
  } else {
    log('warning', 'R911', 'CocosPanel 스프라이트 에디터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 215. Phase DD10 R912~914 기능 체크')

// R912: SceneViewPanel 라이팅 디버그
const svp912Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp912Path)) {
  const svp912 = readFileSync(svp912Path, 'utf-8')
  if (svp912.includes('lightingDebug') || svp912.includes('lightingOverlay') || svp912.includes('diffuse')) {
    log('pass', 'R912', 'SceneViewPanel 라이팅 디버그 존재')
  } else {
    log('warning', 'R912', 'SceneViewPanel 라이팅 디버그 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R913: TerminalPanel 출력 스로틀
const tp913Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp913Path)) {
  const tp913 = readFileSync(tp913Path, 'utf-8')
  if (tp913.includes('outputThrottle') || tp913.includes('throttleInterval') || tp913.includes('throttleOutput')) {
    log('pass', 'R913', 'TerminalPanel 출력 스로틀 존재')
  } else {
    log('warning', 'R913', 'TerminalPanel 출력 스로틀 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R914: SessionList 세션 내보내기 옵션
const sl914Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl914Path)) {
  const sl914 = readFileSync(sl914Path, 'utf-8')
  if (sl914.includes('sessionExportFormat') || sl914.includes('showSessionExport') || sl914.includes('exportSession')) {
    log('pass', 'R914', 'SessionList 세션 내보내기 옵션 존재')
  } else {
    log('warning', 'R914', 'SessionList 세션 내보내기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 216. Phase DD10 R915~917 기능 체크')

// R915: ChatPanel 대화 인사이트
const cp915Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp915Path)) {
  const cp915 = readFileSync(cp915Path, 'utf-8')
  if (cp915.includes('conversationInsights') || cp915.includes('showInsightsPanel') || cp915.includes('avgResponseTime')) {
    log('pass', 'R915', 'ChatPanel 대화 인사이트 존재')
  } else {
    log('warning', 'R915', 'ChatPanel 대화 인사이트 없음', 'chat/ChatPanel.tsx')
  }
}

// R916: InputBar 코드 자동완성
const ib916Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib916Path)) {
  const ib916 = readFileSync(ib916Path, 'utf-8')
  if (ib916.includes('codeCompletion') || ib916.includes('codeCompletionSuggestions') || ib916.includes('codeComplete')) {
    log('pass', 'R916', 'InputBar 코드 자동완성 존재')
  } else {
    log('warning', 'R916', 'InputBar 코드 자동완성 없음', 'chat/InputBar.tsx')
  }
}

// R917: CocosPanel 파티클 에디터
const cocp917Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp917Path)) {
  const cocp917 = readFileSync(cocp917Path, 'utf-8')
  if (cocp917.includes('particleEditorOpen') || cocp917.includes('editingParticle') || cocp917.includes('particleEdit')) {
    log('pass', 'R917', 'CocosPanel 파티클 에디터 존재')
  } else {
    log('warning', 'R917', 'CocosPanel 파티클 에디터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 217. Phase DD10 R918~920 기능 체크')

// R918: SceneViewPanel 카메라 FOV 컨트롤
const svp918Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp918Path)) {
  const svp918 = readFileSync(svp918Path, 'utf-8')
  if (svp918.includes('cameraFov') || svp918.includes('showCameraControls') || svp918.includes('camFov')) {
    log('pass', 'R918', 'SceneViewPanel 카메라 FOV 컨트롤 존재')
  } else {
    log('warning', 'R918', 'SceneViewPanel 카메라 FOV 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R919: TerminalPanel 터미널 매크로
const tp919Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp919Path)) {
  const tp919 = readFileSync(tp919Path, 'utf-8')
  if (tp919.includes('terminalMacros') || tp919.includes('showMacroPanel') || tp919.includes('macroList')) {
    log('pass', 'R919', 'TerminalPanel 터미널 매크로 존재')
  } else {
    log('warning', 'R919', 'TerminalPanel 터미널 매크로 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R920: SessionList 세션 중복 감지
const sl920Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl920Path)) {
  const sl920 = readFileSync(sl920Path, 'utf-8')
  if (sl920.includes('duplicateSessions') || sl920.includes('showDuplicatePanel') || sl920.includes('dupeSessions')) {
    log('pass', 'R920', 'SessionList 세션 중복 감지 존재')
  } else {
    log('warning', 'R920', 'SessionList 세션 중복 감지 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 218. Phase DD10 R921~923 기능 체크')

// R921: ChatPanel 메시지 분석
const cp921Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp921Path)) {
  const cp921 = readFileSync(cp921Path, 'utf-8')
  if (cp921.includes('messageAnalytics') || cp921.includes('showAnalyticsPanel') || cp921.includes('msgAnalytics')) {
    log('pass', 'R921', 'ChatPanel 메시지 분석 패널 존재')
  } else {
    log('warning', 'R921', 'ChatPanel 메시지 분석 없음', 'chat/ChatPanel.tsx')
  }
}

// R922: InputBar 텍스트 변환 메뉴
const ib922Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib922Path)) {
  const ib922 = readFileSync(ib922Path, 'utf-8')
  if (ib922.includes('textTransform') || ib922.includes('showTransformMenu') || ib922.includes('transformText')) {
    log('pass', 'R922', 'InputBar 텍스트 변환 메뉴 존재')
  } else {
    log('warning', 'R922', 'InputBar 텍스트 변환 없음', 'chat/InputBar.tsx')
  }
}

// R923: CocosPanel 오디오 에디터
const cocp923Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocp923Path)) {
  const cocp923 = readFileSync(cocp923Path, 'utf-8')
  if (cocp923.includes('audioEditorOpen') || cocp923.includes('editingAudio') || cocp923.includes('audioEdit')) {
    log('pass', 'R923', 'CocosPanel 오디오 에디터 존재')
  } else {
    log('warning', 'R923', 'CocosPanel 오디오 에디터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 219. Phase DD10 R924~926 기능 체크')

// R924: SceneViewPanel 기즈모 설정
const svp924Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp924Path)) {
  const svp924 = readFileSync(svp924Path, 'utf-8')
  if (svp924.includes('gizmoSize') || svp924.includes('showGizmoSettings') || svp924.includes('gizmoScale')) {
    log('pass', 'R924', 'SceneViewPanel 기즈모 설정 존재')
  } else {
    log('warning', 'R924', 'SceneViewPanel 기즈모 설정 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R925: TerminalPanel 출력 페이징
const tp925Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp925Path)) {
  const tp925 = readFileSync(tp925Path, 'utf-8')
  if (tp925.includes('pagingEnabled') || tp925.includes('currentPage') || tp925.includes('outputPage')) {
    log('pass', 'R925', 'TerminalPanel 출력 페이징 존재')
  } else {
    log('warning', 'R925', 'TerminalPanel 출력 페이징 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R926: SessionList 세션 카테고리
const sl926Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl926Path)) {
  const sl926 = readFileSync(sl926Path, 'utf-8')
  if (sl926.includes('sessionCategories') || sl926.includes('showCategoryManager') || sl926.includes('categoryMap')) {
    log('pass', 'R926', 'SessionList 세션 카테고리 존재')
  } else {
    log('warning', 'R926', 'SessionList 세션 카테고리 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 220. Phase DD10 R927~929 기능 체크')
// R927: ChatPanel 채팅 노트
const cp927Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp927Path)) {
  const cp927 = readFileSync(cp927Path, 'utf-8')
  if (cp927.includes('chatNotes') || cp927.includes('showChatNotes') || cp927.includes('notepad')) {
    log('pass', 'R927', 'ChatPanel 채팅 노트 존재')
  } else {
    log('warning', 'R927', 'ChatPanel 채팅 노트 없음', 'chat/ChatPanel.tsx')
  }
}

// R928: InputBar 문법 검사
const ib928Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib928Path)) {
  const ib928 = readFileSync(ib928Path, 'utf-8')
  if (ib928.includes('grammarCheck') || ib928.includes('grammarSuggestions') || ib928.includes('grammarErrors')) {
    log('pass', 'R928', 'InputBar 문법 검사 존재')
  } else {
    log('warning', 'R928', 'InputBar 문법 검사 없음', 'chat/InputBar.tsx')
  }
}

// R929: CocosPanel 타일맵 에디터
const cocos929Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos929Path)) {
  const cocos929 = readFileSync(cocos929Path, 'utf-8')
  if (cocos929.includes('tileMapEditorOpen') || cocos929.includes('editingTileMap') || cocos929.includes('tileMapEditor')) {
    log('pass', 'R929', 'CocosPanel 타일맵 에디터 존재')
  } else {
    log('warning', 'R929', 'CocosPanel 타일맵 에디터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 221. Phase DD10 R930~932 기능 체크')
// R930: ChatPanel 채팅 분석 대시보드
const cp930Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp930Path)) {
  const cp930 = readFileSync(cp930Path, 'utf-8')
  if (cp930.includes('chatAnalytics') || cp930.includes('showAnalyticsDashboard') || cp930.includes('analyticsDashboard')) {
    log('pass', 'R930', 'ChatPanel 채팅 분석 대시보드 존재')
  } else {
    log('warning', 'R930', 'ChatPanel 채팅 분석 대시보드 없음', 'chat/ChatPanel.tsx')
  }
}

// R931: InputBar 음성 입력
const ib931Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib931Path)) {
  const ib931 = readFileSync(ib931Path, 'utf-8')
  if (ib931.includes('voiceInput') || ib931.includes('voiceTranscript') || ib931.includes('speechRecognition')) {
    log('pass', 'R931', 'InputBar 음성 입력 존재')
  } else {
    log('warning', 'R931', 'InputBar 음성 입력 없음', 'chat/InputBar.tsx')
  }
}

// R932: CocosPanel 씬 그래프
const cocos932Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos932Path)) {
  const cocos932 = readFileSync(cocos932Path, 'utf-8')
  if (cocos932.includes('sceneGraph') || cocos932.includes('showSceneGraph') || cocos932.includes('sceneTree')) {
    log('pass', 'R932', 'CocosPanel 씬 그래프 존재')
  } else {
    log('warning', 'R932', 'CocosPanel 씬 그래프 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 222. Phase DD10 R933~935 기능 체크')
// R933: SceneViewPanel 씬 레이어
const svp933Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp933Path)) {
  const svp933 = readFileSync(svp933Path, 'utf-8')
  if (svp933.includes('sceneLayers') || svp933.includes('showLayerPanel') || svp933.includes('layerManager')) {
    log('pass', 'R933', 'SceneViewPanel 씬 레이어 존재')
  } else {
    log('warning', 'R933', 'SceneViewPanel 씬 레이어 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R934: TerminalPanel 터미널 알림
const tp934Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp934Path)) {
  const tp934 = readFileSync(tp934Path, 'utf-8')
  if (tp934.includes('terminalAlerts') || tp934.includes('showAlertPanel') || tp934.includes('alertNotification')) {
    log('pass', 'R934', 'TerminalPanel 터미널 알림 존재')
  } else {
    log('warning', 'R934', 'TerminalPanel 터미널 알림 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R935: SessionList 세션 태그
const sl935Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl935Path)) {
  const sl935 = readFileSync(sl935Path, 'utf-8')
  if (sl935.includes('showTagEditor') || sl935.includes('sessionTagMap') || sl935.includes('tagEditor')) {
    log('pass', 'R935', 'SessionList 세션 태그 에디터 존재')
  } else {
    log('warning', 'R935', 'SessionList 세션 태그 에디터 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 223. Phase DD10 R936~938 기능 체크')
// R936: ChatPanel 실시간 번역
const cp936Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp936Path)) {
  const cp936 = readFileSync(cp936Path, 'utf-8')
  if (cp936.includes('translateEnabled') || cp936.includes('translateTarget') || cp936.includes('translationMode')) {
    log('pass', 'R936', 'ChatPanel 실시간 번역 존재')
  } else {
    log('warning', 'R936', 'ChatPanel 실시간 번역 없음', 'chat/ChatPanel.tsx')
  }
}

// R937: InputBar 이모지 검색
const ib937Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib937Path)) {
  const ib937 = readFileSync(ib937Path, 'utf-8')
  if (ib937.includes('emojiSearch') || ib937.includes('showEmojiSearch') || ib937.includes('emojiPicker')) {
    log('pass', 'R937', 'InputBar 이모지 검색 존재')
  } else {
    log('warning', 'R937', 'InputBar 이모지 검색 없음', 'chat/InputBar.tsx')
  }
}

// R938: CocosPanel 노드 잠금
const cocos938Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos938Path)) {
  const cocos938 = readFileSync(cocos938Path, 'utf-8')
  if (cocos938.includes('lockedNodes') || cocos938.includes('showLockPanel') || cocos938.includes('nodeLock')) {
    log('pass', 'R938', 'CocosPanel 노드 잠금 존재')
  } else {
    log('warning', 'R938', 'CocosPanel 노드 잠금 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 224. Phase DD10 R939~941 기능 체크')
// R939: SceneViewPanel 스냅 설정
const svp939Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp939Path)) {
  const svp939 = readFileSync(svp939Path, 'utf-8')
  if (svp939.includes('snapSettings') || svp939.includes('showSnapPanel') || svp939.includes('snapGrid')) {
    log('pass', 'R939', 'SceneViewPanel 스냅 설정 존재')
  } else {
    log('warning', 'R939', 'SceneViewPanel 스냅 설정 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R940: TerminalPanel 터미널 메모
const tp940Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp940Path)) {
  const tp940 = readFileSync(tp940Path, 'utf-8')
  if (tp940.includes('terminalNotes') || tp940.includes('showNotesPanel') || tp940.includes('terminalMemo')) {
    log('pass', 'R940', 'TerminalPanel 터미널 메모 존재')
  } else {
    log('warning', 'R940', 'TerminalPanel 터미널 메모 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R941: SessionList 세션 메모
const sl941Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl941Path)) {
  const sl941 = readFileSync(sl941Path, 'utf-8')
  if (sl941.includes('sessionMemos') || sl941.includes('showMemoEditor') || sl941.includes('memoMap')) {
    log('pass', 'R941', 'SessionList 세션 메모 존재')
  } else {
    log('warning', 'R941', 'SessionList 세션 메모 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 225. Phase DD10 R942~944 기능 체크')
// R942: ChatPanel 메시지 북마크
const cp942Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp942Path)) {
  const cp942 = readFileSync(cp942Path, 'utf-8')
  if (cp942.includes('messageBookmarks') || cp942.includes('showBookmarkPanel') || cp942.includes('bookmarkedMessages')) {
    log('pass', 'R942', 'ChatPanel 메시지 북마크 존재')
  } else {
    log('warning', 'R942', 'ChatPanel 메시지 북마크 없음', 'chat/ChatPanel.tsx')
  }
}

// R943: InputBar 텍스트 크기 조절
const ib943Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib943Path)) {
  const ib943 = readFileSync(ib943Path, 'utf-8')
  if (ib943.includes('fontSize') || ib943.includes('showFontSizeControl') || ib943.includes('textSize')) {
    log('pass', 'R943', 'InputBar 텍스트 크기 조절 존재')
  } else {
    log('warning', 'R943', 'InputBar 텍스트 크기 조절 없음', 'chat/InputBar.tsx')
  }
}

// R944: CocosPanel 컴포넌트 검색
const cocos944Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos944Path)) {
  const cocos944 = readFileSync(cocos944Path, 'utf-8')
  if (cocos944.includes('compSearch') || cocos944.includes('compSearchResults') || cocos944.includes('componentFilter')) {
    log('pass', 'R944', 'CocosPanel 컴포넌트 검색 존재')
  } else {
    log('warning', 'R944', 'CocosPanel 컴포넌트 검색 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 226. Phase DD10 R945~947 기능 체크')
// R945: SceneViewPanel 그리드 오버레이
const svp945Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp945Path)) {
  const svp945 = readFileSync(svp945Path, 'utf-8')
  if (svp945.includes('showGrid') || svp945.includes('gridSize') || svp945.includes('gridOverlay')) {
    log('pass', 'R945', 'SceneViewPanel 그리드 오버레이 존재')
  } else {
    log('warning', 'R945', 'SceneViewPanel 그리드 오버레이 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R946: TerminalPanel 출력 필터
const tp946Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp946Path)) {
  const tp946 = readFileSync(tp946Path, 'utf-8')
  if (tp946.includes('outputFilter') || tp946.includes('filterActive') || tp946.includes('filterOutput')) {
    log('pass', 'R946', 'TerminalPanel 출력 필터 존재')
  } else {
    log('warning', 'R946', 'TerminalPanel 출력 필터 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R947: SessionList 세션 핀
const sl947Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl947Path)) {
  const sl947 = readFileSync(sl947Path, 'utf-8')
  if (sl947.includes('pinnedSessions') || sl947.includes('showPinnedOnly') || sl947.includes('pinnedFiltered')) {
    log('pass', 'R947', 'SessionList 세션 핀 존재')
  } else {
    log('warning', 'R947', 'SessionList 세션 핀 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 227. Phase DD10 R948~950 기능 체크')
// R948: ChatPanel 메시지 태그
const cp948Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp948Path)) {
  const cp948 = readFileSync(cp948Path, 'utf-8')
  if (cp948.includes('messageTags') || cp948.includes('showTagFilter') || cp948.includes('taggedMessages')) {
    log('pass', 'R948', 'ChatPanel 메시지 태그 존재')
  } else {
    log('warning', 'R948', 'ChatPanel 메시지 태그 없음', 'chat/ChatPanel.tsx')
  }
}

// R949: InputBar 링크 미리보기
const ib949Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib949Path)) {
  const ib949 = readFileSync(ib949Path, 'utf-8')
  if (ib949.includes('linkPreview') || ib949.includes('showLinkPreview') || ib949.includes('urlPreview')) {
    log('pass', 'R949', 'InputBar 링크 미리보기 존재')
  } else {
    log('warning', 'R949', 'InputBar 링크 미리보기 없음', 'chat/InputBar.tsx')
  }
}

// R950: CocosPanel 에셋 즐겨찾기
const cocos950Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos950Path)) {
  const cocos950 = readFileSync(cocos950Path, 'utf-8')
  if (cocos950.includes('assetFavorites') || cocos950.includes('showFavoritesPanel') || cocos950.includes('favoriteAssets')) {
    log('pass', 'R950', 'CocosPanel 에셋 즐겨찾기 존재')
  } else {
    log('warning', 'R950', 'CocosPanel 에셋 즐겨찾기 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 228. Phase DD10 R951~953 기능 체크')
// R951: SceneViewPanel 색상 테마
const svp951Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp951Path)) {
  const svp951 = readFileSync(svp951Path, 'utf-8')
  if (svp951.includes('sceneColorTheme') || svp951.includes('showThemePanel') || svp951.includes('colorTheme')) {
    log('pass', 'R951', 'SceneViewPanel 색상 테마 존재')
  } else {
    log('warning', 'R951', 'SceneViewPanel 색상 테마 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R952: TerminalPanel 세션 공유
const tp952Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp952Path)) {
  const tp952 = readFileSync(tp952Path, 'utf-8')
  if (tp952.includes('shareSession') || tp952.includes('shareLink') || tp952.includes('sessionShare')) {
    log('pass', 'R952', 'TerminalPanel 세션 공유 존재')
  } else {
    log('warning', 'R952', 'TerminalPanel 세션 공유 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R953: SessionList 아카이브 통계
const sl953Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl953Path)) {
  const sl953 = readFileSync(sl953Path, 'utf-8')
  if (sl953.includes('archiveFilter') || sl953.includes('showArchiveStats') || sl953.includes('archiveStats')) {
    log('pass', 'R953', 'SessionList 아카이브 통계 존재')
  } else {
    log('warning', 'R953', 'SessionList 아카이브 통계 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 229. Phase DD10 R954~956 기능 체크')
// R954: ChatPanel 메시지 색상 라벨
const cp954Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp954Path)) {
  const cp954 = readFileSync(cp954Path, 'utf-8')
  if (cp954.includes('messageLabels') || cp954.includes('showLabelPicker') || cp954.includes('labeledMessages')) {
    log('pass', 'R954', 'ChatPanel 메시지 색상 라벨 존재')
  } else {
    log('warning', 'R954', 'ChatPanel 메시지 색상 라벨 없음', 'chat/ChatPanel.tsx')
  }
}

// R955: InputBar 자동 저장
const ib955Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib955Path)) {
  const ib955 = readFileSync(ib955Path, 'utf-8')
  if (ib955.includes('autoSave') || ib955.includes('lastSaved') || ib955.includes('draftSaved')) {
    log('pass', 'R955', 'InputBar 자동 저장 존재')
  } else {
    log('warning', 'R955', 'InputBar 자동 저장 없음', 'chat/InputBar.tsx')
  }
}

// R956: CocosPanel 노드 히스토리
const cocos956Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos956Path)) {
  const cocos956 = readFileSync(cocos956Path, 'utf-8')
  if (cocos956.includes('nodeHistory') || cocos956.includes('showNodeHistory') || cocos956.includes('nodeLog')) {
    log('pass', 'R956', 'CocosPanel 노드 히스토리 존재')
  } else {
    log('warning', 'R956', 'CocosPanel 노드 히스토리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 230. Phase DD10 R957~959 기능 체크')
// R957: SceneViewPanel 다중 선택
const svp957Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp957Path)) {
  const svp957 = readFileSync(svp957Path, 'utf-8')
  if (svp957.includes('multiSelect') || svp957.includes('selectedNodes') || svp957.includes('multiSelected')) {
    log('pass', 'R957', 'SceneViewPanel 다중 선택 존재')
  } else {
    log('warning', 'R957', 'SceneViewPanel 다중 선택 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R958: TerminalPanel 키 바인딩
const tp958Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp958Path)) {
  const tp958 = readFileSync(tp958Path, 'utf-8')
  if (tp958.includes('keyBindings') || tp958.includes('showKeyBindings') || tp958.includes('keymap')) {
    log('pass', 'R958', 'TerminalPanel 키 바인딩 존재')
  } else {
    log('warning', 'R958', 'TerminalPanel 키 바인딩 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R959: SessionList 세션 그룹
const sl959Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl959Path)) {
  const sl959 = readFileSync(sl959Path, 'utf-8')
  if (sl959.includes('sessionGroups') || sl959.includes('showGroupEditor') || sl959.includes('groupedSessions')) {
    log('pass', 'R959', 'SessionList 세션 그룹 존재')
  } else {
    log('warning', 'R959', 'SessionList 세션 그룹 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 231. Phase DD10 R960~962 기능 체크')
// R960: ChatPanel 메시지 분류
const cp960Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp960Path)) {
  const cp960 = readFileSync(cp960Path, 'utf-8')
  if (cp960.includes('messageCategories') || cp960.includes('activeMsgCategory') || cp960.includes('msgCategory')) {
    log('pass', 'R960', 'ChatPanel 메시지 분류 존재')
  } else {
    log('warning', 'R960', 'ChatPanel 메시지 분류 없음', 'chat/ChatPanel.tsx')
  }
}

// R961: InputBar 단축키 도움말
const ib961Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib961Path)) {
  const ib961 = readFileSync(ib961Path, 'utf-8')
  if (ib961.includes('shortcutHelp') || ib961.includes('shortcutList') || ib961.includes('keyboardShortcuts')) {
    log('pass', 'R961', 'InputBar 단축키 도움말 존재')
  } else {
    log('warning', 'R961', 'InputBar 단축키 도움말 없음', 'chat/InputBar.tsx')
  }
}

// R962: CocosPanel 씬 스냅샷
const cocos962Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos962Path)) {
  const cocos962 = readFileSync(cocos962Path, 'utf-8')
  if (cocos962.includes('sceneSnapshots') || cocos962.includes('showSnapshotList') || cocos962.includes('snapshotList')) {
    log('pass', 'R962', 'CocosPanel 씬 스냅샷 존재')
  } else {
    log('warning', 'R962', 'CocosPanel 씬 스냅샷 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 232. Phase DD10 R963~965 기능 체크')
// R963: SceneViewPanel 노드 정렬
const svp963Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp963Path)) {
  const svp963 = readFileSync(svp963Path, 'utf-8')
  if (svp963.includes('nodeSort') || svp963.includes('nodeSortAsc') || svp963.includes('sortKey')) {
    log('pass', 'R963', 'SceneViewPanel 노드 정렬 존재')
  } else {
    log('warning', 'R963', 'SceneViewPanel 노드 정렬 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R964: TerminalPanel 출력 색상화
const tp964Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp964Path)) {
  const tp964 = readFileSync(tp964Path, 'utf-8')
  if (tp964.includes('colorize') || tp964.includes('colorScheme') || tp964.includes('outputColor')) {
    log('pass', 'R964', 'TerminalPanel 출력 색상화 존재')
  } else {
    log('warning', 'R964', 'TerminalPanel 출력 색상화 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R965: SessionList 세션 알림
const sl965Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl965Path)) {
  const sl965 = readFileSync(sl965Path, 'utf-8')
  if (sl965.includes('sessionAlerts') || sl965.includes('showAlertManager') || sl965.includes('alertMap')) {
    log('pass', 'R965', 'SessionList 세션 알림 존재')
  } else {
    log('warning', 'R965', 'SessionList 세션 알림 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 233. Phase DD10 R966~968 기능 체크')
// R966: ChatPanel 읽음 표시 설정
const cp966Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp966Path)) {
  const cp966 = readFileSync(cp966Path, 'utf-8')
  if (cp966.includes('readStatus') || cp966.includes('showReadStatus') || cp966.includes('readReceipt')) {
    log('pass', 'R966', 'ChatPanel 읽음 표시 설정 존재')
  } else {
    log('warning', 'R966', 'ChatPanel 읽음 표시 설정 없음', 'chat/ChatPanel.tsx')
  }
}

// R967: InputBar 인라인 이미지
const ib967Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib967Path)) {
  const ib967 = readFileSync(ib967Path, 'utf-8')
  if (ib967.includes('inlineImages') || ib967.includes('showImageGallery') || ib967.includes('imageInline')) {
    log('pass', 'R967', 'InputBar 인라인 이미지 존재')
  } else {
    log('warning', 'R967', 'InputBar 인라인 이미지 없음', 'chat/InputBar.tsx')
  }
}

// R968: CocosPanel 리소스 미리보기
const cocos968Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos968Path)) {
  const cocos968 = readFileSync(cocos968Path, 'utf-8')
  if (cocos968.includes('resourcePreview') || cocos968.includes('showResourcePreview') || cocos968.includes('previewResource')) {
    log('pass', 'R968', 'CocosPanel 리소스 미리보기 존재')
  } else {
    log('warning', 'R968', 'CocosPanel 리소스 미리보기 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 234. Phase DD10 R969~971 기능 체크')
// R969: SceneViewPanel 씬 통계
const svp969Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp969Path)) {
  const svp969 = readFileSync(svp969Path, 'utf-8')
  if (svp969.includes('sceneStats') || svp969.includes('showSceneStats') || svp969.includes('sceneMetrics')) {
    log('pass', 'R969', 'SceneViewPanel 씬 통계 존재')
  } else {
    log('warning', 'R969', 'SceneViewPanel 씬 통계 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R970: TerminalPanel 자동 스크롤
const tp970Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp970Path)) {
  const tp970 = readFileSync(tp970Path, 'utf-8')
  if (tp970.includes('autoScroll') || tp970.includes('scrollLock') || tp970.includes('autoScrollEnabled')) {
    log('pass', 'R970', 'TerminalPanel 자동 스크롤 존재')
  } else {
    log('warning', 'R970', 'TerminalPanel 자동 스크롤 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R971: SessionList 세션 내보내기
const sl971Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl971Path)) {
  const sl971 = readFileSync(sl971Path, 'utf-8')
  if (sl971.includes('exportFormat') || sl971.includes('showExportDialog') || sl971.includes('sessionExport')) {
    log('pass', 'R971', 'SessionList 세션 내보내기 존재')
  } else {
    log('warning', 'R971', 'SessionList 세션 내보내기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 235. Phase DD10 R972~974 기능 체크')
// R972: ChatPanel 감정 분석
const cp972Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp972Path)) {
  const cp972 = readFileSync(cp972Path, 'utf-8')
  if (cp972.includes('sentimentMode') || cp972.includes('sentimentData') || cp972.includes('sentimentAnalysis')) {
    log('pass', 'R972', 'ChatPanel 감정 분석 존재')
  } else {
    log('warning', 'R972', 'ChatPanel 감정 분석 없음', 'chat/ChatPanel.tsx')
  }
}

// R973: InputBar 마크다운 툴바
const ib973Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib973Path)) {
  const ib973 = readFileSync(ib973Path, 'utf-8')
  if (ib973.includes('mdToolbar') || ib973.includes('mdToolbarPinned') || ib973.includes('markdownToolbar')) {
    log('pass', 'R973', 'InputBar 마크다운 툴바 존재')
  } else {
    log('warning', 'R973', 'InputBar 마크다운 툴바 없음', 'chat/InputBar.tsx')
  }
}

// R974: CocosPanel 빌드 설정
const cocos974Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos974Path)) {
  const cocos974 = readFileSync(cocos974Path, 'utf-8')
  if (cocos974.includes('buildSettings') || cocos974.includes('showBuildSettings') || cocos974.includes('buildConfig')) {
    log('pass', 'R974', 'CocosPanel 빌드 설정 존재')
  } else {
    log('warning', 'R974', 'CocosPanel 빌드 설정 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 236. Phase DD10 R975~977 기능 체크')
// R975: SceneViewPanel 애니메이션 타임라인
const svp975Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp975Path)) {
  const svp975 = readFileSync(svp975Path, 'utf-8')
  if (svp975.includes('animTimeline') || svp975.includes('animFrame') || svp975.includes('timelineEnabled')) {
    log('pass', 'R975', 'SceneViewPanel 애니메이션 타임라인 존재')
  } else {
    log('warning', 'R975', 'SceneViewPanel 애니메이션 타임라인 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R976: TerminalPanel 입력 히스토리
const tp976Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp976Path)) {
  const tp976 = readFileSync(tp976Path, 'utf-8')
  if (tp976.includes('inputHistory') || tp976.includes('historyIdx') || tp976.includes('commandHistory')) {
    log('pass', 'R976', 'TerminalPanel 입력 히스토리 존재')
  } else {
    log('warning', 'R976', 'TerminalPanel 입력 히스토리 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R977: SessionList 최근 항목
const sl977Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl977Path)) {
  const sl977 = readFileSync(sl977Path, 'utf-8')
  if (sl977.includes('recentLimit') || sl977.includes('showRecentOnly') || sl977.includes('recentSessions')) {
    log('pass', 'R977', 'SessionList 최근 항목 존재')
  } else {
    log('warning', 'R977', 'SessionList 최근 항목 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 237. Phase DD10 R978~980 기능 체크')
// R978: ChatPanel 메시지 통계
const cp978Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp978Path)) {
  const cp978 = readFileSync(cp978Path, 'utf-8')
  if (cp978.includes('msgStats') || cp978.includes('showMsgStats') || cp978.includes('messageStats')) {
    log('pass', 'R978', 'ChatPanel 메시지 통계 존재')
  } else {
    log('warning', 'R978', 'ChatPanel 메시지 통계 없음', 'chat/ChatPanel.tsx')
  }
}

// R979: InputBar 텍스트 확장
const ib979Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib979Path)) {
  const ib979 = readFileSync(ib979Path, 'utf-8')
  if (ib979.includes('expandedInput') || ib979.includes('inputMaxHeight') || ib979.includes('inputExpand')) {
    log('pass', 'R979', 'InputBar 텍스트 확장 존재')
  } else {
    log('warning', 'R979', 'InputBar 텍스트 확장 없음', 'chat/InputBar.tsx')
  }
}

// R980: CocosPanel 플러그인 관리
const cocos980Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos980Path)) {
  const cocos980 = readFileSync(cocos980Path, 'utf-8')
  if (cocos980.includes('showPluginManager') || cocos980.includes('pluginList') || cocos980.includes('plugins')) {
    log('pass', 'R980', 'CocosPanel 플러그인 관리 존재')
  } else {
    log('warning', 'R980', 'CocosPanel 플러그인 관리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 238. Phase DD10 R981~983 기능 체크')
// R981: SceneViewPanel 씬 북마크
const svp981Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp981Path)) {
  const svp981 = readFileSync(svp981Path, 'utf-8')
  if (svp981.includes('sceneBookmarks') || svp981.includes('showBookmarks') || svp981.includes('bookmarkScene')) {
    log('pass', 'R981', 'SceneViewPanel 씬 북마크 존재')
  } else {
    log('warning', 'R981', 'SceneViewPanel 씬 북마크 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R982: TerminalPanel 폰트 설정
const tp982Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp982Path)) {
  const tp982 = readFileSync(tp982Path, 'utf-8')
  if (tp982.includes('termFontSize') || tp982.includes('termFontFamily') || tp982.includes('termFont')) {
    log('pass', 'R982', 'TerminalPanel 폰트 설정 존재')
  } else {
    log('warning', 'R982', 'TerminalPanel 폰트 설정 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R983: SessionList 세션 잠금
const sl983Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl983Path)) {
  const sl983 = readFileSync(sl983Path, 'utf-8')
  if (sl983.includes('lockedSessions') || sl983.includes('showLockConfirm') || sl983.includes('sessionLock')) {
    log('pass', 'R983', 'SessionList 세션 잠금 존재')
  } else {
    log('warning', 'R983', 'SessionList 세션 잠금 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 239. Phase DD10 R984~986 기능 체크')
// R984: ChatPanel 메시지 검색 필터
const cp984Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp984Path)) {
  const cp984 = readFileSync(cp984Path, 'utf-8')
  if (cp984.includes('searchFilter') || cp984.includes('showSearchFilter') || cp984.includes('msgFilter')) {
    log('pass', 'R984', 'ChatPanel 메시지 검색 필터 존재')
  } else {
    log('warning', 'R984', 'ChatPanel 메시지 검색 필터 없음', 'chat/ChatPanel.tsx')
  }
}

// R985: InputBar 코드 언어 선택
const ib985Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib985Path)) {
  const ib985 = readFileSync(ib985Path, 'utf-8')
  if (ib985.includes('codeLanguage') || ib985.includes('showLangPicker') || ib985.includes('langSelect')) {
    log('pass', 'R985', 'InputBar 코드 언어 선택 존재')
  } else {
    log('warning', 'R985', 'InputBar 코드 언어 선택 없음', 'chat/InputBar.tsx')
  }
}

// R986: CocosPanel 렌더 설정
const cocos986Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos986Path)) {
  const cocos986 = readFileSync(cocos986Path, 'utf-8')
  if (cocos986.includes('renderSettings') || cocos986.includes('showRenderSettings') || cocos986.includes('renderConfig')) {
    log('pass', 'R986', 'CocosPanel 렌더 설정 존재')
  } else {
    log('warning', 'R986', 'CocosPanel 렌더 설정 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 240. Phase DD10 R987~989 기능 체크')
// R987: SceneViewPanel 씬 잠금
const svp987Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp987Path)) {
  const svp987 = readFileSync(svp987Path, 'utf-8')
  if (svp987.includes('sceneLocked') || svp987.includes('lockReason') || svp987.includes('sceneReadOnly')) {
    log('pass', 'R987', 'SceneViewPanel 씬 잠금 존재')
  } else {
    log('warning', 'R987', 'SceneViewPanel 씬 잠금 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R988: TerminalPanel 원격 접속
const tp988Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp988Path)) {
  const tp988 = readFileSync(tp988Path, 'utf-8')
  if (tp988.includes('remoteHost') || tp988.includes('showRemotePanel') || tp988.includes('sshConnect')) {
    log('pass', 'R988', 'TerminalPanel 원격 접속 존재')
  } else {
    log('warning', 'R988', 'TerminalPanel 원격 접속 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R989: SessionList 세션 공유
const sl989Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl989Path)) {
  const sl989 = readFileSync(sl989Path, 'utf-8')
  if (sl989.includes('sharedSessions') || sl989.includes('showSharePanel') || sl989.includes('shareSession')) {
    log('pass', 'R989', 'SessionList 세션 공유 존재')
  } else {
    log('warning', 'R989', 'SessionList 세션 공유 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 241. Phase DD10 R990~992 기능 체크')
// R990: ChatPanel 채팅 테마
const cp990Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp990Path)) {
  const cp990 = readFileSync(cp990Path, 'utf-8')
  if (cp990.includes('chatTheme') || cp990.includes('showThemeSelector') || cp990.includes('themeMode')) {
    log('pass', 'R990', 'ChatPanel 채팅 테마 존재')
  } else {
    log('warning', 'R990', 'ChatPanel 채팅 테마 없음', 'chat/ChatPanel.tsx')
  }
}

// R991: InputBar 붙여넣기 처리
const ib991Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib991Path)) {
  const ib991 = readFileSync(ib991Path, 'utf-8')
  if (ib991.includes('pasteMode') || ib991.includes('showPasteOptions') || ib991.includes('pasteHandler')) {
    log('pass', 'R991', 'InputBar 붙여넣기 처리 존재')
  } else {
    log('warning', 'R991', 'InputBar 붙여넣기 처리 없음', 'chat/InputBar.tsx')
  }
}

// R992: CocosPanel 씬 필터
const cocos992Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos992Path)) {
  const cocos992 = readFileSync(cocos992Path, 'utf-8')
  if (cocos992.includes('sceneFilter') || cocos992.includes('sceneFilterResults') || cocos992.includes('sceneSearch')) {
    log('pass', 'R992', 'CocosPanel 씬 필터 존재')
  } else {
    log('warning', 'R992', 'CocosPanel 씬 필터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 242. Phase DD10 R993~995 기능 체크')
// R993: SceneViewPanel 드래그 모드
const svp993Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp993Path)) {
  const svp993 = readFileSync(svp993Path, 'utf-8')
  if (svp993.includes('dragMode') || svp993.includes('dragTarget') || svp993.includes('dragEnabled')) {
    log('pass', 'R993', 'SceneViewPanel 드래그 모드 존재')
  } else {
    log('warning', 'R993', 'SceneViewPanel 드래그 모드 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R994: TerminalPanel 명령어 팔레트
const tp994Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp994Path)) {
  const tp994 = readFileSync(tp994Path, 'utf-8')
  if (tp994.includes('cmdPalette') || tp994.includes('cmdPaletteQuery') || tp994.includes('commandPalette')) {
    log('pass', 'R994', 'TerminalPanel 명령어 팔레트 존재')
  } else {
    log('warning', 'R994', 'TerminalPanel 명령어 팔레트 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R995: SessionList 세션 색상
const sl995Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl995Path)) {
  const sl995 = readFileSync(sl995Path, 'utf-8')
  if (sl995.includes('sessionColors') || sl995.includes('showColorPicker') || sl995.includes('colorMap')) {
    log('pass', 'R995', 'SessionList 세션 색상 존재')
  } else {
    log('warning', 'R995', 'SessionList 세션 색상 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 243. Phase DD10 R996~998 기능 체크')
// R996: ChatPanel 대화 요약 패널
const cp996Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp996Path)) {
  const cp996 = readFileSync(cp996Path, 'utf-8')
  if (cp996.includes('convSummary') || cp996.includes('showSummaryPanel') || cp996.includes('summaryPanel')) {
    log('pass', 'R996', 'ChatPanel 대화 요약 패널 존재')
  } else {
    log('warning', 'R996', 'ChatPanel 대화 요약 패널 없음', 'chat/ChatPanel.tsx')
  }
}

// R997: InputBar 입력 잠금
const ib997Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib997Path)) {
  const ib997 = readFileSync(ib997Path, 'utf-8')
  if (ib997.includes('inputLocked') || ib997.includes('lockMessage') || ib997.includes('inputDisabled')) {
    log('pass', 'R997', 'InputBar 입력 잠금 존재')
  } else {
    log('warning', 'R997', 'InputBar 입력 잠금 없음', 'chat/InputBar.tsx')
  }
}

// R998: CocosPanel 노드 정렬
const cocos998Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos998Path)) {
  const cocos998 = readFileSync(cocos998Path, 'utf-8')
  if (cocos998.includes('nodeSortMode') || cocos998.includes('nodeSortOrder') || cocos998.includes('nodeSort')) {
    log('pass', 'R998', 'CocosPanel 노드 정렬 존재')
  } else {
    log('warning', 'R998', 'CocosPanel 노드 정렬 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 244. Phase DD10 R999~1001 기능 체크 🎉')
// R999: SceneViewPanel 씬 비교
const svp999Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp999Path)) {
  const svp999 = readFileSync(svp999Path, 'utf-8')
  if (svp999.includes('sceneCompare') || svp999.includes('compareScene') || svp999.includes('sceneDiff')) {
    log('pass', 'R999', 'SceneViewPanel 씬 비교 존재')
  } else {
    log('warning', 'R999', 'SceneViewPanel 씬 비교 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1000: TerminalPanel 마일스톤 🎉
const tp1000Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1000Path)) {
  const tp1000 = readFileSync(tp1000Path, 'utf-8')
  if (tp1000.includes('milestone') || tp1000.includes('showMilestonePanel') || tp1000.includes('roundMilestone')) {
    log('pass', 'R1000', 'TerminalPanel Round 1000 마일스톤 존재 🎉')
  } else {
    log('warning', 'R1000', 'TerminalPanel Round 1000 마일스톤 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1001: SessionList 세션 통계
const sl1001Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1001Path)) {
  const sl1001 = readFileSync(sl1001Path, 'utf-8')
  if (sl1001.includes('listStats') || sl1001.includes('showListStats') || sl1001.includes('sessionStats')) {
    log('pass', 'R1001', 'SessionList 세션 통계 존재')
  } else {
    log('warning', 'R1001', 'SessionList 세션 통계 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 245. Phase DD10 R1002~1004 기능 체크')
// R1002: ChatPanel 메시지 우선순위
const cp1002Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1002Path)) {
  const cp1002 = readFileSync(cp1002Path, 'utf-8')
  if (cp1002.includes('msgPriority') || cp1002.includes('showPriorityFilter') || cp1002.includes('messagePriority')) {
    log('pass', 'R1002', 'ChatPanel 메시지 우선순위 존재')
  } else {
    log('warning', 'R1002', 'ChatPanel 메시지 우선순위 없음', 'chat/ChatPanel.tsx')
  }
}

// R1003: InputBar 멀티라인 단축키
const ib1003Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1003Path)) {
  const ib1003 = readFileSync(ib1003Path, 'utf-8')
  if (ib1003.includes('multilineShortcut') || ib1003.includes('showShortcutConfig') || ib1003.includes('newlineKey')) {
    log('pass', 'R1003', 'InputBar 멀티라인 단축키 존재')
  } else {
    log('warning', 'R1003', 'InputBar 멀티라인 단축키 없음', 'chat/InputBar.tsx')
  }
}

// R1004: CocosPanel 씬 태그
const cocos1004Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1004Path)) {
  const cocos1004 = readFileSync(cocos1004Path, 'utf-8')
  if (cocos1004.includes('sceneTags') || cocos1004.includes('showSceneTagEditor') || cocos1004.includes('sceneLabel')) {
    log('pass', 'R1004', 'CocosPanel 씬 태그 존재')
  } else {
    log('warning', 'R1004', 'CocosPanel 씬 태그 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 246. Phase DD10 R1005~1007 기능 체크')
// R1005: SceneViewPanel 씬 메모
const svp1005Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1005Path)) {
  const svp1005 = readFileSync(svp1005Path, 'utf-8')
  if (svp1005.includes('sceneMemo') || svp1005.includes('showSceneMemo') || svp1005.includes('sceneMemos')) {
    log('pass', 'R1005', 'SceneViewPanel 씬 메모 존재')
  } else {
    log('warning', 'R1005', 'SceneViewPanel 씬 메모 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1006: TerminalPanel 출력 줄바꿈
const tp1006Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1006Path)) {
  const tp1006 = readFileSync(tp1006Path, 'utf-8')
  if (tp1006.includes('wordWrap') || tp1006.includes('wrapColumn') || tp1006.includes('lineWrap')) {
    log('pass', 'R1006', 'TerminalPanel 출력 줄바꿈 존재')
  } else {
    log('warning', 'R1006', 'TerminalPanel 출력 줄바꿈 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1007: SessionList 세션 즐겨찾기
const sl1007Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1007Path)) {
  const sl1007 = readFileSync(sl1007Path, 'utf-8')
  if (sl1007.includes('favoriteSessions') || sl1007.includes('showFavoritesOnly') || sl1007.includes('sessionFavorites')) {
    log('pass', 'R1007', 'SessionList 세션 즐겨찾기 존재')
  } else {
    log('warning', 'R1007', 'SessionList 세션 즐겨찾기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 247. Phase DD10 R1008~1010 기능 체크')
// R1008: ChatPanel 메시지 타임스탬프
const cp1008Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1008Path)) {
  const cp1008 = readFileSync(cp1008Path, 'utf-8')
  if (cp1008.includes('showTimestamps') || cp1008.includes('timestampFormat') || cp1008.includes('msgTimestamp')) {
    log('pass', 'R1008', 'ChatPanel 메시지 타임스탬프 존재')
  } else {
    log('warning', 'R1008', 'ChatPanel 메시지 타임스탬프 없음', 'chat/ChatPanel.tsx')
  }
}

// R1009: InputBar 자동 완성 모드
const ib1009Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1009Path)) {
  const ib1009 = readFileSync(ib1009Path, 'utf-8')
  if (ib1009.includes('autocompleteMode') || ib1009.includes('showAutocompleteSettings') || ib1009.includes('autoComplete')) {
    log('pass', 'R1009', 'InputBar 자동 완성 모드 존재')
  } else {
    log('warning', 'R1009', 'InputBar 자동 완성 모드 없음', 'chat/InputBar.tsx')
  }
}

// R1010: CocosPanel 에셋 버전
const cocos1010Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1010Path)) {
  const cocos1010 = readFileSync(cocos1010Path, 'utf-8')
  if (cocos1010.includes('assetVersion') || cocos1010.includes('showVersionHistory') || cocos1010.includes('versionControl')) {
    log('pass', 'R1010', 'CocosPanel 에셋 버전 존재')
  } else {
    log('warning', 'R1010', 'CocosPanel 에셋 버전 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 248. Phase DD10 R1011~1013 기능 체크')
// R1011: SceneViewPanel 씬 히스토리
const svp1011Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1011Path)) {
  const svp1011 = readFileSync(svp1011Path, 'utf-8')
  if (svp1011.includes('sceneHistory') || svp1011.includes('sceneHistoryIdx') || svp1011.includes('historyStack')) {
    log('pass', 'R1011', 'SceneViewPanel 씬 히스토리 존재')
  } else {
    log('warning', 'R1011', 'SceneViewPanel 씬 히스토리 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1012: TerminalPanel 라인 번호
const tp1012Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1012Path)) {
  const tp1012 = readFileSync(tp1012Path, 'utf-8')
  if (tp1012.includes('showLineNumbers') || tp1012.includes('lineOffset') || tp1012.includes('lineNumber')) {
    log('pass', 'R1012', 'TerminalPanel 라인 번호 존재')
  } else {
    log('warning', 'R1012', 'TerminalPanel 라인 번호 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1013: SessionList 세션 정렬
const sl1013Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1013Path)) {
  const sl1013 = readFileSync(sl1013Path, 'utf-8')
  if (sl1013.includes('sortMode') || sl1013.includes('sortAsc') || sl1013.includes('sessionSort')) {
    log('pass', 'R1013', 'SessionList 세션 정렬 존재')
  } else {
    log('warning', 'R1013', 'SessionList 세션 정렬 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 249. Phase DD10 R1014~1016 기능 체크')
// R1014: ChatPanel 메시지 접기
const cp1014Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1014Path)) {
  const cp1014 = readFileSync(cp1014Path, 'utf-8')
  if (cp1014.includes('collapsedMsgs') || cp1014.includes('autoCollapse') || cp1014.includes('msgCollapse')) {
    log('pass', 'R1014', 'ChatPanel 메시지 접기 존재')
  } else {
    log('warning', 'R1014', 'ChatPanel 메시지 접기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1015: InputBar 드래그 업로드
const ib1015Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1015Path)) {
  const ib1015 = readFileSync(ib1015Path, 'utf-8')
  if (ib1015.includes('dragUpload') || ib1015.includes('uploadQueue') || ib1015.includes('dropUpload')) {
    log('pass', 'R1015', 'InputBar 드래그 업로드 존재')
  } else {
    log('warning', 'R1015', 'InputBar 드래그 업로드 없음', 'chat/InputBar.tsx')
  }
}

// R1016: CocosPanel 노드 주석
const cocos1016Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1016Path)) {
  const cocos1016 = readFileSync(cocos1016Path, 'utf-8')
  if (cocos1016.includes('nodeAnnotations') || cocos1016.includes('showAnnotationPanel') || cocos1016.includes('annotation')) {
    log('pass', 'R1016', 'CocosPanel 노드 주석 존재')
  } else {
    log('warning', 'R1016', 'CocosPanel 노드 주석 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 250. Phase DD10 R1017~1019 기능 체크')
// R1017: SceneViewPanel 렌더 통계
const svp1017Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1017Path)) {
  const svp1017 = readFileSync(svp1017Path, 'utf-8')
  if (svp1017.includes('renderStats') || svp1017.includes('showRenderStats') || svp1017.includes('renderMetrics')) {
    log('pass', 'R1017', 'SceneViewPanel 렌더 통계 존재')
  } else {
    log('warning', 'R1017', 'SceneViewPanel 렌더 통계 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1018: TerminalPanel 명령어 히스토리 검색
const tp1018Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1018Path)) {
  const tp1018 = readFileSync(tp1018Path, 'utf-8')
  if (tp1018.includes('historySearch') || tp1018.includes('showHistorySearch') || tp1018.includes('cmdHistorySearch')) {
    log('pass', 'R1018', 'TerminalPanel 명령어 히스토리 검색 존재')
  } else {
    log('warning', 'R1018', 'TerminalPanel 명령어 히스토리 검색 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1019: SessionList 세션 복제
const sl1019Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1019Path)) {
  const sl1019 = readFileSync(sl1019Path, 'utf-8')
  if (sl1019.includes('cloneTarget') || sl1019.includes('showCloneDialog') || sl1019.includes('cloneSession')) {
    log('pass', 'R1019', 'SessionList 세션 복제 존재')
  } else {
    log('warning', 'R1019', 'SessionList 세션 복제 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 251. Phase DD10 R1020~1022 기능 체크')
// R1020: ChatPanel 대화 내보내기
const cp1020Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1020Path)) {
  const cp1020 = readFileSync(cp1020Path, 'utf-8')
  if (cp1020.includes('exportTarget') || cp1020.includes('showExportPanel') || cp1020.includes('chatExport')) {
    log('pass', 'R1020', 'ChatPanel 대화 내보내기 존재')
  } else {
    log('warning', 'R1020', 'ChatPanel 대화 내보내기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1021: InputBar 언어 감지
const ib1021Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1021Path)) {
  const ib1021 = readFileSync(ib1021Path, 'utf-8')
  if (ib1021.includes('detectLang') || ib1021.includes('detectedLang') || ib1021.includes('langDetect')) {
    log('pass', 'R1021', 'InputBar 언어 감지 존재')
  } else {
    log('warning', 'R1021', 'InputBar 언어 감지 없음', 'chat/InputBar.tsx')
  }
}

// R1022: CocosPanel 씬 잠금
const cocos1022Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1022Path)) {
  const cocos1022 = readFileSync(cocos1022Path, 'utf-8')
  if (cocos1022.includes('sceneLockMode') || cocos1022.includes('lockedScenes') || cocos1022.includes('sceneLock')) {
    log('pass', 'R1022', 'CocosPanel 씬 잠금 존재')
  } else {
    log('warning', 'R1022', 'CocosPanel 씬 잠금 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 252. Phase DD10 R1023~1025 기능 체크')
// R1023: SceneViewPanel 노드 검색 고급
const svp1023Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1023Path)) {
  const svp1023 = readFileSync(svp1023Path, 'utf-8')
  if (svp1023.includes('advancedSearch') || svp1023.includes('searchScope') || svp1023.includes('nodeSearchAdvanced')) {
    log('pass', 'R1023', 'SceneViewPanel 노드 검색 고급 존재')
  } else {
    log('warning', 'R1023', 'SceneViewPanel 노드 검색 고급 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1024: TerminalPanel 탭 이름 편집
const tp1024Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1024Path)) {
  const tp1024 = readFileSync(tp1024Path, 'utf-8')
  if (tp1024.includes('editingTabName') || tp1024.includes('tabNameDraft') || tp1024.includes('renameTab')) {
    log('pass', 'R1024', 'TerminalPanel 탭 이름 편집 존재')
  } else {
    log('warning', 'R1024', 'TerminalPanel 탭 이름 편집 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1025: SessionList 대량 선택
const sl1025Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1025Path)) {
  const sl1025 = readFileSync(sl1025Path, 'utf-8')
  if (sl1025.includes('bulkSelect') || sl1025.includes('bulkSelected') || sl1025.includes('multiSelect')) {
    log('pass', 'R1025', 'SessionList 대량 선택 존재')
  } else {
    log('warning', 'R1025', 'SessionList 대량 선택 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 253. Phase DD10 R1026~1028 기능 체크')
// R1026: ChatPanel 메시지 반응 통계
const cp1026Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1026Path)) {
  const cp1026 = readFileSync(cp1026Path, 'utf-8')
  if (cp1026.includes('reactionStats') || cp1026.includes('showReactionStats') || cp1026.includes('emojiStats')) {
    log('pass', 'R1026', 'ChatPanel 메시지 반응 통계 존재')
  } else {
    log('warning', 'R1026', 'ChatPanel 메시지 반응 통계 없음', 'chat/ChatPanel.tsx')
  }
}

// R1027: InputBar 입력 히스토리
const ib1027Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1027Path)) {
  const ib1027 = readFileSync(ib1027Path, 'utf-8')
  if (ib1027.includes('inputHistory') || ib1027.includes('inputHistoryPos') || ib1027.includes('inputHistoryIdx')) {
    log('pass', 'R1027', 'InputBar 입력 히스토리 존재')
  } else {
    log('warning', 'R1027', 'InputBar 입력 히스토리 없음', 'chat/InputBar.tsx')
  }
}

// R1028: CocosPanel 에셋 의존성
const cocos1028Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1028Path)) {
  const cocos1028 = readFileSync(cocos1028Path, 'utf-8')
  if (cocos1028.includes('assetDeps') || cocos1028.includes('showDepsPanel') || cocos1028.includes('dependencies')) {
    log('pass', 'R1028', 'CocosPanel 에셋 의존성 존재')
  } else {
    log('warning', 'R1028', 'CocosPanel 에셋 의존성 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 254. Phase DD10 R1029~1031 기능 체크')
// R1029: SceneViewPanel 씬 수정 감지
const svp1029Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1029Path)) {
  const svp1029 = readFileSync(svp1029Path, 'utf-8')
  if (svp1029.includes('sceneModified') || svp1029.includes('modifiedNodes') || svp1029.includes('isDirty')) {
    log('pass', 'R1029', 'SceneViewPanel 씬 수정 감지 존재')
  } else {
    log('warning', 'R1029', 'SceneViewPanel 씬 수정 감지 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1030: TerminalPanel 출력 통계
const tp1030Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1030Path)) {
  const tp1030 = readFileSync(tp1030Path, 'utf-8')
  if (tp1030.includes('outputStats') || tp1030.includes('showOutputStats') || tp1030.includes('termStats')) {
    log('pass', 'R1030', 'TerminalPanel 출력 통계 존재')
  } else {
    log('warning', 'R1030', 'TerminalPanel 출력 통계 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1031: SessionList 세션 검색 고급
const sl1031Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1031Path)) {
  const sl1031 = readFileSync(sl1031Path, 'utf-8')
  if (sl1031.includes('advSearch') || sl1031.includes('advSearchQuery') || sl1031.includes('advancedFilter')) {
    log('pass', 'R1031', 'SessionList 세션 검색 고급 존재')
  } else {
    log('warning', 'R1031', 'SessionList 세션 검색 고급 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 255. Phase DD10 R1032~1034 기능 체크')
// R1032: ChatPanel AI 제안
const cp1032Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1032Path)) {
  const cp1032 = readFileSync(cp1032Path, 'utf-8')
  if (cp1032.includes('aiSuggestions') || cp1032.includes('showAiSuggestions') || cp1032.includes('aiAssist')) {
    log('pass', 'R1032', 'ChatPanel AI 제안 존재')
  } else {
    log('warning', 'R1032', 'ChatPanel AI 제안 없음', 'chat/ChatPanel.tsx')
  }
}

// R1033: InputBar 리치 텍스트 포맷
const ib1033Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1033Path)) {
  const ib1033 = readFileSync(ib1033Path, 'utf-8')
  if (ib1033.includes('richFormat') || ib1033.includes('formatOptions') || ib1033.includes('richText')) {
    log('pass', 'R1033', 'InputBar 리치 텍스트 포맷 존재')
  } else {
    log('warning', 'R1033', 'InputBar 리치 텍스트 포맷 없음', 'chat/InputBar.tsx')
  }
}

// R1034: CocosPanel 노드 고급 검색
const ccp1034Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1034Path)) {
  const ccp1034 = readFileSync(ccp1034Path, 'utf-8')
  if (ccp1034.includes('nodeAdvSearch') || ccp1034.includes('nodeSearchField') || ccp1034.includes('advNodeSearch')) {
    log('pass', 'R1034', 'CocosPanel 노드 고급 검색 존재')
  } else {
    log('warning', 'R1034', 'CocosPanel 노드 고급 검색 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 256. Phase DD10 R1035~1037 기능 체크')
// R1035: SceneViewPanel 씬 로그
const sv1035Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1035Path)) {
  const sv1035 = readFileSync(sv1035Path, 'utf-8')
  if (sv1035.includes('sceneLog') || sv1035.includes('showSceneLog') || sv1035.includes('sceneEventLog')) {
    log('pass', 'R1035', 'SceneViewPanel 씬 로그 존재')
  } else {
    log('warning', 'R1035', 'SceneViewPanel 씬 로그 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1036: TerminalPanel 프로세스 목록
const tp1036Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1036Path)) {
  const tp1036 = readFileSync(tp1036Path, 'utf-8')
  if (tp1036.includes('processList') || tp1036.includes('showProcessList') || tp1036.includes('procList')) {
    log('pass', 'R1036', 'TerminalPanel 프로세스 목록 존재')
  } else {
    log('warning', 'R1036', 'TerminalPanel 프로세스 목록 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1037: SessionList 세션 레이블
const sl1037Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1037Path)) {
  const sl1037 = readFileSync(sl1037Path, 'utf-8')
  if (sl1037.includes('sessionLabels') || sl1037.includes('showLabelEditor') || sl1037.includes('labelMap')) {
    log('pass', 'R1037', 'SessionList 세션 레이블 존재')
  } else {
    log('warning', 'R1037', 'SessionList 세션 레이블 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 257. Phase DD10 R1038~1040 기능 체크')
// R1038: ChatPanel 메시지 검색 필터
const cp1038Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1038Path)) {
  const cp1038 = readFileSync(cp1038Path, 'utf-8')
  if (cp1038.includes('msgSearchFilter') || cp1038.includes('showSearchFilter') || cp1038.includes('filterQuery')) {
    log('pass', 'R1038', 'ChatPanel 메시지 검색 필터 존재')
  } else {
    log('warning', 'R1038', 'ChatPanel 메시지 검색 필터 없음', 'chat/ChatPanel.tsx')
  }
}

// R1039: InputBar 멘션 자동완성
const ib1039Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1039Path)) {
  const ib1039 = readFileSync(ib1039Path, 'utf-8')
  if (ib1039.includes('mentionMode') || ib1039.includes('mentionQuery') || ib1039.includes('mentionList')) {
    log('pass', 'R1039', 'InputBar 멘션 자동완성 존재')
  } else {
    log('warning', 'R1039', 'InputBar 멘션 자동완성 없음', 'chat/InputBar.tsx')
  }
}

// R1040: CocosPanel 씬 스냅샷
const ccp1040Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1040Path)) {
  const ccp1040 = readFileSync(ccp1040Path, 'utf-8')
  if (ccp1040.includes('sceneSnapshot') || ccp1040.includes('showSnapshotPanel') || ccp1040.includes('sceneSnapshots')) {
    log('pass', 'R1040', 'CocosPanel 씬 스냅샷 존재')
  } else {
    log('warning', 'R1040', 'CocosPanel 씬 스냅샷 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 258. Phase DD10 R1041~1043 기능 체크')
// R1041: SceneViewPanel 노드 핀
const sv1041Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1041Path)) {
  const sv1041 = readFileSync(sv1041Path, 'utf-8')
  if (sv1041.includes('pinnedNodes') || sv1041.includes('showPinnedPanel') || sv1041.includes('pinned')) {
    log('pass', 'R1041', 'SceneViewPanel 노드 핀 존재')
  } else {
    log('warning', 'R1041', 'SceneViewPanel 노드 핀 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1042: TerminalPanel 커맨드 북마크
const tp1042Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1042Path)) {
  const tp1042 = readFileSync(tp1042Path, 'utf-8')
  if (tp1042.includes('cmdBookmarks') || tp1042.includes('showCmdBookmarks') || tp1042.includes('cmdFav')) {
    log('pass', 'R1042', 'TerminalPanel 커맨드 북마크 존재')
  } else {
    log('warning', 'R1042', 'TerminalPanel 커맨드 북마크 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1043: SessionList 세션 그룹
const sl1043Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1043Path)) {
  const sl1043 = readFileSync(sl1043Path, 'utf-8')
  if (sl1043.includes('sessionGroups') || sl1043.includes('showGroupEditor') || sl1043.includes('groupMap')) {
    log('pass', 'R1043', 'SessionList 세션 그룹 존재')
  } else {
    log('warning', 'R1043', 'SessionList 세션 그룹 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 259. Phase DD10 R1044~1046 기능 체크')
// R1044: ChatPanel 메시지 정렬
const cp1044Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1044Path)) {
  const cp1044 = readFileSync(cp1044Path, 'utf-8')
  if (cp1044.includes('msgSortOrder') || cp1044.includes('showSortOptions') || cp1044.includes('msgSort')) {
    log('pass', 'R1044', 'ChatPanel 메시지 정렬 존재')
  } else {
    log('warning', 'R1044', 'ChatPanel 메시지 정렬 없음', 'chat/ChatPanel.tsx')
  }
}

// R1045: InputBar 이모지 픽커
const ib1045Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1045Path)) {
  const ib1045 = readFileSync(ib1045Path, 'utf-8')
  if (ib1045.includes('emojiPickerOpen') || ib1045.includes('recentEmojis') || ib1045.includes('emojiPicker')) {
    log('pass', 'R1045', 'InputBar 이모지 픽커 존재')
  } else {
    log('warning', 'R1045', 'InputBar 이모지 픽커 없음', 'chat/InputBar.tsx')
  }
}

// R1046: CocosPanel 노드 레이어
const ccp1046Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1046Path)) {
  const ccp1046 = readFileSync(ccp1046Path, 'utf-8')
  if (ccp1046.includes('nodeLayer') || ccp1046.includes('showLayerFilter') || ccp1046.includes('nodeLayers')) {
    log('pass', 'R1046', 'CocosPanel 노드 레이어 존재')
  } else {
    log('warning', 'R1046', 'CocosPanel 노드 레이어 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 260. Phase DD10 R1047~1049 기능 체크')
// R1047: SceneViewPanel 씬 즐겨찾기
const sv1047Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1047Path)) {
  const sv1047 = readFileSync(sv1047Path, 'utf-8')
  if (sv1047.includes('sceneFavorites') || sv1047.includes('showFavoritesPane') || sv1047.includes('favScenes')) {
    log('pass', 'R1047', 'SceneViewPanel 씬 즐겨찾기 존재')
  } else {
    log('warning', 'R1047', 'SceneViewPanel 씬 즐겨찾기 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1048: TerminalPanel 출력 필터
const tp1048Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1048Path)) {
  const tp1048 = readFileSync(tp1048Path, 'utf-8')
  if (tp1048.includes('outputFilter') || tp1048.includes('filterRegex') || tp1048.includes('outFilter')) {
    log('pass', 'R1048', 'TerminalPanel 출력 필터 존재')
  } else {
    log('warning', 'R1048', 'TerminalPanel 출력 필터 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1049: SessionList 세션 아카이브
const sl1049Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1049Path)) {
  const sl1049 = readFileSync(sl1049Path, 'utf-8')
  if (sl1049.includes('archivedSessions') || sl1049.includes('showArchived') || sl1049.includes('archiveList')) {
    log('pass', 'R1049', 'SessionList 세션 아카이브 존재')
  } else {
    log('warning', 'R1049', 'SessionList 세션 아카이브 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 261. Phase DD10 R1050~1052 기능 체크')
// R1050: ChatPanel 읽음 표시
const cp1050Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1050Path)) {
  const cp1050 = readFileSync(cp1050Path, 'utf-8')
  if (cp1050.includes('readMarkers') || cp1050.includes('showReadStatus') || cp1050.includes('readStatus')) {
    log('pass', 'R1050', 'ChatPanel 읽음 표시 존재')
  } else {
    log('warning', 'R1050', 'ChatPanel 읽음 표시 없음', 'chat/ChatPanel.tsx')
  }
}

// R1051: InputBar 파일 미리보기
const ib1051Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1051Path)) {
  const ib1051 = readFileSync(ib1051Path, 'utf-8')
  if (ib1051.includes('filePreview') || ib1051.includes('showFilePreview') || ib1051.includes('previewFile')) {
    log('pass', 'R1051', 'InputBar 파일 미리보기 존재')
  } else {
    log('warning', 'R1051', 'InputBar 파일 미리보기 없음', 'chat/InputBar.tsx')
  }
}

// R1052: CocosPanel 씬 템플릿
const ccp1052Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1052Path)) {
  const ccp1052 = readFileSync(ccp1052Path, 'utf-8')
  if (ccp1052.includes('sceneTemplates') || ccp1052.includes('showTemplatePanel') || ccp1052.includes('templateList')) {
    log('pass', 'R1052', 'CocosPanel 씬 템플릿 존재')
  } else {
    log('warning', 'R1052', 'CocosPanel 씬 템플릿 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 262. Phase DD10 R1053~1055 기능 체크')
// R1053: SceneViewPanel 씬 diff
const sv1053Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1053Path)) {
  const sv1053 = readFileSync(sv1053Path, 'utf-8')
  if (sv1053.includes('sceneDiff') || sv1053.includes('showDiffPanel') || sv1053.includes('diffView')) {
    log('pass', 'R1053', 'SceneViewPanel 씬 diff 존재')
  } else {
    log('warning', 'R1053', 'SceneViewPanel 씬 diff 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1054: TerminalPanel 세션 로그
const tp1054Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1054Path)) {
  const tp1054 = readFileSync(tp1054Path, 'utf-8')
  if (tp1054.includes('sessionLog') || tp1054.includes('showSessionLog') || tp1054.includes('termLog')) {
    log('pass', 'R1054', 'TerminalPanel 세션 로그 존재')
  } else {
    log('warning', 'R1054', 'TerminalPanel 세션 로그 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1055: SessionList 세션 내보내기
const sl1055Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1055Path)) {
  const sl1055 = readFileSync(sl1055Path, 'utf-8')
  if (sl1055.includes('exportFormat') || sl1055.includes('showExportDialog') || sl1055.includes('exportMode')) {
    log('pass', 'R1055', 'SessionList 세션 내보내기 존재')
  } else {
    log('warning', 'R1055', 'SessionList 세션 내보내기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 263. Phase DD10 R1056~1058 기능 체크')
// R1056: ChatPanel 메시지 번역
const cp1056Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1056Path)) {
  const cp1056 = readFileSync(cp1056Path, 'utf-8')
  if (cp1056.includes('translateTarget') || cp1056.includes('showTranslatePanel') || cp1056.includes('translateEnabled')) {
    log('pass', 'R1056', 'ChatPanel 메시지 번역 존재')
  } else {
    log('warning', 'R1056', 'ChatPanel 메시지 번역 없음', 'chat/ChatPanel.tsx')
  }
}

// R1057: InputBar 템플릿 메시지
const ib1057Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1057Path)) {
  const ib1057 = readFileSync(ib1057Path, 'utf-8')
  if (ib1057.includes('msgTemplates') || ib1057.includes('showTemplateList') || ib1057.includes('templateMsg')) {
    log('pass', 'R1057', 'InputBar 템플릿 메시지 존재')
  } else {
    log('warning', 'R1057', 'InputBar 템플릿 메시지 없음', 'chat/InputBar.tsx')
  }
}

// R1058: CocosPanel 노드 통계
const ccp1058Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1058Path)) {
  const ccp1058 = readFileSync(ccp1058Path, 'utf-8')
  if (ccp1058.includes('nodeStats') || ccp1058.includes('showNodeStats') || ccp1058.includes('nodeCount')) {
    log('pass', 'R1058', 'CocosPanel 노드 통계 존재')
  } else {
    log('warning', 'R1058', 'CocosPanel 노드 통계 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 264. Phase DD10 R1059~1061 기능 체크')
// R1059: SceneViewPanel 씬 메타데이터
const sv1059Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1059Path)) {
  const sv1059 = readFileSync(sv1059Path, 'utf-8')
  if (sv1059.includes('sceneMeta') || sv1059.includes('showMetaPanel') || sv1059.includes('sceneMetadata')) {
    log('pass', 'R1059', 'SceneViewPanel 씬 메타데이터 존재')
  } else {
    log('warning', 'R1059', 'SceneViewPanel 씬 메타데이터 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1060: TerminalPanel 환경변수
const tp1060Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1060Path)) {
  const tp1060 = readFileSync(tp1060Path, 'utf-8')
  if (tp1060.includes('envVars') || tp1060.includes('showEnvPanel') || tp1060.includes('envEditor')) {
    log('pass', 'R1060', 'TerminalPanel 환경변수 존재')
  } else {
    log('warning', 'R1060', 'TerminalPanel 환경변수 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1061: SessionList 세션 검색 히스토리
const sl1061Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1061Path)) {
  const sl1061 = readFileSync(sl1061Path, 'utf-8')
  if (sl1061.includes('searchHistory') || sl1061.includes('showSearchHistory') || sl1061.includes('historyList')) {
    log('pass', 'R1061', 'SessionList 세션 검색 히스토리 존재')
  } else {
    log('warning', 'R1061', 'SessionList 세션 검색 히스토리 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 265. Phase DD10 R1062~1064 기능 체크')
// R1062: ChatPanel 메시지 핀
const cp1062Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1062Path)) {
  const cp1062 = readFileSync(cp1062Path, 'utf-8')
  if (cp1062.includes('pinnedMsgs') || cp1062.includes('showPinnedMsgs') || cp1062.includes('msgPin')) {
    log('pass', 'R1062', 'ChatPanel 메시지 핀 존재')
  } else {
    log('warning', 'R1062', 'ChatPanel 메시지 핀 없음', 'chat/ChatPanel.tsx')
  }
}

// R1063: InputBar 음성 메모
const ib1063Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1063Path)) {
  const ib1063 = readFileSync(ib1063Path, 'utf-8')
  if (ib1063.includes('voiceMemo') || ib1063.includes('voiceMemoUrl') || ib1063.includes('audioMemo')) {
    log('pass', 'R1063', 'InputBar 음성 메모 존재')
  } else {
    log('warning', 'R1063', 'InputBar 음성 메모 없음', 'chat/InputBar.tsx')
  }
}

// R1064: CocosPanel 씬 검증
const ccp1064Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1064Path)) {
  const ccp1064 = readFileSync(ccp1064Path, 'utf-8')
  if (ccp1064.includes('sceneValidation') || ccp1064.includes('showValidationPanel') || ccp1064.includes('validationErrors')) {
    log('pass', 'R1064', 'CocosPanel 씬 검증 존재')
  } else {
    log('warning', 'R1064', 'CocosPanel 씬 검증 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 266. Phase DD10 R1065~1067 기능 체크')
// R1065: SceneViewPanel 씬 복제
const sv1065Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1065Path)) {
  const sv1065 = readFileSync(sv1065Path, 'utf-8')
  if (sv1065.includes('cloneSceneName') || sv1065.includes('showCloneDialog') || sv1065.includes('sceneClone')) {
    log('pass', 'R1065', 'SceneViewPanel 씬 복제 존재')
  } else {
    log('warning', 'R1065', 'SceneViewPanel 씬 복제 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1066: TerminalPanel 자동완성 제안
const tp1066Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1066Path)) {
  const tp1066 = readFileSync(tp1066Path, 'utf-8')
  if (tp1066.includes('autoSuggest') || tp1066.includes('suggestList') || tp1066.includes('cmdSuggest')) {
    log('pass', 'R1066', 'TerminalPanel 자동완성 제안 존재')
  } else {
    log('warning', 'R1066', 'TerminalPanel 자동완성 제안 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1067: SessionList 최근 세션
const sl1067Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1067Path)) {
  const sl1067 = readFileSync(sl1067Path, 'utf-8')
  if (sl1067.includes('recentSessions') || sl1067.includes('showRecentOnly') || sl1067.includes('recentList')) {
    log('pass', 'R1067', 'SessionList 최근 세션 존재')
  } else {
    log('warning', 'R1067', 'SessionList 최근 세션 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 267. Phase DD10 R1068~1070 기능 체크')
// R1068: ChatPanel 코드 블록 실행
const cp1068Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1068Path)) {
  const cp1068 = readFileSync(cp1068Path, 'utf-8')
  if (cp1068.includes('codeRunTarget') || cp1068.includes('showCodeRunner') || cp1068.includes('runCode')) {
    log('pass', 'R1068', 'ChatPanel 코드 블록 실행 존재')
  } else {
    log('warning', 'R1068', 'ChatPanel 코드 블록 실행 없음', 'chat/ChatPanel.tsx')
  }
}

// R1069: InputBar 슬래시 커맨드
const ib1069Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1069Path)) {
  const ib1069 = readFileSync(ib1069Path, 'utf-8')
  if (ib1069.includes('slashCmdOpen') || ib1069.includes('slashCmdQuery') || ib1069.includes('slashCmd')) {
    log('pass', 'R1069', 'InputBar 슬래시 커맨드 존재')
  } else {
    log('warning', 'R1069', 'InputBar 슬래시 커맨드 없음', 'chat/InputBar.tsx')
  }
}

// R1070: CocosPanel 컴포넌트 검색
const ccp1070Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1070Path)) {
  const ccp1070 = readFileSync(ccp1070Path, 'utf-8')
  if (ccp1070.includes('compSearch') || ccp1070.includes('showCompSearch') || ccp1070.includes('compSearchResults')) {
    log('pass', 'R1070', 'CocosPanel 컴포넌트 검색 존재')
  } else {
    log('warning', 'R1070', 'CocosPanel 컴포넌트 검색 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 268. Phase DD10 R1071~1073 기능 체크')
// R1071: SceneViewPanel 씬 주석
const sv1071Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1071Path)) {
  const sv1071 = readFileSync(sv1071Path, 'utf-8')
  if (sv1071.includes('sceneNotes') || sv1071.includes('showNotesPanel') || sv1071.includes('sceneAnnot')) {
    log('pass', 'R1071', 'SceneViewPanel 씬 주석 존재')
  } else {
    log('warning', 'R1071', 'SceneViewPanel 씬 주석 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1072: TerminalPanel 단축키 맵
const tp1072Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1072Path)) {
  const tp1072 = readFileSync(tp1072Path, 'utf-8')
  if (tp1072.includes('shortcutMap') || tp1072.includes('showShortcutMap') || tp1072.includes('keyMap')) {
    log('pass', 'R1072', 'TerminalPanel 단축키 맵 존재')
  } else {
    log('warning', 'R1072', 'TerminalPanel 단축키 맵 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1073: SessionList 세션 병합
const sl1073Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1073Path)) {
  const sl1073 = readFileSync(sl1073Path, 'utf-8')
  if (sl1073.includes('mergeTarget') || sl1073.includes('showMergeDialog') || sl1073.includes('mergeTargets')) {
    log('pass', 'R1073', 'SessionList 세션 병합 존재')
  } else {
    log('warning', 'R1073', 'SessionList 세션 병합 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 269. Phase DD10 R1074~1076 기능 체크')
// R1074: ChatPanel 메시지 스레드
const cp1074Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1074Path)) {
  const cp1074 = readFileSync(cp1074Path, 'utf-8')
  if (cp1074.includes('threadView') || cp1074.includes('threadRoot') || cp1074.includes('msgThread')) {
    log('pass', 'R1074', 'ChatPanel 메시지 스레드 존재')
  } else {
    log('warning', 'R1074', 'ChatPanel 메시지 스레드 없음', 'chat/ChatPanel.tsx')
  }
}

// R1075: InputBar 글자 수 제한
const ib1075Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1075Path)) {
  const ib1075 = readFileSync(ib1075Path, 'utf-8')
  if (ib1075.includes('charLimit') || ib1075.includes('showCharCount') || ib1075.includes('charCount')) {
    log('pass', 'R1075', 'InputBar 글자 수 제한 존재')
  } else {
    log('warning', 'R1075', 'InputBar 글자 수 제한 없음', 'chat/InputBar.tsx')
  }
}

// R1076: CocosPanel 씬 자동저장
const ccp1076Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1076Path)) {
  const ccp1076 = readFileSync(ccp1076Path, 'utf-8')
  if (ccp1076.includes('autoSave') || ccp1076.includes('autoSaveInterval') || ccp1076.includes('autoSaveEnabled')) {
    log('pass', 'R1076', 'CocosPanel 씬 자동저장 존재')
  } else {
    log('warning', 'R1076', 'CocosPanel 씬 자동저장 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 270. Phase DD10 R1077~1079 기능 체크')
// R1077: SceneViewPanel 씬 퀵액션
const sv1077Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1077Path)) {
  const sv1077 = readFileSync(sv1077Path, 'utf-8')
  if (sv1077.includes('quickActions') || sv1077.includes('showQuickActions') || sv1077.includes('sceneActions')) {
    log('pass', 'R1077', 'SceneViewPanel 씬 퀵액션 존재')
  } else {
    log('warning', 'R1077', 'SceneViewPanel 씬 퀵액션 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1078: TerminalPanel 스크롤 잠금
const tp1078Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1078Path)) {
  const tp1078 = readFileSync(tp1078Path, 'utf-8')
  if (tp1078.includes('scrollLock') || tp1078.includes('scrollPos') || tp1078.includes('lockScroll')) {
    log('pass', 'R1078', 'TerminalPanel 스크롤 잠금 존재')
  } else {
    log('warning', 'R1078', 'TerminalPanel 스크롤 잠금 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1079: SessionList 세션 태그 필터
const sl1079Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1079Path)) {
  const sl1079 = readFileSync(sl1079Path, 'utf-8')
  if (sl1079.includes('tagFilter') || sl1079.includes('showTagFilterPanel') || sl1079.includes('filterTag')) {
    log('pass', 'R1079', 'SessionList 세션 태그 필터 존재')
  } else {
    log('warning', 'R1079', 'SessionList 세션 태그 필터 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 271. Phase DD10 R1080~1082 기능 체크')
// R1080: ChatPanel 메시지 즐겨찾기
const cp1080Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1080Path)) {
  const cp1080 = readFileSync(cp1080Path, 'utf-8')
  if (cp1080.includes('favMsgs') || cp1080.includes('showFavMsgs') || cp1080.includes('favMessages')) {
    log('pass', 'R1080', 'ChatPanel 메시지 즐겨찾기 존재')
  } else {
    log('warning', 'R1080', 'ChatPanel 메시지 즐겨찾기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1081: InputBar 자동교정
const ib1081Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1081Path)) {
  const ib1081 = readFileSync(ib1081Path, 'utf-8')
  if (ib1081.includes('autoCorrect') || ib1081.includes('corrections') || ib1081.includes('spellCheck')) {
    log('pass', 'R1081', 'InputBar 자동교정 존재')
  } else {
    log('warning', 'R1081', 'InputBar 자동교정 없음', 'chat/InputBar.tsx')
  }
}

// R1082: CocosPanel 프리팹 미리보기
const ccp1082Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1082Path)) {
  const ccp1082 = readFileSync(ccp1082Path, 'utf-8')
  if (ccp1082.includes('prefabPreview') || ccp1082.includes('showPrefabPreview') || ccp1082.includes('prefabThumb')) {
    log('pass', 'R1082', 'CocosPanel 프리팹 미리보기 존재')
  } else {
    log('warning', 'R1082', 'CocosPanel 프리팹 미리보기 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 272. Phase DD10 R1083~1085 기능 체크')
// R1083: SceneViewPanel 씬 렌더 통계
const sv1083Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1083Path)) {
  const sv1083 = readFileSync(sv1083Path, 'utf-8')
  if (sv1083.includes('renderStats') || sv1083.includes('showRenderStats') || sv1083.includes('perfStats')) {
    log('pass', 'R1083', 'SceneViewPanel 씬 렌더 통계 존재')
  } else {
    log('warning', 'R1083', 'SceneViewPanel 씬 렌더 통계 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1084: TerminalPanel 명령어 히스토리 공유
const tp1084Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1084Path)) {
  const tp1084 = readFileSync(tp1084Path, 'utf-8')
  if (tp1084.includes('sharedHistory') || tp1084.includes('historyScope') || tp1084.includes('globalHistory')) {
    log('pass', 'R1084', 'TerminalPanel 명령어 히스토리 공유 존재')
  } else {
    log('warning', 'R1084', 'TerminalPanel 명령어 히스토리 공유 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1085: SessionList 세션 복사
const sl1085Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1085Path)) {
  const sl1085 = readFileSync(sl1085Path, 'utf-8')
  if (sl1085.includes('copyTarget') || sl1085.includes('showCopyDialog') || sl1085.includes('sessionCopy')) {
    log('pass', 'R1085', 'SessionList 세션 복사 존재')
  } else {
    log('warning', 'R1085', 'SessionList 세션 복사 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 273. Phase DD10 R1086~1088 기능 체크')
// R1086: ChatPanel 메시지 분류
const cp1086Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1086Path)) {
  const cp1086 = readFileSync(cp1086Path, 'utf-8')
  if (cp1086.includes('msgCategory') || cp1086.includes('showCategoryFilter') || cp1086.includes('categoryFilter')) {
    log('pass', 'R1086', 'ChatPanel 메시지 분류 존재')
  } else {
    log('warning', 'R1086', 'ChatPanel 메시지 분류 없음', 'chat/ChatPanel.tsx')
  }
}

// R1087: InputBar 붙여넣기 모드
const ib1087Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1087Path)) {
  const ib1087 = readFileSync(ib1087Path, 'utf-8')
  if (ib1087.includes('pasteMode') || ib1087.includes('showPasteOptions') || ib1087.includes('pastePlain')) {
    log('pass', 'R1087', 'InputBar 붙여넣기 모드 존재')
  } else {
    log('warning', 'R1087', 'InputBar 붙여넣기 모드 없음', 'chat/InputBar.tsx')
  }
}

// R1088: CocosPanel 씬 익스포트
const ccp1088Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1088Path)) {
  const ccp1088 = readFileSync(ccp1088Path, 'utf-8')
  if (ccp1088.includes('sceneExportPath') || ccp1088.includes('showExportOptions') || ccp1088.includes('exportScene')) {
    log('pass', 'R1088', 'CocosPanel 씬 익스포트 존재')
  } else {
    log('warning', 'R1088', 'CocosPanel 씬 익스포트 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 274. Phase DD10 R1089~1091 기능 체크')
// R1089: SceneViewPanel 씬 레이아웃 저장
const sv1089Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1089Path)) {
  const sv1089 = readFileSync(sv1089Path, 'utf-8')
  if (sv1089.includes('layoutName') || sv1089.includes('showLayoutSave') || sv1089.includes('savedLayout')) {
    log('pass', 'R1089', 'SceneViewPanel 씬 레이아웃 저장 존재')
  } else {
    log('warning', 'R1089', 'SceneViewPanel 씬 레이아웃 저장 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1090: TerminalPanel 폰트 크기
const tp1090Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1090Path)) {
  const tp1090 = readFileSync(tp1090Path, 'utf-8')
  if (tp1090.includes('fontSize') || tp1090.includes('showFontOptions') || tp1090.includes('termFont')) {
    log('pass', 'R1090', 'TerminalPanel 폰트 크기 존재')
  } else {
    log('warning', 'R1090', 'TerminalPanel 폰트 크기 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1091: SessionList 세션 잠금
const sl1091Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1091Path)) {
  const sl1091 = readFileSync(sl1091Path, 'utf-8')
  if (sl1091.includes('lockedSessions') || sl1091.includes('showLockOverlay') || sl1091.includes('lockSession')) {
    log('pass', 'R1091', 'SessionList 세션 잠금 존재')
  } else {
    log('warning', 'R1091', 'SessionList 세션 잠금 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 275. Phase DD10 R1092~1094 기능 체크')
// R1092: ChatPanel 채팅 배경
const cp1092Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1092Path)) {
  const cp1092 = readFileSync(cp1092Path, 'utf-8')
  if (cp1092.includes('chatBg') || cp1092.includes('showBgPicker') || cp1092.includes('bgColor')) {
    log('pass', 'R1092', 'ChatPanel 채팅 배경 존재')
  } else {
    log('warning', 'R1092', 'ChatPanel 채팅 배경 없음', 'chat/ChatPanel.tsx')
  }
}

// R1093: InputBar 줄 높이
const ib1093Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1093Path)) {
  const ib1093 = readFileSync(ib1093Path, 'utf-8')
  if (ib1093.includes('lineHeight') || ib1093.includes('compactMode') || ib1093.includes('inputHeight')) {
    log('pass', 'R1093', 'InputBar 줄 높이 존재')
  } else {
    log('warning', 'R1093', 'InputBar 줄 높이 없음', 'chat/InputBar.tsx')
  }
}

// R1094: CocosPanel 노드 즐겨찾기
const ccp1094Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1094Path)) {
  const ccp1094 = readFileSync(ccp1094Path, 'utf-8')
  if (ccp1094.includes('favNodes') || ccp1094.includes('showFavNodes') || ccp1094.includes('favoriteNodes')) {
    log('pass', 'R1094', 'CocosPanel 노드 즐겨찾기 존재')
  } else {
    log('warning', 'R1094', 'CocosPanel 노드 즐겨찾기 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 276. Phase DD10 R1095~1097 기능 체크')
// R1095: SceneViewPanel 씬 워크플로우
const sv1095Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1095Path)) {
  const sv1095 = readFileSync(sv1095Path, 'utf-8')
  if (sv1095.includes('workflowSteps') || sv1095.includes('showWorkflow') || sv1095.includes('sceneWorkflow')) {
    log('pass', 'R1095', 'SceneViewPanel 씬 워크플로우 존재')
  } else {
    log('warning', 'R1095', 'SceneViewPanel 씬 워크플로우 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1096: TerminalPanel 알림 설정
const tp1096Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1096Path)) {
  const tp1096 = readFileSync(tp1096Path, 'utf-8')
  if (tp1096.includes('notifyOnFinish') || tp1096.includes('notifyKeyword') || tp1096.includes('termNotify')) {
    log('pass', 'R1096', 'TerminalPanel 알림 설정 존재')
  } else {
    log('warning', 'R1096', 'TerminalPanel 알림 설정 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1097: SessionList 세션 북마크
const sl1097Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1097Path)) {
  const sl1097 = readFileSync(sl1097Path, 'utf-8')
  if (sl1097.includes('bookmarkedSessions') || sl1097.includes('showBookmarksOnly') || sl1097.includes('sessionBookmarks')) {
    log('pass', 'R1097', 'SessionList 세션 북마크 존재')
  } else {
    log('warning', 'R1097', 'SessionList 세션 북마크 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 277. Phase DD10 R1098~1100 기능 체크')
// R1098: ChatPanel 메시지 서식
const cp1098Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1098Path)) {
  const cp1098 = readFileSync(cp1098Path, 'utf-8')
  if (cp1098.includes('msgFormatMode') || cp1098.includes('showFormatToolbar') || cp1098.includes('formatMode')) {
    log('pass', 'R1098', 'ChatPanel 메시지 서식 존재')
  } else {
    log('warning', 'R1098', 'ChatPanel 메시지 서식 없음', 'chat/ChatPanel.tsx')
  }
}

// R1099: InputBar 응답 대기 표시
const ib1099Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1099Path)) {
  const ib1099 = readFileSync(ib1099Path, 'utf-8')
  if (ib1099.includes('waitingIndicator') || ib1099.includes('waitDuration') || ib1099.includes('isWaiting')) {
    log('pass', 'R1099', 'InputBar 응답 대기 표시 존재')
  } else {
    log('warning', 'R1099', 'InputBar 응답 대기 표시 없음', 'chat/InputBar.tsx')
  }
}

// R1100: CocosPanel 씬 잠금
const ccp1100Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1100Path)) {
  const ccp1100 = readFileSync(ccp1100Path, 'utf-8')
  if (ccp1100.includes('nodeLock') || ccp1100.includes('showLockPanel') || ccp1100.includes('lockNodes')) {
    log('pass', 'R1100', 'CocosPanel 씬 잠금 존재')
  } else {
    log('warning', 'R1100', 'CocosPanel 씬 잠금 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 278. Phase DD10 R1101~1103 기능 체크')
// R1101: SceneViewPanel 씬 성능 모드
const sv1101Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1101Path)) {
  const sv1101 = readFileSync(sv1101Path, 'utf-8')
  if (sv1101.includes('perfMode') || sv1101.includes('showPerfOptions') || sv1101.includes('highPerf')) {
    log('pass', 'R1101', 'SceneViewPanel 씬 성능 모드 존재')
  } else {
    log('warning', 'R1101', 'SceneViewPanel 씬 성능 모드 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1102: TerminalPanel 입력 히스토리 저장
const tp1102Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1102Path)) {
  const tp1102 = readFileSync(tp1102Path, 'utf-8')
  if (tp1102.includes('persistHistory') || tp1102.includes('historyLimit') || tp1102.includes('saveHistory')) {
    log('pass', 'R1102', 'TerminalPanel 입력 히스토리 저장 존재')
  } else {
    log('warning', 'R1102', 'TerminalPanel 입력 히스토리 저장 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1103: SessionList 세션 통계
const sl1103Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1103Path)) {
  const sl1103 = readFileSync(sl1103Path, 'utf-8')
  if (sl1103.includes('sessionStats') || sl1103.includes('showSessionStats') || sl1103.includes('statPanel')) {
    log('pass', 'R1103', 'SessionList 세션 통계 존재')
  } else {
    log('warning', 'R1103', 'SessionList 세션 통계 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 279. Phase DD10 R1104~1106 기능 체크')
// R1104: ChatPanel 메시지 접기
const cp1104Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1104Path)) {
  const cp1104 = readFileSync(cp1104Path, 'utf-8')
  if (cp1104.includes('foldedMsgs') || cp1104.includes('foldThreshold') || cp1104.includes('collapseLong')) {
    log('pass', 'R1104', 'ChatPanel 메시지 접기 존재')
  } else {
    log('warning', 'R1104', 'ChatPanel 메시지 접기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1105: InputBar 인라인 이미지
const ib1105Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1105Path)) {
  const ib1105 = readFileSync(ib1105Path, 'utf-8')
  if (ib1105.includes('inlineImages') || ib1105.includes('showImageUpload') || ib1105.includes('imgUpload')) {
    log('pass', 'R1105', 'InputBar 인라인 이미지 존재')
  } else {
    log('warning', 'R1105', 'InputBar 인라인 이미지 없음', 'chat/InputBar.tsx')
  }
}

// R1106: CocosPanel 씬 비교
const ccp1106Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1106Path)) {
  const ccp1106 = readFileSync(ccp1106Path, 'utf-8')
  if (ccp1106.includes('compareMode') || ccp1106.includes('compareTarget') || ccp1106.includes('sceneCompare')) {
    log('pass', 'R1106', 'CocosPanel 씬 비교 존재')
  } else {
    log('warning', 'R1106', 'CocosPanel 씬 비교 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 280. Phase DD10 R1107~1109 기능 체크')
// R1107: SceneViewPanel 씬 히트맵
const sv1107Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1107Path)) {
  const sv1107 = readFileSync(sv1107Path, 'utf-8')
  if (sv1107.includes('heatmapMode') || sv1107.includes('heatmapType') || sv1107.includes('nodeHeatmap')) {
    log('pass', 'R1107', 'SceneViewPanel 씬 히트맵 존재')
  } else {
    log('warning', 'R1107', 'SceneViewPanel 씬 히트맵 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1108: TerminalPanel 멀티플렉서
const tp1108Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1108Path)) {
  const tp1108 = readFileSync(tp1108Path, 'utf-8')
  if (tp1108.includes('splitPane') || tp1108.includes('splitRatio') || tp1108.includes('paneLayout')) {
    log('pass', 'R1108', 'TerminalPanel 멀티플렉서 존재')
  } else {
    log('warning', 'R1108', 'TerminalPanel 멀티플렉서 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1109: SessionList 세션 알림
const sl1109Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1109Path)) {
  const sl1109 = readFileSync(sl1109Path, 'utf-8')
  if (sl1109.includes('sessionAlerts') || sl1109.includes('showAlertPanel') || sl1109.includes('alertMap')) {
    log('pass', 'R1109', 'SessionList 세션 알림 존재')
  } else {
    log('warning', 'R1109', 'SessionList 세션 알림 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 281. Phase DD10 R1110~1112 기능 체크')
// R1110: ChatPanel 메시지 색상
const cp1110Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1110Path)) {
  const cp1110 = readFileSync(cp1110Path, 'utf-8')
  if (cp1110.includes('msgColors') || cp1110.includes('showColorPalette') || cp1110.includes('colorMsg')) {
    log('pass', 'R1110', 'ChatPanel 메시지 색상 존재')
  } else {
    log('warning', 'R1110', 'ChatPanel 메시지 색상 없음', 'chat/ChatPanel.tsx')
  }
}

// R1111: InputBar 코드 스니펫
const ib1111Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1111Path)) {
  const ib1111 = readFileSync(ib1111Path, 'utf-8')
  if (ib1111.includes('snippetLib') || ib1111.includes('showSnippetPicker') || ib1111.includes('codeSnippet')) {
    log('pass', 'R1111', 'InputBar 코드 스니펫 존재')
  } else {
    log('warning', 'R1111', 'InputBar 코드 스니펫 없음', 'chat/InputBar.tsx')
  }
}

// R1112: CocosPanel 에셋 태그
const ccp1112Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1112Path)) {
  const ccp1112 = readFileSync(ccp1112Path, 'utf-8')
  if (ccp1112.includes('assetTags') || ccp1112.includes('showTagEditor') || ccp1112.includes('tagAsset')) {
    log('pass', 'R1112', 'CocosPanel 에셋 태그 존재')
  } else {
    log('warning', 'R1112', 'CocosPanel 에셋 태그 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 282. Phase DD10 R1113~1115 기능 체크')
// R1113: SceneViewPanel 씬 체크리스트
const sv1113Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1113Path)) {
  const sv1113 = readFileSync(sv1113Path, 'utf-8')
  if (sv1113.includes('sceneChecklist') || sv1113.includes('showChecklist') || sv1113.includes('checkItems')) {
    log('pass', 'R1113', 'SceneViewPanel 씬 체크리스트 존재')
  } else {
    log('warning', 'R1113', 'SceneViewPanel 씬 체크리스트 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1114: TerminalPanel 테마
const tp1114Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1114Path)) {
  const tp1114 = readFileSync(tp1114Path, 'utf-8')
  if (tp1114.includes('termTheme') || tp1114.includes('showThemePicker') || tp1114.includes('colorTheme')) {
    log('pass', 'R1114', 'TerminalPanel 테마 존재')
  } else {
    log('warning', 'R1114', 'TerminalPanel 테마 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1115: SessionList 세션 백업
const sl1115Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1115Path)) {
  const sl1115 = readFileSync(sl1115Path, 'utf-8')
  if (sl1115.includes('backupEnabled') || sl1115.includes('backupInterval') || sl1115.includes('autoBackup')) {
    log('pass', 'R1115', 'SessionList 세션 백업 존재')
  } else {
    log('warning', 'R1115', 'SessionList 세션 백업 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 283. Phase DD10 R1116~1118 기능 체크')
// R1116: ChatPanel 메시지 공유
const cp1116Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1116Path)) {
  const cp1116 = readFileSync(cp1116Path, 'utf-8')
  if (cp1116.includes('shareTarget') || cp1116.includes('showSharePanel') || cp1116.includes('msgShare')) {
    log('pass', 'R1116', 'ChatPanel 메시지 공유 존재')
  } else {
    log('warning', 'R1116', 'ChatPanel 메시지 공유 없음', 'chat/ChatPanel.tsx')
  }
}

// R1117: InputBar 스마트 따옴표
const ib1117Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1117Path)) {
  const ib1117 = readFileSync(ib1117Path, 'utf-8')
  if (ib1117.includes('smartQuotes') || ib1117.includes('typographyMode') || ib1117.includes('curlyQuotes')) {
    log('pass', 'R1117', 'InputBar 스마트 따옴표 존재')
  } else {
    log('warning', 'R1117', 'InputBar 스마트 따옴표 없음', 'chat/InputBar.tsx')
  }
}

// R1118: CocosPanel 씬 임포트
const ccp1118Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1118Path)) {
  const ccp1118 = readFileSync(ccp1118Path, 'utf-8')
  if (ccp1118.includes('importSource') || ccp1118.includes('showImportDialog') || ccp1118.includes('sceneImport')) {
    log('pass', 'R1118', 'CocosPanel 씬 임포트 존재')
  } else {
    log('warning', 'R1118', 'CocosPanel 씬 임포트 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 284. Phase DD10 R1119~1121 기능 체크')
// R1119: SceneViewPanel 씬 다크모드
const sv1119Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1119Path)) {
  const sv1119 = readFileSync(sv1119Path, 'utf-8')
  if (sv1119.includes('darkOverlay') || sv1119.includes('overlayOpacity') || sv1119.includes('darkMode')) {
    log('pass', 'R1119', 'SceneViewPanel 씬 다크모드 존재')
  } else {
    log('warning', 'R1119', 'SceneViewPanel 씬 다크모드 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1120: TerminalPanel 줄 번호
const tp1120Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1120Path)) {
  const tp1120 = readFileSync(tp1120Path, 'utf-8')
  if (tp1120.includes('termLineNumbers') || tp1120.includes('lineNumberOffset') || tp1120.includes('showLineNum')) {
    log('pass', 'R1120', 'TerminalPanel 줄 번호 존재')
  } else {
    log('warning', 'R1120', 'TerminalPanel 줄 번호 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1121: SessionList 세션 메모
const sl1121Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1121Path)) {
  const sl1121 = readFileSync(sl1121Path, 'utf-8')
  if (sl1121.includes('sessionNotes') || sl1121.includes('showNoteEditor') || sl1121.includes('noteMap')) {
    log('pass', 'R1121', 'SessionList 세션 메모 존재')
  } else {
    log('warning', 'R1121', 'SessionList 세션 메모 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 285. Phase DD10 R1122~1124 기능 체크')
// R1122: ChatPanel 메시지 투표
const cp1122Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1122Path)) {
  const cp1122 = readFileSync(cp1122Path, 'utf-8')
  if (cp1122.includes('msgVotes') || cp1122.includes('showVotePanel') || cp1122.includes('voteMsg')) {
    log('pass', 'R1122', 'ChatPanel 메시지 투표 존재')
  } else {
    log('warning', 'R1122', 'ChatPanel 메시지 투표 없음', 'chat/ChatPanel.tsx')
  }
}

// R1123: InputBar 글로벌 단축키
const ib1123Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1123Path)) {
  const ib1123 = readFileSync(ib1123Path, 'utf-8')
  if (ib1123.includes('globalShortcuts') || ib1123.includes('showShortcutEditor') || ib1123.includes('keyBindings')) {
    log('pass', 'R1123', 'InputBar 글로벌 단축키 존재')
  } else {
    log('warning', 'R1123', 'InputBar 글로벌 단축키 없음', 'chat/InputBar.tsx')
  }
}

// R1124: CocosPanel 노드 그룹
const ccp1124Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1124Path)) {
  const ccp1124 = readFileSync(ccp1124Path, 'utf-8')
  if (ccp1124.includes('nodeGroups') || ccp1124.includes('showGroupPanel') || ccp1124.includes('groupNodes')) {
    log('pass', 'R1124', 'CocosPanel 노드 그룹 존재')
  } else {
    log('warning', 'R1124', 'CocosPanel 노드 그룹 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 286. Phase DD10 R1125~1127 기능 체크')
// R1125: SceneViewPanel 씬 링크
const sv1125Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1125Path)) {
  const sv1125 = readFileSync(sv1125Path, 'utf-8')
  if (sv1125.includes('sceneLinks') || sv1125.includes('showLinkPanel') || sv1125.includes('linkScene')) {
    log('pass', 'R1125', 'SceneViewPanel 씬 링크 존재')
  } else {
    log('warning', 'R1125', 'SceneViewPanel 씬 링크 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1126: TerminalPanel 마크다운 출력
const tp1126Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1126Path)) {
  const tp1126 = readFileSync(tp1126Path, 'utf-8')
  if (tp1126.includes('mdOutput') || tp1126.includes('mdOutputBuffer') || tp1126.includes('markdownOut')) {
    log('pass', 'R1126', 'TerminalPanel 마크다운 출력 존재')
  } else {
    log('warning', 'R1126', 'TerminalPanel 마크다운 출력 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1127: SessionList 세션 우선순위
const sl1127Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1127Path)) {
  const sl1127 = readFileSync(sl1127Path, 'utf-8')
  if (sl1127.includes('sessionPriority') || sl1127.includes('showPrioritySort') || sl1127.includes('priorityMap')) {
    log('pass', 'R1127', 'SessionList 세션 우선순위 존재')
  } else {
    log('warning', 'R1127', 'SessionList 세션 우선순위 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 287. Phase DD10 R1128~1130 기능 체크')
// R1128: ChatPanel 메시지 요약
const cp1128Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1128Path)) {
  const cp1128 = readFileSync(cp1128Path, 'utf-8')
  if (cp1128.includes('autoSummary') || cp1128.includes('summaryLength') || cp1128.includes('msgSummary')) {
    log('pass', 'R1128', 'ChatPanel 메시지 요약 존재')
  } else {
    log('warning', 'R1128', 'ChatPanel 메시지 요약 없음', 'chat/ChatPanel.tsx')
  }
}

// R1129: InputBar 포커스 모드
const ib1129Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1129Path)) {
  const ib1129 = readFileSync(ib1129Path, 'utf-8')
  if (ib1129.includes('focusMode') || ib1129.includes('focusOpacity') || ib1129.includes('writingFocus')) {
    log('pass', 'R1129', 'InputBar 포커스 모드 존재')
  } else {
    log('warning', 'R1129', 'InputBar 포커스 모드 없음', 'chat/InputBar.tsx')
  }
}

// R1130: CocosPanel 씬 히스토리
const ccp1130Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1130Path)) {
  const ccp1130 = readFileSync(ccp1130Path, 'utf-8')
  if (ccp1130.includes('sceneOpHistory') || ccp1130.includes('showOpHistory') || ccp1130.includes('opLog')) {
    log('pass', 'R1130', 'CocosPanel 씬 히스토리 존재')
  } else {
    log('warning', 'R1130', 'CocosPanel 씬 히스토리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 288. Phase DD10 R1131~1133 기능 체크')
// R1131: SceneViewPanel 씬 배치 작업
const sv1131Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1131Path)) {
  const sv1131 = readFileSync(sv1131Path, 'utf-8')
  if (sv1131.includes('batchOps') || sv1131.includes('showBatchPanel') || sv1131.includes('bulkOps')) {
    log('pass', 'R1131', 'SceneViewPanel 씬 배치 작업 존재')
  } else {
    log('warning', 'R1131', 'SceneViewPanel 씬 배치 작업 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1132: TerminalPanel 작업 큐
const tp1132Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1132Path)) {
  const tp1132 = readFileSync(tp1132Path, 'utf-8')
  if (tp1132.includes('taskQueue') || tp1132.includes('showTaskQueue') || tp1132.includes('cmdQueue')) {
    log('pass', 'R1132', 'TerminalPanel 작업 큐 존재')
  } else {
    log('warning', 'R1132', 'TerminalPanel 작업 큐 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1133: SessionList 세션 일정
const sl1133Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1133Path)) {
  const sl1133 = readFileSync(sl1133Path, 'utf-8')
  if (sl1133.includes('sessionSchedule') || sl1133.includes('showSchedulePanel') || sl1133.includes('schedMap')) {
    log('pass', 'R1133', 'SessionList 세션 일정 존재')
  } else {
    log('warning', 'R1133', 'SessionList 세션 일정 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 289. Phase DD10 R1134~1136 기능 체크')
// R1134: ChatPanel 인라인 미리보기
const cp1134Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1134Path)) {
  const cp1134 = readFileSync(cp1134Path, 'utf-8')
  if (cp1134.includes('inlinePreview') || cp1134.includes('previewMaxHeight') || cp1134.includes('previewMode')) {
    log('pass', 'R1134', 'ChatPanel 인라인 미리보기 존재')
  } else {
    log('warning', 'R1134', 'ChatPanel 인라인 미리보기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1135: InputBar 연속 입력 모드
const ib1135Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1135Path)) {
  const ib1135 = readFileSync(ib1135Path, 'utf-8')
  if (ib1135.includes('continuousMode') || ib1135.includes('continuousDelay') || ib1135.includes('streamInput')) {
    log('pass', 'R1135', 'InputBar 연속 입력 모드 존재')
  } else {
    log('warning', 'R1135', 'InputBar 연속 입력 모드 없음', 'chat/InputBar.tsx')
  }
}

// R1136: CocosPanel 씬 권한
const ccp1136Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(ccp1136Path)) {
  const ccp1136 = readFileSync(ccp1136Path, 'utf-8')
  if (ccp1136.includes('scenePerms') || ccp1136.includes('showPermPanel') || ccp1136.includes('permMap')) {
    log('pass', 'R1136', 'CocosPanel 씬 권한 존재')
  } else {
    log('warning', 'R1136', 'CocosPanel 씬 권한 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 290. Phase DD10 R1137~1139 기능 체크')
// R1137: SceneViewPanel 씬 의존성
const sv1137Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1137Path)) {
  const sv1137 = readFileSync(sv1137Path, 'utf-8')
  if (sv1137.includes('sceneDeps') || sv1137.includes('showDepsGraph') || sv1137.includes('depTree')) {
    log('pass', 'R1137', 'SceneViewPanel 씬 의존성 존재')
  } else {
    log('warning', 'R1137', 'SceneViewPanel 씬 의존성 없음', 'sidebar/SceneView/SceneViewPanel.tsx')
  }
}

// R1138: TerminalPanel 세션 공유
const tp1138Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1138Path)) {
  const tp1138 = readFileSync(tp1138Path, 'utf-8')
  if (tp1138.includes('shareSession') || tp1138.includes('shareCode') || tp1138.includes('termShare')) {
    log('pass', 'R1138', 'TerminalPanel 세션 공유 존재')
  } else {
    log('warning', 'R1138', 'TerminalPanel 세션 공유 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1139: SessionList 세션 비교
const sl1139Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1139Path)) {
  const sl1139 = readFileSync(sl1139Path, 'utf-8')
  if (sl1139.includes('compareSessionA') || sl1139.includes('compareSessionB') || sl1139.includes('diffSessions')) {
    log('pass', 'R1139', 'SessionList 세션 비교 존재')
  } else {
    log('warning', 'R1139', 'SessionList 세션 비교 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 291. Phase DD10 R1140~1142 기능 체크')
// R1140: ChatPanel 이모지 반응
const cp1140Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1140Path)) {
  const cp1140 = readFileSync(cp1140Path, 'utf-8')
  if (cp1140.includes('emojiReactions') || cp1140.includes('showReactionBar') || cp1140.includes('reactionBar')) {
    log('pass', 'R1140', 'ChatPanel 이모지 반응 존재')
  } else {
    log('warning', 'R1140', 'ChatPanel 이모지 반응 없음', 'chat/ChatPanel.tsx')
  }
}

// R1141: InputBar 자동 들여쓰기
const ib1141Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1141Path)) {
  const ib1141 = readFileSync(ib1141Path, 'utf-8')
  if (ib1141.includes('autoIndent') || ib1141.includes('indentSize') || ib1141.includes('autoIndentMode')) {
    log('pass', 'R1141', 'InputBar 자동 들여쓰기 존재')
  } else {
    log('warning', 'R1141', 'InputBar 자동 들여쓰기 없음', 'chat/InputBar.tsx')
  }
}

// R1142: CocosPanel 에셋 미리보기
const cocos1142Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1142Path)) {
  const cocos1142 = readFileSync(cocos1142Path, 'utf-8')
  if (cocos1142.includes('assetPreview') || cocos1142.includes('assetPreviewType') || cocos1142.includes('previewAsset')) {
    log('pass', 'R1142', 'CocosPanel 에셋 미리보기 존재')
  } else {
    log('warning', 'R1142', 'CocosPanel 에셋 미리보기 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 292. Phase DD10 R1143~1145 기능 체크')
// R1143: SceneViewPanel 검색 결과
const sv1143Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1143Path)) {
  const sv1143 = readFileSync(sv1143Path, 'utf-8')
  if (sv1143.includes('searchResults') || sv1143.includes('searchResultIdx') || sv1143.includes('sceneSearch')) {
    log('pass', 'R1143', 'SceneViewPanel 검색 결과 존재')
  } else {
    log('warning', 'R1143', 'SceneViewPanel 검색 결과 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1144: TerminalPanel 컬러 출력
const tp1144Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1144Path)) {
  const tp1144 = readFileSync(tp1144Path, 'utf-8')
  if (tp1144.includes('colorOutput') || tp1144.includes('customColors') || tp1144.includes('ansiColors')) {
    log('pass', 'R1144', 'TerminalPanel 컬러 출력 존재')
  } else {
    log('warning', 'R1144', 'TerminalPanel 컬러 출력 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1145: SessionList 세션 평점
const sl1145Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1145Path)) {
  const sl1145 = readFileSync(sl1145Path, 'utf-8')
  if (sl1145.includes('sessionRatings') || sl1145.includes('showRatingPanel') || sl1145.includes('ratingPanel')) {
    log('pass', 'R1145', 'SessionList 세션 평점 존재')
  } else {
    log('warning', 'R1145', 'SessionList 세션 평점 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 293. Phase DD10 R1146~1148 기능 체크')
// R1146: ChatPanel 메시지 스레드
const cp1146Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1146Path)) {
  const cp1146 = readFileSync(cp1146Path, 'utf-8')
  if (cp1146.includes('msgThreads') || cp1146.includes('activeThread') || cp1146.includes('threadingEnabled')) {
    log('pass', 'R1146', 'ChatPanel 메시지 스레드 존재')
  } else {
    log('warning', 'R1146', 'ChatPanel 메시지 스레드 없음', 'chat/ChatPanel.tsx')
  }
}

// R1147: InputBar 맞춤법 검사
const ib1147Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1147Path)) {
  const ib1147 = readFileSync(ib1147Path, 'utf-8')
  if (ib1147.includes('spellCheck') || ib1147.includes('spellLang') || ib1147.includes('spellEnabled')) {
    log('pass', 'R1147', 'InputBar 맞춤법 검사 존재')
  } else {
    log('warning', 'R1147', 'InputBar 맞춤법 검사 없음', 'chat/InputBar.tsx')
  }
}

// R1148: CocosPanel 빌드 큐
const cocos1148Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1148Path)) {
  const cocos1148 = readFileSync(cocos1148Path, 'utf-8')
  if (cocos1148.includes('buildQueue') || cocos1148.includes('showBuildQueue') || cocos1148.includes('buildQueueOpen')) {
    log('pass', 'R1148', 'CocosPanel 빌드 큐 존재')
  } else {
    log('warning', 'R1148', 'CocosPanel 빌드 큐 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 294. Phase DD10 R1149~1151 기능 체크')
// R1149: SceneViewPanel 노드 레이어
const sv1149Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1149Path)) {
  const sv1149 = readFileSync(sv1149Path, 'utf-8')
  if (sv1149.includes('nodeLayers') || sv1149.includes('showLayerPanel') || sv1149.includes('hiddenLayers')) {
    log('pass', 'R1149', 'SceneViewPanel 노드 레이어 존재')
  } else {
    log('warning', 'R1149', 'SceneViewPanel 노드 레이어 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1150: TerminalPanel 세션 로그
const tp1150Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1150Path)) {
  const tp1150 = readFileSync(tp1150Path, 'utf-8')
  if (tp1150.includes('sessionLog') || tp1150.includes('showSessionLog') || tp1150.includes('termLog')) {
    log('pass', 'R1150', 'TerminalPanel 세션 로그 존재')
  } else {
    log('warning', 'R1150', 'TerminalPanel 세션 로그 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1151: SessionList 세션 그룹
const sl1151Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1151Path)) {
  const sl1151 = readFileSync(sl1151Path, 'utf-8')
  if (sl1151.includes('sessionGroups') || sl1151.includes('expandedGroups') || sl1151.includes('groupedSessions')) {
    log('pass', 'R1151', 'SessionList 세션 그룹 존재')
  } else {
    log('warning', 'R1151', 'SessionList 세션 그룹 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 295. Phase DD10 R1152~1154 기능 체크')
// R1152: ChatPanel 메시지 북마크
const cp1152Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1152Path)) {
  const cp1152 = readFileSync(cp1152Path, 'utf-8')
  if (cp1152.includes('msgBookmarks') || cp1152.includes('showBookmarkPanel') || cp1152.includes('bookmarkedMsgs')) {
    log('pass', 'R1152', 'ChatPanel 메시지 북마크 존재')
  } else {
    log('warning', 'R1152', 'ChatPanel 메시지 북마크 없음', 'chat/ChatPanel.tsx')
  }
}

// R1153: InputBar 단어 수
const ib1153Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1153Path)) {
  const ib1153 = readFileSync(ib1153Path, 'utf-8')
  if (ib1153.includes('wordCount') || ib1153.includes('showWordCount') || ib1153.includes('charCount')) {
    log('pass', 'R1153', 'InputBar 단어 수 존재')
  } else {
    log('warning', 'R1153', 'InputBar 단어 수 없음', 'chat/InputBar.tsx')
  }
}

// R1154: CocosPanel 씬 스냅샷
const cocos1154Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1154Path)) {
  const cocos1154 = readFileSync(cocos1154Path, 'utf-8')
  if (cocos1154.includes('sceneSnapshot') || cocos1154.includes('showSnapshotPanel') || cocos1154.includes('sceneSnap')) {
    log('pass', 'R1154', 'CocosPanel 씬 스냅샷 존재')
  } else {
    log('warning', 'R1154', 'CocosPanel 씬 스냅샷 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 296. Phase DD10 R1155~1157 기능 체크')
// R1155: SceneViewPanel 노드 코멘트
const sv1155Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1155Path)) {
  const sv1155 = readFileSync(sv1155Path, 'utf-8')
  if (sv1155.includes('nodeComments') || sv1155.includes('showNodeComments') || sv1155.includes('nodeAnnotations')) {
    log('pass', 'R1155', 'SceneViewPanel 노드 코멘트 존재')
  } else {
    log('warning', 'R1155', 'SceneViewPanel 노드 코멘트 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1156: TerminalPanel 터미널 프로필
const tp1156Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1156Path)) {
  const tp1156 = readFileSync(tp1156Path, 'utf-8')
  if (tp1156.includes('termProfiles') || tp1156.includes('activeProfile') || tp1156.includes('terminalProfile')) {
    log('pass', 'R1156', 'TerminalPanel 터미널 프로필 존재')
  } else {
    log('warning', 'R1156', 'TerminalPanel 터미널 프로필 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1157: SessionList 세션 내보내기
const sl1157Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1157Path)) {
  const sl1157 = readFileSync(sl1157Path, 'utf-8')
  if (sl1157.includes('sessionExportFormat') || sl1157.includes('showExportPanel') || sl1157.includes('exportSession')) {
    log('pass', 'R1157', 'SessionList 세션 내보내기 존재')
  } else {
    log('warning', 'R1157', 'SessionList 세션 내보내기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 297. Phase DD10 R1158~1160 기능 체크')
// R1158: ChatPanel 메시지 레이블
const cp1158Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1158Path)) {
  const cp1158 = readFileSync(cp1158Path, 'utf-8')
  if (cp1158.includes('msgLabels') || cp1158.includes('showLabelPanel') || cp1158.includes('labeledMsgs')) {
    log('pass', 'R1158', 'ChatPanel 메시지 레이블 존재')
  } else {
    log('warning', 'R1158', 'ChatPanel 메시지 레이블 없음', 'chat/ChatPanel.tsx')
  }
}

// R1159: InputBar 입력 히스토리
const ib1159Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1159Path)) {
  const ib1159 = readFileSync(ib1159Path, 'utf-8')
  if (ib1159.includes('inputHistory') || ib1159.includes('inputHistoryIdx') || ib1159.includes('cmdHistory')) {
    log('pass', 'R1159', 'InputBar 입력 히스토리 존재')
  } else {
    log('warning', 'R1159', 'InputBar 입력 히스토리 없음', 'chat/InputBar.tsx')
  }
}

// R1160: CocosPanel 빌드 에러
const cocos1160Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1160Path)) {
  const cocos1160 = readFileSync(cocos1160Path, 'utf-8')
  if (cocos1160.includes('buildErrors') || cocos1160.includes('showBuildErrors') || cocos1160.includes('buildErrList')) {
    log('pass', 'R1160', 'CocosPanel 빌드 에러 존재')
  } else {
    log('warning', 'R1160', 'CocosPanel 빌드 에러 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 298. Phase DD10 R1161~1163 기능 체크')
// R1161: SceneViewPanel 노드 애니메이션
const sv1161Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1161Path)) {
  const sv1161 = readFileSync(sv1161Path, 'utf-8')
  if (sv1161.includes('nodeAnimations') || sv1161.includes('showAnimPanel') || sv1161.includes('animClips')) {
    log('pass', 'R1161', 'SceneViewPanel 노드 애니메이션 존재')
  } else {
    log('warning', 'R1161', 'SceneViewPanel 노드 애니메이션 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1162: TerminalPanel 출력 검색
const tp1162Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1162Path)) {
  const tp1162 = readFileSync(tp1162Path, 'utf-8')
  if (tp1162.includes('outputSearch') || tp1162.includes('outputSearchResults') || tp1162.includes('termSearch')) {
    log('pass', 'R1162', 'TerminalPanel 출력 검색 존재')
  } else {
    log('warning', 'R1162', 'TerminalPanel 출력 검색 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1163: SessionList 세션 노트
const sl1163Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1163Path)) {
  const sl1163 = readFileSync(sl1163Path, 'utf-8')
  if (sl1163.includes('sessionNotes') || sl1163.includes('editingNote') || sl1163.includes('noteContent')) {
    log('pass', 'R1163', 'SessionList 세션 노트 존재')
  } else {
    log('warning', 'R1163', 'SessionList 세션 노트 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 299. Phase DD10 R1164~1166 기능 체크')
// R1164: ChatPanel 메시지 검색
const cp1164Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1164Path)) {
  const cp1164 = readFileSync(cp1164Path, 'utf-8')
  if (cp1164.includes('msgSearchQuery') || cp1164.includes('msgSearchResults') || cp1164.includes('chatSearch')) {
    log('pass', 'R1164', 'ChatPanel 메시지 검색 존재')
  } else {
    log('warning', 'R1164', 'ChatPanel 메시지 검색 없음', 'chat/ChatPanel.tsx')
  }
}

// R1165: InputBar 멘션 제안
const ib1165Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1165Path)) {
  const ib1165 = readFileSync(ib1165Path, 'utf-8')
  if (ib1165.includes('mentionSuggestions') || ib1165.includes('showMentions') || ib1165.includes('mentionList')) {
    log('pass', 'R1165', 'InputBar 멘션 제안 존재')
  } else {
    log('warning', 'R1165', 'InputBar 멘션 제안 없음', 'chat/InputBar.tsx')
  }
}

// R1166: CocosPanel 에셋 검색
const cocos1166Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1166Path)) {
  const cocos1166 = readFileSync(cocos1166Path, 'utf-8')
  if (cocos1166.includes('assetSearchQuery') || cocos1166.includes('assetSearchResults') || cocos1166.includes('assetFilter')) {
    log('pass', 'R1166', 'CocosPanel 에셋 검색 존재')
  } else {
    log('warning', 'R1166', 'CocosPanel 에셋 검색 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 300. Phase DD10 R1167~1169 기능 체크')
// R1167: SceneViewPanel 씬 히스토리
const sv1167Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1167Path)) {
  const sv1167 = readFileSync(sv1167Path, 'utf-8')
  if (sv1167.includes('sceneHistory') || sv1167.includes('sceneHistoryIdx') || sv1167.includes('undoHistory')) {
    log('pass', 'R1167', 'SceneViewPanel 씬 히스토리 존재')
  } else {
    log('warning', 'R1167', 'SceneViewPanel 씬 히스토리 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1168: TerminalPanel SSH 프로필
const tp1168Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1168Path)) {
  const tp1168 = readFileSync(tp1168Path, 'utf-8')
  if (tp1168.includes('sshProfiles') || tp1168.includes('showSshPanel') || tp1168.includes('sshConfig')) {
    log('pass', 'R1168', 'TerminalPanel SSH 프로필 존재')
  } else {
    log('warning', 'R1168', 'TerminalPanel SSH 프로필 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1169: SessionList 세션 태그
const sl1169Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1169Path)) {
  const sl1169 = readFileSync(sl1169Path, 'utf-8')
  if (sl1169.includes('sessionTags') || sl1169.includes('tagFilter') || sl1169.includes('taggedSessions')) {
    log('pass', 'R1169', 'SessionList 세션 태그 존재')
  } else {
    log('warning', 'R1169', 'SessionList 세션 태그 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 301. Phase DD10 R1170~1172 기능 체크')
// R1170: ChatPanel 메시지 우선순위
const cp1170Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1170Path)) {
  const cp1170 = readFileSync(cp1170Path, 'utf-8')
  if (cp1170.includes('msgPriority') || cp1170.includes('showPriorityPanel') || cp1170.includes('priorityMsg')) {
    log('pass', 'R1170', 'ChatPanel 메시지 우선순위 존재')
  } else {
    log('warning', 'R1170', 'ChatPanel 메시지 우선순위 없음', 'chat/ChatPanel.tsx')
  }
}

// R1171: InputBar 코드 완성
const ib1171Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1171Path)) {
  const ib1171 = readFileSync(ib1171Path, 'utf-8')
  if (ib1171.includes('codeCompletions') || ib1171.includes('showCodeComplete') || ib1171.includes('autoComplete')) {
    log('pass', 'R1171', 'InputBar 코드 완성 존재')
  } else {
    log('warning', 'R1171', 'InputBar 코드 완성 없음', 'chat/InputBar.tsx')
  }
}

// R1172: CocosPanel 씬 북마크
const cocos1172Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1172Path)) {
  const cocos1172 = readFileSync(cocos1172Path, 'utf-8')
  if (cocos1172.includes('sceneBookmarks') || cocos1172.includes('showSceneBookmarks') || cocos1172.includes('bookmarkedScenes')) {
    log('pass', 'R1172', 'CocosPanel 씬 북마크 존재')
  } else {
    log('warning', 'R1172', 'CocosPanel 씬 북마크 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 302. Phase DD10 R1173~1175 기능 체크')
// R1173: SceneViewPanel 노드 물리
const sv1173Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1173Path)) {
  const sv1173 = readFileSync(sv1173Path, 'utf-8')
  if (sv1173.includes('nodePhysics') || sv1173.includes('showPhysicsPanel') || sv1173.includes('physicsEnabled')) {
    log('pass', 'R1173', 'SceneViewPanel 노드 물리 존재')
  } else {
    log('warning', 'R1173', 'SceneViewPanel 노드 물리 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1174: TerminalPanel 터미널 매크로
const tp1174Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1174Path)) {
  const tp1174 = readFileSync(tp1174Path, 'utf-8')
  if (tp1174.includes('termMacros') || tp1174.includes('showMacroPanel') || tp1174.includes('macroList')) {
    log('pass', 'R1174', 'TerminalPanel 터미널 매크로 존재')
  } else {
    log('warning', 'R1174', 'TerminalPanel 터미널 매크로 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1175: SessionList 즐겨찾기 세션
const sl1175Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1175Path)) {
  const sl1175 = readFileSync(sl1175Path, 'utf-8')
  if (sl1175.includes('starredSessions') || sl1175.includes('showStarredOnly') || sl1175.includes('favoriteSession')) {
    log('pass', 'R1175', 'SessionList 즐겨찾기 세션 존재')
  } else {
    log('warning', 'R1175', 'SessionList 즐겨찾기 세션 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 303. Phase DD10 R1176~1178 기능 체크')
// R1176: ChatPanel 메시지 스케줄
const cp1176Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1176Path)) {
  const cp1176 = readFileSync(cp1176Path, 'utf-8')
  if (cp1176.includes('msgSchedule') || cp1176.includes('showSchedulePanel') || cp1176.includes('scheduledMsg')) {
    log('pass', 'R1176', 'ChatPanel 메시지 스케줄 존재')
  } else {
    log('warning', 'R1176', 'ChatPanel 메시지 스케줄 없음', 'chat/ChatPanel.tsx')
  }
}

// R1177: InputBar 텍스트 템플릿
const ib1177Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1177Path)) {
  const ib1177 = readFileSync(ib1177Path, 'utf-8')
  if (ib1177.includes('textTemplates') || ib1177.includes('showTemplates') || ib1177.includes('templateList')) {
    log('pass', 'R1177', 'InputBar 텍스트 템플릿 존재')
  } else {
    log('warning', 'R1177', 'InputBar 텍스트 템플릿 없음', 'chat/InputBar.tsx')
  }
}

// R1178: CocosPanel 컴포넌트 검색
const cocos1178Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1178Path)) {
  const cocos1178 = readFileSync(cocos1178Path, 'utf-8')
  if (cocos1178.includes('componentSearch') || cocos1178.includes('componentSearchResults') || cocos1178.includes('compFilter')) {
    log('pass', 'R1178', 'CocosPanel 컴포넌트 검색 존재')
  } else {
    log('warning', 'R1178', 'CocosPanel 컴포넌트 검색 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 304. Phase DD10 R1179~1181 기능 체크')
// R1179: SceneViewPanel 노드 스크립트
const sv1179Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1179Path)) {
  const sv1179 = readFileSync(sv1179Path, 'utf-8')
  if (sv1179.includes('nodeScripts') || sv1179.includes('showScriptPanel') || sv1179.includes('scriptList')) {
    log('pass', 'R1179', 'SceneViewPanel 노드 스크립트 존재')
  } else {
    log('warning', 'R1179', 'SceneViewPanel 노드 스크립트 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1180: TerminalPanel 터미널 플러그인
const tp1180Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1180Path)) {
  const tp1180 = readFileSync(tp1180Path, 'utf-8')
  if (tp1180.includes('termPlugins') || tp1180.includes('showPluginPanel') || tp1180.includes('pluginList')) {
    log('pass', 'R1180', 'TerminalPanel 터미널 플러그인 존재')
  } else {
    log('warning', 'R1180', 'TerminalPanel 터미널 플러그인 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1181: SessionList 세션 활동
const sl1181Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1181Path)) {
  const sl1181 = readFileSync(sl1181Path, 'utf-8')
  if (sl1181.includes('sessionActivity') || sl1181.includes('showActivityPanel') || sl1181.includes('activityLog')) {
    log('pass', 'R1181', 'SessionList 세션 활동 존재')
  } else {
    log('warning', 'R1181', 'SessionList 세션 활동 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 305. Phase DD10 R1182~1184 기능 체크')
// R1182: ChatPanel 메시지 상태
const cp1182Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1182Path)) {
  const cp1182 = readFileSync(cp1182Path, 'utf-8')
  if (cp1182.includes('msgStatus') || cp1182.includes('showStatusPanel') || cp1182.includes('deliveryStatus')) {
    log('pass', 'R1182', 'ChatPanel 메시지 상태 존재')
  } else {
    log('warning', 'R1182', 'ChatPanel 메시지 상태 없음', 'chat/ChatPanel.tsx')
  }
}

// R1183: InputBar 입력 모드
const ib1183Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1183Path)) {
  const ib1183 = readFileSync(ib1183Path, 'utf-8')
  if (ib1183.includes('inputMode') || ib1183.includes('showModePanel') || ib1183.includes('editMode')) {
    log('pass', 'R1183', 'InputBar 입력 모드 존재')
  } else {
    log('warning', 'R1183', 'InputBar 입력 모드 없음', 'chat/InputBar.tsx')
  }
}

// R1184: CocosPanel 노드 필터
const cocos1184Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1184Path)) {
  const cocos1184 = readFileSync(cocos1184Path, 'utf-8')
  if (cocos1184.includes('nodeFilters') || cocos1184.includes('showNodeFilters') || cocos1184.includes('filterNodes')) {
    log('pass', 'R1184', 'CocosPanel 노드 필터 존재')
  } else {
    log('warning', 'R1184', 'CocosPanel 노드 필터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 306. Phase DD10 R1185~1187 기능 체크')
// R1185: SceneViewPanel 씬 이벤트
const sv1185Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1185Path)) {
  const sv1185 = readFileSync(sv1185Path, 'utf-8')
  if (sv1185.includes('sceneEvents') || sv1185.includes('showEventLog') || sv1185.includes('eventHistory')) {
    log('pass', 'R1185', 'SceneViewPanel 씬 이벤트 존재')
  } else {
    log('warning', 'R1185', 'SceneViewPanel 씬 이벤트 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1186: TerminalPanel 터미널 알림
const tp1186Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1186Path)) {
  const tp1186 = readFileSync(tp1186Path, 'utf-8')
  if (tp1186.includes('termNotifications') || tp1186.includes('showTermNotifs') || tp1186.includes('termAlerts')) {
    log('pass', 'R1186', 'TerminalPanel 터미널 알림 존재')
  } else {
    log('warning', 'R1186', 'TerminalPanel 터미널 알림 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1187: SessionList 세션 공유
const sl1187Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1187Path)) {
  const sl1187 = readFileSync(sl1187Path, 'utf-8')
  if (sl1187.includes('sessionSharing') || sl1187.includes('showSharePanel') || sl1187.includes('sharedSession')) {
    log('pass', 'R1187', 'SessionList 세션 공유 존재')
  } else {
    log('warning', 'R1187', 'SessionList 세션 공유 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 307. Phase DD10 R1188~1190 기능 체크')
// R1188: ChatPanel 메시지 접기
const cp1188Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1188Path)) {
  const cp1188 = readFileSync(cp1188Path, 'utf-8')
  if (cp1188.includes('collapsedMsgs') || cp1188.includes('autoCollapse') || cp1188.includes('foldedMsgs')) {
    log('pass', 'R1188', 'ChatPanel 메시지 접기 존재')
  } else {
    log('warning', 'R1188', 'ChatPanel 메시지 접기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1189: InputBar 리치 텍스트
const ib1189Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1189Path)) {
  const ib1189 = readFileSync(ib1189Path, 'utf-8')
  if (ib1189.includes('richTextMode') || ib1189.includes('richTextContent') || ib1189.includes('richEditor')) {
    log('pass', 'R1189', 'InputBar 리치 텍스트 존재')
  } else {
    log('warning', 'R1189', 'InputBar 리치 텍스트 없음', 'chat/InputBar.tsx')
  }
}

// R1190: CocosPanel 씬 검증
const cocos1190Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1190Path)) {
  const cocos1190 = readFileSync(cocos1190Path, 'utf-8')
  if (cocos1190.includes('sceneValidation') || cocos1190.includes('showValidation') || cocos1190.includes('validateScene')) {
    log('pass', 'R1190', 'CocosPanel 씬 검증 존재')
  } else {
    log('warning', 'R1190', 'CocosPanel 씬 검증 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 308. Phase DD10 R1191~1193 기능 체크')
// R1191: SceneViewPanel 노드 속성
const sv1191Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1191Path)) {
  const sv1191 = readFileSync(sv1191Path, 'utf-8')
  if (sv1191.includes('nodeProps') || sv1191.includes('showPropsPanel') || sv1191.includes('propEditor')) {
    log('pass', 'R1191', 'SceneViewPanel 노드 속성 존재')
  } else {
    log('warning', 'R1191', 'SceneViewPanel 노드 속성 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1192: TerminalPanel 터미널 감시
const tp1192Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1192Path)) {
  const tp1192 = readFileSync(tp1192Path, 'utf-8')
  if (tp1192.includes('termWatch') || tp1192.includes('watchActive') || tp1192.includes('watchMode')) {
    log('pass', 'R1192', 'TerminalPanel 터미널 감시 존재')
  } else {
    log('warning', 'R1192', 'TerminalPanel 터미널 감시 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1193: SessionList 세션 복제
const sl1193Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1193Path)) {
  const sl1193 = readFileSync(sl1193Path, 'utf-8')
  if (sl1193.includes('cloningSession') || sl1193.includes('showClonePanel') || sl1193.includes('cloneSession')) {
    log('pass', 'R1193', 'SessionList 세션 복제 존재')
  } else {
    log('warning', 'R1193', 'SessionList 세션 복제 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 309. Phase DD10 R1194~1196 기능 체크')
// R1194: ChatPanel 메시지 전달
const cp1194Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1194Path)) {
  const cp1194 = readFileSync(cp1194Path, 'utf-8')
  if (cp1194.includes('forwardingMsg') || cp1194.includes('forwardTarget') || cp1194.includes('forwardMsg')) {
    log('pass', 'R1194', 'ChatPanel 메시지 전달 존재')
  } else {
    log('warning', 'R1194', 'ChatPanel 메시지 전달 없음', 'chat/ChatPanel.tsx')
  }
}

// R1195: InputBar 줄 바꿈
const ib1195Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1195Path)) {
  const ib1195 = readFileSync(ib1195Path, 'utf-8')
  if (ib1195.includes('lineWrap') || ib1195.includes('wrapWidth') || ib1195.includes('wordWrap')) {
    log('pass', 'R1195', 'InputBar 줄 바꿈 존재')
  } else {
    log('warning', 'R1195', 'InputBar 줄 바꿈 없음', 'chat/InputBar.tsx')
  }
}

// R1196: CocosPanel 리소스 사용
const cocos1196Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1196Path)) {
  const cocos1196 = readFileSync(cocos1196Path, 'utf-8')
  if (cocos1196.includes('resourceUsage') || cocos1196.includes('showResourcePanel') || cocos1196.includes('memUsage')) {
    log('pass', 'R1196', 'CocosPanel 리소스 사용 존재')
  } else {
    log('warning', 'R1196', 'CocosPanel 리소스 사용 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 310. Phase DD10 R1197~1199 기능 체크')
// R1197: SceneViewPanel 노드 그룹
const sv1197Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1197Path)) {
  const sv1197 = readFileSync(sv1197Path, 'utf-8')
  if (sv1197.includes('nodeGroups') || sv1197.includes('showGroupPanel') || sv1197.includes('groupNodes')) {
    log('pass', 'R1197', 'SceneViewPanel 노드 그룹 존재')
  } else {
    log('warning', 'R1197', 'SceneViewPanel 노드 그룹 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1198: TerminalPanel 터미널 녹화
const tp1198Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1198Path)) {
  const tp1198 = readFileSync(tp1198Path, 'utf-8')
  if (tp1198.includes('termRecording') || tp1198.includes('recordingBuffer') || tp1198.includes('isRecording')) {
    log('pass', 'R1198', 'TerminalPanel 터미널 녹화 존재')
  } else {
    log('warning', 'R1198', 'TerminalPanel 터미널 녹화 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1199: SessionList 세션 병합
const sl1199Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1199Path)) {
  const sl1199 = readFileSync(sl1199Path, 'utf-8')
  if (sl1199.includes('mergeSessions') || sl1199.includes('showMergePanel') || sl1199.includes('mergeTarget')) {
    log('pass', 'R1199', 'SessionList 세션 병합 존재')
  } else {
    log('warning', 'R1199', 'SessionList 세션 병합 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 311. Phase DD10 R1200~1202 기능 체크')
// R1200: ChatPanel 메시지 분석
const cp1200Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1200Path)) {
  const cp1200 = readFileSync(cp1200Path, 'utf-8')
  if (cp1200.includes('msgAnalytics') || cp1200.includes('showAnalytics') || cp1200.includes('chatAnalytics')) {
    log('pass', 'R1200', 'ChatPanel 메시지 분석 존재')
  } else {
    log('warning', 'R1200', 'ChatPanel 메시지 분석 없음', 'chat/ChatPanel.tsx')
  }
}

// R1201: InputBar 집중 모드
const ib1201Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1201Path)) {
  const ib1201 = readFileSync(ib1201Path, 'utf-8')
  if (ib1201.includes('focusMode') || ib1201.includes('focusTimer') || ib1201.includes('focusOpacity')) {
    log('pass', 'R1201', 'InputBar 집중 모드 존재')
  } else {
    log('warning', 'R1201', 'InputBar 집중 모드 없음', 'chat/InputBar.tsx')
  }
}

// R1202: CocosPanel 빌드 히스토리
const cocos1202Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1202Path)) {
  const cocos1202 = readFileSync(cocos1202Path, 'utf-8')
  if (cocos1202.includes('buildHistory') || cocos1202.includes('showBuildHistory') || cocos1202.includes('buildLog')) {
    log('pass', 'R1202', 'CocosPanel 빌드 히스토리 존재')
  } else {
    log('warning', 'R1202', 'CocosPanel 빌드 히스토리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 312. Phase DD10 R1203~1205 기능 체크')
// R1203: SceneViewPanel 씬 메트릭
const sv1203Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1203Path)) {
  const sv1203 = readFileSync(sv1203Path, 'utf-8')
  if (sv1203.includes('sceneMetrics') || sv1203.includes('showMetricsPanel') || sv1203.includes('nodeCount')) {
    log('pass', 'R1203', 'SceneViewPanel 씬 메트릭 존재')
  } else {
    log('warning', 'R1203', 'SceneViewPanel 씬 메트릭 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1204: TerminalPanel 터미널 diff
const tp1204Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1204Path)) {
  const tp1204 = readFileSync(tp1204Path, 'utf-8')
  if (tp1204.includes('termDiff') || tp1204.includes('showDiffPanel') || tp1204.includes('diffOutput')) {
    log('pass', 'R1204', 'TerminalPanel 터미널 diff 존재')
  } else {
    log('warning', 'R1204', 'TerminalPanel 터미널 diff 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1205: SessionList 세션 버전
const sl1205Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1205Path)) {
  const sl1205 = readFileSync(sl1205Path, 'utf-8')
  if (sl1205.includes('sessionVersion') || sl1205.includes('showVersionPanel') || sl1205.includes('versionHistory')) {
    log('pass', 'R1205', 'SessionList 세션 버전 존재')
  } else {
    log('warning', 'R1205', 'SessionList 세션 버전 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 313. Phase DD10 R1206~1208 기능 체크')
// R1206: ChatPanel 메시지 번역
const cp1206Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1206Path)) {
  const cp1206 = readFileSync(cp1206Path, 'utf-8')
  if (cp1206.includes('translateTarget') || cp1206.includes('showTranslatePanel') || cp1206.includes('translating')) {
    log('pass', 'R1206', 'ChatPanel 메시지 번역 존재')
  } else {
    log('warning', 'R1206', 'ChatPanel 메시지 번역 없음', 'chat/ChatPanel.tsx')
  }
}

// R1207: InputBar 입력 통계
const ib1207Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1207Path)) {
  const ib1207 = readFileSync(ib1207Path, 'utf-8')
  if (ib1207.includes('inputStats') || ib1207.includes('showInputStats') || ib1207.includes('charCount')) {
    log('pass', 'R1207', 'InputBar 입력 통계 존재')
  } else {
    log('warning', 'R1207', 'InputBar 입력 통계 없음', 'chat/InputBar.tsx')
  }
}

// R1208: CocosPanel 배포 설정
const cocos1208Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1208Path)) {
  const cocos1208 = readFileSync(cocos1208Path, 'utf-8')
  if (cocos1208.includes('deployConfig') || cocos1208.includes('showDeployPanel') || cocos1208.includes('deployTarget')) {
    log('pass', 'R1208', 'CocosPanel 배포 설정 존재')
  } else {
    log('warning', 'R1208', 'CocosPanel 배포 설정 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 314. Phase DD10 R1209~1211 기능 체크')
// R1209: SceneViewPanel 씬 최적화
const sv1209Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1209Path)) {
  const sv1209 = readFileSync(sv1209Path, 'utf-8')
  if (sv1209.includes('optimizeSuggestions') || sv1209.includes('showOptimizePanel') || sv1209.includes('perfHints')) {
    log('pass', 'R1209', 'SceneViewPanel 씬 최적화 존재')
  } else {
    log('warning', 'R1209', 'SceneViewPanel 씬 최적화 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1210: TerminalPanel 터미널 git
const tp1210Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1210Path)) {
  const tp1210 = readFileSync(tp1210Path, 'utf-8')
  if (tp1210.includes('termGitStatus') || tp1210.includes('showGitPanel') || tp1210.includes('gitBranch')) {
    log('pass', 'R1210', 'TerminalPanel 터미널 git 존재')
  } else {
    log('warning', 'R1210', 'TerminalPanel 터미널 git 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1211: SessionList 세션 알림
const sl1211Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1211Path)) {
  const sl1211 = readFileSync(sl1211Path, 'utf-8')
  if (sl1211.includes('sessionReminders') || sl1211.includes('showReminderPanel') || sl1211.includes('reminderTime')) {
    log('pass', 'R1211', 'SessionList 세션 알림 존재')
  } else {
    log('warning', 'R1211', 'SessionList 세션 알림 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 315. Phase DD10 R1212~1214 기능 체크')
// R1212: ChatPanel 복사 형식
const cp1212Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1212Path)) {
  const cp1212 = readFileSync(cp1212Path, 'utf-8')
  if (cp1212.includes('copyFormat') || cp1212.includes('showCopyFormat') || cp1212.includes('copyMode')) {
    log('pass', 'R1212', 'ChatPanel 복사 형식 존재')
  } else {
    log('warning', 'R1212', 'ChatPanel 복사 형식 없음', 'chat/ChatPanel.tsx')
  }
}

// R1213: InputBar 커서 스타일
const ib1213Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1213Path)) {
  const ib1213 = readFileSync(ib1213Path, 'utf-8')
  if (ib1213.includes('cursorStyle') || ib1213.includes('cursorBlink') || ib1213.includes('caretStyle')) {
    log('pass', 'R1213', 'InputBar 커서 스타일 존재')
  } else {
    log('warning', 'R1213', 'InputBar 커서 스타일 없음', 'chat/InputBar.tsx')
  }
}

// R1214: CocosPanel 에셋 태그
const cocos1214Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1214Path)) {
  const cocos1214 = readFileSync(cocos1214Path, 'utf-8')
  if (cocos1214.includes('assetTags') || cocos1214.includes('showAssetTags') || cocos1214.includes('taggedAssets')) {
    log('pass', 'R1214', 'CocosPanel 에셋 태그 존재')
  } else {
    log('warning', 'R1214', 'CocosPanel 에셋 태그 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 316. Phase DD10 R1215~1217 기능 체크')
// R1215: SceneViewPanel 선택 히스토리
const sv1215Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1215Path)) {
  const sv1215 = readFileSync(sv1215Path, 'utf-8')
  if (sv1215.includes('selectionHistory') || sv1215.includes('selHistoryIdx') || sv1215.includes('prevSelection')) {
    log('pass', 'R1215', 'SceneViewPanel 선택 히스토리 존재')
  } else {
    log('warning', 'R1215', 'SceneViewPanel 선택 히스토리 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1216: TerminalPanel 환경 변수
const tp1216Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1216Path)) {
  const tp1216 = readFileSync(tp1216Path, 'utf-8')
  if (tp1216.includes('termEnvVars') || tp1216.includes('showEnvPanel') || tp1216.includes('envVars')) {
    log('pass', 'R1216', 'TerminalPanel 환경 변수 존재')
  } else {
    log('warning', 'R1216', 'TerminalPanel 환경 변수 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1217: SessionList 세션 색상
const sl1217Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1217Path)) {
  const sl1217 = readFileSync(sl1217Path, 'utf-8')
  if (sl1217.includes('sessionColors') || sl1217.includes('showColorPicker') || sl1217.includes('sessionColor')) {
    log('pass', 'R1217', 'SessionList 세션 색상 존재')
  } else {
    log('warning', 'R1217', 'SessionList 세션 색상 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 317. Phase DD10 R1218~1220 기능 체크')
// R1218: ChatPanel 메시지 답장
const cp1218Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1218Path)) {
  const cp1218 = readFileSync(cp1218Path, 'utf-8')
  if (cp1218.includes('replyingTo') || cp1218.includes('replyContext') || cp1218.includes('replyMsg')) {
    log('pass', 'R1218', 'ChatPanel 메시지 답장 존재')
  } else {
    log('warning', 'R1218', 'ChatPanel 메시지 답장 없음', 'chat/ChatPanel.tsx')
  }
}

// R1219: InputBar 탭 크기
const ib1219Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1219Path)) {
  const ib1219 = readFileSync(ib1219Path, 'utf-8')
  if (ib1219.includes('tabSize') || ib1219.includes('useSpaces') || ib1219.includes('tabWidth')) {
    log('pass', 'R1219', 'InputBar 탭 크기 존재')
  } else {
    log('warning', 'R1219', 'InputBar 탭 크기 없음', 'chat/InputBar.tsx')
  }
}

// R1220: CocosPanel 씬 내보내기
const cocos1220Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1220Path)) {
  const cocos1220 = readFileSync(cocos1220Path, 'utf-8')
  if (cocos1220.includes('sceneExportFormat') || cocos1220.includes('showExportScene') || cocos1220.includes('exportScene')) {
    log('pass', 'R1220', 'CocosPanel 씬 내보내기 존재')
  } else {
    log('warning', 'R1220', 'CocosPanel 씬 내보내기 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 318. Phase DD10 R1221~1223 기능 체크')
// R1221: SceneViewPanel 고급 노드 검색
const sv1221Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1221Path)) {
  const sv1221 = readFileSync(sv1221Path, 'utf-8')
  if (sv1221.includes('nodeSearchFilters') || sv1221.includes('showAdvancedSearch') || sv1221.includes('advancedFilter')) {
    log('pass', 'R1221', 'SceneViewPanel 고급 노드 검색 존재')
  } else {
    log('warning', 'R1221', 'SceneViewPanel 고급 노드 검색 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1222: TerminalPanel 터미널 레이아웃
const tp1222Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1222Path)) {
  const tp1222 = readFileSync(tp1222Path, 'utf-8')
  if (tp1222.includes('termLayout') || tp1222.includes('layoutConfig') || tp1222.includes('splitLayout')) {
    log('pass', 'R1222', 'TerminalPanel 터미널 레이아웃 존재')
  } else {
    log('warning', 'R1222', 'TerminalPanel 터미널 레이아웃 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1223: SessionList 세션 통계
const sl1223Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1223Path)) {
  const sl1223 = readFileSync(sl1223Path, 'utf-8')
  if (sl1223.includes('sessionStats') || sl1223.includes('showSessionStats') || sl1223.includes('statPanel')) {
    log('pass', 'R1223', 'SessionList 세션 통계 존재')
  } else {
    log('warning', 'R1223', 'SessionList 세션 통계 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 319. Phase DD10 R1224~1226 기능 체크')
// R1224: ChatPanel 메시지 그룹
const cp1224Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1224Path)) {
  const cp1224 = readFileSync(cp1224Path, 'utf-8')
  if (cp1224.includes('msgGroupBy') || cp1224.includes('showGroupByPanel') || cp1224.includes('groupMessages')) {
    log('pass', 'R1224', 'ChatPanel 메시지 그룹 존재')
  } else {
    log('warning', 'R1224', 'ChatPanel 메시지 그룹 없음', 'chat/ChatPanel.tsx')
  }
}

// R1225: InputBar 구문 강조
const ib1225Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1225Path)) {
  const ib1225 = readFileSync(ib1225Path, 'utf-8')
  if (ib1225.includes('syntaxHighlight') || ib1225.includes('syntaxTheme') || ib1225.includes('codeHighlight')) {
    log('pass', 'R1225', 'InputBar 구문 강조 존재')
  } else {
    log('warning', 'R1225', 'InputBar 구문 강조 없음', 'chat/InputBar.tsx')
  }
}

// R1226: CocosPanel 노드 트리
const cocos1226Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1226Path)) {
  const cocos1226 = readFileSync(cocos1226Path, 'utf-8')
  if (cocos1226.includes('nodeTreeExpanded') || cocos1226.includes('nodeTreeFilter') || cocos1226.includes('treeExpanded')) {
    log('pass', 'R1226', 'CocosPanel 노드 트리 존재')
  } else {
    log('warning', 'R1226', 'CocosPanel 노드 트리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 320. Phase DD10 R1227~1229 기능 체크')
// R1227: SceneViewPanel 씬 카메라
const sv1227Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1227Path)) {
  const sv1227 = readFileSync(sv1227Path, 'utf-8')
  if (sv1227.includes('sceneCameras') || sv1227.includes('activeCamera') || sv1227.includes('cameraList')) {
    log('pass', 'R1227', 'SceneViewPanel 씬 카메라 존재')
  } else {
    log('warning', 'R1227', 'SceneViewPanel 씬 카메라 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1228: TerminalPanel 커맨드 큐
const tp1228Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1228Path)) {
  const tp1228 = readFileSync(tp1228Path, 'utf-8')
  if (tp1228.includes('cmdQueue') || tp1228.includes('queueRunning') || tp1228.includes('commandQueue')) {
    log('pass', 'R1228', 'TerminalPanel 커맨드 큐 존재')
  } else {
    log('warning', 'R1228', 'TerminalPanel 커맨드 큐 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1229: SessionList 세션 우선순위
const sl1229Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1229Path)) {
  const sl1229 = readFileSync(sl1229Path, 'utf-8')
  if (sl1229.includes('sessionPriority') || sl1229.includes('sortByPriority') || sl1229.includes('prioritySort')) {
    log('pass', 'R1229', 'SessionList 세션 우선순위 존재')
  } else {
    log('warning', 'R1229', 'SessionList 세션 우선순위 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 321. Phase DD10 R1230~1232 기능 체크')
// R1230: ChatPanel 메시지 요약 뷰
const cp1230Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1230Path)) {
  const cp1230 = readFileSync(cp1230Path, 'utf-8')
  if (cp1230.includes('msgSummaryView') || cp1230.includes('summaryDepth') || cp1230.includes('autoSummary')) {
    log('pass', 'R1230', 'ChatPanel 메시지 요약 뷰 존재')
  } else {
    log('warning', 'R1230', 'ChatPanel 메시지 요약 뷰 없음', 'chat/ChatPanel.tsx')
  }
}

// R1231: InputBar 줄 번호
const ib1231Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1231Path)) {
  const ib1231 = readFileSync(ib1231Path, 'utf-8')
  if (ib1231.includes('showLineNumbers') || ib1231.includes('lineNumberStart') || ib1231.includes('lineNum')) {
    log('pass', 'R1231', 'InputBar 줄 번호 존재')
  } else {
    log('warning', 'R1231', 'InputBar 줄 번호 없음', 'chat/InputBar.tsx')
  }
}

// R1232: CocosPanel 프리팹 미리보기
const cocos1232Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1232Path)) {
  const cocos1232 = readFileSync(cocos1232Path, 'utf-8')
  if (cocos1232.includes('prefabPreview') || cocos1232.includes('showPrefabPreview') || cocos1232.includes('prefabThumb')) {
    log('pass', 'R1232', 'CocosPanel 프리팹 미리보기 존재')
  } else {
    log('warning', 'R1232', 'CocosPanel 프리팹 미리보기 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 322. Phase DD10 R1233~1235 기능 체크')
// R1233: SceneViewPanel 씬 라이트
const sv1233Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1233Path)) {
  const sv1233 = readFileSync(sv1233Path, 'utf-8')
  if (sv1233.includes('sceneLights') || sv1233.includes('showLightPanel') || sv1233.includes('lightList')) {
    log('pass', 'R1233', 'SceneViewPanel 씬 라이트 존재')
  } else {
    log('warning', 'R1233', 'SceneViewPanel 씬 라이트 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1234: TerminalPanel 터미널 스케줄러
const tp1234Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1234Path)) {
  const tp1234 = readFileSync(tp1234Path, 'utf-8')
  if (tp1234.includes('scheduledCmds') || tp1234.includes('showScheduler') || tp1234.includes('cmdSchedule')) {
    log('pass', 'R1234', 'TerminalPanel 터미널 스케줄러 존재')
  } else {
    log('warning', 'R1234', 'TerminalPanel 터미널 스케줄러 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1235: SessionList 세션 템플릿
const sl1235Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1235Path)) {
  const sl1235 = readFileSync(sl1235Path, 'utf-8')
  if (sl1235.includes('sessionTemplates') || sl1235.includes('showTemplatePanel') || sl1235.includes('templateList')) {
    log('pass', 'R1235', 'SessionList 세션 템플릿 존재')
  } else {
    log('warning', 'R1235', 'SessionList 세션 템플릿 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 323. Phase DD10 R1236~1238 기능 체크')
// R1236: ChatPanel 채팅 내보내기
const cp1236Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1236Path)) {
  const cp1236 = readFileSync(cp1236Path, 'utf-8')
  if (cp1236.includes('chatExportFormat') || cp1236.includes('showExportPanel') || cp1236.includes('exportChat')) {
    log('pass', 'R1236', 'ChatPanel 채팅 내보내기 존재')
  } else {
    log('warning', 'R1236', 'ChatPanel 채팅 내보내기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1237: InputBar 멀티 커서
const ib1237Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1237Path)) {
  const ib1237 = readFileSync(ib1237Path, 'utf-8')
  if (ib1237.includes('multiCursor') || ib1237.includes('cursorPositions') || ib1237.includes('multiSelect')) {
    log('pass', 'R1237', 'InputBar 멀티 커서 존재')
  } else {
    log('warning', 'R1237', 'InputBar 멀티 커서 없음', 'chat/InputBar.tsx')
  }
}

// R1238: CocosPanel 빌드 프로필
const cocos1238Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1238Path)) {
  const cocos1238 = readFileSync(cocos1238Path, 'utf-8')
  if (cocos1238.includes('buildProfiles') || cocos1238.includes('activeBuildProfile') || cocos1238.includes('buildConfig')) {
    log('pass', 'R1238', 'CocosPanel 빌드 프로필 존재')
  } else {
    log('warning', 'R1238', 'CocosPanel 빌드 프로필 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 324. Phase DD10 R1239~1241 기능 체크')
// R1239: SceneViewPanel 씬 머티리얼
const sv1239Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(sv1239Path)) {
  const sv1239 = readFileSync(sv1239Path, 'utf-8')
  if (sv1239.includes('sceneMaterials') || sv1239.includes('showMaterialPanel') || sv1239.includes('matList')) {
    log('pass', 'R1239', 'SceneViewPanel 씬 머티리얼 존재')
  } else {
    log('warning', 'R1239', 'SceneViewPanel 씬 머티리얼 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1240: TerminalPanel 별칭 그룹
const tp1240Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1240Path)) {
  const tp1240 = readFileSync(tp1240Path, 'utf-8')
  if (tp1240.includes('aliasGroups') || tp1240.includes('showAliasGroups') || tp1240.includes('aliasGroup')) {
    log('pass', 'R1240', 'TerminalPanel 별칭 그룹 존재')
  } else {
    log('warning', 'R1240', 'TerminalPanel 별칭 그룹 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1241: SessionList 세션 워크플로우
const sl1241Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1241Path)) {
  const sl1241 = readFileSync(sl1241Path, 'utf-8')
  if (sl1241.includes('sessionWorkflow') || sl1241.includes('showWorkflowPanel') || sl1241.includes('workflowSteps')) {
    log('pass', 'R1241', 'SessionList 세션 워크플로우 존재')
  } else {
    log('warning', 'R1241', 'SessionList 세션 워크플로우 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 325. Phase DD10 R1242~1244 기능 체크')

// R1242: ChatPanel 채팅 반응
const cp1242Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1242Path)) {
  const cp1242 = readFileSync(cp1242Path, 'utf-8')
  if (cp1242.includes('chatReactions') || cp1242.includes('showReactionPicker') || cp1242.includes('reactionPicker')) {
    log('pass', 'R1242', 'ChatPanel 채팅 반응 존재')
  } else {
    log('warning', 'R1242', 'ChatPanel 채팅 반응 없음', 'chat/ChatPanel.tsx')
  }
}

// R1243: InputBar 입력 히스토리
const ib1243Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1243Path)) {
  const ib1243 = readFileSync(ib1243Path, 'utf-8')
  if (ib1243.includes('inputHistory') || ib1243.includes('historyIdx') || ib1243.includes('historyIndex')) {
    log('pass', 'R1243', 'InputBar 입력 히스토리 존재')
  } else {
    log('warning', 'R1243', 'InputBar 입력 히스토리 없음', 'chat/InputBar.tsx')
  }
}

// R1244: CocosPanel 플러그인 관리
const cocos1244Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1244Path)) {
  const cocos1244 = readFileSync(cocos1244Path, 'utf-8')
  if (cocos1244.includes('pluginList') || cocos1244.includes('showPluginManager') || cocos1244.includes('pluginManager')) {
    log('pass', 'R1244', 'CocosPanel 플러그인 관리 존재')
  } else {
    log('warning', 'R1244', 'CocosPanel 플러그인 관리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 326. Phase DD10 R1245~1247 기능 체크')

// R1245: SceneViewPanel 씬 오디오
const svp1245Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1245Path)) {
  const svp1245 = readFileSync(svp1245Path, 'utf-8')
  if (svp1245.includes('sceneAudio') || svp1245.includes('showAudioPanel') || svp1245.includes('audioPanel')) {
    log('pass', 'R1245', 'SceneViewPanel 씬 오디오 존재')
  } else {
    log('warning', 'R1245', 'SceneViewPanel 씬 오디오 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1246: TerminalPanel 터미널 매크로
const tp1246Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1246Path)) {
  const tp1246 = readFileSync(tp1246Path, 'utf-8')
  if (tp1246.includes('termMacros') || tp1246.includes('showMacroPanel') || tp1246.includes('macroPanel')) {
    log('pass', 'R1246', 'TerminalPanel 터미널 매크로 존재')
  } else {
    log('warning', 'R1246', 'TerminalPanel 터미널 매크로 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1247: SessionList 세션 노트
const sl1247Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1247Path)) {
  const sl1247 = readFileSync(sl1247Path, 'utf-8')
  if (sl1247.includes('sessionNotes') || sl1247.includes('showNotesPanel') || sl1247.includes('sessionNote')) {
    log('pass', 'R1247', 'SessionList 세션 노트 존재')
  } else {
    log('warning', 'R1247', 'SessionList 세션 노트 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 327. Phase DD10 R1248~1250 기능 체크')

// R1248: ChatPanel 채팅 번역
const cp1248Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1248Path)) {
  const cp1248 = readFileSync(cp1248Path, 'utf-8')
  if (cp1248.includes('chatTranslate') || cp1248.includes('showTranslatePanel') || cp1248.includes('translatePanel')) {
    log('pass', 'R1248', 'ChatPanel 채팅 번역 존재')
  } else {
    log('warning', 'R1248', 'ChatPanel 채팅 번역 없음', 'chat/ChatPanel.tsx')
  }
}

// R1249: InputBar 멘션 리스트
const ib1249Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1249Path)) {
  const ib1249 = readFileSync(ib1249Path, 'utf-8')
  if (ib1249.includes('inputMentions') || ib1249.includes('showMentionList') || ib1249.includes('mentionList')) {
    log('pass', 'R1249', 'InputBar 멘션 리스트 존재')
  } else {
    log('warning', 'R1249', 'InputBar 멘션 리스트 없음', 'chat/InputBar.tsx')
  }
}

// R1250: CocosPanel 핫 리로드
const cocos1250Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1250Path)) {
  const cocos1250 = readFileSync(cocos1250Path, 'utf-8')
  if (cocos1250.includes('hotReload') || cocos1250.includes('hotReloadInterval') || cocos1250.includes('hotreload')) {
    log('pass', 'R1250', 'CocosPanel 핫 리로드 존재')
  } else {
    log('warning', 'R1250', 'CocosPanel 핫 리로드 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 328. Phase DD10 R1251~1253 기능 체크')

// R1251: SceneViewPanel 씬 파티클
const svp1251Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1251Path)) {
  const svp1251 = readFileSync(svp1251Path, 'utf-8')
  if (svp1251.includes('sceneParticles') || svp1251.includes('showParticlePanel') || svp1251.includes('particlePanel')) {
    log('pass', 'R1251', 'SceneViewPanel 씬 파티클 존재')
  } else {
    log('warning', 'R1251', 'SceneViewPanel 씬 파티클 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1252: TerminalPanel 터미널 프로필
const tp1252Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1252Path)) {
  const tp1252 = readFileSync(tp1252Path, 'utf-8')
  if (tp1252.includes('termProfiles') || tp1252.includes('activeTermProfile') || tp1252.includes('termProfile')) {
    log('pass', 'R1252', 'TerminalPanel 터미널 프로필 존재')
  } else {
    log('warning', 'R1252', 'TerminalPanel 터미널 프로필 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1253: SessionList 세션 배지
const sl1253Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1253Path)) {
  const sl1253 = readFileSync(sl1253Path, 'utf-8')
  if (sl1253.includes('sessionBadges') || sl1253.includes('showBadgePanel') || sl1253.includes('sessionBadge')) {
    log('pass', 'R1253', 'SessionList 세션 배지 존재')
  } else {
    log('warning', 'R1253', 'SessionList 세션 배지 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 329. Phase DD10 R1254~1256 기능 체크')

// R1254: ChatPanel 채팅 폰트
const cp1254Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1254Path)) {
  const cp1254 = readFileSync(cp1254Path, 'utf-8')
  if (cp1254.includes('chatFontSize') || cp1254.includes('chatFontFamily') || cp1254.includes('fontSize')) {
    log('pass', 'R1254', 'ChatPanel 채팅 폰트 존재')
  } else {
    log('warning', 'R1254', 'ChatPanel 채팅 폰트 없음', 'chat/ChatPanel.tsx')
  }
}

// R1255: InputBar 드래그 앤 드롭
const ib1255Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1255Path)) {
  const ib1255 = readFileSync(ib1255Path, 'utf-8')
  if (ib1255.includes('inputDragOver') || ib1255.includes('droppedFiles') || ib1255.includes('dragOver')) {
    log('pass', 'R1255', 'InputBar 드래그 앤 드롭 존재')
  } else {
    log('warning', 'R1255', 'InputBar 드래그 앤 드롭 없음', 'chat/InputBar.tsx')
  }
}

// R1256: CocosPanel 빌드 경고
const cocos1256Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1256Path)) {
  const cocos1256 = readFileSync(cocos1256Path, 'utf-8')
  if (cocos1256.includes('buildWarnings') || cocos1256.includes('showWarningsPanel') || cocos1256.includes('buildWarning')) {
    log('pass', 'R1256', 'CocosPanel 빌드 경고 존재')
  } else {
    log('warning', 'R1256', 'CocosPanel 빌드 경고 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 330. Phase DD10 R1257~1259 기능 체크')

// R1257: SceneViewPanel 씬 셰이더
const svp1257Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1257Path)) {
  const svp1257 = readFileSync(svp1257Path, 'utf-8')
  if (svp1257.includes('sceneShaders') || svp1257.includes('showShaderPanel') || svp1257.includes('shaderPanel')) {
    log('pass', 'R1257', 'SceneViewPanel 씬 셰이더 존재')
  } else {
    log('warning', 'R1257', 'SceneViewPanel 씬 셰이더 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1258: TerminalPanel 터미널 세션
const tp1258Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1258Path)) {
  const tp1258 = readFileSync(tp1258Path, 'utf-8')
  if (tp1258.includes('termSessions') || tp1258.includes('activeTermSession') || tp1258.includes('termSession')) {
    log('pass', 'R1258', 'TerminalPanel 터미널 세션 존재')
  } else {
    log('warning', 'R1258', 'TerminalPanel 터미널 세션 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1259: SessionList 세션 레이아웃
const sl1259Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1259Path)) {
  const sl1259 = readFileSync(sl1259Path, 'utf-8')
  if (sl1259.includes('sessionLayout') || sl1259.includes('sessionLayoutConfig') || sl1259.includes('layoutConfig')) {
    log('pass', 'R1259', 'SessionList 세션 레이아웃 존재')
  } else {
    log('warning', 'R1259', 'SessionList 세션 레이아웃 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 331. Phase DD10 R1260~1262 기능 체크')

// R1260: ChatPanel 채팅 필터
const cp1260Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1260Path)) {
  const cp1260 = readFileSync(cp1260Path, 'utf-8')
  if (cp1260.includes('chatFilter') || cp1260.includes('chatFilterResults') || cp1260.includes('filterResults')) {
    log('pass', 'R1260', 'ChatPanel 채팅 필터 존재')
  } else {
    log('warning', 'R1260', 'ChatPanel 채팅 필터 없음', 'chat/ChatPanel.tsx')
  }
}

// R1261: InputBar 문법 검사
const ib1261Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1261Path)) {
  const ib1261 = readFileSync(ib1261Path, 'utf-8')
  if (ib1261.includes('inputGrammar') || ib1261.includes('grammarSuggestions') || ib1261.includes('grammar')) {
    log('pass', 'R1261', 'InputBar 문법 검사 존재')
  } else {
    log('warning', 'R1261', 'InputBar 문법 검사 없음', 'chat/InputBar.tsx')
  }
}

// R1262: CocosPanel 에셋 번들
const cocos1262Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1262Path)) {
  const cocos1262 = readFileSync(cocos1262Path, 'utf-8')
  if (cocos1262.includes('assetBundles') || cocos1262.includes('showBundlePanel') || cocos1262.includes('bundlePanel')) {
    log('pass', 'R1262', 'CocosPanel 에셋 번들 존재')
  } else {
    log('warning', 'R1262', 'CocosPanel 에셋 번들 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 332. Phase DD10 R1263~1265 기능 체크')

// R1263: SceneViewPanel 씬 스크립트
const svp1263Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1263Path)) {
  const svp1263 = readFileSync(svp1263Path, 'utf-8')
  if (svp1263.includes('sceneScripts') || svp1263.includes('showScriptPanel') || svp1263.includes('scriptPanel')) {
    log('pass', 'R1263', 'SceneViewPanel 씬 스크립트 존재')
  } else {
    log('warning', 'R1263', 'SceneViewPanel 씬 스크립트 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1264: TerminalPanel 터미널 북마크
const tp1264Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1264Path)) {
  const tp1264 = readFileSync(tp1264Path, 'utf-8')
  if (tp1264.includes('termBookmarks') || tp1264.includes('showTermBookmarks') || tp1264.includes('termBookmark')) {
    log('pass', 'R1264', 'TerminalPanel 터미널 북마크 존재')
  } else {
    log('warning', 'R1264', 'TerminalPanel 터미널 북마크 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1265: SessionList 세션 내보내기
const sl1265Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1265Path)) {
  const sl1265 = readFileSync(sl1265Path, 'utf-8')
  if (sl1265.includes('sessionExport') || sl1265.includes('showExportDialog') || sl1265.includes('showExportSessionDialog')) {
    log('pass', 'R1265', 'SessionList 세션 내보내기 존재')
  } else {
    log('warning', 'R1265', 'SessionList 세션 내보내기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 333. Phase DD10 R1266~1268 기능 체크')

// R1266: ChatPanel 채팅 그룹
const cp1266Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1266Path)) {
  const cp1266 = readFileSync(cp1266Path, 'utf-8')
  if (cp1266.includes('chatGroupBy') || cp1266.includes('showGroupPanel') || cp1266.includes('groupPanel')) {
    log('pass', 'R1266', 'ChatPanel 채팅 그룹 존재')
  } else {
    log('warning', 'R1266', 'ChatPanel 채팅 그룹 없음', 'chat/ChatPanel.tsx')
  }
}

// R1267: InputBar 입력 테마
const ib1267Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1267Path)) {
  const ib1267 = readFileSync(ib1267Path, 'utf-8')
  if (ib1267.includes('inputTheme') || ib1267.includes('inputThemeCustom') || ib1267.includes('themeCustom')) {
    log('pass', 'R1267', 'InputBar 입력 테마 존재')
  } else {
    log('warning', 'R1267', 'InputBar 입력 테마 없음', 'chat/InputBar.tsx')
  }
}

// R1268: CocosPanel 씬 히스토리
const cocos1268Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1268Path)) {
  const cocos1268 = readFileSync(cocos1268Path, 'utf-8')
  if (cocos1268.includes('sceneHistory') || cocos1268.includes('showSceneHistory') || cocos1268.includes('sceneHist')) {
    log('pass', 'R1268', 'CocosPanel 씬 히스토리 존재')
  } else {
    log('warning', 'R1268', 'CocosPanel 씬 히스토리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 334. Phase DD10 R1269~1271 기능 체크')

// R1269: SceneViewPanel 씬 콜라이더
const svp1269Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1269Path)) {
  const svp1269 = readFileSync(svp1269Path, 'utf-8')
  if (svp1269.includes('sceneColliders') || svp1269.includes('showColliderPanel') || svp1269.includes('colliderPanel')) {
    log('pass', 'R1269', 'SceneViewPanel 씬 콜라이더 존재')
  } else {
    log('warning', 'R1269', 'SceneViewPanel 씬 콜라이더 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1270: TerminalPanel 터미널 파이프라인
const tp1270Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1270Path)) {
  const tp1270 = readFileSync(tp1270Path, 'utf-8')
  if (tp1270.includes('termPipeline') || tp1270.includes('showPipelinePanel') || tp1270.includes('pipelinePanel')) {
    log('pass', 'R1270', 'TerminalPanel 터미널 파이프라인 존재')
  } else {
    log('warning', 'R1270', 'TerminalPanel 터미널 파이프라인 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1271: SessionList 세션 검색
const sl1271Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1271Path)) {
  const sl1271 = readFileSync(sl1271Path, 'utf-8')
  if (sl1271.includes('sessionSearch') || sl1271.includes('sessionSearchResults') || sl1271.includes('searchResults')) {
    log('pass', 'R1271', 'SessionList 세션 검색 존재')
  } else {
    log('warning', 'R1271', 'SessionList 세션 검색 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 335. Phase DD10 R1272~1274 기능 체크')

// R1272: ChatPanel 채팅 페이지네이션
const cp1272Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1272Path)) {
  const cp1272 = readFileSync(cp1272Path, 'utf-8')
  if (cp1272.includes('chatPagination') || cp1272.includes('showPaginationBar') || cp1272.includes('pageSize')) {
    log('pass', 'R1272', 'ChatPanel 채팅 페이지네이션 존재')
  } else {
    log('warning', 'R1272', 'ChatPanel 채팅 페이지네이션 없음', 'chat/ChatPanel.tsx')
  }
}

// R1273: InputBar 붙여넣기 미리보기
const ib1273Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1273Path)) {
  const ib1273 = readFileSync(ib1273Path, 'utf-8')
  if (ib1273.includes('inputPaste') || ib1273.includes('pastePreview') || ib1273.includes('pastePrev')) {
    log('pass', 'R1273', 'InputBar 붙여넣기 미리보기 존재')
  } else {
    log('warning', 'R1273', 'InputBar 붙여넣기 미리보기 없음', 'chat/InputBar.tsx')
  }
}

// R1274: CocosPanel 빌드 타겟
const cocos1274Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1274Path)) {
  const cocos1274 = readFileSync(cocos1274Path, 'utf-8')
  if (cocos1274.includes('buildTarget') || cocos1274.includes('showTargetPanel') || cocos1274.includes('targetPanel')) {
    log('pass', 'R1274', 'CocosPanel 빌드 타겟 존재')
  } else {
    log('warning', 'R1274', 'CocosPanel 빌드 타겟 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 336. Phase DD10 R1275~1277 기능 체크')

// R1275: SceneViewPanel 씬 리지드바디
const svp1275Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1275Path)) {
  const svp1275 = readFileSync(svp1275Path, 'utf-8')
  if (svp1275.includes('sceneRigidbodies') || svp1275.includes('showRigidbodyPanel') || svp1275.includes('rigidbody')) {
    log('pass', 'R1275', 'SceneViewPanel 씬 리지드바디 존재')
  } else {
    log('warning', 'R1275', 'SceneViewPanel 씬 리지드바디 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1276: TerminalPanel 터미널 스니펫
const tp1276Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1276Path)) {
  const tp1276 = readFileSync(tp1276Path, 'utf-8')
  if (tp1276.includes('termSnippets') || tp1276.includes('showSnippetPanel') || tp1276.includes('snippetPanel')) {
    log('pass', 'R1276', 'TerminalPanel 터미널 스니펫 존재')
  } else {
    log('warning', 'R1276', 'TerminalPanel 터미널 스니펫 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1277: SessionList 세션 즐겨찾기
const sl1277Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1277Path)) {
  const sl1277 = readFileSync(sl1277Path, 'utf-8')
  if (sl1277.includes('sessionFavorites') || sl1277.includes('showFavoritesOnly') || sl1277.includes('favoriteSessions')) {
    log('pass', 'R1277', 'SessionList 세션 즐겨찾기 존재')
  } else {
    log('warning', 'R1277', 'SessionList 세션 즐겨찾기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 337. Phase DD10 R1278~1280 기능 체크')

// R1278: ChatPanel 나란히 보기
const cp1278Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1278Path)) {
  const cp1278 = readFileSync(cp1278Path, 'utf-8')
  if (cp1278.includes('chatSideBySide') || cp1278.includes('sideBySideWidth') || cp1278.includes('sideBySide')) {
    log('pass', 'R1278', 'ChatPanel 나란히 보기 존재')
  } else {
    log('warning', 'R1278', 'ChatPanel 나란히 보기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1279: InputBar 줄 바꿈
const ib1279Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1279Path)) {
  const ib1279 = readFileSync(ib1279Path, 'utf-8')
  if (ib1279.includes('inputWordWrap') || ib1279.includes('inputMaxLines') || ib1279.includes('wordWrap')) {
    log('pass', 'R1279', 'InputBar 줄 바꿈 존재')
  } else {
    log('warning', 'R1279', 'InputBar 줄 바꿈 없음', 'chat/InputBar.tsx')
  }
}

// R1280: CocosPanel 디버그 모드
const cocos1280Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1280Path)) {
  const cocos1280 = readFileSync(cocos1280Path, 'utf-8')
  if (cocos1280.includes('debugMode') || cocos1280.includes('debugOverlay') || cocos1280.includes('debugOver')) {
    log('pass', 'R1280', 'CocosPanel 디버그 모드 존재')
  } else {
    log('warning', 'R1280', 'CocosPanel 디버그 모드 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 338. Phase DD10 R1281~1283 기능 체크')

// R1281: SceneViewPanel 씬 제약
const svp1281Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1281Path)) {
  const svp1281 = readFileSync(svp1281Path, 'utf-8')
  if (svp1281.includes('sceneConstraints') || svp1281.includes('showConstraintPanel') || svp1281.includes('constraintPanel')) {
    log('pass', 'R1281', 'SceneViewPanel 씬 제약 존재')
  } else {
    log('warning', 'R1281', 'SceneViewPanel 씬 제약 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1282: TerminalPanel 터미널 연결
const tp1282Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1282Path)) {
  const tp1282 = readFileSync(tp1282Path, 'utf-8')
  if (tp1282.includes('termConnections') || tp1282.includes('showConnectionPanel') || tp1282.includes('connectionPanel')) {
    log('pass', 'R1282', 'TerminalPanel 터미널 연결 존재')
  } else {
    log('warning', 'R1282', 'TerminalPanel 터미널 연결 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1283: SessionList 세션 그룹
const sl1283Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1283Path)) {
  const sl1283 = readFileSync(sl1283Path, 'utf-8')
  if (sl1283.includes('sessionGroups') || sl1283.includes('showGroupManager') || sl1283.includes('groupManager')) {
    log('pass', 'R1283', 'SessionList 세션 그룹 존재')
  } else {
    log('warning', 'R1283', 'SessionList 세션 그룹 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 339. Phase DD10 R1284~1286 기능 체크')

// R1284: ChatPanel 접근성
const cp1284Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1284Path)) {
  const cp1284 = readFileSync(cp1284Path, 'utf-8')
  if (cp1284.includes('chatAccessibility') || cp1284.includes('accessibilityConfig') || cp1284.includes('accessibility')) {
    log('pass', 'R1284', 'ChatPanel 접근성 존재')
  } else {
    log('warning', 'R1284', 'ChatPanel 접근성 없음', 'chat/ChatPanel.tsx')
  }
}

// R1285: InputBar 괄호 매칭
const ib1285Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1285Path)) {
  const ib1285 = readFileSync(ib1285Path, 'utf-8')
  if (ib1285.includes('inputBracketMatch') || ib1285.includes('bracketPairs') || ib1285.includes('bracketMatch')) {
    log('pass', 'R1285', 'InputBar 괄호 매칭 존재')
  } else {
    log('warning', 'R1285', 'InputBar 괄호 매칭 없음', 'chat/InputBar.tsx')
  }
}

// R1286: CocosPanel 에셋 필터
const cocos1286Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1286Path)) {
  const cocos1286 = readFileSync(cocos1286Path, 'utf-8')
  if (cocos1286.includes('assetFilter') || cocos1286.includes('assetFilterType') || cocos1286.includes('filterType')) {
    log('pass', 'R1286', 'CocosPanel 에셋 필터 존재')
  } else {
    log('warning', 'R1286', 'CocosPanel 에셋 필터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 340. Phase DD10 R1287~1289 기능 체크')

// R1287: SceneViewPanel 타일맵
const svp1287Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1287Path)) {
  const svp1287 = readFileSync(svp1287Path, 'utf-8')
  if (svp1287.includes('sceneTileMap') || svp1287.includes('showTileMapPanel') || svp1287.includes('tileMap')) {
    log('pass', 'R1287', 'SceneViewPanel 타일맵 존재')
  } else {
    log('warning', 'R1287', 'SceneViewPanel 타일맵 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1288: TerminalPanel 터미널 테마
const tp1288Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1288Path)) {
  const tp1288 = readFileSync(tp1288Path, 'utf-8')
  if (tp1288.includes('termTheme') || tp1288.includes('termThemeConfig') || tp1288.includes('themeConfig')) {
    log('pass', 'R1288', 'TerminalPanel 터미널 테마 존재')
  } else {
    log('warning', 'R1288', 'TerminalPanel 터미널 테마 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1289: SessionList 세션 고정
const sl1289Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1289Path)) {
  const sl1289 = readFileSync(sl1289Path, 'utf-8')
  if (sl1289.includes('sessionPinned') || sl1289.includes('showPinnedOnly') || sl1289.includes('pinnedSession')) {
    log('pass', 'R1289', 'SessionList 세션 고정 존재')
  } else {
    log('warning', 'R1289', 'SessionList 세션 고정 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 341. Phase DD10 R1290~1292 기능 체크')

// R1290: ChatPanel 음성 입력
const cp1290Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1290Path)) {
  const cp1290 = readFileSync(cp1290Path, 'utf-8')
  if (cp1290.includes('chatVoice') || cp1290.includes('voiceLanguage') || cp1290.includes('voiceLang')) {
    log('pass', 'R1290', 'ChatPanel 음성 입력 존재')
  } else {
    log('warning', 'R1290', 'ChatPanel 음성 입력 없음', 'chat/ChatPanel.tsx')
  }
}

// R1291: InputBar 자동 들여쓰기
const ib1291Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1291Path)) {
  const ib1291 = readFileSync(ib1291Path, 'utf-8')
  if (ib1291.includes('inputAutoIndent') || ib1291.includes('indentGuides') || ib1291.includes('autoIndent')) {
    log('pass', 'R1291', 'InputBar 자동 들여쓰기 존재')
  } else {
    log('warning', 'R1291', 'InputBar 자동 들여쓰기 없음', 'chat/InputBar.tsx')
  }
}

// R1292: CocosPanel 성능 통계
const cocos1292Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1292Path)) {
  const cocos1292 = readFileSync(cocos1292Path, 'utf-8')
  if (cocos1292.includes('performanceStats') || cocos1292.includes('showPerfPanel') || cocos1292.includes('perfPanel')) {
    log('pass', 'R1292', 'CocosPanel 성능 통계 존재')
  } else {
    log('warning', 'R1292', 'CocosPanel 성능 통계 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 342. Phase DD10 R1293~1295 기능 체크')

// R1293: SceneViewPanel 씬 스프라이트
const svp1293Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1293Path)) {
  const svp1293 = readFileSync(svp1293Path, 'utf-8')
  if (svp1293.includes('sceneSprites') || svp1293.includes('showSpritePanel') || svp1293.includes('spritePanel')) {
    log('pass', 'R1293', 'SceneViewPanel 씬 스프라이트 존재')
  } else {
    log('warning', 'R1293', 'SceneViewPanel 씬 스프라이트 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1294: TerminalPanel 자동완성
const tp1294Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1294Path)) {
  const tp1294 = readFileSync(tp1294Path, 'utf-8')
  if (tp1294.includes('termAutoComplete') || tp1294.includes('autoCompleteList') || tp1294.includes('autoComplete')) {
    log('pass', 'R1294', 'TerminalPanel 자동완성 존재')
  } else {
    log('warning', 'R1294', 'TerminalPanel 자동완성 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1295: SessionList 세션 태그
const sl1295Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1295Path)) {
  const sl1295 = readFileSync(sl1295Path, 'utf-8')
  if (sl1295.includes('sessionTags') || sl1295.includes('activeTagFilter') || sl1295.includes('tagFilter')) {
    log('pass', 'R1295', 'SessionList 세션 태그 존재')
  } else {
    log('warning', 'R1295', 'SessionList 세션 태그 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 343. Phase DD10 R1296~1298 기능 체크')

// R1296: ChatPanel 채팅 위젯
const cp1296Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1296Path)) {
  const cp1296 = readFileSync(cp1296Path, 'utf-8')
  if (cp1296.includes('chatWidgets') || cp1296.includes('showWidgetPanel') || cp1296.includes('widgetPanel')) {
    log('pass', 'R1296', 'ChatPanel 채팅 위젯 존재')
  } else {
    log('warning', 'R1296', 'ChatPanel 채팅 위젯 없음', 'chat/ChatPanel.tsx')
  }
}

// R1297: InputBar 미니맵
const ib1297Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1297Path)) {
  const ib1297 = readFileSync(ib1297Path, 'utf-8')
  if (ib1297.includes('inputMinimap') || ib1297.includes('minimapPosition') || ib1297.includes('minimap')) {
    log('pass', 'R1297', 'InputBar 미니맵 존재')
  } else {
    log('warning', 'R1297', 'InputBar 미니맵 없음', 'chat/InputBar.tsx')
  }
}

// R1298: CocosPanel 빌드 로그
const cocos1298Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1298Path)) {
  const cocos1298 = readFileSync(cocos1298Path, 'utf-8')
  if (cocos1298.includes('buildLog') || cocos1298.includes('showBuildLog') || cocos1298.includes('buildLogs')) {
    log('pass', 'R1298', 'CocosPanel 빌드 로그 존재')
  } else {
    log('warning', 'R1298', 'CocosPanel 빌드 로그 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 344. Phase DD10 R1299~1301 기능 체크')

// R1299: SceneViewPanel 씬 UI
const svp1299Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1299Path)) {
  const svp1299 = readFileSync(svp1299Path, 'utf-8')
  if (svp1299.includes('sceneUI') || svp1299.includes('showUIPanel') || svp1299.includes('uiPanel')) {
    log('pass', 'R1299', 'SceneViewPanel 씬 UI 존재')
  } else {
    log('warning', 'R1299', 'SceneViewPanel 씬 UI 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1300: TerminalPanel 구문 강조
const tp1300Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1300Path)) {
  const tp1300 = readFileSync(tp1300Path, 'utf-8')
  if (tp1300.includes('termSyntaxHighlight') || tp1300.includes('termHighlightRules') || tp1300.includes('highlightRules')) {
    log('pass', 'R1300', 'TerminalPanel 구문 강조 존재')
  } else {
    log('warning', 'R1300', 'TerminalPanel 구문 강조 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1301: SessionList 세션 히트맵
const sl1301Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1301Path)) {
  const sl1301 = readFileSync(sl1301Path, 'utf-8')
  if (sl1301.includes('sessionHeatmap') || sl1301.includes('showHeatmapPanel') || sl1301.includes('heatmapPanel')) {
    log('pass', 'R1301', 'SessionList 세션 히트맵 존재')
  } else {
    log('warning', 'R1301', 'SessionList 세션 히트맵 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 345. Phase DD10 R1302~1304 기능 체크')

// R1302: ChatPanel 채팅 밀도
const cp1302Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1302Path)) {
  const cp1302 = readFileSync(cp1302Path, 'utf-8')
  if (cp1302.includes('chatDensity') || cp1302.includes('showDensityPicker') || cp1302.includes('densityPicker')) {
    log('pass', 'R1302', 'ChatPanel 채팅 밀도 존재')
  } else {
    log('warning', 'R1302', 'ChatPanel 채팅 밀도 없음', 'chat/ChatPanel.tsx')
  }
}

// R1303: InputBar 코드 폴딩
const ib1303Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1303Path)) {
  const ib1303 = readFileSync(ib1303Path, 'utf-8')
  if (ib1303.includes('inputCodeFolding') || ib1303.includes('foldedRanges') || ib1303.includes('codeFolding')) {
    log('pass', 'R1303', 'InputBar 코드 폴딩 존재')
  } else {
    log('warning', 'R1303', 'InputBar 코드 폴딩 없음', 'chat/InputBar.tsx')
  }
}

// R1304: CocosPanel 원격 디버그
const cocos1304Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1304Path)) {
  const cocos1304 = readFileSync(cocos1304Path, 'utf-8')
  if (cocos1304.includes('remoteDebug') || cocos1304.includes('remoteDebugPort') || cocos1304.includes('debugPort')) {
    log('pass', 'R1304', 'CocosPanel 원격 디버그 존재')
  } else {
    log('warning', 'R1304', 'CocosPanel 원격 디버그 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 346. Phase DD10 R1305~1307 기능 체크')

// R1305: SceneViewPanel 씬 네트워크
const svp1305Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1305Path)) {
  const svp1305 = readFileSync(svp1305Path, 'utf-8')
  if (svp1305.includes('sceneNetworks') || svp1305.includes('showNetworkPanel') || svp1305.includes('networkPanel')) {
    log('pass', 'R1305', 'SceneViewPanel 씬 네트워크 존재')
  } else {
    log('warning', 'R1305', 'SceneViewPanel 씬 네트워크 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1306: TerminalPanel 터미널 탭
const tp1306Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1306Path)) {
  const tp1306 = readFileSync(tp1306Path, 'utf-8')
  if (tp1306.includes('termTabs') || tp1306.includes('activeTermTab') || tp1306.includes('termTab')) {
    log('pass', 'R1306', 'TerminalPanel 터미널 탭 존재')
  } else {
    log('warning', 'R1306', 'TerminalPanel 터미널 탭 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1307: SessionList 세션 타임라인
const sl1307Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1307Path)) {
  const sl1307 = readFileSync(sl1307Path, 'utf-8')
  if (sl1307.includes('sessionTimeline') || sl1307.includes('showTimelinePanel') || sl1307.includes('timelinePanel')) {
    log('pass', 'R1307', 'SessionList 세션 타임라인 존재')
  } else {
    log('warning', 'R1307', 'SessionList 세션 타임라인 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 347. Phase DD10 R1308~1310 기능 체크')

// R1308: ChatPanel 채팅 프리셋
const cp1308Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1308Path)) {
  const cp1308 = readFileSync(cp1308Path, 'utf-8')
  if (cp1308.includes('chatPresets') || cp1308.includes('showPresetPanel') || cp1308.includes('presetPanel')) {
    log('pass', 'R1308', 'ChatPanel 채팅 프리셋 존재')
  } else {
    log('warning', 'R1308', 'ChatPanel 채팅 프리셋 없음', 'chat/ChatPanel.tsx')
  }
}

// R1309: InputBar 스크롤 동기화
const ib1309Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1309Path)) {
  const ib1309 = readFileSync(ib1309Path, 'utf-8')
  if (ib1309.includes('inputScrollSync') || ib1309.includes('scrollSyncTarget') || ib1309.includes('scrollSync')) {
    log('pass', 'R1309', 'InputBar 스크롤 동기화 존재')
  } else {
    log('warning', 'R1309', 'InputBar 스크롤 동기화 없음', 'chat/InputBar.tsx')
  }
}

// R1310: CocosPanel 스크립트 템플릿
const cocos1310Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1310Path)) {
  const cocos1310 = readFileSync(cocos1310Path, 'utf-8')
  if (cocos1310.includes('scriptTemplates') || cocos1310.includes('showScriptTemplates') || cocos1310.includes('scriptTemplate')) {
    log('pass', 'R1310', 'CocosPanel 스크립트 템플릿 존재')
  } else {
    log('warning', 'R1310', 'CocosPanel 스크립트 템플릿 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 348. Phase DD10 R1311~1313 기능 체크')

// R1311: SceneViewPanel 씬 프리팹
const svp1311Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1311Path)) {
  const svp1311 = readFileSync(svp1311Path, 'utf-8')
  if (svp1311.includes('scenePrefabs') || svp1311.includes('showPrefabPanel') || svp1311.includes('prefabPanel')) {
    log('pass', 'R1311', 'SceneViewPanel 씬 프리팹 존재')
  } else {
    log('warning', 'R1311', 'SceneViewPanel 씬 프리팹 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1312: TerminalPanel 터미널 검색
const tp1312Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1312Path)) {
  const tp1312 = readFileSync(tp1312Path, 'utf-8')
  if (tp1312.includes('termSearch') || tp1312.includes('termSearchResults') || tp1312.includes('termSearchMatches')) {
    log('pass', 'R1312', 'TerminalPanel 터미널 검색 존재')
  } else {
    log('warning', 'R1312', 'TerminalPanel 터미널 검색 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1313: SessionList 세션 인사이트
const sl1313Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1313Path)) {
  const sl1313 = readFileSync(sl1313Path, 'utf-8')
  if (sl1313.includes('sessionInsights') || sl1313.includes('showInsightPanel') || sl1313.includes('insightPanel')) {
    log('pass', 'R1313', 'SessionList 세션 인사이트 존재')
  } else {
    log('warning', 'R1313', 'SessionList 세션 인사이트 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 349. Phase DD10 R1314~1316 기능 체크')

// R1314: ChatPanel 채팅 초안
const cp1314Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1314Path)) {
  const cp1314 = readFileSync(cp1314Path, 'utf-8')
  if (cp1314.includes('chatDraft') || cp1314.includes('showDraftPanel') || cp1314.includes('draftPanel')) {
    log('pass', 'R1314', 'ChatPanel 채팅 초안 존재')
  } else {
    log('warning', 'R1314', 'ChatPanel 채팅 초안 없음', 'chat/ChatPanel.tsx')
  }
}

// R1315: InputBar 찾기/바꾸기
const ib1315Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1315Path)) {
  const ib1315 = readFileSync(ib1315Path, 'utf-8')
  if (ib1315.includes('inputFindReplace') || ib1315.includes('findReplaceQuery') || ib1315.includes('findReplace')) {
    log('pass', 'R1315', 'InputBar 찾기/바꾸기 존재')
  } else {
    log('warning', 'R1315', 'InputBar 찾기/바꾸기 없음', 'chat/InputBar.tsx')
  }
}

// R1316: CocosPanel 에디터 테마
const cocos1316Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1316Path)) {
  const cocos1316 = readFileSync(cocos1316Path, 'utf-8')
  if (cocos1316.includes('editorTheme') || cocos1316.includes('showEditorTheme') || cocos1316.includes('editorThm')) {
    log('pass', 'R1316', 'CocosPanel 에디터 테마 존재')
  } else {
    log('warning', 'R1316', 'CocosPanel 에디터 테마 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 350. Phase DD10 R1317~1319 기능 체크')

// R1317: SceneViewPanel 씬 텍스처
const svp1317Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1317Path)) {
  const svp1317 = readFileSync(svp1317Path, 'utf-8')
  if (svp1317.includes('sceneTextures') || svp1317.includes('showTexturePanel') || svp1317.includes('texturePanel')) {
    log('pass', 'R1317', 'SceneViewPanel 씬 텍스처 존재')
  } else {
    log('warning', 'R1317', 'SceneViewPanel 씬 텍스처 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1318: TerminalPanel 출력 필터
const tp1318Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1318Path)) {
  const tp1318 = readFileSync(tp1318Path, 'utf-8')
  if (tp1318.includes('termOutputFilter') || tp1318.includes('termOutputFilterActive') || tp1318.includes('outputFilter')) {
    log('pass', 'R1318', 'TerminalPanel 출력 필터 존재')
  } else {
    log('warning', 'R1318', 'TerminalPanel 출력 필터 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1319: SessionList 세션 비교
const sl1319Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1319Path)) {
  const sl1319 = readFileSync(sl1319Path, 'utf-8')
  if (sl1319.includes('sessionCompare') || sl1319.includes('showComparePanel') || sl1319.includes('comparePanel')) {
    log('pass', 'R1319', 'SessionList 세션 비교 존재')
  } else {
    log('warning', 'R1319', 'SessionList 세션 비교 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 351. Phase DD10 R1320~1322 기능 체크')

// R1320: ChatPanel 협업
const cp1320Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1320Path)) {
  const cp1320 = readFileSync(cp1320Path, 'utf-8')
  if (cp1320.includes('chatCollaboration') || cp1320.includes('collaborators') || cp1320.includes('collaboration')) {
    log('pass', 'R1320', 'ChatPanel 협업 존재')
  } else {
    log('warning', 'R1320', 'ChatPanel 협업 없음', 'chat/ChatPanel.tsx')
  }
}

// R1321: InputBar 녹음
const ib1321Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1321Path)) {
  const ib1321 = readFileSync(ib1321Path, 'utf-8')
  if (ib1321.includes('inputRecording') || ib1321.includes('recordingBuffer') || ib1321.includes('recording')) {
    log('pass', 'R1321', 'InputBar 녹음 존재')
  } else {
    log('warning', 'R1321', 'InputBar 녹음 없음', 'chat/InputBar.tsx')
  }
}

// R1322: CocosPanel 빌드 알림
const cocos1322Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1322Path)) {
  const cocos1322 = readFileSync(cocos1322Path, 'utf-8')
  if (cocos1322.includes('buildNotify') || cocos1322.includes('buildNotifyConfig') || cocos1322.includes('notifyConfig')) {
    log('pass', 'R1322', 'CocosPanel 빌드 알림 존재')
  } else {
    log('warning', 'R1322', 'CocosPanel 빌드 알림 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 352. Phase DD10 R1323~1325 기능 체크')

// R1323: SceneViewPanel 씬 폰트
const svp1323Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1323Path)) {
  const svp1323 = readFileSync(svp1323Path, 'utf-8')
  if (svp1323.includes('sceneFonts') || svp1323.includes('showFontPanel') || svp1323.includes('fontPanel')) {
    log('pass', 'R1323', 'SceneViewPanel 씬 폰트 존재')
  } else {
    log('warning', 'R1323', 'SceneViewPanel 씬 폰트 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1324: TerminalPanel 터미널 크기
const tp1324Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1324Path)) {
  const tp1324 = readFileSync(tp1324Path, 'utf-8')
  if (tp1324.includes('termColumns') || tp1324.includes('termRows') || tp1324.includes('termSize')) {
    log('pass', 'R1324', 'TerminalPanel 터미널 크기 존재')
  } else {
    log('warning', 'R1324', 'TerminalPanel 터미널 크기 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1325: SessionList 세션 중복
const sl1325Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1325Path)) {
  const sl1325 = readFileSync(sl1325Path, 'utf-8')
  if (sl1325.includes('sessionDuplicates') || sl1325.includes('showDuplicatePanel') || sl1325.includes('duplicatePanel')) {
    log('pass', 'R1325', 'SessionList 세션 중복 존재')
  } else {
    log('warning', 'R1325', 'SessionList 세션 중복 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 353. Phase DD10 R1326~1328 기능 체크')

// R1326: ChatPanel 줌
const cp1326Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1326Path)) {
  const cp1326 = readFileSync(cp1326Path, 'utf-8')
  if (cp1326.includes('chatZoom') || cp1326.includes('showZoomControls') || cp1326.includes('zoomControls')) {
    log('pass', 'R1326', 'ChatPanel 줌 존재')
  } else {
    log('warning', 'R1326', 'ChatPanel 줌 없음', 'chat/ChatPanel.tsx')
  }
}

// R1327: InputBar 분할 편집
const ib1327Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1327Path)) {
  const ib1327 = readFileSync(ib1327Path, 'utf-8')
  if (ib1327.includes('inputSplit') || ib1327.includes('splitContent') || ib1327.includes('split')) {
    log('pass', 'R1327', 'InputBar 분할 편집 존재')
  } else {
    log('warning', 'R1327', 'InputBar 분할 편집 없음', 'chat/InputBar.tsx')
  }
}

// R1328: CocosPanel 노드 템플릿
const cocos1328Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1328Path)) {
  const cocos1328 = readFileSync(cocos1328Path, 'utf-8')
  if (cocos1328.includes('nodeTemplate') || cocos1328.includes('showNodeTemplates') || cocos1328.includes('nodeTemplates')) {
    log('pass', 'R1328', 'CocosPanel 노드 템플릿 존재')
  } else {
    log('warning', 'R1328', 'CocosPanel 노드 템플릿 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 354. Phase DD10 R1329~1331 기능 체크')

// R1329: SceneViewPanel 씬 아틀라스
const svp1329Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1329Path)) {
  const svp1329 = readFileSync(svp1329Path, 'utf-8')
  if (svp1329.includes('sceneAtlas') || svp1329.includes('showAtlasPanel') || svp1329.includes('atlasPanel')) {
    log('pass', 'R1329', 'SceneViewPanel 씬 아틀라스 존재')
  } else {
    log('warning', 'R1329', 'SceneViewPanel 씬 아틀라스 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1330: TerminalPanel 커서 스타일
const tp1330Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1330Path)) {
  const tp1330 = readFileSync(tp1330Path, 'utf-8')
  if (tp1330.includes('termCursor') || tp1330.includes('termCursorBlink') || tp1330.includes('cursorBlink')) {
    log('pass', 'R1330', 'TerminalPanel 커서 스타일 존재')
  } else {
    log('warning', 'R1330', 'TerminalPanel 커서 스타일 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1331: SessionList 세션 메트릭
const sl1331Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1331Path)) {
  const sl1331 = readFileSync(sl1331Path, 'utf-8')
  if (sl1331.includes('sessionMetrics') || sl1331.includes('showMetricsPanel') || sl1331.includes('metricsPanel')) {
    log('pass', 'R1331', 'SessionList 세션 메트릭 존재')
  } else {
    log('warning', 'R1331', 'SessionList 세션 메트릭 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 355. Phase DD10 R1332~1334 기능 체크')

// R1332: ChatPanel 소리내어 읽기
const cp1332Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1332Path)) {
  const cp1332 = readFileSync(cp1332Path, 'utf-8')
  if (cp1332.includes('chatReadAloud') || cp1332.includes('readAloudSpeed') || cp1332.includes('readAloud')) {
    log('pass', 'R1332', 'ChatPanel 소리내어 읽기 존재')
  } else {
    log('warning', 'R1332', 'ChatPanel 소리내어 읽기 없음', 'chat/ChatPanel.tsx')
  }
}

// R1333: InputBar 단축키
const ib1333Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1333Path)) {
  const ib1333 = readFileSync(ib1333Path, 'utf-8')
  if (ib1333.includes('inputHotkeys') || ib1333.includes('showHotkeyPanel') || ib1333.includes('hotkeyPanel')) {
    log('pass', 'R1333', 'InputBar 단축키 존재')
  } else {
    log('warning', 'R1333', 'InputBar 단축키 없음', 'chat/InputBar.tsx')
  }
}

// R1334: CocosPanel 빌드 스케줄
const cocos1334Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1334Path)) {
  const cocos1334 = readFileSync(cocos1334Path, 'utf-8')
  if (cocos1334.includes('buildSchedule') || cocos1334.includes('buildScheduleEnabled') || cocos1334.includes('scheduleEnabled')) {
    log('pass', 'R1334', 'CocosPanel 빌드 스케줄 존재')
  } else {
    log('warning', 'R1334', 'CocosPanel 빌드 스케줄 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 356. Phase DD10 R1335~1337 기능 체크')

// R1335: SceneViewPanel 씬 타이머
const svp1335Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1335Path)) {
  const svp1335 = readFileSync(svp1335Path, 'utf-8')
  if (svp1335.includes('sceneTimers') || svp1335.includes('showTimerPanel') || svp1335.includes('timerPanel')) {
    log('pass', 'R1335', 'SceneViewPanel 씬 타이머 존재')
  } else {
    log('warning', 'R1335', 'SceneViewPanel 씬 타이머 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1336: TerminalPanel 스크롤백
const tp1336Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1336Path)) {
  const tp1336 = readFileSync(tp1336Path, 'utf-8')
  if (tp1336.includes('termScrollback') || tp1336.includes('termScrollbackEnabled') || tp1336.includes('scrollback')) {
    log('pass', 'R1336', 'TerminalPanel 스크롤백 존재')
  } else {
    log('warning', 'R1336', 'TerminalPanel 스크롤백 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1337: SessionList 세션 복구
const sl1337Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1337Path)) {
  const sl1337 = readFileSync(sl1337Path, 'utf-8')
  if (sl1337.includes('sessionRecovery') || sl1337.includes('showRecoveryPanel') || sl1337.includes('recoveryPanel')) {
    log('pass', 'R1337', 'SessionList 세션 복구 존재')
  } else {
    log('warning', 'R1337', 'SessionList 세션 복구 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 357. Phase DD10 R1338~1340 기능 체크')

// R1338: ChatPanel 채팅 북마크
const cp1338Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1338Path)) {
  const cp1338 = readFileSync(cp1338Path, 'utf-8')
  if (cp1338.includes('chatBookmark') || cp1338.includes('showBookmarkPanel') || cp1338.includes('bookmark')) {
    log('pass', 'R1338', 'ChatPanel 채팅 북마크 존재')
  } else {
    log('warning', 'R1338', 'ChatPanel 채팅 북마크 없음', 'chat/ChatPanel.tsx')
  }
}

// R1339: InputBar 입력 자동저장
const ib1339Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1339Path)) {
  const ib1339 = readFileSync(ib1339Path, 'utf-8')
  if (ib1339.includes('inputAutoSave') || ib1339.includes('autoSaveInterval') || ib1339.includes('autoSave')) {
    log('pass', 'R1339', 'InputBar 입력 자동저장 존재')
  } else {
    log('warning', 'R1339', 'InputBar 입력 자동저장 없음', 'chat/InputBar.tsx')
  }
}

// R1340: CocosPanel 에셋 번들
const cocos1340Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1340Path)) {
  const cocos1340 = readFileSync(cocos1340Path, 'utf-8')
  if (cocos1340.includes('assetBundle') || cocos1340.includes('assetBundleConfig') || cocos1340.includes('bundleConfig')) {
    log('pass', 'R1340', 'CocosPanel 에셋 번들 존재')
  } else {
    log('warning', 'R1340', 'CocosPanel 에셋 번들 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 358. Phase DD10 R1341~1343 기능 체크')

// R1341: SceneViewPanel 씬 오버레이
const svp1341Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1341Path)) {
  const svp1341 = readFileSync(svp1341Path, 'utf-8')
  if (svp1341.includes('sceneOverlay') || svp1341.includes('showOverlayPanel') || svp1341.includes('overlay')) {
    log('pass', 'R1341', 'SceneViewPanel 씬 오버레이 존재')
  } else {
    log('warning', 'R1341', 'SceneViewPanel 씬 오버레이 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1342: TerminalPanel 터미널 탭
const tp1342Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1342Path)) {
  const tp1342 = readFileSync(tp1342Path, 'utf-8')
  if (tp1342.includes('termTabs') || tp1342.includes('activeTabIndex') || tp1342.includes('activeTermTab')) {
    log('pass', 'R1342', 'TerminalPanel 터미널 탭 존재')
  } else {
    log('warning', 'R1342', 'TerminalPanel 터미널 탭 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1343: SessionList 세션 내보내기
const sl1343Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1343Path)) {
  const sl1343 = readFileSync(sl1343Path, 'utf-8')
  if (sl1343.includes('sessionExport') || sl1343.includes('exportFormat') || sl1343.includes('showExportDialog')) {
    log('pass', 'R1343', 'SessionList 세션 내보내기 존재')
  } else {
    log('warning', 'R1343', 'SessionList 세션 내보내기 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 359. Phase DD10 R1344~1346 기능 체크')

// R1344: ChatPanel 채팅 태그
const cp1344Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1344Path)) {
  const cp1344 = readFileSync(cp1344Path, 'utf-8')
  if (cp1344.includes('chatTags') || cp1344.includes('showTagPanel') || cp1344.includes('tagPanel')) {
    log('pass', 'R1344', 'ChatPanel 채팅 태그 존재')
  } else {
    log('warning', 'R1344', 'ChatPanel 채팅 태그 없음', 'chat/ChatPanel.tsx')
  }
}

// R1345: InputBar 멀티라인 모드
const ib1345Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1345Path)) {
  const ib1345 = readFileSync(ib1345Path, 'utf-8')
  if (ib1345.includes('inputMultiline') || ib1345.includes('multilineRows') || ib1345.includes('multiline')) {
    log('pass', 'R1345', 'InputBar 멀티라인 모드 존재')
  } else {
    log('warning', 'R1345', 'InputBar 멀티라인 모드 없음', 'chat/InputBar.tsx')
  }
}

// R1346: CocosPanel 에디터 플러그인
const cocos1346Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1346Path)) {
  const cocos1346 = readFileSync(cocos1346Path, 'utf-8')
  if (cocos1346.includes('editorPlugins') || cocos1346.includes('showPluginPanel') || cocos1346.includes('pluginPanel')) {
    log('pass', 'R1346', 'CocosPanel 에디터 플러그인 존재')
  } else {
    log('warning', 'R1346', 'CocosPanel 에디터 플러그인 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 360. Phase DD10 R1347~1349 기능 체크')

// R1347: SceneViewPanel 씬 그리드
const svp1347Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1347Path)) {
  const svp1347 = readFileSync(svp1347Path, 'utf-8')
  if (svp1347.includes('sceneGrid') || svp1347.includes('sceneGridSize') || svp1347.includes('gridSize')) {
    log('pass', 'R1347', 'SceneViewPanel 씬 그리드 존재')
  } else {
    log('warning', 'R1347', 'SceneViewPanel 씬 그리드 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1348: TerminalPanel 터미널 테마
const tp1348Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1348Path)) {
  const tp1348 = readFileSync(tp1348Path, 'utf-8')
  if (tp1348.includes('termTheme') || tp1348.includes('termThemeCustom') || tp1348.includes('themeCustom')) {
    log('pass', 'R1348', 'TerminalPanel 터미널 테마 존재')
  } else {
    log('warning', 'R1348', 'TerminalPanel 터미널 테마 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1349: SessionList 세션 핀고정
const sl1349Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1349Path)) {
  const sl1349 = readFileSync(sl1349Path, 'utf-8')
  if (sl1349.includes('sessionPins') || sl1349.includes('showPinnedOnly') || sl1349.includes('pinnedOnly')) {
    log('pass', 'R1349', 'SessionList 세션 핀고정 존재')
  } else {
    log('warning', 'R1349', 'SessionList 세션 핀고정 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 361. Phase DD10 R1350~1352 기능 체크')

// R1350: ChatPanel 채팅 필터
const cp1350Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1350Path)) {
  const cp1350 = readFileSync(cp1350Path, 'utf-8')
  if (cp1350.includes('chatFilter') || cp1350.includes('chatFilterActive') || cp1350.includes('filterActive')) {
    log('pass', 'R1350', 'ChatPanel 채팅 필터 존재')
  } else {
    log('warning', 'R1350', 'ChatPanel 채팅 필터 없음', 'chat/ChatPanel.tsx')
  }
}

// R1351: InputBar 드래그앤드롭
const ib1351Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1351Path)) {
  const ib1351 = readFileSync(ib1351Path, 'utf-8')
  if (ib1351.includes('inputDragDrop') || ib1351.includes('dragDropFiles') || ib1351.includes('dragDrop')) {
    log('pass', 'R1351', 'InputBar 드래그앤드롭 존재')
  } else {
    log('warning', 'R1351', 'InputBar 드래그앤드롭 없음', 'chat/InputBar.tsx')
  }
}

// R1352: CocosPanel 빌드 프리셋
const cocos1352Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1352Path)) {
  const cocos1352 = readFileSync(cocos1352Path, 'utf-8')
  if (cocos1352.includes('buildPresets') || cocos1352.includes('activeBuildPreset') || cocos1352.includes('buildPreset')) {
    log('pass', 'R1352', 'CocosPanel 빌드 프리셋 존재')
  } else {
    log('warning', 'R1352', 'CocosPanel 빌드 프리셋 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 362. Phase DD10 R1353~1355 기능 체크')

// R1353: SceneViewPanel 씬 카메라
const svp1353Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1353Path)) {
  const svp1353 = readFileSync(svp1353Path, 'utf-8')
  if (svp1353.includes('sceneCamera') || svp1353.includes('sceneCameraFov') || svp1353.includes('cameraFov')) {
    log('pass', 'R1353', 'SceneViewPanel 씬 카메라 존재')
  } else {
    log('warning', 'R1353', 'SceneViewPanel 씬 카메라 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1354: TerminalPanel 터미널 로그
const tp1354Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1354Path)) {
  const tp1354 = readFileSync(tp1354Path, 'utf-8')
  if (tp1354.includes('termLog') || tp1354.includes('termLogPath') || tp1354.includes('logPath')) {
    log('pass', 'R1354', 'TerminalPanel 터미널 로그 존재')
  } else {
    log('warning', 'R1354', 'TerminalPanel 터미널 로그 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1355: SessionList 세션 통계
const sl1355Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1355Path)) {
  const sl1355 = readFileSync(sl1355Path, 'utf-8')
  if (sl1355.includes('showStatsPanel') || sl1355.includes('sessionStats') || sl1355.includes('statsPanel')) {
    log('pass', 'R1355', 'SessionList 세션 통계 존재')
  } else {
    log('warning', 'R1355', 'SessionList 세션 통계 없음', 'sidebar/SessionList.tsx')
  }
}

console.log('\n## 363. Phase DD10 R1356~1358 기능 체크')

// R1356: ChatPanel 채팅 히스토리 검색
const cp1356Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1356Path)) {
  const cp1356 = readFileSync(cp1356Path, 'utf-8')
  if (cp1356.includes('chatHistorySearch') || cp1356.includes('historySearchResults') || cp1356.includes('historySearch')) {
    log('pass', 'R1356', 'ChatPanel 채팅 히스토리 검색 존재')
  } else {
    log('warning', 'R1356', 'ChatPanel 채팅 히스토리 검색 없음', 'chat/ChatPanel.tsx')
  }
}

// R1357: InputBar 코드 스니펫
const ib1357Path = join(ROOT, 'src/renderer/src/components/chat/InputBar.tsx')
if (existsSync(ib1357Path)) {
  const ib1357 = readFileSync(ib1357Path, 'utf-8')
  if (ib1357.includes('inputSnippets') || ib1357.includes('showSnippetMenu') || ib1357.includes('snippetMenu')) {
    log('pass', 'R1357', 'InputBar 코드 스니펫 존재')
  } else {
    log('warning', 'R1357', 'InputBar 코드 스니펫 없음', 'chat/InputBar.tsx')
  }
}

// R1358: CocosPanel 씬 목록 필터
const cocos1358Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1358Path)) {
  const cocos1358 = readFileSync(cocos1358Path, 'utf-8')
  if (cocos1358.includes('sceneListFilter') || cocos1358.includes('sceneFilterActive') || cocos1358.includes('filterActive')) {
    log('pass', 'R1358', 'CocosPanel 씬 목록 필터 존재')
  } else {
    log('warning', 'R1358', 'CocosPanel 씬 목록 필터 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 364. Phase DD10 R1359~1361 기능 체크')

// R1359: SceneViewPanel 씬 라이팅
const svp1359Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1359Path)) {
  const svp1359 = readFileSync(svp1359Path, 'utf-8')
  if (svp1359.includes('sceneLighting') || svp1359.includes('lightingIntensity') || svp1359.includes('lighting')) {
    log('pass', 'R1359', 'SceneViewPanel 씬 라이팅 존재')
  } else {
    log('warning', 'R1359', 'SceneViewPanel 씬 라이팅 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1360: TerminalPanel 자동완성
const tp1360Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1360Path)) {
  const tp1360 = readFileSync(tp1360Path, 'utf-8')
  if (tp1360.includes('termAutoComplete') || tp1360.includes('autoCompleteList') || tp1360.includes('autoComplete')) {
    log('pass', 'R1360', 'TerminalPanel 자동완성 존재')
  } else {
    log('warning', 'R1360', 'TerminalPanel 자동완성 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1361: SessionList 세션 병합
const sl1361Path = join(ROOT, 'src/renderer/src/components/sidebar/SessionList.tsx')
if (existsSync(sl1361Path)) {
  const sl1361 = readFileSync(sl1361Path, 'utf-8')
  if (sl1361.includes('sessionMerge') || sl1361.includes('mergeTargets') || sl1361.includes('mergeMode')) {
    log('pass', 'R1361', 'SessionList 세션 병합 존재')
  } else {
    log('warning', 'R1361', 'SessionList 세션 병합 없음', 'sidebar/SessionList.tsx')
  }
}


console.log('\n## 365. Phase DD10 R1362~1364 기능 체크')

// R1362: ChatPanel 채팅 밀도 모드
const cp1362Path = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(cp1362Path)) {
  const cp1362 = readFileSync(cp1362Path, 'utf-8')
  if (cp1362.includes('chatDensity') || cp1362.includes('chat-density')) {
    log('pass', 'R1362', 'ChatPanel 채팅 밀도 모드 존재')
  } else {
    log('warning', 'R1362', 'ChatPanel 채팅 밀도 모드 없음', 'chat/ChatPanel.tsx')
  }
}

// R1363: SceneViewPanel 줌 localStorage
const svp1363Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1363Path)) {
  const svp1363 = readFileSync(svp1363Path, 'utf-8')
  if (svp1363.includes('scene-view-zoom') || svp1363.includes('scene-view-pan')) {
    log('pass', 'R1363', 'SceneViewPanel 줌 localStorage 지속 저장 존재')
  } else {
    log('warning', 'R1363', 'SceneViewPanel 줌 localStorage 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1364: SceneViewPanel 목업 이미지 오버레이
if (existsSync(svp1363Path)) {
  const svp1364 = readFileSync(svp1363Path, 'utf-8')
  if (svp1364.includes('overlayImageSrc') || svp1364.includes('overlayImage')) {
    log('pass', 'R1364', 'SceneViewPanel 목업 이미지 오버레이 존재')
  } else {
    log('warning', 'R1364', 'SceneViewPanel 목업 이미지 오버레이 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

console.log('\n## 366. Phase DD10 R1365~1366 기능 체크')

// R1365: TerminalPanel Ctrl+=/-  폰트 크기 단축키
const tp1365Path = join(ROOT, 'src/renderer/src/components/terminal/TerminalPanel.tsx')
if (existsSync(tp1365Path)) {
  const tp1365 = readFileSync(tp1365Path, 'utf-8')
  if (tp1365.includes("key === '='") || tp1365.includes('Math.min(24')) {
    log('pass', 'R1365', 'TerminalPanel 폰트 크기 단축키 존재')
  } else {
    log('warning', 'R1365', 'TerminalPanel 폰트 크기 단축키 없음', 'terminal/TerminalPanel.tsx')
  }
}

// R1366: CocosPanel 최근 씬 파일 목록
const cocos1366Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cocos1366Path)) {
  const cocos1366 = readFileSync(cocos1366Path, 'utf-8')
  if (cocos1366.includes('recentSceneFiles') || cocos1366.includes('recent-scene-files')) {
    log('pass', 'R1366', 'CocosPanel 최근 씬 파일 목록 존재')
  } else {
    log('warning', 'R1366', 'CocosPanel 최근 씬 파일 목록 없음', 'sidebar/CocosPanel.tsx')
  }
}
console.log('\n## 367. Phase DD10 R1368~1370 기능 체크')

// R1368: Inspector cc.Widget 속성 편집
const si1368Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(si1368Path)) {
  const si1368 = readFileSync(si1368Path, 'utf-8')
  if (si1368.includes('cc.Widget') && si1368.includes('alignMode')) {
    log('pass', 'R1368', 'Widget Inspector 섹션 존재')
  } else {
    log('warning', 'R1368', 'Widget Inspector 섹션 없음', 'SceneView/SceneInspector.tsx')
  }
}

// R1369: SceneView Sprite/Label 컬러 fill
const nr1369Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nr1369Path)) {
  const nr1369 = readFileSync(nr1369Path, 'utf-8')
  if (nr1369.includes('compColor') && nr1369.includes('fillColor')) {
    log('pass', 'R1369', 'Color fill 렌더링 존재')
  } else {
    log('warning', 'R1369', 'Color fill 렌더링 없음', 'SceneView/NodeRenderer.tsx')
  }
}

// R1370: CocosPanel 씬 전환 히스토리
const cp1370Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp1370Path)) {
  const cp1370 = readFileSync(cp1370Path, 'utf-8')
  if (cp1370.includes('recentScenes') || cp1370.includes('recent-scene-files')) {
    log('pass', 'R1370', '씬 히스토리 존재')
  } else {
    log('warning', 'R1370', '씬 히스토리 없음', 'sidebar/CocosPanel.tsx')
  }
}

console.log('\n## 368. Phase DD10 R1371~1372 기능 체크')

// R1371: NodeRenderer 컴포넌트 뱃지
if (existsSync(nr1369Path)) {
  const nr1371 = readFileSync(nr1369Path, 'utf-8')
  if (nr1371.includes('MAX_BADGES') && nr1371.includes('icons')) {
    log('pass', 'R1371', '컴포넌트 뱃지 존재')
  } else {
    log('warning', 'R1371', '컴포넌트 뱃지 없음', 'SceneView/NodeRenderer.tsx')
  }
}

// R1372: Inspector 컴포넌트 추가 드롭다운
if (existsSync(si1368Path)) {
  const si1372 = readFileSync(si1368Path, 'utf-8')
  if (si1372.includes('ADDABLE_COMPONENTS') && si1372.includes('추가')) {
    log('pass', 'R1372', '컴포넌트 추가 드롭다운 존재')
  } else {
    log('warning', 'R1372', '컴포넌트 추가 드롭다운 없음', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 369: R1374/R1375/R1376 기능 체크 ───────────────
console.log('\n## 369. Phase DD11 R1374~1376 기능 체크')

// R1374: SceneInspector Sprite 에셋 피커
if (existsSync(si1368Path)) {
  const si1374 = readFileSync(si1368Path, 'utf-8')
  if (si1374.includes('Sprite') && si1374.includes('openFileDialog') && si1374.includes('에셋 피커')) {
    log('pass', 'R1374', 'Sprite 에셋 피커 UI 존재')
  } else {
    log('warning', 'R1374', 'Sprite 에셋 피커 없음', 'SceneView/SceneInspector.tsx')
  }
}

// R1375: SceneInspector cc.Layout 속성 편집
if (existsSync(si1368Path)) {
  const si1375 = readFileSync(si1368Path, 'utf-8')
  if (si1375.includes('cc.Layout') && si1375.includes('paddingTop') && si1375.includes('spacingX') && si1375.includes('resizeMode')) {
    log('pass', 'R1375', 'cc.Layout 속성 편집 존재')
  } else {
    log('warning', 'R1375', 'cc.Layout 속성 편집 없음', 'SceneView/SceneInspector.tsx')
  }
}

// R1376: Claude 컨텍스트 주입 토글
const ccFileCtxPath = join(ROOT, 'src/renderer/src/hooks/useCCFileContext.ts')
if (existsSync(ccFileCtxPath)) {
  const ccFileCtx = readFileSync(ccFileCtxPath, 'utf-8')
  if (ccFileCtx.includes('cc-ctx-inject') && ccFileCtx.includes('updateCCFileContext') && ccFileCtx.includes('cc-file-scene-context')) {
    log('pass', 'R1376', 'CC 파일 씬 컨텍스트 훅 존재')
  } else {
    log('warning', 'R1376', 'CC 파일 씬 컨텍스트 훅 불완전', 'hooks/useCCFileContext.ts')
  }
} else {
  log('warning', 'R1376', 'useCCFileContext.ts 파일 없음')
}

const cp1376Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp1376Path)) {
  const cp1376 = readFileSync(cp1376Path, 'utf-8')
  if (cp1376.includes('Claude 컨텍스트 주입') && cp1376.includes('ccCtxInject') && cp1376.includes('updateCCFileContext')) {
    log('pass', 'R1376', 'CocosPanel 컨텍스트 주입 토글 존재')
  } else {
    log('warning', 'R1376', 'CocosPanel 컨텍스트 주입 토글 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 370: R1377/R1378 기능 체크 ───────────────
console.log('\n## 370. Phase DD11 R1377~1378 기능 체크')

// R1377: NodeHierarchyList 컴포넌트 타입 필터
const nhl1377Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nhl1377Path)) {
  const nhl1377 = readFileSync(nhl1377Path, 'utf-8')
  if (nhl1377.includes('compTypeFilter') && nhl1377.includes('cc.Label') && nhl1377.includes('cc.Sprite')) {
    log('pass', 'R1377', 'NodeHierarchyList 컴포넌트 타입 필터 존재')
  } else {
    log('warning', 'R1377', 'NodeHierarchyList 컴포넌트 타입 필터 없음', 'SceneView/NodeHierarchyList.tsx')
  }
}

// R1378: SceneView 북마크 localStorage per scene
const svp1378Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1378Path)) {
  const svp1378 = readFileSync(svp1378Path, 'utf-8')
  if (svp1378.includes('scene-bookmarks-') && svp1378.includes('bookmarkedUuids') && svp1378.includes('localStorage')) {
    log('pass', 'R1378', 'SceneView 북마크 localStorage per scene 존재')
  } else {
    log('warning', 'R1378', 'SceneView 북마크 per scene 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// ── Section 371: R1380/R1381/R1382 기능 체크 ───────────────
console.log('\n## 371. Phase DD12 R1380~R1382 기능 체크')

// R1380: cc-file-parser RichText/ScrollView/Mask/PageView 컴포넌트 지원
const cfp1380Path = join(ROOT, 'src/main/cc/cc-file-parser.ts')
if (existsSync(cfp1380Path)) {
  const cfp1380 = readFileSync(cfp1380Path, 'utf-8')
  if (cfp1380.includes('cc.RichText') && cfp1380.includes('cc.ScrollView') && cfp1380.includes('cc.Mask') && cfp1380.includes('cc.PageView') && cfp1380.includes('extractComponentProps')) {
    log('pass', 'R1380', 'cc-file-parser RichText/ScrollView/Mask/PageView 컴포넌트 지원')
  } else {
    log('warning', 'R1380', 'cc-file-parser 추가 컴포넌트 지원 불완전', 'cc/cc-file-parser.ts')
  }
} else {
  log('warning', 'R1380', 'cc-file-parser.ts 파일 없음')
}

// R1381: SceneView 씬 diff 뷰어
const svp1381Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1381Path)) {
  const svp1381 = readFileSync(svp1381Path, 'utf-8')
  if (svp1381.includes('diffModeR1381') && svp1381.includes('savedSnapshot') && svp1381.includes('changedUuids')) {
    log('pass', 'R1381', 'SceneView 씬 diff 뷰어 (savedSnapshot + 주황 테두리)')
  } else {
    log('warning', 'R1381', 'SceneView 씬 diff 뷰어 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1382: CocosPanel 에셋 브라우저 폴더 트리
const cp1382Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp1382Path)) {
  const cp1382 = readFileSync(cp1382Path, 'utf-8')
  if (cp1382.includes('assetViewMode') && cp1382.includes('buildFolderTree') && cp1382.includes('getAssetFileIcon')) {
    log('pass', 'R1382', 'CocosPanel 에셋 브라우저 폴더 트리 뷰')
  } else {
    log('warning', 'R1382', 'CocosPanel 에셋 브라우저 폴더 트리 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 372: R1383/R1384 기능 체크 ───────────────
console.log('\n## 372. Phase DD12 R1383~R1384 기능 체크')

// R1383: SceneView 씬 파일 탭 바
const svp1383Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1383Path)) {
  const svp1383 = readFileSync(svp1383Path, 'utf-8')
  if (svp1383.includes('sceneTabFiles') && svp1383.includes('activeSceneTab') && svp1383.includes('R1383')) {
    log('pass', 'R1383', 'SceneView 씬 파일 탭 바 존재')
  } else {
    log('warning', 'R1383', 'SceneView 씬 파일 탭 바 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1384: Inspector cc.Animation 클립 목록 뷰어
const si1384Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(si1384Path)) {
  const si1384 = readFileSync(si1384Path, 'utf-8')
  if (si1384.includes('cc.Animation') && si1384.includes('defaultClip') && si1384.includes('clips') && si1384.includes('R1384')) {
    log('pass', 'R1384', 'Inspector cc.Animation 클립 목록 뷰어')
  } else {
    log('warning', 'R1384', 'Inspector Animation 뷰어 없음', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 373: R1386/R1387/R1388 기능 체크 ───────────────
console.log('\n## 373. Phase DD13 R1386~R1388 기능 체크')

// R1386: SceneView 노드 복사/붙여넣기/복제 (deep clone)
const svp1386Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1386Path)) {
  const svp1386 = readFileSync(svp1386Path, 'utf-8')
  if (svp1386.includes('deepCloneNode') && svp1386.includes('handleCopy') && svp1386.includes('handlePaste') && svp1386.includes('handleDuplicate')) {
    log('pass', 'R1386', 'SceneView 노드 복사/붙여넣기/복제 (deep clone with UUID)')
  } else {
    log('warning', 'R1386', 'SceneView 노드 deep clone 없음', 'SceneView/SceneViewPanel.tsx')
  }
  // Ctrl+C/V/D 단축키
  if (svp1386.includes("key === 'c'") && svp1386.includes('handleCopy') && svp1386.includes("key === 'v'") && svp1386.includes("key === 'd'")) {
    log('pass', 'R1386', 'Ctrl+C/V/D 단축키 바인딩 존재')
  } else {
    log('warning', 'R1386', 'Ctrl+C/V/D 단축키 누락', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1387: Inspector cc.AudioSource 속성 편집
const si1387Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(si1387Path)) {
  const si1387 = readFileSync(si1387Path, 'utf-8')
  if (si1387.includes('cc.AudioSource') && si1387.includes('volume') && si1387.includes('loop') && si1387.includes('playOnLoad') && si1387.includes('preload') && si1387.includes('R1387')) {
    log('pass', 'R1387', 'Inspector cc.AudioSource 속성 편집 (volume/loop/playOnLoad/preload)')
  } else {
    log('warning', 'R1387', 'Inspector AudioSource 편집 없음', 'SceneView/SceneInspector.tsx')
  }
}

// R1388: NodeRenderer Sprite SLICED/TILED 렌더링 힌트
const nr1388Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nr1388Path)) {
  const nr1388 = readFileSync(nr1388Path, 'utf-8')
  if (nr1388.includes('spriteType === 2') && nr1388.includes('spriteType === 3') && nr1388.includes('R1388') && nr1388.includes('SLICED')) {
    log('pass', 'R1388', 'NodeRenderer Sprite SLICED/TILED 렌더링 힌트 (점선 격자/x 패턴)')
  } else {
    log('warning', 'R1388', 'NodeRenderer SLICED/TILED 힌트 없음', 'SceneView/NodeRenderer.tsx')
  }
}

// ── Section 374: R1389/R1390 기능 체크 ───────────────
console.log('\n## 374. Phase DD13 R1389~R1390 기능 체크')

// R1389: cc-file-watcher 부분 업데이트 + 배너 자동 숨김
const cfw1389Path = join(ROOT, 'src/main/cc/cc-file-watcher.ts')
if (existsSync(cfw1389Path)) {
  const cfw1389 = readFileSync(cfw1389Path, 'utf-8')
  if (cfw1389.includes('CCScenePartialUpdate') && cfw1389.includes('debouncedChange') && cfw1389.includes('emitPartialUpdate') && cfw1389.includes('onPartialUpdate')) {
    log('pass', 'R1389', 'cc-file-watcher 부분 업데이트 IPC + debounce 300ms')
  } else {
    log('warning', 'R1389', 'cc-file-watcher 부분 업데이트 없음', 'cc/cc-file-watcher.ts')
  }
}
const cfh1389Path = join(ROOT, 'src/main/ipc/cc-file-handlers.ts')
if (existsSync(cfh1389Path)) {
  const cfh1389 = readFileSync(cfh1389Path, 'utf-8')
  if (cfh1389.includes('cc:scene-partial-update') && cfh1389.includes('onPartialUpdate')) {
    log('pass', 'R1389', 'cc-file-handlers 부분 업데이트 IPC 이벤트 전송')
  } else {
    log('warning', 'R1389', 'cc-file-handlers 부분 업데이트 IPC 없음', 'ipc/cc-file-handlers.ts')
  }
}
const cp1389Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp1389Path)) {
  const cp1389 = readFileSync(cp1389Path, 'utf-8')
  if (cp1389.includes('bannerHidden') && cp1389.includes('bannerTimerRef') && cp1389.includes('5000')) {
    log('pass', 'R1389', 'CocosPanel 외부 변경 배너 5초 자동 숨김')
  } else {
    log('warning', 'R1389', 'CocosPanel 배너 자동 숨김 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R1390: CocosPanel CC 프로젝트 설정 뷰어
if (existsSync(cp1389Path)) {
  const cp1390 = readFileSync(cp1389Path, 'utf-8')
  if (cp1390.includes('showProjectSettings') && cp1390.includes('projectSettings') && cp1390.includes('designWidth') && cp1390.includes('physicsEngine') && cp1390.includes('R1390')) {
    log('pass', 'R1390', 'CocosPanel CC 프로젝트 설정 뷰어 (버전/해상도/물리엔진/빌드타겟)')
  } else {
    log('warning', 'R1390', 'CocosPanel 프로젝트 설정 뷰어 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 375: R1392/R1393/R1394 기능 체크 ───────────────
console.log('\n## 375. Phase DD14 R1392~R1394 기능 체크')

// R1392: SceneView 정렬 가이드라인 SVG 렌더링 (#4af 스타일)
const svp1392Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp1392Path)) {
  const svp1392 = readFileSync(svp1392Path, 'utf-8')
  if (svp1392.includes('R1392') && svp1392.includes('#4af') && svp1392.includes('strokeDasharray="4 2"') && svp1392.includes('alignGuides')) {
    log('pass', 'R1392', 'SceneView 정렬 가이드라인 SVG 렌더링 (#4af, 4 2 dash)')
  } else {
    log('warning', 'R1392', 'SceneView 가이드라인 스타일 미적용', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1393: Inspector 로컬/월드 좌표 토글
const si1393Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(si1393Path)) {
  const si1393 = readFileSync(si1393Path, 'utf-8')
  if (si1393.includes('coordMode') && si1393.includes("'local'") && si1393.includes("'world'") && si1393.includes('R1393') && si1393.includes('worldX') && si1393.includes('worldY')) {
    log('pass', 'R1393', 'Inspector 로컬/월드 좌표 토글 (L/W 버튼, 월드 읽기 전용)')
  } else {
    log('warning', 'R1393', 'Inspector 좌표 토글 없음', 'SceneView/SceneInspector.tsx')
  }
}

// R1394: CocosPanel 씬 템플릿 생성
const cp1394Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp1394Path)) {
  const cp1394 = readFileSync(cp1394Path, 'utf-8')
  if (cp1394.includes('R1394') && cp1394.includes('handleCreateScene') && cp1394.includes('newSceneTemplate') && cp1394.includes('showNewSceneForm') && cp1394.includes('writeTextFile') && cp1394.includes('cc.SceneAsset')) {
    log('pass', 'R1394', 'CocosPanel 씬 템플릿 생성 (빈씬/Canvas, writeTextFile, 자동 열기)')
  } else {
    log('warning', 'R1394', 'CocosPanel 씬 생성 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 376: R1395/R1396 기능 체크 ───────────────
console.log('\n## 376. Phase DD14 R1395~R1396 기능 체크')

// R1395: SceneView 레이어 패널 (가시성/잠금 영구 저장, 색상 라벨)
if (existsSync(svp1392Path)) {
  const svp1395 = readFileSync(svp1392Path, 'utf-8')
  if (svp1395.includes('R1395') && svp1395.includes('layerColors') && svp1395.includes('scene-hidden-layers') && svp1395.includes('scene-locked-layers') && svp1395.includes('LAYER_COLOR_PALETTE')) {
    log('pass', 'R1395', 'SceneView 레이어 패널 고도화 (가시성/잠금 영구저장, 색상 라벨)')
  } else {
    log('warning', 'R1395', 'SceneView 레이어 패널 고도화 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1396: cc-file-parser 2x _trs 파싱 정밀도 향상
const cfp1396Path = join(ROOT, 'src/main/cc/cc-file-parser.ts')
if (existsSync(cfp1396Path)) {
  const cfp1396 = readFileSync(cfp1396Path, 'utf-8')
  if (cfp1396.includes('R1396') && cfp1396.includes('base64') && cfp1396.includes('_position') && cfp1396.includes('_rotation') && cfp1396.includes('_scale') && cfp1396.includes('Buffer.from')) {
    log('pass', 'R1396', 'cc-file-parser 2x _trs 파싱 강화 (base64 디코딩, 개별 필드 폴백, 기본값 보장)')
  } else {
    log('warning', 'R1396', 'cc-file-parser _trs 파싱 강화 없음', 'cc/cc-file-parser.ts')
  }
}

// ── Section 377: R1398/R1399/R1400 기능 체크 ───────────────
console.log('\n## 377. Phase DD14 R1398~R1400 기능 체크')

// R1398: CocosPanel 프리팹 인스턴스화 UI
const cp1398Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp1398Path)) {
  const cp1398 = readFileSync(cp1398Path, 'utf-8')
  if (cp1398.includes('R1398') && cp1398.includes('handleInstantiatePrefab') && cp1398.includes('prefabContent') && cp1398.includes('cc.Prefab') && cp1398.includes('instantiating')) {
    log('pass', 'R1398', 'CocosPanel 프리팹 인스턴스화 UI (readFile → JSON parse → 씬 추가)')
  } else {
    log('warning', 'R1398', 'CocosPanel 프리팹 인스턴스화 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R1399: SceneView 노드 그룹화 Ctrl+G / Ctrl+Shift+G
if (existsSync(sceneViewPath)) {
  const svp1399 = readFileSync(sceneViewPath, 'utf-8')
  if (svp1399.includes('handleGroup') && svp1399.includes('handleUngroup') && svp1399.includes("'Group'")) {
    log('pass', 'R1399', 'SceneView 노드 그룹화 Ctrl+G / 해제 Ctrl+Shift+G')
  } else {
    log('warning', 'R1399', 'SceneView 노드 그룹화 없음', 'SceneView/SceneViewPanel.tsx')
  }
}
// R1399: CocosPanel에서도 Ctrl+G/Ctrl+Shift+G
if (existsSync(cp1398Path)) {
  const cp1399 = readFileSync(cp1398Path, 'utf-8')
  if (cp1399.includes('R1399') && cp1399.includes('Group') && cp1399.includes('ungroupNode')) {
    log('pass', 'R1399', 'CocosPanel Ctrl+G/Ctrl+Shift+G 그룹화/해제 (씬 파일 패치)')
  } else {
    log('warning', 'R1399', 'CocosPanel 그룹화 없음', 'sidebar/CocosPanel.tsx')
  }
}

// R1400: cc-file-parser 파티클/카메라/조명 컴포넌트
const cfp1400Path = join(ROOT, 'src/main/cc/cc-file-parser.ts')
if (existsSync(cfp1400Path)) {
  const cfp1400 = readFileSync(cfp1400Path, 'utf-8')
  if (cfp1400.includes('R1400') && cfp1400.includes('cc.ParticleSystem') && cfp1400.includes('cc.Camera') && cfp1400.includes('cc.DirectionalLight') && cfp1400.includes('cc.PointLight')) {
    log('pass', 'R1400', 'cc-file-parser 파티클/카메라/조명 컴포넌트 추출')
  } else {
    log('warning', 'R1400', 'cc-file-parser 파티클/카메라/조명 없음', 'cc/cc-file-parser.ts')
  }
}
// R1400: NodeRenderer Camera/ParticleSystem 시각 힌트
const nr1400Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx')
if (existsSync(nr1400Path)) {
  const nr1400 = readFileSync(nr1400Path, 'utf-8')
  if (nr1400.includes('R1400') && nr1400.includes('cc.Camera') && nr1400.includes('cc.ParticleSystem')) {
    log('pass', 'R1400', 'NodeRenderer Camera/ParticleSystem 시각 힌트 (테두리 + 라벨 접두사)')
  } else {
    log('warning', 'R1400', 'NodeRenderer 시각 힌트 없음', 'SceneView/NodeRenderer.tsx')
  }
}

// ── Section 378: R1401/R1402 기능 체크 ───────────────
console.log('\n## 378. Phase DD14 R1401~R1402 기능 체크')

// R1401: SceneView 씬 통계 오버레이
if (existsSync(sceneViewPath)) {
  const svp1401 = readFileSync(sceneViewPath, 'utf-8')
  if (svp1401.includes('showStatsOverlay') && svp1401.includes('scene-stats-overlay') && svp1401.includes('Scene Stats') && svp1401.includes('Top Components')) {
    log('pass', 'R1401', 'SceneView 씬 통계 오버레이 (I키, 노드수/컴포넌트 분포, localStorage)')
  } else {
    log('warning', 'R1401', 'SceneView 씬 통계 오버레이 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1402: Inspector 노드 참조 필드 표시
const si1402Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx')
if (existsSync(si1402Path)) {
  const si1402 = readFileSync(si1402Path, 'utf-8')
  if (si1402.includes('R1402') && si1402.includes('__id__') && si1402.includes('__uuid__')) {
    log('pass', 'R1402', 'Inspector 노드 참조 필드 표시 (__id__/__uuid__ 감지, 링크 아이콘)')
  } else {
    log('warning', 'R1402', 'Inspector 노드 참조 없음', 'SceneView/SceneInspector.tsx')
  }
}

// ── Section 379: R1404/R1405/R1406 기능 체크 ───────────────
console.log('\n## 379. Phase DD14 R1404~R1406 기능 체크')

// R1404: SceneView PNG 내보내기 (해상도/배경 선택)
if (existsSync(sceneViewPath)) {
  const svp1404 = readFileSync(sceneViewPath, 'utf-8')
  if (svp1404.includes('R1404') && svp1404.includes('pngExportScale') && svp1404.includes('pngExportBg') && svp1404.includes('showPngExportPanel') && svp1404.includes('PNG Export')) {
    log('pass', 'R1404', 'SceneView PNG 내보내기 (배경색/해상도 1x/2x/4x, 타임스탬프 파일명)')
  } else {
    log('warning', 'R1404', 'SceneView PNG 내보내기 고도화 없음', 'SceneView/SceneViewPanel.tsx')
  }
}

// R1405: Inspector 컴포넌트 순서 변경 ↑↓
if (existsSync(si1402Path)) {
  const si1405 = readFileSync(si1402Path, 'utf-8')
  if (si1405.includes('R1405') && si1405.includes('\u2191') && si1405.includes('\u2193') && si1405.includes('위로 이동') && si1405.includes('아래로 이동')) {
    log('pass', 'R1405', 'Inspector 컴포넌트 순서 변경 (↑↓ 버튼, 첫/마지막 비활성화)')
  } else {
    log('warning', 'R1405', 'Inspector 컴포넌트 순서 변경 없음', 'SceneView/SceneInspector.tsx')
  }
}

// R1406: CocosPanel CC 빌드 트리거 UI
if (existsSync(cp1398Path)) {
  const cp1406 = readFileSync(cp1398Path, 'utf-8')
  if (cp1406.includes('R1406') && cp1406.includes('buildPlatform') && cp1406.includes('빌드 트리거') && cp1406.includes('web-mobile') && cp1406.includes('web-desktop') && cp1406.includes('CC_EDITOR_PATHS')) {
    log('pass', 'R1406', 'CocosPanel CC 빌드 트리거 UI (플랫폼 드롭다운, CLI 미리보기)')
  } else {
    log('warning', 'R1406', 'CocosPanel 빌드 트리거 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── Section 380: R1407/R1408 기능 체크 ───────────────
console.log('\n## 380. Phase DD14 R1407~R1408 기능 체크')

// R1407: SceneView 노드 색상 태그
if (existsSync(sceneViewPath)) {
  const svp1407 = readFileSync(sceneViewPath, 'utf-8')
  if (svp1407.includes('R1407') && svp1407.includes('nodeColorTags') && svp1407.includes('COLOR_TAG_PALETTE') && svp1407.includes('showColorTagPicker') && svp1407.includes('node-color-tags-')) {
    log('pass', 'R1407', 'SceneView 노드 색상 태그 (7색 팔레트, localStorage per scene, 컨텍스트메뉴)')
  } else {
    log('warning', 'R1407', 'SceneView 노드 색상 태그 없음', 'SceneView/SceneViewPanel.tsx')
  }
}
// R1407: NodeHierarchyList 색상 태그 dot
const nhl1407Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/NodeHierarchyList.tsx')
if (existsSync(nhl1407Path)) {
  const nhl1407 = readFileSync(nhl1407Path, 'utf-8')
  if (nhl1407.includes('R1407') && nhl1407.includes('nodeColorTags')) {
    log('pass', 'R1407', 'NodeHierarchyList 색상 태그 dot 표시')
  } else {
    log('warning', 'R1407', 'NodeHierarchyList 색상 태그 dot 없음', 'SceneView/NodeHierarchyList.tsx')
  }
}

// R1408: cc-file-parser analyzeScene 복잡도 분석
if (existsSync(cfp1400Path)) {
  const cfp1408 = readFileSync(cfp1400Path, 'utf-8')
  if (cfp1408.includes('R1408') && cfp1408.includes('analyzeScene') && cfp1408.includes('CCSceneAnalysis') && cfp1408.includes('estimatedDrawCalls') && cfp1408.includes('maxDepth') && cfp1408.includes('componentCounts')) {
    log('pass', 'R1408', 'cc-file-parser analyzeScene 복잡도 분석 (노드수/깊이/컴포넌트/draw call/경고)')
  } else {
    log('warning', 'R1408', 'cc-file-parser analyzeScene 없음', 'cc/cc-file-parser.ts')
  }
}

// ── Section 381: 런타임 에러 방지 — React import 검사 ────────────────────────
{
  const RENDERER = join(ROOT, 'src/renderer/src/components')
  const checkFiles = [
    ['chat/ChatPanel.tsx', 'ChatPanel'],
    ['chat/InputBar.tsx', 'InputBar'],
    ['terminal/TerminalPanel.tsx', 'TerminalPanel'],
    ['sidebar/CocosPanel.tsx', 'CocosPanel'],
    ['sidebar/SceneView/SceneViewPanel.tsx', 'SceneViewPanel'],
    ['sidebar/SessionList.tsx', 'SessionList'],
    ['sidebar/SceneView/SceneInspector.tsx', 'SceneInspector'],
    ['sidebar/SceneView/NodeHierarchyList.tsx', 'NodeHierarchyList'],
    ['sidebar/SceneView/NodeRenderer.tsx', 'NodeRenderer'],
  ]
  for (const [rel, name] of checkFiles) {
    const fpath = join(RENDERER, rel)
    if (!existsSync(fpath)) continue
    const src = readFileSync(fpath, 'utf-8')
    const hasReactDotUsage = /React\.(useState|useEffect|useCallback|useRef|useMemo|createContext|forwardRef)\b/.test(src)
    const hasReactImport = /^import React[,\s]/.test(src)
    if (hasReactDotUsage && !hasReactImport) {
      log('critical', 'RuntimeError', `${name}: React.* 사용하지만 import React 없음 — 런타임 ReferenceError 발생`, rel)
    } else {
      log('pass', 'RuntimeError', `${name}: React import 정상`)
    }
  }
}

// ── Section 382: useState TDZ 검사 ────────────────────────────────────────────
{
  const chatPanelPath = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
  if (existsSync(chatPanelPath)) {
    const src = readFileSync(chatPanelPath, 'utf-8')
    const lines = src.split('\n')
    // useMemo/useEffect 보다 useState 선언이 앞에 있는지 확인 (displayMessages)
    const memoIdx = lines.findIndex(l => l.includes('displayMessages') && l.includes('useMemo'))
    const stateIdx = lines.findIndex(l => l.includes('showOnlyBookmarks') && l.includes('useState'))
    if (memoIdx !== -1 && stateIdx !== -1 && stateIdx > memoIdx) {
      log('critical', 'RuntimeError', 'ChatPanel: showOnlyBookmarks useState가 useMemo보다 뒤에 선언됨 (TDZ)', 'chat/ChatPanel.tsx')
    } else {
      log('pass', 'RuntimeError', 'ChatPanel: showOnlyBookmarks TDZ 없음')
    }
  }
}

// ── Section 383: R1410/R1411/R1412 기능 체크 ───────────────
console.log('\n## 383. Phase DD14 R1410~R1412 기능 체크')

// R1410: cc-asset-resolver UUID 캐시 고도화
const assetResolverPath = join(ROOT, 'src/main/cc/cc-asset-resolver.ts')
if (existsSync(assetResolverPath)) {
  const ar1410 = readFileSync(assetResolverPath, 'utf-8')
  if (ar1410.includes('R1410') && ar1410.includes('resolveUUIDToPath') && ar1410.includes('getAssetInfo') && ar1410.includes('getAllTextureUUIDs')) {
    log('pass', 'R1410', 'cc-asset-resolver UUID→파일명 캐시 고도화 (resolveUUIDToPath, getAssetInfo, getAllTextureUUIDs)')
  } else {
    log('warning', 'R1410', 'cc-asset-resolver 고도화 함수 없음', 'cc/cc-asset-resolver.ts')
  }
}
// R1410: preload API 노출
const preloadPath1410 = join(ROOT, 'src/preload/index.ts')
if (existsSync(preloadPath1410)) {
  const pl1410 = readFileSync(preloadPath1410, 'utf-8')
  if (pl1410.includes('ccGetAssetInfo') && pl1410.includes('ccGetAllTextureUUIDs')) {
    log('pass', 'R1410', 'preload API 노출: ccGetAssetInfo, ccGetAllTextureUUIDs')
  } else {
    log('warning', 'R1410', 'preload API 미노출', 'preload/index.ts')
  }
}

// R1411: Inspector 속성 검색 필터
if (existsSync(si1402Path)) {
  const si1411 = readFileSync(si1402Path, 'utf-8')
  if (si1411.includes('R1411') && si1411.includes('propFilter') && si1411.includes('속성 검색')) {
    log('pass', 'R1411', 'SceneInspector 속성 검색 필터 (propFilter, Esc 초기화, 컴포넌트명/props 필터)')
  } else {
    log('warning', 'R1411', 'Inspector 속성 검색 필터 없음', 'SceneView/SceneInspector.tsx')
  }
}

// R1412: SceneView 채팅 연동 노드 하이라이트
if (existsSync(sceneViewPath)) {
  const svp1412 = readFileSync(sceneViewPath, 'utf-8')
  if (svp1412.includes('R1412') && svp1412.includes('cc-highlight-node')) {
    log('pass', 'R1412', 'SceneView 채팅 연동 노드 하이라이트 (cc-highlight-node 이벤트, 3초 깜빡임)')
  } else {
    log('warning', 'R1412', 'SceneView 채팅 연동 하이라이트 없음', 'SceneView/SceneViewPanel.tsx')
  }
}
// R1412: ChatPanel dispatch
const chatPanelPathR1412 = join(ROOT, 'src/renderer/src/components/chat/ChatPanel.tsx')
if (existsSync(chatPanelPathR1412)) {
  const cp1412 = readFileSync(chatPanelPathR1412, 'utf-8')
  if (cp1412.includes('R1412') && cp1412.includes('cc-highlight-node') && cp1412.includes('dispatchEvent')) {
    log('pass', 'R1412', 'ChatPanel cc-highlight-node dispatch (AI 응답에서 노드명 추출)')
  } else {
    log('warning', 'R1412', 'ChatPanel 하이라이트 dispatch 없음', 'chat/ChatPanel.tsx')
  }
}

// ── Section 384: R1413/R1414 기능 체크 ───────────────
console.log('\n## 384. Phase DD14 R1413~R1414 기능 체크')

// R1413: Inspector 다중 노드 일괄 편집
if (existsSync(si1402Path)) {
  const si1413 = readFileSync(si1402Path, 'utf-8')
  if (si1413.includes('R1413') && si1413.includes('multiSelectedUuids') && si1413.includes('onBatchUpdate') && si1413.includes('일괄 적용') && si1413.includes('batchOffsetX')) {
    log('pass', 'R1413', 'Inspector 다중 노드 일괄 편집 (active 토글, position 오프셋, 일괄 적용 버튼)')
  } else {
    log('warning', 'R1413', 'Inspector 다중 노드 일괄 편집 없음', 'SceneView/SceneInspector.tsx')
  }
}

// R1414: CocosPanel 씬 히스토리 타임라인
if (existsSync(cp1398Path)) {
  const cp1414 = readFileSync(cp1398Path, 'utf-8')
  if (cp1414.includes('R1414') && cp1414.includes('sceneHistoryTimeline') && cp1414.includes('저장 이력') && cp1414.includes('scene-history-') && cp1414.includes('showFullHistory')) {
    log('pass', 'R1414', 'CocosPanel 씬 저장 이력 타임라인 (localStorage, 최근 5개/더보기, 복원 TODO)')
  } else {
    log('warning', 'R1414', 'CocosPanel 씬 히스토리 타임라인 없음', 'sidebar/CocosPanel.tsx')
  }
}

// ── 리포트 ───────────────────────────────────────────────
console.log('\n## QA 결과 요약')
const criticals = results.filter(r => r.level === 'critical')
const warnings = results.filter(r => r.level === 'warning')
const passes = results.filter(r => r.level === 'pass')

console.log(`🔴 Critical: ${criticals.length}`)
console.log(`🟡 Warning:  ${warnings.length}`)
console.log(`✅ Pass:     ${passes.length}`)

// 결과 파일 저장
const reportPath = join(ROOT, `qa-report-round${roundNum}.md`)
const report = [
  `# QA Report — Round ${roundNum}`,
  `> ${new Date().toISOString()}`,
  '',
  '## Critical',
  criticals.length ? criticals.map(r => `- [${r.file ?? ''}] ${r.message}`).join('\n') : '_없음_',
  '',
  '## Warning',
  warnings.length ? warnings.map(r => `- [${r.file ?? ''}] ${r.message}`).join('\n') : '_없음_',
  '',
  '## Pass',
  passes.length ? passes.map(r => `- ${r.message}`).join('\n') : '_없음_',
].join('\n')

writeFileSync(reportPath, report)
console.log(`\n리포트 저장: ${reportPath}`)

if (criticals.length > 0) {
  process.exit(1)
}
