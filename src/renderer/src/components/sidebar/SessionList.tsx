import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { toast } from '../../utils/toast'

interface SessionMeta {
  id: string
  title: string
  cwd: string
  model: string
  updatedAt: number
  createdAt: number
  messageCount: number
  pinned?: boolean
  tags?: string[]
  locked?: boolean
  collection?: string
}

const TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const
type TagColor = typeof TAG_COLORS[number]

const TAG_CSS: Record<TagColor, string> = {
  red:    '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green:  '#22c55e',
  blue:   '#3b82f6',
  purple: '#a855f7',
}

function TagDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: TAG_CSS[color as TagColor] ?? color,
      flexShrink: 0,
    }} />
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

function groupSessions(sessions: SessionMeta[]): Array<{ label: string; items: SessionMeta[] }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const weekAgo = today - 7 * 86400000

  const groups: { label: string; items: SessionMeta[] }[] = [
    { label: '\uC624\uB298', items: [] },
    { label: '\uC5B4\uC81C', items: [] },
    { label: '\uC774\uBC88 \uC8FC', items: [] },
    { label: '\uC774\uC804', items: [] },
  ]

  for (const s of sessions) {
    const ts = s.updatedAt ?? s.createdAt ?? 0
    if (ts >= today) groups[0].items.push(s)
    else if (ts >= yesterday) groups[1].items.push(s)
    else if (ts >= weekAgo) groups[2].items.push(s)
    else groups[3].items.push(s)
  }

  return groups.filter(g => g.items.length > 0)
}

interface SessionStats {
  totalMessages?: number
  estimatedTokens?: number
  updatedAt?: string | null
}

