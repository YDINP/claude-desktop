import React, { useState, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'

export function DistributionPlugin({ nodes, sceneFile, saveScene }: BatchPluginProps) {
  const uuids = nodes.map(n => n.uuid)
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes, patchOrdered } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  // R2569: opacity 그라데이션 분배
  const [opGradFromDist, setOpGradFromDist] = useState<number>(255)
  const [opGradToDist, setOpGradToDist] = useState<number>(0)
  // R2572: 랜덤 산포
  // R2573: 그룹 원점화
  // R2577: 일괄 픽셀 반올림
  // R2595: 크기 통일
  // R2599: size 배수 적용
  const [sizeMulInput, setSizeMulInput] = useState<string>('2')
  // R2634: 첫 노드 크기 통일
  // R2638: 회전 균등 분배
  const [rotGradFrom, setRotGradFrom] = useState<number>(0)
  const [rotGradTo, setRotGradTo] = useState<number>(360)
  // R2681: 산포/수축
  const [spreadFactor, setSpreadFactor] = useState<number>(1.5)
  // R2683: 캔버스 기준 정렬
  // R2684: 절대 간격 설정
  const [evenSpacing, setEvenSpacing] = useState<number>(10)
  // R2695: 위치 선형 배치
  const [posGradFrom, setPosGradFrom] = useState<number>(-200)
  const [posGradTo, setPosGradTo] = useState<number>(200)
  // R2697: opacity 그라데이션
  // R2710: 크기 고정값 일괄 설정
  const [fixedSizeW, setFixedSizeW] = useState<number>(100)
  const [fixedSizeH, setFixedSizeH] = useState<number>(100)
  const [fixedSizeApplyW, setFixedSizeApplyW] = useState<boolean>(true)
  const [fixedSizeApplyH, setFixedSizeApplyH] = useState<boolean>(true)
  // R2719: 격자 스냅
  const [nearestGridSnap, setNearestGridSnap] = useState<number>(16)
  // R2679: 원점 이동
  // R2547: 2-노드 위치 교환
  // R2565: Z축 오프셋
  const [batchDz, setBatchDz] = useState<string>('')
  // R2479: 원형 배치
  const [circleRadiusDist, setCircleRadiusDist] = useState<number>(100)
  // R2481: 격자 배치
  const [gridColsDist, setGridColsDist] = useState<number>(3)
  const [gridGapXDist, setGridGapXDist] = useState<number>(120)
  const [gridGapYDist, setGridGapYDist] = useState<number>(120)

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
            return { ...n, rotation: { ...n.rotation, z: deg } }
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
      {/* R1665: 다중 선택 정렬 — 정렬 버튼 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyAlignDist = async (axis: 'x' | 'y', mode: 'min' | 'max' | 'center') => {
          if (!sceneFile.root) return
          const ns: CCSceneNode[] = []
          function coll(n: CCSceneNode) { if (uuidSet.has(n.uuid)) ns.push(n); n.children.forEach(coll) }
          coll(sceneFile.root)
          if (ns.length < 2) return
          const xs = ns.map(n => ((n.position as Record<string, number>).x ?? 0))
          const minLeft = Math.min(...xs)
          const maxRight = Math.max(...xs)
          const vals = ns.map(n => ((n.position as Record<string, number>)[axis] ?? 0))
          const target = mode === 'min' ? Math.min(...vals) : mode === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length
          await patchNodes(n => {
            const pos = { ...((n.position as object) ?? {}) } as Record<string, number>
            pos[axis] = Math.round(target)
            return { ...n, position: pos as CCSceneNode['position'] }
          }, `다중 선택 정렬 ${axis}=${Math.round(target)} (${ns.length}개)`)
          void minLeft; void maxRight
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>정렬 (R1665)</span>
            <span onClick={() => applyAlignDist('x', 'min')} style={mkBtnS('#34d399')} title="왼쪽 정렬">⊢L</span>
            <span onClick={() => applyAlignDist('x', 'center')} style={mkBtnS('#34d399')} title="X center 정렬">↔C</span>
            <span onClick={() => applyAlignDist('x', 'max')} style={mkBtnS('#34d399')} title="X max 정렬">⊣R</span>
            <span onClick={() => applyAlignDist('y', 'max')} style={mkBtnS('#34d399')} title="Y max 정렬">△T</span>
            <span onClick={() => applyAlignDist('y', 'center')} style={mkBtnS('#34d399')} title="Y center 정렬">↕M</span>
            <span onClick={() => applyAlignDist('y', 'min')} style={mkBtnS('#34d399')} title="Y min 정렬">▽B</span>
          </div>
        )
      })()}

      {/* R1722: 균등 분배 — applyDistH / applyDistV */}
      {sceneFile.root && uuids.length >= 3 && (() => {
        const applyDistribute = async (axis: 'h' | 'v') => {
          if (!sceneFile.root) return
          const ns: CCSceneNode[] = []
          function collectD(n: CCSceneNode) { if (uuidSet.has(n.uuid)) ns.push(n); n.children.forEach(collectD) }
          collectD(sceneFile.root)
          if (ns.length < 3) return
          const info = ns.map(n => { const pos = n.position as { x: number; y: number }; return { uuid: n.uuid, px: pos.x, py: pos.y } })
          if (axis === 'h') {
            info.sort((a, b) => a.px - b.px)
            const minX = info[0].px, maxX = info[info.length - 1].px
            const step = (maxX - minX) / (info.length - 1)
            const newPos: Record<string, number> = {}
            info.forEach((n, i) => { newPos[n.uuid] = minX + step * i })
            function applyDistH(n: CCSceneNode): CCSceneNode {
              if (newPos[n.uuid] !== undefined) {
                const pos = n.position as { x: number; y: number; z?: number }
                return { ...n, position: { ...pos, x: newPos[n.uuid] }, children: n.children.map(applyDistH) }
              }
              return { ...n, children: n.children.map(applyDistH) }
            }
            await saveScene(applyDistH(sceneFile.root))
          } else {
            info.sort((a, b) => a.py - b.py)
            const minY = info[0].py, maxY = info[info.length - 1].py
            const step = (maxY - minY) / (info.length - 1)
            const newPos: Record<string, number> = {}
            info.forEach((n, i) => { newPos[n.uuid] = minY + step * i })
            function applyDistV(n: CCSceneNode): CCSceneNode {
              if (newPos[n.uuid] !== undefined) {
                const pos = n.position as { x: number; y: number; z?: number }
                return { ...n, position: { ...pos, y: newPos[n.uuid] }, children: n.children.map(applyDistV) }
              }
              return { ...n, children: n.children.map(applyDistV) }
            }
            await saveScene(applyDistV(sceneFile.root))
          }
          setBatchMsg(`✓ 균등 분배 (${axis})`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>분배 (R1722)</span>
            <span onClick={() => applyDistribute('h')} style={mkBtnS('#58a6ff')} title="가로 균등 분배">⇔H</span>
            <span onClick={() => applyDistribute('v')} style={mkBtnS('#58a6ff')} title="세로 균등 분배">⇕V</span>
          </div>
        )
      })()}

      {/* R1735: applyMatchSize — 기준 노드 크기 맞추기 (W≡/H≡) */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const ns: CCSceneNode[] = []
        function collectSz(n: CCSceneNode) { if (uuidSet.has(n.uuid)) ns.push(n); n.children.forEach(collectSz) }
        collectSz(sceneFile.root!)
        if (ns.length < 2) return null
        const ref = ns[0]
        const refSz = ref.size as { x?: number; y?: number } | undefined
        const refW = refSz?.x ?? 0, refH = refSz?.y ?? 0
        const applyMatchSize = async (axis: 'w' | 'h' | 'wh') => {
          if (!sceneFile.root) return
          function patchMS(n: CCSceneNode): CCSceneNode {
            if (uuidSet.has(n.uuid) && n.uuid !== ref.uuid) {
              const sz = n.size as { x?: number; y?: number } | undefined
              const newW = (axis === 'w' || axis === 'wh') ? refW : (sz?.x ?? 0)
              const newH = (axis === 'h' || axis === 'wh') ? refH : (sz?.y ?? 0)
              return { ...n, size: { x: newW, y: newH }, children: n.children.map(patchMS) }
            }
            return { ...n, children: n.children.map(patchMS) }
          }
          await saveScene(patchMS(sceneFile.root))
          setBatchMsg(`✓ W≡/H≡ (R1735)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>크기맞춤 (R1735)</span>
            <span onClick={() => applyMatchSize('w')} style={mkBtnS('#38bdf8')} title={`W≡ ${refW}`}>W≡</span>
            <span onClick={() => applyMatchSize('h')} style={mkBtnS('#38bdf8')} title={`H≡ ${refH}`}>H≡</span>
            <span onClick={() => applyMatchSize('wh')} style={mkBtnS('#38bdf8')} title={`WH≡ ${refW}×${refH}`}>WH≡</span>
          </div>
        )
      })()}

      {/* R1768: 균등 배치 + R1772: patchAlign + 선택 노드 정렬 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const posList: { uuid: string; x: number; y: number }[] = []
        function collectAP(n: CCSceneNode) { if (uuidSet.has(n.uuid)) posList.push({ uuid: n.uuid, x: (n.position as { x: number }).x, y: (n.position as { y: number }).y }); n.children.forEach(collectAP) }
        collectAP(sceneFile.root!)
        const xs = posList.map(p => p.x), ys = posList.map(p => p.y)
        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minY = Math.min(...ys), maxY = Math.max(...ys)
        const patchAlign = async (axis: 'x' | 'y', value: number) => {
          if (!sceneFile.root) return
          function applyPA(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(applyPA)
            if (!uuidSet.has(n.uuid)) return { ...n, children: ch }
            return { ...n, position: { ...(n.position || {}), [axis]: value }, children: ch }
          }
          await saveScene(applyPA(sceneFile.root))
          setBatchMsg(`✓ 선택 노드 정렬 (${axis}=${value})`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        const distMap: Record<string, number> = {}
        const patchDist = async (axis: 'x' | 'y') => {
          if (!sceneFile.root || posList.length < 3) return
          const sorted = [...posList].sort((a, b) => a[axis] - b[axis])
          const first = sorted[0][axis], last = sorted[sorted.length - 1][axis]
          const step = (last - first) / (sorted.length - 1)
          sorted.forEach((p, i) => { distMap[p.uuid] = first + i * step })
          function applyPD(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(applyPD)
            if (!uuidSet.has(n.uuid) || distMap[n.uuid] === undefined) return { ...n, children: ch }
            return { ...n, position: { ...(n.position || {}), [axis]: Math.round(distMap[n.uuid]) }, children: ch }
          }
          await saveScene(applyPD(sceneFile.root))
          setBatchMsg(`✓ 균등 배치 ${axis} (R1768)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>Align (R1772)</span>
            <span onClick={() => patchAlign('x', minX)} style={mkBtnS('#a78bfa')} title="⊢L">⊢L</span>
            <span onClick={() => patchAlign('x', maxX)} style={mkBtnS('#a78bfa')} title="⊣R">⊣R</span>
            <span onClick={() => patchAlign('y', maxY)} style={mkBtnS('#a78bfa')} title="⊤T">⊤T</span>
            <span onClick={() => patchAlign('y', minY)} style={mkBtnS('#a78bfa')} title="⊥B">⊥B</span>
            {posList.length >= 3 && <>
              <span onClick={() => patchDist('x')} style={mkBtnS('#58a6ff')} title="X축 균등 배치 (R1768)">↔=</span>
              <span onClick={() => patchDist('y')} style={mkBtnS('#58a6ff')} title="Y축 균등 배치 (R1768)">↕=</span>
            </>}
          </div>
        )
      })()}

      {/* R2479: 원형 배치 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyCircle = async () => {
          if (!sceneFile.root) return
          const n = uuids.length
          const moves = uuids.map((uuid, i) => {
            const angle = (2 * Math.PI * i) / n - Math.PI / 2
            return { uuid, x: Math.round(circleRadiusDist * Math.cos(angle)), y: Math.round(circleRadiusDist * Math.sin(angle)) }
          })
          function patchC(node: CCSceneNode): CCSceneNode {
            const move = moves.find(m => m.uuid === node.uuid)
            const ch = node.children.map(patchC)
            if (!move) return { ...node, children: ch }
            return { ...node, position: { ...(node.position || { z: 0 }), x: move.x, y: move.y }, children: ch }
          }
          await saveScene(patchC(sceneFile.root))
          setBatchMsg(`✓ 원형 배치 r=${circleRadiusDist} (${n}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>원형 (R2479)</span>
            <input type="number" min={10} max={2000} value={circleRadiusDist} onChange={e => setCircleRadiusDist(parseInt(e.target.value) || 100)} style={mkNiS(46)} title="원형 배치 반지름 (R2479)" />
            <span onClick={applyCircle} style={mkBtnS('#fbbf24')} title="원형 배치">○배치</span>
          </div>
        )
      })()}

      {/* R2481: 격자 배치 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyGrid = async () => {
          if (!sceneFile.root) return
          const cols = Math.max(1, gridColsDist)
          const moves = uuids.map((uuid, i) => ({ uuid, x: (i % cols) * gridGapXDist, y: -Math.floor(i / cols) * gridGapYDist }))
          function patchG(node: CCSceneNode): CCSceneNode {
            const move = moves.find(m => m.uuid === node.uuid)
            const ch = node.children.map(patchG)
            if (!move) return { ...node, children: ch }
            return { ...node, position: { ...(node.position || { z: 0 }), x: move.x, y: move.y }, children: ch }
          }
          await saveScene(patchG(sceneFile.root))
          setBatchMsg(`✓ 격자 배치 ${cols}열 (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>격자 (R2481)</span>
            <input type="number" min={1} value={gridColsDist} onChange={e => setGridColsDist(parseInt(e.target.value) || 3)} style={mkNiS(30)} title="열 수" />
            <input type="number" value={gridGapXDist} onChange={e => setGridGapXDist(parseInt(e.target.value) || 120)} style={mkNiS(36)} title="X 간격" />
            <input type="number" value={gridGapYDist} onChange={e => setGridGapYDist(parseInt(e.target.value) || 120)} style={mkNiS(36)} title="Y 간격" />
            <span onClick={applyGrid} style={mkBtnS('#fbbf24')} title="격자 배치 (R2481)">⊞배치</span>
          </div>
        )
      })()}

      {/* R2482: 정렬 도구 + R2483: 균등 배분 + R2485: 크기 균등화 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        function collectAlignPos(n: CCSceneNode, arr: CCSceneNode[]) { if (uuidSet.has(n.uuid)) arr.push(n); n.children.forEach(c => collectAlignPos(c, arr)) }
        const applyEqSize = async (axis: 'w' | 'h') => {
          const ns: CCSceneNode[] = []; collectAlignPos(sceneFile.root!, ns)
          const vals = ns.map(n => (n.size as { x: number; y: number })[axis === 'w' ? 'x' : 'y'])
          const maxV = Math.max(...vals)
          await patchNodes(n => ({ ...n, size: { ...(n.size as { x: number; y: number }), [axis === 'w' ? 'x' : 'y']: maxV } }), `크기균등 ${axis}=${maxV}`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>정렬 도구 (R2482) / 균등 배분 (R2483) / 크기 균등화 (R2485)</span>
            <span onClick={() => applyEqSize('w')} style={mkBtnS('#38bdf8')} title="크기균등 W (R2485)">=W</span>
            <span onClick={() => applyEqSize('h')} style={mkBtnS('#38bdf8')} title="크기균등 H (R2485)">=H</span>
          </div>
        )
      })()}

      {/* R2547: 2-노드 위치 교환 */}
      {sceneFile.root && uuids.length === 2 && (() => {
        const applySwapPos = async () => {
          if (!sceneFile.root) return
          const [uA, uB] = uuids
          let posA: { x: number; y: number; z?: number } | null = null
          let posB: { x: number; y: number; z?: number } | null = null
          function collect(n: CCSceneNode): void {
            if (n.uuid === uA) posA = n.position as { x: number; y: number; z?: number }
            if (n.uuid === uB) posB = n.position as { x: number; y: number; z?: number }
            n.children.forEach(collect)
          }
          collect(sceneFile.root)
          if (!posA || !posB) return
          const pA = posA, pB = posB
          function patch(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(patch)
            if (n.uuid === uA) return { ...n, position: pB, children: ch }
            if (n.uuid === uB) return { ...n, position: pA, children: ch }
            return { ...n, children: ch }
          }
          await saveScene(patch(sceneFile.root))
          setBatchMsg('✓ 2-노드 위치 교환 (R2547)')
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>교환 (R2547)</span>
            <span onClick={applySwapPos} style={mkBtnS('#fbbf24')} title="2-노드 위치 교환 (R2547)">⇄ 위치</span>
          </div>
        )
      })()}

      {/* R2565: Z축 오프셋 */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>dZ (R2565)</span>
        <input type="number" placeholder="dZ" value={batchDz} onChange={e => setBatchDz(e.target.value)}
          title="Z축 오프셋 (CC3.x) — R2565"
          style={mkNiS(46)} />
        {batchDz && <span onClick={async () => {
          const dz = parseFloat(batchDz)
          if (isNaN(dz)) return
          await patchNodes(n => {
            const p = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...p, z: (p.z ?? 0) + dz } }
          }, `Z축 오프셋 +${dz} (${uuids.length}개)`)
        }} style={mkBtnS('#fb923c')} title="Z축 오프셋 적용">적용</span>}
      </div>

      {/* R2569: opacity 그라데이션 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>op분배 (R2569)</span>
            {([{ label: '255→0', from: 255, to: 0 }, { label: '0→255', from: 0, to: 255 }] as const).map(({ label, from, to }) => (
              <span key={label} onClick={async () => {
                if (!sceneFile.root) return
                const collected: CCSceneNode[] = []
                function collectO(n: CCSceneNode) { if (uuidSet.has(n.uuid)) collected.push(n); n.children.forEach(collectO) }
                collectO(sceneFile.root)
                if (collected.length < 2) return
                const opMap: Record<string, number> = {}
                collected.forEach((n, i) => { opMap[n.uuid] = Math.round(from + (to - from) * (i / (collected.length - 1))) })
                function applyOp(n: CCSceneNode): CCSceneNode {
                  const ch = n.children.map(applyOp)
                  if (opMap[n.uuid] !== undefined) return { ...n, opacity: opMap[n.uuid], children: ch }
                  return { ...n, children: ch }
                }
                await saveScene(applyOp(sceneFile.root))
                setBatchMsg(`✓ opacity 그라데이션 분배 ${label}`)
                setTimeout(() => setBatchMsg(null), 2000)
              }} style={mkBtnS('#fb923c')} title={`opacity 그라데이션 ${label} (R2569)`}>{label}</span>
            ))}
          </div>
        )
      })()}

      {/* R2496: 흩뿌리기 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const scatterAmt = 100
        const applyScatter2496 = async () => {
          if (!sceneFile.root) return
          function applyScatterFn(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(applyScatterFn)
            if (!uuidSet.has(n.uuid)) return { ...n, children: ch }
            const pos = n.position as { x: number; y: number; z?: number }
            const angle = Math.random() * Math.PI * 2, dist = Math.random() * scatterAmt
            return { ...n, position: { ...pos, x: Math.round(pos.x + Math.cos(angle) * dist), y: Math.round(pos.y + Math.sin(angle) * dist) }, children: ch }
          }
          await saveScene(applyScatterFn(sceneFile.root))
          setBatchMsg(`✓ 흩뿌리기 (R2496)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>흩뿌리기 (R2496)</span>
            <span onClick={applyScatter2496} style={mkBtnS('#a78bfa')} title={`흩뿌리기 ±${scatterAmt} (R2496)`}>흩뿌리기</span>
          </div>
        )
      })()}

      {/* R2572: 랜덤 산포 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>산포 (R2572)</span>
            {([50, 100, 200] as const).map(r => (
              <span key={r} onClick={async () => {
                if (!sceneFile.root) return
                function applyScatter(n: CCSceneNode): CCSceneNode {
                  const ch = n.children.map(applyScatter)
                  if (!uuidSet.has(n.uuid)) return { ...n, children: ch }
                  const pos = n.position as { x: number; y: number; z?: number }
                  const angle = Math.random() * Math.PI * 2, dist = Math.random() * r
                  return { ...n, position: { ...pos, x: Math.round(pos.x + Math.cos(angle) * dist), y: Math.round(pos.y + Math.sin(angle) * dist) }, children: ch }
                }
                await saveScene(applyScatter(sceneFile.root))
                setBatchMsg(`✓ 랜덤 산포 ±${r}`)
                setTimeout(() => setBatchMsg(null), 2000)
              }} style={mkBtnS('#a78bfa')} title={`랜덤 산포 ±${r} (R2572)`}>±{r}</span>
            ))}
          </div>
        )
      })()}

      {/* R2573: 그룹 원점화 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>원점 (R2573)</span>
            <span onClick={async () => {
              if (!sceneFile.root) return
              const collected: CCSceneNode[] = []
              function collectN(n: CCSceneNode) { if (uuidSet.has(n.uuid)) collected.push(n); n.children.forEach(collectN) }
              collectN(sceneFile.root)
              if (collected.length < 1) return
              const avgX = collected.reduce((s, n) => s + (n.position as { x: number }).x, 0) / collected.length
              const avgY = collected.reduce((s, n) => s + (n.position as { y: number }).y, 0) / collected.length
              function applyNorm(n: CCSceneNode): CCSceneNode {
                const ch = n.children.map(applyNorm)
                if (!uuidSet.has(n.uuid)) return { ...n, children: ch }
                const pos = n.position as { x: number; y: number; z?: number }
                return { ...n, position: { ...pos, x: Math.round(pos.x - avgX), y: Math.round(pos.y - avgY) }, children: ch }
              }
              await saveScene(applyNorm(sceneFile.root))
              setBatchMsg(`✓ 그룹 원점화 (R2573)`)
              setTimeout(() => setBatchMsg(null), 2000)
            }} style={mkBtnS('#34d399')} title="그룹 중심을 (0,0)으로 이동 (R2573)">⊕0</span>
          </div>
        )
      })()}

      {/* R2577: 일괄 픽셀 반올림 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyBatchRound = async () => {
          if (!sceneFile.root) return
          function patch(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(patch)
            if (!uuidSet.has(n.uuid)) return { ...n, children: ch }
            const pos = n.position as { x: number; y: number; z?: number }
            const sz = n.size as { x: number; y: number }
            return { ...n, position: { ...pos, x: Math.round(pos.x), y: Math.round(pos.y) }, size: { x: Math.round(sz.x), y: Math.round(sz.y) }, children: ch }
          }
          await saveScene(patch(sceneFile.root))
          setBatchMsg(`✓ 일괄 픽셀 반올림 (R2577)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>정수화 (R2577)</span>
            <span onClick={applyBatchRound} style={mkBtnS('#fbbf24')} title="선택 노드 위치/크기 정수화 (R2577)">⌊⌉All</span>
          </div>
        )
      })()}

      {/* R2595: 크기 통일 (첫째 노드 기준) */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const selN: CCSceneNode[] = []
        function collectSz2(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selN.push(n); n.children.forEach(collectSz2) }
        collectSz2(sceneFile.root!)
        if (selN.length < 2) return null
        const refSz = selN[0].size as { x: number; y: number }
        const applyMatchSize = async (matchW: boolean, matchH: boolean) => {
          await patchNodes(n => ({ ...n, size: { x: matchW ? refSz.x : (n.size as { x: number; y: number }).x, y: matchH ? refSz.y : (n.size as { x: number; y: number }).y } }), `크기 통일`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>크기 통일 (R2595)</span>
            <span onClick={() => applyMatchSize(true, false)} style={mkBtnS('#38bdf8')} title="W 크기 통일">=W</span>
            <span onClick={() => applyMatchSize(false, true)} style={mkBtnS('#38bdf8')} title="H 크기 통일">=H</span>
            <span onClick={() => applyMatchSize(true, true)} style={mkBtnS('#38bdf8')} title="W×H 크기 통일">=WH</span>
          </div>
        )
      })()}

      {/* R2599: size 배수 적용 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const mul = parseFloat(sizeMulInput) || 2
        const applySizeMul = async (m: number) => {
          await patchNodes(n => {
            const sz = n.size as { x: number; y: number }
            return { ...n, size: { x: Math.round(sz.x * m), y: Math.round(sz.y * m) } }
          }, `size 배수 적용 ×${m} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>sz배수 (R2599)</span>
            <span onClick={() => applySizeMul(0.5)} style={mkBtnS('#38bdf8')}>×0.5</span>
            <span onClick={() => applySizeMul(2)} style={mkBtnS('#38bdf8')}>×2</span>
            <input type="number" value={sizeMulInput} step={0.1} onChange={e => setSizeMulInput(e.target.value)} style={mkNiS(36)} />
            <span onClick={() => applySizeMul(mul)} style={mkBtnS('#38bdf8')} title={`size 배수 적용 ×${mul} (R2599)`}>적용</span>
          </div>
        )
      })()}

      {/* R2634: 첫 노드 크기 통일 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const ns2: CCSceneNode[] = []
        function collectSz3(n: CCSceneNode) { if (uuidSet.has(n.uuid)) ns2.push(n); n.children.forEach(collectSz3) }
        collectSz3(sceneFile.root!)
        if (ns2.length < 2) return null
        const ref = ns2[0]
        const refW = ref.size?.x ?? 100, refH = ref.size?.y ?? 100
        const applyMatchSz = async (mode: 'w' | 'h' | 'both') => {
          await patchNodes(n => {
            const sz = n.size as { x: number; y: number }
            return { ...n, size: { x: mode === 'h' ? sz.x : refW, y: mode === 'w' ? sz.y : refH } }
          }, `첫 노드 크기 통일 (${uuids.length - 1}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>크기통일 (R2634)</span>
            <span onClick={() => applyMatchSz('w')} style={mkBtnS('#38bdf8')} title="첫 노드 W 통일">W</span>
            <span onClick={() => applyMatchSz('h')} style={mkBtnS('#38bdf8')} title="첫 노드 H 통일">H</span>
            <span onClick={() => applyMatchSz('both')} style={mkBtnS('#38bdf8')} title="첫 노드 크기 통일 W+H (R2634)">W+H</span>
          </div>
        )
      })()}

      {/* R2638: 회전 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyRotGrad = () => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const rot = Math.round(rotGradFrom + (rotGradTo - rotGradFrom) * t)
          return { ...n, rotation: { ...n.rotation, z: rot } }
        }, `회전 균등 분배 ${rotGradFrom}°→${rotGradTo}° (${uuids.length}개)`)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#ec4899', flexShrink: 0 }}>rot분배 (R2638)</span>
            <input type="number" value={rotGradFrom} step={1} onChange={e => setRotGradFrom(parseFloat(e.target.value) || 0)} style={mkNiS(40)} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={rotGradTo} step={1} onChange={e => setRotGradTo(parseFloat(e.target.value) || 0)} style={mkNiS(40)} />
            <span onClick={applyRotGrad} style={mkBtnS('#ec4899')} title={`회전 균등 분배 (R2638)`}>분배</span>
          </div>
        )
      })()}

      {/* R2681: 산포/수축 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applySpread = async (factor: number) => {
          if (!sceneFile.root) return
          const selN2: CCSceneNode[] = []
          function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selN2.push(n); n.children.forEach(collect) }
          collect(sceneFile.root)
          if (selN2.length < 2) return
          const xs2 = selN2.map(n => (n.position as { x: number }).x)
          const ys2 = selN2.map(n => (n.position as { y: number }).y)
          const cx = (Math.min(...xs2) + Math.max(...xs2)) / 2, cy = (Math.min(...ys2) + Math.max(...ys2)) / 2
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, x: Math.round(cx + (pos.x - cx) * factor), y: Math.round(cy + (pos.y - cy) * factor) } }
          }, `산포/수축 ×${factor} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>산포 (R2681)</span>
            <input type="number" value={spreadFactor} min={0.1} max={5} step={0.1} onChange={e => setSpreadFactor(parseFloat(e.target.value) || 1)} style={mkNiS(44)} />
            <span onClick={() => applySpread(spreadFactor)} style={mkBtnS('#fb923c')} title="산포">산포</span>
            <span onClick={() => applySpread(1 / spreadFactor)} style={mkBtnS('#fb923c')} title="수축">수축</span>
          </div>
        )
      })()}

      {/* R2683: 캔버스 기준 정렬 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const designWidth = 960, designHeight = 640
        const hw = designWidth / 2, hh = designHeight / 2
        const applyAlignToCanvas = async (ax: number | null, ay: number | null) => {
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, x: ax !== null ? ax : pos.x, y: ay !== null ? ay : pos.y } }
          }, `캔버스 기준 정렬 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>캔버스정렬 (R2683)</span>
            <span onClick={() => applyAlignToCanvas(-hw, null)} style={mkBtnS('#60a5fa')}>◁L</span>
            <span onClick={() => applyAlignToCanvas(0, null)} style={mkBtnS('#60a5fa')}>↔C</span>
            <span onClick={() => applyAlignToCanvas(hw, null)} style={mkBtnS('#60a5fa')}>▷R</span>
            <span onClick={() => applyAlignToCanvas(null, hh)} style={mkBtnS('#60a5fa')}>△T</span>
            <span onClick={() => applyAlignToCanvas(null, 0)} style={mkBtnS('#60a5fa')}>↕C</span>
            <span onClick={() => applyAlignToCanvas(null, -hh)} style={mkBtnS('#60a5fa')}>▽B</span>
          </div>
        )
      })()}

      {/* R2684: 절대 간격 설정 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyEvenSpacing = async (axis: 'x' | 'y') => {
          if (!sceneFile.root) return
          const selN3: CCSceneNode[] = []
          function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selN3.push(n); n.children.forEach(collect) }
          collect(sceneFile.root)
          if (selN3.length < 2) return
          const sorted = [...selN3].sort((a, b) => (a.position as Record<string, number>)[axis] - (b.position as Record<string, number>)[axis])
          const start = (sorted[0].position as Record<string, number>)[axis]
          const uuidToPos = new Map<string, number>()
          sorted.forEach((n, i) => uuidToPos.set(n.uuid, start + i * evenSpacing))
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, [axis]: uuidToPos.get(n.uuid) ?? (pos as Record<string, number>)[axis] } }
          }, `절대 간격 설정 ${axis} ${evenSpacing}px (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>간격 (R2684)</span>
            <input type="number" value={evenSpacing} min={0} step={5} onChange={e => setEvenSpacing(parseFloat(e.target.value) || 0)} style={mkNiS(44)} />
            <span onClick={() => applyEvenSpacing('x')} style={mkBtnS('#60a5fa')} title="X축 절대 간격 설정">X간격</span>
            <span onClick={() => applyEvenSpacing('y')} style={mkBtnS('#60a5fa')} title="Y축 절대 간격 설정">Y간격</span>
          </div>
        )
      })()}

      {/* R2695: 위치 선형 배치 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyPosGradient = (axis: 'x' | 'y') => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const val = posGradFrom + (posGradTo - posGradFrom) * t
          const p = n.position as { x: number; y: number; z?: number }
          return { ...n, position: axis === 'x' ? { ...p, x: val } : { ...p, y: val } }
        }, `위치 선형 배치 ${axis.toUpperCase()} ${posGradFrom}→${posGradTo} (${uuids.length}개)`)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>위치분포 (R2695)</span>
            <input type="number" value={posGradFrom} onChange={e => setPosGradFrom(parseFloat(e.target.value) || 0)} style={mkNiS(52)} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={posGradTo} onChange={e => setPosGradTo(parseFloat(e.target.value) || 0)} style={mkNiS(52)} />
            <span onClick={() => applyPosGradient('x')} style={mkBtnS('#34d399')} title="X축 위치 선형 배치 (R2695)">X배치</span>
            <span onClick={() => applyPosGradient('y')} style={mkBtnS('#34d399')} title="Y축 위치 선형 배치 (R2695)">Y배치</span>
          </div>
        )
      })()}

      {/* R2697: opacity 그라데이션 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyOpGradient = () => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const op = Math.round(opGradFromDist + (opGradToDist - opGradFromDist) * t)
          return { ...n, opacity: Math.max(0, Math.min(255, op)) }
        }, `opacity 그라데이션 ${opGradFromDist}→${opGradToDist} (${uuids.length}개)`)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>op분포 (R2697)</span>
            <input type="number" value={opGradFromDist} min={0} max={255} onChange={e => setOpGradFromDist(parseInt(e.target.value) || 0)} style={mkNiS(44)} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={opGradToDist} min={0} max={255} onChange={e => setOpGradToDist(parseInt(e.target.value) || 0)} style={mkNiS(44)} />
            <span onClick={applyOpGradient} style={mkBtnS('#a78bfa')} title="opacity 그라데이션 (R2697)">적용</span>
          </div>
        )
      })()}

      {/* R2710: 크기 고정값 일괄 설정 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyBatchFixedSize = async () => {
          await patchNodes(n => {
            const sz = n.size as { x: number; y: number }
            return { ...n, size: { x: fixedSizeApplyW ? fixedSizeW : sz.x, y: fixedSizeApplyH ? fixedSizeH : sz.y } }
          }, `크기 고정값 일괄 설정 ${fixedSizeW}×${fixedSizeH} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>크기고정 (R2710)</span>
            <label style={{ fontSize: 8, color: '#94a3b8' }}><input type="checkbox" checked={fixedSizeApplyW} onChange={e => setFixedSizeApplyW(e.target.checked)} />W</label>
            <input type="number" value={fixedSizeW} min={1} onChange={e => setFixedSizeW(parseInt(e.target.value) || 100)} style={mkNiS(40)} />
            <label style={{ fontSize: 8, color: '#94a3b8' }}><input type="checkbox" checked={fixedSizeApplyH} onChange={e => setFixedSizeApplyH(e.target.checked)} />H</label>
            <input type="number" value={fixedSizeH} min={1} onChange={e => setFixedSizeH(parseInt(e.target.value) || 100)} style={mkNiS(40)} />
            <span onClick={applyBatchFixedSize} style={mkBtnS('#22d3ee')} title="크기 고정값 일괄 설정 applyBatchFixedSize (R2710)">적용</span>
          </div>
        )
      })()}

      {/* R2719: 격자 스냅 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyGridSnapNearest = async () => {
          const g = nearestGridSnap
          await patchNodes(n => {
            const p = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...p, x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g } }
          }, `격자 스냅 ${g}px (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>px스냅 (R2719)</span>
            <input type="number" value={nearestGridSnap} min={1} onChange={e => setNearestGridSnap(parseInt(e.target.value) || 16)} style={mkNiS(38)} />
            <span onClick={applyGridSnapNearest} style={mkBtnS('#34d399')} title={`격자 스냅 ${nearestGridSnap}px (R2719)`}>스냅</span>
          </div>
        )
      })()}

      {/* R2679: 원점이동 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyMoveToCenter = async () => {
          if (!sceneFile.root) return
          const selN4: CCSceneNode[] = []
          function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selN4.push(n); n.children.forEach(collect) }
          collect(sceneFile.root)
          if (selN4.length === 0) return
          const xs3 = selN4.map(n => (n.position as { x: number }).x)
          const ys3 = selN4.map(n => (n.position as { y: number }).y)
          const cx = (Math.min(...xs3) + Math.max(...xs3)) / 2, cy = (Math.min(...ys3) + Math.max(...ys3)) / 2
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, x: Math.round(pos.x - cx), y: Math.round(pos.y - cy) } }
          }, `원점이동 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>원점이동 (R2679)</span>
            <span onClick={applyMoveToCenter} style={mkBtnS('#a78bfa')} title="선택 노드 그룹 중심을 (0,0)으로 원점이동 (R2679)">→(0,0)</span>
          </div>
        )
      })()}
    </div>
  )
}
