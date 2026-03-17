import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatMessage } from '../domains/chat/domain'

// ── Types ────────────────────────────────────────────────────────────────────

type MainTab = string

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

export type { MainTab, Workspace, WorkspaceSnapshot }
export { EMPTY_SNAPSHOT }

// ── Dependencies ─────────────────────────────────────────────────────────────

interface WorkspaceManagerDeps {
  chatHydrate: (msgs: ChatMessage[], sessionId: string | null) => void
  chatClearMessages: () => void
  chatSetSessionId: (id: string | null) => void
  chatMessages: ChatMessage[]
  chatSessionId: string | null
  projectSetProject: (path: string) => void
  projectCurrentPath: string | null
}

// ── Return type ──────────────────────────────────────────────────────────────

export interface WorkspaceManager {
  workspaces: Workspace[]
  activeWsId: string
  workspaceNames: Record<string, string>
  openTabs: MainTab[]
  setOpenTabs: React.Dispatch<React.SetStateAction<MainTab[]>>
  activeTab: MainTab
  setActiveTab: React.Dispatch<React.SetStateAction<MainTab>>
  activeTabRef: React.MutableRefObject<MainTab>
  wsCCPort: number
  setWsCCPort: React.Dispatch<React.SetStateAction<number>>
  wsWebPreviewUrl: string
  setWsWebPreviewUrl: React.Dispatch<React.SetStateAction<string>>
  wsCCConnected: boolean
  setWsCCConnected: React.Dispatch<React.SetStateAction<boolean>>
  updateWorkspaceNames: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  handleOpenFolder: () => Promise<void>
  switchWorkspace: (id: string) => void
  closeWorkspace: (id: string) => void
  createOrSwitchWorkspace: (path: string, skipSave?: boolean) => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkspaceManager(deps: WorkspaceManagerDeps): WorkspaceManager {
  const {
    chatHydrate,
    chatMessages,
    chatSessionId,
    projectSetProject,
  } = deps

  // ── Workspace state ──
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWsId, setActiveWsId] = useState<string>('')
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('workspace-names') ?? '{}') } catch { return {} }
  })
  const updateWorkspaceNames = useCallback((updater: (prev: Record<string, string>) => Record<string, string>) => {
    setWorkspaceNames(prev => {
      const next = updater(prev)
      localStorage.setItem('workspace-names', JSON.stringify(next))
      return next
    })
  }, [])
  const wsStateRef = useRef<WorkspaceSnapshot>(EMPTY_SNAPSHOT)

  // ── File tabs (per workspace, stored in snapshot) ──
  const [openTabs, setOpenTabs] = useState<MainTab[]>(['chat'])
  const [activeTab, setActiveTab] = useState<MainTab>('chat')
  const activeTabRef = useRef<MainTab>('chat')

  // ── Per-workspace CC / Preview state ──
  const [wsCCPort, setWsCCPort] = useState<number>(9090)
  const [wsWebPreviewUrl, setWsWebPreviewUrl] = useState<string>('')
  const [wsCCConnected, setWsCCConnected] = useState(false)

  // ── CC connection tabs sync ──
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

  // ── Keep wsStateRef in sync for snapshot saving ──
  wsStateRef.current = {
    messages: chatMessages,
    sessionId: chatSessionId,
    openTabs,
    activeTab,
    ccPort: wsCCPort,
    webPreviewUrl: wsWebPreviewUrl,
  }

  // ── Workspace helpers ──

  const saveCurrentSnapshot = useCallback(() => {
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
  }, [activeWsId])

  const applySnapshot = useCallback((snap: WorkspaceSnapshot, path: string) => {
    chatHydrate(snap.messages, snap.sessionId)
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
    projectSetProject(path)
  }, [chatHydrate, projectSetProject])

  const createOrSwitchWorkspace = useCallback((path: string, skipSave = false) => {
    setWorkspaces(prevWorkspaces => {
      const existing = prevWorkspaces.find(ws => ws.path === path)
      if (existing) {
        // Switch to existing workspace
        if (!skipSave && activeWsId && activeWsId !== existing.id) {
          // Inline snapshot save for the current workspace
          const cur = wsStateRef.current
          const safeTabs = cur.openTabs.filter(t => t !== 'preview' && t !== 'scene')
          const safeActive: MainTab = cur.activeTab === 'scene' || cur.activeTab === 'preview'
            ? (safeTabs[0] ?? 'chat')
            : cur.activeTab
          const snap: WorkspaceSnapshot = { ...cur, openTabs: safeTabs, activeTab: safeActive, messages: [] }
          const updated = prevWorkspaces.map(ws => ws.id === activeWsId ? { ...ws, snapshot: snap } : ws)
          setActiveWsId(existing.id)
          applySnapshot(existing.snapshot, path)
          return updated
        }
        setActiveWsId(existing.id)
        applySnapshot(existing.snapshot, path)
        return prevWorkspaces
      } else {
        // Create new workspace
        if (!skipSave && activeWsId) {
          const cur = wsStateRef.current
          const safeTabs = cur.openTabs.filter(t => t !== 'preview' && t !== 'scene')
          const safeActive: MainTab = cur.activeTab === 'scene' || cur.activeTab === 'preview'
            ? (safeTabs[0] ?? 'chat')
            : cur.activeTab
          const snap: WorkspaceSnapshot = { ...cur, openTabs: safeTabs, activeTab: safeActive, messages: [] }
          const updated = prevWorkspaces.map(ws => ws.id === activeWsId ? { ...ws, snapshot: snap } : ws)
          const id = `ws-${Date.now()}`
          const newSnap = { ...EMPTY_SNAPSHOT }
          setActiveWsId(id)
          applySnapshot(newSnap, path)
          return [...updated, { id, path, snapshot: newSnap }]
        }
        const id = `ws-${Date.now()}`
        const newSnap = { ...EMPTY_SNAPSHOT }
        setActiveWsId(id)
        applySnapshot(newSnap, path)
        return [...prevWorkspaces, { id, path, snapshot: newSnap }]
      }
    })
  }, [activeWsId, applySnapshot])

  const handleOpenFolder = useCallback(async () => {
    const path = await window.api?.openFolder()
    if (!path) return
    createOrSwitchWorkspace(path)
  }, [createOrSwitchWorkspace])

  const switchWorkspace = useCallback((id: string) => {
    if (id === activeWsId) return
    saveCurrentSnapshot()
    setWorkspaces(prevWorkspaces => {
      const target = prevWorkspaces.find(ws => ws.id === id)
      if (!target) return prevWorkspaces
      setActiveWsId(id)
      applySnapshot(target.snapshot, target.path)
      return prevWorkspaces
    })
  }, [activeWsId, saveCurrentSnapshot, applySnapshot])

  const closeWorkspace = useCallback((id: string) => {
    setWorkspaces(prev => {
      const next = prev.filter(ws => ws.id !== id)
      if (activeWsId === id && next.length > 0) {
        const fallback = next[next.length - 1]
        setActiveWsId(fallback.id)
        applySnapshot(fallback.snapshot, fallback.path)
      }
      return next
    })
  }, [activeWsId, applySnapshot])

  // ── Init: restore all saved workspaces ──
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
      const newWorkspaces: Workspace[] = saved.map((ws: { path: string; openTabs: string[]; activeTab: string }, i: number) => ({
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
      projectSetProject(targetWs.path)
      // Apply the active workspace's saved tabs
      setOpenTabs(targetWs.snapshot.openTabs)
      activeTabRef.current = targetWs.snapshot.activeTab
      setActiveTab(targetWs.snapshot.activeTab)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return {
    workspaces,
    activeWsId,
    workspaceNames,
    openTabs,
    setOpenTabs,
    activeTab,
    setActiveTab,
    activeTabRef,
    wsCCPort,
    setWsCCPort,
    wsWebPreviewUrl,
    setWsWebPreviewUrl,
    wsCCConnected,
    setWsCCConnected,
    updateWorkspaceNames,
    handleOpenFolder,
    switchWorkspace,
    closeWorkspace,
    createOrSwitchWorkspace,
  }
}
