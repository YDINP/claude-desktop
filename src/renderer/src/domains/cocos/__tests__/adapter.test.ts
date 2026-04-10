import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── localStorage mock ────────────────────────────────────────────────────────
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

// ── window.api mock 헬퍼 ─────────────────────────────────────────────────────
type Handler = (payload: unknown) => void

let ccStatusHandler: Handler | null = null
let ccEventHandler: Handler | null = null
let ccFileChangedHandler: Handler | null = null

let statusUnsub: ReturnType<typeof vi.fn>
let eventUnsub: ReturnType<typeof vi.fn>
let fileChangedUnsub: ReturnType<typeof vi.fn>

function setupWindowApi(options: {
  includeStatus?: boolean
  includeEvent?: boolean
  includeFileChanged?: boolean
} = {}) {
  const {
    includeStatus = true,
    includeEvent = true,
    includeFileChanged = true,
  } = options

  statusUnsub = vi.fn()
  eventUnsub = vi.fn()
  fileChangedUnsub = vi.fn()

  const api: Record<string, unknown> = {}

  if (includeStatus) {
    api.onCCStatusChange = vi.fn((handler: Handler) => {
      ccStatusHandler = handler
      return statusUnsub
    })
  }

  if (includeEvent) {
    api.onCCEvent = vi.fn((handler: Handler) => {
      ccEventHandler = handler
      return eventUnsub
    })
  }

  if (includeFileChanged) {
    api.onCCFileChanged = vi.fn((handler: Handler) => {
      ccFileChangedHandler = handler
      return fileChangedUnsub
    })
  }

  vi.stubGlobal('window', { api })
}

import { initCocosAdapter } from '../adapter'
import { useCocosStore } from '../store'

function resetStore() {
  useCocosStore.setState({
    connected: false,
    port: 9090,
    status: null,
    sceneFile: null,
    selectedNode: null,
    selectedUuids: [],
    lockedUuids: new Set(),
    pinnedUuids: new Set(),
    layoutMode: 'tab',
  })
  localStorageMock.clear()
}

describe('initCocosAdapter', () => {
  beforeEach(() => {
    setupWindowApi()
    resetStore()
  })

  afterEach(() => {
    vi.clearAllMocks()
    ccStatusHandler = null
    ccEventHandler = null
    ccFileChangedHandler = null
  })

  // ── 등록 ─────────────────────────────────────────────────────────────────────

  it('onCCStatusChange 리스너를 등록한다', () => {
    initCocosAdapter()
    expect(window.api.onCCStatusChange).toHaveBeenCalledOnce()
  })

  it('onCCEvent 리스너를 등록한다', () => {
    initCocosAdapter()
    expect(window.api.onCCEvent).toHaveBeenCalledOnce()
  })

  it('onCCFileChanged 리스너를 등록한다', () => {
    initCocosAdapter()
    expect(window.api.onCCFileChanged).toHaveBeenCalledOnce()
  })

  it('window.api가 없으면 noop cleanup을 반환한다', () => {
    vi.stubGlobal('window', {})
    const cleanup = initCocosAdapter()
    expect(() => cleanup()).not.toThrow()
  })

  // ── onCCStatusChange ─────────────────────────────────────────────────────────

  it('CCStatus → store.setStatus / setConnected 업데이트', () => {
    initCocosAdapter()
    ccStatusHandler!({ connected: true, port: 9876, version: '2.4.13' })
    const state = useCocosStore.getState()
    expect(state.connected).toBe(true)
    expect(state.status).toMatchObject({ connected: true, port: 9876 })
  })

  it('CCStatus.port → store.setPort 업데이트', () => {
    initCocosAdapter()
    ccStatusHandler!({ connected: true, port: 1234, version: '2.4.13' })
    expect(useCocosStore.getState().port).toBe(1234)
  })

  it('CCStatus.port 없으면 port는 초기값 유지', () => {
    initCocosAdapter()
    ccStatusHandler!({ connected: false, version: '2.4.13' })
    expect(useCocosStore.getState().port).toBe(9090)
  })

  it('CCStatus.connected=false → store.connected=false', () => {
    useCocosStore.setState({ connected: true })
    initCocosAdapter()
    ccStatusHandler!({ connected: false, port: 9090, version: '2.4.13' })
    expect(useCocosStore.getState().connected).toBe(false)
  })

  // ── onCCEvent ────────────────────────────────────────────────────────────────

  it("CCEvent type='connected' → store.connected=true", () => {
    initCocosAdapter()
    ccEventHandler!({ type: 'connected' })
    expect(useCocosStore.getState().connected).toBe(true)
  })

  it("CCEvent type='scene:ready' → store.connected 변경 없음", () => {
    initCocosAdapter()
    ccEventHandler!({ type: 'scene:ready' })
    // 'connected' 타입이 아니면 setConnected 호출되지 않으므로 초기값 유지
    expect(useCocosStore.getState().connected).toBe(false)
  })

  // ── cleanup ───────────────────────────────────────────────────────────────────

  it('cleanup 호출 시 statusUnsub 실행', () => {
    const cleanup = initCocosAdapter()
    cleanup()
    expect(statusUnsub).toHaveBeenCalledOnce()
  })

  it('cleanup 호출 시 eventUnsub 실행', () => {
    const cleanup = initCocosAdapter()
    cleanup()
    expect(eventUnsub).toHaveBeenCalledOnce()
  })

  it('cleanup 호출 시 fileChangedUnsub 실행', () => {
    const cleanup = initCocosAdapter()
    cleanup()
    expect(fileChangedUnsub).toHaveBeenCalledOnce()
  })

  it('unsub이 함수가 아닌 경우에도 cleanup이 throw 안 함', () => {
    // unsub으로 undefined 반환하는 api
    vi.stubGlobal('window', {
      api: {
        onCCStatusChange: vi.fn(() => undefined),
        onCCEvent: vi.fn(() => undefined),
        onCCFileChanged: vi.fn(() => undefined),
      },
    })
    const cleanup = initCocosAdapter()
    expect(() => cleanup()).not.toThrow()
  })

  // ── api 메서드 일부 없는 경우 ─────────────────────────────────────────────────

  it('onCCStatusChange 없어도 다른 리스너 등록 정상 동작', () => {
    setupWindowApi({ includeStatus: false })
    expect(() => initCocosAdapter()).not.toThrow()
    expect(window.api.onCCEvent).toHaveBeenCalledOnce()
  })

  it('onCCEvent 없어도 throw 안 함', () => {
    setupWindowApi({ includeEvent: false })
    expect(() => initCocosAdapter()).not.toThrow()
  })
})
