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
  /** R1460: 히트맵 강도 (0~1, undefined면 미적용) */
  heatmapIntensity?: number
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
  heatmapIntensity,
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

  // R1369: Sprite/Label/RichText 컴포넌트 컬러 fill
  const colorComp = node.components.find(c => c.type === 'cc.Sprite' || c.type === 'cc.Label' || c.type === 'cc.RichText')
  const compColor = colorComp?.props?.color as { r: number; g: number; b: number; a: number } | undefined
  const fillColor = compColor ?? (node.color.r !== 255 || node.color.g !== 255 || node.color.b !== 255 ? node.color : undefined)
  const compFillStr = fillColor ? `rgba(${fillColor.r},${fillColor.g},${fillColor.b},${(fillColor.a ?? 255) / 255 * 0.3})` : undefined

  // R1371: 컴포넌트 뱃지 아이콘 (우상단, 최대 3개)
  const MAX_BADGES = 3
  const icons = node.components.slice(0, MAX_BADGES).map(c => getComponentIcon([c]))

  // R1462: cc.Shadow 컴포넌트 감지
  const shadowComp = node.components.find(c => c.type === 'cc.Shadow')
  const shadowEnabled = shadowComp?.props?.enabled !== false && !!shadowComp
  const shadowProps = shadowComp?.props as { color?: { r: number; g: number; b: number; a: number }; blur?: number; offset?: { x: number; y: number } } | undefined
  const shadowFilterId = shadowEnabled ? `shadow-${node.uuid.replace(/[^a-zA-Z0-9]/g, '')}` : null

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
      {/* R1462: cc.Shadow SVG filter defs */}
      {shadowFilterId && shadowEnabled && (
        <defs>
          <filter id={shadowFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx={(shadowProps?.offset?.x ?? 2) / 4}
              dy={-(shadowProps?.offset?.y ?? -2) / 4}
              stdDeviation={(shadowProps?.blur ?? 4) / 3}
              floodColor={shadowProps?.color ? `rgba(${shadowProps.color.r},${shadowProps.color.g},${shadowProps.color.b},${(shadowProps.color.a ?? 255) / 255})` : 'rgba(0,0,0,0.5)'}
            />
          </filter>
        </defs>
      )}
      {/* 노드 바디 */}
      <rect
        x={rx}
        y={ry}
        width={pw}
        height={ph}
        fill={lod >= 2 ? 'none' : compFillStr ? compFillStr : nodeColor ? `${nodeColor}26` : node.labelColor ? `${node.labelColor}33` : 'rgba(255, 255, 255, 0.04)'}
        stroke={nodeColor ?? node.labelColor ?? strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        rx={2}
        filter={shadowFilterId ? `url(#${shadowFilterId})` : undefined}
      >
        {selected && node.components.length > 0 && (
          <title>{node.components.map(c => c.type).join(', ')}</title>
        )}
      </rect>

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

      {/* R1460: 히트맵 오버레이 (클릭 빈도 색상) */}
      {heatmapIntensity != null && heatmapIntensity > 0 && (
        <rect
          x={rx}
          y={ry}
          width={pw}
          height={ph}
          fill={`rgba(${Math.round(255)},${Math.round(140 * (1 - heatmapIntensity))},${Math.round(0)},${0.15 + heatmapIntensity * 0.45})`}
          rx={2}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* 컴포넌트 아이콘 오버레이 (lod=0, 좌상단 배지) */}
      {lod === 0 && icon && pw > 10 && ph > 10 && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={rx + 1}
            y={ry + 1}
            width={12}
            height={12}
            fill="rgba(0,0,0,0.5)"
            rx={2}
          />
          <text
            x={rx + 7}
            y={ry + 11}
            fontSize={10}
            fill="rgba(255,255,255,0.85)"
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
      {lod === 0 && showLabel && (pw > 20 && ph > 12) && (() => {
        // R1400: Camera/ParticleSystem 노드 라벨 접두사
        const hasCamera = node.components.some(c => c.type === 'cc.Camera')
        const hasParticle = node.components.some(c => c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D')
        const prefix = hasCamera ? '\uD83D\uDCF7 ' : hasParticle ? '\u2728 ' : ''
        const displayName = prefix + (node.name.length > 12 ? node.name.slice(0, 12) + '\u2026' : node.name)
        return (
          <text
            x={rx + (icon ? 16 : 4)}
            y={ry + 11}
            fontSize={Math.max(8, Math.min(11, 11 / view.zoom))}
            fill="rgba(255, 255, 255, 0.7)"
            fontFamily="var(--font-mono)"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {displayName}
            {node.name.length > 12 && <title>{node.name}</title>}
          </text>
        )
      })()}

      {/* R1371: 컴포넌트 뱃지 (우상단, 최대 3개) */}
      {showLabel && lod === 0 && pw > 20 && ph > 14 && icons.some(Boolean) && (
        <g style={{ pointerEvents: 'none' }}>
          {icons.map((ic, idx) => {
            if (!ic) return null
            const bx = rx + pw - (idx + 1) * 12 - 1
            const by = ry + 1
            return (
              <g key={idx}>
                <circle cx={bx + 5} cy={by + 5} r={5} fill="rgba(0,0,0,0.55)" />
                <text
                  x={bx + 5} y={by + 8}
                  fontSize={6} fill="rgba(255,255,255,0.85)"
                  textAnchor="middle" dominantBaseline="auto"
                  fontFamily="var(--font-mono)"
                  style={{ userSelect: 'none' }}
                >{ic}</text>
              </g>
            )
          })}
        </g>
      )}

      {/* R1400: Camera 노드 시각 힌트 — 파란 테두리 (#4af) */}
      {lod === 0 && pw > 10 && ph > 10 && node.components.some(c => c.type === 'cc.Camera') && (
        <rect
          x={rx - 1} y={ry - 1} width={pw + 2} height={ph + 2}
          fill="none" stroke="rgba(68,170,255,0.5)" strokeWidth={1.5}
          strokeDasharray="6 3" rx={3}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* R1400: ParticleSystem 노드 시각 힌트 — 주황 테두리 (#fa4) */}
      {lod === 0 && pw > 10 && ph > 10 && node.components.some(c => c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D') && (
        <rect
          x={rx - 1} y={ry - 1} width={pw + 2} height={ph + 2}
          fill="none" stroke="rgba(255,170,68,0.5)" strokeWidth={1.5}
          strokeDasharray="6 3" rx={3}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* R1471: 물리 컴포넌트 시각화 — RigidBody/BoxCollider/CircleCollider/PolygonCollider */}
      {lod === 0 && (() => {
        const rigidBody = node.components.find(c =>
          c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D' ||
          c.type === 'cc.physics.RigidBody')
        const boxCollider = node.components.find(c =>
          c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D' ||
          c.type === 'cc.physics2d.PhysicsBoxCollider')
        const circleCollider = node.components.find(c =>
          c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D' ||
          c.type === 'cc.physics2d.PhysicsCircleCollider')
        const polyCollider = node.components.find(c =>
          c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D' ||
          c.type === 'cc.physics2d.PhysicsPolygonCollider')
        if (!rigidBody && !boxCollider && !circleCollider && !polyCollider) return null
        // 콜라이더 오프셋 (props에서 읽기)
        const cOff = boxCollider?.props?.offset as { x?: number; y?: number } | undefined
        const cSize = boxCollider?.props?.size as { width?: number; height?: number } | undefined
        const cOffX = (cOff?.x ?? 0) * view.scale
        const cOffY = (cOff?.y ?? 0) * view.scale
        const cW = pw + ((cSize?.width ?? 0) * view.scale)
        const cH = ph + ((cSize?.height ?? 0) * view.scale)
        return (
          <g style={{ pointerEvents: 'none' }}>
            {/* BoxCollider — 녹색 점선 */}
            {boxCollider && (
              <rect
                x={rx + cOffX - (cW - pw) / 2} y={ry - cOffY - (cH - ph) / 2}
                width={Math.max(cW, 8)} height={Math.max(cH, 8)}
                fill="rgba(80,255,100,0.06)" stroke="rgba(80,255,100,0.7)"
                strokeWidth={1} strokeDasharray="4 2" rx={1}
              />
            )}
            {/* CircleCollider — 녹색 점선 원 */}
            {circleCollider && (() => {
              const r = (circleCollider.props?.radius as number | undefined ?? Math.min(pw, ph) / 2)
              const cOffC = circleCollider.props?.offset as { x?: number; y?: number } | undefined
              const cx2 = rx + pw / 2 + (cOffC?.x ?? 0) * view.scale
              const cy2 = ry + ph / 2 - (cOffC?.y ?? 0) * view.scale
              return (
                <circle
                  cx={cx2} cy={cy2} r={Math.max(r * view.scale, 4)}
                  fill="rgba(80,255,100,0.06)" stroke="rgba(80,255,100,0.7)"
                  strokeWidth={1} strokeDasharray="4 2"
                />
              )
            })()}
            {/* PolygonCollider — 녹색 다각형 */}
            {polyCollider && pw > 4 && ph > 4 && (
              <rect
                x={rx - 2} y={ry - 2} width={pw + 4} height={ph + 4}
                fill="rgba(80,255,100,0.06)" stroke="rgba(80,255,100,0.7)"
                strokeWidth={1} strokeDasharray="2 2"
              />
            )}
            {/* RigidBody 배지 — 우하단 'RB' */}
            {rigidBody && pw > 16 && ph > 12 && (
              <text x={rx + pw - 1} y={ry + ph - 1} fontSize={6} fill="rgba(80,255,100,0.9)"
                fontFamily="var(--font-mono)" textAnchor="end" style={{ userSelect: 'none' }}>RB</text>
            )}
          </g>
        )
      })()}

      {/* R1388: Sprite SLICED/TILED 렌더링 힌트 */}
      {lod === 0 && pw > 20 && ph > 20 && (() => {
        const spriteComp = node.components.find(c => c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D')
        const spriteType = spriteComp?.props?.type as number | undefined
        if (spriteType === 2) {
          // SLICED: 3x3 점선 격자
          const thirdW = pw / 3
          const thirdH = ph / 3
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={rx + thirdW} y1={ry} x2={rx + thirdW} y2={ry + ph}
                stroke="rgba(255,200,50,0.35)" strokeWidth={0.6} strokeDasharray="3 2" />
              <line x1={rx + thirdW * 2} y1={ry} x2={rx + thirdW * 2} y2={ry + ph}
                stroke="rgba(255,200,50,0.35)" strokeWidth={0.6} strokeDasharray="3 2" />
              <line x1={rx} y1={ry + thirdH} x2={rx + pw} y2={ry + thirdH}
                stroke="rgba(255,200,50,0.35)" strokeWidth={0.6} strokeDasharray="3 2" />
              <line x1={rx} y1={ry + thirdH * 2} x2={rx + pw} y2={ry + thirdH * 2}
                stroke="rgba(255,200,50,0.35)" strokeWidth={0.6} strokeDasharray="3 2" />
              <text x={rx + 2} y={ry + ph - 2} fontSize={6} fill="rgba(255,200,50,0.5)"
                fontFamily="var(--font-mono)" style={{ userSelect: 'none' }}>9s</text>
            </g>
          )
        }
        if (spriteType === 3) {
          // TILED: small x pattern fill
          const gap = 12
          const crosses: React.ReactElement[] = []
          for (let ix = rx + gap; ix < rx + pw - 4; ix += gap) {
            for (let iy = ry + gap; iy < ry + ph - 4; iy += gap) {
              crosses.push(
                <g key={`${ix}-${iy}`}>
                  <line x1={ix - 2} y1={iy - 2} x2={ix + 2} y2={iy + 2}
                    stroke="rgba(150,200,255,0.3)" strokeWidth={0.5} />
                  <line x1={ix + 2} y1={iy - 2} x2={ix - 2} y2={iy + 2}
                    stroke="rgba(150,200,255,0.3)" strokeWidth={0.5} />
                </g>
              )
            }
          }
          return (
            <g style={{ pointerEvents: 'none' }}>
              {crosses}
              <text x={rx + 2} y={ry + ph - 2} fontSize={6} fill="rgba(150,200,255,0.5)"
                fontFamily="var(--font-mono)" style={{ userSelect: 'none' }}>tile</text>
            </g>
          )
        }
        return null
      })()}

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
