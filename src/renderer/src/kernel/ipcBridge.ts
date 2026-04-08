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
import type { StreamEvent, PermissionRequest, CCEvent, CCStatus } from '../../../shared/ipc-schema'

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

  // Claude streaming
  if (api.onClaudeMessage) {
    const unsub = api.onClaudeMessage((event: unknown) => {
      eventBus.emit({ type: 'claude:message', payload: event as StreamEvent })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // Claude permission
  if (api.onClaudePermission) {
    const unsub = api.onClaudePermission((req: unknown) => {
      eventBus.emit({ type: 'claude:permission', payload: req as PermissionRequest })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // CC live events
  if (api.onCCEvent) {
    const unsub = api.onCCEvent((event: unknown) => {
      eventBus.emit({ type: 'cc:event', payload: event as CCEvent })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  if (api.onCCStatusChange) {
    const unsub = api.onCCStatusChange((status: unknown) => {
      eventBus.emit({ type: 'cc:statusChange', payload: status as CCStatus })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // CC file watcher — preload 시그니처: cb({ type, path, timestamp })
  if (api.onCCFileChanged) {
    const unsub = api.onCCFileChanged((event: unknown) => {
      const e = event as { type: string; path: string; timestamp: number }
      eventBus.emit({ type: 'cc:fileChanged', payload: { path: e.path } })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // Terminal — preload 시그니처: cb(id: string, data: string)
  if (api.onTerminalData) {
    const unsub = api.onTerminalData((id: string, data: string) => {
      eventBus.emit({ type: 'terminal:data', payload: { id, data } })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // Filesystem watcher — preload 시그니처: cb({ dirPath, eventType, filename })
  if (api.onDirChanged) {
    const unsub = api.onDirChanged((info: unknown) => {
      const i = info as { dirPath: string; eventType: string; filename: string }
      eventBus.emit({ type: 'fs:change', payload: { path: i.dirPath, type: i.eventType } })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // App-level shortcuts
  if (api.onCloseTab) {
    const unsub = api.onCloseTab(() => {
      eventBus.emit({ type: 'app:closeTab', payload: {} })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  if (api.onFontSizeShortcut) {
    const unsub = api.onFontSizeShortcut((delta: unknown) => {
      eventBus.emit({ type: 'app:fontSizeShortcut', payload: { delta: delta as number } })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  if (api.onNativeThemeChanged) {
    const unsub = api.onNativeThemeChanged((isDark: unknown) => {
      eventBus.emit({ type: 'app:themeChanged', payload: { isDark: isDark as boolean } })
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
