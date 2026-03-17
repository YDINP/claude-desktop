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

  commandBus.register('chat:interrupt', ({ sessionId }) => {
    return window.api?.claudeInterrupt?.(sessionId)
  })

  commandBus.register('chat:close', ({ sessionId }) => {
    return window.api?.claudeClose?.(sessionId)
  })

  commandBus.register('chat:resume', ({ sessionId, cwd }) => {
    return window.api?.claudeResume?.(sessionId, cwd)
  })

  commandBus.register('chat:permissionReply', ({ requestId, allow, sessionId }) => {
    useChatStore.getState().setPendingPermission(null)
    return window.api?.claudePermissionReply?.({ requestId, allow, sessionId })
  })
}
