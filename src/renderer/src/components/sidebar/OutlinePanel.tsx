import { useState, useMemo, useCallback } from 'react'
import type { ChatMessage } from '../../domains/chat'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { t } from '../../utils/i18n'

type OutlineItem = {
  level: 1 | 2 | 3
  text: string
  msgIndex: number
  lineIndex: number
}

function extractOutline(messages: ChatMessage[]): OutlineItem[] {
  const items: OutlineItem[] = []
  messages.forEach((msg, msgIndex) => {
    if (msg.role !== 'assistant') return
    const lines = msg.text.split('\n')
    lines.forEach((line, lineIndex) => {
      const match = /^(#{1,3})\s+(.+)$/.exec(line)
      if (match) {
        items.push({
          level: match[1].length as 1 | 2 | 3,
          text: match[2].trim(),
          msgIndex,
          lineIndex,
        })
      }
    })
  })
  return items
}

interface OutlinePanelProps {
  messages: ChatMessage[]
  onScrollToMsg?: (msgIndex: number) => void
}

export function OutlinePanel({ messages, onScrollToMsg }: OutlinePanelProps) {
  const [search, setSearch] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<0 | 1 | 2 | 3>(0)

  const allItems = useMemo(() => extractOutline(messages), [messages])

  const [reversed, setReversed] = useState(false)
  const items = useMemo(() => {
    let list = allItems
    if (levelFilter !== 0) list = list.filter(it => it.level === levelFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(it => it.text.toLowerCase().includes(q))
    }
    if (reversed) list = [...list].reverse()
    return list
  }, [allItems, search, levelFilter, reversed])
  const [copied, setCopied] = useState(false)
  const { copiedKey: copiedItemKey, copy: copyHeading } = useCopyToClipboard()
  const copyOutline = useCallback(() => {
    const md = items.map(it => `${'#'.repeat(it.level)} ${it.text}`).join('\n')
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [items])

  const indentMap: Record<1 | 2 | 3, number> = { 1: 0, 2: 12, 3: 24 }
  const sizeMap: Record<1 | 2 | 3, number> = { 1: 13, 2: 12, 3: 11 }
  const colorMap: Record<1 | 2 | 3, string> = { 1: '#e8e8e8', 2: '#aaa', 3: '#888' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px 6px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
          {t('outline.header', '아웃라인')}
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          background: 'var(--bg-hover)',
          borderRadius: 8,
          padding: '1px 6px',
        }}>
          {allItems.length}개
        </span>
        {allItems.length > 0 && (() => {
          const levelCount: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
          allItems.forEach(it => { levelCount[it.level]++ })
          return (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 3 }}>
              {([1, 2, 3] as const).filter(lv => levelCount[lv] > 0).map(lv => (
                <span key={lv} style={{ background: 'var(--bg-hover)', borderRadius: 4, padding: '1px 4px' }}>
                  H{lv}:{levelCount[lv]}
                </span>
              ))}
            </span>
          )
        })()}
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', alignItems: 'center' }}>
          {allItems.length > 0 && (
            <button
              onClick={() => setReversed(v => !v)}
              title={reversed ? t('outline.oldestFirst', '오래된 항목 먼저') : t('outline.newestFirst', '최신 항목 먼저')}
              style={{ padding: '0 5px', fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', background: reversed ? 'var(--accent)' : 'none', color: reversed ? '#fff' : 'var(--text-muted)' }}
            >{reversed ? '↑' : '↓'}</button>
          )}
          {items.length > 0 && (
            <button
              onClick={copyOutline}
              title={t('outline.copyTitle', '아웃라인 복사')}
              style={{ padding: '0 5px', fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', background: copied ? 'var(--accent)' : 'none', color: copied ? '#fff' : 'var(--text-muted)' }}
            >{copied ? '✓' : '📋'}</button>
          )}
          {([1, 2, 3] as const).map(lv => {
            const cnt = allItems.filter(i => i.level === lv).length
            if (cnt === 0) return null
            return (
              <button key={lv} onClick={() => setLevelFilter(f => f === lv ? 0 : lv)}
                title={`H${lv}만 보기 (${cnt}개)`}
                style={{ padding: '0 4px', fontSize: 9, borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', background: levelFilter === lv ? 'var(--accent)' : 'none', color: levelFilter === lv ? '#fff' : 'var(--text-muted)' }}>
                H{lv}({cnt})
              </button>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setSearch('')}
          placeholder={t('outline.searchPlaceholder', '헤딩 검색...')}
          className="panel-search"
          style={{ background: 'var(--bg-input)', boxSizing: 'border-box' }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 11 }}>
            {allItems.length === 0 ? t('outline.empty', '헤딩 없음') : t('outline.noResults', '검색 결과 없음')}
          </div>
        ) : (
          items.map((item, i) => {
            const key = `${item.msgIndex}-${item.lineIndex}`
            const isActive = activeKey === key
            return (
              <div
                key={key}
                onClick={() => {
                  setActiveKey(key)
                  onScrollToMsg?.(item.msgIndex)
                }}
                style={{
                  paddingLeft: 10 + indentMap[item.level],
                  paddingRight: 4,
                  paddingTop: 4,
                  paddingBottom: 4,
                  cursor: 'pointer',
                  fontSize: sizeMap[item.level],
                  color: colorMap[item.level],
                  background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  overflow: 'hidden',
                  transition: 'background 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
                title={item.text}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
                <button
                  onClick={e => { e.stopPropagation(); copyHeading(`${'#'.repeat(item.level)} ${item.text}`, key) }}
                  title={t('outline.copyHeadingTitle', '헤딩 복사')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, padding: '0 2px', color: copiedItemKey === key ? 'var(--success-bright)' : 'var(--border)', flexShrink: 0, opacity: 0, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => { if (copiedItemKey !== key) e.currentTarget.style.opacity = '0' }}
                  ref={el => { if (el && copiedItemKey === key) el.style.opacity = '1' }}
                >📋</button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
