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
