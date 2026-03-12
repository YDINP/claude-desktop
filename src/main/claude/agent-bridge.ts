import type { BrowserWindow } from 'electron'

const IPC_CLAUDE_MESSAGE = 'claude:message'

let sdkQuery: ((...args: unknown[]) => AsyncIterable<unknown>) | null = null
const IPC_CLAUDE_PERMISSION = 'claude:permission'

type PermissionResolver = (allow: boolean) => void
type PendingPermissionEntry = { resolve: PermissionResolver; toolName: string }

export class AgentBridge {
  private win: BrowserWindow
  private currentSessionId: string | null = null
  private pendingPermissions = new Map<string, PendingPermissionEntry>()
  private sessionAllowlist = new Set<string>()
  private abortController: AbortController | null = null
  private currentCwd: string = process.env.HOME || process.env.USERPROFILE || 'C:\\Users'
  private systemPrompt: string = ''
  private temperature: number = 1.0

  constructor(win: BrowserWindow) {
    this.win = win
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt
  }

  setTemperature(temp: number): void {
    this.temperature = Math.max(0, Math.min(1, temp))
  }

  async sendMessage(text: string, cwd: string, model: string = 'claude-opus-4-6') {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.currentCwd = cwd
    this.abortController = new AbortController()

    try {
      if (!sdkQuery) {
        const sdk = await import('@anthropic-ai/claude-agent-sdk')
        sdkQuery = sdk.query as typeof sdkQuery
      }

      const options: Record<string, unknown> = {
        cwd,
        model,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
        permissionMode: 'default',
        includePartialMessages: true,
        canUseTool: (toolName: string, input: unknown) => this.handlePermission(toolName, input),
        ...(this.systemPrompt ? { systemPrompt: this.systemPrompt } : {}),
        ...(this.temperature !== 1.0 ? { temperature: this.temperature } : {}),
      }

      if (this.currentSessionId) {
        options.resume = this.currentSessionId
      }

      for await (const msg of sdkQuery!({ prompt: text, options })) {
        this.processMessage(msg as Record<string, unknown>)
        if (this.abortController.signal.aborted) break
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      this.emit({ type: 'error', message: String(err) })
    }
  }

  private processMessage(msg: Record<string, unknown>) {
    const type = msg.type as string
    const subtype = msg.subtype as string | undefined

    if (type === 'system' && subtype === 'init') {
      this.currentSessionId = msg.session_id as string
      this.emit({ type: 'init', sessionId: this.currentSessionId })
      return
    }

    if (type === 'assistant') {
      const message = msg.message as Record<string, unknown>
      const content = message?.content as unknown[]
      if (!content) return

      for (const block of content) {
        const b = block as Record<string, unknown>
        if (b.type === 'text') {
          this.emit({ type: 'text', text: b.text as string })
        } else if (b.type === 'tool_use') {
          this.emit({
            type: 'tool_start',
            toolId: b.id as string,
            toolName: b.name as string,
            toolInput: b.input
          })
        }
      }
      return
    }

    if (type === 'tool_result') {
      const toolUseId = msg.tool_use_id as string
      const content = msg.content as unknown[]
      const textContent = content?.find((c) => (c as Record<string, unknown>).type === 'text')
      this.emit({
        type: 'tool_end',
        toolId: toolUseId,
        toolOutput: (textContent as Record<string, unknown>)?.text as string ?? '',
        isError: msg.is_error as boolean ?? false
      })
      return
    }

    if (type === 'result') {
      this.emit({
        type: 'result',
        costUsd: msg.total_cost_usd as number ?? 0,
        inputTokens: msg.usage ? (msg.usage as Record<string, number>).input_tokens ?? 0 : 0,
        outputTokens: msg.usage ? (msg.usage as Record<string, number>).output_tokens ?? 0 : 0,
      })
      return
    }
  }

  private async handlePermission(toolName: string, input: unknown): Promise<boolean> {
    if (this.sessionAllowlist.has(toolName)) {
      return true
    }
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2, 10)
      this.pendingPermissions.set(requestId, { resolve, toolName })
      this.win.webContents.send(IPC_CLAUDE_PERMISSION, { requestId, toolName, input })
    })
  }

  replyPermission(requestId: string, allow: boolean, allowSession?: boolean) {
    const entry = this.pendingPermissions.get(requestId)
    if (entry) {
      if (allowSession && allow) {
        this.sessionAllowlist.add(entry.toolName)
      }
      entry.resolve(allow)
      this.pendingPermissions.delete(requestId)
    }
  }

  interrupt() {
    this.abortController?.abort()
    this.emit({ type: 'interrupted' })
  }

  getSessionId() {
    return this.currentSessionId
  }

  resetSession() {
    this.currentSessionId = null
    this.sessionAllowlist.clear()
  }

  resumeSession(sessionId: string) {
    this.currentSessionId = sessionId
  }

  private emit(event: Record<string, unknown>) {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send(IPC_CLAUDE_MESSAGE, event)
    }
  }
}
