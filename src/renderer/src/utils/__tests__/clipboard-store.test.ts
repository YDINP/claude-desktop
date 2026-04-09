import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clipboardStore } from '../clipboard-store'

// clipboard-store uses module-level state — reset between tests

beforeEach(() => {
  clipboardStore.clear()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('clipboardStore', () => {

  // ── push ────────────────────────────────────────────────────────────────────

  describe('push', () => {
    it('adds an entry', () => {
      clipboardStore.push('hello', 'terminal')
      expect(clipboardStore.getAll()).toHaveLength(1)
      expect(clipboardStore.getAll()[0].text).toBe('hello')
    })

    it('ignores empty/whitespace-only text', () => {
      clipboardStore.push('', 'terminal')
      clipboardStore.push('   ', 'terminal')
      expect(clipboardStore.getAll()).toHaveLength(0)
    })

    it('deduplicates: pushes same text moves it to top', () => {
      clipboardStore.push('first', 'a')
      clipboardStore.push('second', 'b')
      clipboardStore.push('first', 'a')
      const all = clipboardStore.getAll()
      expect(all).toHaveLength(2)
      expect(all[0].text).toBe('first')
      expect(all[1].text).toBe('second')
    })

    it('stores source correctly', () => {
      clipboardStore.push('text', 'editor')
      expect(clipboardStore.getAll()[0].source).toBe('editor')
    })

    it('caps at 30 entries', () => {
      for (let i = 0; i < 35; i++) {
        clipboardStore.push(`entry-${i}`, 'test')
      }
      expect(clipboardStore.getAll()).toHaveLength(30)
    })

    it('most recent entry is first', () => {
      clipboardStore.push('older', 'a')
      clipboardStore.push('newer', 'b')
      expect(clipboardStore.getAll()[0].text).toBe('newer')
    })
  })

  // ── subscribe / emit ─────────────────────────────────────────────────────────

  describe('subscribe', () => {
    it('calls listener immediately with current entries', () => {
      clipboardStore.push('existing', 'src')
      const fn = vi.fn()
      clipboardStore.subscribe(fn)
      expect(fn).toHaveBeenCalledOnce()
      expect(fn.mock.calls[0][0][0].text).toBe('existing')
    })

    it('calls listener on push', () => {
      const fn = vi.fn()
      clipboardStore.subscribe(fn)
      fn.mockClear()
      clipboardStore.push('new-text', 'src')
      expect(fn).toHaveBeenCalledOnce()
      expect(fn.mock.calls[0][0][0].text).toBe('new-text')
    })

    it('returns unsubscribe function that stops notifications', () => {
      const fn = vi.fn()
      const unsub = clipboardStore.subscribe(fn)
      fn.mockClear()
      unsub()
      clipboardStore.push('after-unsub', 'src')
      expect(fn).not.toHaveBeenCalled()
    })

    it('multiple subscribers all receive events', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      clipboardStore.subscribe(fn1)
      clipboardStore.subscribe(fn2)
      fn1.mockClear()
      fn2.mockClear()
      clipboardStore.push('broadcast', 'src')
      expect(fn1).toHaveBeenCalledOnce()
      expect(fn2).toHaveBeenCalledOnce()
    })

    it('passes a copy of entries to listener (not shared reference)', () => {
      clipboardStore.push('text', 'src')
      let captured: unknown[] = []
      clipboardStore.subscribe(entries => { captured = entries })
      const snapshot = captured
      clipboardStore.push('another', 'src')
      // The captured array from first call should not be mutated
      expect(snapshot).toHaveLength(1)
    })
  })

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes entry by id', () => {
      clipboardStore.push('to-remove', 'src')
      const id = clipboardStore.getAll()[0].id
      clipboardStore.remove(id)
      expect(clipboardStore.getAll()).toHaveLength(0)
    })

    it('notifies listeners on remove', () => {
      clipboardStore.push('item', 'src')
      const id = clipboardStore.getAll()[0].id
      const fn = vi.fn()
      clipboardStore.subscribe(fn)
      fn.mockClear()
      clipboardStore.remove(id)
      expect(fn).toHaveBeenCalledOnce()
      expect(fn.mock.calls[0][0]).toHaveLength(0)
    })

    it('does nothing for unknown id', () => {
      clipboardStore.push('item', 'src')
      clipboardStore.remove('nonexistent-id')
      expect(clipboardStore.getAll()).toHaveLength(1)
    })
  })

  // ── clear ────────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all entries', () => {
      clipboardStore.push('a', 'src')
      clipboardStore.push('b', 'src')
      clipboardStore.clear()
      expect(clipboardStore.getAll()).toHaveLength(0)
    })

    it('notifies listeners with empty array', () => {
      clipboardStore.push('item', 'src')
      const fn = vi.fn()
      clipboardStore.subscribe(fn)
      fn.mockClear()
      clipboardStore.clear()
      expect(fn).toHaveBeenCalledWith([])
    })
  })

  // ── getAll ───────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns copy of entries', () => {
      clipboardStore.push('text', 'src')
      const a = clipboardStore.getAll()
      const b = clipboardStore.getAll()
      expect(a).not.toBe(b)
      expect(a).toEqual(b)
    })
  })
})
