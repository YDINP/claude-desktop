import React from 'react'
import type { ChatMessage } from '../../domains/chat/domain'
import { t } from '../../utils/i18n'

export function BookmarkView({ messages }: { messages: ChatMessage[] }) {
  const bookmarked = messages.filter(m => m.bookmarked)
  const exportAll = () => {
    const blob = new Blob([JSON.stringify(bookmarked, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookmarks-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportOne = (msg: ChatMessage) => {
    const blob = new Blob([JSON.stringify(msg, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookmark-${msg.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  if (!bookmarked.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>
        {t('bookmarkView.empty', '즐겨찾기한 메시지가 없습니다')}
      </div>
    )
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('bookmarkView.count', '즐겨찾기 {n}개').replace('{n}', String(bookmarked.length))}</span>
        <button
          onClick={exportAll}
          style={{
            background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 10,
            padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
          }}
        >{t('bookmarkView.exportAll', '전체 즐겨찾기 내보내기')}</button>
      </div>
      {bookmarked.map(msg => (
        <div key={msg.id} style={{
          marginBottom: 8, padding: '8px 10px',
          background: 'var(--bg-secondary)', borderRadius: 6,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {msg.role === 'user' ? t('msg.roleUser', '나') : 'Claude'} · {msg.timestamp ? new Date(msg.timestamp).toLocaleString('ko-KR') : ''}
            </span>
            <button
              onClick={() => exportOne(msg)}
              title={t('bookmarkView.jsonDownload', 'JSON 다운로드')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 12, padding: '0 4px',
              }}
            >📤</button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'hidden' }}>
            {msg.text.slice(0, 500)}{msg.text.length > 500 ? '…' : ''}
          </div>
        </div>
      ))}
    </>
  )
}
