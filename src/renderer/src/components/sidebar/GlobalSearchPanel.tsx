import { useState, useCallback, useRef, useEffect } from 'react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'

const SEARCH_HISTORY_KEY = 'global-search-history'

function loadSearchHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]') } catch { return [] }
}

function saveSearchHistory(h: string[]) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h.slice(0, 5)))
}

interface GlobalSearchResult {
  sessionId: string
  sessionTitle: string
  messageIndex: number
  role: string
  excerpt: string
  updatedAt: number
}

interface Props {
  onSelectSession: (sessionId: string) => void
}

export function GlobalSearchPanel({ onSelectSession }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'assistant'>('all')
  const [sortOrder, setSortOrder] = useState<'relevance' | 'date'>('relevance')
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory)
  const [showHistory, setShowHistory] = useState(false)
  const { copiedKey: copiedResultKey, copy: copyExcerpt } = useCopyToClipboard()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setSearched(false); return }
    setLoading(true)
    setShowHistory(false)
    try {
      const res = await window.api.sessionSearchAll(q)
      setResults(res)
      setSearched(true)
      setSearchHistory(prev => {
        const next = [q, ...prev.filter(h => h !== q)].slice(0, 5)
        saveSearchHistory(next)
        return next
      })
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 400)
  }

  const fmtDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const highlightQuery = (text: string, q: string) => {
    if (!q.trim() || q.length < 2) return <>{text}</>
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx < 0) return <>{text}</>
    return <>{text.slice(0, idx)}<mark style={{ background: '#fbbf2466', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      <div style={{ marginBottom: 8, position: 'relative' }}>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => { if (!query.trim() && searchHistory.length > 0) setShowHistory(true) }}
          onBlur={() => setTimeout(() => setShowHistory(false), 150)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setQuery(''); setResults([]); setSearched(false) }
            else if (e.key === 'Enter' && query.trim().length >= 2) {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              search(query)
            }
          }}
          placeholder="전체 세션 검색..."
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '6px 8px', color: 'var(--text-primary)',
            fontSize: 12, outline: 'none',
          }}
        />
        {showHistory && searchHistory.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            marginTop: 2, overflow: 'hidden',
          }}>
            <div style={{ padding: '3px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>최근 검색</span>
              <button onClick={() => { const next: string[] = []; setSearchHistory(next); saveSearchHistory(next); setShowHistory(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 9, padding: 0 }}>전체 삭제</button>
            </div>
            {searchHistory.map((h, i) => (
              <div key={i}
                style={{ padding: '5px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>🕐</span>
                <span onClick={() => { setQuery(h); setShowHistory(false); search(h) }} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</span>
                <button onClick={e => { e.stopPropagation(); const next = searchHistory.filter((_, j) => j !== i); setSearchHistory(next); saveSearchHistory(next) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}
        {query.length >= 2 && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {(['all', 'user', 'assistant'] as const).map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  style={{ padding: '0 5px', fontSize: 9, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: roleFilter === r ? 'var(--accent)' : 'var(--bg-secondary)', color: roleFilter === r ? '#fff' : 'var(--text-muted)' }}>
                  {r === 'all' ? '전체' : r === 'user' ? '나' : 'Claude'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {!loading && searched && (
                <button
                  onClick={() => setSortOrder(s => s === 'relevance' ? 'date' : 'relevance')}
                  title={sortOrder === 'relevance' ? '날짜순으로 정렬' : '관련성순으로 정렬'}
                  style={{ padding: '0 5px', fontSize: 9, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: sortOrder === 'date' ? 'var(--accent)' : 'var(--bg-secondary)', color: sortOrder === 'date' ? '#fff' : 'var(--text-muted)' }}
                >
                  {sortOrder === 'date' ? '📅' : '⭐'}
                </button>
              )}
              <span>{loading ? '검색 중...' : searched ? `${results.filter(r => roleFilter === 'all' || r.role === roleFilter).length}건` : ''}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {results.length === 0 && searched && !loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
            결과 없음
          </div>
        )}
        {(sortOrder === 'date'
          ? [...results].sort((a, b) => b.updatedAt - a.updatedAt)
          : results
        ).filter(r => roleFilter === 'all' || r.role === roleFilter).map((r, i) => (
          <div
            key={`${r.sessionId}-${r.messageIndex}-${i}`}
            onClick={() => onSelectSession(r.sessionId)}
            style={{
              padding: '6px 8px', marginBottom: 4,
              background: 'var(--bg-secondary)', borderRadius: 4,
              cursor: 'pointer', border: '1px solid transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {r.sessionTitle}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 6 }}>
                <button
                  onClick={e => { e.stopPropagation(); const key = `${r.sessionId}-${r.messageIndex}-${i}`; copyExcerpt(r.excerpt, key) }}
                  title="발췌 복사"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '0 2px', color: copiedResultKey === `${r.sessionId}-${r.messageIndex}-${i}` ? 'var(--success-bright)' : 'var(--text-muted)' }}
                >{copiedResultKey === `${r.sessionId}-${r.messageIndex}-${i}` ? '✓' : '📋'}</button>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {fmtDate(r.updatedAt)}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 10, color: r.role === 'user' ? 'var(--accent)' : 'var(--text-muted)',
              marginBottom: 2 }}>
              {r.role === 'user' ? '나' : 'Claude'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' }}>
              {highlightQuery(r.excerpt, query)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
