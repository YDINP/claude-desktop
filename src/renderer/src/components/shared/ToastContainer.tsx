import { useEffect, useRef, useState } from 'react'
import { subscribe, unsubscribe } from '../../utils/toast'
import type { Toast, ToastType } from '../../utils/toast'

const MAX_TOASTS = 5

const BORDER_COLOR: Record<ToastType, string> = {
  success: '#4caf50',
  error:   '#f44336',
  info:    '#527bff',
  warning: '#ff9800',
}

const ICON: Record<ToastType, string> = {
  success: '✅',
  error:   '❌',
  info:    'ℹ️',
  warning: '⚠️',
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  error:   5000,
  info:    3000,
  warning: 4000,
}

interface ToastEntry extends Toast {
  visible: boolean
}

function ToastItem({
  entry,
  onRemove,
}: {
  entry: ToastEntry
  onRemove: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = () => {
    setVisible(false)
    setTimeout(() => onRemove(entry.id), 300)
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const duration = entry.duration ?? DEFAULT_DURATION[entry.type]
    timerRef.current = setTimeout(dismiss, duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const borderColor = BORDER_COLOR[entry.type]

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        width: 320,
        padding: '10px 36px 10px 14px',
        background: '#2a2a2a',
        borderRadius: 8,
        borderLeft: `4px solid ${borderColor}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        color: '#fff',
        fontSize: 13,
        lineHeight: '1.4',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 15 }}>{ICON[entry.type]}</span>
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{entry.message}</span>
      <span
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          fontSize: 14,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1,
        }}
      >
        ×
      </span>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => {
        const next = [...prev, { ...t, visible: false }]
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
      })
    }
    subscribe(handler)
    return () => unsubscribe(handler)
  }, [])

  const remove = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(entry => (
        <ToastItem key={entry.id} entry={entry} onRemove={remove} />
      ))}
    </div>
  )
}
