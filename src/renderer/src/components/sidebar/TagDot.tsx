import React from 'react'
import { TAG_CSS, type TagColor } from './sessionUtils'

export function TagDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: TAG_CSS[color as TagColor] ?? color,
      flexShrink: 0,
    }} />
  )
}
