import { lazy, Suspense, useEffect, useState } from 'react'
import type React from 'react'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { FileTree } from './FileTree'
import { SessionList } from './SessionList'
import { ChangedFilesPanel } from './ChangedFilesPanel'
import { SearchPanel } from './SearchPanel'
import { BookmarksPanel } from './BookmarksPanel'
import { SnippetPanel } from './SnippetPanel'
import { OutlinePanel } from './OutlinePanel'
import { AgentPanel } from './AgentPanel'
import { GlobalSearchPanel } from './GlobalSearchPanel'

const StatsPanel = lazy(() => import('./StatsPanel').then(m => ({ default: m.StatsPanel })))
const PluginsPanel = lazy(() => import('./PluginsPanel').then(m => ({ default: m.PluginsPanel })))
const ConnectionPanel = lazy(() => import('./ConnectionPanel').then(m => ({ default: m.ConnectionPanel })))
const CalendarPanel = lazy(() => import('./CalendarPanel').then(m => ({ default: m.CalendarPanel })))
const TasksPanel = lazy(() => import('./TasksPanel'))
const NotesPanel = lazy(() => import('./NotesPanel'))
const ClipboardPanel = lazy(() => import('./ClipboardPanel').then(m => ({ default: m.ClipboardPanel })))
const DiffPanel = lazy(() => import('./DiffPanel').then(m => ({ default: m.DiffPanel })))
const RemotePanel = lazy(() => import('./RemotePanel').then(m => ({ default: m.RemotePanel })))
import type { ChangedFile } from './ChangedFilesPanel'
import type { ChatMessage } from '../../domains/chat'
import { useProject } from '../../stores/project-store'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import { t } from '../../utils/i18n'

interface SidebarProps {
  onSessionSelect: (sessionId: string) => void
  onNewChat: () => void
  onFileClick: (path: string) => void
  activeFilePath?: string
  activeSessionId?: string | null
  changedFiles?: ChangedFile[]
  onClearChangedFiles?: () => void
  onRemoveChangedFile?: (path: string) => void
  onOpenInSplit?: (path: string) => void
  messages?: ChatMessage[]
  onScrollToMessage?: (messageId: string) => void
  switchTabRef?: React.MutableRefObject<((tab: Tab) => void) | null>
  onInsertSnippet?: (content: string) => void
  onTabChange?: (tab: Tab) => void
  wsKey?: string
  ccPort?: number
  onCCPortChange?: (port: number) => void
  onCCConnectedChange?: (connected: boolean) => void
  forceTab?: Tab
}

export type { Tab as SidebarTab }

type Tab = 'files' | 'sessions' | 'changes' | 'search' | 'bookmarks' | 'stats' | 'snippets' | 'outline' | 'plugins' | 'connections' | 'agent' | 'globalsearch' | 'calendar' | 'tasks' | 'notes' | 'clipboard' | 'diff' | 'remote'

const getPanelTitles = (): Record<Tab, string> => ({
  files:        t('panel.files',       'Files'),
  search:       t('panel.search',      'Search'),
  sessions:     t('panel.sessions',    'History'),
  changes:      t('panel.changes',     'Changes'),
  globalsearch: t('panel.globalsearch','Global Search'),
  bookmarks:    t('panel.bookmarks',   'Bookmarks'),
  stats:        t('panel.stats',       'Stats'),
  snippets:     t('panel.snippets',    'Snippets'),
  outline:      t('panel.outline',     'Outline'),
  plugins:      t('panel.plugins',     'Plugins'),
  connections:  t('panel.connections', 'Connections'),
  agent:        t('panel.agent',       'Agent'),
  calendar:     t('panel.calendar',    '캘린더'),
  tasks:        t('panel.tasks',       '작업'),
  notes:        t('panel.notes',       '노트'),
  clipboard:    t('panel.clipboard',   '클립보드'),
  diff:         t('panel.diff',        'Diff'),
  remote:       t('panel.remote',      '리모트'),
})

