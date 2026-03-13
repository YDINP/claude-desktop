import { contextBridge, ipcRenderer } from 'electron'
import type { CCEvent, CCNode, CCStatus, CCProjectInfo, AssetTree } from '../shared/ipc-schema'

contextBridge.exposeInMainWorld('api', {
  // Claude
  claudeSend: (payload: { text: string; cwd: string; model: string; extraSystemPrompt?: string }) =>
    ipcRenderer.send('claude:send', payload),
  claudeInterrupt: () => ipcRenderer.send('claude:interrupt'),
  ollamaList: () => ipcRenderer.invoke('ollama:list'),
  ollamaSend: (payload: { model: string; messages: Array<{ role: string; content: string }> }) =>
    ipcRenderer.send('ollama:send', payload),
  ollamaInterrupt: () => ipcRenderer.send('ollama:interrupt'),
  openaiSend: (payload: { model: string; messages: { role: string; content: string }[] }) =>
    ipcRenderer.send('openai:send', payload),
  openaiInterrupt: () => ipcRenderer.send('openai:interrupt'),
  claudeClose: () => ipcRenderer.send('claude:close'),
  claudeResume: (sessionId: string) => ipcRenderer.send('claude:resume', { sessionId }),
  claudePermissionReply: (requestId: string, allow: boolean, allowSession?: boolean) =>
    ipcRenderer.send('claude:permission-reply', { requestId, allow, allowSession }),
  onClaudeMessage: (cb: (event: unknown) => void) => {
    ipcRenderer.on('claude:message', (_, data) => cb(data))
  },
  onClaudePermission: (cb: (req: unknown) => void) => {
    ipcRenderer.on('claude:permission', (_, data) => cb(data))
  },
  removeClaudeListeners: () => {
    ipcRenderer.removeAllListeners('claude:message')
    ipcRenderer.removeAllListeners('claude:permission')
  },
  onCloseTab: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('shortcut:close-tab', handler as Parameters<typeof ipcRenderer.on>[1])
    return () => ipcRenderer.removeListener('shortcut:close-tab', handler as Parameters<typeof ipcRenderer.removeListener>[1])
  },
  onFontSizeShortcut: (cb: (delta: number, reset?: boolean) => void) => {
    const handler = (_: unknown, { delta, reset }: { delta: number; reset?: boolean }) => cb(delta, reset)
    ipcRenderer.on('shortcut:font-size', handler as Parameters<typeof ipcRenderer.on>[1])
    return () => ipcRenderer.removeListener('shortcut:font-size', handler as Parameters<typeof ipcRenderer.removeListener>[1])
  },

  // Terminal
  terminalCreate: (id: string, cwd: string) =>
    ipcRenderer.send('terminal:create', { id, cwd }),
  terminalWrite: (id: string, data: string) =>
    ipcRenderer.send('terminal:data', { id, data }),
  terminalResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', { id, cols, rows }),
  terminalClose: (id: string) =>
    ipcRenderer.send('terminal:close', { id }),
  onTerminalData: (cb: (id: string, data: string) => void) => {
    const listener = (_: unknown, { id, data }: { id: string; data: string }) => cb(id, data)
    ipcRenderer.on('terminal:data', listener as Parameters<typeof ipcRenderer.on>[1])
    return () => ipcRenderer.removeListener('terminal:data', listener as Parameters<typeof ipcRenderer.removeListener>[1])
  },

  // File system
  saveFile: (content: string, defaultName: string) => ipcRenderer.invoke('fs:save-file', { content, defaultName }),
  readDir: (path: string) => ipcRenderer.invoke('fs:read-dir', { path }),
  readFile: (path: string) => ipcRenderer.invoke('fs:read-file', { path }),
  readFileBase64: (path: string) => ipcRenderer.invoke('fs:read-file-base64', { path }),
  searchFiles: (rootPath: string, query: string) =>
    ipcRenderer.invoke('fs:search-files', { rootPath, query }),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  revealInExplorer: (path: string) => ipcRenderer.invoke('shell:reveal-in-explorer', path),
  saveClipboardImage: (base64: string, ext: string) => ipcRenderer.invoke('clipboard:save-image', { base64, ext }),
  exportHtml: (filePath: string, html: string) => ipcRenderer.invoke('fs:exportHtml', { filePath, html }),
  writeTextFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeTextFile', { filePath, content }),
  showSaveDialog: (opts: { defaultPath: string; filters: Array<{name: string; extensions: string[]}> }) => ipcRenderer.invoke('fs:showSaveDialog', opts),
  openFileDialog: (opts?: { title?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('fs:open-file-dialog', opts),
  createFile: (dirPath: string, name: string) => ipcRenderer.invoke('fs:createFile', { dirPath, name }),
  createDir: (dirPath: string, name: string) => ipcRenderer.invoke('fs:createDir', { dirPath, name }),
  renameFile: (oldPath: string, newName: string) => ipcRenderer.invoke('fs:rename', { oldPath, newName }),
  deleteFile: (filePath: string, isDir: boolean) => ipcRenderer.invoke('fs:delete', { filePath, isDir }),
  grepSearch: (rootPath: string, query: string, options?: { caseSensitive?: boolean; useRegex?: boolean; includePattern?: string }) =>
    ipcRenderer.invoke('fs:grepSearch', { rootPath, query, options }),
  watchDir: (dirPath: string) => ipcRenderer.invoke('fs:watchDir', { dirPath }),
  unwatchDir: (dirPath: string) => ipcRenderer.invoke('fs:unwatchDir', { dirPath }),
  onDirChanged: (callback: (data: { dirPath: string; eventType: string; filename: string }) => void) => {
    const handler = (_: unknown, data: { dirPath: string; eventType: string; filename: string }) => callback(data)
    ipcRenderer.on('fs:dirChanged', handler)
    return () => ipcRenderer.off('fs:dirChanged', handler)
  },
  recentFiles: () => ipcRenderer.invoke('fs:recentFiles'),
  addRecentFile: (filePath: string) => ipcRenderer.invoke('fs:addRecentFile', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('fs:clearRecentFiles'),
  getFavorites: () => ipcRenderer.invoke('fs:getFavorites'),
  toggleFavorite: (path: string) => ipcRenderer.invoke('fs:toggleFavorite', { path }),
  fsStat: (path: string) => ipcRenderer.invoke('fs:stat', { path }),

  // Project intelligence
  projectAnalyze: (rootPath: string) => ipcRenderer.invoke('project:analyze', rootPath),

  // Project
  openFolder: () => ipcRenderer.invoke('project:open'),
  getRecentProjects: () => ipcRenderer.invoke('project:recent'),
  getCurrentProject: () => ipcRenderer.invoke('project:current'),
  setProject: (path: string) => ipcRenderer.send('project:set', { path }),
  getOpenWorkspaces: () => ipcRenderer.invoke('project:get-workspaces'),
  setOpenWorkspaces: (workspaces: Array<{ path: string; openTabs: string[]; activeTab: string }>, activePath: string | null) =>
    ipcRenderer.send('project:set-workspaces', { workspaces, activePath }),

  // Project system prompt
  getProjectSystemPrompt: (projectPath: string) => ipcRenderer.invoke('project:getSystemPrompt', projectPath),
  setProjectSystemPrompt: (projectPath: string, prompt: string) => ipcRenderer.invoke('project:setSystemPrompt', { projectPath, prompt }),

  // Git
  gitStatus: (cwd: string) => ipcRenderer.invoke('git:status', { cwd }),
  gitFileDiff: (cwd: string, filePath: string, staged: boolean) =>
    ipcRenderer.invoke('git:fileDiff', { cwd, filePath, staged }),
  gitDiff: (repoPath: string, filePath: string) => ipcRenderer.invoke('git:diff', { repoPath, filePath }),
  gitStatusFull: (repoPath: string) => ipcRenderer.invoke('git:statusFull', { repoPath }),
  gitStage: (repoPath: string, filePath: string) => ipcRenderer.invoke('git:stage', { repoPath, filePath }),
  gitUnstage: (repoPath: string, filePath: string) => ipcRenderer.invoke('git:unstage', { repoPath, filePath }),
  gitCommit: (repoPath: string, message: string) => ipcRenderer.invoke('git:commit', { repoPath, message }),
  gitLog: (repoPath: string, limit?: number) => ipcRenderer.invoke('git:log', { repoPath, limit }),
  gitGenerateCommitMessage: (repoPath: string) => ipcRenderer.invoke('git:generateCommitMessage', { repoPath }),
  gitBranches: (cwd: string) => ipcRenderer.invoke('git:branches', { cwd }),
  gitCheckout: (cwd: string, branch: string) => ipcRenderer.invoke('git:checkout', { cwd, branch }),
  gitCreateBranch: (cwd: string, name: string) => ipcRenderer.invoke('git:createBranch', { cwd, name }),
  gitDeleteBranch: (cwd: string, name: string, force?: boolean) => ipcRenderer.invoke('git:deleteBranch', { cwd, name, force }),
  gitStashList: (cwd: string) => ipcRenderer.invoke('git:stashList', { cwd }),
  gitStashPush: (cwd: string, message?: string) => ipcRenderer.invoke('git:stashPush', { cwd, message }),
  gitStashPop: (cwd: string, ref?: string) => ipcRenderer.invoke('git:stashPop', { cwd, ref }),
  gitStashDrop: (cwd: string, ref: string) => ipcRenderer.invoke('git:stashDrop', { cwd, ref }),
  gitShow: (cwd: string, hash: string) => ipcRenderer.invoke('git:show', { cwd, hash }),
  gitRestoreFile: (cwd: string, filePath: string) => ipcRenderer.invoke('git:restoreFile', { cwd, filePath }),
  gitBlame: (cwd: string, filePath: string) => ipcRenderer.invoke('git:blame', { cwd, filePath }),
  gitFetch: (cwd: string) => ipcRenderer.invoke('git:fetch', { cwd }),
  gitUndoLastCommit: (cwd: string) => ipcRenderer.invoke('git:undoLastCommit', { cwd }),
  gitCleanUntracked: (cwd: string) => ipcRenderer.invoke('git:cleanUntracked', { cwd }),
  gitListTags: (cwd: string) => ipcRenderer.invoke('git:listTags', { cwd }),
  gitCreateTag: (cwd: string, name: string, message?: string) => ipcRenderer.invoke('git:createTag', { cwd, name, message }),
  gitDeleteTag: (cwd: string, name: string) => ipcRenderer.invoke('git:deleteTag', { cwd, name }),

  // Sessions
  sessionSave: (session: unknown) => ipcRenderer.invoke('session:save', session),
  sessionList: () => ipcRenderer.invoke('session:list'),
  sessionLoad: (id: string) => ipcRenderer.invoke('session:load', id),
  sessionDelete: (id: string) => ipcRenderer.invoke('session:delete', id),
  sessionRename: (id: string, title: string) => ipcRenderer.invoke('session:rename', { id, title }),
  sessionPin: (id: string, pinned: boolean) => ipcRenderer.invoke('session:pin', { id, pinned }),
  sessionTag: (id: string, tags: string[]) => ipcRenderer.invoke('session:tag', { id, tags }),
  sessionGlobalSearch: (query: string, limit?: number) => ipcRenderer.invoke('session:globalSearch', { query, limit }),
  sessionExportAll: () => ipcRenderer.invoke('session:exportAll'),
  sessionImportBackup: () => ipcRenderer.invoke('session:importBackup'),
  sessionFork: (sourceSessionId: string, upToMessageIndex: number, newTitle?: string) =>
    ipcRenderer.invoke('session:fork', { sourceSessionId, upToMessageIndex, newTitle }),
  sessionStats: (id: string) => ipcRenderer.invoke('session:stats', { id }),
  sessionGlobalStats: () => ipcRenderer.invoke('session:globalStats'),
  sessionExportMarkdown: (sessionId: string) => ipcRenderer.invoke('session:exportMarkdown', { sessionId }),
  sessionExportPdf: (sessionId: string) => ipcRenderer.invoke('session:exportPdf', { sessionId }),
  sessionGenerateTitle: (userMsg: string, assistantMsg: string) =>
    ipcRenderer.invoke('session:generateTitle', { userMsg, assistantMsg }),
  sessionGenerateTags: (userMsg: string, assistantMsg: string) =>
    ipcRenderer.invoke('session:generateTags', { userMsg, assistantMsg }),
  generateTitle: (data: { userMessage: string }) =>
    ipcRenderer.invoke('claude:generateTitle', data),
  compressContext: (messages: Array<{ role: string; text: string }>) =>
    ipcRenderer.invoke('claude:compressContext', { messages }),
  explainCode: (code: string, language: string) =>
    ipcRenderer.invoke('claude:explainCode', { code, language }),
  translate: (text: string, targetLang: 'ko' | 'en') =>
    ipcRenderer.invoke('claude:translate', { text, targetLang }),
  enhancePrompt: (prompt: string) => ipcRenderer.invoke('claude:enhancePrompt', { prompt }),
  suggestFollowUps: (lastAssistantMsg: string, lastUserMsg: string) =>
    ipcRenderer.invoke('claude:suggestFollowUps', { lastAssistantMsg, lastUserMsg }),
  generateDocs: (data: { code: string; lang: string }) => ipcRenderer.invoke('claude:generateDocs', data),
  summarizeSession: (data: { messages: Array<{ role: string; content: string }> }) =>
    ipcRenderer.invoke('claude:summarizeSession', data),
  generateInsights: (data: { totalSessions: number; totalTokens: number; avgTokensPerSession: number; topHours: number[]; peakDay: string; totalDays: number }) => ipcRenderer.invoke('claude:generateInsights', data),
  suggestSnippets: (messages: Array<{ role: string; content: string }>) =>
    ipcRenderer.invoke('claude:suggestSnippets', { messages }),
  sessionGetNote: (sessionId: string) => ipcRenderer.invoke('session:getNote', { sessionId }),
  sessionSetNote: (sessionId: string, note: string) => ipcRenderer.invoke('session:setNote', { sessionId, note }),
  sessionDuplicate: (sessionId: string) => ipcRenderer.invoke('session:duplicate', { sessionId }),
  sessionMerge: (sourceId: string, targetId: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('session:merge', sourceId, targetId),
  sessionReorder: (fromId: string, toId: string) => ipcRenderer.invoke('session:reorder', { fromId, toId }),
  sessionSetLocked: (id: string, locked: boolean) => ipcRenderer.invoke('session:setLocked', { id, locked }),
  sessionSetCollection: (id: string, collection: string | null) => ipcRenderer.invoke('session:setCollection', { id, collection }),
  saveSessionAsTemplate: (sessionId: string, templateName?: string) => ipcRenderer.invoke('session:saveAsTemplate', { sessionId, templateName }),
  listTemplates: () => ipcRenderer.invoke('session:listTemplates'),
  createSessionFromTemplate: (templateId: string) => ipcRenderer.invoke('session:createFromTemplate', { templateId }),
  deleteTemplate: (templateId: string) => ipcRenderer.invoke('session:deleteTemplate', { templateId }),
  sessionSearchAll: (query: string) => ipcRenderer.invoke('session:searchAll', query),

  // Snippets
  snippetList: () => ipcRenderer.invoke('snippet:list'),
  snippetSave: (snippet: { id: string; name: string; content: string; language?: string; category?: string; shortcut?: string; createdAt: number }) =>
    ipcRenderer.invoke('snippet:save', { snippet }),
  snippetDelete: (id: string) => ipcRenderer.invoke('snippet:delete', { id }),

  // Prompt templates
  templateList: () => ipcRenderer.invoke('template:list'),
  templateSave: (t: { id: string; name: string; prompt: string }) => ipcRenderer.invoke('template:save', t),
  templateDelete: (id: string) => ipcRenderer.invoke('template:delete', id),

  // Plugins
  pluginsList: () => ipcRenderer.invoke('plugins:list'),
  pluginsOpenFolder: () => ipcRenderer.invoke('plugins:openFolder'),
  pluginsReadFile: (path: string) => ipcRenderer.invoke('plugins:readFile', { path }),

  // Remote SSH
  listSshHosts: () => ipcRenderer.invoke('remote:listHosts') as Promise<Array<{ alias: string; hostname: string; user: string; port: number; identityFile?: string }>>,
  getSavedRemoteHosts: () => ipcRenderer.invoke('remote:getSavedHosts') as Promise<Array<{ id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }>>,
  saveRemoteHost: (host: { id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }) =>
    ipcRenderer.invoke('remote:saveHost', host) as Promise<Array<{ id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }>>,
  removeRemoteHost: (id: string) => ipcRenderer.invoke('remote:removeHost', { id }) as Promise<Array<{ id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }>>,

  // MCP connections
  getMcpServers: () => ipcRenderer.invoke('connections:getMcpServers') as Promise<{
    servers: Array<{ name: string; command: string; args: string[]; status: 'unknown'; configFile: string }>
    configFile: string | null
  }>,
  pingMcpServer: (server: { name: string; command: string; args: string[] }) =>
    ipcRenderer.invoke('connections:pingServer', server) as Promise<{ alive: boolean; latency?: number }>,

  // Settings
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch: Record<string, unknown>) => ipcRenderer.invoke('settings:set', patch),

  // Memory
  getMemoryUsage: (): Promise<{ rss: number; heapUsed: number; heapTotal: number }> =>
    ipcRenderer.invoke('app:memoryUsage'),
  onMemoryUpdate: (cb: (data: { rss: number; heapUsed: number }) => void) => {
    const handler = (_: unknown, data: { rss: number; heapUsed: number }) => cb(data)
    ipcRenderer.on('app:memoryUpdate', handler)
    return () => ipcRenderer.removeListener('app:memoryUpdate', handler)
  },

  // Terminal theme
  getTerminalTheme: () => ipcRenderer.invoke('app:getTerminalTheme'),
  setTerminalTheme: (theme: string) => ipcRenderer.invoke('app:setTerminalTheme', theme),

  // System prompt profiles
  getSystemPromptProfiles: () => ipcRenderer.invoke('app:getSystemPromptProfiles'),
  saveSystemPromptProfile: (profile: { id: string; name: string; content: string }) => ipcRenderer.invoke('app:saveSystemPromptProfile', profile),
  deleteSystemPromptProfile: (id: string) => ipcRenderer.invoke('app:deleteSystemPromptProfile', id),

  // Tasks
  getTasks: () => ipcRenderer.invoke('app:getTasks'),
  saveTasks: (tasks: Array<{ id: string; text: string; done: boolean; createdAt: number; priority?: string }>) => ipcRenderer.invoke('app:saveTasks', tasks),

  // Notification settings
  getNotificationSettings: () => ipcRenderer.invoke('app:getNotificationSettings'),
  setNotificationSettings: (s: { responseComplete: boolean; backgroundOnly: boolean; longSession: boolean; contextWarning: boolean }) => ipcRenderer.invoke('app:setNotificationSettings', s),

  // Window
  newWindow: () => ipcRenderer.invoke('app:newWindow'),

  // Native theme
  getNativeTheme: (): Promise<{ isDark: boolean }> => ipcRenderer.invoke('native-theme:get'),
  onNativeThemeChanged: (cb: (isDark: boolean) => void) => {
    const handler = (_: unknown, { isDark }: { isDark: boolean }) => cb(isDark)
    ipcRenderer.on('native-theme:changed', handler)
    return () => ipcRenderer.removeListener('native-theme:changed', handler)
  },

  // Cocos Creator
  ccConnect: (port?: number) => ipcRenderer.invoke('cc:connect', port),
  ccDisconnect: (port?: number) => ipcRenderer.invoke('cc:disconnect', port),
  ccStatus: () => ipcRenderer.invoke('cc:status'),
  ccGetTree: (port: number) => ipcRenderer.invoke('cc:getTree', port),
  ccGetCanvasSize: (port: number): Promise<import('../shared/ipc-schema').CanvasSize | null> =>
    ipcRenderer.invoke('cc:getCanvasSize', port),
  ccGetNode: (port: number, uuid: string) => ipcRenderer.invoke('cc:getNode', port, uuid),
  ccSetProperty: (port: number, uuid: string, key: string, value: unknown) => ipcRenderer.invoke('cc:setProperty', port, uuid, key, value),
  ccSetZOrder: (port: number, uuid: string, direction: string) => ipcRenderer.invoke('cc:setZOrder', port, uuid, direction),
  ccCreateNode: (port: number, name: string, parentUuid?: string) => ipcRenderer.invoke('cc:createNode', port, name, parentUuid),
  ccDeleteNode: (port: number, uuid: string) => ipcRenderer.invoke('cc:deleteNode', port, uuid),
  ccSetComponentProp: (port: number, uuid: string, compType: string, key: string, value: unknown) =>
    ipcRenderer.invoke('cc:setComponentProp', port, uuid, compType, key, value),
  ccMoveNode: (port: number, uuid: string, x: number, y: number) => ipcRenderer.invoke('cc:moveNode', port, uuid, x, y),
  onCCEvent: (cb: (event: CCEvent) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: unknown) => cb(data as CCEvent)
    ipcRenderer.on('cc:event', handler)
    return () => ipcRenderer.removeListener('cc:event', handler)
  },
  onCCStatusChange: (cb: (status: { connected: boolean }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: unknown) => cb(data as { connected: boolean })
    ipcRenderer.on('cc:statusChange', handler)
    return () => ipcRenderer.removeListener('cc:statusChange', handler)
  },
  ccDetectProject: (rootPath: string): Promise<CCProjectInfo> => ipcRenderer.invoke('cc:detectProject', rootPath),
  ccGetPort: (): Promise<number> => ipcRenderer.invoke('cc:getPort'),
  ccSetPort: (port: number): Promise<boolean> => ipcRenderer.invoke('cc:setPort', port),
  ccInstallExtension: (projectPath: string, version: string): Promise<{ success: boolean; message: string }> => ipcRenderer.invoke('cc:installExtension', projectPath, version),
  ccOpenEditor: (projectPath: string, version: string, creatorVersion?: string): Promise<{ success: boolean; message: string }> => ipcRenderer.invoke('cc:openEditor', projectPath, version, creatorVersion),
  ccGetAssets: (port: number): Promise<AssetTree> => ipcRenderer.invoke('cc:get-assets', port),

  // CC File-based Engine (Phase A)
  ccFileDetect: (projectPath: string): Promise<import('../shared/ipc-schema').CCFileProjectInfo> =>
    ipcRenderer.invoke('cc:file:detect', projectPath),
  ccFileOpenProject: (): Promise<import('../shared/ipc-schema').CCFileProjectInfo | null> =>
    ipcRenderer.invoke('cc:file:openProject'),
  ccFileListScenes: (projectPath: string): Promise<string[]> =>
    ipcRenderer.invoke('cc:file:listScenes', projectPath),
  ccFileReadScene: (
    scenePath: string,
    projectInfo: import('../shared/ipc-schema').CCFileProjectInfo
  ): Promise<import('../shared/ipc-schema').CCSceneFile | { error: string }> =>
    ipcRenderer.invoke('cc:file:readScene', scenePath, projectInfo),
  ccFileSaveScene: (
    sceneFile: import('../shared/ipc-schema').CCSceneFile,
    modifiedRoot: import('../shared/ipc-schema').CCSceneNode
  ): Promise<{ success: boolean; backupPath?: string; error?: string; conflict?: boolean }> =>
    ipcRenderer.invoke('cc:file:saveScene', sceneFile, modifiedRoot),
  // R1437: 충돌 무시 강제 덮어쓰기
  ccFileForceOverwrite: (
    sceneFile: import('../shared/ipc-schema').CCSceneFile,
    modifiedRoot: import('../shared/ipc-schema').CCSceneNode
  ): Promise<{ success: boolean; backupPath?: string; error?: string }> =>
    ipcRenderer.invoke('cc:file:forceOverwrite', sceneFile, modifiedRoot),
  ccFileRestoreBackup: (scenePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('cc:file:restoreBackup', scenePath),
  // R1423: .bak 파일 관리
  ccFileListBakFiles: (scenePath: string): Promise<Array<{ name: string; path: string; size: number; mtime: number }>> =>
    ipcRenderer.invoke('cc:file:listBakFiles', scenePath),
  ccFileDeleteAllBakFiles: (scenePath: string): Promise<{ deleted: number; error?: string }> =>
    ipcRenderer.invoke('cc:file:deleteAllBakFiles', scenePath),
  ccFileRestoreFromBak: (bakPath: string, scenePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('cc:file:restoreFromBak', bakPath, scenePath),
  ccFileWatch: (paths: string | string[]): Promise<{ watching: number }> =>
    ipcRenderer.invoke('cc:file:watch', paths),
  ccFileUnwatch: (paths?: string | string[]): Promise<{ watching: number }> =>
    ipcRenderer.invoke('cc:file:unwatch', paths),
  onCCFileChanged: (cb: (event: { type: string; path: string; timestamp: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { type: string; path: string; timestamp: number }) => cb(data)
    ipcRenderer.on('cc:file:changed', handler)
    return () => ipcRenderer.removeListener('cc:file:changed', handler)
  },
  ccFileBuildUUIDMap: (assetsDir: string): Promise<Record<string, { uuid: string; path: string; relPath: string; type: string }>> =>
    ipcRenderer.invoke('cc:file:buildUUIDMap', assetsDir),
  ccFileResolveTexture: (uuid: string, assetsDir: string): Promise<string | null> =>
    ipcRenderer.invoke('cc:file:resolveTexture', uuid, assetsDir),
  ccFileExtractUUIDs: (raw: unknown[]): Promise<string[]> =>
    ipcRenderer.invoke('cc:file:extractUUIDs', raw),
  // R1438: 씬 로컬 HTTP 공유
  ccFileServeScene: (sceneJson: string): Promise<{ success: boolean; url?: string; error?: string }> =>
    ipcRenderer.invoke('cc:file:serveScene', sceneJson),
  // R1410: UUID → 에셋 상세 정보
  ccGetAssetInfo: (uuid: string, assetsDir: string): Promise<{ path: string; type: string; name: string } | null> =>
    ipcRenderer.invoke('cc:file:getAssetInfo', uuid, assetsDir),
  ccGetAllTextureUUIDs: (assetsDir: string): Promise<string[]> =>
    ipcRenderer.invoke('cc:file:getAllTextureUUIDs', assetsDir),

  // CC Editor Window
  openCCEditorWindow: (): Promise<void> =>
    ipcRenderer.invoke('cc:open-window'),

  // Shell exec
  shellExec: (code: string): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke('shell:exec', code),
})

declare global {
  interface Window {
    api: {
      claudeSend: (payload: { text: string; cwd: string; model: string; extraSystemPrompt?: string }) => void
      claudeInterrupt: () => void
      ollamaList: () => Promise<string[]>
      ollamaSend: (payload: { model: string; messages: Array<{ role: string; content: string }> }) => void
      ollamaInterrupt: () => void
      openaiSend?: (payload: { model: string; messages: { role: string; content: string }[] }) => void
      openaiInterrupt?: () => void
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
      onTerminalData: (cb: (id: string, data: string) => void) => () => void
      saveFile: (content: string, defaultName: string) => Promise<boolean>
      readDir: (path: string) => Promise<unknown[]>
      readFile: (path: string) => Promise<string>
      readFileBase64: (path: string) => Promise<string>
      searchFiles: (rootPath: string, query: string) => Promise<{ name: string; path: string; relPath: string }[]>
      openExternal: (url: string) => Promise<void>
      revealInExplorer: (path: string) => Promise<void>
      saveClipboardImage: (base64: string, ext: string) => Promise<string | null>
      exportHtml: (filePath: string, html: string) => Promise<{ ok?: boolean; error?: string }>
      writeTextFile: (filePath: string, content: string) => Promise<{ ok?: boolean; error?: string }>
      showSaveDialog: (opts: { defaultPath: string; filters: Array<{name: string; extensions: string[]}> }) => Promise<string | null>
      openFileDialog?: (opts?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string[]>
      createFile: (dirPath: string, name: string) => Promise<{ ok?: boolean; filePath?: string; error?: string }>
      createDir: (dirPath: string, name: string) => Promise<{ ok?: boolean; dirPath?: string; error?: string }>
      renameFile: (oldPath: string, newName: string) => Promise<{ ok?: boolean; newPath?: string; error?: string }>
      deleteFile: (filePath: string, isDir: boolean) => Promise<{ ok?: boolean; error?: string }>
      grepSearch: (rootPath: string, query: string, options?: { caseSensitive?: boolean; useRegex?: boolean; includePattern?: string }) =>
        Promise<{ results: Array<{ filePath: string; lineNum: number; lineContent: string; relPath: string }>; error?: string }>
      watchDir: (dirPath: string) => Promise<{ ok?: boolean; error?: string }>
      unwatchDir: (dirPath: string) => Promise<{ ok?: boolean }>
      onDirChanged: (callback: (data: { dirPath: string; eventType: string; filename: string }) => void) => () => void
      recentFiles: () => Promise<string[]>
      addRecentFile: (filePath: string) => Promise<boolean>
      clearRecentFiles: () => Promise<boolean>
      getFavorites: () => Promise<string[]>
      toggleFavorite: (path: string) => Promise<{ isFavorite: boolean }>
      fsStat: (path: string) => Promise<{ size: number; mtime: number; isDirectory: boolean } | null>
      projectAnalyze: (rootPath: string) => Promise<{ name: string; type: string; description: string; keyFiles: string[]; techStack: string[]; summary: string } | null>
      openFolder: () => Promise<string | null>
      getRecentProjects: () => Promise<string[]>
      getCurrentProject: () => Promise<string | null>
      setProject: (path: string) => void
      getOpenWorkspaces: () => Promise<{ workspaces: Array<{ path: string; openTabs: string[]; activeTab: string }>; activePath: string | null }>
      setOpenWorkspaces: (workspaces: Array<{ path: string; openTabs: string[]; activeTab: string }>, activePath: string | null) => void
      getProjectSystemPrompt: (projectPath: string) => Promise<string>
      setProjectSystemPrompt: (projectPath: string, prompt: string) => Promise<boolean>
      gitStatus: (cwd: string) => Promise<{ branch: string | null; changed: number } | null>
      gitFileDiff: (cwd: string, filePath: string, staged: boolean) => Promise<{ diff: string }>
      gitDiff: (repoPath: string, filePath: string) => Promise<{ diff: string }>
      gitStatusFull: (repoPath: string) => Promise<{ files: Array<{ path: string; status: string; staged: boolean; unstaged: boolean }>; branch: string; lastCommit: string; error?: string }>
      gitStage: (repoPath: string, filePath: string) => Promise<{ ok?: boolean; error?: string }>
      gitUnstage: (repoPath: string, filePath: string) => Promise<{ ok?: boolean; error?: string }>
      gitCommit: (repoPath: string, message: string) => Promise<{ ok?: boolean; error?: string }>
      gitLog: (repoPath: string, limit?: number) => Promise<{ commits: Array<{ hash?: string; short?: string; subject?: string; author?: string; date?: string }>; error?: string }>
      gitShow: (cwd: string, hash: string) => Promise<string>
      gitRestoreFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>
      gitGenerateCommitMessage: (repoPath: string) => Promise<{ message: string }>
      gitBranches: (cwd: string) => Promise<{ branches: Array<{ name: string; upstream: string; isCurrent: boolean; isRemote: boolean }> }>
      gitCheckout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>
      gitCreateBranch: (cwd: string, name: string) => Promise<{ success: boolean; error?: string }>
      gitDeleteBranch: (cwd: string, name: string, force?: boolean) => Promise<{ success: boolean; error?: string }>
      gitStashList: (cwd: string) => Promise<{ entries: Array<{ ref: string; message: string; date: string }> }>
      gitStashPush: (cwd: string, message?: string) => Promise<{ success: boolean; error?: string }>
      gitStashPop: (cwd: string, ref?: string) => Promise<{ success: boolean; error?: string }>
      gitStashDrop: (cwd: string, ref: string) => Promise<{ success: boolean; error?: string }>
      gitBlame: (cwd: string, filePath: string) => Promise<Array<{ hash: string; author: string; date: string; lineNo: number }>>
      gitFetch: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>
      gitUndoLastCommit: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>
      gitCleanUntracked: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>
      gitListTags: (cwd: string) => Promise<string[]>
      gitCreateTag: (cwd: string, name: string, message?: string) => Promise<{ success: boolean; error?: string }>
      gitDeleteTag: (cwd: string, name: string) => Promise<{ success: boolean; error?: string }>
      sessionSave: (session: unknown) => Promise<boolean>
      sessionList: () => Promise<unknown[]>
      sessionLoad: (id: string) => Promise<unknown>
      sessionDelete: (id: string) => Promise<boolean>
      sessionRename: (id: string, title: string) => Promise<boolean>
      sessionPin: (id: string, pinned: boolean) => Promise<boolean>
      sessionTag: (id: string, tags: string[]) => Promise<{ error?: string }>
      sessionGlobalSearch: (query: string, limit?: number) => Promise<Array<{
        sessionId: string
        sessionName: string
        snippet: string
        matchCount: number
      }>>
      sessionExportAll: () => Promise<{ ok?: boolean; count?: number; filePath?: string; canceled?: boolean; error?: string }>
      sessionImportBackup: () => Promise<{ ok?: boolean; imported?: number; canceled?: boolean; error?: string }>
      sessionFork: (sourceSessionId: string, upToMessageIndex: number, newTitle?: string) => Promise<{ ok?: boolean; newSessionId?: string; error?: string }>
      sessionStats: (id: string) => Promise<{
        userMessages?: number
        assistantMessages?: number
        totalMessages?: number
        estimatedTokens?: number
        createdAt?: string | null
        updatedAt?: string | null
        error?: string
      }>
      sessionGlobalStats: () => Promise<{
        totalSessions: number
        topTags: { tag: string; count: number }[]
        dailyCounts: number[]
        dailyCountsMap: Record<string, number>
        recentCount: number
      }>
      sessionExportMarkdown: (sessionId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      sessionExportPdf: (sessionId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      sessionGenerateTitle: (userMsg: string, assistantMsg: string) => Promise<{ title: string }>
      sessionGenerateTags: (userMsg: string, assistantMsg: string) => Promise<{ tags: string[] }>
      generateTitle: (data: { userMessage: string }) => Promise<string>
      compressContext: (messages: Array<{ role: string; text: string }>) => Promise<{ summary: string; compressedCount: number; error?: string }>
      explainCode: (code: string, language: string) => Promise<string>
      translate: (text: string, targetLang: 'ko' | 'en') => Promise<string>
      enhancePrompt: (prompt: string) => Promise<string>
      suggestFollowUps: (lastAssistantMsg: string, lastUserMsg: string) => Promise<string[]>
      generateDocs: (data: { code: string; lang: string }) => Promise<string>
      summarizeSession: (data: { messages: Array<{ role: string; content: string }> }) => Promise<{ summary: string; error?: string }>
      generateInsights: (data: { totalSessions: number; totalTokens: number; avgTokensPerSession: number; topHours: number[]; peakDay: string; totalDays: number }) => Promise<string>
      suggestSnippets: (messages: Array<{ role: string; content: string }>) => Promise<Array<{ title: string; content: string; category: string }>>
      sessionGetNote: (sessionId: string) => Promise<{ note: string }>
      sessionSetNote: (sessionId: string, note: string) => Promise<{ success: boolean }>
      sessionDuplicate: (sessionId: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>
      sessionMerge: (sourceId: string, targetId: string) => Promise<{ ok: boolean; error?: string }>
      sessionReorder: (fromId: string, toId: string) => Promise<void>
      sessionSetLocked: (id: string, locked: boolean) => Promise<boolean>
      sessionSetCollection: (id: string, collection: string | null) => Promise<void>
      saveSessionAsTemplate: (sessionId: string, templateName?: string) => Promise<{ templateId?: string; error?: string }>
      listTemplates: () => Promise<Array<{ id: string; name: string; description?: string; createdAt: number; messageCount: number }>>
      createSessionFromTemplate: (templateId: string) => Promise<{ sessionId?: string; error?: string }>
      deleteTemplate: (templateId: string) => Promise<{ ok?: boolean; error?: string }>
      sessionSearchAll: (query: string) => Promise<Array<{
        sessionId: string
        sessionTitle: string
        messageIndex: number
        role: string
        excerpt: string
        updatedAt: number
      }>>
      snippetList: () => Promise<Array<{ id: string; name: string; content: string; language?: string; category?: string; shortcut?: string; createdAt: number }>>
      snippetSave: (snippet: { id: string; name: string; content: string; language?: string; category?: string; shortcut?: string; createdAt: number }) => Promise<{ success: boolean }>
      snippetDelete: (id: string) => Promise<{ success: boolean }>
      templateList: () => Promise<Array<{ id: string; name: string; prompt: string }>>
      templateSave: (t: { id: string; name: string; prompt: string }) => Promise<boolean>
      templateDelete: (id: string) => Promise<boolean>
      onCloseTab: (cb: () => void) => () => void
      onFontSizeShortcut: (cb: (delta: number, reset?: boolean) => void) => () => void
      settingsGet: () => Promise<{ theme: string; fontSize: number; maxTokensPerRequest: number; temperature: number; showTimestamps: boolean; selectedModel: string; accentColor: string; compactMode: boolean; soundEnabled: boolean; customCSS: string }>
      settingsSet: (patch: Record<string, unknown>) => Promise<boolean>
      getMemoryUsage: () => Promise<{ rss: number; heapUsed: number; heapTotal: number }>
      onMemoryUpdate: (cb: (data: { rss: number; heapUsed: number }) => void) => () => void
      getNativeTheme: () => Promise<{ isDark: boolean }>
      onNativeThemeChanged: (cb: (isDark: boolean) => void) => () => void
      newWindow: () => Promise<void>
      getTerminalTheme: () => Promise<string>
      setTerminalTheme: (theme: string) => Promise<void>
      getSystemPromptProfiles: () => Promise<Array<{ id: string; name: string; content: string }>>
      saveSystemPromptProfile: (profile: { id: string; name: string; content: string }) => Promise<void>
      deleteSystemPromptProfile: (id: string) => Promise<void>
      getTasks: () => Promise<Array<{ id: string; text: string; done: boolean; createdAt: number; priority?: 'low' | 'medium' | 'high' }>>
      saveTasks: (tasks: Array<{ id: string; text: string; done: boolean; createdAt: number; priority?: string }>) => Promise<void>
      getNotificationSettings: () => Promise<{ responseComplete: boolean; backgroundOnly: boolean; longSession: boolean; contextWarning: boolean }>
      setNotificationSettings: (s: { responseComplete: boolean; backgroundOnly: boolean; longSession: boolean; contextWarning: boolean }) => Promise<void>
      pluginsList: () => Promise<Array<{ filename: string; name: string; description: string; version: string; author: string; path: string }>>
      pluginsOpenFolder: () => Promise<void>
      pluginsReadFile: (path: string) => Promise<string>
      getMcpServers: () => Promise<{
        servers: Array<{ name: string; command: string; args: string[]; status: 'unknown'; configFile: string }>
        configFile: string | null
      }>
      pingMcpServer: (server: { name: string; command: string; args: string[] }) => Promise<{ alive: boolean; latency?: number }>
      listSshHosts: () => Promise<Array<{ alias: string; hostname: string; user: string; port: number; identityFile?: string }>>
      getSavedRemoteHosts: () => Promise<Array<{ id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }>>
      saveRemoteHost: (host: { id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }) => Promise<Array<{ id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }>>
      removeRemoteHost: (id: string) => Promise<Array<{ id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }>>
      // Cocos Creator
      ccConnect: (port?: number) => Promise<boolean>
      ccDisconnect: (port?: number) => Promise<boolean>
      ccStatus: () => Promise<import('../shared/ipc-schema').CCStatus>
      ccGetTree: (port: number) => Promise<unknown>
      ccGetCanvasSize: (port: number) => Promise<import('../shared/ipc-schema').CanvasSize | null>
      ccGetNode: (port: number, uuid: string) => Promise<unknown>
      ccSetProperty: (port: number, uuid: string, key: string, value: unknown) => Promise<unknown>
      ccSetZOrder: (port: number, uuid: string, direction: string) => Promise<void>
      ccCreateNode?: (port: number, name: string, parentUuid?: string) => Promise<string>
      ccDeleteNode?: (port: number, uuid: string) => Promise<void>
      ccSetComponentProp?: (port: number, uuid: string, compType: string, key: string, value: unknown) => Promise<unknown>
      ccMoveNode: (port: number, uuid: string, x: number, y: number) => Promise<unknown>
      onCCEvent: (cb: (event: import('../shared/ipc-schema').CCEvent) => void) => () => void
      onCCStatusChange: (cb: (status: { connected: boolean; port?: number }) => void) => () => void
      ccDetectProject: (rootPath: string) => Promise<{ detected: boolean; version?: string; port?: number; name?: string }>
      ccGetPort: () => Promise<number>
      ccSetPort: (port: number) => Promise<boolean>
      ccInstallExtension?: (projectPath: string, version: string) => Promise<{ success: boolean; message: string }>
      ccOpenEditor?: (projectPath: string, version: string, creatorVersion?: string) => Promise<{ success: boolean; message: string }>
      ccGetAssets?: (port: number) => Promise<import('../shared/ipc-schema').AssetTree>
      // CC File-based Engine (Phase A)
      ccFileDetect: (projectPath: string) => Promise<import('../shared/ipc-schema').CCFileProjectInfo>
      ccFileOpenProject: () => Promise<import('../shared/ipc-schema').CCFileProjectInfo | null>
      ccFileListScenes: (projectPath: string) => Promise<string[]>
      ccFileReadScene: (
        scenePath: string,
        projectInfo: import('../shared/ipc-schema').CCFileProjectInfo
      ) => Promise<import('../shared/ipc-schema').CCSceneFile | { error: string }>
      ccFileSaveScene: (
        sceneFile: import('../shared/ipc-schema').CCSceneFile,
        modifiedRoot: import('../shared/ipc-schema').CCSceneNode
      ) => Promise<{ success: boolean; backupPath?: string; error?: string; conflict?: boolean }>
      // R1437
      ccFileForceOverwrite: (
        sceneFile: import('../shared/ipc-schema').CCSceneFile,
        modifiedRoot: import('../shared/ipc-schema').CCSceneNode
      ) => Promise<{ success: boolean; backupPath?: string; error?: string }>
      ccFileRestoreBackup: (scenePath: string) => Promise<{ success: boolean; error?: string }>
      // R1423
      ccFileListBakFiles: (scenePath: string) => Promise<Array<{ name: string; path: string; size: number; mtime: number }>>
      ccFileDeleteAllBakFiles: (scenePath: string) => Promise<{ deleted: number; error?: string }>
      ccFileRestoreFromBak: (bakPath: string, scenePath: string) => Promise<{ success: boolean; error?: string }>
      ccFileWatch: (paths: string | string[]) => Promise<{ watching: number }>
      ccFileUnwatch: (paths?: string | string[]) => Promise<{ watching: number }>
      onCCFileChanged: (cb: (event: { type: string; path: string; timestamp: number }) => void) => () => void
      ccFileBuildUUIDMap: (assetsDir: string) => Promise<Record<string, { uuid: string; path: string; relPath: string; type: string }>>
      ccFileResolveTexture: (uuid: string, assetsDir: string) => Promise<string | null>
      ccFileExtractUUIDs: (raw: unknown[]) => Promise<string[]>
      // R1438
      ccFileServeScene: (sceneJson: string) => Promise<{ success: boolean; url?: string; error?: string }>
      ccGetAssetInfo?: (uuid: string, assetsDir: string) => Promise<{ path: string; type: string; name: string } | null>
      ccGetAllTextureUUIDs?: (assetsDir: string) => Promise<string[]>
      // CC Editor Window
      openCCEditorWindow?: () => Promise<void>
      // Shell exec
      shellExec?: (code: string) => Promise<{ ok: boolean; output: string }>
    }
  }
}
