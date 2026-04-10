import { useEffect, useRef } from 'react'
import { t } from '../../utils/i18n'

interface PermissionRequest { requestId: string; toolName: string; input: unknown }

function trapFocus(container: HTMLElement, e: React.KeyboardEvent) {
  if (e.key !== 'Tab') return
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}

export function PermissionModal({
  request,
  onReply,
  onAllowSession,
}: {
  request: PermissionRequest
  onReply: (allow: boolean) => void
  onAllowSession: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onReply(true) }
      if (e.key === 'Escape') { e.preventDefault(); onReply(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onReply])

  useEffect(() => {
    setTimeout(() => {
      const buttons = modalRef.current?.querySelectorAll<HTMLElement>('button')
      const allowBtn = buttons?.[buttons.length - 1]
      allowBtn?.focus()
    }, 50)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('permission.dialog', '권한 요청')}
        onKeyDown={e => { if (modalRef.current) trapFocus(modalRef.current, e) }}
        style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 20,
        width: 420,
        maxWidth: '90vw',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--warning)' }}>
          Permission Required
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Claude wants to use:
          <code style={{
            display: 'block',
            background: 'var(--bg-tertiary)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent)',
            fontSize: 12,
          }}>
            {request.toolName}
          </code>
        </div>
        {!!request.input && (
          <pre style={{
            background: 'var(--bg-tertiary)',
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            overflow: 'auto',
            maxHeight: 120,
            marginBottom: 16,
            fontFamily: 'var(--font-mono)',
          }}>
            {JSON.stringify(request.input, null, 2)}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => onReply(false)}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            거부
            <span style={{ fontSize: 10, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>Esc</span>
          </button>
          <button
            onClick={onAllowSession}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-tertiary)',
              color: 'var(--accent)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--accent)',
              fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            세션 허용
          </button>
          <button
            onClick={() => onReply(true)}
            style={{
              padding: '6px 16px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            허용
            <span style={{ fontSize: 10, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>Enter</span>
          </button>
        </div>
      </div>
    </div>
  )
}
