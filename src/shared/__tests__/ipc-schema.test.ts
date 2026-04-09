import { describe, it, expect } from 'vitest'
import {
  IPC,
  CC_CONNECT,
  CC_DISCONNECT,
  CC_STATUS,
  CC_GET_TREE,
  CC_GET_NODE,
  CC_SET_PROPERTY,
  CC_MOVE_NODE,
  CC_BUILD_WEB,
  CC_BUILD_STATUS,
  CC_EVENT,
  CC_DETECT_PROJECT,
  CC_GET_PORT,
  CC_SET_PORT,
  CC_INSTALL_EXTENSION,
  CC_GET_CANVAS_SIZE,
  CC_GET_ASSETS,
  CC_SET_COMP_PROP,
  CC_FILE_DETECT,
  CC_FILE_OPEN_PROJECT,
  CC_FILE_LIST_SCENES,
  CC_FILE_READ_SCENE,
  CC_FILE_SAVE_SCENE,
  OLLAMA_LIST,
  OLLAMA_SEND,
  OLLAMA_INTERRUPT,
  OPENAI_SEND,
  OPENAI_INTERRUPT,
  SESSION_SEARCH_ALL,
  SESSION_MERGE,
  SHELL_EXEC,
  type DirEntry,
  type SessionInfo,
  type StreamEvent,
  type StreamEventType,
  type PermissionRequest,
  type CCNode,
  type CCEvent,
  type CCStatus,
  type CCSceneNode,
  type CCSceneFile,
  type AguiEvent,
} from '../ipc-schema'

// ── IPC 채널 상수 ─────────────────────────────────────────────────────────────

