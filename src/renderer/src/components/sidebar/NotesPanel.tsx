import { useState, useEffect, useCallback } from 'react'

interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
  pinned?: boolean
}

const STORAGE_KEY = 'claude-desktop-notes'

function loadNotes(): Note[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'title'>('latest')

  const selected = notes.find(n => n.id === selectedId) ?? null

  useEffect(() => {
    if (selected) { setContent(selected.content); setTitle(selected.title) }
    else { setContent(''); setTitle('') }
  }, [selectedId])

  const save = useCallback((next: Note[]) => {
    setNotes(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const addNote = () => {
    const note: Note = { id: Date.now().toString(), title: '새 노트', content: '', updatedAt: Date.now() }
    save([note, ...notes])
    setSelectedId(note.id)
  }

  const deleteNote = (id: string) => {
    save(notes.filter(n => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const updateCurrent = useCallback((newTitle: string, newContent: string) => {
    if (!selectedId) return
    const next = notes.map(n => n.id === selectedId ? { ...n, title: newTitle, content: newContent, updatedAt: Date.now() } : n)
    save(next)
  }, [selectedId, notes, save])

  const togglePin = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    save(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n))
  }, [notes, save])

  const filteredNotes = searchQuery.trim()
    ? notes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : notes

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    if (sortOrder === 'latest') return b.updatedAt - a.updatedAt
    if (sortOrder === 'oldest') return a.updatedAt - b.updatedAt
    return a.title.localeCompare(b.title, 'ko')
  })

  const SORT_LABELS: Record<typeof sortOrder, string> = { latest: '최신', oldest: '오래됨', title: '제목' }
  const cycleSortOrder = () => setSortOrder(s => s === 'latest' ? 'oldest' : s === 'oldest' ? 'title' : 'latest')

  const exportNotes = () => {
    const md = sortedNotes.map(n => `# ${n.title || '(제목 없음)'}\n\n${n.content}`).join('\n\n---\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notes-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--border)', gap: 4, flexShrink: 0 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="노트 검색..."
          style={{
            flex: 1, fontSize: 10, padding: '2px 6px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
            borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{filteredNotes.length}/{notes.length}</span>
        <button onClick={cycleSortOrder} title={`정렬: ${SORT_LABELS[sortOrder]}`}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 9, padding: '2px 5px', flexShrink: 0, whiteSpace: 'nowrap' }}>
          ↕{SORT_LABELS[sortOrder]}
        </button>
        {notes.length > 0 && (
          <button onClick={exportNotes} title="Markdown으로 내보내기"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, padding: '0 2px' }}>
            📤
          </button>
        )}
        <button onClick={addNote}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 8px', flexShrink: 0 }}>
          +
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 노트 목록 */}
        <div style={{ width: 100, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          {sortedNotes.length === 0 && <div style={{ padding: 8, fontSize: 10, color: 'var(--text-muted)' }}>{searchQuery ? '검색 결과 없음' : '노트 없음'}</div>}
          {sortedNotes.map(n => (
            <div key={n.id}
              onClick={() => setSelectedId(n.id)}
              style={{
                padding: '5px 8px', cursor: 'pointer', fontSize: 11,
                background: n.id === selectedId ? 'rgba(96,165,250,0.15)' : 'transparent',
                borderLeft: n.pinned ? '2px solid #fbbf24' : (n.id === selectedId ? '2px solid var(--accent)' : '2px solid transparent'),
                borderBottom: '1px solid var(--border)',
                position: 'relative',
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', paddingRight: 28 }}>{n.title || '(제목 없음)'}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(n.updatedAt).toLocaleDateString('ko')}</div>
              <button onClick={e => togglePin(n.id, e)} title={n.pinned ? '핀 해제' : '핀 고정'}
                style={{ position: 'absolute', top: 3, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: n.pinned ? '#fbbf24' : 'var(--text-muted)', opacity: n.pinned ? 1 : 0.5, padding: '0 2px' }}>📌</button>
              <button onClick={e => { e.stopPropagation(); deleteNote(n.id) }}
                style={{ position: 'absolute', top: 3, right: 3, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', opacity: 0.6, padding: '0 2px' }}>×</button>
            </div>
          ))}
        </div>

        {/* 편집 영역 */}
        {selectedId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); updateCurrent(e.target.value, content) }}
              placeholder="제목..."
              style={{
                padding: '4px 8px', fontSize: 12, fontWeight: 600,
                background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                color: 'var(--text-primary)', outline: 'none', flexShrink: 0,
              }}
            />
            <textarea
              value={content}
              onChange={e => { setContent(e.target.value); updateCurrent(title, e.target.value) }}
              placeholder="노트 내용..."
              style={{
                flex: 1, padding: '8px', fontSize: 11, lineHeight: 1.6,
                background: 'transparent', border: 'none', resize: 'none',
                color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ padding: '2px 8px', fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', borderTop: '1px solid var(--border)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {content.length}자 · {content.trim() ? content.trim().split(/\s+/).length : 0}단어
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
            노트를 선택하거나 + 추가
          </div>
        )}
      </div>
    </div>
  )
}
