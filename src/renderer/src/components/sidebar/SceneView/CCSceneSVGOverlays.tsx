import { useCCSceneCtx } from './CCSceneContext'
import { t } from '../../../utils/i18n'

/** 씬 레벨 SVG 오버레이 (노드 렌더링 후, <g transform> 내부) */
export function CCSceneSVGOverlays() {
  const ctx = useCCSceneCtx()
  const {
    selectedUuid, onSelect,
    view, svgRef,
    flatNodes, nodeMap,
    designW, designH, effectiveW, effectiveH,
    cx, cy, ccToSvg, cameraFrames,
    multiSelected, uuids,
    selectionBox,
    ov,
    lockedUuids,
    hiddenUuids,
    svSearch,
    mouseScenePos,
    pinMarkers, setPinMarkers,
    refUuids, parentUuidSet,
  } = ctx
  const {
    selectionColor,
    showCameraFrames,
    showZeroSizeWarn, showSelPolyline, showHierarchyLines,
    showCrosshair, showSelAxisLine, showSiblingHighlight,
    showRefArrows, showPairDist, showSelCenter,
    showSelGroupBBox, showSafeZone, showRuleOfThirds,
    showCustomRatio, customRatioW, customRatioH,
    showOriginCross, showDupNameOverlay,
    showSelBBox, showSceneBBox,
    showSiblingGroup,
    hideInactiveNodes,
  } = ov

  return (
    <>
          {/* R2696: 크기 0 노드 경고 오버레이 */}
          {showZeroSizeWarn && flatNodes.map(fn => {
            if ((fn.node.size?.x ?? 0) !== 0 && (fn.node.size?.y ?? 0) !== 0) return null
            const sp = ccToSvg(fn.worldX, fn.worldY)
            const fs = 11 / view.zoom
            return (
              <g key={`zw-${fn.node.uuid}`} style={{ pointerEvents: 'none' }}>
                <text x={sp.x} y={sp.y + fs * 0.4} textAnchor="middle" fontSize={fs}
                  fill="rgba(239,68,68,0.9)" style={{ userSelect: 'none' }}>⚠</text>
              </g>
            )
          })}
          {/* R2728: 잠금 노드 🔒 아이콘 오버레이 */}
          {lockedUuids.size > 0 && flatNodes.map(fn => {
            if (!lockedUuids.has(fn.node.uuid)) return null
            const sp = ccToSvg(fn.worldX, fn.worldY)
            const w = fn.node.size?.x ?? 0
            const h = fn.node.size?.y ?? 0
            const ax = fn.node.anchor?.x ?? 0.5
            const ay = fn.node.anchor?.y ?? 0.5
            // 화면 고정 크기 14px: UI 오버레이이므로 zoom에 따라 변하지 않아야 함
            const iconSize = 14 / view.zoom
            // 노드 우상단 모서리 기준
            const iconX = sp.x + w * (1 - ax) - iconSize * 0.1
            const iconY = sp.y - h * (1 - ay) + iconSize * 1.1
            return (
              <text key={`lk-${fn.node.uuid}`}
                x={iconX} y={iconY} fontSize={iconSize}
                textAnchor="end" fill="rgba(251,191,36,0.9)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >🔒</text>
            )
          })}
          {/* R2645: 선택 노드 순서 연결선 오버레이 */}
          {showSelPolyline && uuids.length >= 2 && (() => {
            const ordered: { x: number; y: number }[] = []
            uuids.forEach(uid => {
              const found = flatNodes.find(fn => fn.node.uuid === uid)
              if (found) ordered.push(ccToSvg(found.worldX, found.worldY))
            })
            if (ordered.length < 2) return null
            const pts = ordered.map(p => `${p.x},${p.y}`).join(' ')
            const sw = 1.5 / view.zoom
            return (
              <polyline points={pts}
                fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth={sw}
                strokeDasharray={`${4/view.zoom} ${2/view.zoom}`}
                style={{ pointerEvents: 'none' }} />
            )
          })()}
          {/* R2646: 계층 구조 연결선 오버레이 */}
          {showHierarchyLines && (() => {
            const posMap = new Map<string, { x: number; y: number }>()
            flatNodes.forEach(fn => { posMap.set(fn.node.uuid, ccToSvg(fn.worldX, fn.worldY)) })
            const sw = 1 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                {flatNodes.map(fn => {
                  if (!fn.parentUuid) return null
                  const from = posMap.get(fn.parentUuid)
                  const to = posMap.get(fn.node.uuid)
                  if (!from || !to) return null
                  return (
                    <line key={fn.node.uuid}
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke="rgba(103,232,249,0.35)" strokeWidth={sw}
                      style={{ pointerEvents: 'none' }} />
                  )
                })}
              </g>
            )
          })()}
          {/* R2661: 마우스 크로스헤어 가이드라인 */}
          {showCrosshair && mouseScenePos && (() => {
            const sp = ccToSvg(mouseScenePos.x, mouseScenePos.y)
            const sw = 1 / view.zoom
            const viewW = svgRef.current?.clientWidth ?? 800
            const viewH = svgRef.current?.clientHeight ?? 600
            const left = (0 - view.offsetX) / view.zoom
            const right = (viewW - view.offsetX) / view.zoom
            const top = (0 - view.offsetY) / view.zoom
            const bottom = (viewH - view.offsetY) / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={left} y1={sp.y} x2={right} y2={sp.y} stroke="rgba(148,163,184,0.5)" strokeWidth={sw} />
                <line x1={sp.x} y1={top} x2={sp.x} y2={bottom} stroke="rgba(148,163,184,0.5)" strokeWidth={sw} />
              </g>
            )
          })()}
          {/* R2698: 선택 노드 위치 가이드 십자선 */}
          {showSelAxisLine && selectedUuid && (() => {
            const fn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!fn) return null
            const sp = ccToSvg(fn.worldX, fn.worldY)
            const viewW = svgRef.current?.clientWidth ?? 800
            const viewH = svgRef.current?.clientHeight ?? 600
            const left = (0 - view.offsetX) / view.zoom
            const right = (viewW - view.offsetX) / view.zoom
            const top = (0 - view.offsetY) / view.zoom
            const bottom = (viewH - view.offsetY) / view.zoom
            const sw = 1 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={left} y1={sp.y} x2={right} y2={sp.y} stroke="rgba(34,211,238,0.45)" strokeWidth={sw} strokeDasharray={`${5/view.zoom} ${3/view.zoom}`} />
                <line x1={sp.x} y1={top} x2={sp.x} y2={bottom} stroke="rgba(34,211,238,0.45)" strokeWidth={sw} strokeDasharray={`${5/view.zoom} ${3/view.zoom}`} />
              </g>
            )
          })()}
          {/* R2700: 선택 노드 형제 강조 오버레이 */}
          {showSiblingHighlight && selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn || !selFn.parentUuid) return null
            const siblings = flatNodes.filter(f => f.parentUuid === selFn.parentUuid && f.node.uuid !== selectedUuid)
            if (siblings.length === 0) return null
            const sw = 1.5 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                {siblings.map(fn => {
                  const sp2 = ccToSvg(fn.worldX, fn.worldY)
                  const w2 = fn.node.size?.x ?? 0, h2 = fn.node.size?.y ?? 0
                  const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
                  const rx = sp2.x - w2 * ax, ry = sp2.y - h2 * (1 - ay)
                  return (
                    <rect key={fn.node.uuid} x={rx} y={ry} width={w2} height={h2}
                      fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.7)" strokeWidth={sw}
                      strokeDasharray={`${3/view.zoom} ${2/view.zoom}`} />
                  )
                })}
              </g>
            )
          })()}
          {/* R2718: 선택 노드 uuid 참조 화살표 오버레이 */}
          {showRefArrows && selectedUuid && refUuids.length > 0 && (() => {
            const selFn = nodeMap.get(selectedUuid)
            if (!selFn) return null
            const fromSvg = ccToSvg(selFn.worldX, selFn.worldY)
            const sw = 1.5 / view.zoom
            return (
              <g style={{ pointerEvents: 'none' }}>
                {refUuids.map(refUuid => {
                  const toFn = nodeMap.get(refUuid)
                  if (!toFn) return null
                  const toSvg = ccToSvg(toFn.worldX, toFn.worldY)
                  return (
                    <line key={refUuid}
                      x1={fromSvg.x} y1={fromSvg.y}
                      x2={toSvg.x} y2={toSvg.y}
                      stroke="#f97316" strokeWidth={sw} opacity={0.8}
                      markerEnd="url(#ref-arrow)" />
                  )
                })}
              </g>
            )
          })()}
          {/* R2682: 선택 노드 간 거리 텍스트 */}
          {showPairDist && uuids.length >= 2 && (() => {
            const posMap = new Map<string, { x: number; y: number }>()
            flatNodes.forEach(fn => posMap.set(fn.node.uuid, { x: fn.worldX, y: fn.worldY }))
            const pairs: { a: string; b: string }[] = []
            for (let i = 0; i < uuids.length - 1; i++) pairs.push({ a: uuids[i], b: uuids[i + 1] })
            return (
              <g pointerEvents="none">
                {pairs.map(({ a, b }, i) => {
                  const pa = posMap.get(a), pb = posMap.get(b)
                  if (!pa || !pb) return null
                  const sa = ccToSvg(pa.x, pa.y), sb = ccToSvg(pb.x, pb.y)
                  const mx = (sa.x + sb.x) / 2, my = (sa.y + sb.y) / 2
                  const dx = pb.x - pa.x, dy = pb.y - pa.y
                  const dist = Math.round(Math.sqrt(dx * dx + dy * dy))
                  return (
                    <text key={i} x={mx} y={my - 3 / view.zoom} fontSize={8 / view.zoom} fill="#a78bfa" textAnchor="middle" style={{ userSelect: 'none' }}>{dist}</text>
                  )
                })}
              </g>
            )
          })()}
          {/* R2680: 선택 그룹 중심 마커 */}
          {showSelCenter && uuids.length >= 1 && (() => {
            const selFlat = flatNodes.filter(fn => uuids.includes(fn.node.uuid))
            if (selFlat.length === 0) return null
            const xs = selFlat.map(fn => fn.worldX)
            const ys = selFlat.map(fn => fn.worldY)
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2
            const cy = (Math.min(...ys) + Math.max(...ys)) / 2
            const sp = ccToSvg(cx, cy)
            const r = 6 / view.zoom
            const sw = 1.5 / view.zoom
            return (
              <g pointerEvents="none">
                <line x1={sp.x - r} y1={sp.y} x2={sp.x + r} y2={sp.y} stroke="rgba(52,211,153,0.9)" strokeWidth={sw} />
                <line x1={sp.x} y1={sp.y - r} x2={sp.x} y2={sp.y + r} stroke="rgba(52,211,153,0.9)" strokeWidth={sw} />
                <circle cx={sp.x} cy={sp.y} r={r * 0.4} fill="none" stroke="rgba(52,211,153,0.9)" strokeWidth={sw} />
              </g>
            )
          })()}
          {/* R2647: 선택 노드 그룹 바운딩박스 */}
          {showSelGroupBBox && uuids.length >= 1 && (() => {
            const selFlat = flatNodes.filter(fn => uuids.includes(fn.node.uuid))
            if (selFlat.length === 0) return null
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            selFlat.forEach(({ node, worldX, worldY }) => {
              const w2 = (node.size?.x ?? 0) / 2, h2 = (node.size?.y ?? 0) / 2
              if (w2 === 0 && h2 === 0) { minX = Math.min(minX, worldX); maxX = Math.max(maxX, worldX); minY = Math.min(minY, worldY); maxY = Math.max(maxY, worldY); return }
              minX = Math.min(minX, worldX - w2); maxX = Math.max(maxX, worldX + w2)
              minY = Math.min(minY, worldY - h2); maxY = Math.max(maxY, worldY + h2)
            })
            if (!isFinite(minX)) return null
            const svgL = ccToSvg(minX, maxY).x, svgT = ccToSvg(minX, maxY).y
            const svgR = ccToSvg(maxX, minY).x, svgB = ccToSvg(maxX, minY).y
            const bw = svgR - svgL, bh = svgB - svgT
            const sw = 1.5 / view.zoom
            const fs = 9 / view.zoom
            const wCC = Math.round(maxX - minX), hCC = Math.round(maxY - minY)
            return (
              <>
                <rect x={svgL} y={svgT} width={bw} height={bh}
                  fill="none" stroke="rgba(96,165,250,0.7)" strokeWidth={sw}
                  strokeDasharray={`${4/view.zoom} ${2/view.zoom}`} style={{ pointerEvents: 'none' }} />
                <text x={svgL + 2/view.zoom} y={svgT - 2/view.zoom}
                  fontSize={fs} fill="rgba(96,165,250,0.9)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{wCC}×{hCC}</text>
              </>
            )
          })()}
          {/* R2629: 안전 영역 + 비율 가이드 오버레이 */}
          {showSafeZone && (() => {
            const cw = effectiveW, ch = effectiveH
            // SVG 내 캔버스 좌상단 좌표: cc(0,0) = SVG(cx,cy), cc(-cw/2, ch/2) = 좌상단
            const svgLeft = cx - cw / 2, svgTop = cy - ch / 2
            // 90% safe zone
            const safeMarginX = cw * 0.05, safeMarginY = ch * 0.05
            const safeX = svgLeft + safeMarginX, safeY = svgTop + safeMarginY
            const safeW = cw * 0.9, safeH = ch * 0.9
            const sw = 1 / view.zoom
            const fs = 8 / view.zoom
            return (
              <>
                {/* 90% 안전 영역 */}
                <rect x={safeX} y={safeY} width={safeW} height={safeH}
                  fill="none" stroke="rgba(251,191,36,0.5)" strokeWidth={sw}
                  strokeDasharray={`${4/view.zoom} ${2/view.zoom}`} style={{ pointerEvents: 'none' }} />
                <text x={safeX + 2/view.zoom} y={safeY - 2/view.zoom}
                  fontSize={fs} fill="rgba(251,191,36,0.7)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>90%</text>
                {/* 16:9 가이드 (캔버스 높이 기준) */}
                {(() => {
                  const h169 = ch, w169 = Math.round(ch * 16 / 9)
                  if (w169 <= cw) {
                    const x169 = cx - w169 / 2
                    return <rect x={x169} y={svgTop} width={w169} height={h169}
                      fill="none" stroke="rgba(96,165,250,0.35)" strokeWidth={sw}
                      strokeDasharray={`${6/view.zoom} ${3/view.zoom}`} style={{ pointerEvents: 'none' }} />
                  }
                  const w169b = cw, h169b = Math.round(cw * 9 / 16)
                  const y169b = cy - h169b / 2
                  return <rect x={svgLeft} y={y169b} width={w169b} height={h169b}
                    fill="none" stroke="rgba(96,165,250,0.35)" strokeWidth={sw}
                    strokeDasharray={`${6/view.zoom} ${3/view.zoom}`} style={{ pointerEvents: 'none' }} />
                })()}
                <text x={svgLeft + 2/view.zoom} y={svgTop + fs * 1.4}
                  fontSize={fs} fill="rgba(96,165,250,0.6)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>16:9</text>
              </>
            )
          })()}
          {/* R2709: 커스텀 비율 가이드 오버레이 */}
          {showCustomRatio && customRatioW > 0 && customRatioH > 0 && (() => {
            const cw = effectiveW, ch = effectiveH
            const svgLeft = cx - cw / 2, svgTop = cy - ch / 2
            const scale = Math.min(cw / customRatioW, ch / customRatioH)
            const rw = customRatioW * scale
            const rh = customRatioH * scale
            const rx = cx - rw / 2
            const ry = cy - rh / 2
            const sw = 1.5 / view.zoom
            const dash = 6 / view.zoom
            const fs = 8 / view.zoom
            return (
              <g>
                <rect x={rx} y={ry} width={rw} height={rh}
                  fill="none"
                  stroke="rgba(234,179,8,0.7)"
                  strokeWidth={sw}
                  strokeDasharray={`${dash} ${dash}`}
                  style={{ pointerEvents: 'none' }} />
                <text x={rx + 2/view.zoom} y={ry - 3/view.zoom}
                  fill="rgba(234,179,8,0.8)"
                  fontSize={fs}
                  fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>{customRatioW}:{customRatioH}</text>
              </g>
            )
          })()}
          {/* R2637: 씬 전체 바운딩박스 */}
          {showSceneBBox && (() => {
            if (flatNodes.length === 0) return null
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            flatNodes.forEach(({ node, worldX, worldY }) => {
              const w2 = (node.size?.x || 0) / 2, h2 = (node.size?.y || 0) / 2
              if (w2 === 0 && h2 === 0) return
              const ax = node.anchor?.x ?? 0.5, ay = node.anchor?.y ?? 0.5
              const left = worldX - w2, right = worldX + w2
              const top = worldY - h2, bottom = worldY + h2
              minX = Math.min(minX, left); maxX = Math.max(maxX, right)
              minY = Math.min(minY, bottom); maxY = Math.max(maxY, top)
              // Suppress unused lint warning for ax/ay
              void ax; void ay
            })
            if (!isFinite(minX)) return null
            const svgL = ccToSvg(minX, maxY).x, svgT = ccToSvg(minX, maxY).y
            const svgR = ccToSvg(maxX, minY).x, svgB = ccToSvg(maxX, minY).y
            const bw = svgR - svgL, bh = svgB - svgT
            const sw = 1.5 / view.zoom
            const fs = 9 / view.zoom
            const wCC = Math.round(maxX - minX), hCC = Math.round(maxY - minY)
            return (
              <>
                <rect x={svgL} y={svgT} width={bw} height={bh}
                  fill="none" stroke="rgba(248,113,113,0.6)" strokeWidth={sw}
                  strokeDasharray={`${5/view.zoom} ${2/view.zoom}`} style={{ pointerEvents: 'none' }} />
                <text x={svgL + 2/view.zoom} y={svgT - 2/view.zoom}
                  fontSize={fs} fill="rgba(248,113,113,0.8)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{wCC}×{hCC}</text>
              </>
            )
          })()}
          {/* R2630: 삼분법(Rule of Thirds) 가이드 */}
          {showRuleOfThirds && (() => {
            const cw = effectiveW, ch = effectiveH
            const svgLeft = cx - cw / 2, svgTop = cy - ch / 2
            const sw = 1 / view.zoom
            const lines = []
            for (let i = 1; i <= 2; i++) {
              const x = svgLeft + cw * i / 3
              const y = svgTop + ch * i / 3
              lines.push(
                <line key={`v${i}`} x1={x} y1={svgTop} x2={x} y2={svgTop + ch}
                  stroke="rgba(167,139,250,0.4)" strokeWidth={sw} style={{ pointerEvents: 'none' }} />,
                <line key={`h${i}`} x1={svgLeft} y1={y} x2={svgLeft + cw} y2={y}
                  stroke="rgba(167,139,250,0.4)" strokeWidth={sw} style={{ pointerEvents: 'none' }} />
              )
              // 교차점 원
              for (let j = 1; j <= 2; j++) {
                const ix = svgLeft + cw * i / 3, iy = svgTop + ch * j / 3
                lines.push(
                  <circle key={`c${i}${j}`} cx={ix} cy={iy} r={3/view.zoom}
                    fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth={sw} style={{ pointerEvents: 'none' }} />
                )
              }
            }
            return <>{lines}</>
          })()}
          {/* R2617: 원점(0,0) 십자선 */}
          {showOriginCross && (() => {
            const arm = Math.max(20, Math.min(effectiveW, effectiveH) * 0.1) / view.zoom
            const fs = 9 / view.zoom
            return (
              <>
                <line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy}
                  stroke="rgba(74,222,128,0.7)" strokeWidth={1 / view.zoom} style={{ pointerEvents: 'none' }} />
                <line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm}
                  stroke="rgba(74,222,128,0.7)" strokeWidth={1 / view.zoom} style={{ pointerEvents: 'none' }} />
                <circle cx={cx} cy={cy} r={3 / view.zoom}
                  fill="rgba(74,222,128,0.9)" style={{ pointerEvents: 'none' }} />
                <text x={cx + 4 / view.zoom} y={cy - 3 / view.zoom}
                  fontSize={fs} fill="rgba(74,222,128,0.9)" fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >(0,0)</text>
              </>
            )
          })()}
          {/* R2607: 중복 이름 노드 강조 */}
          {showDupNameOverlay && (() => {
            const nameCount = new Map<string, number>()
            flatNodes.forEach(fn => nameCount.set(fn.node.name, (nameCount.get(fn.node.name) ?? 0) + 1))
            const dupFns = flatNodes.filter(fn => (nameCount.get(fn.node.name) ?? 0) > 1 && (fn.node.size?.x || fn.node.size?.y))
            if (dupFns.length === 0) return null
            return dupFns.map(fn => {
              const svgX = cx + fn.worldX, svgY = cy - fn.worldY
              const w = fn.node.size?.x ?? 0, h = fn.node.size?.y ?? 0
              const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
              const rx = svgX - w * ax, ry = svgY - h * (1 - ay)
              return (
                <rect key={`dup_${fn.node.uuid}`} x={rx} y={ry} width={w} height={h}
                  fill="none" stroke="rgba(251,146,60,0.8)" strokeWidth={2/view.zoom}
                  strokeDasharray={`${5/view.zoom} ${2.5/view.zoom}`}
                  style={{ pointerEvents: 'none' }} />
              )
            })
          })()}
          {/* R2600: 다중 선택 bounding box */}
          {showSelBBox && multiSelected.size >= 2 && (() => {
            const selFns = flatNodes.filter(fn => multiSelected.has(fn.node.uuid) && (fn.node.size?.x || fn.node.size?.y))
            if (selFns.length < 2) return null
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            selFns.forEach(fn => {
              const svgX = cx + fn.worldX, svgY = cy - fn.worldY
              const w = fn.node.size?.x ?? 0, h = fn.node.size?.y ?? 0
              const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
              const rx = svgX - w * ax, ry = svgY - h * (1 - ay)
              minX = Math.min(minX, rx); minY = Math.min(minY, ry)
              maxX = Math.max(maxX, rx + w); maxY = Math.max(maxY, ry + h)
            })
            const bw = maxX - minX, bh = maxY - minY
            const pad = 6 / view.zoom, fs = 9 / view.zoom
            return (
              <>
                <rect x={minX - pad} y={minY - pad} width={bw + pad*2} height={bh + pad*2}
                  fill="none" stroke="rgba(96,165,250,0.7)" strokeWidth={1.5 / view.zoom}
                  strokeDasharray={`${6/view.zoom} ${3/view.zoom}`}
                  style={{ pointerEvents: 'none' }} />
                <text x={minX - pad} y={minY - pad - 2/view.zoom}
                  textAnchor="start" fontSize={fs} fill="rgba(96,165,250,0.9)"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{Math.round(bw)}×{Math.round(bh)} ({selFns.length})</text>
              </>
            )
          })()}
          {/* 크기 없는 노드 → 십자 표시 (비활성 포함, 반투명) */}
          {flatNodes.filter(fn => !(fn.node.size?.x) && !(fn.node.size?.y) && !(hideInactiveNodes && fn.node.active === false)).map(({ node, worldX, worldY }) => {
            const svgPos = ccToSvg(worldX, worldY)
            const isSelected = node.uuid === selectedUuid
            const r = 5 / view.zoom
            return (
              <g key={`dot_${node.uuid}`}
                opacity={node.active ? 1 : 0.2}
                onClick={e => { e.stopPropagation(); onSelect(node.uuid) }}
                style={{ cursor: 'pointer' }}
              >
                <line x1={svgPos.x - r} y1={svgPos.y} x2={svgPos.x + r} y2={svgPos.y}
                  stroke={isSelected ? '#58a6ff' : '#888'} strokeWidth={1 / view.zoom} />
                <line x1={svgPos.x} y1={svgPos.y - r} x2={svgPos.x} y2={svgPos.y + r}
                  stroke={isSelected ? '#58a6ff' : '#888'} strokeWidth={1 / view.zoom} />
              </g>
            )
          })}
          {/* R1703: 형제 그룹 하이라이트 */}
          {showSiblingGroup && selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn?.parentUuid) return null
            const siblings = flatNodes.filter(f => f.parentUuid === selFn.parentUuid && f.node.uuid !== selectedUuid)
            return (
              <>
                {siblings.map(fn => {
                  if (!fn.node.size?.x || !fn.node.size?.y) return null
                  const sp = ccToSvg(fn.worldX, fn.worldY)
                  const w = fn.node.size.x, h = fn.node.size.y
                  const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
                  return (
                    <rect key={fn.node.uuid}
                      x={sp.x - w * ax} y={sp.y - h * (1 - ay)}
                      width={w} height={h}
                      fill="rgba(251,191,36,0.06)"
                      stroke="rgba(251,191,36,0.35)"
                      strokeWidth={1 / view.zoom}
                      strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })}
              </>
            )
          })()}
          {/* R1693: 좌표 핀 마커 */}
          {pinMarkers.map(pm => {
            const sp = ccToSvg(pm.ccX, pm.ccY)
            const r = 6 / view.zoom
            return (
              <g key={pm.id} style={{ cursor: 'pointer' }}
                onClick={() => setPinMarkers(prev => prev.filter(p => p.id !== pm.id))}
                onDoubleClick={e => {
                  e.stopPropagation()
                  // R2529: 더블클릭으로 레이블 편집
                  const input = window.prompt(t('svgOverlay.pinLabelPrompt'), pm.label ?? '')
                  if (input !== null) setPinMarkers(prev => prev.map(p => p.id === pm.id ? { ...p, label: input || undefined } : p))
                }}
              >
                <line x1={sp.x} y1={sp.y - r} x2={sp.x} y2={sp.y + r} stroke="#f472b6" strokeWidth={1.5 / view.zoom} />
                <line x1={sp.x - r} y1={sp.y} x2={sp.x + r} y2={sp.y} stroke="#f472b6" strokeWidth={1.5 / view.zoom} />
                <circle cx={sp.x} cy={sp.y} r={2 / view.zoom} fill="#f472b6" />
                <text x={sp.x + 5 / view.zoom} y={sp.y - 4 / view.zoom} fontSize={8 / view.zoom} fill="#f472b6" fontFamily="monospace" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {pm.label ?? `${pm.ccX},${pm.ccY}`}
                </text>
              </g>
            )
          })}
          {/* R1604: 선택 노드 부모 하이라이트 (연보라 점선) */}
          {selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn?.parentUuid) return null
            const parentFn = flatNodes.find(f => f.node.uuid === selFn.parentUuid)
            if (!parentFn || !parentFn.node.size?.x || !parentFn.node.size?.y) return null
            const { node: pn, worldX: px, worldY: py } = parentFn
            const sp = ccToSvg(px, py)
            const w = pn.size?.x ?? 0, h = pn.size?.y ?? 0
            const ax = pn.anchor?.x ?? 0.5, ay = pn.anchor?.y ?? 0.5
            return (
              <rect
                x={sp.x - w * ax} y={sp.y - h * (1 - ay)}
                width={w} height={h}
                fill="none"
                stroke="rgba(180,120,255,0.45)"
                strokeWidth={1 / view.zoom}
                strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
                style={{ pointerEvents: 'none' }}
              />
            )
          })()}
          {/* R1636: 선택 노드 직계 자식 하이라이트 (연초록 점선) */}
          {selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn) return null
            const children = flatNodes.filter(f => f.parentUuid === selectedUuid && f.node.size?.x && f.node.size?.y)
            if (children.length === 0) return null
            return (
              <g>
                {children.map(cf => {
                  const { node: cn, worldX: cx2, worldY: cy2 } = cf
                  const sp = ccToSvg(cx2, cy2)
                  const w = cn.size?.x ?? 0, h = cn.size?.y ?? 0
                  const ax = cn.anchor?.x ?? 0.5, ay = cn.anchor?.y ?? 0.5
                  return (
                    <rect key={cf.node.uuid}
                      x={sp.x - w * ax} y={sp.y - h * (1 - ay)}
                      width={w} height={h}
                      fill="none"
                      stroke="rgba(60,220,100,0.25)"
                      strokeWidth={1 / view.zoom}
                      strokeDasharray={`${3 / view.zoom} ${3 / view.zoom}`}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })}
              </g>
            )
          })()}
          {/* R1643: 선택 노드↔부모 연결선 (계층 시각화) */}
          {selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn?.parentUuid) return null
            const parentFn = flatNodes.find(f => f.node.uuid === selFn.parentUuid)
            if (!parentFn) return null
            const childSvg = ccToSvg(selFn.worldX, selFn.worldY)
            const parentSvg = ccToSvg(parentFn.worldX, parentFn.worldY)
            return (
              <line
                x1={childSvg.x} y1={childSvg.y}
                x2={parentSvg.x} y2={parentSvg.y}
                stroke="rgba(220,100,200,0.35)"
                strokeWidth={1 / view.zoom}
                strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`}
                style={{ pointerEvents: 'none' }}
              />
            )
          })()}
          {/* R1613: 형제 노드 하이라이트 (연노랑 점선) */}
          {selectedUuid && (() => {
            const selFn = flatNodes.find(f => f.node.uuid === selectedUuid)
            if (!selFn?.parentUuid) return null
            const parentFn = flatNodes.find(f => f.node.uuid === selFn.parentUuid)
            if (!parentFn) return null
            const siblings = flatNodes.filter(f => f.parentUuid === selFn.parentUuid && f.node.uuid !== selectedUuid && f.node.size?.x && f.node.size?.y)
            if (siblings.length === 0) return null
            return (
              <g>
                {siblings.map(sf => {
                  const { node: sn, worldX: sx, worldY: sy } = sf
                  const sp = ccToSvg(sx, sy)
                  const w = sn.size?.x ?? 0, h = sn.size?.y ?? 0
                  const ax = sn.anchor?.x ?? 0.5, ay = sn.anchor?.y ?? 0.5
                  return (
                    <rect key={sf.node.uuid}
                      x={sp.x - w * ax} y={sp.y - h * (1 - ay)}
                      width={w} height={h}
                      fill="none"
                      stroke="rgba(250,200,60,0.3)"
                      strokeWidth={1 / view.zoom}
                      strokeDasharray={`${4 / view.zoom} ${4 / view.zoom}`}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })}
              </g>
            )
          })()}
          {/* rubber-band 선택 박스 */}
          {selectionBox && (
            <rect
              x={Math.min(selectionBox.x1, selectionBox.x2)}
              y={Math.min(selectionBox.y1, selectionBox.y2)}
              width={Math.abs(selectionBox.x2 - selectionBox.x1)}
              height={Math.abs(selectionBox.y2 - selectionBox.y1)}
              fill="rgba(88,166,255,0.08)"
              stroke={selectionColor}
              strokeWidth={1 / view.zoom}
              strokeDasharray={`${3 / view.zoom},${2 / view.zoom}`}
              style={{ pointerEvents: 'none' }}
            />
          )}
          {/* R1525: 다중 노드 경계 박스 (BBox) overlay — 주황 점선 */}
          {multiSelected.size > 1 && (() => {
            const selNodes = flatNodes.filter(fn => multiSelected.has(fn.node.uuid) && fn.node.size?.x && fn.node.size?.y)
            if (selNodes.length < 2) return null
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            for (const { node, worldX, worldY } of selNodes) {
              const sp = ccToSvg(worldX, worldY)
              const w = node.size!.x, h = node.size!.y
              const ax = node.anchor?.x ?? 0.5, ay = node.anchor?.y ?? 0.5
              const left = sp.x - w * ax, right = sp.x + w * (1 - ax)
              const top = sp.y - h * (1 - ay), bot = sp.y + h * ay
              if (left < minX) minX = left
              if (right > maxX) maxX = right
              if (top < minY) minY = top
              if (bot > maxY) maxY = bot
            }
            const pad = 4 / view.zoom
            const bw = maxX - minX, bh = maxY - minY
            // R1624: bounding box 크기 레이블
            const sceneW = Math.round(bw / view.zoom * view.zoom), sceneH = Math.round(bh / view.zoom * view.zoom)
            return (
              <g>
                <rect
                  x={minX - pad} y={minY - pad}
                  width={bw + pad * 2} height={bh + pad * 2}
                  fill="none"
                  stroke="#ff9944"
                  strokeWidth={1.5 / view.zoom}
                  strokeDasharray={`${5 / view.zoom} ${3 / view.zoom}`}
                  style={{ pointerEvents: 'none' }}
                />
                {/* R1624: BBox 크기 레이블 */}
                <text
                  x={minX - pad + (bw + pad * 2) / 2}
                  y={minY - pad - 3 / view.zoom}
                  fontSize={9 / view.zoom}
                  fill="#ff9944"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{Math.round(sceneW)}×{Math.round(sceneH)}</text>
              </g>
            )
          })()}
        {/* R2318/R2319: cc.Camera 뷰 프레임 오버레이 (토글 가능) */}
        {showCameraFrames && cameraFrames.map((cam, i) => {
          const sp = ccToSvg(cam.worldX, cam.worldY)
          return (
            <g key={i} pointerEvents="none">
              <rect
                x={sp.x - cam.w / 2} y={sp.y - cam.h / 2}
                width={cam.w} height={cam.h}
                fill="none" stroke="rgba(255,200,60,0.6)" strokeWidth={1.5 / view.zoom}
                strokeDasharray={`${6 / view.zoom},${3 / view.zoom}`}
              />
              <text x={sp.x - cam.w / 2 + 3 / view.zoom} y={sp.y - cam.h / 2 - 2 / view.zoom}
                fontSize={8 / view.zoom} fill="rgba(255,200,60,0.8)" style={{ pointerEvents: 'none', userSelect: 'none' }}>📷</text>
            </g>
          )
        })}
    </>
  )
}
