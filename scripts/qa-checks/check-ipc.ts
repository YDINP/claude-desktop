/**
 * IPC channel mapping & runtime safety checks
 * Extracted from qa.ts sections 3-5 (CC bridge, Sidebar, IPC handlers) + section 103 (runtime)
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { LogFn } from './check-rounds'

export function runIpcChecks(root: string, log: LogFn): void {
  // ── 3. CC 통합 파일 검사 ──────────────────────────────────
  console.log('\n## 3. CC 통합 파일 검사')
  const ccBridgePath = join(root, 'src/main/cc/cc-bridge.ts')
  if (existsSync(ccBridgePath)) {
    const content = readFileSync(ccBridgePath, 'utf-8')
    if (!content.includes('scheduleReconnect') || !content.includes('reconnectTimer')) {
      log('warning', 'CC-Bridge', '자동 재연결 로직 확인 필요', 'src/main/cc/cc-bridge.ts')
    } else {
      log('pass', 'CC-Bridge', '자동 재연결 로직 존재')
    }
    const disconnectBlock = content.match(/disconnect\s*\(\)[^}]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s)?.[1] ?? ''
    if (!disconnectBlock.includes('reconnectTimer') || !disconnectBlock.includes('clearTimeout')) {
      log('warning', 'CC-Bridge', 'disconnect 메서드 reconnect 취소 확인 필요', 'src/main/cc/cc-bridge.ts')
    }
  } else {
    log('warning', 'CC-Bridge', 'cc-bridge.ts 파일 없음')
  }

  // ── 4. Sidebar 탭 중복 검사 ──────────────────────────────
  console.log('\n## 4. Sidebar 탭 중복 검사')
  const sidebarPath = join(root, 'src/renderer/src/components/sidebar/Sidebar.tsx')
  const appPath = join(root, 'src/renderer/src/App.tsx')
  if (existsSync(sidebarPath)) {
    const appContent = existsSync(appPath) ? readFileSync(appPath, 'utf-8') : ''
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
    const fp = join(root, rf)
    if (!existsSync(fp)) continue
    const content = readFileSync(fp, 'utf-8')
    const callMatches = content.match(/^\s*registerCCHandlers\s*\(/gm) ?? []
    const ccHandlerCalls = callMatches.length
    if (ccHandlerCalls > 1) {
      log('critical', 'IPC', `registerCCHandlers 중복 호출: ${ccHandlerCalls}회`, rf)
    } else if (ccHandlerCalls === 1) {
      log('pass', 'IPC', 'registerCCHandlers 정상 등록', rf)
    } else {
      if (rf === 'src/main/ipc/router.ts') {
        log('warning', 'IPC', `registerCCHandlers 미등록`, rf)
      }
    }
  }

  // ── 런타임 안전성 검사 ──────────────────────────────────
  console.log('\n## 런타임 안전성 검사')
  const mainIndexPath = join(root, 'src/main/index.ts')
  const fsHandlersPath = join(root, 'src/main/ipc/fs-handlers.ts')

  // AppContent conditional Hook (H1 fix)
  const appTsxPath = join(root, 'src/renderer/src/App.tsx')
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

  // cc:open-window singleton (H4 fix)
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

  // grepSearch execFile (H5 fix)
  if (existsSync(fsHandlersPath)) {
    const fsHandlersSrc = readFileSync(fsHandlersPath, 'utf-8')
    const grepIdx = fsHandlersSrc.indexOf('grepSearch')
    const grepSection = grepIdx >= 0 ? fsHandlersSrc.slice(grepIdx) : ''
    if (grepSection.includes('execFileAsync') || grepSection.includes('execFile')) {
      log('pass', 'Runtime', 'grepSearch execFile 배열 방식 사용 (shell injection 방어)')
    } else {
      log('warning', 'Runtime', 'grepSearch 여전히 exec 사용 중 — shell injection 위험', 'src/main/ipc/fs-handlers.ts')
    }

    // fs:delete path guard (L3 fix)
    const deleteIdx = fsHandlersSrc.indexOf('fs:delete')
    const deleteSection = deleteIdx >= 0 ? fsHandlersSrc.slice(deleteIdx) : ''
    if (deleteSection.includes('unsafe path') || deleteSection.includes('normalized.length')) {
      log('pass', 'Runtime', 'fs:delete 경로 가드 존재')
    } else {
      log('warning', 'Runtime', 'fs:delete 재귀 삭제 경로 가드 없음', 'src/main/ipc/fs-handlers.ts')
    }

    // watchDir isDestroyed (M5 fix)
    if (fsHandlersSrc.includes('isDestroyed()')) {
      log('pass', 'Runtime', 'watchDir sender.isDestroyed() 체크 존재')
    } else {
      log('warning', 'Runtime', 'watchDir sender 생존 확인 없음', 'src/main/ipc/fs-handlers.ts')
    }
  } else {
    log('warning', 'Runtime', 'src/main/ipc/fs-handlers.ts 없음')
  }

  // cc-file-parser recursion depth (M4 fix)
  const parserPath = join(root, 'src/main/cc/cc-file-parser.ts')
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

  // handleSave try/finally (H2 fix)
  const cocosPanelPath = join(root, 'src/renderer/src/components/sidebar/CocosPanel/index.tsx')
  if (existsSync(cocosPanelPath)) {
    const cocosPanelSrc = readFileSync(cocosPanelPath, 'utf-8')
    const handleSaveIdx = cocosPanelSrc.indexOf('handleSave')
    const handleSaveBlock = handleSaveIdx >= 0 ? cocosPanelSrc.slice(handleSaveIdx, handleSaveIdx + 8000) : ''
    if (handleSaveBlock.includes('finally')) {
      log('pass', 'Runtime', 'handleSave try/finally 존재 (saving 상태 고착 방지)')
    } else {
      log('warning', 'Runtime', 'handleSave finally 없음 — throw 시 saving 고착 위험', 'src/renderer/src/components/sidebar/CocosPanel.tsx')
    }
  } else {
    log('warning', 'Runtime', 'CocosPanel.tsx 없음')
  }

  // local:// path traversal (L4 fix)
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
}
