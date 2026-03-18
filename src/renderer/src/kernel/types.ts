/**
 * Kernel type definitions — AppCommands + AppEvents discriminated unions
 * Phase A: 기존 코드 무수정, 추가만
 */
import type {
  CCSceneNode,
  CCSceneFile,
  StreamEvent,
  PermissionRequest,
  CCEvent,
  CCStatus,
} from '../../../shared/ipc-schema'

// ── Commands (UI → CommandBus → IPC) ─────────────────────────────────────────

export type AppCommand =
  // chat
  | { type: 'chat:send';            payload: { text: string; cwd: string; sessionId?: string; model?: string; extraSystemPrompt?: string } }
  | { type: 'chat:interrupt';       payload: { sessionId: string } }
  | { type: 'chat:close';           payload: { sessionId: string } }
  | { type: 'chat:resume';          payload: { sessionId: string; cwd: string } }
  | { type: 'chat:permissionReply'; payload: { requestId: string; allow: boolean; sessionId: string } }
  // cocos file
  | { type: 'cocos:saveScene';      payload: { root: CCSceneNode; sceneFile: CCSceneFile } }
  | { type: 'cocos:selectNode';     payload: { uuid: string } }
  | { type: 'cocos:lockUuids';      payload: { uuids: string[] } }
  | { type: 'cocos:unlockUuids';    payload: { uuids: string[] } }
  // session
  | { type: 'session:load';         payload: { sessionId: string } }
  | { type: 'session:new';          payload: { cwd: string } }
  | { type: 'session:delete';       payload: { sessionId: string } }
  // terminal
  | { type: 'terminal:create';      payload: { id: string; cwd: string } }
  | { type: 'terminal:write';       payload: { id: string; data: string } }
  | { type: 'terminal:resize';      payload: { id: string; cols: number; rows: number } }
  | { type: 'terminal:close';       payload: { id: string } }
  // filesystem
  | { type: 'fs:readFile';          payload: { path: string } }
  | { type: 'fs:readDir';           payload: { path: string } }
  | { type: 'fs:saveFile';          payload: { path: string; content: string } }
  | { type: 'fs:watchDir';          payload: { path: string } }
  | { type: 'fs:unwatchDir';        payload: { path: string } }

// ── Events (IPC → EventBus → UI) ─────────────────────────────────────────────

export type AppEvent =
  // claude
  | { type: 'claude:message';       payload: StreamEvent }
  | { type: 'claude:permission';    payload: PermissionRequest }
  // cocos live
  | { type: 'cc:event';             payload: CCEvent }
  | { type: 'cc:statusChange';      payload: CCStatus }
  // cocos file
  | { type: 'cc:fileChanged';       payload: { path: string } }
  | { type: 'cc:externalChange';    payload: { path: string } }
  // terminal
  | { type: 'terminal:data';        payload: { id: string; data: string } }
  // filesystem
  | { type: 'fs:change';            payload: { path: string; type: string } }
  // app
  | { type: 'app:closeTab';         payload: Record<string, never> }
  | { type: 'app:fontSizeShortcut'; payload: { delta: number } }
  | { type: 'app:themeChanged';     payload: { isDark: boolean } }

// ── Helper types ──────────────────────────────────────────────────────────────

export type AppCommandType = AppCommand['type']
export type AppEventType   = AppEvent['type']

export type CommandPayload<T extends AppCommandType> =
  Extract<AppCommand, { type: T }>['payload']

export type EventPayload<T extends AppEventType> =
  Extract<AppEvent, { type: T }>['payload']
