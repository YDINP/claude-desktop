import React, { useRef } from 'react'

interface VariableModalProps {
  varModal: { text: string; vars: string[] }
  varValues: Record<string, string>
  onVarValuesChange: (values: Record<string, string>) => void
  onCancel: () => void
  onSend: (text: string) => void
}

export function VariableModal({ varModal, varValues, onVarValuesChange, onCancel, onSend }: VariableModalProps) {
  const varInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const doSend = () => {
    let result = varModal.text
    varModal.vars.forEach(v => {
      result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), varValues[v] ?? '')
    })
    onCancel()
    onSend(result)
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '8px 8px 0 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        padding: '14px 16px 12px',
        width: '100%',
        maxWidth: 560,
        pointerEvents: 'all',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent, #89b4fa)', marginBottom: 10 }}>
          🔧 변수 값 입력
        </div>
        {varModal.vars.map((varName, i) => (
          <div key={varName} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <label style={{
              fontSize: 12, color: 'var(--text-secondary)',
              minWidth: 120, fontFamily: 'monospace',
              background: 'rgba(96,165,250,0.1)',
              borderRadius: 4, padding: '2px 6px',
              border: '1px solid rgba(96,165,250,0.2)',
            }}>
              {'{{'}{varName}{'}}'}
            </label>
            <input
              ref={el => { varInputRefs.current[i] = el }}
              type="text"
              value={varValues[varName] ?? ''}
              onChange={e => onVarValuesChange({ ...varValues, [varName]: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (i < varModal.vars.length - 1) {
                    varInputRefs.current[i + 1]?.focus()
                  } else {
                    doSend()
                  }
                } else if (e.key === 'Escape') {
                  onCancel()
                }
              }}
              placeholder={`${varName} 값 입력...`}
              autoFocus={i === 0}
              style={{
                flex: 1,
                background: 'var(--bg-input, var(--bg-primary))',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm, 4px)',
                color: 'var(--text-primary)',
                fontSize: 13,
                padding: '5px 10px',
                outline: 'none',
              }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-muted)',
              fontSize: 12,
              padding: '5px 14px',
              cursor: 'pointer',
            }}
          >취소</button>
          <button
            onClick={doSend}
            style={{
              background: 'var(--accent, #89b4fa)',
              border: 'none',
              borderRadius: 4,
              color: '#1e1e2e',
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 16px',
              cursor: 'pointer',
            }}
          >치환 후 전송</button>
        </div>
      </div>
    </div>
  )
}
