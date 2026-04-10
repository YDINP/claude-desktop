import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  subscribe,
  unsubscribe,
  toast,
  toastSuccess,
  toastError,
  toastInfo,
  toastWarning,
} from '../toast'

// toast.ts uses module-level listeners array and _seq counter.
// We clean up listeners manually after each test.

describe('toast', () => {

  // ── subscribe / unsubscribe ──────────────────────────────────────────────────

  describe('subscribe / unsubscribe', () => {
    it('registered listener receives toast events', () => {
      const fn = vi.fn()
      subscribe(fn)
      toast('hello')
      expect(fn).toHaveBeenCalledOnce()
      unsubscribe(fn)
    })

    it('unsubscribed listener no longer receives events', () => {
      const fn = vi.fn()
      subscribe(fn)
      unsubscribe(fn)
      toast('after-unsub')
      expect(fn).not.toHaveBeenCalled()
    })

    it('multiple listeners all receive the same toast', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      subscribe(fn1)
      subscribe(fn2)
      toast('broadcast')
      expect(fn1).toHaveBeenCalledOnce()
      expect(fn2).toHaveBeenCalledOnce()
      unsubscribe(fn1)
      unsubscribe(fn2)
    })

    it('unsubscribing unknown listener does not throw', () => {
      const fn = vi.fn()
      expect(() => unsubscribe(fn)).not.toThrow()
    })
  })

  // ── toast ────────────────────────────────────────────────────────────────────

  describe('toast()', () => {
    let fn: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fn = vi.fn()
      subscribe(fn)
    })

    it('emits toast with correct message', () => {
      toast('test message')
      expect(fn.mock.calls[0][0].message).toBe('test message')
    })

    it('defaults type to "info"', () => {
      toast('msg')
      expect(fn.mock.calls[0][0].type).toBe('info')
    })

    it('accepts explicit type', () => {
      toast('msg', 'error')
      expect(fn.mock.calls[0][0].type).toBe('error')
    })

    it('passes duration when provided', () => {
      toast('msg', 'info', 2000)
      expect(fn.mock.calls[0][0].duration).toBe(2000)
    })

    it('duration is undefined when not provided', () => {
      toast('msg')
      expect(fn.mock.calls[0][0].duration).toBeUndefined()
    })

    it('id is unique per call', () => {
      toast('a')
      toast('b')
      const id1 = fn.mock.calls[0][0].id as string
      const id2 = fn.mock.calls[1][0].id as string
      expect(id1).not.toBe(id2)
    })

    it('id follows toast-{n} pattern', () => {
      toast('check')
      const id = fn.mock.calls[0][0].id as string
      expect(id).toMatch(/^toast-\d+$/)
    })

    afterEach(() => {
      unsubscribe(fn)
    })
  })

  // ── convenience helpers ──────────────────────────────────────────────────────

  describe('toastSuccess', () => {
    it('emits success type with duration 3000', () => {
      const fn = vi.fn()
      subscribe(fn)
      toastSuccess('done')
      const t = fn.mock.calls[0][0]
      expect(t.type).toBe('success')
      expect(t.duration).toBe(3000)
      expect(t.message).toBe('done')
      unsubscribe(fn)
    })
  })

  describe('toastError', () => {
    it('emits error type with duration 5000', () => {
      const fn = vi.fn()
      subscribe(fn)
      toastError('fail')
      const t = fn.mock.calls[0][0]
      expect(t.type).toBe('error')
      expect(t.duration).toBe(5000)
      unsubscribe(fn)
    })
  })

  describe('toastInfo', () => {
    it('emits info type with duration 3000', () => {
      const fn = vi.fn()
      subscribe(fn)
      toastInfo('info msg')
      const t = fn.mock.calls[0][0]
      expect(t.type).toBe('info')
      expect(t.duration).toBe(3000)
      unsubscribe(fn)
    })
  })

  describe('toastWarning', () => {
    it('emits warning type with duration 4000', () => {
      const fn = vi.fn()
      subscribe(fn)
      toastWarning('warn msg')
      const t = fn.mock.calls[0][0]
      expect(t.type).toBe('warning')
      expect(t.duration).toBe(4000)
      unsubscribe(fn)
    })
  })
})
