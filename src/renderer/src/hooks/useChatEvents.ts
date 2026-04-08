import { useEffect } from 'react'

interface UseChatEventsOptions {
  onPrefill: (text: string) => void
  workflowPromptRef: React.MutableRefObject<string | null>
}

/**
 * cc-chat-prefill 이벤트 (씬 AI 분석 프리필)와
 * workflow-inject 이벤트 (워크플로우 시스템 프롬프트 주입)를 처리한다.
 */
export function useChatEvents({ onPrefill, workflowPromptRef }: UseChatEventsOptions): void {
  // R1474: cc-chat-prefill 이벤트 → 입력창 프리필 (씬 AI 분석)
  useEffect(() => {
    const onPrefillHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string; message?: string; imageBase64?: string }
      const msg = detail.text ?? detail.message ?? ''
      if (msg) onPrefill(msg)
    }
    window.addEventListener('cc-chat-prefill', onPrefillHandler)
    return () => window.removeEventListener('cc-chat-prefill', onPrefillHandler)
  }, [onPrefill])

  // workflow-inject 이벤트 → 시스템 프롬프트 ref에 주입
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.systemPrompt) {
        workflowPromptRef.current = detail.systemPrompt
      }
    }
    window.addEventListener('workflow-inject', handler)
    return () => window.removeEventListener('workflow-inject', handler)
  }, [workflowPromptRef])
}