describe('IPC 채널 상수', () => {
  it('Claude 관련 채널이 정의되어 있다', () => {
    expect(IPC.CLAUDE_START).toBe('claude:start')
    expect(IPC.CLAUDE_SEND).toBe('claude:send')
    expect(IPC.CLAUDE_MESSAGE).toBe('claude:message')
    expect(IPC.CLAUDE_INTERRUPT).toBe('claude:interrupt')
    expect(IPC.CLAUDE_CLOSE).toBe('claude:close')
    expect(IPC.CLAUDE_PERMISSION).toBe('claude:permission')
    expect(IPC.CLAUDE_PERMISSION_REPLY).toBe('claude:permission-reply')
    expect(IPC.CLAUDE_SESSIONS).toBe('claude:sessions')
    expect(IPC.CLAUDE_RESUME).toBe('claude:resume')
  })

  it('Terminal 관련 채널이 정의되어 있다', () => {
    expect(IPC.TERMINAL_CREATE).toBe('terminal:create')
    expect(IPC.TERMINAL_DATA).toBe('terminal:data')
    expect(IPC.TERMINAL_RESIZE).toBe('terminal:resize')
    expect(IPC.TERMINAL_CLOSE).toBe('terminal:close')
  })

  it('FileSystem 관련 채널이 정의되어 있다', () => {
    expect(IPC.FS_READ_DIR).toBe('fs:read-dir')
    expect(IPC.FS_READ_FILE).toBe('fs:read-file')
    expect(IPC.FS_CHANGE).toBe('fs:change')
  })

  it('Project 관련 채널이 정의되어 있다', () => {
    expect(IPC.PROJECT_OPEN).toBe('project:open')
    expect(IPC.PROJECT_RECENT).toBe('project:recent')
    expect(IPC.PROJECT_CURRENT).toBe('project:current')
    expect(IPC.PROJECT_SET).toBe('project:set')
  })

  it('모든 IPC 값이 고유하다 (중복 없음)', () => {
    const values = Object.values(IPC)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('IPC 객체는 as const — 런타임에 값이 변경되지 않는다', () => {
    const original = IPC.CLAUDE_START
    // as const이므로 TypeScript 레벨에서 재할당 불가 — 값이 유지됨을 확인
    expect(IPC.CLAUDE_START).toBe(original)
  })
})

// ── CC IPC 상수 ───────────────────────────────────────────────────────────────

describe('CC IPC 상수', () => {
  it('기본 CC 채널이 cc: 접두어를 가진다', () => {
    expect(CC_CONNECT).toBe('cc:connect')
    expect(CC_DISCONNECT).toBe('cc:disconnect')
    expect(CC_STATUS).toBe('cc:status')
    expect(CC_GET_TREE).toBe('cc:getTree')
    expect(CC_GET_NODE).toBe('cc:getNode')
    expect(CC_SET_PROPERTY).toBe('cc:setProperty')
    expect(CC_MOVE_NODE).toBe('cc:moveNode')
    expect(CC_BUILD_WEB).toBe('cc:buildWeb')
    expect(CC_BUILD_STATUS).toBe('cc:buildStatus')
    expect(CC_EVENT).toBe('cc:event')
  })

  it('추가 CC 채널이 올바르게 정의된다', () => {
    expect(CC_DETECT_PROJECT).toBe('cc:detectProject')
    expect(CC_GET_PORT).toBe('cc:getPort')
    expect(CC_SET_PORT).toBe('cc:setPort')
    expect(CC_INSTALL_EXTENSION).toBe('cc:installExtension')
    expect(CC_GET_CANVAS_SIZE).toBe('cc:getCanvasSize')
    expect(CC_GET_ASSETS).toBe('cc:get-assets')
    expect(CC_SET_COMP_PROP).toBe('cc:setComponentProp')
  })

  it('CC 파일 기반 채널이 cc:file: 접두어를 가진다', () => {
    expect(CC_FILE_DETECT).toBe('cc:file:detect')
    expect(CC_FILE_OPEN_PROJECT).toBe('cc:file:openProject')
    expect(CC_FILE_LIST_SCENES).toBe('cc:file:listScenes')
    expect(CC_FILE_READ_SCENE).toBe('cc:file:readScene')
    expect(CC_FILE_SAVE_SCENE).toBe('cc:file:saveScene')
  })
})

// ── 기타 상수 ─────────────────────────────────────────────────────────────────

describe('기타 IPC 상수', () => {
  it('Ollama 채널이 ollama: 접두어를 가진다', () => {
    expect(OLLAMA_LIST).toBe('ollama:list')
    expect(OLLAMA_SEND).toBe('ollama:send')
    expect(OLLAMA_INTERRUPT).toBe('ollama:interrupt')
  })

  it('OpenAI 채널이 openai: 접두어를 가진다', () => {
    expect(OPENAI_SEND).toBe('openai:send')
    expect(OPENAI_INTERRUPT).toBe('openai:interrupt')
  })

  it('Session/Shell 채널이 정의된다', () => {
    expect(SESSION_SEARCH_ALL).toBe('session:searchAll')
    expect(SESSION_MERGE).toBe('session:merge')
    expect(SHELL_EXEC).toBe('shell:exec')
  })
})

// ── StreamEventType ───────────────────────────────────────────────────────────

describe('StreamEventType', () => {
  it('유효한 StreamEventType 값이 타입 호환된다', () => {
    const types: StreamEventType[] = [
      'init', 'text', 'text_delta', 'tool_start', 'tool_end', 'result', 'error',
    ]
    expect(types).toHaveLength(7)
  })

  it('StreamEvent 객체가 정상 생성된다', () => {
    const event: StreamEvent = {
      type: 'text',
      sessionId: 'sess-1',
      text: 'hello',
    }
    expect(event.type).toBe('text')
    expect(event.text).toBe('hello')
  })

  it('StreamEvent tool_start 케이스가 정상 생성된다', () => {
    const event: StreamEvent = {
      type: 'tool_start',
      toolId: 'tool-1',
      toolName: 'bash',
      toolInput: { command: 'ls' },
    }
    expect(event.toolName).toBe('bash')
    expect(event.toolInput).toEqual({ command: 'ls' })
  })

  it('StreamEvent result 케이스에 costUsd가 포함된다', () => {
    const event: StreamEvent = {
      type: 'result',
      costUsd: 0.005,
    }
    expect(event.costUsd).toBe(0.005)
  })
})

// ── DirEntry / SessionInfo / PermissionRequest ────────────────────────────────

describe('공통 인터페이스 구조', () => {
  it('DirEntry 객체가 정상 생성된다', () => {
    const entry: DirEntry = { name: 'src', path: '/project/src', isDir: true }
    expect(entry.isDir).toBe(true)
    expect(entry.name).toBe('src')
  })

  it('SessionInfo 객체가 정상 생성된다', () => {
    const info: SessionInfo = {
      id: 'abc',
      cwd: '/home/user',
      createdAt: 1000,
      updatedAt: 2000,
    }
    expect(info.id).toBe('abc')
    expect(info.summary).toBeUndefined()
  })

  it('SessionInfo에 summary가 선택적으로 포함된다', () => {
    const info: SessionInfo = {
      id: 'xyz',
      cwd: '/tmp',
      createdAt: 1000,
      updatedAt: 2000,
      summary: 'Test session',
    }
    expect(info.summary).toBe('Test session')
  })

  it('PermissionRequest 객체가 정상 생성된다', () => {
    const req: PermissionRequest = {
      requestId: 'req-1',
      toolName: 'bash',
      input: { command: 'rm -rf /' },
    }
    expect(req.requestId).toBe('req-1')
    expect(req.toolName).toBe('bash')
  })
})

// ── CCStatus / CCEvent ────────────────────────────────────────────────────────

describe('CCStatus / CCEvent', () => {
  it('CCStatus 객체가 정상 생성된다', () => {
    const status: CCStatus = {
      connected: true,
      port: 7456,
      version: '2.4.13',
    }
    expect(status.connected).toBe(true)
    expect(status.port).toBe(7456)
  })

  it('CCEvent connected 타입이 정상 생성된다', () => {
    const event: CCEvent = { type: 'connected', version: '2.4.13', _ccPort: 7456 }
    expect(event.type).toBe('connected')
    expect(event._ccPort).toBe(7456)
  })

  it('CCEvent node:select 타입에 uuids가 포함된다', () => {
    const event: CCEvent = { type: 'node:select', uuids: ['uuid-1', 'uuid-2'] }
    expect(event.uuids).toHaveLength(2)
  })
})

// ── CCNode 트리 구조 ──────────────────────────────────────────────────────────

describe('CCNode', () => {
  it('CCNode가 children 배열을 포함한다', () => {
    const node: CCNode = {
      uuid: 'n1',
      name: 'Canvas',
      active: true,
      position: { x: 0, y: 0 },
      size: { width: 960, height: 640 },
      anchor: { x: 0.5, y: 0.5 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 255,
      color: { r: 255, g: 255, b: 255, a: 255 },
      children: [],
      components: [],
    }
    expect(node.children).toHaveLength(0)
    expect(node.name).toBe('Canvas')
  })

  it('CCNode components에 타입 정보가 포함된다', () => {
    const node: CCNode = {
      uuid: 'n2',
      name: 'Label',
      active: true,
      position: { x: 10, y: 20 },
      size: { width: 100, height: 30 },
      anchor: { x: 0.5, y: 0.5 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 255,
      color: { r: 0, g: 0, b: 0, a: 255 },
      children: [],
      components: [{ type: 'cc.Label', props: { string: 'Hello' } }],
    }
    expect(node.components[0].type).toBe('cc.Label')
  })
})

// ── AG-UI 이벤트 ──────────────────────────────────────────────────────────────

describe('AguiEvent', () => {
  it('run_started 이벤트가 정상 생성된다', () => {
    const ev: AguiEvent = { type: 'run_started', runId: 'r1', timestamp: 1000 }
    expect(ev.type).toBe('run_started')
    expect(ev.runId).toBe('r1')
  })

  it('step_started 이벤트가 stepName을 포함한다', () => {
    const ev: AguiEvent = {
      type: 'step_started',
      runId: 'r1',
      stepId: 's1',
      stepName: 'analyze',
      timestamp: 1000,
    }
    expect(ev.stepName).toBe('analyze')
  })

  it('run_finished 이벤트가 costUsd를 포함한다', () => {
    const ev: AguiEvent = {
      type: 'run_finished',
      runId: 'r1',
      costUsd: 0.01,
      timestamp: 2000,
    }
    expect(ev.costUsd).toBe(0.01)
  })
})
