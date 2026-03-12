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

// ── Cocos Creator Integration ─────────────────────────────
export const CC_CONNECT = 'cc:connect'
export const CC_DISCONNECT = 'cc:disconnect'
export const CC_STATUS = 'cc:status'
export const CC_GET_TREE = 'cc:getTree'
export const CC_GET_NODE = 'cc:getNode'
export const CC_SET_PROPERTY = 'cc:setProperty'
export const CC_MOVE_NODE = 'cc:moveNode'
export const CC_BUILD_WEB = 'cc:buildWeb'
export const CC_BUILD_STATUS = 'cc:buildStatus'
export const CC_EVENT = 'cc:event'

export interface CCNode {
  uuid: string
  name: string
  active: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  anchor: { x: number; y: number }
  scale: { x: number; y: number }
  rotation: number
  opacity: number
  color: { r: number; g: number; b: number; a: number }
  children: CCNode[]
  components: { type: string; props?: Record<string, unknown> }[]
}

export interface CCEvent {
  type: 'connected' | 'scene:ready' | 'scene:saved' | 'node:select' | 'node:deselect'
  uuids?: string[]
  version?: string
}

export interface CCStatus {
  connected: boolean
  port: number
  version: string
  clientCount?: number
}

export interface CanvasSize {
  width: number
  height: number
}

export const CC_DETECT_PROJECT = 'cc:detectProject'
export const CC_GET_PORT = 'cc:getPort'
export const CC_SET_PORT = 'cc:setPort'
export const CC_INSTALL_EXTENSION = 'cc:installExtension'
export const CC_GET_CANVAS_SIZE = 'cc:getCanvasSize'
export const CC_GET_ASSETS = 'cc:get-assets'

export interface AssetItem {
  name: string
  path: string
  type: 'folder' | 'script' | 'prefab' | 'texture' | 'scene' | 'audio' | 'atlas' | 'font' | 'json' | 'text' | 'animation' | 'material' | 'file'
  children?: AssetItem[]
}

export interface AssetTree {
  tree: AssetItem[]
  root?: string
  error?: string
}

export interface CCProjectInfo {
  detected: boolean
  version?: '2x' | '3x'
  port?: number
  name?: string
}

// ── AG-UI Protocol Events ─────────────────────────────────────────────────────
export interface AguiRunStarted {
  type: 'run_started'
  runId: string
  timestamp: number
}

export interface AguiStepStarted {
  type: 'step_started'
  runId: string
  stepId: string
  stepName: string
  timestamp: number
}

export interface AguiStepFinished {
  type: 'step_finished'
  runId: string
  stepId: string
  success: boolean
  timestamp: number
}

export interface AguiRunFinished {
  type: 'run_finished'
  runId: string
  costUsd: number
  timestamp: number
}

export type AguiEvent = AguiRunStarted | AguiStepStarted | AguiStepFinished | AguiRunFinished
