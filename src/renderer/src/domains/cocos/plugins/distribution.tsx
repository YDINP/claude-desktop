import React, { useState, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'

export function DistributionPlugin({ nodes, sceneFile, saveScene }: BatchPluginProps) {
  const uuids = nodes.map(n => n.uuid)
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes, patchOrdered } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  const [rotDistFrom, setRotDistFrom] = useState<number>(0)
  const [rotDistTo, setRotDistTo] = useState<number>(360)
  const [scaleGradFrom, setScaleGradFrom] = useState<number>(1)
  const [scaleGradTo, setScaleGradTo] = useState<number>(2)
  const [szGradFromW, setSzGradFromW] = useState<number>(50)
  const [szGradToW, setSzGradToW] = useState<number>(200)
  const [szGradFromH, setSzGradFromH] = useState<number>(50)
  const [szGradToH, setSzGradToH] = useState<number>(200)
  const [posZFrom, setPosZFrom] = useState<number>(0)
  const [posZTo, setPosZTo] = useState<number>(100)
  const [posXFrom, setPosXFrom] = useState<number>(-200)
  const [posXTo, setPosXTo] = useState<number>(200)
  const [posYFrom, setPosYFrom] = useState<number>(-200)
  const [posYTo, setPosYTo] = useState<number>(200)
  const [anchorXFrom, setAnchorXFrom] = useState<number>(0)
  const [anchorXTo, setAnchorXTo] = useState<number>(1)
  const [anchorYFrom, setAnchorYFrom] = useState<number>(0)
  const [anchorYTo, setAnchorYTo] = useState<number>(1)
  const [fontSizeFrom, setFontSizeFrom] = useState<number>(16)
  const [fontSizeTo, setFontSizeTo] = useState<number>(48)
  const [rotGradFrom, setRotGradFrom] = useState<number>(0)
  const [rotGradTo, setRotGradTo] = useState<number>(360)

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

  return (
    <div>
      {batchMsg && <div style={{ fontSize: 9, color: '#4ade80', marginBottom: 4 }}>{batchMsg}</div>}

      {/* R2604: rotation 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyRotDist = async () => {
          await patchOrdered((n, idx, total) => {
            const t = total > 1 ? idx / (total - 1) : 0
            const deg = Math.round(rotDistFrom + (rotDistTo - rotDistFrom) * t)
            const newRot = typeof n.rotation === 'number' ? deg : { ...(n.rotation as object), z: deg }
            return { ...n, rotation: newRot }
          }, `회전 분배 ${rotDistFrom}°→${rotDistTo}° (${uuids.length}개)`)
        }
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>회전분배 (R2604)</span>
            <input type="number" value={rotDistFrom} onChange={e => setRotDistFrom(parseInt(e.target.value) || 0)} style={niS} title="시작 각도(°)" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={rotDistTo} onChange={e => setRotDistTo(parseInt(e.target.value) || 0)} style={niS} title="끝 각도(°)" />
            <span onClick={applyRotDist}
              title={`선택된 ${uuids.length}개 노드 rotation ${rotDistFrom}°→${rotDistTo}° 균등 분배 (R2604)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#34d399', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#34d399')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >분배</span>
          </div>
        )
      })()}

      {/* R2605: scale 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyScaleGrad = async () => {
          await patchOrdered((n, idx, total) => {
            const t = total > 1 ? idx / (total - 1) : 0
            const sv = Math.round((scaleGradFrom + (scaleGradTo - scaleGradFrom) * t) * 1000) / 1000
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, x: sv, y: sv } }
          }, `scale 분배 ${scaleGradFrom}→${scaleGradTo} (${uuids.length}개)`)
        }
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>scale분배 (R2605)</span>
            <input type="number" value={scaleGradFrom} step={0.1} onChange={e => setScaleGradFrom(parseFloat(e.target.value) || 1)} style={niS} title="시작 scale" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={scaleGradTo} step={0.1} onChange={e => setScaleGradTo(parseFloat(e.target.value) || 1)} style={niS} title="끝 scale" />
            <span onClick={applyScaleGrad}
              title={`선택된 ${uuids.length}개 노드 scale ${scaleGradFrom}→${scaleGradTo} 균등 분배 (R2605)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#fb923c', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >분배</span>
          </div>
        )
      })()}

      {/* R2613: size W 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applySzGrad = () => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const newW = Math.round(szGradFromW + (szGradToW - szGradFromW) * t)
          const sz = n.size as { x: number; y: number }
          return { ...n, size: { ...sz, x: newW } }
        }, `size.W 분배 ${szGradFromW}→${szGradToW} (${uuids.length}개)`)
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>sizeW분배 (R2613)</span>
            <input type="number" value={szGradFromW} min={1} onChange={e => setSzGradFromW(parseInt(e.target.value) || 1)} style={niS} title="시작 width" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={szGradToW} min={1} onChange={e => setSzGradToW(parseInt(e.target.value) || 1)} style={niS} title="끝 width" />
            <span onClick={applySzGrad}
              title={`선택된 ${uuids.length}개 노드 size.W ${szGradFromW}→${szGradToW} 균등 분배 (R2613)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#38bdf8', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#38bdf8')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >분배</span>
          </div>
        )
      })()}

      {/* R2614: size H 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applySzGradH = () => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const newH = Math.round(szGradFromH + (szGradToH - szGradFromH) * t)
          const sz = n.size as { x: number; y: number }
          return { ...n, size: { ...sz, y: newH } }
        }, `size.H 분배 ${szGradFromH}→${szGradToH} (${uuids.length}개)`)
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>sizeH분배 (R2614)</span>
            <input type="number" value={szGradFromH} min={1} onChange={e => setSzGradFromH(parseInt(e.target.value) || 1)} style={niS} title="시작 height" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={szGradToH} min={1} onChange={e => setSzGradToH(parseInt(e.target.value) || 1)} style={niS} title="끝 height" />
            <span onClick={applySzGradH}
              title={`선택된 ${uuids.length}개 노드 size.H ${szGradFromH}→${szGradToH} 균등 분배 (R2614)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >분배</span>
          </div>
        )
      })()}

      {/* R2616: position Z 균등 분배 (CC3.x) */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyPosZGrad = () => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const newZ = Math.round(posZFrom + (posZTo - posZFrom) * t)
          const p = n.position as { x: number; y: number; z?: number }
          return { ...n, position: { ...p, z: newZ } }
        }, `pos.Z 분배 ${posZFrom}→${posZTo} (${uuids.length}개)`)
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>posZ분배 (R2616)</span>
            <input type="number" value={posZFrom} onChange={e => setPosZFrom(parseInt(e.target.value) || 0)} style={niS} title="시작 Z" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={posZTo} onChange={e => setPosZTo(parseInt(e.target.value) || 0)} style={niS} title="끝 Z" />
            <span onClick={applyPosZGrad}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#94a3b8', userSelect: 'none' }}
            >분배</span>
          </div>
        )
      })()}

      {/* R2618: position X 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyPosXGrad = () => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const newX = Math.round(posXFrom + (posXTo - posXFrom) * t)
          const p = n.position as { x: number; y: number; z?: number }
          return { ...n, position: { ...p, x: newX } }
        }, `pos.X 분배 ${posXFrom}→${posXTo} (${uuids.length}개)`)
        const niS = mkNiS(44)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>posX분배 (R2618)</span>
            <input type="number" value={posXFrom} onChange={e => setPosXFrom(parseInt(e.target.value) || 0)} style={niS} title="시작 X" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={posXTo} onChange={e => setPosXTo(parseInt(e.target.value) || 0)} style={niS} title="끝 X" />
            <span onClick={applyPosXGrad}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#94a3b8', userSelect: 'none' }}
            >분배</span>
          </div>
        )
      })()}

      {/* R2619: position Y 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyPosYGrad = () => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const newY = Math.round(posYFrom + (posYTo - posYFrom) * t)
          const p = n.position as { x: number; y: number; z?: number }
          return { ...n, position: { ...p, y: newY } }
        }, `pos.Y 분배 ${posYFrom}→${posYTo} (${uuids.length}개)`)
        const niS = mkNiS(44)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>posY분배 (R2619)</span>
            <input type="number" value={posYFrom} onChange={e => setPosYFrom(parseInt(e.target.value) || 0)} style={niS} title="시작 Y" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={posYTo} onChange={e => setPosYTo(parseInt(e.target.value) || 0)} style={niS} title="끝 Y" />
            <span onClick={applyPosYGrad}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#94a3b8', userSelect: 'none' }}
            >분배</span>
          </div>
        )
      })()}

      {/* R2628: 앵커 X/Y 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyAnchorXGrad = async () => {
          await patchOrdered((n, idx, total) => {
            const t = total > 1 ? idx / (total - 1) : 0
            const ax = parseFloat((anchorXFrom + (anchorXTo - anchorXFrom) * t).toFixed(3))
            return { ...n, anchor: { x: ax, y: n.anchor?.y ?? 0.5 } }
          }, `anchor.X ${anchorXFrom}→${anchorXTo} (${uuids.length}개)`)
        }
        const applyAnchorYGrad = async () => {
          await patchOrdered((n, idx, total) => {
            const t = total > 1 ? idx / (total - 1) : 0
            const ay = parseFloat((anchorYFrom + (anchorYTo - anchorYFrom) * t).toFixed(3))
            return { ...n, anchor: { x: n.anchor?.x ?? 0.5, y: ay } }
          }, `anchor.Y ${anchorYFrom}→${anchorYTo} (${uuids.length}개)`)
        }
        const niS = mkNiS(36)
        const btnS = mkBtnS('#fb923c')
        return (
          <>
            <div style={{ display: 'flex', gap: 3, marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#fb923c', flexShrink: 0 }}>ancX분배 (R2628)</span>
              <input type="number" value={anchorXFrom} min={0} max={1} step={0.1} onChange={e => setAnchorXFrom(parseFloat(e.target.value) || 0)} style={niS} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
              <input type="number" value={anchorXTo} min={0} max={1} step={0.1} onChange={e => setAnchorXTo(parseFloat(e.target.value) || 0)} style={niS} />
              <span onClick={applyAnchorXGrad} style={btnS}>분배</span>
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#fb923c', flexShrink: 0 }}>ancY분배 (R2628)</span>
              <input type="number" value={anchorYFrom} min={0} max={1} step={0.1} onChange={e => setAnchorYFrom(parseFloat(e.target.value) || 0)} style={niS} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
              <input type="number" value={anchorYTo} min={0} max={1} step={0.1} onChange={e => setAnchorYTo(parseFloat(e.target.value) || 0)} style={niS} />
              <span onClick={applyAnchorYGrad} style={btnS}>분배</span>
            </div>
          </>
        )
      })()}

      {/* R2633: cc.Label 폰트 크기 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const hasLabel = uuids.some(u => {
          let found = false
          function find(n: CCSceneNode) { if (n.uuid === u) { found = n.components.some(c => c.type === 'cc.Label'); return }; n.children.forEach(find) }
          find(sceneFile.root!)
          return found
        })
        if (!hasLabel) return null
        const applyFontSizeGrad = async () => {
          await patchOrdered((n, idx, total) => {
            const hasLabelComp = n.components.some(c => c.type === 'cc.Label')
            if (!hasLabelComp) return n
            const t = total > 1 ? idx / (total - 1) : 0
            const fs = Math.round(fontSizeFrom + (fontSizeTo - fontSizeFrom) * t)
            const comps = n.components.map(c => c.type === 'cc.Label' ? { ...c, props: { ...c.props, fontSize: fs, _fontSize: fs, _N$fontSize: fs } } : c)
            return { ...n, components: comps }
          }, `font 분배 ${fontSizeFrom}→${fontSizeTo} (${uuids.length}개)`)
        }
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#67e8f9', flexShrink: 0 }}>font분배 (R2633)</span>
            <input type="number" value={fontSizeFrom} min={1} onChange={e => setFontSizeFrom(parseInt(e.target.value) || 1)} style={niS} title="시작 fontSize" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={fontSizeTo} min={1} onChange={e => setFontSizeTo(parseInt(e.target.value) || 1)} style={niS} title="끝 fontSize" />
            <span onClick={applyFontSizeGrad}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#67e8f9', userSelect: 'none' }}
            >분배</span>
          </div>
        )
      })()}
    </div>
  )
}
