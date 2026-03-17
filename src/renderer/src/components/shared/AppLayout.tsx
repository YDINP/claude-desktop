/**
 * AppLayout — App.tsx JSX 전체를 담는 레이아웃 컴포넌트 (Phase D.2)
 * AppContent는 훅/상태 선언만 담고, 렌더링은 여기서 담당.
 */
import type React from 'react'
import { AgentBay } from '../hq/AgentBay'
import { ResourceBar } from '../hq/ResourceBar'
import { OpsFeed } from '../hq/OpsFeed'
import { Sidebar } from '../sidebar/Sidebar'
import type { SidebarTab } from '../sidebar/Sidebar'
import type { ChangedFile } from '../sidebar/ChangedFilesPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { TerminalPanel } from '../terminal/TerminalPanel'
import { PermissionModal } from '../permission/PermissionModal'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'
import { FileViewer } from './FileViewer'
import { CommandPalette } from './CommandPalette'
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay'
import { SettingsPanel } from './SettingsPanel'
import { Lightbox } from './Lightbox'
import { WebPreviewPanel } from '../sidebar/WebPreviewPanel'
import { SceneViewPanel } from '../sidebar/SceneView/SceneViewPanel'
import { CocosPanel } from '../sidebar/CocosPanel'
import { ToastContainer } from './ToastContainer'
import { WorkspaceTabBar } from './WorkspaceTabBar'
import { FileTabBar } from './FileTabBar'
import type { WorkspaceManager } from '../../hooks/useWorkspaceManager'
import type { SettingsSync } from '../../hooks/useSettingsSync'
import type { ResizeHandlers } from '../../hooks/useResizeHandlers'
import type { ChatMessage } from '../../domains/chat/domain'

