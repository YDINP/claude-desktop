import React, { useState, useCallback, useMemo } from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'

export function TransformPlugin({ nodes, sceneFile, saveScene, onSelectNode, onMultiSelectChange, lockedUuids, onSetLockedUuids }: BatchPluginProps) {
  const uuids = nodes.map(n => n.uuid)
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes, patchOrdered } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  // state
  const [snapGridSize, setSnapGridSize] = useState<number>(8)
  const [nearestGridSnap, setNearestGridSnap] = useState<number>(16)
  const [posOffsetX, setPosOffsetX] = useState<number>(0)
  const [posOffsetY, setPosOffsetY] = useState<number>(0)
  const [nudgeStep, setNudgeStep] = useState<number>(1)
  const [absPosX, setAbsPosX] = useState<number>(0)
  const [absPosY, setAbsPosY] = useState<number>(0)
  const [absPosAxisX, setAbsPosAxisX] = useState(true)
  const [absPosAxisY, setAbsPosAxisY] = useState(true)
  const [randomRange, setRandomRange] = useState<number>(50)
  const [randomRotRange, setRandomRotRange] = useState<number>(30)
  const [absRotValue, setAbsRotValue] = useState<number>(45)
  const [rotDeltaStep, setRotDeltaStep] = useState<number>(90) /* R2727 */
  const [rotDelta, setRotDelta] = useState<number>(15) /* R2494 */
  const [snapGrid, setSnapGrid2] = useState<number>(16) /* R2495 */
  const [rotOffsetInput, setRotOffsetInput] = useState<string>('15') /* R2612 */
  const [absScaleX, setAbsScaleX] = useState<number>(1)
  const [absScaleY, setAbsScaleY] = useState<number>(1)
  const [scaleMulFactor, setScaleMulFactor] = useState<number>(2.0) /* R2728 */
  const [scaleLinkedPreset, setScaleLinkedPreset] = useState<boolean>(true) /* R2728 */
  const [layerInput, setLayerInput] = useState<number>(1073741824) /* R2736 — UI: 1073741824(Default) */
  const [batchRot, setBatchRot] = useState<string>('')
  const [batchScaleX, setBatchScaleX] = useState<string>('')
  const [batchScaleY, setBatchScaleY] = useState<string>('')
  const [batchSizeW, setBatchSizeW] = useState<string>('')
  const [batchSizeH, setBatchSizeH] = useState<string>('')
  const [scaleMulInput, setScaleMulInput] = useState<string>('2')
  const [sizeMulInput, setSizeMulInput] = useState<string>('2')
  const [scaleLinked, setScaleLinked] = useState(false)
  const [batchAnchor, setBatchAnchor] = useState<{ x: number; y: number } | null>(null)
  const [batchAnchorCompensate, setBatchAnchorCompensate] = useState(true)
  const [fixedSizeW, setFixedSizeW] = useState<number>(100)
  const [fixedSizeH, setFixedSizeH] = useState<number>(100)
  const [fixedSizeApplyW, setFixedSizeApplyW] = useState<boolean>(true)
  const [fixedSizeApplyH, setFixedSizeApplyH] = useState<boolean>(true)
  const [sizeFactor, setSizeFactor] = useState<number>(1.5)
  const [spreadFactor, setSpreadFactor] = useState<number>(1.5)
  const [evenSpacing, setEvenSpacing] = useState<number>(10)
  const [aspectRatioW, setAspectRatioW] = useState<number>(16)
  const [aspectRatioH, setAspectRatioH] = useState<number>(9)
  const [posGradFrom, setPosGradFrom] = useState<number>(-200)
  const [posGradTo, setPosGradTo] = useState<number>(200)

  const mkBtnS = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontSize: 9, padding: '1px 5px', cursor: 'pointer',
    border: '1px solid var(--border)', borderRadius: 2,
    color, userSelect: 'none', ...extra,
  })
  const mkNiS = (w: number, padding = '1px 3px'): React.CSSProperties => ({
    width: w, fontSize: 9, padding, border: '1px solid var(--border)',
    borderRadius: 2, background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', textAlign: 'center',
  })

  // R2513: Z-Order 이동
  const moveZOrder = useCallback(async (dir: 'up' | 'down' | 'top' | 'bottom') => {
    if (!sceneFile.root) return
    function patch(n: CCSceneNode): CCSceneNode {
      const children = n.children.map(patch)
      const selIdx = children.map((c, i) => uuidSet.has(c.uuid) ? i : -1).filter(i => i >= 0)
      if (selIdx.length === 0) return { ...n, children }
      const moved = [...children]
      if (dir === 'top') {
        const sel = selIdx.map(i => moved[i])
        const rest = moved.filter((_, i) => !selIdx.includes(i))
        return { ...n, children: [...rest, ...sel] }
      } else if (dir === 'bottom') {
        const sel = selIdx.map(i => moved[i])
        const rest = moved.filter((_, i) => !selIdx.includes(i))
        return { ...n, children: [...sel, ...rest] }
      } else if (dir === 'up') {
        for (let k = selIdx.length - 1; k >= 0; k--) {
          const i = selIdx[k]
          if (i < moved.length - 1 && !uuidSet.has(moved[i + 1].uuid)) {
            [moved[i], moved[i + 1]] = [moved[i + 1], moved[i]]
          }
        }
        return { ...n, children: moved }
      } else {
        for (let k = 0; k < selIdx.length; k++) {
          const i = selIdx[k]
          if (i > 0 && !uuidSet.has(moved[i - 1].uuid)) {
            [moved[i], moved[i - 1]] = [moved[i - 1], moved[i]]
          }
        }
        return { ...n, children: moved }
      }
    }
    await saveScene({ ...sceneFile, root: patch(sceneFile.root) } as unknown as CCSceneNode)
    setBatchMsg(`Z-Order ${dir}`)
    setTimeout(() => setBatchMsg(null), 2000)
  }, [sceneFile, uuidSet, saveScene])

  return (
    <div>
      {batchMsg && <div style={{ fontSize: 9, color: '#4ade80', marginBottom: 4 }}>{batchMsg}</div>}

      {/* R2513: Z-Order 이동 버튼 */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>Z순서 (R2513)</span>
        {(['top', 'up', 'down', 'bottom'] as const).map(dir => {
          const labels: Record<string, string> = { top: '⊤ 최상', up: '▲', down: '▼', bottom: '⊥ 최하' }
          const titles: Record<string, string> = { top: '최상위로 이동', up: '한 칸 앞으로', down: '한 칸 뒤로', bottom: '최하위로 이동' }
          return (
            <span key={dir} onClick={() => moveZOrder(dir)} title={titles[dir]}
              style={{ fontSize: 9, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#94a3b8', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >{labels[dir]}</span>
          )
        })}
      </div>

      {/* R2520: 노드 반전 — scaleX/Y 부호 반전 (Flip) */}
      {sceneFile.root && (() => {
        const doFlip = async (axis: 'x' | 'y') => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            const newScale = axis === 'x' ? { ...sc, x: -sc.x } : { ...sc, y: -sc.y }
            return { ...n, scale: newScale }
          }, `${uuids.length}개 노드 ${axis.toUpperCase()} 반전`)
        }
        const fs: React.CSSProperties = { fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#94a3b8', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>반전 (R2520)</span>
            <span style={fs} onClick={() => doFlip('x')} title="선택 노드 scaleX 부호 반전 (Flip Horizontal)"
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#38bdf8')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>⇆ X</span>
            <span style={fs} onClick={() => doFlip('y')} title="선택 노드 scaleY 부호 반전 (Flip Vertical)"
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>⇅ Y</span>
          </div>
        )
      })()}

      {/* R2519: Transform 빠른 초기화 (P/R/S reset) */}
      {sceneFile.root && (() => {
        const doReset = async (what: 'pos' | 'rot' | 'scale' | 'color') => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            if (what === 'pos') return { ...n, position: { x: 0, y: 0, z: 0 } }
            if (what === 'rot') return { ...n, rotation: typeof n.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 } }
            if (what === 'color') return { ...n, color: { r: 255, g: 255, b: 255, a: n.color?.a ?? 255 } }
            return { ...n, scale: { x: 1, y: 1, z: 1 } }
          }, `patch`)
          const label = what === 'pos' ? '위치' : what === 'rot' ? '회전' : what === 'color' ? 'tint색상' : '스케일'
          setBatchMsg(`${uuids.length}개 ${label} 초기화`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        const rs: React.CSSProperties = { fontSize: 9, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#94a3b8', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>초기화 (R2519)</span>
            <span style={rs} onClick={() => doReset('pos')} title="선택 노드 위치 → (0,0) 초기화"
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#34d399')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>P↺</span>
            <span style={rs} onClick={() => doReset('rot')} title="선택 노드 회전 → 0° 초기화"
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f472b6')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>R↺</span>
            <span style={rs} onClick={() => doReset('scale')} title="선택 노드 스케일 → (1,1,1) 초기화"
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#fbbf24')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>S↺</span>
            <span style={rs} onClick={() => doReset('color')} title="선택 노드 tint 색상 → 흰색(255,255,255) 초기화 (R2606)"
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f472b6')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>C↺</span>
          </div>
        )
      })()}

      {/* R2514: 그리드 스냅 */}
      {sceneFile.root && (() => {
        const applyGridSnap = async () => {
          const g = snapGridSize
          if (g < 1) return
          await patchNodes(n => {
            const p = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...p, x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g } }
          }, `${uuids.length}개 노드 ${g}px 그리드 스냅`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>◫ 스냅 (R2514)</span>
            <input type="number" value={snapGridSize} min={1} max={256}
              onChange={e => setSnapGridSize(Math.max(1, parseInt(e.target.value) || 8))}
              style={mkNiS(38)} title="그리드 크기 (px)" />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
            <span onClick={applyGridSnap}
              title={`선택된 ${uuids.length}개 노드 위치를 ${snapGridSize}px 그리드에 스냅 (R2514)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#34d399', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#34d399')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >스냅</span>
          </div>
        )
      })()}

      {/* R2609: size 스냅 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applySzSnap = async (step: number) => {
          await patchNodes(n => {
            const sz = n.size as { x: number; y: number }
            return { ...n, size: { x: Math.round(sz.x / step) * step, y: Math.round(sz.y / step) * step } }
          }, `size ${step}px 스냅 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>sz스냅 (R2609)</span>
            {([8, 16, 32] as const).map(step => (
              <span key={step} onClick={() => applySzSnap(step)}
                title={`size.x/y를 ${step}px 배수로 스냅 (R2609)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', userSelect: 'none', background: 'rgba(56,189,248,0.05)' }}
              >{step}</span>
            ))}
          </div>
        )
      })()}

      {/* R2623: position XY 스냅 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyPosSnap = async (step: number) => {
          await patchNodes(n => {
            const p = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...p, x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step } }
          }, `pos ${step}px 스냅 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>pos스냅 (R2623)</span>
            {([1, 8, 16, 32] as const).map(step => (
              <span key={step} onClick={() => applyPosSnap(step)}
                title={`position.x/y를 ${step}px 배수로 반올림 스냅 (R2623)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', userSelect: 'none', background: 'rgba(167,139,250,0.05)' }}
              >{step}</span>
            ))}
          </div>
        )
      })()}

      {/* R2654: 위치 XY 원점 리셋 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyPosReset = async (axis: 'x' | 'y' | 'both') => {
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            const nx = axis === 'y' ? pos.x : 0
            const ny = axis === 'x' ? pos.y : 0
            return { ...n, position: { ...pos, x: nx, y: ny } }
          }, `position ${axis === 'both' ? 'XY' : axis.toUpperCase()}→0 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>pos리셋 (R2654)</span>
            <span onClick={() => applyPosReset('x')} title="position.x → 0 (R2654)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', userSelect: 'none' }}>X=0</span>
            <span onClick={() => applyPosReset('y')} title="position.y → 0 (R2654)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', userSelect: 'none' }}>Y=0</span>
            <span onClick={() => applyPosReset('both')} title="position XY → 0,0 (R2654)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', userSelect: 'none' }}>XY=0</span>
          </div>
        )
      })()}

      {/* R2692: 방향 nudge 버튼 ←→↑↓ */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const nudge = async (dx: number, dy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const p = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...p, x: p.x + dx, y: p.y + dy } }
          }, `nudge Δ(${dx >= 0 ? '+' : ''}${dx},${dy >= 0 ? '+' : ''}${dy}) (${uuids.length}개)`)
        }
        const btnS = mkBtnS('#34d399', { fontSize: 10, lineHeight: 1.2 })
        const niS = mkNiS(36)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>nudge (R2692)</span>
            <span onClick={() => nudge(-nudgeStep, 0)} style={btnS} title={`←  X-${nudgeStep}`}>←</span>
            <span onClick={() => nudge(nudgeStep, 0)} style={btnS} title={`→  X+${nudgeStep}`}>→</span>
            <span onClick={() => nudge(0, nudgeStep)} style={btnS} title={`↑  Y+${nudgeStep}`}>↑</span>
            <span onClick={() => nudge(0, -nudgeStep)} style={btnS} title={`↓  Y-${nudgeStep}`}>↓</span>
            <input type="number" value={nudgeStep} min={1} max={100} step={1}
              onChange={e => setNudgeStep(Math.max(1, parseInt(e.target.value) || 1))}
              style={niS} title="nudge 단위 (px)" />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
          </div>
        )
      })()}

      {/* R2674: 절대 위치 직접 지정 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyAbsPos = async () => {
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, x: absPosAxisX ? absPosX : pos.x, y: absPosAxisY ? absPosY : pos.y } }
          }, `절대위치 ${absPosAxisX ? `X=${absPosX}` : ''}${absPosAxisX && absPosAxisY ? ' ' : ''}${absPosAxisY ? `Y=${absPosY}` : ''} (${uuids.length}개)`)
        }
        const niS = mkNiS(52)
        const ckS: React.CSSProperties = { cursor: 'pointer', fontSize: 9, color: '#94a3b8', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>절대pos (R2674)</span>
            <label style={ckS}><input type="checkbox" checked={absPosAxisX} onChange={e => setAbsPosAxisX(e.target.checked)} style={{ marginRight: 2 }} />X</label>
            <input type="number" value={absPosX} onChange={e => setAbsPosX(parseFloat(e.target.value) || 0)} style={niS} title="절대 X 좌표" disabled={!absPosAxisX} />
            <label style={ckS}><input type="checkbox" checked={absPosAxisY} onChange={e => setAbsPosAxisY(e.target.checked)} style={{ marginRight: 2 }} />Y</label>
            <input type="number" value={absPosY} onChange={e => setAbsPosY(parseFloat(e.target.value) || 0)} style={niS} title="절대 Y 좌표" disabled={!absPosAxisY} />
            <span onClick={applyAbsPos}
              title={`선택 노드 position을 절대 좌표로 지정 (R2674)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >지정</span>
          </div>
        )
      })()}

      {/* R2516: 위치 오프셋 이동 */}
      {sceneFile.root && (() => {
        const applyOffset = async () => {
          if (posOffsetX === 0 && posOffsetY === 0) return
          await patchNodes(n => {
            const p = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...p, x: p.x + posOffsetX, y: p.y + posOffsetY } }
          }, `${uuids.length}개 노드 Δ(${posOffsetX >= 0 ? '+' : ''}${posOffsetX}, ${posOffsetY >= 0 ? '+' : ''}${posOffsetY})`)
        }
        const numInputS: React.CSSProperties = { width: 44, fontSize: 9, padding: '1px 3px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'center' }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>Δ이동 (R2516)</span>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>X</span>
            <input type="number" value={posOffsetX} onChange={e => setPosOffsetX(parseFloat(e.target.value) || 0)} style={numInputS} title="X 오프셋 (px)" />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>Y</span>
            <input type="number" value={posOffsetY} onChange={e => setPosOffsetY(parseFloat(e.target.value) || 0)} style={numInputS} title="Y 오프셋 (px)" />
            <span onClick={applyOffset}
              title={`선택된 ${uuids.length}개 노드 위치에 Δ(${posOffsetX}, ${posOffsetY}) 더하기 (R2516)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#fb923c', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >적용</span>
          </div>
        )
      })()}

      {/* R2663: 랜덤 위치 오프셋 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyRandomOffset = async () => {
          await patchNodes(n => {
            const p = n.position as { x: number; y: number; z?: number }
            const dx = (Math.random() * 2 - 1) * randomRange
            const dy = (Math.random() * 2 - 1) * randomRange
            return { ...n, position: { ...p, x: Math.round(p.x + dx), y: Math.round(p.y + dy) } }
          }, `랜덤 오프셋 ±${randomRange} (${uuids.length}개)`)
        }
        const niS = mkNiS(44)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>랜덤 (R2663)</span>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>±</span>
            <input type="number" value={randomRange} min={1} step={10} onChange={e => setRandomRange(Math.max(1, parseInt(e.target.value) || 1))} style={niS} title="랜덤 오프셋 범위 (px)" />
            <span onClick={applyRandomOffset}
              title={`선택된 ${uuids.length}개 노드 위치에 ±${randomRange}px 랜덤 오프셋 추가 (R2663)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#fb923c', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >적용</span>
          </div>
        )
      })()}

      {/* R2664: 랜덤 회전 오프셋 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyRandomRotation = async () => {
          await patchNodes(n => {
            const delta = (Math.random() * 2 - 1) * randomRotRange
            if (typeof n.rotation === 'number') return { ...n, rotation: Math.round(n.rotation + delta) }
            const r = n.rotation as { x: number; y: number; z: number }
            return { ...n, rotation: { ...r, z: Math.round(r.z + delta) } }
          }, `랜덤 회전 ±${randomRotRange}° (${uuids.length}개)`)
        }
        const niS = mkNiS(44)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>랜덤회전 (R2664)</span>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>±</span>
            <input type="number" value={randomRotRange} min={1} max={180} step={5} onChange={e => setRandomRotRange(Math.max(1, parseInt(e.target.value) || 1))} style={niS} title="랜덤 회전 범위 (도)" />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>°</span>
            <span onClick={applyRandomRotation}
              title={`선택된 ${uuids.length}개 노드에 ±${randomRotRange}° 랜덤 회전 추가 (R2664)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >적용</span>
          </div>
        )
      })()}

      {/* R2655: 스케일 1.0 일괄 리셋 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyScaleReset = async (axis: 'x' | 'y' | 'both') => {
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            const nx = axis === 'y' ? sc.x : 1
            const ny = axis === 'x' ? sc.y : 1
            return { ...n, scale: { ...sc, x: nx, y: ny } }
          }, `scale ${axis === 'both' ? 'XY' : axis.toUpperCase()}→1 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>scale리셋 (R2655)</span>
            <span onClick={() => applyScaleReset('x')} title="scale.x → 1 (R2655)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', userSelect: 'none' }}>Sx=1</span>
            <span onClick={() => applyScaleReset('y')} title="scale.y → 1 (R2655)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', userSelect: 'none' }}>Sy=1</span>
            <span onClick={() => applyScaleReset('both')} title="scale XY → 1,1 (R2655)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', userSelect: 'none' }}>SXY=1</span>
          </div>
        )
      })()}

      {/* R2662: 회전 0 일괄 리셋 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyRotReset = async () => {
          await patchNodes(n => {
            const rot = typeof n.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 }
            return { ...n, rotation: rot }
          }, `rotation → 0 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>rot리셋 (R2662)</span>
            <span onClick={applyRotReset} title="rotation → 0 (R2662)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', userSelect: 'none' }}>R=0</span>
          </div>
        )
      })()}

      {/* R2685: 회전 절대값 지정 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyAbsRot = async () => {
          await patchNodes(n => {
            const rot = typeof n.rotation === 'number' ? absRotValue : { x: 0, y: 0, z: absRotValue }
            return { ...n, rotation: rot }
          }, `rotation = ${absRotValue}° (${uuids.length}개)`)
        }
        const niS = mkNiS(44)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>rot지정 (R2685)</span>
            <input type="number" value={absRotValue} min={-360} max={360} step={1} onChange={e => setAbsRotValue(parseFloat(e.target.value) || 0)} style={niS} title="절대 회전값 (도)" />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>°</span>
            <span onClick={applyAbsRot}
              title={`선택 노드 rotation = ${absRotValue}° (R2685)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#fb923c', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >지정</span>
          </div>
        )
      })()}

      {/* R2727: 회전 프리셋 버튼 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyPreset = async (v: number) => {
          await patchNodes(n => ({
            ...n,
            rotation: typeof n.rotation === 'number' ? v : { x: 0, y: 0, z: v },
          }), `rotation = ${v}° (R2727)`)
        }
        const applyDelta = async (sign: 1 | -1) => {
          await patchNodes(n => {
            const cur = typeof n.rotation === 'number' ? n.rotation : (n.rotation as { x: number; y: number; z: number })?.z ?? 0
            const next = cur + sign * rotDeltaStep
            return { ...n, rotation: typeof n.rotation === 'number' ? next : { x: 0, y: 0, z: next } }
          }, `rotation Δ${sign > 0 ? '+' : ''}${sign * rotDeltaStep}° (R2727)`)
        }
        const presets = [0, 45, 90, 180, 270]
        const bsPreset: React.CSSProperties = {
          fontSize: 9, padding: '1px 5px', cursor: 'pointer',
          border: '1px solid var(--border)', borderRadius: 2,
          color: 'var(--text-muted)', background: 'var(--bg-hover)', userSelect: 'none',
        }
        const niS = mkNiS(36)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 5 }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>rot프리셋 (R2727)</span>
              {presets.map(v => (
                <span key={v} onClick={() => applyPreset(v)} title={`rotation = ${v}°`} style={bsPreset}>{v}°</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>Δ</span>
              <input type="number" value={rotDeltaStep} min={1} max={360} step={1}
                onChange={e => setRotDeltaStep(parseFloat(e.target.value) || 1)}
                style={niS} title="회전 delta 값 (도)" />
              <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>°</span>
              <span onClick={() => applyDelta(1)} title={`rotation +${rotDeltaStep}°`}
                style={bsPreset}>Δ+{rotDeltaStep}°</span>
              <span onClick={() => applyDelta(-1)} title={`rotation -${rotDeltaStep}°`}
                style={bsPreset}>Δ-{rotDeltaStep}°</span>
            </div>
          </div>
        )
      })()}

      {/* R2687: 위치/크기 정수 스냅 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyRoundPos = async (target: 'pos' | 'size' | 'both') => {
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            const sz = n.size as { x: number; y: number } | undefined
            const newPos = (target === 'pos' || target === 'both') ? { ...pos, x: Math.round(pos.x), y: Math.round(pos.y) } : pos
            const newSz = sz && (target === 'size' || target === 'both') ? { x: Math.round(sz.x), y: Math.round(sz.y) } : sz
            return { ...n, position: newPos, ...(newSz ? { size: newSz } : {}) }
          }, `정수 스냅 (${target}) (${uuids.length}개)`)
        }
        const bs: React.CSSProperties = { fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>정수스냅 (R2687)</span>
            <span onClick={() => applyRoundPos('pos')} title="position XY → Math.round (R2687)" style={bs}>pos</span>
            <span onClick={() => applyRoundPos('size')} title="size WH → Math.round (R2687)" style={bs}>size</span>
            <span onClick={() => applyRoundPos('both')} title="position+size 모두 정수화 (R2687)" style={bs}>all</span>
          </div>
        )
      })()}

      {/* R2690: scale 절대값 지정 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyAbsScale = async () => {
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, x: absScaleX, y: absScaleY } }
          }, `scale = (${absScaleX}, ${absScaleY}) (${uuids.length}개)`)
        }
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>scale지정 (R2690)</span>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>X</span>
            <input type="number" value={absScaleX} min={-10} max={10} step={0.1} onChange={e => setAbsScaleX(parseFloat(e.target.value) || 1)} style={niS} title="절대 scaleX" />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>Y</span>
            <input type="number" value={absScaleY} min={-10} max={10} step={0.1} onChange={e => setAbsScaleY(parseFloat(e.target.value) || 1)} style={niS} title="절대 scaleY" />
            <span onClick={applyAbsScale}
              title={`scale = (${absScaleX}, ${absScaleY}) (R2690)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#fb923c', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >지정</span>
          </div>
        )
      })()}

      {/* R2728: scale 프리셋 버튼 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyScalePreset = async (v: number) => {
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, x: v, y: scaleLinkedPreset ? v : sc.y } }
          }, `scale×${v}프리셋 — R2728`)
        }
        const applyScaleMul = async () => {
          const factor = scaleMulFactor || 1.0
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, x: (sc.x || 1.0) * factor, y: (sc.y || 1.0) * factor } }
          }, `scale×${factor}배 — R2728`)
        }
        const bsP: React.CSSProperties = {
          fontSize: 9, padding: '1px 5px', cursor: 'pointer',
          border: '1px solid var(--border)', borderRadius: 2,
          color: 'var(--text-muted)', background: 'var(--bg-hover)', userSelect: 'none',
        }
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 5 }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>scale프리셋 (R2728)</span>
              {([0.5, 1.0, 1.5, 2.0] as const).map(v => (
                <span key={v} onClick={() => applyScalePreset(v)} title={`scale.x=${v}${scaleLinkedPreset ? ` scale.y=${v}` : ' (y유지)'}`} style={bsP}>{v}×</span>
              ))}
              <label style={{ fontSize: 8, color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={scaleLinkedPreset} onChange={e => setScaleLinkedPreset(e.target.checked)} style={{ marginRight: 2 }} />XY연동
              </label>
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>×배수</span>
              <input type="number" value={scaleMulFactor} min={0.01} step={0.1}
                onChange={e => setScaleMulFactor(parseFloat(e.target.value) || 1.0)}
                style={niS} title="scale 곱 배수" />
              <span onClick={applyScaleMul}
                title={`선택 노드 scale.x * scale.y * ${scaleMulFactor} (R2728)`}
                style={bsP}>×{scaleMulFactor}</span>
            </div>
          </div>
        )
      })()}

      {/* R2736: Layer 일괄 설정 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const LAYER_PRESETS = [
          { label: 'Default', value: 1073741824 },
          { label: 'UI', value: 33554432 },
          { label: 'Node', value: 524288 },
          { label: 'Gizmos', value: 268435456 },
        ] as const
        const bsL: React.CSSProperties = {
          fontSize: 9, padding: '1px 5px', cursor: 'pointer',
          border: '1px solid var(--border)', borderRadius: 2,
          color: 'var(--text-muted)', background: 'var(--bg-hover)', userSelect: 'none',
        }
        const applyLayer = async (v: number) => {
          await patchNodes(n => ({ ...n, _layer: v }), `layer=${v} (R2736)`)
        }
        return (
          <div style={{ marginBottom: 4, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>Layer (R2736)</span>
            {LAYER_PRESETS.map(({ label, value }) => (
              <span key={label} onClick={() => applyLayer(value)}
                style={bsL}
                title={`_layer = ${value}`}>{label}</span>
            ))}
            <input type="number" value={layerInput}
              onChange={e => setLayerInput(Number(e.target.value))}
              style={mkNiS(90)} title="직접 입력 (bitmask)" />
            <span onClick={() => applyLayer(layerInput)} style={bsL}>지정</span>
          </div>
        )
      })()}

      {/* R1706: 일괄 회전 편집 */}
      {sceneFile.root && (() => {
        const applyBatchRot = async () => {
          const v = parseFloat(batchRot)
          if (isNaN(v)) return
          await patchNodes(n => {
            if (typeof n.rotation === 'number') return { ...n, rotation: v }
            return { ...n, rotation: { x: 0, y: 0, z: v } }
          }, `회전 °=${v} (${uuids.length}개) R1706`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>회전 ° (R1706)</span>
            <input type="text" value={batchRot} onChange={e => setBatchRot(e.target.value)}
              style={mkNiS(44)} placeholder="batchRot" title="일괄 회전값 (도)" />
            <span onClick={applyBatchRot} style={mkBtnS('#a78bfa')}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >적용</span>
          </div>
        )
      })()}

      {/* R1737: 앵커 일괄 설정 */}
      {sceneFile.root && (() => {
        const applyAnchor = async (ax: number, ay: number) => {
          await patchNodes(n => {
            const compensate = batchAnchorCompensate
            if (compensate && n.size) {
              const oldAx = n.anchor?.x ?? 0.5, oldAy = n.anchor?.y ?? 0.5
              const w = n.size.x ?? n.size.width ?? 0, h = n.size.y ?? n.size.height ?? 0
              const pos = n.position as { x: number; y: number; z?: number }
              const dx = (ax - oldAx) * w, dy = (ay - oldAy) * h
              return { ...n, anchor: { x: ax, y: ay }, position: { ...pos, x: pos.x + dx, y: pos.y + dy } }
            }
            return { ...n, anchor: { x: ax, y: ay } }
          }, `앵커 일괄 설정 (${ax},${ay}) R1737`)
        }
        const presets: [string, number, number][] = [
          ['TL',0,1],['TC',0.5,1],['TR',1,1],
          ['ML',0,0.5],['MC',0.5,0.5],['MR',1,0.5],
          ['BL',0,0],['BC',0.5,0],['BR',1,0],
        ]
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#fb923c', flexShrink: 0 }}>batchAnchor (R1737)</span>
            {presets.map(([label, ax, ay]) => (
              <span key={label} onClick={() => applyAnchor(ax, ay)}
                style={mkBtnS('#fb923c')} title={`앵커 일괄 설정 (${ax},${ay})`}>{label}</span>
            ))}
            <label style={{ fontSize: 8, color: '#94a3b8', cursor: 'pointer' }}>
              <input type="checkbox" checked={batchAnchorCompensate}
                onChange={e => setBatchAnchorCompensate(e.target.checked)} style={{ marginRight: 2 }} />보정
            </label>
          </div>
        )
      })()}

      {/* R1776: 회전 일괄 정규화 (0~360) */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyNormRot = async () => {
          await patchNodes(n => {
            if (typeof n.rotation === 'number') {
              return { ...n, rotation: ((n.rotation % 360) + 360) % 360 }
            }
            const r = n.rotation as { x: number; y: number; z: number }
            return { ...n, rotation: { ...r, z: ((r.z % 360) + 360) % 360 } }
          }, `회전 정규화 0~360 (${uuids.length}개) R1776`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>회전 정규화 (R1776)</span>
            <span onClick={applyNormRot} style={mkBtnS('#a78bfa')} title="회전값 0~360° 정규화">정규화</span>
          </div>
        )
      })()}

      {/* R1780: 크기배율 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyMult1780 = async (m: number) => {
          await patchNodes(n => {
            const sz = n.size as { x: number; y: number } | undefined
            if (!sz) return n
            return { ...n, size: { x: Math.round(sz.x * m), y: Math.round(sz.y * m) } }
          }, `크기배율 ×${m} (${uuids.length}개) R1780`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>크기배율 (R1780)</span>
            {[0.5, 2, 1.5, 0.75].map(m => (
              <span key={m} onClick={() => applyMult1780(m)} style={mkBtnS('#22d3ee')} title={`크기배율 ×${m}`}>×{m}</span>
            ))}
          </div>
        )
      })()}

      {/* R1781: 정수화 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyInt = async () => {
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            const sz = n.size as { x: number; y: number } | undefined
            return {
              ...n,
              position: { ...pos, x: Math.round(pos.x), y: Math.round(pos.y) },
              ...(sz ? { size: { x: Math.round(sz.x), y: Math.round(sz.y) } } : {}),
            }
          }, `정수화 pos+size (${uuids.length}개) R1781`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>정수화 (R1781)</span>
            <span onClick={applyInt} style={mkBtnS('#34d399')} title="위치/크기 정수화">⊹int</span>
          </div>
        )
      })()}

      {/* R1809: 커스텀 배율 applyMult */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyMult = async () => {
          const m = parseFloat(sizeMulInput)
          if (isNaN(m) || m === 0) return
          await patchNodes(n => {
            const sz = n.size as { x: number; y: number } | undefined
            if (!sz) return n
            return { ...n, size: { x: Math.round(sz.x * m), y: Math.round(sz.y * m) } }
          }, `커스텀 배율 ×${m} (${uuids.length}개) R1809`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>커스텀 배율 (R1809)</span>
            <input type="text" value={sizeMulInput} onChange={e => setSizeMulInput(e.target.value)}
              style={mkNiS(40)} title="배율 입력" />
            <span onClick={applyMult} style={mkBtnS('#22d3ee')} title="applyMult 크기배율 적용">적용</span>
          </div>
        )
      })()}

      {/* R2494: 회전 델타 applyRotDelta */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyRotDelta = async (dir: 1 | -1) => {
          const d = rotDelta * dir
          await patchNodes(n => {
            if (typeof n.rotation === 'number') return { ...n, rotation: n.rotation + d }
            const r = n.rotation as { x: number; y: number; z: number }
            return { ...n, rotation: { ...r, z: r.z + d } }
          }, `회전± ${d > 0 ? '+' : ''}${d}° (${uuids.length}개) R2494`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>회전± (R2494)</span>
            <span onClick={() => applyRotDelta(-1)} style={mkBtnS('#a78bfa')} title="applyRotDelta -">-</span>
            <input type="number" value={rotDelta} min={1} max={360} step={5}
              onChange={e => setRotDelta(parseFloat(e.target.value) || 15)} style={mkNiS(40)} title="회전 델타 (°)" />
            <span onClick={() => applyRotDelta(1)} style={mkBtnS('#a78bfa')} title="applyRotDelta +">+</span>
          </div>
        )
      })()}

      {/* R2495: 그리드 스냅 applySnap snapGrid 스냅px */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applySnap = async () => {
          const g = snapGrid
          if (g < 1) return
          await patchNodes(n => {
            const p = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...p, x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g } }
          }, `스냅px=${g} (${uuids.length}개) R2495`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>snapGrid (R2495)</span>
            <input type="number" value={snapGrid} min={1} max={256}
              onChange={e => setSnapGrid2(Math.max(1, parseInt(e.target.value) || 16))} style={mkNiS(38)} title="스냅px 크기" />
            <span onClick={applySnap} style={mkBtnS('#34d399')} title="applySnap 그리드 스냅">스냅</span>
          </div>
        )
      })()}

      {/* R2527: 스케일 X/Y 링크 토글 scaleLinked */}
      {sceneFile.root && (() => {
        const applyBatchScale = async () => {
          const sx = parseFloat(batchScaleX), sy = parseFloat(batchScaleY)
          if (isNaN(sx) && isNaN(sy)) return
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, x: isNaN(sx) ? sc.x : sx, y: isNaN(sy) ? sc.y : sy } }
          }, `scale (${batchScaleX}, ${batchScaleY}) (${uuids.length}개) R2527`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>scale (R2527)</span>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>X</span>
            <input type="text" value={batchScaleX}
              onChange={e => { setBatchScaleX(e.target.value); if (scaleLinked) setBatchScaleY(e.target.value) }}
              style={mkNiS(36)} title="scaleX" />
            <label style={{ fontSize: 8, color: '#94a3b8', cursor: 'pointer' }}>
              <input type="checkbox" checked={scaleLinked}
                onChange={e => setScaleLinked(e.target.checked)} style={{ marginRight: 1 }} />🔗
            </label>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>Y</span>
            <input type="text" value={batchScaleY}
              onChange={e => setBatchScaleY(e.target.value)}
              style={mkNiS(36)} title="scaleY" />
            <span onClick={applyBatchScale} style={mkBtnS('#fb923c')} title="스케일 적용">적용</span>
          </div>
        )
      })()}

      {/* R2528: 스케일 배율 버튼 applyScaleMult */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyScaleMult = async (m: number) => {
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, x: sc.x * m, y: sc.y * m } }
          }, `scale ×${m} (${uuids.length}개) R2528`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>sc배율 (R2528)</span>
            {[0.5, 0.75, 1.5, 2].map(m => (
              <span key={m} onClick={() => applyScaleMult(m)} style={mkBtnS('#fb923c')} title={`applyScaleMult sc.x * m = ${m}`}>×{m}</span>
            ))}
          </div>
        )
      })()}

      {/* R2536: 미러(flip) applyFlip ↔H ↕V */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyFlip = async (axis: 'x' | 'y') => {
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, [axis]: -(sc[axis] ?? 1) } }
          }, `flip ${axis} (${uuids.length}개) R2536`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>flip (R2536)</span>
            <span onClick={() => applyFlip('x')} style={mkBtnS('#a78bfa')} title="applyFlip ↔H">↔H</span>
            <span onClick={() => applyFlip('y')} style={mkBtnS('#a78bfa')} title="applyFlip ↕V">↕V</span>
          </div>
        )
      })()}

      {/* R2541: 스케일/회전 리셋 applyReset ↺1:1 ∠0° */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyReset = async (what: 'scale' | 'rot') => {
          await patchNodes(n => {
            if (what === 'scale') return { ...n, scale: { x: 1, y: 1, z: 1 } }
            return { ...n, rotation: typeof n.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 } }
          }, `${what} 리셋 (${uuids.length}개) R2541`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>리셋 (R2541)</span>
            <span onClick={() => applyReset('scale')} style={mkBtnS('#fb923c')} title="applyReset scale">↺1:1</span>
            <span onClick={() => applyReset('rot')} style={mkBtnS('#fb923c')} title="applyReset rotation">∠0°</span>
          </div>
        )
      })()}

      {/* R2542: 사이즈 정수화 applySzInt ⊹sz */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applySzInt = async () => {
          await patchNodes(n => {
            const sz = n.size as { x: number; y: number } | undefined
            if (!sz) return n
            return { ...n, size: { x: Math.round(sz.x), y: Math.round(sz.y) } }
          }, `사이즈 정수화 (${uuids.length}개) R2542`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>사이즈 정수화 (R2542)</span>
            <span onClick={applySzInt} style={mkBtnS('#34d399')} title="applySzInt ⊹sz">⊹sz</span>
          </div>
        )
      })()}

      {/* R2593: 랜덤 회전 applyRandRot 🎲rot */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyRandRot = async () => {
          await patchNodes(n => {
            const r = Math.floor(Math.random() * 360)
            if (typeof n.rotation === 'number') return { ...n, rotation: r }
            return { ...n, rotation: { x: 0, y: 0, z: r } }
          }, `🎲rot 랜덤 회전 (${uuids.length}개) R2593`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>랜덤rot (R2593)</span>
            <span onClick={applyRandRot} style={mkBtnS('#a78bfa')} title="applyRandRot 🎲rot">🎲rot</span>
          </div>
        )
      })()}

      {/* R2594: 랜덤 스케일 applyRandScale 🎲sc */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyRandScale = async () => {
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            const factor = 0.5 + Math.random() * 1.5
            return { ...n, scale: { ...sc, x: parseFloat((sc.x * factor).toFixed(2)), y: parseFloat((sc.y * factor).toFixed(2)) } }
          }, `🎲sc 랜덤 스케일 (${uuids.length}개) R2594`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>랜덤sc (R2594)</span>
            <span onClick={applyRandScale} style={mkBtnS('#fb923c')} title="applyRandScale 🎲sc">🎲sc</span>
          </div>
        )
      })()}

      {/* R2597: scale 배수 적용 scaleMulInput applyScaleMul ×0.5 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyScaleMul = async () => {
          const m = parseFloat(scaleMulInput)
          if (isNaN(m) || m === 0) return
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, x: parseFloat((sc.x * m).toFixed(3)), y: parseFloat((sc.y * m).toFixed(3)) } }
          }, `scale ×${m} (${uuids.length}개) R2597`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>sc배수 (R2597)</span>
            <input type="text" value={scaleMulInput} onChange={e => setScaleMulInput(e.target.value)}
              style={mkNiS(40)} title="scaleMulInput 배수" />
            <span onClick={applyScaleMul} style={mkBtnS('#fb923c')} title="applyScaleMul scale 배수 적용">적용</span>
            <span onClick={() => { setScaleMulInput('0.5') }} style={mkBtnS('#94a3b8')} title="×0.5 프리셋">×0.5</span>
          </div>
        )
      })()}

      {/* R2608: rotation 스냅 applyRotSnap rot스냅 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyRotSnap = async (step: number) => {
          await patchNodes(n => {
            if (typeof n.rotation === 'number') return { ...n, rotation: Math.round(n.rotation / step) * step }
            const r = n.rotation as { x: number; y: number; z: number }
            return { ...n, rotation: { ...r, z: Math.round(r.z / step) * step } }
          }, `rot스냅 ${step}° (${uuids.length}개) R2608`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>rot스냅 (R2608)</span>
            {[15, 30, 45, 90].map(step => (
              <span key={step} onClick={() => applyRotSnap(step)} style={mkBtnS('#a78bfa')} title={`applyRotSnap ${step}°`}>{step}°</span>
            ))}
          </div>
        )
      })()}

      {/* R2612: rotation 오프셋 rotOffsetInput addRot rot+= (R2612) */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const addRot = async () => {
          const d = parseFloat(rotOffsetInput)
          if (isNaN(d)) return
          await patchNodes(n => {
            if (typeof n.rotation === 'number') return { ...n, rotation: n.rotation + d }
            const r = n.rotation as { x: number; y: number; z: number }
            return { ...n, rotation: { ...r, z: r.z + d } }
          }, `rot+= (R2612) ${d > 0 ? '+' : ''}${d}° (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>rot+= (R2612)</span>
            <input type="text" value={rotOffsetInput} onChange={e => setRotOffsetInput(e.target.value)}
              style={mkNiS(40)} title="rotOffsetInput 오프셋" />
            <span onClick={addRot} style={mkBtnS('#a78bfa')} title="addRot rotation 오프셋 적용">적용</span>
          </div>
        )
      })()}
    </div>
  )
}
