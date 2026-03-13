import { useCallback, useEffect, useRef, useState } from 'react'

import { AgentBay } from './components/hq/AgentBay'
import { ResourceBar } from './components/hq/ResourceBar'
import { OpsFeed } from './components/hq/OpsFeed'
import './styles/hq.css'
import { ProjectProvider, useProject } from './stores/project-store'
import { useChatStore } from './stores/chat-store'
import { ChatMessage } from './stores/chat-store'
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
import { applyCustomCSS } from './utils/css'
import { ToastContainer } from './components/shared/ToastContainer'
import { toast } from './utils/toast'

// ── Types ────────────────────────────────────────────────────────────────────

type FileTab = string  // file path
type MainTab = 'chat' | 'scene' | 'preview' | FileTab
type CCLayoutMode = 'tab' | 'split' | 'detach'

interface ActiveAgent {
  id: string
  description: string
  status: 'running' | 'completed' | 'error'
  startTime: number
  output?: string
}

interface WorkspaceSnapshot {
  messages: ChatMessage[]
  sessionId: string | null
  openTabs: MainTab[]
  activeTab: MainTab
  ccPort?: number
  webPreviewUrl?: string
}

interface Workspace {
  id: string
  path: string
  snapshot: WorkspaceSnapshot
}

const EMPTY_SNAPSHOT: WorkspaceSnapshot = {
  messages: [],
  sessionId: null,
  openTabs: ['chat'],
  activeTab: 'chat',
}

// ── WelcomeScreen ────────────────────────────────────────────────────────────

interface RecentSession { id: string; title: string; cwd: string; updatedAt: number }

