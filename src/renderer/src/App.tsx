import { useCallback, useEffect, useRef, useState } from 'react'

import { AgentBay } from './components/hq/AgentBay'
import { ResourceBar } from './components/hq/ResourceBar'
import { OpsFeed } from './components/hq/OpsFeed'
import './styles/hq.css'
import { ProjectProvider, useProject } from './stores/project-store'
import { useChatStore } from './domains/chat/store'
import type { ChatMessage } from './domains/chat/domain'
import { initChatAdapter } from './domains/chat/adapter'
import { registerChatCommands } from './domains/chat/commands'
import { Sidebar } from './components/sidebar/Sidebar'
import type { SidebarTab } from './components/sidebar/Sidebar'
import type { ChangedFile } from './components/sidebar/ChangedFilesPanel'
import { ChatPanel } from './components/chat/ChatPanel'
import { TerminalPanel } from './components/terminal/TerminalPanel'
import { PermissionModal } from './components/permission/PermissionModal'
import { StatusBar } from './components/shared/StatusBar'
import { TitleBar } from './components/shared/TitleBar'
import { FileViewer } from './components/shared/FileViewer'
import { CommandPalette } from './components/shared/CommandPalette'
import { KeyboardShortcutsOverlay } from './components/shared/KeyboardShortcutsOverlay'
import { SettingsPanel } from './components/shared/SettingsPanel'
import { Lightbox } from './components/shared/Lightbox'
import { WebPreviewPanel } from './components/sidebar/WebPreviewPanel'
import { SceneViewPanel } from './components/sidebar/SceneView/SceneViewPanel'
import { CocosPanel } from './components/sidebar/CocosPanel'
import { playCompletionSound } from './utils/sound'
import { recordCost } from './utils/cost-tracker'
import { aguiDispatch } from './utils/agui-store'
import { ToastContainer } from './components/shared/ToastContainer'
import { toast } from './utils/toast'

// Extracted hooks & components
import { useWorkspaceManager } from './hooks/useWorkspaceManager'
import { useSessionManager } from './hooks/useSessionManager'
import { useSettingsSync } from './hooks/useSettingsSync'
import { useResizeHandlers } from './hooks/useResizeHandlers'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { WelcomeScreen } from './components/shared/WelcomeScreen'
import { WorkspaceTabBar } from './components/shared/WorkspaceTabBar'
import { FileTabBar } from './components/shared/FileTabBar'

// ── Types ────────────────────────────────────────────────────────────────────

type CCLayoutMode = 'tab' | 'split' | 'detach'

// ── CC Editor Detached Window ─────────────────────────────────────────────

function CCEditorWindow() {
  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <CocosPanel />
    </div>
  )
}

// ── AppContent ───────────────────────────────────────────────────────────────