type CCLayoutMode = 'tab' | 'split' | 'detach'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AppLayoutProps {
  // Domain hooks (타입 안전 번들)
  workspace: WorkspaceManager
  settings: SettingsSync
  resize: ResizeHandlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any   // ReturnType<typeof useProject> — 순환 import 방지
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chat: any      // ReturnType<typeof useChatStore>

  // Session
  sessionTitle: string | undefined
  setSessionTitle: (t: string | undefined) => void
  sessionCreatedAt: number | undefined
  setSessionCreatedAt: (t: number | undefined) => void
  suggestions: string[]
  setSuggestions: React.Dispatch<React.SetStateAction<string[]>>

  // CC layout
  ccLayout: CCLayoutMode
  ccTab: 'claude' | 'editor'
  ccSplitRatio: number
  setCCTab: React.Dispatch<React.SetStateAction<'claude' | 'editor'>>
  setCCLayoutMode: (mode: CCLayoutMode) => void
  openCCEditorWindow: () => Promise<void>
  handleCCSplitDragStart: (e: React.MouseEvent) => void

  // Chat UI triggers
  chatFocusTrigger: number
  chatSearchTrigger: number
  scrollToMessageId: string | null
  setScrollToMessageId: React.Dispatch<React.SetStateAction<string | null>>

  // File panels
  splitFilePath: string | null
  setSplitFilePath: React.Dispatch<React.SetStateAction<string | null>>
  dirtyTabs: Set<string>
  setTabDirty: (path: string, dirty: boolean) => void
  changedFiles: ChangedFile[]
  setChangedFiles: React.Dispatch<React.SetStateAction<ChangedFile[]>>
  lightbox: { src: string; alt?: string } | null
  setLightbox: React.Dispatch<React.SetStateAction<{ src: string; alt?: string } | null>>

  // Overlays
  paletteOpen: boolean
  setPaletteOpen: (v: boolean | ((o: boolean) => boolean)) => void
  shortcutsOpen: boolean
  setShortcutsOpen: (v: boolean | ((o: boolean) => boolean)) => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean | ((o: boolean) => boolean)) => void
  pendingInsert: string | undefined
  setPendingInsert: React.Dispatch<React.SetStateAction<string | undefined>>

  // Sidebar
  activeSidebarIconTab: SidebarTab | null
  setActiveSidebarIconTab: React.Dispatch<React.SetStateAction<SidebarTab | null>>
  sidebarSwitchTabRef: React.MutableRefObject<((tab: SidebarTab) => void) | null>

  // Handlers
  handleToggleHQ: () => void
  openFile: (path: string) => void
  switchToChat: (clearChanges?: boolean) => void
  closeFileTab: (path: string) => void
  handleExportMarkdown: () => Promise<void>
  handleEditResend: (messageId: string, newText: string) => void
  handleFork: (messageIndex: number) => Promise<void>
  handleCompressContext: () => Promise<void>
  handleReplyToMessage: (text: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppLayout({
  workspace, settings, resize, project, chat,
  sessionTitle, setSessionTitle, sessionCreatedAt, setSessionCreatedAt,
  suggestions, setSuggestions,
  ccLayout, ccTab, ccSplitRatio, setCCTab, setCCLayoutMode, openCCEditorWindow, handleCCSplitDragStart,
  chatFocusTrigger, chatSearchTrigger, scrollToMessageId, setScrollToMessageId,
  splitFilePath, setSplitFilePath, dirtyTabs, setTabDirty, changedFiles, setChangedFiles,
  lightbox, setLightbox,
  paletteOpen, setPaletteOpen, shortcutsOpen, setShortcutsOpen, settingsOpen, setSettingsOpen,
  pendingInsert, setPendingInsert,
  activeSidebarIconTab, setActiveSidebarIconTab, sidebarSwitchTabRef,
  handleToggleHQ, openFile, switchToChat, closeFileTab,
  handleExportMarkdown, handleEditResend, handleFork, handleCompressContext, handleReplyToMessage,
}: AppLayoutProps) {
  // ── Destructure domain hooks for convenient local-name access ─────────────
  const {
    workspaces, activeWsId, workspaceNames, updateWorkspaceNames,
    openTabs, activeTab, setActiveTab, activeTabRef,
    wsCCPort, setWsCCPort, wsWebPreviewUrl, setWsWebPreviewUrl,
    wsCCConnected, setWsCCConnected,
    handleOpenFolder, switchWorkspace, closeWorkspace,
  } = workspace

  const {
    hqMode, activeAgents, focusMode, setFocusMode,
    theme, toggleTheme, soundEnabled, handleToggleSound,
    compactMode, handleToggleCompact, chatFontSize,
  } = settings

  const {
    terminalOpen, setTerminalOpen,
    bottomHeight, isDragging, handleSplitterMouseDown,
    sidebarCollapsed, setSidebarCollapsed,
    sidebarWidth, setSidebarWidth,
    isSidebarDragging, handleSidebarDragMouseDown,
    agentBayWidth, isAgentBayDragging, setIsAgentBayDragging,
    agentBayDragStartX, agentBayDragStartW,
  } = resize

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }} data-hq={hqMode ? 'true' : undefined}>
      <TitleBar onOpenFolder={handleOpenFolder} onOpenPalette={() => setPaletteOpen(true)} theme={theme} onToggleTheme={toggleTheme} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(c => !c)} onOpenSettings={() => setSettingsOpen(true)} hqMode={hqMode} onToggleHQ={handleToggleHQ} />

      {/* Icon bar — sidebar panel shortcuts + HQ */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0, height: 28, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {([
          { id: 'bookmarks' as SidebarTab, label: '★', title: '북마크' },
          { id: 'stats' as SidebarTab, label: '📊', title: '통계' },
          { id: 'snippets' as SidebarTab, label: '📎', title: '스니펫' },
          { id: 'tasks' as SidebarTab, label: '📋', title: '태스크' },
          { id: 'calendar' as SidebarTab, label: '📅', title: '캘린더' },
          { id: 'clipboard' as SidebarTab, label: '🗂️', title: '클립보드' },
          { id: 'diff' as SidebarTab, label: '🔀', title: '파일 비교' },
          { id: 'outline' as SidebarTab, label: '📑', title: '아웃라인' },
          { id: 'plugins' as SidebarTab, label: '🧩', title: '플러그인' },
          { id: 'connections' as SidebarTab, label: '🔌', title: 'MCP 연결' },
          { id: 'agent' as SidebarTab, label: '🤖', title: '에이전트' },
          { id: 'remote' as SidebarTab, label: '🖥️', title: '원격' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => {
              if (sidebarCollapsed) setSidebarCollapsed(false)
              sidebarSwitchTabRef.current?.(t.id)
              setActiveSidebarIconTab(t.id)
            }}
            title={t.title}
            style={{
              flexShrink: 0, width: 32, height: 28,
              background: activeSidebarIconTab === t.id ? 'var(--bg-primary)' : 'transparent',
              color: activeSidebarIconTab === t.id ? 'var(--text-primary)' : t.id === 'bookmarks' && chat.messages.some((m: any) => m.bookmarked) ? '#fbbf24' : 'var(--text-muted)',
              borderBottom: activeSidebarIconTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              fontSize: 14, cursor: 'pointer', transition: 'all 0.1s',
            }}
          >{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleToggleHQ}
          title={hqMode ? '기본 모드로 전환 (Ctrl+Shift+H)' : 'HQ Mode (Ctrl+Shift+H)'}
          style={{
            flexShrink: 0, padding: '0 10px', height: 28,
            background: hqMode ? 'rgba(0,152,255,0.15)' : 'transparent',
            color: hqMode ? '#0098ff' : 'var(--text-muted)',
            borderBottom: hqMode ? '2px solid #0098ff' : '2px solid transparent',
            fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px',
          }}
        >⬡ HQ</button>
      </div>

      {/* Workspace tabs */}
      {workspaces.length > 0 && (
        <WorkspaceTabBar
          workspaces={workspaces}
          activeId={activeWsId}
          workspaceNames={workspaceNames}
          onSelect={switchWorkspace}
          onClose={closeWorkspace}
          onAdd={handleOpenFolder}
          onRename={(id, name) => updateWorkspaceNames(prev => ({ ...prev, [id]: name }))}
        />
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: (sidebarCollapsed || focusMode) ? 0 : sidebarWidth,
          background: 'var(--bg-secondary)',
          flexShrink: 0, overflow: 'hidden', position: 'relative',
          transition: isSidebarDragging ? 'none' : 'width 0.15s ease',
        }}>
          <div style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {(
              <Sidebar
                activeSessionId={chat.sessionId}
                changedFiles={changedFiles}
                onClearChangedFiles={() => setChangedFiles([])}
                onRemoveChangedFile={(path) => setChangedFiles(prev => prev.filter(f => f.path !== path))}
                messages={chat.messages}
                onScrollToMessage={messageId => {
                  setScrollToMessageId(messageId)
                  switchToChat()
                  setTimeout(() => setScrollToMessageId(null), 500)
                }}
                onSessionSelect={async sid => {
                  const saved = await window.api.sessionLoad(sid) as { messages: ChatMessage[]; title?: string; createdAt?: number; forkedFrom?: string } | null
                  if (saved?.messages?.length) {
                    chat.hydrate(saved.messages as ChatMessage[], sid)
                  } else {
                    chat.clearMessages()
                    chat.setSessionId(sid)
                  }
                  setSessionTitle(saved?.title)
                  setSessionCreatedAt(saved?.createdAt)
                  if (saved?.forkedFrom) {
                    window.api.claudeClose()
                  } else {
                    window.api.claudeResume(sid)
                  }
                  switchToChat()
                }}
                onNewChat={() => {
                  chat.clearMessages()
                  setSessionTitle(undefined)
                  setSessionCreatedAt(undefined)
                  window.api.claudeClose()
                  switchToChat(true)
                }}
                onFileClick={openFile}
                activeFilePath={activeTab !== 'chat' ? activeTab : undefined}
                onOpenInSplit={(path) => setSplitFilePath(path)}
                switchTabRef={sidebarSwitchTabRef}
                onTabChange={(t) => {
                  const textTabs: SidebarTab[] = ['files', 'search', 'sessions', 'changes', 'git']
                  if (textTabs.includes(t)) setActiveSidebarIconTab(null)
                  else setActiveSidebarIconTab(t)
                }}
                onInsertSnippet={(content) => {
                  setPendingInsert(content)
                  if (sidebarCollapsed) setSidebarCollapsed(false)
                  switchToChat()
                }}
                wsKey={activeWsId}
                ccPort={wsCCPort}
                onCCPortChange={setWsCCPort}
                onCCConnectedChange={setWsCCConnected}
              />
            )}
          </div>
        </div>

        {/* Sidebar resize handle */}
        {!sidebarCollapsed && !focusMode && (
          <div
            onMouseDown={handleSidebarDragMouseDown}
            onDoubleClick={() => setSidebarWidth(220)}
            style={{
              width: 6, flexShrink: 0, cursor: 'col-resize',
              position: 'relative', zIndex: 20,
              background: isSidebarDragging ? 'rgba(82,139,255,0.3)' : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(82,139,255,0.3)' }}
            onMouseLeave={e => { if (!isSidebarDragging) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: 2, width: 1,
              background: isSidebarDragging ? 'var(--accent)' : 'var(--border)',
              pointerEvents: 'none',
            }} />
            {isSidebarDragging && (
              <div style={{
                position: 'absolute', top: 8, left: 8,
                background: 'var(--accent)', color: '#fff',
                fontSize: 10, padding: '2px 5px', borderRadius: 3,
                whiteSpace: 'nowrap', pointerEvents: 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}>
                {sidebarWidth}px
              </div>
            )}
          </div>
        )}

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* File tab bar */}
          <FileTabBar
            tabs={openTabs}
            active={activeTab}
            onSelect={t => { activeTabRef.current = t; setActiveTab(t) }}
            onClose={closeFileTab}
            dirtyTabs={dirtyTabs}
          />

          {/* CC Layout header — chat 탭일 때만 표시 */}
          {activeTab === 'chat' && (
            <div style={{
              display: 'flex', alignItems: 'center',
              borderBottom: '1px solid var(--border)', flexShrink: 0,
              background: 'var(--bg-secondary)', height: 30,
            }}>
              {ccLayout === 'tab' && (
                <>
                  <button
                    onClick={() => setCCTab('claude')}
                    style={{
                      padding: '0 14px', height: 30, fontSize: 12, cursor: 'pointer',
                      background: ccTab === 'claude' ? 'var(--bg-primary)' : 'transparent',
                      color: ccTab === 'claude' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: 'none', borderRight: '1px solid var(--border)',
                      borderBottom: ccTab === 'claude' ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >Claude</button>
                  <button
                    onClick={() => setCCTab('editor')}
                    style={{
                      padding: '0 14px', height: 30, fontSize: 12, cursor: 'pointer',
                      background: ccTab === 'editor' ? 'var(--bg-primary)' : 'transparent',
                      color: ccTab === 'editor' ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderBottom: ccTab === 'editor' ? '2px solid var(--accent)' : '2px solid transparent',
                      border: 'none',
                    }}
                  >CC Editor</button>
                </>
              )}
              {ccLayout === 'split' && (
                <span style={{ padding: '0 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                  Claude + CC Editor
                </span>
              )}
              {ccLayout === 'detach' && (
                <span style={{ padding: '0 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                  CC Editor (detached)
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, paddingRight: 8 }}>
                <button
                  title="Tab mode"
                  onClick={() => setCCLayoutMode('tab')}
                  style={{
                    width: 26, height: 22, fontSize: 13, cursor: 'pointer',
                    background: ccLayout === 'tab' ? 'var(--accent)' : 'transparent',
                    color: ccLayout === 'tab' ? '#fff' : 'var(--text-muted)',
                    border: '1px solid ' + (ccLayout === 'tab' ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{'\u25A1'}</button>
                <button
                  title="Split mode"
                  onClick={() => setCCLayoutMode('split')}
                  style={{
                    width: 26, height: 22, fontSize: 13, cursor: 'pointer',
                    background: ccLayout === 'split' ? 'var(--accent)' : 'transparent',
                    color: ccLayout === 'split' ? '#fff' : 'var(--text-muted)',
                    border: '1px solid ' + (ccLayout === 'split' ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{'\u229E'}</button>
                <button
                  title="Detach window"
                  onClick={openCCEditorWindow}
                  style={{
                    width: 26, height: 22, fontSize: 13, cursor: 'pointer',
                    background: ccLayout === 'detach' ? 'var(--accent)' : 'transparent',
                    color: ccLayout === 'detach' ? '#fff' : 'var(--text-muted)',
                    border: '1px solid ' + (ccLayout === 'detach' ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{'\u238B'}</button>
              </div>
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {/* Chat tab content — CC layout mode applies here */}
            <div style={{ position: 'absolute', inset: 0, display: activeTab === 'chat' ? 'flex' : 'none', flexDirection: ccLayout === 'split' ? 'row' : 'column' }}>
              {/* Claude panel — always visible in split, conditional in tab */}
              <div style={{
                flex: ccLayout === 'split' ? `0 0 ${ccSplitRatio * 100}%` : 1,
                overflow: 'hidden',
                display: (ccLayout === 'tab' && ccTab === 'editor') ? 'none' : 'flex',
                flexDirection: 'column',
                minWidth: ccLayout === 'split' ? 300 : undefined,
              }}>
                {hqMode ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#080810' }}>
                    <ResourceBar
                      contextUsage={Math.min(chat.sessionInputTokens / 200000, 1)}
                      sessionTokens={chat.sessionOutputTokens + chat.sessionInputTokens}
                      totalCost={project.totalCost}
                      isStreaming={chat.isStreaming}
                      model={project.selectedModel ?? ''}
                      onToggleHQ={handleToggleHQ}
                      hqMode={hqMode}
                      cwd={project.currentPath}
                    />
                    {/* HQ: AgentBay(left) + ChatPanel(right) */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                      <AgentBay
                        sessions={[]}
                        agents={activeAgents}
                        activeSessionId={chat.sessionId ?? null}
                        isStreaming={chat.isStreaming}
                        toolUses={chat.messages.flatMap((m: any) => m.toolUses ?? []).slice(-5)}
                        width={agentBayWidth}
                        onSelectSession={async (sid: string) => {
                          const saved = await window.api.sessionLoad(sid) as { messages: ChatMessage[]; title?: string; createdAt?: number; forkedFrom?: string } | null
                          if (saved?.messages?.length) {
                            chat.hydrate(saved.messages as ChatMessage[], sid)
                          } else {
                            chat.clearMessages()
                            chat.setSessionId(sid)
                          }
                          setSessionTitle(saved?.title)
                          setSessionCreatedAt(saved?.createdAt)
                          if (saved?.forkedFrom) {
                            window.api.claudeClose()
                          } else {
                            window.api.claudeResume(sid)
                          }
                        }}
                        onNewSession={() => {
                          chat.clearMessages()
                          setSessionTitle(undefined)
                          setSessionCreatedAt(undefined)
                          window.api.claudeClose()
                        }}
                        onToggleHQ={handleToggleHQ}
                      />
                      <div
                        onMouseDown={(e) => { setIsAgentBayDragging(true); agentBayDragStartX.current = e.clientX; agentBayDragStartW.current = agentBayWidth }}
                        style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: isAgentBayDragging ? 'rgba(82,139,255,0.5)' : 'transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(82,139,255,0.5)' }}
                        onMouseLeave={e => { if (!isAgentBayDragging) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      />
                      <div style={{ flex: 1, overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>
                        <ChatPanel project={project} focusTrigger={chatFocusTrigger} searchTrigger={chatSearchTrigger} scrollToMessageId={scrollToMessageId} onFork={handleFork} onEditResend={handleEditResend} onOpenFile={openFile} onImageClick={(src, alt) => setLightbox({ src, alt })} onCompressContext={handleCompressContext} pendingInsert={pendingInsert} onPendingInsertConsumed={() => setPendingInsert(undefined)} onReplyToMessage={handleReplyToMessage} suggestions={suggestions} onDismissSuggestions={() => setSuggestions([])} hqMode={hqMode} onToggleHQ={handleToggleHQ} onOpenPromptChain={() => { if (sidebarCollapsed) setSidebarCollapsed(false); sidebarSwitchTabRef.current?.('agent'); setTimeout(() => window.dispatchEvent(new CustomEvent('open-prompt-chain')), 100) }} />
                      </div>
                    </div>
                    <OpsFeed
                      toolUses={chat.messages.flatMap((m: any) => m.toolUses ?? []).slice(-10)}
                      isStreaming={chat.isStreaming}
                      onToolClick={(toolId) => console.log('tool clicked:', toolId)}
                    />
                  </div>
                ) : (
                  <ChatPanel project={project} focusTrigger={chatFocusTrigger} searchTrigger={chatSearchTrigger} scrollToMessageId={scrollToMessageId} onFork={handleFork} onEditResend={handleEditResend} onOpenFile={openFile} onImageClick={(src, alt) => setLightbox({ src, alt })} onCompressContext={handleCompressContext} pendingInsert={pendingInsert} onPendingInsertConsumed={() => setPendingInsert(undefined)} onReplyToMessage={handleReplyToMessage} suggestions={suggestions} onDismissSuggestions={() => setSuggestions([])} hqMode={hqMode} onToggleHQ={handleToggleHQ} onOpenPromptChain={() => { if (sidebarCollapsed) setSidebarCollapsed(false); sidebarSwitchTabRef.current?.('agent'); setTimeout(() => window.dispatchEvent(new CustomEvent('open-prompt-chain')), 100) }} />
                )}
              </div>

              {/* Split drag handle */}
              {ccLayout === 'split' && (
                <div
                  onMouseDown={handleCCSplitDragStart}
                  style={{
                    width: 4, flexShrink: 0, cursor: 'col-resize',
                    background: 'var(--border)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(82,139,255,0.5)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)' }}
                />
              )}

              {/* CC Editor panel — split or tab:editor */}
              {ccLayout !== 'detach' && (
                <div style={{
                  flex: ccLayout === 'split' ? `0 0 ${(1 - ccSplitRatio) * 100}%` : 1,
                  overflow: 'hidden',
                  display: (ccLayout === 'tab' && ccTab === 'claude') ? 'none' : 'flex',
                  flexDirection: 'column',
                  minWidth: ccLayout === 'split' ? 300 : undefined,
                }}>
                  <CocosPanel />
                </div>
              )}
            </div>

            {/* Scene view tab */}
            <div style={{ position: 'absolute', inset: 0, display: activeTab === 'scene' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
              <SceneViewPanel key={activeWsId} connected={wsCCConnected} wsKey={activeWsId} port={wsCCPort} />
            </div>
            {/* Web preview tab */}
            <div style={{ position: 'absolute', inset: 0, display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
              <WebPreviewPanel key={activeWsId} defaultUrl={wsWebPreviewUrl} onUrlChange={setWsWebPreviewUrl} />
            </div>
            {openTabs.filter(t => t !== 'chat' && t !== 'scene' && t !== 'preview').map(path => (
              <div key={path} style={{ position: 'absolute', inset: 0, display: activeTab === path ? 'flex' : 'none', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, position: 'relative' }}>
                  <FileViewer
                    path={path}
                    cwd={project.currentPath ?? undefined}
                    onSplitView={splitFilePath ? undefined : (p) => setSplitFilePath(p)}
                    onAskAI={(prompt) => { setActiveTab('chat'); setPendingInsert(prompt) }}
                    onDirtyChange={(dirty) => setTabDirty(path, dirty)}
                  />
                </div>
                {splitFilePath && activeTab === path && (
                  <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, position: 'relative', borderLeft: '1px solid var(--border)' }}>
                    <FileViewer
                      path={splitFilePath}
                      cwd={project.currentPath ?? undefined}
                      onClose={() => setSplitFilePath(null)}
                      onAskAI={(prompt) => { setActiveTab('chat'); setPendingInsert(prompt) }}
                      onDirtyChange={(dirty) => setTabDirty(splitFilePath, dirty)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Terminal toggle */}
          {!focusMode && (
          <div
            onClick={() => setTerminalOpen(o => !o)}
            style={{
              height: 24, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 6,
              fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, userSelect: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)' }}
          >
            <span>{terminalOpen ? '▾' : '▸'}</span>
            <span>Terminal</span>
          </div>
          )}

          {terminalOpen && !focusMode && (
            <>
              <div
                onMouseDown={handleSplitterMouseDown}
                style={{ height: 4, background: 'var(--border)', cursor: 'row-resize', flexShrink: 0 }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--accent)' }}
                onMouseLeave={e => { if (!isDragging) (e.target as HTMLElement).style.background = 'var(--border)' }}
              />
              <div style={{ height: bottomHeight, flexShrink: 0 }}>
                <TerminalPanel
                  cwd={project.currentPath || 'C:\\'}
                  onAskAI={(text) => {
                    setPendingInsert(text)
                    switchToChat()
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <StatusBar
        model={project.selectedModel}
        totalCost={project.totalCost}
        totalInputTokens={project.totalInputTokens}
        totalOutputTokens={project.totalOutputTokens}
        inputTokens={chat.sessionInputTokens}
        outputTokens={chat.sessionOutputTokens}
        cwd={project.currentPath}
        onShowShortcuts={() => setShortcutsOpen(true)}
        contextUsage={Math.min(chat.sessionInputTokens / 200000, 1)}
        messageCount={chat.messages.length}
        chatFontSize={chatFontSize}
        sessionId={chat.sessionId ?? undefined}
        sessionTitle={sessionTitle}
        sessionCreatedAt={sessionCreatedAt}
      />

      {chat.pendingPermission && (
        <PermissionModal
          request={chat.pendingPermission}
          onReply={allow => {
            window.api.claudePermissionReply(chat.pendingPermission!.requestId, allow)
            chat.setPendingPermission(null)
          }}
          onAllowSession={() => {
            window.api.claudePermissionReply(chat.pendingPermission!.requestId, true, true)
            chat.setPendingPermission(null)
          }}
        />
      )}

      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} currentProject={project.currentPath ?? undefined} />

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          openTabs={openTabs.filter(t => t !== 'chat' && t !== 'preview' && t !== 'scene')}
          onSelectSession={async sid => {
            const saved = await window.api.sessionLoad(sid) as { messages: ChatMessage[] } | null
            if (saved?.messages?.length) {
              chat.hydrate(saved.messages as ChatMessage[], sid)
            } else {
              chat.clearMessages()
              chat.setSessionId(sid)
            }
            window.api.claudeResume(sid)
            switchToChat()
          }}
          onSelectTab={path => {
            activeTabRef.current = path
            setActiveTab(path)
          }}
          currentWorkspacePath={workspaces.find(w => w.id === activeWsId)?.path}
          onSelectFile={openFile}
          onNewChat={() => { chat.clearMessages(); window.api?.claudeClose(); switchToChat(true) }}
          onOpenFolder={handleOpenFolder}
          onToggleTerminal={() => setTerminalOpen(o => !o)}
          onOpenSettings={() => setSettingsOpen(true)}
          onExportMarkdown={handleExportMarkdown}
          onSidebarTab={tab => {
            if (sidebarCollapsed) setSidebarCollapsed(false)
            sidebarSwitchTabRef.current?.(tab)
          }}
          onToggleSound={handleToggleSound}
          onToggleCompact={handleToggleCompact}
          soundEnabled={soundEnabled}
          compactMode={compactMode}
        />
      )}

      {focusMode && (
        <div
          onClick={() => setFocusMode(false)}
          style={{
            position: 'fixed', top: 8, right: 8, zIndex: 9998,
            background: 'var(--accent)', color: '#fff',
            borderRadius: 12, padding: '3px 10px', fontSize: 12,
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          🎯 포커스 모드 (Ctrl+Shift+F)
        </div>
      )}

      <ToastContainer />

      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
