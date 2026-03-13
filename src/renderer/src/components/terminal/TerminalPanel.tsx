import { useEffect, useRef, useState, useCallback, DragEvent, ChangeEvent } from 'react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { setActiveTerminalId } from '../../stores/terminal-store'
import { recordCommand, getTopCommands } from '../../utils/command-learner'

const QUICK_CMDS_KEY = 'terminalQuickCmds'
const TAB_COLORS_KEY = 'terminal-tab-colors'
const CMD_BOOKMARKS_KEY = 'cmd-bookmarks'
const OUTPUT_THEME_KEY = 'terminal-output-theme'

type OutputTheme = 'default' | 'solarized' | 'monokai'

const OUTPUT_THEME_OPTIONS: { label: string; value: OutputTheme }[] = [
  { label: '기본', value: 'default' },
  { label: 'Solarized', value: 'solarized' },
  { label: 'Monokai', value: 'monokai' },
]

const OUTPUT_THEME_STYLES: Record<OutputTheme, { background: string; color: string }> = {
  default: { background: '#1a1a1a', color: '#d4d4d4' },
  solarized: { background: '#002b36', color: '#839496' },
  monokai: { background: '#272822', color: '#f8f8f2' },
}

const loadCmdBookmarks = (): string[] => {
  try { return JSON.parse(localStorage.getItem(CMD_BOOKMARKS_KEY) ?? 'null') ?? [] }
  catch { return [] }
}

const saveCmdBookmarks = (bookmarks: string[]) => {
  localStorage.setItem(CMD_BOOKMARKS_KEY, JSON.stringify(bookmarks))
}

const TAB_COLOR_OPTIONS = [
  { label: '기본', value: '' },
  { label: '빨강', value: '#f44336' },
  { label: '초록', value: '#4ec9b0' },
  { label: '파랑', value: '#569cd6' },
  { label: '노랑', value: '#dcdcaa' },
]

const loadTabColors = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(TAB_COLORS_KEY) ?? 'null') ?? {} }
  catch { return {} }
}

const saveTabColors = (colors: Record<string, string>) => {
  localStorage.setItem(TAB_COLORS_KEY, JSON.stringify(colors))
}
const defaultCmds = [
  { id: '1', label: 'ls', cmd: 'ls -la\n' },
  { id: '2', label: 'git status', cmd: 'git status\n' },
  { id: '3', label: 'git log', cmd: 'git log --oneline -10\n' },
]

interface QuickCmd { id: string; label: string; cmd: string }

const loadQuickCmds = (): QuickCmd[] => {
  try { return JSON.parse(localStorage.getItem(QUICK_CMDS_KEY) ?? 'null') ?? defaultCmds }
  catch { return defaultCmds }
}

const saveQuickCmds = (cmds: QuickCmd[]) => {
  localStorage.setItem(QUICK_CMDS_KEY, JSON.stringify(cmds))
}

interface TerminalPanelProps {
  cwd: string
  available?: boolean
  onAskAI?: (text: string) => void
}

interface TabInfo {
  id: string
  title: string
}

interface TermInstance {
  term: Terminal
  fitAddon: FitAddon
  observer: ResizeObserver
}

const TERMINAL_THEMES: Record<string, ITheme> = {
  dark: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4' },
  light: { background: '#ffffff', foreground: '#333333', cursor: '#333333' },
  monokai: { background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f2', green: '#a6e22e', red: '#f92672', yellow: '#e6db74' },
  solarized: { background: '#002b36', foreground: '#839496', cursor: '#839496', blue: '#268bd2', green: '#859900' },
  dracula: { background: '#282a36', foreground: '#f8f8f2', cursor: '#f1fa8c', green: '#50fa7b', red: '#ff5555', yellow: '#f1fa8c' },
}

let termIdCounter = 0

function makeTab(): TabInfo {
  const n = ++termIdCounter
  return { id: `term-${n}`, title: 'cmd' }
}

const TERM_THEME = {
  background: '#1a1a1a',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
  black: '#1e1e1e', red: '#f44747',
  green: '#4ec9b0', yellow: '#dcdcaa',
  blue: '#569cd6', magenta: '#c586c0',
  cyan: '#4fc1ff', white: '#d4d4d4',
}

const ERROR_PATTERNS = [
  /TypeError:/,
  /ReferenceError:/,
  /SyntaxError:/,
  /Error: Cannot find module/,
  /Build failed/i,
  /ENOENT/,
  /EACCES/,
  /npm ERR/,
  /FAILED/,
  /exit code [^0]/i,
]

const isErrorLine = (line: string): boolean => ERROR_PATTERNS.some(p => p.test(line))

const AUTO_ANALYZE_KEY = 'terminal-auto-analyze'

const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*[mGKHF]/g, '')

