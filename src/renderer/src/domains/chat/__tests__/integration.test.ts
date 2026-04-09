/**
 * Chat 전체 흐름 통합 테스트
 * registerChatCommands + commandBus + store + adapter 연동
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── localStorage mock ────────────────────────────────────────────────────────
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

// ── 모듈 레벨 싱글톤 초기화를 위한 fresh import 헬퍼 ─────────────────────────
async function freshSetup() {
  vi.resetModules()
  localStorageMock.clear()
  rafCallbacks = []

  const [{ commandBus }, { registerChatCommands }, { useChatStore }, { initChatAdapter }] =
    await Promise.all([
      import('../../../kernel/commandBus'),
      import('../commands'),
      import('../store'),
      import('../adapter'),
    ])

  return { commandBus, registerChatCommands, useChatStore, initChatAdapter }
}

// ── window.api mock builder ──────────────────────────────────────────────────
function buildWindowApi() {
  let claudeMessageHandler: ((ev: unknown) => void) | null = null
  let permissionHandler: ((req: unknown) => void) | null = null

  const api = {
    claudeSend: vi.fn().mockResolvedValue(undefined),
    claudeInterrupt: vi.fn().mockResolvedValue(undefined),
    claudeClose: vi.fn().mockResolvedValue(undefined),
    claudeResume: vi.fn().mockResolvedValue(undefined),
    claudePermissionReply: vi.fn().mockResolvedValue(undefined),
    onClaudeMessage: vi.fn((handler: (ev: unknown) => void) => {
      claudeMessageHandler = handler
      return vi.fn()
    }),
    onClaudePermission: vi.fn((handler: (req: unknown) => void) => {
      permissionHandler = handler
      return vi.fn()
    }),
  }

  const emit = (ev: unknown) => claudeMessageHandler?.(ev)
  const emitPermission = (req: unknown) => permissionHandler?.(req)

  return { api, emit, emitPermission }
}

describe('Chat 전체 흐름 통합', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── 1. registerChatCommands → commandBus.dispatch('chat:send') → store + claudeSend ──

  it('chat:send → store에 user 메시지 추가 + claudeSend 호출', async () => {
    const { commandBus, registerChatCommands, useChatStore } = await freshSetup()
    const { api } = buildWindowApi()
    vi.stubGlobal('window', { api })

    useChatStore.setState({ messages: [], isStreaming: false, sessionId: null })
    registerChatCommands()

    await commandBus.dispatch({
      type: 'chat:send',
      payload: { text: '안녕하세요', cwd: '/workspace', sessionId: 'sess-1', model: 'claude-3' },
    })

    const msgs = useChatStore.getState().messages
    expect(msgs.length).toBe(1)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].text).toBe('안녕하세요')
    expect(api.claudeSend).toHaveBeenCalledWith({
      text: '안녕하세요',
      cwd: '/workspace',
      sessionId: 'sess-1',
      model: 'claude-3',
      extraSystemPrompt: undefined,
    })
  })

  it('chat:send 후 isStreaming이 true가 된다', async () => {
    const { commandBus, registerChatCommands, useChatStore } = await freshSetup()
    const { api } = buildWindowApi()
    vi.stubGlobal('window', { api })

    useChatStore.setState({ messages: [], isStreaming: false, sessionId: null })
    registerChatCommands()

    await commandBus.dispatch({
      type: 'chat:send',
      payload: { text: 'test', cwd: '/' },
    })

    expect(useChatStore.getState().isStreaming).toBe(true)
  })

  // ── 2. chat:interrupt → claudeInterrupt 호출 ─────────────────────────────────

  it('chat:interrupt → claudeInterrupt 호출', async () => {
    const { commandBus, registerChatCommands } = await freshSetup()
    const { api } = buildWindowApi()
    vi.stubGlobal('window', { api })
    registerChatCommands()

    await commandBus.dispatch({ type: 'chat:interrupt', payload: { sessionId: 'sess-1' } })

    expect(api.claudeInterrupt).toHaveBeenCalledOnce()
  })

  // ── 3. adapter 'result' 이벤트 → store.finishStreaming ────────────────────────

  it("adapter 'result' 이벤트 → isStreaming false + addUsage 반영", async () => {
    const { useChatStore, initChatAdapter } = await freshSetup()
    const { api, emit } = buildWindowApi()
    vi.stubGlobal('window', { api })

    useChatStore.setState({ isStreaming: true, sessionInputTokens: 0, sessionOutputTokens: 0 })
    initChatAdapter()

    emit({ type: 'result', costUsd: 0.005, inputTokens: 200, outputTokens: 80 })

    const state = useChatStore.getState()
    expect(state.isStreaming).toBe(false)
    expect(state.sessionInputTokens).toBe(200)
    expect(state.sessionOutputTokens).toBe(80)
  })

  // ── 4. adapter 'interrupted' 이벤트 → store.finishStreaming ─────────────────

  it("adapter 'interrupted' → isStreaming false", async () => {
    const { useChatStore, initChatAdapter } = await freshSetup()
    const { api, emit } = buildWindowApi()
    vi.stubGlobal('window', { api })

    useChatStore.setState({ isStreaming: true })
    initChatAdapter()

    emit({ type: 'interrupted' })

    expect(useChatStore.getState().isStreaming).toBe(false)
  })

  // ── 5. adapter 'text' → store.appendText (통합 경로) ─────────────────────────

  it("adapter 'text' 이벤트 → assistant 메시지 생성 + 텍스트 누적", async () => {
    const { useChatStore, initChatAdapter } = await freshSetup()
    const { api, emit } = buildWindowApi()
    vi.stubGlobal('window', { api })

    useChatStore.setState({ messages: [] })
    initChatAdapter()

    emit({ type: 'text', text: 'Hello' })
    flushRAF()
    emit({ type: 'text', text: ' World' })
    flushRAF()

    const msgs = useChatStore.getState().messages
    expect(msgs.length).toBeGreaterThan(0)
    const last = msgs[msgs.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.text).toContain('Hello')
  })

  // ── 6. registerChatCommands + adapter 순차 연동 (send → streaming → finish) ──

  it('send → 스트리밍 시작 → result 이벤트로 완료되는 전체 흐름', async () => {
    const { commandBus, registerChatCommands, useChatStore, initChatAdapter } = await freshSetup()
    const { api, emit } = buildWindowApi()
    vi.stubGlobal('window', { api })

    useChatStore.setState({ messages: [], isStreaming: false, sessionId: null,
      sessionInputTokens: 0, sessionOutputTokens: 0 })

    registerChatCommands()
    initChatAdapter()

    // 1) user sends message
    await commandBus.dispatch({
      type: 'chat:send',
      payload: { text: 'what is 2+2?', cwd: '/tmp', sessionId: 'sess-flow' },
    })
    expect(useChatStore.getState().isStreaming).toBe(true)
    expect(useChatStore.getState().messages[0].role).toBe('user')

    // 2) adapter receives init
    emit({ type: 'init', sessionId: 'sess-flow' })
    expect(useChatStore.getState().sessionId).toBe('sess-flow')

    // 3) assistant text streams in
    emit({ type: 'text_delta', text: '4' })
    flushRAF()
    const afterText = useChatStore.getState().messages
    expect(afterText[afterText.length - 1].role).toBe('assistant')

    // 4) result finalizes
    emit({ type: 'result', costUsd: 0.001, inputTokens: 10, outputTokens: 5 })
    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(useChatStore.getState().sessionInputTokens).toBe(10)
  })

  // ── 7. chat:permissionReply → pendingPermission null + claudePermissionReply ──

  it('chat:permissionReply → pendingPermission 초기화 + claudePermissionReply 호출', async () => {
    const { commandBus, registerChatCommands, useChatStore } = await freshSetup()
    const { api } = buildWindowApi()
    vi.stubGlobal('window', { api })

    useChatStore.setState({ pendingPermission: { requestId: 'req-42', toolName: 'Bash', input: {} } })
    registerChatCommands()

    await commandBus.dispatch({
      type: 'chat:permissionReply',
      payload: { requestId: 'req-42', allow: true, sessionId: 'sess-1' },
    })

    expect(useChatStore.getState().pendingPermission).toBeNull()
    expect(api.claudePermissionReply).toHaveBeenCalledWith('req-42', true)
  })
})
