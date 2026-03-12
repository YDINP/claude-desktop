import { useState, useEffect, useCallback } from 'react'

interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--border)', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>노트 {notes.length}개</span>
        <button onClick={addNote}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}>
          + 추가
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 노트 목록 */}
        <div style={{ width: 100, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          {notes.length === 0 && <div style={{ padding: 8, fontSize: 10, color: 'var(--text-muted)' }}>노트 없음</div>}
          {notes.map(n => (
            <div key={n.id}
              onClick={() => setSelectedId(n.id)}
              style={{
                padding: '5px 8px', cursor: 'pointer', fontSize: 11,
                background: n.id === selectedId ? 'rgba(96,165,250,0.15)' : 'transparent',
                borderLeft: n.id === selectedId ? '2px solid var(--accent)' : '2px solid transparent',
                borderBottom: '1px solid var(--border)',
                position: 'relative',
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{n.title || '(제목 없음)'}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(n.updatedAt).toLocaleDateString('ko')}</div>
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
