import { useEffect, useMemo, useRef, useState } from 'react'

interface SessionMeta {
  id: string
  title: string
  cwd: string
  updatedAt: number
}

type PaletteResult =
  | { type: 'tab'; path: string; label: string }
  | { type: 'session'; id: string; label: string; sub: string }
  | { type: 'file'; path: string; label: string; sub: string }
  | { type: 'action'; actionId: string; label: string; sub: string; shortcut?: string }
  | { type: 'recent-file'; path: string; label: string; sub: string }
  | { type: 'recent-session'; id: string; label: string; sub: string }
  | { type: 'ai-suggest'; query: string; label: string; sub: string }

interface CommandPaletteProps {
  onClose: () => void
  openTabs: string[]
  onSelectSession: (id: string) => void
  onSelectTab: (path: string) => void
  currentWorkspacePath?: string
  onSelectFile: (path: string) => void
  onNewChat?: () => void
  onOpenFolder?: () => void
  onToggleTerminal?: () => void
  onOpenSettings?: () => void
  onExportMarkdown?: () => void
  onSidebarTab?: (tab: 'files' | 'sessions' | 'changes' | 'search' | 'git' | 'bookmarks') => void
  onToggleSound?: () => void
  onToggleCompact?: () => void
  soundEnabled?: boolean
  compactMode?: boolean
  onAskAI?: (query: string) => void
}

interface GlobalSearchResult {
  sessionId: string
  sessionName: string
  snippet: string
  matchCount: number
}

// --- Usage tracking ---
const usageKey = 'cmdPaletteUsage'
const getUsage = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(usageKey) ?? '{}') } catch { return {} }
}
const incrementUsage = (id: string) => {
  const u = getUsage()
  u[id] = (u[id] ?? 0) + 1
  localStorage.setItem(usageKey, JSON.stringify(u))
}

// --- Favorites ---
const favKey = 'cmdPaletteFavorites'
const getFavorites = (): string[] => {
  try { return JSON.parse(localStorage.getItem(favKey) ?? '[]') } catch { return [] }
}

// --- Recent Files ---
const recentFilesKey = 'recent-files'
const getRecentFiles = (): string[] => {
  try { return JSON.parse(localStorage.getItem(recentFilesKey) ?? '[]') } catch { return [] }
}
export const addRecentFile = (path: string) => {
  const list = getRecentFiles().filter(p => p !== path)
  list.unshift(path)
  localStorage.setItem(recentFilesKey, JSON.stringify(list.slice(0, 20)))
}

function getResultId(r: PaletteResult): string {
  if (r.type === 'tab') return `tab:${r.path}`
  if (r.type === 'session') return `session:${r.id}`
  if (r.type === 'file') return `file:${r.path}`
  if (r.type === 'recent-file') return `recent-file:${r.path}`
  if (r.type === 'recent-session') return `recent-session:${r.id}`
  if (r.type === 'ai-suggest') return `ai-suggest:${r.query}`
  return `action:${r.actionId}`
}

// --- Fuzzy scoring ---
function scoreMatch(label: string, query: string): number {
  if (!query) return 0
  const lowerLabel = label.toLowerCase()
  const lowerQuery = query.toLowerCase()
  if (lowerLabel === lowerQuery) return 120
  if (lowerLabel.startsWith(lowerQuery)) return 100
  const words = lowerLabel.split(/[\s\-_/\\.]/)
  if (words.some(w => w.startsWith(lowerQuery))) return 70
  if (lowerLabel.includes(lowerQuery)) return 30
  return -1
}

