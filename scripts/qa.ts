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
  if (si6.includes('부모 노드 선택')) {
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
