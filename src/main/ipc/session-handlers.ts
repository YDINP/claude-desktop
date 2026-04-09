import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { mkdir, writeFile, readFile, readdir, unlink, access, rename } from 'fs/promises'

const sessionsDir = join(app.getPath('userData'), 'claude-desktop', 'sessions')
const INDEX_FILE = join(sessionsDir, '_index.json')
const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/

const templatesDir = join(app.getPath('userData'), 'claude-desktop', 'templates')
const TEMPLATES_INDEX_FILE = join(templatesDir, '_index.json')

async function ensureDir() {
  await mkdir(sessionsDir, { recursive: true })
}

async function ensureTemplatesDir() {
  await mkdir(templatesDir, { recursive: true })
}

interface TemplateMeta {
  id: string
  name: string
  description?: string
  createdAt: number
  messageCount: number
}

async function readTemplatesIndex(): Promise<TemplateMeta[]> {
  try {
    return JSON.parse(await readFile(TEMPLATES_INDEX_FILE, 'utf8')) as TemplateMeta[]
  } catch {
    return []
  }
}

async function writeTemplatesIndex(templates: TemplateMeta[]) {
  await writeFile(TEMPLATES_INDEX_FILE, JSON.stringify(templates))
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

interface SessionMeta {
  id: string
  title: string
  cwd: string
  model: string
  updatedAt: number
  createdAt: number
  messageCount: number
  pinned?: boolean
  tags?: string[]
  locked?: boolean
  collection?: string
  forkedFrom?: string
}

async function readIndex(): Promise<SessionMeta[]> {
  try {
    return JSON.parse(await readFile(INDEX_FILE, 'utf8')) as SessionMeta[]
  } catch {
    return []
  }
}

async function writeIndex(sessions: SessionMeta[]) {
  const tmpPath = INDEX_FILE + '.tmp'
  await writeFile(tmpPath, JSON.stringify(sessions), 'utf-8')
  await rename(tmpPath, INDEX_FILE)
}

async function buildIndexFromDisk(): Promise<SessionMeta[]> {
  const files = (await readdir(sessionsDir)).filter(f => f.endsWith('.json') && f !== '_index.json')
  const results = await Promise.all(
    files.map(async f => {
      try {
        const s = JSON.parse(await readFile(join(sessionsDir, f), 'utf8')) as StoredSession & { pinned?: boolean; tags?: string[]; locked?: boolean; collection?: string; forkedFrom?: string }
        return { id: s.id, title: s.title, cwd: s.cwd, model: s.model, updatedAt: s.updatedAt, createdAt: s.createdAt, messageCount: s.messages.length, pinned: s.pinned, tags: s.tags, locked: s.locked, collection: s.collection, forkedFrom: s.forkedFrom }
      } catch { return null }
    })
  )
  return results.filter(Boolean) as SessionMeta[]
}

export interface StoredSession {
  id: string
  title: string
  cwd: string
  model: string
  messages: unknown[]
  createdAt: number
  updatedAt: number
}

function validateSessionId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id)
}

