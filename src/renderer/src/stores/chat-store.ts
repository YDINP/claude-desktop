import { useState, useCallback, useRef } from 'react'

export interface ToolUseItem {
  id: string
  name: string
  input: unknown
  status: 'running' | 'done' | 'error'
  output?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  toolUses: ToolUseItem[]
  timestamp: number
  isError?: boolean
  bookmarked?: boolean
  pinned?: boolean
  reactions?: string[]
  note?: string
  model?: string
  editHistory?: string[]
  thinkingText?: string
  alternatives?: string[]
  altIndex?: number
}

export function useChatStore() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pendingPermission, setPendingPermission] = useState<{
    requestId: string; toolName: string; input: unknown
  } | null>(null)
  const [sessionInputTokens, setSessionInputTokens] = useState(0)
  const [sessionOutputTokens, setSessionOutputTokens] = useState(0)
  const [sessionModel, setSessionModel] = useState<string | undefined>(undefined)

  const textBufRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const thinkBufRef = useRef('')
  const thinkRafRef = useRef<number | null>(null)

  const addUserMessage = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      toolUses: [],
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, msg])
    setIsStreaming(true)
    return msg.id
  }, [])

  const ensureAssistantMessage = useCallback(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant') return prev
      return [...prev, {
        id: Date.now().toString(),
        role: 'assistant' as const,
        text: '',
        toolUses: [],
        timestamp: Date.now(),
      }]
    })
  }, [])

  const appendText = useCallback((text: string) => {
    textBufRef.current += text
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const buffered = textBufRef.current
        textBufRef.current = ''
        if (!buffered) return
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (!last || last.role !== 'assistant') return prev
          return [...prev.slice(0, -1), { ...last, text: last.text + buffered }]
        })
      })
    }
  }, [])

  const reconcileText = useCallback((fullText: string) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    textBufRef.current = ''
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [...prev.slice(0, -1), { ...last, text: fullText }]
    })
  }, [])

  const appendThinking = useCallback((text: string) => {
    thinkBufRef.current += text
    if (thinkRafRef.current === null) {
      thinkRafRef.current = requestAnimationFrame(() => {
        thinkRafRef.current = null
        const buffered = thinkBufRef.current
        thinkBufRef.current = ''
        if (!buffered) return
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (!last || last.role !== 'assistant') return prev
          return [...prev.slice(0, -1), { ...last, thinkingText: (last.thinkingText ?? '') + buffered }]
        })
      })
    }
  }, [])

  const addToolUse = useCallback((toolId: string, toolName: string, toolInput: unknown) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      const tool: ToolUseItem = { id: toolId, name: toolName, input: toolInput, status: 'running' }
      return [...prev.slice(0, -1), { ...last, toolUses: [...last.toolUses, tool] }]
    })
  }, [])

  const updateToolUse = useCallback((toolId: string, output: string, isError: boolean) => {
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        toolUses: msg.toolUses.map((t) =>
          t.id === toolId
            ? { ...t, status: (isError ? 'error' : 'done') as ToolUseItem['status'], output }
            : t
        ),
      }))
    )
  }, [])

  const markLastMessageError = useCallback(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [...prev.slice(0, -1), { ...last, isError: true }]
    })
  }, [])

  const finishStreaming = useCallback(() => {
    // Flush any buffered text before marking streaming done
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const buffered = textBufRef.current
    textBufRef.current = ''
    if (buffered) {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, text: last.text + buffered }]
      })
    }
    if (thinkRafRef.current !== null) {
      cancelAnimationFrame(thinkRafRef.current)
      thinkRafRef.current = null
    }
    const thinkBuffered = thinkBufRef.current
    thinkBufRef.current = ''
    if (thinkBuffered) {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, thinkingText: (last.thinkingText ?? '') + thinkBuffered }]
      })
    }
    setIsStreaming(false)
  }, [])
  const addUsage = useCallback((inputTokens: number, outputTokens: number, model?: string) => {
    setSessionInputTokens(prev => prev + inputTokens)
    setSessionOutputTokens(prev => prev + outputTokens)
    if (model) setSessionModel(model)
  }, [])

  const clearMessages = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    textBufRef.current = ''
    if (thinkRafRef.current !== null) {
      cancelAnimationFrame(thinkRafRef.current)
      thinkRafRef.current = null
    }
    thinkBufRef.current = ''
    setMessages([])
    setSessionId(null)
    setIsStreaming(false)
    setSessionInputTokens(0)
    setSessionOutputTokens(0)
    setSessionModel(undefined)
  }, [])
  const truncateAfter = useCallback((messageId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex(m => m.id === messageId)
      if (idx === -1) return prev
      return prev.slice(0, idx + 1)
    })
  }, [])

  const editMessage = useCallback((messageId: string, newText: string) => {
    setMessages((prev) =>
      prev.map(m => {
        if (m.id !== messageId) return m
        return {
          ...m,
          text: newText,
          editHistory: [...(m.editHistory ?? []), m.text],
        }
      })
    )
  }, [])

  const toggleBookmark = useCallback((messageId: string) => {
    setMessages(state =>
      state.map(m =>
        m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m
      )
    )
  }, [])

  const togglePin = useCallback((messageId: string) => {
    setMessages(state =>
      state.map(m =>
        m.id === messageId ? { ...m, pinned: !m.pinned } : m
      )
    )
  }, [])

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    setMessages(state =>
      state.map(m => {
        if (m.id !== messageId) return m
        const reactions = m.reactions ?? []
        const exists = reactions.includes(emoji)
        return {
          ...m,
          reactions: exists
            ? reactions.filter(r => r !== emoji)
            : [...reactions, emoji],
        }
      })
    )
  }, [])

  const setMessageNote = useCallback((messageId: string, note: string) => {
    setMessages(state =>
      state.map(m =>
        m.id === messageId ? { ...m, note } : m
      )
    )
  }, [])

  const saveAlternative = useCallback((messageId: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId)
      if (idx < 0) return prev
      const msg = prev[idx]
      if (msg.role !== 'assistant' || !msg.text) return prev
      const alts = [...(msg.alternatives ?? []), msg.text]
      return [...prev.slice(0, idx), { ...msg, alternatives: alts, text: '', altIndex: undefined }, ...prev.slice(idx + 1)]
    })
  }, [])

  const setAltIndex = useCallback((messageId: string, index: number) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId)
      if (idx < 0) return prev
      const msg = prev[idx]
      const alts = msg.alternatives ?? []
      if (index < 0 || index >= alts.length) return prev
      return [...prev.slice(0, idx), { ...msg, altIndex: index }, ...prev.slice(idx + 1)]
    })
  }, [])

  const compressMessages = useCallback((summary: string, compressedCount: number) => {
    setMessages(prev => {
      const kept = prev.slice(compressedCount)
      const summaryMsg: ChatMessage = {
        id: `summary-${Date.now()}`,
        role: 'assistant',
        text: `**[대화 요약]** ${summary}`,
        toolUses: [],
        timestamp: Date.now(),
      }
      return [summaryMsg, ...kept]
    })
  }, [])

  const hydrate = useCallback((msgs: ChatMessage[], sid: string | null) => {
    setMessages(msgs)
    setSessionId(sid)
    setIsStreaming(false)
    setPendingPermission(null)
  }, [])

  return {
    messages,
    isStreaming,
    sessionId,
    pendingPermission,
    sessionInputTokens,
    sessionOutputTokens,
    sessionModel,
    setSessionId,
    setPendingPermission,
    addUserMessage,
    ensureAssistantMessage,
    appendText,
    reconcileText,
    appendThinking,
    addToolUse,
    updateToolUse,
    markLastMessageError,
    finishStreaming,
    clearMessages,
    truncateAfter,
    editMessage,
    toggleBookmark,
    togglePin,
    toggleReaction,
    setMessageNote,
    compressMessages,
    hydrate,
    addUsage,
    saveAlternative,
    setAltIndex,
  }
}
