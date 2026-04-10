import React from 'react'
import type { RendererProps } from './types'
import { t } from '../../../../../utils/i18n'

/** cc.Layout Quick Edit renderer */
function LayoutRendererInner({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.Layout') {
              const layoutType = Number(p.type ?? p.layoutType ?? p._type ?? p._layoutType ?? p._N$type ?? p._N$layoutType ?? 0)
              const resizeMode = Number(p.resizeMode ?? p._resizeMode ?? p._N$resizeMode ?? 0)
              const spacingX = Number(p.spacingX ?? p._spacingX ?? p._N$spacingX ?? 0)
              const spacingY = Number(p.spacingY ?? p._spacingY ?? p._N$spacingY ?? 0)
              const pLeft = Number(p.paddingLeft ?? p._paddingLeft ?? p._N$paddingLeft ?? 0)
              const pRight = Number(p.paddingRight ?? p._paddingRight ?? p._N$paddingRight ?? 0)
              const pTop = Number(p.paddingTop ?? p._paddingTop ?? p._N$paddingTop ?? 0)
              const pBottom = Number(p.paddingBottom ?? p._paddingBottom ?? p._N$paddingBottom ?? 0)
              const autoWrap = !!(p.autoWrap ?? p._autoWrap ?? p._N$autoWrap ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2433: enabled (BatchInspector R2197) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked, _N$enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select value={layoutType}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: v, layoutType: v, _type: v, _layoutType: v, _N$type: v, _N$layoutType: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>None</option>
                      <option value={1}>Horizontal</option>
                      <option value={2}>Vertical</option>
                      <option value={3}>Grid</option>
                    </select>
                    <select value={resizeMode}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resizeMode: v, _resizeMode: v, _N$resizeMode: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>None</option>
                      <option value={1}>Children</option>
                      <option value={2}>Container</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 36, whiteSpace: 'nowrap', flexShrink: 0 }}>space</span>
                    {[['X', spacingX, 'spacingX'], ['Y', spacingY, 'spacingY']].map(([label, val, key]) => (
                      <input key={key as string} type="number" defaultValue={val as number} step={1}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: v, [`_${key as string}`]: v, [`_N$${key as string}`]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        placeholder={label as string}
                        style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    ))}
                    {/* R1783: spacing 퀵 프리셋 */}
                    {[0, 5, 10, 20].map(v => (
                      <span key={v} title={`spacing X/Y = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingX: v, _spacingX: v, _N$spacingX: v, spacingY: v, _spacingY: v, _N$spacingY: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${spacingX === v && spacingY === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: spacingX === v && spacingY === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 36, whiteSpace: 'nowrap', flexShrink: 0 }}>pad</span>
                    {[['L', pLeft, 'paddingLeft'], ['R', pRight, 'paddingRight'], ['T', pTop, 'paddingTop'], ['B', pBottom, 'paddingBottom']].map(([label, val, key]) => (
                      <input key={key as string} type="number" defaultValue={val as number} step={1}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: v, [`_${key as string}`]: v, [`_N$${key as string}`]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        placeholder={label as string}
                        style={{ width: 32, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    ))}
                    {/* R1748: 패딩 균등 버튼 */}
                    <span
                      title={t('layout.equalPadding')}
                      onClick={() => {
                        const v = Math.min(pLeft, pRight, pTop, pBottom)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, paddingLeft: v, _paddingLeft: v, _N$paddingLeft: v, paddingRight: v, _paddingRight: v, _N$paddingRight: v, paddingTop: v, _paddingTop: v, _N$paddingTop: v, paddingBottom: v, _paddingBottom: v, _N$paddingBottom: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ fontSize: 8, cursor: 'pointer', padding: '0 3px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >=</span>
                    {/* R1796: padding 퀵 프리셋 */}
                    {[0, 5, 10, 20].map(v => (
                      <span key={v} title={`padding 전체 = ${v}`}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, paddingLeft: v, _paddingLeft: v, _N$paddingLeft: v, paddingRight: v, _paddingRight: v, _N$paddingRight: v, paddingTop: v, _paddingTop: v, _N$paddingTop: v, paddingBottom: v, _paddingBottom: v, _N$paddingBottom: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${pLeft === v && pRight === v && pTop === v && pBottom === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: pLeft === v && pRight === v && pTop === v && pBottom === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1820: direction 버튼 (Horizontal/Vertical/Grid 공통) */}
                  {layoutType !== 0 && (() => {
                    const hDir = Number(p.horizontalDirection ?? p._horizontalDirection ?? p._N$horizontalDirection ?? 0)
                    const vDir = Number(p.verticalDirection ?? p._verticalDirection ?? p._N$verticalDirection ?? 1)
                    return (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>H:</span>
                          {([['L→R', 0], ['R→L', 1]] as const).map(([l, v]) => (
                            <span key={v} title={l}
                              onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalDirection: v, _horizontalDirection: v, _N$horizontalDirection: v } } : c); applyAndSave({ components: updated }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${hDir === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: hDir === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>V:</span>
                          {([['B→T', 0], ['T→B', 1]] as const).map(([l, v]) => (
                            <span key={v} title={l}
                              onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, verticalDirection: v, _verticalDirection: v, _N$verticalDirection: v } } : c); applyAndSave({ components: updated }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${vDir === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: vDir === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  {/* R2355: childAlignment 퀵 편집 */}
                  {(() => {
                    const childAlign = Number(p.childAlignment ?? p._childAlignment ?? p._N$childAlignment ?? 0)
                    const alignNames: Record<number, string> = { 0: 'None', 1: 'LT', 2: 'CT', 3: 'RT', 4: 'LC', 5: 'C', 6: 'RC', 7: 'LB', 8: 'CB', 9: 'RB' }
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 36, whiteSpace: 'nowrap', flexShrink: 0 }}>align</span>
                        {([[0,'None'],[1,'LT'],[5,'C'],[9,'RB'],[4,'LC'],[6,'RC']] as const).map(([v, l]) => (
                          <span key={v} title={`childAlignment = ${alignNames[v] ?? v}`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, childAlignment: v, _childAlignment: v, _N$childAlignment: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${childAlign === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: childAlign === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                          >{l}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2398: constraint + constraintNum + startAxis (Grid) */}
                  {layoutType === 3 && (() => {
                    const constraint = Number(p.constraint ?? p._constraint ?? p._N$constraint ?? 0)
                    const constraintNum = Number(p.constraintNum ?? p._constraintNum ?? p._N$constraintNum ?? 0)
                    const startAxis = Number(p.startAxis ?? p._startAxis ?? p._N$startAxis ?? 0)
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 36, whiteSpace: 'nowrap', flexShrink: 0 }}>constr</span>
                          {([['None', 0], ['Row', 1], ['Col', 2]] as const).map(([l, v]) => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, constraint: v, _constraint: v, _N$constraint: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${constraint === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: constraint === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                          <input type="number" defaultValue={constraintNum} min={0} step={1} title="constraintNum"
                            onBlur={e => { const v = parseInt(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, constraintNum: v, _constraintNum: v, _N$constraintNum: v } } : c); applyAndSave({ components: u }) }}
                            style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 36, whiteSpace: 'nowrap', flexShrink: 0 }}>axis</span>
                          {([['H→', 0], ['V↓', 1]] as const).map(([l, v]) => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startAxis: v, _startAxis: v, _N$startAxis: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${startAxis === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: startAxis === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                  {layoutType === 3 && (() => {
                    // R1709: Grid cellSize 편집
                    const cellSizeRaw = p.cellSize as { width?: number; height?: number } | undefined
                    const cellW = Number(cellSizeRaw?.width ?? 0)
                    const cellH = Number(cellSizeRaw?.height ?? 0)
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 36, whiteSpace: 'nowrap', flexShrink: 0 }}>cell</span>
                          {([['W', cellW, 'width'], ['H', cellH, 'height']] as const).map(([label, val, key]) => (
                            <input key={key} type="number" defaultValue={val} step={1} min={0}
                              onBlur={e => {
                                const v = parseFloat(e.target.value) || 0
                                const newCell = { width: key === 'width' ? v : cellW, height: key === 'height' ? v : cellH }
                                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cellSize: newCell, _cellSize: newCell, _N$cellSize: newCell } } : c)
                                applyAndSave({ components: updated })
                              }}
                              placeholder={label}
                              style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                            />
                          ))}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                          <input type="checkbox" checked={autoWrap}
                            onChange={e => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoWrap: e.target.checked, _autoWrap: e.target.checked, _N$autoWrap: e.target.checked } } : c)
                              applyAndSave({ components: updated })
                            }}
                          />autoWrap
                        </label>
                      </>
                    )
                  })()}
                  {/* R2409: affectedByScale (BatchInspector R2112) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.affectedByScale ?? p._affectedByScale ?? false)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, affectedByScale: e.target.checked, _affectedByScale: e.target.checked, _N$affectedByScale: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0, accentColor: '#818cf8' }}
                    />affectedByScale
                  </label>
                  {/* R2410: wrapMode (BatchInspector R2057) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>wrapMode</span>
                    {(() => {
                      const cur = Number(p.wrapMode ?? p._wrapMode ?? p._N$wrapMode ?? 0)
                      return ([['NoWrap', 0], ['Wrap', 1], ['1Line', 2]] as const).map(([l, v]) => (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, wrapMode: v, _wrapMode: v, _N$wrapMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      ))
                    })()}
                  </div>
                </div>
              )
            }
            // R1590/R1813: cc.Graphics Quick Edit (applyAndSave)
            return null
}
export const LayoutRenderer = React.memo(LayoutRendererInner)