export function TerminalPanel({ cwd, available = true, onAskAI }: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TabInfo[]>(() => [makeTab()])
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const initial = tabs[0].id
    setActiveTerminalId(initial)
    return initial
  })
  const instancesRef = useRef<Map<string, TermInstance>>(new Map())
  const containerRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const searchAddonsRef = useRef<Record<string, SearchAddon>>({})
  const terminalThemeRef = useRef<string>('dark')

  // Feature 2: tab rename state
  const [tabNames, setTabNames] = useState<Record<string, string>>({})
  const [renamingTab, setRenamingTab] = useState<string | null>(null)

  // R722: command stats
  const [cmdStats, setCmdStats] = useState<Record<string, number>>({})
  const [showCmdStats, setShowCmdStats] = useState(false)

  // R728: auto reconnect
  const [autoReconnect, setAutoReconnect] = useState(true)
  const [reconnectCount, setReconnectCount] = useState<Record<string, number>>({})

  // R740: tab sharing
  const [sharedTabs, setSharedTabs] = useState<Set<string>>(new Set())
  const [shareCode, setShareCode] = useState<string | null>(null)

  // R749: command aliases
  const [cmdAliases, setCmdAliases] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('cmd-aliases') ?? '{}'))
  const [showAliasEditor, setShowAliasEditor] = useState(false)

  // R755: captured env vars viewer
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [showEnvVars, setShowEnvVars] = useState(false)

  // R761: per-tab process info
  const [processInfo, setProcessInfo] = useState<Record<string, { pid: number; cpu: number; mem: number }>>({})
  const [showProcessInfo, setShowProcessInfo] = useState(false)
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({})
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
  // R778: terminal color theme
  const [colorTheme, setColorTheme] = useState<'dark' | 'light' | 'solarized' | 'monokai'>('dark')
  const [customColors, setCustomColors] = useState<Record<string, string>>({})
  // R785: session recording
  const [isRecordingSession, setIsRecordingSession] = useState(false)
  const [recordedFrames, setRecordedFrames] = useState<string[]>([])

  // Tab color state
  const [tabColors, setTabColors] = useState<Record<string, string>>(loadTabColors)
  const [tabColorMenuOpen, setTabColorMenuOpen] = useState<string | null>(null)

  // Drag & drop reorder state
  const dragTabRef = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Terminal theme state
  const [terminalTheme, setTerminalTheme] = useState<string>('dark')
  useEffect(() => {
    if (window.api?.getTerminalTheme) {
      window.api.getTerminalTheme().then(t => { setTerminalTheme(t); terminalThemeRef.current = t })
    }
  }, [])
  useEffect(() => { terminalThemeRef.current = terminalTheme }, [terminalTheme])

  // Quick commands state
  const [quickCmds, setQuickCmds] = useState<QuickCmd[]>(loadQuickCmds)
  const [editingCmds, setEditingCmds] = useState(false)
  // Learned commands state
  const [learnedCmds, setLearnedCmds] = useState<string[]>([])
  const inputBufferRef = useRef<Record<string, string>>({})

  const sendQuickCmd = (cmd: string) => {
    window.api?.terminalWrite(activeTabId, cmd)
  }

  const updateCmd = (index: number, field: keyof QuickCmd, value: string) => {
    setQuickCmds(prev => {
      const next = prev.map((qc, i) => i === index ? { ...qc, [field]: value } : qc)
      saveQuickCmds(next)
      return next
    })
  }

  const deleteCmd = (index: number) => {
    setQuickCmds(prev => {
      const next = prev.filter((_, i) => i !== index)
      saveQuickCmds(next)
      return next
    })
  }

  const addCmd = () => {
    if (quickCmds.length >= 8) return
    setQuickCmds(prev => {
      const next = [...prev, { id: Date.now().toString(), label: '', cmd: '' }]
      saveQuickCmds(next)
      return next
    })
  }

  // Bookmark state
  const [cmdBookmarks, setCmdBookmarks] = useState<string[]>(loadCmdBookmarks)
  const [cmdBookmarkOpen, setCmdBookmarkOpen] = useState(false)

  const bookmarkCmd = () => {
    const current = (inputBufferRef.current[activeTabId] ?? '').trim()
    if (!current) return
    setCmdBookmarks(prev => {
      if (prev.includes(current)) return prev
      const next = [current, ...prev].slice(0, 10)
      saveCmdBookmarks(next)
      return next
    })
  }

  const removeBookmark = (cmd: string) => {
    setCmdBookmarks(prev => {
      const next = prev.filter(c => c !== cmd)
      saveCmdBookmarks(next)
      return next
    })
  }

  // AI error detection state (per-tab)
  const [errorBanners, setErrorBanners] = useState<Record<string, boolean>>({})
  const outputBufferRef = useRef<Record<string, string[]>>({})
  const errorLineIdxRef = useRef<Record<string, number>>({})
  const errorTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Output theme state
  const [outputTheme, setOutputTheme] = useState<OutputTheme>(
    () => (localStorage.getItem(OUTPUT_THEME_KEY) as OutputTheme) ?? 'default'
  )
  const [outputThemeOpen, setOutputThemeOpen] = useState(false)

  // Auto-analyze toggle
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(
    () => localStorage.getItem(AUTO_ANALYZE_KEY) === 'true'
  )
  const autoAnalyzeRef = useRef(autoAnalyze)
  useEffect(() => {
    autoAnalyzeRef.current = autoAnalyze
    localStorage.setItem(AUTO_ANALYZE_KEY, autoAnalyze ? 'true' : 'false')
  }, [autoAnalyze])

  const buildErrorContext = (tabId: string): string => {
    const buf = outputBufferRef.current[tabId] ?? []
    const errIdx = errorLineIdxRef.current[tabId] ?? buf.length - 1
    const start = Math.max(0, errIdx - 10)
    const end = Math.min(buf.length, errIdx + 11)
    return buf.slice(start, end).join('\n')
  }

  const sendErrorToAI = (tabId: string) => {
    const context = buildErrorContext(tabId)
    const prompt = `터미널 에러가 발생했습니다:\n\`\`\`\n${context}\n\`\`\`\n\n작업 디렉토리: ${cwd}`
    onAskAI?.(prompt)
    setErrorBanners(prev => ({ ...prev, [tabId]: false }))
  }

  const handleAskClaude = () => {
    sendErrorToAI(activeTabId)
  }

  // Recording state
  const [recording, setRecording] = useState(false)
  const recordingRef = useRef(false)
  const recordBufferRef = useRef<string[]>([])
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (!recording) { setBlink(false); return }
    const interval = setInterval(() => setBlink(b => !b), 500)
    return () => clearInterval(interval)
  }, [recording])

  const toggleRecording = async () => {
    if (recording) {
      setRecording(false)
      recordingRef.current = false
      const content = recordBufferRef.current.join('\n')
      recordBufferRef.current = []
      if (content.trim()) {
        const filePath = await window.api.showSaveDialog({
          defaultPath: `terminal-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`,
          filters: [{ name: 'Text', extensions: ['txt'] }],
        })
        if (filePath) await window.api.writeTextFile(filePath, content)
      }
    } else {
      recordBufferRef.current = []
      recordingRef.current = true
      setRecording(true)
    }
  }

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Split layout state
  const [splitLayout, setSplitLayout] = useState<'single' | 'horizontal' | 'vertical'>('single')
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [splitTabId, setSplitTabId] = useState<string | null>(null)

  // Filter state
  const [termFilter, setTermFilter] = useState('')
  const [filterRegex, setFilterRegex] = useState(false)
  const [filterCaseSensitive, setFilterCaseSensitive] = useState(false)
  const [showTermFilter, setShowTermFilter] = useState(false)
  const [termSearchMatches, setTermSearchMatches] = useState<number[]>([])
  const [termSearchIdx, setTermSearchIdx] = useState(0)
  const filterInputRef = useRef<HTMLInputElement>(null)

  // Initialize learned commands on mount
  useEffect(() => {
    setLearnedCmds(getTopCommands(3).filter(c => !quickCmds.some(q => q.cmd.trim() === c)))
  }, [])

  // Sync active terminal ID to shared store so ChatPanel can write to it
  useEffect(() => {
    setActiveTerminalId(activeTabId)
  }, [activeTabId])

  // Single shared listener: routes data to the correct terminal instance by id
  useEffect(() => {
    if (!available || !window.api) return
    const removeListener = window.api.onTerminalData((id: string, data: string) => {
      instancesRef.current.get(id)?.term.write(data)
      if (recordingRef.current && id === activeTabId) {
        const ts = new Date().toISOString()
        recordBufferRef.current.push(`[${ts}] ${data}`)
      }
      // Output buffer capture + error detection (per-tab)
      const clean = stripAnsi(data)
      const lines = clean.split(/\r?\n/).filter(l => l.length > 0)
      const buf = outputBufferRef.current[id] ?? []
      const newBuf = [...buf, ...lines]
      const trimmed = newBuf.length > 200 ? newBuf.slice(-200) : newBuf
      outputBufferRef.current[id] = trimmed
      const errorRelIdx = lines.findIndex(l => isErrorLine(l))
      if (errorRelIdx !== -1) {
        const absIdx = trimmed.length - lines.length + errorRelIdx
        errorLineIdxRef.current[id] = Math.max(0, absIdx)
        setErrorBanners(prev => ({ ...prev, [id]: true }))
        if (errorTimerRef.current[id]) clearTimeout(errorTimerRef.current[id])
        errorTimerRef.current[id] = setTimeout(() => {
          setErrorBanners(prev => ({ ...prev, [id]: false }))
        }, 8000)
        if (autoAnalyzeRef.current) {
          // slight delay so buffer is fully written
          setTimeout(() => sendErrorToAI(id), 100)
        }
      }
    })
    return removeListener
  }, [available, activeTabId])

  const initTab = useCallback((id: string) => {
    if (!available || !window.api) return
    const el = containerRefs.current.get(id)
    if (!el || instancesRef.current.has(id)) return

    const term = new Terminal({
      theme: TERMINAL_THEMES[terminalThemeRef.current] ?? TERMINAL_THEMES.dark,
      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    const searchAddon = new SearchAddon()
    term.loadAddon(searchAddon)
    searchAddonsRef.current[id] = searchAddon

    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && !e.shiftKey && e.key === 'f') {
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
        return false
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        setShowTermFilter(prev => !prev)
        setTimeout(() => filterInputRef.current?.focus(), 50)
        return false
      }
      return true
    })

    term.open(el)
    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch { /* not yet visible */ }
    })

    term.onData((data) => {
      window.api.terminalWrite(id, data)
      // Command learning
      if (data === '\r') {
        const cmd = inputBufferRef.current[id] ?? ''
        if (cmd.trim()) {
          recordCommand(cmd.trim())
          setLearnedCmds(getTopCommands(3).filter(c => !quickCmds.some(q => q.cmd.trim() === c)))
        }
        inputBufferRef.current[id] = ''
      } else if (data === '\x7f') { // backspace
        inputBufferRef.current[id] = (inputBufferRef.current[id] ?? '').slice(0, -1)
      } else if (data.charCodeAt(0) >= 32) { // printable
        inputBufferRef.current[id] = (inputBufferRef.current[id] ?? '') + data
      }
    })
    window.api.terminalCreate(id, cwd)

    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        window.api.terminalResize(id, term.cols, term.rows)
      } catch { /* not yet visible */ }
    })
    observer.observe(el)

    instancesRef.current.set(id, { term, fitAddon, observer })
  }, [available, cwd])

  const destroyTab = useCallback((id: string) => {
    const inst = instancesRef.current.get(id)
    if (!inst) return
    inst.observer.disconnect()
    window.api?.terminalClose(id)
    inst.term.dispose()
    instancesRef.current.delete(id)
    delete searchAddonsRef.current[id]
  }, [])

  // Init active tab when its container div mounts
  const setContainerRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    containerRefs.current.set(id, el)
    if (el) initTab(id)
  }, [initTab])

  // When active tab changes, fit the terminal
  useEffect(() => {
    const inst = instancesRef.current.get(activeTabId)
    if (inst) {
      requestAnimationFrame(() => {
        try {
          inst.fitAddon.fit()
          window.api?.terminalResize(activeTabId, inst.term.cols, inst.term.rows)
        } catch { /* not yet visible */ }
      })
    }
  }, [activeTabId])

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const id of instancesRef.current.keys()) destroyTab(id)
    }
  }, [destroyTab])

  const addTab = () => {
    if (tabs.length >= 5) return
    const tab = makeTab()
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return
    destroyTab(id)
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeTabId === id) {
        const idx = prev.findIndex(t => t.id === id)
        const fallback = next[Math.max(0, idx - 1)]
        setActiveTabId(fallback.id)
      }
      return next
    })
  }

  // Feature 1: clear terminal
  const clearTerminal = (id: string) => {
    const inst = instancesRef.current.get(id)
    if (inst) inst.term.clear()
  }

  // Feature 3: save terminal history
  const saveTerminalHistory = async (id: string, label: string) => {
    const inst = instancesRef.current.get(id)
    if (!inst) return

    const buffer = inst.term.buffer.active
    const lines: string[] = []
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i)
      if (line) lines.push(line.translateToString(true))
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop()
    }
    const text = lines.join('\n')

    const filePath = await window.api.showSaveDialog({
      defaultPath: `terminal-${label}.txt`,
      filters: [{ name: 'Text', extensions: ['txt'] }],
    })
    if (!filePath) return
    await window.api.writeTextFile(filePath, text)
  }

  // Theme change handler
  const handleThemeChange = (newTheme: string) => {
    setTerminalTheme(newTheme)
    for (const inst of instancesRef.current.values()) {
      inst.term.options.theme = TERMINAL_THEMES[newTheme] ?? TERMINAL_THEMES.dark
    }
    window.api?.setTerminalTheme(newTheme)
  }

  // Helper: get display label for a tab
  const getTabLabel = (tab: TabInfo, index: number): string => {
    return tabNames[tab.id] ?? tab.title ?? `Terminal ${index + 1}`
  }

  if (!available) {
    return (
      <div style={{
        height: '100%',
        background: '#1a1a1a',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '4px 8px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          Terminal (unavailable — install Visual Studio Build Tools)
        </div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 12, flexDirection: 'column', gap: 8,
        }}>
          <div>Terminal requires Visual Studio Build Tools</div>
          <code style={{ color: 'var(--accent)', fontSize: 11 }}>
            npm install -g windows-build-tools
          </code>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      background: '#1a1a1a',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Tab bar */}
      <div
        onClick={() => { setTabColorMenuOpen(null); setCmdBookmarkOpen(false); setOutputThemeOpen(false) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {tabs.map((tab, i) => (
          <div
            key={tab.id}
            draggable
            onClick={() => setActiveTabId(tab.id)}
            onDragStart={(e: DragEvent<HTMLDivElement>) => {
              dragTabRef.current = i
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOverIdx(i)
            }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault()
              if (dragTabRef.current === null || dragTabRef.current === i) {
                setDragOverIdx(null)
                return
              }
              const fromIdx = dragTabRef.current
              const toIdx = i
              setTabs(prev => {
                const next = [...prev]
                const [moved] = next.splice(fromIdx, 1)
                next.splice(toIdx, 0, moved)
                return next
              })
              dragTabRef.current = null
              setDragOverIdx(null)
            }}
            onDragEnd={() => {
              dragTabRef.current = null
              setDragOverIdx(null)
            }}
            onContextMenu={e => {
              e.preventDefault()
              e.stopPropagation()
              setTabColorMenuOpen(prev => prev === tab.id ? null : tab.id)
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'grab',
              color: tab.id === activeTabId ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: tab.id === activeTabId ? '2px solid var(--accent)' : '2px solid transparent',
              borderLeft: dragOverIdx === i && dragTabRef.current !== i ? '2px solid var(--accent)' : '2px solid transparent',
              background: tab.id === activeTabId ? 'var(--bg-tertiary)' : 'transparent',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            {/* Tab color dot */}
            {tabColors[tab.id] && (
              <span style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: tabColors[tab.id],
                flexShrink: 0,
              }} />
            )}

            {/* Feature 2: rename on double-click */}
            {renamingTab === tab.id ? (
              <input
                autoFocus
                defaultValue={getTabLabel(tab, i)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim()
                    setTabNames(prev => ({ ...prev, [tab.id]: val || getTabLabel(tab, i) }))
                    setRenamingTab(null)
                  }
                  if (e.key === 'Escape') setRenamingTab(null)
                }}
                onBlur={e => {
                  const val = e.target.value.trim()
                  setTabNames(prev => ({ ...prev, [tab.id]: val || getTabLabel(tab, i) }))
                  setRenamingTab(null)
                }}
                style={{
                  background: 'var(--bg-input, #2a2a2a)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--accent)',
                  borderRadius: 2,
                  padding: '0 4px',
                  fontSize: 11,
                  width: 80,
                  outline: 'none',
                }}
              />
            ) : (
              <span onDoubleClick={e => { e.stopPropagation(); setRenamingTab(tab.id) }}>
                {getTabLabel(tab, i)}
              </span>
            )}

            {/* Feature 3: save history button */}
            <span
              onClick={e => { e.stopPropagation(); saveTerminalHistory(tab.id, getTabLabel(tab, i)) }}
              title="터미널 히스토리 저장"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                padding: '1px 2px',
                lineHeight: 1,
                opacity: 0.6,
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.6' }}
            >
              &#128190;
            </span>

            {/* Feature 1: clear button */}
            <span
              onClick={e => { e.stopPropagation(); clearTerminal(tab.id) }}
              title="터미널 지우기"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                padding: '1px 2px',
                lineHeight: 1,
                opacity: 0.6,
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.6' }}
            >
              ⌫
            </span>

            {tabs.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                style={{
                  marginLeft: 2,
                  lineHeight: 1,
                  opacity: 0.6,
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.6' }}
              >
                ×
              </span>
            )}

            {/* Tab color context menu */}
            {tabColorMenuOpen === tab.id && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 200,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  padding: '4px 0',
                  minWidth: 100,
                }}
              >
                {TAB_COLOR_OPTIONS.map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      setTabColors(prev => {
                        const next = { ...prev }
                        if (opt.value) next[tab.id] = opt.value
                        else delete next[tab.id]
                        saveTabColors(next)
                        return next
                      })
                      setTabColorMenuOpen(null)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: opt.value || 'transparent',
                      border: opt.value ? 'none' : '1px solid var(--border)',
                      flexShrink: 0,
                    }} />
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {tabs.length < 5 && (
          <div
            onClick={addTab}
            title="New terminal"
            style={{
              padding: '4px 8px',
              fontSize: 14,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              userSelect: 'none',
              lineHeight: 1,
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)' }}
          >
            +
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 6 }}>
          {/* Split layout buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {([
              { value: 'single', icon: '☐', title: '단일 터미널' },
              { value: 'horizontal', icon: '⬚', title: '수평 분할 (좌우)' },
              { value: 'vertical', icon: '⬓', title: '수직 분할 (위아래)' },
            ] as const).map(({ value, icon, title }) => (
              <span
                key={value}
                title={title}
                onClick={() => {
                  setSplitLayout(value)
                  if (value !== 'single' && !splitTabId) {
                    const other = tabs.find(t => t.id !== activeTabId)
                    setSplitTabId(other?.id ?? activeTabId)
                  }
                  if (value === 'single') setSplitTabId(null)
                }}
                style={{
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: '1px 4px',
                  borderRadius: 3,
                  border: splitLayout === value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: splitLayout === value ? 'var(--accent)' : 'var(--text-muted)',
                  userSelect: 'none',
                  lineHeight: 1,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = splitLayout === value ? 'var(--accent)' : 'var(--border)' }}
              >
                {icon}
              </span>
            ))}
          </div>
          {/* Filter button */}
          <span
            onClick={() => { setShowTermFilter(prev => !prev); setTimeout(() => filterInputRef.current?.focus(), 50) }}
            title="출력 필터 (Ctrl+Shift+F)"
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              cursor: 'pointer', fontSize: 11, padding: '1px 5px',
              borderRadius: 4,
              border: showTermFilter ? '1px solid var(--accent)' : '1px solid var(--border)',
              color: showTermFilter ? 'var(--accent)' : 'var(--text-muted)',
              background: 'none', userSelect: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = showTermFilter ? 'var(--accent)' : 'var(--border)' }}
          >
            &#128269; 필터
          </span>
          {/* Recording button */}
          <span
            onClick={toggleRecording}
            title={recording ? '녹화 중지 및 저장' : '터미널 출력 녹화 시작'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              cursor: 'pointer',
              fontSize: 11,
              padding: '1px 5px',
              borderRadius: 4,
              border: recording ? '1px solid #f44336' : '1px solid var(--border)',
              color: recording ? '#f44336' : 'var(--text-muted)',
              background: 'none',
              userSelect: 'none',
              opacity: blink ? 0.6 : 1,
              transition: 'opacity 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = recording ? '#f44336' : 'var(--text-muted)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = recording ? '#f44336' : 'var(--border)' }}
          >
            {recording ? '⏹' : '🔴'} {recording ? '녹화중' : '녹화'}
          </span>
          <select
            value={terminalTheme}
            onChange={e => handleThemeChange(e.target.value)}
            title="터미널 테마"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 10,
              padding: '1px 4px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {Object.keys(TERMINAL_THEMES).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {/* Output theme dropdown */}
          <div style={{ position: 'relative' }}>
            <span
              onClick={e => { e.stopPropagation(); setOutputThemeOpen(prev => !prev) }}
              title="출력 색상 테마"
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                cursor: 'pointer', fontSize: 11, padding: '1px 5px',
                borderRadius: 4,
                border: outputThemeOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: outputThemeOpen ? 'var(--accent)' : 'var(--text-muted)',
                background: 'none', userSelect: 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = outputThemeOpen ? 'var(--accent)' : 'var(--border)' }}
            >
              &#127912; {outputTheme}
            </span>
            {outputThemeOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  zIndex: 200,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  padding: '4px 0',
                  minWidth: 130,
                  marginTop: 2,
                }}
              >
                {OUTPUT_THEME_OPTIONS.map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      setOutputTheme(opt.value)
                      localStorage.setItem(OUTPUT_THEME_KEY, opt.value)
                      setOutputThemeOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: opt.value === outputTheme ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: opt.value === outputTheme ? 600 : 400,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: OUTPUT_THEME_STYLES[opt.value].background,
                      border: '1px solid var(--border)',
                      flexShrink: 0,
                    }} />
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick commands bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexWrap: 'wrap', flexShrink: 0 }}>
        {learnedCmds.map(cmd => (
          <button
            key={cmd}
            onClick={() => sendQuickCmd(cmd + '\n')}
            title={`자주 사용: ${cmd}`}
            style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11,
              background: 'rgba(82,139,255,0.1)', border: '1px solid rgba(82,139,255,0.3)',
              cursor: 'pointer', color: 'var(--accent)', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(82,139,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(82,139,255,0.3)')}
          >
            ★ {cmd.length > 20 ? cmd.slice(0, 20) + '…' : cmd}
          </button>
        ))}
        {quickCmds.map(qc => (
          <button
            key={qc.id}
            onClick={() => sendQuickCmd(qc.cmd)}
            title={qc.cmd}
            style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            {qc.label || qc.cmd}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
          {/* Bookmark add button */}
          <button
            onClick={bookmarkCmd}
            onContextMenu={e => { e.preventDefault(); setCmdBookmarkOpen(prev => !prev) }}
            title="현재 입력 명령어 즐겨찾기 추가 (우클릭: 목록)"
            style={{ padding: '2px 6px', fontSize: 13, background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
          >
            ★
          </button>
          {/* Bookmark dropdown */}
          {cmdBookmarkOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 200,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                minWidth: 200,
                maxHeight: 260,
                overflowY: 'auto',
                marginTop: 2,
              }}
            >
              <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>즐겨찾기 ({cmdBookmarks.length}/10)</span>
                <button onClick={() => setCmdBookmarkOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
              </div>
              {cmdBookmarks.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>즐겨찾기 없음</div>
              ) : (
                cmdBookmarks.map((cmd, idx) => (
                  <div
                    key={idx}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span
                      onClick={() => { sendQuickCmd(cmd + '\n'); setCmdBookmarkOpen(false) }}
                      title={cmd}
                      style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {cmd.length > 30 ? cmd.slice(0, 30) + '…' : cmd}
                    </span>
                    <button
                      onClick={() => removeBookmark(cmd)}
                      style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0 }}
                    >×</button>
                  </div>
                ))
              )}
            </div>
          )}
          <button
            onClick={() => setEditingCmds(e => !e)}
            title="빠른 명령어 편집"
            style={{ padding: '2px 6px', fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            &#9881;
          </button>
        </div>
      </div>

      {/* Quick commands edit panel */}
      {editingCmds && (
        <div style={{ padding: 8, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12, flexShrink: 0 }}>
          {quickCmds.map((qc, i) => (
            <div key={qc.id} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <input
                value={qc.label}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateCmd(i, 'label', e.target.value)}
                placeholder="레이블"
                style={{ width: 80, padding: '2px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 3, color: 'inherit', fontSize: 11 }}
              />
              <input
                value={qc.cmd}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateCmd(i, 'cmd', e.target.value)}
                placeholder="명령어"
                style={{ flex: 1, padding: '2px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 3, color: 'inherit', fontSize: 11 }}
              />
              <button onClick={() => deleteCmd(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f44336' }}>×</button>
            </div>
          ))}
          {quickCmds.length < 8 && (
            <button onClick={addCmd} style={{ fontSize: 11, background: 'none', border: '1px dashed var(--border)', borderRadius: 3, cursor: 'pointer', padding: '2px 8px', color: 'var(--text-muted)' }}>+ 추가</button>
          )}
        </div>
      )}

      {/* Filter bar */}
      {showTermFilter && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)', flexShrink: 0,
        }}>
          <input
            ref={filterInputRef}
            value={termFilter}
            onChange={e => setTermFilter(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setShowTermFilter(false); setTermFilter('') } }}
            placeholder="출력 필터 키워드..."
            style={{
              flex: 1, padding: '3px 8px', fontSize: 12,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4, outline: 'none',
            }}
          />
          {termFilter && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {(outputBufferRef.current[activeTabId] ?? []).filter(l => l.includes(termFilter)).length} 줄 매칭
            </span>
          )}
          <button
            onClick={() => { setShowTermFilter(false); setTermFilter('') }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
          >×</button>
        </div>
      )}

      {/* Terminal containers */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {splitLayout !== 'single' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: splitLayout === 'horizontal' ? 'row' : 'column',
          }}>
            {/* Primary pane */}
            <div style={{ position: 'relative', flex: `0 0 ${splitRatio * 100}%`, overflow: 'hidden' }}>
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  ref={setContainerRef(tab.id)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: 4,
                    display: tab.id === activeTabId ? 'block' : 'none',
                  }}
                />
              ))}
            </div>
            {/* Splitter handle */}
            <div
              title="드래그하여 비율 조정"
              onMouseDown={e => {
                e.preventDefault()
                const container = (e.currentTarget as HTMLElement).parentElement
                if (!container) return
                const rect = container.getBoundingClientRect()
                const totalSize = splitLayout === 'horizontal' ? rect.width : rect.height
                const onMove = (me: MouseEvent) => {
                  const pos = splitLayout === 'horizontal' ? me.clientX - rect.left : me.clientY - rect.top
                  setSplitRatio(Math.min(0.85, Math.max(0.15, pos / totalSize)))
                }
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
              style={{
                flexShrink: 0,
                background: 'var(--border)',
                cursor: splitLayout === 'horizontal' ? 'col-resize' : 'row-resize',
                width: splitLayout === 'horizontal' ? 4 : '100%',
                height: splitLayout === 'vertical' ? 4 : '100%',
                zIndex: 10,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)' }}
            />
            {/* Secondary pane */}
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
              {tabs.map(tab => (
                <div
                  key={`secondary-${tab.id}`}
                  ref={setContainerRef(`secondary-${tab.id}`)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: 4,
                    display: tab.id === splitTabId ? 'block' : 'none',
                  }}
                />
              ))}
              {/* Secondary pane tab selector */}
              <div style={{ position: 'absolute', top: 2, right: 4, zIndex: 20, display: 'flex', gap: 2 }}>
                {tabs.map(tab => (
                  <span
                    key={tab.id}
                    onClick={() => setSplitTabId(tab.id)}
                    title={tabNames[tab.id] ?? tab.title}
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 3,
                      cursor: 'pointer',
                      background: tab.id === splitTabId ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: tab.id === splitTabId ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      userSelect: 'none',
                    }}
                  >
                    {tabNames[tab.id] ?? tab.title}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        {splitLayout === 'single' && tabs.map(tab => (
          <div
            key={tab.id}
            ref={setContainerRef(tab.id)}
            style={{
              position: 'absolute',
              inset: 0,
              padding: 4,
              display: tab.id === activeTabId ? 'block' : 'none',
            }}
          />
        ))}
        {showTermFilter && termFilter && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: OUTPUT_THEME_STYLES[outputTheme].background, overflowY: 'auto',
            padding: '6px 8px', fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
            fontSize: 12, lineHeight: 1.5,
          }}>
            {(outputBufferRef.current[activeTabId] ?? [])
              .filter(l => l.includes(termFilter))
              .map((line, i) => {
                const idx = line.indexOf(termFilter)
                return (
                  <div key={i} style={{ color: OUTPUT_THEME_STYLES[outputTheme].color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {line.slice(0, idx)}
                    <mark style={{ background: 'rgba(255,200,0,0.35)', color: '#ffe066', borderRadius: 2 }}>
                      {line.slice(idx, idx + termFilter.length)}
                    </mark>
                    {line.slice(idx + termFilter.length)}
                  </div>
                )
              })
            }
            {(outputBufferRef.current[activeTabId] ?? []).filter(l => l.includes(termFilter)).length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>매칭 결과 없음</div>
            )}
          </div>
        )}
        {errorBanners[activeTabId] && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(248,81,73,0.12)', borderTop: '1px solid rgba(248,81,73,0.4)',
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
            fontSize: 11, zIndex: 10,
          }}>
            <span style={{ color: 'var(--error, #f85149)' }}>⚠️ 에러 감지</span>
            <button
              onClick={handleAskClaude}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
                padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >🤖 AI 분석</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={autoAnalyze}
                onChange={e => setAutoAnalyze(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              자동 분석
            </label>
            <button
              onClick={() => setErrorBanners(prev => ({ ...prev, [activeTabId]: false }))}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              }}
            >✕</button>
          </div>
        )}
        {searchOpen && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                const addon = searchAddonsRef.current[activeTabId]
                if (addon && e.target.value) {
                  addon.findNext(e.target.value, { caseSensitive: false, regex: false, wholeWord: false })
                }
              }}
              onKeyDown={e => {
                const addon = searchAddonsRef.current[activeTabId]
                if (e.key === 'Enter') {
                  e.shiftKey
                    ? addon?.findPrevious(searchQuery)
                    : addon?.findNext(searchQuery)
                }
                if (e.key === 'Escape') {
                  setSearchOpen(false)
                  setSearchQuery('')
                }
              }}
              placeholder="터미널 검색..."
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 12,
                outline: 'none',
                width: 180,
              }}
            />
            <button
              onClick={() => searchAddonsRef.current[activeTabId]?.findPrevious(searchQuery)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
            >▲</button>
            <button
              onClick={() => searchAddonsRef.current[activeTabId]?.findNext(searchQuery)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
            >▼</button>
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
            >×</button>
          </div>
        )}
      </div>
    </div>
  )
}
