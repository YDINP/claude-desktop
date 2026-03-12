import { useState, useEffect, useMemo } from 'react'
import { clipboardStore } from '../../utils/clipboard-store'

interface ClipboardEntry {
  id: string; text: string; source: string; timestamp: number
}

export function ClipboardPanel() {
  const [entries, setEntries] = useState<ClipboardEntry[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    return clipboardStore.subscribe(setEntries)
  }, [])

  const filtered = useMemo(() =>
    query.trim()
      ? entries.filter(e => e.text.toLowerCase().includes(query.toLowerCase()) || e.source.toLowerCase().includes(query.toLowerCase()))
      : entries
  , [entries, query])

  const copyEntry = (entry: ClipboardEntry) => {
    navigator.clipboard.writeText(entry.text)
    setCopiedId(entry.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  if (entries.length === 0) {
    return <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>복사한 내용이 없습니다</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entries.length}개 항목</span>
        <button onClick={() => clipboardStore.clear()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}>전체 삭제</button>
      </div>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          placeholder="클립보드 검색..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
          style={{ width: '100%', padding: '3px 6px', boxSizing: 'border-box', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && query && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>검색 결과 없음</div>
        )}
        {filtered.map(entry => (
          <div key={entry.id} style={{ padding: '8px', borderBottom: '1px solid var(--border)', cursor: 'pointer', position: 'relative' }}
            onClick={() => copyEntry(entry)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
              <span>{new Date(entry.timestamp).toLocaleTimeString('ko-KR')} · {entry.source}</span>
              <span style={{ flexShrink: 0 }}>{entry.text.length.toLocaleString()}자</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', maxHeight: 60, lineHeight: 1.4, textOverflow: 'ellipsis', WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
              {entry.text}
            </div>
            {copiedId === entry.id && (
              <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 10, color: 'var(--accent)' }}>✓ 복사됨</div>
            )}
            <button onClick={e => { e.stopPropagation(); clipboardStore.remove(entry.id) }}
              style={{ position: 'absolute', top: 4, right: copiedId === entry.id ? 40 : 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, opacity: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
