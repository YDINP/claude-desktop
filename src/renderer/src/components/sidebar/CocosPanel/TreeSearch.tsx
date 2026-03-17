import { useState, useCallback } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'

// ── 노드 트리 검색 ──────────────────────────────────────────────────────────

export function TreeSearch({ root, onSelect, onQueryChange }: { root: CCSceneNode; onSelect: (n: CCSceneNode | null) => void; onQueryChange?: (q: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CCSceneNode[]>([])
  const [totalFound, setTotalFound] = useState(0)
  const [open, setOpen] = useState(false)
  // R1558: 키보드 탐색
  const [activeIdx, setActiveIdx] = useState(-1)
  // R1679: 더 보기 (페이지 크기 증가)
  const [pageSize, setPageSize] = useState(12)
  // R1694: 최근 검색어 히스토리
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tree-search-history') ?? '[]') } catch { return [] }
  })

  const search = useCallback((q: string, ps?: number) => {
    setQuery(q)
    setActiveIdx(-1)
    onQueryChange?.(q)
    if (!q.trim()) { setResults([]); setTotalFound(0); setOpen(false); setPageSize(12); return }
    // R2498: /regex/ 구문 지원 — 슬래시로 시작하면 정규식으로 파싱
    let regex: RegExp | null = null
    if (q.startsWith('/') && q.length > 1) {
      try { regex = new RegExp(q.slice(1), 'i') } catch { /* invalid regex — fall back to literal */ }
    }
    const ql = q.toLowerCase()
    const found: CCSceneNode[] = []
    function walk(n: CCSceneNode) {
      // R1558: 이름 + 컴포넌트 타입 모두 검색
      const nameMatch = regex ? regex.test(n.name) : n.name.toLowerCase().includes(ql)
      const compMatch = !regex && n.components.some(c => c.type.toLowerCase().includes(ql))
      if (nameMatch || compMatch) found.push(n)
      n.children.forEach(walk)
    }
    walk(root)
    const limit = ps ?? pageSize
    setTotalFound(found.length)
    setResults(found.slice(0, limit))
    setOpen(true)
  }, [root, pageSize])

  const addToHistory = (q: string) => {
    if (!q.trim()) return
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, 8)
      localStorage.setItem('tree-search-history', JSON.stringify(next))
      return next
    })
  }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        value={query}
        onChange={e => search(e.target.value)}
        onFocus={() => { if (!query.trim() && searchHistory.length > 0) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="노드/컴포넌트 검색..."
        onKeyDown={e => {
          // R1558: ↑↓ 탐색, Enter 선택, Escape 닫기
          if (!open || results.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') {
            e.preventDefault()
            const idx = activeIdx >= 0 ? activeIdx : 0
            if (results[idx]) { addToHistory(query); onSelect(results[idx]); setQuery(''); setOpen(false) }
          }
          else if (e.key === 'Escape') { setOpen(false); setQuery('') }
        }}
        style={{
          width: '100%', background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 10, boxSizing: 'border-box',
        }}
      />
      {/* R1694: 빈 검색 + 포커스 → 최근 검색어 드롭다운 */}
      {open && !query.trim() && searchHistory.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border)',
          borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>최근 검색</div>
          {searchHistory.map((h, i) => (
            <div
              key={i}
              onMouseDown={() => { search(h); addToHistory(h) }}
              style={{ padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>🕐 {h}</span>
              <span onMouseDown={e => { e.stopPropagation(); setSearchHistory(prev => { const next = prev.filter((_, j) => j !== i); localStorage.setItem('tree-search-history', JSON.stringify(next)); return next }) }} style={{ color: '#555', fontSize: 9 }}>×</span>
            </div>
          ))}
        </div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border)',
          borderRadius: 4, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {results.map((n, i) => (
            <div
              key={n.uuid}
              onMouseDown={() => { addToHistory(query); onSelect(n); setQuery(''); setOpen(false) }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: '4px 8px', fontSize: 10, cursor: 'pointer',
                color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                background: i === activeIdx ? 'rgba(88,166,255,0.15)' : 'transparent',
              }}
            >
              {n.name || '(unnamed)'}
              {n.components.length > 0 && (
                <span style={{ marginLeft: 4, color: '#58a6ff', fontSize: 8 }}>
                  {n.components.map(c => c.type.split('.').pop()).join(' · ')}
                </span>
              )}
              {!n.active && <span style={{ marginLeft: 4, fontSize: 8, color: '#f85149' }}>◌</span>}
            </div>
          ))}
          {/* R1679: 전체 결과 수 + 더 보기 */}
          <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{results.length < totalFound ? `${results.length} / ${totalFound}개` : `${totalFound}개`}</span>
            {results.length < totalFound && (
              <span
                onMouseDown={e => { e.preventDefault(); const np = pageSize + 12; setPageSize(np); search(query, np) }}
                style={{ cursor: 'pointer', color: '#58a6ff', fontSize: 8 }}
              >더 보기 ▾</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
