import { ipcMain, shell, dialog, app } from 'electron'
import { AppConfig } from '../store/app-config'
import type { Snippet } from '../store/app-config'
import { readdir, readFile, writeFile, stat, mkdir, rename as fsRename, unlink, rm } from 'fs/promises'
import { watch, FSWatcher } from 'fs'
import path, { join, relative, dirname } from 'path'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import type { DirEntry } from '../../shared/ipc-schema'
import { analyzeProject } from './project-intelligence'

const watchers = new Map<string, FSWatcher>()

const execFileAsync = promisify(execFile)

interface FileSearchResult {
  name: string
  path: string
  relPath: string
}

async function searchFilesRecursive(
  rootPath: string,
  currentPath: string,
  query: string,
  depth: number,
  results: FileSearchResult[]
): Promise<void> {
  if (depth > 6 || results.length >= 30) return
  let entries
  try {
    entries = await readdir(currentPath, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (results.length >= 30) return
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const fullPath = join(currentPath, entry.name)
    if (entry.isDirectory()) {
      await searchFilesRecursive(rootPath, fullPath, query, depth + 1, results)
    } else {
      if (entry.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          name: entry.name,
          path: fullPath,
          relPath: relative(rootPath, fullPath).replace(/\\/g, '/'),
        })
      }
    }
  }
}

