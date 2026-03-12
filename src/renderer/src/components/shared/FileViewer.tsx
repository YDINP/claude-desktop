import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface FileViewerProps {
  path: string
  cwd?: string
  onClose?: () => void
  onSplitView?: (path: string) => void
}

type BlameEntry = { hash: string; author: string; date: string; lineNo: number }

function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
    cs: 'csharp', html: 'html', css: 'css', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', sh: 'bash', bash: 'bash', xml: 'xml',
    sql: 'sql', php: 'php', rb: 'ruby', kt: 'kotlin', swift: 'swift',
    toml: 'toml',
  }
  return map[ext] ?? 'text'
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])

function highlightLine(line: string, query: string, activeMatchInLine: number | null): React.ReactNode {
  if (!query) return line
  const parts: React.ReactNode[] = []
  const lower = line.toLowerCase()
  const lowerQ = query.toLowerCase()
  let last = 0
  let idx = lower.indexOf(lowerQ)
  let matchCount = 0
  while (idx !== -1) {
    if (idx > last) parts.push(line.slice(last, idx))
    const isThisActive = activeMatchInLine === matchCount
    parts.push(
      <mark
        key={idx}
        style={{
          background: isThisActive ? '#f0a30a' : '#4a4a00',
          color: isThisActive ? '#000' : '#fff',
          borderRadius: 2,
        }}
      >
        {line.slice(idx, idx + query.length)}
      </mark>
    )
    matchCount++
    last = idx + query.length
    idx = lower.indexOf(lowerQ, last)
  }
  if (last < line.length) parts.push(line.slice(last))
  return <>{parts}</>
}

