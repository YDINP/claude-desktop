import React from 'react'
import type { SceneNode, ViewTransform } from './types'
import { cocosToSvg } from './utils'
import { useSceneViewCtx } from './SceneViewContext'

/**
 * 퀵 액션 팝업 - 단일 노드 선택 시 노드 우상단에 표시
 * 핀/잠금/숨김/삭제/UUID복사 버튼
 * SceneViewPanel에서 추출
 */
interface SceneViewQuickActionsProps {
  show: boolean
  dismissed: boolean
  setDismissed: (v: boolean) => void
  isDragging: boolean
  isResizing: boolean
}

export function SceneViewQuickActions({
  show, dismissed, setDismissed, isDragging, isResizing,
}: SceneViewQuickActionsProps) {
  const ctx = useSceneViewCtx()
  const {
    nodeMap, view, DESIGN_W, DESIGN_H,
    selectedUuid, selectedUuids, selectedNode,
    pinnedUuids, lockedUuids, setLockedUuids,
    hiddenLayers, setHiddenLayers,
    nodeToTopLevel, containerRef,
    togglePin, handleDeleteNode, updateNode,
  } = ctx

  if (!show || dismissed || selectedUuids.size !== 1 || !selectedNode || isDragging || isResizing) return null

  const n = selectedNode
  const { sx, sy } = cocosToSvg(n.x, n.y, DESIGN_W, DESIGN_H)
  const screenX = sx * view.zoom + view.offsetX
  const screenY = sy * view.zoom + view.offsetY
  const PW = 100
  const PH = 32
  const containerW = containerRef.current?.clientWidth ?? 600
  const containerH = containerRef.current?.clientHeight ?? 400
  let px = screenX + 8
  let py = screenY - PH - 8
  px = Math.max(4, Math.min(px, containerW - PW - 4))
  py = Math.max(4, Math.min(py, containerH - PH - 4))

  const isPinned = pinnedUuids.has(n.uuid)
  const isLocked = lockedUuids.has(n.uuid)
  const topUuid = nodeToTopLevel.get(n.uuid)
  const isHidden = !!(topUuid && hiddenLayers.has(topUuid))

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
    padding: '0 3px',
    color: 'rgba(255,255,255,0.8)',
    userSelect: 'none',
  }

  return (
    <>
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 29, background: 'transparent' }}
        onMouseDown={() => setDismissed(true)}
      />
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: px,
          top: py,
          width: PW,
          height: PH,
          zIndex: 30,
          background: 'rgba(15,15,25,0.92)',
          border: '1px solid rgba(96,165,250,0.45)',
          borderRadius: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          pointerEvents: 'all',
        }}
      >
        <button
          style={{ ...btnStyle, color: isPinned ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}
          title={isPinned ? '핀 해제' : '핀 고정'}
          onClick={e => { e.stopPropagation(); togglePin(n.uuid) }}
        >{'\uD83D\uDCCC'}</button>
        <button
          style={{ ...btnStyle, color: isLocked ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}
          title={isLocked ? '잠금 해제' : '잠금'}
          onClick={e => {
            e.stopPropagation()
            setLockedUuids(prev => {
              const next = new Set(prev)
              if (isLocked) next.delete(n.uuid); else next.add(n.uuid)
              localStorage.setItem('cd-scene-locked', JSON.stringify([...next]))
              return next
            })
            updateNode(n.uuid, { locked: !isLocked })
          }}
        >{'\uD83D\uDD12'}</button>
        <button
          style={{ ...btnStyle, opacity: isHidden ? 0.4 : 1 }}
          title={isHidden ? '표시' : '숨기기'}
          onClick={e => {
            e.stopPropagation()
            if (!topUuid) return
            setHiddenLayers(prev => {
              const next = new Set(prev)
              if (isHidden) next.delete(topUuid); else next.add(topUuid)
              return next
            })
          }}
        >{'\uD83D\uDC41'}</button>
        <button
          style={{ ...btnStyle, color: 'rgba(239,68,68,0.85)' }}
          title="삭제"
          onClick={e => { e.stopPropagation(); setDismissed(true); handleDeleteNode() }}
        >{'\u2702'}</button>
        <button
          style={{ ...btnStyle, color: 'rgba(167,243,208,0.85)' }}
          title="UUID 복사"
          onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(n.uuid) }}
        >{'\uD83D\uDCCB'}</button>
      </div>
    </>
  )
}
