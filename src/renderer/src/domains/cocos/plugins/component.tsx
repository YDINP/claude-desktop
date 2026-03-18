import React, { useState, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'

export function ComponentPlugin({ nodes, sceneFile, saveScene, onMultiSelectChange }: BatchPluginProps) {
  const uuids = nodes.map(n => n.uuid)
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes, patchComponents, patchOrdered } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  // R2505: 컴포넌트 일괄 추가
  const [batchAddComp, setBatchAddComp] = useState<string>('')
  // R2506: 컴포넌트 일괄 제거
  const [batchRemComp, setBatchRemComp] = useState<string>('')
  // R2491: 범용 컴포넌트 prop 일괄 편집
  const [genericCompType, setGenericCompType] = useState<string>('')
  const [genericPropName, setGenericPropName] = useState<string>('')
  const [genericPropVal, setGenericPropVal] = useState<string>('')
  // R2706: 단색 Sprite 교체
  const [batchSolidColor, setBatchSolidColor] = useState<string>('#ffffff')
  // R2712: Label fontSize 사용자 정의 입력
  const [customFontSize, setCustomFontSize] = useState<number>(24)
  // R2721: Label 폰트 색상
  const [labelFontColor, setLabelFontColor] = useState<string>('#ffffff')
  // R1553: 스케일/사이즈 일괄 편집
  const [batchScaleX, setBatchScaleX] = useState<string>('')
  const [batchScaleY, setBatchScaleY] = useState<string>('')
  // R2527: 스케일 X/Y 링크
  const [scaleLinked, setScaleLinked] = useState(false)
  // R2530: 앵커 변경 시 위치 보정 여부
  const [batchAnchorCompensate, setBatchAnchorCompensate] = useState(true)
  const [batchAnchor, setBatchAnchor] = useState<{ x: number; y: number } | null>(null)
  // R2710: 고정 크기
  const [fixedSizeW, setFixedSizeW] = useState<number>(100)
  const [fixedSizeH, setFixedSizeH] = useState<number>(100)
  const [fixedSizeApplyW, setFixedSizeApplyW] = useState<boolean>(true)
  const [fixedSizeApplyH, setFixedSizeApplyH] = useState<boolean>(true)
  // R2528: 스케일 배율
  const [scaleMulInput, setScaleMulInput] = useState<string>('2')
  // R2599: size 배수
  const [sizeMulInput, setSizeMulInput] = useState<string>('2')
  // R1750: 레이어 일괄 설정
  const [batchLayer, setBatchLayer] = useState<string>('')
  // R2714: 조건부 active 토글
  const [condActivePattern, setCondActivePattern] = useState<string>('')
  const [condActiveValue, setCondActiveValue] = useState<'active' | 'inactive'>('active')
  // R1983: active/inactive 설정
  const [batchActive, setBatchActive] = useState<'active' | 'inactive' | ''>('')

  // R1698: 공통 컴포넌트 타입 계산
  const commonCompTypes = useMemo(() => {
    if (!sceneFile.root) return []
    const nodeArr: CCSceneNode[] = []
    function collectC(n: CCSceneNode) { if (uuidSet.has(n.uuid)) nodeArr.push(n); n.children.forEach(collectC) }
    collectC(sceneFile.root)
    if (nodeArr.length < 2) return []
    const allTypes = nodeArr.map(n => new Set(n.components.map(c => c.type)))
    return [...allTypes[0]].filter(t => allTypes.every(s => s.has(t)))
  }, [sceneFile.root, uuidSet])

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

      {/* R2517: 컴포넌트 타입으로 씬 전체 선택 — 선택 노드의 공통 comp 타입 표시 + ⊞전체 클릭 */}
      {onMultiSelectChange && sceneFile.root && uuids.length > 0 && (() => {
        const selectedNodes: CCSceneNode[] = []
        function collectSel(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selectedNodes.push(n); n.children.forEach(collectSel) }
        collectSel(sceneFile.root!)
        // 선택 노드 중 공통 comp 타입 (중복 없이 up to 6개)
        const compTypeSet = new Set<string>()
        selectedNodes.forEach(n => n.components.forEach(c => compTypeSet.add(c.type)))
        const compTypes = [...compTypeSet].slice(0, 6)
        if (compTypes.length === 0) return null
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>⊞전체 (R2517)</span>
            {compTypes.map(ct => {
              // 씬 내 해당 타입 노드 모두 찾기
              const all: string[] = []
              function walkType(n: CCSceneNode) { if (n.components.some(c => c.type === ct)) all.push(n.uuid); n.children.forEach(walkType) }
              walkType(sceneFile.root!)
              const shortName = ct.includes('.') ? ct.split('.').pop()! : ct
              return (
                <span key={ct} onClick={() => onMultiSelectChange(all)}
                  title={`씬 내 ${ct} 컴포넌트를 가진 ${all.length}개 노드 전체 선택 (R2517)`}
                  style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >{shortName}×{all.length}</span>
              )
            })}
          </div>
        )
      })()}
      {/* R2523: 공통 컴포넌트 enabled 일괄 토글 */}
      {sceneFile.root && uuids.length > 0 && (() => {
        const selNodes: CCSceneNode[] = []
        function collectSel2523(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selNodes.push(n); n.children.forEach(collectSel2523) }
        collectSel2523(sceneFile.root!)
        const typeSet = new Set<string>()
        selNodes.forEach(n => n.components.forEach(c => typeSet.add(c.type)))
        const types = [...typeSet].filter(t => t !== 'cc.Node').slice(0, 5)
        if (types.length === 0) return null
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>컴프 ON/OFF (R2523)</span>
            {types.map(ct => {
              const nodesWithComp = selNodes.filter(n => n.components.some(c => c.type === ct))
              const allOn = nodesWithComp.every(n => n.components.find(c => c.type === ct)?.props.enabled !== false)
              const shortName = ct.includes('.') ? ct.split('.').pop()! : ct
              return (
                <span key={ct}
                  title={`선택된 노드의 ${ct} 컴포넌트를 일괄 ${allOn ? '비활성화' : '활성화'} (R2523)`}
                  onClick={async () => {
                    if (!sceneFile.root) return
                    const newEnabled = !allOn
                    await patchComponents(
                      c => c.type === ct,
                      c => { ...c, props: { ...c.props, enabled: newEnabled, _enabled: newEnabled } },
                      `${ct} ${newEnabled ? '활성화' : '비활성화'} (${nodesWithComp.length}개)`,
                    )
                  }}
                  style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${allOn ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`, borderRadius: 2, color: allOn ? '#34d399' : '#f87171', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >{shortName} {allOn ? '●' : '○'}</span>
              )
            })}
          </div>
        )
      })()}
      {/* R2505: 컴포넌트 일괄 추가 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const doBatchAdd = async () => {
          const ct = batchAddComp.trim()
          if (!ct || !sceneFile.root) return
          await patchNodes(n => {
            if (n.components.some(c => c.type === ct)) return { ...n} // 이미 있으면 스킵
            return { ...n, components: [...n.components, { type: ct, props: {} }]}
          }, `${ct} 일괄 추가 (${uuids.length}개)`)
          setBatchAddComp('')
        }
        const QUICK_COMPS = ['cc.Widget', 'cc.Layout', 'cc.Button', 'cc.Toggle', 'cc.Mask', 'cc.BlockInputEvents', 'cc.AudioSource']
        return (
          <div style={{ marginBottom: 6, padding: '3px 6px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: '#38bdf8', fontWeight: 600, marginBottom: 3 }}>⊕ 컴포넌트 일괄 추가 (R2505)</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
              {QUICK_COMPS.map(ct => (
                <span key={ct} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', background: 'rgba(56,189,248,0.06)' }}
                  onClick={async () => {
                    if (!sceneFile.root) return
                    await patchNodes(n => {
                      if (n.components.some(c => c.type === ct)) return n
                      return { ...n, components: [...n.components, { type: ct, props: {} }]}
                    }, `${ct.split('.').pop()} 일괄 추가`)
                  }}
                  title={`${ct} 일괄 추가`}
                >{ct.split('.').pop()}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <input value={batchAddComp} onChange={e => setBatchAddComp(e.target.value)}
                placeholder="컴포넌트 타입 (예: cc.Widget)"
                onKeyDown={e => { if (e.key === 'Enter') doBatchAdd() }}
                style={{ flex: 1, fontSize: 9, padding: '2px 4px', borderRadius: 3, background: 'var(--bg-input, #1a1a2e)', border: '1px solid #334', color: 'var(--text-primary)', outline: 'none', minWidth: 0 }} />
              <span onClick={doBatchAdd} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', lineHeight: 1.6 }}>추가</span>
            </div>
          </div>
        )
      })()}
      {/* R2506: 컴포넌트 일괄 제거 */}
      {/* R2506: 컴포넌트 일괄 제거 */}
      {commonCompTypes.length > 0 && uuids.length >= 1 && sceneFile.root && (() => {
        const doBatchRem = async (ct: string) => {
          if (!ct || !sceneFile.root) return
          await patchNodes(n => {
            return { ...n, components: n.components.filter(c => c.type !== ct)}
          }, `${ct.split('.').pop()} 일괄 제거 (${uuids.length}개)`)
          setBatchRemComp('')
        }
        return (
          <div style={{ marginBottom: 6, padding: '3px 6px', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: '#f87171', fontWeight: 600, marginBottom: 3 }}>⊖ 컴포넌트 일괄 제거 (R2506)</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
              {commonCompTypes.map(ct => (
                <span key={ct} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', background: 'rgba(248,113,113,0.06)' }}
                  onClick={() => doBatchRem(ct)}
                  title={`${ct} 공통 컴포넌트 일괄 제거`}
                >{ct.split('.').pop()} ×</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <input value={batchRemComp} onChange={e => setBatchRemComp(e.target.value)}
                placeholder="제거할 컴포넌트 타입"
                onKeyDown={e => { if (e.key === 'Enter') doBatchRem(batchRemComp.trim()) }}
                style={{ flex: 1, fontSize: 9, padding: '2px 4px', borderRadius: 3, background: 'var(--bg-input, #1a1a2e)', border: '1px solid #334', color: 'var(--text-primary)', outline: 'none', minWidth: 0 }} />
              <span onClick={() => doBatchRem(batchRemComp.trim())} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', lineHeight: 1.6 }}>제거</span>
            </div>
          </div>
        )
      })()}
      {/* R1698: 공통 컴포넌트 표시 */}
      {commonCompTypes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', alignSelf: 'center' }}>공통:</span>
          {commonCompTypes.map(t => (
            <span key={t} style={{ fontSize: 8, padding: '0 4px', borderRadius: 3, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa' }}>
              {t.includes('.') ? t.split('.').pop() : t}
            </span>
          ))}
        </div>
      )}
      {/* R2095: 공통 cc.PolygonCollider restitution 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyRest = async (restitution: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => { ...c, props: { ...c.props, restitution, _restitution: restitution, _N$restitution: restitution } },
            `PolygonCollider restitution=${restitution} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyRst</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`restitution = ${v}`}
                onClick={() => applyPolyRest(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2094: 공통 cc.PolygonCollider friction 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyFric = async (friction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => { ...c, props: { ...c.props, friction, _friction: friction, _N$friction: friction } },
            `PolygonCollider friction=${friction} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyFrc</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`friction = ${v}`}
                onClick={() => applyPolyFric(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2093: 공통 cc.PolygonCollider density 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyDens = async (density: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => { ...c, props: { ...c.props, density, _density: density, _N$density: density } },
            `PolygonCollider density=${density} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyDns</span>
            {[0.1, 0.5, 1, 2, 5, 10].map(v => (
              <span key={v} title={`density = ${v}`}
                onClick={() => applyPolyDens(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2218: 공통 cc.BoxCollider2D enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider2D') || commonCompTypes.includes('cc.BoxCollider')) && (() => {
        const applyBoxColliderEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider2D' || c.type === 'cc.BoxCollider'),
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `BoxCollider2D enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxCEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyBoxColliderEnabled(v)} title={`BoxCollider2D enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2218: 공통 cc.CircleCollider2D enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider2D') || commonCompTypes.includes('cc.CircleCollider')) && (() => {
        const applyCircleColliderEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider2D' || c.type === 'cc.CircleCollider'),
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `CircleCollider2D enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirCEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyCircleColliderEnabled(v)} title={`CircleCollider2D enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2220: 공통 cc.PolygonCollider2D enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyColliderEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `PolygonCollider2D enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyCEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyPolyColliderEnabled(v)} title={`PolygonCollider2D enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2156: 공통 cc.PolygonCollider offset 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D') ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `PolyCollider offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyOff</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0]] as [string,number,number][]).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyPolyOffset(ox, oy)} title={`offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2171: 공통 cc.PolygonCollider threshold 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyThreshold = async (threshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => { ...c, props: { ...c.props, threshold, _threshold: threshold, _N$threshold: threshold } },
            `PolygonCollider threshold=${threshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyThr</span>
            {[1, 2, 5, 10, 20].map(v => (
              <span key={v} onClick={() => applyPolyThreshold(v)} title={`threshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2160: 공통 cc.BoxCollider2D offset 일괄 설정 */}
      {commonCompTypes.includes('cc.BoxCollider2D') && (() => {
        const applyBoxOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => c.type === 'cc.BoxCollider2D' ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `BoxCollider2D offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Box2Off</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0]] as [string,number,number][]).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyBoxOffset(ox, oy)} title={`BoxCollider2D offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2160: 공통 cc.CircleCollider2D offset 일괄 설정 */}
      {commonCompTypes.includes('cc.CircleCollider2D') && (() => {
        const applyCircleOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => c.type === 'cc.CircleCollider2D' ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `CircleCollider2D offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Cir2Off</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0]] as [string,number,number][]).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyCircleOffset(ox, oy)} title={`CircleCollider2D offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2209: 공통 cc.BoxCollider2D size 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.BoxCollider2D') && (() => {
        const applyBoxCollSize = async (w: number, h: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const size = { width: w, height: h }
            const components = n.components.map(c => c.type === 'cc.BoxCollider2D' ? { ...c, props: { ...c.props, size, _size: size, _N$size: size } } : c)
            return { ...n, components }
          }, `BoxCollider2D size=(${w},${h}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Box2Sz</span>
            {([[50,50],[100,100],[150,150],[200,200],[100,50],[200,100]] as [number,number][]).map(([w,h]) => (
              <span key={`${w}x${h}`} onClick={() => applyBoxCollSize(w, h)} title={`BoxCollider2D size=(${w},${h})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{w}×{h}</span>
            ))}
          </div>
        )
      })()}
      {/* R2209: 공통 cc.CircleCollider2D radius 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.CircleCollider2D') && (() => {
        const applyCircleCollRadius = async (radius: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.CircleCollider2D',
            c => { ...c, props: { ...c.props, radius, _radius: radius, _N$radius: radius } },
            `CircleCollider2D radius=${radius} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Cir2R</span>
            {[25, 50, 75, 100, 150, 200].map(v => (
              <span key={v} onClick={() => applyCircleCollRadius(v)} title={`CircleCollider2D radius=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2084: 공통 cc.PolygonCollider sensor 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyColliderSensor = async (sensor: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => { ...c, props: { ...c.props, sensor, _sensor: sensor, _N$sensor: sensor } },
            `PolygonCollider sensor=${sensor} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolySens</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`sensor = ${v}`}
                onClick={() => applyPolyColliderSensor(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'sns✓' : 'sns✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2092: 공통 cc.CircleCollider restitution 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleRestitution = async (restitution: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => { ...c, props: { ...c.props, restitution, _restitution: restitution, _N$restitution: restitution } },
            `CircleCollider restitution=${restitution} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirRest</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`restitution = ${v}`}
                onClick={() => applyCircleRestitution(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2090: 공통 cc.CircleCollider friction 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleFriction = async (friction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => { ...c, props: { ...c.props, friction, _friction: friction, _N$friction: friction } },
            `CircleCollider friction=${friction} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirFric</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`friction = ${v}`}
                onClick={() => applyCircleFriction(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2088: 공통 cc.CircleCollider density 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleDensity = async (density: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => { ...c, props: { ...c.props, density, _density: density, _N$density: density } },
            `CircleCollider density=${density} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirDens</span>
            {[0.1, 0.5, 1, 2, 5, 10].map(v => (
              <span key={v} title={`density = ${v}`}
                onClick={() => applyCircleDensity(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2083: 공통 cc.CircleCollider sensor 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleSensor = async (sensor: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => { ...c, props: { ...c.props, sensor, _sensor: sensor, _N$sensor: sensor } },
            `CircleCollider sensor=${sensor} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirSens</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`sensor = ${v}`}
                onClick={() => applyCircleSensor(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'sns✓' : 'sns✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2091: 공통 cc.BoxCollider restitution 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const applyBoxRestitution = async (restitution: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => { ...c, props: { ...c.props, restitution, _restitution: restitution, _N$restitution: restitution } },
            `BoxCollider restitution=${restitution} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxRest</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`restitution = ${v}`}
                onClick={() => applyBoxRestitution(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2089: 공통 cc.BoxCollider friction 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const applyBoxFriction = async (friction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => { ...c, props: { ...c.props, friction, _friction: friction, _N$friction: friction } },
            `BoxCollider friction=${friction} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxFric</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`friction = ${v}`}
                onClick={() => applyBoxFriction(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2087: 공통 cc.BoxCollider density 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const applyBoxDensity = async (density: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => { ...c, props: { ...c.props, density, _density: density, _N$density: density } },
            `BoxCollider density=${density} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxDens</span>
            {[0.1, 0.5, 1, 2, 5, 10].map(v => (
              <span key={v} title={`density = ${v}`}
                onClick={() => applyBoxDensity(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2082: 공통 cc.BoxCollider sensor 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const applyBoxSensor = async (sensor: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => { ...c, props: { ...c.props, sensor, _sensor: sensor, _N$sensor: sensor } },
            `BoxCollider sensor=${sensor} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxSens</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`sensor = ${v}`}
                onClick={() => applyBoxSensor(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'sns✓' : 'sns✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2163: 노드 _tag 일괄 설정 (CC2.x 노드 태그) */}
      {(() => {
        const applyNodeTag = async (tag: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _tag: tag }), `_tag=${tag} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Tag</span>
            {[0, 1, 2, 3, 10, 100].map(v => (
              <span key={v} onClick={() => applyNodeTag(v)} title={`_tag=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2174: 노드 _group 일괄 설정 (CC2.x 레이어/물리 그룹) */}
      {(() => {
        const applyNodeGroup = async (group: string) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _group: group }), `_group="${group}" (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodeGrp</span>
            {(['default', 'wall', 'ground', 'player', 'enemy', 'trigger'].map(g => (
              <span key={g} onClick={() => applyNodeGroup(g)} title={`_group="${g}"`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{g}</span>
            )))}
          </div>
        )
      })()}
      {/* R2161: 노드 _zIndex 일괄 설정 (CC2.x z-order) */}
      {(() => {
        const applyZIndex = async (zIndex: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _zIndex: zIndex }), `_zIndex=${zIndex} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>zIdx</span>
            {[0, 1, 2, 5, 10, -1].map(v => (
              <span key={v} onClick={() => applyZIndex(v)} title={`_zIndex=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2184: 노드 cascadeColorEnabled 일괄 설정 (CC2.x) */}
      {(() => {
        const applyNodeCascadeColor = async (cascadeColorEnabled: boolean) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, cascadeColorEnabled }), `cascadeColorEnabled=${cascadeColorEnabled} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CscCol</span>
            {([['col✓', true], ['col✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyNodeCascadeColor(v)} title={`cascadeColorEnabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2183: 노드 cascadeOpacityEnabled 일괄 설정 (CC2.x) */}
      {(() => {
        const applyNodeCascadeOpacity = async (cascadeOpacityEnabled: boolean) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, cascadeOpacityEnabled }), `cascadeOpacity=${cascadeOpacityEnabled} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CscOp</span>
            {([['cas✓', true], ['cas✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyNodeCascadeOpacity(v)} title={`cascadeOpacityEnabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2166: 노드 _skewX 일괄 설정 (CC2.x) */}
      {(() => {
        const applySkewX = async (skewX: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _skewX: skewX }), `_skewX=${skewX} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>skewX</span>
            {[0, 10, 20, 30, 45, -10].map(v => (
              <span key={v} onClick={() => applySkewX(v)} title={`_skewX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2166: 노드 _skewY 일괄 설정 (CC2.x) */}
      {(() => {
        const applySkewY = async (skewY: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _skewY: skewY }), `_skewY=${skewY} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>skewY</span>
            {[0, 10, 20, 30, 45, -10].map(v => (
              <span key={v} onClick={() => applySkewY(v)} title={`_skewY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2214: 노드 _rotationX 일괄 설정 (CC2.x 3D 회전) */}
      {(() => {
        const applyNodeRotX = async (rotationX: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _rotationX: rotationX }), `_rotationX=${rotationX} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodRX</span>
            {[0, 30, 45, 60, 90, 180, -90].map(v => (
              <span key={v} onClick={() => applyNodeRotX(v)} title={`_rotationX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2214: 노드 _rotationY 일괄 설정 (CC2.x 3D 회전) */}
      {(() => {
        const applyNodeRotY = async (rotationY: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _rotationY: rotationY }), `_rotationY=${rotationY} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodRY</span>
            {[0, 30, 45, 60, 90, 180, -90].map(v => (
              <span key={v} onClick={() => applyNodeRotY(v)} title={`_rotationY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2006: 노드 rotation 일괄 설정 */}
      {(() => {
        const applyNodeRotation = async (deg: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            // CC2.x: rotation is a number (z-euler); CC3.x: {x,y,z} euler
            const rotation = typeof n.rotation === 'number' ? deg : { x: 0, y: 0, z: deg }
            return { ...n, rotation}
          }, `rotation=${deg}° (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Rot</span>
            {[0, 45, 90, 180, -90, -45].map(v => (
              <span key={v} onClick={() => applyNodeRotation(v)} title={`rotation=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2003: 노드 scale 일괄 설정 */}
      {(() => {
        const applyNodeScale = async (s: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, scale: { x: s, y: s, z: s } }), `scale=${s} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Scale</span>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
              <span key={v} onClick={() => applyNodeScale(v)} title={`scale=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R2202: 노드 scaleX 일괄 설정 (플립/비균등 스케일) */}
      {(() => {
        const applyNodeScaleX = async (sx: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, scale: { ...(n.scale || { x: 1, y: 1, z: 1 }), x: sx } }), `scaleX=${sx} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodSX</span>
            {[-1, 0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
              <span key={v} onClick={() => applyNodeScaleX(v)} title={`scaleX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2202: 노드 scaleY 일괄 설정 (플립/비균등 스케일) */}
      {(() => {
        const applyNodeScaleY = async (sy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, scale: { ...(n.scale || { x: 1, y: 1, z: 1 }), y: sy } }), `scaleY=${sy} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodSY</span>
            {[-1, 0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
              <span key={v} onClick={() => applyNodeScaleY(v)} title={`scaleY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1996: 노드 color(tint) 일괄 설정 */}
      {(() => {
        const applyNodeTint = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          await patchNodes(n => ({ ...n, color: { r, g, b, a: n.color?.a ?? 255 } }), `node tint=${hex} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Tint</span>
            <input type="color" defaultValue="#ffffff"
              style={{ width: 20, height: 16, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 2, background: 'none' }}
              onChange={e => applyNodeTint(e.target.value)} />
            {['#ffffff','#ff0000','#00ff00','#0000ff','#ffff00'].map(c => (
              <span key={c} onClick={() => applyNodeTint(c)} title={c}
                style={{ width: 12, height: 12, borderRadius: 2, background: c, cursor: 'pointer', border: '1px solid var(--border)', flexShrink: 0 }} />
            ))}
          </div>
        )
      })()}
      {/* R1993: 노드 layer 일괄 설정 (CC3.x) */}
      {(() => {
        const applyNodeLayer = async (layer: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, layer }), `Node Layer`)
          const names: Record<number, string> = { 2: 'Dflt', 32: 'UI', 33554432: 'UI2D' }
          setBatchMsg(`✓ layer=${names[layer] ?? layer} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodeLay</span>
            <span onClick={() => applyNodeLayer(2)} title="DEFAULT(1<<1=2)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>Dflt</span>
            <span onClick={() => applyNodeLayer(32)} title="UI(1<<5=32)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>UI</span>
            <span onClick={() => applyNodeLayer(33554432)} title="UI_2D(1<<25=33554432)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>UI2D</span>
          </div>
        )
      })()}
      {/* R2053: 노드 opacity preset 일괄 설정 */}
      {(() => {
        const applyNodeOpacity = async (opacity: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, opacity }), `opacity=${opacity} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>NodeOpa</span>
            {[0, 64, 128, 192, 255].map(v => (
              <span key={v} onClick={() => applyNodeOpacity(v)} title={`opacity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2131: 노드 color preset 일괄 설정 */}
      {(() => {
        const applyNodeColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const color = { r, g, b, a: 255 }
          await patchNodes(n => ({ ...n, color }), `node color=${hex} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>NodeClr</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyNodeColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ffffff','#000000','#ff0000','#00ff00','#0000ff','#ffff00'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyNodeColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1983: 노드 active/inactive 일괄 설정 */}
      {(() => {
        const applyNodeActive = async (active: boolean) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, active }), `node active=${active} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodeAct</span>
            <span onClick={() => applyNodeActive(true)} title="active ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>act✓</span>
            <span onClick={() => applyNodeActive(false)} title="active OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>act✗</span>
          </div>
        )
      })()}
      {/* R1749: 공통 cc.Label fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label fs</span>
          <input type="number" min={1} max={200} placeholder="fontSize"
            style={{ width: 56, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={async e => {
              const fs = parseInt(e.target.value)
              if (isNaN(fs) || fs <= 0 || !sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.Label',
                c => { ...c, props: { ...c.props, fontSize: fs, _fontSize: fs, _N$fontSize: fs } },
                `Label fontSize ${fs} (${uuids.length}개)`,
              )
            }}
          />
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
        </div>
      )}
      {/* R1792: 공통 cc.Label lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label lh</span>
          <input type="number" min={0} placeholder="lineHeight (0=auto)"
            style={{ width: 56, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={async e => {
              const lh = parseInt(e.target.value)
              if (isNaN(lh) || !sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.Label',
                c => { ...c, props: { ...c.props, lineHeight: lh, _lineHeight: lh, _N$lineHeight: lh } },
                `Label lineHeight ${lh} (${uuids.length}개)`,
              )
            }}
          />
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
        </div>
      )}
      {/* R1804: 공통 cc.Label wrapText 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label wrap</span>
          {(['✓ wrap', '✕ wrap'] as const).map(label => (
            <span key={label}
              title={`enableWrapText 모두 ${label.startsWith('✓') ? '활성' : '비활성'}`}
              onClick={async () => {
                if (!sceneFile.root) return
                const val = label.startsWith('✓')
                await patchComponents(
                  c => c.type === 'cc.Label',
                  c => { ...c, props: { ...c.props, enableWrapText: val, _enableWrapText: val, _N$enableWrapText: val } },
                  `wrap ${val} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: label.startsWith('✓') ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R1802: 공통 cc.Label bold/italic 일괄 토글 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label 스타일</span>
          {([
            { label: 'B', key: 'isBold', title: 'Bold 일괄 설정' },
            { label: 'I', key: 'isItalic', title: 'Italic 일괄 설정' },
            { label: 'U', key: 'isUnderline', title: 'Underline 일괄 설정' },
          ] as const).map(({ label, key, title }) => (
            <React.Fragment key={key}>
              {(['on', 'off'] as const).map(v => (
                <span key={v}
                  title={`${title} → ${v}`}
                  onClick={async () => {
                    if (!sceneFile.root) return
                    const val = v === 'on'
                    await patchComponents(
                      c => c.type === 'cc.Label',
                      c => { ...c, props: { ...c.props, [key]: val, [`_${key}`]: val, [`_N$${key}`]: val } },
                      `${key} ${v} (${uuids.length}개)`,
                    )
                  }}
                  style={{ fontSize: v === 'on' ? 9 : 7, fontWeight: label === 'B' ? 700 : 400, fontStyle: label === 'I' ? 'italic' : 'normal', textDecoration: label === 'U' ? 'underline' : 'none', cursor: 'pointer', padding: '1px 3px', borderRadius: 2, border: `1px solid ${v === 'on' ? 'rgba(88,166,255,0.4)' : 'var(--border)'}`, color: v === 'on' ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                >{label}{v === 'on' ? '✓' : '✕'}</span>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
      {/* R1800: 공통 cc.Label vAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label vAlgn</span>
          {([['T', 0], ['M', 1], ['B', 2]] as const).map(([l, v]) => (
            <span key={v} title={`vAlign = ${l}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Label',
                  c => { ...c, props: { ...c.props, verticalAlign: v, _verticalAlign: v, _N$verticalAlign: v } },
                  `vAlign ${l} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 8px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1799: 공통 cc.Label hAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label algn</span>
          {([['L', 0], ['C', 1], ['R', 2]] as const).map(([l, v]) => (
            <span key={v} title={`hAlign = ${l}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Label',
                  c => { ...c, props: { ...c.props, horizontalAlign: v, _horizontalAlign: v, _N$horizontalAlign: v } },
                  `hAlign ${l} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 8px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1854: 공통 cc.Label bold/italic 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelStyle = async (key: 'isBold' | 'isItalic' | 'isUnderline', value: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, [key]: value, [`_${key}`]: value, [`_N$${key}`]: value } },
            `Label ${key}=${value} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label sty</span>
            {(['isBold','isItalic','isUnderline'] as const).map(key => {
              const short = key === 'isBold' ? 'B' : key === 'isItalic' ? 'I' : 'U'
              return (
                <React.Fragment key={key}>
                  <span onClick={() => applyLabelStyle(key, true)} title={`${key} ON`}
                    style={{ fontSize: 9, fontWeight: key==='isBold'?700:400, fontStyle: key==='isItalic'?'italic':'normal', textDecoration: key==='isUnderline'?'underline':'none', cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
                  >{short}✓</span>
                  <span onClick={() => applyLabelStyle(key, false)} title={`${key} OFF`}
                    style={{ fontSize: 9, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
                  >{short}✗</span>
                </React.Fragment>
              )
            })}
          </div>
        )
      })()}
      {/* R1797: 공통 cc.Label overflow 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label ovf</span>
          {([['None', 0], ['Clamp', 1], ['Shrink', 2], ['ResH', 3]] as const).map(([l, v]) => (
            <span key={v} title={`overflow = ${l}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Label',
                  c => { ...c, props: { ...c.props, overflow: v, _overflow: v, _N$overflow: v } },
                  `overflow ${l} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1855: 공통 cc.Label lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelLH = async (lh: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, lineHeight: lh, _lineHeight: lh, _N$lineHeight: lh } },
            `Label lineH ${lh} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label lnH</span>
            {([0, 20, 24, 32, 40, 48] as const).map(v => (
              <span key={v} title={v === 0 ? 'lineHeight=0 (자동)' : `lineHeight=${v}`}
                onClick={() => applyLabelLH(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v === 0 ? 'auto' : v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1927: 공통 cc.Label enableWrapText 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyWrapText = async (enableWrapText: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, enableWrapText, _enableWrapText: enableWrapText, _N$enableWrapText: enableWrapText } },
            `Label wrap=${enableWrapText} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblWrap</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`enableWrapText = ${v}`}
                onClick={() => applyWrapText(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v ? 'wrap✓' : 'wrap✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1868: 공통 cc.Label spacingX 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelSpX = async (sx: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, spacingX: sx, _spacingX: sx, _N$spacingX: sx } },
            `Label spacingX ${sx} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label spX</span>
            {([-2, -1, 0, 1, 2, 4, 8] as const).map(v => (
              <span key={v} title={`spacingX=${v}`}
                onClick={() => applyLabelSpX(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1978: 공통 cc.Label bold/italic 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelBold = async (isBold: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, isBold, _isBold: isBold, _N$isBold: isBold } },
            `Label bold=${isBold} (${uuids.length}개)`,
          )
        }
        const applyLabelItalic = async (isItalic: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, isItalic, _isItalic: isItalic, _N$isItalic: isItalic } },
            `Label italic=${isItalic} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>LbStyle</span>
            <span onClick={() => applyLabelBold(true)} title="bold ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none', fontWeight: 'bold' }}>B✓</span>
            <span onClick={() => applyLabelBold(false)} title="bold OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>B✗</span>
            <span onClick={() => applyLabelItalic(true)} title="italic ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none', fontStyle: 'italic' }}>I✓</span>
            <span onClick={() => applyLabelItalic(false)} title="italic OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>I✗</span>
          </div>
        )
      })()}
      {/* R1992: 공통 cc.Label strikethrough 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelStrike = async (isStrike: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, isStrike, _isStrike: isStrike, _N$isStrike: isStrike } },
            `Label strike=${isStrike} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>LbStrike</span>
            <span onClick={() => applyLabelStrike(true)} title="strikethrough ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none', textDecoration: 'line-through' }}>S✓</span>
            <span onClick={() => applyLabelStrike(false)} title="strikethrough OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>S✗</span>
          </div>
        )
      })()}
      {/* R1985: 공통 cc.Label underline 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelUnderline = async (isUnderline: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, isUnderline, _isUnderline: isUnderline, _N$isUnderline: isUnderline } },
            `Label underline=${isUnderline} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>LbUnder</span>
            <span onClick={() => applyLabelUnderline(true)} title="underline ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none', textDecoration: 'underline' }}>U✓</span>
            <span onClick={() => applyLabelUnderline(false)} title="underline OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>U✗</span>
          </div>
        )
      })()}
      {/* R2215: 공통 cc.Label _underlineHeight 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelULHeight = async (underlineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, underlineHeight, _underlineHeight: underlineHeight } },
            `Label underlineHeight=${underlineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblULH</span>
            {[1, 2, 3, 4, 5, 6, 8].map(v => (
              <span key={v} onClick={() => applyLabelULHeight(v)} title={`underlineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2216: 공통 cc.Label _spacingX 일괄 설정 (CC3.x 문자 간격) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelSpacingX = async (spacingX: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, spacingX, _spacingX: spacingX } },
            `Label spacingX=${spacingX} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblSpX</span>
            {[0, 1, 2, 3, 4, 5, 8, 10].map(v => (
              <span key={v} onClick={() => applyLabelSpacingX(v)} title={`_spacingX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2225: 공통 cc.Label charSpacing 일괄 설정 (CC2.x/CC3.x 문자 간격) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelCharSpacing = async (charSpacing: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, charSpacing, _charSpacing: charSpacing, _N$charSpacing: charSpacing } },
            `Label charSpacing=${charSpacing} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblChSp</span>
            {[0, 1, 2, 3, 4, 5, 8].map(v => (
              <span key={v} onClick={() => applyLabelCharSpacing(v)} title={`charSpacing=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1955: 공통 cc.Label color 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } },
            `Label color (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LbColor</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyLabelColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#000000','#ff4444','#ffff00','#44ff44'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2034: 공통 cc.Label verticalAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelVAlign = async (verticalAlign: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, verticalAlign, _verticalAlign: verticalAlign, _N$verticalAlign: verticalAlign } },
            `Label V Align`,
          )
          const names = ['T','C','B']
          setBatchMsg(`✓ Label vAlign=${names[verticalAlign]??verticalAlign} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblVA</span>
            {([['T',0],['C',1],['B',2]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyLabelVAlign(v)} title={`verticalAlign=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2019: 공통 cc.Label horizontalAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelHAlign = async (horizontalAlign: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, horizontalAlign, _horizontalAlign: horizontalAlign, _N$horizontalAlign: horizontalAlign } },
            `Label H Align`,
          )
          const names = ['L','C','R']
          setBatchMsg(`✓ Label hAlign=${names[horizontalAlign]??horizontalAlign} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblHA</span>
            {([['L',0],['C',1],['R',2]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyLabelHAlign(v)} title={`horizontalAlign=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2018: 공통 cc.Label overflow 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelOverflow = async (overflow: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, overflow, _overflow: overflow, _N$overflow: overflow } },
            `Label Overflow`,
          )
          const names = ['None','Clamp','Shrink','Resize']
          setBatchMsg(`✓ Label overflow=${names[overflow]??overflow} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblOvfl</span>
            {([['None',0],['Clamp',1],['Shrink',2],['Rsz',3]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyLabelOverflow(v)} title={`overflow=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2064: 공통 cc.Label fontFamily preset 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelFontFamily = async (fontFamily: string) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, fontFamily, _fontFamily: fontFamily, _N$fontFamily: fontFamily } },
            `Label fontFamily=${fontFamily} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblFont</span>
            {['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia'].map(f => (
              <span key={f} title={`fontFamily = ${f}`}
                onClick={() => applyLabelFontFamily(f)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{f.split(' ')[0]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2017: 공통 cc.Label lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelLineHeight = async (lineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, lineHeight, _lineHeight: lineHeight, _N$lineHeight: lineHeight } },
            `Label lineHeight=${lineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblLH</span>
            {[0, 20, 30, 40, 60, 80].map(v => (
              <span key={v} onClick={() => applyLabelLineHeight(v)} title={`lineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2102: 공통 cc.Label spacingY 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelSpacingY = async (spacingY: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, spacingY, _spacingY: spacingY, _N$spacingY: spacingY } },
            `Label spacingY=${spacingY} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblSpY</span>
            {[0, 2, 5, 10, 20, 30].map(v => (
              <span key={v} onClick={() => applyLabelSpacingY(v)} title={`spacingY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1951: 공통 cc.Label fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelFontSize = async (fontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, fontSize, _fontSize: fontSize, _N$fontSize: fontSize } },
            `Label fontSize=${fontSize} (${uuids.length}개)`,
          )
        }
        // R2712: 프리셋 확장 + 커스텀 입력
        const niSFont = mkNiS(50)
        const btnSApply = mkBtnS('#3b82f6', { fontSize: 8, padding: '1px 6px' })
        return (
          <div style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LbFont</span>
              {([12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72] as const).map(v => (
                <span key={v} title={`Label fontSize = ${v}`}
                  onClick={() => applyLabelFontSize(v)}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
                >{v}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
              <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }} />
              <input type="number" min={1} max={200} value={customFontSize}
                onChange={e => setCustomFontSize(Math.max(1, Math.min(200, Number(e.target.value))))}
                style={niSFont}
                onKeyDown={e => e.key === 'Enter' && applyLabelFontSize(customFontSize)}
              />
              <span onClick={() => applyLabelFontSize(customFontSize)} style={btnSApply}>적용</span>
            </div>
          </div>
        )
      })()}
      {/* R1940: 공통 cc.Label overflow 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelOverflow = async (overflow: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, overflow, _overflow: overflow, _N$overflow: overflow } },
            `Label Overflow`,
          )
          const names: Record<number,string> = { 0:'None', 1:'Clamp', 2:'Shrink', 3:'Resize' }
          setBatchMsg(`✓ Label overflow=${names[overflow]??overflow} (${uuids.length}개)`) // R2238: _overflow CC3.x
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LbOvflw</span>
            {([['None',0],['Clamp',1],['Shrink',2],['Rsz',3]] as const).map(([l, v]) => (
              <span key={v} title={`overflow = ${l}`}
                onClick={() => applyLabelOverflow(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1925: 공통 cc.Label cacheMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyCacheMode = async (cacheMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, cacheMode, _cacheMode: cacheMode, _N$cacheMode: cacheMode } },
            `Cache Mode`,
          )
          const names = ['None', 'Bitmap', 'Char']
          setBatchMsg(`✓ Label cacheMode=${names[cacheMode] ?? cacheMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblCache</span>
            {([['None',0],['Bitmap',1],['Char',2]] as [string,number][]).map(([l,v]) => (
              <span key={v} title={`cacheMode = ${l}`}
                onClick={() => applyCacheMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2165: 공통 cc.Label isSystemFontUsed 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelSysFont = async (isSystemFontUsed: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, isSystemFontUsed, _isSystemFontUsed: isSystemFontUsed, _N$isSystemFontUsed: isSystemFontUsed } },
            `Label isSystemFontUsed=${isSystemFontUsed} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblSys</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`isSystemFontUsed = ${v}`}
                onClick={() => applyLabelSysFont(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v ? 'sys✓' : 'sys✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2173: 공통 cc.Label platformFont 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelPlatFont = async (platformFont: string) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, platformFont, _platformFont: platformFont, _N$platformFont: platformFont } },
            `Label platformFont="${platformFont}" (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>PlatFont</span>
            {(['', 'Arial', 'sans-serif', 'serif', 'monospace'] as const).map(f => (
              <span key={f || 'default'} onClick={() => applyLabelPlatFont(f)} title={`platformFont="${f || '(기본)'}"`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{f || 'def'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2191: 공통 cc.Label enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Label enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelEnabled(v)} title={`Label enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2205: 공통 cc.Label enableOutline 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelEnableOutline = async (enableOutline: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, enableOutline, _enableOutline: enableOutline } },
            `Label enableOutline=${enableOutline} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblOtln</span>
            {([['otln✓', true], ['otln✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelEnableOutline(v)} title={`enableOutline=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2210: 공통 cc.Label outlineWidth 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelOW = async (outlineWidth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, outlineWidth, _outlineWidth: outlineWidth } },
            `Label outlineWidth=${outlineWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblOW</span>
            {[1, 2, 3, 4, 5, 6, 8].map(v => (
              <span key={v} onClick={() => applyLabelOW(v)} title={`Label outlineWidth=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2210: 공통 cc.Label outlineColor 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelOutlineClr = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const outlineColor = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, outlineColor, _outlineColor: outlineColor } },
            `Label outlineColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblOC</span>
            {(['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelOutlineClr(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2721: cc.Label/RichText 폰트 색상 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelFontColor = async () => {
          if (!sceneFile.root) return
          const hex = labelFontColor
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorObj = { r, g, b, a: 255 }
          await patchNodes(n => {
            const updComps = n.components.map(c => {
            if (c.type !== 'cc.Label' && c.type !== 'cc.RichText') return c
            // CC2.x: color prop as {r,g,b,a}; CC3.x: fontColor as hex string
            return { ...c, props: { ...c.props, color: colorObj, _color: colorObj, fontColor: hex, _fontColor: hex } }
            })
            return { ...n, components: updComps}
          }, `Label fontColor=${hex} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>폰트색 (R2721)</span>
            <input type="color" value={labelFontColor}
              onChange={e => setLabelFontColor(e.target.value)}
              style={{ width: 28, height: 18, padding: 0, border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', background: 'none' }}
              title="Label/RichText 폰트 색상 선택" />
            <span onClick={applyLabelFontColor}
              title={`선택된 ${uuids.length}개 노드 Label fontColor → ${labelFontColor} (R2721)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#58a6ff', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >적용</span>
          </div>
        )
      })()}
      {/* R2205: 공통 cc.Label enableShadow 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelEnableShadow = async (enableShadow: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, enableShadow, _enableShadow: enableShadow } },
            `Label enableShadow=${enableShadow} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblShdw</span>
            {([['shdw✓', true], ['shdw✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelEnableShadow(v)} title={`enableShadow=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2211: 공통 cc.Label shadowColor 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelShadowClr = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const shadowColor = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, shadowColor, _shadowColor: shadowColor } },
            `Label shadowColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblShdC</span>
            {(['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff', '#0000ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelShadowClr(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2211: 공통 cc.Label shadowBlur 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelShadowBlu = async (shadowBlur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, shadowBlur, _shadowBlur: shadowBlur } },
            `Label shadowBlur=${shadowBlur} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblShdB</span>
            {[0, 1, 2, 3, 5, 8, 12].map(v => (
              <span key={v} onClick={() => applyLabelShadowBlu(v)} title={`Label shadowBlur=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2212: 공통 cc.Label shadowOffset 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelShdOff = async (x: number, y: number) => {
          if (!sceneFile.root) return
          const shadowOffset = { x, y }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, shadowOffset, _shadowOffset: shadowOffset } },
            `Label shadowOffset=(${x},${y}) (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblShdO</span>
            {([[1,1],[2,2],[3,3],[2,1],[1,2],[0,2]] as [number,number][]).map(([x,y]) => (
              <span key={`${x}-${y}`} onClick={() => applyLabelShdOff(x, y)} title={`shadowOffset=(${x},${y})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{x},{y}</span>
            ))}
          </div>
        )
      })()}
      {/* R2212: 공통 cc.EditBox placeholderFontColor 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEBPlaceholderClr = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorObj = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, placeholderFontColor: colorObj, _placeholderFontColor: colorObj, _N$placeholderFontColor: colorObj } },
            `EditBox placeholderFontColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBphClr</span>
            {(['#ffffff', '#cccccc', '#999999', '#666666', '#333333', '#000000', '#aaaaaa'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyEBPlaceholderClr(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2184: 공통 cc.Label enableGradient 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelGradient = async (enableGradient: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, enableGradient, _enableGradient: enableGradient } },
            `Label enableGradient=${enableGradient} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblGrad</span>
            {([['grad✓', true], ['grad✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelGradient(v)} title={`enableGradient=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2213: 공통 cc.Label colorTop 일괄 설정 (CC3.x 그라디언트) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelColorTop = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorTop = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, colorTop, _colorTop: colorTop } },
            `Label colorTop=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblClrT</span>
            {(['#ffffff', '#ffff00', '#ff8800', '#ff0000', '#00ff00', '#0088ff', '#000000'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelColorTop(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2213: 공통 cc.Label colorBottom 일괄 설정 (CC3.x 그라디언트) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelColorBot = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorBottom = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, colorBottom, _colorBottom: colorBottom } },
            `Label colorBottom=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblClrB</span>
            {(['#000000', '#333333', '#0000ff', '#ff0000', '#00ff00', '#ffff00', '#ffffff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelColorBot(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2181: 공통 cc.Label enableDashLine 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelDashLine = async (enableDashLine: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => { ...c, props: { ...c.props, enableDashLine, _enableDashLine: enableDashLine } },
            `Label enableDashLine=${enableDashLine} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblDash</span>
            {([['dash✓', true], ['dash✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelDashLine(v)} title={`enableDashLine=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2223: 공통 cc.RichText lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRTLineHeight = async (lineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, lineHeight, _lineHeight: lineHeight, _N$lineHeight: lineHeight } },
            `RichText lineHeight=${lineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>RTLineH</span>
            {[20, 24, 28, 32, 36, 40, 48].map(v => (
              <span key={v} onClick={() => applyRTLineHeight(v)} title={`lineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1888: 공통 cc.RichText maxWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichMaxW = async (w: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, maxWidth: w, _maxWidth: w, _N$maxWidth: w } },
            `Rich Max W`,
          ) // R2252: _maxWidth CC3.x
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Rich maxW</span>
            {([0, 100, 200, 300, 400, 600] as const).map(v => (
              <span key={v} title={v === 0 ? 'maxWidth=0 (무제한)' : `maxWidth=${v}`}
                onClick={() => applyRichMaxW(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v === 0 ? '∞' : v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1903: 공통 cc.RichText fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichFS = async (fontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, fontSize, _fontSize: fontSize, _N$fontSize: fontSize } },
            `Rich F S`,
          ) // R2252: _fontSize CC3.x
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Rich fs</span>
            {([16, 20, 24, 28, 32, 40] as const).map(v => (
              <span key={v} title={`fontSize = ${v}`}
                onClick={() => applyRichFS(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1929: 공통 cc.RichText horizontalAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichAlign = async (horizontalAlign: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, horizontalAlign, _horizontalAlign: horizontalAlign, _N$horizontalAlign: horizontalAlign } },
            `Rich Align`,
          )
          const names = ['L', 'C', 'R']
          setBatchMsg(`✓ RichText align=${names[horizontalAlign] ?? horizontalAlign} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>RichAlgn</span>
            {([['L',0],['C',1],['R',2]] as [string,number][]).map(([l,v]) => (
              <span key={v} title={`horizontalAlign = ${l}`}
                onClick={() => applyRichAlign(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1956: 공통 cc.RichText fontColor 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichFontColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } },
            `RichText fontColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>RTcolor</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyRichFontColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#000000','#ff4444','#ffff44'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyRichFontColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2192: 공통 cc.RichText enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichTextEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `RichText enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>RTComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyRichTextEnabled(v)} title={`RichText enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2182: 공통 cc.RichText imageLineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichImgLineH = async (imageLineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, imageLineHeight, _imageLineHeight: imageLineHeight, _N$imageLineHeight: imageLineHeight } },
            `RichText imageLineHeight=${imageLineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>RTImgLH</span>
            {[20, 24, 28, 32, 40, 48].map(v => (
              <span key={v} onClick={() => applyRichImgLineH(v)} title={`imageLineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1942: 공통 cc.RichText lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichLineH = async (lineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, lineHeight, _lineHeight: lineHeight, _N$lineHeight: lineHeight } },
            `RichText lineH=${lineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>RTlineH</span>
            {([20, 24, 28, 32, 40] as const).map(v => (
              <span key={v} title={`lineHeight = ${v}`}
                onClick={() => applyRichLineH(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2010: 공통 cc.RichText verticalAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichVAlign = async (verticalAlign: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, verticalAlign, _verticalAlign: verticalAlign, _N$verticalAlign: verticalAlign } },
            `Rich V Align`,
          )
          const names = ['Top', 'Ctr', 'Bot']
          setBatchMsg(`✓ RichText vAlign=${names[verticalAlign] ?? verticalAlign} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>RTvAlign</span>
            {([['Top', 0], ['Ctr', 1], ['Bot', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyRichVAlign(v)} title={`verticalAlign=${l}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2066: 공통 cc.RichText fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichFontSize = async (fontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, fontSize, _fontSize: fontSize, _N$fontSize: fontSize } },
            `RichText fontSize=${fontSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>RichFS</span>
            {[12, 16, 20, 24, 32, 40].map(v => (
              <span key={v} title={`fontSize = ${v}`}
                onClick={() => applyRichFontSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2141: 공통 cc.RichText overflow 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichOverflow = async (overflow: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, overflow, _overflow: overflow, _N$overflow: overflow } },
            `RichText overflow=${overflow} (${uuids.length}개)`,
          )
        }
        const labels = ['None', 'Clamp', 'Shrink', 'Resize']
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>RichOvfl</span>
            {[0, 1, 2, 3].map(v => (
              <span key={v} onClick={() => applyRichOverflow(v)} title={`overflow=${labels[v]}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{labels[v]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2035: 공통 cc.RichText lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichLineH = async (lineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, lineHeight, _lineHeight: lineHeight, _N$lineHeight: lineHeight } },
            `RichText lineHeight=${lineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>RichLH</span>
            {[0, 20, 30, 40, 60, 80].map(v => (
              <span key={v} onClick={() => applyRichLineH(v)} title={`lineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2164: 공통 cc.RichText handleTouchEvent 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichTouch = async (handleTouchEvent: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, handleTouchEvent, _handleTouchEvent: handleTouchEvent } },
            `RichText handleTouchEvent=${handleTouchEvent} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>RTtouch</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`handleTouchEvent = ${v}`}
                onClick={() => applyRichTouch(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}
              >{v ? 'touch✓' : 'touch✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1982: 공통 cc.RichText maxWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichMaxWidth = async (maxWidth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, maxWidth, _maxWidth: maxWidth, _N$maxWidth: maxWidth } },
            `RichText maxWidth=${maxWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>RTmaxW</span>
            {[0, 200, 400, 600, 800].map(v => (
              <span key={v} onClick={() => applyRichMaxWidth(v)} title={`maxWidth=${v} (0=无限)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v || '∞'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2221: 공통 cc.DirectionalLight/PointLight enabled (컴포넌트 레벨) 일괄 설정 (CC3.x) */}
      {(commonCompTypes.includes('cc.DirectionalLight') || commonCompTypes.includes('cc.PointLight')) && (() => {
        const applyLightEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.DirectionalLight' || c.type === 'cc.PointLight'),
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Light enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fde68a', width: 48, flexShrink: 0 }}>LightEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLightEnabled(v)} title={`Light enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2142: 공통 cc.DirectionalLight/cc.PointLight intensity 일괄 설정 */}
      {(commonCompTypes.includes('cc.DirectionalLight') || commonCompTypes.includes('cc.PointLight')) && (() => {
        const lightType = commonCompTypes.includes('cc.DirectionalLight') ? 'cc.DirectionalLight' : 'cc.PointLight'
        const applyLightIntensity = async (intensity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.DirectionalLight' || c.type === 'cc.PointLight'),
            c => { ...c, props: { ...c.props, intensity, _intensity: intensity } },
            `${lightType} intensity=${intensity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>LightInt</span>
            {[0, 0.5, 1, 2, 3, 5].map(v => (
              <span key={v} onClick={() => applyLightIntensity(v)} title={`intensity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fbbf24', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2143: 공통 cc.DirectionalLight/cc.PointLight color 일괄 설정 */}
      {(commonCompTypes.includes('cc.DirectionalLight') || commonCompTypes.includes('cc.PointLight')) && (() => {
        const applyLightColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const color = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.DirectionalLight' || c.type === 'cc.PointLight'),
            c => { ...c, props: { ...c.props, color, _color: color } },
            `Light color=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>LightCol</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyLightColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ffffff','#ffe4b5','#ffd700','#add8e6','#ffb6c1'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLightColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2144: 공통 cc.Graphics lineWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsLineWidth = async (lineWidth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, lineWidth, _lineWidth: lineWidth } },
            `Graphics lineWidth=${lineWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxLnW</span>
            {[1, 2, 3, 5, 8, 10].map(v => (
              <span key={v} onClick={() => applyGraphicsLineWidth(v)} title={`lineWidth=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2145: 공통 cc.Graphics fillColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsFillColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const fillColor = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, fillColor, _fillColor: fillColor } },
            `Graphics fillColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxFill</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyGraphicsFillColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ffffff','#000000','#ff0000','#00ff00','#0000ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyGraphicsFillColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2146: 공통 cc.Graphics strokeColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsStrokeColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const strokeColor = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, strokeColor, _strokeColor: strokeColor } },
            `Graphics strokeColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxStrk</span>
            <input type="color" defaultValue="#000000"
              onChange={e => applyGraphicsStrokeColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#000000','#ffffff','#ff0000','#00ff00','#0000ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyGraphicsStrokeColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2171: 공통 cc.Graphics lineJoin 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsLineJoin = async (lineJoin: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, lineJoin, _lineJoin: lineJoin } },
            `Graphics lineJoin=${['miter','round','bevel'][lineJoin] ?? lineJoin} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxJoin</span>
            {([['Miter', 0], ['Round', 1], ['Bevel', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyGraphicsLineJoin(v)} title={`lineJoin=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2172: 공통 cc.Graphics lineCap 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsLineCap = async (lineCap: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, lineCap, _lineCap: lineCap } },
            `Graphics lineCap=${['butt','round','square'][lineCap] ?? lineCap} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxCap</span>
            {([['Butt', 0], ['Round', 1], ['Square', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyGraphicsLineCap(v)} title={`lineCap=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2175: 공통 cc.Graphics miterLimit 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsMiterLimit = async (miterLimit: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, miterLimit, _miterLimit: miterLimit } },
            `Graphics miterLimit=${miterLimit} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxMitr</span>
            {[1, 2, 5, 10, 20, 50].map(v => (
              <span key={v} onClick={() => applyGraphicsMiterLimit(v)} title={`miterLimit=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2194: 공통 cc.Graphics enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Graphics enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyGraphicsEnabled(v)} title={`Graphics enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2179: 공통 cc.Graphics fillOpacity + strokeOpacity 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGfxFillOpacity = async (fillOpacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, fillOpacity, _fillOpacity: fillOpacity } },
            `Graphics fillOpacity=${fillOpacity} (${uuids.length}개)`,
          )
        }
        const applyGfxStrokeOpacity = async (strokeOpacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => { ...c, props: { ...c.props, strokeOpacity, _strokeOpacity: strokeOpacity } },
            `Graphics strokeOpacity=${strokeOpacity} (${uuids.length}개)`,
          )
        }
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxFill%</span>
              {[0, 64, 128, 192, 255].map(v => (
                <span key={v} onClick={() => applyGfxFillOpacity(v)} title={`fillOpacity=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxStrk%</span>
              {[0, 64, 128, 192, 255].map(v => (
                <span key={v} onClick={() => applyGfxStrokeOpacity(v)} title={`strokeOpacity=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
          </>
        )
      })()}
      {/* R2172: 공통 cc.Widget enabled 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Widget enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>WgtEn</span>
            {([['enabled✓', true], ['enabled✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyWidgetEnabled(v)} title={`Widget enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2178: 공통 cc.UITransform priority 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.UITransform') && (() => {
        const applyUITransPriority = async (priority: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.UITransform',
            c => { ...c, props: { ...c.props, priority, _priority: priority } },
            `UITransform priority=${priority} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>UITPri</span>
            {[0, 1, 2, 5, 10, 100].map(v => (
              <span key={v} onClick={() => applyUITransPriority(v)} title={`priority=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2222: 공통 cc.UITransform _anchorPoint 프리셋 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.UITransform') && (() => {
        const applyUITransAnchor = async (ax: number, ay: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const _anchorPoint = { x: ax, y: ay }
            const components = n.components.map(c => c.type === 'cc.UITransform' ? { ...c, props: { ...c.props, _anchorPoint } } : c)
            return { ...n, components }
          }, `UITransform anchorPoint=(${ax},${ay}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>UITAnc</span>
            {([['C', 0.5, 0.5], ['TL', 0, 1], ['TR', 1, 1], ['BL', 0, 0], ['BR', 1, 0], ['TC', 0.5, 1], ['BC', 0.5, 0]] as [string, number, number][]).map(([l, ax, ay]) => (
              <span key={l} onClick={() => applyUITransAnchor(ax, ay)} title={`anchorPoint=(${ax},${ay})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1895: 공통 cc.UIOpacity opacity 일괄 설정 */}
      {commonCompTypes.includes('cc.UIOpacity') && (() => {
        const applyUIOpacity = async (opacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.UIOpacity',
            c => { ...c, props: { ...c.props, opacity, _opacity: opacity } },
            `U I Opacity`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>UIOpacity</span>
            {([0, 64, 128, 192, 255] as const).map(v => (
              <span key={v} title={`opacity = ${v}`}
                onClick={() => applyUIOpacity(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2217: 공통 cc.UIOpacity enabled (컴포넌트 레벨) 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.UIOpacity') && (() => {
        const applyUIOpacityEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.UIOpacity',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `UIOpacity enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>UIOpEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyUIOpacityEnabled(v)} title={`UIOpacity enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2195: 공통 cc.Toggle enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Toggle') && (() => {
        const applyToggleEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Toggle',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Toggle enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TGLComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyToggleEnabled(v)} title={`Toggle enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1764: 공통 cc.Toggle isChecked 일괄 설정 */}
      {commonCompTypes.includes('cc.Toggle') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>Toggle</span>
          {(['checked', 'unchecked'] as const).map(v => (
            <span key={v}
              title={`모두 ${v}`}
              onClick={async () => {
                if (!sceneFile.root) return
                const checked = v === 'checked'
                await patchComponents(
                  c => c.type === 'cc.Toggle',
                  c => { ...c, props: { ...c.props, isChecked: checked, _isChecked: checked, _N$isChecked: checked } },
                  `Toggle ${v} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: v === 'checked' ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
            >{v === 'checked' ? '✓ 체크' : '○ 해제'}</span>
          ))}
        </div>
      )}
      {/* R2106: 공통 cc.Toggle isChecked 일괄 설정 */}
      {commonCompTypes.includes('cc.Toggle') && (() => {
        const applyToggleCheck = async (isChecked: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Toggle',
            c => { ...c, props: { ...c.props, isChecked, _isChecked: isChecked } },
            `Toggle isChecked=${isChecked} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TogChk</span>
            <span onClick={() => applyToggleCheck(true)} title="isChecked ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>chk✓</span>
            <span onClick={() => applyToggleCheck(false)} title="isChecked OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>chk✗</span>
          </div>
        )
      })()}
      {/* R1900: 공통 cc.Toggle interactable 일괄 설정 */}
      {commonCompTypes.includes('cc.Toggle') && (() => {
        const applyToggleInteract = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Toggle',
            c => { ...c, props: { ...c.props, interactable, _interactable: interactable, _N$interactable: interactable } },
            `Toggle Interact`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TogInter</span>
            <span onClick={() => applyToggleInteract(true)} title="interactable ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>inter✓</span>
            <span onClick={() => applyToggleInteract(false)} title="interactable OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>inter✗</span>
          </div>
        )
      })()}
      {/* R2199: 공통 cc.ToggleContainer enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.ToggleContainer') && (() => {
        const applyTCEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ToggleContainer',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `ToggleContainer enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>TCComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyTCEnabled(v)} title={`ToggleContainer enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2182: 공통 cc.ToggleContainer autoCheckToggle 일괄 설정 */}
      {commonCompTypes.includes('cc.ToggleContainer') && (() => {
        const applyTCAutoCheck = async (autoCheckToggle: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ToggleContainer',
            c => { ...c, props: { ...c.props, autoCheckToggle, _autoCheckToggle: autoCheckToggle } },
            `ToggleContainer autoCheckToggle=${autoCheckToggle} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>TCauto</span>
            {([['auto✓', true], ['auto✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyTCAutoCheck(v)} title={`autoCheckToggle=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2132: 공통 cc.ToggleContainer allowSwitchOff 일괄 설정 */}
      {commonCompTypes.includes('cc.ToggleContainer') && (() => {
        const applyTCAllowSwitchOff = async (allowSwitchOff: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ToggleContainer',
            c => { ...c, props: { ...c.props, allowSwitchOff, _allowSwitchOff: allowSwitchOff } },
            `ToggleContainer allowSwitchOff=${allowSwitchOff} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TCswOff</span>
            <span onClick={() => applyTCAllowSwitchOff(true)} title="allowSwitchOff ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>sw✓</span>
            <span onClick={() => applyTCAllowSwitchOff(false)} title="allowSwitchOff OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>sw✗</span>
          </div>
        )
      })()}
      {/* R1908: 공통 cc.EditBox inputMode 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditBoxMode = async (inputMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, inputMode, _inputMode: inputMode } },
            `Edit Box Mode`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>EBmode</span>
            {([['Any', 0], ['Num', 2], ['Email', 1], ['1Line', 6]] as [string,number][]).map(([l, v]) => (
              <span key={v} title={`inputMode = ${l}`}
                onClick={() => applyEditBoxMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1915: 공통 cc.EditBox maxLength 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditBoxMax = async (maxLength: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, maxLength, _maxLength: maxLength } },
            `EditBox maxLength ${maxLength} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>EBmax</span>
            {([0, 8, 16, 32, 64, 128] as const).map(v => (
              <span key={v} title={`maxLength = ${v === 0 ? '∞' : v}`}
                onClick={() => applyEditBoxMax(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{v === 0 ? '∞' : v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1943: 공통 cc.EditBox fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditBoxFontSize = async (fontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, fontSize, _fontSize: fontSize, _N$fontSize: fontSize } },
            `EditBox fontSize=${fontSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBfont</span>
            {([16, 20, 24, 28, 32] as const).map(v => (
              <span key={v} title={`EditBox fontSize = ${v}`}
                onClick={() => applyEditBoxFontSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2198: 공통 cc.EditBox enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditBoxEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `EditBox enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>EBComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyEditBoxEnabled(v)} title={`EditBox enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2086: 공통 cc.EditBox inputFlag 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditInputFlag = async (inputFlag: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, inputFlag, _inputFlag: inputFlag, _N$inputFlag: inputFlag } },
            `EditBox inputFlag=${inputFlag} (${uuids.length}개)`,
          )
        }
        // 0=Default, 1=InitialCapsFWord, 2=InitialCapsSentence, 3=InitialCapsAllChars, 4=Sensitive
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBflg</span>
            {([0, 1, 4] as const).map((v, i) => (
              <span key={v} title={`inputFlag = ${v} (${['Def','Init','Sens'][i]})`}
                onClick={() => applyEditInputFlag(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{['Def','Init','Sens'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2208: 공통 cc.EditBox placeholderFontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEBPlaceholderFS = async (placeholderFontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, placeholderFontSize, _placeholderFontSize: placeholderFontSize, _N$placeholderFontSize: placeholderFontSize } },
            `EditBox placeholderFontSize=${placeholderFontSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>EBphFS</span>
            {[12, 14, 16, 18, 20, 24, 28].map(v => (
              <span key={v} onClick={() => applyEBPlaceholderFS(v)} title={`placeholderFontSize=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2208: 공통 cc.EditBox fontColor 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEBFontColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorObj = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, fontColor: colorObj, _fontColor: colorObj, _N$fontColor: colorObj } },
            `EditBox fontColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>EBfColor</span>
            {(['#ffffff', '#000000', '#cccccc', '#888888', '#ff0000', '#00ff00', '#0000ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyEBFontColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block', flexShrink: 0 }} />
            ))}
          </div>
        )
      })()}
      {/* R2177: 공통 cc.EditBox lineCount 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditLineCount = async (lineCount: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, lineCount, _lineCount: lineCount, _N$lineCount: lineCount } },
            `EditBox lineCount=${lineCount} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>EBlines</span>
            {[1, 2, 3, 5, 10, 0].map(v => (
              <span key={v} onClick={() => applyEditLineCount(v)} title={`lineCount=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2105: 공통 cc.EditBox maxLength 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditMaxLen = async (maxLength: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, maxLength, _maxLength: maxLength } },
            `EditBox maxLength=${maxLength} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EditMax</span>
            {[0, 10, 20, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyEditMaxLen(v)} title={`maxLength=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2110: 공통 cc.EditBox tabIndex 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditTabIndex = async (tabIndex: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, tabIndex, _tabIndex: tabIndex } },
            `EditBox tabIndex=${tabIndex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EditTab</span>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <span key={v} onClick={() => applyEditTabIndex(v)} title={`tabIndex=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2085: 공통 cc.EditBox inputMode 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditInputMode = async (inputMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, inputMode, _inputMode: inputMode, _N$inputMode: inputMode } },
            `EditBox inputMode=${inputMode} (${uuids.length}개)`,
          )
        }
        // 0=Any, 1=EmailAddr, 2=Numeric, 3=PhoneNum, 4=URL, 5=Decimal, 6=SingleLine
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBinM</span>
            {([0, 2, 5, 6] as const).map((v, i) => (
              <span key={v} title={`inputMode = ${v} (${['Any','Num','Dec','1L'][i]})`}
                onClick={() => applyEditInputMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{['Any','Num','Dec','1L'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R1986: 공통 cc.EditBox returnType 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditReturnType = async (returnType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, returnType, _returnType: returnType, _N$returnType: returnType } },
            `Edit Return Type`,
          )
          const names = ['Dflt', 'Done', 'Send', 'Srch', 'Go', 'Next']
          setBatchMsg(`✓ EditBox returnType=${names[returnType] ?? returnType} (${uuids.length}개)`) // R2238: _returnType CC3.x
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBret</span>
            {([['Dflt', 0], ['Done', 1], ['Send', 2], ['Go', 4]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyEditReturnType(v)} title={`returnType=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1884: 공통 cc.Button transition 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnTransition = async (transition: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, transition, _transition: transition } },
            `Btn Transition`,
          )
          const names = ['None', 'Color', 'Sprite', 'Scale']
          setBatchMsg(`✓ Button transition=${names[transition] ?? transition} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnTrans</span>
            {(['None', 'Color', 'Sprite', 'Scale'] as const).map((l, v) => (
              <span key={v} title={`transition = ${l}`}
                onClick={() => applyBtnTransition(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1897: 공통 cc.Button zoomScale 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnZoom = async (zoom: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, zoomScale: zoom, _zoomScale: zoom, _N$zoomScale: zoom } },
            `Btn Zoom`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnZoom</span>
            {([0.9, 1.0, 1.1, 1.2, 1.3, 1.5] as const).map(v => (
              <span key={v} title={`zoomScale = ${v}`}
                onClick={() => applyBtnZoom(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2020: 공통 cc.Button interactable 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnInteract = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, interactable, _interactable: interactable, _N$interactable: interactable } },
            `Button interactable=${interactable} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>BtnIA</span>
            {([['ia✓',true],['ia✗',false]] as [string,boolean][]).map(([label,v]) => (
              <span key={label} onClick={() => applyBtnInteract(v)} title={`interactable=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2192: 공통 cc.Button enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyButtonEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Button enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#e879f9', width: 48, flexShrink: 0 }}>BtnComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyButtonEnabled(v)} title={`Button enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#e879f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2165: 공통 cc.Button autoGray 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnAutoGray = async (autoGrayEffect: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, autoGrayEffect, _autoGrayEffect: autoGrayEffect, _N$autoGrayEffect: autoGrayEffect } },
            `Button autoGray=${autoGrayEffect} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>BtnGry</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`autoGrayEffect = ${v}`}
                onClick={() => applyBtnAutoGray(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v ? 'gray✓' : 'gray✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1945: 공통 cc.Button normalColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnNormalColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, normalColor: col, _normalColor: col, _N$normalColor: col } },
            `Button normalColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnNorm</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyBtnNormalColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#cccccc','#ff9999','#99ccff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyBtnNormalColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1946: 공통 cc.Button pressedColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnPressedColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, pressedColor: col, _pressedColor: col, _N$pressedColor: col } },
            `Button pressedColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnPress</span>
            <input type="color" defaultValue="#cccccc"
              onChange={e => applyBtnPressedColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#c8c8c8','#aaaaaa','#ff6666','#6699ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyBtnPressedColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1947: 공통 cc.Button disabledColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnDisabledColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 200 }
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, disabledColor: col, _disabledColor: col, _N$disabledColor: col } },
            `Button disabledColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnDis</span>
            <input type="color" defaultValue="#787878"
              onChange={e => applyBtnDisabledColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#787878','#555555','#aaaaaa','#ffaaaa'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyBtnDisabledColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2130: 공통 cc.Button hoverColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnHoverColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, hoverColor: { r, g, b, a: 255 }, _hoverColor: { r, g, b, a: 255 }, _N$hoverColor: { r, g, b, a: 255 } } },
            `Button hoverColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnHovC</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyBtnHoverColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ccddff','#aabbff','#ffffff','#dddddd'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyBtnHoverColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1948: 공통 cc.Button duration 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnDuration = async (duration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, duration, _duration: duration } },
            `Button duration=${duration}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnDur</span>
            {([0.1, 0.2, 0.3, 0.5, 1] as const).map(v => (
              <span key={v} title={`Button duration = ${v}s`}
                onClick={() => applyBtnDuration(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R1769: 공통 cc.Button interactable 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>Button</span>
          {(['on', 'off'] as const).map(v => (
            <span key={v}
              title={`interactable 모두 ${v === 'on' ? '활성화' : '비활성화'}`}
              onClick={async () => {
                if (!sceneFile.root) return
                const interact = v === 'on'
                await patchComponents(
                  c => c.type === 'cc.Button',
                  c => { ...c, props: { ...c.props, interactable: interact, _interactable: interact, _N$interactable: interact } },
                  `Button ${v === 'on' ? '활성' : '비활성'} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: v === 'on' ? '#4ade80' : '#f87171', userSelect: 'none' }}
            >{v === 'on' ? '✓ 활성' : '✕ 비활성'}</span>
          ))}
        </div>
      )}
      {/* R2196: 공통 cc.AudioSource enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `AudioSource enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyAudioEnabled(v)} title={`AudioSource enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1761: 공통 cc.AudioSource volume 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>Audio vol</span>
          <input type="range" min={0} max={1} step={0.01} defaultValue={1}
            onMouseUp={async e => {
              const vol = parseFloat((e.target as HTMLInputElement).value)
              if (!sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.AudioSource',
                c => { ...c, props: { ...c.props, volume: vol, _volume: vol, _N$volume: vol } },
                `volume ${Math.round(vol * 100)}% (${uuids.length}개)`,
              )
            }}
            style={{ flex: 1 }}
          />
        </div>
      )}
      {/* R2219: 공통 cc.LabelOutline enabled (컴포넌트 레벨) 일괄 설정 (CC2.x) */}
      {commonCompTypes.includes('cc.LabelOutline') && (() => {
        const applyLabelOutlineEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelOutline',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `LabelOutline enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>OutEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelOutlineEnabled(v)} title={`LabelOutline enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2219: 공통 cc.LabelShadow enabled (컴포넌트 레벨) 일괄 설정 (CC2.x) */}
      {commonCompTypes.includes('cc.LabelShadow') && (() => {
        const applyLabelShadowEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelShadow',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `LabelShadow enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>ShdEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelShadowEnabled(v)} title={`LabelShadow enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1861: 공통 cc.LabelShadow blur 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelShadow') && (() => {
        const applyShadowBlur = async (blur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelShadow',
            c => { ...c, props: { ...c.props, blur, _blur: blur } },
            `LabelShadow blur=${blur} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Shadow</span>
            {([0, 1, 2, 3, 5, 8] as const).map(v => (
              <span key={v} title={`shadow blur = ${v}`}
                onClick={() => applyShadowBlur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1860: 공통 cc.LabelOutline width 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelOutline') && (() => {
        const applyOutlineWidth = async (width: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelOutline',
            c => { ...c, props: { ...c.props, width, _width: width, _N$width: width } },
            `LabelOutline w=${width} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Outline</span>
            {([0, 1, 2, 3, 4, 5] as const).map(v => (
              <span key={v} title={`outline width = ${v}`}
                onClick={() => applyOutlineWidth(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1909: 공통 cc.LabelOutline color 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelOutline') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>OL color</span>
          <input type="color" defaultValue="#000000"
            onChange={async e => {
              const hex = e.target.value
              if (!sceneFile.root) return
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              const col = { r, g, b, a: 255 }
              await patchComponents(
                c => c.type === 'cc.LabelOutline',
                c => { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } },
                `O L Color`,
              )
            }}
            style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
            title="cc.LabelOutline 색상 일괄 설정"
          />
        </div>
      )}
      {/* R1963: 공통 cc.LabelOutline width 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelOutline') && (() => {
        const applyLabelOutlineWidth = async (width: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelOutline',
            c => { ...c, props: { ...c.props, width, _width: width, _N$width: width } },
            `LabelOutline width=${width} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>OLwidth</span>
            {([1, 2, 3, 4, 5] as const).map(v => (
              <span key={v} title={`LabelOutline width = ${v}`}
                onClick={() => applyLabelOutlineWidth(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1910: 공통 cc.LabelShadow color 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelShadow') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Shd clr</span>
          <input type="color" defaultValue="#000000"
            onChange={async e => {
              const hex = e.target.value
              if (!sceneFile.root) return
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              const col = { r, g, b, a: 255 }
              await patchComponents(
                c => c.type === 'cc.LabelShadow',
                c => { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } },
                `Shadow Color`,
              )
            }}
            style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
            title="cc.LabelShadow 색상 일괄 설정"
          />
        </div>
      )}
      {/* R1964: 공통 cc.LabelShadow blur 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelShadow') && (() => {
        const applyLabelShadowBlur = async (blur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelShadow',
            c => { ...c, props: { ...c.props, blur, _blur: blur, _N$blur: blur } },
            `LabelShadow blur=${blur} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Shdblur</span>
            {([0, 1, 2, 3, 5] as const).map(v => (
              <span key={v} title={`LabelShadow blur = ${v}`}
                onClick={() => applyLabelShadowBlur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1965: 공통 cc.LabelShadow offset 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelShadow') && (() => {
        const applyLabelShadowOffset = async (x: number, y: number) => {
          if (!sceneFile.root) return
          const offset = { x, y }
          await patchComponents(
            c => c.type === 'cc.LabelShadow',
            c => { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } },
            `LabelShadow offset=(${x},${y}) (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Shdofs</span>
            {([[1,1],[2,2],[3,3],[0,1],[1,0]] as const).map(([x,y]) => (
              <span key={`${x}-${y}`} title={`offset=(${x},${y})`}
                onClick={() => applyLabelShadowOffset(x, y)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{x},{y}</span>
            ))}
          </div>
        )
      })()}
      {/* R1859: 공통 cc.ScrollView horizontal/vertical/inertia 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollToggle = async (key: 'horizontal' | 'vertical' | 'inertia', value: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, [key]: value, [`_${key}`]: value, [`_N$${key}`]: value } },
            `ScrollView ${key}=${value} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>ScrollV</span>
            <span onClick={() => applyScrollToggle('horizontal', true)} title="horizontal ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>H✓</span>
            <span onClick={() => applyScrollToggle('horizontal', false)} title="horizontal OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>H✗</span>
            <span onClick={() => applyScrollToggle('vertical', true)} title="vertical ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>V✓</span>
            <span onClick={() => applyScrollToggle('vertical', false)} title="vertical OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>V✗</span>
            <span onClick={() => applyScrollToggle('inertia', true)} title="inertia ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>iner✓</span>
            <span onClick={() => applyScrollToggle('inertia', false)} title="inertia OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>iner✗</span>
          </div>
        )
      })()}
      {/* R1876: 공통 cc.ScrollView brake 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollBrake = async (brake: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, brake, _brake: brake, _N$brake: brake } },
            `ScrollView brake=${brake} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVbrake</span>
            {([0, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`brake = ${v}`}
                onClick={() => applyScrollBrake(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1935: 공통 cc.ScrollView elastic 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollElastic = async (elastic: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, elastic, _elastic: elastic, _N$elastic: elastic } },
            `ScrollView elastic=${elastic} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVelast</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`elastic = ${v}`}
                onClick={() => applyScrollElastic(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v ? 'el✓' : 'el✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1928: 공통 cc.ScrollView elasticDuration 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyElasticDur = async (elasticDuration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, elasticDuration, _elasticDuration: elasticDuration, _N$elasticDuration: elasticDuration } },
            `ScrollView elasticDuration=${elasticDuration} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVelast</span>
            {([0.1, 0.2, 0.3, 0.5, 1] as const).map(v => (
              <span key={v} title={`elasticDuration = ${v}s`}
                onClick={() => applyElasticDur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1949: 공통 cc.ScrollView bounceDuration 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVBounceDur = async (bounceDuration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, bounceDuration, _bounceDuration: bounceDuration, _N$bounceDuration: bounceDuration } },
            `ScrollView bounceDur=${bounceDuration}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVbounce</span>
            {([0.1, 0.2, 0.3, 0.5, 1] as const).map(v => (
              <span key={v} title={`bounceDuration = ${v}s`}
                onClick={() => applySVBounceDur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2169: 공통 cc.ScrollView scrollDuration 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVScrollDur = async (scrollDuration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, scrollDuration, _scrollDuration: scrollDuration, _N$scrollDuration: scrollDuration } },
            `ScrollView scrollDuration=${scrollDuration}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVsdur</span>
            {[0, 0.1, 0.3, 0.5, 1].map(v => (
              <span key={v} onClick={() => applySVScrollDur(v)} title={`scrollDuration=${v}s`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2181: 공통 cc.ScrollView mouseWheelScrollSensitivity 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVMouseWheelSens = async (mouseWheelScrollSensitivity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, mouseWheelScrollSensitivity, _mouseWheelScrollSensitivity: mouseWheelScrollSensitivity, _N$mouseWheelScrollSensitivity: mouseWheelScrollSensitivity } },
            `ScrollView mouseWheelSens=${mouseWheelScrollSensitivity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVwhl</span>
            {[0.5, 1, 2, 3, 5, 10].map(v => (
              <span key={v} onClick={() => applySVMouseWheelSens(v)} title={`mouseWheelScrollSensitivity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2193: 공통 cc.ScrollView enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `ScrollView enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySVEnabled(v)} title={`ScrollView enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2180: 공통 cc.ScrollView hideScrollBar 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVHideScrollBar = async (hideScrollBar: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, hideScrollBar, _hideScrollBar: hideScrollBar, _N$hideScrollBar: hideScrollBar } },
            `ScrollView hideScrollBar=${hideScrollBar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVhide</span>
            {([['hide✓', true], ['hide✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySVHideScrollBar(v)} title={`hideScrollBar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2185: 공통 cc.ScrollBar enableAutoHide + autoHideTime 일괄 설정 */}
      {commonCompTypes.includes('cc.Scrollbar') && (() => {
        const applySBAutoHide = async (enableAutoHide: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => { ...c, props: { ...c.props, enableAutoHide, _enableAutoHide: enableAutoHide, _N$enableAutoHide: enableAutoHide } },
            `Scrollbar enableAutoHide=${enableAutoHide} (${uuids.length}개)`,
          )
        }
        const applySBAutoHideTime = async (autoHideTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => { ...c, props: { ...c.props, autoHideTime, _autoHideTime: autoHideTime, _N$autoHideTime: autoHideTime } },
            `Scrollbar autoHideTime=${autoHideTime} (${uuids.length}개)`,
          )
        }
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SBhide</span>
              {([['hide✓', true], ['hide✗', false]] as const).map(([l, v]) => (
                <span key={String(v)} onClick={() => applySBAutoHide(v)} title={`enableAutoHide=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SBhideT</span>
              {[0.5, 1, 2, 3, 5].map(v => (
                <span key={v} onClick={() => applySBAutoHideTime(v)} title={`autoHideTime=${v}s`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
          </>
        )
      })()}
      {/* R2198: 공통 cc.Scrollbar enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Scrollbar') && (() => {
        const applyScrollbarEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Scrollbar enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SBComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyScrollbarEnabled(v)} title={`Scrollbar enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2186: 공통 cc.Scrollbar direction 일괄 설정 */}
      {commonCompTypes.includes('cc.Scrollbar') && (() => {
        const applySBDir = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => { ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } },
            `Scrollbar direction=${direction === 0 ? 'H' : 'V'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SBdir</span>
            <span onClick={() => applySBDir(0)} title="direction=Horizontal"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>H→</span>
            <span onClick={() => applySBDir(1)} title="direction=Vertical"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>V↓</span>
          </div>
        )
      })()}
      {/* R2174: 공통 cc.ScrollView bounceTime 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVBounceTime = async (bounceTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, bounceTime, _bounceTime: bounceTime, _N$bounceTime: bounceTime } },
            `ScrollView bounceTime=${bounceTime} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVbncT</span>
            {[0, 0.1, 0.2, 0.5, 1].map(v => (
              <span key={v} onClick={() => applySVBounceTime(v)} title={`bounceTime=${v}s`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2065: 공통 cc.ScrollView bounce 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollBounce = async (bounce: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, bounce, _bounce: bounce, _N$bounce: bounce } },
            `ScrollView bounce=${bounce} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVbnce</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`bounce = ${v}`}
                onClick={() => applyScrollBounce(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v ? 'bnc✓' : 'bnc✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2104: 공통 cc.ScrollView inertia 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollInertia = async (inertia: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, inertia, _inertia: inertia } },
            `ScrollView inertia=${inertia} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVInert</span>
            <span onClick={() => applyScrollInertia(true)} title="inertia ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>ine✓</span>
            <span onClick={() => applyScrollInertia(false)} title="inertia OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>ine✗</span>
          </div>
        )
      })()}
      {/* R2115: 공통 cc.ScrollView horizontal 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVHoriz = async (horizontal: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, horizontal, _horizontal: horizontal, _N$horizontal: horizontal } },
            `ScrollView horizontal=${horizontal} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVHoriz</span>
            <span onClick={() => applySVHoriz(true)} title="horizontal ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>H✓</span>
            <span onClick={() => applySVHoriz(false)} title="horizontal OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>H✗</span>
          </div>
        )
      })()}
      {/* R2116: 공통 cc.ScrollView vertical 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVVert = async (vertical: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, vertical, _vertical: vertical, _N$vertical: vertical } },
            `ScrollView vertical=${vertical} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVVert</span>
            <span onClick={() => applySVVert(true)} title="vertical ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>V✓</span>
            <span onClick={() => applySVVert(false)} title="vertical OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>V✗</span>
          </div>
        )
      })()}
      {/* R2168: 공통 cc.ScrollView cancelInnerEvents 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVCancelInner = async (cancelInnerEvents: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, cancelInnerEvents, _cancelInnerEvents: cancelInnerEvents, _N$cancelInnerEvents: cancelInnerEvents } },
            `ScrollView cancelInnerEvents=${cancelInnerEvents} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVCancel</span>
            <span onClick={() => applySVCancelInner(true)} title="cancelInnerEvents ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>cin✓</span>
            <span onClick={() => applySVCancelInner(false)} title="cancelInnerEvents OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>cin✗</span>
          </div>
        )
      })()}
      {/* R2004: 공통 cc.ScrollView pagingEnabled 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVPaging = async (pagingEnabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, pagingEnabled, _pagingEnabled: pagingEnabled, _N$pagingEnabled: pagingEnabled } },
            `ScrollView paging=${pagingEnabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVpaging</span>
            <span onClick={() => applySVPaging(true)} title="pagingEnabled ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>pg✓</span>
            <span onClick={() => applySVPaging(false)} title="pagingEnabled OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>pg✗</span>
          </div>
        )
      })()}
      {/* R1980: 공통 cc.ScrollView speedAmplifier 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVSpeed = async (speedAmplifier: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, speedAmplifier, _speedAmplifier: speedAmplifier, _N$speedAmplifier: speedAmplifier } },
            `ScrollView speedAmplifier=${speedAmplifier} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVspeed</span>
            {([0.5, 1, 1.5, 2, 3] as const).map(v => (
              <span key={v} onClick={() => applySVSpeed(v)} title={`speedAmplifier = ${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R2077: 공통 cc.PageView pageTurningSpeed 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVTurnSpeed = async (pageTurningSpeed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, pageTurningSpeed, _pageTurningSpeed: pageTurningSpeed, _N$pageTurningSpeed: pageTurningSpeed } },
            `PageView pageTurningSpeed=${pageTurningSpeed} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>PVspd</span>
            {[0.1, 0.3, 0.5, 1, 1.5, 2].map(v => (
              <span key={v} title={`pageTurningSpeed = ${v}`}
                onClick={() => applyPVTurnSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2200: 공통 cc.PageView enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `PageView enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PVComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyPVEnabled(v)} title={`PageView enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2180: 공통 cc.PageView effectType 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVEffectType = async (effectType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, effectType, _effectType: effectType, _N$effectType: effectType } },
            `PageView effectType=${['NONE','SCROLL','FADE'][effectType] ?? effectType} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PVeffect</span>
            {([['NONE', 0], ['SCROLL', 1], ['FADE', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyPVEffectType(v)} title={`effectType=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2067: 공통 cc.PageView direction 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPageViewDir = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } },
            `PageView direction=${direction} (${uuids.length}개)`,
          )
        }
        // 0=Horizontal, 1=Vertical
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>PVdir</span>
            {([0, 1] as const).map((v, i) => (
              <span key={v} title={`direction = ${v} (${['Horizontal','Vertical'][i]})`}
                onClick={() => applyPageViewDir(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{['H','V'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R1936: 공통 cc.PageView bounceEnabled 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVBounce = async (v: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, bounceEnabled: v, _bounceEnabled: v, _N$bounceEnabled: v } },
            `PageView bounce=${v} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVbounce</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`bounceEnabled = ${v}`}
                onClick={() => applyPVBounce(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v ? 'bnc✓' : 'bnc✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2111: 공통 cc.PageView autoPageTurningThreshold 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVAutoThresh = async (threshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, autoPageTurningThreshold: threshold, _autoPageTurningThreshold: threshold, _N$autoPageTurningThreshold: threshold } },
            `PageView autoPageTurningThreshold=${threshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVAutoT</span>
            {[0.1, 0.2, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} onClick={() => applyPVAutoThresh(v)} title={`autoPageTurningThreshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1967: 공통 cc.PageView scrollThreshold 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVScrollThresh = async (threshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, scrollThreshold: threshold, _scrollThreshold: threshold, _N$scrollThreshold: threshold } },
            `PageView scrollThresh=${threshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVthresh</span>
            {([0.1, 0.2, 0.3, 0.5] as const).map(v => (
              <span key={v} title={`scrollThreshold = ${v}`}
                onClick={() => applyPVScrollThresh(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2206: 공통 cc.PageView autoPlay 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVAutoPlay = async (autoPlay: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, autoPlay, _autoPlay: autoPlay } },
            `PageView autoPlay=${autoPlay} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PVauto</span>
            {([['auto✓', true], ['auto✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyPVAutoPlay(v)} title={`autoPlay=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1966: 공통 cc.PageView autoPageTurningInterval 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVAutoInterval = async (interval: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, autoPageTurningInterval: interval, _autoPageTurningInterval: interval, _N$autoPageTurningInterval: interval } },
            `PageView autoInterval=${interval}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVauto</span>
            {([0, 1, 2, 3, 5] as const).map(v => (
              <span key={v} title={`autoPageTurningInterval = ${v}s`}
                onClick={() => applyPVAutoInterval(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R1991: 공통 cc.PageView pageTurningEventTiming 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVEventTiming = async (pageTurningEventTiming: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, pageTurningEventTiming, _pageTurningEventTiming: pageTurningEventTiming, _N$pageTurningEventTiming: pageTurningEventTiming } },
            `PageView eventTiming=${pageTurningEventTiming} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVevTim</span>
            {([0, 0.1, 0.2, 0.3, 0.5, 1].map(v => (
              <span key={v} onClick={() => applyPVEventTiming(v)} title={`pageTurningEventTiming=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            )))}
          </div>
        )
      })()}
      {/* R1875: 공통 cc.PageView slideDuration 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVSlideDur = async (dur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, slideDuration: dur, _slideDuration: dur, _N$slideDuration: dur } },
            `PageView slideDur ${dur}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVslide</span>
            {([0.1, 0.2, 0.3, 0.5, 1] as const).map(v => (
              <span key={v} title={`slideDuration = ${v}s`}
                onClick={() => applyPVSlideDur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R1858: 공통 cc.PageView direction 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVDir = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } },
            `PageView dir=${direction === 0 ? 'H' : 'V'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PageView</span>
            <span onClick={() => applyPVDir(0)} title="방향: Horizontal" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>H→</span>
            <span onClick={() => applyPVDir(1)} title="방향: Vertical" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>V↓</span>
          </div>
        )
      })()}
      {/* R1795: 공통 cc.AudioSource loop/playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>Audio</span>
          {([
            { label: '✓ loop', key: 'loop', val: true },
            { label: '✕ loop', key: 'loop', val: false },
            { label: '▶ auto', key: 'playOnLoad', val: true },
            { label: '○ auto', key: 'playOnLoad', val: false },
          ] as const).map(({ label, key, val }) => (
            <span key={`${key}${val}`}
              title={`${key} = ${val} (모든 선택 노드)`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.AudioSource',
                  c => { ...c, props: { ...c.props, [key]: val, [`_${key}`]: val, [`_N$${key}`]: val } },
                  `${key} ${val} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: val ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R1816: 공통 cc.Animation playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>Anim</span>
          {([
            { label: '▶ auto', key: 'playOnLoad', val: true },
            { label: '○ auto', key: 'playOnLoad', val: false },
          ] as const).map(({ label, key, val }) => (
            <span key={`${key}${val}`}
              title={`${key} = ${val}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Animation',
                  c => { ...c, props: { ...c.props, [key]: val, [`_${key}`]: val, [`_N$${key}`]: val } },
                  `Animation ${key} ${val} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: val ? '#fbbf24' : 'var(--text-muted)', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R2191: 공통 cc.Animation enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Animation enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>AnimComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyAnimEnabled(v)} title={`Animation enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2186: 공통 cc.Animation sample 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimSample = async (sample: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => { ...c, props: { ...c.props, sample, _sample: sample, _N$sample: sample } },
            `Animation sample=${sample} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>AnimSmp</span>
            {[24, 30, 48, 60, 120].map(v => (
              <span key={v} onClick={() => applyAnimSample(v)} title={`sample=${v}fps`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2052: 공통 cc.Animation speed 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimSpeed = async (speed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => { ...c, props: { ...c.props, speed, _speed: speed, _N$speed: speed } },
            `Animation speed=${speed}x (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>AnimSpd</span>
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map(v => (
              <span key={v} onClick={() => applyAnimSpeed(v)} title={`speed=${v}x`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R1984: 공통 cc.Animation wrapMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimWrapMode = async (wrapMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => { ...c, props: { ...c.props, defaultClipSettings: { ...(c.props.defaultClipSettings as object ?? {}), wrapMode } } },
            `Anim Wrap Mode`,
          )
          const names: Record<number, string> = { 0: 'Default', 1: 'Normal', 2: 'Loop', 3: 'PingPong', 4: 'Reverse', 5: 'LoopRev' }
          setBatchMsg(`✓ Anim wrapMode=${names[wrapMode] ?? wrapMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>AnimWrap</span>
            {([['Dflt', 0], ['Norm', 1], ['Loop', 2], ['Ping', 3]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyAnimWrapMode(v)} title={`wrapMode=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fbbf24', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2220: 공통 cc.WebView enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.WebView') && (() => {
        const applyWebViewEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.WebView',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `WebView enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>WVEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyWebViewEnabled(v)} title={`WebView enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2196: 공통 cc.VideoPlayer enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `VideoPlayer enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VPComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyVideoEnabled(v)} title={`VideoPlayer enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1842: 공통 cc.VideoPlayer loop/muted 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoToggle = async (key: 'loop' | 'muted', value: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, [key]: value, [`_${key}`]: value, [`_N$${key}`]: value } },
            `VideoPlayer ${key}=${value} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>Video</span>
            <span onClick={() => applyVideoToggle('loop', true)} title="loop ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>loop✓</span>
            <span onClick={() => applyVideoToggle('loop', false)} title="loop OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>loop✗</span>
            <span onClick={() => applyVideoToggle('muted', true)} title="muted ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>mute✓</span>
            <span onClick={() => applyVideoToggle('muted', false)} title="muted OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>mute✗</span>
          </div>
        )
      })()}
      {/* R1877: 공통 cc.VideoPlayer playbackRate 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoPBRate = async (rate: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, playbackRate: rate, _playbackRate: rate, _N$playbackRate: rate } },
            `VideoPlayer ×${rate} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VideoPB</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`playbackRate = ${v}`}
                onClick={() => applyVideoPBRate(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >×{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2005: 공통 cc.VideoPlayer fullScreenEnabled 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoFullscreen = async (fullScreenEnabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, fullScreenEnabled, _fullScreenEnabled: fullScreenEnabled, _N$fullScreenEnabled: fullScreenEnabled } },
            `VideoPlayer fullscreen=${fullScreenEnabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VideoFS</span>
            <span onClick={() => applyVideoFullscreen(true)} title="fullScreenEnabled ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>fs✓</span>
            <span onClick={() => applyVideoFullscreen(false)} title="fullScreenEnabled OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>fs✗</span>
          </div>
        )
      })()}
      {/* R2075: 공통 cc.VideoPlayer volume 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoVol = async (volume: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, volume, _volume: volume, _N$volume: volume } },
            `VideoPlayer volume=${volume} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VPvol</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <span key={v} title={`volume = ${v}`}
                onClick={() => applyVideoVol(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R2224: 공통 cc.VideoPlayer keepAspectRatio 토글 (CC3.x) */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoKeepAspect = async (keepAspectRatio: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, keepAspectRatio, _keepAspectRatio: keepAspectRatio } },
            `VideoPlayer keepAspectRatio=${keepAspectRatio} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>VPAsp</span>
            {([['비율✓', true], ['비율✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyVideoKeepAspect(v)} title={`keepAspectRatio=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2103: 공통 cc.VideoPlayer muted 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoMuted = async (muted: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, muted, _muted: muted } },
            `VideoPlayer muted=${muted} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VidMute</span>
            <span onClick={() => applyVideoMuted(true)} title="muted ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>mute✓</span>
            <span onClick={() => applyVideoMuted(false)} title="muted OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>mute✗</span>
          </div>
        )
      })()}
      {/* R2046: 공통 cc.VideoPlayer resourceType 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoResType = async (resourceType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, resourceType, _resourceType: resourceType, _N$resourceType: resourceType } },
            `Video Res Type`,
          )
          const names = ['Local','Remote']
          setBatchMsg(`✓ VideoPlayer resourceType=${names[resourceType]??resourceType} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>VidResT</span>
            {([['Local',0],['Remote',1]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyVideoResType(v)} title={`resourceType=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2000: 공통 cc.VideoPlayer keepAspectRatio 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoKeepAspect = async (keepAspectRatio: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, keepAspectRatio, _keepAspectRatio: keepAspectRatio, _N$keepAspectRatio: keepAspectRatio } },
            `VideoPlayer keepAspect=${keepAspectRatio} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VideoAR</span>
            <span onClick={() => applyVideoKeepAspect(true)} title="keepAspectRatio ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>ar✓</span>
            <span onClick={() => applyVideoKeepAspect(false)} title="keepAspectRatio OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>ar✗</span>
          </div>
        )
      })()}
      {/* R2165: 공통 cc.VideoPlayer startTime 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoStart = async (startTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => { ...c, props: { ...c.props, startTime, _startTime: startTime, _N$startTime: startTime } },
            `VideoPlayer startTime=${startTime}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VidSt</span>
            {([0, 1, 2, 5, 10, 30] as const).map(v => (
              <span key={v} title={`startTime = ${v}s`}
                onClick={() => applyVideoStart(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2137: 공통 cc.MotionStreak fastMode 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSFastMode = async (fastMode: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, fastMode, _fastMode: fastMode } },
            `MotionStreak fastMode=${fastMode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSFast</span>
            <span onClick={() => applyMSFastMode(true)} title="fastMode ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>fast✓</span>
            <span onClick={() => applyMSFastMode(false)} title="fastMode OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>fast✗</span>
          </div>
        )
      })()}
      {/* R2107: 공통 cc.MotionStreak color 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 }, _N$color: { r, g, b, a: 255 } } },
            `MotionStreak color=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSColor</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyMSColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ffffff','#ffff00','#ff4444','#44aaff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyMSColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2076: 공통 cc.MotionStreak stroke 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSStroke = async (stroke: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, stroke, _stroke: stroke, _N$stroke: stroke } },
            `MotionStreak stroke=${stroke} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSstroke</span>
            {[5, 10, 20, 30, 50, 80].map(v => (
              <span key={v} title={`stroke = ${v}`}
                onClick={() => applyMSStroke(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2071: 공통 cc.MotionStreak fade 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSFade = async (fade: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, fade, _fade: fade, _N$fade: fade } },
            `MotionStreak fade=${fade} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSfade</span>
            {[0.1, 0.3, 0.5, 0.7, 1, 2].map(v => (
              <span key={v} title={`fade = ${v}`}
                onClick={() => applyMSFade(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2036: 공통 cc.MotionStreak minSeg 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSMinSeg = async (minSeg: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, minSeg, _minSeg: minSeg, _N$minSeg: minSeg } },
            `MotionStreak minSeg=${minSeg} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSminSeg</span>
            {[1, 2, 5, 10, 20, 50].map(v => (
              <span key={v} onClick={() => applyMSMinSeg(v)} title={`minSeg=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2200: 공통 cc.MotionStreak enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `MotionStreak enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#c8a', width: 48, flexShrink: 0 }}>MSComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyMotionEnabled(v)} title={`MotionStreak enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#c8a', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2190: 공통 cc.MotionStreak timeToLive 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSTtl = async (time: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, timeToLive: time, _timeToLive: time } },
            `MotionStreak timeToLive=${time} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#c8a', width: 48, flexShrink: 0 }}>MStlive</span>
            {[0.1, 0.2, 0.5, 1, 2, 3].map(v => (
              <span key={v} onClick={() => applyMSTtl(v)} title={`timeToLive=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#c8a', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2175: 공통 cc.MotionStreak speedThreshold 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSSpeedThresh = async (speedThreshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, speedThreshold, _speedThreshold: speedThreshold, _N$speedThreshold: speedThreshold } },
            `MotionStreak speedThreshold=${speedThreshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSspThr</span>
            {[1, 5, 10, 20, 50, 100].map(v => (
              <span key={v} onClick={() => applyMSSpeedThresh(v)} title={`speedThreshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1883: 공통 cc.MotionStreak stroke 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionStroke = async (stroke: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, stroke, _stroke: stroke, _N$stroke: stroke } },
            `MotionStreak stroke=${stroke} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSstroke</span>
            {([8, 16, 32, 64, 128] as const).map(v => (
              <span key={v} title={`stroke = ${v}`}
                onClick={() => applyMotionStroke(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1880: 공통 cc.MotionStreak fade 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionFade = async (fade: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, fade, _fade: fade, _N$fade: fade } },
            `MotionStreak fade=${fade} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSfade</span>
            {([0.1, 0.3, 0.5, 1, 2, 3] as const).map(v => (
              <span key={v} title={`fade = ${v}s`}
                onClick={() => applyMotionFade(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1926: 공통 cc.MotionStreak minSeg 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionSeg = async (minSeg: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, minSeg, _minSeg: minSeg, _N$minSeg: minSeg } },
            `MotionStreak minSeg ${minSeg} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSseg</span>
            {([1, 2, 5, 10, 20] as const).map(v => (
              <span key={v} title={`minSeg = ${v}`}
                onClick={() => applyMotionSeg(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1962: 공통 cc.MotionStreak color 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } },
            `MotionStreak color (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MScolor</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyMotionColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#ff4444','#44ff44','#4444ff','#ffff44'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyMotionColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1839: 공통 dragonBones.ArmatureDisplay timeScale 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBSpeed = async (timeScale: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => { ...c, props: { ...c.props, timeScale, _timeScale: timeScale, _N$timeScale: timeScale } },
            `DragonBones ×${timeScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>DB</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`timeScale = ×${v}`}
                onClick={() => applyDBSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >×{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1930: 공통 dragonBones.ArmatureDisplay playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBPlayOnLoad = async (playOnLoad: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => { ...c, props: { ...c.props, playOnLoad, _playOnLoad: playOnLoad, _N$playOnLoad: playOnLoad } },
            `DragonBones playOnLoad=${playOnLoad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>DBpol</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`playOnLoad = ${v}`}
                onClick={() => applyDBPlayOnLoad(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v ? 'pol✓' : 'pol✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2044: 공통 dragonBones.ArmatureDisplay playTimes 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBPlayTimes = async (playTimes: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => { ...c, props: { ...c.props, playTimes, _playTimes: playTimes, _N$playTimes: playTimes } },
            `D B Play Times`,
          )
          const label = playTimes === -1 ? '∞' : `${playTimes}x`
          setBatchMsg(`✓ DB playTimes=${label} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>DBplay</span>
            {([['∞',-1],['1x',1],['2x',2],['3x',3],['5x',5]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyDBPlayTimes(v)} title={`playTimes=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2011: 공통 dragonBones.ArmatureDisplay loop 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => { ...c, props: { ...c.props, loop, _loop: loop, _N$loop: loop } },
            `DragonBones loop=${loop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>DBloop</span>
            <span onClick={() => applyDBLoop(true)} title="loop ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>loop✓</span>
            <span onClick={() => applyDBLoop(false)} title="loop OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>loop✗</span>
          </div>
        )
      })()}
      {/* R2138: 공통 dragonBones.ArmatureDisplay debugBones 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBDebugBones = async (debugBones: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => { ...c, props: { ...c.props, debugBones, _debugBones: debugBones, _N$debugBones: debugBones } },
            `DragonBones debugBones=${debugBones} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>DBDbgBn</span>
            <span onClick={() => applyDBDebugBones(true)} title="debugBones ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>bn✓</span>
            <span onClick={() => applyDBDebugBones(false)} title="debugBones OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>bn✗</span>
          </div>
        )
      })()}
      {/* R2201: 공통 dragonBones.ArmatureDisplay enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `dragonBones.ArmatureDisplay enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#c084fc', width: 48, flexShrink: 0 }}>DBComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyDBEnabled(v)} title={`dragonBones.ArmatureDisplay enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#c084fc', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2188: 공통 dragonBones.ArmatureDisplay blendMode 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBBlendMode = async (blendMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => { ...c, props: { ...c.props, blendMode, _blendMode: blendMode } },
            `DragonBones blendMode=${['NORM','ADD','MULT'][blendMode] ?? blendMode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#c084fc', width: 48, flexShrink: 0 }}>DBblend</span>
            {([['NORM', 0], ['ADD', 10], ['MULT', 12]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyDBBlendMode(v)} title={`blendMode=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#c084fc', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1838: 공통 sp.Skeleton timeScale 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineSpeed = async (timeScale: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, timeScale, _timeScale: timeScale, _N$timeScale: timeScale } },
            `Spine ×${timeScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>Spine</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`timeScale = ×${v}`}
                onClick={() => applySpineSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >×{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1931: 공통 sp.Skeleton loop 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, loop, _loop: loop, _N$loop: loop } },
            `Spine loop=${loop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>Spine lp</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`loop = ${v}`}
                onClick={() => applySpineLoop(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v ? 'loop✓' : 'loop✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2037: 공통 sp.Skeleton timeScale 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineTimeScale = async (timeScale: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, timeScale, _timeScale: timeScale, _N$timeScale: timeScale } },
            `Skeleton timeScale=${timeScale}x (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SpineTS</span>
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map(v => (
              <span key={v} onClick={() => applySpineTimeScale(v)} title={`timeScale=${v}x`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R1990: 공통 sp.Skeleton premultipliedAlpha 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpinePremult = async (premultipliedAlpha: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, premultipliedAlpha, _premultipliedAlpha: premultipliedAlpha, _N$premultipliedAlpha: premultipliedAlpha } },
            `Spine premultAlpha=${premultipliedAlpha} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpPremult</span>
            <span onClick={() => applySpinePremult(true)} title="premultipliedAlpha ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>pre✓</span>
            <span onClick={() => applySpinePremult(false)} title="premultipliedAlpha OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>pre✗</span>
          </div>
        )
      })()}
      {/* R2139: 공통 sp.Skeleton paused 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpinePaused = async (paused: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, paused, _paused: paused, _N$paused: paused } },
            `Spine paused=${paused} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpPaused</span>
            <span onClick={() => applySpinePaused(true)} title="paused ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>⏸✓</span>
            <span onClick={() => applySpinePaused(false)} title="paused OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>▶✓</span>
          </div>
        )
      })()}
      {/* R2136: 공통 sp.Skeleton debugBones 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineDebugBones = async (debugBones: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, debugBones, _debugBones: debugBones, _N$debugBones: debugBones } },
            `Spine debugBones=${debugBones} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpDbgBn</span>
            <span onClick={() => applySpineDebugBones(true)} title="debugBones ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>bn✓</span>
            <span onClick={() => applySpineDebugBones(false)} title="debugBones OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>bn✗</span>
          </div>
        )
      })()}
      {/* R2135: 공통 sp.Skeleton debugSlots 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineDebugSlots = async (debugSlots: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, debugSlots, _debugSlots: debugSlots, _N$debugSlots: debugSlots } },
            `Spine debugSlots=${debugSlots} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpDbgSl</span>
            <span onClick={() => applySpineDebugSlots(true)} title="debugSlots ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>dbg✓</span>
            <span onClick={() => applySpineDebugSlots(false)} title="debugSlots OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>dbg✗</span>
          </div>
        )
      })()}
      {/* R2134: 공통 sp.Skeleton useTint 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineUseTint = async (useTint: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, useTint, _useTint: useTint, _N$useTint: useTint } },
            `Spine useTint=${useTint} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpTint</span>
            <span onClick={() => applySpineUseTint(true)} title="useTint ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>tint✓</span>
            <span onClick={() => applySpineUseTint(false)} title="useTint OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>tint✗</span>
          </div>
        )
      })()}
      {/* R2194: 공통 cc.ParticleSystem enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `ParticleSystem enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#aee', width: 48, flexShrink: 0 }}>PSComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyParticleEnabled(v)} title={`ParticleSystem enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#aee', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2201: 공통 sp.Skeleton enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `sp.Skeleton enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpineEnabled(v)} title={`sp.Skeleton enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2188: 공통 sp.Skeleton enableBatch 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineEnableBatch = async (enableBatch: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => { ...c, props: { ...c.props, enableBatch, _enableBatch: enableBatch, _N$enableBatch: enableBatch } },
            `Spine enableBatch=${enableBatch} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpBatch</span>
            {([['batch✓', true], ['batch✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpineEnableBatch(v)} title={`enableBatch=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2189: 공통 cc.ParticleSystem sourcePos.x 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticlePosX = async (x: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, sourcePos: { ...(c.props.sourcePos || { x: 0, y: 0 }), x }, _sourcePos: { ...(c.props._sourcePos || { x: 0, y: 0 }), x } } },
            `ParticleSystem sourcePos.x=${x} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#aee', width: 48, flexShrink: 0 }}>PSposX</span>
            {[0, 50, 100, 200, 300, 500].map(v => (
              <span key={v} onClick={() => applyParticlePosX(v)} title={`sourcePos.x=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#aee', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2189: 공통 cc.ParticleSystem sourcePos.y 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticlePosY = async (y: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, sourcePos: { ...(c.props.sourcePos || { x: 0, y: 0 }), y }, _sourcePos: { ...(c.props._sourcePos || { x: 0, y: 0 }), y } } },
            `ParticleSystem sourcePos.y=${y} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#aee', width: 48, flexShrink: 0 }}>PSposY</span>
            {[0, 50, 100, 200, 300, 500].map(v => (
              <span key={v} onClick={() => applyParticlePosY(v)} title={`sourcePos.y=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#aee', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1932: 공통 cc.ParticleSystem loop 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            // loop is achieved by setting duration = -1 or duration = positive
            const dur = loop ? -1 : 1
            const components = n.components.map(c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D') ? { ...c, props: { ...c.props, duration: dur, _duration: dur, _N$duration: dur } } : c)
            return { ...n, components }
          }, `ParticleSystem loop=${loop} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Ploop</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={v ? 'loop (duration=-1)' : 'once (duration=1)'}
                onClick={() => applyParticleLoop(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v ? 'loop' : 'once'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1981: 공통 cc.ParticleSystem emitterMode 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEmitterMode = async (emitterMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, emitterMode, _emitterMode: emitterMode, _N$emitterMode: emitterMode } },
            `P S Emitter Mode`,
          )
          const names = ['Gravity', 'Radius']
          setBatchMsg(`✓ PS emitterMode=${names[emitterMode] ?? emitterMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSemit</span>
            <span onClick={() => applyPSEmitterMode(0)} title="emitterMode=GRAVITY"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Grav</span>
            <span onClick={() => applyPSEmitterMode(1)} title="emitterMode=RADIUS"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Rad</span>
          </div>
        )
      })()}
      {/* R1979: 공통 cc.ParticleSystem autoRemoveOnFinish 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSAutoRemove = async (autoRemoveOnFinish: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, autoRemoveOnFinish, _autoRemoveOnFinish: autoRemoveOnFinish } },
            `PS autoRemove=${autoRemoveOnFinish} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSautorm</span>
            <span onClick={() => applyPSAutoRemove(true)} title="autoRemoveOnFinish ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>rm✓</span>
            <span onClick={() => applyPSAutoRemove(false)} title="autoRemoveOnFinish OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>rm✗</span>
          </div>
        )
      })()}
      {/* R1977: 공통 cc.ParticleSystem srcBlendFactor/dstBlendFactor 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSBlend = async (src: number, dst: number, label: string) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, srcBlendFactor: src, dstBlendFactor: dst, _srcBlendFactor: src, _dstBlendFactor: dst, _N$srcBlendFactor: src, _N$dstBlendFactor: dst } },
            `PS blend=${label} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSblend</span>
            <span onClick={() => applyPSBlend(770, 771, 'Add')} title="src=ONE(770) dst=ONE_MINUS_SRC_ALPHA(771)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Add</span>
            <span onClick={() => applyPSBlend(770, 1)} title="src=ONE(770) dst=ONE(1) — Additive"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Addv</span>
            <span onClick={() => applyPSBlend(774, 771, 'Norm')} title="src=SRC_ALPHA(774) dst=ONE_MINUS_SRC_ALPHA(771) — Normal"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Norm</span>
          </div>
        )
      })()}
      {/* R1976: 공통 cc.ParticleSystem positionType 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSPosType = async (positionType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, positionType, _positionType: positionType, _N$positionType: positionType } },
            `P S Pos Type`,
          )
          const names = ['Free', 'Relative', 'Group']
          setBatchMsg(`✓ PS positionType=${names[positionType] ?? positionType} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSposType</span>
            {([['Free', 0], ['Rel', 1], ['Grp', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyPSPosType(v)} title={`positionType=${l}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1846: 공통 cc.ParticleSystem startSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleSize = async (startSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startSize, _startSize: startSize, _N$startSize: startSize } },
            `Particle startSize ${startSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Psize</span>
            {([10, 20, 50, 80, 100] as const).map(v => (
              <span key={v} title={`startSize = ${v}`}
                onClick={() => applyParticleSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1837: 공통 cc.ParticleSystem emitRate 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleRate = async (rate: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, emissionRate: rate, _emissionRate: rate, _N$emissionRate: rate } },
            `Particle emitRate ${rate} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Particle</span>
            {([5, 10, 30, 50, 100] as const).map(v => (
              <span key={v} title={`emitRate = ${v}`}
                onClick={() => applyParticleRate(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1874: 공통 cc.ParticleSystem maxParticles 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleMax = async (max: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, maxParticles: max, _maxParticles: max, _N$maxParticles: max, totalParticles: max, _totalParticles: max, _N$totalParticles: max } },
            `Particle maxParticles ${max} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PmaxN</span>
            {([10, 30, 50, 100, 200, 500] as const).map(v => (
              <span key={v} title={`maxParticles = ${v}`}
                onClick={() => applyParticleMax(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1873: 공통 cc.ParticleSystem duration 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleDur = async (dur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, duration: dur, _duration: dur, _N$duration: dur } },
            `Particle duration ${dur < 0 ? '∞' : `${dur}s`} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Pdur</span>
            {([[-1,'∞'], [1,'1s'], [2,'2s'], [5,'5s'], [10,'10s']] as [number, string][]).map(([v, l]) => (
              <span key={v} title={`duration = ${v < 0 ? '무한' : `${v}s`}`}
                onClick={() => applyParticleDur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1893: 공통 cc.ParticleSystem speed 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleSpeed = async (speed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, speed, _speed: speed, _N$speed: speed } },
            `Particle Speed`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Pspeed</span>
            {([30, 60, 100, 180, 300, 500] as const).map(v => (
              <span key={v} title={`speed = ${v}`}
                onClick={() => applyParticleSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2008: 공통 cc.ParticleSystem angleVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSAngleVar = async (angleVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, angleVar, _angleVar: angleVar, _N$angleVar: angleVar } },
            `PS angleVar=${angleVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSangV</span>
            {[0, 15, 30, 45, 90, 180].map(v => (
              <span key={v} onClick={() => applyPSAngleVar(v)} title={`angleVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R1896: 공통 cc.ParticleSystem angle 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleAngle = async (angle: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, angle, _angle: angle, _N$angle: angle } },
            `Particle Angle`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Pangle</span>
            {([0, 45, 90, 135, 180, 270] as const).map(v => (
              <span key={v} title={`angle = ${v}°`}
                onClick={() => applyParticleAngle(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R1914: 공통 cc.ParticleSystem maxParticles 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyMaxParticles = async (maxParticles: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, maxParticles, _maxParticles: maxParticles, _N$maxParticles: maxParticles } },
            `ParticleSystem maxParticles ${maxParticles} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>maxPart</span>
            {([50, 100, 150, 200, 300, 500] as const).map(v => (
              <span key={v} title={`maxParticles = ${v}`}
                onClick={() => applyMaxParticles(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1950: 공통 cc.ParticleSystem emissionRate 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleEmission = async (emissionRate: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, emissionRate, _emissionRate: emissionRate, _N$emissionRate: emissionRate } },
            `ParticleSystem emissionRate=${emissionRate} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSemit</span>
            {([5, 10, 20, 30, 50] as const).map(v => (
              <span key={v} title={`emissionRate = ${v}`}
                onClick={() => applyParticleEmission(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2033: 공통 cc.ParticleSystem angle 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSAngle = async (angle: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, angle, _angle: angle, _N$angle: angle } },
            `PS angle=${angle}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSangle</span>
            {[0, 45, 90, 135, 180, 270].map(v => (
              <span key={v} onClick={() => applyPSAngle(v)} title={`angle=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2032: 공통 cc.ParticleSystem endSpin 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndSpin = async (endSpin: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endSpin, _endSpin: endSpin, _N$endSpin: endSpin } },
            `PS endSpin=${endSpin}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendSpin</span>
            {[0, 45, 90, 180, 270, 360].map(v => (
              <span key={v} onClick={() => applyPSEndSpin(v)} title={`endSpin=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2049: 공통 cc.ParticleSystem endSizeVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndSizeVar = async (endSizeVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endSizeVar, _endSizeVar: endSizeVar, _N$endSizeVar: endSizeVar } },
            `PS endSizeVar=${endSizeVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendSzV</span>
            {[0, 2, 5, 10, 20, 50].map(v => (
              <span key={v} onClick={() => applyPSEndSizeVar(v)} title={`endSizeVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2048: 공통 cc.ParticleSystem endSpinVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndSpinVar = async (endSpinVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endSpinVar, _endSpinVar: endSpinVar, _N$endSpinVar: endSpinVar } },
            `PS endSpinVar=${endSpinVar}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendSpV</span>
            {[0, 15, 30, 45, 90, 180].map(v => (
              <span key={v} onClick={() => applyPSEndSpinVar(v)} title={`endSpinVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2047: 공통 cc.ParticleSystem startSpinVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartSpinVar = async (startSpinVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startSpinVar, _startSpinVar: startSpinVar, _N$startSpinVar: startSpinVar } },
            `PS startSpinVar=${startSpinVar}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstSpV</span>
            {[0, 15, 30, 45, 90, 180].map(v => (
              <span key={v} onClick={() => applyPSStartSpinVar(v)} title={`startSpinVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2031: 공통 cc.ParticleSystem startSpin 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartSpin = async (startSpin: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startSpin, _startSpin: startSpin, _N$startSpin: startSpin } },
            `PS startSpin=${startSpin}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstSpin</span>
            {[0, 45, 90, 180, 270, 360].map(v => (
              <span key={v} onClick={() => applyPSStartSpin(v)} title={`startSpin=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2051: 공통 cc.ParticleSystem tangentialAccelVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSTangAccelVar = async (tangentialAccelVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, tangentialAccelVar, _tangentialAccelVar: tangentialAccelVar, _N$tangentialAccelVar: tangentialAccelVar } },
            `PS tangentialAccelVar=${tangentialAccelVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PStAccV</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSTangAccelVar(v)} title={`tangentialAccelVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2030: 공통 cc.ParticleSystem tangentialAccel 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSTangAccel = async (tangentialAccel: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, tangentialAccel, _tangentialAccel: tangentialAccel, _N$tangentialAccel: tangentialAccel } },
            `PS tangentialAccel=${tangentialAccel} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PStAccel</span>
            {[-100, -50, 0, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSTangAccel(v)} title={`tangentialAccel=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2050: 공통 cc.ParticleSystem radialAccelVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRadialAccelVar = async (radialAccelVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, radialAccelVar, _radialAccelVar: radialAccelVar, _N$radialAccelVar: radialAccelVar } },
            `PS radialAccelVar=${radialAccelVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrAccV</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSRadialAccelVar(v)} title={`radialAccelVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2029: 공통 cc.ParticleSystem radialAccel 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRadialAccel = async (radialAccel: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, radialAccel, _radialAccel: radialAccel, _N$radialAccel: radialAccel } },
            `PS radialAccel=${radialAccel} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrAccel</span>
            {[-100, -50, 0, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSRadialAccel(v)} title={`radialAccel=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2028: 공통 cc.ParticleSystem speed 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSSpeed = async (speed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, speed, _speed: speed, _N$speed: speed } },
            `PS speed=${speed} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSspd</span>
            {[0, 50, 100, 200, 300, 500].map(v => (
              <span key={v} onClick={() => applyPSSpeed(v)} title={`speed=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2027: 공통 cc.ParticleSystem duration 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSDuration = async (duration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, duration, _duration: duration, _N$duration: duration } },
            `P S Duration`,
          )
          const label = duration === -1 ? '∞' : `${duration}s`
          setBatchMsg(`✓ PS duration=${label} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSDur</span>
            {([['∞',-1],['1s',1],['2s',2],['5s',5],['10s',10]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyPSDuration(v)} title={`duration=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2026: 공통 cc.ParticleSystem totalParticles 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSTotalPart = async (totalParticles: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, totalParticles, _totalParticles: totalParticles, _N$totalParticles: totalParticles } },
            `PS totalParticles=${totalParticles} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PStotal</span>
            {[10, 25, 50, 100, 200, 500].map(v => (
              <span key={v} onClick={() => applyPSTotalPart(v)} title={`totalParticles=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2168: 공통 cc.ParticleSystem simulationSpace 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSSimSpace = async (simulationSpace: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, simulationSpace, _simulationSpace: simulationSpace, _N$simulationSpace: simulationSpace } },
            `PS simulationSpace=${simulationSpace === 0 ? 'World' : 'Local'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSsim</span>
            <span onClick={() => applyPSSimSpace(0)} title="simulationSpace=World(0)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>World</span>
            <span onClick={() => applyPSSimSpace(1)} title="simulationSpace=Local(1)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Local</span>
          </div>
        )
      })()}
      {/* R2062: 공통 cc.ParticleSystem rotationIsDir 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRotIsDir = async (rotationIsDir: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, rotationIsDir, _rotationIsDir: rotationIsDir, _N$rotationIsDir: rotationIsDir } },
            `PS rotationIsDir=${rotationIsDir} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrotDir</span>
            {([['dir✓',true],['dir✗',false]] as [string,boolean][]).map(([label,v]) => (
              <span key={label} onClick={() => applyPSRotIsDir(v)} title={`rotationIsDir=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2147: 공통 cc.ParticleSystem endRadiusVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndRadiusVar = async (endRadiusVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endRadiusVar, _endRadiusVar: endRadiusVar, _N$endRadiusVar: endRadiusVar } },
            `PS endRadiusVar=${endRadiusVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendRdV</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSEndRadiusVar(v)} title={`endRadiusVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2061: 공통 cc.ParticleSystem startRadiusVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartRadiusVar = async (startRadiusVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startRadiusVar, _startRadiusVar: startRadiusVar, _N$startRadiusVar: startRadiusVar } },
            `PS startRadiusVar=${startRadiusVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstRadV</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSStartRadiusVar(v)} title={`startRadiusVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2060: 공통 cc.ParticleSystem endRadius 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndRadius = async (endRadius: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endRadius, _endRadius: endRadius, _N$endRadius: endRadius } },
            `PS endRadius=${endRadius} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendRad</span>
            {[0, 50, 100, 150, 200, 300].map(v => (
              <span key={v} onClick={() => applyPSEndRadius(v)} title={`endRadius=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2059: 공통 cc.ParticleSystem startRadius 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartRadius = async (startRadius: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startRadius, _startRadius: startRadius, _N$startRadius: startRadius } },
            `PS startRadius=${startRadius} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstRad</span>
            {[0, 50, 100, 150, 200, 300].map(v => (
              <span key={v} onClick={() => applyPSStartRadius(v)} title={`startRadius=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2016: 공통 cc.ParticleSystem rotatePerSVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRotPerSVar = async (rotatePerSVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, rotatePerSVar, _rotatePerSVar: rotatePerSVar, _N$rotatePerSVar: rotatePerSVar } },
            `PS rotatePerSVar=${rotatePerSVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrPSVar</span>
            {[0, 15, 30, 45, 90].map(v => (
              <span key={v} onClick={() => applyPSRotPerSVar(v)} title={`rotatePerSVar=${v}°/s`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2015: 공통 cc.ParticleSystem rotatePerS 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRotPerS = async (rotatePerS: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, rotatePerS, _rotatePerS: rotatePerS, _N$rotatePerS: rotatePerS } },
            `PS rotatePerS=${rotatePerS} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrotPS</span>
            {[0, 45, 90, 180, 360].map(v => (
              <span key={v} onClick={() => applyPSRotPerS(v)} title={`rotatePerS=${v}°/s`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2121: 공통 cc.ParticleSystem endRotationVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndRotVar = async (endRotationVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endRotationVar, _endRotationVar: endRotationVar } },
            `PS endRotationVar=${endRotationVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSeRtV</span>
            {[0, 30, 60, 90, 180, 360].map(v => (
              <span key={v} onClick={() => applyPSEndRotVar(v)} title={`endRotationVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2120: 공통 cc.ParticleSystem startRotationVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartRotVar = async (startRotationVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startRotationVar, _startRotationVar: startRotationVar } },
            `PS startRotationVar=${startRotationVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSsRtV</span>
            {[0, 30, 60, 90, 180, 360].map(v => (
              <span key={v} onClick={() => applyPSStartRotVar(v)} title={`startRotationVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2119: 공통 cc.ParticleSystem endRotation 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndRot = async (endRotation: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endRotation, _endRotation: endRotation } },
            `PS endRotation=${endRotation} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendRt</span>
            {[0, 45, 90, 180, 270, 360].map(v => (
              <span key={v} onClick={() => applyPSEndRot(v)} title={`endRotation=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2118: 공통 cc.ParticleSystem startRotation 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartRot = async (startRotation: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startRotation, _startRotation: startRotation } },
            `PS startRotation=${startRotation} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstRot</span>
            {[0, 45, 90, 180, 270, 360].map(v => (
              <span key={v} onClick={() => applyPSStartRot(v)} title={`startRotation=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2054: 공통 cc.ParticleSystem posVar (spread) 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSPosVar = async (v: number) => {
          if (!sceneFile.root) return
          const posVar = { x: v, y: v }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, posVar, _posVar: posVar, _N$posVar: posVar } },
            `PS posVar=(${v},${v}) (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSposVar</span>
            {[0, 10, 25, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSPosVar(v)} title={`posVar=(${v},${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2117: 공통 cc.ParticleSystem gravity.y 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSGravY = async (gy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const updComps = n.components.map(c => {
            if (c.type !== 'cc.ParticleSystem') return c
            const grav = (c.props?.gravity as { x?: number; y?: number } | undefined) ?? {}
            const newGrav = { x: grav.x ?? 0, y: gy }; return { ...c, props: { ...c.props, gravity: newGrav, _gravity: newGrav, _N$gravity: newGrav } }
            })
            return { ...n, components: updComps}
          }, `PS gravity.y=${gy} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSgravY</span>
            {[-300, -200, -100, 0, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSGravY(v)} title={`gravity.y=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2055: 공통 cc.ParticleSystem gravity.x 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSGravityX = async (gx: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const comp = n.components.find(c => c.type === 'cc.ParticleSystem')
            const prevGy = (comp?.props?.gravity as {x:number,y:number}|undefined)?.y ?? 0
            const grav = { x: gx, y: prevGy }
            const components = n.components.map(c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D') ? { ...c, props: { ...c.props, gravity: grav, _gravity: grav, _N$gravity: grav } } : c)
            return { ...n, components }
          }, `PS gravity.x=${gx} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSgravX</span>
            {[-200, -100, 0, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSGravityX(v)} title={`gravity.x=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2002: 공통 cc.ParticleSystem gravity 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSGravity = async (gy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const grav = { x: 0, y: gy }
            const components = n.components.map(c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D') ? { ...c, props: { ...c.props, gravity: grav, _gravity: grav, _N$gravity: grav } } : c)
            return { ...n, components }
          }, `PS gravity.y=${gy} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSgrav</span>
            {[0, -100, -200, -500, 100].map(v => (
              <span key={v} onClick={() => applyPSGravity(v)} title={`gravity.y=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2081: 공통 cc.ParticleSystem life 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSLife = async (life: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, life, _life: life, _N$life: life } },
            `PS life=${life} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSlife</span>
            {[0.5, 1, 1.5, 2, 3, 5].map(v => (
              <span key={v} title={`life = ${v}s`}
                onClick={() => applyPSLife(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2001: 공통 cc.ParticleSystem lifeVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSLifeVar = async (lifeVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, lifeVar, _lifeVar: lifeVar, _N$lifeVar: lifeVar } },
            `PS lifeVar=${lifeVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSlifeV</span>
            {[0, 0.25, 0.5, 1, 2].map(v => (
              <span key={v} onClick={() => applyPSLifeVar(v)} title={`lifeVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1999: 공통 cc.ParticleSystem speedVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSSpeedVar = async (speedVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, speedVar, _speedVar: speedVar, _N$speedVar: speedVar } },
            `PS speedVar=${speedVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSspdVar</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSSpeedVar(v)} title={`speedVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2074: 공통 cc.ParticleSystem endSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndSize = async (endSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endSize, _endSize: endSize, _N$endSize: endSize } },
            `PS endSize=${endSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendSz</span>
            {[0, 10, 20, 30, 50, 80].map(v => (
              <span key={v} title={`endSize = ${v}`}
                onClick={() => applyPSEndSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2073: 공통 cc.ParticleSystem startSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartSize = async (startSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startSize, _startSize: startSize, _N$startSize: startSize } },
            `PS startSize=${startSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstSz</span>
            {[10, 20, 30, 50, 80, 100].map(v => (
              <span key={v} title={`startSize = ${v}`}
                onClick={() => applyPSStartSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1998: 공통 cc.ParticleSystem startSizeVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartSizeVar = async (startSizeVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startSizeVar, _startSizeVar: startSizeVar, _N$startSizeVar: startSizeVar } },
            `PS startSizeVar=${startSizeVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSszVar</span>
            {[0, 2, 5, 10, 20].map(v => (
              <span key={v} onClick={() => applyPSStartSizeVar(v)} title={`startSizeVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1957: 공통 cc.ParticleSystem startSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleStartSize = async (startSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startSize, _startSize: startSize, _N$startSize: startSize } },
            `ParticleSystem startSize=${startSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSsize</span>
            {([5, 10, 20, 30, 50] as const).map(v => (
              <span key={v} title={`startSize = ${v}`}
                onClick={() => applyParticleStartSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1958: 공통 cc.ParticleSystem life 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleLife = async (life: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, life, _life: life, _N$life: life } },
            `ParticleSystem life=${life}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSlife</span>
            {([0.5, 1, 2, 3, 5] as const).map(v => (
              <span key={v} title={`life = ${v}s`}
                onClick={() => applyParticleLife(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R1961: 공통 cc.ParticleSystem endSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleEndSize = async (endSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endSize, _endSize: endSize, _N$endSize: endSize } },
            `ParticleSystem endSize=${endSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSendSz</span>
            {([0, 5, 10, 20, 30] as const).map(v => (
              <span key={v} title={`endSize = ${v}`}
                onClick={() => applyParticleEndSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1969: 공통 cc.ParticleSystem startColor 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleStartColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startColor: col, _startColor: col, _N$startColor: col } },
            `ParticleSystem startColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSstCol</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyParticleStartColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#ff4444','#ffff44','#44ff44','#4444ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyParticleStartColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1970: 공통 cc.ParticleSystem endColor 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleEndColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 0 }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endColor: col, _endColor: col, _N$endColor: col } },
            `ParticleSystem endColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSendCol</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyParticleEndColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#ff4444','#ffff44','#44ff44','#000000'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyParticleEndColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2148: 공통 cc.ParticleSystem startColorVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartColorVar = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const startColorVar = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, startColorVar, _startColorVar: startColorVar, _N$startColorVar: startColorVar } },
            `PS startColorVar (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSstColV</span>
            <input type="color" defaultValue="#000000"
              onChange={e => applyPSStartColorVar(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#000000','#ffffff','#808080','#ff0000','#00ff00'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyPSStartColorVar(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2149: 공통 cc.ParticleSystem endColorVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndColorVar = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const endColorVar = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => { ...c, props: { ...c.props, endColorVar, _endColorVar: endColorVar, _N$endColorVar: endColorVar } },
            `PS endColorVar (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSendColV</span>
            <input type="color" defaultValue="#000000"
              onChange={e => applyPSEndColorVar(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#000000','#ffffff','#808080','#ff0000','#00ff00'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyPSEndColorVar(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2222: 공통 cc.TiledLayer enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.TiledLayer') && (() => {
        const applyTiledLayerEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.TiledLayer',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `TiledLayer enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#6ee7b7', width: 48, flexShrink: 0 }}>TileEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyTiledLayerEnabled(v)} title={`TiledLayer enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2150: 공통 cc.TiledLayer opacity 일괄 설정 */}
      {commonCompTypes.includes('cc.TiledLayer') && (() => {
        const applyTiledLayerOpacity = async (opacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.TiledLayer',
            c => { ...c, props: { ...c.props, opacity, _opacity: opacity, _N$opacity: opacity } },
            `TiledLayer opacity=${opacity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>TLOpacity</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <span key={v} onClick={() => applyTiledLayerOpacity(v)} title={`opacity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2151: 공통 cc.TiledLayer visible 일괄 설정 */}
      {commonCompTypes.includes('cc.TiledLayer') && (() => {
        const applyTiledLayerVisible = async (visible: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.TiledLayer',
            c => { ...c, props: { ...c.props, visible, _visible: visible, _N$visible: visible } },
            `TiledLayer visible=${visible} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>TLVisible</span>
            <span onClick={() => applyTiledLayerVisible(true)} title="visible ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>show✓</span>
            <span onClick={() => applyTiledLayerVisible(false)} title="visible OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>hide✗</span>
          </div>
        )
      })()}
      {/* R2207: 공통 cc.BlockInputEvents enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.BlockInputEvents') && (() => {
        const applyBIEEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.BlockInputEvents',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `BlockInputEvents enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>BIEComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyBIEEnabled(v)} title={`BlockInputEvents enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2207: 공통 cc.Canvas enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Canvas enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CvsComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyCanvasEnabled(v)} title={`Canvas enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2152: 공통 cc.Canvas fitWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasFitWidth = async (fitWidth: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => { ...c, props: { ...c.props, fitWidth, _fitWidth: fitWidth, _N$fitWidth: fitWidth } },
            `Canvas fitWidth=${fitWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CVFitW</span>
            <span onClick={() => applyCanvasFitWidth(true)} title="fitWidth ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>fitW✓</span>
            <span onClick={() => applyCanvasFitWidth(false)} title="fitWidth OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>fitW✗</span>
          </div>
        )
      })()}
      {/* R2187: 공통 cc.Canvas resizeWithBrowserSize 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasResizeWithBrowser = async (resizeWithBrowserSize: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => { ...c, props: { ...c.props, resizeWithBrowserSize, _resizeWithBrowserSize: resizeWithBrowserSize, _N$resizeWithBrowserSize: resizeWithBrowserSize } },
            `Canvas resizeWithBrowserSize=${resizeWithBrowserSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CanvRes</span>
            {([['rsz✓', true], ['rsz✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyCanvasResizeWithBrowser(v)} title={`resizeWithBrowserSize=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2153: 공통 cc.Canvas fitHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasFitHeight = async (fitHeight: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => { ...c, props: { ...c.props, fitHeight, _fitHeight: fitHeight, _N$fitHeight: fitHeight } },
            `Canvas fitHeight=${fitHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CVFitH</span>
            <span onClick={() => applyCanvasFitHeight(true)} title="fitHeight ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>fitH✓</span>
            <span onClick={() => applyCanvasFitHeight(false)} title="fitHeight OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>fitH✗</span>
          </div>
        )
      })()}
      {/* R2154: 공통 cc.Canvas resolutionPolicy 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasResPolicy = async (resolutionPolicy: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => { ...c, props: { ...c.props, resolutionPolicy, _resolutionPolicy: resolutionPolicy, _N$resolutionPolicy: resolutionPolicy } },
            `Canvas Res Policy`,
          )
          const labels = ['SHOW_ALL', 'NO_BORDER', 'EXACT_FIT', 'FIX_H', 'FIX_W']
          setBatchMsg(`✓ Canvas policy=${labels[resolutionPolicy] ?? resolutionPolicy} (${uuids.length}개)`) // R2255: _resolutionPolicy CC3.x
        }
        const opts: [string, number][] = [['SHOW_ALL', 0], ['NO_BORDER', 1], ['EXACT_FIT', 2], ['FIX_H', 3], ['FIX_W', 4]]
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CVPolicy</span>
            {opts.map(([l, v]) => (
              <span key={v} onClick={() => applyCanvasResPolicy(v)} title={`resolutionPolicy=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l.replace('_', '')}</span>
            ))}
          </div>
        )
      })()}
      {/* R2155: 공통 cc.Canvas designResolution 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const [drW, setDrW] = React.useState(960)
        const [drH, setDrH] = React.useState(640)
        const applyCanvasDesignRes = async (w: number, h: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const dr = { width: w, height: h }
            const components = n.components.map(c => c.type === 'cc.Canvas' ? { ...c, props: { ...c.props, _N$designResolution: dr, _designResolution: dr } } : c)
            return { ...n, components }
          }, `Canvas designRes=${w}×${h} (${uuids.length}개)`)
        }
        const presets: [string, number, number][] = [['960×640', 960, 640], ['1280×720', 1280, 720], ['1920×1080', 1920, 1080], ['375×667', 375, 667]]
        return (
          <div style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CVRes</span>
              <input type="number" value={drW} min={1} onChange={e => setDrW(parseInt(e.target.value) || 960)}
                style={{ width: 50, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>×</span>
              <input type="number" value={drH} min={1} onChange={e => setDrH(parseInt(e.target.value) || 640)}
                style={{ width: 50, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }} />
              <span onClick={() => applyCanvasDesignRes(drW, drH)} title={`designResolution=${drW}×${drH}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid #60a5fa', color: '#60a5fa', userSelect: 'none' }}>✓</span>
            </div>
            <div style={{ display: 'flex', gap: 3, paddingLeft: 52 }}>
              {presets.map(([l, w, h]) => (
                <span key={l} onClick={() => { setDrW(w); setDrH(h); applyCanvasDesignRes(w, h) }} title={`${w}×${h}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
              ))}
            </div>
          </div>
        )
      })()}
      {/* R1836: 공통 cc.SkeletalAnimation speedRatio 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkeletalSpeed = async (speedRatio: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => { ...c, props: { ...c.props, speedRatio, _speedRatio: speedRatio } },
            `SkeletalAnim ×${speedRatio} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SkelAnim</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`speedRatio = ×${v}`}
                onClick={() => applySkeletalSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >×{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1885: 공통 cc.SkeletalAnimation playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkelPlayOnLoad = async (playOnLoad: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => { ...c, props: { ...c.props, playOnLoad, _playOnLoad: playOnLoad } },
            `SkeletalAnim playOnLoad=${playOnLoad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SkelPOL</span>
            <span onClick={() => applySkelPlayOnLoad(true)} title="playOnLoad ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>play✓</span>
            <span onClick={() => applySkelPlayOnLoad(false)} title="playOnLoad OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>play✗</span>
          </div>
        )
      })()}
      {/* R2056: 공통 cc.SkeletalAnimation speed 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkelSpeed = async (speed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => { ...c, props: { ...c.props, speed, _speed: speed, _N$speed: speed } },
            `SkeletalAnim speed=${speed}x (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SkelSpd</span>
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map(v => (
              <span key={v} onClick={() => applySkelSpeed(v)} title={`speed=${v}x`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R2045: 공통 cc.SkeletalAnimation wrapMode 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkelWrapMode = async (wrapMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => { ...c, props: { ...c.props, wrapMode, _wrapMode: wrapMode, _N$wrapMode: wrapMode } },
            `Skel Wrap Mode`,
          )
          const names: Record<number,string> = {1:'Dflt',2:'Norm',3:'Loop',4:'PingPong',8:'Rev'}
          setBatchMsg(`✓ Skel wrapMode=${names[wrapMode]??wrapMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SkelWM</span>
            {([['Dflt',1],['Norm',2],['Loop',3],['Ping',4],['Rev',8]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applySkelWrapMode(v)} title={`wrapMode=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2012: 공통 cc.SkeletalAnimation loop 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkeletalLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => { ...c, props: { ...c.props, loop, _loop: loop } },
            `SkeletalAnim loop=${loop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SkelLoop</span>
            <span onClick={() => applySkeletalLoop(true)} title="loop ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>loop✓</span>
            <span onClick={() => applySkeletalLoop(false)} title="loop OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>loop✗</span>
          </div>
        )
      })()}
      {/* R2221: 공통 cc.SkeletalAnimation enabled (컴포넌트 레벨) 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkeletalAnimEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `SkeletalAnimation enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>SkelEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySkeletalAnimEnabled(v)} title={`SkeletalAnimation enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2133: 공통 cc.SkeletalAnimation defaultCachingMode 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkeletalCaching = async (defaultCachingMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => { ...c, props: { ...c.props, defaultCachingMode, _defaultCachingMode: defaultCachingMode } },
            `SkeletalAnimation cachingMode=${defaultCachingMode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SkelCach</span>
            {([['Rltime',0],['Shared',1],['Private',2]] as [string,number][]).map(([l,v]) => (
              <span key={v} onClick={() => applySkeletalCaching(v)} title={`defaultCachingMode=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2195: 공통 cc.Slider enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Slider enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SLDComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySliderEnabled(v)} title={`Slider enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1835: 공통 cc.Slider progress 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderProg = async (progress: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, progress, _progress: progress, _N$progress: progress } },
            `Slider progress ${Math.round(progress * 100)}% (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>Slider</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`progress = ${Math.round(v * 100)}%`}
                onClick={() => applySliderProg(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1869: 공통 cc.Slider direction 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderDir = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } },
            `Slider direction=${direction === 0 ? 'H' : 'V'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SliderDir</span>
            <span onClick={() => applySliderDir(0)} title="direction = Horizontal" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>H→</span>
            <span onClick={() => applySliderDir(1)} title="direction = Vertical" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>V↓</span>
          </div>
        )
      })()}
      {/* R1904: 공통 cc.Slider interactable 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderInteract = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, interactable, _interactable: interactable, _N$interactable: interactable } },
            `Slider Interact`,
          ) // R2257: _interactable CC3.x
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SldrInter</span>
            <span onClick={() => applySliderInteract(true)} title="interactable ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>inter✓</span>
            <span onClick={() => applySliderInteract(false)} title="interactable OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>inter✗</span>
          </div>
        )
      })()}
      {/* R2042: 공통 cc.Slider value 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderVal = async (progress: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, progress, _progress: progress, _N$progress: progress } },
            `Slider value=${progress} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SldrVal</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <span key={v} onClick={() => applySliderVal(v)} title={`progress=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1944: 공통 cc.Slider min/max 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderRange = async (min: number, max: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, minValue: min, maxValue: max, _minValue: min, _maxValue: max, _N$minValue: min, _N$maxValue: max } },
            `Slider [${min}~${max}] (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SLrange</span>
            {([[0,1],[0,10],[0,100],[-1,1]] as const).map(([mn,mx]) => (
              <span key={`${mn}-${mx}`} title={`min=${mn} max=${mx}`}
                onClick={() => applySliderRange(mn, mx)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{mn}~{mx}</span>
            ))}
          </div>
        )
      })()}
      {/* R1960: 공통 cc.Slider step 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderStep = async (step: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, step, _step: step, _N$step: step } },
            `Slider step=${step} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SLstep</span>
            {([0, 0.01, 0.05, 0.1, 0.5, 1] as const).map(v => (
              <span key={v} title={`step = ${v}`}
                onClick={() => applySliderStep(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2223: 공통 cc.AudioSource _pitch 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioPitch = async (pitch: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, pitch, _pitch: pitch } },
            `AudioSource pitch=${pitch} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASPitch</span>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(v => (
              <span key={v} onClick={() => applyAudioPitch(v)} title={`_pitch=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2108: 공통 cc.AudioSource loop 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, loop, _loop: loop } },
            `AudioSource loop=${loop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>AudLoop</span>
            <span onClick={() => applyAudioLoop(true)} title="loop ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>loop✓</span>
            <span onClick={() => applyAudioLoop(false)} title="loop OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>loop✗</span>
          </div>
        )
      })()}
      {/* R2109: 공통 cc.AudioSource playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioPlayOnLoad = async (playOnLoad: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, playOnLoad, _playOnLoad: playOnLoad } },
            `AudioSource playOnLoad=${playOnLoad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>AudPOL</span>
            <span onClick={() => applyAudioPlayOnLoad(true)} title="playOnLoad ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>pol✓</span>
            <span onClick={() => applyAudioPlayOnLoad(false)} title="playOnLoad OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>pol✗</span>
          </div>
        )
      })()}
      {/* R1828: 공통 cc.AudioSource volume 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioVol = async (volume: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, volume, _volume: volume, _N$volume: volume } },
            `AudioSource volume ${Math.round(volume * 100)}% (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>Audio</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`volume = ${Math.round(v * 100)}%`}
                onClick={() => applyAudioVol(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1866: 공통 cc.AudioSource pitch 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioPitch = async (pitch: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, pitch, _pitch: pitch } },
            `AudioSource pitch ${pitch} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>Pitch</span>
            {([0.5, 0.75, 1, 1.25, 1.5, 2] as const).map(v => (
              <span key={v} title={`pitch = ${v}`}
                onClick={() => applyAudioPitch(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1911: 공통 cc.AudioSource preload 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioPreload = async (preload: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, preload, _preload: preload, _N$preload: preload } },
            `AudioSource preload ${preload} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>AUpre</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`preload = ${v}`}
                onClick={() => applyAudioPreload(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{v ? 'pre✓' : 'pre✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1971: 공통 cc.AudioSource startTime 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioStart = async (startTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, startTime, _startTime: startTime, _N$startTime: startTime } },
            `AudioSource startTime=${startTime}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASstart</span>
            {([0, 0.5, 1, 2, 5] as const).map(v => (
              <span key={v} title={`startTime = ${v}s`}
                onClick={() => applyAudioStart(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2164: 공통 cc.AudioSource endTime 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioEnd = async (endTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, endTime, _endTime: endTime, _N$endTime: endTime } },
            `AudioSource endTime=${endTime < 0 ? '∞' : endTime + 's'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASend</span>
            {([-1, 0, 1, 2, 5, 10] as const).map(v => (
              <span key={v} title={`endTime = ${v < 0 ? '∞(no limit)' : v + 's'}`}
                onClick={() => applyAudioEnd(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{v < 0 ? '∞' : v + 's'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2199: 공통 cc.Camera enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCameraEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Camera enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>CamComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyCameraEnabled(v)} title={`Camera enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1912: 공통 cc.Camera depth 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamDepth = async (depth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, depth, _depth: depth } },
            `Camera depth ${depth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>CamDepth</span>
            {([-2, -1, 0, 1, 2] as const).map(v => (
              <span key={v} title={`Camera depth = ${v}`}
                onClick={() => applyCamDepth(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1920: 공통 cc.Camera backgroundColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamBg = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, backgroundColor: col, _backgroundColor: col, _N$backgroundColor: col } },
            `Camera bgColor ${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>CamBg</span>
            <input type="color" defaultValue="#000000"
              onChange={e => applyCamBg(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#000000','#ffffff','#ff0000','#0000ff'] as const).map(c => (
              <span key={c} title={c}
                onClick={() => applyCamBg(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer', border: '1px solid var(--border)', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1921: 공통 cc.Camera clearFlags 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamFlags = async (clearFlags: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, clearFlags, _clearFlags: clearFlags } },
            `Camera clearFlags ${clearFlags} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>CamFlag</span>
            {([['None',0],['Depth',2],['C+D',7],['All',15]] as [string,number][]).map(([l,v]) => (
              <span key={v} title={`clearFlags = ${v}`}
                onClick={() => applyCamFlags(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1941: 공통 cc.Camera zoomRatio 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamZoom = async (zoomRatio: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, zoomRatio, _zoomRatio: zoomRatio } },
            `Camera zoom=${zoomRatio} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#818cf8', width: 48, flexShrink: 0 }}>CamZoom</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`zoomRatio = ${v}`}
                onClick={() => applyCamZoom(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#818cf8', userSelect: 'none' }}
              >{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R1952: 공통 cc.Camera fov 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamFov = async (fov: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, fov, _fov: fov } },
            `Camera fov=${fov}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#818cf8', width: 48, flexShrink: 0 }}>CamFov</span>
            {([45, 60, 75, 90, 120] as const).map(v => (
              <span key={v} title={`fov = ${v}°`}
                onClick={() => applyCamFov(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#818cf8', userSelect: 'none' }}
              >{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2187: 공통 cc.Camera clearDepth 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamClearDepth = async (clearDepth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, clearDepth, _clearDepth: clearDepth } },
            `Camera clearDepth=${clearDepth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamDepth</span>
            {[0, 0.5, 1].map(v => (
              <span key={v} onClick={() => applyCamClearDepth(v)} title={`clearDepth=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2178: 공통 cc.Camera orthoHeight 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamOrthoHeight = async (orthoHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, orthoHeight, _orthoHeight: orthoHeight } },
            `Camera orthoHeight=${orthoHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamOrtH</span>
            {[100, 200, 360, 480, 540, 720].map(v => (
              <span key={v} onClick={() => applyCamOrthoHeight(v)} title={`orthoHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2058: 공통 cc.Camera orthographic 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamOrtho = async (ortho: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, ortho, _ortho: ortho } },
            `Camera ortho=${ortho} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamOrtho</span>
            {([['ort✓',true],['ort✗',false]] as [string,boolean][]).map(([label,v]) => (
              <span key={label} onClick={() => applyCamOrtho(v)} title={`orthographic=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R1989: 공통 cc.Camera cullingMask 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamCulling = async (cullingMask: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, cullingMask, _cullingMask: cullingMask } },
            `Cam Culling`,
          )
          const labels: Record<number, string> = { [-1 >>> 0]: 'All', 0: 'None', 1: 'Dflt' }
          setBatchMsg(`✓ Camera cullingMask=${labels[cullingMask >>> 0] ?? cullingMask} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#818cf8', width: 48, flexShrink: 0 }}>CamCull</span>
            <span onClick={() => applyCamCulling(-1)} title="cullingMask=ALL(-1)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#818cf8', userSelect: 'none' }}>All</span>
            <span onClick={() => applyCamCulling(0)} title="cullingMask=NONE(0)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>None</span>
            <span onClick={() => applyCamCulling(1)} title="cullingMask=DEFAULT(1)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#818cf8', userSelect: 'none' }}>Dflt</span>
          </div>
        )
      })()}
      {/* R2114: 공통 cc.Camera targetDisplay 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamTargetDisplay = async (targetDisplay: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, targetDisplay, _targetDisplay: targetDisplay } },
            `Camera targetDisplay=${targetDisplay} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>CamDisp</span>
            {[0, 1, 2, 3].map(v => (
              <span key={v} onClick={() => applyCamTargetDisplay(v)} title={`targetDisplay=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2167: 공통 cc.Camera near 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamNear = async (near: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, near, _near: near } },
            `Camera near=${near} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamNear</span>
            {[0.001, 0.01, 0.1, 1].map(v => (
              <span key={v} onClick={() => applyCamNear(v)} title={`near=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2167: 공통 cc.Camera far 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamFar = async (far: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => { ...c, props: { ...c.props, far, _far: far } },
            `Camera far=${far} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamFar</span>
            {[100, 500, 1000, 2000, 10000].map(v => (
              <span key={v} onClick={() => applyCamFar(v)} title={`far=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1821: 공통 cc.Layout type 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Layout</span>
          {([['None', 0], ['H', 1], ['V', 2], ['Grid', 3]] as const).map(([l, v]) => (
            <span key={v} title={`layout type = ${l}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Layout',
                  c => { ...c, props: { ...c.props, type: v, layoutType: v, _type: v, _layoutType: v, _N$type: v, _N$layoutType: v } },
                  `Layout type ${l} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1959: 공통 cc.Layout childAlignment 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutChildAlign = async (childAlignment: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, childAlignment, _childAlignment: childAlignment } },
            `Layout Child Align`,
          )
          const names: Record<number,string> = { 0:'None', 1:'LT', 2:'CT', 3:'RT', 4:'LC', 5:'C', 6:'RC', 7:'LB', 8:'CB', 9:'RB' }
          setBatchMsg(`✓ Layout align=${names[childAlignment]??childAlignment} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LyAlign</span>
            {([[1,'LT'],[5,'C'],[9,'RB'],[4,'LC'],[6,'RC']] as const).map(([v,l]) => (
              <span key={v} title={`childAlignment = ${l}`}
                onClick={() => applyLayoutChildAlign(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1972: 공통 cc.Layout horizontalDirection 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutHorDir = async (horizontalDirection: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, horizontalDirection, _horizontalDirection: horizontalDirection } },
            `Layout horDir=${horizontalDirection===0?'L':'R'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LyHorDir</span>
            <span onClick={() => applyLayoutHorDir(0)} title="LEFT_TO_RIGHT"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>→L</span>
            <span onClick={() => applyLayoutHorDir(1)} title="RIGHT_TO_LEFT"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>←R</span>
          </div>
        )
      })()}
      {/* R1973: 공통 cc.Layout verticalDirection 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutVerDir = async (verticalDirection: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, verticalDirection, _verticalDirection: verticalDirection } },
            `Layout verDir=${verticalDirection===0?'T':'B'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LyVerDir</span>
            <span onClick={() => applyLayoutVerDir(0)} title="TOP_TO_BOTTOM"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>↓T</span>
            <span onClick={() => applyLayoutVerDir(1)} title="BOTTOM_TO_TOP"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>↑B</span>
          </div>
        )
      })()}
      {/* R2197: 공통 cc.Layout enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Layout enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LyComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLayoutEnabled(v)} title={`Layout enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2024: 공통 cc.Layout paddingRight 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPadRight = async (paddingRight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, paddingRight, _paddingRight: paddingRight, _N$paddingRight: paddingRight } },
            `Layout paddingRight=${paddingRight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LpadR</span>
            {[0, 5, 10, 20, 30, 50].map(v => (
              <span key={v} onClick={() => applyLayoutPadRight(v)} title={`paddingRight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2023: 공통 cc.Layout paddingLeft 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPadLeft = async (paddingLeft: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, paddingLeft, _paddingLeft: paddingLeft, _N$paddingLeft: paddingLeft } },
            `Layout paddingLeft=${paddingLeft} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LpadL</span>
            {[0, 5, 10, 20, 30, 50].map(v => (
              <span key={v} onClick={() => applyLayoutPadLeft(v)} title={`paddingLeft=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2022: 공통 cc.Layout paddingBottom 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPadBot = async (paddingBottom: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, paddingBottom, _paddingBottom: paddingBottom, _N$paddingBottom: paddingBottom } },
            `Layout paddingBottom=${paddingBottom} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LpadB</span>
            {[0, 5, 10, 20, 30, 50].map(v => (
              <span key={v} onClick={() => applyLayoutPadBot(v)} title={`paddingBottom=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2021: 공통 cc.Layout paddingTop 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPadTop = async (paddingTop: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, paddingTop, _paddingTop: paddingTop, _N$paddingTop: paddingTop } },
            `Layout paddingTop=${paddingTop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LpadT</span>
            {[0, 5, 10, 20, 30, 50].map(v => (
              <span key={v} onClick={() => applyLayoutPadTop(v)} title={`paddingTop=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1878: 공통 cc.Layout padding 일괄 설정 (uniform) */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPad = async (pad: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad, _paddingLeft: pad, _paddingRight: pad, _paddingTop: pad, _paddingBottom: pad, _N$paddingLeft: pad, _N$paddingRight: pad, _N$paddingTop: pad, _N$paddingBottom: pad } },
            `Layout padding=${pad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lpad</span>
            {([0, 4, 8, 12, 16, 24] as const).map(v => (
              <span key={v} title={`padding = ${v} (all sides)`}
                onClick={() => applyLayoutPad(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2041: 공통 cc.Layout spacingY 일괄 설정 (individual) */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutSpacingY = async (spacingY: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, spacingY, _spacingY: spacingY, _N$spacingY: spacingY } },
            `Layout spacingY=${spacingY} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LspY</span>
            {[0, 2, 5, 10, 20, 30].map(v => (
              <span key={v} onClick={() => applyLayoutSpacingY(v)} title={`spacingY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2080: 공통 cc.Layout resizeMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutResizeMode = async (resizeMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, resizeMode, _resizeMode: resizeMode, _N$resizeMode: resizeMode } },
            `Layout resizeMode=${resizeMode} (${uuids.length}개)`,
          )
        }
        // 0=NONE, 1=CONTAINER, 2=CHILDREN
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LresM</span>
            {([0, 1, 2] as const).map((v, i) => (
              <span key={v} title={`resizeMode = ${v} (${['None','Cont','Chld'][i]})`}
                onClick={() => applyLayoutResizeMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{['None','Cont','Chld'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2224: 공통 cc.Layout padding 사방향 프리셋 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPad = async (pt: number, pb: number, pl: number, pr: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, paddingTop: pt, _paddingTop: pt, _N$paddingTop: pt, paddingBottom: pb, _paddingBottom: pb, _N$paddingBottom: pb, paddingLeft: pl, _paddingLeft: pl, _N$paddingLeft: pl, paddingRight: pr, _paddingRight: pr, _N$paddingRight: pr } },
            `Layout padding=${pt}/${pb}/${pl}/${pr} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#86efac', width: 48, flexShrink: 0 }}>LayoutPad</span>
            {([['0', 0,0,0,0], ['4', 4,4,4,4], ['8', 8,8,8,8], ['12', 12,12,12,12], ['16', 16,16,16,16], ['20', 20,20,20,20]] as const).map(([l, pt, pb, pl, pr]) => (
              <span key={String(l)} onClick={() => applyLayoutPad(pt, pb, pl, pr)} title={`padding=${l}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#86efac', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2140: 공통 cc.Layout autoWrap 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutAutoWrap = async (autoWrap: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, autoWrap, _autoWrap: autoWrap } },
            `Layout autoWrap=${autoWrap} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LAutoWrp</span>
            <span onClick={() => applyLayoutAutoWrap(true)} title="autoWrap ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>wrap✓</span>
            <span onClick={() => applyLayoutAutoWrap(false)} title="autoWrap OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>wrap✗</span>
          </div>
        )
      })()}
      {/* R2112: 공통 cc.Layout affectedByScale 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutAffected = async (affectedByScale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, affectedByScale, _affectedByScale: affectedByScale } },
            `Layout affectedByScale=${affectedByScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LScaleAff</span>
            <span onClick={() => applyLayoutAffected(true)} title="affectedByScale ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>aff✓</span>
            <span onClick={() => applyLayoutAffected(false)} title="affectedByScale OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>aff✗</span>
          </div>
        )
      })()}
      {/* R2079: 공통 cc.Layout constraint 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutConstraint = async (constraint: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, constraint, _constraint: constraint, _N$constraint: constraint } },
            `Layout constraint=${constraint} (${uuids.length}개)`,
          )
        }
        // 0=NONE, 1=FIXED_ROW, 2=FIXED_COL
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lconst</span>
            {([0, 1, 2] as const).map((v, i) => (
              <span key={v} title={`constraint = ${v} (${['None','FixRow','FixCol'][i]})`}
                onClick={() => applyLayoutConstraint(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{['None','FRow','FCol'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2163: 공통 cc.Layout constraintNum 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyConstraintNum = async (constraintNum: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, constraintNum, _constraintNum: constraintNum, _N$constraintNum: constraintNum } },
            `Layout constraintNum=${constraintNum} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LconN</span>
            {[1, 2, 3, 4, 5, 6].map(v => (
              <span key={v} onClick={() => applyConstraintNum(v)} title={`constraintNum=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2078: 공통 cc.Layout startAxis 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutStartAxis = async (startAxis: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, startAxis, _startAxis: startAxis, _N$startAxis: startAxis } },
            `Layout startAxis=${startAxis} (${uuids.length}개)`,
          )
        }
        // 0=HORIZONTAL, 1=VERTICAL
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LaxisX</span>
            {([0, 1] as const).map((v, i) => (
              <span key={v} title={`startAxis = ${v} (${['H','V'][i]})`}
                onClick={() => applyLayoutStartAxis(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{['H','V'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2068: 공통 cc.Layout cellSize 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutCell = async (size: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const cellSize = { width: size, height: size }
            const components = n.components.map(c => c.type === 'cc.Layout' ? { ...c, props: { ...c.props, cellSize, _cellSize: cellSize, _N$cellSize: cellSize } } : c)
            return { ...n, components }
          }, `Layout cellSize=${size}x${size} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LcellS</span>
            {[40, 60, 80, 100, 120, 160].map(v => (
              <span key={v} title={`cellSize = ${v}x${v}`}
                onClick={() => applyLayoutCell(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2040: 공통 cc.Layout spacingX 일괄 설정 (individual) */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutSpacingX = async (spacingX: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, spacingX, _spacingX: spacingX, _N$spacingX: spacingX } },
            `Layout spacingX=${spacingX} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LspX</span>
            {[0, 2, 5, 10, 20, 30].map(v => (
              <span key={v} onClick={() => applyLayoutSpacingX(v)} title={`spacingX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1879: 공통 cc.Layout spacingX/Y 일괄 설정 (uniform) */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutSpacing = async (sp: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, spacingX: sp, spacingY: sp, _spacingX: sp, _spacingY: sp, _N$spacingX: sp, _N$spacingY: sp } },
            `Layout spacing=${sp} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lspacing</span>
            {([0, 2, 4, 8, 12, 16] as const).map(v => (
              <span key={v} title={`spacingX/Y = ${v}`}
                onClick={() => applyLayoutSpacing(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1894: 공통 cc.Layout resizeMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutResize = async (resizeMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, resizeMode, _resizeMode: resizeMode, _N$resizeMode: resizeMode } },
            `Layout Resize`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lresize</span>
            {(['None', 'Container', 'Children'] as const).map((l, v) => (
              <span key={v} title={`resizeMode = ${l}`}
                onClick={() => applyLayoutResize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1934: 공통 cc.Layout affectedByScale 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutScale = async (affectedByScale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, affectedByScale, _affectedByScale: affectedByScale } },
            `Layout affectedByScale=${affectedByScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lscale</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`affectedByScale = ${v}`}
                onClick={() => applyLayoutScale(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v ? 'sc✓' : 'sc✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1822: 공통 cc.Widget alignment 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Widget</span>
          {([
            { label: '⊞ Stretch', patch: { isAlignTop: true, isAlignBottom: true, isAlignLeft: true, isAlignRight: true, isAlignHorizontalCenter: false, isAlignVerticalCenter: false, top: 0, bottom: 0, left: 0, right: 0 } },
            { label: '⊕ Center', patch: { isAlignTop: false, isAlignBottom: false, isAlignLeft: false, isAlignRight: false, isAlignHorizontalCenter: true, isAlignVerticalCenter: true } },
            { label: '✕ None', patch: { isAlignTop: false, isAlignBottom: false, isAlignLeft: false, isAlignRight: false, isAlignHorizontalCenter: false, isAlignVerticalCenter: false } },
          ]).map(({ label, patch }) => (
            <span key={label}
              title={`Widget ${label}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Widget',
                  c => { ...c, props: { ...c.props, ...patch } },
                  `Widget ${label} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R2057: 공통 cc.Layout wrapMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutWrap = async (wrapMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => { ...c, props: { ...c.props, wrapMode, _wrapMode: wrapMode, _N$wrapMode: wrapMode } },
            `Layout Wrap`,
          )
          const names = ['NoWrap','Wrap','SingleLine']
          setBatchMsg(`✓ Layout wrapMode=${names[wrapMode]??wrapMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LwrapM</span>
            {([['NoWrap',0],['Wrap',1],['1Line',2]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyLayoutWrap(v)} title={`wrapMode=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2169: 공통 cc.Widget isAbs* 플래그 일괄 설정 (절대값/% 전환) */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAbs = async (isAbs: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, isAbsTop: isAbs, _isAbsTop: isAbs, _N$isAbsTop: isAbs, isAbsBottom: isAbs, _isAbsBottom: isAbs, _N$isAbsBottom: isAbs, isAbsLeft: isAbs, _isAbsLeft: isAbs, _N$isAbsLeft: isAbs, isAbsRight: isAbs, _isAbsRight: isAbs, _N$isAbsRight: isAbs, isAbsHorizontalCenter: isAbs, _isAbsHorizontalCenter: isAbs, _N$isAbsHorizontalCenter: isAbs, isAbsVerticalCenter: isAbs, _isAbsVerticalCenter: isAbs, _N$isAbsVerticalCenter: isAbs, } },
            `Widget isAbs*=${isAbs} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtAbs</span>
            <span onClick={() => applyWidgetIsAbs(true)} title="isAbs* 모두 true (절대px)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>px✓</span>
            <span onClick={() => applyWidgetIsAbs(false)} title="isAbs* 모두 false (%)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>%✗</span>
          </div>
        )
      })()}
      {/* R2101: 공통 cc.Widget verticalCenter 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetVCenter = async (verticalCenter: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, verticalCenter, _verticalCenter: verticalCenter, _N$verticalCenter: verticalCenter } },
            `Widget verticalCenter=${verticalCenter} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtVC</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`verticalCenter = ${v}`}
                onClick={() => applyWidgetVCenter(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2100: 공통 cc.Widget horizontalCenter 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetHCenter = async (horizontalCenter: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, horizontalCenter, _horizontalCenter: horizontalCenter, _N$horizontalCenter: horizontalCenter } },
            `Widget horizontalCenter=${horizontalCenter} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtHC</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`horizontalCenter = ${v}`}
                onClick={() => applyWidgetHCenter(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2099: 공통 cc.Widget right 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetRight = async (right: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, right, _right: right, _N$right: right } },
            `Widget right=${right} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtRgt</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`right = ${v}`}
                onClick={() => applyWidgetRight(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2098: 공통 cc.Widget left 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetLeft = async (left: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, left, _left: left, _N$left: left } },
            `Widget left=${left} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtLeft</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`left = ${v}`}
                onClick={() => applyWidgetLeft(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2097: 공통 cc.Widget bottom 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetBot = async (bottom: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, bottom, _bottom: bottom, _N$bottom: bottom } },
            `Widget bottom=${bottom} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtBot</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`bottom = ${v}`}
                onClick={() => applyWidgetBot(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2125: 공통 cc.Widget isAlignRight 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignRight = async (isAlignRight: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, isAlignRight, _isAlignRight: isAlignRight } },
            `Widget isAlignRight=${isAlignRight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WARight</span>
            <span onClick={() => applyWidgetIsAlignRight(true)} title="isAlignRight ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>R✓</span>
            <span onClick={() => applyWidgetIsAlignRight(false)} title="isAlignRight OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>R✗</span>
          </div>
        )
      })()}
      {/* R2127: 공통 cc.Widget isAlignVerticalCenter 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignVCenter = async (isAlignVerticalCenter: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, isAlignVerticalCenter, _isAlignVerticalCenter: isAlignVerticalCenter, _N$isAlignVerticalCenter: isAlignVerticalCenter } },
            `Widget isAlignVerticalCenter=${isAlignVerticalCenter} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WAVCtr</span>
            <span onClick={() => applyWidgetIsAlignVCenter(true)} title="isAlignVerticalCenter ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>VC✓</span>
            <span onClick={() => applyWidgetIsAlignVCenter(false)} title="isAlignVerticalCenter OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>VC✗</span>
          </div>
        )
      })()}
      {/* R2126: 공통 cc.Widget isAlignHorizontalCenter 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignHCenter = async (isAlignHorizontalCenter: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, isAlignHorizontalCenter, _isAlignHorizontalCenter: isAlignHorizontalCenter, _N$isAlignHorizontalCenter: isAlignHorizontalCenter } },
            `Widget isAlignHorizontalCenter=${isAlignHorizontalCenter} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WAHCtr</span>
            <span onClick={() => applyWidgetIsAlignHCenter(true)} title="isAlignHorizontalCenter ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>HC✓</span>
            <span onClick={() => applyWidgetIsAlignHCenter(false)} title="isAlignHorizontalCenter OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>HC✗</span>
          </div>
        )
      })()}
      {/* R2124: 공통 cc.Widget isAlignLeft 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignLeft = async (isAlignLeft: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, isAlignLeft, _isAlignLeft: isAlignLeft } },
            `Widget isAlignLeft=${isAlignLeft} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WALeft</span>
            <span onClick={() => applyWidgetIsAlignLeft(true)} title="isAlignLeft ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>L✓</span>
            <span onClick={() => applyWidgetIsAlignLeft(false)} title="isAlignLeft OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>L✗</span>
          </div>
        )
      })()}
      {/* R2123: 공통 cc.Widget isAlignBottom 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignBot = async (isAlignBottom: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, isAlignBottom, _isAlignBottom: isAlignBottom } },
            `Widget isAlignBottom=${isAlignBottom} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WABot</span>
            <span onClick={() => applyWidgetIsAlignBot(true)} title="isAlignBottom ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>B✓</span>
            <span onClick={() => applyWidgetIsAlignBot(false)} title="isAlignBottom OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>B✗</span>
          </div>
        )
      })()}
      {/* R2122: 공통 cc.Widget isAlignTop 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignTop = async (isAlignTop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, isAlignTop, _isAlignTop: isAlignTop } },
            `Widget isAlignTop=${isAlignTop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WATop</span>
            <span onClick={() => applyWidgetIsAlignTop(true)} title="isAlignTop ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>T✓</span>
            <span onClick={() => applyWidgetIsAlignTop(false)} title="isAlignTop OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>T✗</span>
          </div>
        )
      })()}
      {/* R2096: 공통 cc.Widget top 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetTop = async (top: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, top, _top: top, _N$top: top } },
            `Widget top=${top} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtTop</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`top = ${v}`}
                onClick={() => applyWidgetTop(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2043: 공통 cc.Widget alignMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetAlignMode = async (alignMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, alignMode, _alignMode: alignMode, _N$alignMode: alignMode } },
            `Widget Align Mode`,
          )
          const names = ['Once','OnResize','Always']
          setBatchMsg(`✓ Widget alignMode=${names[alignMode]??alignMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WidgAM</span>
            {([['Once',0],['Resize',1],['Always',2]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyWidgetAlignMode(v)} title={`alignMode=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R1974: 공통 cc.Widget margin(top/bottom/left/right) 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetMargin = async (v: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => { ...c, props: { ...c.props, top: v, _top: v, bottom: v, _bottom: v, left: v, _left: v, right: v, _right: v, _N$top: v, _N$bottom: v, _N$left: v, _N$right: v } },
            `Widget margin=${v} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>WgMargin</span>
            {[0, 10, 20, 50, 100].map(v => (
              <span key={v} onClick={() => applyWidgetMargin(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1881: 공통 cc.RigidBody type 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBType = async (type: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, type, _type: type, _N$type: type } },
            `R B Type`,
          )
          const names = ['Dynamic', 'Static', 'Kinematic']
          setBatchMsg(`✓ RigidBody type=${names[type] ?? type} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBtype</span>
            {(['Dyn', 'Sta', 'Kin'] as const).map((l, v) => (
              <span key={v} title={`RigidBody type = ${['Dynamic','Static','Kinematic'][v]}`}
                onClick={() => applyRBType(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1871: 공통 cc.RigidBody mass 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBMass = async (mass: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, mass, _mass: mass, _N$mass: mass } },
            `RigidBody mass ${mass} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RB mass</span>
            {([0.1, 0.5, 1, 2, 5, 10] as const).map(v => (
              <span key={v} title={`mass = ${v}`}
                onClick={() => applyRBMass(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1857: 공통 cc.RigidBody gravityScale 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBGravScale = async (gs: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, gravityScale: gs, _gravityScale: gs, _N$gravityScale: gs } },
            `RigidBody gravityScale ${gs} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>gravSc</span>
            {([0, 0.5, 1, 2] as const).map(v => (
              <span key={v} title={`gravityScale = ${v}`}
                onClick={() => applyRBGravScale(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1851: 공통 cc.RigidBody fixedRotation 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBFixRot = async (fixedRotation: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, fixedRotation, _fixedRotation: fixedRotation, _N$fixedRotation: fixedRotation } },
            `RigidBody fixedRotation=${fixedRotation} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>fixRot</span>
            <span onClick={() => applyRBFixRot(true)} title="fixedRotation = true" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>lock✓</span>
            <span onClick={() => applyRBFixRot(false)} title="fixedRotation = false" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>lock✗</span>
          </div>
        )
      })()}
      {/* R1824: 공통 cc.RigidBody linearDamping 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBDamp = async (linearDamping: number) => {
          if (!sceneFile.root || isNaN(linearDamping)) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, linearDamping, _linearDamping: linearDamping, _N$linearDamping: linearDamping } },
            `RigidBody linearDamping ${linearDamping} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>RB damp</span>
            {([0, 0.1, 0.5, 1, 5] as const).map(v => (
              <span key={v} title={`linearDamping = ${v}`}
                onClick={() => applyRBDamp(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
            <input type="number" placeholder="?" step={0.1} min={0}
              style={{ width: 36, fontSize: 8, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text)', padding: '1px 3px' }}
              onKeyDown={e => { if (e.key === 'Enter') { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) { applyRBDamp(v);(e.target as HTMLInputElement).value = '' } } }}
              onBlur={e => { if (e.target.value) { applyRBDamp(parseFloat(e.target.value)); e.target.value = '' } }}
              title="linearDamping 직접 입력 후 Enter"
            />
          </div>
        )
      })()}
      {/* R1898: 공통 cc.RigidBody angularDamping 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyAngularDamp = async (angularDamping: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, angularDamping, _angularDamping: angularDamping, _N$angularDamping: angularDamping } },
            `Angular Damp`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>RB angD</span>
            {([0, 0.1, 0.5, 1, 5] as const).map(v => (
              <span key={v} title={`angularDamping = ${v}`}
                onClick={() => applyAngularDamp(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1917: 공통 cc.RigidBody bullet 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBBullet = async (bullet: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, bullet, _bullet: bullet, _N$bullet: bullet } },
            `RigidBody bullet=${bullet} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBbullet</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`bullet = ${v}`}
                onClick={() => applyRBBullet(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'blt✓' : 'blt✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1922: 공통 cc.RigidBody allowSleep 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBSleep = async (allowSleep: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, allowSleep, _allowSleep: allowSleep, _N$allowSleep: allowSleep } },
            `RigidBody allowSleep=${allowSleep} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBsleep</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`allowSleep = ${v}`}
                onClick={() => applyRBSleep(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'slp✓' : 'slp✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1939: 공통 cc.RigidBody linearVelocity 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBLinearVel = async (x: number, y: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const vel = { x, y }
            const components = n.components.map(c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D') ? { ...c, props: { ...c.props, linearVelocity: vel, _linearVelocity: vel, _N$linearVelocity: vel } } : c)
            return { ...n, components }
          }, `RigidBody vel=(${x},${y}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBvel</span>
            {([0, 1, 5, 10] as const).map(v => (
              <span key={v} title={`linearVelocity = {x:0,y:${v}}`}
                onClick={() => applyRBLinearVel(0, v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >↑{v}</span>
            ))}
            <span title="stop" onClick={() => applyRBLinearVel(0, 0)}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>■</span>
          </div>
        )
      })()}
      {/* R1953: 공통 cc.RigidBody angularVelocity 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBAngVel = async (angularVelocity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, angularVelocity, _angularVelocity: angularVelocity } },
            `RigidBody angVel=${angularVelocity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBangVel</span>
            {([-90, -45, 0, 45, 90] as const).map(v => (
              <span key={v} title={`angularVelocity = ${v}`}
                onClick={() => applyRBAngVel(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1968: 공통 cc.RigidBody fixedRotation 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBFixedRot = async (fixedRotation: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, fixedRotation, _fixedRotation: fixedRotation } },
            `RigidBody fixedRotation=${fixedRotation} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBfxRot</span>
            <span onClick={() => applyRBFixedRot(true)} title="fixedRotation ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>fix✓</span>
            <span onClick={() => applyRBFixedRot(false)} title="fixedRotation OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>fix✗</span>
          </div>
        )
      })()}
      {/* R2070: 공통 cc.RigidBody angularDamping 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBAngDamp = async (angularDamping: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, angularDamping, _angularDamping: angularDamping, _N$angularDamping: angularDamping } },
            `RigidBody angularDamping=${angularDamping} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBangD</span>
            {[0, 0.1, 0.5, 1, 2, 5].map(v => (
              <span key={v} title={`angularDamping = ${v}`}
                onClick={() => applyRBAngDamp(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2069: 공통 cc.RigidBody linearDamping 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBLinearDamp = async (linearDamping: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, linearDamping, _linearDamping: linearDamping, _N$linearDamping: linearDamping } },
            `RigidBody linearDamping=${linearDamping} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBlinD</span>
            {[0, 0.1, 0.5, 1, 2, 5].map(v => (
              <span key={v} title={`linearDamping = ${v}`}
                onClick={() => applyRBLinearDamp(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2217: 공통 cc.RigidBody enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `RigidBody enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyRBEnabled(v)} title={`RigidBody enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2009: 공통 cc.RigidBody enabledContactListener 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBContactListener = async (enabledContactListener: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, enabledContactListener, _enabledContactListener: enabledContactListener, _N$enabledContactListener: enabledContactListener } },
            `RigidBody contactListener=${enabledContactListener} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBcont</span>
            <span onClick={() => applyRBContactListener(true)} title="enabledContactListener ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>cb✓</span>
            <span onClick={() => applyRBContactListener(false)} title="enabledContactListener OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>cb✗</span>
          </div>
        )
      })()}
      {/* R1975: 공통 cc.RigidBody awake 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBAwake = async (awake: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, awake, _awake: awake, _N$awake: awake } },
            `RigidBody awake=${awake} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBawake</span>
            <span onClick={() => applyRBAwake(true)} title="awake ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>awk✓</span>
            <span onClick={() => applyRBAwake(false)} title="awake OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>awk✗</span>
          </div>
        )
      })()}
      {/* R1997: 공통 cc.RigidBody sleepThreshold 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBSleepThresh = async (sleepThreshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, sleepThreshold, _sleepThreshold: sleepThreshold, _N$sleepThreshold: sleepThreshold } },
            `RigidBody sleepThreshold=${sleepThreshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBsleep</span>
            {[0.005, 0.01, 0.05, 0.1, 0.5].map(v => (
              <span key={v} onClick={() => applyRBSleepThresh(v)} title={`sleepThreshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2129: 공통 cc.RigidBody angularVelocityLimit 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBAngVelLim = async (angularVelocityLimit: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, angularVelocityLimit, _angularVelocityLimit: angularVelocityLimit } },
            `RigidBody angularVelocityLimit=${angularVelocityLimit} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBangV</span>
            {[0, 1, 5, 10, 50, 100].map(v => (
              <span key={v} onClick={() => applyRBAngVelLim(v)} title={`angularVelocityLimit=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2128: 공통 cc.RigidBody linearVelocityLimit 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBLinVelLim = async (linearVelocityLimit: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, linearVelocityLimit, _linearVelocityLimit: linearVelocityLimit } },
            `RigidBody linearVelocityLimit=${linearVelocityLimit} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBlinV</span>
            {[0, 1, 5, 10, 50, 100].map(v => (
              <span key={v} onClick={() => applyRBLinVelLim(v)} title={`linearVelocityLimit=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2161: 공통 cc.RigidBody group 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBGroup = async (group: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, group, _group: group } },
            `RigidBody group=${group} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBGrp</span>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <span key={v} onClick={() => applyRBGroup(v)} title={`group=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2170: 공통 cc.RigidBody rotationOffset 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBRotOffset = async (rotationOffset: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, rotationOffset, _rotationOffset: rotationOffset } },
            `RigidBody rotationOffset=${rotationOffset} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBrotOff</span>
            {[0, 30, 45, 90, 180, -90].map(v => (
              <span key={v} onClick={() => applyRBRotOffset(v)} title={`rotationOffset=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2176: 공통 Collider category 일괄 설정 */}
      {(commonCompTypes.some(t => ['cc.BoxCollider','cc.BoxCollider2D','cc.CircleCollider','cc.CircleCollider2D','cc.PolygonCollider','cc.PolygonCollider2D'].includes(t))) && (() => {
        const COLLIDER_TYPES_176 = ['cc.BoxCollider','cc.BoxCollider2D','cc.CircleCollider','cc.CircleCollider2D','cc.PolygonCollider','cc.PolygonCollider2D']
        const applyColliderCategory = async (category: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => COLLIDER_TYPES_176.includes(c.type),
            c => { ...c, props: { ...c.props, category, _category: category } },
            `Collider category=${category} (${uuids.length}개)`,
          )
        }
        const applyColliderMask = async (mask: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => COLLIDER_TYPES_176.includes(c.type),
            c => { ...c, props: { ...c.props, mask, _mask: mask } },
            `Collider mask=${mask} (${uuids.length}개)`,
          )
        }
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>ColCat</span>
              {[0, 1, 2, 4, 8, -1].map(v => (
                <span key={v} onClick={() => applyColliderCategory(v)} title={`category=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>ColMask</span>
              {[0, 1, 2, 4, 8, -1].map(v => (
                <span key={v} onClick={() => applyColliderMask(v)} title={`mask=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
          </>
        )
      })()}
      {/* R2162: 공통 cc.BoxCollider/CircleCollider/PolygonCollider tag 일괄 설정 */}
      {(commonCompTypes.some(t => ['cc.BoxCollider','cc.BoxCollider2D','cc.CircleCollider','cc.CircleCollider2D','cc.PolygonCollider','cc.PolygonCollider2D'].includes(t))) && (() => {
        const COLLIDER_TYPES = ['cc.BoxCollider','cc.BoxCollider2D','cc.CircleCollider','cc.CircleCollider2D','cc.PolygonCollider','cc.PolygonCollider2D']
        const applyColliderTag = async (tag: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => COLLIDER_TYPES.includes(c.type),
            c => { ...c, props: { ...c.props, tag, _tag: tag } },
            `Collider tag=${tag} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>ColTag</span>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <span key={v} onClick={() => applyColliderTag(v)} title={`collider tag=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2193: 공통 cc.Mask enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Mask') && (() => {
        const applyMaskEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Mask',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Mask enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>MskComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyMaskEnabled(v)} title={`Mask enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1863: 공통 cc.Mask type 일괄 설정 */}
      {commonCompTypes.includes('cc.Mask') && (() => {
        const applyMaskType = async (type: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Mask',
            c => { ...c, props: { ...c.props, type, _type: type, _N$type: type } },
            `Mask Type`,
          )
          const names = ['Rect','Ellipse','Image']
          setBatchMsg(`✓ Mask type=${names[type] ?? type} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>MaskType</span>
            {(['Rect','Ellipse','Image'] as const).map((l, v) => (
              <span key={v} title={`Mask type = ${l}`}
                onClick={() => applyMaskType(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1852: 공통 cc.Mask inverted 일괄 설정 */}
      {commonCompTypes.includes('cc.Mask') && (() => {
        const applyMaskInvert = async (inverted: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Mask',
            c => { ...c, props: { ...c.props, inverted, _inverted: inverted, _N$inverted: inverted } },
            `Mask inverted=${inverted} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Mask</span>
            <span onClick={() => applyMaskInvert(true)} title="inverted ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>inv✓</span>
            <span onClick={() => applyMaskInvert(false)} title="inverted OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>inv✗</span>
          </div>
        )
      })()}
      {/* R1988: 공통 cc.Mask alphaThreshold 일괄 설정 */}
      {commonCompTypes.includes('cc.Mask') && (() => {
        const applyMaskAlpha = async (alphaThreshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Mask',
            c => { ...c, props: { ...c.props, alphaThreshold, _alphaThreshold: alphaThreshold, _N$alphaThreshold: alphaThreshold } },
            `Mask alphaThreshold=${alphaThreshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>MaskAlph</span>
            {[0, 0.1, 0.3, 0.5, 1].map(v => (
              <span key={v} onClick={() => applyMaskAlpha(v)} title={`alphaThreshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1872: 공통 cc.BoxCollider/CircleCollider sensor 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D') || commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const hasBox = commonCompTypes.some(t => t === 'cc.BoxCollider' || t === 'cc.BoxCollider2D')
        const hasCircle = commonCompTypes.some(t => t === 'cc.CircleCollider' || t === 'cc.CircleCollider2D')
        const colliderTypes = [
          ...(hasBox ? ['cc.BoxCollider', 'cc.BoxCollider2D'] : []),
          ...(hasCircle ? ['cc.CircleCollider', 'cc.CircleCollider2D'] : []),
        ]
        const applyColliderSensor = async (sensor: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => colliderTypes.includes(c.type),
            c => { ...c, props: { ...c.props, sensor, _sensor: sensor, _N$sensor: sensor } },
            `Collider sensor=${sensor} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Sensor</span>
            <span onClick={() => applyColliderSensor(true)} title="sensor ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>ON✓</span>
            <span onClick={() => applyColliderSensor(false)} title="sensor OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>OFF✗</span>
          </div>
        )
      })()}
      {/* R2039: 공통 cc.CircleCollider offset 일괄 설정 */}
      {commonCompTypes.includes('cc.CircleCollider') && (() => {
        const applyCircleOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => c.type === 'cc.CircleCollider' ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `CircleCollider offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CircOff</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0]] as [string,number,number][]).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyCircleOffset(ox, oy)} title={`offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R1995: 공통 cc.CircleCollider radius 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleRadius = async (radius: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => { ...c, props: { ...c.props, radius, _radius: radius, _N$radius: radius } },
            `CircleCollider radius=${radius} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirRad</span>
            {[25, 50, 75, 100, 150].map(v => (
              <span key={v} onClick={() => applyCircleRadius(v)} title={`radius=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2038: 공통 cc.BoxCollider offset 일괄 설정 */}
      {commonCompTypes.includes('cc.BoxCollider') && (() => {
        const applyBoxOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => c.type === 'cc.BoxCollider' ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `BoxCollider offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>BoxOff</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0],['reset',0,0]] as [string,number,number][]).slice(0,4).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyBoxOffset(ox, oy)} title={`offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R1994: 공통 cc.BoxCollider size 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const boxType = commonCompTypes.includes('cc.BoxCollider') ? 'cc.BoxCollider' : 'cc.BoxCollider2D'
        const applyBoxSize = async (w: number, h: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => { ...c, props: { ...c.props, size: { width: w, height: h }, _size: { width: w, height: h }, _N$size: { width: w, height: h } } },
            `BoxCollider size=${w}×${h} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxSize</span>
            {([[50,50],[100,100],[200,100],[100,200]] as const).map(([w, h]) => (
              <span key={`${w}x${h}`} onClick={() => applyBoxSize(w, h)} title={`size=${w}×${h}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{w}×{h}</span>
            ))}
          </div>
        )
      })()}
      {/* R1886: 공통 cc.ProgressBar totalLength 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBLength = async (totalLength: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, totalLength, _totalLength: totalLength, _N$totalLength: totalLength } },
            `ProgressBar totalLength=${totalLength} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBlen</span>
            {([50, 100, 200, 300, 500] as const).map(v => (
              <span key={v} title={`totalLength = ${v}`}
                onClick={() => applyPBLength(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2197: 공통 cc.ProgressBar enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `ProgressBar enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyPBEnabled(v)} title={`ProgressBar enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1771: 공통 cc.ProgressBar progress 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Progress</span>
          <input type="range" min={0} max={1} step={0.01} defaultValue={0}
            onMouseUp={async e => {
              const prog = parseFloat((e.target as HTMLInputElement).value)
              if (!sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.ProgressBar',
                c => { ...c, props: { ...c.props, progress: prog, _progress: prog, _N$progress: prog } },
                `progress ${Math.round(prog * 100)}% (${uuids.length}개)`,
              )
            }}
            style={{ flex: 1 }}
          />
        </div>
      )}
      {/* R1853: 공통 cc.ProgressBar reverse 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBReverse = async (reverse: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, reverse, _reverse: reverse, _N$reverse: reverse } },
            `ProgressBar reverse=${reverse} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBrev</span>
            <span onClick={() => applyPBReverse(true)} title="reverse ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>rev✓</span>
            <span onClick={() => applyPBReverse(false)} title="reverse OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>rev✗</span>
          </div>
        )
      })()}
      {/* R1987: 공통 cc.ProgressBar mode 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBMode = async (mode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, mode, _mode: mode, _N$mode: mode } },
            `P B Mode`,
          )
          const names = ['Horiz', 'Vert', 'Filled']
          setBatchMsg(`✓ ProgressBar mode=${names[mode] ?? mode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBmode</span>
            {([['H', 0], ['V', 1], ['Fill', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyPBMode(v)} title={`mode=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2173: 공통 cc.ProgressBar startWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBStartWidth = async (startWidth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, startWidth, _startWidth: startWidth, _N$startWidth: startWidth } },
            `ProgressBar startWidth=${startWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>PBstW</span>
            {[0, 1, 5, 10, 20, 50].map(v => (
              <span key={v} onClick={() => applyPBStartWidth(v)} title={`startWidth=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2063: 공통 cc.ProgressBar totalLength 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBTotalLength = async (totalLength: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, totalLength, _totalLength: totalLength, _N$totalLength: totalLength } },
            `ProgressBar totalLength=${totalLength} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBtotal</span>
            {[100, 200, 300, 400, 500].map(v => (
              <span key={v} title={`totalLength = ${v}`}
                onClick={() => applyPBTotalLength(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1906: 공통 cc.ProgressBar progress 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBProgress = async (progress: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, progress, _progress: progress, _N$progress: progress } },
            `P B Progress`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBprog</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`progress = ${v}`}
                onClick={() => applyPBProgress(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1916: 공통 cc.ProgressBar reverse 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBReverse = async (reverse: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, reverse, _reverse: reverse, _N$reverse: reverse } },
            `ProgressBar reverse=${reverse} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBrev</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`reverse = ${v}`}
                onClick={() => applyPBReverse(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v ? 'rev✓' : 'rev✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1862: 공통 cc.Sprite type 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySpriteType = async (type: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, type, _type: type } },
            `Spr Type`,
          )
          const names = ['Simple','Sliced','Tiled','Filled']
          setBatchMsg(`✓ Sprite type=${names[type]} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>Spr type</span>
            {(['Simple','Sliced','Tiled','Filled'] as const).map((l, v) => (
              <span key={v} title={`Sprite type = ${l}`}
                onClick={() => applySpriteType(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1882: 공통 cc.Sprite sizeMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySpriteSizeMode = async (sizeMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, sizeMode, _sizeMode: sizeMode } },
            `Sprite Size Mode`,
          )
          const names = ['Custom', 'Trimmed', 'Raw']
          setBatchMsg(`✓ Sprite sizeMode=${names[sizeMode] ?? sizeMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprSize</span>
            {(['Custom', 'Trimmed', 'Raw'] as const).map((l, v) => (
              <span key={v} title={`sizeMode = ${l}`}
                onClick={() => applySpriteSizeMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1891: 공통 cc.Sprite flipX/flipY 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprFlip = async (axis: 'X' | 'Y', value: boolean) => {
          if (!sceneFile.root) return
          const key = `flip${axis}`
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, [key]: value, [`_${key}`]: value, [`_N$${key}`]: value } },
            `Spr Flip`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprFlip</span>
            {(['X', 'Y'] as const).map(axis => (
              <React.Fragment key={axis}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>flip{axis}:</span>
                {([true, false] as const).map(v => (
                  <span key={String(v)} title={`flip${axis}=${v}`}
                    onClick={() => applySprFlip(axis, v)}
                    style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
                  >{v ? '✓' : '✗'}</span>
                ))}
              </React.Fragment>
            ))}
          </div>
        )
      })()}
      {/* R1899: 공통 cc.Sprite grayscale 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprGray = async (grayscale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, grayscale, _grayscale: grayscale, _N$grayscale: grayscale } },
            `Spr Gray`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprGray</span>
            <span onClick={() => applySprGray(true)} title="grayscale ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>gray✓</span>
            <span onClick={() => applySprGray(false)} title="grayscale OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>gray✗</span>
          </div>
        )
      })()}
      {/* R2215: 공통 cc.Sprite _color 일괄 설정 (CC3.x 컴포넌트 레벨 색상) */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteClr = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorObj = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, _color: colorObj } },
            `Sprite _color=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprClr</span>
            {(['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff8800', '#888888'] as const).map(c => (
              <span key={c} title={c} onClick={() => applySpriteClr(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2190: 공통 cc.Sprite enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, enabled, _enabled: enabled } },
            `Sprite enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SpComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpriteEnabled(v)} title={`Sprite enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2216: 공통 cc.Sprite _useGrayscale 일괄 설정 (CC3.x) */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpUseGray = async (useGrayscale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, _useGrayscale: useGrayscale } },
            `Sprite _useGrayscale=${useGrayscale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SpUseGy</span>
            {([['ugray✓', true], ['ugray✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpUseGray(v)} title={`_useGrayscale=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2183: 공통 cc.Sprite packable 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpritePackable = async (packable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, packable, _packable: packable } },
            `Sprite packable=${packable} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SpPack</span>
            {([['pack✓', true], ['pack✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpritePackable(v)} title={`packable=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2177: 공통 cc.Sprite meshType 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteMeshType = async (meshType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, meshType, _meshType: meshType } },
            `Sprite meshType=${['NORMAL','POLYGON'][meshType] ?? meshType} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SpMesh</span>
            {([['NORMAL', 0], ['POLY', 1]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applySpriteMeshType(v)} title={`meshType=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2113: 공통 cc.Sprite trim 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySpriteTrim = async (trim: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, trim, _trim: trim } },
            `Sprite trim=${trim} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SprTrim</span>
            <span onClick={() => applySpriteTrim(true)} title="trim ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>trim✓</span>
            <span onClick={() => applySpriteTrim(false)} title="trim OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>trim✗</span>
          </div>
        )
      })()}
      {/* R2206: 공통 cc.Sprite blendMode(srcBlendFactor/dstBlendFactor) 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpBlend = async (src: number, dst: number, label: string) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, srcBlendFactor: src, dstBlendFactor: dst, _srcBlendFactor: src, _dstBlendFactor: dst, _N$srcBlendFactor: src, _N$dstBlendFactor: dst } },
            `Sprite blend=${label} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SpBlend</span>
            {([['Norm', 770, 771], ['Add', 1, 1], ['Mul', 774, 771], ['Scr', 1, 771]] as [string, number, number][]).map(([l, s, d]) => (
              <span key={l} onClick={() => applySpBlend(s, d, l)} title={`src=${s},dst=${d}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2072: 공통 cc.Sprite fillType 일괄 설정 (Filled 타입) */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprFillType = async (fillType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, fillType, _fillType: fillType } },
            `Sprite fillType=${fillType} (${uuids.length}개)`,
          )
        }
        // 0=Horizontal, 1=Vertical, 2=Radial
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SprFT</span>
            {([0, 1, 2] as const).map((v, i) => (
              <span key={v} title={`fillType = ${v} (${['H','V','Rad'][i]})`}
                onClick={() => applySprFillType(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{['H','V','Rad'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R1923: 공통 cc.Sprite fillRange 일괄 설정 (Filled 타입) */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applyFillRange = async (fillRange: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, fillRange, _fillRange: fillRange } },
            `Sprite fillRange ${fillRange} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>FillRng</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`fillRange = ${v}`}
                onClick={() => applyFillRange(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1933: 공통 cc.Sprite fillStart 일괄 설정 (Filled 타입) */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applyFillStart = async (fillStart: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, fillStart, _fillStart: fillStart } },
            `Sprite fillStart ${fillStart} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>FillSt</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`fillStart = ${v}`}
                onClick={() => applyFillStart(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R2170: 공통 cc.Sprite fillCenter 일괄 설정 (Filled 타입) */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySpriteFillCenter = async (x: number, y: number) => {
          if (!sceneFile.root) return
          const fillCenter = { x, y }
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, fillCenter, _fillCenter: fillCenter } },
            `Sprite fillCenter=(${x},${y}) (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>FillCtr</span>
            {([[0.5,0.5,'C'],[0,0,'BL'],[1,0,'BR'],[0,1,'TL'],[1,1,'TR']] as const).map(([x,y,l]) => (
              <span key={l} onClick={() => applySpriteFillCenter(x, y)} title={`fillCenter=(${x},${y})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1954: 공통 cc.Sprite grayscale 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprGray = async (grayscale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, grayscale, _grayscale: grayscale } },
            `Sprite grayscale=${grayscale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>SprGray</span>
            <span onClick={() => applySprGray(true)} title="grayscale ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>gray✓</span>
            <span onClick={() => applySprGray(false)} title="grayscale OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>gray✗</span>
          </div>
        )
      })()}
      {/* R2007: 공통 cc.Sprite isTrimmedMode 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySprTrimmed = async (isTrimmedMode: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, isTrimmedMode, _isTrimmedMode: isTrimmedMode } },
            `Sprite isTrimmed=${isTrimmedMode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprTrim</span>
            <span onClick={() => applySprTrimmed(true)} title="isTrimmedMode ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>trm✓</span>
            <span onClick={() => applySprTrimmed(false)} title="isTrimmedMode OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>trm✗</span>
          </div>
        )
      })()}
      {/* R2225: 공통 cc.Sprite _isTrimmedMode 숫자 선택 (CC3.x: 0=Trim, 1=Raw, 2=Polygon) */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteTrimMode = async (mode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, _isTrimmedMode: mode } },
            `Sprite _isTrimmedMode=${mode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SpTrimM</span>
            {([['Trim(0)', 0], ['Raw(1)', 1], ['Poly(2)', 2]] as [string, number][]).map(([label, mode]) => (
              <span key={mode} onClick={() => applySpriteTrimMode(mode)} title={`_isTrimmedMode=${mode}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2226: 공통 cc.Sprite capInsets 균등 9-slice 일괄 설정 (CC2.x/CC3.x) */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteCap = async (inset: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, insetTop: inset, _insetTop: inset, _N$insetTop: inset, insetBottom: inset, _insetBottom: inset, _N$insetBottom: inset, insetLeft: inset, _insetLeft: inset, _N$insetLeft: inset, insetRight: inset, _insetRight: inset, _N$insetRight: inset } },
            `Sprite capInset=${inset} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprInst</span>
            {[0, 1, 2, 4, 8, 16].map(v => (
              <span key={v} onClick={() => applySpriteCap(v)} title={`capInset=${v} (all 4 insets)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2706: 공통 cc.Sprite 단색 사각형 일괄 교체 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applyBatchSolidColor = async () => {
          if (!sceneFile.root) return
          const m = batchSolidColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
          if (!m) return
          const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16)
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, spriteFrame: null, _spriteFrame: null, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 } } },
            `단색 Sprite (${batchSolidColor}) 적용 (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprSolid</span>
            <input type="color" value={batchSolidColor} onChange={e => setBatchSolidColor(e.target.value)}
              style={{ width: 32, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>단색</span>
            <span onClick={applyBatchSolidColor}
              style={{ fontSize: 9, padding: '1px 6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', cursor: 'pointer', userSelect: 'none' }}>
              적용
            </span>
          </div>
        )
      })()}
      {/* R2232: 공통 cc.RigidBody _gravityScale 일괄 설정 (CC3.x) */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBGravScale3 = async (gravityScale: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, gravityScale, _gravityScale: gravityScale } },
            `RigidBody _gravityScale=${gravityScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBGrv3</span>
            {[0, 0.5, 1, 2, 5, 10].map(v => (
              <span key={v} onClick={() => applyRBGravScale3(v)} title={`_gravityScale=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2232: 공통 cc.Scrollbar _autoHideTime 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Scrollbar') && (() => {
        const applySBAutoHideTime3 = async (autoHideTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => { ...c, props: { ...c.props, autoHideTime, _autoHideTime: autoHideTime, _N$autoHideTime: autoHideTime } },
            `Scrollbar _autoHideTime=${autoHideTime} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>SBHideT3</span>
            {[0, 0.5, 1, 2, 3].map(v => (
              <span key={v} onClick={() => applySBAutoHideTime3(v)} title={`_autoHideTime=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2233: 공통 cc.PageView _bounceEnabled 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVBounce3 = async (v: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => { ...c, props: { ...c.props, bounceEnabled: v, _bounceEnabled: v, _N$bounceEnabled: v } },
            `PageView _bounceEnabled=${v} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PVbnc3</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} onClick={() => applyPVBounce3(v)} title={`_bounceEnabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v ? '✓' : '✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2233: 공통 cc.ToggleContainer _allowSwitchOff 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.ToggleContainer') && (() => {
        const applyTCAllowSwitch3 = async (allowSwitchOff: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ToggleContainer',
            c => { ...c, props: { ...c.props, allowSwitchOff, _allowSwitchOff: allowSwitchOff } },
            `ToggleContainer _allowSwitchOff=${allowSwitchOff} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TCswitch3</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} onClick={() => applyTCAllowSwitch3(v)} title={`_allowSwitchOff=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v ? '✓' : '✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2234: 공통 cc.RichText _overflow 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRTOverflow3 = async (overflow: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => { ...c, props: { ...c.props, overflow, _overflow: overflow, _N$overflow: overflow } },
            `RichText _overflow=${overflow} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>RTOvfl3</span>
            {([['None', 0], ['Clamp', 1], ['Shrink', 2], ['Rsz', 3]] as [string, number][]).map(([l, v]) => (
              <span key={v} onClick={() => applyRTOverflow3(v)} title={`_overflow=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2234: 공통 cc.Canvas _fitWidth/_fitHeight 동시 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasFit3 = async (fitWidth: boolean, fitHeight: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => { ...c, props: { ...c.props, fitWidth, _fitWidth: fitWidth, fitHeight, _fitHeight: fitHeight } },
            `Canvas _fitWidth=${fitWidth} _fitHeight=${fitHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fde68a', width: 48, flexShrink: 0 }}>CanFit3</span>
            <span onClick={() => applyCanvasFit3(true, false)} title="_fitWidth=true _fitHeight=false"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fde68a', userSelect: 'none' }}>W✓H✗</span>
            <span onClick={() => applyCanvasFit3(false, true)} title="_fitWidth=false _fitHeight=true"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fde68a', userSelect: 'none' }}>W✗H✓</span>
            <span onClick={() => applyCanvasFit3(true, true)} title="_fitWidth=true _fitHeight=true"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fde68a', userSelect: 'none' }}>W✓H✓</span>
            <span onClick={() => applyCanvasFit3(false, false)} title="_fitWidth=false _fitHeight=false"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>W✗H✗</span>
          </div>
        )
      })()}
      {/* R2229: 공통 cc.Slider _direction 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderDir3 = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } },
            `Slider _direction=${direction === 0 ? 'H' : 'V'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SldrDir3</span>
            <span onClick={() => applySliderDir3(0)} title="_direction=Horizontal"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>H→</span>
            <span onClick={() => applySliderDir3(1)} title="_direction=Vertical"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>V↓</span>
          </div>
        )
      })()}
      {/* R2229: 공통 cc.Slider _interactable 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderInteract3 = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => { ...c, props: { ...c.props, interactable, _interactable: interactable, _N$interactable: interactable } },
            `Slider _interactable=${interactable} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SldrInt3</span>
            <span onClick={() => applySliderInteract3(true)} title="Slider _interactable ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>int✓</span>
            <span onClick={() => applySliderInteract3(false)} title="Slider _interactable OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>int✗</span>
          </div>
        )
      })()}
      {/* R2230: 공통 cc.EditBox _returnType 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditRetType3 = async (returnType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => { ...c, props: { ...c.props, returnType, _returnType: returnType, _N$returnType: returnType } },
            `Edit Ret Type3`,
          )
          const names = ['Dflt', 'Done', 'Send', 'Srch', 'Go', 'Next']
          setBatchMsg(`✓ EditBox _returnType=${names[returnType] ?? returnType} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBret3</span>
            {([['Dflt', 0], ['Done', 1], ['Send', 2], ['Go', 4]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyEditRetType3(v)} title={`_returnType=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2230: 공통 cc.Animation _playOnLoad 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimPOL3 = async (playOnLoad: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => { ...c, props: { ...c.props, playOnLoad, _playOnLoad: playOnLoad } },
            `Animation _playOnLoad=${playOnLoad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>AnimPOL3</span>
            <span onClick={() => applyAnimPOL3(true)} title="Animation _playOnLoad ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fbbf24', userSelect: 'none' }}>pol✓</span>
            <span onClick={() => applyAnimPOL3(false)} title="Animation _playOnLoad OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>pol✗</span>
          </div>
        )
      })()}
      {/* R2231: 공통 cc.TiledLayer _opacity 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.TiledLayer') && (() => {
        const applyTiledLayerOpa3 = async (opacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.TiledLayer',
            c => { ...c, props: { ...c.props, opacity, _opacity: opacity } },
            `TiledLayer _opacity=${opacity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>TLOpa3</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <span key={v} onClick={() => applyTiledLayerOpa3(v)} title={`_opacity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2231: 공통 cc.RigidBody _type 일괄 설정 (CC3.x) */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBType3 = async (type: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => { ...c, props: { ...c.props, type, _type: type } },
            `RigidBody _type=${['Dynamic','Static','Kinematic'][type] ?? type} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBtype3</span>
            {(['Dyn', 'Sta', 'Kin'] as const).map((l, v) => (
              <span key={v} title={`RigidBody _type=${['Dynamic','Static','Kinematic'][v]}`}
                onClick={() => applyRBType3(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2228: 공통 cc.Toggle _interactable 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Toggle') && (() => {
        const applyToggleInteract3 = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Toggle',
            c => { ...c, props: { ...c.props, interactable, _interactable: interactable } },
            `Toggle _interactable=${interactable} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TogInt3</span>
            <span onClick={() => applyToggleInteract3(true)} title="Toggle _interactable ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>int✓</span>
            <span onClick={() => applyToggleInteract3(false)} title="Toggle _interactable OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>int✗</span>
          </div>
        )
      })()}
      {/* R2228: 공통 cc.ProgressBar _reverse 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBReverse3 = async (reverse: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => { ...c, props: { ...c.props, reverse, _reverse: reverse, _N$reverse: reverse } },
            `ProgressBar _reverse=${reverse} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBRev3</span>
            <span onClick={() => applyPBReverse3(true)} title="ProgressBar _reverse ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>rev✓</span>
            <span onClick={() => applyPBReverse3(false)} title="ProgressBar _reverse OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>rev✗</span>
          </div>
        )
      })()}
      {/* R2227: 공통 cc.Button _zoomScale 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnZoom3 = async (zoom: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => { ...c, props: { ...c.props, zoomScale: zoom, _zoomScale: zoom } },
            `Button _zoomScale=${zoom} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnZm3</span>
            {([0.9, 1.0, 1.1, 1.2, 1.3, 1.5] as const).map(v => (
              <span key={v} title={`_zoomScale=${v}`}
                onClick={() => applyBtnZoom3(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2227: 공통 cc.ScrollView _brake 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVBrake3 = async (brake: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => { ...c, props: { ...c.props, brake, _brake: brake, _N$brake: brake } },
            `ScrollView _brake=${brake} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVBrk3</span>
            {([0, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`_brake=${v}`}
                onClick={() => applySVBrake3(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2226: 공통 cc.AudioSource _volume 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioVol3 = async (volume: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => { ...c, props: { ...c.props, volume, _volume: volume } },
            `AudioSource _volume=${Math.round(volume * 100)}% (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASVol3</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`_volume=${Math.round(v * 100)}%`}
                onClick={() => applyAudioVol3(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}>{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1867: 공통 cc.Sprite blendFactor 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprBlend = async (src: number, dst: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => { ...c, props: { ...c.props, srcBlendFactor: src, _srcBlendFactor: src, dstBlendFactor: dst, _dstBlendFactor: dst } },
            `Spr Blend`,
          )
          const names: Record<string, string> = {'770/771': 'Normal', '770/1': 'Add', '774/771': 'Mul'}
          setBatchMsg(`✓ Sprite blend=${names[`${src}/${dst}`] ?? `${src}/${dst}`} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprBlend</span>
            {([['Normal', 770, 771], ['Add', 770, 1], ['Mul', 774, 771]] as [string, number, number][]).map(([l, src, dst]) => (
              <span key={l} title={`srcBlend=${src} dstBlend=${dst}`}
                onClick={() => applySprBlend(src, dst)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1760: 공통 cc.Sprite tint 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>Sprite 색</span>
          <input type="color" defaultValue="#ffffff"
            onChange={async e => {
              const hex = e.target.value
              if (!sceneFile.root) return
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              await patchComponents(
                c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
                c => { ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 } } },
                `Sprite tint (${uuids.length}개)`,
              )
            }}
            style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
            title="cc.Sprite tint 색상 일괄 설정"
          />
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>tint</span>
        </div>
      )}
      {/* R1803: 공통 cc.Sprite grayscale 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>Sprite gray</span>
          {(['✓ gray', '○ gray'] as const).map(label => (
            <span key={label}
              title={`grayscale 모두 ${label.startsWith('✓') ? '활성' : '비활성'}`}
              onClick={async () => {
                if (!sceneFile.root) return
                const val = label.startsWith('✓')
                await patchComponents(
                  c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
                  c => { ...c, props: { ...c.props, grayscale: val, _grayscale: val, _N$grayscale: val } },
                  `grayscale ${val} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: label.startsWith('✓') ? '#94a3b8' : 'var(--text-muted)', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R1801: 공통 cc.Sprite type 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>Sprite typ</span>
          {([['Smp', 0], ['Slc', 1], ['Til', 2], ['Fil', 3]] as const).map(([l, v]) => (
            <span key={v} title={['Simple', 'Sliced', 'Tiled', 'Filled'][v]}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
                  c => { ...c, props: { ...c.props, type: v, _type: v, _N$type: v } },
                  `Sprite type ${['Simple','Sliced','Tiled','Filled'][v]} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#4ade80')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1762: 공통 cc.Label fontFamily 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label 폰트</span>
          <input type="text" placeholder="fontFamily (빈칸=기본)"
            style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={async e => {
              const ff = e.target.value.trim()
              if (!sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.Label',
                c => { ...c, props: { ...c.props, fontFamily: ff, _fontFamily: ff, _N$fontFamily: ff } },
                `fontFamily "${ff}" (${uuids.length}개)`,
              )
            }}
          />
        </div>
      )}
      {/* R1758: 공통 cc.Label 텍스트 색상 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label 색</span>
          <input type="color" defaultValue="#ffffff"
            onChange={async e => {
              const hex = e.target.value
              if (!sceneFile.root) return
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              await patchComponents(
                c => c.type === 'cc.Label',
                c => { ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 } } },
                `Label 색상 (${uuids.length}개)`,
              )
            }}
            style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
            title="cc.Label 텍스트 색상 일괄 설정"
          />
        </div>
      )}
      {/* R1750: 레이어 일괄 설정 (CC3.x) */}
      {sceneFile.projectInfo?.version === '3x' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>Layer</span>
          <select
            value={batchLayer}
            onChange={async e => {
              const val = e.target.value
              setBatchLayer(val)
              if (!val || !sceneFile.root) return
              const layer = parseInt(val)
              await patchNodes(n => ({ ...n, layer }), `Layer ${layer} (${uuids.length}개)`)
              setBatchLayer('')
            }}
            style={{ flex: 1, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px' }}
          >
            <option value="">(변경 안 함)</option>
            {([[1, 'DEFAULT'], [2, 'IGNORE_RAYCAST'], [16, 'UI_3D'], [524288, 'UI_2D'], [1073741824, 'ALL']] as [number, string][]).map(([v, n]) => (
              <option key={v} value={v}>{n} ({v})</option>
            ))}
          </select>
        </div>
      )}
      {/* Active 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>Active</span>
        {(['active', 'inactive', ''] as const).map(v => (
          <button
            key={v || 'none'}
            onClick={() => setBatchActive(v)}
            style={{
              fontSize: 9, padding: '1px 6px', cursor: 'pointer', borderRadius: 3,
              background: batchActive === v ? (v === 'active' ? 'rgba(74,222,128,0.25)' : v === 'inactive' ? 'rgba(248,81,73,0.2)' : 'rgba(255,255,255,0.1)') : 'transparent',
              border: batchActive === v ? `1px solid ${v === 'active' ? '#4ade80' : v === 'inactive' ? '#f85149' : '#666'}` : '1px solid transparent',
              color: v === 'active' ? '#4ade80' : v === 'inactive' ? '#f85149' : 'var(--text-muted)',
            }}
          >{v === '' ? '(변경 안 함)' : v === 'active' ? '활성화' : '비활성화'}</button>
        ))}
        {/* R2602: active 반전 */}
        <button
          title={`선택 ${uuids.length}개 노드 active 개별 반전 (R2602)`}
          onClick={async () => {
            if (!sceneFile.root) return
            await patchNodes(n => {
              return { ...n, active: !n.active}
            }, `active 반전 (${uuids.length}개)`)
          }}
          style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', borderRadius: 3, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', background: 'none' }}
        >반전</button>
        {/* R2622: active 교차 패턴 — 홀수 인덱스: 활성, 짝수: 비활성 */}
        {uuids.length >= 2 && (
          <button
            title={`선택 ${uuids.length}개 노드 active 교차 패턴 설정 (홀수=on, 짝수=off) (R2622)`}
            onClick={async () => {
              if (!sceneFile.root) return
              await patchOrdered((n, idx) => {
                return { ...n, active: idx % 2 === 0 }
              }, `active 교차 (${uuids.length}개)`)
            }}
            style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', borderRadius: 3, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', background: 'none' }}
          >교차</button>
        )}
      </div>
      {/* R2714: 조건부 active 토글 */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, flexWrap: 'wrap', paddingLeft: 52, marginBottom: 4 }}>
        <input
          placeholder="이름 패턴 또는 /regex/"
          value={condActivePattern}
          onChange={e => setCondActivePattern(e.target.value)}
          style={{ ...mkNiS(120), flex: 1 }}
        />
        <button onClick={() => setCondActiveValue('active')}
          style={mkBtnS(condActiveValue === 'active' ? '#22c55e' : '#374151')}>ON</button>
        <button onClick={() => setCondActiveValue('inactive')}
          style={mkBtnS(condActiveValue === 'inactive' ? '#ef4444' : '#374151')}>OFF</button>
        <button
          onClick={async () => {
            if (!condActivePattern.trim() || !sceneFile.root || uuids.length === 0) return
            let re: RegExp
            try {
              const m = condActivePattern.match(/^\/(.+)\/([gi]*)$/)
              re = m ? new RegExp(m[1], m[2] || 'i') : new RegExp(condActivePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            } catch { setBatchMsg('❌ 정규식 오류'); return }
            const targetVal = condActiveValue === 'active'
            let count = 0
            function patch(n: CCSceneNode): CCSceneNode {
              const ch = n.children.map(patch)
              if (!uuidSet.has(n.uuid)) return { ...n, children: ch }
              if (re.test(n.name ?? '')) { count++; return { ...n, active: targetVal, children: ch } }
              return { ...n, children: ch }
            }
            const newRoot = patch(sceneFile.root)
            if (count === 0) { setBatchMsg('⚠ 매칭 없음'); setTimeout(() => setBatchMsg(null), 2000); return }
            await saveScene({ ...sceneFile, root: newRoot })
            setBatchMsg(`✓ 조건부 ${condActiveValue} ${count}개`)
            setTimeout(() => setBatchMsg(null), 2000)
          }}
          disabled={!condActivePattern.trim()}
      {/* R2548: 선택 노드 중 cc.Label/cc.RichText 있는 것들에 텍스트 일괄 적용 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const hasLabelNode = uuids.some(u => {
          let found = false
          function find(n: CCSceneNode) { if (n.uuid === u) { found = n.components.some(c => c.type === 'cc.Label' || c.type === 'cc.RichText'); return }; n.children.forEach(find) }
          find(sceneFile.root!)
          return found
        })
        if (!hasLabelNode) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>레이블 (R2548)</span>
            <input
              placeholder="텍스트 일괄 적용 (Enter)"
              title="선택 노드 중 cc.Label/cc.RichText에 텍스트 일괄 입력 — Enter로 저장 (R2548)"
              style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: 120 }}
              onKeyDown={async e => {
                if (e.key !== 'Enter' || !sceneFile.root) return
                const text = (e.target as HTMLInputElement).value
                await patchNodes(n => {
                  const comps = n.components.map(c => {
                  if (c.type === 'cc.Label') return { ...c, props: { ...c.props, string: text } }
                  if (c.type === 'cc.RichText') return { ...c, props: { ...c.props, string: text } }
                  return c
                  })
                  return { ...n, components: comps}
                }, `레이블 텍스트 (R2548)`)
                ;(e.target as HTMLInputElement).value = ''
              }}
            />
          </div>
        )
      })()}
      {/* R2627: cc.Label 텍스트 일련번호 추가 — 선택 Label 노드에 1,2,3... 순번 붙이기 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const hasLabelNode = uuids.some(u => {
          let found = false
          function find(n: CCSceneNode) { if (n.uuid === u) { found = n.components.some(c => c.type === 'cc.Label'); return }; n.children.forEach(find) }
          find(sceneFile.root!)
          return found
        })
        if (!hasLabelNode) return null
        const applyLabelSerial = async (mode: 'append' | 'replace') => {
          if (!sceneFile.root) return
          await patchOrdered((n, idx) => {
            const hasLabel = n.components.some(c => c.type === 'cc.Label')
            if (!hasLabel) return n
            const num = idx + 1
            const comps = n.components.map(c => {
              if (c.type !== 'cc.Label') return c
              const cur = (c.props?.string as string | undefined) ?? ''
              const newStr = mode === 'append' ? `${cur}${num}` : String(num)
              return { ...c, props: { ...c.props, string: newStr } }
            })
            return { ...n, components: comps }
          }, `Label 순번 (${uuids.length}개)`)
        }
        const bs: React.CSSProperties = { fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#67e8f9', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>L순번 (R2627)</span>
            <span onClick={() => applyLabelSerial('append')} title="Label 텍스트 뒤에 순번 추가 (R2627)" style={bs}>+번호</span>
            <span onClick={() => applyLabelSerial('replace')} title="Label 텍스트를 순번으로 교체 (R2627)" style={{ ...bs, color: '#f9a8d4' }}>번호만</span>
          </div>
        )
      })()}
      {/* R2467: 컴포넌트 일괄 추가 */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>컴포넌트 일괄 추가</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {(['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.ScrollView', 'cc.Layout', 'cc.Widget', 'cc.Animation', 'cc.AudioSource', 'cc.UIOpacity', 'cc.Mask'] as const).map(ct => (
            <span
              key={ct}
              title={`선택 ${uuids.length}개 노드에 ${ct} 추가 (R2467)`}
              onClick={async () => {
                if (!sceneFile.root) return
                function patchAddComp(n: CCSceneNode): CCSceneNode {
                  const children = n.children.map(patchAddComp)
                  if (!uuidSet.has(n.uuid)) return { ...n, children }
                  if (n.components.some(c => c.type === ct)) return { ...n, children }
                  return { ...n, components: [...n.components, { type: ct, props: {} }], children }
                }
                const result = await saveScene(patchAddComp(sceneFile.root))
                setBatchMsg(result.success ? `✓ ${ct.split('.').pop()} 추가 (${uuids.length}개)` : `✗ 오류`)
                setTimeout(() => setBatchMsg(null), 2000)
              }}
              style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#4ade80')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >{ct.split('.').pop()}</span>
          ))}
        </div>
      </div>
      {/* R2491: 범용 컴포넌트 prop 일괄 편집 */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>⚙ 범용 prop 편집</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <input placeholder="cc.Label" value={genericCompType} onChange={e => setGenericCompType(e.target.value)}
            style={{ width: 68, fontSize: 9, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            title="컴포넌트 타입 (R2491)" />
          <input placeholder="prop명" value={genericPropName} onChange={e => setGenericPropName(e.target.value)}
            style={{ width: 60, fontSize: 9, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            title="prop 이름 (R2491)" />
          <input placeholder="값" value={genericPropVal} onChange={e => setGenericPropVal(e.target.value)}
            style={{ width: 52, fontSize: 9, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            title="설정할 값 (숫자/true/false/문자열) (R2491)" />
          <button
            onClick={async () => {
              if (!sceneFile.root || !genericCompType.trim() || !genericPropName.trim()) return
              const rawVal = genericPropVal
              let parsed: unknown = rawVal
              if (rawVal === 'true') parsed = true
              else if (rawVal === 'false') parsed = false
              else if (rawVal !== '' && !isNaN(Number(rawVal))) parsed = Number(rawVal)
              function patchGeneric(node: CCSceneNode): CCSceneNode {
                const children = node.children.map(patchGeneric)
                if (!uuidSet.has(node.uuid)) return { ...node, children }
                const comps = node.components.map(c => {
                  if (c.type !== genericCompType.trim()) return c
                  return { ...c, props: { ...c.props, [genericPropName.trim()]: parsed } }
                })
                return { ...node, components: comps, children }
              }
              const result = await saveScene(patchGeneric(sceneFile.root))
              setBatchMsg(result.success ? `✓ ${genericCompType}.${genericPropName}=${rawVal} (${uuids.length}개)` : `✗ 오류`)
              setTimeout(() => setBatchMsg(null), 2500)
            }}
            style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,191,36,0.5)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
            title={`${genericCompType}.${genericPropName} = ${genericPropVal} (R2491)`}
          >적용</button>
        </div>
      </div>
    </div>
  )
}
