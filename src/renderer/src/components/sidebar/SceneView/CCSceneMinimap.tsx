// QA: R2560 미니맵 클릭 팬 구현 (CCFileSceneView에서 추출)
import { useRef } from 'react'
import type { FlatNode, ViewTransformCC } from './ccSceneTypes'

export interface CCSceneMinimapProps {
  flatNodes: FlatNode[]
  selectedUuid: string | null
  multiSelected: Set<string>
  svSearch: string
  svSearchMatches: Set<string>
  effectiveW: number
  effectiveH: number
  view: ViewTransformCC
  svgRef: React.RefObject<SVGSVGElement | null>
  viewRef: React.RefObject<ViewTransformCC>
  mmPos: { x: number; y: number } | null
  setMmPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  setView: React.Dispatch<React.SetStateAction<ViewTransformCC>>
  onSelect: (uuid: string | null) => void
}

export function CCSceneMinimap({
  flatNodes, selectedUuid, multiSelected, svSearch, svSearchMatches,
  effectiveW, effectiveH, view, svgRef, viewRef, mmPos, setMmPos, setView, onSelect,
}: CCSceneMinimapProps) {
  const mmDragRef = useRef<{ startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null)

  const MM_W = 100, MM_H = 72
  const svgEl = svgRef.current
  const svgW = svgEl?.clientWidth ?? effectiveW
  const svgH = svgEl?.clientHeight ?? effectiveH
  const vpX = -view.offsetX / view.zoom
  const vpY = -view.offsetY / view.zoom
  const vpW = svgW / view.zoom
  const vpH = svgH / view.zoom
  const sceneX = -effectiveW / 2, sceneY = -effectiveH / 2
  const sceneW = effectiveW, sceneH = effectiveH
  const scaleX = MM_W / sceneW
  const scaleY = MM_H / sceneH
  const s = Math.min(scaleX, scaleY)
  const mmOffX = (MM_W - sceneW * s) / 2
  const mmOffY = (MM_H - sceneH * s) / 2
  const toMM = (x: number, y: number) => ({
    x: (x - sceneX) * s + mmOffX,
    y: (sceneH - (y - sceneY)) * s + mmOffY,
  })
  const vpMM = toMM(vpX, vpY + vpH)
  const vpW2 = vpW * s, vpH2 = vpH * s

  return (
    <div style={{
      position: 'absolute',
      ...(mmPos ? { left: mmPos.x, top: mmPos.y } : { bottom: 8, right: 8 }),
      zIndex: 5,
      width: MM_W,
      background: 'rgba(10,10,20,0.85)', border: '1px solid #333',
      borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
      display: 'flex', flexDirection: 'column' as const,
    }}
      onClick={e => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const mmX = e.clientX - rect.left
        const mmY = e.clientY - rect.top
        // R2470: 노드 히트 테스트 — 역순(나중에 렌더된 노드 우선)
        let hitUuid: string | null = null
        for (let i = flatNodes.length - 1; i >= 0; i--) {
          const fn2 = flatNodes[i]
          const p2 = toMM(fn2.worldX, fn2.worldY)
          const nw2 = fn2.node.size?.x ?? 0, nh2 = fn2.node.size?.y ?? 0
          const mw2 = nw2 * s, mh2 = nh2 * s
          if (mw2 > 2 && mh2 > 2) {
            const ax2 = fn2.node.anchor?.x ?? 0.5, ay2 = fn2.node.anchor?.y ?? 0.5
            const rx = p2.x - mw2 * ax2, ry = p2.y - mh2 * (1 - ay2)
            if (mmX >= rx && mmX <= rx + mw2 && mmY >= ry && mmY <= ry + mh2) { hitUuid = fn2.node.uuid; break }
          } else {
            if ((mmX - p2.x) ** 2 + (mmY - p2.y) ** 2 <= 16) { hitUuid = fn2.node.uuid; break }
          }
        }
        if (hitUuid) { onSelect(hitUuid); return }
        // R1498: 빈 공간 클릭 → 씬 좌표 역변환 → pan
        const scX = (mmX - mmOffX) / s + sceneX
        const scY = sceneH - (mmY - mmOffY) / s + sceneY
        const svgElInner = svgRef.current
        if (!svgElInner) return
        const svgRect = svgElInner.getBoundingClientRect()
        const z = viewRef.current.zoom
        const svgClickX = svgRect.width / 2 - scX * z
        const svgClickY = svgRect.height / 2 + scY * z
        setView(v => ({ ...v, offsetX: svgClickX, offsetY: svgClickY }))
      }}
      title="미니맵 — 노드 클릭으로 선택 / 빈 공간 클릭으로 이동 (R2470)"
    >
      {/* drag handle */}
      <div
        style={{ height: 8, cursor: 'grab', background: 'rgba(255,255,255,0.08)', borderRadius: '3px 3px 0 0', flexShrink: 0 }}
        onMouseDown={e => {
          e.stopPropagation()
          const parent = (e.currentTarget.parentElement?.parentElement) as HTMLElement | null
          const rect = e.currentTarget.parentElement?.getBoundingClientRect()
          if (!rect) return
          mmDragRef.current = {
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startX: rect.left - (parent?.getBoundingClientRect().left ?? 0),
            startY: rect.top - (parent?.getBoundingClientRect().top ?? 0),
          }
          const onMove = (me: MouseEvent) => {
            if (!mmDragRef.current) return
            const dx = me.clientX - mmDragRef.current.startMouseX
            const dy = me.clientY - mmDragRef.current.startMouseY
            setMmPos({ x: mmDragRef.current.startX + dx, y: mmDragRef.current.startY + dy })
          }
          const onUp = () => {
            mmDragRef.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      />
      <svg width={MM_W} height={MM_H}>
        {/* 씬 경계 */}
        <rect x={mmOffX} y={mmOffY} width={sceneW * s} height={sceneH * s} fill="none" stroke="#333" strokeWidth={0.5} />
        {/* R1554: 노드 rect/점 (크기 반영) */}
        {flatNodes.map(fn => {
          const p = toMM(fn.worldX, fn.worldY)
          const isSelected = fn.node.uuid === selectedUuid || multiSelected.has(fn.node.uuid)
          const isMatch = svSearch.trim() ? svSearchMatches.has(fn.node.uuid) : false
          const nw = fn.node.size?.x ?? 0
          const nh = fn.node.size?.y ?? 0
          const mw = nw * s, mh = nh * s
          if (mw > 2 && mh > 2) {
            const ax = fn.node.anchor?.x ?? 0.5, ay = fn.node.anchor?.y ?? 0.5
            return <rect key={fn.node.uuid}
              x={p.x - mw * ax} y={p.y - mh * (1 - ay)}
              width={mw} height={mh}
              fill={isSelected ? 'rgba(88,166,255,0.2)' : isMatch ? 'rgba(255,68,255,0.2)' : 'rgba(255,255,255,0.05)'}
              stroke={isSelected ? '#58a6ff' : isMatch ? '#ff44ff' : 'rgba(255,255,255,0.25)'}
              strokeWidth={isSelected ? 0.8 : 0.4}
            />
          }
          return <circle key={fn.node.uuid} cx={p.x} cy={p.y} r={isSelected ? 2 : 1.5}
            fill={isSelected ? '#58a6ff' : isMatch ? '#ff44ff' : 'rgba(255,255,255,0.3)'} />
        })}
        {/* 뷰포트 사각형 */}
        <rect x={vpMM.x} y={vpMM.y} width={vpW2} height={vpH2}
          fill="rgba(88,166,255,0.06)" stroke="#58a6ff" strokeWidth={0.75} />
      </svg>
    </div>
  )
}
