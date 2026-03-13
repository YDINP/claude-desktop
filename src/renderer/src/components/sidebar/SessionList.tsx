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
  forkedFrom?: string
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const groups: { label: string; items: SessionMeta[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: '이번 주', items: [] },
    { label: '이번 달', items: [] },
    { label: '이전', items: [] },
  ]

  for (const s of sessions) {
    const ts = s.updatedAt ?? s.createdAt ?? 0
    if (ts >= today) groups[0].items.push(s)
    else if (ts >= yesterday) groups[1].items.push(s)
    else if (ts >= weekAgo) groups[2].items.push(s)
    else if (ts >= monthStart) groups[3].items.push(s)
    else groups[4].items.push(s)
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [customTagInput, setCustomTagInput] = useState('')
  const [showTagSuggest, setShowTagSuggest] = useState(false)
  const [filterCustomTag, setFilterCustomTag] = useState<string | null>(null)

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

  // Close more-menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpenId])

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

  const handleAddCustomTag = useCallback(async (sessionId: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed || trimmed.length > 20) return
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    const existing = session.tags ?? []
    if (existing.includes(trimmed)) return
    await window.api.sessionTag(sessionId, [...existing, trimmed])
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, tags: [...(s.tags ?? []), trimmed] } : s))
    setCustomTagInput('')
    setShowTagSuggest(false)
  }, [sessions])

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

  // 모든 세션에서 커스텀 태그 수집 (자동완성용)
  const allCustomTags = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const s of sessions) {
      for (const t of (s.tags ?? []).filter(t => !TAG_COLORS.includes(t as TagColor))) {
        freq[t] = (freq[t] ?? 0) + 1
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 20)
  }, [sessions])

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
    if (filterCustomTag) {
      result = result.filter(s => s.tags?.includes(filterCustomTag))
    }
    return result
  }, [sessions, search, filterTag, filterCustomTag])

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

  const forkMap = useMemo(() => {
    const map = new Map<string, SessionMeta[]>()
    const sessionIdSet = new Set(sessions.map(s => s.id))
    for (const s of sessions) {
      if (s.forkedFrom && sessionIdSet.has(s.forkedFrom)) {
        if (!map.has(s.forkedFrom)) map.set(s.forkedFrom, [])
        map.get(s.forkedFrom)!.push(s)
      }
    }
    return map
  }, [sessions])

  const forkedIds = useMemo(() => {
    const sessionIdSet = new Set(sessions.map(s => s.id))
    const ids = new Set<string>()
    for (const s of sessions) {
      if (s.forkedFrom && sessionIdSet.has(s.forkedFrom)) ids.add(s.id)
    }
    return ids
  }, [sessions])

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

  const pinnedFiltered = activeSessions.filter(s => s.pinned && !s.collection && !forkedIds.has(s.id))
  const unpinnedFiltered = activeSessions.filter(s => !s.pinned && !s.collection && !forkedIds.has(s.id))
  const groups = groupSessions(unpinnedFiltered)

  const renderSessionItem = (s: SessionMeta, depth: number = 0) => {
    const isActive = s.id === activeSessionId
    const isSelected = selectedIds.has(s.id)
    const sessionTags = (s.tags ?? []).filter(t => TAG_COLORS.includes(t as TagColor)).slice(0, 3)
    const sessionCustomTags = (s.tags ?? []).filter(t => !TAG_COLORS.includes(t as TagColor)).slice(0, 2)
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
          padding: `8px 12px 8px ${depth > 0 ? depth * 16 + 12 : 12}px`,
          cursor: 'pointer',
          borderBottom: '1px solid var(--border)',
          borderLeft: isActive ? '3px solid var(--accent)' : depth > 0 ? '3px solid rgba(0,152,255,0.3)' : '3px solid transparent',
          borderTop: dragOverId === s.id ? '2px solid var(--accent)' : '2px solid transparent',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          position: 'relative',
          background: isSelected ? 'var(--bg-hover)' : isActive ? 'var(--bg-hover)' : 'transparent',
          opacity: dragId === s.id ? 0.4 : 1,
        }}
        onMouseEnter={() => handleSessionMouseEnter(s.id)}
        onMouseLeave={() => handleSessionMouseLeave()}
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
              {sessionCustomTags.map(t => (
                <span
                  key={t}
                  onClick={e => { e.stopPropagation(); setFilterCustomTag(t) }}
                  style={{
                    background: 'rgba(82,139,255,0.15)', color: '#7ca0ff',
                    borderRadius: 8, padding: '0px 5px', fontSize: 9, cursor: 'pointer',
                    border: '1px solid rgba(82,139,255,0.3)', flexShrink: 0,
                  }}
                >
                  {t}
                </span>
              ))}
              {s.forkedFrom && (
                <span style={{ fontSize: 9, color: '#0098ff', flexShrink: 0, letterSpacing: 0 }}>⎇</span>
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
        {/* Pin button */}
        <button
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
            opacity: hoveredSession === s.id || s.pinned ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
          title={s.pinned ? '고정 해제' : '세션 고정'}
        >
          {'\uD83D\uDCCC'}
        </button>
        {/* More menu button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === s.id ? null : s.id) }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 4px',
              lineHeight: 1,
              opacity: hoveredSession === s.id || menuOpenId === s.id ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
            title="더보기"
          >
            ⋯
          </button>
          {menuOpenId === s.id && (
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                zIndex: 100,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 0',
                minWidth: 140,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {[
                {
                  label: '이름 변경',
                  icon: '✏️',
                  action: (e: React.MouseEvent) => { setMenuOpenId(null); startRename(e, s) },
                  disabled: s.locked,
                },
                {
                  label: '복제',
                  icon: '📂',
                  action: async (e: React.MouseEvent) => {
                    e.stopPropagation(); setMenuOpenId(null)
                    const result = await window.api.sessionDuplicate(s.id)
                    if (result.success) { await refresh(); toast('세션이 복제되었습니다', 'success') }
                    else toast('복제 실패: ' + (result.error ?? ''), 'error')
                  },
                  disabled: false,
                },
                {
                  label: '병합...',
                  icon: '⎇',
                  action: (e: React.MouseEvent) => { e.stopPropagation(); setMenuOpenId(null); setMergeMode(true); setMergeSourceId(s.id) },
                  disabled: false,
                },
                {
                  label: '메모',
                  icon: '📝',
                  action: (e: React.MouseEvent) => { setMenuOpenId(null); handleNoteOpen(e, s.id) },
                  disabled: false,
                },
                {
                  label: '태그 설정',
                  icon: '🏷',
                  action: (e: React.MouseEvent) => { setMenuOpenId(null); openTagPicker(e, s.id) },
                  disabled: false,
                },
                {
                  label: s.locked ? '잠금 해제' : '세션 잠금',
                  icon: s.locked ? '🔓' : '🔒',
                  action: (e: React.MouseEvent) => { e.stopPropagation(); setMenuOpenId(null); handleToggleLock(s.id, !s.locked) },
                  disabled: false,
                },
                {
                  label: 'MD 내보내기',
                  icon: '📄',
                  action: async (e: React.MouseEvent) => {
                    e.stopPropagation(); setMenuOpenId(null)
                    const result = await window.api.sessionExportMarkdown(s.id)
                    if (result.success) toast('내보내기 완료', 'success')
                    else if (result.error) toast('내보내기 실패: ' + result.error, 'error')
                  },
                  disabled: false,
                },
                {
                  label: '삭제',
                  icon: '✕',
                  action: (e: React.MouseEvent) => { setMenuOpenId(null); handleDelete(e, s.id) },
                  disabled: s.locked,
                  danger: true,
                },
              ].map(({ label, icon, action, disabled, danger }) => (
                <button
                  key={label}
                  onClick={action}
                  disabled={disabled}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 12px',
                    background: 'none',
                    border: 'none',
                    cursor: disabled ? 'default' : 'pointer',
                    fontSize: 12,
                    color: disabled ? 'var(--text-muted)' : danger ? 'var(--error)' : 'var(--text-primary)',
                    opacity: disabled ? 0.4 : 1,
                    gap: 8,
                  }}
                  onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  <span style={{ marginRight: 8 }}>{icon}</span>{label}
                </button>
              ))}
            </div>
          )}
        </div>
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
      {/* Fork children */}
      {depth < 10 && (forkMap.get(s.id) ?? []).map(child => renderSessionItem(child, depth + 1))}
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
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            lineHeight: 1,
          }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="세션 검색..."
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
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
                color: 'var(--text-muted)',
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
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, paddingLeft: 2 }}>
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
        {filterCustomTag && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: 'rgba(82,139,255,0.15)', color: '#7ca0ff',
              borderRadius: 10, padding: '1px 8px', fontSize: 10,
              border: '1px solid rgba(82,139,255,0.3)',
              cursor: 'pointer',
            }}
            onClick={() => setFilterCustomTag(null)}
          >
            #{filterCustomTag} ×
          </span>
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
          {pinnedFiltered.map(s => renderSessionItem(s))}
        </div>
      )}
      {/* Regular sessions grouped by time */}
      {groups.map(group => (
        <div key={group.label}>
          {!search && !filterTag && !filterCustomTag && (
            <div style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              padding: '6px 8px 2px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {group.label}
            </div>
          )}
          {group.items.map(s => renderSessionItem(s))}
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
          {archiveOpen && archivedSessions.map(s => renderSessionItem(s))}
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
      {filtered.length === 0 && filterCustomTag && !search && !filterTag && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
          {`'#${filterCustomTag}' 태그가 있는 세션이 없습니다`}
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
            flexDirection: 'column',
            gap: 4,
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: 160,
          }}
        >
          {/* 색상 dots */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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
                onClick={() => {
                  const session = sessions.find(s => s.id === tagPickerFor)
                  const existing = (session?.tags ?? []).filter(t => !TAG_COLORS.includes(t as TagColor))
                  handleSetTag(tagPickerFor, [c, ...existing])
                }}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: TAG_CSS[c],
                  cursor: 'pointer',
                  border: sessions.find(s => s.id === tagPickerFor)?.tags?.includes(c)
                    ? '2px solid var(--text-primary)' : '2px solid transparent',
                  boxSizing: 'border-box',
                }}
                title={c}
              />
            ))}
          </div>
          {/* 커스텀 태그 입력 */}
          <div style={{ marginTop: 2, position: 'relative' }}>
            <input
              value={customTagInput}
              onChange={e => { setCustomTagInput(e.target.value); setShowTagSuggest(e.target.value.length > 0) }}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter' && customTagInput.trim()) {
                  handleAddCustomTag(tagPickerFor!, customTagInput)
                }
                if (e.key === 'Escape') { setCustomTagInput(''); setShowTagSuggest(false) }
              }}
              onClick={e => e.stopPropagation()}
              placeholder="태그 추가..."
              style={{
                width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', fontSize: 10,
                boxSizing: 'border-box', outline: 'none',
              }}
            />
            {showTagSuggest && allCustomTags.filter(t => t.includes(customTagInput.toLowerCase())).length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, marginTop: 2,
                maxHeight: 100, overflowY: 'auto',
              }}>
                {allCustomTags.filter(t => t.includes(customTagInput.toLowerCase())).slice(0, 6).map(t => (
                  <div
                    key={t}
                    onClick={() => handleAddCustomTag(tagPickerFor!, t)}
                    style={{ padding: '3px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* 현재 커스텀 태그 목록 */}
          {(sessions.find(s => s.id === tagPickerFor)?.tags ?? []).filter(t => !TAG_COLORS.includes(t as TagColor)).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
              {(sessions.find(s => s.id === tagPickerFor)?.tags ?? []).filter(t => !TAG_COLORS.includes(t as TagColor)).map(t => (
                <span
                  key={t}
                  style={{
                    background: 'rgba(82,139,255,0.15)', color: '#7ca0ff',
                    borderRadius: 8, padding: '1px 6px', fontSize: 9,
                    border: '1px solid rgba(82,139,255,0.3)',
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}
                  onClick={() => {
                    const session = sessions.find(s => s.id === tagPickerFor)
                    if (!session) return
                    const newTags = (session.tags ?? []).filter(x => x !== t)
                    handleSetTag(tagPickerFor!, newTags)
                  }}
                  title="클릭하여 제거"
                >
                  {t} ×
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
