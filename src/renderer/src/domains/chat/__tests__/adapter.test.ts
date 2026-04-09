import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── localStorage mock (store.ts 등이 참조할 수 있음) ────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// ── requestAnimationFrame mock ──────────────────────────────────────────────
let rafCallbacks: Array<() => void> = []
vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { rafCallbacks.push(cb); return 1 })
vi.stubGlobal('cancelAnimationFrame', () => { rafCallbacks = [] })
function flushRAF() {
  const cbs = [...rafCallbacks]; rafCallbacks = []; cbs.forEach(cb => cb())
}

// ── window.api mock ─────────────────────────────────────────────────────────
let claudeMessageHandler: ((ev: unknown) => void) | null = null
let permissionHandler: ((req: unknown) => void) | null = null
let claudeMessageUnsub: ReturnType<typeof vi.fn>
let permissionUnsub: ReturnType<typeof vi.fn>

function setupWindowApi() {
  claudeMessageUnsub = vi.fn()
  permissionUnsub = vi.fn()

  vi.stubGlobal('window', {
    api: {
      onClaudeMessage: vi.fn((handler: (ev: unknown) => void) => {
        claudeMessageHandler = handler
        return claudeMessageUnsub
      }),
      onClaudePermission: vi.fn((handler: (req: unknown) => void) => {
        permissionHandler = handler
        return permissionUnsub
      }),
    },
  })
}

import { initChatAdapter } from '../adapter'
import { useChatStore } from '../store'

// ── Store 초기화 헬퍼 ────────────────────────────────────────────────────────
function resetStore() {
  useChatStore.setState({
    messages: [],
    isStreaming: false,
    sessionId: null,
    pendingPermission: null,
    sessionInputTokens: 0,
    sessionOutputTokens: 0,
    sessionModel: undefined,
  })
  localStorageMock.clear()
  rafCallbacks = []
}

