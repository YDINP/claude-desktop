import { useState, useMemo } from 'react'
import type { ChatMessage } from '../../domains/chat'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useExpandedId } from '../../hooks/useExpandedId'
import { downloadFile } from '../../utils/download'

export function BookmarksPanel({
  messages,
  onScrollToMessage,
}: {
  messages: ChatMessage[]
  onScrollToMessage?: (messageId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'assistant'>('all')
  const { copiedKey: copiedId, copy: copyBookmark } = useCopyToClipboard()
  const { expandedId, toggle: setExpandedId } = useExpandedId()
  const [copiedAll, setCopiedAll] = useState(false)
  const [sortOrder, setSortOrder] = useState<'default' | 'newest' | 'oldest'>('default')
  const cycleSortOrder = () => setSortOrder(s => s === 'default' ? 'newest' : s === 'newest' ? 'oldest' : 'default')
  const SORT_ICONS: Record<typeof sortOrder, string> = { default: '↕', newest: '🔽', oldest: '🔼' }
  const bookmarked = messages.filter(m => m.bookmarked)

  const filtered = useMemo(() => {
    let list = query.trim()
      ? bookmarked.filter(b => b.text.toLowerCase().includes(query.toLowerCase()))
      : bookmarked
    if (roleFilter !== 'all') list = list.filter(b => b.role === roleFilter)
    if (sortOrder === 'newest') list = [...list].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    else if (sortOrder === 'oldest') list = [...list].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    return list
  }, [bookmarked, query, roleFilter, sortOrder])

  const ROLE_LABELS: Record<typeof roleFilter, string> = { all: '전체', user: '나', assistant: 'Claude' }
  const cycleRole = () => setRoleFilter(r => r === 'all' ? 'user' : r === 'user' ? 'assistant' : 'all')

  const exportBookmarks = () => {
    const md = bookmarked.map(b =>
      `### ${b.role === 'assistant' ? 'Claude' : '사용자'}\n\n${b.text}\n\n---`
    ).join('\n\n')
    downloadFile(md, `bookmarks-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown')
  }

  if (bookmarked.length === 0) {
    return (
      <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
        ★ 북마크된 메시지 없음
        <div style={{ fontSize: 11, marginTop: 4 }}>메시지 위에 마우스를 올리고 ☆ 클릭</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
          북마크 {(query.trim() || roleFilter !== 'all') && filtered.length !== bookmarked.length
            ? <>{filtered.length}<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>/{bookmarked.length}</span></>
            : bookmarked.length}개
        </span>
        <button onClick={cycleRole} title={`역할 필터: ${ROLE_LABELS[roleFilter]}`}
          style={{ background: roleFilter !== 'all' ? 'var(--accent-dim)' : 'none', border: `1px solid ${roleFilter !== 'all' ? 'var(--accent)' : 'transparent'}`, borderRadius: 4, cursor: 'pointer', color: roleFilter !== 'all' ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, padding: '1px 5px' }}>
          {ROLE_LABELS[roleFilter]}
        </button>
        <button onClick={cycleSortOrder} title={`정렬: ${sortOrder === 'default' ? '기본순' : sortOrder === 'newest' ? '최신순' : '오래된순'}`}
          style={{ background: sortOrder !== 'default' ? 'var(--accent-dim)' : 'none', border: `1px solid ${sortOrder !== 'default' ? 'var(--accent)' : 'transparent'}`, borderRadius: 4, cursor: 'pointer', color: sortOrder !== 'default' ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, padding: '1px 4px' }}>
          {SORT_ICONS[sortOrder]}
        </button>
        <button
          onClick={() => {
            const md = filtered.map(b => `### ${b.role === 'assistant' ? 'Claude' : '사용자'}\n\n${b.text}`).join('\n\n---\n\n')
            navigator.clipboard.writeText(md).then(() => { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1500) })
          }}
          title="필터된 북마크 전체 클립보드 복사"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedAll ? '#4ade80' : 'var(--text-muted)', fontSize: 12, padding: '2px 4px', lineHeight: 1 }}
        >
          {copiedAll ? '✓' : '📋'}
        </button>
        <button
          onClick={exportBookmarks}
          title="마크다운으로 내보내기"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 14, padding: '2px 4px',
            lineHeight: 1,
          }}
        >
          📤
        </button>
      </div>
      <div style={{ padding: '8px 10px 4px' }}>
        <input
          type="text"
          placeholder="북마크 검색..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setQuery('')}
          style={{
            width: '100%', padding: '6px 8px', boxSizing: 'border-box',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-primary)', fontSize: 12,
            outline: 'none',
          }}
        />
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            검색 결과 없음
          </div>
        ) : filtered.map(m => (
          <div
            key={m.id}
            onClick={() => onScrollToMessage?.(m.id)}
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border)',
              cursor: onScrollToMessage ? 'pointer' : 'default',
            }}
            onMouseEnter={e => { if (onScrollToMessage) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ color: '#fbbf24', fontSize: 11 }}>★</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: m.role === 'user' ? 'var(--accent)' : 'var(--success)', textTransform: 'uppercase' }}>
                {m.role === 'user' ? 'You' : 'Claude'}
              </span>
              {m.timestamp && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {new Date(m.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); setExpandedId(m.id) }}
                title={expandedId === m.id ? '접기' : '펼치기'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--text-muted)', fontSize: 9, lineHeight: 1, flexShrink: 0 }}
              >
                {expandedId === m.id ? '▲' : '▼'}
              </button>
              <button
                onClick={e => { e.stopPropagation(); copyBookmark(m.text, m.id) }}
                title="클립보드에 복사"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
                  color: copiedId === m.id ? '#4ade80' : 'var(--text-muted)', fontSize: 11,
                  lineHeight: 1, flexShrink: 0,
                }}
              >
                {copiedId === m.id ? '✓' : '📋'}
              </button>
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              ...(expandedId === m.id ? { lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : {
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.5,
              }),
            } as React.CSSProperties}>
              {expandedId === m.id ? m.text : (m.text.slice(0, 200) + (m.text.length > 200 ? '\u2026' : ''))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
