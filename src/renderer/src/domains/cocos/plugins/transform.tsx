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
  const [absScaleX, setAbsScaleX] = useState<number>(1)
  const [absScaleY, setAbsScaleY] = useState<number>(1)
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
    </div>
  )
}