export function Sidebar({ onSessionSelect, onNewChat, onFileClick, activeFilePath, activeSessionId, changedFiles = [], onClearChangedFiles, onRemoveChangedFile, onOpenInSplit, messages = [], onScrollToMessage, switchTabRef, onInsertSnippet, onTabChange, wsKey, ccPort, onCCPortChange, onCCConnectedChange, forceTab }: SidebarProps) {
  const panelTitles = getPanelTitles()
  const [tab, setTab] = useState<Tab>('files')
  const switchTab = (t: Tab) => { setTab(t); onTabChange?.(t) }
  // forceTab이 있으면 해당 탭 강제 표시
  const activeTab = forceTab ?? tab

  useEffect(() => {
    if (switchTabRef) switchTabRef.current = switchTab
    return () => { if (switchTabRef) switchTabRef.current = null }
  }, [switchTabRef])
  const { currentPath } = useProject()
  const { features } = useFeatureFlags()
  const [fileSearch, setFileSearch] = useState('')
  const [fileSearchResults, setFileSearchResults] = useState<{ name: string; path: string; relPath: string }[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fileSearch.trim().length >= 2 && currentPath) {
        let cancelled = false
        window.api.searchFiles(currentPath, fileSearch).then(results => {
          if (!cancelled) setFileSearchResults(results)
        })
        return () => { cancelled = true }
      } else {
        setFileSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [fileSearch, currentPath])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar — 2 rows: text tabs + icon tabs */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        {/* Row 1: icon tabs — 균등 분배 */}
        <div role="tablist" aria-label={t('sidebar.tabsLabel', '사이드바 탭')} style={{ display: 'flex' }}>
          {([
            { id: 'files', label: '📁', title: panelTitles.files },
            { id: 'search', label: '🔍', title: panelTitles.search },
            { id: 'sessions', label: '📖', title: panelTitles.sessions },
            { id: 'changes', label: '✏️', title: changedFiles.length > 0 ? `${panelTitles.changes} (${changedFiles.length})` : panelTitles.changes },
            { id: 'globalsearch', label: '🌐', title: panelTitles.globalsearch },
          ] as { id: Tab; label: string; title: string }[]).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => switchTab(t.id)}
              title={t.title}
              style={{
                flex: 1,
                padding: '5px 2px',
                background: activeTab === t.id ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === t.id ? 'var(--text-primary)' : t.id === 'changes' && changedFiles.length > 0 ? 'var(--warning)' : 'var(--text-muted)',
                borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                fontSize: 16,
                transition: 'all 0.1s',
                minWidth: 0,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Row 2: 추가 패널 아이콘 */}
        <div role="tablist" aria-label={t('sidebar.extraTabsLabel', '사이드바 추가 탭')} style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
          {([
            { id: 'calendar', label: '📅', title: panelTitles.calendar },
            { id: 'tasks', label: '✅', title: panelTitles.tasks },
            { id: 'notes', label: '📝', title: panelTitles.notes },
            { id: 'clipboard', label: '📋', title: panelTitles.clipboard },
            { id: 'diff', label: '⊟', title: panelTitles.diff },
            { id: 'remote', label: '🔗', title: panelTitles.remote },
          ] as { id: Tab; label: string; title: string }[]).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => switchTab(t.id)}
              title={t.title}
              style={{
                flex: 1,
                padding: '5px 2px',
                background: activeTab === t.id ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                fontSize: 16,
                transition: 'all 0.1s',
                minWidth: 0,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Row 3: 숨겨진 기능 탭 아이콘 */}
        <div role="tablist" aria-label={t('sidebar.featureTabsLabel', '사이드바 기능 탭')} style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
          {([
            { id: 'bookmarks', label: '★', title: panelTitles.bookmarks },
            { id: 'stats', label: '📊', title: panelTitles.stats },
            { id: 'snippets', label: '✂', title: panelTitles.snippets },
            { id: 'outline', label: '§', title: panelTitles.outline },
            { id: 'plugins', label: '🧩', title: panelTitles.plugins },
            { id: 'connections', label: '🔌', title: panelTitles.connections },
            { id: 'agent', label: '🤖', title: panelTitles.agent },
          ] as { id: Tab; label: string; title: string }[]).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => switchTab(t.id)}
              title={t.title}
              style={{
                flex: 1,
                padding: '5px 2px',
                background: activeTab === t.id ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                fontSize: 16,
                transition: 'all 0.1s',
                minWidth: 0,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 현재 탭 타이틀 */}
      <div style={{
        padding: '4px 10px',
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        {panelTitles[activeTab]}
      </div>

      {/* New chat button */}
      <button
        onClick={onNewChat}
        style={{
          margin: '8px',
          padding: '6px 0',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {t('sidebar.newChat', '+ New Chat')}
      </button>

      {/* Content */}
      <div key={activeTab} role="tabpanel" aria-label={panelTitles[activeTab]} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
        {activeTab === 'files' && currentPath && (
          <ErrorBoundary name="FilesPanel">
            <>
              {/* File search */}
              <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <input
                  value={fileSearch}
                  onChange={e => setFileSearch(e.target.value)}
                  placeholder={t('sidebar.fileSearch', '파일 검색...')}
                  style={{
                    width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 4,
                    padding: '3px 8px', fontSize: 11, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              {/* Search results or tree */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                {fileSearch.trim().length >= 2 ? (
                  fileSearchResults.length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 11 }}>{t('sidebar.noResults', '결과 없음')}</div>
                  ) : (
                    fileSearchResults.map(f => (
                      <div
                        key={f.path}
                        onClick={() => onFileClick(f.path)}
                        style={{
                          padding: '5px 10px', cursor: 'pointer', fontSize: 12,
                          borderBottom: '1px solid var(--border)',
                          background: f.path === activeFilePath ? 'var(--bg-hover)' : 'transparent',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = f.path === activeFilePath ? 'var(--bg-hover)' : 'transparent' }}
                      >
                        <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.relPath}</div>
                      </div>
                    ))
                  )
                ) : (
                  <FileTree rootPath={currentPath} onFileClick={onFileClick} activeFilePath={activeFilePath} onOpenInSplit={onOpenInSplit} />
                )}
              </div>
            </>
          </ErrorBoundary>
        )}
        {activeTab === 'files' && !currentPath && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            {t('sidebar.noFolder', 'No folder open')}
          </div>
        )}
        {activeTab === 'search' && currentPath && (
          <ErrorBoundary name="SearchPanel">
            <SearchPanel rootPath={currentPath} onFileClick={(path) => onFileClick(path)} />
          </ErrorBoundary>
        )}
        {activeTab === 'search' && !currentPath && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            {t('sidebar.noFolder', 'No folder open')}
          </div>
        )}
        {activeTab === 'sessions' && (
          <ErrorBoundary name="SessionList">
            <SessionList onSelect={onSessionSelect} activeSessionId={activeSessionId} />
          </ErrorBoundary>
        )}
        {activeTab === 'changes' && (
          <ErrorBoundary name="ChangedFilesPanel">
            <ChangedFilesPanel
              files={changedFiles}
              onFileClick={onFileClick}
              onClear={onClearChangedFiles ?? (() => {})}
              onRemoveFile={onRemoveChangedFile}
              rootPath={currentPath ?? undefined}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'bookmarks' && (
          <ErrorBoundary name="BookmarksPanel">
            <BookmarksPanel messages={messages} onScrollToMessage={onScrollToMessage} />
          </ErrorBoundary>
        )}
        {activeTab === 'stats' && features.stats && (
          <ErrorBoundary name="StatsPanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <StatsPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === 'stats' && !features.stats && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>{t('sidebar.statsDisabled', '통계 기능이 비활성화되었습니다.')}</div>
        )}
        {activeTab === 'snippets' && (
          <ErrorBoundary name="SnippetPanel">
            <SnippetPanel onInsert={onInsertSnippet ?? (() => {})} />
          </ErrorBoundary>
        )}
        {activeTab === 'outline' && features.outline && (
          <ErrorBoundary name="OutlinePanel">
            <OutlinePanel
              messages={messages}
              onScrollToMsg={onScrollToMessage ? (idx) => {
                const msg = messages[idx]
                if (msg) onScrollToMessage(msg.id)
              } : undefined}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'outline' && !features.outline && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>{t('sidebar.outlineDisabled', '아웃라인 기능이 비활성화되었습니다.')}</div>
        )}
        {activeTab === 'plugins' && features.plugins && (
          <ErrorBoundary name="PluginsPanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <PluginsPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === 'plugins' && !features.plugins && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>{t('sidebar.pluginsDisabled', '플러그인 기능이 비활성화되었습니다.')}</div>
        )}
        {activeTab === 'connections' && features.connections && (
          <ErrorBoundary name="ConnectionPanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <ConnectionPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === 'connections' && !features.connections && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>{t('sidebar.connDisabled', 'MCP 연결 기능이 비활성화되었습니다.')}</div>
        )}
        {activeTab === 'agent' && (
          <ErrorBoundary name="AgentPanel">
            <AgentPanel />
          </ErrorBoundary>
        )}
        {activeTab === 'globalsearch' && (
          <ErrorBoundary name="GlobalSearchPanel">
            <GlobalSearchPanel
              onSelectSession={(sessionId) => {
                switchTab('sessions')
                onSessionSelect(sessionId)
              }}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'calendar' && (
          <ErrorBoundary name="CalendarPanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <CalendarPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === 'tasks' && (
          <ErrorBoundary name="TasksPanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <TasksPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === 'notes' && (
          <ErrorBoundary name="NotesPanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <NotesPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === 'clipboard' && (
          <ErrorBoundary name="ClipboardPanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <ClipboardPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === 'diff' && (
          <ErrorBoundary name="DiffPanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <DiffPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === 'remote' && (
          <ErrorBoundary name="RemotePanel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>...</div>}>
              <RemotePanel />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
