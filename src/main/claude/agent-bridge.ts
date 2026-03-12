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
  private textBatch = ''
  private textFlushTimer: ReturnType<typeof setTimeout> | null = null
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

      try {
        for await (const msg of sdkQuery!({ prompt: text, options })) {
          this.processMessage(msg as Record<string, unknown>)
          if (this.abortController.signal.aborted) break
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        // resume 실패(포크된 세션 등) 시 세션 없이 재시도
        const errMsg = String(err)
        if (this.currentSessionId && (errMsg.includes('exit') || errMsg.includes('code 1') || errMsg.includes('session'))) {
          this.currentSessionId = null
          delete options.resume
          try {
            for await (const m of sdkQuery!({ prompt: text, options })) {
              this.processMessage(m as Record<string, unknown>)
              if (this.abortController.signal.aborted) break
            }
          } catch (err2: unknown) {
            if (!(err2 instanceof Error && err2.name === 'AbortError')) {
              this.emit({ type: 'error', message: String(err2) })
            }
          }
        } else {
          this.emit({ type: 'error', message: errMsg })
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      this.emit({ type: 'error', message: String(err) })
    }
  }

  private flushTextBatch(): void {
    if (this.textFlushTimer !== null) {
      clearTimeout(this.textFlushTimer)
      this.textFlushTimer = null
    }
    if (this.textBatch) {
      this.emit({ type: 'text_delta', text: this.textBatch })
      this.textBatch = ''
    }
  }

  private processMessage(msg: Record<string, unknown>) {
    const type = msg.type as string
    const subtype = msg.subtype as string | undefined

    if (type === 'system') {
      if (subtype === 'init') {
        this.currentSessionId = msg.session_id as string
        this.emit({ type: 'init', sessionId: this.currentSessionId })
      } else if (subtype === 'status') {
        // compacting 상태 알림
        this.emit({ type: 'status', status: msg.status ?? null })
      }
      // compact_boundary, hook_response 등은 무시
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
        } else if (b.type === 'thinking') {
          // Extended Thinking 블록
          this.emit({ type: 'thinking', text: b.thinking as string ?? '' })
        } else if (b.type === 'tool_use') {
          this.emit({
            type: 'tool_start',
            toolId: b.id as string,
            toolName: b.name as string,
            toolInput: b.input
          })
        }
      }

      // assistant-level error (e.g. authentication_failed, rate_limit)
      if (msg.error) {
        this.emit({ type: 'error', message: String(msg.error) })
      }
      return
    }

    // SDK wraps tool results inside a 'user' message with content array
    if (type === 'user') {
      const message = msg.message as Record<string, unknown> | undefined
      const content = (message?.content ?? msg.content) as unknown[]
      if (!Array.isArray(content)) return
      for (const item of content) {
        const it = item as Record<string, unknown>
        if (it.type === 'tool_result') {
          const toolUseId = it.tool_use_id as string
          const toolContent = it.content as unknown[]
          const textBlock = Array.isArray(toolContent)
            ? toolContent.find((c) => (c as Record<string, unknown>).type === 'text')
            : undefined
          this.emit({
            type: 'tool_end',
            toolId: toolUseId,
            toolOutput: (textBlock as Record<string, unknown> | undefined)?.text as string ?? '',
            isError: it.is_error as boolean ?? false
          })
        }
      }
      return
    }

    // Legacy direct tool_result (kept for compatibility)
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

    if (type === 'tool_progress') {
      // 툴 실행 중 진행 상황
      this.emit({
        type: 'tool_progress',
        toolId: msg.tool_use_id as string,
        toolName: msg.tool_name as string,
        elapsedSeconds: msg.elapsed_time_seconds as number ?? 0,
      })
      return
    }

    // stream_event: includePartialMessages=true 일 때 오는 raw 스트리밍 이벤트
    if (type === 'stream_event') {
      const event = msg.event as Record<string, unknown> | undefined
      if (!event) return
      const evType = event.type as string

      if (evType === 'content_block_delta') {
        const delta = event.delta as Record<string, unknown> | undefined
        if (!delta) return
        if (delta.type === 'text_delta') {
          // 스트리밍 텍스트 delta — 16ms 배치 후 전송
          this.textBatch += (delta.text as string) ?? ''
          if (this.textFlushTimer === null) {
            this.textFlushTimer = setTimeout(() => {
              this.textFlushTimer = null
              if (this.textBatch) {
                this.emit({ type: 'text_delta', text: this.textBatch })
                this.textBatch = ''
              }
            }, 16)
          }
        } else if (delta.type === 'thinking_delta') {
          this.emit({ type: 'thinking_delta', text: delta.thinking as string ?? '' })
        } else if (delta.type === 'input_json_delta') {
          this.emit({ type: 'input_json_delta', partial: delta.partial_json as string ?? '' })
        }
      } else if (evType === 'message_delta') {
        const usage = event.usage as Record<string, number> | undefined
        if (usage) {
          this.emit({
            type: 'usage',
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
          })
        }
      } else if (evType === 'ping') {
        console.log('[agent-bridge] ping received')
      } else if (evType === 'error') {
        const err = event.error as Record<string, unknown> | undefined
        const errType = err?.type as string ?? ''
        if (errType === 'overloaded_error') {
          console.warn('[agent-bridge] API overloaded — stream error')
          this.emit({ type: 'error', message: 'API overloaded. Please retry later.' })
        } else {
          this.emit({ type: 'error', message: err?.message as string ?? String(event) })
        }
      }
      return
    }

    if (type === 'result') {
      const subtype2 = msg.subtype as string | undefined
      const isErrorResult = subtype2 && subtype2 !== 'success'
      if (isErrorResult) {
        const errors = msg.errors as string[] | undefined
        const errMsg = errors?.join('; ') ?? `Session ended: ${subtype2}`
        this.emit({ type: 'error', message: errMsg })
      }
      this.flushTextBatch()
      this.emit({
        type: 'result',
        costUsd: msg.total_cost_usd as number ?? 0,
        inputTokens: msg.usage ? (msg.usage as Record<string, number>).input_tokens ?? 0 : 0,
        outputTokens: msg.usage ? (msg.usage as Record<string, number>).output_tokens ?? 0 : 0,
      })
      return
    }

    if (type === 'auth_status') {
      if (msg.error) {
        this.emit({ type: 'error', message: `Auth error: ${msg.error}` })
      }
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
