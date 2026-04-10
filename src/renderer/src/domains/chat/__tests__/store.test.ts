import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock localStorage
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

// Mock requestAnimationFrame / cancelAnimationFrame for synchronous testing
let rafCallbacks: Array<() => void> = []
let rafIdCounter = 1
vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
  rafCallbacks.push(cb)
  return rafIdCounter++
})
vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
  // Clear pending callbacks
  rafCallbacks = []
})

function flushRAF() {
  const cbs = [...rafCallbacks]
  rafCallbacks = []
  cbs.forEach(cb => cb())
}

import { useChatStore } from '../store'

describe('chat store', () => {
  beforeEach(() => {
    // Reset store state
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
    rafIdCounter = 1
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('addUserMessage', () => {
    it('should add a user message and start streaming', () => {
      const store = useChatStore.getState()

      const msgId = store.addUserMessage('Hello')

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0].role).toBe('user')
      expect(state.messages[0].text).toBe('Hello')
      expect(state.messages[0].id).toBe(msgId)
      expect(state.isStreaming).toBe(true)
    })

    it('should set timestamp on user message', () => {
      const before = Date.now()
      useChatStore.getState().addUserMessage('test')
      const after = Date.now()

      const msg = useChatStore.getState().messages[0]
      expect(msg.timestamp).toBeGreaterThanOrEqual(before)
      expect(msg.timestamp).toBeLessThanOrEqual(after)
    })

    it('should initialize empty toolUses array', () => {
      useChatStore.getState().addUserMessage('test')
      expect(useChatStore.getState().messages[0].toolUses).toEqual([])
    })
  })

  describe('appendText', () => {
    it('should buffer text and flush on RAF', () => {
      // Set up an assistant message first
      useChatStore.setState({
        messages: [{
          id: '1', role: 'assistant', text: '', toolUses: [], timestamp: Date.now(),
        }],
        isStreaming: true,
      })

      useChatStore.getState().appendText('Hello ')
      useChatStore.getState().appendText('World')

      // Before RAF flush, text should still be empty (buffered)
      expect(useChatStore.getState().messages[0].text).toBe('')

      // Flush RAF
      flushRAF()

      expect(useChatStore.getState().messages[0].text).toBe('Hello World')
    })

    it('should not append if last message is not assistant', () => {
      useChatStore.setState({
        messages: [{
          id: '1', role: 'user', text: 'question', toolUses: [], timestamp: Date.now(),
        }],
      })

      useChatStore.getState().appendText('should not appear')
      flushRAF()

      expect(useChatStore.getState().messages[0].text).toBe('question')
    })

    it('should batch multiple appends into a single RAF callback', () => {
      useChatStore.setState({
        messages: [{
          id: '1', role: 'assistant', text: 'start-', toolUses: [], timestamp: Date.now(),
        }],
        isStreaming: true,
      })

      useChatStore.getState().appendText('a')
      useChatStore.getState().appendText('b')
      useChatStore.getState().appendText('c')

      // Only 1 RAF should have been scheduled
      expect(rafCallbacks).toHaveLength(1)

      flushRAF()
      expect(useChatStore.getState().messages[0].text).toBe('start-abc')
    })
  })

  describe('finishStreaming', () => {
    it('should flush remaining buffered text and set isStreaming to false', () => {
      useChatStore.setState({
        messages: [{
          id: '1', role: 'assistant', text: 'partial', toolUses: [], timestamp: Date.now(),
        }],
        isStreaming: true,
      })

      // Buffer some text without flushing
      useChatStore.getState().appendText(' more')
      // Don't flush RAF manually

      useChatStore.getState().finishStreaming()

      const state = useChatStore.getState()
      expect(state.isStreaming).toBe(false)
      expect(state.messages[0].text).toBe('partial more')
    })

    it('should flush remaining thinking text', () => {
      useChatStore.setState({
        messages: [{
          id: '1', role: 'assistant', text: '', thinkingText: 'think-', toolUses: [], timestamp: Date.now(),
        }],
        isStreaming: true,
      })

      useChatStore.getState().appendThinking('more')
      useChatStore.getState().finishStreaming()

      expect(useChatStore.getState().messages[0].thinkingText).toBe('think-more')
    })
  })

  describe('hydrate', () => {
    it('should restore messages and session ID', () => {
      const msgs = [
        { id: 'msg1', role: 'user' as const, text: 'hi', toolUses: [], timestamp: 1000 },
        { id: 'msg2', role: 'assistant' as const, text: 'hello', toolUses: [], timestamp: 2000 },
      ]

      useChatStore.getState().hydrate(msgs, 'session-123')

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(2)
      expect(state.sessionId).toBe('session-123')
      expect(state.isStreaming).toBe(false)
      expect(state.pendingPermission).toBeNull()
    })

    it('should merge reactions from localStorage', () => {
      // Set up reactions in localStorage
      localStorageMock.setItem('chat-reactions', JSON.stringify({
        msg1: ['thumbsup'],
      }))

      const msgs = [
        { id: 'msg1', role: 'user' as const, text: 'hi', toolUses: [], timestamp: 1000 },
      ]

      useChatStore.getState().hydrate(msgs, null)

      const state = useChatStore.getState()
      expect(state.messages[0].reactions).toContain('thumbsup')
    })

    it('should handle null sessionId', () => {
      useChatStore.getState().hydrate([], null)

      expect(useChatStore.getState().sessionId).toBeNull()
    })

    it('should deduplicate reactions from file and localStorage', () => {
      localStorageMock.setItem('chat-reactions', JSON.stringify({
        msg1: ['heart', 'thumbsup'],
      }))

      const msgs = [
        { id: 'msg1', role: 'user' as const, text: 'hi', toolUses: [], timestamp: 1000, reactions: ['heart', 'smile'] },
      ]

      useChatStore.getState().hydrate(msgs, null)

      const reactions = useChatStore.getState().messages[0].reactions!
      // Should have unique set: heart, smile, thumbsup
      expect(new Set(reactions).size).toBe(reactions.length)
      expect(reactions).toContain('heart')
      expect(reactions).toContain('smile')
      expect(reactions).toContain('thumbsup')
    })
  })

  describe('ensureAssistantMessage', () => {
    it('should add assistant message if last is not assistant', () => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'user', text: 'hi', toolUses: [], timestamp: 1000 }],
      })

      useChatStore.getState().ensureAssistantMessage()

      const msgs = useChatStore.getState().messages
      expect(msgs).toHaveLength(2)
      expect(msgs[1].role).toBe('assistant')
      expect(msgs[1].text).toBe('')
    })

    it('should not add another assistant message if last is already assistant', () => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'assistant', text: 'hi', toolUses: [], timestamp: 1000 }],
      })

      useChatStore.getState().ensureAssistantMessage()

      expect(useChatStore.getState().messages).toHaveLength(1)
    })
  })

  describe('clearMessages', () => {
    it('should reset all state', () => {
      useChatStore.setState({
        messages: [{ id: '1', role: 'user', text: 'hi', toolUses: [], timestamp: 1000 }],
        sessionId: 'sess-1',
        isStreaming: true,
        sessionInputTokens: 100,
        sessionOutputTokens: 200,
        sessionModel: 'claude-3',
      })

      useChatStore.getState().clearMessages()

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(0)
      expect(state.sessionId).toBeNull()
      expect(state.isStreaming).toBe(false)
      expect(state.sessionInputTokens).toBe(0)
      expect(state.sessionOutputTokens).toBe(0)
      expect(state.sessionModel).toBeUndefined()
    })
  })

  describe('editMessage', () => {
    it('should update text and record edit history', () => {
      useChatStore.setState({
        messages: [{ id: 'msg1', role: 'user', text: 'original', toolUses: [], timestamp: 1000 }],
      })

      useChatStore.getState().editMessage('msg1', 'edited text')

      const msg = useChatStore.getState().messages[0]
      expect(msg.text).toBe('edited text')
      expect(msg.editHistory).toEqual(['original'])
    })
  })

  describe('addUsage', () => {
    it('should accumulate token counts', () => {
      useChatStore.getState().addUsage(100, 50, 'claude-3')
      useChatStore.getState().addUsage(200, 75)

      const state = useChatStore.getState()
      expect(state.sessionInputTokens).toBe(300)
      expect(state.sessionOutputTokens).toBe(125)
      expect(state.sessionModel).toBe('claude-3')
    })
  })

  describe('truncateAfter', () => {
    it('should remove all messages after the given id', () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'user', text: 'a', toolUses: [], timestamp: 1000 },
          { id: '2', role: 'assistant', text: 'b', toolUses: [], timestamp: 2000 },
          { id: '3', role: 'user', text: 'c', toolUses: [], timestamp: 3000 },
        ],
      })

      useChatStore.getState().truncateAfter('2')

      const msgs = useChatStore.getState().messages
      expect(msgs).toHaveLength(2)
      expect(msgs[1].id).toBe('2')
    })
  })

  describe('compressMessages', () => {
    it('should replace first N messages with a summary', () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'user', text: 'a', toolUses: [], timestamp: 1000 },
          { id: '2', role: 'assistant', text: 'b', toolUses: [], timestamp: 2000 },
          { id: '3', role: 'user', text: 'c', toolUses: [], timestamp: 3000 },
        ],
      })

      useChatStore.getState().compressMessages('Summary of conversation', 2)

      const msgs = useChatStore.getState().messages
      expect(msgs).toHaveLength(2) // summary + remaining 1
      expect(msgs[0].text).toContain('Summary of conversation')
      expect(msgs[0].role).toBe('assistant')
      expect(msgs[1].id).toBe('3')
    })
  })
})
