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

// commandBus는 모듈 레벨 싱글톤이므로 resetModules 후 재import
async function freshModules() {
  vi.resetModules()
  localStorageMock.clear()
  const [{ commandBus }, { registerChatCommands }, { useChatStore }] = await Promise.all([
    import('../../../kernel/commandBus'),
    import('../commands'),
    import('../store'),
  ])
  return { commandBus, registerChatCommands, useChatStore }
}

describe('registerChatCommands', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── 등록 확인 ─────────────────────────────────────────────────────────────

  it('chat:send 핸들러가 등록된다', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    registerChatCommands()
    expect(commandBus.hasHandler('chat:send')).toBe(true)
  })

  it('chat:interrupt 핸들러가 등록된다', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    registerChatCommands()
    expect(commandBus.hasHandler('chat:interrupt')).toBe(true)
  })

  it('chat:close 핸들러가 등록된다', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    registerChatCommands()
    expect(commandBus.hasHandler('chat:close')).toBe(true)
  })

  it('chat:resume 핸들러가 등록된다', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    registerChatCommands()
    expect(commandBus.hasHandler('chat:resume')).toBe(true)
  })

  it('chat:permissionReply 핸들러가 등록된다', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    registerChatCommands()
    expect(commandBus.hasHandler('chat:permissionReply')).toBe(true)
  })

  // ── chat:send ────────────────────────────────────────────────────────────────

  it('chat:send → window.api.claudeSend 호출', async () => {
    const { commandBus, registerChatCommands, useChatStore } = await freshModules()
    const claudeSend = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { claudeSend } })

    useChatStore.setState({ messages: [], isStreaming: false, sessionId: null })
    registerChatCommands()

    await commandBus.dispatch({
      type: 'chat:send',
      payload: { text: 'hello', cwd: '/tmp', sessionId: 'sess-1', model: 'claude-3' },
    })

    expect(claudeSend).toHaveBeenCalledWith({
      text: 'hello',
      cwd: '/tmp',
      sessionId: 'sess-1',
      model: 'claude-3',
      extraSystemPrompt: undefined,
    })
  })

  it('chat:send → store에 user 메시지가 추가된다', async () => {
    const { commandBus, registerChatCommands, useChatStore } = await freshModules()
    vi.stubGlobal('window', { api: { claudeSend: vi.fn() } })

    useChatStore.setState({ messages: [], isStreaming: false, sessionId: null })
    registerChatCommands()

    await commandBus.dispatch({
      type: 'chat:send',
      payload: { text: '테스트 메시지', cwd: '/tmp' },
    })

    const msgs = useChatStore.getState().messages
    expect(msgs.length).toBe(1)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].text).toBe('테스트 메시지')
  })

  it('chat:send → window.api 없어도 throw 안 함', async () => {
    const { commandBus, registerChatCommands, useChatStore } = await freshModules()
    vi.stubGlobal('window', {})
    useChatStore.setState({ messages: [], isStreaming: false, sessionId: null })
    registerChatCommands()

    await expect(
      commandBus.dispatch({ type: 'chat:send', payload: { text: 'hi', cwd: '/' } })
    ).resolves.not.toThrow()
  })

  // ── chat:interrupt ───────────────────────────────────────────────────────────

  it('chat:interrupt → window.api.claudeInterrupt 호출', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    const claudeInterrupt = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { claudeInterrupt } })

    registerChatCommands()
    await commandBus.dispatch({ type: 'chat:interrupt', payload: { sessionId: 'sess-1' } })

    expect(claudeInterrupt).toHaveBeenCalledOnce()
  })

  it('chat:interrupt → window.api 없어도 throw 안 함', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    vi.stubGlobal('window', {})
    registerChatCommands()

    await expect(
      commandBus.dispatch({ type: 'chat:interrupt', payload: { sessionId: 'x' } })
    ).resolves.not.toThrow()
  })

  // ── chat:close ───────────────────────────────────────────────────────────────

  it('chat:close → window.api.claudeClose 호출', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    const claudeClose = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { claudeClose } })

    registerChatCommands()
    await commandBus.dispatch({ type: 'chat:close', payload: { sessionId: 'sess-1' } })

    expect(claudeClose).toHaveBeenCalledOnce()
  })

  it('chat:close → window.api 없어도 throw 안 함', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    vi.stubGlobal('window', {})
    registerChatCommands()

    await expect(
      commandBus.dispatch({ type: 'chat:close', payload: { sessionId: 'x' } })
    ).resolves.not.toThrow()
  })

  // ── chat:resume ──────────────────────────────────────────────────────────────

  it('chat:resume → window.api.claudeResume(sessionId) 호출', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    const claudeResume = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { claudeResume } })

    registerChatCommands()
    await commandBus.dispatch({ type: 'chat:resume', payload: { sessionId: 'sess-resume', cwd: '/' } })

    expect(claudeResume).toHaveBeenCalledWith('sess-resume')
  })

  it('chat:resume → window.api 없어도 throw 안 함', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    vi.stubGlobal('window', {})
    registerChatCommands()

    await expect(
      commandBus.dispatch({ type: 'chat:resume', payload: { sessionId: 'x', cwd: '/' } })
    ).resolves.not.toThrow()
  })

  // ── chat:permissionReply ─────────────────────────────────────────────────────

  it('chat:permissionReply → window.api.claudePermissionReply 호출', async () => {
    const { commandBus, registerChatCommands, useChatStore } = await freshModules()
    const claudePermissionReply = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { claudePermissionReply } })

    useChatStore.setState({ pendingPermission: { requestId: 'req-1', toolName: 'Bash', input: {} } })
    registerChatCommands()

    await commandBus.dispatch({
      type: 'chat:permissionReply',
      payload: { requestId: 'req-1', allow: true, sessionId: 'sess-1' },
    })

    expect(claudePermissionReply).toHaveBeenCalledWith('req-1', true)
  })

  it('chat:permissionReply → pendingPermission을 null로 초기화', async () => {
    const { commandBus, registerChatCommands, useChatStore } = await freshModules()
    vi.stubGlobal('window', { api: { claudePermissionReply: vi.fn() } })

    useChatStore.setState({ pendingPermission: { requestId: 'req-x', toolName: 'Bash', input: {} } })
    registerChatCommands()

    await commandBus.dispatch({
      type: 'chat:permissionReply',
      payload: { requestId: 'req-x', allow: false, sessionId: 'sess-1' },
    })

    expect(useChatStore.getState().pendingPermission).toBeNull()
  })

  it('chat:permissionReply allow=false → claudePermissionReply(id, false) 호출', async () => {
    const { commandBus, registerChatCommands } = await freshModules()
    const claudePermissionReply = vi.fn()
    vi.stubGlobal('window', { api: { claudePermissionReply } })

    registerChatCommands()
    await commandBus.dispatch({
      type: 'chat:permissionReply',
      payload: { requestId: 'req-deny', allow: false, sessionId: 'sess-1' },
    })

    expect(claudePermissionReply).toHaveBeenCalledWith('req-deny', false)
  })
})
