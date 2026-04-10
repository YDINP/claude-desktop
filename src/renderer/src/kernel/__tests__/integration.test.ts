/**
 * Kernel eventBus → Terminal adapter 통합 테스트
 * initIpcBridge → onTerminalData → eventBus → useTerminalStore 전체 경로
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── localStorage mock (store 초기화에 필요할 수 있음) ────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

import { eventBus } from '../eventBus'
import { initIpcBridge, destroyIpcBridge } from '../ipcBridge'

// terminal adapter & store
import { initTerminalAdapter } from '../../domains/terminal/adapter'
import { useTerminalStore } from '../../domains/terminal/store'

// ── window.api mock ──────────────────────────────────────────────────────────
type TerminalDataHandler = (id: string, data: string) => void
let terminalDataHandler: TerminalDataHandler | null = null

const mockApi = {
  onTerminalData: vi.fn((handler: TerminalDataHandler) => {
    terminalDataHandler = handler
    return vi.fn() // unsub
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

describe('Kernel eventBus → Terminal adapter 통합', () => {
  beforeEach(() => {
    terminalDataHandler = null
    vi.clearAllMocks()
    destroyIpcBridge()
    eventBus.clear()
    useTerminalStore.getState().reset()
    vi.stubGlobal('window', { api: mockApi })
  })

  afterEach(() => {
    destroyIpcBridge()
    eventBus.clear()
  })

  // ── 1. initIpcBridge → onTerminalData 등록 ───────────────────────────────

  it('initIpcBridge 호출 시 api.onTerminalData 리스너를 등록한다', () => {
    initIpcBridge()
    expect(mockApi.onTerminalData).toHaveBeenCalledOnce()
    expect(terminalDataHandler).not.toBeNull()
  })

  // ── 2. eventBus.emit('terminal:data') → useTerminalStore.appendOutput ─────

  it('eventBus terminal:data 직접 emit → useTerminalStore에 출력 누적', () => {
    initTerminalAdapter()

    eventBus.emit({ type: 'terminal:data', payload: { id: 'tab-1', data: 'ls output' } })

    const history = useTerminalStore.getState().outputHistory['tab-1']
    expect(history).toBeDefined()
    expect(history).toContain('ls output')
  })

  // ── 3. initIpcBridge → onTerminalData → eventBus → store 전체 경로 ────────

  it('IPC terminal:data → eventBus → store 전체 파이프라인', () => {
    initIpcBridge()
    initTerminalAdapter()

    // 실제 IPC 데이터 수신 시뮬레이션
    terminalDataHandler!('tab-2', 'hello from terminal')

    const history = useTerminalStore.getState().outputHistory['tab-2']
    expect(history).toBeDefined()
    expect(history).toContain('hello from terminal')
  })

  it('여러 탭의 데이터가 각각 분리되어 저장된다', () => {
    initIpcBridge()
    initTerminalAdapter()

    terminalDataHandler!('tab-a', 'output-a')
    terminalDataHandler!('tab-b', 'output-b')

    const histA = useTerminalStore.getState().outputHistory['tab-a']
    const histB = useTerminalStore.getState().outputHistory['tab-b']

    expect(histA).toContain('output-a')
    expect(histB).toContain('output-b')
    expect(histA).not.toContain('output-b')
    expect(histB).not.toContain('output-a')
  })

  it('동일 탭에 여러 데이터가 순서대로 누적된다', () => {
    initIpcBridge()
    initTerminalAdapter()

    terminalDataHandler!('tab-x', 'line1')
    terminalDataHandler!('tab-x', 'line2')
    terminalDataHandler!('tab-x', 'line3')

    const history = useTerminalStore.getState().outputHistory['tab-x']
    expect(history).toEqual(['line1', 'line2', 'line3'])
  })

  // ── 4. destroyIpcBridge → cleanup 확인 ───────────────────────────────────

  it('destroyIpcBridge 호출 시 unsub 함수를 실행한다', () => {
    const unsubFn = vi.fn()
    mockApi.onTerminalData.mockImplementationOnce((handler: TerminalDataHandler) => {
      terminalDataHandler = handler
      return unsubFn
    })

    initIpcBridge()
    destroyIpcBridge()

    expect(unsubFn).toHaveBeenCalledOnce()
  })

  it('destroyIpcBridge 후 재초기화 시 다시 리스너가 등록된다', () => {
    initIpcBridge()
    destroyIpcBridge()
    initIpcBridge()

    expect(mockApi.onTerminalData).toHaveBeenCalledTimes(2)
  })

  it('destroyIpcBridge 후 eventBus cleanup → store 업데이트 안 됨', () => {
    initIpcBridge()
    const adapterCleanup = initTerminalAdapter()
    adapterCleanup()
    destroyIpcBridge()

    // eventBus에도 더 이상 구독자 없음 — 직접 emit해도 store 변화 없음
    eventBus.emit({ type: 'terminal:data', payload: { id: 'tab-gone', data: 'should not appear' } })

    const history = useTerminalStore.getState().outputHistory['tab-gone']
    expect(history).toBeUndefined()
  })

  // ── 5. eventBus emit spy ──────────────────────────────────────────────────

  it('onTerminalData 수신 시 eventBus.emit이 terminal:data 타입으로 호출된다', () => {
    initIpcBridge()

    const emitSpy = vi.spyOn(eventBus, 'emit')
    terminalDataHandler!('tab-spy', 'spy-data')

    expect(emitSpy).toHaveBeenCalledWith({
      type: 'terminal:data',
      payload: { id: 'tab-spy', data: 'spy-data' },
    })
  })
})
