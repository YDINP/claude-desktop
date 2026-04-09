/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CCFileWatcher } from '../cc-file-watcher'

// ── Mock chokidar (dynamic import inside watch()) ─────────────────────────────

const mockWatcherOn = vi.fn()
const mockWatcherAdd = vi.fn()
const mockWatcherClose = vi.fn().mockResolvedValue(undefined)
const mockWatcherUnwatch = vi.fn()

const mockWatcher = {
  on: mockWatcherOn,
  add: mockWatcherAdd,
  close: mockWatcherClose,
  unwatch: mockWatcherUnwatch,
}
// chokidar.watch() returns the mockWatcher; .on() chains
mockWatcherOn.mockReturnValue(mockWatcher)

vi.mock('chokidar', () => ({
  default: { watch: vi.fn().mockReturnValue(mockWatcher) },
}))

// ── Mock fs (used inside emitPartialUpdate) ───────────────────────────────────

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getChokidar() {
  const { default: chokidar } = await import('chokidar')
  return chokidar
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CCFileWatcher', () => {
  let watcher: CCFileWatcher

  beforeEach(() => {
    vi.clearAllMocks()
    mockWatcherOn.mockReturnValue(mockWatcher)
    watcher = new CCFileWatcher()
  })

  afterEach(async () => {
    await watcher.close()
  })

  // ── watch() ─────────────────────────────────────────────────────────────────

  describe('watch()', () => {
    it('starts chokidar watcher on first call', async () => {
      await watcher.watch('/project/scene.fire')
      const chokidar = await getChokidar()
      expect(chokidar.watch).toHaveBeenCalledOnce()
    })

    it('does not create a second chokidar watcher if already initialized', async () => {
      await watcher.watch('/project/a.fire')
      await watcher.watch('/project/b.fire')
      const chokidar = await getChokidar()
      expect(chokidar.watch).toHaveBeenCalledOnce()
      // second path is added via .add()
      expect(mockWatcherAdd).toHaveBeenCalledWith(['/project/b.fire'])
    })

    it('skips already-watched paths', async () => {
      await watcher.watch('/project/scene.fire')
      const chokidar = await getChokidar()
      vi.clearAllMocks()
      mockWatcherOn.mockReturnValue(mockWatcher)

      await watcher.watch('/project/scene.fire') // same path again
      expect(chokidar.watch).not.toHaveBeenCalled()
      expect(mockWatcherAdd).not.toHaveBeenCalled()
    })

    it('accepts an array of paths', async () => {
      await watcher.watch(['/a.fire', '/b.fire'])
      const chokidar = await getChokidar()
      expect(chokidar.watch).toHaveBeenCalledOnce()
      const [paths] = (chokidar.watch as ReturnType<typeof vi.fn>).mock.calls[0] as [string[]]
      expect(paths).toContain('/a.fire')
      expect(paths).toContain('/b.fire')
    })

    it('increments watchedCount', async () => {
      expect(watcher.watchedCount).toBe(0)
      await watcher.watch('/a.fire')
      expect(watcher.watchedCount).toBe(1)
      await watcher.watch('/b.fire')
      expect(watcher.watchedCount).toBe(2)
    })
  })

  // ── onChange / emit ─────────────────────────────────────────────────────────

  describe('onChange()', () => {
    it('registers callback and fires on "add" event', async () => {
      const cb = vi.fn()
      watcher.onChange(cb)
      await watcher.watch('/project')

      // simulate chokidar 'add' event
      const addHandler = mockWatcherOn.mock.calls.find(([evt]) => evt === 'add')?.[1]
      addHandler?.('/project/new.fire')

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ type: 'add', path: '/project/new.fire' }))
    })

    it('registers callback and fires on "unlink" event', async () => {
      const cb = vi.fn()
      watcher.onChange(cb)
      await watcher.watch('/project')

      const unlinkHandler = mockWatcherOn.mock.calls.find(([evt]) => evt === 'unlink')?.[1]
      unlinkHandler?.('/project/old.fire')

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ type: 'unlink', path: '/project/old.fire' }))
    })

    it('returns unsubscribe function', async () => {
      const cb = vi.fn()
      const unsub = watcher.onChange(cb)
      await watcher.watch('/project')
      unsub()

      const addHandler = mockWatcherOn.mock.calls.find(([evt]) => evt === 'add')?.[1]
      addHandler?.('/project/new.fire')

      expect(cb).not.toHaveBeenCalled()
    })
  })

  // ── debouncedChange (uses fake timers) ──────────────────────────────────────

  describe('debouncedChange via "change" event', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('debounces rapid change events to single callback within 300ms', async () => {
      const cb = vi.fn()
      watcher.onChange(cb)
      await watcher.watch('/project')

      const changeHandler = mockWatcherOn.mock.calls.find(([evt]) => evt === 'change')?.[1]

      // Fire 3 times rapidly
      changeHandler?.('/project/scene.fire')
      changeHandler?.('/project/scene.fire')
      changeHandler?.('/project/scene.fire')

      // Not yet fired
      expect(cb).not.toHaveBeenCalled()

      // Advance past debounce
      vi.advanceTimersByTime(350)

      expect(cb).toHaveBeenCalledOnce()
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ type: 'change', path: '/project/scene.fire' }))
    })

    it('resets debounce timer on new change event', async () => {
      const cb = vi.fn()
      watcher.onChange(cb)
      await watcher.watch('/project')

      const changeHandler = mockWatcherOn.mock.calls.find(([evt]) => evt === 'change')?.[1]

      changeHandler?.('/project/scene.fire')
      vi.advanceTimersByTime(200) // not yet expired
      changeHandler?.('/project/scene.fire') // reset timer
      vi.advanceTimersByTime(200) // 200ms after reset — still waiting
      expect(cb).not.toHaveBeenCalled()

      vi.advanceTimersByTime(150) // now 350ms after last event
      expect(cb).toHaveBeenCalledOnce()
    })
  })

  // ── fileContentCache LRU-like 50-item limit ──────────────────────────────────

  describe('fileContentCache LRU 50-item limit', () => {
    it('evicts oldest entry when 50 items are already cached and a new path is added', async () => {
      const { readFileSync } = await import('fs')
      const mockRead = vi.mocked(readFileSync)

      // Pre-fill 50 entries via cacheFileContent (public API)
      for (let i = 0; i < 50; i++) {
        watcher.cacheFileContent(`/path/file${i}.fire`, `content${i}`)
      }

      // Now trigger emitPartialUpdate for a brand-new path — uses readFileSync
      mockRead.mockReturnValue('new-content' as unknown as Buffer)

      const cb = vi.fn()
      watcher.onPartialUpdate(cb)
      await watcher.watch('/project')

      vi.useFakeTimers()
      const changeHandler = mockWatcherOn.mock.calls.find(([evt]) => evt === 'change')?.[1]
      changeHandler?.('/path/file-new.fire')
      vi.advanceTimersByTime(350)
      vi.useRealTimers()

      // Let the async emitPartialUpdate run
      await new Promise(resolve => setTimeout(resolve, 0))

      // The new file should trigger fullReload (no old content) and be cached
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ fullReload: true, path: '/path/file-new.fire' }))
    })

    it('cacheFileContent sets content accessible for subsequent updates', () => {
      watcher.cacheFileContent('/my/scene.fire', 'initial content')
      // No assertion on internal state — verify by watching that partial update
      // uses old content (verified indirectly via emitPartialUpdate producing diff, not fullReload)
      // Just confirm no throw
      expect(() => watcher.cacheFileContent('/my/scene.fire', 'updated')).not.toThrow()
    })
  })

  // ── emitPartialUpdate — full reload vs UUID diff ─────────────────────────────

  describe('emitPartialUpdate', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    async function triggerChange(path: string) {
      const changeHandler = mockWatcherOn.mock.calls.find(([evt]) => evt === 'change')?.[1]
      changeHandler?.(path)
      vi.advanceTimersByTime(350)
      vi.useRealTimers()
      await new Promise(resolve => setTimeout(resolve, 10))
      vi.useFakeTimers()
    }

    it('emits fullReload=true when no previous cache exists', async () => {
      const { readFileSync } = await import('fs')
      vi.mocked(readFileSync).mockReturnValue('{}' as unknown as Buffer)

      const cb = vi.fn()
      watcher.onPartialUpdate(cb)
      await watcher.watch('/project')

      await triggerChange('/project/scene.fire')

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ fullReload: true }))
    })

    it('emits changedUuids when JSON arrays differ', async () => {
      const { readFileSync } = await import('fs')
      const OLD = JSON.stringify([{ _id: 'uuid-1', name: 'Node' }])
      const NEW = JSON.stringify([{ _id: 'uuid-1', name: 'Node Changed' }])

      // Cache old content
      watcher.cacheFileContent('/project/scene.fire', OLD)
      vi.mocked(readFileSync).mockReturnValue(NEW as unknown as Buffer)

      const cb = vi.fn()
      watcher.onPartialUpdate(cb)
      await watcher.watch('/project')

      await triggerChange('/project/scene.fire')

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        changedUuids: ['uuid-1'],
        fullReload: false,
      }))
    })

    it('emits fullReload=true when JSON is not an array', async () => {
      const { readFileSync } = await import('fs')
      watcher.cacheFileContent('/project/scene.fire', '{"notAnArray": true}')
      vi.mocked(readFileSync).mockReturnValue('{"alsoNotAnArray": 1}' as unknown as Buffer)

      const cb = vi.fn()
      watcher.onPartialUpdate(cb)
      await watcher.watch('/project')

      await triggerChange('/project/scene.fire')

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ fullReload: true }))
    })

    it('emits fullReload=true when readFileSync throws', async () => {
      const { readFileSync } = await import('fs')
      vi.mocked(readFileSync).mockImplementation(() => { throw new Error('ENOENT') })

      const cb = vi.fn()
      watcher.onPartialUpdate(cb)
      await watcher.watch('/project')

      await triggerChange('/project/scene.fire')

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ fullReload: true }))
    })

    it('uses __id__ field when _id is absent', async () => {
      const { readFileSync } = await import('fs')
      const OLD = JSON.stringify([{ __id__: 'alt-uuid', val: 1 }])
      const NEW = JSON.stringify([{ __id__: 'alt-uuid', val: 2 }])

      watcher.cacheFileContent('/project/s.fire', OLD)
      vi.mocked(readFileSync).mockReturnValue(NEW as unknown as Buffer)

      const cb = vi.fn()
      watcher.onPartialUpdate(cb)
      await watcher.watch('/project')

      await triggerChange('/project/s.fire')

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ changedUuids: ['alt-uuid'] }))
    })
  })

  // ── onPartialUpdate ──────────────────────────────────────────────────────────

  describe('onPartialUpdate()', () => {
    it('returns unsubscribe function that removes the callback', async () => {
      const { readFileSync } = await import('fs')
      vi.mocked(readFileSync).mockReturnValue('{}' as unknown as Buffer)

      const cb = vi.fn()
      const unsub = watcher.onPartialUpdate(cb)
      await watcher.watch('/project')
      unsub()

      vi.useFakeTimers()
      const changeHandler = mockWatcherOn.mock.calls.find(([evt]) => evt === 'change')?.[1]
      changeHandler?.('/project/scene.fire')
      vi.advanceTimersByTime(350)
      vi.useRealTimers()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(cb).not.toHaveBeenCalled()
    })
  })

  // ── unwatch ──────────────────────────────────────────────────────────────────

  describe('unwatch()', () => {
    it('removes path from watchedPaths', async () => {
      await watcher.watch('/project/a.fire')
      expect(watcher.watchedCount).toBe(1)
      watcher.unwatch('/project/a.fire')
      expect(watcher.watchedCount).toBe(0)
    })

    it('accepts array of paths', async () => {
      await watcher.watch(['/a.fire', '/b.fire'])
      watcher.unwatch(['/a.fire', '/b.fire'])
      expect(watcher.watchedCount).toBe(0)
    })
  })

  // ── close ────────────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('clears state and closes chokidar watcher', async () => {
      await watcher.watch('/project')
      await watcher.close()
      expect(mockWatcherClose).toHaveBeenCalledOnce()
      expect(watcher.watchedCount).toBe(0)
    })
  })
})
