import { useState, useMemo } from 'react'
import type { ChatMessage } from '../../stores/chat-store'

export function BookmarksPanel({
  messages,
  onScrollToMessage,
}: {
  messages: ChatMessage[]
  onScrollToMessage?: (messageId: string) => void
}) {
  const [query, setQuery] = useState('')
  const bookmarked = messages.filter(m => m.bookmarked)

  const filtered = useMemo(() =>
    query.trim()
      ? bookmarked.filter(b => b.text.toLowerCase().includes(query.toLowerCase()))
      : bookmarked
  , [bookmarked, query])

  const exportBookmarks = () => {
    const md = bookmarked.map(b =>
      `### ${b.role === 'assistant' ? 'Claude' : '사용자'}\n\n${b.text}\n\n---`
    ).join('\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (bookmarked.length === 0) {
    return (
      <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        ★ 북마크된 메시지 없음
        <div style={{ fontSize: 11, marginTop: 4 }}>메시지 위에 마우스를 올리고 ☆ 클릭</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
          북마크 {bookmarked.length}개
        </span>
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
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.5,
            } as React.CSSProperties}>
              {m.text.slice(0, 200)}{m.text.length > 200 ? '\u2026' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
