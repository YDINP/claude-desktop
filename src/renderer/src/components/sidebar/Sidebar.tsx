import { useEffect, useState } from 'react'
import type React from 'react'
import { FileTree } from './FileTree'
import { SessionList } from './SessionList'
import { ChangedFilesPanel } from './ChangedFilesPanel'
import { SearchPanel } from './SearchPanel'
import { GitPanel } from './GitPanel'
import { BookmarksPanel } from './BookmarksPanel'
import { StatsPanel } from './StatsPanel'
import { SnippetPanel } from './SnippetPanel'
import { TasksPanel } from './TasksPanel'
import { CalendarPanel } from './CalendarPanel'
import { ClipboardPanel } from './ClipboardPanel'
import { NotesPanel } from './NotesPanel'
import { DiffPanel } from './DiffPanel'
import { OutlinePanel } from './OutlinePanel'
import { PluginsPanel } from './PluginsPanel'
import { ConnectionPanel } from './ConnectionPanel'
import { AgentPanel } from './AgentPanel'
import { RemotePanel } from './RemotePanel'
import { CocosPanel } from './CocosPanel'
import { GlobalSearchPanel } from './GlobalSearchPanel'
import type { ChangedFile } from './ChangedFilesPanel'
import type { ChatMessage } from '../../stores/chat-store'
import { useProject } from '../../stores/project-store'

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
}

export type { Tab as SidebarTab }

type Tab = 'files' | 'sessions' | 'changes' | 'search' | 'git' | 'bookmarks' | 'stats' | 'snippets' | 'tasks' | 'calendar' | 'clipboard' | 'diff' | 'outline' | 'plugins' | 'connections' | 'agent' | 'remote' | 'cocos' | 'globalsearch' | 'notes'

export function Sidebar({ onSessionSelect, onNewChat, onFileClick, activeFilePath, activeSessionId, changedFiles = [], onClearChangedFiles, onRemoveChangedFile, onOpenInSplit, messages = [], onScrollToMessage, switchTabRef, onInsertSnippet, onTabChange, wsKey, ccPort, onCCPortChange, onCCConnectedChange }: SidebarProps) {
  const [tab, setTab] = useState<Tab>('files')
  const switchTab = (t: Tab) => { setTab(t); onTabChange?.(t) }

  useEffect(() => {
    if (switchTabRef) switchTabRef.current = switchTab
    return () => { if (switchTabRef) switchTabRef.current = null }
  }, [switchTabRef])
  const { currentPath } = useProject()
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
        {/* Row 1: text tabs — 균등 분배 */}
        <div style={{ display: 'flex' }}>
          {([
            { id: 'files', label: 'Files' },
            { id: 'search', label: 'Search' },
            { id: 'sessions', label: 'History' },
            { id: 'changes', label: changedFiles.length > 0 ? `Changes (${changedFiles.length})` : 'Changes' },
            { id: 'git', label: '⎇ Git' },
          { id: 'globalsearch', label: '🔍 전체' },
          { id: 'notes', label: '📝 노트' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              title={t.id}
              style={{
                flex: 1,
                padding: '5px 2px',
                background: tab === t.id ? 'var(--bg-primary)' : 'transparent',
                color: tab === t.id ? 'var(--text-primary)' : t.id === 'changes' && changedFiles.length > 0 ? 'var(--warning)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                transition: 'all 0.1s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
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
      <div key={tab} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
        {tab === 'files' && currentPath && (
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
        {tab === 'files' && !currentPath && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            No folder open
          </div>
        )}
        {tab === 'search' && currentPath && (
          <SearchPanel rootPath={currentPath} onFileClick={(path) => onFileClick(path)} />
        )}
        {tab === 'search' && !currentPath && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            No folder open
          </div>
        )}
        {tab === 'sessions' && (
          <SessionList onSelect={onSessionSelect} activeSessionId={activeSessionId} />
        )}
        {tab === 'changes' && (
          <ChangedFilesPanel
            files={changedFiles}
            onFileClick={onFileClick}
            onClear={onClearChangedFiles ?? (() => {})}
            onRemoveFile={onRemoveChangedFile}
            rootPath={currentPath ?? undefined}
          />
        )}
        {tab === 'git' && currentPath && (
          <GitPanel rootPath={currentPath} />
        )}
        {tab === 'git' && !currentPath && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            No folder open
          </div>
        )}
        {tab === 'bookmarks' && (
          <BookmarksPanel messages={messages} onScrollToMessage={onScrollToMessage} />
        )}
        {tab === 'stats' && (
          <StatsPanel />
        )}
        {tab === 'snippets' && (
          <SnippetPanel onInsert={onInsertSnippet ?? (() => {})} />
        )}
        {tab === 'tasks' && (
          <TasksPanel />
        )}
        {tab === 'calendar' && (
          <CalendarPanel onSelectSession={onSessionSelect} />
        )}
        {tab === 'clipboard' && (
          <ClipboardPanel />
        )}
        {tab === 'diff' && (
          <DiffPanel />
        )}
        {tab === 'outline' && (
          <OutlinePanel
            messages={messages}
            onScrollToMsg={onScrollToMessage ? (idx) => {
              const msg = messages[idx]
              if (msg) onScrollToMessage(msg.id)
            } : undefined}
          />
        )}
        {tab === 'plugins' && (
          <PluginsPanel />
        )}
        {tab === 'connections' && (
          <ConnectionPanel />
        )}
        {tab === 'agent' && (
          <AgentPanel />
        )}
        {tab === 'remote' && (
          <RemotePanel />
        )}
        {tab === 'cocos' && (
          <CocosPanel />
        )}
        {tab === 'notes' && (
          <NotesPanel />
        )}
        {tab === 'globalsearch' && (
          <GlobalSearchPanel
            onSelectSession={(sessionId) => {
              switchTab('sessions')
              onSessionSelect(sessionId)
            }}
          />
        )}
      </div>
    </div>
  )
}