export function FileViewer({ path, cwd, onClose, onSplitView }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(13)
  const [imgScale, setImgScale] = useState(1)
  const [fitMode, setFitMode] = useState(true)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [splitPreview, setSplitPreview] = useState(false)

  // Git blame state
  const [showBlame, setShowBlame] = useState(false)
  const [blameData, setBlameData] = useState<BlameEntry[]>([])
  const [blameLoading, setBlameLoading] = useState(false)

  // Go-to-line state
  const [gotoOpen, setGotoOpen] = useState(false)
  const [gotoLine, setGotoLine] = useState('')

  // Find/Replace state (edit mode only)
  const [showReplace, setShowReplace] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [replaceMatchCount, setReplaceMatchCount] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const activeMatchRef = useRef<HTMLDivElement>(null)

  const filename = path.split(/[\\/]/).pop() ?? path
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const isMarkdown = ext === 'md'
  const isImage = IMAGE_EXT.has(ext)

  const imgSrc = isImage ? `local://localhost?path=${encodeURIComponent(path)}` : null

  useEffect(() => {
    setImgScale(1)
    setFitMode(true)
    setError(null)
    setSearchOpen(false)
    setSearchQuery('')
    setMatchIndex(0)
    if (!isImage) {
      setContent(null)
      window.api.readFile(path).then(setContent).catch(() => setError('파일을 읽을 수 없습니다'))
    }
  }, [path])

  // Reset edit state when file changes
  useEffect(() => {
    setIsEditing(false)
    setSaveStatus('idle')
    setSplitPreview(false)
    setShowBlame(false)
    setBlameData([])
  }, [path])

  const handleSave = async () => {
    setSaveStatus('saving')
    const result = await window.api.writeTextFile(path, editContent)
    if (result.ok) {
      setSaveStatus('saved')
      setContent(editContent)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
    }
  }

  const handleToggleBlame = async () => {
    if (showBlame) { setShowBlame(false); return }
    if (!cwd || !path) return
    setBlameLoading(true)
    const data = await window.api.gitBlame(cwd, path)
    setBlameData(data)
    setShowBlame(true)
    setBlameLoading(false)
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      if (isImage) {
        setFitMode(false)
        setImgScale(prev => Math.min(5, Math.max(0.25, prev * (e.deltaY < 0 ? 1.1 : 0.9))))
      } else {
        setFontSize(prev => Math.min(32, Math.max(8, prev + (e.deltaY < 0 ? 1 : -1))))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const jumpToLine = (lineNum: number) => {
    const el = scrollRef.current
    if (!el) return
    // Measure actual line height from first child line element, fallback to 21px
    const lineHeight = 21
    el.scrollTo({ top: Math.max(0, (lineNum - 1) * lineHeight), behavior: 'smooth' })
  }

  // Ctrl+F / Ctrl+G handler
  useEffect(() => {
    if (isImage || isMarkdown) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(prev => {
          if (!prev) setTimeout(() => searchInputRef.current?.focus(), 0)
          return !prev
        })
      }
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault()
        setGotoOpen(true)
        setGotoLine('')
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isImage, isMarkdown, searchOpen])

  // Ctrl+H handler (edit mode only)
  useEffect(() => {
    if (!isEditing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault()
        setShowReplace(prev => {
          if (!prev) setTimeout(() => findInputRef.current?.focus(), 0)
          return !prev
        })
      }
      if (e.key === 'Escape' && showReplace) {
        setShowReplace(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditing, showReplace])

  // Reset replace panel when leaving edit mode
  useEffect(() => {
    if (!isEditing) {
      setShowReplace(false)
      setFindText('')
      setReplaceText('')
      setReplaceMatchCount(0)
      setSplitPreview(false)
    }
  }, [isEditing])

  // Realtime match count for find/replace
  useEffect(() => {
    if (!findText) { setReplaceMatchCount(0); return }
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const count = (editContent.match(new RegExp(escaped, 'g')) ?? []).length
    setReplaceMatchCount(count)
  }, [findText, editContent])

  const doReplaceAll = () => {
    if (!findText) return
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const count = (editContent.match(new RegExp(escaped, 'g')) ?? []).length
    const newContent = editContent.replace(new RegExp(escaped, 'g'), replaceText)
    setEditContent(newContent)
    setSaveStatus('idle')
    setReplaceMatchCount(count)
  }

  const doReplaceOne = () => {
    if (!findText) return
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const newContent = editContent.replace(new RegExp(escaped), replaceText)
    setEditContent(newContent)
    setSaveStatus('idle')
  }

  // Compute match positions: array of { lineIdx, matchInLine }
  const lines = useMemo(() => (content ?? '').split('\n'), [content])

  interface MatchPos { lineIdx: number; matchInLine: number }
  const matches = useMemo<MatchPos[]>(() => {
    if (!searchQuery || !content) return []
    const result: MatchPos[] = []
    const lowerQ = searchQuery.toLowerCase()
    lines.forEach((line, lineIdx) => {
      const lower = line.toLowerCase()
      let idx = lower.indexOf(lowerQ)
      let m = 0
      while (idx !== -1) {
        result.push({ lineIdx, matchInLine: m })
        m++
        idx = lower.indexOf(lowerQ, idx + lowerQ.length)
      }
    })
    return result
  }, [searchQuery, content, lines])

  // Reset matchIndex when query changes
  useEffect(() => {
    setMatchIndex(0)
  }, [searchQuery])

  // Scroll active match into view
  useEffect(() => {
    if (activeMatchRef.current) {
      activeMatchRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [matchIndex, matches.length])

  const goNext = () => {
    if (matches.length === 0) return
    setMatchIndex(i => (i + 1) % matches.length)
  }
  const goPrev = () => {
    if (matches.length === 0) return
    setMatchIndex(i => (i - 1 + matches.length) % matches.length)
  }

  // Track per-line match counters for active detection
  const activeMatch = matches[matchIndex]

  // Per-line cumulative match index start
  const lineMatchStart = useMemo(() => {
    const starts: number[] = new Array(lines.length).fill(0)
    let cumulative = 0
    lines.forEach((line, i) => {
      starts[i] = cumulative
      if (!searchQuery) return
      const lowerQ = searchQuery.toLowerCase()
      const lower = line.toLowerCase()
      let idx = lower.indexOf(lowerQ)
      while (idx !== -1) {
        cumulative++
        idx = lower.indexOf(lowerQ, idx + lowerQ.length)
      }
    })
    return starts
  }, [lines, searchQuery])

  const blameVisible = showBlame && blameData.length > 0 && !isEditing && !isImage

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        gap: 6,
      }}
        title={path}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {path}
        </span>
        {content !== null && !isImage && !isEditing && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {lines.length} 라인
          </span>
        )}
        {!isImage && (
          isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                미리보기
              </button>
              {isMarkdown && (
                <button
                  onClick={() => setSplitPreview(p => !p)}
                  title={splitPreview ? '분할 뷰 닫기' : '분할 뷰 열기'}
                  style={{
                    background: splitPreview ? 'var(--accent)' : 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: splitPreview ? '#fff' : 'var(--text-muted)',
                    fontSize: 11,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  분할 뷰
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                style={{
                  background: saveStatus === 'saved' ? '#1a6b2a' : saveStatus === 'error' ? '#6b1a1a' : 'var(--accent)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  padding: '2px 8px',
                  cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: saveStatus === 'saving' ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                {saveStatus === 'saving' ? '저장 중...' : saveStatus === 'saved' ? '저장됨' : saveStatus === 'error' ? '오류' : '저장'}
              </button>
            </>
          ) : (
            <button
              onClick={() => { setEditContent(content ?? ''); setIsEditing(true) }}
              title="편집 모드"
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-muted)',
                fontSize: 11,
                padding: '2px 8px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ✏ 편집
            </button>
          )
        )}
        {cwd && !isEditing && !isImage && (
          <button
            onClick={handleToggleBlame}
            title="Git Blame"
            style={{
              background: showBlame ? 'var(--accent)' : 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: showBlame ? '#fff' : 'var(--text-muted)',
              fontSize: 11,
              padding: '2px 8px',
              cursor: blameLoading ? 'wait' : 'pointer',
              flexShrink: 0,
              opacity: blameLoading ? 0.6 : 1,
            }}
          >
            ⚖ Blame
          </button>
        )}
        {onSplitView && !isEditing && (
          <button
            onClick={() => onSplitView(path)}
            title="분할 뷰에서 열기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 6px', flexShrink: 0 }}
          >
            ⧉
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            title="닫기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 6px', flexShrink: 0 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      {/* Split view (edit + markdown preview) */}
      {isEditing && isMarkdown && splitPreview && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* 편집 영역 */}
          <div style={{ flex: 1, overflow: 'hidden', borderRight: '1px solid var(--border)', position: 'relative' }}>
            <textarea
              value={editContent}
              onChange={e => { setEditContent(e.target.value); setSaveStatus('idle') }}
              onKeyDown={e => {
                if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave() }
                if (e.ctrlKey && e.key === 'h') { e.preventDefault() }
                if (e.key === 'Escape' && !showReplace) { setIsEditing(false) }
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: 'none',
                outline: 'none',
                padding: 16,
                fontSize: `${fontSize}px`,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
                resize: 'none',
                boxSizing: 'border-box',
              }}
              spellCheck={false}
            />
          </div>
          {/* 미리보기 영역 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', background: 'var(--bg-primary)' }}>
            <div style={{ fontSize, lineHeight: 1.7, color: 'var(--text-primary)', maxWidth: 720 }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        onClick={e => { e.preventDefault(); if (href) window.api.openExternal(href) }}
                        style={{ color: 'var(--accent)', cursor: 'pointer' }}
                      >
                        {children}
                      </a>
                    )
                  },
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const inline = !match
                    if (inline) return <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em' }} {...props}>{children}</code>
                    return (
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div">
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  }
                }}
              >
                {editContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Main content area — flex row when blame is visible */}
      <div
        style={{
          flex: isEditing && isMarkdown && splitPreview ? 0 : 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          ...(isEditing && isMarkdown && splitPreview ? { display: 'none' } : {}),
        }}
      >
        {/* Git blame gutter */}
        {blameVisible && (
          <div style={{
            flexShrink: 0,
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            borderRight: '1px solid var(--border)',
            lineHeight: '1.4em',
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--bg-secondary)',
          }}>
            {blameData.map(b => (
              <div key={b.lineNo} style={{ padding: '0 8px', whiteSpace: 'nowrap' }} title={`${b.author} · ${b.date}`}>
                <span style={{ color: 'var(--accent)', marginRight: 4 }}>{b.hash}</span>
                <span>{b.author.slice(0, 10).padEnd(10)} {b.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* File content */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflow: 'auto',
            minWidth: 0,
            minHeight: 0,
            padding: isMarkdown && !isEditing ? '16px 24px' : 0,
            display: isImage ? 'flex' : undefined,
            alignItems: isImage ? 'center' : undefined,
            justifyContent: isImage ? 'center' : undefined,
            position: 'relative',
          }}
        >
          {/* Edit mode textarea */}
          {isEditing && !isImage && (
            <>
              <textarea
                value={editContent}
                onChange={e => { setEditContent(e.target.value); setSaveStatus('idle') }}
                onKeyDown={e => {
                  if (e.ctrlKey && e.key === 's') {
                    e.preventDefault()
                    handleSave()
                  }
                  if (e.ctrlKey && e.key === 'h') {
                    e.preventDefault()
                  }
                  if (e.key === 'Escape' && !showReplace) {
                    setIsEditing(false)
                  }
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  outline: 'none',
                  padding: 16,
                  fontSize: `${fontSize}px`,
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.6,
                  resize: 'none',
                  boxSizing: 'border-box',
                  zIndex: 50,
                }}
                spellCheck={false}
              />
              {/* Find/Replace panel */}
              {showReplace && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 16,
                    zIndex: 200,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    minWidth: 320,
                  }}
                >
                  {/* Find row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>찾기</span>
                    <input
                      ref={findInputRef}
                      value={findText}
                      onChange={e => setFindText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { setShowReplace(false) }
                        if (e.key === 'Enter') { doReplaceOne() }
                      }}
                      placeholder="찾을 텍스트..."
                      style={{
                        flex: 1,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        padding: '3px 6px',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 48, textAlign: 'right', flexShrink: 0 }}>
                      {findText ? `${replaceMatchCount}개` : ''}
                    </span>
                    <button
                      onClick={() => setShowReplace(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}
                      title="닫기 (Escape)"
                    >✕</button>
                  </div>
                  {/* Replace row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, flexShrink: 0 }}>바꾸기</span>
                    <input
                      value={replaceText}
                      onChange={e => setReplaceText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { setShowReplace(false) }
                        if (e.key === 'Enter') { doReplaceAll() }
                      }}
                      placeholder="바꿀 텍스트..."
                      style={{
                        flex: 1,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        padding: '3px 6px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  {/* Buttons row */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      onClick={doReplaceOne}
                      disabled={!findText || replaceMatchCount === 0}
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        color: 'var(--text-primary)',
                        fontSize: 11,
                        padding: '3px 10px',
                        cursor: findText && replaceMatchCount > 0 ? 'pointer' : 'not-allowed',
                        opacity: findText && replaceMatchCount > 0 ? 1 : 0.4,
                      }}
                      title="첫 번째 일치 항목 치환 (Enter)"
                    >
                      Replace
                    </button>
                    <button
                      onClick={doReplaceAll}
                      disabled={!findText || replaceMatchCount === 0}
                      style={{
                        background: findText && replaceMatchCount > 0 ? 'var(--accent)' : 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        color: findText && replaceMatchCount > 0 ? '#fff' : 'var(--text-muted)',
                        fontSize: 11,
                        padding: '3px 10px',
                        cursor: findText && replaceMatchCount > 0 ? 'pointer' : 'not-allowed',
                        opacity: findText && replaceMatchCount > 0 ? 1 : 0.4,
                      }}
                      title="모두 치환"
                    >
                      Replace All
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Go-to-line dialog */}
          {gotoOpen && !isImage && !isEditing && (
            <div style={{
              position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
              zIndex: 100, background: 'var(--bg-secondary)', border: '1px solid var(--accent)',
              borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>라인으로 이동:</span>
              <input
                autoFocus
                value={gotoLine}
                onChange={e => setGotoLine(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const lineNum = parseInt(gotoLine)
                    if (!isNaN(lineNum) && lineNum > 0) jumpToLine(lineNum)
                    setGotoOpen(false)
                  }
                  if (e.key === 'Escape') setGotoOpen(false)
                }}
                placeholder="1"
                style={{
                  width: 60, padding: '2px 6px',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 3, color: 'inherit', fontSize: 13, textAlign: 'center',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter</span>
              <button
                onClick={() => setGotoOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
              >✕</button>
            </div>
          )}

          {/* Search bar overlay */}
          {searchOpen && !isImage && !isMarkdown && !isEditing && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 16,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext() }
                  if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
                }}
                placeholder="검색..."
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  padding: '2px 6px',
                  outline: 'none',
                  width: 160,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40, textAlign: 'center' }}>
                {matches.length === 0 ? (searchQuery ? '없음' : '') : `${matchIndex + 1}/${matches.length}`}
              </span>
              <button
                onClick={goPrev}
                disabled={matches.length === 0}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}
                title="이전 (Shift+Enter)"
              >↑</button>
              <button
                onClick={goNext}
                disabled={matches.length === 0}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}
                title="다음 (Enter)"
              >↓</button>
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}
                title="닫기 (Escape)"
              >✕</button>
            </div>
          )}

          {isImage && imgSrc && !error && (
            <>
              {/* Zoom control overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {(
                  [
                    {
                      label: '−',
                      title: '축소 (25%)',
                      onClick: () => { setFitMode(false); setImgScale(prev => Math.max(0.25, parseFloat((prev - 0.25).toFixed(2)))) },
                    },
                    {
                      label: `${fitMode ? 'fit' : `${Math.round(imgScale * 100)}%`}`,
                      title: '100%로 리셋',
                      onClick: () => { setFitMode(false); setImgScale(1) },
                    },
                    {
                      label: '+',
                      title: '확대 (25%)',
                      onClick: () => { setFitMode(false); setImgScale(prev => Math.min(5, parseFloat((prev + 0.25).toFixed(2)))) },
                    },
                    {
                      label: '맞추기',
                      title: '화면에 맞추기',
                      onClick: () => setFitMode(f => !f),
                      active: fitMode,
                    },
                  ] as { label: string; title: string; onClick: () => void; active?: boolean }[]
                ).map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    title={btn.title}
                    style={{
                      background: btn.active ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <img
                src={imgSrc}
                alt={filename}
                onError={() => setError('이미지를 불러올 수 없습니다')}
                style={{
                  maxWidth: fitMode ? '100%' : 'none',
                  maxHeight: fitMode ? '100%' : 'none',
                  width: !fitMode ? `${imgScale * 100}%` : undefined,
                  objectFit: fitMode ? 'contain' : undefined,
                  display: 'block',
                  userSelect: 'none',
                }}
              />
            </>
          )}
          {error && (
            <div style={{ padding: 16, color: 'var(--error)', fontSize: 12 }}>{error}</div>
          )}
          {content === null && !error && !isImage && (
            <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
          )}
          {content !== null && !error && isMarkdown && !content.startsWith('[File too large') && (
            <div style={{ fontSize, lineHeight: 1.7, color: 'var(--text-primary)', maxWidth: 720 }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        onClick={e => { e.preventDefault(); if (href) window.api.openExternal(href) }}
                        style={{ color: 'var(--accent)', cursor: 'pointer' }}
                      >
                        {children}
                      </a>
                    )
                  },
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const inline = !match
                    if (inline) return <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em' }} {...props}>{children}</code>
                    return (
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div">
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
          {content !== null && !error && content.startsWith('[File too large') && (
            <div style={{ padding: 16, color: 'var(--error)', fontSize: 12 }}>{content}</div>
          )}
          {content !== null && !error && !isMarkdown && !content.startsWith('[File too large') && (
            searchQuery ? (
              // Search mode: render lines as divs with highlights
              <pre
                style={{
                  margin: 0,
                  fontSize,
                  fontFamily: 'monospace',
                  lineHeight: '1.5',
                  padding: '12px 16px',
                  color: 'var(--text-primary)',
                  minHeight: '100%',
                  overflowX: 'auto',
                }}
              >
                {lines.map((line, lineIdx) => {
                  const startIdx = lineMatchStart[lineIdx]
                  const isActiveLine = activeMatch?.lineIdx === lineIdx
                  const activeMatchInLine = isActiveLine ? (matchIndex - startIdx) : null
                  return (
                    <div
                      key={lineIdx}
                      ref={isActiveLine ? activeMatchRef : undefined}
                      style={{ minHeight: '1.5em' }}
                    >
                      {highlightLine(line, searchQuery, activeMatchInLine)}
                    </div>
                  )
                })}
              </pre>
            ) : (
              getLang(filename) !== 'text' ? (
                <SyntaxHighlighter
                  language={getLang(filename)}
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, background: 'transparent', fontSize, flex: 1, overflow: 'auto', minHeight: '100%' }}
                  showLineNumbers={true}
                  lineNumberStyle={{ color: '#555', minWidth: '3em' }}
                >
                  {content}
                </SyntaxHighlighter>
              ) : (
                <pre style={{ margin: 0, padding: 16, fontSize, overflow: 'auto', flex: 1, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {content}
                </pre>
              )
            )
          )}
        </div>
      </div>
    </div>
  )
}
