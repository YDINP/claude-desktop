import React, { useState, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'
import { MiscSelectionTools } from './misc-selection'
import { t } from '../../../utils/i18n'

export function MiscPlugin({ nodes, sceneFile, saveScene, onMultiSelectChange, onSelectNode, lockedUuids, onSetLockedUuids }: BatchPluginProps) {
  const uuids = useMemo(() => nodes.map(n => n.uuid), [nodes])
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes, patchOrdered } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  // R2643: 격자 배치
  const [gridCols, setGridCols] = useState<number>(3)
  const [gridSpacingX, setGridSpacingX] = useState<number>(150)
  const [gridSpacingY, setGridSpacingY] = useState<number>(150)
  // R2649: 복제 오프셋
  const [cloneOffsetX, setCloneOffsetX] = useState<number>(50)
  const [cloneOffsetY, setCloneOffsetY] = useState<number>(-50)
  // R2639: 원형 배치
  const [circleRadius, setCircleRadius] = useState<number>(200)
  // R2689: size 배수 스케일
  const [sizeFactor, setSizeFactor] = useState<number>(1.5)
  // R2690: 절대 scale 값
  const [absScaleX, setAbsScaleX] = useState<number>(1)
  const [absScaleY, setAbsScaleY] = useState<number>(1)
  // R2660: 가로세로 비율
  const [aspectRatioW, setAspectRatioW] = useState<number>(16)
  const [aspectRatioH, setAspectRatioH] = useState<number>(9)
  // R2681: 산포 factor
  const [spreadFactor, setSpreadFactor] = useState<number>(1.5)
  // R2684: 절대 간격
  const [evenSpacing, setEvenSpacing] = useState<number>(10)
  // R2695: 위치 선형 그라데이션
  const [posGradFrom, setPosGradFrom] = useState<number>(-200)
  const [posGradTo, setPosGradTo] = useState<number>(200)
  // R2628: 앵커 분배
  const [anchorXFrom, setAnchorXFrom] = useState<number>(0)
  const [anchorXTo, setAnchorXTo] = useState<number>(1)
  const [anchorYFrom, setAnchorYFrom] = useState<number>(0)
  const [anchorYTo, setAnchorYTo] = useState<number>(1)

  const mkBtnS = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontSize: 9, padding: '1px 5px', cursor: 'pointer',
    border: '1px solid var(--border)', borderRadius: 2,
    color, userSelect: 'none', ...extra,
  })
  const mkBtnTint = (rgb: string, hex: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
    border: `1px solid rgba(${rgb},0.4)`, color: hex,
    userSelect: 'none', background: `rgba(${rgb},0.05)`, ...extra,
  })
  const mkNiS = (w: number, padding = '1px 3px'): React.CSSProperties => ({
    width: w, fontSize: 9, padding, border: '1px solid var(--border)',
    borderRadius: 2, background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', textAlign: 'center',
  })

  return (
    <div>
      {batchMsg && <div style={{ fontSize: 9, color: '#4ade80', marginBottom: 4 }}>{batchMsg}</div>}

      {/* R2336: 2-노드 선택 시 거리/간격 정보 */}
      {uuids.length === 2 && sceneFile.root && (() => {
        const nodes2: CCSceneNode[] = []
        function collectTwo(n: CCSceneNode) { if (uuidSet.has(n.uuid)) nodes2.push(n); n.children.forEach(collectTwo) }
        collectTwo(sceneFile.root)
        if (nodes2.length !== 2) return null
        const [a, b] = nodes2
        const pa = a.position as { x: number; y: number }
        const pb = b.position as { x: number; y: number }
        const dx = Math.round((pb.x - pa.x) * 10) / 10
        const dy = Math.round((pb.y - pa.y) * 10) / 10
        const dist = Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10
        return (
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '3px 6px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#34d399', fontWeight: 600 }}>📐</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>dx:</span>
            <span style={{ fontSize: 9, color: '#34d399', fontFamily: 'monospace' }}>{dx}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>dy:</span>
            <span style={{ fontSize: 9, color: '#34d399', fontFamily: 'monospace' }}>{dy}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>dist:</span>
            <span style={{ fontSize: 9, color: '#fbbf24', fontFamily: 'monospace' }}>{dist}</span>
            {/* R2531: 2-노드 위치 교환 */}
            <span onClick={async () => {
              if (!sceneFile.root) return
              const posA = { ...(a.position as { x: number; y: number; z?: number }) }
              const posB = { ...(b.position as { x: number; y: number; z?: number }) }
              const uuidA = a.uuid, uuidB = b.uuid
              function patch(n: CCSceneNode): CCSceneNode {
                const children = n.children.map(patch)
                if (n.uuid === uuidA) return { ...n, position: posB, children }
                if (n.uuid === uuidB) return { ...n, position: posA, children }
                return { ...n, children }
              }
              await saveScene(patch(sceneFile.root))
              setBatchMsg(t('batch.misc.s_pos_swap_r2531', '✓ 위치 교환 (R2531)'))
              setTimeout(() => setBatchMsg(null), 2000)
            }}
              title={t('batch.misc.t_node_pos_swap_r2531', '두 노드 위치 교환 (R2531)')}
              style={{ fontSize: 9, padding: '1px 5px', cursor: 'pointer', border: '1px solid rgba(52,211,153,0.4)', borderRadius: 2, color: '#34d399', userSelect: 'none', marginLeft: 'auto' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#34d399')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)')}
            >{t('batch.misc.j_swap', '⇄ 교환')}</span>
          </div>
        )
      })()}
      {/* R2499: 3+ 노드 선택 바운딩박스 통계 (center, span, rot range) */}
      {uuids.length >= 3 && sceneFile.root && (() => {
        const ns: CCSceneNode[] = []
        function coll(n: CCSceneNode) { if (uuidSet.has(n.uuid)) ns.push(n); n.children.forEach(coll) }
        coll(sceneFile.root)
        if (ns.length < 3) return null
        const xs = ns.map(n => (n.position as { x?: number }).x ?? 0)
        const ys = ns.map(n => (n.position as { y?: number }).y ?? 0)
        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minY = Math.min(...ys), maxY = Math.max(...ys)
        const cx = Math.round((minX + maxX) / 2), cy = Math.round((minY + maxY) / 2)
        const spanX = Math.round(maxX - minX), spanY = Math.round(maxY - minY)
        return (
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, padding: '3px 6px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#818cf8', fontWeight: 600 }}>⊞</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>center</span>
            <span style={{ fontSize: 9, color: '#818cf8', fontFamily: 'monospace' }}>{cx},{cy}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>span</span>
            <span style={{ fontSize: 9, color: '#a78bfa', fontFamily: 'monospace' }}>{spanX}×{spanY}</span>
          </div>
        )
      })()}
      {/* R2503: 정렬/분배 도구 (2+ 노드) */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const applyAlign = async (axis: 'x' | 'y', mode: 'min' | 'max' | 'center' | 'distrib') => {
          if (!sceneFile.root) return
          const ns: CCSceneNode[] = []
          function coll(n: CCSceneNode) { if (uuidSet.has(n.uuid)) ns.push(n); n.children.forEach(coll) }
          coll(sceneFile.root)
          if (ns.length < 2) return
          const vals = ns.map(n => ((n.position as Record<string, number>)[axis] ?? 0))
          const minV = Math.min(...vals), maxV = Math.max(...vals)
          const avgV = vals.reduce((a, b) => a + b, 0) / vals.length
          const sorted = [...ns].sort((a, b) => ((a.position as Record<string, number>)[axis] ?? 0) - ((b.position as Record<string, number>)[axis] ?? 0))
          const targetMap = new Map<string, number>()
          if (mode === 'min') ns.forEach(n => targetMap.set(n.uuid, minV))
          else if (mode === 'max') ns.forEach(n => targetMap.set(n.uuid, maxV))
          else if (mode === 'center') ns.forEach(n => targetMap.set(n.uuid, avgV))
          else if (mode === 'distrib') {
            sorted.forEach((n, i) => {
              const frac = sorted.length === 1 ? minV : minV + (maxV - minV) * i / (sorted.length - 1)
              targetMap.set(n.uuid, frac)
            })
          }
          await patchNodes(n => {
            const pos = { ...((n.position as object) ?? {}) } as Record<string, number>
            pos[axis] = Math.round(targetMap.get(n.uuid)!)
            return { ...n, position: pos as CCSceneNode['position']}
          }, `patch`)
        }
        const btnS: React.CSSProperties = { fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34d399', lineHeight: 1.6 }
        return (
          <div style={{ marginBottom: 6, padding: '3px 6px', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: '#34d399', fontWeight: 600, marginBottom: 3 }}>{t('batch.misc.j_align_r2503', '⊟ 정렬 (R2503)')}</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <span style={btnS} onClick={() => applyAlign('x', 'min')} title={t('batch.misc.t_x_align', 'X 최솟값 정렬')}>◁ L</span>
              <span style={btnS} onClick={() => applyAlign('x', 'center')} title={t('batch.misc.t_x_align2', 'X 중앙 정렬')}>↔ CX</span>
              <span style={btnS} onClick={() => applyAlign('x', 'max')} title={t('batch.misc.t_x_align3', 'X 최댓값 정렬')}>▷ R</span>
              <span style={btnS} onClick={() => applyAlign('x', 'distrib')} title={t('batch.misc.t_x_equal_distrib', 'X 균등 분배')}>⇹ DH</span>
              <span style={{ width: 1, background: 'rgba(52,211,153,0.2)', margin: '0 1px' }} />
              <span style={btnS} onClick={() => applyAlign('y', 'max')} title={t('batch.misc.t_y_align', 'Y 최댓값 정렬')}>△ T</span>
              <span style={btnS} onClick={() => applyAlign('y', 'center')} title={t('batch.misc.t_y_align2', 'Y 중앙 정렬')}>↕ CY</span>
              <span style={btnS} onClick={() => applyAlign('y', 'min')} title={t('batch.misc.t_y_align3', 'Y 최솟값 정렬')}>▽ B</span>
              <span style={btnS} onClick={() => applyAlign('y', 'distrib')} title={t('batch.misc.t_y_equal_distrib', 'Y 균등 분배')}>⇳ DV</span>
            </div>
          </div>
        )
      })()}
      {/* R2014: 노드 size 일괄 설정 */}
      {(() => {
        const applyNodeSize = async (w: number, h: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            // CC2.x uses size field; CC3.x uses UITransform component
            const newSize = { width: w, height: h }
            const components = n.components.map(c => c.type === 'cc.UITransform' ? { ...c, props: { ...c.props, contentSize: newSize, _contentSize: newSize } } : c)
            return { ...n, components }
          }, `size=${w}×${h} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Size</span>
            {([[100,100],[200,100],[100,200],[200,200],[300,100]] as const).map(([w, h]) => (
              <span key={`${w}x${h}`} onClick={() => applyNodeSize(w, h)} title={`size=${w}×${h}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{w}×{h}</span>
            ))}
          </div>
        )
      })()}
      {/* R2348: 선택 노드 균등 배분 (distribute evenly) — 3개 이상 */}
      {uuids.length >= 3 && sceneFile.root && (() => {
        const distNodes: CCSceneNode[] = []
        function collectDist(n: CCSceneNode) { if (uuidSet.has(n.uuid)) distNodes.push(n); n.children.forEach(collectDist) }
        collectDist(sceneFile.root)
        if (distNodes.length < 3) return null
        const applyDistribute = async (axis: 'x' | 'y') => {
          if (!sceneFile.root) return
          const sorted = [...distNodes].sort((a, b) => {
            const pa = a.position as { x: number; y: number }
            const pb = b.position as { x: number; y: number }
            return pa[axis] - pb[axis]
          })
          const first = (sorted[0].position as { x: number; y: number })[axis]
          const last = (sorted[sorted.length - 1].position as { x: number; y: number })[axis]
          const step = (last - first) / (sorted.length - 1)
          const posMap = new Map<string, number>()
          sorted.forEach((n, i) => posMap.set(n.uuid, first + step * i))
          await patchNodes(n => {
            const newVal = posMap.get(n.uuid)
            if (newVal == null) return n
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, [axis]: Math.round(newVal) }}
          }, `distribute ${axis.toUpperCase()} (${distNodes.length}개, step=${Math.round(step)})`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Dist</span>
            {([['X →', 'x'], ['Y ↕', 'y']] as [string, 'x' | 'y'][]).map(([label, axis]) => (
              <span key={axis} onClick={() => applyDistribute(axis)} title={`${axis.toUpperCase()}축 균등 배분 (첫/끝 노드 고정, ${distNodes.length}개)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', userSelect: 'none', background: 'rgba(167,139,250,0.05)' }}>{label}</span>
            ))}
            <span style={{ fontSize: 8, color: '#555' }}>{distNodes.length}{t('batch.misc.j_count', '개')}</span>
          </div>
        )
      })()}
      {/* R2733: 크기 고려 균등 간격 (size-aware even gap) */}
      {uuids.length >= 3 && sceneFile.root && (() => {
        const gapNodes: CCSceneNode[] = []
        function collectGap(n: CCSceneNode) { if (uuidSet.has(n.uuid)) gapNodes.push(n); n.children.forEach(collectGap) }
        collectGap(sceneFile.root)
        if (gapNodes.length < 3) return null
        const bsP: React.CSSProperties = { fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', userSelect: 'none', background: 'rgba(251,191,36,0.05)' }
        const applyEvenGap = async (axis: 'x' | 'y', mode: 'auto' | 'fixed') => {
          if (!sceneFile.root) return
          const sorted = [...gapNodes].sort((a, b) => {
            const pa = a.position as { x: number; y: number }
            const pb = b.position as { x: number; y: number }
            return axis === 'y' ? pb[axis] - pa[axis] : pa[axis] - pb[axis]
          })
          const getSize = (n: CCSceneNode) => axis === 'x' ? (n.size?.x ?? 0) : (n.size?.y ?? 0)
          const getAnchor = (n: CCSceneNode) => axis === 'x' ? (n.anchor?.x ?? 0.5) : (n.anchor?.y ?? 0.5)
          let gap: number
          let firstEdge: number
          if (mode === 'auto') {
            const totalSize = sorted.reduce((s, n) => s + getSize(n), 0)
            const first = sorted[0], last = sorted[sorted.length - 1]
            const firstPos = (first.position as { x: number; y: number })[axis]
            const lastPos = (last.position as { x: number; y: number })[axis]
            const fe = axis === 'y' ? firstPos - getSize(first) * getAnchor(first) : firstPos - getSize(first) * getAnchor(first)
            const le = axis === 'y' ? lastPos + getSize(last) * (1 - getAnchor(last)) : lastPos + getSize(last) * (1 - getAnchor(last))
            const span = le - fe
            gap = (span - totalSize) / (sorted.length - 1)
            firstEdge = fe
          } else {
            gap = evenSpacing
            const first = sorted[0]
            const firstPos = (first.position as { x: number; y: number })[axis]
            firstEdge = firstPos - getSize(first) * getAnchor(first)
          }
          let cursor = firstEdge
          const posMap = new Map<string, number>()
          for (const n of sorted) {
            const sz = getSize(n)
            const ak = getAnchor(n)
            posMap.set(n.uuid, cursor + sz * ak)
            cursor += sz + gap
          }
          await patchNodes(n => {
            const newVal = posMap.get(n.uuid)
            if (newVal == null) return n
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, [axis]: Math.round(newVal) } }
          }, `evenGap ${axis.toUpperCase()} ${mode} (${gapNodes.length}개, gap=${Math.round(gap)})`)
        }
        return (
          <div style={{ marginBottom: 4, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>{t('batch.misc.j_eqgap', '균등갭')}</span>
            <input type="number" value={evenSpacing} onChange={e => setEvenSpacing(Number(e.target.value))}
              style={mkNiS(44)} title={t('batch.misc.t_fixed_px', '고정 갭 px')} min={0} />
            <span onClick={() => applyEvenGap('x', 'auto')} style={bsP} title={t('batch.misc.t_x_dir_auto_equal_gap_r2733', 'X 방향 자동 균등 간격 (R2733)')}>Auto H</span>
            <span onClick={() => applyEvenGap('y', 'auto')} style={bsP} title={t('batch.misc.t_y_dir_auto_equal_gap_r2733', 'Y 방향 자동 균등 간격 (R2733)')}>Auto V</span>
            <span onClick={() => applyEvenGap('x', 'fixed')} style={bsP} title={t('batch.misc.t_x_dir_fixed_r2733', 'X 방향 고정 갭 (R2733)')}>Fix H</span>
            <span onClick={() => applyEvenGap('y', 'fixed')} style={bsP} title={t('batch.misc.t_y_dir_fixed_r2733', 'Y 방향 고정 갭 (R2733)')}>Fix V</span>
          </div>
        )
      })()}
      {/* R2695: 위치 선형 그라데이션 */}
      {uuids.length >= 2 && sceneFile?.root && (() => {
        const bsP: React.CSSProperties = { fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', userSelect: 'none', background: 'rgba(251,191,36,0.05)' }
        const applyPosGrad = async (axis: 'x' | 'y') => {
          if (!sceneFile.root) return
          const gradNodes: CCSceneNode[] = []
          function collectGrad(n: CCSceneNode) { if (uuidSet.has(n.uuid)) gradNodes.push(n); n.children.forEach(collectGrad) }
          collectGrad(sceneFile.root)
          const sorted = [...gradNodes].sort((a, b) => {
            const pa = a.position as { x: number; y: number }
            const pb = b.position as { x: number; y: number }
            return axis === 'y' ? pb[axis] - pa[axis] : pa[axis] - pb[axis]
          })
          const n = sorted.length
          const posMap = new Map<string, number>()
          for (let i = 0; i < n; i++) {
            const val = n === 1
              ? (posGradFrom + posGradTo) / 2
              : posGradFrom + (posGradTo - posGradFrom) * i / (n - 1)
            posMap.set(sorted[i].uuid, Math.round(val))
          }
          await patchNodes(node => {
            const newVal = posMap.get(node.uuid)
            if (newVal == null) return node
            const pos = node.position as { x: number; y: number; z?: number }
            return { ...node, position: { ...pos, [axis]: newVal } }
          }, `posGrad ${axis.toUpperCase()} ${posGradFrom}→${posGradTo} (${n}개)`)
        }
        return (
          <div style={{ marginBottom: 4, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t('batch.misc.j_posgradation_r2695', '위치그라데이션 (R2695)')}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>from</span>
            <input type="number" value={posGradFrom} onChange={e => setPosGradFrom(Number(e.target.value))}
              style={mkNiS(44)} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>to</span>
            <input type="number" value={posGradTo} onChange={e => setPosGradTo(Number(e.target.value))}
              style={mkNiS(44)} />
            <span onClick={() => applyPosGrad('x')} style={bsP} title={t('batch.misc.t_x_dir_pos', 'X 방향 위치 선형 보간')}>→X</span>
            <span onClick={() => applyPosGrad('y')} style={bsP} title={t('batch.misc.t_y_dir_pos', 'Y 방향 위치 선형 보간')}>↑Y</span>
          </div>
        )
      })()}
      {/* R2533: 선택 노드 가장자리 정렬 (edge alignment: L/R/T/B/CX/CY) */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const alnNodes: CCSceneNode[] = []
        function collectAln(n: CCSceneNode) { if (uuidSet.has(n.uuid)) alnNodes.push(n); n.children.forEach(collectAln) }
        collectAln(sceneFile.root!)
        if (alnNodes.length < 2) return null
        type AlnMode = 'L' | 'R' | 'T' | 'B' | 'CX' | 'CY'
        const applyAlign = async (mode: AlnMode) => {
          if (!sceneFile.root) return
          // CC 좌표: y 위가 +. left=pos.x-w*ax, right=pos.x+w*(1-ax), top=pos.y+h*(1-ay), bottom=pos.y-h*ay
          const bounds = alnNodes.map(n => {
            const pos = n.position as { x: number; y: number }
            const w = n.size?.x ?? 0, h = n.size?.y ?? 0
            const ax = n.anchor?.x ?? 0.5, ay = n.anchor?.y ?? 0.5
            return { uuid: n.uuid, L: pos.x - w * ax, R: pos.x + w * (1 - ax), T: pos.y + h * (1 - ay), B: pos.y - h * ay, ax, ay, w, h }
          })
          const minL = Math.min(...bounds.map(b => b.L))
          const maxR = Math.max(...bounds.map(b => b.R))
          const maxT = Math.max(...bounds.map(b => b.T))
          const minB = Math.min(...bounds.map(b => b.B))
          const midX = (minL + maxR) / 2
          const midY = (minB + maxT) / 2
          const newPosMap = new Map<string, { x: number; y: number }>()
          for (const b of bounds) {
            const pos = alnNodes.find(n => n.uuid === b.uuid)!.position as { x: number; y: number }
            let nx = pos.x, ny = pos.y
            if (mode === 'L') nx = minL + b.w * b.ax
            else if (mode === 'R') nx = maxR - b.w * (1 - b.ax)
            else if (mode === 'T') ny = maxT - b.h * (1 - b.ay)
            else if (mode === 'B') ny = minB + b.h * b.ay
            else if (mode === 'CX') nx = midX
            else if (mode === 'CY') ny = midY
            newPosMap.set(b.uuid, { x: Math.round(nx), y: Math.round(ny) })
          }
          await patchNodes(n => {
            const np = newPosMap.get(n.uuid)
            if (!np) return n
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, x: np.x, y: np.y }}
          }, `align ${mode} (${alnNodes.length}개)`)
        }
        const modes: [AlnMode, string][] = [['L','⊢L'],['R','R⊣'],['T','⊤T'],['B','B⊥'],['CX','↔X'],['CY','↕Y']]
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Align</span>
            {modes.map(([mode, label]) => (
              <span key={mode} onClick={() => applyAlign(mode)}
                title={`${mode === 'L' ? t('batch.misc.s_label', '왼쪽 가장자리') : mode === 'R' ? t('batch.misc.s_label2', '오른쪽 가장자리') : mode === 'T' ? t('batch.misc.s_label3', '위 가장자리') : mode === 'B' ? t('batch.misc.s_label4', '아래 가장자리') : mode === 'CX' ? t('batch.misc.s_label5', '수평 중앙') : t('batch.misc.s_label6', '수직 중앙')} 정렬 (R2533)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', userSelect: 'none', background: 'rgba(251,146,60,0.05)' }}>{label}</span>
            ))}
            <span style={{ fontSize: 8, color: '#555' }}>{alnNodes.length}{t('batch.misc.j_count', '개')}</span>
          </div>
        )
      })()}
      {/* R2561: 선택 노드 위치 역전 (X축/Y축 순서 뒤집기) */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const revNodes: CCSceneNode[] = []
        function collectRev(n: CCSceneNode) { if (uuidSet.has(n.uuid)) revNodes.push(n); n.children.forEach(collectRev) }
        collectRev(sceneFile.root!)
        if (revNodes.length < 2) return null
        const applyReverse = async (axis: 'x' | 'y') => {
          if (!sceneFile.root) return
          const sorted = [...revNodes].sort((a, b) => {
            const pa = a.position as { x: number; y: number }
            const pb = b.position as { x: number; y: number }
            return pa[axis] - pb[axis]
          })
          const positions = sorted.map(n => (n.position as { x: number; y: number })[axis])
          const newPosMap = new Map<string, number>()
          sorted.forEach((n, i) => newPosMap.set(n.uuid, positions[positions.length - 1 - i]))
          await patchNodes(n => {
            const np = newPosMap.get(n.uuid)
            if (np === undefined) return n
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, [axis]: np }}
          }, `reverse ${axis.toUpperCase()} (${revNodes.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_reverse_r2561', '역전 (R2561)')}</span>
            <span onClick={() => applyReverse('x')} title={t('batch.misc.t_x_pos_invert_arrange_r2561', 'X축 위치 순서 뒤집기 — 좌우 반전 배치 (R2561)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', userSelect: 'none', background: 'rgba(251,146,60,0.05)' }}>⇄X</span>
            <span onClick={() => applyReverse('y')} title={t('batch.misc.t_y_pos_invert_arrange_r2561', 'Y축 위치 순서 뒤집기 — 상하 반전 배치 (R2561)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', userSelect: 'none', background: 'rgba(251,146,60,0.05)' }}>⇅Y</span>
          </div>
        )
      })()}
      {/* R2575: 선택 노드 스케일 반전 (↔H / ↕V) */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const flipNodes: CCSceneNode[] = []
        function collectFlip(n: CCSceneNode) { if (uuidSet.has(n.uuid)) flipNodes.push(n); n.children.forEach(collectFlip) }
        collectFlip(sceneFile.root!)
        if (flipNodes.length === 0) return null
        const applyFlip = (axis: 'x' | 'y') => patchNodes(n => {
          const sc = n.scale as { x: number; y: number; z?: number }
          return { ...n, scale: { ...sc, [axis]: -(sc[axis] ?? 1) } }
        }, `scale${axis.toUpperCase()} flip (${flipNodes.length}개)`)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_invert_r2575', '반전 (R2575)')}</span>
            <span onClick={() => applyFlip('x')} title={t('batch.misc.t_scalex_invert_mirror_r2575', 'scaleX 부호 반전 — 좌우 미러 (R2575)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', userSelect: 'none', background: 'rgba(167,139,250,0.05)' }}>↔H</span>
            <span onClick={() => applyFlip('y')} title={t('batch.misc.t_scaley_invert_mirror_r2575', 'scaleY 부호 반전 — 상하 미러 (R2575)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', userSelect: 'none', background: 'rgba(167,139,250,0.05)' }}>↕V</span>
          </div>
        )
      })()}
      {/* R2587: 선택 노드 위치 대칭 이동 (바운딩박스 중심 기준) */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const selNodes: CCSceneNode[] = []
        function collectMirror(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selNodes.push(n); n.children.forEach(collectMirror) }
        collectMirror(sceneFile.root!)
        if (selNodes.length < 2) return null
        const xs = selNodes.map(n => (n.position as { x: number }).x)
        const ys = selNodes.map(n => (n.position as { y: number }).y)
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2
        const applyMirror = async (axis: 'x' | 'y') => {
          if (!sceneFile.root) return
          const center = axis === 'x' ? cx : cy
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, [axis]: 2 * center - pos[axis] }}
          }, `patch`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_sym_r2587', '대칭 (R2587)')}</span>
            <span onClick={() => applyMirror('x')} title={t('batch.misc.t_x_sym_move_ref_invert_r2587', 'X축 대칭 이동 — 바운딩박스 중심 기준 좌우 반전 (R2587)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none', background: 'rgba(52,211,153,0.05)' }}>⟺X</span>
            <span onClick={() => applyMirror('y')} title={t('batch.misc.t_y_sym_move_ref_invert_r2587', 'Y축 대칭 이동 — 바운딩박스 중심 기준 상하 반전 (R2587)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none', background: 'rgba(52,211,153,0.05)' }}>⟺Y</span>
          </div>
        )
      })()}
      {/* R2589: 정확히 2개 노드 선택 시 위치 교환 (⇄) */}
      {uuids.length === 2 && sceneFile.root && (() => {
        const swapNodes: { uuid: string; pos: { x: number; y: number; z?: number } }[] = []
        function collectSwap(n: CCSceneNode) {
          if (uuidSet.has(n.uuid)) swapNodes.push({ uuid: n.uuid, pos: n.position as { x: number; y: number; z?: number } })
          n.children.forEach(collectSwap)
        }
        collectSwap(sceneFile.root!)
        if (swapNodes.length !== 2) return null
        const applySwap = async () => {
          if (!sceneFile.root) return
          const [a, b] = swapNodes
          function patch(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(patch)
            if (n.uuid === a.uuid) return { ...n, position: { ...b.pos }, children: ch }
            if (n.uuid === b.uuid) return { ...n, position: { ...a.pos }, children: ch }
            return { ...n, children: ch }
          }
          await saveScene(patch(sceneFile.root))
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_swap_r2589', '교환 (R2589)')}</span>
            <span onClick={applySwap} title={t('batch.misc.t_node_pos_position_swap_r2589', '두 노드의 위치(position) 교환 (R2589)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', userSelect: 'none', background: 'rgba(251,191,36,0.05)' }}>{t('batch.misc.j_pos', '⇄ 위치')}</span>
          </div>
        )
      })()}
      {/* R2611: 선택 노드 위치 셔플 (≥3개) */}
      {uuids.length >= 3 && sceneFile.root && (() => {
        const applyPosShuffle = async () => {
          if (!sceneFile.root) return
          const selNodes: CCSceneNode[] = []
          function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selNodes.push(n); n.children.forEach(collect) }
          collect(sceneFile.root)
          const positions = selNodes.map(n => ({ ...(n.position as { x: number; y: number; z?: number }) }))
          for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]]
          }
          const posMap = new Map(selNodes.map((n, i) => [n.uuid, positions[i]]))
          await patchNodes(n => {
            return { ...n, position: { ...(n.position as object), ...posMap.get(n.uuid)! }}
          }, `위치 셔플 (${selNodes.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_shuffle_r2611', '셔플 (R2611)')}</span>
            <span onClick={applyPosShuffle} title={`${uuids.length}개 노드 위치를 무작위 교환 (R2611)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(129,140,248,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(129,140,248,0.05)' }}>{t('batch.misc.j_pos2', '⇌ 위치')}</span>
          </div>
        )
      })()}
      {/* R2632: 선택 노드 위치 X/Y 미러 — 그룹 중심 기준 반전 */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const applyMirror = async (axis: 'x' | 'y') => {
          if (!sceneFile.root) return
          const selNodes: { uuid: string; pos: { x: number; y: number; z?: number } }[] = []
          function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selNodes.push({ uuid: n.uuid, pos: n.position as { x: number; y: number; z?: number } }); n.children.forEach(collect) }
          collect(sceneFile.root)
          if (selNodes.length < 2) return
          const avgX = selNodes.reduce((s, n) => s + n.pos.x, 0) / selNodes.length
          const avgY = selNodes.reduce((s, n) => s + n.pos.y, 0) / selNodes.length
          const posMap = new Map<string, { x: number; y: number; z?: number }>()
          selNodes.forEach(({ uuid, pos }) => {
            posMap.set(uuid, {
              x: axis === 'x' ? avgX * 2 - pos.x : pos.x,
              y: axis === 'y' ? avgY * 2 - pos.y : pos.y,
              z: pos.z,
            })
          })
          function patch(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(patch)
            const p = posMap.get(n.uuid)
            if (!p) return { ...n, children: ch }
            return { ...n, position: { ...n.position, ...p }, children: ch }
          }
          await saveScene(patch(sceneFile.root))
          setBatchMsg(`✓ 위치 ${axis.toUpperCase()} 미러 (${selNodes.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_mirror_r2632', '미러 (R2632)')}</span>
            <span onClick={() => applyMirror('x')} title={t('batch.misc.t_select_node_x_pos_ref_invert_r2632', '선택 노드 X 위치를 그룹 중심 기준 반전 (R2632)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(244,114,182,0.4)', color: '#f472b6', userSelect: 'none', background: 'rgba(244,114,182,0.05)' }}>⇔ X</span>
            <span onClick={() => applyMirror('y')} title={t('batch.misc.t_select_node_y_pos_ref_invert_r2632', '선택 노드 Y 위치를 그룹 중심 기준 반전 (R2632)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(244,114,182,0.4)', color: '#f472b6', userSelect: 'none', background: 'rgba(244,114,182,0.05)' }}>⇕ Y</span>
          </div>
        )
      })()}
      {/* R2639: 원형 배치 */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const applyCircleArrange = async () => {
          if (!sceneFile.root) return
          const count = uuids.length
          const collected: CCSceneNode[] = []
          function collect(n: CCSceneNode) {
            if (uuidSet.has(n.uuid)) collected.push(n)
            n.children.forEach(collect)
          }
          collect(sceneFile.root)
          if (collected.length === 0) return
          const cx = collected.reduce((s, n) => s + ((n.position as { x: number }).x ?? 0), 0) / count
          const cy = collected.reduce((s, n) => s + ((n.position as { y: number }).y ?? 0), 0) / count
          let idx = 0
          await patchNodes(n => {
            const angle = (idx / count) * Math.PI * 2 - Math.PI / 2
            const nx = Math.round(cx + circleRadius * Math.cos(angle))
            const ny = Math.round(cy + circleRadius * Math.sin(angle))
            idx++
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, x: nx, y: ny }}
          }, `원형 배치 r=${circleRadius} (${count}개)`)
        }
        const niS = mkNiS(46)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_circlearrange_r2639', '원형배치 (R2639)')}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>r=</span>
            <input type="number" value={circleRadius} min={10} step={10} onChange={e => setCircleRadius(parseInt(e.target.value) || 200)} style={niS} title={t('batch.misc.t_cc', '원 반지름 (CC 단위)')} />
            <span onClick={applyCircleArrange}
              title={`선택된 ${uuids.length}개 노드를 반지름 ${circleRadius}인 원형으로 균등 배치 (R2639)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.05)' }}
            >{t('batch.misc.j_arrange', '○배치')}</span>
          </div>
        )
      })()}
      {/* R2643: 격자 배치 */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const applyGridArrange = async () => {
          if (!sceneFile.root) return
          const count = uuids.length
          const collected: CCSceneNode[] = []
          function collect(n: CCSceneNode) {
            if (uuidSet.has(n.uuid)) collected.push(n)
            n.children.forEach(collect)
          }
          collect(sceneFile.root)
          if (collected.length === 0) return
          const startX = (collected[0].position as { x: number }).x
          const startY = (collected[0].position as { y: number }).y
          const cols = Math.max(1, gridCols)
          const posMap = new Map<string, { x: number; y: number }>()
          collected.forEach((n, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            posMap.set(n.uuid, { x: startX + col * gridSpacingX, y: startY - row * gridSpacingY })
          })
          function patch(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(patch)
            const p = posMap.get(n.uuid)
            if (!p) return { ...n, children: ch }
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, x: Math.round(p.x), y: Math.round(p.y) }, children: ch }
          }
          await saveScene(patch(sceneFile.root))
          setBatchMsg(`✓ 격자 배치 ${cols}열 (${count}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        const niS = mkNiS(34, '1px 2px')
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_gridarrange_r2643', '격자배치 (R2643)')}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t('batch.misc.j_label', '열')}</span>
            <input type="number" value={gridCols} min={1} max={20} step={1} onChange={e => setGridCols(parseInt(e.target.value) || 3)} style={niS} title={t('batch.misc.t_label', '열 수')} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>dx</span>
            <input type="number" value={gridSpacingX} step={10} onChange={e => setGridSpacingX(parseInt(e.target.value) || 150)} style={niS} title={t('batch.misc.t_gap', '가로 간격')} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>dy</span>
            <input type="number" value={gridSpacingY} step={10} onChange={e => setGridSpacingY(parseInt(e.target.value) || 150)} style={niS} title={t('batch.misc.t_gap2', '세로 간격')} />
            <span onClick={applyGridArrange}
              title={`선택된 ${uuids.length}개 노드를 ${gridCols}열 격자로 배치 (R2643)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }}
            >{t('batch.misc.j_arrange2', '⊞배치')}</span>
          </div>
        )
      })()}
      {/* R2582: 선택 노드 형제 위치 순서로 Z-order 재정렬 */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const applySortByPos = async (axis: 'x' | 'y') => {
          if (!sceneFile.root) return
          // 선택 노드의 부모별로 그룹화
          const parentMap = new Map<string, CCSceneNode[]>()
          function findParents(n: CCSceneNode) {
            const selectedChildren = n.children.filter(c => uuidSet.has(c.uuid))
            if (selectedChildren.length > 0) parentMap.set(n.uuid, n.children)
            n.children.forEach(findParents)
          }
          findParents(sceneFile.root!)
          if (parentMap.size === 0) return
          function walkSort(n: CCSceneNode): CCSceneNode {
            const children = n.children.map(walkSort)
            if (!parentMap.has(n.uuid)) return { ...n, children }
            const selected = children.filter(c => uuidSet.has(c.uuid))
            selected.sort((a, b) => {
              const pa = a.position as { x: number; y: number }
              const pb = b.position as { x: number; y: number }
              return axis === 'x' ? pa.x - pb.x : pa.y - pb.y
            })
            const result: CCSceneNode[] = [...children]
            const indices = children.map((c, i) => uuidSet.has(c.uuid) ? i : -1).filter(i => i >= 0)
            indices.forEach((idx, i) => { result[idx] = selected[i] })
            return { ...n, children: result }
          }
          await saveScene(walkSort(sceneFile.root!))
          setBatchMsg(`✓ ${axis.toUpperCase()}축 위치 순 Z-order 정렬 — R2582`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Z-sort (R2582)</span>
            <span onClick={() => applySortByPos('x')} title={t('batch.misc.t_x_pos_z_order_align_r2582', 'X축 위치 순으로 형제 Z-order 재정렬 (R2582)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.05)' }}>X↗</span>
            <span onClick={() => applySortByPos('y')} title={t('batch.misc.t_y_pos_z_order_align_r2582', 'Y축 위치 순으로 형제 Z-order 재정렬 (R2582)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.05)' }}>Y↗</span>
          </div>
        )
      })()}
      {/* R2653: Z-order 최전면/최후면 이동 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyZMove = async (dir: 'front' | 'back') => {
          if (!sceneFile.root) return
          function patch(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(patch)
            const selCh = ch.filter(c => uuidSet.has(c.uuid))
            if (selCh.length === 0) return { ...n, children: ch }
            const others = ch.filter(c => !uuidSet.has(c.uuid))
            const result = dir === 'front' ? [...others, ...selCh] : [...selCh, ...others]
            return { ...n, children: result }
          }
          await saveScene(patch(sceneFile.root))
          setBatchMsg(`✓ ${dir === 'front' ? t('batch.misc.s_label7', '최전면') : t('batch.misc.s_label8', '최후면')} 이동 (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_zmove_r2653', 'Z이동 (R2653)')}</span>
            <span onClick={() => applyZMove('front')} title={t('batch.misc.t_select_node_move_r2653', '선택 노드를 형제 중 최전면(맨 뒤 배열)으로 이동 (R2653)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.05)' }}>{t('batch.misc.j_label2', '▲맨앞')}</span>
            <span onClick={() => applyZMove('back')} title={t('batch.misc.t_select_node_move_r26532', '선택 노드를 형제 중 최후면(맨 앞 배열)으로 이동 (R2653)')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.05)' }}>{t('batch.misc.j_label3', '▼맨뒤')}</span>
          </div>
        )
      })()}
      {/* R2649: 선택 노드 복제 (offset 후 형제로 추가) */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyDuplicate = async () => {
          if (!sceneFile.root) return
          function deepClone(n: CCSceneNode, dx: number, dy: number, topLevel: boolean): CCSceneNode {
            const newUuid = typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `clone-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
            const pos = n.position as { x: number; y: number; z?: number }
            return {
              ...n,
              uuid: newUuid,
              name: `${n.name}_copy`,
              _rawIndex: undefined,
              position: topLevel ? { ...pos, x: pos.x + dx, y: pos.y + dy } : pos,
              components: n.components.map(c => ({ ...c, _rawIndex: undefined })),
              children: n.children.map(c => deepClone(c, 0, 0, false)),
            }
          }
          function patch(n: CCSceneNode): CCSceneNode {
            const ch = n.children.map(patch)
            const selChildren = ch.filter(c => uuidSet.has(c.uuid))
            if (selChildren.length === 0) return { ...n, children: ch }
            const cloned = selChildren.map(c => deepClone(c, cloneOffsetX, cloneOffsetY, true))
            return { ...n, children: [...ch, ...cloned] }
          }
          await saveScene(patch(sceneFile.root))
          setBatchMsg(`✓ 복제 +${cloneOffsetX},${cloneOffsetY} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_dup_r2649', '복제 (R2649)')}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>dx</span>
            <input type="number" value={cloneOffsetX} step={10} onChange={e => setCloneOffsetX(parseInt(e.target.value) || 0)} style={niS} title={t('batch.misc.t_dup_x_offset', '복제 X 오프셋')} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>dy</span>
            <input type="number" value={cloneOffsetY} step={10} onChange={e => setCloneOffsetY(parseInt(e.target.value) || 0)} style={niS} title={t('batch.misc.t_dup_y_offset', '복제 Y 오프셋')} />
            <span onClick={applyDuplicate}
              title={`선택 노드 복제 후 (${cloneOffsetX}, ${cloneOffsetY}) 오프셋 (R2649)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none' }}
            >{t('batch.misc.j_dup', '⎘복제')}</span>
          </div>
        )
      })()}
      {/* R2535: 선택 노드 스택 배치 (edge-to-edge stack X/Y + 간격) */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const stkNodes: CCSceneNode[] = []
        function collectStk(n: CCSceneNode) { if (uuidSet.has(n.uuid)) stkNodes.push(n); n.children.forEach(collectStk) }
        collectStk(sceneFile.root!)
        if (stkNodes.length < 2) return null
        const applyStack = async (axis: 'x' | 'y', gap: number) => {
          if (!sceneFile.root) return
          // sort by current position on axis
          const sorted = [...stkNodes].sort((a, b) => {
            const pa = a.position as { x: number; y: number }
            const pb = b.position as { x: number; y: number }
            return pa[axis] - pb[axis]
          })
          const newPosMap = new Map<string, { x: number; y: number }>()
          // first node stays; each subsequent node placed edge-to-edge
          if (axis === 'x') {
            let curRight = (() => {
              const n = sorted[0]; const pos = n.position as { x: number; y: number }
              return pos.x + (n.size?.x ?? 0) * (1 - (n.anchor?.x ?? 0.5))
            })()
            for (let i = 1; i < sorted.length; i++) {
              const n = sorted[i]; const w = n.size?.x ?? 0; const ax = n.anchor?.x ?? 0.5
              const nx = Math.round(curRight + gap + w * ax)
              const pos = n.position as { x: number; y: number }
              newPosMap.set(n.uuid, { x: nx, y: pos.y })
              curRight = nx + w * (1 - ax)
            }
          } else {
            // CC: y-up. Stack downward (decreasing y). top of node = pos.y + h*(1-ay)
            let curBottom = (() => {
              const n = sorted[sorted.length - 1]; const pos = n.position as { x: number; y: number }
              return pos.y - (n.size?.y ?? 0) * (n.anchor?.y ?? 0.5)
            })()
            for (let i = sorted.length - 2; i >= 0; i--) {
              const n = sorted[i]; const h = n.size?.y ?? 0; const ay = n.anchor?.y ?? 0.5
              const ny = Math.round(curBottom - gap - h * (1 - ay))
              const pos = n.position as { x: number; y: number }
              newPosMap.set(n.uuid, { x: pos.x, y: ny })
              curBottom = ny - h * ay
            }
          }
          await patchNodes(n => {
            const np = newPosMap.get(n.uuid)
            if (!np) return n
            const pos = n.position as { x: number; y: number; z?: number }
            return { ...n, position: { ...pos, x: np.x, y: np.y }}
          }, `stack ${axis.toUpperCase()} gap=${gap} (${sorted.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Stack</span>
            {(['x', 'y'] as const).map(axis => (
              [0, 4, 8].map(g => (
                <span key={`${axis}-${g}`} onClick={() => applyStack(axis, g)}
                  title={`${axis.toUpperCase()}축 스택 배치 (gap=${g}px) — 가장자리끼리 붙임 (R2535)`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none', background: 'rgba(52,211,153,0.05)' }}>{axis === 'x' ? '→' : '↓'}{g > 0 ? `+${g}` : ''}</span>
              ))
            ))}
            <span style={{ fontSize: 8, color: '#555' }}>{stkNodes.length}{t('batch.misc.j_count', '개')}</span>
          </div>
        )
      })()}
      {/* R2347: 선택 노드 위치 맞추기 (match position) */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const nodesOrdered: CCSceneNode[] = []
        function collectPos(n: CCSceneNode) { if (uuidSet.has(n.uuid)) nodesOrdered.push(n); n.children.forEach(collectPos) }
        collectPos(sceneFile.root)
        if (nodesOrdered.length < 2) return null
        const refNode = nodesOrdered[0]
        const refPos = refNode.position as { x: number; y: number }
        const applyMatchPos = async (axis: 'x' | 'y' | 'xy') => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const pos = n.position as { x: number; y: number; z?: number }
            const nx = axis === 'y' ? pos.x : refPos.x
            const ny = axis === 'x' ? pos.y : refPos.y
            return { ...n, position: { ...pos, x: nx, y: ny }}
          }, `matchPos(${axis.toUpperCase()}) → (${Math.round(refPos.x)}, ${Math.round(refPos.y)}) (${uuids.length - 1}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>MatchPos</span>
            <span style={{ fontSize: 8, color: '#555', marginRight: 2 }}>{refNode.name.slice(0, 6)}({Math.round(refPos.x)},{Math.round(refPos.y)})</span>
            {([['X', 'x'], ['Y', 'y'], ['XY', 'xy']] as [string, 'x' | 'y' | 'xy'][]).map(([label, axis]) => (
              <span key={axis} onClick={() => applyMatchPos(axis)} title={`첫 번째 노드(${refNode.name}) ${label} 위치로 맞추기`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(96,165,250,0.4)', color: '#60a5fa', userSelect: 'none', background: 'rgba(96,165,250,0.05)' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2346: 첫 번째 선택 노드 크기 맞추기 (match size) */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const nodes: CCSceneNode[] = []
        function collectOrder(n: CCSceneNode) { if (uuidSet.has(n.uuid)) nodes.push(n); n.children.forEach(collectOrder) }
        collectOrder(sceneFile.root)
        if (nodes.length < 2) return null
        const ref = nodes[0]
        const refW = Math.round(ref.size?.x ?? ref.size?.width ?? 100)
        const refH = Math.round(ref.size?.y ?? ref.size?.height ?? 100)
        const applyMatchSize = async (mode: 'both' | 'w' | 'h') => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const curW = n.size?.x ?? n.size?.width ?? 100
            const curH = n.size?.y ?? n.size?.height ?? 100
            const nw = mode === 'h' ? curW : refW
            const nh = mode === 'w' ? curH : refH
            const newSize = { width: nw, height: nh, x: nw, y: nh }
            const components = n.components.map(c => c.type === 'cc.UITransform' ? { ...c, props: { ...c.props, contentSize: { width: nw, height: nh }, _contentSize: { width: nw, height: nh } } } : c)
            return { ...n, components }
          }, `matchSize(${mode === 'both' ? `${refW}×${refH}` : mode === 'w' ? `W=${refW}` : `H=${refH}`}) (${uuids.length - 1}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Match</span>
            <span style={{ fontSize: 8, color: '#555', marginRight: 2 }}>{ref.name.slice(0, 8)}({refW}×{refH})</span>
            {([['W+H', 'both'], ['W', 'w'], ['H', 'h']] as [string, 'both' | 'w' | 'h'][]).map(([label, mode]) => (
              <span key={mode} onClick={() => applyMatchSize(mode)} title={`첫 번째 노드(${ref.name}) ${label}=${mode === 'w' ? refW : mode === 'h' ? refH : `${refW}×${refH}`} 맞추기`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none', background: 'rgba(52,211,153,0.05)' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2689: 크기 배수 스케일 (W×factor, H×factor) */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyScaleBySize = async (factor: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const sz = n.size as { x: number; y: number } | undefined
            if (!sz) return n
            const newSz = { x: Math.round(sz.x * factor), y: Math.round(sz.y * factor) }
            // UITransform contentSize도 함께 업데이트
            const comps = n.components.map(c => {
            if (c.type === 'cc.UITransform') return { ...c, props: { ...c.props, '_contentSize': { width: newSz.x, height: newSz.y } } }
            return c
            })
            return { ...n, size: newSz, components: comps}
          }, `크기 ×${factor} (${uuids.length}개)`)
        }
        const niS = mkNiS(44)
        const bs: React.CSSProperties = { fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(34,211,238,0.4)', color: '#22d3ee', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>{t('batch.misc.j_sizemult_r2689', '크기배수 (R2689)')}</span>
            <input type="number" value={sizeFactor} min={0.1} max={10} step={0.1} onChange={e => setSizeFactor(parseFloat(e.target.value) || 1)} style={niS} title={t('batch.misc.t_size_mult', '크기 배수')} />
            <span onClick={() => applyScaleBySize(sizeFactor)} title={`W/H ×${sizeFactor} (R2689)`} style={bs}>{t('batch.misc.j_enlarge', '확대')}</span>
            <span onClick={() => applyScaleBySize(1 / sizeFactor)} title={`W/H ×${(1/sizeFactor).toFixed(2)} 축소 (R2689)`} style={bs}>{t('batch.misc.j_label4', '축소')}</span>
          </div>
        )
      })()}
      {/* R2690: scale 절대값 지정 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyAbsScale = async () => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const sc = n.scale as { x: number; y: number; z?: number }
            return { ...n, scale: { ...sc, x: absScaleX, y: absScaleY }}
          }, `scale = (${absScaleX}, ${absScaleY}) (${uuids.length}개)`)
        }
        const niS = mkNiS(40)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>{t('batch.misc.j_scaleassign_r2690', 'scale지정 (R2690)')}</span>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>X</span>
            <input type="number" value={absScaleX} min={-10} max={10} step={0.1} onChange={e => setAbsScaleX(parseFloat(e.target.value) || 1)} style={niS} title={t('batch.misc.t_scalex', '절대 scaleX')} />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>Y</span>
            <input type="number" value={absScaleY} min={-10} max={10} step={0.1} onChange={e => setAbsScaleY(parseFloat(e.target.value) || 1)} style={niS} title={t('batch.misc.t_scaley', '절대 scaleY')} />
            <span onClick={applyAbsScale}
              title={`scale = (${absScaleX}, ${absScaleY}) (R2690)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#fb923c', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >{t('batch.misc.j_assign', '지정')}</span>
          </div>
        )
      })()}
      {/* R2659: 크기 W=H 정사각형화 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applySquarify = async (basis: 'max' | 'min' | 'w' | 'h') => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const cw = n.size?.x ?? n.size?.width ?? 100
            const ch2 = n.size?.y ?? n.size?.height ?? 100
            const side = basis === 'max' ? Math.max(cw, ch2) : basis === 'min' ? Math.min(cw, ch2) : basis === 'w' ? cw : ch2
            const newSize = { width: side, height: side, x: side, y: side }
            const components = n.components.map(c => c.type === 'cc.UITransform' ? { ...c, props: { ...c.props, contentSize: { width: side, height: side }, _contentSize: { width: side, height: side } } } : c)
            return { ...n, components }
          }, `정사각형화(${basis}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_square_r2659', '정사각 (R2659)')}</span>
            {([['max', '大'], ['min', '小'], [t('batch.misc.s_w_ref', 'W기준'), 'w'], [t('batch.misc.s_h_ref', 'H기준'), 'h']] as [string, 'max' | 'min' | 'w' | 'h'][]).map(([label, basis]) => (
              <span key={basis} onClick={() => applySquarify(basis)} title={`W=H 정사각형화 (${label}) (R2659)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2660: 가로세로 비율 적용 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyAspectRatio = async (basis: 'w' | 'h') => {
          if (!sceneFile.root || aspectRatioW <= 0 || aspectRatioH <= 0) return
          const ratio = aspectRatioW / aspectRatioH
          await patchNodes(n => {
            const cw = n.size?.x ?? n.size?.width ?? 100
            const cht = n.size?.y ?? n.size?.height ?? 100
            const nw = basis === 'w' ? cw : Math.round(cht * ratio)
            const nh = basis === 'h' ? cht : Math.round(cw / ratio)
            const newSize = { width: nw, height: nh, x: nw, y: nh }
            const components = n.components.map(c => c.type === 'cc.UITransform' ? { ...c, props: { ...c.props, contentSize: { width: nw, height: nh }, _contentSize: { width: nw, height: nh } } } : c)
            return { ...n, components }
          }, `${aspectRatioW}:${aspectRatioH} 비율 적용 (${basis.toUpperCase()}기준, ${uuids.length}개)`)
        }
        const niS = mkNiS(30, '1px 2px')
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>{t('batch.misc.j_ratio_r2660', '비율 (R2660)')}</span>
            <input type="number" value={aspectRatioW} min={1} step={1} onChange={e => setAspectRatioW(parseInt(e.target.value) || 16)} style={niS} title={t('batch.misc.t_ratio', '비율 가로')} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>:</span>
            <input type="number" value={aspectRatioH} min={1} step={1} onChange={e => setAspectRatioH(parseInt(e.target.value) || 9)} style={niS} title={t('batch.misc.t_ratio2', '비율 세로')} />
            <span onClick={() => applyAspectRatio('w')} title={`W 고정, H를 ${aspectRatioW}:${aspectRatioH} 비율로 조정 (R2660)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none' }}>{t('batch.misc.j_wref', 'W기준')}</span>
            <span onClick={() => applyAspectRatio('h')} title={`H 고정, W를 ${aspectRatioW}:${aspectRatioH} 비율로 조정 (R2660)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none' }}>{t('batch.misc.j_href', 'H기준')}</span>
          </div>
        )
      })()}
      {/* R2203: 노드 width 독립 일괄 설정 */}
      {(() => {
        const applyNodeWidth = async (w: number) => {
          await patchNodes(n => {
            const curH = n.size?.height ?? 100
            const newSize = { width: w, height: curH }
            const updComps = n.components.map(c => c.type === 'cc.UITransform' ? { ...c, props: { ...c.props, contentSize: newSize, _contentSize: newSize } } : c)
            return { ...n, size: newSize, components: updComps }
          }, `width=${w} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodW</span>
            {[50, 100, 150, 200, 300, 400, 500].map(v => (
              <span key={v} onClick={() => applyNodeWidth(v)} title={`width=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2203: 노드 height 독립 일괄 설정 */}
      {(() => {
        const applyNodeHeight = async (h: number) => {
          await patchNodes(n => {
            const curW = n.size?.width ?? 100
            const newSize = { width: curW, height: h }
            const updComps = n.components.map(c => c.type === 'cc.UITransform' ? { ...c, props: { ...c.props, contentSize: newSize, _contentSize: newSize } } : c)
            return { ...n, size: newSize, components: updComps }
          }, `height=${h} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodH</span>
            {[50, 100, 150, 200, 300, 400, 500].map(v => (
              <span key={v} onClick={() => applyNodeHeight(v)} title={`height=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2025: 노드 anchor preset 일괄 설정 */}
      {(() => {
        const applyNodeAnchor = async (ax: number, ay: number) => {
          await patchNodes(n => ({ ...n, anchor: { x: ax, y: ay } }), `anchor=(${ax},${ay}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>Anchor</span>
            {([['TL',0,1],['TC',0.5,1],['TR',1,1],['ML',0,0.5],['MC',0.5,0.5],['MR',1,0.5],['BL',0,0],['BC',0.5,0],['BR',1,0]] as [string,number,number][]).map(([label,ax,ay]) => (
              <span key={label} onClick={() => applyNodeAnchor(ax, ay)} title={`anchor=(${ax},${ay})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2628: 앵커 X 균등 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyAnchorXGrad = async () => {
          if (!sceneFile.root) return
          await patchOrdered((n, idx, total) => {
            const frac = total > 1 ? idx / (total - 1) : 0
            const ax = parseFloat((anchorXFrom + (anchorXTo - anchorXFrom) * frac).toFixed(3))
            return { ...n, anchor: { x: ax, y: n.anchor?.y ?? 0.5 } }
          }, `anchor.X ${anchorXFrom}→${anchorXTo} (${uuids.length}개)`)
        }
        const applyAnchorYGrad = async () => {
          if (!sceneFile.root) return
          await patchOrdered((n, idx, total) => {
            const frac = total > 1 ? idx / (total - 1) : 0
            const ay = parseFloat((anchorYFrom + (anchorYTo - anchorYFrom) * frac).toFixed(3))
            return { ...n, anchor: { x: n.anchor?.x ?? 0.5, y: ay } }
          }, `anchor.Y ${anchorYFrom}→${anchorYTo} (${uuids.length}개)`)
        }
        const niS = mkNiS(36)
        const btnS = mkBtnS('#fb923c')
        return (
          <>
            <div style={{ display: 'flex', gap: 3, marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#fb923c', flexShrink: 0 }}>{t('batch.misc.j_ancxdistrib_r2628', 'ancX분배 (R2628)')}</span>
              <input type="number" value={anchorXFrom} min={0} max={1} step={0.1} onChange={e => setAnchorXFrom(parseFloat(e.target.value) || 0)} style={niS} title={t('batch.misc.t_start_anchor_x', '시작 anchor.x')} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
              <input type="number" value={anchorXTo} min={0} max={1} step={0.1} onChange={e => setAnchorXTo(parseFloat(e.target.value) || 0)} style={niS} title={t('batch.misc.t_end_anchor_x', '끝 anchor.x')} />
              <span onClick={applyAnchorXGrad} title={`anchor.X ${anchorXFrom}→${anchorXTo} 균등 분배 (R2628)`} style={btnS}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >{t('batch.misc.j_distrib', '분배')}</span>
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#fb923c', flexShrink: 0 }}>{t('batch.misc.j_ancydistrib_r2628', 'ancY분배 (R2628)')}</span>
              <input type="number" value={anchorYFrom} min={0} max={1} step={0.1} onChange={e => setAnchorYFrom(parseFloat(e.target.value) || 0)} style={niS} title={t('batch.misc.t_start_anchor_y', '시작 anchor.y')} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
              <input type="number" value={anchorYTo} min={0} max={1} step={0.1} onChange={e => setAnchorYTo(parseFloat(e.target.value) || 0)} style={niS} title={t('batch.misc.t_end_anchor_y', '끝 anchor.y')} />
              <span onClick={applyAnchorYGrad} title={`anchor.Y ${anchorYFrom}→${anchorYTo} 균등 분배 (R2628)`} style={btnS}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#fb923c')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >{t('batch.misc.j_distrib', '분배')}</span>
            </div>
          </>
        )
      })()}
      {/* R2013: 노드 position 일괄 설정 (reset/preset) */}
      {(() => {
        const applyNodePos = async (x: number, y: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, position: { x, y, z: n.position?.z ?? 0 } }), `pos=(${x},${y}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Pos</span>
            <span onClick={() => applyNodePos(0, 0)} title="position=(0,0)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>0,0</span>
            <span onClick={() => applyNodePos(0, 100)} title="position=(0,100)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>0,100</span>
            <span onClick={() => applyNodePos(0, -100)} title="position=(0,-100)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>0,-100</span>
          </div>
        )
      })()}
      {/* R2204: 노드 posX 독립 일괄 설정 (Y 유지) */}
      {(() => {
        const applyNodePosX = async (x: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, position: { ...(n.position || { x: 0, y: 0, z: 0 }), x } }), `posX=${x} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodX</span>
            {[-200, -100, -50, 0, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyNodePosX(v)} title={`posX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2204: 노드 posY 독립 일괄 설정 (X 유지) */}
      {(() => {
        const applyNodePosY = async (y: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, position: { ...(n.position || { x: 0, y: 0, z: 0 }), y } }), `posY=${y} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodY</span>
            {[-200, -100, -50, 0, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyNodePosY(v)} title={`posY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2559: 선택 노드 JSON 내보내기 */}
      {sceneFile.root && uuids.length > 0 && (() => {
        const exportNodes = () => {
          if (!sceneFile.root) return
          const selected: CCSceneNode[] = []
          function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selected.push(n); n.children.forEach(collect) }
          collect(sceneFile.root)
          const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `nodes-export-${Date.now()}.json`
          a.click()
          URL.revokeObjectURL(url)
        }
        return (
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, paddingLeft: 52 }}>
            <span onClick={exportNodes} title={`선택 ${uuids.length}개 노드를 JSON 파일로 내보내기 (R2559)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', userSelect: 'none', background: 'rgba(52,211,153,0.05)' }}>⬇ JSON</span>
            {/* R2580: 선택 노드 이름 목록 클립보드 복사 */}
            <span
              onClick={() => {
                if (!sceneFile.root) return
                const names: string[] = []
                function collectNames(n: CCSceneNode) { if (uuidSet.has(n.uuid)) names.push(n.name); n.children.forEach(collectNames) }
                collectNames(sceneFile.root)
                navigator.clipboard.writeText(names.join('\n')).catch(() => {})
                setBatchMsg(`✓ 이름 ${names.length}개 복사 (R2580)`)
                setTimeout(() => setBatchMsg(null), 2000)
              }}
              title={t('batch.misc.t_select_node_name_copy_r2580', '선택 노드 이름 목록 복사 (줄바꿈 구분) — R2580')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none', background: 'rgba(148,163,184,0.05)' }}
            >{t('batch.misc.j_name', '📋 이름')}</span>
            {/* R2584: 선택 노드 UUID 목록 클립보드 복사 */}
            <span
              onClick={() => {
                if (!sceneFile.root) return
                const uuidList: string[] = []
                function collectUuids(n: CCSceneNode) { if (uuidSet.has(n.uuid)) uuidList.push(n.uuid); n.children.forEach(collectUuids) }
                collectUuids(sceneFile.root)
                navigator.clipboard.writeText(uuidList.join('\n')).catch(() => {})
                setBatchMsg(`✓ UUID ${uuidList.length}개 복사 (R2584)`)
                setTimeout(() => setBatchMsg(null), 2000)
              }}
              title={t('batch.misc.t_select_node_uuid_copy_r2584', '선택 노드 UUID 목록 복사 (줄바꿈 구분) — R2584')}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.05)' }}
            >📋 UUID</span>
          </div>
        )
      })()}
      {/* R2570: 자동 그리드 배치 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        return (
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, paddingLeft: 52, flexWrap: 'wrap' }}>
            {([{ label: t('batch.misc.s_2', '⊞2열'), cols: 2 }, { label: t('batch.misc.s_3', '⊞3열'), cols: 3 }, { label: '⊞√N', cols: 0 }] as { label: string; cols: number }[]).map(({ label, cols: colsArg }) => (
              <span
                key={label}
                title={`선택 노드를 ${colsArg === 0 ? 'sqrt(N)' : colsArg}열 그리드로 배치 (R2570)`}
                onClick={async () => {
                  if (!sceneFile.root) return
                  const nodes: CCSceneNode[] = []
                  function collectG(n: CCSceneNode) { if (uuidSet.has(n.uuid)) nodes.push(n); n.children.forEach(collectG) }
                  collectG(sceneFile.root)
                  if (nodes.length < 2) return
                  const cols = colsArg === 0 ? Math.ceil(Math.sqrt(nodes.length)) : colsArg
                  const gapX = Math.max((nodes[0]?.size?.x ?? 100) + 10, 20)
                  const gapY = Math.max((nodes[0]?.size?.y ?? 100) + 10, 20)
                  function applyGrid(n: CCSceneNode): CCSceneNode {
                    const children = n.children.map(applyGrid)
                    const idx = nodes.findIndex(x => x.uuid === n.uuid)
                    if (idx === -1) return { ...n, children }
                    const col = idx % cols, row = Math.floor(idx / cols)
                    const pos = n.position as { x: number; y: number; z?: number }
                    return { ...n, position: { ...pos, x: col * gapX, y: -row * gapY }, children }
                  }
                  const result = await saveScene(applyGrid(sceneFile.root))
                  setBatchMsg(result.success ? `✓ 그리드 배치 ${cols}열 (${nodes.length}개)` : `✗ 오류`)
                  setTimeout(() => setBatchMsg(null), 2000)
                }}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')} onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
              >{label}</span>
            ))}
          </div>
        )
      })()}

      {/* R2500~R2725: 선택 유틸리티 (misc-selection.tsx로 분리) */}
      <MiscSelectionTools
        uuids={uuids} uuidSet={uuidSet} sceneFile={sceneFile}
        setBatchMsg={setBatchMsg} onMultiSelectChange={onMultiSelectChange}
        lockedUuids={lockedUuids} onSetLockedUuids={onSetLockedUuids}
        mkBtnS={mkBtnS}
      />
    </div>
  )
}
