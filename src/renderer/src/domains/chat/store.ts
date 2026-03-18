/**
 * Chat 전역 zustand store
 * useChatStore() — App.tsx와 ChatPanel 모두 직접 구독
 */
import { create } from 'zustand'
import type { ChatMessage, ToolUseItem, PendingPermission } from './domain'

// RAF 버퍼 (싱글톤 store이므로 모듈 레벨로 관리)
let _textBuf = ''
let _rafId: number | null = null
let _thinkBuf = ''
let _thinkRafId: number | null = null

const REACTIONS_LS_KEY = 'chat-reactions'

function loadReactionsFromStorage(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(REACTIONS_LS_KEY) ?? '{}') } catch { return {} }
}
function saveReactionsToStorage(msgId: string, reactions: string[]) {
  try {
    const all = loadReactionsFromStorage()
    if (reactions.length === 0) { delete all[msgId] } else { all[msgId] = reactions }
    localStorage.setItem(REACTIONS_LS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  sessionId: string | null
  pendingPermission: PendingPermission | null
  sessionInputTokens: number
  sessionOutputTokens: number
  sessionModel: string | undefined

  setSessionId: (id: string | null) => void
  setPendingPermission: (p: PendingPermission | null) => void
  addUserMessage: (text: string) => string
  ensureAssistantMessage: () => void
  appendText: (text: string) => void
  reconcileText: (fullText: string) => void
  appendThinking: (text: string) => void
  addToolUse: (toolId: string, toolName: string, toolInput: unknown) => void
  updateToolUse: (toolId: string, output: string, isError: boolean) => void
  markLastMessageError: () => void
  finishStreaming: () => void
  addUsage: (inputTokens: number, outputTokens: number, model?: string) => void
  clearMessages: () => void
  truncateAfter: (messageId: string) => void
  deleteMessage: (messageId: string) => void
  editMessage: (messageId: string, newText: string) => void
  toggleBookmark: (messageId: string) => void
  togglePin: (messageId: string) => void
  toggleReaction: (messageId: string, emoji: string) => void
  setMessageNote: (messageId: string, note: string) => void
  saveAlternative: (messageId: string) => void
  setAltIndex: (messageId: string, index: number) => void
  compressMessages: (summary: string, compressedCount: number) => void
  hydrate: (msgs: ChatMessage[], sessionId: string | null) => void
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  isStreaming: false,
  sessionId: null,
  pendingPermission: null,
  sessionInputTokens: 0,
  sessionOutputTokens: 0,
  sessionModel: undefined,

  setSessionId: (id) => set({ sessionId: id }),
  setPendingPermission: (p) => set({ pendingPermission: p }),

  addUserMessage: (text) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      toolUses: [],
      timestamp: Date.now(),
    }
    set(s => ({ messages: [...s.messages, msg], isStreaming: true }))
    return msg.id
  },

  ensureAssistantMessage: () => {
    set(s => {
      const last = s.messages[s.messages.length - 1]
      if (last?.role === 'assistant') return s
      return {
        messages: [...s.messages, {
          id: Date.now().toString(),
          role: 'assistant' as const,
          text: '',
          toolUses: [],
          timestamp: Date.now(),
        }],
      }
    })
  },

  appendText: (text) => {
    _textBuf += text
    if (_rafId === null) {
      _rafId = requestAnimationFrame(() => {
        _rafId = null
        const buffered = _textBuf
        _textBuf = ''
        if (!buffered) return
        set(s => {
          const last = s.messages[s.messages.length - 1]
          if (!last || last.role !== 'assistant') return s
          return { messages: [...s.messages.slice(0, -1), { ...last, text: last.text + buffered }] }
        })
      })
    }
  },

  reconcileText: (fullText) => {
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null }
    _textBuf = ''
    set(s => {
      const last = s.messages[s.messages.length - 1]
      if (!last || last.role !== 'assistant') return s
      return { messages: [...s.messages.slice(0, -1), { ...last, text: fullText }] }
    })
  },

  appendThinking: (text) => {
    _thinkBuf += text
    if (_thinkRafId === null) {
      _thinkRafId = requestAnimationFrame(() => {
        _thinkRafId = null
        const buffered = _thinkBuf
        _thinkBuf = ''
        if (!buffered) return
        set(s => {
          const last = s.messages[s.messages.length - 1]
          if (!last || last.role !== 'assistant') return s
          return {
            messages: [...s.messages.slice(0, -1), {
              ...last, thinkingText: (last.thinkingText ?? '') + buffered,
            }],
          }
        })
      })
    }
  },

  addToolUse: (toolId, toolName, toolInput) => {
    set(s => {
      const last = s.messages[s.messages.length - 1]
      if (!last || last.role !== 'assistant') return s
      const tool: ToolUseItem = { id: toolId, name: toolName, input: toolInput, status: 'running' }
      return { messages: [...s.messages.slice(0, -1), { ...last, toolUses: [...last.toolUses, tool] }] }
    })
  },

  updateToolUse: (toolId, output, isError) => {
    set(s => ({
      messages: s.messages.map(msg => ({
        ...msg,
        toolUses: msg.toolUses.map(t =>
          t.id === toolId
            ? { ...t, status: (isError ? 'error' : 'done') as ToolUseItem['status'], output }
            : t
        ),
      })),
    }))
  },

  markLastMessageError: () => {
    set(s => {
      const last = s.messages[s.messages.length - 1]
      if (!last || last.role !== 'assistant') return s
      return { messages: [...s.messages.slice(0, -1), { ...last, isError: true }] }
    })
  },

  finishStreaming: () => {
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null }
    const buffered = _textBuf; _textBuf = ''
    if (_thinkRafId !== null) { cancelAnimationFrame(_thinkRafId); _thinkRafId = null }
    const thinkBuffered = _thinkBuf; _thinkBuf = ''
    set(s => {
      let msgs = s.messages
      if (buffered) {
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant') msgs = [...msgs.slice(0, -1), { ...last, text: last.text + buffered }]
      }
      if (thinkBuffered) {
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant') {
          msgs = [...msgs.slice(0, -1), { ...last, thinkingText: (last.thinkingText ?? '') + thinkBuffered }]
        }
      }
      return { messages: msgs, isStreaming: false }
    })
  },

  addUsage: (inputTokens, outputTokens, model) => {
    set(s => ({
      sessionInputTokens: s.sessionInputTokens + inputTokens,
      sessionOutputTokens: s.sessionOutputTokens + outputTokens,
      ...(model ? { sessionModel: model } : {}),
    }))
  },

  clearMessages: () => {
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null }
    _textBuf = ''
    if (_thinkRafId !== null) { cancelAnimationFrame(_thinkRafId); _thinkRafId = null }
    _thinkBuf = ''
    set({
      messages: [],
      sessionId: null,
      isStreaming: false,
      sessionInputTokens: 0,
      sessionOutputTokens: 0,
      sessionModel: undefined,
    })
  },

  truncateAfter: (messageId) => {
    set(s => {
      const idx = s.messages.findIndex(m => m.id === messageId)
      if (idx === -1) return s
      return { messages: s.messages.slice(0, idx + 1) }
    })
  },

  deleteMessage: (messageId) => set(s => ({ messages: s.messages.filter(m => m.id !== messageId) })),

  editMessage: (messageId, newText) => {
    set(s => ({
      messages: s.messages.map(m =>
        m.id !== messageId ? m : { ...m, text: newText, editHistory: [...(m.editHistory ?? []), m.text] }
      ),
    }))
  },

  toggleBookmark: (messageId) => {
    set(s => ({ messages: s.messages.map(m => m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m) }))
  },

  togglePin: (messageId) => {
    set(s => ({ messages: s.messages.map(m => m.id === messageId ? { ...m, pinned: !m.pinned } : m) }))
  },

  toggleReaction: (messageId, emoji) => {
    set(s => ({
      messages: s.messages.map(m => {
        if (m.id !== messageId) return m
        const reactions = m.reactions ?? []
        const exists = reactions.includes(emoji)
        const next = exists ? reactions.filter(r => r !== emoji) : [...reactions, emoji]
        saveReactionsToStorage(messageId, next)
        return { ...m, reactions: next }
      }),
    }))
  },

  setMessageNote: (messageId, note) => {
    set(s => ({ messages: s.messages.map(m => m.id === messageId ? { ...m, note } : m) }))
  },

  saveAlternative: (messageId) => {
    set(s => {
      const idx = s.messages.findIndex(m => m.id === messageId)
      if (idx < 0) return s
      const msg = s.messages[idx]
      if (msg.role !== 'assistant' || !msg.text) return s
      const alts = [...(msg.alternatives ?? []), msg.text]
      const updated: ChatMessage = { ...msg, alternatives: alts, text: '', altIndex: undefined }
      return { messages: [...s.messages.slice(0, idx), updated, ...s.messages.slice(idx + 1)] }
    })
  },

  setAltIndex: (messageId, index) => {
    set(s => {
      const idx = s.messages.findIndex(m => m.id === messageId)
      if (idx < 0) return s
      const msg = s.messages[idx]
      const alts = msg.alternatives ?? []
      if (index < 0 || index >= alts.length) return s
      return { messages: [...s.messages.slice(0, idx), { ...msg, altIndex: index }, ...s.messages.slice(idx + 1)] }
    })
  },

  compressMessages: (summary, compressedCount) => {
    set(s => {
      const kept = s.messages.slice(compressedCount)
      const summaryMsg: ChatMessage = {
        id: `summary-${Date.now()}`,
        role: 'assistant',
        text: `**[대화 요약]** ${summary}`,
        toolUses: [],
        timestamp: Date.now(),
      }
      return { messages: [summaryMsg, ...kept] }
    })
  },

  hydrate: (msgs, sid) => {
    const stored = loadReactionsFromStorage()
    const merged = msgs.map(m => {
      const ls = stored[m.id]
      if (!ls?.length) return m
      return { ...m, reactions: [...new Set([...(m.reactions ?? []), ...ls])] }
    })
    set({ messages: merged, sessionId: sid, isStreaming: false, pendingPermission: null })
  },
}))
