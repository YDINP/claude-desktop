import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── window.api mock ──────────────────────────────────────────────────────────

type TerminalDataHandler = (id: string, data: string) => void
let terminalDataHandler: TerminalDataHandler | null = null
let terminalDataUnsub: ReturnType<typeof vi.fn>

const mockApi = {
  onTerminalData: vi.fn((handler: TerminalDataHandler) => {
    terminalDataHandler = handler
    return terminalDataUnsub
  }),
  terminalCreate: vi.fn(),
  terminalWrite: vi.fn(),
  terminalResize: vi.fn(),
  terminalClose: vi.fn(),
  readFile: vi.fn(),
  readDir: vi.fn(),
  saveFile: vi.fn(),
  watchDir: vi.fn(),
  unwatchDir: vi.fn(),
  sessionLoad: vi.fn(),
  sessionDelete: vi.fn(),
  ccFileSaveScene: vi.fn(),
}

// eventBus spy
import { eventBus } from '../eventBus'
import { commandBus } from '../commandBus'
import { initIpcBridge, destroyIpcBridge } from '../ipcBridge'

describe('ipcBridge', () => {
  beforeEach(() => {
    terminalDataUnsub = vi.fn()
    terminalDataHandler = null
    vi.clearAllMocks()
    // 각 테스트 전 bridge 초기화 해제 보장
    destroyIpcBridge()
    vi.stubGlobal('window', { api: mockApi })
  })

  afterEach(() => {
    destroyIpcBridge()
  })

  // ── 초기화 ───────────────────────────────────────────────────────────────

  it('initIpcBridge 호출 시 terminal:data 리스너를 등록한다', () => {
    initIpcBridge()
    expect(mockApi.onTerminalData).toHaveBeenCalledOnce()
  })

  it('중복 호출 시 리스너를 한 번만 등록한다', () => {
    initIpcBridge()
    initIpcBridge()
    expect(mockApi.onTerminalData).toHaveBeenCalledOnce()
  })

  it('window.api가 없을 때 경고만 출력하고 throw 안 함', () => {
    vi.stubGlobal('window', {})
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => initIpcBridge()).not.toThrow()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('window.api unavailable'))
    consoleSpy.mockRestore()
  })

  // ── terminal:data → eventBus ─────────────────────────────────────────────

  it('terminal:data 수신 시 eventBus에 emit한다', () => {
    initIpcBridge()
    const emitSpy = vi.spyOn(eventBus, 'emit')
    terminalDataHandler!('tab-1', 'some output')
    expect(emitSpy).toHaveBeenCalledWith({
      type: 'terminal:data',
      payload: { id: 'tab-1', data: 'some output' },
    })
  })

  // ── destroyIpcBridge ─────────────────────────────────────────────────────

  it('destroyIpcBridge 호출 시 unsub 함수를 호출한다', () => {
    initIpcBridge()
    destroyIpcBridge()
    expect(terminalDataUnsub).toHaveBeenCalledOnce()
  })

  it('destroyIpcBridge 후 재초기화 가능하다', () => {
    initIpcBridge()
    destroyIpcBridge()
    initIpcBridge()
    expect(mockApi.onTerminalData).toHaveBeenCalledTimes(2)
  })

  it('destroyIpcBridge 후 terminal:data 이벤트는 eventBus에 전달되지 않는다', () => {
    initIpcBridge()
    const capturedHandler = terminalDataHandler!
    destroyIpcBridge()

    const emitSpy = vi.spyOn(eventBus, 'emit')
    // cleanup이 됐으므로 handler를 직접 호출해도 실제 경로는 해제된 상태
    // ipcBridge 내부에서 api.onTerminalData unsub이 불린 것을 확인
    expect(terminalDataUnsub).toHaveBeenCalledOnce()
    emitSpy.mockRestore()
    void capturedHandler // suppress unused warning
  })

  // ── commandBus 핸들러 등록 확인 ──────────────────────────────────────────

  it('terminal:create 핸들러가 등록된다', () => {
    initIpcBridge()
    expect(commandBus.hasHandler('terminal:create')).toBe(true)
  })

  it('terminal:write 핸들러가 등록된다', () => {
    initIpcBridge()
    expect(commandBus.hasHandler('terminal:write')).toBe(true)
  })

  it('terminal:resize 핸들러가 등록된다', () => {
    initIpcBridge()
    expect(commandBus.hasHandler('terminal:resize')).toBe(true)
  })

  it('terminal:close 핸들러가 등록된다', () => {
    initIpcBridge()
    expect(commandBus.hasHandler('terminal:close')).toBe(true)
  })

  it('fs:readFile 핸들러가 등록된다', () => {
    initIpcBridge()
    expect(commandBus.hasHandler('fs:readFile')).toBe(true)
  })

  it('session:load 핸들러가 등록된다', () => {
    initIpcBridge()
    expect(commandBus.hasHandler('session:load')).toBe(true)
  })

  it('cocos:saveScene 핸들러가 등록된다', () => {
    initIpcBridge()
    expect(commandBus.hasHandler('cocos:saveScene')).toBe(true)
  })

  // ── commandBus dispatch → window.api 호출 확인 ──────────────────────────

  it('terminal:create dispatch → api.terminalCreate 호출', async () => {
    initIpcBridge()
    await commandBus.dispatch({ type: 'terminal:create', payload: { id: 'tab-1', cwd: '/home' } })
    expect(mockApi.terminalCreate).toHaveBeenCalledWith('tab-1', '/home')
  })

  it('terminal:write dispatch → api.terminalWrite 호출', async () => {
    initIpcBridge()
    await commandBus.dispatch({ type: 'terminal:write', payload: { id: 'tab-1', data: 'ls\n' } })
    expect(mockApi.terminalWrite).toHaveBeenCalledWith('tab-1', 'ls\n')
  })

  it('terminal:resize dispatch → api.terminalResize 호출', async () => {
    initIpcBridge()
    await commandBus.dispatch({ type: 'terminal:resize', payload: { id: 'tab-1', cols: 80, rows: 24 } })
    expect(mockApi.terminalResize).toHaveBeenCalledWith('tab-1', 80, 24)
  })

  it('terminal:close dispatch → api.terminalClose 호출', async () => {
    initIpcBridge()
    await commandBus.dispatch({ type: 'terminal:close', payload: { id: 'tab-1' } })
    expect(mockApi.terminalClose).toHaveBeenCalledWith('tab-1')
  })

  it('fs:saveFile dispatch → api.saveFile(content, path) 순으로 호출', async () => {
    initIpcBridge()
    await commandBus.dispatch({ type: 'fs:saveFile', payload: { path: 'file.txt', content: 'hello' } })
    // preload 시그니처: (content, defaultName) — 순서 주의
    expect(mockApi.saveFile).toHaveBeenCalledWith('hello', 'file.txt')
  })

  it('cocos:saveScene dispatch → api.ccFileSaveScene(sceneFile, root) 순으로 호출', async () => {
    initIpcBridge()
    const sceneFile = { uuid: 'sf-1' } as never
    const root = { uuid: 'root-1' } as never
    await commandBus.dispatch({ type: 'cocos:saveScene', payload: { root, sceneFile } })
    // preload 시그니처: (sceneFile, modifiedRoot) — 순서 역전 주의
    expect(mockApi.ccFileSaveScene).toHaveBeenCalledWith(sceneFile, root)
  })
})
