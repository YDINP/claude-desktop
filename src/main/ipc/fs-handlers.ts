import { ipcMain, shell, dialog, app } from 'electron'
import { AppConfig } from '../store/app-config'
import type { Snippet } from '../store/app-config'
import { readdir, readFile, writeFile, stat, mkdir, rename as fsRename, unlink, rm } from 'fs/promises'
import { watch, FSWatcher } from 'fs'
import path, { join, relative, dirname } from 'path'
import { exec, execFile, spawn } from 'child_process'
import { promisify } from 'util'
import type { DirEntry } from '../../shared/ipc-schema'
import { analyzeProject } from './project-intelligence'

const watchers = new Map<string, FSWatcher>()

const execAsync = promisify(exec)
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

  ipcMain.handle('git:fileDiff', async (_, { cwd, filePath, staged }: { cwd: string; filePath: string; staged: boolean }) => {
    try {
      const args = ['diff', ...(staged ? ['--staged'] : []), '--', filePath]
      const result = await execFileAsync('git', args, { cwd })
      return { diff: result.stdout }
    } catch {
      return { diff: '' }
    }
  })

  ipcMain.handle('git:diff', async (_, { repoPath, filePath }: { repoPath: string; filePath: string }) => {
    try {
      const { stdout } = await execFileAsync('git', ['diff', 'HEAD', '--', filePath], { cwd: repoPath, maxBuffer: 1024 * 512 })
      return { diff: stdout }
    } catch {
      return { diff: '' }
    }
  })

  // Simple git status for StatusBar (branch + changed count)
  ipcMain.handle('git:status', async (_, { cwd }: { cwd: string }) => {
    try {
      const [branchResult, statusResult] = await Promise.all([
        execAsync('git rev-parse --abbrev-ref HEAD', { cwd }).catch(() => null),
        execAsync('git status --porcelain', { cwd }).catch(() => null),
      ])
      const branch = branchResult?.stdout.trim() ?? null
      const changed = statusResult ? statusResult.stdout.trim().split('\n').filter(Boolean).length : 0
      return { branch, changed }
    } catch {
      return null
    }
  })

  // Detailed git status for GitPanel
  ipcMain.handle('git:statusFull', async (_, { repoPath }: { repoPath: string }) => {
    try {
      const { stdout } = await execAsync('git status --porcelain -u', { cwd: repoPath })

      const files: Array<{ path: string; status: string; staged: boolean; unstaged: boolean }> = []
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue
        const indexStatus = line[0]
        const worktreeStatus = line[1]
        const filePath = line.slice(3).trim()
        files.push({
          path: filePath,
          status: line.slice(0, 2),
          staged: indexStatus !== ' ' && indexStatus !== '?',
          unstaged: worktreeStatus !== ' ',
        })
      }

      let branch = ''
      try {
        const branchResult = await execAsync('git branch --show-current', { cwd: repoPath })
        branch = branchResult.stdout.trim()
      } catch { /* no branch */ }

      let lastCommit = ''
      try {
        const commitResult = await execAsync('git log -1 --oneline', { cwd: repoPath })
        lastCommit = commitResult.stdout.trim()
      } catch { /* no commits */ }

      return { files, branch, lastCommit }
    } catch (e) {
      return { files: [], branch: '', lastCommit: '', error: String(e) }
    }
  })

  ipcMain.handle('git:stage', async (_, { repoPath, filePath }: { repoPath: string; filePath: string }) => {
    try {
      await execFileAsync('git', ['add', filePath], { cwd: repoPath })
      return { ok: true }
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('git:unstage', async (_, { repoPath, filePath }: { repoPath: string; filePath: string }) => {
    try {
      await execFileAsync('git', ['restore', '--staged', filePath], { cwd: repoPath })
      return { ok: true }
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('git:commit', async (_, { repoPath, message }: { repoPath: string; message: string }) => {
    try {
      await execFileAsync('git', ['commit', '-m', message], { cwd: repoPath })
      return { ok: true }
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('git:generateCommitMessage', async (_, { repoPath }: { repoPath: string }) => {
    try {
      const { stdout } = await execAsync('git diff --staged', { cwd: repoPath, maxBuffer: 1024 * 512 })
      const diff = stdout.trim()
      if (!diff) return { message: '' }

      const diffText = diff.slice(0, 4000)
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return { message: '' }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `Write a concise git commit message (under 72 chars) for this diff:\n\n${diffText}\n\nReturn ONLY the commit message, nothing else.`
          }]
        })
      })
      if (!resp.ok) return { message: '' }
      const data = await resp.json() as { content?: Array<{ type: string; text: string }> }
      const message = data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : ''
      return { message }
    } catch {
      return { message: '' }
    }
  })

  ipcMain.handle('git:branches', async (_, { cwd }: { cwd: string }) => {
    try {
      const result = await execAsync('git branch -a --format="%(refname:short)|%(upstream:short)|%(HEAD)"', { cwd })
      const branches = result.stdout.trim().split('\n').filter(Boolean).map(line => {
        const [name, upstream, head] = line.split('|')
        return {
          name: name?.trim() ?? '',
          upstream: upstream?.trim() ?? '',
          isCurrent: head?.trim() === '*',
          isRemote: name?.startsWith('remotes/') ?? false,
        }
      }).filter(b => b.name && !b.name.endsWith('/HEAD'))
      return { branches }
    } catch {
      return { branches: [] }
    }
  })

  ipcMain.handle('git:checkout', async (_, { cwd, branch }: { cwd: string; branch: string }) => {
    try {
      await execFileAsync('git', ['checkout', branch], { cwd })
      return { success: true }
    } catch (e: unknown) {
      const err = e as { stderr?: string }
      return { success: false, error: err.stderr ?? String(e) }
    }
  })

  ipcMain.handle('git:createBranch', async (_, { cwd, name }: { cwd: string; name: string }) => {
    try {
      await execFileAsync('git', ['checkout', '-b', name], { cwd })
      return { success: true }
    } catch (e: unknown) {
      const err = e as { stderr?: string }
      return { success: false, error: err.stderr ?? String(e) }
    }
  })

  ipcMain.handle('git:deleteBranch', async (_, { cwd, name, force }: { cwd: string; name: string; force?: boolean }) => {
    try {
      const flag = force ? '-D' : '-d'
      await execFileAsync('git', ['branch', flag, name], { cwd })
      return { success: true }
    } catch (e: unknown) {
      const err = e as { stderr?: string }
      return { success: false, error: err.stderr ?? String(e) }
    }
  })

  ipcMain.handle('git:stashList', async (_, { cwd }: { cwd: string }) => {
    try {
      const result = await execAsync('git stash list --format="%gd|%s|%ci"', { cwd })
      const entries = result.stdout.trim().split('\n').filter(Boolean).map(line => {
        const [ref, msg, date] = line.split('|')
        return { ref: ref?.trim() ?? '', message: msg?.trim() ?? '', date: date?.trim() ?? '' }
      })
      return { entries }
    } catch {
      return { entries: [] }
    }
  })

  ipcMain.handle('git:stashPush', async (_, { cwd, message }: { cwd: string; message?: string }) => {
    try {
      const args = message ? ['stash', 'push', '-m', message] : ['stash', 'push']
      await execFileAsync('git', args, { cwd })
      return { success: true }
    } catch (e: unknown) {
      const err = e as { stderr?: string }
      return { success: false, error: err.stderr ?? String(e) }
    }
  })

  ipcMain.handle('git:stashPop', async (_, { cwd, ref }: { cwd: string; ref?: string }) => {
    try {
      const args = ref ? ['stash', 'pop', ref] : ['stash', 'pop']
      await execFileAsync('git', args, { cwd })
      return { success: true }
    } catch (e: unknown) {
      const err = e as { stderr?: string }
      return { success: false, error: err.stderr ?? String(e) }
    }
  })

  ipcMain.handle('git:stashDrop', async (_, { cwd, ref }: { cwd: string; ref: string }) => {
    try {
      await execFileAsync('git', ['stash', 'drop', ref], { cwd })
      return { success: true }
    } catch (e: unknown) {
      const err = e as { stderr?: string }
      return { success: false, error: err.stderr ?? String(e) }
    }
  })

  ipcMain.handle('git:log', async (_, { repoPath, limit }: { repoPath: string; limit?: number }) => {
    try {
      const n = limit ?? 20
      const { stdout } = await execAsync(`git log -${n} --oneline --format="%H|%h|%s|%an|%ar"`, { cwd: repoPath })
      const commits = stdout.split('\n').filter(Boolean).map(line => {
        const [hash, short, subject, author, date] = line.split('|')
        return { hash, short, subject, author, date }
      })
      return { commits }
    } catch (e) { return { commits: [], error: String(e) } }
  })

  ipcMain.handle('git:restoreFile', async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    try {
      if (filePath.includes('..')) throw new Error('invalid path')
      await execFileAsync('git', ['checkout', '--', filePath], { cwd })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('git:show', async (_, { cwd, hash }: { cwd: string; hash: string }) => {
    try {
      const { stdout } = await execFileAsync('git', ['show', '--stat', '--patch', hash], { cwd })
      return stdout
    } catch {
      return ''
    }
  })

  ipcMain.handle('git:blame', async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    try {
      if (filePath.includes('..')) throw new Error('invalid path')
      const rel = relative(cwd, filePath).replace(/\\/g, '/')
      const { stdout } = await execFileAsync('git', ['blame', '--line-porcelain', rel], { cwd })
      const lines: Array<{ hash: string; author: string; date: string; lineNo: number }> = []
      const blocks = stdout.split('\n')
      let current: Partial<{ hash: string; author: string; date: string; lineNo: number }> = {}
      for (const line of blocks) {
        if (/^[0-9a-f]{40}/.test(line)) {
          const parts = line.split(' ')
          current = { hash: parts[0].slice(0, 7) }
        } else if (line.startsWith('author ')) {
          current.author = line.slice(7)
        } else if (line.startsWith('author-time ')) {
          current.date = new Date(parseInt(line.slice(12)) * 1000).toLocaleDateString('ko-KR')
        } else if (line.startsWith('\t')) {
          lines.push({ hash: current.hash ?? '?', author: current.author ?? '?', date: current.date ?? '?', lineNo: lines.length + 1 })
        }
      }
      return lines
    } catch {
      return []
    }
  })

  ipcMain.handle('git:fetch', async (_, { cwd }: { cwd: string }) => {
    try {
      const { stdout } = await execAsync('git fetch --all', { cwd })
      return { success: true, output: stdout }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('git:undoLastCommit', async (_, { cwd }: { cwd: string }) => {
    try {
      const { stdout } = await execAsync('git reset --soft HEAD~1', { cwd })
      return { success: true, output: stdout }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('git:cleanUntracked', async (_, { cwd }: { cwd: string }) => {
    try {
      const { stdout } = await execAsync('git clean -fd', { cwd })
      return { success: true, output: stdout }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // List tags
  ipcMain.handle('git:listTags', async (_, { cwd }: { cwd: string }) => {
    try {
      const { stdout } = await execAsync('git tag -l --sort=-version:refname', { cwd })
      return stdout.trim().split('\n').filter(Boolean)
    } catch { return [] }
  })

  // Create tag
  ipcMain.handle('git:createTag', async (_, { cwd, name, message }: { cwd: string; name: string; message?: string }) => {
    try {
      if (!/^[a-zA-Z0-9._/-]+$/.test(name)) throw new Error('유효하지 않은 태그 이름')
      const args = message
        ? ['tag', '-a', name, '-m', message]
        : ['tag', name]
      await execFileAsync('git', args, { cwd })
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // Delete tag
  ipcMain.handle('git:deleteTag', async (_, { cwd, name }: { cwd: string; name: string }) => {
    try {
      if (!/^[a-zA-Z0-9._/-]+$/.test(name)) throw new Error('유효하지 않은 태그 이름')
      await execFileAsync('git', ['tag', '-d', name], { cwd })
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
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

  // Remote SSH hosts
  const remoteHostsFile = join(app.getPath('home'), '.claude-desktop', 'remote-hosts.json')

  async function readSavedHosts(): Promise<Array<{ id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }>> {
    try {
      const raw = await readFile(remoteHostsFile, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return []
    }
  }

  ipcMain.handle('remote:listHosts', async () => {
    const sshConfigPath = join(app.getPath('home'), '.ssh', 'config')
    try {
      const raw = await readFile(sshConfigPath, 'utf-8')
      const results: Array<{ alias: string; hostname: string; user: string; port: number; identityFile?: string }> = []
      const blocks = raw.split(/^Host\s+/m).slice(1)
      for (const block of blocks) {
        const lines = block.split('\n')
        const alias = lines[0].trim()
        if (!alias || alias === '*') continue
        let hostname = ''
        let user = ''
        let port = 22
        let identityFile: string | undefined
        for (const line of lines.slice(1)) {
          const m = line.match(/^\s*(\w+)\s+(.+)/)
          if (!m) continue
          const [, key, val] = m
          if (key === 'HostName') hostname = val.trim()
          else if (key === 'User') user = val.trim()
          else if (key === 'Port') port = parseInt(val.trim()) || 22
          else if (key === 'IdentityFile') identityFile = val.trim()
        }
        if (hostname && user) results.push({ alias, hostname, user, port, identityFile })
      }
      return results
    } catch {
      return []
    }
  })

  ipcMain.handle('remote:getSavedHosts', async () => {
    return readSavedHosts()
  })

  ipcMain.handle('remote:saveHost', async (_, host: { id: string; label: string; hostname: string; user: string; port: number; identityFile?: string }) => {
    try {
      await mkdir(join(app.getPath('home'), '.claude-desktop'), { recursive: true })
      const hosts = await readSavedHosts()
      const idx = hosts.findIndex(h => h.id === host.id)
      if (idx >= 0) hosts[idx] = host
      else hosts.push(host)
      await writeFile(remoteHostsFile, JSON.stringify(hosts, null, 2), 'utf-8')
      return hosts
    } catch {
      return readSavedHosts()
    }
  })

  ipcMain.handle('remote:removeHost', async (_, { id }: { id: string }) => {
    try {
      const hosts = (await readSavedHosts()).filter(h => h.id !== id)
      await writeFile(remoteHostsFile, JSON.stringify(hosts, null, 2), 'utf-8')
      return hosts
    } catch {
      return readSavedHosts()
    }
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
