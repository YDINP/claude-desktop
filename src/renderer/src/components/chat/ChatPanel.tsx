import React, { useEffect, useRef, useState, useCallback, useMemo, useTransition } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { ModelSelector } from './ModelSelector'
import { ExportConversationButton, ExportHtmlButton, ExportPdfButton, CopyConversationButton } from './ExportButtons'
import { MiniMap } from './MiniMap'
import { BookmarkView } from './BookmarkView'
import { VariableModal } from './VariableModal'
import { ShortcutsOverlay } from './ShortcutsOverlay'
import { SystemPromptEditor, SessionSummaryPanel, ChatSearchBar } from './ChatToolbar'
import {
  CONTEXT_WINDOW, foldThreshold, ACTION_PROMPTS,
  getMsgPosition, ContextUsageIndicator, StreamingSpinner, TypingIndicator,
  formatElapsed, formatTimeSep, MSG_LABEL_KINDS, MSG_LABEL_COLORS,
} from './chatUtils'
import { useChatStore } from '../../domains/chat/store'
import type { useProject } from '../../stores/project-store'
import type { ChatMessage } from '../../domains/chat/domain'
import { getActiveTerminalId } from '../../domains/terminal/store'
import { WelcomeScreen } from '../shared/WelcomeScreen'
import { useCCContext } from '../../hooks/useCCContext'
import { useCCFileContext } from '../../hooks/useCCFileContext'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useContextFiles } from '../../hooks/useContextFiles'
import { parseCCActions, executeCCActions } from '../../utils/cc-action-parser'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'

interface ChatPanelProps {
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
  onReplyToMessage?: (text: string) => void
  suggestions?: string[]
  onDismissSuggestions?: () => void
  recentSessions?: Array<{ id: string; title: string }>
  onSelectSession?: (id: string) => void
  hqMode?: boolean
  onToggleHQ?: () => void
  onOpenPromptChain?: () => void
}

/* Feature registry — extracted: BookmarkView(showOnlyBookmarks,exportAll,exportOne,bookmarkedMsgs), ExportButtons, ModelSelector(MODEL_DEFS,recent-model,modelHistory,modelFavorites), MiniMap, VariableModal(varModal,varValues,varInputRefs), ShortcutsOverlay, ChatToolbar(SystemPromptEditor,SessionSummaryPanel,ChatSearchBar), chatUtils(CONTEXT_WINDOW,ContextUsageIndicator,StreamingSpinner,TypingIndicator,formatElapsed,formatTimeSep)
 * Deferred: messageFolders,activeMsgFolder,msgFolder,msgSearchQuery,showMsgSearch,searchHighlights,searchHlIdx,searchFilter,showSearchFilter,reactionStats,showReactionStats,emojiReactions,showEmojiPicker,messageReactions,showReactionPicker,threadOpen,msgThreads,threadReplies,threadSummaries,threadSummaryLoading,threadingEnabled,activeThread,threadView,threadRoot,msgRatings,showRatingBar,qualityScores,showQualityPanel,summaryCards,showSummaryCard,convSummary,showSummaryPanel,msgSummaryView,summaryDepth,runningBlocks,blockOutputs,codeRunTarget,showCodeRunner,msgExpiry,showExpiredMsgs,exportTemplate,msgExportFormat,showMsgExportPanel,chatExportOptions,showExportOptions,chatExportFormat,showExportPanel,exportTarget,modelHistory,modelFavorites,streamSpeed,streamChunkSize,pausedStream,branchPoint,branches,translateLang,translating,chatTranslate,showTranslatePanel,translateEnabled,translateTarget,translationHistory,showTranslationHistory,pinnedMessages,showPinnedPanel,pinnedMsgs,showPinnedOnly,readReceipts,showReadReceipts,readStatus,showReadStatus,readMarkers,copyFormat,showCopyMenu,chatDraft,showDraftPanel,messageDrafts,showDraftList,bulkSelectMode,bulkSelected,encryptedMsgs,showEncryptionInfo,scheduledMsgs,messageSchedule,showSchedulePanel,msgSchedule,showScheduler,watermarkText,showWatermark,persona,personaList,activePersona,personaPrompt,systemPromptDraft,showSystemPromptEditor,msgCategories,categoryFilter,showCategoryFilter,messageCategories,activeMsgCategory,msgCategory,regenOptions,showRegenOptions,collapseThreshold,collapsedByDefault,collapsedMsgs,autoCollapse,contextUsage,showContextBar,msgTheme,msgDensity,conversationInsights,showInsightsPanel,messageAnalytics,showAnalyticsPanel,chatAnalytics,showAnalyticsDashboard,msgAnalytics,showAnalytics,msgStats,showMsgStats,chatNotes,showChatNotes,chatStats,showChatStats,sentimentMode,sentimentData,chatTheme,showThemeSelector,msgPriority,showPriorityFilter,timestampFormat,aiSuggestions,showAiSuggestions,aiAssistMode,aiAssistSuggestion,msgSearchFilter,msgSortOrder,showSortOptions,favMsgs,showFavMsgs,chatBg,showBgPicker,msgFormatMode,showFormatToolbar,foldedMsgs,msgFoldThreshold,msgColors,showColorPalette,shareTarget,showSharePanel,msgVotes,showVotePanel,inlinePreview,previewMaxHeight,msgBookmarks,msgStatus,showStatusPanel,forwardingMsg,forwardTarget,msgGroupBy,showGroupByPanel,chatReactions,chatFilter,chatFilterActive,chatFilterResults,chatGroupBy,showGroupPanel,chatPagination,showPaginationBar,chatSideBySide,sideBySideWidth,chatAccessibility,accessibilityConfig,chatVoice,voiceLanguage,showDensityPicker,chatPresets,showPresetPanel,chatCollaboration,collaborators,chatZoom,showZoomControls,chatReadAloud,readAloudSpeed,replyingTo,replyContext,chatWidgets,showWidgetPanel,chatBookmark,showBookmarkPanel,chatTags,showTagPanel,chatHistorySearch,historySearchResults,chatFontSize,chatFontFamily,bookmarkFolders,activeBookmarkFolder,messageBookmarks,messageTags,showTagFilter,messageLabels,showLabelPicker,showLabelMenu,msgLabels */
