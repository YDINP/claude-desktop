import React, { memo } from 'react'
import type { SceneNode, ViewTransform } from './types'
import { cocosToSvg, getComponentIcon } from './utils'

interface NodeRendererProps {
  node: SceneNode
  nodeMap: Map<string, SceneNode>
  view: ViewTransform
  selected: boolean
  hovered: boolean
  onMouseDown: (e: React.MouseEvent, uuid: string) => void
  onMouseEnter: (uuid: string) => void
  onMouseLeave: () => void
}

// 디자인 해상도 (씬 좌표 기준 — 추후 SceneViewPanel에서 주입할 것)
const DESIGN_W = 960
const DESIGN_H = 640

// 8방향 리사이즈 핸들 위치 (0~1 비율, 좌상단 기준)
const HANDLES = [
  { id: 'nw', rx: 0,   ry: 0   },
  { id: 'n',  rx: 0.5, ry: 0   },
  { id: 'ne', rx: 1,   ry: 0   },
  { id: 'e',  rx: 1,   ry: 0.5 },
  { id: 'se', rx: 1,   ry: 1   },
  { id: 's',  rx: 0.5, ry: 1   },
  { id: 'sw', rx: 0,   ry: 1   },
  { id: 'w',  rx: 0,   ry: 0.5 },
]

export const NodeRenderer = memo(function NodeRenderer({
  node,
  view,
  selected,
  hovered,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}: NodeRendererProps) {
  // 씬 좌표 → SVG 좌표 변환
  const { sx, sy } = cocosToSvg(node.x, node.y, DESIGN_W, DESIGN_H)

  // 실제 픽셀 크기 (스케일 적용)
  const pw = node.width * Math.abs(node.scaleX)
  const ph = node.height * Math.abs(node.scaleY)

  // anchor 기준으로 좌상단 계산
  const rx = sx - pw * node.anchorX
  const ry = sy - ph * (1 - node.anchorY)  // Cocos Y 역전

  // 회전 중심 (anchor 점)
  const cx = sx
  const cy = sy

  const opacity = node.active ? (node.opacity / 255) : 0.3

  // 테두리 색상 결정
  const strokeColor = selected
    ? 'var(--accent)'
    : hovered
    ? 'rgba(0, 152, 255, 0.5)'
    : 'rgba(255, 255, 255, 0.25)'

  const strokeWidth = selected ? 1.5 : 1
  const strokeDash = node.active ? 'none' : '4 3'

  const icon = getComponentIcon(node.components)

  return (
    <g
      opacity={opacity}
      transform={`rotate(${-node.rotation} ${cx} ${cy})`}
      onMouseDown={e => onMouseDown(e, node.uuid)}
      onMouseEnter={() => onMouseEnter(node.uuid)}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'move' }}
    >
      {/* 노드 바디 */}
      <rect
        x={rx}
        y={ry}
        width={pw}
        height={ph}
        fill="rgba(255, 255, 255, 0.04)"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        rx={2}
      />

      {/* 라벨 */}
      {(pw > 20 && ph > 12) && (
        <text
          x={rx + 4}
          y={ry + 11}
          fontSize={9}
          fill="rgba(255, 255, 255, 0.7)"
          fontFamily="var(--font-mono)"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {icon ? `${icon} ` : ''}{node.name.length > 14 ? node.name.slice(0, 12) + '\u2026' : node.name}
        </text>
      )}

      {/* 선택 핸들 (8개) */}
      {selected && HANDLES.map(h => {
        const hx = rx + pw * h.rx
        const hy = ry + ph * h.ry
        return (
          <g key={h.id}>
            <rect
              x={hx - 4}
              y={hy - 4}
              width={8}
              height={8}
              fill="var(--bg-secondary)"
              stroke="var(--accent)"
              strokeWidth={1}
              rx={1}
              style={{ cursor: `${h.id}-resize`, pointerEvents: 'all' }}
            />
          </g>
        )
      })}

      {/* 앵커 포인트 (선택 시) */}
      {selected && (
        <circle
          cx={cx}
          cy={cy}
          r={3}
          fill="var(--accent)"
          stroke="var(--bg-secondary)"
          strokeWidth={1}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  )
})
