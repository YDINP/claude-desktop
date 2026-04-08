import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadFile } from '../../utils/download'

interface Snippet {
  id: string
  name: string
  content: string
  language?: string
  category?: string
  shortcut?: string
  createdAt: number
}

interface AiSuggestion {
  title: string
  content: string
  category: string
}

interface SnippetPanelProps {
  onInsert: (content: string) => void
  recentMessages?: Array<{ role: string; content: string }>
}

const LANG_OPTIONS = ['', 'typescript', 'javascript', 'python', 'bash', 'json', 'html', 'css', 'sql', 'plaintext']

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: 4,
  padding: '4px 8px', fontSize: 11, outline: 'none',
}

export function SnippetPanel({ onInsert, recentMessages }: SnippetPanelProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Snippet | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [language, setLanguage] = useState('')
  const [category, setCategory] = useState('')
  const [shortcut, setShortcut] = useState('')
  const [filter, setFilter] = useState('')
  const [sortOrder, setSortOrder] = useState<'created' | 'name'>('created')
  const [toast, setToast] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
  const [aiSuggestionsOpen, setAiSuggestionsOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null)

  useEffect(() => {
    window.api.snippetList().then(list => setSnippets(list as Snippet[]))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleAiSuggest = async () => {
    setAiLoading(true)
    setAiSuggestionsOpen(true)
    try {
      const msgs = recentMessages && recentMessages.length > 0
        ? recentMessages
        : [{ role: 'user', content: '최근 대화 없음' }]
      const suggestions = await window.api.suggestSnippets(msgs)
      setAiSuggestions(suggestions)
    } catch {
      setAiSuggestions([])
    } finally {
      setAiLoading(false)
    }
  }

  const handleAddAiSuggestion = async (s: AiSuggestion) => {
    const snippet: Snippet = {
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: s.title,
      content: s.content,
      category: s.category || 'AI 추천',
      createdAt: Date.now(),
    }
    await window.api.snippetSave(snippet)
    const updated = await window.api.snippetList() as Snippet[]
    setSnippets(updated)
    showToast(`"${s.title}" 추가됨`)
  }

  const resetForm = () => {
    setName('')
    setContent('')
    setLanguage('')
    setCategory('')
    setShortcut('')
    setEditTarget(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return
    const snippet: Snippet = {
      id: editTarget?.id ?? `snip-${Date.now()}`,
      name: name.trim(),
      content,
      language: language || undefined,
      category: category.trim() || undefined,
      shortcut: shortcut.trim() || undefined,
      createdAt: editTarget?.createdAt ?? Date.now(),
    }
    await window.api.snippetSave(snippet)
    const updated = await window.api.snippetList() as Snippet[]
    setSnippets(updated)
    resetForm()
  }

  const handleEdit = (s: Snippet) => {
    setEditTarget(s)
    setName(s.name)
    setContent(s.content)
    setLanguage(s.language ?? '')
    setCategory(s.category ?? '')
    setShortcut(s.shortcut ?? '')
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    await window.api.snippetDelete(id)
    setSnippets(prev => prev.filter(s => s.id !== id))
  }

  const handleDuplicate = async (s: Snippet) => {
    const copy: Snippet = {
      ...s,
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `${s.name} (복사)`,
      createdAt: Date.now(),
    }
    await window.api.snippetSave(copy)
    const updated = await window.api.snippetList() as Snippet[]
    setSnippets(updated)
    showToast(`"${copy.name}" 복제됨`)
  }

  // Feature 1: Import from file
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-imported
    e.target.value = ''

    if (file.size > 1024 * 1024) { showToast('1MB 이하만 가능'); return }

    const text = await file.text()
    const ext = file.name.split('.').pop()?.toLowerCase()

    let imported: Snippet[] = []

    if (ext === 'json') {
      try {
        const parsed = JSON.parse(text)
        const raw: unknown[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as { snippets?: unknown[] }).snippets)
            ? (parsed as { snippets: unknown[] }).snippets
            : []
        imported = raw
          .filter((item): item is Snippet =>
            typeof item === 'object' && item !== null &&
            typeof (item as Snippet).name === 'string' &&
            typeof (item as Snippet).content === 'string'
          )
          .map(item => ({
            ...item,
            id: `snip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: (item as Snippet).createdAt ?? Date.now(),
          }))
      } catch {
        showToast('JSON 파싱 실패')
        return
      }
    } else {
      // .txt — single snippet
      const title = file.name.replace(/\.[^.]+$/, '')
      imported = [{
        id: `snip-${Date.now()}`,
        name: title,
        content: text,
        category: 'imported',
        createdAt: Date.now(),
      }]
    }

    if (imported.length === 0) {
      showToast('가져올 스니펫 없음')
      return
    }

    for (const s of imported) {
      await window.api.snippetSave(s)
    }
    const updated = await window.api.snippetList() as Snippet[]
    setSnippets(updated)
    showToast(`${imported.length}개 스니펫 가져왔습니다`)
  }

  // Feature 3: Export to JSON
  const handleExport = () => {
    const json = JSON.stringify(snippets, null, 2)
    downloadFile(json, 'snippets.json', 'application/json')
  }

  const availableCategories = useMemo(() => {
    const cats = new Set(snippets.map(s => s.category ?? '기타'))
    return [...cats].sort()
  }, [snippets])

  const filtered = useMemo(() => {
    let list = filter.trim()
      ? snippets.filter(s =>
          s.name.toLowerCase().includes(filter.toLowerCase()) ||
          s.content.toLowerCase().includes(filter.toLowerCase()) ||
          (s.category ?? '').toLowerCase().includes(filter.toLowerCase()) ||
          (s.shortcut ?? '').toLowerCase().includes(filter.toLowerCase())
        )
      : [...snippets]
    if (catFilter) list = list.filter(s => (s.category ?? '기타') === catFilter)
    if (sortOrder === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    else list.sort((a, b) => b.createdAt - a.createdAt)
    return list
  }, [snippets, filter, sortOrder, catFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, Snippet[]>()
    for (const s of filtered) {
      const cat = s.category ?? '기타'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(s)
    }
    return map
  }, [filtered])

  const renderSnippetItem = (s: Snippet) => (
    <div
      key={s.id}
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '6px 8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <span style={{
          flex: 1, fontSize: 12, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {s.name}
        </span>
        {s.shortcut && (
          <span style={{
            fontSize: 9, color: '#666', background: 'var(--bg-tertiary)',
            borderRadius: 3, padding: '1px 4px', flexShrink: 0, fontFamily: 'monospace',
          }}>
            {s.shortcut}
          </span>
        )}
        {s.language && (
          <span style={{
            fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
            borderRadius: 3, padding: '1px 4px', flexShrink: 0,
          }}>
            {s.language}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace',
        ...(expandedSnippetId === s.id
          ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: 4 }
          : { maxHeight: 40, overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: 2 }),
      }}>
        {expandedSnippetId === s.id ? s.content : (s.content.slice(0, 120) + (s.content.length > 120 ? '…' : ''))}
      </div>
      {s.content.length > 120 && (
        <button
          onClick={() => setExpandedSnippetId(id => id === s.id ? null : s.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--accent)', padding: '0 0 3px', display: 'block' }}
        >
          {expandedSnippetId === s.id ? '▲ 접기' : '▼ 펼치기'}
        </button>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => {
            navigator.clipboard.writeText(s.content).then(() => {
              setCopiedId(s.id)
              setTimeout(() => setCopiedId(id => id === s.id ? null : id), 1500)
            })
          }}
          title="클립보드에 복사"
          style={{
            padding: '3px 6px', background: 'transparent',
            color: copiedId === s.id ? '#4ade80' : 'var(--text-muted)',
            borderRadius: 3, fontSize: 11, flexShrink: 0,
          }}
        >
          {copiedId === s.id ? '✓' : '📋'}
        </button>
        <button
          onClick={() => onInsert(s.content)}
          style={{
            flex: 1, padding: '3px 0', background: 'var(--accent)', color: '#fff',
            borderRadius: 3, fontSize: 10,
          }}
        >
          삽입
        </button>
        <button
          onClick={() => handleEdit(s)}
          style={{
            padding: '3px 8px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            borderRadius: 3, fontSize: 10,
          }}
        >
          편집
        </button>
        <button
          onClick={() => handleDuplicate(s)}
          title="스니펫 복제"
          style={{
            padding: '3px 6px', background: 'transparent', color: 'var(--text-muted)',
            borderRadius: 3, fontSize: 11,
          }}
        >
          ⧉
        </button>
        <button
          onClick={() => handleDelete(s.id)}
          style={{
            padding: '3px 8px', background: 'transparent', color: 'var(--error, #f87171)',
            borderRadius: 3, fontSize: 10,
          }}
        >
          삭제
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 검색 + 버튼들 */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 4 }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setFilter('')}
          placeholder="스니펫 검색..."
          style={{
            flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 4,
            padding: '3px 8px', fontSize: 11, outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => setSortOrder(o => o === 'created' ? 'name' : 'created')}
          title={sortOrder === 'created' ? '이름 순으로 정렬' : '생성 순으로 정렬'}
          style={{
            padding: '3px 6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            borderRadius: 4, fontSize: 11, flexShrink: 0,
          }}
        >
          {sortOrder === 'created' ? '↕️' : '🔤'}
        </button>
        <button
          onClick={handleImportClick}
          title="JSON/TXT 파일에서 가져오기"
          style={{
            padding: '3px 6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            borderRadius: 4, fontSize: 11, flexShrink: 0,
          }}
        >
          📂
        </button>
        <button
          onClick={handleExport}
          title="스니펫 내보내기 (JSON)"
          style={{
            padding: '3px 6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            borderRadius: 4, fontSize: 11, flexShrink: 0,
          }}
        >
          📤
        </button>
        <button
          onClick={handleAiSuggest}
          title="AI 스니펫 제안"
          disabled={aiLoading}
          style={{
            padding: '3px 6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            borderRadius: 4, fontSize: 11, flexShrink: 0,
            opacity: aiLoading ? 0.6 : 1,
          }}
        >
          {aiLoading ? '...' : '💡'}
        </button>
        <button
          onClick={() => { resetForm(); setShowForm(v => !v) }}
          title="새 스니펫"
          style={{
            padding: '3px 8px', background: 'var(--accent)', color: '#fff',
            borderRadius: 4, fontSize: 11, flexShrink: 0,
          }}
        >
          +
        </button>
        {/* 숨김 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* 카테고리 퀵 필터 */}
      {availableCategories.length > 1 && (
        <div style={{ display: 'flex', gap: 3, padding: '3px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(f => f === cat ? null : cat)}
              style={{
                padding: '0 6px', fontSize: 9, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${catFilter === cat ? 'var(--accent)' : 'var(--border)'}`,
                background: catFilter === cat ? 'var(--accent)' : 'none',
                color: catFilter === cat ? '#fff' : 'var(--text-muted)',
              }}
            >
              {cat} ({snippets.filter(s => (s.category ?? '기타') === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* 토스트 메시지 */}
      {toast && (
        <div style={{
          padding: '5px 10px', background: 'var(--accent)', color: '#fff',
          fontSize: 11, textAlign: 'center', flexShrink: 0,
        }}>
          {toast}
        </div>
      )}

      {/* AI 추천 스니펫 */}
      {aiSuggestionsOpen && (
        <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div
            onClick={() => setAiSuggestionsOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', cursor: 'pointer',
              background: 'var(--bg-secondary)', fontSize: 11,
              color: 'var(--text-muted)', userSelect: 'none',
            }}
          >
            <span>💡 AI 추천 스니펫</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                onClick={e => { e.stopPropagation(); handleAiSuggest() }}
                disabled={aiLoading}
                style={{
                  padding: '1px 6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                  borderRadius: 3, fontSize: 10, opacity: aiLoading ? 0.6 : 1,
                }}
              >
                {aiLoading ? '...' : '생성'}
              </button>
              <span style={{ fontSize: 10 }}>▲</span>
            </div>
          </div>
          {aiLoading ? (
            <div style={{ padding: '8px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              AI 분석 중...
            </div>
          ) : aiSuggestions.length === 0 ? (
            <div style={{ padding: '8px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              제안을 불러올 수 없습니다
            </div>
          ) : (
            <div>
              {aiSuggestions.map((s, i) => (
                <div key={i} style={{ padding: '6px 8px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{
                      flex: 1, fontSize: 11, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.title}
                    </span>
                    {s.category && (
                      <span style={{
                        fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
                        borderRadius: 3, padding: '1px 4px', flexShrink: 0,
                      }}>
                        {s.category}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace',
                    maxHeight: 36, overflow: 'hidden', whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all', marginBottom: 4,
                  }}>
                    {s.content.slice(0, 100)}{s.content.length > 100 ? '…' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => onInsert(s.content)}
                      style={{
                        flex: 1, padding: '2px 0', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                        borderRadius: 3, fontSize: 10,
                      }}
                    >
                      삽입
                    </button>
                    <button
                      onClick={() => handleAddAiSuggestion(s)}
                      style={{
                        flex: 1, padding: '2px 0', background: 'var(--accent)', color: '#fff',
                        borderRadius: 3, fontSize: 10,
                      }}
                    >
                      추가
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 추가/편집 폼 */}
      {showForm && (
        <div style={{
          padding: '8px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="이름 *"
            autoFocus
            style={inputStyle}
          />
          <input
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="카테고리 (선택)"
            style={inputStyle}
          />
          <input
            value={shortcut}
            onChange={e => setShortcut(e.target.value)}
            placeholder="단축키 (선택, 예: /hello)"
            style={inputStyle}
          />
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            style={inputStyle}
          >
            <option value="">언어 선택 (선택)</option>
            {LANG_OPTIONS.filter(Boolean).map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="내용 *"
            rows={5}
            style={{
              ...inputStyle,
              resize: 'vertical', fontFamily: 'monospace',
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !content.trim()}
              style={{
                flex: 1, padding: '4px', background: 'var(--accent)', color: '#fff',
                borderRadius: 4, fontSize: 11,
                opacity: !name.trim() || !content.trim() ? 0.5 : 1,
              }}
            >
              {editTarget ? '수정' : '저장'}
            </button>
            <button
              onClick={resetForm}
              style={{
                flex: 1, padding: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                borderRadius: 4, fontSize: 11,
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 스니펫 목록 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            {snippets.length === 0 ? '스니펫이 없습니다. + 버튼으로 추가하세요.' : '검색 결과 없음'}
          </div>
        )}
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <div key={cat}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
              padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 1,
              background: 'var(--bg-secondary)',
            }}>
              {cat}
            </div>
            {items.map(s => renderSnippetItem(s))}
          </div>
        ))}
      </div>
    </div>
  )
}