export function SessionList({ onSelect, activeSessionId, onImportComplete }: { onSelect: (id: string) => void; activeSessionId?: string | null; onImportComplete?: () => void }) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [search, setSearch] = useState('')
  const [tagPickerFor, setTagPickerFor] = useState<string | null>(null)
  const [tagPickerPos, setTagPickerPos] = useState<{ x: number; y: number } | null>(null)
  const [filterTag, setFilterTag] = useState<TagColor | null>(null)
  const tagPickerRef = useRef<HTMLDivElement>(null)
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)
  const [sessionStats, setSessionStats] = useState<Record<string, SessionStats>>({})
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; description?: string; createdAt: number; messageCount: number }>>([])
  const [templateOpen, setTemplateOpen] = useState(false)

  const refreshTemplates = useCallback(async () => {
    try {
      const list = await window.api.listTemplates()
      setTemplates(list)
    } catch {
      setTemplates([])
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const list = await window.api.sessionList() as SessionMeta[]
      setSessions(list)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    refreshTemplates()
  }, [refresh, refreshTemplates])

  // Re-fetch when window regains focus or session is saved
  useEffect(() => {
    const handler = () => { refresh() }
    window.addEventListener('focus', handler)
    window.addEventListener('session:saved', handler)
    return () => {
      window.removeEventListener('focus', handler)
      window.removeEventListener('session:saved', handler)
    }
  }, [refresh])

  // Close tag picker on outside click
  useEffect(() => {
    if (!tagPickerFor) return
    const handleClick = (e: MouseEvent) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setTagPickerFor(null)
        setTagPickerPos(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [tagPickerFor])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextMenu])

  // Escape key to exit selection mode or merge mode
  useEffect(() => {
    if (!selectionMode && !mergeMode) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectionMode(false)
        setSelectedIds(new Set())
        setMergeMode(false)
        setMergeSourceId(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectionMode, mergeMode])

  const handlePin = useCallback(async (e: React.MouseEvent, s: SessionMeta) => {
    e.stopPropagation()
    const newPinned = !s.pinned
    await window.api.sessionPin(s.id, newPinned)
    setSessions(prev => {
      const updated = prev.map(item => item.id === s.id ? { ...item, pinned: newPinned } : item)
      return [...updated].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.updatedAt - a.updatedAt
      })
    })
  }, [])

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await window.api.sessionDelete(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }, [])

  const startRename = useCallback((e: React.MouseEvent, s: SessionMeta) => {
    e.stopPropagation()
    setRenamingId(s.id)
    setRenameValue(s.title || 'Untitled')
  }, [])

  const commitRename = useCallback(async (id: string) => {
    const trimmed = renameValue.trim()
    if (trimmed) {
      await window.api.sessionRename(id, trimmed)
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s))
    }
    setRenamingId(null)
  }, [renameValue])

  const handleSetTag = useCallback(async (id: string, tags: string[]) => {
    await window.api.sessionTag(id, tags)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, tags } : s))
    setTagPickerFor(null)
    setTagPickerPos(null)
  }, [])

  const openTagPicker = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTagPickerFor(id)
    setTagPickerPos({ x: rect.left, y: rect.bottom + 4 })
  }, [])

  const handleSessionMouseEnter = useCallback((sessionId: string) => {
    setHoveredSession(sessionId)
    if (sessionStats[sessionId]) return
    statsTimerRef.current = setTimeout(async () => {
      const stats = await window.api.sessionStats(sessionId)
      if (!stats.error) {
        setSessionStats(prev => ({ ...prev, [sessionId]: stats }))
      }
    }, 400)
  }, [sessionStats])

  const handleSessionMouseLeave = useCallback(() => {
    setHoveredSession(null)
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
  }, [])

  const handleNoteOpen = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (noteOpenId === sessionId) {
      setNoteOpenId(null)
      return
    }
    const { note } = await window.api.sessionGetNote(sessionId)
    setNoteText(note)
    setNoteOpenId(sessionId)
  }, [noteOpenId])

  const handleNoteSave = useCallback(async (sessionId: string) => {
    setNoteSaving(true)
    await window.api.sessionSetNote(sessionId, noteText)
    setNoteSaving(false)
    setNoteOpenId(null)
  }, [noteText])

  const handleToggleLock = useCallback(async (id: string, locked: boolean) => {
    await window.api.sessionSetLocked(id, locked)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, locked } : s))
  }, [])

  const toggleCollection = useCallback((name: string) => {
    setOpenCollections(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const handleSetCollection = useCallback(async (id: string) => {
    const name = window.prompt('컬렉션 이름 입력 (비우면 제거):')
    if (name === null) return
    const collection = name.trim() || null
    await window.api.sessionSetCollection(id, collection)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, collection: collection ?? undefined } : s))
  }, [])

  // Apply search filter (must be before hooks)
  const filtered = useMemo(() => {
    let result = search.trim()
      ? sessions.filter(s =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.cwd.toLowerCase().includes(search.toLowerCase())
        )
      : sessions
    if (filterTag) {
      result = result.filter(s => s.tags && s.tags.includes(filterTag))
    }
    return result
  }, [sessions, search, filterTag])

  const ARCHIVE_DAYS = 30

  const { activeSessions, archivedSessions } = useMemo(() => {
    if (sessions.length === 0) return { activeSessions: [], archivedSessions: [] }
    const now = Date.now()
    const active: SessionMeta[] = []
    const archived: SessionMeta[] = []
    for (const s of filtered) {
      const ts = s.updatedAt ?? s.createdAt ?? now
      const days = (now - ts) / (1000 * 60 * 60 * 24)
      if (days > ARCHIVE_DAYS && !s.pinned) {
        archived.push(s)
      } else {
        active.push(s)
      }
    }
    return { activeSessions: active, archivedSessions: archived }
  }, [filtered, sessions.length])

  const collections = useMemo(() => {
    const map = new Map<string, SessionMeta[]>()
    for (const s of activeSessions) {
      if (s.collection) {
        if (!map.has(s.collection)) map.set(s.collection, [])
        map.get(s.collection)!.push(s)
      }
    }
    return map
  }, [activeSessions])

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
        Loading sessions...
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
        No previous sessions
      </div>
    )
  }

  const pinnedFiltered = activeSessions.filter(s => s.pinned && !s.collection)
  const unpinnedFiltered = activeSessions.filter(s => !s.pinned && !s.collection)
  const groups = groupSessions(unpinnedFiltered)

  const renderSessionItem = (s: SessionMeta) => {
    const isActive = s.id === activeSessionId
    const isSelected = selectedIds.has(s.id)
    const sessionTags = (s.tags ?? []).slice(0, 3)
    return (
      <div key={s.id}>
      <div
        draggable={true}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ sessionId: s.id, x: e.clientX, y: e.clientY }) }}
        onDragStart={() => setDragId(s.id)}
        onDragOver={(e) => { e.preventDefault(); setDragOverId(s.id) }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={async () => {
          if (dragId && dragId !== s.id) {
            await window.api.sessionReorder(dragId, s.id)
            await refresh()
          }
          setDragId(null)
          setDragOverId(null)
        }}
        onDragEnd={() => { setDragId(null); setDragOverId(null) }}
        onClick={async () => {
          if (mergeMode && mergeSourceId) {
            if (mergeSourceId === s.id) return
            if (s.locked) { toast('잠금된 세션에는 병합할 수 없습니다', 'error'); return }
            const sourceSession = sessions.find(x => x.id === mergeSourceId)
            const sourceName = sourceSession?.title ?? mergeSourceId
            const targetName = s.title ?? s.id
            if (window.confirm(`'${sourceName}'의 메시지를 '${targetName}'에 추가할까요?`)) {
              const defaultTitle = `${sourceName} + ${targetName}`
              const title = window.prompt('병합 세션 제목:', defaultTitle) ?? defaultTitle
              const result = await window.api.sessionMerge([mergeSourceId, s.id], title)
              if (result.success) {
                await refresh()
                toast('세션이 병합되었습니다', 'success')
              } else {
                toast('병합 실패: ' + (result.error ?? ''), 'error')
              }
            }
            setMergeMode(false)
            setMergeSourceId(null)
          } else if (selectionMode) {
            setSelectedIds(prev => {
              const next = new Set(prev)
              if (next.has(s.id)) next.delete(s.id)
              else next.add(s.id)
              return next
            })
          } else {
            onSelect(s.id)
          }
        }}
        className="session-item"
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          borderBottom: '1px solid var(--border)',
          borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
          borderTop: dragOverId === s.id ? '2px solid var(--accent)' : '2px solid transparent',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          position: 'relative',
          background: isSelected ? 'var(--bg-hover)' : isActive ? 'var(--bg-hover)' : 'transparent',
          opacity: dragId === s.id ? 0.4 : 1,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
          const btn = (e.currentTarget as HTMLElement).querySelector('.pin-btn') as HTMLElement | null
          if (btn) btn.style.opacity = '1'
          const tagBtn = (e.currentTarget as HTMLElement).querySelector('.tag-btn') as HTMLElement | null
          if (tagBtn) tagBtn.style.opacity = '1'
          const noteBtn = (e.currentTarget as HTMLElement).querySelector('.note-btn') as HTMLElement | null
          if (noteBtn) noteBtn.style.opacity = '1'
          const mdBtn = (e.currentTarget as HTMLElement).querySelector('.export-md-btn') as HTMLElement | null
          if (mdBtn) mdBtn.style.opacity = '1'
          const pdfBtn = (e.currentTarget as HTMLElement).querySelector('.export-pdf-btn') as HTMLElement | null
          if (pdfBtn) pdfBtn.style.opacity = '1'
          const dupBtn = (e.currentTarget as HTMLElement).querySelector('.duplicate-btn') as HTMLElement | null
          if (dupBtn) dupBtn.style.opacity = '1'
          const mergeBtn = (e.currentTarget as HTMLElement).querySelector('.merge-btn') as HTMLElement | null
          if (mergeBtn) mergeBtn.style.opacity = '1'
          const lockBtn = (e.currentTarget as HTMLElement).querySelector('.lock-btn') as HTMLElement | null
          if (lockBtn) lockBtn.style.opacity = '1'
          handleSessionMouseEnter(s.id)
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = isActive ? 'var(--bg-hover)' : 'transparent'
          const btn = (e.currentTarget as HTMLElement).querySelector('.pin-btn') as HTMLElement | null
          if (btn) btn.style.opacity = s.pinned ? '1' : '0'
          const tagBtn = (e.currentTarget as HTMLElement).querySelector('.tag-btn') as HTMLElement | null
          if (tagBtn) tagBtn.style.opacity = '0'
          const noteBtn = (e.currentTarget as HTMLElement).querySelector('.note-btn') as HTMLElement | null
          if (noteBtn) noteBtn.style.opacity = noteOpenId === s.id ? '1' : '0'
          const mdBtn = (e.currentTarget as HTMLElement).querySelector('.export-md-btn') as HTMLElement | null
          if (mdBtn) mdBtn.style.opacity = '0'
          const pdfBtn = (e.currentTarget as HTMLElement).querySelector('.export-pdf-btn') as HTMLElement | null
          if (pdfBtn) pdfBtn.style.opacity = '0'
          const dupBtn = (e.currentTarget as HTMLElement).querySelector('.duplicate-btn') as HTMLElement | null
          if (dupBtn) dupBtn.style.opacity = '0'
          const mergeBtn = (e.currentTarget as HTMLElement).querySelector('.merge-btn') as HTMLElement | null
          if (mergeBtn) mergeBtn.style.opacity = mergeSourceId === s.id ? '1' : '0'
          const lockBtn = (e.currentTarget as HTMLElement).querySelector('.lock-btn') as HTMLElement | null
          if (lockBtn) lockBtn.style.opacity = s.locked ? '1' : '0'
          handleSessionMouseLeave()
        }}
      >
        {selectionMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              setSelectedIds(prev => {
                const next = new Set(prev)
                if (e.target.checked) next.add(s.id)
                else next.delete(s.id)
                return next
              })
            }}
            onClick={e => e.stopPropagation()}
            style={{ marginRight: 2, marginTop: 2, cursor: 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renamingId === s.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRename(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(s.id) }
                if (e.key === 'Escape') { setRenamingId(null) }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--accent)',
                borderRadius: 3,
                padding: '1px 4px',
                fontSize: 12,
                outline: 'none',
              }}
            />
          ) : (
            <div
              onDoubleClick={(e) => { if (!s.locked) startRename(e, s) }}
              style={{
                fontSize: 12,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'text',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={'\uB354\uBE14\uD074\uB9AD\uC73C\uB85C \uC774\uB984 \uBCC0\uACBD'}
            >
              {sessionTags.length > 0 && (
                <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
                  {sessionTags.map((t, i) => <TagDot key={i} color={t} />)}
                </span>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title || 'Untitled'}
              </span>
            </div>
          )}
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 2,
            display: 'flex',
            gap: 8,
          }}>
            <span>{formatTime(s.updatedAt)}</span>
            <span>{s.messageCount} msg{s.messageCount !== 1 ? 's' : ''}</span>
          </div>
          {hoveredSession === s.id && sessionStats[s.id] && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
              <span>💬 {sessionStats[s.id].totalMessages}</span>
              <span>~{((sessionStats[s.id].estimatedTokens ?? 0) / 1000).toFixed(1)}K tok</span>
              {sessionStats[s.id].updatedAt && (
                <span>{new Date(sessionStats[s.id].updatedAt!).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
              )}
            </div>
          )}
        </div>
        <button
          className="tag-btn"
          onClick={(e) => openTagPicker(e, s.id)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0,
            transition: 'opacity 0.1s',
          }}
          title={'\uD0DC\uADF8 \uC124\uC815'}
        >
          {'\uD83C\uDFF7'}
        </button>
        <button
          className="note-btn"
          onClick={(e) => handleNoteOpen(e, s.id)}
          style={{
            background: 'none',
            border: 'none',
            color: noteOpenId === s.id ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: noteOpenId === s.id ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
          title="세션 메모"
        >
          {'\uD83D\uDCDD'}
        </button>
        <button
          className="export-md-btn"
          onClick={async (e) => {
            e.stopPropagation()
            const result = await window.api.sessionExportMarkdown(s.id)
            if (result.success) toast('내보내기 완료', 'success')
            else if (result.error) toast('내보내기 실패: ' + result.error, 'error')
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0,
            transition: 'opacity 0.1s',
          }}
          title="마크다운으로 내보내기"
        >
          {'\uD83D\uDCC4'}
        </button>
        <button
          className="export-pdf-btn"
          onClick={async (e) => {
            e.stopPropagation()
            const result = await window.api.sessionExportPdf(s.id)
            if (result.success) toast('PDF 내보내기 완료', 'success')
            else if (result.error) toast('PDF 내보내기 실패: ' + result.error, 'error')
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0,
            transition: 'opacity 0.1s',
          }}
          title="PDF로 내보내기"
        >
          {'\uD83D\uDDB8'}
        </button>
        <button
          className="duplicate-btn"
          onClick={async (e) => {
            e.stopPropagation()
            const result = await window.api.sessionDuplicate(s.id)
            if (result.success) {
              await refresh()
              toast('세션이 복제되었습니다', 'success')
            } else {
              toast('복제 실패: ' + (result.error ?? ''), 'error')
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0,
            transition: 'opacity 0.1s',
          }}
          title="세션 복제"
        >
          {'\uD83D\uDCC2'}
        </button>
        <button
          className="merge-btn"
          onClick={(e) => {
            e.stopPropagation()
            setMergeMode(true)
            setMergeSourceId(s.id)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: mergeSourceId === s.id ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 11,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: mergeSourceId === s.id ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
          title="다른 세션에 병합..."
        >
          &#x2387;
        </button>
        <button
          className="pin-btn"
          onClick={(e) => handlePin(e, s)}
          style={{
            background: 'none',
            border: 'none',
            color: s.pinned ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 13,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: s.pinned ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
          title={s.pinned ? '\uACE0\uC815 \uD574\uC81C' : '\uC138\uC158 \uACE0\uC815'}
        >
          {'\uD83D\uDCCC'}
        </button>
        <button
          className="lock-btn"
          onClick={(e) => { e.stopPropagation(); handleToggleLock(s.id, !s.locked) }}
          style={{
            background: 'none',
            border: 'none',
            color: s.locked ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: s.locked ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
          title={s.locked ? '\uC78A\uAE08 \uD574\uC81C' : '\uC138\uC158 \uC78A\uAE08'}
        >
          {s.locked ? '\uD83D\uDD12' : '\uD83D\uDD13'}
        </button>
        {!s.locked && (
        <button
          onClick={(e) => handleDelete(e, s.id)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 4px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0.5,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = 'var(--error)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
          title="Delete session"
        >
          &#x2715;
        </button>
        )}
      </div>
      {noteOpenId === s.id && (
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <textarea
            autoFocus
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="세션 메모 입력..."
            rows={3}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              resize: 'vertical',
              fontFamily: 'var(--font-ui)',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onKeyDown={async (e) => {
              e.stopPropagation()
              if (e.key === 'Escape') setNoteOpenId(null)
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                await handleNoteSave(s.id)
              }
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
            <button
              onClick={e => { e.stopPropagation(); setNoteOpenId(null) }}
              style={{ fontSize: 10, padding: '2px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              onClick={async (e) => { e.stopPropagation(); await handleNoteSave(s.id) }}
              style={{ fontSize: 10, padding: '2px 6px', background: 'var(--accent)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer' }}
            >
              {noteSaving ? '...' : '저장'}
            </button>
          </div>
        </div>
      )}
      </div>
    )
  }

  return (
    <div>
      {/* Search bar */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{
            position: 'absolute',
            left: 7,
            fontSize: 11,
            color: '#888',
            pointerEvents: 'none',
            lineHeight: 1,
          }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="세션 검색..."
            style={{
              width: '100%',
              background: '#2a2a2a',
              color: '#ffffff',
              border: '1px solid #666',
              borderRadius: 4,
              padding: '4px 24px 4px 24px',
              fontSize: 11,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 4,
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 13,
                padding: '0 2px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
              title="검색 지우기"
            >
              ×
            </button>
          )}
        </div>
        {search && (
          <div style={{ fontSize: 10, color: '#888', marginTop: 3, paddingLeft: 2 }}>
            {filtered.length}개
          </div>
        )}
      </div>
      {/* Tag filter bar */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 2 }}>Tags:</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sessions.length}개 세션</span>
        {TAG_COLORS.map(c => (
          <div
            key={c}
            onClick={() => setFilterTag(prev => prev === c ? null : c)}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: TAG_CSS[c],
              cursor: 'pointer',
              border: filterTag === c ? '2px solid var(--text-primary)' : '2px solid transparent',
              boxSizing: 'border-box',
              opacity: filterTag && filterTag !== c ? 0.4 : 1,
              transition: 'opacity 0.1s, border-color 0.1s',
            }}
            title={`Filter by ${c}`}
          />
        ))}
        {filterTag && (
          <div
            onClick={() => setFilterTag(null)}
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              marginLeft: 4,
              textDecoration: 'underline',
            }}
          >
            clear
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
          <button
            onClick={() => { setSelectionMode(p => !p); setSelectedIds(new Set()) }}
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: selectionMode ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: selectionMode ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
            title="다중 선택 모드"
          >
            {selectionMode ? `${selectedIds.size}개 선택됨` : '선택'}
          </button>
          <button
            onClick={async () => {
              const result = await window.api.sessionExportAll()
              if (result.ok) toast(`${result.count}개 세션을 내보냈습니다.`, 'success')
              else if (!result.canceled && result.error) toast('내보내기 실패: ' + result.error, 'error')
            }}
            title="세션 백업 내보내기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }}
          >
            &#8593; 백업
          </button>
          <button
            onClick={async () => {
              const result = await window.api.sessionImportBackup()
              if (result.ok) {
                toast(`${result.imported}개 세션을 가져왔습니다.`, 'success')
                await refresh()
                onImportComplete?.()
              } else if (!result.canceled && result.error) {
                toast('가져오기 실패: ' + result.error, 'error')
              }
            }}
            title="세션 백업 가져오기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }}
          >
            &#8595; 복원
          </button>
        </div>
      </div>
      {/* Merge mode banner */}
      {mergeMode && (
        <div style={{
          padding: '6px 12px',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span>병합 모드: 대상 세션을 클릭하세요</span>
          <button
            onClick={() => { setMergeMode(false); setMergeSourceId(null) }}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
          >
            &#x2715;
          </button>
        </div>
      )}
      {/* Collection sections */}
      {Array.from(collections.entries()).map(([collName, colSessions]) => (
        <div key={collName}>
          <div
            onClick={() => toggleCollection(collName)}
            style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
          >
            {'\uD83D\uDCC1'} {collName} ({colSessions.length}) {openCollections.has(collName) ? '\u25B4' : '\u25BE'}
          </div>
          {openCollections.has(collName) && colSessions.map(s => renderSessionItem(s))}
        </div>
      ))}
      {/* Pinned sessions */}
      {pinnedFiltered.length > 0 && (
        <div>
          <div style={{
            padding: '4px 12px',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border)',
            marginTop: 4,
            userSelect: 'none',
          }}>
            {'\uACE0\uC815\uB428'}
          </div>
          {pinnedFiltered.map(renderSessionItem)}
        </div>
      )}
      {/* Regular sessions grouped by time */}
      {groups.map(group => (
        <div key={group.label}>
          <div style={{
            padding: '4px 12px',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border)',
            marginTop: 4,
            userSelect: 'none',
          }}>
            {group.label}
          </div>
          {group.items.map(renderSessionItem)}
        </div>
      ))}
      {/* Archive section */}
      {archivedSessions.length > 0 && (
        <div>
          <div
            onClick={() => setArchiveOpen(a => !a)}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
            }}
          >
            {'\uD83D\uDCE6'} {'\uC544\uCE74\uC774\uBC0C'} ({archivedSessions.length}) {archiveOpen ? '\u25B4' : '\u25BE'}
          </div>
          {archiveOpen && archivedSessions.map(renderSessionItem)}
        </div>
      )}
      {filtered.length === 0 && search && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
          {'\uAC80\uC0C9 \uACB0\uACFC \uC5C6\uC74C'}
        </div>
      )}
      {filtered.length === 0 && filterTag && !search && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
          {`'${filterTag}' \uD0DC\uADF8\uAC00 \uC788\uB294 \uC138\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4`}
        </div>
      )}
      {/* Bulk delete bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          padding: '6px 12px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {selectedIds.size}개 선택
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setSelectedIds(new Set(filtered.map(s => s.id)))}
              style={{
                fontSize: 10,
                padding: '2px 6px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-muted)',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              전체
            </button>
            {selectedIds.size >= 2 && (
              <button
                onClick={async () => {
                  const ids = Array.from(selectedIds)
                  const firstSession = sessions.find(s => s.id === ids[0])
                  const defaultTitle = `${firstSession?.title ?? '세션'} (병합)`
                  const title = window.prompt('병합 세션 제목:', defaultTitle)
                  if (title === null) return
                  const result = await window.api.sessionMerge(ids, title || defaultTitle)
                  if (result.success) {
                    await refresh()
                    setSelectedIds(new Set())
                    setSelectionMode(false)
                    toast('세션이 병합되었습니다', 'success')
                  } else {
                    toast('병합 실패: ' + (result.error ?? ''), 'error')
                  }
                }}
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
                병합
              </button>
            )}
            <button
              onClick={async () => {
                if (!window.confirm(`${selectedIds.size}개 세션을 삭제할까요?`)) return
                for (const id of selectedIds) {
                  await window.api.sessionDelete(id)
                }
                setSessions(prev => prev.filter(s => !selectedIds.has(s.id)))
                setSelectedIds(new Set())
                setSelectionMode(false)
              }}
              style={{
                fontSize: 10,
                padding: '2px 8px',
                background: 'var(--error)',
                color: '#fff',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              삭제
            </button>
          </div>
        </div>
      )}
      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: 160,
          }}
        >
          <div
            onClick={async () => {
              const id = contextMenu.sessionId
              setContextMenu(null)
              const result = await window.api.sessionExportMarkdown(id)
              if (result.success) toast('마크다운 내보내기 완료', 'success')
              else if (result.error) toast('내보내기 실패: ' + result.error, 'error')
            }}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            {'📄'} {'마크다운 내보내기'}
          </div>
          <div
            onClick={async () => {
              const id = contextMenu.sessionId
              setContextMenu(null)
              await handleSetCollection(id)
            }}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            {'\uD83D\uDCC1'} {'\ucf5c\ub809\uc158 \uc9c0\uc815...'}
          </div>
          <div
            onClick={async () => {
              const id = contextMenu.sessionId
              setContextMenu(null)
              const name = window.prompt('\ud15c\ud50c\ub9bf \uc774\ub984 \uc785\ub825:')
              if (name === null) return
              const result = await window.api.saveSessionAsTemplate(id, name.trim() || undefined)
              if (result.templateId) {
                await refreshTemplates()
                toast('\ud15c\ud50c\ub9bf\uc73c\ub85c \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4', 'success')
              } else if (result.error) {
                toast('\uc800\uc7a5 \uc2e4\ud328: ' + result.error, 'error')
              }
            }}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            {'\uD83D\uDCC4'} {'\ud15c\ud50c\ub9bf\uc73c\ub85c \uc800\uc7a5'}
          </div>
        </div>
      )}
      {/* Templates section */}
      <div>
        <div
          onClick={() => setTemplateOpen(o => !o)}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
          }}
        >
          {'\uD83D\uDCC4'} {'\ud15c\ud50c\ub9bf'} ({templates.length}) {templateOpen ? '\u25B4' : '\u25BE'}
        </div>
        {templateOpen && (
          <div>
            {templates.length === 0 ? (
              <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
                {'\ud15c\ud50c\ub9bf \uc5c6\uc74c'}
              </div>
            ) : (
              templates.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={async () => {
                    const result = await window.api.createSessionFromTemplate(tpl.id)
                    if (result.sessionId) {
                      await refresh()
                      onSelect(result.sessionId)
                      toast('\ud15c\ud50c\ub9bf\uc5d0\uc11c \uc138\uc158\uc744 \uc0dd\uc131\ud588\uc2b5\ub2c8\ub2e4', 'success')
                    } else if (result.error) {
                      toast('\uc2e4\ud328: ' + result.error, 'error')
                    }
                  }}
                  onContextMenu={async (e) => {
                    e.preventDefault()
                    if (window.confirm(`'\ud15c\ud50c\ub9bf "${tpl.name}"\uc744 \uc0ad\uc81c\ud560\uae4c\uc694?`)) {
                      await window.api.deleteTemplate(tpl.id)
                      await refreshTemplates()
                      toast('\ud15c\ud50c\ub9bf\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4', 'success')
                    }
                  }}
                  className="session-item"
                  style={{
                    padding: '6px 12px 6px 20px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {tpl.messageCount} msgs
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {/* Tag picker popover */}
      {tagPickerFor && tagPickerPos && (
        <div
          ref={tagPickerRef}
          style={{
            position: 'fixed',
            top: tagPickerPos.y,
            left: tagPickerPos.x,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 8px',
            display: 'flex',
            gap: 4,
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div
            onClick={() => handleSetTag(tagPickerFor, [])}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--bg-hover)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: 'var(--text-muted)',
            }}
            title="Clear tags"
          >
            {'\u00D7'}
          </div>
          {TAG_COLORS.map(c => (
            <div
              key={c}
              onClick={() => handleSetTag(tagPickerFor, [c])}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: TAG_CSS[c],
                cursor: 'pointer',
              }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  )
}
