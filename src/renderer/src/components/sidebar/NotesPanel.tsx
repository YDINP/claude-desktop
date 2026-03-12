import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'

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
  const [noteCopied, setNoteCopied] = useState(false)
  const [codeMode, setCodeMode] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const NOTE_TEMPLATES = [
    { icon: '📅', label: '미팅 노트', title: '미팅 노트', content: '## 참석자\n\n## 안건\n\n## 논의 내용\n\n## 액션 아이템\n- [ ] ' },
    { icon: '✅', label: '할 일 목록', title: '할 일 목록', content: '## 오늘 할 일\n- [ ] \n- [ ] \n- [ ] \n\n## 나중에\n- [ ] ' },
    { icon: '🐛', label: '버그 리포트', title: '버그 리포트', content: '## 문제 설명\n\n## 재현 방법\n1. \n2. \n\n## 예상 동작\n\n## 실제 동작\n\n## 환경\n' },
    { icon: '💡', label: '아이디어', title: '아이디어', content: '## 개요\n\n## 동기\n\n## 구현 방안\n\n## 장단점\n- 장점: \n- 단점: \n' },
  ]

  const applyTemplate = (t: typeof NOTE_TEMPLATES[number]) => {
    setTitle(t.title)
    setContent(t.content)
    updateCurrent(t.title, t.content)
    setShowTemplates(false)
  }
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const duplicateNote = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const orig = notes.find(n => n.id === id)
    if (!orig) return
    const dup: Note = { ...orig, id: Date.now().toString(), title: orig.title + ' 복사', updatedAt: Date.now(), pinned: false }
    save([dup, ...notes])
    setSelectedId(dup.id)
  }, [notes, save])

  const togglePin = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    save(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n))
  }, [notes, save])

  const copyNoteToClipboard = useCallback(() => {
    if (!selectedId) return
    const note = notes.find(n => n.id === selectedId)
    if (!note) return
    const md = note.title ? `# ${note.title}\n\n${note.content}` : note.content
    navigator.clipboard.writeText(md).then(() => {
      setNoteCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setNoteCopied(false), 1500)
    })
  }, [selectedId, notes])

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx < 0) return text
    return (<>{text.slice(0, idx)}<mark style={{ background: '#fbbf2466', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>)
  }

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

  const importFromFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split('\n')
      const title = (lines[0].startsWith('#') ? lines[0].replace(/^#+\s*/, '') : file.name.replace(/\.[^.]+$/, '')).trim() || '가져온 노트'
      const contentStart = lines[0].startsWith('#') ? lines.slice(1).join('\n').replace(/^\n+/, '') : text
      const note: Note = { id: Date.now().toString(), title, content: contentStart, updatedAt: Date.now() }
      save([note, ...notes])
      setSelectedId(note.id)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

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
        <button onClick={() => fileInputRef.current?.click()} title=".txt/.md 파일 가져오기"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, padding: '0 2px' }}>
          📥
        </button>
        <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={importFromFile} style={{ display: 'none' }} />
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
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', paddingRight: 28 }}>{highlightText(n.title || '(제목 없음)', searchQuery)}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{new Date(n.updatedAt).toLocaleDateString('ko')}</span>
                {n.content.length > 0 && (
                  <span style={{ opacity: 0.6 }}>
                    {n.content.length > 999 ? `${(n.content.length / 1000).toFixed(1)}k` : n.content.length}자
                  </span>
                )}
              </div>
              {searchQuery.trim() && n.content.toLowerCase().includes(searchQuery.toLowerCase()) && (() => {
                const idx = n.content.toLowerCase().indexOf(searchQuery.toLowerCase())
                const start = Math.max(0, idx - 12)
                const end = Math.min(n.content.length, idx + searchQuery.length + 18)
                const excerpt = (start > 0 ? '…' : '') + n.content.slice(start, end) + (end < n.content.length ? '…' : '')
                return <div style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic', paddingRight: 28 }}>{excerpt}</div>
              })()}
              <button onClick={e => duplicateNote(n.id, e)} title="복제"
                style={{ position: 'absolute', top: 3, right: 28, background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--text-muted)', opacity: 0.5, padding: '0 2px' }}>⊕</button>
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
                flex: 1, padding: '8px', fontSize: codeMode ? 10 : 11, lineHeight: 1.6,
                background: 'transparent', border: 'none', resize: 'none',
                color: 'var(--text-primary)', outline: 'none',
                fontFamily: codeMode ? 'var(--font-mono, monospace)' : 'inherit',
              }}
            />
            <div style={{ padding: '2px 8px', fontSize: 9, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', position: 'relative' }}>
              <div style={{ display: 'flex', gap: 2 }}>
                <button onClick={copyNoteToClipboard} title="노트를 Markdown으로 클립보드 복사"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: noteCopied ? 'var(--success)' : 'var(--text-muted)', padding: '0 2px', transition: 'color 0.15s' }}>
                  {noteCopied ? '✓' : '📋'}
                </button>
                <button onClick={() => setCodeMode(v => !v)} title={codeMode ? '일반 텍스트 모드' : '코드 모노스페이스 모드'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: codeMode ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px', fontFamily: 'monospace', fontWeight: codeMode ? 700 : 400 }}>
                  {'</>'}
                </button>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowTemplates(v => !v)} title="노트 템플릿 삽입"
                    style={{ background: showTemplates ? 'var(--accent-dim)' : 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: showTemplates ? 'var(--accent)' : 'var(--text-muted)', padding: '0 2px' }}>
                    ✦
                  </button>
                  {showTemplates && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 50, minWidth: 140, padding: 4 }}>
                      {NOTE_TEMPLATES.map(t => (
                        <button key={t.label} onClick={() => applyTemplate(t)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 11, color: 'var(--text-primary)', borderRadius: 4 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span>{content.length}자 · {content.trim() ? content.trim().split(/\s+/).length : 0}단어 · {content.split('\n').length}줄</span>
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
