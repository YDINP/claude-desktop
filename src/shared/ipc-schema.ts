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
export const CC_SET_COMP_PROP = 'cc:setComponentProp'

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

// ── CC File-based Engine (Phase A) ────────────────────────────────────────────
export const CC_FILE_DETECT = 'cc:file:detect'
export const CC_FILE_OPEN_PROJECT = 'cc:file:openProject'
export const CC_FILE_LIST_SCENES = 'cc:file:listScenes'
export const CC_FILE_READ_SCENE = 'cc:file:readScene'
export const CC_FILE_SAVE_SCENE = 'cc:file:saveScene'

/** 파일 기반 CC 프로젝트 정보 (Phase A) */
export interface CCFileProjectInfo {
  detected: boolean
  version?: '2x' | '3x'
  creatorVersion?: string
  name?: string
  projectPath?: string
  assetsDir?: string
  scenes?: string[]
  port?: number
}

export interface CCVec2 { x: number; y: number }
export interface CCVec3 { x: number; y: number; z: number }
export interface CCColor { r: number; g: number; b: number; a: number }

export interface CCSceneComponent {
  type: string
  props: Record<string, unknown>
  /** raw 배열 내 인덱스 (저장 시 패치용) */
  _rawIndex?: number
}

/**
 * 통합 씬 노드 타입 — SSOT (QA C-3/C-4 해결)
 * CC 2.x .fire / CC 3.x .scene 모두 이 타입으로 정규화
 */
export interface CCSceneNode {
  uuid: string
  name: string
  active: boolean
  position: CCVec3
  /** 2.x: z-euler number | 3.x: {x,y,z} euler */
  rotation: CCVec3 | number
  scale: CCVec3
  /** UITransform / _contentSize 기반 */
  size: CCVec2
  anchor: CCVec2
  opacity: number
  color: CCColor
  layer?: number
  components: CCSceneComponent[]
  children: CCSceneNode[]
  /** R1453: 이벤트 핸들러 목록 (Button clickEvents, Toggle checkEvents, Slider slideEvents) */
  eventHandlers?: { component: string; event: string; handler: string; target?: string }[]
  /** 원본 flat 배열 인덱스 (직접 편집용) */
  _rawIndex?: number
}

export interface CCSceneFile {
  projectInfo: CCFileProjectInfo
  scenePath: string
  root: CCSceneNode
  /** 원본 flat 배열 (patch 기반 저장용) */
  _raw?: unknown[]
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

// ── Ollama Local LLM ──────────────────────────────────────────────────────────
export const OLLAMA_LIST = 'ollama:list'
export const OLLAMA_SEND = 'ollama:send'
export const OLLAMA_INTERRUPT = 'ollama:interrupt'

// ── OpenAI ────────────────────────────────────────────────────────────────────
export const OPENAI_SEND = 'openai:send'
export const OPENAI_INTERRUPT = 'openai:interrupt'

// ── Session Search ────────────────────────────────────────────────────────────
export const SESSION_SEARCH_ALL = 'session:searchAll'

// ── Session Merge ─────────────────────────────────────────────────────────────
export const SESSION_MERGE = 'session:merge'

// ── Shell Exec ────────────────────────────────────────────────────────────────
export const SHELL_EXEC = 'shell:exec'

export interface GlobalSearchResult {
  sessionId: string
  sessionTitle: string
  messageIndex: number
  role: string
  excerpt: string
  updatedAt: number
}
