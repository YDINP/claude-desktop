export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

type Listener = (t: Toast) => void

const listeners: Listener[] = []
let _seq = 0

export function subscribe(cb: Listener): void {
  listeners.push(cb)
}

export function unsubscribe(cb: Listener): void {
  const idx = listeners.indexOf(cb)
  if (idx !== -1) listeners.splice(idx, 1)
}

export function toast(message: string, type: ToastType = 'info', duration?: number): void {
  const t: Toast = { id: `toast-${++_seq}`, message, type, duration }
  listeners.forEach(cb => cb(t))
}

export function toastSuccess(message: string): void {
  toast(message, 'success', 3000)
}

export function toastError(message: string): void {
  toast(message, 'error', 5000)
}

export function toastInfo(message: string): void {
  toast(message, 'info', 3000)
}

export function toastWarning(message: string): void {
  toast(message, 'warning', 4000)
}

// Legacy shim — keeps App.tsx registerToast call working during migration
export function registerToast(_fn: unknown): void {
  // no-op: event emitter pattern replaces this
}
