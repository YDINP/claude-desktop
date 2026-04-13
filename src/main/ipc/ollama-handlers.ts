import { ipcMain, type BrowserWindow } from 'electron'
import { ollamaListModels, ollamaChat } from '../ollama/ollama-bridge'

const IPC_CLAUDE_MESSAGE = 'claude:message'

let abortController: AbortController | null = null

export function registerOllamaHandlers(win: BrowserWindow): void {
  ipcMain.handle('ollama:list', async () => {
    return ollamaListModels()
  })

  ipcMain.on('ollama:send', (_, { model, messages }: { model: string; messages: Array<{ role: string; content: string }> }) => {
    if (abortController) abortController.abort()
    abortController = new AbortController()

    const runId = `ollama-${Date.now()}`
    win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'init', sessionId: runId })
    win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'run_started', runId, timestamp: Date.now() })

    ollamaChat(
      model,
      messages,
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
          win.webContents.send(IPC_CLAUDE_MESSAGE, { type: 'error', message: `Ollama error: ${err}` })
        }
        abortController = null
      },
      abortController.signal,
    )
  })

  ipcMain.on('ollama:interrupt', () => {
    abortController?.abort()
    abortController = null
  })
}
