/**
 * IPC Bridge — window.api ↔ Kernel 연결
 * window.api.onXxx 이벤트 → eventBus.emit()
 * commandBus 핸들러 → window.api.xxx() 호출
 *
 * Phase A: 이벤트 브릿지만 설치.
 * 도메인 어댑터(chat/cocos/...)는 Phase B/C에서 추가.
 */
import { eventBus } from './eventBus'
import { commandBus } from './commandBus'
// StreamEvent, PermissionRequest, CCEvent, CCStatus — 각 adapter에서 직접 import

let initialized = false
const cleanups: (() => void)[] = []

export function initIpcBridge(): void {
  if (initialized) return
  initialized = true

  const api = window.api
  if (!api) {
    console.warn('[IpcBridge] window.api unavailable — bridge skipped')
    return
  }

  // ── Main→Renderer 이벤트 → EventBus ──────────────────────────────────────
  // 주의: claude:message, claude:permission, cc:event, cc:statusChange,
  //       cc:fileChanged, fs:change, app:closeTab, app:fontSizeShortcut,
  //       app:themeChanged 는 각 adapter/hook 에서 직접 window.api 구독.
  //       여기서 중복 구독하면 이벤트가 2번 처리됨 (P0-1).

  // Terminal — eventBus 경유로만 소비되므로 유일하게 유지
  if (api.onTerminalData) {
    const unsub = api.onTerminalData((id: string, data: string) => {
      eventBus.emit({ type: 'terminal:data', payload: { id, data } })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // ── CommandBus → window.api 핸들러 ───────────────────────────────────────

  // chat 커맨드는 chat/commands.ts에서 등록 (store 연동 로직 포함)
  // 여기서 중복 등록하면 commandBus가 덮어써서 store 로직이 누락됨

  // terminal — preload 시그니처: (id, cwd), (id, data), (id, cols, rows), (id)
  commandBus.register('terminal:create', ({ id, cwd }) =>
    api.terminalCreate?.(id, cwd)
  )
  commandBus.register('terminal:write', ({ id, data }) =>
    api.terminalWrite?.(id, data)
  )
  commandBus.register('terminal:resize', ({ id, cols, rows }) =>
    api.terminalResize?.(id, cols, rows)
  )
  commandBus.register('terminal:close', ({ id }) =>
    api.terminalClose?.(id)
  )

  // filesystem
  commandBus.register('fs:readFile', ({ path }) =>
    api.readFile?.(path)
  )
  commandBus.register('fs:readDir', ({ path }) =>
    api.readDir?.(path)
  )
  // preload saveFile 시그니처: (content, defaultName) — 다이얼로그 기반 저장
  commandBus.register('fs:saveFile', ({ path, content }) =>
    api.saveFile?.(content, path)
  )
  commandBus.register('fs:watchDir', ({ path }) =>
    api.watchDir?.(path)
  )
  commandBus.register('fs:unwatchDir', ({ path }) =>
    api.unwatchDir?.(path)
  )

  // session
  commandBus.register('session:load', ({ sessionId }) =>
    api.sessionLoad?.(sessionId)
  )
  commandBus.register('session:delete', ({ sessionId }) =>
    api.sessionDelete?.(sessionId)
  )

  // cocos file — preload 시그니처: (sceneFile, modifiedRoot) — 순서 역전 주의
  commandBus.register('cocos:saveScene', ({ root, sceneFile }) =>
    api.ccFileSaveScene?.(sceneFile, root)
  )
}

export function destroyIpcBridge(): void {
  cleanups.forEach(fn => fn())
  cleanups.length = 0
  initialized = false
}
