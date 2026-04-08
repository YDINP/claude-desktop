import React, { memo, type RefObject } from 'react'
import type { ChatMessage } from '../../domains/chat/domain'

export interface MiniMapProps {
  messages: ChatMessage[]
  scrollTop: number
  clientHeight: number
  totalScrollHeight: number
  blockHeights: number[]
  totalRaw: number
  minimapRef: RefObject<HTMLDivElement>
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
}

export const MiniMap = memo(function MiniMap({ messages, scrollTop, clientHeight, totalScrollHeight, blockHeights, totalRaw, minimapRef, onClick }: MiniMapProps) {
  return (
    <div
      ref={minimapRef}
      onClick={onClick}
      style={{
        width: 40,
        flexShrink: 0,
        background: 'rgba(0,0,0,0.3)',
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {(() => {
        const containerH = minimapRef.current?.clientHeight ?? 300
        const scale = totalRaw > containerH ? containerH / totalRaw : 1
        let offsetY = 0
        const blocks = messages.map((msg, i) => {
          const h = blockHeights[i] * scale
          const y = offsetY
          offsetY += h + scale
          return (
            <div
              key={msg.id}
              style={{
                position: 'absolute',
                top: y,
                left: 4,
                right: 4,
                height: Math.max(2, h),
                background: msg.role === 'user' ? '#4a90e2' : '#666',
                borderRadius: 1,
              }}
            />
          )
        })

        const totalScrollH = Math.max(totalScrollHeight, 1)
        const vpTop = (scrollTop / totalScrollH) * containerH
        const vpHeight = Math.max(10, (clientHeight / (totalScrollH + clientHeight)) * containerH)
        const viewport = (
          <div
            key="viewport"
            style={{
              position: 'absolute',
              top: vpTop,
              left: 0,
              right: 0,
              height: vpHeight,
              background: 'rgba(137,180,250,0.15)',
              border: '1px solid rgba(137,180,250,0.4)',
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
        )

        return <>{blocks}{viewport}</>
      })()}
    </div>
  )
})
