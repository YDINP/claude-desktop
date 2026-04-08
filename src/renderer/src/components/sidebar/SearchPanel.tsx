import React, { useState, useRef, useCallback, useMemo } from 'react'

interface SearchResult {
  filePath: string
  lineNum: number
  lineContent: string
  relPath: string
}

interface GroupedResults {
  filePath: string
  relPath: string
  matches: Array<{ lineNum: number; lineContent: string }>
}

export function SearchPanel({ rootPath, onFileClick }: { rootPath: string; onFileClick: (path: string, line?: number) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedExts, setSelectedExts] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [replaceMode, setReplaceMode] = useState(false)
  const [replaceText, setReplaceText] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [replaceResult, setReplaceResult] = useState<string | null>(null)

  const toggleExt = (ext: string) => {
    setSelectedExts(prev => {
      const next = new Set(prev)
      if (next.has(ext)) next.delete(ext)
      else next.add(ext)
      return next
    })
  }

  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cd-search-history') ?? '[]') } catch { return [] }
  })
  const [showHistory, setShowHistory] = useState(false)

  const saveHistory = (q: string) => {
    const next = [q, ...history.filter(h => h !== q)].slice(0, 20)
    setHistory(next)
    localStorage.setItem('cd-search-history', JSON.stringify(next))
  }

  const removeHistoryItem = (item: string) => {
    const next = history.filter(h => h !== item)
    setHistory(next)
    localStorage.setItem('cd-search-history', JSON.stringify(next))
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem('cd-search-history')
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setIsSearching(true)
    setError(null)
    try {
      const searchQ = wholeWord && !useRegex ? `\\b${q}\\b` : q
      const res = await window.api.grepSearch(rootPath, searchQ, { caseSensitive, useRegex: useRegex || wholeWord })
      if (res.error) setError(res.error)
      setResults(res.results)
      setSelectedExts(new Set())
    } finally {
      setIsSearching(false)
    }
  }, [rootPath, caseSensitive, useRegex, wholeWord])

  const handleChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  const handleSubmit = (q: string) => {
    if (q.trim().length >= 2) saveHistory(q.trim())
    doSearch(q)
    setShowHistory(false)
  }

  const handleHistoryClick = (item: string) => {
    setQuery(item)
    handleSubmit(item)
  }

  const availableExts = useMemo(() => {
    const exts = new Set<string>()
    results.forEach(r => {
      const ext = r.filePath.split('.').pop()?.toLowerCase()
      if (ext) exts.add(ext)
    })
    return Array.from(exts).sort()
  }, [results])

  const filteredResults = useMemo(() => {
    if (selectedExts.size === 0) return results
    return results.filter(r => {
      const ext = r.filePath.split('.').pop()?.toLowerCase() ?? ''
      return selectedExts.has(ext)
    })
  }, [results, selectedExts])

  // Group results by file
  const grouped = filteredResults.reduce<GroupedResults[]>((acc, r) => {
    const existing = acc.find(g => g.filePath === r.filePath)
    if (existing) {
      existing.matches.push({ lineNum: r.lineNum, lineContent: r.lineContent })
    } else {
      acc.push({ filePath: r.filePath, relPath: r.relPath, matches: [{ lineNum: r.lineNum, lineContent: r.lineContent }] })
    }
    return acc
  }, [])

  const handleReplaceAll = async () => {
    if (!results.length || !query.trim()) return
    if (query.length > 200) return
    if (useRegex) {
      try { new RegExp(query) } catch { return }
    }
    const files = [...new Set(results.map(r => r.filePath))]
    const confirmed = window.confirm(`${files.length}개 파일에서 "${query}"를 "${replaceText}"로 바꿀까요?`)
    if (!confirmed) return

    setReplacing(true)
    setReplaceResult(null)

    let successCount = 0
    let errorCount = 0

    for (const filePath of files) {
      try {
        const content = await window.api.readFile(filePath)
        const newContent = useRegex
          ? content.replace(new RegExp(query, caseSensitive ? 'g' : 'gi'), replaceText)
          : caseSensitive
            ? content.split(query).join(replaceText)
            : content.split(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join(replaceText)
        if (newContent !== content) {
          await window.api.writeTextFile(filePath, newContent)
          successCount++
        }
      } catch {
        errorCount++
      }
    }

    setReplacing(false)
    setReplaceResult(`${successCount}개 파일 수정 완료${errorCount > 0 ? ` (${errorCount}개 실패)` : ''}`)
    doSearch(query)
  }

  const fileName = (fp: string) => fp.split(/[/\\]/).pop() ?? fp
  const totalMatches = filteredResults.length
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  const [resultsCopied, setResultsCopied] = useState(false)
  const toggleCollapse = (filePath: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }

  const highlightLine = (text: string, q: string): React.ReactNode => {
    if (!q.trim() || q.length < 2) return text
    try {
      const re = new RegExp(useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi')
      const parts: React.ReactNode[] = []
      let last = 0; let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index))
        parts.push(<mark key={m.index} style={{ background: '#fbbf2466', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{m[0]}</mark>)
        last = m.index + m[0].length
        if (m[0].length === 0) break
      }
      if (last < text.length) parts.push(text.slice(last))
      return parts.length ? <>{parts}</> : text
    } catch { return text }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search input */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
        <input
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(query) }}
          onFocus={() => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
            setShowHistory(true)
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => setShowHistory(false), 150)
          }}
          placeholder="프로젝트 검색... (Enter)"
          style={{
            width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px',
            fontSize: 12, outline: 'none', boxSizing: 'border-box',
          }}
        />
        {/* History dropdown */}
        {showHistory && history.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 8, right: 8,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, zIndex: 50, maxHeight: 240, overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            {history.map(item => (
              <div
                key={item}
                style={{
                  display: 'flex', alignItems: 'center', padding: '4px 8px',
                  fontSize: 12, cursor: 'pointer', gap: 6,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>🕐</span>
                <span
                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}
                  onClick={() => handleHistoryClick(item)}
                >
                  {item}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); removeHistoryItem(item) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '0 2px', fontSize: 12, flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <div
              style={{
                padding: '4px 8px', fontSize: 11, color: 'var(--text-muted)',
                cursor: 'pointer', textAlign: 'center', borderTop: '1px solid var(--border)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              onClick={() => clearHistory()}
            >
              전체 삭제
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} style={{ margin: 0 }} />
            Aa
          </label>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} style={{ margin: 0 }} />
            .*
          </label>
          <label style={{ fontSize: 10, color: wholeWord ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }} title="단어 단위 검색">
            <input type="checkbox" checked={wholeWord} onChange={e => { setWholeWord(e.target.checked); if (query.trim().length >= 2) doSearch(query) }} style={{ margin: 0 }} />
            Ww
          </label>
          <button
            onClick={() => setReplaceMode(r => !r)}
            title="파일에서 바꾸기 모드"
            style={{
              background: replaceMode ? 'var(--accent)' : 'none',
              color: replaceMode ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 4,
              padding: '2px 5px', cursor: 'pointer', fontSize: 11, lineHeight: 1,
            }}
          >
            ⇄
          </button>
          {totalMatches > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {totalMatches}건 ({grouped.length}파일)
            </span>
          )}
        </div>
      </div>
      {replaceMode && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 4, padding: '4px 8px' }}>
            <input
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              placeholder="바꿀 텍스트..."
              style={{ flex: 1, padding: '4px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', fontSize: 12, outline: 'none' }}
            />
            <button
              onClick={handleReplaceAll}
              disabled={replacing || !results.length}
              style={{ padding: '4px 8px', background: replacing || !results.length ? 'var(--bg-secondary)' : '#f44336', border: 'none', borderRadius: 4, color: replacing || !results.length ? 'var(--text-muted)' : '#fff', cursor: replacing || !results.length ? 'default' : 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}
            >
              {replacing ? '...' : '모두 바꾸기'}
            </button>
          </div>
          {replaceResult && (
            <div style={{ padding: '2px 12px 6px', fontSize: 11, color: 'var(--text-muted)' }}>{replaceResult}</div>
          )}
        </div>
      )}

      {/* Extension filter chips */}
      {availableExts.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
          {availableExts.map(ext => (
            <button
              key={ext}
              onClick={() => toggleExt(ext)}
              style={{
                padding: '2px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: selectedExts.has(ext) ? 'var(--accent)' : 'var(--bg-secondary)',
                color: selectedExts.has(ext) ? '#fff' : 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              {ext}
            </button>
          ))}
          {selectedExts.size > 0 && (
            <button
              onClick={() => setSelectedExts(new Set())}
              style={{ padding: '2px 6px', borderRadius: 10, fontSize: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)' }}
            >
              ✕ 전체
            </button>
          )}
        </div>
      )}

      {/* Results summary */}
      {!isSearching && grouped.length > 0 && (
        <div style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{grouped.length}개 파일 · {totalMatches}개 매치</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => {
                const lines = grouped.flatMap(g => [g.filePath, ...g.matches.map(m => `  L${m.lineNum}: ${m.lineContent.trim()}`)]).join('\n')
                navigator.clipboard.writeText(lines).then(() => { setResultsCopied(true); setTimeout(() => setResultsCopied(false), 1500) })
              }}
              title="검색 결과 전체 복사"
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', color: resultsCopied ? '#4caf50' : 'var(--text-muted)', fontSize: 9, padding: '1px 4px', lineHeight: 1 }}
            >{resultsCopied ? '✓' : '📋'}</button>
            {selectedExts.size > 0 && <span style={{ color: 'var(--accent)' }}>{selectedExts.size}개 확장자 필터</span>}
            {grouped.length > 1 && (
              <button
                onClick={() => {
                  if (collapsedFiles.size < grouped.length) {
                    setCollapsedFiles(new Set(grouped.map(g => g.filePath)))
                  } else {
                    setCollapsedFiles(new Set())
                  }
                }}
                title={collapsedFiles.size < grouped.length ? '전체 접기' : '전체 펼치기'}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 9, padding: '1px 4px', lineHeight: 1 }}
              >
                {collapsedFiles.size < grouped.length ? '⊖' : '⊕'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
        {isSearching && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>검색 중...</div>
        )}
        {error && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--error)' }}>오류: {error}</div>
        )}
        {!isSearching && query.length >= 2 && grouped.length === 0 && !error && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>결과 없음</div>
        )}
        {grouped.map(group => {
          const isCollapsed = collapsedFiles.has(group.filePath)
          return (
            <div key={group.filePath} style={{ marginBottom: 4 }}>
              {/* File header */}
              <div style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  onClick={() => toggleCollapse(group.filePath)}
                  style={{ flexShrink: 0, fontSize: 9, color: 'var(--text-muted)', userSelect: 'none' }}
                >
                  {isCollapsed ? '▸' : '▾'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                  onClick={() => onFileClick(group.filePath)}>
                  {fileName(group.filePath)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, flexShrink: 0 }}
                  onClick={() => toggleCollapse(group.filePath)}>
                  {isCollapsed ? `(${group.matches.length})` : group.relPath}
                </span>
              </div>
              {/* Match lines */}
              {!isCollapsed && group.matches.map(m => (
                <div
                  key={m.lineNum}
                  onClick={() => onFileClick(group.filePath, m.lineNum)}
                  style={{ padding: '1px 8px 1px 20px', fontSize: 11, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 28, textAlign: 'right', fontSize: 10 }}>{m.lineNum}</span>
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlightLine(m.lineContent, query)}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
