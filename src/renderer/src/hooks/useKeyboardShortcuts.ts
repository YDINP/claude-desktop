/**
 * useKeyboardShortcuts — App-level keyboard shortcut handler
 * Extracted from App.tsx: the single useEffect that handles all Ctrl+* shortcuts.
 */
import { useEffect, useRef } from 'react'
import { useUIStore } from '../stores/ui-store'

interface KeyboardShortcutDeps {
  // sidebar
  setSidebarCollapsed: (updater: (c: boolean) => boolean) => void
  // terminal
  setTerminalOpen: (updater: (o: boolean) => boolean) => void
  // focus mode
  setFocusMode: (updater: (f: boolean) => boolean) => void
  // HQ
  handleToggleHQ: () => void
  // chat
  chatClearMessages: () => void
  switchToChat: (clearChanges?: boolean) => void
  setChatSearchTrigger: (updater: (n: number) => number) => void
  // workspace
  openTabs: string[]
  activeTabRef: React.MutableRefObject<string>
  setActiveTab: (tab: string) => void
  switchWorkspace: (id: string) => void
  closeWorkspace: (id: string) => void
  workspaces: Array<{ id: string; path: string }>
  activeWsId: string
  // project model
  setProjectModel: (model: string) => void
}

export function useKeyboardShortcuts(deps: KeyboardShortcutDeps): void {
  const {
    setSidebarCollapsed,
    setTerminalOpen,
    setFocusMode,
    handleToggleHQ,
    chatClearMessages, switchToChat, setChatSearchTrigger,
    openTabs, activeTabRef, setActiveTab,
    switchWorkspace, closeWorkspace, workspaces, activeWsId,
    setProjectModel,
  } = deps

  // UI overlay state from store (stable selectors — no re-render churn)
  const setPaletteOpen = useUIStore(s => s.setPaletteOpen)
  const setShortcutsOpen = useUIStore(s => s.setShortcutsOpen)
  const setSettingsOpen = useUIStore(s => s.setSettingsOpen)

  // Stable refs to avoid stale closures for frequently-read values
  const paletteOpenRef = useRef(useUIStore.getState().paletteOpen)
  const shortcutsOpenRef = useRef(useUIStore.getState().shortcutsOpen)
  // Subscribe to store changes outside React render cycle
  useEffect(() => useUIStore.subscribe(s => {
    paletteOpenRef.current = s.paletteOpen
    shortcutsOpenRef.current = s.shortcutsOpen
  }), [])

  const openTabsRef = useRef(openTabs)
  openTabsRef.current = openTabs

  const workspacesRef = useRef(workspaces)
  workspacesRef.current = workspaces

  const activeWsIdRef = useRef(activeWsId)
  activeWsIdRef.current = activeWsId

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      } else if (e.key === 'Escape' && paletteOpenRef.current) {
        setPaletteOpen(false)
      } else if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        chatClearMessages()
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
      } else if (e.key === '?' && !e.ctrlKey && !e.altKey) {
        const tag = (document.activeElement as HTMLElement)?.tagName
        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          setShortcutsOpen(o => !o)
        }
      } else if (e.key === 'Escape' && shortcutsOpenRef.current) {
        setShortcutsOpen(false)
      } else if (e.ctrlKey && e.key === '1') {
        e.preventDefault()
        setProjectModel('claude-opus-4-6')
      } else if (e.ctrlKey && e.key === '2') {
        e.preventDefault()
        setProjectModel('claude-sonnet-4-6')
      } else if (e.ctrlKey && e.key === '3') {
        e.preventDefault()
        setProjectModel('claude-haiku-4-5-20251001')
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
  }, [chatClearMessages, handleToggleHQ, setPaletteOpen, setShortcutsOpen, setSettingsOpen])
}
