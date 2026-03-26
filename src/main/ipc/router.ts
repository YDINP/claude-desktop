import type { BrowserWindow } from 'electron'
import { AgentBridge } from '../claude/agent-bridge'
import { PtyManager } from '../terminal/pty-manager'
import { registerClaudeHandlers } from './claude-handlers'
import { registerTerminalHandlers } from './terminal-handlers'
import { registerFsHandlers } from './fs-handlers'
import { registerSessionHandlers } from './session-handlers'
import { registerCCHandlers } from './cc-handlers'
import { registerCCFileHandlers } from './cc-file-handlers'
import { registerOllamaHandlers } from './ollama-handlers'
import { registerOpenAIHandlers } from './openai-handlers'
import { registerCommandHandlers } from './command-handlers'
import { registerFeatureHandlers } from './feature-handlers'

export function registerAllHandlers(win: BrowserWindow) {
  const agentBridge = new AgentBridge(win)
  const ptyManager = new PtyManager(win)

  registerClaudeHandlers(agentBridge)
  registerTerminalHandlers(ptyManager)
  registerFsHandlers(win)
  registerSessionHandlers()
  registerCCHandlers(win)
  registerCCFileHandlers(win)
  registerOllamaHandlers(win)
  registerOpenAIHandlers(win)
  registerCommandHandlers()
  registerFeatureHandlers()

  win.on('closed', () => {
    ptyManager.closeAll()
  })
}
