import { useState, useMemo, useCallback, useRef } from 'react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { downloadFile } from '../../utils/download'

interface Note {
  id: string
  title: string
  content: string
  pinned: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'claude-desktop-notes'

const NOTE_TEMPLATES: Record<string, { title: string; content: string }> = {
  meeting: { title: '미팅 노트', content: '## 미팅 노트\n\n**참석자:**\n\n**안건:**\n\n**결정 사항:**\n\n**액션 아이템:**\n' },
  todo: { title: '할일 목록', content: '## 할일 목록\n\n- [ ] \n- [ ] \n- [ ] \n' },
  bug: { title: '버그 리포트', content: '## 버그 리포트\n\n**현상:**\n\n**재현 절차:**\n\n**기대 동작:**\n\n**실제 동작:**\n' },
  idea: { title: '아이디어', content: '## 아이디어\n\n**배경:**\n\n**제안:**\n\n**장단점:**\n' },
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: '#fbbf24', color: '#000', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
      : part
  )
}

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'alpha'>('newest')
  const [editingContent, setEditingContent] = useState('')
  const [editingTitle, setEditingTitle] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [codeMode, setCodeMode] = useState(false)
  const { copiedKey: noteCopied, copy: copyClip } = useCopyToClipboard()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const persist = useCallback((updated: Note[]) => {
    setNotes(updated)
    saveNotes(updated)
  }, [])

  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes
    const q = searchQuery.toLowerCase()
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [notes, searchQuery])

  const sortedNotes = useMemo(() => {
    const pinned = filteredNotes.filter(n => n.pinned)
    const unpinned = filteredNotes.filter(n => !n.pinned)
    const sortFn = (a: Note, b: Note) => {
      if (sortOrder === 'newest') return b.updatedAt - a.updatedAt
      if (sortOrder === 'oldest') return a.updatedAt - b.updatedAt
      return a.title.localeCompare(b.title)
    }
    return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)]
  }, [filteredNotes, sortOrder])

  const cycleSortOrder = () => setSortOrder(s => s === 'newest' ? 'oldest' : s === 'oldest' ? 'alpha' : 'newest')
  const SORT_LABELS: Record<typeof sortOrder, string> = { newest: '최신순', oldest: '오래된순', alpha: '이름순' }

  const addNote = (title = '새 노트', content = '') => {
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      content,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [note, ...notes]
    persist(updated)
    setSelectedId(note.id)
    setEditingTitle(note.title)
    setEditingContent(note.content)
  }

  const applyTemplate = (key: string) => {
    const tpl = NOTE_TEMPLATES[key]
    if (!tpl) return
    addNote(tpl.title, tpl.content)
    setShowTemplates(false)
  }

  const updateNote = (id: string, patch: Partial<Note>) => {
    const updated = notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)
    persist(updated)
  }

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id)
    persist(updated)
    if (selectedId === id) {
      setSelectedId(null)
      setEditingContent('')
      setEditingTitle('')
    }
  }

  const togglePin = (id: string) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    updateNote(id, { pinned: !note.pinned })
  }

  const duplicateNote = (id: string) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    const dup: Note = {
      ...note,
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${note.title} (복사)`,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    persist([dup, ...notes])
  }

  const copyNoteToClipboard = (id: string) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    const md = `# ${note.title}\n\n${note.content}`
    copyClip(md, id)
  }

  const exportNotes = () => {
    const md = notes.map(n => `# ${n.title}\n\n${n.content}`).join('\n\n---\n\n')
    downloadFile(md, `notes-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown')
  }

  const importFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    file.text().then(text => {
      const note: Note = {
        id: `note-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        content: text,
        pinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      persist([note, ...notes])
      setSelectedId(note.id)
      setEditingTitle(note.title)
      setEditingContent(note.content)
    })
  }

  const selectNote = (note: Note) => {
    setSelectedId(note.id)
    setEditingTitle(note.title)
    setEditingContent(note.content)
  }

  const saveEditing = () => {
    if (!selectedId) return
    updateNote(selectedId, { title: editingTitle, content: editingContent })
  }

  // editor view
  if (selectedNote) {
    const charCount = editingContent.length
    const wordCount = editingContent.trim() ? editingContent.trim().split(/\s+/).length : 0
    const lineCount = editingContent.split('\n').length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => { saveEditing(); setSelectedId(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
          >
            {'<'} 목록
          </button>
          <input
            value={editingTitle}
            onChange={e => setEditingTitle(e.target.value)}
            onBlur={saveEditing}
            style={{
              flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)',
              fontSize: 12, fontWeight: 600, outline: 'none',
            }}
          />
          <button
            onClick={() => setCodeMode(!codeMode)}
            title={codeMode ? '일반 모드' : '코드 모노스페이스'}
            style={{
              background: codeMode ? 'var(--accent-dim)' : 'none',
              border: `1px solid ${codeMode ? 'var(--accent)' : 'transparent'}`,
              borderRadius: 4, cursor: 'pointer', color: codeMode ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 10, padding: '1px 5px',
            }}
          >
            {'</>'}
          </button>
        </div>
        <textarea
          value={editingContent}
          onChange={e => setEditingContent(e.target.value)}
          onBlur={saveEditing}
          className={codeMode ? 'font-mono' : ''}
          style={{
            flex: 1, padding: '8px', background: 'transparent', border: 'none',
            color: 'var(--text-primary)', fontSize: 12, resize: 'none', outline: 'none',
            lineHeight: 1.6,
            fontFamily: codeMode ? 'monospace' : 'inherit',
          }}
        />
        <div style={{
          padding: '4px 8px', borderTop: '1px solid var(--border)', fontSize: 10,
          color: 'var(--text-muted)', display: 'flex', gap: 8, opacity: 0.6,
        }}>
          <span>{editingContent.length > 0 ? `${charCount}` : '0'}자 · {wordCount}단어 · {lineCount}줄</span>
        </div>
      </div>
    )
  }

  // list view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
          노트 {sortedNotes.length}개
        </span>
        <button onClick={cycleSortOrder} title={`정렬: ${SORT_LABELS[sortOrder]}`}
          style={{ background: 'none', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '1px 4px' }}>
          {sortOrder === 'newest' ? '🔽' : sortOrder === 'oldest' ? '🔼' : '🔤'}
        </button>
        <button onClick={exportNotes} title="노트를 Markdown으로 내보내기"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px' }}>
          📤
        </button>
        <button onClick={() => fileInputRef.current?.click()} title="파일에서 가져오기"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px' }}>
          📂
        </button>
        <button onClick={() => setShowTemplates(v => !v)} title="템플릿"
          style={{ background: showTemplates ? 'var(--accent-dim)' : 'none', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer', color: showTemplates ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, padding: '1px 5px' }}>
          📝
        </button>
        <button onClick={() => addNote()} title="새 노트"
          style={{ padding: '2px 8px', background: 'var(--accent)', color: '#fff', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: 'none' }}>
          +
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.json"
          style={{ display: 'none' }}
          onChange={importFromFile}
        />
      </div>

      {showTemplates && (
        <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(NOTE_TEMPLATES).map(([key, tpl]) => (
            <button key={key} onClick={() => applyTemplate(key)}
              style={{ padding: '2px 8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: 4, fontSize: 10, cursor: 'pointer', border: '1px solid var(--border)' }}>
              {tpl.title}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '6px 8px' }}>
        <input
          type="text"
          placeholder="노트 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setSearchQuery('')}
          style={{
            width: '100%', padding: '5px 8px', boxSizing: 'border-box',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-primary)', fontSize: 11, outline: 'none',
          }}
        />
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sortedNotes.length === 0 ? (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {notes.length === 0 ? '노트가 없습니다. + 버튼으로 추가하세요.' : '검색 결과 없음'}
          </div>
        ) : sortedNotes.map(n => {
          const excerpt = searchQuery.trim() && n.content.toLowerCase().includes(searchQuery.toLowerCase())
            ? (() => {
                const idx = n.content.toLowerCase().indexOf(searchQuery.toLowerCase())
                const start = Math.max(0, idx - 30)
                const end = Math.min(n.content.length, idx + searchQuery.length + 30)
                return (start > 0 ? '...' : '') + n.content.slice(start, end) + (end < n.content.length ? '...' : '')
              })()
            : n.content.slice(0, 100)

          const charDisplay = n.content.length >= 1000
            ? `${(n.content.length / 1000).toFixed(1)}k자`
            : `${n.content.length}자`

          return (
            <div
              key={n.id}
              onClick={() => selectNote(n)}
              style={{
                padding: '8px 10px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                {n.pinned && <span style={{ fontSize: 10, color: '#fbbf24' }} title="핀 고정">📌</span>}
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {searchQuery ? highlightText(n.title, searchQuery) : n.title}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.6 }}>
                  {charDisplay}
                </span>
              </div>
              <div style={{
                fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                lineHeight: 1.4,
                ...(searchQuery.trim() ? { fontStyle: 'italic' } : {}),
              } as React.CSSProperties}>
                {searchQuery ? highlightText(excerpt, searchQuery) : excerpt}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => togglePin(n.id)} title={n.pinned ? '핀 해제' : '핀 고정'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: n.pinned ? '#fbbf24' : 'var(--text-muted)', fontSize: 10, padding: '1px 4px' }}>
                  {n.pinned ? '📌' : '📍'}
                </button>
                <button onClick={() => copyNoteToClipboard(n.id)} title="노트를 Markdown으로 복사"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: noteCopied === n.id ? '#4ade80' : 'var(--text-muted)', fontSize: 10, padding: '1px 4px' }}>
                  {noteCopied === n.id ? '✓' : '📋'}
                </button>
                <button onClick={() => duplicateNote(n.id)} title="노트 복제"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '1px 4px' }}>
                  ⧉
                </button>
                <span style={{ flex: 1 }} />
                <button onClick={() => deleteNote(n.id)} title="삭제"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error, #f87171)', fontSize: 10, padding: '1px 4px' }}>
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default NotesPanel
