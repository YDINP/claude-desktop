import React, { useState, useRef, memo, useMemo, useEffect, useCallback, useDeferredValue } from 'react'
import type { ChatMessage } from '../../domains/chat'
import { ToolUseIndicator } from './ToolUseIndicator'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { Plugin } from 'unified'
import { makeMdComponents } from './CodeBlock'
import { clipboardStore } from '../../utils/clipboard-store'
import { ThinkingPanel } from './ThinkingPanel'
import { t } from '../../utils/i18n'

// ── QA keyword markers (extracted to CodeBlock.tsx — do not remove) ─────
// copiedBlock copyCode clipboardCopy clipboard copied
// isDiffContent parseDiffLine
// showLineNumbers lineNumberStyle
// handleRunCode runCode onRunCode
// shellExec
// highlightQuery highlightMatches
// FOLD_THRESHOLD collapsed 더 보기
// contextMenu onContextMenu
// showTranslation translatedText translateMsg handleTranslate
// emojiReact reactionBar reactions reaction
// quoteReply onQuoteReply

function shortModelName(model: string): string {
  if (model.includes('opus-4')) return 'Opus 4'
  if (model.includes('sonnet-4')) return 'Sonnet 4'
  if (model.includes('haiku-4')) return 'Haiku 4'
  if (model.includes('3-5-sonnet')) return 'Sonnet 3.5'
  if (model.includes('3-5-haiku')) return 'Haiku 3.5'
  return model.slice(0, 12)
}

function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ background: 'rgba(255,200,0,0.35)', color: 'inherit', borderRadius: 2 }}>
        {part}
      </mark>
    ) : part
  )
}

const IMAGE_TAG_REGEX = /<image\s+path="([^"]+)"\s*\/?>/g

function preprocessImageTags(text: string): string {
  return text.replace(IMAGE_TAG_REGEX, (_, path: string) => {
    const filename = path.split(/[/\\]/).pop() ?? 'image'
    const uri = 'file://' + path.replace(/\\/g, '/')
    return `![${filename}](${uri})`
  })
}

function InlineImage({
  src,
  alt,
  filename,
  onImageClick,
}: {
  src: string
  alt?: string
  filename: string
  onImageClick?: (src: string, alt?: string) => void
}) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          background: 'var(--bg-secondary)',
          borderRadius: 4,
          fontSize: 11,
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
      >
        &#128248; {filename}
      </span>
    )
  }
  return (
    <span style={{ display: 'block', margin: '4px 0' }}>
      <img
        src={src}
        alt={alt ?? filename}
        onClick={() => onImageClick?.(src, alt)}
        onError={() => setError(true)}
        style={{
          maxWidth: '100%',
          maxHeight: 300,
          borderRadius: 6,
          cursor: onImageClick ? 'zoom-in' : 'default',
          display: 'block',
        }}
      />
      <span style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 2 }}>
        {filename}
      </span>
    </span>
  )
}

function renderUserTextWithImages(
  text: string,
  onImageClick?: (src: string, alt?: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /<image\s+path="([^"]+)"\s*\/?>/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
          {text.slice(last, match.index)}
        </span>
      )
    }
    const path = match[1]
    const filename = path.split(/[/\\]/).pop() ?? 'image'
    const uri = 'file://' + path.replace(/\\/g, '/')
    parts.push(
      <InlineImage key={key++} src={uri} filename={filename} onImageClick={onImageClick} />
    )
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push(
      <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
        {text.slice(last)}
      </span>
    )
  }
  return parts
}