export function registerSessionHandlers() {
  ipcMain.handle('session:save', async (_e, session: StoredSession) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(session.id)) {
      throw new Error('Invalid session ID')
    }
    await ensureDir()
    await writeFile(join(sessionsDir, `${session.id}.json`), JSON.stringify(session, null, 2))
    // Update index
    const index = await readIndex()
    const existingEntry = index.find(s => s.id === session.id)
    const meta: SessionMeta = {
      id: session.id, title: session.title, cwd: session.cwd,
      model: session.model, updatedAt: session.updatedAt,
      createdAt: session.createdAt, messageCount: session.messages.length,
      pinned: existingEntry?.pinned,
      tags: existingEntry?.tags,
      locked: existingEntry?.locked,
      forkedFrom: existingEntry?.forkedFrom,
    }
    const idx = index.findIndex(s => s.id === session.id)
    if (idx >= 0) index[idx] = meta
    else index.push(meta)
    await writeIndex(index)
    return true
  })

  ipcMain.handle('session:list', async () => {
    await ensureDir()
    let index = await readIndex()
    if (index.length === 0) {
      // Build index from disk (first run or migration)
      index = await buildIndexFromDisk()
      if (index.length > 0) await writeIndex(index)
    } else {
      // Reconcile: find orphan session files not in index
      const diskIndex = await buildIndexFromDisk()
      const indexedIds = new Set(index.map(s => s.id))
      const orphans = diskIndex.filter(s => !indexedIds.has(s.id))
      if (orphans.length > 0) {
        index = [...index, ...orphans]
        await writeIndex(index)
      }
    }
    // Pinned sessions float to top; within each group preserve index order (respects manual reorder)
    const pinned = index.filter(s => s.pinned)
    const unpinned = index.filter(s => !s.pinned)
    return [...pinned, ...unpinned]
  })

  ipcMain.handle('session:reorder', async (_, { fromId, toId }: { fromId: string; toId: string }) => {
    if (!SESSION_ID_RE.test(fromId) || !SESSION_ID_RE.test(toId)) throw new Error('invalid id')
    const idx = await readIndex()
    const fromPos = idx.findIndex(e => e.id === fromId)
    const toPos = idx.findIndex(e => e.id === toId)
    if (fromPos === -1 || toPos === -1) return
    const [item] = idx.splice(fromPos, 1)
    idx.splice(toPos, 0, item)
    await writeIndex(idx)
  })

  ipcMain.handle('session:load', async (_e, id: string) => {
    if (!validateSessionId(id)) return null
    const file = join(sessionsDir, `${id}.json`)
    if (!await fileExists(file)) return null
    return JSON.parse(await readFile(file, 'utf8'))
  })

  ipcMain.handle('session:delete', async (_e, id: string) => {
    if (!validateSessionId(id)) return false
    const file = join(sessionsDir, `${id}.json`)
    if (await fileExists(file)) await unlink(file)
    // Remove from index
    const index = await readIndex()
    await writeIndex(index.filter(s => s.id !== id))
    return true
  })

  ipcMain.handle('session:rename', async (_e, { id, title }: { id: string; title: string }) => {
    if (!validateSessionId(id)) return false
    const file = join(sessionsDir, `${id}.json`)
    if (!await fileExists(file)) return false
    const session = JSON.parse(await readFile(file, 'utf8')) as StoredSession
    session.title = title
    await writeFile(file, JSON.stringify(session, null, 2))
    // Update index
    const index = await readIndex()
    const entry = index.find(s => s.id === id)
    if (entry) entry.title = title
    await writeIndex(index)
    return true
  })

  ipcMain.handle('session:pin', async (_e, { id, pinned }: { id: string; pinned: boolean }) => {
    if (!validateSessionId(id)) return false
    const file = join(sessionsDir, `${id}.json`)
    if (!await fileExists(file)) return false
    // Update session file
    const session = JSON.parse(await readFile(file, 'utf8')) as StoredSession & { pinned?: boolean }
    session.pinned = pinned
    await writeFile(file, JSON.stringify(session, null, 2))
    // Update index
    const index = await readIndex()
    const entry = index.find(s => s.id === id)
    if (entry) entry.pinned = pinned
    await writeIndex(index)
    return true
  })

  ipcMain.handle('session:globalSearch', async (_, { query, limit }: { query: string; limit?: number }) => {
    const q = query.toLowerCase().trim()
    if (!q || q.length < 2) return []

    const results: Array<{
      sessionId: string
      sessionName: string
      snippet: string
      matchCount: number
    }> = []

    const index = await readIndex()

    for (const meta of index) {
      try {
        const sessionPath = join(sessionsDir, meta.id + '.json')
        const raw = await readFile(sessionPath, 'utf8')
        const session = JSON.parse(raw) as StoredSession

        const messages = session.messages as Array<{ role?: string; content?: string; text?: string }>

        let matchCount = 0
        let snippet = ''

        for (const msg of messages) {
          const text = (msg.content ?? msg.text ?? '') as string
          if (typeof text !== 'string') continue
          const lower = text.toLowerCase()
          const idx = lower.indexOf(q)
          if (idx !== -1) {
            matchCount++
            if (!snippet) {
              const start = Math.max(0, idx - 20)
              const end = Math.min(text.length, idx + q.length + 60)
              snippet = (start > 0 ? '\u2026' : '') + text.slice(start, end) + (end < text.length ? '\u2026' : '')
            }
          }
        }

        if (matchCount > 0) {
          results.push({
            sessionId: meta.id,
            sessionName: meta.title ?? meta.id,
            snippet,
            matchCount,
          })
        }

        if (results.length >= (limit ?? 20)) break
      } catch {
        // skip corrupt sessions
      }
    }

    results.sort((a, b) => b.matchCount - a.matchCount)
    return results.slice(0, limit ?? 20)
  })

  ipcMain.handle('session:tag', async (_e, { id, tags }: { id: string; tags: string[] }) => {
    if (!validateSessionId(id)) return { error: 'Invalid session ID' }
    const file = join(sessionsDir, `${id}.json`)
    if (!await fileExists(file)) return { error: 'Session not found' }
    // Update session file
    const session = JSON.parse(await readFile(file, 'utf8')) as StoredSession & { tags?: string[] }
    session.tags = tags
    await writeFile(file, JSON.stringify(session, null, 2))
    // Update index
    const index = await readIndex()
    const entry = index.find(s => s.id === id)
    if (entry) entry.tags = tags
    await writeIndex(index)
    return {}
  })

  ipcMain.handle('session:exportAll', async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0]
      const result = await dialog.showSaveDialog(win, {
        defaultPath: `claude-sessions-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return { canceled: true }

      const index = await readIndex()
      const sessions: unknown[] = []
      for (const meta of index) {
        try {
          const raw = await readFile(join(sessionsDir, meta.id + '.json'), 'utf-8')
          sessions.push(JSON.parse(raw))
        } catch { /* skip corrupt sessions */ }
      }

      await writeFile(
        result.filePath,
        JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sessions }, null, 2),
        'utf-8'
      )
      return { ok: true, count: sessions.length, filePath: result.filePath }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('session:fork', async (_, { sourceSessionId, upToMessageIndex, newTitle }: { sourceSessionId: string; upToMessageIndex: number; newTitle?: string }) => {
    if (!validateSessionId(sourceSessionId)) return { error: 'Invalid session ID' }

    try {
      const sourcePath = join(sessionsDir, sourceSessionId + '.json')
      const raw = await readFile(sourcePath, 'utf-8')
      const sourceSession = JSON.parse(raw) as StoredSession

      const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const messages = (sourceSession.messages ?? []).slice(0, upToMessageIndex + 1)

      const title = newTitle ?? `${sourceSession.title ?? '세션'} (분기)`
      const now = Date.now()

      const newSession: StoredSession & { forkedFrom?: string; forkedAtMessage?: number } = {
        id: newId,
        title,
        cwd: sourceSession.cwd,
        model: sourceSession.model,
        messages,
        createdAt: now,
        updatedAt: now,
        forkedFrom: sourceSessionId,
        forkedAtMessage: upToMessageIndex,
      }

      const newPath = join(sessionsDir, newId + '.json')
      await writeFile(newPath, JSON.stringify(newSession, null, 2), 'utf-8')

      const index = await readIndex()
      const meta: SessionMeta = {
        id: newId,
        title,
        cwd: sourceSession.cwd,
        model: sourceSession.model,
        updatedAt: now,
        createdAt: now,
        messageCount: messages.length,
        forkedFrom: sourceSessionId,
      }
      index.unshift(meta)
      await writeIndex(index)

      return { ok: true, newSessionId: newId }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('session:duplicate', async (_, { sessionId }: { sessionId: string }) => {
    if (!validateSessionId(sessionId)) return { success: false, error: 'Invalid session ID' }
    try {
      const srcPath = join(sessionsDir, `${sessionId}.json`)
      if (!await fileExists(srcPath)) return { success: false, error: 'Session not found' }
      const raw = JSON.parse(await readFile(srcPath, 'utf-8')) as StoredSession & { pinned?: boolean; tags?: string[] }

      const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const newTitle = `${raw.title ?? '세션'} (복사본)`
      const now = Date.now()

      const newSession = {
        ...raw,
        id: newId,
        title: newTitle,
        createdAt: now,
        updatedAt: now,
        pinned: undefined,
      }
      const dstPath = join(sessionsDir, `${newId}.json`)
      await writeFile(dstPath, JSON.stringify(newSession, null, 2), 'utf-8')

      const index = await readIndex()
      const srcMeta = index.find(s => s.id === sessionId)
      const newMeta: SessionMeta = {
        id: newId,
        title: newTitle,
        cwd: raw.cwd,
        model: raw.model,
        updatedAt: now,
        createdAt: now,
        messageCount: (raw.messages ?? []).length,
        tags: srcMeta?.tags,
      }
      index.unshift(newMeta)
      await writeIndex(index)

      return { success: true, sessionId: newId }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('session:globalStats', async () => {
    const sessions = await readIndex()
    const totalSessions = sessions.length

    const tagCounts: Record<string, number> = {}
    for (const s of sessions) {
      for (const tag of s.tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    const now = Date.now()
    const dailyCounts: number[] = Array(7).fill(0)
    const dailyMessageCounts: number[] = Array(7).fill(0)
    const dailyCountsMap: Record<string, number> = {}
    for (const s of sessions) {
      const ts = s.updatedAt ?? s.createdAt ?? 0
      const dayAgo = Math.floor((now - ts) / 86400000)
      if (dayAgo >= 0 && dayAgo < 7) {
        dailyCounts[6 - dayAgo]++
        dailyMessageCounts[6 - dayAgo] += s.messageCount ?? 0
      }
      if (dayAgo >= 0 && dayAgo < 84) {
        const d = new Date(ts)
        const key = d.toISOString().slice(0, 10)
        dailyCountsMap[key] = (dailyCountsMap[key] ?? 0) + 1
      }
    }

    const recentCount = sessions.filter(s => {
      const ts = s.updatedAt ?? s.createdAt ?? 0
      return now - ts < 7 * 86400000
    }).length

    const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount ?? 0), 0)
    const avgMessagesPerSession = totalSessions === 0
      ? 0
      : Math.round((totalMessages / totalSessions) * 10) / 10
    const topSessions = [...sessions]
      .sort((a, b) => (b.messageCount ?? 0) - (a.messageCount ?? 0))
      .slice(0, 5)
      .map(s => ({ id: s.id, title: s.title, messageCount: s.messageCount ?? 0 }))

    return { totalSessions, topTags, dailyCounts, dailyCountsMap, recentCount, totalMessages, avgMessagesPerSession, dailyMessageCounts, topSessions }
  })

  ipcMain.handle('session:stats', async (_, { id }: { id: string }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { error: 'Invalid ID' }
    try {
      const sessionPath = join(sessionsDir, id + '.json')
      const raw = await readFile(sessionPath, 'utf-8')
      const session = JSON.parse(raw)
      const messages = session.messages ?? []

      const userMessages = messages.filter((m: { role: string }) => m.role === 'user').length
      const assistantMessages = messages.filter((m: { role: string }) => m.role === 'assistant').length
      const totalChars = messages.reduce((sum: number, m: { content?: string; text?: string }) => sum + (m.content ?? m.text ?? '').length, 0)
      const estimatedTokens = Math.round(totalChars / 4)

      return {
        userMessages,
        assistantMessages,
        totalMessages: messages.length,
        estimatedTokens,
        createdAt: session.meta?.createdAt ?? null,
        updatedAt: session.meta?.updatedAt ?? null,
      }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('session:exportMarkdown', async (_, { sessionId }: { sessionId: string }) => {
    if (!validateSessionId(sessionId)) return { success: false, error: 'Invalid session ID' }
    try {
      const sessionPath = join(sessionsDir, `${sessionId}.json`)
      if (!await fileExists(sessionPath)) return { success: false, error: 'Session not found' }
      const raw = JSON.parse(await readFile(sessionPath, 'utf-8')) as StoredSession

      const messages = (raw.messages ?? []) as Array<{ role?: string; content?: string; text?: string }>
      const lines: string[] = []
      lines.push(`# ${raw.title ?? raw.id ?? 'Session'}`)
      lines.push(`> 내보낸 날짜: ${new Date().toISOString()}`)
      lines.push(`> 총 메시지: ${messages.length}개`)
      lines.push('')
      lines.push('---')
      lines.push('')

      for (const msg of messages) {
        const roleLabel = msg.role === 'user' ? '## 👤 사용자' : '## 🤖 어시스턴트'
        const text = (msg.content ?? msg.text ?? '') as string
        lines.push(roleLabel)
        lines.push('')
        lines.push(text)
        lines.push('')
        lines.push('---')
        lines.push('')
      }

      const markdown = lines.join('\n')

      const win = BrowserWindow.getAllWindows()[0]
      const result = await dialog.showSaveDialog(win, {
        defaultPath: `session-${sessionId.slice(0, 8)}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })

      if (!result.canceled && result.filePath) {
        await writeFile(result.filePath, markdown, 'utf-8')
        return { success: true, filePath: result.filePath }
      }
      return { success: false }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('session:exportPdf', async (_, { sessionId }: { sessionId: string }) => {
    if (!validateSessionId(sessionId)) return { success: false, error: 'Invalid session ID' }
    try {
      const sessionPath = join(sessionsDir, `${sessionId}.json`)
      if (!await fileExists(sessionPath)) return { success: false, error: 'Session not found' }
      const raw = JSON.parse(await readFile(sessionPath, 'utf-8')) as StoredSession

      const messages = (raw.messages ?? []) as Array<{ role?: string; content?: string; text?: string }>
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; color: #1e1e1e; }
h1 { font-size: 20px; border-bottom: 2px solid #ccc; padding-bottom: 8px; }
.msg { margin-bottom: 20px; padding: 12px; border-radius: 8px; }
.user { background: #f0f0f0; }
.assistant { background: #fff; border: 1px solid #e0e0e0; }
.role { font-weight: bold; font-size: 12px; color: #666; margin-bottom: 6px; }
pre { background: #f8f8f8; padding: 10px; border-radius: 4px; overflow-wrap: break-word; white-space: pre-wrap; }
</style>
</head>
<body>
<h1>${(raw.title ?? 'Session').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
<p style="color:#888;font-size:12px">${new Date(raw.createdAt ?? Date.now()).toLocaleString('ko-KR')}</p>
${messages.map(m => `<div class="msg ${m.role === 'user' ? 'user' : 'assistant'}">
<div class="role">${m.role === 'user' ? 'User' : 'Claude'}</div>
<div>${(m.content ?? m.text ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
</div>`).join('\n')}
</body>
</html>`

      const tmpHtml = join(app.getPath('temp'), `session-${sessionId}.html`)
      await writeFile(tmpHtml, htmlContent, 'utf-8')

      const win = BrowserWindow.getAllWindows()[0]
      const result = await dialog.showSaveDialog(win, {
        defaultPath: `session-${(raw.title ?? sessionId).slice(0, 20).replace(/[/\\?%*:|"<>]/g, '_')}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })

      if (result.canceled || !result.filePath) {
        try { await unlink(tmpHtml) } catch {}
        return { success: false }
      }

      const pdfWin = new BrowserWindow({ show: false })
      await pdfWin.loadFile(tmpHtml)
      const pdfData = await pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 1, bottom: 1, left: 1, right: 1 },
      })
      pdfWin.destroy()

      await writeFile(result.filePath, pdfData)
      try { await unlink(tmpHtml) } catch {}

      return { success: true, filePath: result.filePath }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('session:getNote', async (_, { sessionId }: { sessionId: string }) => {
    if (!validateSessionId(sessionId)) return { note: '' }
    const sessionPath = join(sessionsDir, `${sessionId}.json`)
    try {
      const raw = JSON.parse(await readFile(sessionPath, 'utf-8'))
      return { note: raw.note ?? '' }
    } catch {
      return { note: '' }
    }
  })

  ipcMain.handle('session:setNote', async (_, { sessionId, note }: { sessionId: string; note: string }) => {
    if (!validateSessionId(sessionId)) return { success: false }
    const sessionPath = join(sessionsDir, `${sessionId}.json`)
    try {
      const raw = JSON.parse(await readFile(sessionPath, 'utf-8'))
      raw.note = note
      await writeFile(sessionPath, JSON.stringify(raw, null, 2), 'utf-8')
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('session:setLocked', async (_, { id, locked }: { id: string; locked: boolean }) => {
    if (!validateSessionId(id)) return false
    const filePath = join(sessionsDir, `${id}.json`)
    if (!await fileExists(filePath)) return false
    const raw = JSON.parse(await readFile(filePath, 'utf-8'))
    raw.locked = locked
    await writeFile(filePath, JSON.stringify(raw, null, 2), 'utf-8')
    const idx = await readIndex()
    const entry = idx.find((e: SessionMeta) => e.id === id)
    if (entry) { (entry as SessionMeta & { locked?: boolean }).locked = locked; await writeIndex(idx) }
    return true
  })

  ipcMain.handle('session:setCollection', async (_, { id, collection }: { id: string; collection: string | null }) => {
    if (!validateSessionId(id)) {
      throw new Error('Invalid session ID')
    }
    const filePath = join(sessionsDir, `${id}.json`)
    // R2314: ISSUE-002 — readFile 예외 처리 (파일 삭제/권한 오류 시 UI 무응답 방지)
    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(await readFile(filePath, 'utf-8'))
    } catch (e) {
      throw new Error(`세션 파일 읽기 실패: ${String(e)}`)
    }
    if (collection) raw.collection = collection
    else delete raw.collection
    await writeFile(filePath, JSON.stringify(raw))
    const idx = await readIndex()
    const entry = idx.find((e: SessionMeta) => e.id === id)
    if (entry) {
      if (collection) entry.collection = collection
      else delete entry.collection
      await writeIndex(idx)
    }
  })

  ipcMain.handle('session:merge', async (_, sourceId: string, targetId: string) => {
    if (!validateSessionId(sourceId) || !validateSessionId(targetId)) return { ok: false, error: 'Invalid session ID' }
    if (sourceId === targetId) return { ok: false, error: 'Source and target must be different' }
    try {
      const sourcePath = join(sessionsDir, `${sourceId}.json`)
      const targetPath = join(sessionsDir, `${targetId}.json`)
      if (!await fileExists(sourcePath)) return { ok: false, error: `Source session not found: ${sourceId}` }
      if (!await fileExists(targetPath)) return { ok: false, error: `Target session not found: ${targetId}` }

      const source = JSON.parse(await readFile(sourcePath, 'utf-8')) as StoredSession
      const target = JSON.parse(await readFile(targetPath, 'utf-8')) as StoredSession

      const mergedMessages = [...(target.messages ?? []), ...(source.messages ?? [])]
      const now = Date.now()

      const updatedTarget: StoredSession = {
        ...target,
        messages: mergedMessages,
        updatedAt: now,
      }

      await writeFile(targetPath, JSON.stringify(updatedTarget, null, 2), 'utf-8')

      // Delete source file
      await unlink(sourcePath)

      // Update index: remove source, update target messageCount
      const index = await readIndex()
      const filteredIndex = index.filter(s => s.id !== sourceId)
      const targetEntry = filteredIndex.find(s => s.id === targetId)
      if (targetEntry) {
        targetEntry.messageCount = mergedMessages.length
        targetEntry.updatedAt = now
      }
      await writeIndex(filteredIndex)

      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('session:saveAsTemplate', async (_, { sessionId, templateName }: { sessionId: string; templateName?: string }) => {
    if (!validateSessionId(sessionId)) return { error: 'Invalid session ID' }
    try {
      const sessionPath = join(sessionsDir, `${sessionId}.json`)
      if (!await fileExists(sessionPath)) return { error: 'Session not found' }
      const session = JSON.parse(await readFile(sessionPath, 'utf-8')) as StoredSession & { systemPrompt?: string }

      await ensureTemplatesDir()
      const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const name = (templateName ?? session.title ?? 'Untitled').trim() || 'Untitled'
      const now = Date.now()

      const template = {
        id: templateId,
        name,
        description: '',
        createdAt: now,
        messages: session.messages ?? [],
        systemPrompt: session.systemPrompt,
      }
      await writeFile(join(templatesDir, `${templateId}.json`), JSON.stringify(template, null, 2), 'utf-8')

      const index = await readTemplatesIndex()
      const meta: TemplateMeta = { id: templateId, name, description: '', createdAt: now, messageCount: (session.messages ?? []).length }
      index.push(meta)
      await writeTemplatesIndex(index)

      return { templateId }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('session:listTemplates', async () => {
    await ensureTemplatesDir()
    return await readTemplatesIndex()
  })

  ipcMain.handle('session:createFromTemplate', async (_, { templateId }: { templateId: string }) => {
    if (!SESSION_ID_RE.test(templateId)) return { error: 'Invalid template ID' }
    try {
      const tplPath = join(templatesDir, `${templateId}.json`)
      if (!await fileExists(tplPath)) return { error: 'Template not found' }
      const tpl = JSON.parse(await readFile(tplPath, 'utf-8')) as { id: string; name: string; messages: unknown[]; systemPrompt?: string }

      const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const now = Date.now()
      const newSession: StoredSession & { systemPrompt?: string } = {
        id: newId,
        title: tpl.name,
        cwd: '',
        model: '',
        messages: tpl.messages ?? [],
        createdAt: now,
        updatedAt: now,
        systemPrompt: tpl.systemPrompt,
      }
      await ensureDir()
      await writeFile(join(sessionsDir, `${newId}.json`), JSON.stringify(newSession, null, 2), 'utf-8')

      const index = await readIndex()
      const meta: SessionMeta = {
        id: newId,
        title: tpl.name,
        cwd: '',
        model: '',
        updatedAt: now,
        createdAt: now,
        messageCount: (tpl.messages ?? []).length,
      }
      index.unshift(meta)
      await writeIndex(index)

      return { sessionId: newId }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('session:deleteTemplate', async (_, { templateId }: { templateId: string }) => {
    if (!SESSION_ID_RE.test(templateId)) return { error: 'Invalid template ID' }
    try {
      const tplPath = join(templatesDir, `${templateId}.json`)
      if (await fileExists(tplPath)) await unlink(tplPath)
      const index = await readTemplatesIndex()
      await writeTemplatesIndex(index.filter(t => t.id !== templateId))
      return { ok: true }
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('session:importBackup', async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0]
      const result = await dialog.showOpenDialog(win, {
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        properties: ['openFile'],
      })
      if (result.canceled || !result.filePaths[0]) return { canceled: true }

      const raw = await readFile(result.filePaths[0], 'utf-8')
      const backup = JSON.parse(raw) as { sessions?: unknown[] }
      if (!backup.sessions || !Array.isArray(backup.sessions)) {
        return { error: '유효하지 않은 백업 파일입니다' }
      }

      await ensureDir()
      let imported = 0
      for (const session of backup.sessions) {
        const s = session as { meta?: { id?: string }; id?: string }
        const id = s.meta?.id ?? s.id
        if (!id || typeof id !== 'string') continue
        if (!validateSessionId(id)) continue
        const sessionPath = join(sessionsDir, id + '.json')
        if (await fileExists(sessionPath)) continue
        await writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8')
        imported++
      }

      // Rebuild index from disk to pick up newly imported sessions
      const newIndex = await buildIndexFromDisk()
      await writeIndex(newIndex)
      return { ok: true, imported }
    } catch (e) {
      return { error: String(e) }
    }
  })

  // session:searchAll — 모든 세션 파일에서 메시지 텍스트 검색
  ipcMain.handle('session:searchAll', async (_, query: string) => {
    if (!query || query.length < 2) return []

    const index = await readIndex()
    const q = query.toLowerCase()
    const results: Array<{
      sessionId: string
      sessionTitle: string
      messageIndex: number
      role: string
      excerpt: string
      updatedAt: number
    }> = []

    // 세션 수가 많으면 성능 문제 → 최근 100개만 검색
    const sessionsToSearch = [...index]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 100)

    for (const meta of sessionsToSearch) {
      const filePath = join(sessionsDir, `${meta.id}.json`)
      if (!await fileExists(filePath)) continue
      try {
        const session = JSON.parse(await readFile(filePath, 'utf-8'))
        const messages: { text?: unknown; role?: unknown }[] = session.messages ?? []
        messages.forEach((msg, idx) => {
          const text = typeof msg.text === 'string' ? msg.text : ''
          if (text.toLowerCase().includes(q)) {
            // excerpt: 검색어 주변 80자
            const pos = text.toLowerCase().indexOf(q)
            const start = Math.max(0, pos - 40)
            const end = Math.min(text.length, pos + query.length + 40)
            const excerpt = (start > 0 ? '\u2026' : '') + text.slice(start, end) + (end < text.length ? '\u2026' : '')
            results.push({
              sessionId: meta.id,
              sessionTitle: meta.title ?? 'Untitled',
              messageIndex: idx,
              role: typeof msg.role === 'string' ? msg.role : 'assistant',
              excerpt,
              updatedAt: meta.updatedAt ?? 0,
            })
          }
        })
      } catch {
        // 파일 읽기 실패 시 스킵
      }
      if (results.length >= 50) break  // 최대 50건
    }

    return results
  })
}
