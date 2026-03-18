import React, { useState, useRef } from 'react'

export function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const [checked, setChecked] = useState(value)
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 16, flexShrink: 0, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => {
          setChecked(e.target.checked)
          onChange(e.target.checked)
        }}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <span style={{
        position: 'absolute', inset: 0,
        background: checked ? '#4caf50' : '#555',
        borderRadius: 16,
        transition: 'background 0.2s ease',
      }} />
      <span style={{
        position: 'absolute',
        top: 2, left: checked ? 18 : 2,
        width: 12, height: 12,
        background: '#fff',
        borderRadius: '50%',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }} />
    </label>
  )
}

/** 스크러빙 라벨: 마우스 좌우 드래그로 숫자 값 조절 */
export function ScrubLabel({ label, value, onChange, step = 1, inputRef }: { label: string; value: number; onChange: (v: number) => void; step?: number; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const startRef = useRef<{ x: number; v: number; moved: boolean } | null>(null)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startRef.current = { x: e.clientX, v: value, moved: false }
    const sensitivity = e.shiftKey ? 0.05 : 0.5
    const onMove = (me: MouseEvent) => {
      if (!startRef.current) return
      startRef.current.moved = true
      const dx = me.clientX - startRef.current.x
      const raw = startRef.current.v + dx * sensitivity * step
      onChange(Math.round(raw / step) * step)
    }
    const onUp = (ue: MouseEvent) => {
      const wasDrag = startRef.current?.moved ?? false
      startRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!wasDrag) {
        // 클릭으로 처리: input에 포커스
        inputRef?.current?.focus()
        inputRef?.current?.select()
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  return (
    <span
      onMouseDown={handleMouseDown}
      title={`드래그로 ${label} 조절 (Shift: 미세 조절)`}
      style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, cursor: 'ew-resize', userSelect: 'none' }}
    >{label}</span>
  )
}
