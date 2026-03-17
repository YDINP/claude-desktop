import { useState, useEffect, useRef } from 'react'
import type { ChatMessage } from '../domains/chat/domain'

interface SessionManagerDeps {
  messages: ChatMessage[]
  isStreaming: boolean
  sessionId: string | null
  currentPath: string | null
  selectedModel: string | undefined
}

export interface SessionManager {
  sessionTitle: string | undefined
  setSessionTitle: (t: string | undefined) => void
  sessionCreatedAt: number | undefined
  setSessionCreatedAt: (t: number | undefined) => void
  suggestions: string[]
  setSuggestions: (s: string[]) => void
}

export function useSessionManager(deps: SessionManagerDeps): SessionManager {
  const { messages, isStreaming, sessionId, currentPath, selectedModel } = deps

  // state
  const [sessionTitle, setSessionTitle] = useState<string | undefined>(undefined)
  const [sessionCreatedAt, setSessionCreatedAt] = useState<number | undefined>(undefined)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // refs
  const earlyTitledSessionsRef = useRef<Set<string>>(new Set())
  const prevMessageCountRef = useRef(0)
  const prevIsStreamingRef = useRef(false)
  const autoTitledSessionsRef = useRef<Set<string>>(new Set())
  const autoTaggedSessionsRef = useRef<Set<string>>(new Set())

  // ── Smart early title: generate title from first user message (non-blocking) ──
  useEffect(() => {
    const userMsgs = messages.filter(m => m.role === 'user')
    const prevCount = prevMessageCountRef.current
    prevMessageCountRef.current = messages.length
    // Trigger only when transitioning to exactly 1 user message (first send)
    if (userMsgs.length !== 1 || prevCount !== 0) return
    const sid = sessionId
    if (!sid || earlyTitledSessionsRef.current.has(sid)) return
    earlyTitledSessionsRef.current.add(sid)
    const userMessage = userMsgs[0].text
    window.api?.generateTitle({ userMessage })
      .then(title => {
        if (title && sid) {
          window.api?.sessionRename(sid, title)
            .then(() => window.dispatchEvent(new CustomEvent('session:saved')))
        }
      })
      .catch(() => { /* silent: post-streaming fallback will handle */ })
  }, [messages, sessionId])

  // ── Auto-save session ──
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current
    prevIsStreamingRef.current = isStreaming
    if (!wasStreaming && isStreaming) {
      setSuggestions([])
    }
    if (wasStreaming && !isStreaming && sessionId && currentPath && messages.length > 0) {
      const firstUser = messages.find(m => m.role === 'user')
      const title = firstUser ? firstUser.text.replace(/\n/g, ' ').slice(0, 60) : 'Untitled'

      // Auto-title: 첫 번째 응답 완료 시 Haiku API로 제목 생성
      const userMsgs = messages.filter(m => m.role === 'user')
      const assistantMsgs = messages.filter(m => m.role === 'assistant')
      if (
        userMsgs.length === 1 && assistantMsgs.length === 1 &&
        !autoTitledSessionsRef.current.has(sessionId) &&
        !earlyTitledSessionsRef.current.has(sessionId)
      ) {
        const sid = sessionId
        autoTitledSessionsRef.current.add(sid)
        const userText = userMsgs[0].text
        const assistantText = assistantMsgs[0].text
        window.api?.sessionGenerateTitle(userText, assistantText)
          .then(({ title }) => {
            if (title && sid) {
              window.api?.sessionRename(sid, title)
                .then(() => window.dispatchEvent(new CustomEvent('session:saved')))
            }
          })
          .catch(() => {
            // fallback: user 메시지 앞 30자
            const rawText = userText.replace(/\n/g, ' ').trim()
            let fallbackTitle = rawText
            if (rawText.length > 30) {
              const truncated = rawText.slice(0, 30)
              const lastSpace = truncated.lastIndexOf(' ')
              fallbackTitle = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated
            }
            if (fallbackTitle && sid) {
              window.api?.sessionRename(sid, fallbackTitle)
                .then(() => window.dispatchEvent(new CustomEvent('session:saved')))
            }
          })

        // 자동 태그 생성
        if (!autoTaggedSessionsRef.current.has(sid)) {
          autoTaggedSessionsRef.current.add(sid)
          window.api?.sessionGenerateTags(userText, assistantText)
            .then(({ tags }) => {
              if (tags.length > 0 && sid) {
                window.api?.sessionTag(sid, tags)
                  .then(() => window.dispatchEvent(new CustomEvent('session:saved')))
              }
            })
            .catch(() => { /* 태그 생성 실패 시 무시 */ })
        }
      }

      const sessionCreated = messages[0]?.timestamp ?? Date.now()
      setSessionTitle(title)
      setSessionCreatedAt(sessionCreated)
      window.api?.sessionSave({
        id: sessionId, title,
        cwd: currentPath,
        model: selectedModel,
        messages: messages,
        createdAt: sessionCreated,
        updatedAt: Date.now(),
      }).then(() => window.dispatchEvent(new CustomEvent('session:saved')))

      // Desktop notification on session complete
      if ('Notification' in window) {
        const last = messages.filter(m => m.role === 'assistant').pop()
        const preview = last?.text?.slice(0, 100)?.replace(/\n/g, ' ') ?? '응답이 완료되었습니다'
        if (Notification.permission === 'granted') {
          new window.Notification('클로드', { body: preview, silent: false })
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
              new window.Notification('클로드', { body: preview, silent: false })
            }
          })
        }
      }

      // Follow-up suggestions
      const lastAssistant = messages.filter(m => m.role === 'assistant').pop()
      const lastUser = messages.filter(m => m.role === 'user').pop()
      if (lastAssistant?.text && lastUser?.text) {
        setSuggestions([])
        window.api?.suggestFollowUps?.(lastAssistant.text, lastUser.text)
          .then(result => { setSuggestions(result ?? []) })
          .catch(() => { /* silent */ })
      }
    }
  }, [isStreaming])

  return { sessionTitle, setSessionTitle, sessionCreatedAt, setSessionCreatedAt, suggestions, setSuggestions }
}
