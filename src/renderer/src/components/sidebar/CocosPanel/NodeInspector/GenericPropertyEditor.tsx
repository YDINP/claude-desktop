import React from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { BoolToggle, WheelInput } from '../utils'

interface GenericPropertyEditorProps {
  comp: CCSceneNode['components'][number]
  draft: CCSceneNode
  applyAndSave: (patch: Partial<CCSceneNode>) => void
  origIdx: number
  ci: number
  propSearch: string
  setPropSearch: (v: string) => void
  favProps: Set<string>
  toggleFavProp: (compType: string, propKey: string) => void
  expandedArrayProps: Set<string>
  setExpandedArrayProps: React.Dispatch<React.SetStateAction<Set<string>>>
  origSnapRef: React.MutableRefObject<CCSceneNode | null>
  collapsedComps: Set<string>
  typeMatchedComps: Array<{ comp: CCSceneNode['components'][number]; origIdx: number }> | null
}

const HIDDEN = new Set(['objFlags', '_objFlags', 'enabled', 'playOnLoad', 'id', 'prefab', 'compPrefabInfo', 'contentSize', 'anchorPoint', 'N$file', 'N$spriteAtlas', 'N$clips', 'N$defaultClip', 'name', '_name'])
// 컴포넌트별 전용 렌더러(ComponentQuickEdit)가 이미 표시하는 prop 중복 제거
const COMP_SKIP: Record<string, Set<string>> = {
  'cc.Label': new Set(['string', '_string', 'fontSize', 'lineHeight', 'fontFamily', 'font', '_N$file', 'isSystemFontUsed', 'horizontalAlign', '_N$horizontalAlign', 'verticalAlign', 'overflow', '_N$overflow', 'cacheMode', 'isBold', 'isItalic', 'isUnderline', 'color', '_color', '_N$color', 'spacingX', '_spacingX', '_N$spacingX', 'spacingY', '_spacingY', '_N$spacingY', 'enableWrapText', '_enableWrapText', '_N$enableWrapText', '_isBold', '_N$isBold', '_isItalic', '_N$isItalic', '_isUnderline', '_N$isUnderline', 'isStrikethrough', '_isStrikethrough', '_N$isStrikethrough', 'platformFont', '_platformFont', '_N$platformFont', '_cacheMode', '_N$cacheMode']),
  'cc.RichText': new Set(['string', '_string', 'fontSize', 'fontFamily', 'font', '_N$file', 'isSystemFontUsed', 'horizontalAlign', 'maxWidth', 'lineHeight']),
  'cc.Sprite': new Set(['spriteFrame', '_spriteFrame', 'type', 'sizeMode', 'trim', 'grayscale', '_N$type', '_N$sizeMode', '_N$trim', '_N$grayscale']),
  'cc.Button': new Set(['interactable', 'transition', 'duration', 'zoomScale', 'normalColor', 'pressedColor', 'hoverColor', 'disabledColor']),
  'cc.Layout': new Set(['type', 'resizeMode', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'spacingX', 'spacingY', 'horizontalDirection', 'verticalDirection']),
  'cc.AudioSource': new Set(['clip', 'volume', 'loop', 'playOnAwake']),
}

