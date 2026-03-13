import { useEffect, useRef, useState, useCallback, memo, useMemo, useTransition, type RefObject } from 'react'

// ── Model Selector ────────────────────────────────────────────────────────────
const MODEL_DEFS = [
  {
    id: 'claude-opus-4-6',
    label: 'Opus 4.6',
    icon: '🧠',
    desc: '가장 강력',
    color: '#c084fc',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    icon: '⚖️',
    desc: '균형',
    color: '#60a5fa',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    icon: '⚡',
    desc: '빠름',
    color: '#34d399',
  },
] as const

function ModelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // recent-model localStorage 동기화
  const [recentId, setRecentId] = useState<string | null>(() =>
    localStorage.getItem('recent-model'),
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (id: string) => {
    onChange(id)
    localStorage.setItem('recent-model', id)
    setRecentId(id)
    setOpen(false)
  }

  // 최근 모델을 상단으로 정렬
  const sorted = useMemo(() => {
    if (!recentId || recentId === value) return MODEL_DEFS
    const idx = MODEL_DEFS.findIndex((m) => m.id === recentId)
    if (idx <= 0) return MODEL_DEFS
    const arr = [...MODEL_DEFS]
    const [item] = arr.splice(idx, 1)
    return [item, ...arr]
  }, [recentId, value])

  const current = MODEL_DEFS.find((m) => m.id === value) ?? MODEL_DEFS[1]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="모델 선택"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '2px 8px 2px 6px',
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--text-primary)',
        }}
      >
        <span>{current.icon}</span>
        <span style={{ color: current.color, fontWeight: 600 }}>{current.label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 9999,
            minWidth: 170,
            overflow: 'hidden',
          }}
        >
          {sorted.map((m, i) => {
            const isSelected = m.id === value
            const isRecent = m.id === recentId && m.id !== value
            return (
              <div
                key={m.id}
                onClick={() => handleSelect(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--bg-hover, rgba(137,180,250,0.12))' : 'transparent',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) =>
                  !isSelected &&
                  ((e.currentTarget as HTMLDivElement).style.background =
                    'var(--bg-hover, rgba(255,255,255,0.06))')
                }
                onMouseLeave={(e) =>
                  !isSelected &&
                  ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                }
              >
                <span style={{ fontSize: 15 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: m.color, fontWeight: 600, fontSize: 12 }}>{m.label}</span>
                    {isRecent && (
                      <span
                        style={{
                          fontSize: 9,
                          background: 'rgba(255,255,255,0.1)',
                          color: 'var(--text-muted)',
                          borderRadius: 3,
                          padding: '1px 4px',
                        }}
                      >
                        최근
                      </span>
                    )}
                    {isSelected && (
                      <span style={{ fontSize: 10, color: m.color }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{m.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────
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
  onOpenPromptChain?: () => void
}

const CONTEXT_WINDOW = 200000
const foldThreshold = 20

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

export function ChatPanel({ chat, project, focusTrigger, searchTrigger, scrollToMessageId, onFork, onEditResend, onOpenFile, onImageClick, onCompressContext, pendingInsert, onPendingInsertConsumed, onTogglePin, onReplyToMessage, suggestions, onDismissSuggestions, recentSessions, onSelectSession, hqMode, onToggleHQ, onOpenPromptChain }: ChatPanelProps) {
  const ccCtx = useCCContext()
  const projectSummary = useProjectContext(project.currentPath ?? null)
  const ctxFiles = useContextFiles(project.currentPath ?? null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const scrollPositions = useRef<Record<string, number>>({})
  const prevSessionIdRef = useRef<string | null | undefined>(chat.sessionId)
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
  const [autoSummary, setAutoSummary] = useState<string | null>(null)
  const [showAutoSummary, setShowAutoSummary] = useState(false)
  const [welcomePendingInsert, setWelcomePendingInsert] = useState<string | undefined>(undefined)
  const [minimapScroll, setMinimapScroll] = useState({ scrollTop: 0, clientHeight: 1, totalScrollHeight: 1 })
  const [suggestionIndex, setSuggestionIndex] = useState<number>(-1)
  const [suggestionPendingInsert, setSuggestionPendingInsert] = useState<string | undefined>(undefined)

  const onSelectSuggestion = useCallback((text: string) => {
    setSuggestionPendingInsert(text)
    setSuggestionIndex(-1)
  }, [])

  // ── 뷰 모드 (compact / wide) ──────────────────────────────────────────────
  const [chatViewMode, setChatViewMode] = useState<'compact' | 'wide'>(() =>
    (localStorage.getItem('chat-view-mode') as 'compact' | 'wide') ?? 'compact'
  )
  const toggleViewMode = () => setChatViewMode(v => {
    const next = v === 'compact' ? 'wide' : 'compact'
    localStorage.setItem('chat-view-mode', next)
    return next
  })

  // ── 타임스탬프 표시 토글 ──────────────────────────────────────────────────
  const [showTimestamps, setShowTimestamps] = useState<boolean>(() => {
    try { return localStorage.getItem('show-timestamps') === 'true' } catch { return false }
  })
  const toggleTimestamps = () => setShowTimestamps(v => {
    const next = !v
    try { localStorage.setItem('show-timestamps', String(next)) } catch { /* ignore */ }
    return next
  })

  // ── 프롬프트 변수 템플릿 ─────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('')
  const [varModal, setVarModal] = useState<{ text: string; vars: string[] } | null>(null)
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const varInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const extractVars = (text: string): string[] => {
    const matches = [...text.matchAll(/\{\{([^}]+)\}\}/g)]
    return [...new Set(matches.map(m => m[1].trim()))]
  }

  const hasVars = extractVars(inputText).length > 0

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

  // R651: msgSearchQuery / showMsgSearch aliases (동일 state 참조)
  const msgSearchQuery = searchQuery
  const showMsgSearch = showSearch

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

  const [showShortcutsOverlay, setShowShortcutsOverlay] = useState(false)
  const [activePersona, setActivePersona] = useState<string | null>(null)
  const [personaPrompt, setPersonaPrompt] = useState('')

  // 채팅 패널 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      if (e.key === 'Escape') {
        if (showShortcutsOverlay) { setShowShortcutsOverlay(false); return }
        if (showSearch) { setShowSearch(false); return }
      }

      // input/textarea 포커스 중이면 아래 단축키 무시
      if (isInput) return

      if (e.key === '?') {
        setShowShortcutsOverlay(v => !v)
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault()
          setShowSearch(v => !v)
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault()
          setShowOnlyBookmarks(v => !v)
        } else if (e.key === 'w' || e.key === 'W') {
          e.preventDefault()
          setChatViewMode(v => v === 'compact' ? 'wide' : 'compact')
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showSearch, showShortcutsOverlay])

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

  // 세션 전환 시 스크롤 위치 저장/복원
  useEffect(() => {
    const prevId = prevSessionIdRef.current
    const nextId = chat.sessionId
    if (prevId === nextId) return

    // 이전 세션 스크롤 위치 저장
    if (prevId) {
      const el = scrollContainerRef.current
      if (el) scrollPositions.current[prevId] = el.scrollTop
    }

    // 새 세션 스크롤 위치 복원
    const savedPos = nextId ? scrollPositions.current[nextId] : undefined
    if (savedPos !== undefined) {
      requestAnimationFrame(() => {
        const el = scrollContainerRef.current
        if (el) el.scrollTop = savedPos
      })
    } else {
      // 저장된 위치 없으면 맨 아래로
      isAtBottomRef.current = true
    }

    prevSessionIdRef.current = nextId
  }, [chat.sessionId])

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
  const [foldedMessages, setFoldedMessages] = useState<Set<string>>(new Set())
  const [autoSummary, setAutoSummary] = useState<string | null>(null)
  const [showAutoSummary, setShowAutoSummary] = useState(false)

  // R701: 메시지 카테고리 레이블
  const [bookmarkedMsgs, setBookmarkedMsgs] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('bookmarked-msgs') ?? '[]')))
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [reactionStats, setReactionStats] = useState<Record<string, Record<string, number>>>({})
  const [threadOpen, setThreadOpen] = useState<string | null>(null)
  const [msgRatings, setMsgRatings] = useState<Record<string, 1 | 2 | 3 | 4 | 5>>({})
  const [showRatingBar, setShowRatingBar] = useState<string | null>(null)
  const [runningBlocks, setRunningBlocks] = useState<Set<string>>(new Set())
  const [msgExpiry, setMsgExpiry] = useState<Record<string, number>>({})
  const [exportTemplate, setExportTemplate] = useState<'default' | 'minimal' | 'detailed'>('default')
  const [streamSpeed, setStreamSpeed] = useState<'auto' | 'slow' | 'normal' | 'fast'>('auto')
  const [streamChunkSize, setStreamChunkSize] = useState(10)
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({})
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([])
  const [showPinnedPanel, setShowPinnedPanel] = useState(false)
  const [messageSchedule, setMessageSchedule] = useState<Array<{ id: string; scheduledAt: number; content: string }>>([])
  const [showSchedulePanel, setShowSchedulePanel] = useState(false)
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({})
  const [showDraftList, setShowDraftList] = useState(false)
  const [chatExportOptions, setChatExportOptions] = useState<{ format: string; range: string }>({ format: 'md', range: 'all' })
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [messageFolders, setMessageFolders] = useState<Record<string, string[]>>({})
  const [activeMsgFolder, setActiveMsgFolder] = useState<string | null>(null)
  const [threadingEnabled, setThreadingEnabled] = useState(false)
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [aiAssistMode, setAiAssistMode] = useState<'off' | 'suggest' | 'auto'>('off')
  const [aiAssistSuggestion, setAiAssistSuggestion] = useState<string | null>(null)
  const [readReceipts, setReadReceipts] = useState<Record<string, number>>({})
  const [showReadReceipts, setShowReadReceipts] = useState(false)
  const [conversationInsights, setConversationInsights] = useState<{ totalTokens: number; avgResponseTime: number } | null>(null)
  const [showInsightsPanel, setShowInsightsPanel] = useState(false)
  const [messageAnalytics, setMessageAnalytics] = useState<{ sent: number; received: number; avgLength: number } | null>(null)
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false)
  const [chatNotes, setChatNotes] = useState<Record<string, string>>({})
  const [showChatNotes, setShowChatNotes] = useState(false)
  const [pinnedMsgs, setPinnedMsgs] = useState<string[]>(() => JSON.parse(localStorage.getItem('pinned-msgs') ?? '[]'))
  const [chatStats, setChatStats] = useState<{ totalTokens: number; avgResponseTime: number; totalMsgs: number }>({ totalTokens: 0, avgResponseTime: 0, totalMsgs: 0 })
  const [copyFormat, setCopyFormat] = useState<'text' | 'markdown' | 'html'>('markdown')
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [encryptedMsgs, setEncryptedMsgs] = useState<Set<string>>(new Set())
  const [showEncryptionInfo, setShowEncryptionInfo] = useState(false)
  const [scheduledMsgs, setScheduledMsgs] = useState<Array<{ text: string; sendAt: number }>>([])
  const [watermarkText, setWatermarkText] = useState<string>('')
  const [persona, setPersona] = useState<string>('default')
  const [personaList, setPersonaList] = useState<Array<{ name: string; prompt: string }>>(() => JSON.parse(localStorage.getItem('personas') ?? '[]'))
  const [systemPromptDraft, setSystemPromptDraft] = useState<string>('')
  const [msgCategories, setMsgCategories] = useState<Record<string, string>>({})
  const [regenOptions, setRegenOptions] = useState<{ temperature: number; style: string }>({ temperature: 1.0, style: 'default' })
  const [translationHistory, setTranslationHistory] = useState<Array<{ msgId: string; original: string; translated: string; lang: string }>>([])
  const [showTranslationHistory, setShowTranslationHistory] = useState(false)
  const [collapseThreshold, setCollapseThreshold] = useState(500)
  const [collapsedByDefault, setCollapsedByDefault] = useState(false)
  const [showRegenOptions, setShowRegenOptions] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false)
  const [contextUsage, setContextUsage] = useState(0)
  const [showContextBar, setShowContextBar] = useState(true)
  const [msgTheme, setMsgTheme] = useState<'default' | 'compact' | 'bubble' | 'minimal'>('default')
  const [msgDensity, setMsgDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [showWatermark, setShowWatermark] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [showCopyMenu, setShowCopyMenu] = useState<string | null>(null)
  const [showChatStats, setShowChatStats] = useState(false)
  const [showPinnedOnly, setShowPinnedOnly] = useState(false)
  const [translateLang, setTranslateLang] = useState<string>('ko')
  const [translating, setTranslating] = useState<Set<string>>(new Set())
  const [branchPoint, setBranchPoint] = useState<string | null>(null)
  const [branches, setBranches] = useState<Record<string, string[]>>({})
  const [pausedStream, setPausedStream] = useState(false)
  const [modelHistory, setModelHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem('model-history') ?? '[]'))
  const [modelFavorites, setModelFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('model-favorites') ?? '[]'))
  const [searchHighlights, setSearchHighlights] = useState<number[]>([])
  const [searchHlIdx, setSearchHlIdx] = useState(0)
  const [showExpiredMsgs, setShowExpiredMsgs] = useState(false)
  const [blockOutputs, setBlockOutputs] = useState<Record<string, string>>({})
  const [summaryCards, setSummaryCards] = useState<Record<string, string>>({})
  const [showSummaryCard, setShowSummaryCard] = useState<string | null>(null)
  const [threadReplies, setThreadReplies] = useState<Record<string, string[]>>({})
  const [showReactionStats, setShowReactionStats] = useState(false)
  const [msgLabels, setMsgLabels] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('msg-labels') ?? '{}') } catch { return {} }
  })
  const [showLabelMenu, setShowLabelMenu] = useState<string | null>(null)
  const [emojiReactions, setEmojiReactions] = useState<Record<string, Record<string, number>>>({})
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [bookmarkFolders, setBookmarkFolders] = useState<Array<{ id: string; name: string; msgIds: string[] }>>([])
  const [activeBookmarkFolder, setActiveBookmarkFolder] = useState<string | null>(null)
  const [qualityScores, setQualityScores] = useState<Record<string, number>>({})
  const [showQualityPanel, setShowQualityPanel] = useState(false)
  const [threadSummaries, setThreadSummaries] = useState<Record<string, string>>({})
  const [threadSummaryLoading, setThreadSummaryLoading] = useState<string | null>(null)
  const [msgExportFormat, setMsgExportFormat] = useState<'md' | 'txt' | 'html' | 'json'>('md')
  const [showMsgExportPanel, setShowMsgExportPanel] = useState(false)
  const MSG_LABEL_KINDS = ['중요', '질문', '답변', '코드', '오류'] as const
  const MSG_LABEL_COLORS: Record<string, string> = {
    '중요': '#f87171', '질문': '#60a5fa', '답변': '#34d399', '코드': '#c084fc', '오류': '#fbbf24',
  }
  const setMsgLabel = useCallback((messageId: string, label: string) => {
    setMsgLabels(prev => {
      const next = { ...prev }
      if (next[messageId] === label) { delete next[messageId] } else { next[messageId] = label }
      try { localStorage.setItem('msg-labels', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    setShowLabelMenu(null)
  }, [])

  const toggleFoldMessages = useCallback(() => {
    if (displayMessages.length < foldThreshold) return
    // 앞 5개 + 뒤 5개 제외한 중간 메시지들을 fold
    const foldStart = 5
    const foldEnd = displayMessages.length - 5
    const middleIds = displayMessages.slice(foldStart, foldEnd).map(m => m.id)
    setFoldedMessages(prev => {
      if (prev.size > 0) return new Set()
      return new Set(middleIds)
    })
  }, [displayMessages])

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

  const handleSendWithVarCheck = useCallback((text: string) => {
    const vars = extractVars(text)
    if (vars.length > 0) {
      const initValues: Record<string, string> = {}
      vars.forEach(v => { initValues[v] = '' })
      setVarValues(initValues)
      setVarModal({ text, vars })
    } else {
      handleSend(text)
    }
  }, [handleSend]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const [threadSummaries, setThreadSummaries] = useState<Record<string, string>>({})
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null)
  const [msgExportFormat, setMsgExportFormat] = useState<'md' | 'txt' | 'html' | 'json'>('md')
  const [showMsgExportPanel, setShowMsgExportPanel] = useState(false)
  const [chatAnalytics, setChatAnalytics] = React.useState<Record<string, number>>({})
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = React.useState(false)
  const [translateEnabled, setTranslateEnabled] = React.useState(false)
  const [translateTarget, setTranslateTarget] = React.useState('en')
  const [messageBookmarks, setMessageBookmarks] = React.useState<string[]>([])
  const [showBookmarkPanel, setShowBookmarkPanel] = React.useState(false)
  const [messageTags, setMessageTags] = React.useState<Record<string, string[]>>({})
  const [showTagFilter, setShowTagFilter] = React.useState(false)
  const [messageLabels, setMessageLabels] = React.useState<Record<string, string>>({})
  const [showLabelPicker, setShowLabelPicker] = React.useState(false)
  const [messageCategories, setMessageCategories] = React.useState<string[]>([])
  const [activeMsgCategory, setActiveMsgCategory] = React.useState('all')
  const [readStatus, setReadStatus] = React.useState<Record<string, boolean>>({})
  const [showReadStatus, setShowReadStatus] = React.useState(false)
  const [sentimentMode, setSentimentMode] = React.useState(false)
  const [sentimentData, setSentimentData] = React.useState<Record<string, string>>({})
  const [msgStats, setMsgStats] = React.useState<Record<string, number>>({})
  const [showMsgStats, setShowMsgStats] = React.useState(false)
  const [searchFilter, setSearchFilter] = React.useState<'all' | 'mine' | 'ai'>('all')
  const [showSearchFilter, setShowSearchFilter] = React.useState(false)
  const [chatTheme, setChatTheme] = React.useState('default')
  const [showThemeSelector, setShowThemeSelector] = React.useState(false)
  const [convSummary, setConvSummary] = React.useState('')
  const [showSummaryPanel, setShowSummaryPanel] = React.useState(false)
  const [msgPriority, setMsgPriority] = React.useState<'normal' | 'high' | 'urgent'>('normal')
  const [showPriorityFilter, setShowPriorityFilter] = React.useState(false)
  const [timestampFormat, setTimestampFormat] = React.useState<'relative' | 'absolute'>('relative')
  const [collapsedMsgs, setCollapsedMsgs] = React.useState<string[]>([])
  const [autoCollapse, setAutoCollapse] = React.useState(false)
  const [exportTarget, setExportTarget] = React.useState<'all' | 'selected'>('all')
  const [showExportPanel, setShowExportPanel] = React.useState(false)
  const [aiSuggestions, setAiSuggestions] = React.useState<string[]>([])
  const [showAiSuggestions, setShowAiSuggestions] = React.useState(false)
  const [msgSearchFilter, setMsgSearchFilter] = React.useState('')
  const [showSearchFilter, setShowSearchFilter] = React.useState(false)
  const [msgSortOrder, setMsgSortOrder] = React.useState<'asc' | 'desc'>('asc')
  const [showSortOptions, setShowSortOptions] = React.useState(false)
  const [readMarkers, setReadMarkers] = React.useState<Record<string, boolean>>({})
  const [showReadStatus, setShowReadStatus] = React.useState(false)
  const [codeRunTarget, setCodeRunTarget] = React.useState<string | null>(null)
  const [showCodeRunner, setShowCodeRunner] = React.useState(false)
  const [threadView, setThreadView] = React.useState(false)
  const [threadRoot, setThreadRoot] = React.useState<string | null>(null)
  const [favMsgs, setFavMsgs] = React.useState<string[]>([])
  const [showFavMsgs, setShowFavMsgs] = React.useState(false)
  const [msgCategory, setMsgCategory] = React.useState<string>('all')
  const [showCategoryFilter, setShowCategoryFilter] = React.useState(false)
  const [chatBg, setChatBg] = React.useState<string>('default')
  const [showBgPicker, setShowBgPicker] = React.useState(false)
  const [msgFormatMode, setMsgFormatMode] = React.useState<'plain' | 'markdown'>('markdown')
  const [showFormatToolbar, setShowFormatToolbar] = React.useState(false)
  const [foldedMsgs, setFoldedMsgs] = React.useState<string[]>([])
  const [foldThreshold, setFoldThreshold] = React.useState(500)
  const [msgColors, setMsgColors] = React.useState<Record<string, string>>({})
  const [showColorPalette, setShowColorPalette] = React.useState(false)
  const [shareTarget, setShareTarget] = React.useState<string | null>(null)
  const [showSharePanel, setShowSharePanel] = React.useState(false)
  const [msgVotes, setMsgVotes] = React.useState<Record<string, number>>({})
  const [showVotePanel, setShowVotePanel] = React.useState(false)
  const [inlinePreview, setInlinePreview] = React.useState(true)
  const [previewMaxHeight, setPreviewMaxHeight] = React.useState(300)

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
    const msg = chat.messages.find(m => m.id === messageId)
    const pinnedCount = chat.messages.filter(m => m.pinned).length
    if (!msg?.pinned && pinnedCount >= 3) return
    if (onTogglePin) onTogglePin(messageId)
    else chat.togglePin(messageId)
  }, [onTogglePin, chat.togglePin, chat.messages])

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    chat.toggleReaction(messageId, emoji)
  }, [chat.toggleReaction])

  const handleDeleteMessage = useCallback((messageId: string) => {
    chat.deleteMessage(messageId)
  }, [chat.deleteMessage])

  const handleRetryMessage = useCallback((messageId: string) => {
    if (chat.isStreaming || !project.currentPath || !onEditResend) return
    const msg = chat.messages.find(m => m.id === messageId)
    if (!msg || msg.role !== 'user') return
    onEditResend(messageId, msg.text)
  }, [chat.isStreaming, chat.messages, project.currentPath, onEditResend])

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
        [data-view-mode="wide"] div[class*="react-syntax-highlighter"] > pre,
        [data-view-mode="wide"] .code-block-pre {
          padding: 16px !important;
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
              title={showOnlyBookmarks ? '전체 메시지 보기' : '즐겨찾기 뷰 보기'}
              style={{
                background: showOnlyBookmarks ? 'var(--warning, #fbbf24)' : 'none',
                border: '1px solid var(--warning, #fbbf24)',
                color: showOnlyBookmarks ? '#000' : 'var(--warning, #fbbf24)',
                fontSize: 10, cursor: 'pointer', padding: '2px 6px', borderRadius: 3,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}
            >
              ⭐
              <span style={{
                background: showOnlyBookmarks ? 'rgba(0,0,0,0.2)' : 'var(--warning, #fbbf24)',
                color: showOnlyBookmarks ? '#000' : '#000',
                borderRadius: 8, fontSize: 9, padding: '0 4px', lineHeight: '14px',
                minWidth: 14, textAlign: 'center', fontWeight: 700,
              }}>
                {chat.messages.filter(m => m.bookmarked).length}
              </span>
            </button>
          </>
        )}
        <ModelSelector value={project.selectedModel} onChange={project.setModel} />
        <button
          onClick={toggleViewMode}
          title={chatViewMode === 'compact' ? '와이드 뷰로 전환' : '컴팩트 뷰로 전환'}
          style={{
            background: 'none', border: 'none',
            color: chatViewMode === 'wide' ? 'var(--accent, #89b4fa)' : 'var(--text-muted)',
            fontSize: 15, cursor: 'pointer', padding: '2px 4px', lineHeight: 1,
          }}
        >{chatViewMode === 'compact' ? '⊞' : '⊟'}</button>
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
        <button
          onClick={toggleTimestamps}
          title={showTimestamps ? '타임스탬프 숨기기' : '타임스탬프 표시'}
          style={{
            background: 'none', border: 'none',
            color: showTimestamps ? 'var(--accent, #89b4fa)' : 'var(--text-muted)',
            fontSize: 13, cursor: 'pointer', padding: '2px 4px', lineHeight: 1,
          }}
        >🕐</button>
        {chat.messages.length >= foldThreshold && (
          <button
            onClick={toggleFoldMessages}
            title={foldedMessages.size > 0 ? '접힌 메시지 펼치기' : '중간 메시지 접기'}
            style={{
              background: 'none', border: 'none',
              color: foldedMessages.size > 0 ? 'var(--accent, #89b4fa)' : 'var(--text-muted)',
              fontSize: 11, cursor: 'pointer', padding: '2px 6px',
            }}
          >{foldedMessages.size > 0 ? `↕ ${foldedMessages.size}개 메시지 보이기` : '↕ 메시지 숨기기'}</button>
        )}
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

      {/* Auto summary banner */}
      {chat.messages.length >= 50 && (
        <div style={{
          padding: '4px 12px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {chat.messages.length}개 메시지
            </span>
            <button
              onClick={() => {
                if (!autoSummary) setAutoSummary('대화 요약 생성 중...')
                setShowAutoSummary((v) => !v)
              }}
              style={{
                fontSize: 10,
                padding: '2px 8px',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              요약 보기
            </button>
          </div>
          {showAutoSummary && autoSummary && (
            <div style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              padding: '4px 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {autoSummary}
            </div>
          )}
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
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 72, textAlign: 'center' }}>
            {matchCount > 0 ? `${safeMatchIdx + 1} / ${matchCount}개 매칭` : (msgSearchQuery ? '0개 매칭' : '')}
            {isSearchPending && msgSearchQuery && (
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
            {pinnedOpen && pinnedMessages.map(m => {
              const msgIdx = displayMessages.findIndex(dm => dm.id === m.id)
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (msgIdx !== -1) virtualizer.scrollToIndex(msgIdx, { align: 'center', behavior: 'smooth' })
                  }}
                  style={{ padding: '6px 16px', fontSize: 12, borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                >
                  <span style={{ fontWeight: 600 }}>{m.role}: </span>
                  {m.text.slice(0, 120)}{m.text.length > 120 ? '…' : ''}
                </div>
              )
            })}
          </div>
        )
      })()}


      {/* Messages - virtualized */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
      {showOnlyBookmarks ? (
        /* ── 즐겨찾기 전용 뷰 ─────────────────────────────────────── */
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {(() => {
            const bookmarked = chat.messages.filter(m => m.bookmarked)
            const exportAll = () => {
              const blob = new Blob([JSON.stringify(bookmarked, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `bookmarks-${Date.now()}.json`
              a.click()
              URL.revokeObjectURL(url)
            }
            const exportOne = (msg: (typeof bookmarked)[number]) => {
              const blob = new Blob([JSON.stringify(msg, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `bookmark-${msg.id}.json`
              a.click()
              URL.revokeObjectURL(url)
            }
            if (!bookmarked.length) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>
                  즐겨찾기한 메시지가 없습니다
                </div>
              )
            }
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>즐겨찾기 {bookmarked.length}개</span>
                  <button
                    onClick={exportAll}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', fontSize: 10,
                      padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
                    }}
                  >전체 즐겨찾기 내보내기</button>
                </div>
                {bookmarked.map(msg => (
                  <div key={msg.id} style={{
                    marginBottom: 8, padding: '8px 10px',
                    background: 'var(--bg-secondary)', borderRadius: 6,
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {msg.role === 'user' ? '나' : 'Claude'} · {msg.timestamp ? new Date(msg.timestamp).toLocaleString('ko-KR') : ''}
                      </span>
                      <button
                        onClick={() => exportOne(msg)}
                        title="JSON 다운로드"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', fontSize: 12, padding: '0 4px',
                        }}
                      >📤</button>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'hidden' }}>
                      {msg.text.slice(0, 500)}{msg.text.length > 500 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </>
            )
          })()}
        </div>
      ) : (
      <div
        ref={scrollContainerRef}
        data-view-mode={chatViewMode}
        style={{ flex: 1, overflow: 'auto', position: 'relative', paddingRight: showMinimap && messageCount > 0 ? 42 : 0, padding: chatViewMode === 'wide' ? '0 10%' : undefined }}
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

              // fold: 해당 메시지가 접힌 상태면 스킵
              if (foldedMessages.has(msg.id)) return null

              // fold: fold 구간 시작점 직전에 토글 버튼 삽입
              const isFoldBoundary = foldedMessages.size > 0 &&
                virtualRow.index > 0 &&
                foldedMessages.has(displayMessages[virtualRow.index - 1]?.id ?? '')

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
                    marginTop: chatViewMode === 'wide' ? (isGrouped ? 4 : 16) : (isGrouped ? 2 : 8),
                  }}
                >
                  {isFoldBoundary && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 16px' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <button
                        onClick={toggleFoldMessages}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          padding: '3px 12px',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {foldedMessages.size}개 메시지 보이기
                      </button>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
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
                    onDelete={() => handleDeleteMessage(msg.id)}
                    onRetry={msg.role === 'user' && !chat.isStreaming ? () => handleRetryMessage(msg.id) : undefined}
                    viewMode={chatViewMode}
                    showTimestamp={showTimestamps}
                  />
                  {/* R701: 레이블 뱃지 + 메뉴 */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px 2px', minHeight: 16 }}>
                    {msgLabels[msg.id] && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 6px',
                        borderRadius: 8, background: MSG_LABEL_COLORS[msgLabels[msg.id]] + '33',
                        color: MSG_LABEL_COLORS[msgLabels[msg.id]], border: `1px solid ${MSG_LABEL_COLORS[msgLabels[msg.id]]}55`,
                        letterSpacing: '0.3px',
                      }}>
                        {msgLabels[msg.id]}
                      </span>
                    )}
                    <button
                      onClick={() => setShowLabelMenu(prev => prev === msg.id ? null : msg.id)}
                      title="레이블 설정"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: 11, padding: '0 2px', opacity: 0.5,
                      }}
                    >
                      #
                    </button>
                    {showLabelMenu === msg.id && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: 16, zIndex: 999,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: 4, display: 'flex', gap: 4,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      }}>
                        {MSG_LABEL_KINDS.map(kind => (
                          <button
                            key={kind}
                            onClick={() => setMsgLabel(msg.id, kind)}
                            style={{
                              background: msgLabels[msg.id] === kind ? MSG_LABEL_COLORS[kind] + '33' : 'transparent',
                              border: `1px solid ${MSG_LABEL_COLORS[kind]}55`,
                              borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
                              fontSize: 11, fontWeight: 600,
                              color: MSG_LABEL_COLORS[kind],
                            }}
                          >
                            {kind}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
      )} {/* end showOnlyBookmarks ternary */}
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
        <div
          className="suggestionBar"
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            gap: 6,
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            flexShrink: 0,
            alignItems: 'center',
            scrollbarWidth: 'none',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2, flexShrink: 0 }}>제안:</span>
          {suggestions.map((s, i) => {
            const isSelected = i === suggestionIndex
            return (
              <button
                key={i}
                onClick={() => { onSelectSuggestion(s); if (onDismissSuggestions) onDismissSuggestions() }}
                onMouseEnter={() => setSuggestionIndex(i)}
                onMouseLeave={() => setSuggestionIndex(-1)}
                style={{
                  background: isSelected ? 'rgba(82,139,255,0.25)' : 'rgba(82,139,255,0.1)',
                  border: isSelected ? '1px solid rgba(82,139,255,0.6)' : '1px solid rgba(82,139,255,0.3)',
                  borderRadius: 16,
                  fontSize: 12,
                  padding: '4px 12px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >{s}</button>
            )
          })}
          <button
            onClick={onDismissSuggestions}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 14, cursor: 'pointer', padding: '2px 6px', lineHeight: 1, marginLeft: 'auto', flexShrink: 0,
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
      {/* 변수 감지 인디케이터 */}
      {hasVars && !varModal && (
        <div style={{
          padding: '3px 12px',
          background: 'rgba(96,165,250,0.08)',
          borderTop: '1px solid rgba(96,165,250,0.2)',
          fontSize: 11,
          color: 'var(--accent, #89b4fa)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span>🔧</span>
          <span>변수 {extractVars(inputText).length}개 감지됨 — 전송 시 값 입력</span>
        </div>
      )}

      {/* 변수 치환 모달 */}
      {varModal && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px 8px 0 0',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
            padding: '14px 16px 12px',
            width: '100%',
            maxWidth: 560,
            pointerEvents: 'all',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent, #89b4fa)', marginBottom: 10 }}>
              🔧 변수 값 입력
            </div>
            {varModal.vars.map((varName, i) => (
              <div key={varName} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <label style={{
                  fontSize: 12, color: 'var(--text-secondary)',
                  minWidth: 120, fontFamily: 'monospace',
                  background: 'rgba(96,165,250,0.1)',
                  borderRadius: 4, padding: '2px 6px',
                  border: '1px solid rgba(96,165,250,0.2)',
                }}>
                  {'{{'}{varName}{'}}'}
                </label>
                <input
                  ref={el => { varInputRefs.current[i] = el }}
                  type="text"
                  value={varValues[varName] ?? ''}
                  onChange={e => setVarValues(prev => ({ ...prev, [varName]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (i < varModal.vars.length - 1) {
                        varInputRefs.current[i + 1]?.focus()
                      } else {
                        // 마지막 필드 Enter → 전송
                        let result = varModal.text
                        varModal.vars.forEach(v => {
                          result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), varValues[v] ?? '')
                        })
                        setVarModal(null)
                        handleSend(result)
                      }
                    } else if (e.key === 'Escape') {
                      setVarModal(null)
                    }
                  }}
                  placeholder={`${varName} 값 입력...`}
                  autoFocus={i === 0}
                  style={{
                    flex: 1,
                    background: 'var(--bg-input, var(--bg-primary))',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    padding: '5px 10px',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setVarModal(null)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  padding: '5px 14px',
                  cursor: 'pointer',
                }}
              >취소</button>
              <button
                onClick={() => {
                  let result = varModal.text
                  varModal.vars.forEach(v => {
                    result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), varValues[v] ?? '')
                  })
                  setVarModal(null)
                  handleSend(result)
                }}
                style={{
                  background: 'var(--accent, #89b4fa)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#1e1e2e',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '5px 16px',
                  cursor: 'pointer',
                }}
              >치환 후 전송</button>
            </div>
          </div>
        </div>
      )}

      {/* Context token indicator bar — 입력창 위 */}
      {(() => {
        const contextUsage = chat.sessionInputTokens > 0 ? Math.min(chat.sessionInputTokens / CONTEXT_WINDOW, 1.0) : 0
        if (contextUsage <= 0) return null
        const barColor = contextUsage >= 0.8 ? '#f87171' : contextUsage >= 0.5 ? '#fbbf24' : '#4ade80'
        return (
          <div
            title={`컨텍스트 ${Math.round(contextUsage * 100)}% 사용`}
            style={{ height: 3, background: 'var(--border)', flexShrink: 0, cursor: 'default' }}
          >
            <div style={{
              height: '100%',
              width: `${contextUsage * 100}%`,
              background: barColor,
              transition: 'width 0.3s ease',
            }} />
          </div>
        )
      })()}
      <InputBar
        onSend={handleSendWithVarCheck}
        onInterrupt={handleInterrupt}
        onPause={handlePause}
        onResume={handleResume}
        isPaused={isPaused}
        pausedTask={pausedTask}
        isStreaming={chat.isStreaming}
        disabled={!project.currentPath}
        focusTrigger={focusTrigger}
        pendingInsert={suggestionPendingInsert ?? welcomePendingInsert ?? pendingInsert}
        onPendingInsertConsumed={() => {
          if (suggestionPendingInsert) setSuggestionPendingInsert(undefined)
          else if (welcomePendingInsert) setWelcomePendingInsert(undefined)
          else onPendingInsertConsumed?.()
        }}
        onOpenPromptChain={onOpenPromptChain}
        onTextChange={setInputText}
      />

      {/* 키보드 단축키 오버레이 */}
      {showShortcutsOverlay && (
        <div
          onClick={() => setShowShortcutsOverlay(false)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '20px 28px',
              minWidth: 300,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>키보드 단축키</span>
              <button
                onClick={() => setShowShortcutsOverlay(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              >×</button>
            </div>
            {([
              ['Ctrl+F', '채팅 검색 토글'],
              ['Ctrl+B', '즐겨찾기 뷰 토글'],
              ['Ctrl+W', '뷰 모드 전환 (컴팩트/와이드)'],
              ['Escape', '검색 닫기'],
              ['?', '단축키 도움말'],
            ] as [string, string][]).map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                <kbd style={{
                  background: 'var(--bg-input, var(--bg-primary))',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--text-primary)',
                  minWidth: 80,
                  textAlign: 'center',
                  flexShrink: 0,
                }}>{key}</kbd>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
