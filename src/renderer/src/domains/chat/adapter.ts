/**
 * Chat Adapter — IPC 이벤트 → Chat Store 업데이트
 * 순수 chat 상태 업데이트만 담당.
 * 크로스-도메인 사이드이펙트(비용, 에이전트, 사운드)는 콜백으로 위임.
 */
import { useChatStore } from './store'
import { t } from '../../utils/i18n'

export interface ChatAdapterCallbacks {
  /** Write/Edit 툴 실행 시 (파일 변경 추적) */
  onToolWrite?: (toolName: string, toolInput: unknown) => void
  /** Task 에이전트 시작 */
  onTaskStart?: (toolId: string, description: string) => void
  /** Task 에이전트 완료 */
  onTaskEnd?: (toolId: string, output: string, isError: boolean) => void
  /** 스트리밍 완료 (비용, 사운드 처리) */
  onResult?: (cost: number, inputTokens: number, outputTokens: number) => void
  /** AGUI 프로토콜 이벤트 */
  onAguiEvent?: (ev: unknown) => void
}

const AGUI_TYPES = new Set(['run_started', 'step_started', 'step_finished', 'run_finished'])

let _isDeltaStreaming = false

export function initChatAdapter(callbacks?: ChatAdapterCallbacks): () => void {
  if (!window.api?.onClaudeMessage) return () => {}

  const store = () => useChatStore.getState()

  // ── Claude 스트리밍 메시지 핸들러 ──────────────────────────────────────────

  const unsub = window.api.onClaudeMessage((event: unknown) => {
    const ev = event as { type: string; [k: string]: unknown }

    switch (ev.type) {
      case 'init':
        store().setSessionId(ev.sessionId as string)
        break

      case 'text':
        if (_isDeltaStreaming) {
          store().reconcileText(ev.text as string)
        } else {
          store().ensureAssistantMessage()
          store().appendText(ev.text as string)
        }
        break

      case 'text_delta':
        _isDeltaStreaming = true
        store().ensureAssistantMessage()
        store().appendText(ev.text as string)
        break

      case 'thinking':
      case 'thinking_delta':
        if (ev.text) {
          store().ensureAssistantMessage()
          store().appendThinking(ev.text as string)
        }
        break

      case 'tool_start':
        store().ensureAssistantMessage()
        store().addToolUse(ev.toolId as string, ev.toolName as string, ev.toolInput)
        if (ev.toolName === 'Write' || ev.toolName === 'Edit') {
          callbacks?.onToolWrite?.(ev.toolName as string, ev.toolInput)
        }
        if (ev.toolName === 'Task') {
          const input = ev.toolInput as Record<string, unknown> | undefined
          const desc = (input?.description ?? input?.prompt ?? 'Task') as string
          callbacks?.onTaskStart?.(ev.toolId as string, desc.slice(0, 100))
        }
        break

      case 'tool_end':
        store().updateToolUse(ev.toolId as string, ev.toolOutput as string, ev.isError as boolean)
        callbacks?.onTaskEnd?.(ev.toolId as string, ev.toolOutput as string, ev.isError as boolean)
        break

      case 'result':
        _isDeltaStreaming = false
        store().addUsage((ev.inputTokens as number) ?? 0, (ev.outputTokens as number) ?? 0)
        store().finishStreaming()
        callbacks?.onResult?.(
          (ev.costUsd as number) ?? 0,
          (ev.inputTokens as number) ?? 0,
          (ev.outputTokens as number) ?? 0,
        )
        break

      case 'usage':
        store().addUsage((ev.inputTokens as number) ?? 0, (ev.outputTokens as number) ?? 0)
        break

      case 'interrupted':
        _isDeltaStreaming = false
        store().finishStreaming()
        break

      case 'error': {
        store().ensureAssistantMessage()
        const errMsg = String(ev.message ?? '')
        const isApiKeyError = /401|api_key|authentication|invalid_api_key|x-api-key/i.test(errMsg)
        if (isApiKeyError) {
          store().appendText(`\n${t('adapter.apiKeyInvalid', '⚠️ API 키가 유효하지 않습니다. ANTHROPIC_API_KEY 환경변수를 확인해주세요.\n\n원인: ')}${errMsg}`)
        } else {
          store().appendText(`\n[Error: ${errMsg}]`)
        }
        store().markLastMessageError()
        store().finishStreaming()
        break
      }

      // input_json_delta, tool_progress, status — 무시
      default:
        break
    }

    if (AGUI_TYPES.has(ev.type)) {
      callbacks?.onAguiEvent?.(ev)
    }
  })

  // ── Permission 핸들러 ─────────────────────────────────────────────────────

  const permUnsub = window.api.onClaudePermission?.((req: unknown) => {
    const r = req as { requestId: string; toolName: string; input: unknown }
    store().setPendingPermission(r)
  })

  return () => {
    if (typeof unsub === 'function') unsub()
    if (typeof permUnsub === 'function') permUnsub()
  }
}