export function CommandPalette({ onClose, openTabs, onSelectSession, onSelectTab, currentWorkspacePath, onSelectFile, onNewChat, onOpenFolder, onToggleTerminal, onOpenSettings, onExportMarkdown, onSidebarTab, onToggleSound, onToggleCompact, soundEnabled, compactMode, onAskAI }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [selected, setSelected] = useState(0)
  const [fileResults, setFileResults] = useState<{ name: string; path: string; relPath: string }[]>([])
  const [globalSearchResults, setGlobalSearchResults] = useState<GlobalSearchResult[]>([])
  const globalSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [favorites, setFavorites] = useState<string[]>(getFavorites)
  const usage = useMemo(() => getUsage(), [])

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
      localStorage.setItem(favKey, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    inputRef.current?.focus()
    window.api.sessionList().then(list => setSessions(list as SessionMeta[]))
  }, [])

  useEffect(() => {
    setFileResults([])
    if (query.length >= 2 && currentWorkspacePath) {
      window.api.searchFiles(currentWorkspacePath, query).then(files => setFileResults(files))
    }
  }, [query, currentWorkspacePath])

  // "#" prefix = global session text search
  const isGlobalSearch = query.trimStart().startsWith('#')

  useEffect(() => {
    if (!isGlobalSearch) { setGlobalSearchResults([]); return }
    const term = query.trimStart().slice(1).trim()
    if (term.length < 2) { setGlobalSearchResults([]); return }

    if (globalSearchDebounceRef.current) clearTimeout(globalSearchDebounceRef.current)
    globalSearchDebounceRef.current = setTimeout(async () => {
      const results = await window.api.sessionGlobalSearch(term, 15)
      setGlobalSearchResults(results)
    }, 200)

    return () => { if (globalSearchDebounceRef.current) clearTimeout(globalSearchDebounceRef.current) }
  }, [query, isGlobalSearch])

  // ">" prefix = actions only (VS Code style)
  const isActionMode = query.startsWith('>')
  const q = (isActionMode ? query.slice(1) : query).trim().toLowerCase()

  const tabResults: PaletteResult[] = isActionMode ? [] : openTabs
    .filter(path => {
      const name = path.split(/[\\/]/).pop() ?? path
      return !q || scoreMatch(name, q) >= 0
    })
    .map(path => ({ type: 'tab', path, label: path.split(/[\\/]/).pop() ?? path }))

  const sessionResults: PaletteResult[] = isActionMode ? [] : sessions
    .filter(s => !q || scoreMatch(s.title || '', q) >= 0 || scoreMatch(s.cwd, q) >= 0)
    .slice(0, 10)
    .map(s => ({
      type: 'session',
      id: s.id,
      label: s.title || 'Untitled',
      sub: s.cwd.split(/[\\/]/).slice(-2).join('/'),
    }))

  const filePaletteResults: PaletteResult[] = !isActionMode && query.length >= 2
    ? fileResults.map(f => ({ type: 'file', path: f.path, label: f.name, sub: f.relPath }))
    : []

  const ACTIONS: PaletteResult[] = [
    { type: 'action', actionId: 'new-chat', label: '새 세션 시작', sub: 'New chat', shortcut: 'Ctrl+K' },
    { type: 'action', actionId: 'open-folder', label: '폴더 열기', sub: 'Open workspace' },
    { type: 'action', actionId: 'toggle-terminal', label: '터미널 토글', sub: 'Terminal', shortcut: 'Ctrl+T' },
    { type: 'action', actionId: 'open-settings', label: '설정 열기', sub: 'Settings', shortcut: 'Ctrl+,' },
    { type: 'action', actionId: 'export-markdown', label: '현재 세션을 마크다운으로 내보내기', sub: 'Export session' },
    { type: 'action', actionId: 'session-search', label: '세션 검색 (대화 내 검색)', sub: '# prefix search' },
    { type: 'action', actionId: 'sidebar-git', label: 'Git 패널 열기', sub: 'Sidebar: Git' },
    { type: 'action', actionId: 'sidebar-search', label: '코드 검색 열기', sub: 'Sidebar: Search' },
    { type: 'action', actionId: 'sidebar-bookmarks', label: '북마크 목록 열기', sub: 'Sidebar: Bookmarks' },
    { type: 'action', actionId: 'sidebar-sessions', label: '히스토리 패널 열기', sub: 'Sidebar: History' },
    { type: 'action', actionId: 'toggle-sound', label: soundEnabled ? '알림 사운드 끄기' : '알림 사운드 켜기', sub: 'Sound toggle' },
    { type: 'action', actionId: 'toggle-compact', label: compactMode ? '컴팩트 모드 끄기' : '컴팩트 모드 켜기', sub: 'Compact mode' },
  ]

  const actionResults: PaletteResult[] = !q
    ? ACTIONS
    : ACTIONS.filter(a => scoreMatch(a.label, q) >= 0 || scoreMatch(a.sub, q) >= 0)

  // --- Recent Files (shown when query is empty) ---
  const recentFileResults: PaletteResult[] = useMemo(() => {
    if (q || isActionMode) return []
    return getRecentFiles().slice(0, 5).map(path => {
      const parts = path.split(/[\\/]/)
      const label = parts.pop() ?? path
      const sub = parts.slice(-2).join('/')
      return { type: 'recent-file' as const, path, label, sub }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isActionMode])

  // --- Recent Sessions (shown when query is empty) ---
  const recentSessionResults: PaletteResult[] = useMemo(() => {
    if (q || isActionMode) return []
    return [...sessions]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 5)
      .map(s => ({
        type: 'recent-session' as const,
        id: s.id,
        label: s.title || 'Untitled',
        sub: s.cwd.split(/[\\/]/).slice(-2).join('/'),
      }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isActionMode, sessions])

  // --- AI Suggest (shown when query is non-empty and doesn't start with /) ---
  const aiSuggestResult: PaletteResult[] = useMemo(() => {
    if (!q || isActionMode || isGlobalSearch || query.startsWith('/')) return []
    return [{
      type: 'ai-suggest' as const,
      query: q,
      label: `"${query.trim()}" — AI에 질문하기`,
      sub: '새 채팅에서 이 내용으로 질문합니다',
    }]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isActionMode, isGlobalSearch, query])

  const allFiltered: PaletteResult[] = isGlobalSearch ? [] : [
    ...recentFileResults,
    ...recentSessionResults,
    ...actionResults,
    ...tabResults,
    ...sessionResults,
    ...filePaletteResults,
    ...aiSuggestResult,
  ]

  const results = useMemo(() => {
    if (!q) {
      // No search query: show recent sections first, then pinned/usage-sorted rest
      return [...allFiltered].sort((a, b) => {
        // ai-suggest always last
        if (a.type === 'ai-suggest') return 1
        if (b.type === 'ai-suggest') return -1
        // recent sections stay at top (don't sort them)
        if (a.type === 'recent-file' || a.type === 'recent-session') {
          if (b.type === 'recent-file' || b.type === 'recent-session') return 0
          return -1
        }
        if (b.type === 'recent-file' || b.type === 'recent-session') return 1
        const aId = getResultId(a)
        const bId = getResultId(b)
        const aPin = favorites.includes(aId) ? 1 : 0
        const bPin = favorites.includes(bId) ? 1 : 0
        if (bPin !== aPin) return bPin - aPin
        return (usage[bId] ?? 0) - (usage[aId] ?? 0)
      })
    }
    // With query: score-based sort
    return [...allFiltered].sort((a, b) => {
      if (a.type === 'ai-suggest') return 1
      if (b.type === 'ai-suggest') return -1
      const aId = getResultId(a)
      const bId = getResultId(b)
      const aPin = favorites.includes(aId) ? 1 : 0
      const bPin = favorites.includes(bId) ? 1 : 0
      if (bPin !== aPin) return bPin - aPin
      const aScore = scoreMatch('label' in a ? (a as { label: string }).label : '', q)
      const bScore = scoreMatch('label' in b ? (b as { label: string }).label : '', q)
      if (bScore !== aScore) return bScore - aScore
      return (usage[bId] ?? 0) - (usage[aId] ?? 0)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, usage, query, sessions, fileResults, openTabs])

  const totalCount = isGlobalSearch ? globalSearchResults.length : results.length
  const clampSel = Math.min(selected, Math.max(0, totalCount - 1))

  const select = (r: PaletteResult) => {
    const id = getResultId(r)
    if (r.type === 'tab') { incrementUsage(id); onSelectTab(r.path) }
    else if (r.type === 'session') { incrementUsage(id); onSelectSession(r.id) }
    else if (r.type === 'file') { incrementUsage(id); onSelectFile(r.path) }
    else if (r.type === 'recent-file') { addRecentFile(r.path); onSelectFile(r.path) }
    else if (r.type === 'recent-session') { onSelectSession(r.id) }
    else if (r.type === 'ai-suggest') {
      onNewChat?.()
      onAskAI?.(r.query)
    }
    else if (r.type === 'action') {
      incrementUsage(id)
      if (r.actionId === 'new-chat') onNewChat?.()
      else if (r.actionId === 'open-folder') onOpenFolder?.()
      else if (r.actionId === 'toggle-terminal') onToggleTerminal?.()
      else if (r.actionId === 'open-settings') onOpenSettings?.()
      else if (r.actionId === 'export-markdown') { onExportMarkdown?.(); return }
      else if (r.actionId === 'session-search') { setQuery('# '); setSelected(0); return }
      else if (r.actionId === 'sidebar-git') onSidebarTab?.('git')
      else if (r.actionId === 'sidebar-search') onSidebarTab?.('search')
      else if (r.actionId === 'sidebar-bookmarks') onSidebarTab?.('bookmarks')
      else if (r.actionId === 'sidebar-sessions') onSidebarTab?.('sessions')
      else if (r.actionId === 'toggle-sound') { onToggleSound?.(); return }
      else if (r.actionId === 'toggle-compact') { onToggleCompact?.(); return }
    }
    onClose()
  }

  const selectGlobalResult = (r: GlobalSearchResult) => {
    onSelectSession(r.sessionId)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, totalCount - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      if (isGlobalSearch) {
        const r = globalSearchResults[clampSel]
        if (r) selectGlobalResult(r)
      } else {
        const r = results[clampSel]
        if (r) select(r)
      }
    }
  }

  // Split pinned vs unpinned for section header
  const pinnedResults = results.filter(r => favorites.includes(getResultId(r)))
  const hasFavorites = pinnedResults.length > 0

  // Section header helpers
  const hasRecentFiles = results.some(r => r.type === 'recent-file')
  const hasRecentSessions = results.some(r => r.type === 'recent-session')

  const getTypeLabel = (type: PaletteResult['type']) => {
    switch (type) {
      case 'tab': return 'tab'
      case 'session': return 'hist'
      case 'file': return 'file'
      case 'recent-file': return 'recent'
      case 'recent-session': return 'recent'
      case 'ai-suggest': return '💡'
      default: return '▶ cmd'
    }
  }

  const getTypeColor = (type: PaletteResult['type']) => {
    switch (type) {
      case 'action': return 'var(--warning)'
      case 'tab': return 'var(--accent)'
      case 'session': return 'var(--success)'
      case 'recent-file': return 'var(--accent)'
      case 'recent-session': return 'var(--success)'
      case 'ai-suggest': return 'var(--accent)'
      default: return 'var(--text-muted)'
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="커맨드 팔레트"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 72,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520, background: 'var(--bg-secondary)',
          borderRadius: 8, border: '1px solid var(--border)',
          overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          aria-label="검색"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(0) }}
          onKeyDown={onKeyDown}
          placeholder="명령어, 세션, 파일 검색... (> = 커맨드, # = 대화 내 검색)"
          style={{
            width: '100%', padding: '12px 16px',
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: 'none', borderBottom: '1px solid var(--border)',
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div role="listbox" style={{ maxHeight: 360, overflow: 'auto' }}>
          {isGlobalSearch ? (
            <>
              <div style={{ padding: '6px 16px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg-primary)' }}>
                대화 내 검색
              </div>
              {globalSearchResults.length === 0 && (
                <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                  {query.trimStart().slice(1).trim().length < 2 ? '2글자 이상 입력하세요' : '검색 결과 없음'}
                </div>
              )}
              {globalSearchResults.map((r, i) => (
                <div
                  key={r.sessionId}
                  role="option"
                  aria-selected={i === clampSel}
                  onClick={() => selectGlobalResult(r)}
                  onMouseEnter={() => setSelected(i)}
                  style={{
                    padding: '8px 16px', cursor: 'pointer',
                    background: i === clampSel ? 'var(--bg-hover)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{
                    fontSize: 9, flexShrink: 0, width: 44, textAlign: 'right', textTransform: 'uppercase',
                    fontWeight: 600, letterSpacing: '0.5px', color: 'var(--success)',
                  }}>
                    search
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.sessionName}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 8,
                        background: 'var(--accent)', color: '#fff', flexShrink: 0,
                      }}>
                        {r.matchCount}건
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.snippet}
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {results.length === 0 && (
                <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>No results</div>
              )}
              {results.map((r, i) => {
                const rid = getResultId(r)
                const isPinned = favorites.includes(rid)
                const useCount = usage[rid] ?? 0
                const isFirstUnpinned = hasFavorites && !isPinned && (i === 0 || favorites.includes(getResultId(results[i - 1])))

                // Section headers
                const prevR = i > 0 ? results[i - 1] : null
                const showRecentFilesHeader = r.type === 'recent-file' && (i === 0 || prevR?.type !== 'recent-file') && hasRecentFiles
                const showRecentSessionsHeader = r.type === 'recent-session' && (prevR?.type !== 'recent-session') && hasRecentSessions
                const showFavoritesHeader = isPinned && i === 0
                const showAiHeader = r.type === 'ai-suggest'

                const sectionHeader = showRecentFilesHeader
                  ? '📂 최근 파일'
                  : showRecentSessionsHeader
                  ? '💬 최근 세션'
                  : showFavoritesHeader
                  ? '즐겨찾기'
                  : isFirstUnpinned
                  ? '전체'
                  : showAiHeader
                  ? '제안'
                  : null

                return (
                  <div key={rid}>
                    {sectionHeader && (
                      <div style={{ padding: '6px 16px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg-primary)' }}>
                        {sectionHeader}
                      </div>
                    )}
                    <div
                      role="option"
                      aria-selected={i === clampSel}
                      onClick={() => select(r)}
                      onMouseEnter={() => setSelected(i)}
                      style={{
                        padding: '8px 16px', cursor: 'pointer',
                        background: i === clampSel ? 'var(--bg-hover)' : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 10,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span style={{
                        fontSize: 9, flexShrink: 0, width: 44, textAlign: 'right', textTransform: 'uppercase',
                        fontWeight: 600, letterSpacing: '0.5px',
                        color: getTypeColor(r.type),
                      }}>
                        {getTypeLabel(r.type)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.label}
                        </div>
                        {(r.type === 'session' || r.type === 'file' || r.type === 'recent-file' || r.type === 'recent-session') && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{r.sub}</div>
                        )}
                        {(r.type === 'action' || r.type === 'ai-suggest') && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{r.sub}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {useCount > 0 && r.type !== 'recent-file' && r.type !== 'recent-session' && r.type !== 'ai-suggest' && (
                          <span style={{
                            fontSize: 10, color: 'var(--text-muted)',
                            background: 'var(--bg-primary)', borderRadius: 4,
                            padding: '1px 5px', fontVariantNumeric: 'tabular-nums',
                          }}>
                            {useCount}
                          </span>
                        )}
                        {r.type === 'action' && r.shortcut && (
                          <span style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4,
                            background: 'var(--bg-primary)', color: 'var(--text-muted)',
                            border: '1px solid var(--border)', fontFamily: 'monospace',
                          }}>
                            {r.shortcut}
                          </span>
                        )}
                        {r.type !== 'recent-file' && r.type !== 'recent-session' && r.type !== 'ai-suggest' && (
                          <button
                            onClick={e => toggleFavorite(rid, e)}
                            title={isPinned ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 14, lineHeight: 1, padding: '0 2px',
                              color: isPinned ? 'var(--warning)' : 'var(--text-muted)',
                              opacity: i === clampSel || isPinned ? 1 : 0.3,
                              transition: 'opacity 0.1s',
                            }}
                          >
                            {isPinned ? '★' : '☆'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
