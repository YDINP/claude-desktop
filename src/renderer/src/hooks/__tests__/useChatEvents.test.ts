import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatEvents } from '../useChatEvents'

describe('useChatEvents', () => {
  let onPrefill: ReturnType<typeof vi.fn>
  let workflowPromptRef: React.MutableRefObject<string | null>

  beforeEach(() => {
    onPrefill = vi.fn()
    workflowPromptRef = { current: null }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function setup() {
    return renderHook(() =>
      useChatEvents({ onPrefill, workflowPromptRef }),
    )
  }

  // ── cc-chat-prefill ──────────────────────────────────────────────────────────

  it('cc-chat-prefill: detail.text → onPrefill 호출', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { text: 'hello prefill' } }))
    })
    expect(onPrefill).toHaveBeenCalledWith('hello prefill')
  })

  it('cc-chat-prefill: detail.message → onPrefill 호출 (text 없을 때)', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { message: 'from message field' } }))
    })
    expect(onPrefill).toHaveBeenCalledWith('from message field')
  })

  it('cc-chat-prefill: detail.text 우선 (text + message 동시)', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { text: 'text wins', message: 'ignored' } }))
    })
    expect(onPrefill).toHaveBeenCalledWith('text wins')
  })

  it('cc-chat-prefill: detail이 비어있으면 onPrefill 호출 안 함', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: {} }))
    })
    expect(onPrefill).not.toHaveBeenCalled()
  })

  it('cc-chat-prefill: detail.text가 빈 문자열이면 onPrefill 호출 안 함', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { text: '' } }))
    })
    expect(onPrefill).not.toHaveBeenCalled()
  })

  it('cc-chat-prefill: imageBase64만 있고 text/message 없으면 onPrefill 호출 안 함', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { imageBase64: 'base64data' } }))
    })
    expect(onPrefill).not.toHaveBeenCalled()
  })

  // ── workflow-inject ──────────────────────────────────────────────────────────

  it('workflow-inject: systemPrompt → workflowPromptRef.current에 저장', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('workflow-inject', { detail: { systemPrompt: 'sys-prompt-text' } }))
    })
    expect(workflowPromptRef.current).toBe('sys-prompt-text')
  })

  it('workflow-inject: systemPrompt 없으면 ref 변경 없음', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('workflow-inject', { detail: { otherField: 'x' } }))
    })
    expect(workflowPromptRef.current).toBeNull()
  })

  it('workflow-inject: detail null이면 ref 변경 없음', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('workflow-inject', { detail: null }))
    })
    expect(workflowPromptRef.current).toBeNull()
  })

  it('workflow-inject: 여러 번 주입 시 마지막 값이 저장된다', () => {
    setup()
    act(() => {
      window.dispatchEvent(new CustomEvent('workflow-inject', { detail: { systemPrompt: 'first' } }))
      window.dispatchEvent(new CustomEvent('workflow-inject', { detail: { systemPrompt: 'second' } }))
    })
    expect(workflowPromptRef.current).toBe('second')
  })

  // ── cleanup ──────────────────────────────────────────────────────────────────

  it('unmount 후 cc-chat-prefill 이벤트 무시', () => {
    const { unmount } = setup()
    unmount()
    act(() => {
      window.dispatchEvent(new CustomEvent('cc-chat-prefill', { detail: { text: 'after unmount' } }))
    })
    expect(onPrefill).not.toHaveBeenCalled()
  })

  it('unmount 후 workflow-inject 이벤트 무시', () => {
    const { unmount } = setup()
    unmount()
    act(() => {
      window.dispatchEvent(new CustomEvent('workflow-inject', { detail: { systemPrompt: 'after unmount' } }))
    })
    expect(workflowPromptRef.current).toBeNull()
  })
})