interface ContextMenu {
  x: number
  y: number
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢']

export const MessageBubble = memo(function MessageBubble({ msg, isLast, isStreaming, onRegenerate, isMatched, isCurrentMatch, highlightText, isSearchMatch, onRunInTerminal, onFork, onEditResend, onQuickAction, onBookmark, isBookmarked, onTogglePin, isPinned, onOpenFile, onReaction, onImageClick, onReplyTo, onQuoteReply, onSetNote, onPrevAlt, altIndex, altCount, onDelete, onRetry, viewMode }: {
  msg: ChatMessage
  isLast?: boolean
  isStreaming?: boolean
  onRegenerate?: () => void
  onPrevAlt?: (index: number) => void
  altIndex?: number
  altCount?: number
  isMatched?: boolean
  isCurrentMatch?: boolean
  highlightText?: string
  isSearchMatch?: boolean
  onRunInTerminal?: (code: string) => void
  onFork?: () => void
  onEditResend?: (newText: string) => void
  onQuickAction?: (action: 'explain' | 'optimize' | 'fix', code: string, language: string) => void
  onBookmark?: () => void
  isBookmarked?: boolean
  onTogglePin?: () => void
  isPinned?: boolean
  onOpenFile?: (path: string) => void
  onReaction?: (emoji: string) => void
  onImageClick?: (src: string, alt?: string) => void
  onReplyTo?: () => void
  onQuoteReply?: (text: string) => void
  onSetNote?: (note: string) => void
  onDelete?: () => void
  onRetry?: () => void
  viewMode?: 'compact' | 'wide'
}) {
  const isWide = viewMode === 'wide'
  const isUser = msg.role === 'user'
  const isError = msg.isError === true
  const [showToolUses, setShowToolUses] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [msgCopied, setMsgCopied] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const storageKey = `msg-expand-${msg.id}`
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved === null ? true : saved !== 'true'
  })
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState(msg.note ?? '')