describe('initChatAdapter', () => {
  beforeEach(() => {
    setupWindowApi()
    resetStore()
  })

  afterEach(() => {
    vi.clearAllMocks()
    claudeMessageHandler = null
    permissionHandler = null
  })

  // ── 등록 ─────────────────────────────────────────────────────────────────

  it('window.api.onClaudeMessage 리스너를 등록한다', () => {
    initChatAdapter()
    expect(window.api.onClaudeMessage).toHaveBeenCalledOnce()
  })

  it('window.api.onClaudePermission 리스너를 등록한다', () => {
    initChatAdapter()
    expect(window.api.onClaudePermission).toHaveBeenCalledOnce()
  })

  it('window.api가 없으면 cleanup noop을 반환한다', () => {
    vi.stubGlobal('window', {})
    const cleanup = initChatAdapter()
    expect(() => cleanup()).not.toThrow()
  })

  it('cleanup 호출 시 unsub 함수들을 호출한다', () => {
    const cleanup = initChatAdapter()
    cleanup()
    expect(claudeMessageUnsub).toHaveBeenCalledOnce()
    expect(permissionUnsub).toHaveBeenCalledOnce()
  })

  // ── 이벤트 타입: init ────────────────────────────────────────────────────

  it("'init' 이벤트 → sessionId를 store에 설정한다", () => {
    initChatAdapter()
    claudeMessageHandler!({ type: 'init', sessionId: 'sess-abc' })
    expect(useChatStore.getState().sessionId).toBe('sess-abc')
  })

  // ── 이벤트 타입: text ────────────────────────────────────────────────────

  it("'text' 이벤트 → assistant 메시지에 텍스트를 추가한다", () => {
    initChatAdapter()
    claudeMessageHandler!({ type: 'text', text: 'hello' })
    flushRAF()
    const msgs = useChatStore.getState().messages
    expect(msgs.length).toBeGreaterThan(0)
    expect(msgs[msgs.length - 1].role).toBe('assistant')
    expect(msgs[msgs.length - 1].text).toContain('hello')
  })

  // ── 이벤트 타입: text_delta ──────────────────────────────────────────────

  it("'text_delta' 이벤트 → ensureAssistantMessage + appendText 호출한다", () => {
    initChatAdapter()
    claudeMessageHandler!({ type: 'text_delta', text: 'delta-chunk' })
    flushRAF()
    const msgs = useChatStore.getState().messages
    expect(msgs[msgs.length - 1].text).toContain('delta-chunk')
  })

  // ── 이벤트 타입: thinking ────────────────────────────────────────────────

  it("'thinking' 이벤트 → assistant 메시지에 thinking 텍스트를 추가한다", () => {
    initChatAdapter()
    claudeMessageHandler!({ type: 'thinking', text: 'think...' })
    flushRAF()
    const msgs = useChatStore.getState().messages
    expect(msgs[msgs.length - 1].thinkingText).toContain('think...')
  })

  it("'thinking' 이벤트에 text가 없으면 아무 변화도 없다", () => {
    initChatAdapter()
    const before = useChatStore.getState().messages.length
    claudeMessageHandler!({ type: 'thinking' })
    expect(useChatStore.getState().messages.length).toBe(before)
  })

  // ── 이벤트 타입: tool_start ──────────────────────────────────────────────

  it("'tool_start' 이벤트 → addToolUse를 호출한다", () => {
    initChatAdapter()
    claudeMessageHandler!({
      type: 'tool_start',
      toolId: 'tid-1',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    })
    const msgs = useChatStore.getState().messages
    const last = msgs[msgs.length - 1]
    expect(last.toolUses[0]).toMatchObject({ id: 'tid-1', name: 'Bash' })
  })

  it("'tool_start' Write/Edit → callbacks.onToolWrite 를 호출한다", () => {
    const onToolWrite = vi.fn()
    initChatAdapter({ onToolWrite })
    claudeMessageHandler!({ type: 'tool_start', toolId: 't2', toolName: 'Write', toolInput: { path: 'a.ts' } })
    expect(onToolWrite).toHaveBeenCalledWith('Write', { path: 'a.ts' })
  })

  it("'tool_start' Task → callbacks.onTaskStart 를 호출한다", () => {
    const onTaskStart = vi.fn()
    initChatAdapter({ onTaskStart })
    claudeMessageHandler!({
      type: 'tool_start',
      toolId: 't3',
      toolName: 'Task',
      toolInput: { description: 'do something' },
    })
    expect(onTaskStart).toHaveBeenCalledWith('t3', 'do something')
  })

  // ── 이벤트 타입: tool_end ────────────────────────────────────────────────

  it("'tool_end' 이벤트 → updateToolUse를 호출하고 onTaskEnd 콜백을 호출한다", () => {
    const onTaskEnd = vi.fn()
    initChatAdapter({ onTaskEnd })
    // 먼저 tool_start로 툴을 추가
    claudeMessageHandler!({ type: 'tool_start', toolId: 'tid-x', toolName: 'Bash', toolInput: {} })
    claudeMessageHandler!({ type: 'tool_end', toolId: 'tid-x', toolOutput: 'done', isError: false })
    const last = useChatStore.getState().messages.at(-1)!
    expect(last.toolUses[0]).toMatchObject({ id: 'tid-x', output: 'done', status: 'done' })
    expect(onTaskEnd).toHaveBeenCalledWith('tid-x', 'done', false)
  })

  // ── 이벤트 타입: result ──────────────────────────────────────────────────

  it("'result' 이벤트 → finishStreaming + addUsage + onResult 콜백", () => {
    const onResult = vi.fn()
    initChatAdapter({ onResult })
    // 스트리밍 시작
    useChatStore.setState({ isStreaming: true })
    claudeMessageHandler!({ type: 'result', costUsd: 0.01, inputTokens: 100, outputTokens: 50 })
    const state = useChatStore.getState()
    expect(state.isStreaming).toBe(false)
    expect(state.sessionInputTokens).toBe(100)
    expect(state.sessionOutputTokens).toBe(50)
    expect(onResult).toHaveBeenCalledWith(0.01, 100, 50)
  })

  // ── 이벤트 타입: usage ───────────────────────────────────────────────────

  it("'usage' 이벤트 → addUsage를 호출한다", () => {
    initChatAdapter()
    claudeMessageHandler!({ type: 'usage', inputTokens: 20, outputTokens: 10 })
    const state = useChatStore.getState()
    expect(state.sessionInputTokens).toBe(20)
    expect(state.sessionOutputTokens).toBe(10)
  })

  // ── 이벤트 타입: interrupted ─────────────────────────────────────────────

  it("'interrupted' 이벤트 → finishStreaming을 호출한다", () => {
    initChatAdapter()
    useChatStore.setState({ isStreaming: true })
    claudeMessageHandler!({ type: 'interrupted' })
    expect(useChatStore.getState().isStreaming).toBe(false)
  })

  // ── 이벤트 타입: error ───────────────────────────────────────────────────

  it("'error' 이벤트 → [Error: ...] 텍스트를 추가한다", () => {
    initChatAdapter()
    claudeMessageHandler!({ type: 'error', message: 'something went wrong' })
    flushRAF()
    const last = useChatStore.getState().messages.at(-1)!
    expect(last.text).toContain('something went wrong')
    expect(last.isError).toBe(true)
  })

  it("'error' API 키 오류 → 안내 메시지를 포함한다", () => {
    initChatAdapter()
    claudeMessageHandler!({ type: 'error', message: '401 invalid_api_key' })
    flushRAF()
    const last = useChatStore.getState().messages.at(-1)!
    expect(last.text).toMatch(/API 키/)
  })

  // ── AGUI 이벤트 ──────────────────────────────────────────────────────────

  it("AGUI 타입 이벤트 → onAguiEvent 콜백을 호출한다", () => {
    const onAguiEvent = vi.fn()
    initChatAdapter({ onAguiEvent })
    const ev = { type: 'run_started', runId: 'r1' }
    claudeMessageHandler!(ev)
    expect(onAguiEvent).toHaveBeenCalledWith(ev)
  })

  it("일반 타입 이벤트는 onAguiEvent를 호출하지 않는다", () => {
    const onAguiEvent = vi.fn()
    initChatAdapter({ onAguiEvent })
    claudeMessageHandler!({ type: 'text', text: 'hi' })
    expect(onAguiEvent).not.toHaveBeenCalled()
  })

  // ── Permission 핸들러 ────────────────────────────────────────────────────

  it("permission 이벤트 → setPendingPermission을 호출한다", () => {
    initChatAdapter()
    const req = { requestId: 'req-1', toolName: 'Bash', input: { command: 'rm -rf' } }
    permissionHandler!(req)
    expect(useChatStore.getState().pendingPermission).toMatchObject(req)
  })
})
