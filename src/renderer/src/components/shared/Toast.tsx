import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onRemove: (id: number) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 32,
      right: 16,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <ToastItemComponent key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItemComponent({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  const color = toast.type === 'success' ? 'var(--accent)'
    : toast.type === 'error' ? 'var(--error)'
    : 'var(--text-muted)'

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${color}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: '8px 14px',
        fontSize: 12,
        color: 'var(--text-primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'opacity 0.3s, transform 0.3s',
        minWidth: 160,
        maxWidth: 280,
      }}
      onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300) }}
    >
      {toast.message}
    </div>
  )
}