/** Prop 변경 감지: 원시값/null은 직접 비교, 객체는 JSON.stringify 폴백 */
function shallowEqualPropValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  // 키 수 다르면 즉시 false (JSON.stringify 비용 절감)
  const aKeys = Object.keys(a as object)
  const bKeys = Object.keys(b as object)
  if (aKeys.length !== bKeys.length) return false
  // 객체/배열: JSON.stringify 폴백 (드문 경우)
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Generic property editor for component props — renders typed inputs for each property */
export function GenericPropertyEditor({ comp, draft, applyAndSave, origIdx, ci, propSearch, setPropSearch, favProps, toggleFavProp, expandedArrayProps, setExpandedArrayProps, origSnapRef, collapsedComps, typeMatchedComps }: GenericPropertyEditorProps): React.ReactElement | null {
  const [colorPickerProp, setColorPickerProp] = React.useState<string | null>(null)
  if (collapsedComps.has(comp.type) && typeMatchedComps === null) return null
            const compSkip = COMP_SKIP[comp.type]
            const allProps = Object.entries(comp.props).filter(([k]) => {
              if (HIDDEN.has(k)) return false
              if (compSkip?.has(k)) return false
              return true
            })
            const showFilter = allProps.length >= 3
            // 타입 매칭 시 전체 prop 표시, 아닐 때만 prop 이름 필터
            const isTypeMatch = typeMatchedComps !== null
            const baseFiltered = (propSearch && !isTypeMatch)
              ? allProps.filter(([k]) => k.toLowerCase().includes(propSearch.toLowerCase()))
              : allProps
            // 즐겨찾기 prop을 맨 앞으로 정렬
            const filteredProps = [
              ...baseFiltered.filter(([k]) => favProps.has(`${comp.type}:${k}`)),
              ...baseFiltered.filter(([k]) => !favProps.has(`${comp.type}:${k}`)),
            ]
            // R1536: propSearch 매칭 시 키 이름 하이라이트 — map 밖에서 한 번만 정의
            const buildPropKeyLabel = (key: string, isChanged: boolean): React.ReactNode => {
              const baseLabel = (() => {
                if (!propSearch) return key
                const lk = key.toLowerCase(), lq = propSearch.toLowerCase()
                const i = lk.indexOf(lq)
                if (i < 0) return key
                return <>{key.slice(0, i)}<mark style={{ background: 'rgba(250,204,21,0.25)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{key.slice(i, i + propSearch.length)}</mark>{key.slice(i + propSearch.length)}</>
              })()
              return isChanged
                ? <><span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', marginRight: 3, flexShrink: 0, verticalAlign: 'middle' }} title="변경됨" />{baseLabel}</>
                : baseLabel
            }
            return (
              <>
                {showFilter && (
                  <input
                    placeholder="Filter properties..."
                    value={propSearch}
                    onChange={e => setPropSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setPropSearch('') }}
                    style={{
                      width: '100%', boxSizing: 'border-box', marginBottom: 4,
                      background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 9,
                    }}
                  />
                )}
                {/* R1536: PropSearch 하이라이트 */}
                {filteredProps.map(([k, v]) => {
            const isFavProp = favProps.has(`${comp.type}:${k}`)
            // R1673: 원본 대비 변경된 prop 감지
            const origComp = origSnapRef.current?.components[origIdx]
            const origVal = origComp?.props[k]
            const isPropChanged = origComp !== undefined && !shallowEqualPropValue(v, origVal)
            const favBtn = (
              <span
                key="fav"
                className={isFavProp ? 'prop-fav is-fav' : 'prop-fav'}
                title={isFavProp ? '즐겨찾기 해제' : '즐겨찾기'}
                onClick={e => { e.stopPropagation(); toggleFavProp(comp.type, k) }}
                style={{
                  cursor: 'pointer', fontSize: 9, flexShrink: 0,
                  color: '#fbbf24',
                  opacity: isFavProp ? 1 : 0,
                  transition: 'opacity 0.1s',
                  paddingLeft: 2,
                }}
              >{isFavProp ? '★' : '☆'}</span>
            )
            // R1536: per-key wrapper — JSX uses {propKeyLabel(k)}{favBtn}
            const propKeyLabel = (key: string) => buildPropKeyLabel(key, isPropChanged)
            if (v && typeof v === 'object' && '__uuid__' in (v as object)) {
              const uuid = (v as { __uuid__: string }).__uuid__
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, overflow: 'hidden' }}>
                  <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                  <span
                    style={{
                      flex: 1, fontSize: 11, color: '#888', fontFamily: 'monospace',
                      background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '2px 5px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'copy', border: '1px dashed transparent',
                      transition: 'border-color 0.1s, background 0.1s',
                    }}
                    title={`${uuid}\n에셋을 여기에 드롭하여 UUID 변경`}
                    onDragOver={e => {
                      if (e.dataTransfer.types.includes('application/cc-asset')) {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'copy'
                        ;(e.currentTarget as HTMLElement).style.borderColor = '#58a6ff'
                        ;(e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.12)'
                      }
                    }}
                    onDragLeave={e => {
                      ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                    }}
                    onDrop={e => {
                      e.preventDefault()
                      ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                      try {
                        const data = JSON.parse(e.dataTransfer.getData('application/cc-asset') || '{}')
                        if (data.uuid) {
                          applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: { __uuid__: data.uuid } } } : c
                            )
                          })
                        }
                      } catch {}
                    }}
                    onClick={() => navigator.clipboard.writeText(uuid).catch(() => {})}
                  >
                    {uuid.slice(0, 8)}…
                  </span>
                </div>
              )
            }
            // 내부 참조 타입 {__id__: N}
            if (v && typeof v === 'object' && '__id__' in (v as object)) {
              const refId = (v as { __id__: number }).__id__
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, overflow: 'hidden' }}>
                  <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                  <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '2px 5px', flex: 1 }} title={`내부 참조 ID: ${refId}`}>
                    ref[{refId}]
                  </span>
                </div>
              )
            }
            // 벡터 타입 {x,y} 또는 {x,y,z} → 인라인 숫자 인풋
            if (v && typeof v === 'object' && !('__uuid__' in (v as object)) && !('__id__' in (v as object))) {
              const vobj = v as Record<string, unknown>
              const numKeys = Object.keys(vobj).filter(k => typeof vobj[k] === 'number')
              // RGBA 컬러 피커: r/g/b 키가 모두 있는 객체 (cc.Color 포함)
              const hasRgb = ['r', 'g', 'b'].every(c => c in vobj && typeof vobj[c] === 'number')
              if (hasRgb) {
                const r = Math.round(Math.min(255, Math.max(0, Number(vobj.r ?? 0))))
                const g = Math.round(Math.min(255, Math.max(0, Number(vobj.g ?? 0))))
                const b = Math.round(Math.min(255, Math.max(0, Number(vobj.b ?? 0))))
                const hasAlpha = 'a' in vobj && typeof vobj.a === 'number'
                const a = hasAlpha ? Math.round(Math.min(255, Math.max(0, Number(vobj.a ?? 255)))) : undefined
                const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                return (
                  <div key={k} className="prop-row" style={{ marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                      <input
                        type="color"
                        value={hex}
                        onChange={e => {
                          const h = e.target.value
                          const r2 = parseInt(h.slice(1, 3), 16)
                          const g2 = parseInt(h.slice(3, 5), 16)
                          const b2 = parseInt(h.slice(5, 7), 16)
                          applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, r: r2, g: g2, b: b2 } } } : c
                            )
                          })
                        }}
                        style={{ width: 36, height: 20, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {r},{g},{b}{hasAlpha ? `,${a}` : ''}
                      </span>
                    </div>
                    {hasAlpha && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, paddingLeft: 56 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 8 }}>A</span>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={a}
                          onChange={e => {
                            const newA = Number(e.target.value)
                            applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, a: newA } } } : c
                              )
                            })
                          }}
                          style={{ flex: 1, accentColor: 'var(--accent)', height: 4 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 22, textAlign: 'right' }}>{a}</span>
                      </div>
                    )}
                  </div>
                )
              }
              const isVec2 = vobj.__type__ === 'cc.Vec2'
              const isVec3 = vobj.__type__ === 'cc.Vec3'
              const isVecType = isVec2 || isVec3
              const vecAxes = isVec2 ? ['x', 'y'] : isVec3 ? ['x', 'y', 'z'] : null
              const axisColor: Record<string, string> = { x: '#e05555', y: '#55b055', z: '#4488dd' }
              if (isVecType && vecAxes) {
                return (
                  <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, overflow: 'hidden' }}>
                    <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                    <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                      {vecAxes.map(axis => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: axisColor[axis] ?? 'var(--text-muted)',
                            marginRight: 2, flexShrink: 0, userSelect: 'none',
                          }}>{axis.toUpperCase()}</span>
                          <WheelInput type="number" defaultValue={Number(vobj[axis])}
                            title={axis}
                            onChange={e => {
                              const val = parseFloat((e.target as HTMLInputElement).value)
                              if (!isNaN(val)) applyAndSave({
                                components: draft.components.map((c, i) =>
                                  i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: val } } } : c
                                )
                              })
                            }}
                            onBlur={e => applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: parseFloat((e.target as HTMLInputElement).value) || 0 } } } : c
                              )
                            })}
                            onWheelChange={e => {
                              e.preventDefault()
                              const el = e.target as HTMLInputElement
                              const current = parseFloat(el.value)
                              if (isNaN(current)) return
                              const delta = e.deltaY < 0 ? 1 : -1
                              const multiplier = e.shiftKey ? 10 : 1
                              const newVal = current + delta * multiplier
                              el.value = String(newVal)
                              applyAndSave({
                                components: draft.components.map((c, i) =>
                                  i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: newVal } } } : c
                                )
                              })
                            }}
                            style={{
                              flex: 1, minWidth: 0, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                              color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 11,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              if (numKeys.length >= 2 && numKeys.length <= 3) {
                return (
                  <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, overflow: 'hidden' }}>
                    <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                    <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                      {numKeys.map(axis => (
                        <WheelInput key={axis} type="number" defaultValue={Number(vobj[axis])}
                          title={axis}
                          onChange={e => {
                            const val = parseFloat((e.target as HTMLInputElement).value)
                            if (!isNaN(val)) applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: val } } } : c
                              )
                            })
                          }}
                          onBlur={e => applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: parseFloat((e.target as HTMLInputElement).value) || 0 } } } : c
                            )
                          })}
                          onWheelChange={e => {
                            e.preventDefault()
                            const el = e.target as HTMLInputElement
                            const current = parseFloat(el.value)
                            if (isNaN(current)) return
                            const delta = e.deltaY < 0 ? 1 : -1
                            const multiplier = e.shiftKey ? 10 : 1
                            const newVal = current + delta * multiplier
                            el.value = String(newVal)
                            applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: newVal } } } : c
                              )
                            })
                          }}
                          style={{
                            flex: 1, minWidth: 0, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 11,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              }
              if (numKeys.length >= 4 && numKeys.length <= 8) {
                return (
                  <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4, overflow: 'hidden' }}>
                    <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, flex: 1 }}>
                      {numKeys.map(axis => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>{axis}</span>
                          <WheelInput type="number" defaultValue={Number(vobj[axis])}
                            onBlur={e => {
                              const val = parseFloat((e.target as HTMLInputElement).value)
                              if (!isNaN(val)) applyAndSave({
                                components: draft.components.map((c, i) =>
                                  i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: val } } } : c
                                )
                              })
                            }}
                            onWheelChange={e => {
                              e.preventDefault()
                              const el = e.target as HTMLInputElement
                              const cur = parseFloat(el.value)
                              if (isNaN(cur)) return
                              const delta = e.deltaY < 0 ? 1 : -1
                              const newVal = cur + delta * (e.shiftKey ? 10 : 1)
                              el.value = String(newVal)
                              applyAndSave({
                                components: draft.components.map((c, i) =>
                                  i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: newVal } } } : c
                                )
                              })
                            }}
                            style={{ width: 44, minWidth: 0, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px', fontSize: 9 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              return null
            }
            // 배열 타입 — 펼치기/접기 토글 + 요소별 편집
            if (Array.isArray(v)) {
              const arrKey = `${comp.type}:${k}:${ci}`
              const isExpanded = expandedArrayProps.has(arrKey)
              const arr = v as unknown[]
              return (
                <div key={k} className="prop-row" style={{ marginBottom: 3 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setExpandedArrayProps(prev => {
                      const next = new Set(prev)
                      if (next.has(arrKey)) next.delete(arrKey)
                      else next.add(arrKey)
                      return next
                    })}
                  >
                    <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>{isExpanded ? '▾' : '▸'}</span>
                    <span style={{ minWidth: 48, whiteSpace: 'nowrap', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                    <span style={{ fontSize: 9, color: '#666' }}>[{arr.length}]</span>
                  </div>
                  {isExpanded && arr.map((elem, elemIdx) => {
                    const elemLabel = `[${elemIdx}]`
                    if (elem !== null && typeof elem === 'object' && '__type__' in (elem as object)) {
                      const elemObj = elem as Record<string, unknown>
                      const numSubKeys = Object.keys(elemObj).filter(k2 => typeof elemObj[k2] === 'number' && k2 !== '__type__')
                      return (
                        <div key={elemIdx} style={{ paddingLeft: 16, marginTop: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ minWidth: 44, whiteSpace: 'nowrap', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                            <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '1px 4px' }}>
                              {String(elemObj.__type__)}
                            </span>
                          </div>
                          {numSubKeys.length > 0 && numSubKeys.length <= 4 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, paddingLeft: 48, marginTop: 2 }}>
                              {numSubKeys.map(sk => (
                                <div key={sk} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{sk}</span>
                                  <WheelInput type="number" defaultValue={Number(elemObj[sk])}
                                    onBlur={e => {
                                      const val = parseFloat((e.target as HTMLInputElement).value)
                                      if (isNaN(val)) return
                                      const newArr = [...arr]
                                      newArr[elemIdx] = { ...elemObj, [sk]: val }
                                      applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                                    }}
                                    onWheelChange={e => {
                                      e.preventDefault()
                                      const el = e.target as HTMLInputElement
                                      const cur = parseFloat(el.value)
                                      if (isNaN(cur)) return
                                      const newVal = cur + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 1)
                                      el.value = String(newVal)
                                      const newArr = [...arr]
                                      newArr[elemIdx] = { ...elemObj, [sk]: newVal }
                                      applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                                    }}
                                    style={{ width: 44, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px', fontSize: 9 }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
                    if (typeof elem === 'number') {
                      return (
                        <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                          <span style={{ minWidth: 44, whiteSpace: 'nowrap', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                          <WheelInput
                            type="number"
                            defaultValue={elem}
                            onBlur={e => {
                              const val = parseFloat((e.target as HTMLInputElement).value)
                              if (isNaN(val)) return
                              const newArr = [...arr]
                              newArr[elemIdx] = val
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            onWheelChange={e => {
                              e.preventDefault()
                              const el = e.target as HTMLInputElement
                              const current = parseFloat(el.value)
                              if (isNaN(current)) return
                              const delta = e.deltaY < 0 ? 1 : -1
                              const newVal = current + delta * (e.shiftKey ? 10 : 1)
                              el.value = String(newVal)
                              const newArr = [...arr]
                              newArr[elemIdx] = newVal
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            style={{ flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 9 }}
                          />
                        </div>
                      )
                    }
                    if (typeof elem === 'string') {
                      return (
                        <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                          <span style={{ minWidth: 44, whiteSpace: 'nowrap', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                          <input
                            type="text"
                            defaultValue={elem}
                            onBlur={e => {
                              const newArr = [...arr]
                              newArr[elemIdx] = e.target.value
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            style={{ flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 9 }}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                        <span style={{ minWidth: 44, whiteSpace: 'nowrap', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                        <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>{JSON.stringify(elem)}</span>
                      </div>
                    )
                  })}
                </div>
              )
            }
            if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return null
            const isBool = typeof v === 'boolean'
            const isText = typeof v === 'string'
            // fontStyle → 드롭다운
            if (k === 'fontStyle' && typeof v === 'number') {
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, overflow: 'hidden' }}>
                  <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                  <select
                    value={Number(v)}
                    onChange={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: Number(e.target.value) } } : c
                      )
                    })}
                    style={{ flex: 1, fontSize: 11, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px' }}
                  >
                    <option value={0}>Normal</option>
                    <option value={1}>Bold</option>
                    <option value={2}>Italic</option>
                    <option value={3}>BoldItalic</option>
                  </select>
                </div>
              )
            }
            // 알려진 Cocos enum → 드롭다운
            const COCOS_ENUM_MAP: Record<string, Record<number, string>> = {
              overflow:        { 0: 'None', 1: 'Clamp', 2: 'Shrink', 3: 'Resize Height' },
              horizontalAlign: { 0: 'Left', 1: 'Center', 2: 'Right' },
              verticalAlign:   { 0: 'Top',  1: 'Center', 2: 'Bottom' },
              wrapMode:        { 0: 'Default', 1: 'Normal', 2: 'Loop', 3: 'PingPong', 4: 'ClampForever' },
              // R1487: cc.Button enum
              transition:      { 0: 'None', 1: 'Color', 2: 'Sprite', 3: 'Scale' },
              // R1487: cc.Layout enum
              type:            { 0: 'None', 1: 'Horizontal', 2: 'Vertical', 3: 'Grid' },
              resizeMode:      { 0: 'None', 1: 'Children', 2: 'Container' },
              axisDirection:   { 0: 'Horizontal', 1: 'Vertical' },
              verticalDirection:  { 0: 'Bottom to Top', 1: 'Top to Bottom' },
              horizontalDirection: { 0: 'Left to Right', 1: 'Right to Left' },
              // cc.Mask / cc.ScrollView
              _type:           { 0: 'Rect', 1: 'Ellipse', 2: 'Image Stencil' },
              movementType:    { 0: 'Unrestricted', 1: 'Elastic', 2: 'Clamped' },
            }
            if (k in COCOS_ENUM_MAP && typeof v === 'number') {
              const enumOptions = COCOS_ENUM_MAP[k]
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, overflow: 'hidden' }}>
                  <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                  <select
                    value={Number(v)}
                    onChange={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: Number(e.target.value) } } : c
                      )
                    })}
                    style={{ flex: 1, fontSize: 11, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px' }}
                  >
                    {Object.entries(enumOptions).map(([val, label]) => (
                      <option key={val} value={Number(val)}>{label}</option>
                    ))}
                  </select>
                </div>
              )
            }
            return (
              <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, overflow: 'hidden' }}>
                <span style={{ minWidth: 64, whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{propKeyLabel(k)}{favBtn}</span>
                {isBool ? (
                  <BoolToggle
                    value={Boolean(v)}
                    onChange={checked => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: checked } } : c
                      )
                    })}
                  />
                ) : isText ? (
                  (() => {
                    const strV = String(v)
                    const isColor = strV.startsWith('#') || strV.startsWith('rgb')
                    const toHex = (s: string): string => {
                      if (s.startsWith('#')) return s.slice(0, 7)
                      const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
                      if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
                      return '#000000'
                    }
                    return (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                        {isColor && (
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div
                              className="colorSwatch"
                              onClick={() => setColorPickerProp(colorPickerProp === k ? null : k)}
                              style={{
                                width: 14, height: 14, borderRadius: 2, border: '1px solid var(--border)',
                                background: strV, cursor: 'pointer', marginTop: 3, flexShrink: 0,
                              }}
                            />
                            {colorPickerProp === k && (
                              <input
                                type="color"
                                value={toHex(strV)}
                                onChange={e => applyAndSave({
                                  components: draft.components.map((c, i) =>
                                    i === origIdx ? { ...c, props: { ...c.props, [k]: e.target.value } } : c
                                  )
                                })}
                                style={{
                                  position: 'absolute', top: 18, left: 0, zIndex: 100,
                                  width: 40, height: 24, padding: 0, border: 'none', cursor: 'pointer',
                                }}
                              />
                            )}
                          </div>
                        )}
                        <textarea
                          rows={2}
                          defaultValue={strV}
                          onBlur={e => applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: e.target.value } } : c
                            )
                          })}
                          style={{
                            flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 11,
                            resize: 'vertical', fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    )
                  })()
                ) : (
                  <WheelInput
                    type="number"
                    defaultValue={Number(v)}
                    onChange={e => {
                      const val = parseFloat((e.target as HTMLInputElement).value)
                      if (!isNaN(val)) applyAndSave({
                        components: draft.components.map((c, i) =>
                          i === origIdx ? { ...c, props: { ...c.props, [k]: val } } : c
                        )
                      })
                    }}
                    onBlur={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: parseFloat((e.target as HTMLInputElement).value) || 0 } } : c
                      )
                    })}
                    onWheelChange={e => {
                      e.preventDefault()
                      const el = e.target as HTMLInputElement
                      const current = parseFloat(el.value)
                      if (isNaN(current)) return
                      const delta = e.deltaY < 0 ? 1 : -1
                      const multiplier = e.shiftKey ? 10 : 1
                      const newVal = current + delta * multiplier
                      el.value = String(newVal)
                      applyAndSave({
                        components: draft.components.map((c, i) =>
                          i === origIdx ? { ...c, props: { ...c.props, [k]: newVal } } : c
                        )
                      })
                    }}
                    style={{
                      flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 11,
                    }}
                  />
                )}
              </div>
            )
                })}
              </>
            )
}
