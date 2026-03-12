import { useEffect, useRef, useState, useCallback, memo, useMemo, useTransition, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import type { useChatStore } from '../../stores/chat-store'
import type { useProject } from '../../stores/project-store'
import type { ChatMessage } from '../../stores/chat-store'
import { getActiveTerminalId } from '../../stores/terminal-store'
import { WelcomeScreen } from '../shared/WelcomeScreen'

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

export function ChatPanel({ chat, project, focusTrigger, searchTrigger, scrollToMessageId, onFork, onEditResend, onOpenFile, onImageClick, onCompressContext, pendingInsert, onPendingInsertConsumed, onTogglePin, onReplyToMessage, suggestions, onDismissSuggestions, recentSessions, onSelectSession }: ChatPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showTopBtn, setShowTopBtn] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)
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

  const messageCount = chat.messages.length

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
    count: messageCount,
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

  // Scroll to bottom when streaming finishes
  const prevStreamingRef = useRef(chat.isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current && !chat.isStreaming && messageCount > 0) {
      if (isAtBottomRef.current) {
        virtualizer.scrollToIndex(messageCount - 1, { align: 'end', behavior: 'smooth' })
      }
    }
    prevStreamingRef.current = chat.isStreaming
  }, [chat.isStreaming, messageCount, virtualizer])

  const bookmarkIdxRef = useRef(0)

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

  const handleSend = useCallback((text: string) => {
    if (!project.currentPath) return
    chat.addUserMessage(text)
    window.api.claudeSend({
      text,
      cwd: project.currentPath,
      model: project.selectedModel,
    })
  }, [project.currentPath, project.selectedModel, chat.addUserMessage])

  const handleInterrupt = useCallback(() => {
    window.api.claudeInterrupt()
    chat.finishStreaming()
  }, [chat.finishStreaming])

  const handleRegenerate = useCallback(() => {
    const lastUser = [...chat.messages].reverse().find(m => m.role === 'user')
    if (lastUser && project.currentPath) {
      window.api.claudeSend({
        text: lastUser.text,
        cwd: project.currentPath,
        model: project.selectedModel,
      })
      chat.ensureAssistantMessage()
      chat.appendText('')
    }
  }, [chat.messages, project.currentPath, project.selectedModel, chat.ensureAssistantMessage, chat.appendText])

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
          <button
            onClick={jumpToBookmark}
            title="다음 북마크로 이동"
            style={{
              background: 'none', border: 'none', color: 'var(--warning, #fbbf24)',
              fontSize: 13, cursor: 'pointer', padding: '2px 6px',
            }}
          >★</button>
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
      </div>

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
              const msg = chat.messages[virtualRow.index]
              if (!msg) return null
              const isLast = virtualRow.index === messageCount - 1
              const prevMsg = virtualRow.index > 0 ? chat.messages[virtualRow.index - 1] : null
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
                    isMatched={matchedMessageIds.has(msg.id)}
                    isCurrentMatch={currentMatchId === msg.id}
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
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claude</span>
            <StreamingSpinner />
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

      <InputBar
        onSend={handleSend}
        onInterrupt={handleInterrupt}
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