function AppContent() {
  const project = useProject()
  const chat = useChatStore()

  // ── Domain hooks ──
  const workspace = useWorkspaceManager({
    chatHydrate: chat.hydrate,
    chatClearMessages: chat.clearMessages,
    chatSetSessionId: chat.setSessionId,
    chatMessages: chat.messages,
    chatSessionId: chat.sessionId,
    projectSetProject: project.setProject,
    projectCurrentPath: project.currentPath,
  })
  const {
    workspaces, activeWsId, workspaceNames, updateWorkspaceNames,
    openTabs, setOpenTabs, activeTab, setActiveTab, activeTabRef,
    wsCCPort, setWsCCPort, wsWebPreviewUrl, setWsWebPreviewUrl,
    wsCCConnected, setWsCCConnected,
    handleOpenFolder, switchWorkspace, closeWorkspace, createOrSwitchWorkspace,
  } = workspace

  const session = useSessionManager({
    messages: chat.messages,
    isStreaming: chat.isStreaming,
    sessionId: chat.sessionId,
    currentPath: project.currentPath,
    selectedModel: project.selectedModel,
  })
  const { sessionTitle, setSessionTitle, sessionCreatedAt, setSessionCreatedAt, suggestions, setSuggestions } = session

  const settings = useSettingsSync()
  const {
    hqMode, handleToggleHQ: _toggleHQ,
    activeAgents, setActiveAgents,
    focusMode, setFocusMode,
    theme, toggleTheme,
    soundEnabled, soundEnabledRef, handleToggleSound,
    compactMode, handleToggleCompact,
    chatFontSize,
  } = settings

  const resize = useResizeHandlers()
  const {
    terminalOpen, setTerminalOpen,
    bottomHeight, isDragging, handleSplitterMouseDown,
    sidebarCollapsed, setSidebarCollapsed,
    sidebarWidth, setSidebarWidth,
    isSidebarDragging, handleSidebarDragMouseDown,
    agentBayWidth, setAgentBayWidth,
    isAgentBayDragging, setIsAgentBayDragging,
    agentBayDragStartX, agentBayDragStartW,
  } = resize

  // handleToggleHQ wrapper (needs setActiveTab from workspace)
  const handleToggleHQ = useCallback(() => _toggleHQ(() => setActiveTab('chat')), [_toggleHQ, setActiveTab])

  // ── CC Layout mode (stays in AppContent) ──
  const [ccLayout, setCCLayout] = useState<CCLayoutMode>(() =>
    (localStorage.getItem('cc-layout-mode') as CCLayoutMode) ?? 'tab'
  )
  const [ccTab, setCCTab] = useState<'claude' | 'editor'>('claude')
  const [ccSplitRatio, setCCSplitRatio] = useState(0.5)
  const ccSplitRatioRef = useRef(0.5)

  // ── Chat UI triggers ──
  const [chatFocusTrigger, setChatFocusTrigger] = useState(0)
  const [chatSearchTrigger, setChatSearchTrigger] = useState(0)
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null)
  const [splitFilePath, setSplitFilePath] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; alt?: string } | null>(null)

  // ── File dirty tracking ──
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set())
  const setTabDirty = useCallback((path: string, dirty: boolean) => {
    setDirtyTabs(prev => {
      const s = new Set(prev)
      if (dirty) s.add(path)
      else s.delete(path)
      return s
    })
  }, [])

  // ── Changed files tracking ──
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([])
  const trackChangedFile = (toolName: string, toolInput: unknown) => {
    const input = toolInput as { file_path?: string }
    if (!input?.file_path) return
    const op: ChangedFile['op'] = toolName === 'Write' ? 'write' : 'edit'
    setChangedFiles(prev => {
      const path = input.file_path!
      const idx = prev.findIndex(f => f.path === path)
      const entry: ChangedFile = { path, op, ts: Date.now() }
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = entry
        return updated
      }
      return [...prev, entry]
    })
  }

  // ── UI overlays ──
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingInsert, setPendingInsert] = useState<string | undefined>(undefined)
  const handleReplyToMessage = useCallback((text: string) => {
    const quoted = text.split('\n').map(line => `> ${line}`).join('\n')
    setPendingInsert(quoted + '\n\n')
  }, [])

  // ── Sidebar ──
  const sidebarSwitchTabRef = useRef<((tab: SidebarTab) => void) | null>(null)
  const [activeSidebarIconTab, setActiveSidebarIconTab] = useState<SidebarTab | null>(null)

  // ── Project ref (stable reference for event handlers) ──
  const projectRef = useRef(project)
  projectRef.current = project

  // ── File tab helpers ──
  const openFile = (path: string) => {
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/')
    setOpenTabs(prev => {
      if (prev.some(t => t.toLowerCase().replace(/\\/g, '/') === normalizedPath)) return prev
      return [...prev, path]
    })
    activeTabRef.current = path
    setActiveTab(path)
  }

  const switchToChat = (clearChanges = false) => {
    activeTabRef.current = 'chat'
    setActiveTab('chat')
    setChatFocusTrigger(n => n + 1)
    if (clearChanges) setChangedFiles([])
  }

  const closeFileTab = (path: string) => {
    setSplitFilePath(prev => prev === path ? null : prev)
    setOpenTabs(prev => {
      const next = prev.filter(t => t !== path)
      if (activeTabRef.current === path) {
        const fallback = next[next.length - 1] ?? 'chat'
        activeTabRef.current = fallback
        setActiveTab(fallback)
      }
      return next
    })
  }

  const closeActiveFileTab = useCallback(() => {
    const cur = activeTabRef.current
    // [M-6] scene/preview 탭은 CC 연결 의존 탭 → Ctrl+W로 닫기 불가
    if (cur !== 'chat' && cur !== 'scene' && cur !== 'preview') closeFileTab(cur)
  }, [])

  // ── CC layout helpers ──
  const handleCCSplitDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const container = e.currentTarget.parentElement!
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    const onMove = (me: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const ratio = Math.min(0.8, Math.max(0.2, (me.clientX - rect.left) / rect.width))
      ccSplitRatioRef.current = ratio
      setCCSplitRatio(ratio)
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const openCCEditorWindow = async () => {
    await window.api.openCCEditorWindow?.()
    setCCLayout('detach')
    localStorage.setItem('cc-layout-mode', 'detach')
  }

  const setCCLayoutMode = (mode: CCLayoutMode) => {
    setCCLayout(mode)
    localStorage.setItem('cc-layout-mode', mode)
  }

  // ── Export current session as markdown ──
  const handleExportMarkdown = async () => {
    if (!chat.sessionId) return
    const result = await window.api?.sessionExportMarkdown(chat.sessionId)
    if (result?.success) toast('내보내기 완료', 'success')
    else if (result?.error) toast('내보내기 실패: ' + result.error, 'error')
  }

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts({
    setPaletteOpen,
    paletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    setSettingsOpen,
    setSidebarCollapsed,
    setTerminalOpen,
    setFocusMode,
    handleToggleHQ,
    chatClearMessages: chat.clearMessages,
    switchToChat,
    setChatSearchTrigger,
    openTabs,
    activeTabRef,
    setActiveTab,
    switchWorkspace,
    closeWorkspace,
    workspaces,
    activeWsId,
    setProjectModel: project.setModel,
  })

  // ── cc:open-file event ──
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<string>).detail
      if (path) openFile(path)
    }
    window.addEventListener('cc:open-file', handler)
    return () => window.removeEventListener('cc:open-file', handler)
  }, [])

  // ── Chat adapter ──
  useEffect(() => {
    registerChatCommands()
    return initChatAdapter({
      onToolWrite: (toolName, toolInput) => trackChangedFile(toolName, toolInput),
      onTaskStart: (toolId, description) => {
        setActiveAgents(prev => [...prev, { id: toolId, description, status: 'running', startTime: Date.now() }])
      },
      onTaskEnd: (toolId, output, isError) => {
        setActiveAgents(prev => prev.map(a =>
          a.id === toolId
            ? { ...a, status: isError ? 'error' : 'completed', output: output?.slice(0, 200) }
            : a
        ))
      },
      onResult: (cost, inputTokens, outputTokens) => {
        setTimeout(() => setActiveAgents([]), 5000)
        projectRef.current.addCost(cost, inputTokens, outputTokens)
        recordCost(cost, inputTokens, outputTokens)
        if (soundEnabledRef.current) playCompletionSound()
      },
      onAguiEvent: (ev) => aguiDispatch(ev),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Ctrl+W: close active file tab ──
  useEffect(() => {
    if (!window.api) return
    return window.api.onCloseTab(closeActiveFileTab)
  }, [closeActiveFileTab])

  // ── Edit & resend ──
  const handleEditResend = useCallback((messageId: string, newText: string) => {
    if (chat.isStreaming || !project.currentPath) return

    // 1. Edit the message text in the store
    chat.editMessage(messageId, newText)

    // 2. Remove all messages after this one
    chat.truncateAfter(messageId)

    // 3. Resend — trigger Claude with the new text
    window.api.claudeSend({
      text: newText,
      cwd: project.currentPath,
      model: project.selectedModel,
    })
    chat.ensureAssistantMessage()
  }, [chat.isStreaming, chat.editMessage, chat.truncateAfter, chat.ensureAssistantMessage, project.currentPath, project.selectedModel])

  // ── Session fork ──
  const handleFork = useCallback(async (messageIndex: number) => {
    const sessionId = chat.sessionId
    if (!sessionId) return
    const result = await window.api.sessionFork(sessionId, messageIndex)
    if (result.error) {
      console.error('Fork failed:', result.error)
      return
    }
    if (result.newSessionId) {
      const newId = result.newSessionId
      const saved = await window.api.sessionLoad(newId) as { messages: ChatMessage[] } | null
      if (saved?.messages?.length) {
        chat.hydrate(saved.messages as ChatMessage[], newId)
      } else {
        chat.clearMessages()
        chat.setSessionId(newId)
      }
      // 포크된 세션은 SDK가 UUID를 모르므로 resume 대신 새 세션으로 시작
      window.api.claudeClose()
      switchToChat()
    }
  }, [chat.sessionId, chat.hydrate, chat.clearMessages, chat.setSessionId])

  // ── Auto-resume last session on startup ──
  const autoResumedRef = useRef(false)
  useEffect(() => {
    if (autoResumedRef.current || workspaces.length === 0 || !activeWsId) return
    if (chat.messages.length > 0 || chat.sessionId) return
    autoResumedRef.current = true
    const activeWs = workspaces.find(w => w.id === activeWsId)
    if (!activeWs?.path) return
    window.api?.sessionList().then(async (list: unknown) => {
      const sessions = (list as Array<{ id: string; updatedAt: number; cwd: string; forkedFrom?: string }>)
        .filter(s => !s.forkedFrom && s.cwd === activeWs.path)
        .sort((a, b) => b.updatedAt - a.updatedAt)
      const recent = sessions[0]
      if (!recent) return
      const saved = await window.api.sessionLoad(recent.id) as { messages: ChatMessage[]; title?: string; createdAt?: number } | null
      if (!saved?.messages?.length) return
      chat.hydrate(saved.messages as ChatMessage[], recent.id)
      setSessionTitle(saved.title)
      setSessionCreatedAt(saved.createdAt)
      window.api.claudeResume(recent.id)
    }).catch(() => {})
  }, [workspaces, activeWsId])

  // ── Context compression ──
  const handleCompressContext = useCallback(async () => {
    if (chat.messages.length < 30) return
    const payload = chat.messages.map(m => ({ role: m.role, text: m.text }))
    const result = await window.api.compressContext(payload)
    if (result.error || !result.summary) return
    chat.compressMessages(result.summary, result.compressedCount)
  }, [chat.messages, chat.compressMessages])

  // ── Welcome screen ──
  if (workspaces.length === 0) {
    return (
      <WelcomeScreen
        onOpenFolder={handleOpenFolder}
        onOpenPath={p => createOrSwitchWorkspace(p)}
        onOpenSession={async (sessionId, path) => {
          await createOrSwitchWorkspace(path, true)
          // Small delay to let workspace initialize, then resume session
          setTimeout(async () => {
            const saved = await window.api.sessionLoad(sessionId) as { messages: ChatMessage[] } | null
            if (saved?.messages?.length) {
              chat.hydrate(saved.messages as ChatMessage[], sessionId)
            } else {
              chat.setSessionId(sessionId)
            }
            window.api.claudeResume(sessionId)
          }, 100)
        }}
      />
    )
  }

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
                  // Switch to chat tab and reset the id after a tick so re-triggering works
                  switchToChat()
                  setTimeout(() => setScrollToMessageId(null), 500)
                }}
                onSessionSelect={async sid => {
                  // Load saved messages immediately for instant display
                  const saved = await window.api.sessionLoad(sid) as { messages: ChatMessage[]; title?: string; createdAt?: number; forkedFrom?: string } | null
                  if (saved?.messages?.length) {
                    chat.hydrate(saved.messages as ChatMessage[], sid)
                  } else {
                    chat.clearMessages()
                    chat.setSessionId(sid)
                  }
                  setSessionTitle(saved?.title)
                  setSessionCreatedAt(saved?.createdAt)
                  // 포크된 세션은 SDK가 UUID를 모르므로 새 세션으로 시작
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

export default function App() {
  const isCCEditorWindow = window.location.hash === '#cc-editor'
  if (isCCEditorWindow) return <CCEditorWindow />
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  )
}