export function registerFsHandlers(_win: unknown) {
  ipcMain.handle('fs:read-dir', async (_, { path }: { path: string }): Promise<DirEntry[]> => {
    try {
      const entries = await readdir(path, { withFileTypes: true })
      return entries
        .map((e) => ({
          name: e.name,
          path: join(path, e.name),
          isDir: e.isDirectory()
        }))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .filter((e) => !e.name.startsWith('.') || e.isDir)
    } catch {
      return []
    }
  })

  ipcMain.handle('fs:read-file', async (_, { path }: { path: string }): Promise<string> => {
    try {
      const info = await stat(path)
      if (info.size > 2 * 1024 * 1024) { // 2MB limit
        return `[File too large to display: ${(info.size / 1024 / 1024).toFixed(1)} MB. Use a text editor for large files.]`
      }
      const buf = await readFile(path)
      return buf.toString('utf-8')
    } catch {
      return ''
    }
  })

  ipcMain.handle('fs:read-file-base64', async (_, { path: filePath }: { path: string }): Promise<string> => {
    try {
      const info = await stat(filePath)
      if (info.size > 2 * 1024 * 1024) { // 2MB limit
        return ''
      }
      const buf = await readFile(filePath)
      return buf.toString('base64')
    } catch {
      return ''
    }
  })

  ipcMain.handle('shell:open-external', async (_, url: string) => {
    let parsed: URL
    try { parsed = new URL(url) } catch { return }
    if (!['https:', 'http:'].includes(parsed.protocol)) return
    await shell.openExternal(url)
  })

  ipcMain.handle('shell:reveal-in-explorer', (_, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle(
    'fs:search-files',
    async (_, { rootPath, query }: { rootPath: string; query: string }): Promise<FileSearchResult[]> => {
      try {
        const results: FileSearchResult[] = []
        await searchFilesRecursive(rootPath, rootPath, query, 0, results)
        return results
      } catch {
        return []
      }
    }
  )

  ipcMain.handle('fs:save-file', async (_e, { content, defaultName }: { content: string; defaultName: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
      ],
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('fs:exportHtml', async (_, { filePath, html }: { filePath: string; html: string }) => {
    try {
      if (!path.isAbsolute(filePath)) throw new Error('absolute path required')
      const norm = path.resolve(filePath)
      if (norm.includes('..')) throw new Error('invalid path')
      await writeFile(norm, html, 'utf-8')
      return { ok: true }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('fs:showSaveDialog', async (_, { defaultPath, filters }: { defaultPath: string; filters: Array<{name: string; extensions: string[]}> }) => {
    const { BrowserWindow } = await import('electron')
    const win = BrowserWindow.getAllWindows()[0]
    const result = await dialog.showSaveDialog(win, { defaultPath, filters })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('fs:open-file-dialog', async (_event, opts?: { title?: string; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showOpenDialog({
      title: opts?.title ?? '파일 선택',
      properties: ['openFile', 'multiSelections'],
      filters: opts?.filters ?? [
        { name: '텍스트 파일', extensions: ['ts', 'tsx', 'js', 'jsx', 'py', 'md', 'txt', 'json', 'yaml', 'yml', 'toml', 'css', 'html', 'xml', 'sh', 'env'] },
        { name: '모든 파일', extensions: ['*'] },
      ],
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('fs:writeTextFile', async (_, { filePath, content }: { filePath: string; content: string }) => {
    try {
      if (!path.isAbsolute(filePath)) throw new Error('absolute path required')
      if (filePath.includes('..')) throw new Error('invalid path')
      await writeFile(filePath, content, 'utf-8')
      return { ok: true }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('clipboard:save-image', async (_e, { base64, ext }: { base64: string; ext: string }) => {
    try {
      const tmpDir = join(app.getPath('temp'), 'claude-desktop-paste')
      await mkdir(tmpDir, { recursive: true })
      const filename = `paste-${Date.now()}.${ext}`
      const filepath = join(tmpDir, filename)
      await writeFile(filepath, Buffer.from(base64, 'base64'))
      return filepath
    } catch {
      return null
    }
  })

  ipcMain.handle('fs:createFile', async (_, { dirPath, name }: { dirPath: string; name: string }) => {
    try {
      const filePath = join(dirPath, name)
      try { await stat(filePath); return { error: '이미 존재하는 파일입니다' } } catch { /* not found, ok */ }
      await writeFile(filePath, '', 'utf-8')
      return { ok: true, filePath }
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('fs:createDir', async (_, { dirPath, name }: { dirPath: string; name: string }) => {
    try {
      const newDir = join(dirPath, name)
      await mkdir(newDir, { recursive: true })
      return { ok: true, dirPath: newDir }
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('fs:rename', async (_, { oldPath, newName }: { oldPath: string; newName: string }) => {
    try {
      const dir = dirname(oldPath)
      const newPath = join(dir, newName)
      await fsRename(oldPath, newPath)
      return { ok: true, newPath }
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('fs:delete', async (_, { filePath, isDir }: { filePath: string; isDir: boolean }) => {
    try {
      if (isDir) {
        const normalized = path.resolve(filePath)
        if (normalized.length < 10) throw new Error('unsafe path')
        if (/^[A-Za-z]:[\\\/]?$/.test(normalized) || normalized === '/') throw new Error('unsafe path')
        await rm(normalized, { recursive: true, force: true })
      } else {
        await unlink(filePath)
      }
      return { ok: true }
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('fs:watchDir', async (event, { dirPath }: { dirPath: string }) => {
    const existing = watchers.get(dirPath)
    if (existing) { existing.close(); watchers.delete(dirPath) }

    try {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null

      const watcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        if (filename.includes('node_modules') || filename.includes('.git') ||
            filename.startsWith('dist') || filename.startsWith('out')) return

        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          if (event.sender.isDestroyed()) return
          event.sender.send('fs:dirChanged', { dirPath, eventType, filename })
        }, 300)
      })

      watchers.set(dirPath, watcher)
      // R2313: ISSUE-005 — sender(WebContents) 파괴 시 watcher 즉시 정리 (창 닫힘 누수 방지)
      event.sender.once('destroyed', () => {
        watcher.close()
        watchers.delete(dirPath)
      })
      return { ok: true }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('fs:unwatchDir', async (_, { dirPath }: { dirPath: string }) => {
    const watcher = watchers.get(dirPath)
    if (watcher) { watcher.close(); watchers.delete(dirPath) }
    return { ok: true }
  })

  ipcMain.handle('fs:stat', async (_, { path }: { path: string }) => {
    try {
      const s = await stat(path)
      return {
        size: s.size,
        mtime: s.mtime.getTime(),
        isDirectory: s.isDirectory(),
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('shell:exec', async (_, code: string) => {
    // R2316: ISSUE-001 — 화이트리스트 기반 execFile (shell:false) 보안 강화
    // shell:true → shell:false 전환으로 쉘 인젝션 우회 불가
    const SHELL_EXEC_ALLOWLIST = [
      'git', 'node', 'npm', 'npx', 'bun', 'deno',
      'python', 'python3', 'tsc', 'rg', 'grep',
    ]

    // 명령어를 실행파일과 인자로 파싱 (간단한 공백 분리, 따옴표 그룹핑)
    function parseCommand(cmd: string): string[] {
      const tokens: string[] = []
      let current = ''
      let inSingle = false
      let inDouble = false
      for (let i = 0; i < cmd.length; i++) {
        const ch = cmd[i]
        if (ch === "'" && !inDouble) { inSingle = !inSingle }
        else if (ch === '"' && !inSingle) { inDouble = !inDouble }
        else if (ch === ' ' && !inSingle && !inDouble) {
          if (current) { tokens.push(current); current = '' }
        } else {
          current += ch
        }
      }
      if (current) tokens.push(current)
      return tokens
    }

    const tokens = parseCommand(code.trim())
    if (tokens.length === 0) return { ok: false, output: '빈 명령어입니다.' }

    const [executable, ...args] = tokens
    const baseExe = executable.replace(/^.*[/\\]/, '').replace(/\.exe$/i, '').toLowerCase()
    if (!SHELL_EXEC_ALLOWLIST.includes(baseExe)) {
      return { ok: false, output: '보안 정책으로 차단된 명령어입니다.' }
    }

    try {
      const { stdout } = await execFileAsync(executable, args, {
        timeout: 10000,
        encoding: 'utf8',
        shell: false,
        maxBuffer: 1024 * 1024,
      })
      return { ok: true, output: String(stdout).slice(0, 4000) }
    } catch (e: any) {
      return { ok: false, output: e.message?.slice(0, 2000) ?? 'Error' }
    }
  })

  ipcMain.handle('project:analyze', async (_e, rootPath: string) => analyzeProject(rootPath))

  ipcMain.handle('fs:recentFiles', () => AppConfig.getInstance().getRecentFiles())
  ipcMain.handle('fs:addRecentFile', (_, filePath: string) => {
    AppConfig.getInstance().addRecentFile(filePath)
    return true
  })
  ipcMain.handle('fs:clearRecentFiles', () => {
    AppConfig.getInstance().clearRecentFiles()
    return true
  })

  ipcMain.handle('fs:getFavorites', () => {
    return AppConfig.getInstance().getFavoriteFiles()
  })

  ipcMain.handle('fs:toggleFavorite', (_, { path }: { path: string }) => {
    const config = AppConfig.getInstance()
    const favorites = config.getFavoriteFiles()
    if (favorites.includes(path)) {
      config.removeFavoriteFile(path)
      return { isFavorite: false }
    } else {
      config.addFavoriteFile(path)
      return { isFavorite: true }
    }
  })

  ipcMain.handle('snippet:list', () => AppConfig.getInstance().getSnippets())

  ipcMain.handle('snippet:save', (_, { snippet }: { snippet: Snippet }) => {
    const config = AppConfig.getInstance()
    const snippets = config.getSnippets()
    const idx = snippets.findIndex((s: Snippet) => s.id === snippet.id)
    if (idx >= 0) snippets[idx] = snippet
    else snippets.unshift(snippet)
    config.saveSnippets(snippets)
    return { success: true }
  })

  ipcMain.handle('snippet:delete', (_, { id }: { id: string }) => {
    const config = AppConfig.getInstance()
    const snippets = config.getSnippets().filter((s: Snippet) => s.id !== id)
    config.saveSnippets(snippets)
    return { success: true }
  })

  app.on('quit', () => {
    watchers.forEach(w => w.close())
    watchers.clear()
  })

  // Plugins
  const pluginsDir = join(app.getPath('home'), '.claude-desktop', 'plugins')

  ipcMain.handle('plugins:list', async () => {
    try {
      await mkdir(pluginsDir, { recursive: true })
      const entries = await readdir(pluginsDir, { withFileTypes: true })
      const jsFiles = entries.filter(e => e.isFile() && e.name.endsWith('.js'))
      const result: Array<{
        filename: string; name: string; description: string; version: string; author: string; path: string
      }> = []
      for (const entry of jsFiles) {
        const filePath = join(pluginsDir, entry.name)
        let name = '', description = '', version = '', author = ''
        try {
          const raw = await readFile(filePath, 'utf-8')
          const lines = raw.split('\n').slice(0, 5)
          for (const line of lines) {
            const nameMatch = line.match(/\/\/\s*@name\s+(.+)/)
            if (nameMatch) name = nameMatch[1].trim()
            const descMatch = line.match(/\/\/\s*@description\s+(.+)/)
            if (descMatch) description = descMatch[1].trim()
            const verMatch = line.match(/\/\/\s*@version\s+(.+)/)
            if (verMatch) version = verMatch[1].trim()
            const authorMatch = line.match(/\/\/\s*@author\s+(.+)/)
            if (authorMatch) author = authorMatch[1].trim()
          }
        } catch { /* skip unreadable */ }
        result.push({ filename: entry.name, name, description, version, author, path: filePath })
      }
      return result
    } catch {
      return []
    }
  })

  ipcMain.handle('plugins:openFolder', async () => {
    await mkdir(pluginsDir, { recursive: true })
    shell.openPath(pluginsDir)
  })

  ipcMain.handle('plugins:readFile', async (_, { path: filePath }: { path: string }) => {
    try {
      const content = await readFile(filePath, 'utf-8')
      return content
    } catch {
      return ''
    }
  })

  // MCP server connections
  ipcMain.handle('connections:getMcpServers', async () => {
    const homedir = app.getPath('home')
    const candidates = [
      join(homedir, '.claude.json'),
      join(homedir, '.config', 'claude', 'claude.json'),
    ]

    for (const configPath of candidates) {
      try {
        const raw = await readFile(configPath, 'utf-8')
        const parsed = JSON.parse(raw) as { mcpServers?: Record<string, { command: string; args?: string[] }> }
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          const servers = Object.entries(parsed.mcpServers).map(([name, cfg]) => ({
            name,
            command: cfg.command ?? '',
            args: Array.isArray(cfg.args) ? cfg.args : [],
            status: 'unknown' as const,
            configFile: configPath,
          }))
          return { servers, configFile: configPath }
        }
      } catch { /* try next */ }
    }
    return { servers: [], configFile: null }
  })

  const ALLOWED_COMMANDS = ['node', 'python', 'python3', 'git', 'npm', 'npx', 'bun', 'deno', 'java', 'ruby', 'php', 'go', 'rustc', 'tsc']

  ipcMain.handle('connections:pingServer', async (_, { command }: { name: string; command: string; args: string[] }) => {
    const start = Date.now()
    return new Promise<{ alive: boolean; latency?: number }>((resolve) => {
      if (!ALLOWED_COMMANDS.includes(command)) {
        return resolve({ alive: false })
      }
      try {
        const child = spawn(command, ['--version'], {
          shell: false,
          timeout: 5000,
          stdio: 'ignore',
        })
        child.on('exit', (code) => {
          resolve({ alive: code === 0, latency: Date.now() - start })
        })
        child.on('error', () => {
          resolve({ alive: false })
        })
        setTimeout(() => {
          child.kill()
          resolve({ alive: false })
        }, 5000)
      } catch {
        resolve({ alive: false })
      }
    })
  })

  ipcMain.handle('fs:grepSearch', async (_, { rootPath, query, options }: {
    rootPath: string
    query: string
    options?: { caseSensitive?: boolean; useRegex?: boolean; includePattern?: string }
  }) => {
    try {
      if (!query.trim()) return { results: [] }

      const rgArgs: string[] = [
        '--line-number',
        '--with-filename',
        '--max-count=50',
        '--max-filesize=500K',
      ]
      if (!options?.caseSensitive) rgArgs.push('--ignore-case')
      if (!options?.useRegex) rgArgs.push('--fixed-strings')
      rgArgs.push('--glob=!node_modules', '--glob=!.git', '--glob=!dist', '--glob=!out', '--glob=!*.lock')
      if (options?.includePattern) rgArgs.push(`--glob=${options.includePattern}`)
      rgArgs.push('--', query, rootPath)

      let stdout = ''
      try {
        const result = await execFileAsync('rg', rgArgs, { maxBuffer: 1024 * 512 })
        stdout = result.stdout
      } catch (e: unknown) {
        // rg returns exit code 1 when no matches (not an error)
        const err = e as { code?: number; stdout?: string }
        if (err.code === 1) stdout = err.stdout ?? ''
        else throw e
      }

      // Parse output: "filepath:linenum:content"
      const results: Array<{ filePath: string; lineNum: number; lineContent: string; relPath: string }> = []
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue
        // Handle Windows paths: C:\path\to\file:10:content
        const match = line.match(/^(.+?):(\d+):(.*)$/)
        if (!match) continue
        const [, filePath, lineNumStr, lineContent] = match
        results.push({
          filePath,
          lineNum: parseInt(lineNumStr, 10),
          lineContent: lineContent.trim(),
          relPath: filePath.replace(rootPath, '').replace(/^[/\\]/, ''),
        })
      }

      return { results: results.slice(0, 200) }
    } catch (e) {
      return { error: String(e), results: [] }
    }
  })
}
