import { useCallback, useEffect, useRef, useState } from 'react'

import './styles/hq.css'
import { ProjectProvider, useProject } from './stores/project-store'
import { useChatStore } from './domains/chat/store'
import type { ChatMessage } from './domains/chat/domain'
import { initChatAdapter } from './domains/chat/adapter'
import { registerChatCommands } from './domains/chat/commands'
import type { SidebarTab } from './components/sidebar/Sidebar'
import type { ChangedFile } from './components/sidebar/ChangedFilesPanel'
import { playCompletionSound } from './utils/sound'
import { recordCost } from './utils/cost-tracker'
import { aguiDispatch } from './utils/agui-store'
import { toast } from './utils/toast'

// Extracted hooks & components
import { useWorkspaceManager } from './hooks/useWorkspaceManager'
import { useSessionManager } from './hooks/useSessionManager'
import { useSettingsSync } from './hooks/useSettingsSync'
import { useResizeHandlers } from './hooks/useResizeHandlers'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { WelcomeScreen } from './components/shared/WelcomeScreen'
import { AppLayout } from './components/shared/AppLayout'
import { CocosPanel } from './components/sidebar/CocosPanel'

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
    workspaces, activeWsId,
    openTabs, setOpenTabs, activeTab, setActiveTab, activeTabRef,
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
  const { handleToggleHQ: _toggleHQ, setActiveAgents, soundEnabledRef, setFocusMode } = settings

  const resize = useResizeHandlers()
  const { setSidebarCollapsed, setTerminalOpen } = resize

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
      if (!path) return
      if (/\.(fire|scene|prefab)$/i.test(path)) {
        // 씬/프리펩 → CocosPanel에서 열기
        window.dispatchEvent(new CustomEvent('cc:load-scene', { detail: path }))
      } else {
        openFile(path)
      }
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
    <AppLayout
      workspace={workspace}
      settings={settings}
      resize={resize}
      project={project}
      chat={chat}
      sessionTitle={sessionTitle}
      setSessionTitle={setSessionTitle}
      sessionCreatedAt={sessionCreatedAt}
      setSessionCreatedAt={setSessionCreatedAt}
      suggestions={suggestions}
      setSuggestions={setSuggestions}
      ccLayout={ccLayout}
      ccTab={ccTab}
      ccSplitRatio={ccSplitRatio}
      setCCTab={setCCTab}
      setCCLayoutMode={setCCLayoutMode}
      openCCEditorWindow={openCCEditorWindow}
      handleCCSplitDragStart={handleCCSplitDragStart}
      chatFocusTrigger={chatFocusTrigger}
      chatSearchTrigger={chatSearchTrigger}
      scrollToMessageId={scrollToMessageId}
      setScrollToMessageId={setScrollToMessageId}
      splitFilePath={splitFilePath}
      setSplitFilePath={setSplitFilePath}
      dirtyTabs={dirtyTabs}
      setTabDirty={setTabDirty}
      changedFiles={changedFiles}
      setChangedFiles={setChangedFiles}
      lightbox={lightbox}
      setLightbox={setLightbox}
      paletteOpen={paletteOpen}
      setPaletteOpen={setPaletteOpen}
      shortcutsOpen={shortcutsOpen}
      setShortcutsOpen={setShortcutsOpen}
      settingsOpen={settingsOpen}
      setSettingsOpen={setSettingsOpen}
      pendingInsert={pendingInsert}
      setPendingInsert={setPendingInsert}
      activeSidebarIconTab={activeSidebarIconTab}
      setActiveSidebarIconTab={setActiveSidebarIconTab}
      sidebarSwitchTabRef={sidebarSwitchTabRef}
      handleToggleHQ={handleToggleHQ}
      openFile={openFile}
      switchToChat={switchToChat}
      closeFileTab={closeFileTab}
      handleExportMarkdown={handleExportMarkdown}
      handleEditResend={handleEditResend}
      handleFork={handleFork}
      handleCompressContext={handleCompressContext}
      handleReplyToMessage={handleReplyToMessage}
    />
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