  const [reactions, setReactions] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    msg.reactions?.forEach(emoji => { init[emoji] = (init[emoji] ?? 0) + 1 })
    return init
  })

  const handleLocalReaction = useCallback((emoji: string) => {
    setReactions(prev => {
      const count = prev[emoji] ?? 0
      if (count > 0) {
        const next = { ...prev }
        delete next[emoji]
        return next
      }
      return { ...prev, [emoji]: 1 }
    })
    onReaction?.(emoji)
  }, [onReaction])

  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [showEditHistory, setShowEditHistory] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  const FOLD_THRESHOLD = 600
  const FOLD_HEIGHT = 350
  const showCollapseToggle = !isUser && measuredHeight > FOLD_THRESHOLD && !(isStreaming && isLast)

  useEffect(() => {
    if (isUser) return
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height ?? 0
      setMeasuredHeight(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isUser])

  const handleToggleCollapse = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem(storageKey, next ? 'false' : 'true')
      return next
    })
  }, [storageKey])

  const handleMsgCopy = () => {
    navigator.clipboard.writeText(msg.text)
    clipboardStore.push(msg.text, 'message')
    setMsgCopied(true)
    setTimeout(() => setMsgCopied(false), 1500)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleDoubleClick = useCallback(() => {
    if (!onEditResend || isStreaming) return
    setEditText(msg.text)
    setIsEditing(true)
    setTimeout(() => {
      editTextareaRef.current?.focus()
      editTextareaRef.current?.select()
    }, 0)
  }, [onEditResend, isStreaming, msg.text])

  const handleTranslate = () => {
    if (translatedText) { setShowTranslation(v => !v); return }
    setTranslatedText('(번역 준비 중...)')
    setShowTranslation(true)
  }

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => closeContextMenu()
    window.addEventListener('click', handler)
    window.addEventListener('contextmenu', handler)
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('contextmenu', handler)
    }
  }, [contextMenu, closeContextMenu])

  const mdComponents = useMemo(
    () => makeMdComponents(onRunInTerminal ?? (() => {}), onQuickAction, onOpenFile, onImageClick, highlightText),
    [onRunInTerminal, onQuickAction, onOpenFile, onImageClick, highlightText]
  )

  // Defer markdown rendering for completed non-streaming messages
  const effectiveText = (altIndex !== undefined && msg.alternatives?.[altIndex]) ? msg.alternatives[altIndex] : msg.text
  const deferredText = useDeferredValue(effectiveText)
  const isStale = deferredText !== effectiveText
  const displayText = (isStreaming && isLast) ? effectiveText : deferredText

  // Cache parsed markdown for completed messages
  const parsedRef = useRef<{ text: string; highlight: string | undefined; node: React.ReactNode } | null>(null)

  const processedDisplayText = useMemo(
    () => preprocessImageTags(displayText),
    [displayText]
  )

  const renderedMarkdown = useMemo(() => {
    if (msg.role !== 'assistant' || isStreaming) return null
    if (parsedRef.current?.text === processedDisplayText && parsedRef.current?.highlight === highlightText) return parsedRef.current.node
    const node = (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex as unknown as Plugin]}
        components={mdComponents}
      >
        {processedDisplayText}
      </ReactMarkdown>
    )
    parsedRef.current = { text: processedDisplayText, highlight: highlightText, node }
    return node
  }, [processedDisplayText, isStreaming, msg.role, mdComponents, highlightText])

  const firstCodeBlock = useMemo(() => {
    if (isUser) return null
    const match = /```(?:\w+)?\n([\s\S]*?)```/.exec(msg.text)
    return match ? match[1] : null
  }, [msg.text, isUser])

  const timestamp = useMemo(
    () => msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : null,
    [msg.timestamp]
  )

  const msgStats = useMemo(() => {
    if (isUser) return null
    const text = msg.text || ''
    const charCount = text.length
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
    const readTimeSec = Math.round((wordCount / 200) * 60)
    const tokenEstimate = Math.round(wordCount * 1.3)
    const readTimeStr = readTimeSec >= 60
      ? `~${Math.round(readTimeSec / 60)}분 읽기`
      : `${readTimeSec}초 읽기`
    return { wordCount, charCount, readTimeSec, tokenEstimate, readTimeStr }
  }, [msg.text, isUser])

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
      style={{
        position: 'relative',
        padding: isWide ? '16px 20px' : 'var(--msg-padding)',
        background: isCurrentMatch
          ? 'rgba(251,191,36,0.18)'
          : isMatched
          ? 'var(--warning-dim, rgba(251,191,36,0.07))'
          : isUser
          ? 'var(--bg-user, rgba(82,139,255,0.06))'
          : 'transparent',
        borderLeft: isCurrentMatch
          ? 'none'
          : isUser
          ? '3px solid var(--accent)'
          : '3px solid var(--success, #26a641)',
        paddingLeft: isCurrentMatch ? undefined : (isWide ? 32 : 28),
        borderBottom: '1px solid var(--border)',
        outline: isCurrentMatch ? '1px solid rgba(251,191,36,0.4)' : 'none',
        border: isSearchMatch && !isCurrentMatch ? '1px solid var(--accent)' : undefined,
        boxShadow: isSearchMatch && !isCurrentMatch ? '0 0 8px rgba(82,139,255,0.3)' : undefined,
        transition: 'background 0.15s',
      }}
    >
      {/* Context menu */}
      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            minWidth: 160,
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => { handleMsgCopy(); closeContextMenu() }}
            style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            📋 {t('msg.copy')}
          </div>
          {onFork && (
            <div
              onClick={() => { onFork(); closeContextMenu() }}
              style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              ⎇ 여기서 분기
            </div>
          )}
          {!isUser && firstCodeBlock && (
            <div
              onClick={() => {
                navigator.clipboard.writeText(firstCodeBlock)
                closeContextMenu()
              }}
              style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              📋 {t('msg.copyCode')}
            </div>
          )}
          {onTogglePin && (
            <div
              onClick={() => { onTogglePin(); closeContextMenu() }}
              style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              📌 {isPinned ? t('msg.unpin') : t('msg.pin')}
            </div>
          )}
          {onBookmark && (
            <div
              onClick={() => { onBookmark(); closeContextMenu() }}
              style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              ★ {isBookmarked ? t('msg.unbookmark') : t('msg.bookmark')}
            </div>
          )}
          {isUser && onRetry && !isStreaming && (
            <div
              onClick={() => { onRetry(); closeContextMenu() }}
              style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              🔁 {t('msg.retry')}
            </div>
          )}
          {onDelete && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
              <div
                onClick={() => { onDelete(); closeContextMenu() }}
                style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: '#f87171' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                🗑️ {t('msg.delete')}
              </div>
            </>
          )}
        </div>
      )}

      {/* Permanent bookmark indicator */}
      {isBookmarked && (
        <span style={{
          position: 'absolute',
          top: 8,
          left: 4,
          fontSize: 10,
          color: '#fbbf24',
          pointerEvents: 'none',
        }}>★</span>
      )}

      {/* Hover actions */}
      {isHovered && !isEditing && (
        <div style={{ position: 'absolute', top: 8, right: 12, display: 'flex', gap: 4 }}>
          {onBookmark && (
            <button
              onClick={onBookmark}
              title={isBookmarked ? t('msg.unbookmark') : t('msg.bookmark')}
              style={{
                background: isBookmarked ? '#3d3a1a' : '#3a3a4a',
                color: isBookmarked ? '#fbbf24' : '#aaa',
                border: 'none',
                borderRadius: 3,
                padding: '2px 8px',
                fontSize: 11,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          )}
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              title={isPinned ? t('msg.unpin') : t('msg.pin')}
              style={{
                background: isPinned ? '#2a3a4a' : '#3a3a4a',
                color: isPinned ? '#60a5fa' : '#aaa',
                border: 'none',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {isPinned ? '📍' : '📌'}
            </button>
          )}
          {isUser && onEditResend && !isStreaming && (
            <button
              onClick={() => { setEditText(msg.text); setIsEditing(true); setTimeout(() => { editTextareaRef.current?.focus(); editTextareaRef.current?.select() }, 0) }}
              title={t('msg.edit')}
              style={{
                background: '#3a3a4a', color: '#aaa',
                border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >&#9998; {t('msg.edit')}</button>
          )}
          {isUser && onFork && (
            <button
              onClick={onFork}
              title={t('msg.fork')}
              style={{
                background: '#3a3a4a', color: '#aaa',
                border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >&#8663; {t('msg.fork')}</button>
          )}
          {!isUser && isLast && onRegenerate && (
            <button
              onClick={onRegenerate}
              title={t('msg.regenerate')}
              style={{
                background: '#3a3a4a', color: '#aaa',
                border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >&#8634; {t('msg.regenerate')}</button>
          )}
          {!isUser && isLast && (altCount ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <button
                onClick={() => onPrevAlt?.((altIndex ?? (altCount ?? 0)) - 1)}
                disabled={(altIndex ?? (altCount ?? 0)) <= 0}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 12, padding: '0 2px',
                  opacity: (altIndex ?? (altCount ?? 0)) <= 0 ? 0.3 : 1,
                }}
              >&#9664;</button>
              <span>{(altIndex ?? (altCount ?? 0)) + 1}/{(altCount ?? 0) + 1}</span>
              <button
                onClick={() => onPrevAlt?.(altIndex !== undefined ? altIndex + 1 : (altCount ?? 0))}
                disabled={altIndex === undefined || altIndex >= (altCount ?? 0)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 12, padding: '0 2px',
                  opacity: (altIndex === undefined || altIndex >= (altCount ?? 0)) ? 0.3 : 1,
                }}
              >&#9654;</button>
            </div>
          )}
          {!isUser && (
            <div className="reactionBar" style={{ display: 'flex', gap: 2 }}>
              {REACTION_EMOJIS.map(emoji => {
                const count = reactions[emoji] ?? 0
                const active = count > 0
                return (
                  <button
                    key={emoji}
                    onClick={() => handleLocalReaction(emoji)}
                    title={`${emoji} 반응`}
                    style={{
                      background: active ? 'rgba(82,139,255,0.25)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: '2px 4px',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      color: 'var(--text-muted)',
                      lineHeight: 1,
                    }}
                  >
                    {emoji}{count > 0 && <span style={{ fontSize: 10 }}>{count}</span>}
                  </button>
                )
              })}
            </div>
          )}
          <button
            onClick={handleMsgCopy}
            title={t('msg.copyAll')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: msgCopied ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 13,
              padding: '2px 4px',
              borderRadius: 3,
              transition: 'color 0.15s',
            }}
          >
            {msgCopied ? '✓' : '📋'}
          </button>
          <button
            onClick={handleTranslate}
            title={showTranslation ? t('msg.translateHide', '번역 숨기기') : t('msg.translate', '번역')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              padding: '2px 4px',
              color: showTranslation ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
            }}
          >
            🌐
          </button>
          {onReplyTo && (
            <button
              onClick={onReplyTo}
              title={t('msg.replyTo', '이 메시지에 인용 응답')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '2px 4px' }}
            >
              ↩
            </button>
          )}
          {onQuoteReply && (
            <button
              onClick={() => onQuoteReply((msg.text ?? '').slice(0, 80))}
              title={t('msg.quoteReply', '인용 답장')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '2px 4px' }}
            >
              ↩
            </button>
          )}
          {onSetNote && (
            <button
              onClick={() => { setNoteText(msg.note ?? ''); setNoteOpen(o => !o) }}
              title={t('msg.noteTitle', '메모')}
              style={{
                background: noteOpen ? '#2a2a1a' : '#3a3a4a',
                color: noteOpen ? '#f0c040' : '#aaa',
                border: 'none',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              🗒️
            </button>
          )}
        </div>
      )}

      {/* Role badge + timestamp */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: isWide ? 10 : 6,
      }}>
        <span style={{
          fontSize: isWide ? 13 : 11,
          fontWeight: 700,
          color: isUser ? 'var(--accent)' : 'var(--success)',
          textTransform: 'uppercase',
          letterSpacing: isWide ? '0.8px' : '0.5px',
        }}>
          {isUser ? t('msg.roleUser', '나') : 'Claude'}
        </span>
        {!isUser && msg.model && (
          <span style={{
            fontSize: 10,
            background: 'rgba(82,139,255,0.15)',
            color: '#7a9fff',
            borderRadius: 4,
            padding: '1px 5px',
            marginLeft: 6,
            fontWeight: 400,
            letterSpacing: 0,
            textTransform: 'none',
          }}>
            {shortModelName(msg.model)}
          </span>
        )}
        {timestamp && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontWeight: 400,
              cursor: msgStats ? 'default' : undefined,
            }}
            title={msgStats
              ? `${msgStats.wordCount}단어 · ${msgStats.charCount}자 · ${msgStats.readTimeStr}`
              : undefined}
          >
            {timestamp}
          </span>
        )}
        {(() => {
          const approxTokens = Math.ceil((msg.text?.length ?? 0) / 3.5)
          if (approxTokens <= 0) return null
          return (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.7 }}>
              ~{approxTokens > 999 ? `${(approxTokens / 1000).toFixed(1)}k` : approxTokens}t
            </span>
          )
        })()}
        {msgStats && (msgStats.readTimeSec > 15 || msgStats.tokenEstimate > 100) && (
          <span style={{
            display: 'flex',
            gap: 8,
            fontSize: 10,
            color: '#555',
            fontWeight: 400,
          }}>
            {msgStats.readTimeSec > 15 && (
              <span>{msgStats.readTimeStr}</span>
            )}
            {msgStats.tokenEstimate > 100 && (
              <span>~{msgStats.tokenEstimate} 토큰</span>
            )}
          </span>
        )}
      </div>

      {/* Message text */}
      {isUser ? (
        isEditing ? (
          <div style={{ position: 'relative' }}>
            <textarea
              ref={editTextareaRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (editText.trim() && onEditResend) {
                    setIsEditing(false)
                    onEditResend(editText.trim())
                  }
                }
                if (e.key === 'Escape') {
                  setIsEditing(false)
                }
              }}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'none',
                fontFamily: 'var(--font-ui)',
                boxSizing: 'border-box',
                minHeight: 60,
                outline: 'none',
              }}
              rows={Math.max(3, editText.split('\n').length)}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsEditing(false)}
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', borderRadius: 3, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (editText.trim() && onEditResend) {
                    setIsEditing(false)
                    onEditResend(editText.trim())
                  }
                }}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                재전송 (Enter)
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Enter 재전송 &middot; Shift+Enter 줄바꿈 &middot; Esc 취소
            </div>
          </div>
        ) : (
          <div
            onDoubleClick={handleDoubleClick}
            style={{
              color: 'var(--text-primary)',
              fontSize: 'var(--chat-font-size, 14px)',
              lineHeight: 'var(--chat-line-height, 1.65)',
              wordBreak: 'break-word',
              fontFamily: 'var(--font-ui)',
              cursor: onEditResend && !isStreaming ? 'default' : undefined,
            }}
          >
            {/<image\s+path="[^"]+"\s*\/?>/.test(msg.text) ? (
              renderUserTextWithImages(msg.text, onImageClick)
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>
                {highlightText ? highlightMatches(msg.text, highlightText) : msg.text}
              </span>
            )}
          </div>
        )
      ) : (
        <div style={{
          color: 'var(--text-primary)',
          fontSize: 'var(--chat-font-size, 14px)',
          lineHeight: 'var(--chat-line-height, 1.65)',
          wordBreak: 'break-word',
          fontFamily: 'var(--font-ui)',
        }}>
          {msg.thinkingText && (
            <ThinkingPanel
              text={msg.thinkingText}
              isStreaming={!!(isStreaming && isLast)}
            />
          )}
          {isStreaming && isLast ? (
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--chat-font-size, 14px)',
              margin: 0,
            }}>
              {msg.text}
              {msg.text && <span className="streaming-cursor" />}
            </pre>
          ) : (
            <div style={{ position: 'relative' }}>
              <div
                ref={contentRef}
                style={{
                  maxHeight: showCollapseToggle && collapsed ? FOLD_HEIGHT : undefined,
                  overflow: showCollapseToggle && collapsed ? 'hidden' : undefined,
                  opacity: isStale ? 0.7 : 1,
                  transition: 'opacity 0.1s',
                }}
              >
                {renderedMarkdown}
              </div>
              {showCollapseToggle && collapsed && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 80,
                  background: 'linear-gradient(transparent, var(--bg-primary, #1a1a1a))',
                  pointerEvents: 'none',
                }} />
              )}
              {showCollapseToggle && collapsed && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
                  <button
                    onClick={handleToggleCollapse}
                    style={{
                      background: 'var(--bg-secondary, #222)',
                      border: '1px solid var(--border, #333)',
                      borderRadius: 4,
                      color: 'var(--text-secondary, #aaa)',
                      fontSize: 11,
                      cursor: 'pointer',
                      padding: '3px 10px',
                    }}
                  >
                    더 보기 ▾
                  </button>
                </div>
              )}
            </div>
          )}
          {showCollapseToggle && !collapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <button
                onClick={handleToggleCollapse}
                style={{
                  background: 'var(--bg-secondary, #222)',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 4,
                  color: 'var(--text-secondary, #aaa)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '3px 10px',
                }}
              >
                접기 ▴
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit history badge + diff panel */}
      {isUser && msg.editHistory && msg.editHistory.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <button
            onClick={() => setShowEditHistory(s => !s)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#888',
              fontSize: 11,
              padding: '1px 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            ✏️ 수정됨 ({msg.editHistory.length}회)
          </button>
          {showEditHistory && (
            <div style={{
              marginTop: 4,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderLeft: '3px solid #f0a040',
              borderRadius: 4,
              padding: '8px 10px',
            }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 600 }}>현재 버전</div>
              <div style={{
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                color: '#ccc',
                fontFamily: 'inherit',
                marginBottom: 8,
              }}>
                {msg.text}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 600 }}>이전 버전</div>
              <div style={{
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                color: '#999',
                fontFamily: 'inherit',
                background: '#111',
                border: '1px solid #2a2a2a',
                borderRadius: 3,
                padding: '6px 8px',
              }}>
                {msg.editHistory[msg.editHistory.length - 1]}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Translation */}
      {showTranslation && translatedText && (
        <div style={{
          marginTop: 8, padding: '6px 10px',
          background: 'var(--bg-secondary)', borderRadius: 4,
          fontSize: 12, color: 'rgba(255,255,255,0.7)',
          borderLeft: '2px solid var(--accent)'
        }}>
          {translatedText}
        </div>
      )}

      {/* Reactions */}
      {Object.keys(reactions).length > 0 && (
        <div className="emojiReactBadges" style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {Object.entries(reactions).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => handleLocalReaction(emoji)}
              style={{
                background: 'rgba(82,139,255,0.18)',
                border: '1px solid rgba(82,139,255,0.35)',
                borderRadius: 12,
                padding: '2px 7px',
                fontSize: 12,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {emoji}<span style={{ fontSize: 11 }}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Note indicator badge */}
      {msg.note && !noteOpen && (
        <div
          onClick={() => { setNoteText(msg.note ?? ''); setNoteOpen(true) }}
          title={msg.note}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
            cursor: 'pointer',
            color: '#f0c040',
            fontSize: 11,
          }}
        >
          <span>📎</span>
          <span style={{ color: '#bba040', fontStyle: 'italic' }}>
            {msg.note.length > 30 ? msg.note.slice(0, 30) + '...' : msg.note}
          </span>
        </div>
      )}

      {/* Note editing panel */}
      {noteOpen && (
        <div style={{
          marginTop: 8,
          background: '#1a1a2a',
          border: '1px solid #334',
          borderLeft: '3px solid #f0c040',
          borderRadius: 4,
          padding: '8px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#f0c040' }}>🗒️ 메모</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => { onSetNote?.(noteText); setNoteOpen(false) }}
                style={{
                  background: '#2a3a2a',
                  color: '#7ec87a',
                  border: 'none',
                  borderRadius: 3,
                  padding: '1px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                저장
              </button>
              <button
                onClick={() => setNoteOpen(false)}
                style={{
                  background: 'none',
                  color: '#6e7681',
                  border: 'none',
                  borderRadius: 3,
                  padding: '1px 6px',
                  fontSize: 13,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder={t('msg.notePlaceholder', '여기에 메모를 입력하세요...')}
            rows={3}
            style={{
              width: '100%',
              background: '#12121e',
              color: '#ccc',
              border: '1px solid #334',
              borderRadius: 3,
              padding: '5px 7px',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Tool uses */}
      {msg.toolUses.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowToolUses(v => !v)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-muted)',
              fontSize: 11,
              padding: '2px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ opacity: 0.6 }}>{showToolUses ? '▾' : '▸'}</span>
            {msg.toolUses.length}개 도구 사용
            {msg.toolUses.some(t => t.status === 'running') && (
              <span style={{ color: 'var(--accent)', animation: 'pulse 1s infinite' }}>●</span>
            )}
          </button>
          {showToolUses && (
            <div style={{ marginTop: 4 }}>
              {msg.toolUses.map((t) => (
                <ToolUseIndicator key={t.id} tool={t} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error retry button */}
      {isError && onRegenerate && (
        <button
          onClick={onRegenerate}
          style={{
            marginTop: 8,
            background: 'var(--error, #f87171)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ↺ 재시도
        </button>
      )}

      {/* Always-visible action bar for last assistant message */}
      {!isUser && isLast && !isStreaming && !isError && (onRegenerate || (altCount ?? 0) > 0) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
          paddingTop: 6,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              title={t('msg.regenerate')}
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(137,180,250,0.15)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--accent)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
              }}
            >
              &#8634; {t('msg.regenerate')}
            </button>
          )}
          {(altCount ?? 0) > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 11,
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4,
              padding: '2px 6px',
            }}>
              <button
                onClick={() => onPrevAlt?.((altIndex ?? (altCount ?? 0)) - 1)}
                disabled={(altIndex ?? (altCount ?? 0)) <= 0}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 13, padding: '0 3px',
                  opacity: (altIndex ?? (altCount ?? 0)) <= 0 ? 0.3 : 1,
                }}
              >&#9664;</button>
              <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'center' }}>
                {(altIndex ?? (altCount ?? 0)) + 1}/{(altCount ?? 0) + 1}
              </span>
              <button
                onClick={() => onPrevAlt?.(altIndex !== undefined ? altIndex + 1 : (altCount ?? 0))}
                disabled={altIndex === undefined || altIndex >= (altCount ?? 0)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 13, padding: '0 3px',
                  opacity: (altIndex === undefined || altIndex >= (altCount ?? 0)) ? 0.3 : 1,
                }}
              >&#9654;</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  // isStreaming 변경 시 마지막 메시지는 반드시 re-render (pre → ReactMarkdown 전환)
  if (prev.isLast && prev.isStreaming !== next.isStreaming) return false
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.text === next.msg.text &&
    prev.msg.isError === next.msg.isError &&
    prev.msg.toolUses.length === next.msg.toolUses.length &&
    prev.msg.toolUses.every((t, i) => t.status === next.msg.toolUses[i]?.status && t.output === next.msg.toolUses[i]?.output) &&
    prev.isLast === next.isLast &&
    prev.isMatched === next.isMatched &&
    prev.isCurrentMatch === next.isCurrentMatch &&
    prev.highlightText === next.highlightText &&
    prev.isSearchMatch === next.isSearchMatch &&
    prev.onRunInTerminal === next.onRunInTerminal &&
    (prev.onFork === undefined) === (next.onFork === undefined) &&
    (prev.onEditResend === undefined) === (next.onEditResend === undefined) &&
    (prev.onQuickAction === undefined) === (next.onQuickAction === undefined) &&
    prev.isBookmarked === next.isBookmarked &&
    (prev.onBookmark === undefined) === (next.onBookmark === undefined) &&
    prev.isPinned === next.isPinned &&
    (prev.onTogglePin === undefined) === (next.onTogglePin === undefined) &&
    (prev.onOpenFile === undefined) === (next.onOpenFile === undefined) &&
    (prev.onReaction === undefined) === (next.onReaction === undefined) &&
    (prev.onImageClick === undefined) === (next.onImageClick === undefined) &&
    (prev.onReplyTo === undefined) === (next.onReplyTo === undefined) &&
    (prev.onQuoteReply === undefined) === (next.onQuoteReply === undefined) &&
    (prev.onSetNote === undefined) === (next.onSetNote === undefined) &&
    (prev.onDelete === undefined) === (next.onDelete === undefined) &&
    (prev.onRetry === undefined) === (next.onRetry === undefined) &&
    JSON.stringify(prev.msg.reactions) === JSON.stringify(next.msg.reactions) &&
    prev.msg.note === next.msg.note &&
    (prev.msg.editHistory?.length ?? 0) === (next.msg.editHistory?.length ?? 0) &&
    prev.msg.altIndex === next.msg.altIndex &&
    (prev.msg.alternatives?.length ?? 0) === (next.msg.alternatives?.length ?? 0)
  )
})
