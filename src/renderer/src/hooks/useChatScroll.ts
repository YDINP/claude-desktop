import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChatMessage } from '../domains/chat/domain'

interface UseChatScrollOptions {
  sessionId: string | null | undefined
  messages: ChatMessage[]
  messageCount: number
  isStreaming: boolean
  scrollToMessageId?: string | null
  scrollContainerRef: React.RefObject<HTMLDivElement>
  /** virtualizer.scrollToIndex 래퍼 — ChatPanel에서 주입 */
  scrollToIndex: (idx: number, opts?: { align?: string; behavior?: string }) => void
  onAfterStreamEnd?: () => void
}

interface UseChatScrollReturn {
  showScrollBtn: boolean
  showTopBtn: boolean
  minimapScroll: { scrollTop: number; clientHeight: number; totalScrollHeight: number }
  scrollContainerHeight: number
  isAtBottomRef: React.MutableRefObject<boolean>
  handleScroll: () => void
  scrollToBottom: () => void
}

export function useChatScroll({
  sessionId,
  messages,
  messageCount,
  isStreaming,
  scrollToMessageId,
  scrollContainerRef,
  scrollToIndex,
  onAfterStreamEnd,
}: UseChatScrollOptions): UseChatScrollReturn {
  const isAtBottomRef = useRef(true)
  const scrollPositions = useRef<Record<string, number>>({})
  const prevSessionIdRef = useRef<string | null | undefined>(sessionId)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showTopBtn, setShowTopBtn] = useState(false)
  const [minimapScroll, setMinimapScroll] = useState({ scrollTop: 0, clientHeight: 1, totalScrollHeight: 1 })
  const [scrollContainerHeight, setScrollContainerHeight] = useState(0)

  // 스크롤 컨테이너 높이 추적 (bottom-anchor paddingStart 계산용)
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    setScrollContainerHeight(el.clientHeight)
    const obs = new ResizeObserver(([entry]) => {
      setScrollContainerHeight(entry.contentRect.height)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 세션 전환 시 스크롤 위치 저장/복원
  useEffect(() => {
    const prevId = prevSessionIdRef.current
    const nextId = sessionId
    if (prevId === nextId) return

    if (prevId) {
      const el = scrollContainerRef.current
      if (el) scrollPositions.current[prevId] = el.scrollTop
    }

    const savedPos = nextId ? scrollPositions.current[nextId] : undefined
    if (savedPos !== undefined) {
      requestAnimationFrame(() => {
        const el = scrollContainerRef.current
        if (el) el.scrollTop = savedPos
      })
    } else {
      isAtBottomRef.current = true
    }

    prevSessionIdRef.current = nextId
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll: when near bottom, scroll to last item
  useEffect(() => {
    if (isAtBottomRef.current && messageCount > 0) {
      scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
    }
  }, [messages, messageCount, scrollToIndex])

  // Always scroll to bottom when user sends a message
  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    if (messageCount > prevMsgCountRef.current) {
      const last = messages[messageCount - 1]
      if (last?.role === 'user') {
        isAtBottomRef.current = true
        requestAnimationFrame(() => {
          scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
        })
      }
    }
    prevMsgCountRef.current = messageCount
  }, [messages, messageCount, scrollToIndex])

  // Scroll to bottom when streaming finishes + callback for CC actions
  const prevStreamingRef = useRef(isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && messageCount > 0) {
      if (isAtBottomRef.current) {
        scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
      }
      onAfterStreamEnd?.()
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, messageCount, scrollToIndex, onAfterStreamEnd])

  // Scroll to a specific message when requested from sidebar
  useEffect(() => {
    if (!scrollToMessageId) return
    const idx = messages.findIndex(m => m.id === scrollToMessageId)
    if (idx !== -1) {
      scrollToIndex(idx, { align: 'center', behavior: 'smooth' })
    }
  }, [scrollToMessageId]) // eslint-disable-line react-hooks/exhaustive-deps

  const scrollStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottomRef.current = dist < 100
    if (scrollStateTimerRef.current) clearTimeout(scrollStateTimerRef.current)
    scrollStateTimerRef.current = setTimeout(() => {
      setShowScrollBtn(dist > 150)
      setShowTopBtn(el.scrollTop > 500)
      setMinimapScroll({
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
        totalScrollHeight: el.scrollHeight - el.clientHeight,
      })
    }, 50)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = useCallback(() => {
    if (messageCount > 0) {
      isAtBottomRef.current = true
      setShowScrollBtn(false)
      scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
    }
  }, [messageCount, scrollToIndex])

  return {
    showScrollBtn,
    showTopBtn,
    minimapScroll,
    scrollContainerHeight,
    isAtBottomRef,
    handleScroll,
    scrollToBottom,
  }
}
