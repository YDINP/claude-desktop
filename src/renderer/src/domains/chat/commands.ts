/**
 * Chat CommandBus 핸들러 등록
 * chat:send / chat:resume / chat:close / chat:interrupt / chat:permissionReply
 */
import { commandBus } from '../../kernel/commandBus'
import { useChatStore } from './store'

export function registerChatCommands(): void {
  commandBus.register('chat:send', async ({ text, cwd, sessionId, model, extraSystemPrompt }) => {
    const store = useChatStore.getState()
    store.addUserMessage(text)
    return window.api?.claudeSend?.({ text, cwd, model, extraSystemPrompt, sessionId })
  })

  // preload 시그니처: claudeInterrupt() — 인자 없음
  commandBus.register('chat:interrupt', () => {
    return window.api?.claudeInterrupt?.()
  })

  // preload 시그니처: claudeClose() — 인자 없음
  commandBus.register('chat:close', () => {
    return window.api?.claudeClose?.()
  })

  // preload 시그니처: claudeResume(sessionId)
  commandBus.register('chat:resume', ({ sessionId }) => {
    return window.api?.claudeResume?.(sessionId)
  })

  // preload 시그니처: claudePermissionReply(requestId, allow, allowSession?)
  commandBus.register('chat:permissionReply', ({ requestId, allow }) => {
    useChatStore.getState().setPendingPermission(null)
    return window.api?.claudePermissionReply?.(requestId, allow)
  })
}
