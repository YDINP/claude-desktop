import { ipcMain, app, type BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import { openaiChat } from '../providers/openai-bridge'

const IPC_CLAUDE_MESSAGE = 'claude:message'

let abortController: AbortController | null = null

function readOpenAIApiKey(): string {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { openaiApiKey?: string }
    return settings.openaiApiKey ?? ''
  } catch {
    return ''
  }
}

export function registerOpenAIHandlers(win: BrowserWindow): void {
  ipcMain.on('openai:send', (_, { model, messages }: { model: string; messages: Array<{ role: string; content: string }> }) => {
    if (abortController) abortController.abort()
    abortController = new AbortController()

    const apiKey = readOpenAIApiKey()
    if (!apiKey) {
      win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'error', message: 'OpenAI API 키가 설정되지 않았습니다. settings.json에 openaiApiKey를 추가해주세요.' })
      abortController = null
      return
    }

    const runId = `openai-${Date.now()}`
    win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'init', sessionId: runId })
    win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'run_started', runId, timestamp: Date.now() })

    openaiChat(
      model,
      messages,
      apiKey,
      (text) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'text_delta', text })
        }
      },
      (fullText) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'text', text: fullText })
          win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'run_finished', runId, costUsd: 0, timestamp: Date.now() })
          win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'result', costUsd: 0, inputTokens: 0, outputTokens: 0 })
        }
        abortController = null
      },
      (err) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'error', message: `OpenAI error: ${err}` })
        }
        abortController = null
      },
      abortController.signal,
    )
  })

  ipcMain.on('openai:interrupt', () => {
    abortController?.abort()
    abortController = null
  })
}
