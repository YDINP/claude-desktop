export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

export interface SessionInfo {
  id: string
  cwd: string
  createdAt: number
  updatedAt: number
  summary?: string
}

export type StreamEventType =
  | 'init'
  | 'text'
  | 'text_delta'
  | 'tool_start'
  | 'tool_end'
  | 'result'
  | 'error'

export interface StreamEvent {
  type: StreamEventType
  sessionId?: string
  text?: string
  toolId?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: string
  isError?: boolean
  costUsd?: number
  message?: string
}

export interface PermissionRequest {
  requestId: string
  toolName: string
  input: unknown
}

export const IPC = {
  // Claude Agent
  CLAUDE_START: 'claude:start',
  CLAUDE_SEND: 'claude:send',
  CLAUDE_MESSAGE: 'claude:message',
  CLAUDE_INTERRUPT: 'claude:interrupt',
  CLAUDE_CLOSE: 'claude:close',
  CLAUDE_PERMISSION: 'claude:permission',
  CLAUDE_PERMISSION_REPLY: 'claude:permission-reply',
  CLAUDE_SESSIONS: 'claude:sessions',
  CLAUDE_RESUME: 'claude:resume',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',

  // File System
  FS_READ_DIR: 'fs:read-dir',
  FS_READ_FILE: 'fs:read-file',
  FS_CHANGE: 'fs:change',

  // Project
  PROJECT_OPEN: 'project:open',
  PROJECT_RECENT: 'project:recent',
  PROJECT_CURRENT: 'project:current',
  PROJECT_SET: 'project:set',
} as const
