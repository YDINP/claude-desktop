import { useEffect, useRef, useState, useCallback, memo, useMemo, useTransition, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import type { useChatStore } from '../../stores/chat-store'
import type { useProject } from '../../stores/project-store'
import type { ChatMessage } from '../../stores/chat-store'
import { getActiveTerminalId } from '../../stores/terminal-store'
import { WelcomeScreen } from '../shared/WelcomeScreen'
import { useCCContext } from '../../hooks/useCCContext'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useContextFiles } from '../../hooks/useContextFiles'
import { parseCCActions, executeCCActions } from '../../utils/cc-action-parser'

function ExportConversationButton({ messages }: { messages: ChatMessage[] }) {
  if (!messages.length) return null
  const handleExport = async () => {
    const md = messages.map(m => `## ${m.role === 'user' ? 'You' : 'Claude'}\n\n${m.text}`).join('\n\n---\n\n')
    const title = messages.find(m => m.role === 'user')?.text.slice(0, 30).replace(/[^\w\s가-힣]/g, '').trim() ?? 'conversation'
    await window.api.saveFile(md, `${title}.md`)
  }
  return (
    <button onClick={handleExport} title="대화를 파일로 저장" style={{
      background: 'none', border: 'none', color: 'var(--text-muted)',
      fontSize: 11, cursor: 'pointer', padding: '2px 6px',
    }}>
      💾 내보내기
    </button>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function generateChatHtml(messages: ChatMessage[], sessionName?: string): string {
  const rows = messages.map(m => `
    <div class="message ${m.role}">
      <div class="meta">${m.role === 'user' ? 'You' : 'Claude'}${m.timestamp ? ' · ' + new Date(m.timestamp).toLocaleString('ko-KR') : ''}</div>
      <div class="text">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div>
    </div>`).join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(sessionName ?? 'Chat Export')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; background: #1e1e2e; color: #cdd6f4; padding: 0 20px; }
  h1 { color: #89b4fa; font-size: 18px; margin-bottom: 24px; }
  .message { padding: 16px; border-bottom: 1px solid #313244; }
  .message.user { background: #262637; border-radius: 6px; margin: 8px 0; }
  .meta { font-size: 11px; font-weight: 600; color: #89b4fa; text-transform: uppercase; margin-bottom: 8px; }
  .message.assistant .meta { color: #a6e3a1; }
  .text { font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
<h1>${escapeHtml(sessionName ?? 'Chat Export')}</h1>
${rows}
</body>
</html>`
}

function ExportHtmlButton({ messages, sessionName }: { messages: ChatMessage[]; sessionName?: string }) {
  if (!messages.length) return null
  const handleExport = async () => {
    const filePath = await window.api.showSaveDialog({
      defaultPath: `${sessionName ?? 'chat'}.html`,
      filters: [{ name: 'HTML Files', extensions: ['html'] }],
    })
    if (!filePath) return
    const html = generateChatHtml(messages, sessionName)
    await window.api.exportHtml(filePath, html)
  }
  return (
    <button onClick={handleExport} title="HTML로 내보내기" style={{
      background: 'none', border: 'none', color: 'var(--text-muted)',
      cursor: 'pointer', fontSize: 12, padding: '2px 6px',
    }}>
      ⬇ HTML
    </button>
  )
}

function ExportPdfButton({ messages, sessionId }: { messages: ChatMessage[]; sessionId: string | null }) {
  const [exporting, setExporting] = useState(false)
  if (!messages.length || !sessionId) return null
  const handleExport = async () => {
    setExporting(true)
    try {
      await window.api.sessionExportPdf(sessionId)
    } finally {
      setExporting(false)
    }
  }
  return (
    <button onClick={handleExport} disabled={exporting} title="PDF로 내보내기" style={{
      background: 'none', border: 'none', color: exporting ? 'var(--text-muted)' : 'var(--text-muted)',
      cursor: exporting ? 'default' : 'pointer', fontSize: 12, padding: '2px 6px',
    }}>
      {exporting ? '...' : '⬇ PDF'}
    </button>
  )
}

function CopyConversationButton({ messages }: { messages: ChatMessage[] }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    if (!messages.length) return
    const md = messages.map(m => `**${m.role === 'user' ? 'You' : 'Claude'}**\n\n${m.text}`).join('\n\n---\n\n')
    navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [messages])
  if (!messages.length) return null
  return (
    <button
      onClick={copy}
      title="대화 전체 복사 (Markdown)"
      style={{
        background: 'none', border: 'none',
        color: copied ? 'var(--success)' : 'var(--text-muted)',
        fontSize: 11, cursor: 'pointer', padding: '2px 6px',
        marginRight: 'auto',
      }}
    >
      {copied ? '✓ 복사됨' : '📋 대화 복사'}
    </button>
  )
}

interface ChatPanelProps {
  chat: ReturnType<typeof useChatStore>
  project: ReturnType<typeof useProject>
  focusTrigger?: number
  onImageClick?: (src: string, alt?: string) => void
  searchTrigger?: number
  scrollToMessageId?: string | null
  onFork?: (messageIndex: number) => void
  onEditResend?: (messageId: string, newText: string) => void
  onOpenFile?: (path: string) => void
  onCompressContext?: () => void
  pendingInsert?: string
  onPendingInsertConsumed?: () => void
  onTogglePin?: (id: string) => void
  onReplyToMessage?: (text: string) => void
  suggestions?: string[]
  onDismissSuggestions?: () => void
  recentSessions?: Array<{ id: string; title: string }>
  onSelectSession?: (id: string) => void
  hqMode?: boolean
  onToggleHQ?: () => void
}

const CONTEXT_WINDOW = 200000

type MsgPosition = 'solo' | 'first' | 'middle' | 'last'

function getMsgPosition(messages: ChatMessage[], index: number): MsgPosition {
  const msg = messages[index]
  const prev = messages[index - 1]
  const next = messages[index + 1]

  const sameRoleAsPrev = prev && prev.role === msg.role &&
    Math.abs((msg.timestamp ?? 0) - (prev.timestamp ?? 0)) < 2 * 60 * 1000
  const sameRoleAsNext = next && next.role === msg.role &&
    Math.abs((next.timestamp ?? 0) - (msg.timestamp ?? 0)) < 2 * 60 * 1000

  if (!sameRoleAsPrev && !sameRoleAsNext) return 'solo'
  if (!sameRoleAsPrev && sameRoleAsNext) return 'first'
  if (sameRoleAsPrev && sameRoleAsNext) return 'middle'
  return 'last'
}

const ACTION_PROMPTS = {
  explain: (lang: string, code: string) => `다음 ${lang} 코드를 단계별로 설명해줘:\n\`\`\`${lang}\n${code}\n\`\`\``,
  optimize: (lang: string, code: string) => `다음 ${lang} 코드의 성능을 최적화해줘. 변경 이유를 설명해줘:\n\`\`\`${lang}\n${code}\n\`\`\``,
  fix: (lang: string, code: string) => `다음 ${lang} 코드의 버그를 찾아 수정해줘:\n\`\`\`${lang}\n${code}\n\`\`\``,
}

function ContextUsageIndicator({ messages }: { messages: ChatMessage[] }) {
  if (!messages.length) return null
  const totalChars = messages.reduce((sum, m) => sum + m.text.length, 0)
  const estimatedTokens = Math.round(totalChars / 4)
  const ratio = estimatedTokens / CONTEXT_WINDOW
  if (ratio < 0.8) return null
  const nK = Math.round(estimatedTokens / 1000)
  const isError = ratio >= 0.95
  return (
    <span style={{
      fontSize: 11,
      color: isError ? 'var(--error, #f87171)' : 'var(--warning, #fbbf24)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {isError ? '🔴' : '⚠'} ~{nK}K tokens
    </span>
  )
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const StreamingSpinner = memo(function StreamingSpinner() {
  const [frameIdx, setFrameIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrameIdx(i => (i + 1) % SPINNER_FRAMES.length), 100)
    return () => clearInterval(id)
  }, [])
  return <span style={{ fontSize: 13, color: 'var(--warning)', marginLeft: 'auto', fontFamily: 'monospace' }}>{SPINNER_FRAMES[frameIdx]}</span>
})

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span /><span /><span />
    </div>
  )
}

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

const formatTimeSep = (ts: number) => {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `오늘 ${timeStr}`
  if (d.toDateString() === yesterday.toDateString()) return `어제 ${timeStr}`
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) + ' ' + timeStr
}

interface MiniMapProps {
  messages: ChatMessage[]
  scrollTop: number
  clientHeight: number
  totalScrollHeight: number
  blockHeights: number[]
  totalRaw: number
  minimapRef: RefObject<HTMLDivElement>
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
}

const MiniMap = memo(function MiniMap({ messages, scrollTop, clientHeight, totalScrollHeight, blockHeights, totalRaw, minimapRef, onClick }: MiniMapProps) {
  return (
    <div
      ref={minimapRef}
      onClick={onClick}
      style={{
        width: 40,
        flexShrink: 0,
        background: 'rgba(0,0,0,0.3)',
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {(() => {
        const containerH = minimapRef.current?.clientHeight ?? 300
        const scale = totalRaw > containerH ? containerH / totalRaw : 1
        let offsetY = 0
        const blocks = messages.map((msg, i) => {
          const h = blockHeights[i] * scale
          const y = offsetY
          offsetY += h + scale
          return (
            <div
              key={msg.id}
              style={{
                position: 'absolute',
                top: y,
                left: 4,
                right: 4,
                height: Math.max(2, h),
                background: msg.role === 'user' ? '#4a90e2' : '#666',
                borderRadius: 1,
              }}
            />
          )
        })

        const totalScrollH = Math.max(totalScrollHeight, 1)
        const vpTop = (scrollTop / totalScrollH) * containerH
        const vpHeight = Math.max(10, (clientHeight / (totalScrollH + clientHeight)) * containerH)
        const viewport = (
          <div
            key="viewport"
            style={{
              position: 'absolute',
              top: vpTop,
              left: 0,
              right: 0,
              height: vpHeight,
              background: 'rgba(137,180,250,0.15)',
              border: '1px solid rgba(137,180,250,0.4)',
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
        )

        return <>{blocks}{viewport}</>
      })()}
    </div>
  )
})

export function ChatPanel({ chat, project, focusTrigger, searchTrigger, scrollToMessageId, onFork, onEditResend, onOpenFile, onImageClick, onCompressContext, pendingInsert, onPendingInsertConsumed, onTogglePin, onReplyToMessage, suggestions, onDismissSuggestions, recentSessions, onSelectSession, hqMode, onToggleHQ }: ChatPanelProps) {
  const ccCtx = useCCContext()
  const projectSummary = useProjectContext(project.currentPath ?? null)
  const ctxFiles = useContextFiles(project.currentPath ?? null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showTopBtn, setShowTopBtn] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(true)
  const [customSystemPrompt, setCustomSystemPromptRaw] = useState(() => {
    try { return localStorage.getItem('custom-system-prompt') ?? '' } catch { return '' }
  })
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const customSystemPromptDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setCustomSystemPrompt = useCallback((value: string) => {
    setCustomSystemPromptRaw(value)
    if (customSystemPromptDebounceRef.current) clearTimeout(customSystemPromptDebounceRef.current)
    customSystemPromptDebounceRef.current = setTimeout(() => {
      try { localStorage.setItem('custom-system-prompt', value) } catch { /* ignore */ }
    }, 500)
  }, [])
  const [showMinimap, setShowMinimap] = useState(false)
  const [showCtxFiles, setShowCtxFiles] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [welcomePendingInsert, setWelcomePendingInsert] = useState<string | undefined>(undefined)
  const [minimapScroll, setMinimapScroll] = useState({ scrollTop: 0, clientHeight: 1, totalScrollHeight: 1 })

  const handleWelcomeSelectPrompt = useCallback((prompt: string) => {
    setWelcomePendingInsert(prompt)
  }, [])

  // Elapsed time during streaming
  const [streamingSeconds, setStreamingSeconds] = useState(0)

  // Token rate during streaming
  const [tokenRate, setTokenRate] = useState(0)
  const lastTokenCountRef = useRef(0)
  const streamingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Consolidated streaming timer: updates elapsed seconds + token rate in one interval
  useEffect(() => {
    if (chat.isStreaming) {
      setStreamingSeconds(0)
      lastTokenCountRef.current = chat.messages[chat.messages.length - 1]?.text.length ?? 0
      streamingTimerRef.current = setInterval(() => {
        setStreamingSeconds(s => s + 1)
        const currentLen = chat.messages[chat.messages.length - 1]?.text.length ?? 0
        const charsPerSec = currentLen - lastTokenCountRef.current
        setTokenRate(Math.round(charsPerSec / 4))
        lastTokenCountRef.current = currentLen
      }, 1000)
    } else {
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current)
        streamingTimerRef.current = null
      }
      setTokenRate(0)
    }
    return () => {
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current)
        streamingTimerRef.current = null
      }
    }
  }, [chat.isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIdx, setMatchIdx] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isSearchPending, startSearchTransition] = useTransition()

  const handleSearchChange = useCallback((value: string) => {
    startSearchTransition(() => {
      setSearchQuery(value)
      setMatchIdx(0)
    })
  }, [])

  const displayMessages = useMemo(
    () => showOnlyBookmarks ? chat.messages.filter(m => m.bookmarked) : chat.messages,
    [chat.messages, showOnlyBookmarks]
  )

  const messageCount = displayMessages.length

  // searchTrigger prop 변화 시 검색창 열기 (App.tsx에서 Ctrl+F 시 증가)
  useEffect(() => {
    if (searchTrigger === undefined || searchTrigger === 0) return
    setShowSearch(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [searchTrigger])

  // 검색창 열릴 때 input focus
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
      setMatchIdx(0)
    }
  }, [showSearch])

  // 매치된 메시지 인덱스 목록
  // chat.messages 전체 대신 [searchQuery, messageCount] 의존 — 스트리밍 중 내용 변경만으로는 재계산 안 함
  const matchedIndices = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    const indices: number[] = []
    chat.messages.forEach((m, i) => {
      if (m.text.toLowerCase().includes(q)) indices.push(i)
    })
    return indices
  }, [searchQuery, messageCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const matchCount = matchedIndices.length

  // matchIdx가 범위 초과하지 않도록 보정
  const safeMatchIdx = matchCount > 0 ? Math.min(matchIdx, matchCount - 1) : 0

  const matchedMessageIds = useMemo(
    () => new Set(matchedIndices.map(i => chat.messages[i]?.id ?? '')),
    [matchedIndices] // eslint-disable-line react-hooks/exhaustive-deps
    // chat.messages 전체 제외: matchedIndices는 searchQuery+messages.length 기반으로 갱신되므로
    // 스트리밍 중 메시지 내용만 바뀌는 경우에는 재계산 불필요
  )

  const currentMatchId = matchCount > 0 ? (chat.messages[matchedIndices[safeMatchIdx]]?.id ?? null) : null

  // 매치 이동 시 가상 스크롤 점프
  useEffect(() => {
    if (matchCount > 0 && matchedIndices[safeMatchIdx] !== undefined) {
      virtualizer.scrollToIndex(matchedIndices[safeMatchIdx], { align: 'center', behavior: 'smooth' })
    }
  }, [safeMatchIdx, matchedIndices, matchCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchPrev = useCallback(() => {
    setMatchIdx(i => (i - 1 + matchCount) % matchCount)
  }, [matchCount])

  const handleSearchNext = useCallback(() => {
    setMatchIdx(i => (i + 1) % matchCount)
  }, [matchCount])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.shiftKey ? handleSearchPrev() : handleSearchNext()
    } else if (e.key === 'Escape') {
      setShowSearch(false)
    }
  }, [handleSearchPrev, handleSearchNext])

  const virtualizer = useVirtualizer({
    count: displayMessages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 250,
    overscan: 5,
  })

  // Auto-scroll: when near bottom, scroll to last item
  useEffect(() => {
    if (isAtBottomRef.current && messageCount > 0) {
      virtualizer.scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
    }
  }, [chat.messages, messageCount, virtualizer])

  // Always scroll to bottom when user sends a message
  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    if (messageCount > prevMsgCountRef.current) {
      const last = chat.messages[messageCount - 1]
      if (last?.role === 'user') {
        isAtBottomRef.current = true
        // Use requestAnimationFrame to ensure virtualizer has updated
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
        })
      }
    }
    prevMsgCountRef.current = messageCount
  }, [chat.messages, messageCount, virtualizer])

  // Scroll to bottom when streaming finishes + CC action execution
  const prevStreamingRef = useRef(chat.isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current && !chat.isStreaming && messageCount > 0) {
      if (isAtBottomRef.current) {
        virtualizer.scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
      }
      // CC 액션 자동 실행
      if (ccCtx.connected) {
        const lastMsg = chat.messages[messageCount - 1]
        if (lastMsg?.role === 'assistant' && lastMsg.text) {
          const actions = parseCCActions(lastMsg.text)
          if (actions.length > 0) {
            executeCCActions(actions, ccCtx.port).catch(() => {})
          }
        }
      }
    }
    prevStreamingRef.current = chat.isStreaming
  }, [chat.isStreaming, messageCount, virtualizer, ccCtx.connected, chat.messages])

  const bookmarkIdxRef = useRef(0)
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false)

  const jumpToBookmark = useCallback(() => {
    const bookmarked = chat.messages
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.bookmarked)
    if (!bookmarked.length) return
    bookmarkIdxRef.current = bookmarkIdxRef.current % bookmarked.length
    const targetIdx = bookmarked[bookmarkIdxRef.current].i
    bookmarkIdxRef.current++
    virtualizer.scrollToIndex(targetIdx, { align: 'center', behavior: 'smooth' })
  }, [chat.messages, virtualizer])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottomRef.current = dist < 100
    setShowScrollBtn(dist > 150)
    setShowTopBtn(el.scrollTop > 500)
    setMinimapScroll({
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      totalScrollHeight: el.scrollHeight - el.clientHeight,
    })
  }, [])

  const scrollToBottom = useCallback(() => {
    if (messageCount > 0) {
      isAtBottomRef.current = true
      setShowScrollBtn(false)
      virtualizer.scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
    }
  }, [messageCount, virtualizer])

  const autoSetTitle = useCallback(async (userText: string) => {
    if (!chat.sessionId) return
    const userMsgCount = chat.messages.filter(m => m.role === 'user').length
    if (userMsgCount > 0) return
    const newTitle = userText.slice(0, 50).replace(/\n/g, ' ')
    try {
      await window.api.sessionRename?.(chat.sessionId, newTitle)
    } catch {
      // 조용히 실패
    }
  }, [chat.sessionId, chat.messages])

  const resolveVars = (prompt: string): string => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return prompt
      .replace(/\{\{date\}\}/g, `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`)
      .replace(/\{\{time\}\}/g, `${pad(now.getHours())}:${pad(now.getMinutes())}`)
      .replace(/\{\{project\}\}/g, project.currentPath?.split(/[/\\]/).pop() ?? '')
      .replace(/\{\{model\}\}/g, project.selectedModel)
      .replace(/\{\{day\}\}/g, ['일','월','화','수','목','금','토'][now.getDay()])
  }

  const handleSend = useCallback((text: string) => {
    if (!project.currentPath) return
    const model = project.selectedModel
    const prevMessages = chat.messages
    autoSetTitle(text)
    chat.addUserMessage(text)
    if (model.startsWith('ollama:')) {
      const ollamaModel = model.replace('ollama:', '')
      const history = prevMessages
        .filter(m => m.text.trim())
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      history.push({ role: 'user', content: text })
      window.api.ollamaSend?.({ model: ollamaModel, messages: history })
    } else if (model.startsWith('openai:')) {
      const openaiModel = model.replace('openai:', '')
      const history = chat.messages.map((m) => ({
        role: m.role,
        content: m.text ?? '',
      }))
      history.push({ role: 'user', content: text })
      window.api.openaiSend?.({ model: openaiModel, messages: history })
    } else {
      const resolvedSystemPrompt = customSystemPrompt ? resolveVars(customSystemPrompt) : ''
      const parts = [resolvedSystemPrompt, projectSummary, ccCtx.contextString, ctxFiles.contextString].filter(Boolean)
      const extraSystemPrompt = parts.length > 0 ? parts.join('\n\n') : undefined
      window.api.claudeSend({
        text,
        cwd: project.currentPath,
        model,
        ...(extraSystemPrompt ? { extraSystemPrompt } : {}),
      })
    }
  }, [project.currentPath, project.selectedModel, chat.addUserMessage, chat.messages, ccCtx.contextString, projectSummary, customSystemPrompt, ctxFiles.contextString, autoSetTitle])

  const PAUSE_STATE_KEY = 'claude:pause-state'
  const [isPaused, setIsPaused] = useState(() => {
    try { return !!localStorage.getItem(PAUSE_STATE_KEY) } catch { return false }
  })
  const [pausedTask, setPausedTask] = useState<string | null>(() => {
    try {
      const s = localStorage.getItem(PAUSE_STATE_KEY)
      return s ? JSON.parse(s).taskTitle : null
    } catch { return null }
  })

  const handleInterrupt = useCallback(() => {
    setIsPaused(false)
    setPausedTask(null)
    localStorage.removeItem(PAUSE_STATE_KEY)
    if (project.selectedModel.startsWith('ollama:')) {
      window.api.ollamaInterrupt?.()
    } else if (project.selectedModel.startsWith('openai:')) {
      window.api.openaiInterrupt?.()
    } else {
      window.api.claudeInterrupt()
    }
    chat.finishStreaming()
  }, [chat.finishStreaming, project.selectedModel])

  const handlePause = useCallback(() => {
    window.api.claudeInterrupt()
    chat.finishStreaming()

    const msgs = chat.messages
    const lastUser = [...msgs].reverse().find(m => m.role === 'user')
    const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
    const taskTitle = lastUser?.text?.slice(0, 120) ?? '(작업 내용 없음)'
    const progressSnippet = lastAssistant?.text?.slice(-200) ?? ''

    const state = {
      sessionId: chat.sessionId,
      cwd: project.currentPath,
      taskTitle,
      progressSnippet,
      timestamp: Date.now(),
    }
    localStorage.setItem(PAUSE_STATE_KEY, JSON.stringify(state))
    setIsPaused(true)
    setPausedTask(taskTitle)
  }, [chat.messages, chat.sessionId, chat.finishStreaming, project.currentPath])

  const handleResume = useCallback(() => {
    try {
      const raw = localStorage.getItem(PAUSE_STATE_KEY)
      if (!raw || !project.currentPath) return
      const state = JSON.parse(raw) as { taskTitle: string; progressSnippet: string; cwd?: string }
      const resumePrompt = `이전에 하던 작업을 이어서 진행해줘.\n\n[이전 요청]\n${state.taskTitle}${state.progressSnippet ? `\n\n[마지막 진행 상태]\n...${state.progressSnippet}` : ''}\n\n계속 진행해줘.`
      window.api.claudeSend({ text: resumePrompt, cwd: project.currentPath, model: project.selectedModel })
      chat.addUserMessage(resumePrompt)
      chat.ensureAssistantMessage()
      localStorage.removeItem(PAUSE_STATE_KEY)
      setIsPaused(false)
      setPausedTask(null)
    } catch { /* ignore */ }
  }, [chat, project.currentPath, project.selectedModel])

  const handleRegenerate = useCallback(() => {
    const lastUser = [...chat.messages].reverse().find(m => m.role === 'user')
    const lastAssistant = [...chat.messages].reverse().find(m => m.role === 'assistant')
    if (lastUser && project.currentPath) {
      if (lastAssistant && lastAssistant.text) {
        chat.saveAlternative(lastAssistant.id)
      }
      window.api.claudeSend({
        text: lastUser.text,
        cwd: project.currentPath,
        model: project.selectedModel,
      })
      chat.ensureAssistantMessage()
      chat.appendText('')
    }
  }, [chat.messages, project.currentPath, project.selectedModel, chat.ensureAssistantMessage, chat.appendText, chat.saveAlternative])

  const handleRunInTerminal = useCallback((code: string) => {
    const id = getActiveTerminalId()
    if (id) window.api.terminalWrite(id, code + '\n')
  }, [])

  const handleQuickAction = useCallback((action: 'explain' | 'optimize' | 'fix', code: string, language: string) => {
    const prompt = ACTION_PROMPTS[action](language, code)
    handleSend(prompt)
  }, [handleSend])

  const handleBookmark = useCallback((messageId: string) => {
    chat.toggleBookmark(messageId)
  }, [chat.toggleBookmark])

  const handleTogglePin = useCallback((messageId: string) => {
    if (onTogglePin) onTogglePin(messageId)
    else chat.togglePin(messageId)
  }, [onTogglePin, chat.togglePin])

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    chat.toggleReaction(messageId, emoji)
  }, [chat.toggleReaction])

  const handleSummarize = useCallback(async () => {
    setSummaryOpen(true)
    setSummaryLoading(true)
    try {
      const result = await window.api.summarizeSession({
        messages: chat.messages.map(m => ({ role: m.role, content: m.text })),
      })
      setSummaryText(result.summary)
    } catch (e) {
      console.error('summarize failed', e)
      setSummaryText('')
    } finally {
      setSummaryLoading(false)
    }
  }, [chat.messages])

  // Scroll to a specific message when requested from sidebar
  useEffect(() => {
    if (!scrollToMessageId) return
    const idx = chat.messages.findIndex(m => m.id === scrollToMessageId)
    if (idx !== -1) {
      virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' })
    }
  }, [scrollToMessageId]) // eslint-disable-line react-hooks/exhaustive-deps

  const virtualItems = virtualizer.getVirtualItems()

  // Minimap calculations
  const minimapBlockHeights = useMemo(() =>
    chat.messages.map(m => Math.max(3, Math.min(20, m.text.length / 50))),
    [chat.messages]
  )
  const minimapTotalRaw = useMemo(() =>
    minimapBlockHeights.reduce((s, h) => s + h + 1, 0),
    [minimapBlockHeights]
  )

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current
    if (!el) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const ratio = (e.clientY - rect.top) / rect.height
    const totalScrollHeight = el.scrollHeight - el.clientHeight
    el.scrollTop = ratio * totalScrollHeight
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <style>{`
        [data-group-pos="middle"] > div:first-child > div:first-child,
        [data-group-pos="last"] > div:first-child > div:first-child {
          display: none;
        }
      `}</style>
      {/* Model selector */}
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <CopyConversationButton messages={chat.messages} />
        <ExportConversationButton messages={chat.messages} />
        <ExportHtmlButton messages={chat.messages} sessionName={chat.messages.find(m => m.role === 'user')?.text.slice(0, 30).replace(/[^\w\s가-힣]/g, '').trim()} />
        <ExportPdfButton messages={chat.messages} sessionId={chat.sessionId} />
        {chat.messages.some(m => m.bookmarked) && (
          <>
            <button
              onClick={jumpToBookmark}
              title="다음 북마크로 이동"
              style={{
                background: 'none', border: 'none', color: 'var(--warning, #fbbf24)',
                fontSize: 13, cursor: 'pointer', padding: '2px 6px',
              }}
            >★</button>
            <button
              onClick={() => setShowOnlyBookmarks(v => !v)}
              title={showOnlyBookmarks ? '전체 메시지 보기' : '북마크 메시지만 보기'}
              style={{
                background: showOnlyBookmarks ? 'var(--warning, #fbbf24)' : 'none',
                border: 'none',
                color: showOnlyBookmarks ? '#000' : 'var(--warning, #fbbf24)',
                fontSize: 10, cursor: 'pointer', padding: '2px 6px', borderRadius: 3,
              }}
            >★ 필터</button>
          </>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Model:</span>
        <select
          value={project.selectedModel}
          onChange={(e) => project.setModel(e.target.value)}
          style={{
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            fontSize: 12,
          }}
        >
          <option value="claude-opus-4-6">Claude Opus 4.6</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
        </select>
        <ContextUsageIndicator messages={chat.messages} />
        <button
          onClick={() => setShowMinimap(v => !v)}
          title={showMinimap ? '미니맵 숨기기' : '미니맵 표시'}
          style={{
            background: 'none', border: 'none',
            color: showMinimap ? 'var(--accent, #89b4fa)' : 'var(--text-muted)',
            fontSize: 13, cursor: 'pointer', padding: '2px 4px', lineHeight: 1,
            marginLeft: 'auto',
          }}
        >🗺</button>
        {chat.messages.length > 0 && (
          <button
            onClick={handleSummarize}
            title="세션 요약 생성"
            style={{
              background: 'none', border: 'none',
              color: summaryOpen ? 'var(--accent, #89b4fa)' : 'var(--text-muted)',
              fontSize: 11, cursor: 'pointer', padding: '2px 6px',
            }}
          >📝 요약</button>
        )}
        {chat.isStreaming && (
          <>
            <StreamingSpinner />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {formatElapsed(streamingSeconds)}{tokenRate > 0 ? ` · ~${tokenRate} tok/s` : ''}
            </span>
          </>
        )}
        <button
          onClick={() => setShowSystemPrompt(v => !v)}
          style={{
            fontSize: 10,
            padding: '2px 8px',
            background: customSystemPrompt ? 'var(--accent)' : 'var(--bg-secondary)',
            color: customSystemPrompt ? '#fff' : 'var(--text-muted)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          {customSystemPrompt ? '⚙ 시스템 ✓' : '⚙ 시스템 프롬프트'}
        </button>
      </div>

      {/* Custom system prompt editor */}
      {showSystemPrompt && (
        <div style={{
          borderBottom: '1px solid var(--border)',
          padding: '8px',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>커스텀 시스템 프롬프트</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: customSystemPrompt.length > 1800 ? '#f87171' : 'var(--text-muted)' }}>
                {customSystemPrompt.length} / 2000
              </span>
              {customSystemPrompt && (
                <button onClick={() => setCustomSystemPrompt('')} style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
              )}
            </div>
          </div>
          <textarea
            value={customSystemPrompt}
            onChange={e => setCustomSystemPrompt(e.target.value.slice(0, 2000))}
            placeholder="Claude에게 항상 적용할 지침을 입력하세요... (예: 한국어로 답변해줘, 코드는 TypeScript로)"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              fontSize: 11,
              padding: '4px 8px',
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              minHeight: 48,
              maxHeight: 160,
            }}
          />
          <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4 }}>
            지원 변수: {'{'}'{'{'}date{'}'}{'}'}(YYYY-MM-DD), {'{'}'{'{'}time{'}'}{'}'}(HH:MM), {'{'}'{'{'}project{'}'}{'}'}(프로젝트명), {'{'}'{'{'}model{'}'}{'}'}(모델명), {'{'}'{'{'}day{'}'}{'}'}(요일)
          </div>
        </div>
      )}

      {/* Session summary panel */}
      {summaryOpen && (
        <div style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          borderLeft: '4px solid var(--accent)',
          flexShrink: 0,
        }}>
          <div style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: summaryLoading ? 'none' : '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>📝 세션 요약</span>
            <button
              onClick={handleSummarize}
              disabled={summaryLoading}
              title="재생성"
              style={{
                background: 'none', border: 'none',
                color: summaryLoading ? 'var(--text-muted)' : 'var(--accent)',
                fontSize: 11, cursor: summaryLoading ? 'default' : 'pointer', padding: '1px 6px',
              }}
            >🔄 재생성</button>
            <button
              onClick={() => setSummaryOpen(false)}
              title="닫기"
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-muted)',
                fontSize: 14, cursor: 'pointer', padding: '1px 6px', marginLeft: 'auto', lineHeight: 1,
              }}
            >×</button>
          </div>
          <div style={{
            padding: '12px 16px',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {summaryLoading ? '요약 생성 중...' : summaryText}
          </div>
        </div>
      )}

      {/* Context compress banner */}
      {chat.messages.length >= 30 && !chat.isStreaming && onCompressContext && (
        <div style={{
          padding: '4px 12px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          flexShrink: 0,
        }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {chat.messages.length}개 메시지 — 컨텍스트가 길어졌습니다
          </span>
          <button
            onClick={onCompressContext}
            style={{
              fontSize: 10,
              padding: '2px 8px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            압축
          </button>
        </div>
      )}

      {/* Search bar */}
      {showSearch && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <input
            ref={searchInputRef}
            placeholder="대화 검색..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 8px',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 52, textAlign: 'center' }}>
            {matchCount > 0 ? `${safeMatchIdx + 1} / ${matchCount}` : '0 / 0'}
            {isSearchPending && searchQuery && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>...</span>
            )}
          </span>
          <button onClick={handleSearchPrev} disabled={matchCount === 0} title="이전 (Shift+Enter)" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 13, cursor: matchCount > 0 ? 'pointer' : 'default', padding: '2px 4px',
          }}>▲</button>
          <button onClick={handleSearchNext} disabled={matchCount === 0} title="다음 (Enter)" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 13, cursor: matchCount > 0 ? 'pointer' : 'default', padding: '2px 4px',
          }}>▼</button>
          <button onClick={() => setShowSearch(false)} title="닫기 (Esc)" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 14, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
          }}>×</button>
        </div>
      )}

      {/* Pinned messages */}
      {(() => {
        const pinnedMessages = chat.messages.filter(m => m.pinned)
        if (!pinnedMessages.length) return null
        return (
          <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
            <div
              onClick={() => setPinnedOpen(p => !p)}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📌 핀 메시지 {pinnedMessages.length}개 {pinnedOpen ? '▴' : '▾'}
            </div>
            {pinnedOpen && pinnedMessages.map(m => (
              <div key={m.id} style={{ padding: '6px 16px', fontSize: 12, borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 600 }}>{m.role}: </span>
                {m.text.slice(0, 120)}{m.text.length > 120 ? '…' : ''}
              </div>
            ))}
          </div>
        )
      })()}

      {/* Context usage bar */}
      {chat.sessionInputTokens > 0 && (
        <div
          title={`컨텍스트: ${chat.sessionInputTokens.toLocaleString()} / 200,000 토큰`}
          style={{ height: 3, background: 'var(--border)', flexShrink: 0, cursor: 'default' }}
        >
          <div style={{
            height: '100%',
            width: `${Math.min(chat.sessionInputTokens / 200000 * 100, 100)}%`,
            background: chat.sessionInputTokens > 160000 ? '#f87171' :
                        chat.sessionInputTokens > 100000 ? '#fbbf24' : 'var(--accent)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Messages - virtualized */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflow: 'auto', position: 'relative', paddingRight: showMinimap && messageCount > 0 ? 42 : 0 }}
        onScroll={handleScroll}
      >
        {messageCount === 0 && !chat.isStreaming ? (
          <WelcomeScreen
            onSelectPrompt={handleWelcomeSelectPrompt}
            recentSessions={recentSessions}
            onSelectSession={onSelectSession}
          />
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const msg = displayMessages[virtualRow.index]
              if (!msg) return null
              const isLast = virtualRow.index === messageCount - 1
              const prevMsg = virtualRow.index > 0 ? displayMessages[virtualRow.index - 1] : null
              const showTimeSep = !!(
                msg.timestamp &&
                prevMsg?.timestamp &&
                msg.timestamp - prevMsg.timestamp > 3600000
              )
              const msgPosition = msg.timestamp !== undefined
                ? getMsgPosition(chat.messages, virtualRow.index)
                : 'solo'
              const isGrouped = msgPosition === 'middle' || msgPosition === 'last'
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  data-group-pos={msgPosition}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    marginTop: isGrouped ? 2 : 8,
                  }}
                >
                  {showTimeSep && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, margin: '8px 16px',
                      color: 'var(--text-muted)', fontSize: 11,
                    }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <span>{formatTimeSep(msg.timestamp)}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
                  <MessageBubble
                    msg={msg}
                    isLast={isLast}
                    isStreaming={chat.isStreaming}
                    onRegenerate={isLast && msg.role === 'assistant' && !chat.isStreaming ? handleRegenerate : undefined}
                    onPrevAlt={(msg.alternatives?.length ?? 0) > 0 ? (idx: number) => chat.setAltIndex(msg.id, idx) : undefined}
                    altIndex={msg.altIndex}
                    altCount={(msg.alternatives?.length ?? 0)}
                    isMatched={matchedMessageIds.has(msg.id)}
                    isCurrentMatch={currentMatchId === msg.id}
                    highlightText={searchQuery || undefined}
                    isSearchMatch={currentMatchId === msg.id}
                    onRunInTerminal={handleRunInTerminal}
                    onFork={onFork && msg.role === 'user' ? () => onFork(virtualRow.index) : undefined}
                    onEditResend={msg.role === 'user' && onEditResend ? (newText) => onEditResend(msg.id, newText) : undefined}
                    onQuickAction={handleQuickAction}
                    onBookmark={() => handleBookmark(msg.id)}
                    isBookmarked={msg.bookmarked}
                    onTogglePin={() => handleTogglePin(msg.id)}
                    isPinned={msg.pinned}
                    onOpenFile={onOpenFile}
                    onReaction={msg.role === 'assistant' ? (emoji) => handleReaction(msg.id, emoji) : undefined}
                    onImageClick={onImageClick}
                    onReplyTo={onReplyToMessage ? () => onReplyToMessage(msg.text) : undefined}
                  />
                </div>
              )
            })}
          </div>
        )}
        {chat.isStreaming && messageCount > 0 && chat.messages[messageCount - 1]?.role === 'user' && (
          <div style={{ padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claude</span>
            <TypingIndicator />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {formatElapsed(streamingSeconds)}{tokenRate > 0 ? ` · ~${tokenRate} tok/s` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Minimap */}
      {showMinimap && messageCount > 0 && (
        <MiniMap
          messages={chat.messages}
          scrollTop={minimapScroll.scrollTop}
          clientHeight={minimapScroll.clientHeight}
          totalScrollHeight={minimapScroll.totalScrollHeight}
          blockHeights={minimapBlockHeights}
          totalRaw={minimapTotalRaw}
          minimapRef={minimapRef}
          onClick={handleMinimapClick}
        />
      )}
      </div>

      {/* Scroll to top button */}
      {showTopBtn && (
        <button
          onClick={() => {
            const el = scrollContainerRef.current
            if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          style={{
            position: 'absolute',
            top: 60,
            right: 16,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            borderRadius: 20,
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 10,
          }}
          title="맨 위로 스크롤"
        >↑ 맨 위</button>
      )}

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        chat.isStreaming ? (
          <button
            onClick={scrollToBottom}
            style={{
              position: 'absolute',
              bottom: 70,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--accent, #89b4fa)',
              color: '#1e1e2e',
              border: 'none',
              borderRadius: 16,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
              zIndex: 10,
              whiteSpace: 'nowrap',
              letterSpacing: '0.3px',
            }}
            title="맨 아래로 스크롤"
          >↓ 새 메시지</button>
        ) : (
          <button
            onClick={scrollToBottom}
            style={{
              position: 'absolute',
              bottom: 70,
              right: 16,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              borderRadius: '50%',
              width: 32, height: 32,
              fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              zIndex: 10,
            }}
            title="맨 아래로 스크롤"
          >↓</button>
        )
      )}

      {suggestions && suggestions.length > 0 && !chat.isStreaming && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>제안:</span>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { handleSend(s); if (onDismissSuggestions) onDismissSuggestions() }}
              style={{
                background: 'rgba(82,139,255,0.1)',
                border: '1px solid rgba(82,139,255,0.3)',
                borderRadius: 16,
                fontSize: 12,
                padding: '4px 12px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(82,139,255,0.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(82,139,255,0.1)' }}
            >{s}</button>
          ))}
          <button
            onClick={onDismissSuggestions}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 14, cursor: 'pointer', padding: '2px 6px', lineHeight: 1, marginLeft: 'auto',
            }}
            title="닫기"
          >×</button>
        </div>
      )}

      {ccCtx.connected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', fontSize: 10, color: 'var(--success, #26a641)',
          borderTop: '1px solid var(--border)',
          background: 'rgba(38,166,65,0.06)',
        }}>
          <span>CC</span>
          <span>연결됨</span>
          {ccCtx.selectedNode && (
            <span style={{ color: 'var(--text-muted)' }}>
              — 선택: {ccCtx.selectedNode.name}
            </span>
          )}
        </div>
      )}
      {/* 첨부 컨텍스트 파일 */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          <div
            onClick={() => setShowCtxFiles(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 12px', cursor: 'pointer',
              fontSize: 10, color: 'var(--text-muted)',
            }}
          >
            <span>📎</span>
            <span>컨텍스트 파일 {ctxFiles.files.length > 0 ? `(${ctxFiles.files.length}개, ~${ctxFiles.totalTokens > 1000 ? (ctxFiles.totalTokens/1000).toFixed(1)+'k' : ctxFiles.totalTokens}토큰)` : ''}</span>
            <span style={{ marginLeft: 'auto' }}>{showCtxFiles ? '▲' : '▼'}</span>
          </div>
          {showCtxFiles && (
            <div style={{ padding: '4px 12px 6px', display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
              {ctxFiles.files.map(f => (
                <span
                  key={f.path}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '2px 6px', fontSize: 10,
                    color: f.error ? 'var(--error)' : 'var(--text-secondary)',
                  }}
                  title={f.path}
                >
                  {f.name}
                  <button
                    onClick={e => { e.stopPropagation(); ctxFiles.removeFile(f.path) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: 0, lineHeight: 1 }}
                  >×</button>
                </span>
              ))}
              <button
                onClick={async e => {
                  e.stopPropagation()
                  if (window.api.openFileDialog) {
                    const paths = await window.api.openFileDialog({ title: '컨텍스트 파일 선택' })
                    for (const p of paths) ctxFiles.addFile(p)
                  } else {
                    const path = window.prompt('파일 경로:')?.trim()
                    if (path) ctxFiles.addFile(path)
                  }
                }}
                style={{
                  background: 'none', border: '1px dashed var(--border)',
                  borderRadius: 4, padding: '2px 8px', fontSize: 10,
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >+ 파일 추가</button>
            </div>
          )}
        </div>
      <InputBar
        onSend={handleSend}
        onInterrupt={handleInterrupt}
        onPause={handlePause}
        onResume={handleResume}
        isPaused={isPaused}
        pausedTask={pausedTask}
        isStreaming={chat.isStreaming}
        disabled={!project.currentPath}
        focusTrigger={focusTrigger}
        pendingInsert={welcomePendingInsert ?? pendingInsert}
        onPendingInsertConsumed={() => {
          if (welcomePendingInsert) setWelcomePendingInsert(undefined)
          else onPendingInsertConsumed?.()
        }}
      />
    </div>
  )
}
