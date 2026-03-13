import React, { memo, useEffect, useState } from 'react'
import type { SceneNode, ViewTransform } from './types'
import { cocosToSvg, getComponentIcon } from './utils'

interface NodeRendererProps {
  node: SceneNode
  nodeMap: Map<string, SceneNode>
  view: ViewTransform
  selected: boolean
  hovered: boolean
  multiSelected?: boolean
  showLabel?: boolean
  dimmed?: boolean
  hasChildren?: boolean
  collapsed?: boolean
  bookmarked?: boolean
  locked?: boolean
  pinned?: boolean
  highlighted?: boolean
  nodeColor?: string
  designWidth?: number
  designHeight?: number
  flashing?: boolean
  onMouseDown: (e: React.MouseEvent, uuid: string) => void
  onMouseEnter: (uuid: string) => void
  onMouseLeave: () => void
  onDoubleClick?: (uuid: string) => void
}

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
  multiSelected,
  showLabel = true,
  dimmed = false,
  hasChildren = false,
  collapsed = false,
  bookmarked = false,
  locked = false,
  pinned = false,
  highlighted = false,
  flashing = false,
  nodeColor,
  designWidth = 960,
  designHeight = 640,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
}: NodeRendererProps) {
  // worldX/Y가 있으면 월드 좌표 사용 (중첩 노드 위치 정확), 없으면 로컬 좌표 fallback
  const renderX = node.worldX ?? node.x
  const renderY = node.worldY ?? node.y
  // 씬 좌표 → SVG 좌표 변환
  const { sx, sy } = cocosToSvg(renderX, renderY, designWidth, designHeight)

  // 실제 픽셀 크기 (스케일 적용)
  const pw = node.width * Math.abs(node.scaleX)
  const ph = node.height * Math.abs(node.scaleY)

  // anchor 기준으로 좌상단 계산
  const rx = sx - pw * node.anchorX
  const ry = sy - ph * (1 - node.anchorY)  // Cocos Y 역전

  // 회전 중심 (anchor 점)
  const cx = sx
  const cy = sy

  const baseOpacity = node.visible === false ? 0.15 : node.active ? (node.opacity / 255) : 0.3
  const opacity = dimmed ? baseOpacity * 0.2 : locked ? baseOpacity * 0.5 : baseOpacity

  // LOD: 줌 레벨에 따라 렌더링 디테일 단계
  // lod=0: 전체, lod=1: 라벨/아이콘 숨김, lod=2: fill 없음 (테두리만)
  const lod = view.zoom < 0.2 ? 2 : view.zoom < 0.4 ? 1 : 0

  // 컴포넌트 클릭 시 깜빡임 효과
  const [flashOn, setFlashOn] = useState(false)
  useEffect(() => {
    if (!flashing) return
    let count = 0
    setFlashOn(true)
    const id = setInterval(() => {
      count++
      setFlashOn(v => !v)
      if (count >= 5) clearInterval(id)
    }, 150)
    return () => clearInterval(id)
  }, [flashing])

  // 화면 픽셀 크기가 2px 미만인 노드는 완전히 스킵
  if (lod === 2 && pw * view.zoom < 2 && ph * view.zoom < 2 && !selected && !hovered) return null

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
      onDoubleClick={() => onDoubleClick?.(node.uuid)}
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
        fill={lod >= 2 ? 'none' : nodeColor ? `${nodeColor}26` : node.labelColor ? `${node.labelColor}33` : 'rgba(255, 255, 255, 0.04)'}
        stroke={nodeColor ?? node.labelColor ?? strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        rx={2}
      />

      {/* 멀티 선택 하이라이트 */}
      {multiSelected && !selected && (
        <rect
          x={rx - 1}
          y={ry - 1}
          width={pw + 2}
          height={ph + 2}
          fill="rgba(96, 165, 250, 0.08)"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          rx={2}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* 검색 하이라이트 */}
      {highlighted && (
        <rect
          x={rx - 1}
          y={ry - 1}
          width={pw + 2}
          height={ph + 2}
          fill="rgba(251,191,36,0.15)"
          stroke="#fbbf24"
          strokeWidth={2}
          rx={2}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* 깜빡임 효과 (Inspector 컴포넌트 클릭 시) */}
      {flashOn && (
        <rect
          x={rx - 2}
          y={ry - 2}
          width={pw + 4}
          height={ph + 4}
          fill="rgba(96,165,250,0.25)"
          stroke="#60a5fa"
          strokeWidth={2}
          rx={3}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* 컴포넌트 아이콘 오버레이 (zoom > 0.5일 때만 표시, 우상단) */}
      {view.zoom > 0.5 && icon && pw > 10 && ph > 10 && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={rx + pw - Math.max(8, 10 / view.zoom) - 2}
            y={ry + 1}
            width={Math.max(8, 10 / view.zoom) + 2}
            height={Math.max(8, 10 / view.zoom) + 2}
            fill="rgba(0,0,0,0.4)"
            rx={2}
          />
          <text
            x={rx + pw - Math.max(8, 10 / view.zoom) / 2 - 1}
            y={ry + Math.max(8, 10 / view.zoom) + 1}
            fontSize={Math.max(8, 10 / view.zoom)}
            fill="rgba(255,255,255,0.7)"
            textAnchor="middle"
            dominantBaseline="auto"
            fontFamily="var(--font-mono)"
            style={{ userSelect: 'none' }}
          >
            {icon}
          </text>
        </g>
      )}

      {/* 라벨 (LOD: zoom < 0.4 시 숨김) */}
      {lod === 0 && showLabel && (pw > 20 && ph > 12) && (
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

      {/* 즐겨찾기 별 표시 */}
      {bookmarked && lod === 0 && (
        <text
          x={rx + 2}
          y={ry + ph - 2}
          fontSize={8 / 1}
          fill="#fbbf24"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >★</text>
      )}

      {/* 잠금 아이콘 */}
      {locked && lod === 0 && (
        <text
          x={rx + pw - 10}
          y={ry + 10}
          fontSize={8}
          fill="#f87171"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >🔒</text>
      )}

      {/* 핀 아이콘 */}
      {pinned && lod === 0 && (
        <text
          x={rx + pw - (locked ? 20 : 10)}
          y={ry + 10}
          fontSize={10}
          fill="#fbbf24"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >📌</text>
      )}

      {/* 자식 그룹 접힘 표시 — Alt+클릭으로 토글 */}
      {hasChildren && collapsed && lod === 0 && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={rx + pw - 10}
            y={ry + ph - 10}
            width={9}
            height={9}
            fill="var(--accent)"
            rx={1}
          />
          <text
            x={rx + pw - 6}
            y={ry + ph - 3}
            fontSize={7}
            fill="white"
            fontFamily="var(--font-mono)"
            style={{ userSelect: 'none' }}
          >▶</text>
        </g>
      )}
      {hasChildren && !collapsed && lod === 0 && (
        <rect
          x={rx + pw - 8}
          y={ry + ph - 8}
          width={7}
          height={7}
          fill="none"
          stroke="rgba(96,165,250,0.5)"
          strokeWidth={0.8}
          rx={1}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  )
})
