/// <reference types="vite/client" />

interface Window {
  api: {
    claudeSend: (payload: { text: string; cwd: string; model: string; extraSystemPrompt?: string }) => void
    claudeInterrupt: () => void
    claudeClose: () => void
    claudeResume: (sessionId: string) => void
    claudePermissionReply: (requestId: string, allow: boolean, allowSession?: boolean) => void
    onClaudeMessage: (cb: (event: unknown) => void) => void
    onClaudePermission: (cb: (req: unknown) => void) => void
    removeClaudeListeners: () => void
    terminalCreate: (id: string, cwd: string) => void
    terminalWrite: (id: string, data: string) => void
    terminalResize: (id: string, cols: number, rows: number) => void
    terminalClose: (id: string) => void
    onTerminalData: (cb: (id: string, data: string) => void) => void
    saveFile: (content: string, defaultName: string) => Promise<boolean>
    readDir: (path: string) => Promise<{ name: string; path: string; isDir: boolean }[]>
    readFile: (path: string) => Promise<string>
    readFileBase64: (path: string) => Promise<string>
    searchFiles: (rootPath: string, query: string) => Promise<{ name: string; path: string; relPath: string }[]>
    openExternal: (url: string) => Promise<void>
    revealInExplorer: (path: string) => Promise<void>
    openFolder: () => Promise<string | null>
    getRecentProjects: () => Promise<string[]>
    getCurrentProject: () => Promise<string | null>
    setProject: (path: string) => void
    getOpenWorkspaces: () => Promise<{ workspaces: Array<{ path: string; openTabs: string[]; activeTab: string }>; activePath: string | null }>
    setOpenWorkspaces: (workspaces: Array<{ path: string; openTabs: string[]; activeTab: string }>, activePath: string | null) => void
    getProjectSystemPrompt: (projectPath: string) => Promise<string>
    setProjectSystemPrompt: (projectPath: string, prompt: string) => Promise<boolean>
    gitStatus: (cwd: string) => Promise<{ branch: string | null; changed: number } | null>
    gitDiff: (repoPath: string, filePath: string) => Promise<{ diff: string }>
    gitStatusFull: (repoPath: string) => Promise<{ files: Array<{ path: string; status: string; staged: boolean; unstaged: boolean }>; branch: string; lastCommit: string; error?: string }>
    gitStage: (repoPath: string, filePath: string) => Promise<{ ok?: boolean; error?: string }>
    gitUnstage: (repoPath: string, filePath: string) => Promise<{ ok?: boolean; error?: string }>
    gitCommit: (repoPath: string, message: string) => Promise<{ ok?: boolean; error?: string }>
    gitLog: (repoPath: string, limit?: number) => Promise<{ commits: Array<{ hash?: string; subject?: string; author?: string; date?: string }>; error?: string }>
    sessionSave: (session: unknown) => Promise<boolean>
    sessionList: () => Promise<unknown[]>
    sessionLoad: (id: string) => Promise<unknown>
    sessionDelete: (id: string) => Promise<boolean>
    sessionRename: (id: string, title: string) => Promise<boolean>
    onCloseTab: (cb: () => void) => () => void
    // Cocos Creator
    ccConnect: (port?: number) => Promise<boolean>
    ccDisconnect: () => Promise<boolean>
    ccStatus: () => Promise<import('../../shared/ipc-schema').CCStatus>
    ccGetTree: () => Promise<unknown>
    ccGetNode: (uuid: string) => Promise<unknown>
    ccSetProperty: (uuid: string, key: string, value: unknown) => Promise<unknown>
    ccMoveNode: (uuid: string, x: number, y: number) => Promise<unknown>
    onCCEvent: (cb: (event: import('../../shared/ipc-schema').CCEvent) => void) => () => void
    onCCStatusChange: (cb: (status: { connected: boolean }) => void) => () => void
    // Ollama
    ollamaList: () => Promise<string[]>
    ollamaSend: (payload: { model: string; messages: Array<{ role: string; content: string }> }) => void
    ollamaInterrupt: () => void
    // OpenAI
    openaiSend?: (payload: { model: string; messages: { role: string; content: string }[] }) => void
    openaiInterrupt?: () => void
    // CC File-based editor
    ccFileBuildUUIDMap?: (assetsDir: string) => Promise<Record<string, { uuid: string; path: string; relPath: string; type: string }>>
    openCCEditorWindow?: () => Promise<void>
  }
}