export function ChatPanel({ project, focusTrigger, searchTrigger, scrollToMessageId, onFork, onEditResend, onOpenFile, onImageClick, onCompressContext, pendingInsert, onPendingInsertConsumed, onReplyToMessage, suggestions, onDismissSuggestions, recentSessions, onSelectSession, hqMode, onToggleHQ, onOpenPromptChain }: ChatPanelProps) {
  const chat = useChatStore()
  const { features } = useFeatureFlags()
  const ccCtx = useCCContext()
  const ccFileCtx = useCCFileContext()
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
  const [scrollContainerHeight, setScrollContainerHeight] = useState(0)

  const onSelectSuggestion = useCallback((text: string) => {
    setSuggestionPendingInsert(text)
    setSuggestionIndex(-1)
  }, [])

  // ── 뷰 모드 (compact / wide) ──────────────────────────────────────────────
  const [chatViewMode, setChatViewMode] = useState<'compact' | 'wide'>(() =>
    (localStorage.getItem('chat-view-mode') as 'compact' | 'wide') ?? 'compact'
  )

  // ── 채팅 밀도 모드 ─────────────────────────────────────────────────────────
  const [chatDensity, setChatDensity] = useState<'compact' | 'normal' | 'focus'>(() =>
    (localStorage.getItem('chat-density') as any) ?? 'normal'
  )
  useEffect(() => { localStorage.setItem('chat-density', chatDensity) }, [chatDensity])
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

  // R1474: cc-chat-prefill 이벤트 → 입력창 프리필 (씬 AI 분석)
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string; message?: string; imageBase64?: string }
      const msg = detail.text ?? detail.message ?? ''
      if (msg) setInputText(prev => prev ? prev + '\n\n' + msg : msg)
    }
    window.addEventListener('cc-chat-prefill', onPrefill)
    return () => window.removeEventListener('cc-chat-prefill', onPrefill)
  }, [])
  const [varValues, setVarValues] = useState<Record<string, string>>({})

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

  const handleSearchChange = useCallback((value: string) => {
    startSearchTransition(() => {
      setSearchQuery(value)
      setMatchIdx(0)
    })
  }, [])

  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false)
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

  const contentPaddingStart = Math.max(0, scrollContainerHeight - (displayMessages.length * 250) - 40)

  const virtualizer = useVirtualizer({
    count: displayMessages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 250,
    overscan: 5,
    paddingStart: contentPaddingStart,
  })

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
      // R1412: AI 응답에서 노드 이름 추출 → SceneView 하이라이트 이벤트 발생
      {
        const lastMsg = chat.messages[messageCount - 1]
        if (lastMsg?.role === 'assistant' && lastMsg.text) {
          const nodeNames = new Set<string>()
          const patterns = [/[`"]([A-Za-z_][\w\- ]{1,39})[`"]/g]
          for (const pat of patterns) {
            let m: RegExpExecArray | null
            while ((m = pat.exec(lastMsg.text)) !== null) {
              nodeNames.add(m[1])
            }
          }
          for (const nodeName of nodeNames) {
            window.dispatchEvent(new CustomEvent('cc-highlight-node', { detail: { nodeName } }))
          }
        }
      }
    }
    prevStreamingRef.current = chat.isStreaming
  }, [chat.isStreaming, messageCount, virtualizer, ccCtx.connected, chat.messages])

  const bookmarkIdxRef = useRef(0)
  const [foldedMessages, setFoldedMessages] = useState<Set<string>>(new Set())

  // R701: 메시지 카테고리 레이블
  const [msgLabels, setMsgLabels] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('msg-labels') ?? '{}') } catch { return {} }
  })
  const [showLabelMenu, setShowLabelMenu] = useState<string | null>(null)
  const setMsgLabel = useCallback((messageId: string, label: string) => {
    setMsgLabels(prev => {
      const next = { ...prev }
      if (next[messageId] === label) { delete next[messageId] } else { next[messageId] = label }
      try { localStorage.setItem('msg-labels', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    setShowLabelMenu(null)
  }, [])

  const msgFoldThreshold = 500

  const toggleFoldMessages = useCallback(() => {
    if (displayMessages.length < foldThreshold) return
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

  // ── Workflow inject ref
  const workflowPromptRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.systemPrompt) {
        workflowPromptRef.current = detail.systemPrompt
      }
    }
    window.addEventListener('workflow-inject', handler)
    return () => window.removeEventListener('workflow-inject', handler)
  }, [])

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
      const wfPrompt = workflowPromptRef.current
      workflowPromptRef.current = null
      const parts = [resolvedSystemPrompt, wfPrompt, projectSummary, ccCtx.contextString, ccFileCtx.contextString, ctxFiles.contextString].filter(Boolean)
      const extraSystemPrompt = parts.length > 0 ? parts.join('\n\n') : undefined
      window.api.claudeSend({
        text,
        cwd: project.currentPath,
        model,
        ...(extraSystemPrompt ? { extraSystemPrompt } : {}),
      })
    }
  }, [project.currentPath, project.selectedModel, chat.addUserMessage, chat.messages, ccCtx.contextString, ccFileCtx.contextString, projectSummary, customSystemPrompt, ctxFiles.contextString, autoSetTitle])

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
    chat.togglePin(messageId)
  }, [chat.togglePin, chat.messages])

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
        {features.sessionExport && (
          <>
            <ExportConversationButton messages={chat.messages} />
            <ExportHtmlButton messages={chat.messages} sessionName={chat.messages.find(m => m.role === 'user')?.text.slice(0, 30).replace(/[^\w\s가-힣]/g, '').trim()} />
            <ExportPdfButton messages={chat.messages} sessionId={chat.sessionId} />
          </>
        )}
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
        {(['compact', 'normal', 'focus'] as const).map(d => (
          <button
            key={d}
            onClick={() => setChatDensity(d)}
            title={d === 'compact' ? '촘촘 보기' : d === 'normal' ? '기본 보기' : '집중 보기'}
            style={{
              background: chatDensity === d ? 'var(--accent, #89b4fa)' : 'none',
              border: 'none',
              color: chatDensity === d ? '#1e1e2e' : 'var(--text-muted)',
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              padding: '1px 5px', lineHeight: '16px', borderRadius: 4,
            }}
          >{d === 'compact' ? 'C' : d === 'normal' ? 'N' : 'F'}</button>
        ))}
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
        {chat.messages.length >= msgFoldThreshold && (
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

      {showSystemPrompt && (
        <SystemPromptEditor customSystemPrompt={customSystemPrompt} setCustomSystemPrompt={setCustomSystemPrompt} onClose={() => setShowSystemPrompt(false)} />
      )}

      {summaryOpen && (
        <SessionSummaryPanel summaryLoading={summaryLoading} summaryText={summaryText} onRegenerate={handleSummarize} onClose={() => setSummaryOpen(false)} />
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

      {showSearch && (
        <ChatSearchBar
          searchQuery={searchQuery} matchCount={matchCount} safeMatchIdx={safeMatchIdx}
          isSearchPending={isSearchPending} searchInputRef={searchInputRef}
          onSearchChange={handleSearchChange} onSearchPrev={handleSearchPrev}
          onSearchNext={handleSearchNext} onSearchKeyDown={handleSearchKeyDown}
          onClose={() => setShowSearch(false)}
        />
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
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          <BookmarkView messages={chat.messages} />
        </div>
      ) : (<>
      <div
        ref={scrollContainerRef}
        data-view-mode={chatViewMode}
        style={{
          flex: 1, overflow: 'auto', position: 'relative',
          paddingRight: showMinimap && messageCount > 0 ? 42 : 0,
          padding: chatViewMode === 'wide' ? '0 10%' : undefined,
          fontSize: chatDensity === 'compact' ? 11 : chatDensity === 'focus' ? 14 : undefined,
        }}
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
                    marginTop: chatDensity === 'compact' ? (isGrouped ? 1 : 4) : chatDensity === 'focus' ? (isGrouped ? 8 : 16) : (chatViewMode === 'wide' ? (isGrouped ? 4 : 16) : (isGrouped ? 2 : 8)),
                    ...(chatDensity === 'focus' ? { maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' } : {}),
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
      </>
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
            className="scroll-to-bottom-streaming"
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
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="맨 아래로 스크롤 (자동 스크롤 재개)"
          >
            <span className="scroll-pulse-dot" />
            ↓ 새 메시지 수신 중
          </button>
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
        <VariableModal
          varModal={varModal}
          varValues={varValues}
          onVarValuesChange={setVarValues}
          onCancel={() => setVarModal(null)}
          onSend={handleSend}
        />
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
        projectPath={project.currentPath}
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

      {showShortcutsOverlay && <ShortcutsOverlay onClose={() => setShowShortcutsOverlay(false)} />}
    </div>
  )
}
