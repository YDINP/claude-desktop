import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionManager } from '../useSessionManager'
import type { ChatMessage } from '../../domains/chat/domain'

// ── window.api mock ────────────────────────────────────────────────────────────

const mockApi = {
  generateTitle: vi.fn().mockResolvedValue('Generated Title'),
  sessionRename: vi.fn().mockResolvedValue(undefined),
  sessionSave: vi.fn().mockResolvedValue(undefined),
  sessionGenerateTitle: vi.fn().mockResolvedValue({ title: 'Auto Title' }),
  sessionGenerateTags: vi.fn().mockResolvedValue({ tags: ['tag1', 'tag2'] }),
  sessionTag: vi.fn().mockResolvedValue(undefined),
  suggestFollowUps: vi.fn().mockResolvedValue(['Q1?', 'Q2?']),
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMsg(role: 'user' | 'assistant', text: string, ts = 1000): ChatMessage {
  return { id: Math.random().toString(), role, text, toolUses: [], timestamp: ts }
}

const BASE_DEPS = {
  messages: [] as ChatMessage[],
  isStreaming: false,
  sessionId: null as string | null,
  currentPath: null as string | null,
  selectedModel: undefined as string | undefined,
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true })
  // suppress Notification
  Object.defineProperty(window, 'Notification', {
    value: { permission: 'denied', requestPermission: vi.fn() },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSessionManager', () => {
  describe('return values', () => {
    it('returns initial state', () => {
      const { result } = renderHook(() => useSessionManager(BASE_DEPS))
      expect(result.current.sessionTitle).toBeUndefined()
      expect(result.current.sessionCreatedAt).toBeUndefined()
      expect(result.current.suggestions).toEqual([])
    })

    it('setSessionTitle / setSessionCreatedAt work', () => {
      const { result } = renderHook(() => useSessionManager(BASE_DEPS))
      act(() => result.current.setSessionTitle('Test'))
      expect(result.current.sessionTitle).toBe('Test')
      act(() => result.current.setSessionCreatedAt(12345))
      expect(result.current.sessionCreatedAt).toBe(12345)
    })

    it('setSuggestions works', () => {
      const { result } = renderHook(() => useSessionManager(BASE_DEPS))
      act(() => result.current.setSuggestions(['A', 'B']))
      expect(result.current.suggestions).toEqual(['A', 'B'])
    })
  })

  describe('auto-save on streaming → idle transition', () => {
    it('calls sessionSave when wasStreaming=true and now false, with valid sid/cwd/messages', async () => {
      const msgs = [makeMsg('user', 'Hello'), makeMsg('assistant', 'World')]
      const deps = { ...BASE_DEPS, messages: msgs, sessionId: 'sid-1', currentPath: '/some/path', isStreaming: true }
      const { result, rerender } = renderHook((p) => useSessionManager(p), { initialProps: deps })

      // transition: streaming → idle
      await act(async () => {
        rerender({ ...deps, isStreaming: false })
      })

      expect(mockApi.sessionSave).toHaveBeenCalledOnce()
      const saveArg = mockApi.sessionSave.mock.calls[0][0]
      expect(saveArg.id).toBe('sid-1')
      expect(saveArg.cwd).toBe('/some/path')
      expect(saveArg.messages).toEqual(msgs)
    })

    it('does NOT call sessionSave when sessionId is null', async () => {
      const msgs = [makeMsg('user', 'Hello'), makeMsg('assistant', 'World')]
      const deps = { ...BASE_DEPS, messages: msgs, sessionId: null, currentPath: '/p', isStreaming: true }
      const { rerender } = renderHook((p) => useSessionManager(p), { initialProps: deps })

      await act(async () => { rerender({ ...deps, isStreaming: false }) })

      expect(mockApi.sessionSave).not.toHaveBeenCalled()
    })

    it('does NOT call sessionSave when currentPath is null', async () => {
      const msgs = [makeMsg('user', 'Hello'), makeMsg('assistant', 'World')]
      const deps = { ...BASE_DEPS, messages: msgs, sessionId: 'sid-2', currentPath: null, isStreaming: true }
      const { rerender } = renderHook((p) => useSessionManager(p), { initialProps: deps })

      await act(async () => { rerender({ ...deps, isStreaming: false }) })

      expect(mockApi.sessionSave).not.toHaveBeenCalled()
    })

    it('does NOT call sessionSave when messages is empty', async () => {
      const deps = { ...BASE_DEPS, messages: [], sessionId: 'sid-3', currentPath: '/p', isStreaming: true }
      const { rerender } = renderHook((p) => useSessionManager(p), { initialProps: deps })

      await act(async () => { rerender({ ...deps, isStreaming: false }) })

      expect(mockApi.sessionSave).not.toHaveBeenCalled()
    })
  })

  describe('latestRef pattern — stale closure avoidance', () => {
    it('uses most recent messages/sessionId in save, even though effect dep is only isStreaming', async () => {
      // Start streaming with empty messages
      const initial = { ...BASE_DEPS, messages: [] as ChatMessage[], sessionId: null, currentPath: '/p', isStreaming: true }
      const { rerender } = renderHook((p) => useSessionManager(p), { initialProps: initial })

      // Update messages/sessionId mid-stream (without toggling isStreaming)
      const updatedMsgs = [makeMsg('user', 'Query'), makeMsg('assistant', 'Answer')]
      await act(async () => {
        rerender({ ...initial, messages: updatedMsgs, sessionId: 'sid-latest', isStreaming: true })
      })

      // Now stop streaming — effect reads from latestRef, not stale closure
      await act(async () => {
        rerender({ ...initial, messages: updatedMsgs, sessionId: 'sid-latest', isStreaming: false })
      })

      expect(mockApi.sessionSave).toHaveBeenCalledOnce()
      expect(mockApi.sessionSave.mock.calls[0][0].id).toBe('sid-latest')
      expect(mockApi.sessionSave.mock.calls[0][0].messages).toEqual(updatedMsgs)
    })
  })

  describe('auto-title on first response complete', () => {
    // Note: earlyTitledSessionsRef blocks sessionGenerateTitle for sessions
    // where generateTitle (early-title) was already called.
    // Early-title fires ONLY when prevCount===0 AND userMsgs.length===1.
    // To bypass it: start with 1 assistant message (prevCount→1), then add user+assistant.
    it('calls sessionGenerateTitle when 1 user + 1 assistant message on streaming end', async () => {
      // Initial render: 1 assistant message so prevMessageCountRef becomes 1
      const assistant0 = makeMsg('assistant', 'placeholder')
      const base = { ...BASE_DEPS, sessionId: 'sid-t2', currentPath: '/p', isStreaming: true, messages: [assistant0] }
      const { rerender } = renderHook((p) => useSessionManager(p), { initialProps: base })

      // Replace with 1 user + 1 assistant (prevCount=1 → early-title skipped)
      const msgs = [makeMsg('user', 'First question'), makeMsg('assistant', 'First answer')]
      await act(async () => { rerender({ ...base, messages: msgs }) })

      // Stop streaming
      await act(async () => { rerender({ ...base, messages: msgs, isStreaming: false }) })

      expect(mockApi.sessionGenerateTitle).toHaveBeenCalledWith('First question', 'First answer')
    })

    it('does NOT call sessionGenerateTitle again for subsequent messages', async () => {
      const assistant0 = makeMsg('assistant', 'placeholder')
      const base = { ...BASE_DEPS, sessionId: 'sid-dup2', currentPath: '/p', isStreaming: true, messages: [assistant0] }
      const { rerender } = renderHook((p) => useSessionManager(p), { initialProps: base })

      const msgs1 = [makeMsg('user', 'Q1'), makeMsg('assistant', 'A1')]
      await act(async () => { rerender({ ...base, messages: msgs1 }) })
      await act(async () => { rerender({ ...base, messages: msgs1, isStreaming: false }) })
      expect(mockApi.sessionGenerateTitle).toHaveBeenCalledOnce()

      // Second round — autoTitledSessionsRef already has the sid
      const msgs2 = [...msgs1, makeMsg('user', 'Q2'), makeMsg('assistant', 'A2')]
      await act(async () => { rerender({ ...base, messages: msgs2, isStreaming: true }) })
      await act(async () => { rerender({ ...base, messages: msgs2, isStreaming: false }) })

      expect(mockApi.sessionGenerateTitle).toHaveBeenCalledOnce()
    })
  })

  describe('suggestions cleared on streaming start', () => {
    it('clears suggestions when isStreaming transitions to true', async () => {
      const msgs = [makeMsg('user', 'Q'), makeMsg('assistant', 'A')]
      const deps = { ...BASE_DEPS, messages: msgs, sessionId: 'sid-s', currentPath: '/p', isStreaming: true }
      const { result, rerender } = renderHook((p) => useSessionManager(p), { initialProps: deps })

      // pre-populate suggestions manually
      act(() => result.current.setSuggestions(['old suggestion']))

      // transition: idle → streaming
      await act(async () => { rerender({ ...deps, isStreaming: false }) })
      // streaming again
      await act(async () => { rerender({ ...deps, isStreaming: true }) })

      expect(result.current.suggestions).toEqual([])
    })
  })

  describe('title generation from first user message', () => {
    it('derives title from first user message text (≤60 chars)', async () => {
      const msgs = [makeMsg('user', 'Short title'), makeMsg('assistant', 'Reply')]
      const deps = { ...BASE_DEPS, messages: msgs, sessionId: 'sid-ti', currentPath: '/p', isStreaming: true }
      const { result, rerender } = renderHook((p) => useSessionManager(p), { initialProps: deps })

      await act(async () => { rerender({ ...deps, isStreaming: false }) })

      // sessionTitle is set from first user message before API title resolves
      expect(result.current.sessionTitle).toBe('Short title')
    })

    it('truncates title to 60 chars from user message', async () => {
      const longText = 'A'.repeat(80)
      const msgs = [makeMsg('user', longText), makeMsg('assistant', 'Reply')]
      const deps = { ...BASE_DEPS, messages: msgs, sessionId: 'sid-long', currentPath: '/p', isStreaming: true }
      const { result, rerender } = renderHook((p) => useSessionManager(p), { initialProps: deps })

      await act(async () => { rerender({ ...deps, isStreaming: false }) })

      expect(result.current.sessionTitle!.length).toBe(60)
    })
  })

  describe('early title (first user message send)', () => {
    it('calls generateTitle with first user message text', async () => {
      const msgs = [makeMsg('user', 'Early message')]
      const deps = { ...BASE_DEPS, messages: msgs, sessionId: 'sid-early', isStreaming: false }
      renderHook(() => useSessionManager(deps))

      await act(async () => {})

      expect(mockApi.generateTitle).toHaveBeenCalledWith({ userMessage: 'Early message' })
    })

    it('does NOT call generateTitle again when more messages added', async () => {
      const msgs1 = [makeMsg('user', 'First')]
      const deps = { ...BASE_DEPS, messages: msgs1, sessionId: 'sid-once', isStreaming: false }
      const { rerender } = renderHook((p) => useSessionManager(p), { initialProps: deps })

      await act(async () => {})
      expect(mockApi.generateTitle).toHaveBeenCalledOnce()

      const msgs2 = [...msgs1, makeMsg('assistant', 'Answer'), makeMsg('user', 'Second')]
      await act(async () => { rerender({ ...deps, messages: msgs2 }) })

      expect(mockApi.generateTitle).toHaveBeenCalledOnce()
    })

    it('does NOT call generateTitle when no sessionId', async () => {
      const msgs = [makeMsg('user', 'Hello')]
      const deps = { ...BASE_DEPS, messages: msgs, sessionId: null, isStreaming: false }
      renderHook(() => useSessionManager(deps))

      await act(async () => {})

      expect(mockApi.generateTitle).not.toHaveBeenCalled()
    })
  })
})
