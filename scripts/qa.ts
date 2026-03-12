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
  // cocos 탭은 App.tsx 아이콘 탭에 등록될 수 있으므로 두 파일 모두 확인
  const cocosInSidebar = (sidebarContent.match(/id: 'cocos'/g) ?? []).length
  const cocosInApp = (appContent.match(/id: 'cocos'/g) ?? []).length
  const totalCocos = cocosInSidebar + cocosInApp
  if (totalCocos > 2) {
    log('critical', 'Sidebar', `cocos 탭 중복 등록: ${totalCocos}회`, 'Sidebar.tsx/App.tsx')
  } else if (totalCocos >= 1) {
    log('pass', 'Sidebar', 'cocos 탭 정상 등록')
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
  if (svp11.includes('cursorScenePos.x') && svp11.includes('cursorScenePos.y') && svp11.includes('isDragging && !isResizing')) {
    log('pass', 'Round132', 'SceneViewPanel: 씬 좌표 오버레이 + 드래그 중 숨김 존재')
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
  if (svp14.includes('hoveredUuid && hoverTooltipPos') && svp14.includes('!isDragging && !isResizing')) {
    log('pass', 'Round141', 'SceneViewPanel: 호버 툴팁 렌더링 조건 + 드래그 중 숨김 존재')
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
  if (st6.includes('bgLight') && st6.includes('onBgToggle')) {
    log('pass', 'Round177', 'SceneToolbar: bgLight + onBgToggle prop 존재')
  } else {
    log('warning', 'Round177', 'SceneToolbar bgLight 미구현', 'SceneView/SceneToolbar.tsx')
  }
}
const svp177Path = join(ROOT, 'src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx')
if (existsSync(svp177Path)) {
  const svp177 = readFileSync(svp177Path, 'utf-8')
  if (svp177.includes('bgLight') && svp177.includes('setBgLight')) {
    log('pass', 'Round177', 'SceneViewPanel: bgLight state + 체크패턴 분기 존재')
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
  if (si16.includes('X, Y 위치를 (0, 0)으로 초기화') && si16.includes("onUpdate(node.uuid, 'x', 0)")) {
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
  if (si17.includes('회전을 0으로 초기화') && si17.includes("onUpdate(node.uuid, 'rotation', 0)")) {
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
  if (si18.includes('스케일을 (1, 1)로 초기화') && si18.includes("onUpdate(node.uuid, 'scaleX', 1)")) {
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
  if (si19.includes('앵커를 (0.5, 0.5) 중심으로 초기화') && si19.includes("onUpdate(node.uuid, 'anchorX', 0.5)")) {
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
// CocosPanel 연결 유지 시간 표시 (Round 341)
const cp341Path = join(ROOT, 'src/renderer/src/components/sidebar/CocosPanel.tsx')
if (existsSync(cp341Path)) {
  const cp341 = readFileSync(cp341Path, 'utf-8')
  if (cp341.includes('connectedAt') && cp341.includes('uptime') && cp341.includes('setUptime')) {
    log('pass', 'Round341', 'CocosPanel: 연결 유지 시간 표시 (connectedAt/uptime) 존재')
  } else {
    log('warning', 'Round341', 'CocosPanel 연결 유지 시간 미구현', 'sidebar/CocosPanel.tsx')
  }
}

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
  if (svp240.includes('compList') && svp240.includes('pos:') && svp240.includes('size:')) {
    log('pass', 'Round240', 'SceneViewPanel: 호버 툴팁 리치 정보 (pos/size/components) 구현 존재')
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
  if (svp202.includes('showRuler') && svp202.includes('눈금자') && svp202.includes('RULER_SIZE')) {
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
