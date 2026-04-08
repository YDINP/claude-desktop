import { useEffect, useState } from 'react'
import type React from 'react'
import { FileTree } from './FileTree'
import { SessionList } from './SessionList'
import { ChangedFilesPanel } from './ChangedFilesPanel'
import { SearchPanel } from './SearchPanel'
import { BookmarksPanel } from './BookmarksPanel'
import { StatsPanel } from './StatsPanel'
import { SnippetPanel } from './SnippetPanel'
import { OutlinePanel } from './OutlinePanel'
import { PluginsPanel } from './PluginsPanel'
import { ConnectionPanel } from './ConnectionPanel'
import { AgentPanel } from './AgentPanel'
import { GlobalSearchPanel } from './GlobalSearchPanel'
import { CalendarPanel } from './CalendarPanel'
import { TasksPanel } from './TasksPanel'
import { NotesPanel } from './NotesPanel'
import { ClipboardPanel } from './ClipboardPanel'
import { DiffPanel } from './DiffPanel'
import { RemotePanel } from './RemotePanel'
import type { ChangedFile } from './ChangedFilesPanel'
import type { ChatMessage } from '../../domains/chat'
import { useProject } from '../../stores/project-store'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'

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

const PANEL_TITLES: Record<Tab, string> = {
  files: 'Files',
  search: 'Search',
  sessions: 'History',
  changes: 'Changes',
  globalsearch: 'Global Search',
  bookmarks: 'Bookmarks',
  stats: 'Stats',
  snippets: 'Snippets',
  outline: 'Outline',
  plugins: 'Plugins',
  connections: 'Connections',
  agent: 'Agent',
  calendar: '캘린더',
  tasks: '작업',
  notes: '노트',
  clipboard: '클립보드',
  diff: 'Diff',
  remote: '리모트',
}

export function Sidebar({ onSessionSelect, onNewChat, onFileClick, activeFilePath, activeSessionId, changedFiles = [], onClearChangedFiles, onRemoveChangedFile, onOpenInSplit, messages = [], onScrollToMessage, switchTabRef, onInsertSnippet, onTabChange, wsKey, ccPort, onCCPortChange, onCCConnectedChange, forceTab }: SidebarProps) {
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
        <div style={{ display: 'flex' }}>
          {([
            { id: 'files', label: '📁', title: 'Files' },
            { id: 'search', label: '🔍', title: 'Search' },
            { id: 'sessions', label: '📖', title: 'History' },
            { id: 'changes', label: '✏️', title: changedFiles.length > 0 ? `Changes (${changedFiles.length})` : 'Changes' },
            { id: 'globalsearch', label: '🌐', title: 'Global Search' },
          ] as { id: Tab; label: string; title: string }[]).map((t) => (
            <button
              key={t.id}
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
        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
          {([
            { id: 'calendar', label: '📅', title: '캘린더' },
            { id: 'tasks', label: '✅', title: '작업' },
            { id: 'notes', label: '📝', title: '노트' },
            { id: 'clipboard', label: '📋', title: '클립보드' },
            { id: 'diff', label: '⊟', title: 'Diff' },
            { id: 'remote', label: '🔗', title: '리모트' },
          ] as { id: Tab; label: string; title: string }[]).map((t) => (
            <button
              key={t.id}
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
        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
          {([
            { id: 'bookmarks', label: '★', title: 'Bookmarks' },
            { id: 'stats', label: '📊', title: 'Stats' },
            { id: 'snippets', label: '✂', title: 'Snippets' },
            { id: 'outline', label: '§', title: 'Outline' },
            { id: 'plugins', label: '🧩', title: 'Plugins' },
            { id: 'connections', label: '🔌', title: 'Connections' },
            { id: 'agent', label: '🤖', title: 'Agent' },
          ] as { id: Tab; label: string; title: string }[]).map((t) => (
            <button
              key={t.id}
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
        {PANEL_TITLES[activeTab]}
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
        + New Chat
      </button>

      {/* Content */}
      <div key={activeTab} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
        {activeTab === 'files' && currentPath && (
          <>
            {/* File search */}
            <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <input
                value={fileSearch}
                onChange={e => setFileSearch(e.target.value)}
                placeholder="파일 검색..."
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
                  <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 11 }}>결과 없음</div>
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
        )}
        {activeTab === 'files' && !currentPath && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            No folder open
          </div>
        )}
        {activeTab === 'search' && currentPath && (
          <SearchPanel rootPath={currentPath} onFileClick={(path) => onFileClick(path)} />
        )}
        {activeTab === 'search' && !currentPath && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            No folder open
          </div>
        )}
        {activeTab === 'sessions' && (
          <SessionList onSelect={onSessionSelect} activeSessionId={activeSessionId} />
        )}
        {activeTab === 'changes' && (
          <ChangedFilesPanel
            files={changedFiles}
            onFileClick={onFileClick}
            onClear={onClearChangedFiles ?? (() => {})}
            onRemoveFile={onRemoveChangedFile}
            rootPath={currentPath ?? undefined}
          />
        )}
        {activeTab === 'bookmarks' && (
          <BookmarksPanel messages={messages} onScrollToMessage={onScrollToMessage} />
        )}
        {activeTab === 'stats' && features.stats && (
          <StatsPanel />
        )}
        {activeTab === 'stats' && !features.stats && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>통계 기능이 비활성화되었습니다.</div>
        )}
        {activeTab === 'snippets' && (
          <SnippetPanel onInsert={onInsertSnippet ?? (() => {})} />
        )}
        {activeTab === 'outline' && features.outline && (
          <OutlinePanel
            messages={messages}
            onScrollToMsg={onScrollToMessage ? (idx) => {
              const msg = messages[idx]
              if (msg) onScrollToMessage(msg.id)
            } : undefined}
          />
        )}
        {activeTab === 'outline' && !features.outline && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>아웃라인 기능이 비활성화되었습니다.</div>
        )}
        {activeTab === 'plugins' && features.plugins && (
          <PluginsPanel />
        )}
        {activeTab === 'plugins' && !features.plugins && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>플러그인 기능이 비활성화되었습니다.</div>
        )}
        {activeTab === 'connections' && features.connections && (
          <ConnectionPanel />
        )}
        {activeTab === 'connections' && !features.connections && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>MCP 연결 기능이 비활성화되었습니다.</div>
        )}
        {activeTab === 'agent' && (
          <AgentPanel />
        )}
        {activeTab === 'globalsearch' && (
          <GlobalSearchPanel
            onSelectSession={(sessionId) => {
              switchTab('sessions')
              onSessionSelect(sessionId)
            }}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarPanel />
        )}
        {activeTab === 'tasks' && (
          <TasksPanel />
        )}
        {activeTab === 'notes' && (
          <NotesPanel />
        )}
        {activeTab === 'clipboard' && (
          <ClipboardPanel />
        )}
        {activeTab === 'diff' && (
          <DiffPanel />
        )}
        {activeTab === 'remote' && (
          <RemotePanel />
        )}
      </div>
    </div>
  )
}