function WelcomeScreen({ onOpenFolder, onOpenPath, onOpenSession }: {
  onOpenFolder: () => void
  onOpenPath: (p: string) => void
  onOpenSession: (id: string, path: string) => void
}) {
  const [recents, setRecents] = useState<string[]>([])
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  useEffect(() => {
    window.api?.getRecentProjects().then(setRecents)
    window.api?.sessionList().then(list => {
      const sessions = (list as RecentSession[])
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 4)
      setRecentSessions(sessions)
    })
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-primary)', gap: 32,
      WebkitAppRegion: 'drag',
    } as React.CSSProperties}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Claude Desktop</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>AI 코딩 어시스턴트</div>
      </div>

      <button
        onClick={onOpenFolder}
        style={{
          padding: '10px 28px', background: 'var(--accent)', color: '#fff',
          borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        폴더 열기
      </button>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', width: '100%', maxWidth: 720, justifyContent: 'center' }}>
        {recentSessions.length > 0 && (
          <div style={{ flex: 1, maxWidth: 340 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              최근 대화
            </div>
            {recentSessions.map(s => (
              <div
                key={s.id}
                onClick={() => onOpenSession(s.id, s.cwd)}
                style={{
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  WebkitAppRegion: 'no-drag',
                } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ opacity: 0.5 }}>💬</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {s.title || '대화'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.cwd.split(/[\\/]/).slice(-2).join('/')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {recents.length > 0 && (
          <div style={{ flex: 1, maxWidth: 340 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              최근 프로젝트
            </div>
            {recents.slice(0, 6).map(p => (
              <div
                key={p}
                onClick={() => onOpenPath(p)}
                style={{
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  WebkitAppRegion: 'no-drag',
                } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ opacity: 0.5 }}>⬡</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.split(/[\\/]/).pop()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Accent color helper ──────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ── WorkspaceTabBar ──────────────────────────────────────────────────────────

function WorkspaceTabBar({ workspaces, activeId, workspaceNames, onSelect, onClose, onAdd, onRename }: {
  workspaces: Workspace[]
  activeId: string
  workspaceNames: Record<string, string>
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
}) {
  const [tabMenu, setTabMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const [renamingTab, setRenamingTab] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const getTabName = (id: string) => {
    const ws = workspaces.find(w => w.id === id)
    return workspaceNames[id] ?? (ws ? (ws.path.split(/[\\/]/).pop() ?? ws.path) : id)
  }

  const applyRename = (id: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed) onRename(id, trimmed)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      height: 28,
      overflowX: 'auto',
    }}>
      {workspaces.map(ws => {
        const name = getTabName(ws.id)
        const isActive = ws.id === activeId
        const isRenaming = renamingTab === ws.id
        return (
          <div
            key={ws.id}
            onClick={() => onSelect(ws.id)}
            onContextMenu={e => { e.preventDefault(); setTabMenu({ tabId: ws.id, x: e.clientX, y: e.clientY }) }}
            title={ws.path}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0 10px', flexShrink: 0,
              fontSize: 12, cursor: 'pointer', userSelect: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-primary)' : 'transparent',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span style={{ fontSize: 10, opacity: 0.7 }}>⬡</span>
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => { applyRename(renamingTab!, renameValue); setRenamingTab(null) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { applyRename(renamingTab!, renameValue); setRenamingTab(null) }
                  if (e.key === 'Escape') setRenamingTab(null)
                  e.stopPropagation()
                }}
                onClick={e => e.stopPropagation()}
                style={{ width: 80, background: 'var(--bg-primary)', color: 'inherit', border: '1px solid var(--accent)', borderRadius: 3, padding: '1px 4px', fontSize: 12 }}
              />
            ) : (
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
            )}
            {workspaces.length > 1 && (
              <span
                onClick={e => { e.stopPropagation(); onClose(ws.id) }}
                style={{ opacity: 0.4, fontSize: 14, lineHeight: 1, padding: '0 1px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
              >×</span>
            )}
          </div>
        )
      })}
      <div
        onClick={onAdd}
        title="Open folder in new workspace"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, flexShrink: 0, cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 16,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
      >+</div>

      {tabMenu && (
        <div
          style={{
            position: 'fixed', top: tabMenu.y, left: tabMenu.x, zIndex: 9999,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onMouseLeave={() => setTabMenu(null)}
        >
          {[
            {
              label: '이름 변경',
              action: () => { setRenamingTab(tabMenu.tabId); setRenameValue(getTabName(tabMenu.tabId)); setTabMenu(null) },
            },
            {
              label: '탭 닫기',
              action: () => { onClose(tabMenu.tabId); setTabMenu(null) },
            },
            {
              label: '새 탭',
              action: () => { onAdd(); setTabMenu(null) },
            },
          ].map(item => (
            <div
              key={item.label}
              onClick={item.action}
              style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, #2a2a2a)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── FileTabBar ───────────────────────────────────────────────────────────────

function FileTabBar({ tabs, active, onSelect, onClose }: {
  tabs: MainTab[]
  active: MainTab
  onSelect: (t: MainTab) => void
  onClose: (t: MainTab) => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      height: 28,
      overflowX: 'auto',
    }}>
      {tabs.map(t => {
        const isActive = t === active
        const label = t === 'chat' ? 'Claude'
          : t === 'scene' ? '⬡ 씬뷰'
          : t === 'preview' ? '🌐 프리뷰'
          : (t.split(/[\\/]/).pop() ?? t)
        return (
          <div
            key={t}
            onClick={() => onSelect(t)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 12px', flexShrink: 0,
              fontSize: 12, cursor: 'pointer', userSelect: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-primary)' : 'transparent',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              maxWidth: 160,
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
            {t !== 'chat' && t !== 'scene' && t !== 'preview' && (
              <span
                onClick={e => { e.stopPropagation(); onClose(t) }}
                style={{ opacity: 0.4, fontSize: 14, lineHeight: 1, padding: '0 1px', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
              >×</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── AppContent ───────────────────────────────────────────────────────────────

// ── CC Editor Detached Window ─────────────────────────────────────────────

function CCEditorWindow() {
  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <CocosPanel />
    </div>
  )
}

function AppContent() {
  const project = useProject()
  const chat = useChatStore()

  // ── Workspace state ──
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWsId, setActiveWsId] = useState<string>('')
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('workspace-names') ?? '{}') } catch { return {} }
  })
  const updateWorkspaceNames = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    setWorkspaceNames(prev => {
      const next = updater(prev)
      localStorage.setItem('workspace-names', JSON.stringify(next))
      return next
    })
  }
  const wsStateRef = useRef<WorkspaceSnapshot>(EMPTY_SNAPSHOT)

  // ── File tabs (per workspace, stored in snapshot) ──
  const [openTabs, setOpenTabs] = useState<MainTab[]>(['chat'])
  const [activeTab, setActiveTab] = useState<MainTab>('chat')
  const activeTabRef = useRef<MainTab>('chat')

  // ── Per-workspace CC / Preview state ──
  const [wsCCPort, setWsCCPort] = useState<number>(9090)
  const [wsWebPreviewUrl, setWsWebPreviewUrl] = useState<string>('')
  const [wsCCConnected, setWsCCConnected] = useState(false)

  // ── CC Layout mode ──
  const [ccLayout, setCCLayout] = useState<CCLayoutMode>(() =>
    (localStorage.getItem('cc-layout-mode') as CCLayoutMode) ?? 'tab'
  )
  const [ccTab, setCCTab] = useState<'claude' | 'editor'>('claude')
  const [ccSplitRatio, setCCSplitRatio] = useState(0.5)
  const ccSplitRatioRef = useRef(0.5)

  // CC 연결 상태에 따라 scene + preview 탭 추가/제거
  useEffect(() => {
    if (!wsCCConnected) {
      // [M-13] setActiveTab을 updater 바깥에서 호출
      if (activeTabRef.current === 'scene' || activeTabRef.current === 'preview') {
        activeTabRef.current = 'chat'
        setActiveTab('chat')
      }
    }
    setOpenTabs(prev => {
      if (wsCCConnected) {
        let next = prev
        if (!next.includes('scene')) {
          next = ['chat', 'scene', ...next.filter(t => t !== 'chat')]
        }
        if (!next.includes('preview')) {
          const sceneIdx = next.indexOf('scene')
          if (sceneIdx !== -1) {
            next = [...next.slice(0, sceneIdx + 1), 'preview', ...next.slice(sceneIdx + 1)]
          } else {
            next = ['chat', 'preview', ...next.filter(t => t !== 'chat')]
          }
        }
        return next
      }
      // 연결 해제 시
      return prev.filter(t => t !== 'scene' && t !== 'preview')
    })
  }, [wsCCConnected])

  // ── Terminal ──
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [bottomHeight, setBottomHeight] = useState(240)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  // ── Chat focus trigger ──
  const [chatFocusTrigger, setChatFocusTrigger] = useState(0)
  const [chatSearchTrigger, setChatSearchTrigger] = useState(0)
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null)

  // ── Split view ──
  const [splitFilePath, setSplitFilePath] = useState<string | null>(null)

  // ── Lightbox ──
  const [lightbox, setLightbox] = useState<{ src: string; alt?: string } | null>(null)

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

  // ── Command palette ──
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteOpenRef = useRef(false)
  paletteOpenRef.current = paletteOpen

  // ── Keyboard shortcuts overlay ──
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // ── Settings panel ──
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ── HQ mode ──
  const [hqMode, setHqMode] = useState(false)
  const [activeAgents, setActiveAgents] = useState<ActiveAgent[]>([])
  const [agentBayWidth, setAgentBayWidth] = useState(260)
  const [isAgentBayDragging, setIsAgentBayDragging] = useState(false)
  const agentBayDragStartX = useRef(0)
  const agentBayDragStartW = useRef(0)

  useEffect(() => {
    window.api?.settingsGet().then((s: Record<string, unknown>) => {
      if (s?.hqMode) setHqMode(true)
    }).catch(() => {})
  }, [])

  const handleToggleHQ = useCallback(() => {
    setHqMode(prev => {
      const next = !prev
      if (next) setActiveTab('chat')  // HQ 켤 때 chat 탭으로 전환
      window.api?.settingsGet().then(settings => {
        window.api?.settingsSave({ ...settings, hqMode: next })
      }).catch(() => {})
      return next
    })
  }, [])

  // ── Focus mode ──
  const [focusMode, setFocusMode] = useState(false)

  // ── Theme toggle ──
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() =>
    (localStorage.getItem('theme') as 'dark' | 'light' | 'system') ?? 'dark'
  )

  const applyTheme = useCallback((t: 'dark' | 'light' | 'system', isDark?: boolean) => {
    const effective = t === 'system'
      ? (isDark !== undefined ? isDark : window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark' : 'light'
      : t
    document.documentElement.setAttribute('data-theme', effective)
  }, [])

  useEffect(() => {
    localStorage.setItem('theme', theme)
    if (theme !== 'system') {
      applyTheme(theme)
      return
    }
    // system: 초기값 + 변경 구독
    window.api?.getNativeTheme?.().then(({ isDark }) => applyTheme('system', isDark))
    const unsub = window.api?.onNativeThemeChanged?.((isDark) => applyTheme('system', isDark))
    return () => unsub?.()
  }, [theme, applyTheme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : t === 'light' ? 'dark' : 'dark')

  // ── Sound enabled ref + state for palette display ──
  const soundEnabledRef = useRef(true)
  const isDeltaStreamingRef = useRef(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [compactMode, setCompactMode] = useState(false)

  // ── Chat font size (Ctrl+=/- shortcut) ──
  const [chatFontSize, setChatFontSize] = useState(() =>
    Number(localStorage.getItem('chat-font-size') ?? '13')
  )
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-font-size', `${chatFontSize}px`)
    localStorage.setItem('chat-font-size', String(chatFontSize))
  }, [chatFontSize])
  useEffect(() => {
    const unsub = window.api?.onFontSizeShortcut?.((delta, reset) => {
      setChatFontSize(prev => {
        if (reset) return 13
        return Math.min(18, Math.max(11, prev + delta))
      })
    })
    return () => unsub?.()
  }, [])
  useEffect(() => {
    const onFontSizeChange = (e: Event) => {
      const { size } = (e as CustomEvent).detail as { size: number }
      setChatFontSize(size)
    }
    window.addEventListener('font-size-change', onFontSizeChange)
    return () => window.removeEventListener('font-size-change', onFontSizeChange)
  }, [])

  // ── Sidebar tab switcher ref ──
  const sidebarSwitchTabRef = useRef<((tab: SidebarTab) => void) | null>(null)
  const [activeSidebarIconTab, setActiveSidebarIconTab] = useState<SidebarTab | null>(null)

  // ── Session metadata for StatusBar ──
  const [sessionTitle, setSessionTitle] = useState<string | undefined>(undefined)
  const [sessionCreatedAt, setSessionCreatedAt] = useState<number | undefined>(undefined)

  // ── Follow-up suggestions ──
  const [suggestions, setSuggestions] = useState<string[]>([])

  // ── Snippet insert ──
  const [pendingInsert, setPendingInsert] = useState<string | undefined>(undefined)

  const handleReplyToMessage = useCallback((text: string) => {
    const quoted = text.split('\n').map(line => `> ${line}`).join('\n')
    setPendingInsert(quoted + '\n\n')
  }, [])

  // ── Apply saved accent color + compact mode on startup ──
  useEffect(() => {
    const savedAccent = localStorage.getItem('accent-color')
    if (savedAccent) {
      document.documentElement.style.setProperty('--accent', savedAccent)
      try { document.documentElement.style.setProperty('--accent-rgb', hexToRgb(savedAccent)) } catch { /* ignore */ }
    }
    window.api?.settingsGet().then(settings => {
      if (settings.accentColor) {
        document.documentElement.style.setProperty('--accent', settings.accentColor)
        try { document.documentElement.style.setProperty('--accent-rgb', hexToRgb(settings.accentColor)) } catch { /* ignore */ }
      }
      const compact = !!settings.compactMode
      if (compact) document.documentElement.setAttribute('data-compact', 'true')
      setCompactMode(compact)
      const sound = settings.soundEnabled !== false
      soundEnabledRef.current = sound
      setSoundEnabled(sound)
      if (settings.customCSS) {
        applyCustomCSS(settings.customCSS)
      }
    })
  }, [])

  // ── Sync accent color from SettingsPanel ──
  useEffect(() => {
    const onAccentChange = (e: Event) => {
      const { color } = (e as CustomEvent).detail as { color: string }
      document.documentElement.style.setProperty('--accent', color)
      try { document.documentElement.style.setProperty('--accent-rgb', hexToRgb(color)) } catch { /* ignore */ }
    }
    window.addEventListener('accent-change', onAccentChange)
    return () => window.removeEventListener('accent-change', onAccentChange)
  }, [])

  // ── Sync soundEnabledRef when settings are saved ──
  useEffect(() => {
    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { soundEnabled?: boolean; compactMode?: boolean; theme?: string }
      const sound = detail.soundEnabled !== false
      soundEnabledRef.current = sound
      setSoundEnabled(sound)
      if (detail.compactMode !== undefined) setCompactMode(!!detail.compactMode)
      if (detail.theme) setTheme(detail.theme as 'dark' | 'light' | 'system')
    }
    window.addEventListener('settings:changed', onSettingsChanged)
    return () => window.removeEventListener('settings:changed', onSettingsChanged)
  }, [])

  // ── Sidebar resize & collapse ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )
  const [sidebarWidth, setSidebarWidth] = useState(
    () => Number(localStorage.getItem('sidebar-width')) || 220
  )
  useEffect(() => { localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed)) }, [sidebarCollapsed])
  useEffect(() => { localStorage.setItem('sidebar-width', String(sidebarWidth)) }, [sidebarWidth])
  const [isSidebarDragging, setIsSidebarDragging] = useState(false)
  const sidebarDragStartX = useRef(0)
  const sidebarDragStartW = useRef(0)

  // ── Tab cycling ref ──
  const openTabsRef = useRef(openTabs)
  openTabsRef.current = openTabs

  // ── Workspace cycling refs ──
  const workspacesRef = useRef(workspaces)
  workspacesRef.current = workspaces
  const activeWsIdRef = useRef(activeWsId)
  activeWsIdRef.current = activeWsId

  // ── Project ref (stable reference for event handlers) ──
  const projectRef = useRef(project)
  projectRef.current = project

  // Keep wsStateRef in sync for snapshot saving
  wsStateRef.current = { messages: chat.messages, sessionId: chat.sessionId, openTabs, activeTab, ccPort: wsCCPort, webPreviewUrl: wsWebPreviewUrl }

  // Init: restore all saved workspaces
  useEffect(() => {
    if (!window.api) return
    window.api.getOpenWorkspaces().then(({ workspaces: saved, activePath }) => {
      if (saved.length === 0) {
        // Legacy fallback: load single current project
        window.api.getCurrentProject().then(path => {
          if (path) createOrSwitchWorkspace(path, true)
        })
        return
      }
      // Restore all workspaces with saved tab state
      const newWorkspaces: Workspace[] = saved.map((ws, i) => ({
        id: `ws-${Date.now()}-${i}`,
        path: ws.path,
        snapshot: {
          messages: [],
          sessionId: null,
          openTabs: ws.openTabs.length > 0 ? ws.openTabs.filter((t: string) => t !== 'preview' && t !== 'scene') : ['chat'],
          activeTab: ws.activeTab || 'chat',
        },
      }))
      const targetPath = activePath ?? saved[saved.length - 1].path
      const targetWs = newWorkspaces.find(w => w.path === targetPath) ?? newWorkspaces[newWorkspaces.length - 1]
      setWorkspaces(newWorkspaces)
      setActiveWsId(targetWs.id)
      window.api?.setProject(targetWs.path)
      project.setProject(targetWs.path)
      // Apply the active workspace's saved tabs
      setOpenTabs(targetWs.snapshot.openTabs)
      activeTabRef.current = targetWs.snapshot.activeTab
      setActiveTab(targetWs.snapshot.activeTab)
    })
  }, [])

  // ── Workspace helpers ──

  const saveCurrentSnapshot = () => {
    if (!activeWsId) return
    const cur = wsStateRef.current
    // [C-2] scene/preview는 CC 연결 상태 의존 탭 → 스냅샷에서 제외
    const safeTabs = cur.openTabs.filter(t => t !== 'preview' && t !== 'scene')
    const safeActive: MainTab = cur.activeTab === 'scene' || cur.activeTab === 'preview'
      ? (safeTabs[0] ?? 'chat')
      : cur.activeTab
    // [SEC-C9] messages는 스냅샷에 저장 안 함 — sessionId로 복원
    const snap: WorkspaceSnapshot = { ...cur, openTabs: safeTabs, activeTab: safeActive, messages: [] }
    setWorkspaces(prev => prev.map(ws => ws.id === activeWsId ? { ...ws, snapshot: snap } : ws))
  }

  const applySnapshot = (snap: WorkspaceSnapshot, path: string) => {
    chat.hydrate(snap.messages, snap.sessionId)
    const safeTabs = snap.openTabs.filter(t => t !== 'preview' && t !== 'scene')
    // [C-1] activeTab이 scene/preview이면 'chat'으로 폴백
    const safeActive: MainTab = snap.activeTab === 'scene' || snap.activeTab === 'preview'
      ? 'chat'
      : snap.activeTab
    setOpenTabs(safeTabs)
    activeTabRef.current = safeActive
    setActiveTab(safeActive)
    setWsCCPort(snap.ccPort ?? 9090)
    setWsWebPreviewUrl(snap.webPreviewUrl ?? '')
    setWsCCConnected(false)
    window.api?.setProject(path)
    project.setProject(path)
  }

  const createOrSwitchWorkspace = (path: string, skipSave = false) => {
    const existing = workspaces.find(ws => ws.path === path)
    if (existing) {
      // Switch to existing workspace
      if (!skipSave && activeWsId && activeWsId !== existing.id) {
        saveCurrentSnapshot()
      }
      setActiveWsId(existing.id)
      applySnapshot(existing.snapshot, path)
    } else {
      // Create new workspace
      if (!skipSave && activeWsId) saveCurrentSnapshot()
      const id = `ws-${Date.now()}`
      const snap = { ...EMPTY_SNAPSHOT }
      setWorkspaces(prev => [...prev, { id, path, snapshot: snap }])
      setActiveWsId(id)
      applySnapshot(snap, path)
    }
  }

  const handleOpenFolder = async () => {
    const path = await window.api?.openFolder()
    if (!path) return
    createOrSwitchWorkspace(path)
  }

  const switchWorkspace = (id: string) => {
    if (id === activeWsId) return
    saveCurrentSnapshot()
    const target = workspaces.find(ws => ws.id === id)
    if (!target) return
    setActiveWsId(id)
    applySnapshot(target.snapshot, target.path)
  }

  const closeWorkspace = (id: string) => {
    const next = workspaces.filter(ws => ws.id !== id)
    setWorkspaces(next)
    if (activeWsId === id && next.length > 0) {
      const fallback = next[next.length - 1]
      setActiveWsId(fallback.id)
      applySnapshot(fallback.snapshot, fallback.path)
    }
  }

  // ── File tabs helpers ──

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

  const closeActiveFileTab = () => {
    const cur = activeTabRef.current
    // [M-6] scene/preview 탭은 CC 연결 의존 탭 → Ctrl+W로 닫기 불가
    if (cur !== 'chat' && cur !== 'scene' && cur !== 'preview') closeFileTab(cur)
  }

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

  // ── Sound toggle (from palette) ──
  const handleToggleSound = async () => {
    const settings = await window.api?.settingsGet()
    if (!settings) return
    const newVal = !soundEnabledRef.current
    await window.api?.settingsSave({ ...settings, soundEnabled: newVal })
    soundEnabledRef.current = newVal
    setSoundEnabled(newVal)
    window.dispatchEvent(new CustomEvent('settings:changed', { detail: { ...settings, soundEnabled: newVal } }))
  }

  // ── Compact mode toggle (from palette) ──
  const handleToggleCompact = async () => {
    const settings = await window.api?.settingsGet()
    if (!settings) return
    const newVal = !compactMode
    await window.api?.settingsSave({ ...settings, compactMode: newVal })
    if (newVal) {
      document.documentElement.setAttribute('data-compact', 'true')
    } else {
      document.documentElement.removeAttribute('data-compact')
    }
    setCompactMode(newVal)
    window.dispatchEvent(new CustomEvent('settings:changed', { detail: { ...settings, compactMode: newVal } }))
  }

  // ── Export current session as markdown ──
  const handleExportMarkdown = async () => {
    if (!chat.sessionId) return
    const result = await window.api?.sessionExportMarkdown(chat.sessionId)
    if (result?.success) toast('내보내기 완료', 'success')
    else if (result?.error) toast('내보내기 실패: ' + result.error, 'error')
  }

  // ── Persist workspace list (with tab state) ──
  useEffect(() => {
    if (workspaces.length === 0) return
    const wsData = workspaces.map(w => {
      if (w.id === activeWsId) {
        const safeTabs = openTabs.filter(t => t !== 'scene' && t !== 'preview')
        const safeActive = activeTab === 'scene' || activeTab === 'preview' ? 'chat' : activeTab
        return { path: w.path, openTabs: safeTabs, activeTab: safeActive }
      }
      return { path: w.path, openTabs: w.snapshot.openTabs, activeTab: w.snapshot.activeTab }
    })
    const activePath = workspaces.find(w => w.id === activeWsId)?.path ?? null
    window.api?.setOpenWorkspaces(wsData, activePath)
  }, [workspaces, activeWsId, openTabs, activeTab])

  // ── Smart early title: generate title from first user message (non-blocking) ──
  const earlyTitledSessionsRef = useRef<Set<string>>(new Set())
  const prevMessageCountRef = useRef(0)
  useEffect(() => {
    const userMsgs = chat.messages.filter(m => m.role === 'user')
    const prevCount = prevMessageCountRef.current
    prevMessageCountRef.current = chat.messages.length
    // Trigger only when transitioning to exactly 1 user message (first send)
    if (userMsgs.length !== 1 || prevCount !== 0) return
    const sid = chat.sessionId
    if (!sid || earlyTitledSessionsRef.current.has(sid)) return
    earlyTitledSessionsRef.current.add(sid)
    const userMessage = userMsgs[0].text
    window.api?.generateTitle({ userMessage })
      .then(title => {
        if (title && sid) {
          window.api?.sessionRename(sid, title)
            .then(() => window.dispatchEvent(new CustomEvent('session:saved')))
        }
      })
      .catch(() => { /* silent: post-streaming fallback will handle */ })
  }, [chat.messages, chat.sessionId])

  // ── Auto-save session ──
  const prevIsStreamingRef = useRef(false)
  const autoTitledSessionsRef = useRef<Set<string>>(new Set())
  const autoTaggedSessionsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current
    prevIsStreamingRef.current = chat.isStreaming
    if (!wasStreaming && chat.isStreaming) {
      setSuggestions([])
    }
    if (wasStreaming && !chat.isStreaming && chat.sessionId && project.currentPath && chat.messages.length > 0) {
      const firstUser = chat.messages.find(m => m.role === 'user')
      const title = firstUser ? firstUser.text.replace(/\n/g, ' ').slice(0, 60) : 'Untitled'

      // Auto-title: 첫 번째 응답 완료 시 Haiku API로 제목 생성
      const userMsgs = chat.messages.filter(m => m.role === 'user')
      const assistantMsgs = chat.messages.filter(m => m.role === 'assistant')
      if (
        userMsgs.length === 1 && assistantMsgs.length === 1 &&
        !autoTitledSessionsRef.current.has(chat.sessionId) &&
        !earlyTitledSessionsRef.current.has(chat.sessionId)
      ) {
        const sid = chat.sessionId
        autoTitledSessionsRef.current.add(sid)
        const userText = userMsgs[0].text
        const assistantText = assistantMsgs[0].text
        window.api?.sessionGenerateTitle(userText, assistantText)
          .then(({ title }) => {
            if (title && sid) {
              window.api?.sessionRename(sid, title)
                .then(() => window.dispatchEvent(new CustomEvent('session:saved')))
            }
          })
          .catch(() => {
            // fallback: user 메시지 앞 30자
            const rawText = userText.replace(/\n/g, ' ').trim()
            let fallbackTitle = rawText
            if (rawText.length > 30) {
              const truncated = rawText.slice(0, 30)
              const lastSpace = truncated.lastIndexOf(' ')
              fallbackTitle = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated
            }
            if (fallbackTitle && sid) {
              window.api?.sessionRename(sid, fallbackTitle)
                .then(() => window.dispatchEvent(new CustomEvent('session:saved')))
            }
          })

        // 자동 태그 생성
        if (!autoTaggedSessionsRef.current.has(sid)) {
          autoTaggedSessionsRef.current.add(sid)
          window.api?.sessionGenerateTags(userText, assistantText)
            .then(({ tags }) => {
              if (tags.length > 0 && sid) {
                window.api?.sessionTag(sid, tags)
                  .then(() => window.dispatchEvent(new CustomEvent('session:saved')))
              }
            })
            .catch(() => { /* 태그 생성 실패 시 무시 */ })
        }
      }

      const sessionCreated = chat.messages[0]?.timestamp ?? Date.now()
      setSessionTitle(title)
      setSessionCreatedAt(sessionCreated)
      window.api?.sessionSave({
        id: chat.sessionId, title,
        cwd: project.currentPath,
        model: project.selectedModel,
        messages: chat.messages,
        createdAt: sessionCreated,
        updatedAt: Date.now(),
      }).then(() => window.dispatchEvent(new CustomEvent('session:saved')))

      // Desktop notification on session complete
      if ('Notification' in window) {
        const last = chat.messages.filter(m => m.role === 'assistant').pop()
        const preview = last?.text?.slice(0, 100)?.replace(/\n/g, ' ') ?? '응답이 완료되었습니다'
        if (Notification.permission === 'granted') {
          new window.Notification('클로드', { body: preview, silent: false })
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
              new window.Notification('클로드', { body: preview, silent: false })
            }
          })
        }
      }

      // Follow-up suggestions
      const lastAssistant = chat.messages.filter(m => m.role === 'assistant').pop()
      const lastUser = chat.messages.filter(m => m.role === 'user').pop()
      if (lastAssistant?.text && lastUser?.text) {
        setSuggestions([])
        window.api?.suggestFollowUps?.(lastAssistant.text, lastUser.text)
          .then(result => { setSuggestions(result ?? []) })
          .catch(() => { /* silent */ })
      }
    }
  }, [chat.isStreaming])

  // ── Claude IPC ──
  useEffect(() => {
    if (!window.api) return
    window.api.onClaudeMessage((event: unknown) => {
      const ev = event as { type: string; [k: string]: unknown }
      if (ev.type === 'init') {
        chat.setSessionId(ev.sessionId as string)
      } else if (ev.type === 'text') {
        if (isDeltaStreamingRef.current) {
          chat.reconcileText(ev.text as string)
        } else {
          chat.ensureAssistantMessage()
          chat.appendText(ev.text as string)
        }
      } else if (ev.type === 'tool_start') {
        chat.ensureAssistantMessage()
        chat.addToolUse(ev.toolId as string, ev.toolName as string, ev.toolInput)
        if (ev.toolName === 'Write' || ev.toolName === 'Edit') {
          trackChangedFile(ev.toolName as string, ev.toolInput)
        }
        if (ev.toolName === 'Task') {
          const input = ev.toolInput as Record<string, unknown> | undefined
          const desc = (input?.description ?? input?.prompt ?? 'Task') as string
          setActiveAgents(prev => [...prev, {
            id: ev.toolId as string,
            description: desc.slice(0, 100),
            status: 'running',
            startTime: Date.now(),
          }])
        }
      } else if (ev.type === 'tool_end') {
        chat.updateToolUse(ev.toolId as string, ev.toolOutput as string, ev.isError as boolean)
        setActiveAgents(prev => prev.map(a =>
          a.id === (ev.toolId as string)
            ? { ...a, status: (ev.isError as boolean) ? 'error' : 'completed', output: (ev.toolOutput as string)?.slice(0, 200) }
            : a
        ))
      } else if (ev.type === 'result') {
        setTimeout(() => setActiveAgents([]), 5000)
        project.addCost(
          (ev.costUsd as number) ?? 0,
          (ev.inputTokens as number) ?? 0,
          (ev.outputTokens as number) ?? 0,
        )
        recordCost(
          (ev.costUsd as number) ?? 0,
          (ev.inputTokens as number) ?? 0,
          (ev.outputTokens as number) ?? 0,
        )
        chat.addUsage(
          (ev.inputTokens as number) ?? 0,
          (ev.outputTokens as number) ?? 0,
          project.selectedModel,
        )
        isDeltaStreamingRef.current = false
        chat.finishStreaming()
        if (soundEnabledRef.current) {
          playCompletionSound()
        }
      } else if (ev.type === 'thinking') {
        // Extended Thinking 전체 블록 (non-streaming fallback)
        if (ev.text) { chat.ensureAssistantMessage(); chat.appendThinking(ev.text as string) }
      } else if (ev.type === 'thinking_delta') {
        // thinking 스트리밍 delta
        if (ev.text) { chat.ensureAssistantMessage(); chat.appendThinking(ev.text as string) }
      } else if (ev.type === 'text_delta') {
        isDeltaStreamingRef.current = true
        chat.ensureAssistantMessage()
        chat.appendText(ev.text as string)
      } else if (ev.type === 'input_json_delta') {
        // tool input 스트리밍 — 현재는 무시
      } else if (ev.type === 'usage') {
        // message_delta usage 업데이트
        chat.addUsage(
          (ev.inputTokens as number) ?? 0,
          (ev.outputTokens as number) ?? 0,
        )
      } else if (ev.type === 'tool_progress') {
        // 툴 실행 중 — 현재는 무시 (향후 진행 표시 UI에 활용 가능)
      } else if (ev.type === 'status') {
        // compacting 상태 — 현재는 무시
      } else if (ev.type === 'interrupted') {
        setActiveAgents([])
        chat.finishStreaming()
      } else if (ev.type === 'error') {
        chat.ensureAssistantMessage()
        const errMsg = String(ev.message ?? '')
        const isApiKeyError = /401|api_key|authentication|invalid_api_key|x-api-key/i.test(errMsg)
        if (isApiKeyError) {
          chat.appendText(`\n⚠️ API 키가 유효하지 않습니다. ANTHROPIC_API_KEY 환경변수를 확인해주세요.\n\n원인: ${errMsg}`)
        } else {
          chat.appendText(`\n[Error: ${errMsg}]`)
        }
        chat.markLastMessageError()
        chat.finishStreaming()
      }

      if (['run_started', 'step_started', 'step_finished', 'run_finished'].includes(ev.type)) {
        aguiDispatch(ev)
      }
    })
    window.api.onClaudePermission((req: unknown) => {
      const r = req as { requestId: string; toolName: string; input: unknown }
      chat.setPendingPermission(r)
    })
    return () => window.api.removeClaudeListeners()
  }, [])

  // ── Ctrl+W: close active file tab ──
  useEffect(() => {
    if (!window.api) return
    return window.api.onCloseTab(closeActiveFileTab)
  }, [closeActiveFileTab])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      } else if (e.key === 'Escape' && paletteOpenRef.current) {
        setPaletteOpen(false)
      } else if (e.ctrlKey && (e.key === 'k' || e.key === 'n')) {
        e.preventDefault()
        chat.clearMessages()
        window.api?.claudeClose()
        switchToChat(true)
      } else if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        const tabs = openTabsRef.current
        const cur = activeTabRef.current
        const idx = tabs.indexOf(cur)
        const next = e.shiftKey
          ? tabs[(idx - 1 + tabs.length) % tabs.length]
          : tabs[(idx + 1) % tabs.length]
        activeTabRef.current = next
        setActiveTab(next)
      } else if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed(c => !c)
      } else if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        setTerminalOpen(o => !o)
      } else if (e.ctrlKey && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault()
        setShortcutsOpen(o => !o)
      } else if (e.key === 'Escape' && shortcutsOpen) {
        setShortcutsOpen(false)
      } else if (e.ctrlKey && e.key === '1') {
        e.preventDefault()
        projectRef.current.setModel('claude-opus-4-6')
      } else if (e.ctrlKey && e.key === '2') {
        e.preventDefault()
        projectRef.current.setModel('claude-sonnet-4-6')
      } else if (e.ctrlKey && e.key === '3') {
        e.preventDefault()
        projectRef.current.setModel('claude-haiku-4-5-20251001')
      } else if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setFocusMode(f => !f)
      } else if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        if (activeTabRef.current === 'chat') {
          setChatSearchTrigger(n => n + 1)
        }
      } else if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(o => !o)
      } else if (e.ctrlKey && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const wsList = workspacesRef.current
        if (wsList.length <= 1) return
        const curId = activeWsIdRef.current
        const idx = wsList.findIndex(ws => ws.id === curId)
        const nextIdx = e.key === 'ArrowLeft'
          ? (idx - 1 + wsList.length) % wsList.length
          : (idx + 1) % wsList.length
        switchWorkspace(wsList[nextIdx].id)
      } else if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        handleToggleHQ()
      } else if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault()
        const wsList = workspacesRef.current
        if (wsList.length > 1) {
          closeWorkspace(activeWsIdRef.current)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chat.clearMessages, shortcutsOpen, handleToggleHQ])

  // ── Sidebar drag ──
  const handleSidebarDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsSidebarDragging(true)
    sidebarDragStartX.current = e.clientX
    sidebarDragStartW.current = sidebarWidth
  }
  useEffect(() => {
    if (!isSidebarDragging) return
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - sidebarDragStartX.current
      setSidebarWidth(Math.max(160, Math.min(500, sidebarDragStartW.current + delta)))
    }
    const onUp = () => {
      setIsSidebarDragging(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isSidebarDragging])

  // ── AgentBay resize drag ──
  useEffect(() => {
    if (!isAgentBayDragging) return
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - agentBayDragStartX.current
      setAgentBayWidth(Math.max(180, Math.min(480, agentBayDragStartW.current + delta)))
    }
    const onUp = () => setIsAgentBayDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isAgentBayDragging])

  // ── Splitter drag ──
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartH.current = bottomHeight
  }
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const delta = dragStartY.current - e.clientY
      setBottomHeight(Math.max(80, Math.min(600, dragStartH.current + delta)))
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDragging])

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

        {/* Sidebar resize handle — 사이드바 밖, 메인 영역 앞 */}
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
            {/* 경계선 */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: 2, width: 1,
              background: isSidebarDragging ? 'var(--accent)' : 'var(--border)',
              pointerEvents: 'none',
            }} />
            {/* 드래그 중 width 툴팁 */}
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
                        <ChatPanel chat={chat} project={project} focusTrigger={chatFocusTrigger} searchTrigger={chatSearchTrigger} scrollToMessageId={scrollToMessageId} onFork={handleFork} onEditResend={handleEditResend} onOpenFile={openFile} onImageClick={(src, alt) => setLightbox({ src, alt })} onCompressContext={handleCompressContext} pendingInsert={pendingInsert} onPendingInsertConsumed={() => setPendingInsert(undefined)} onTogglePin={(id) => chat.togglePin(id)} onReplyToMessage={handleReplyToMessage} suggestions={suggestions} onDismissSuggestions={() => setSuggestions([])} hqMode={hqMode} onToggleHQ={handleToggleHQ} />
                      </div>
                    </div>
                    <OpsFeed
                      toolUses={chat.messages.flatMap((m: any) => m.toolUses ?? []).slice(-10)}
                      isStreaming={chat.isStreaming}
                      onToolClick={(toolId) => console.log('tool clicked:', toolId)}
                    />
                  </div>
                ) : (
                  <ChatPanel chat={chat} project={project} focusTrigger={chatFocusTrigger} searchTrigger={chatSearchTrigger} scrollToMessageId={scrollToMessageId} onFork={handleFork} onEditResend={handleEditResend} onOpenFile={openFile} onImageClick={(src, alt) => setLightbox({ src, alt })} onCompressContext={handleCompressContext} pendingInsert={pendingInsert} onPendingInsertConsumed={() => setPendingInsert(undefined)} onTogglePin={(id) => chat.togglePin(id)} onReplyToMessage={handleReplyToMessage} suggestions={suggestions} onDismissSuggestions={() => setSuggestions([])} hqMode={hqMode} onToggleHQ={handleToggleHQ} />
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
                  />
                </div>
                {splitFilePath && activeTab === path && (
                  <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, position: 'relative', borderLeft: '1px solid var(--border)' }}>
                    <FileViewer
                      path={splitFilePath}
                      cwd={project.currentPath ?? undefined}
                      onClose={() => setSplitFilePath(null)}
                      onAskAI={(prompt) => { setActiveTab('chat'); setPendingInsert(prompt) }}
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
