// QA: 클립보드 검색
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useExpandedId } from '../../hooks/useExpandedId'
import { t } from '../../utils/i18n'

// --- Types ---

interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
}

// --- Constants ---

const STORAGE_KEY = 'clipboardHistory'
const PINNED_KEY = 'clipboardPinnedIds'
const MAX_ENTRIES = 100

// --- Helpers ---

function loadEntries(): ClipboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveEntries(entries: ClipboardEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function loadPinnedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function savePinnedIds(ids: Set<string>) {
  localStorage.setItem(PINNED_KEY, JSON.stringify([...ids]))
}

// --- Component ---

export function ClipboardPanel() {
  const [entries, setEntries] = useState<ClipboardEntry[]>(loadEntries)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(loadPinnedIds)
  const [query, setQuery] = useState('')
  const { copiedKey: copiedId, copy: copyItemClip } = useCopyToClipboard()
  const { expandedId, toggle: toggleExpanded } = useExpandedId()

  // Persist
  useEffect(() => { saveEntries(entries) }, [entries])
  useEffect(() => { savePinnedIds(pinnedIds) }, [pinnedIds])

  // Listen for clipboard changes (poll every 2s)
  useEffect(() => {
    let last = ''
    const interval = setInterval(async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text && text !== last && text.trim()) {
          last = text
          setEntries(prev => {
            // Deduplicate
            if (prev.length > 0 && prev[0].text === text) return prev
            const entry: ClipboardEntry = {
              id: `cb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              text,
              timestamp: Date.now(),
            }
            return [entry, ...prev].slice(0, MAX_ENTRIES)
          })
        }
      } catch {
        // clipboard read may fail without focus/permission
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // --- Derived ---
  const filtered = useMemo(() => {
    if (!query.trim()) return entries
    const q = query.toLowerCase()
    return entries.filter(e => e.text.toLowerCase().includes(q))
  }, [entries, query])

  // --- Handlers ---

  const isPinned = useCallback((id: string) => pinnedIds.has(id), [pinnedIds])

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const copyItem = useCallback((id: string, text: string) => {
    // 클립보드에 복사
    copyItemClip(text, id)
  }, [copyItemClip])

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
    setPinnedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  // 비핀 삭제 - pinned items are protected
  const clearUnpinned = useCallback(() => {
    setEntries(prev => prev.filter(e => pinnedIds.has(e.id)))
  }, [pinnedIds])

  // --- Render ---

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search bar */}
      <div className="panel-header" style={{ gap: 4, flexShrink: 0 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setQuery('')}
          placeholder={t('clipboard.searchPlaceholder')}
          className="panel-search"
          style={{ flex: 1, background: 'var(--bg-input)', boxSizing: 'border-box' }}
        />
        <button
          onClick={clearUnpinned}
          title={pinnedIds.size > 0 ? `비핀 삭제 (${pinnedIds.size}개 📌 보호)` : '전체 삭제'}
          style={{
            padding: '3px 6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            borderRadius: 4, fontSize: 11, cursor: 'pointer', border: 'none', flexShrink: 0,
          }}
        >
          {pinnedIds.size > 0 ? `🗑 (📌${pinnedIds.size})` : '🗑'}
        </button>
      </div>

      {/* Stats */}
      <div style={{
        padding: '3px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8,
      }}>
        {query.trim() ? (
          <span>{filtered.length}/{entries.length}건</span>
        ) : (
          <span>{entries.length}건</span>
        )}
        {pinnedIds.size > 0 && <span>📌 {pinnedIds.size}개 고정</span>}
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div className="panel-empty">
            {entries.length === 0 ? t('clipboard.empty') : t('common.noResults')}
          </div>
        ) : filtered.map(entry => {
          const pinned = isPinned(entry.id)
          const isExpanded = expandedId === entry.id
          const charCount = entry.text.length
          return (
            <div
              key={entry.id}
              style={{
                padding: '6px 8px', borderBottom: '1px solid var(--border)',
                background: pinned ? 'var(--bg-secondary)' : 'transparent',
              }}
            >
              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', flex: 1 }}>
                  {new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  {' '}
                  <span title={`${charCount.toLocaleString()}자`}>
                    ({charCount.toLocaleString()}자)
                  </span>
                </span>
                <button
                  onClick={() => togglePin(entry.id)}
                  title={pinned ? '고정 해제' : '고정'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: pinned ? '#fbbf24' : 'var(--text-muted)', fontSize: 11,
                    padding: '0 2px',
                  }}
                >
                  {pinned ? '📌' : '○'}
                </button>
              </div>
              {/* Text content */}
              <div style={{
                fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace',
                ...(isExpanded
                  ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all' }
                  : { maxHeight: 40, overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }),
              }}>
                {isExpanded ? entry.text : entry.text.slice(0, 150) + (entry.text.length > 150 ? '...' : '')}
              </div>
              {/* Expand / actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                {entry.text.length > 150 && (
                  <button
                    onClick={() => toggleExpanded(entry.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 9, color: 'var(--accent)', padding: 0,
                    }}
                  >
                    {isExpanded ? '▲ 접기' : '▼ 펼치기'}
                  </button>
                )}
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => copyItem(entry.id, entry.text)}
                  title="클립보드에 복사"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: copiedId === entry.id ? '#4ade80' : 'var(--text-muted)',
                    fontSize: 11, padding: '0 2px',
                  }}
                >
                  {copiedId === entry.id ? '✓' : '📋'}
                </button>
                <button
                  onClick={() => removeEntry(entry.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--error, #f87171)', fontSize: 10, padding: '0 2px',
                  }}
                >
                  x
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
