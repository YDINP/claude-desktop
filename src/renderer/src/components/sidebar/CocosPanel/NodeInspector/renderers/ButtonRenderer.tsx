import React from 'react'
import type { RendererProps } from './types'

/** cc.Toggle, cc.ToggleContainer, cc.EditBox, cc.Button, cc.Slider Quick Edit renderer */
export function ButtonRenderer({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.ToggleContainer') {
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {comp.type === 'cc.ToggleContainer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {/* R2427: ToggleContainer enabled (BatchInspector R2199) */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                          onChange={ev => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: ev.target.checked, _enabled: ev.target.checked } } : c); applyAndSave({ components: u }) }} />
                        enabled
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.allowSwitchOff ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, allowSwitchOff: ev.target.checked, _allowSwitchOff: ev.target.checked, _N$allowSwitchOff: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        allowSwitchOff
                      </label>
                      {/* R2378: autoCheckToggle */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={!!(p.autoCheckToggle ?? p._autoCheckToggle ?? p._N$autoCheckToggle ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoCheckToggle: ev.target.checked, _autoCheckToggle: ev.target.checked, _N$autoCheckToggle: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        autoCheckToggle
                      </label>
                    </div>
                  )}
                </div>
              )
            }
            // R1586/R1812: cc.EditBox — 텍스트 입력 필드 Quick Edit (applyAndSave)
            if (comp.type === 'cc.EditBox') {
              const INPUT_MODE = ['Any', 'EmailAddr', 'Numeric', 'PhoneNumber', 'URL', 'Decimal', 'SingleLine']
              const INPUT_FLAG = ['Default', 'Password', 'Sensitive', 'InitialCapsWord', 'InitialCapsSentence', 'InitialCapsAllChars']
              const RETURN_TYPE = ['Default', 'Done', 'Send', 'Search', 'Go', 'Next']
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2434: enabled (BatchInspector R2198) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>string (초기값)</label>
                    <input type="text" defaultValue={String(p.string ?? '')}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: ev.target.value, _string: ev.target.value, _N$string: ev.target.value } } : c)
                        applyAndSave({ components: updated })
                      }} />
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>placeholder</label>
                    <input type="text" defaultValue={String(p.placeholder ?? '')}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholder: ev.target.value, _placeholder: ev.target.value, _N$placeholder: ev.target.value } } : c)
                        applyAndSave({ components: updated })
                      }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>maxLength</label>
                      <input type="number" defaultValue={Number(p.maxLength ?? 20)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxLength: v, _maxLength: v, _N$maxLength: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>fontSize</label>
                      <input type="number" defaultValue={Number(p.fontSize ?? 20)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>inputMode</label>
                      <select value={Number(p.inputMode ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => {
                          const v = parseInt(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inputMode: v, _inputMode: v, _N$inputMode: v } } : c)
                          applyAndSave({ components: updated })
                        }}>
                        {INPUT_MODE.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>inputFlag</label>
                      <select value={Number(p.inputFlag ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => {
                          const v = parseInt(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inputFlag: v, _inputFlag: v, _N$inputFlag: v } } : c)
                          applyAndSave({ components: updated })
                        }}>
                        {INPUT_FLAG.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>returnType</label>
                    <select value={Number(p.returnType ?? 0)}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onChange={ev => {
                        const v = parseInt(ev.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, returnType: v, _returnType: v, _N$returnType: v } } : c)
                        applyAndSave({ components: updated })
                      }}>
                      {RETURN_TYPE.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                    </select>
                  </div>
                  {/* R2352: lineCount + tabIndex */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>lineCount</label>
                      <input type="number" min={1} defaultValue={Number(p.lineCount ?? p._lineCount ?? p._N$lineCount ?? 1)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = parseInt(ev.target.value) || 1
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineCount: v, _lineCount: v, _N$lineCount: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>tabIndex</label>
                      <input type="number" min={0} defaultValue={Number(p.tabIndex ?? p._tabIndex ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = parseInt(ev.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tabIndex: v, _tabIndex: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  </div>
                  {/* R2447: placeholderFontSize + fontColor + placeholderFontColor (BatchInspector R2208) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <label style={{ fontSize: 11, flexShrink: 0, width: 100 }}>phFontSize</label>
                    <input type="number" defaultValue={Number(p.placeholderFontSize ?? p._placeholderFontSize ?? p._N$placeholderFontSize ?? 20)} min={1} step={2}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = Math.max(1, parseInt(ev.target.value) || 20); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontSize: v, _placeholderFontSize: v, _N$placeholderFontSize: v } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {(() => {
                    const fc = p.fontColor ?? p._fontColor ?? p._N$fontColor as { r?: number; g?: number; b?: number } | undefined
                    const pfc = p.placeholderFontColor ?? p._placeholderFontColor ?? p._N$placeholderFontColor as { r?: number; g?: number; b?: number } | undefined
                    const fcHex = fc ? `#${(((fc as Record<string,number>).r ?? 255) << 16 | ((fc as Record<string,number>).g ?? 255) << 8 | ((fc as Record<string,number>).b ?? 255)).toString(16).padStart(6, '0')}` : '#ffffff'
                    const pfcHex = pfc ? `#${(((pfc as Record<string,number>).r ?? 127) << 16 | ((pfc as Record<string,number>).g ?? 127) << 8 | ((pfc as Record<string,number>).b ?? 127)).toString(16).padStart(6, '0')}` : '#888888'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: 11, flexShrink: 0 }}>fontColor</label>
                        <input type="color" defaultValue={fcHex}
                          style={{ width: 26, height: 20, border: '1px solid #444', borderRadius: 2, padding: 0, cursor: 'pointer', background: 'none' }}
                          onChange={ev => { const h = ev.target.value; const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16); const col = {r,g,b,a:255}; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } } : c); applyAndSave({ components: u }) }}
                        />
                        <label style={{ fontSize: 11, flexShrink: 0 }}>phColor</label>
                        <input type="color" defaultValue={pfcHex}
                          style={{ width: 26, height: 20, border: '1px solid #444', borderRadius: 2, padding: 0, cursor: 'pointer', background: 'none' }}
                          onChange={ev => { const h = ev.target.value; const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16); const col = {r,g,b,a:255}; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontColor: col, _placeholderFontColor: col, _N$placeholderFontColor: col } } : c); applyAndSave({ components: u }) }}
                        />
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1585: cc.RichText — 서식 텍스트 Quick Edit
            if (comp.type === 'cc.Button') {
              const btnEnabled = !!(p.enabled ?? p._enabled ?? true)
              const transition = Number(p.transition ?? 0)
              const interactable = !!(p.interactable ?? true)
              // R1725: duration (Color/Scale transition 공통)
              const duration = Number(p.duration ?? p._N$duration ?? 0.1)
              const toHex = (c: unknown) => {
                const col = c as { r?: number; g?: number; b?: number } | undefined
                if (!col) return '#ffffff'
                return `#${(col.r ?? 255).toString(16).padStart(2, '0')}${(col.g ?? 255).toString(16).padStart(2, '0')}${(col.b ?? 255).toString(16).padStart(2, '0')}`
              }
              const stateColors = [
                ['normal', p.normalColor],
                ['hover', p.hoverColor],
                ['pressed', p.pressedColor],
                ['disabled', p.disabledColor],
              ]
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2428: enabled (BatchInspector R2192) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={btnEnabled}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>transition</span>
                    <select value={transition}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, transition: v, _transition: v, _N$transition: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>None</option>
                      <option value={1}>Color</option>
                      <option value={2}>Sprite</option>
                      <option value={3}>Scale</option>
                    </select>
                  </div>
                  {/* R1840: transition 퀵 버튼 */}
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}></span>
                    {([['None',0],['Color',1],['Sprite',2],['Scale',3]] as [string,number][]).map(([label,v]) => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, transition: v, _transition: v, _N$transition: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${transition === v ? '#fb923c' : 'var(--border)'}`, color: transition === v ? '#fb923c' : 'var(--text-muted)', background: 'var(--bg-primary)' }}
                      >{label}</span>
                    ))}
                  </div>
                  {/* R1725: duration (Color/Scale) */}
                  {(transition === 1 || transition === 3) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>duration</span>
                      <input type="number" defaultValue={duration} min={0} step={0.05}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) ?? 0.1
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, duration: v, _duration: v, _N$duration: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>s</span>
                    </div>
                  )}
                  {transition === 1 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {stateColors.map(([label, val]) => (
                        <div key={label as string} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <input type="color" value={toHex(val)}
                            onChange={e => {
                              const hex = e.target.value
                              const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
                              const colorKey = `${label as string}Color`
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [colorKey]: { r, g, b, a: 255 }, [`_${colorKey}`]: { r, g, b, a: 255 }, [`_N$${colorKey}`]: { r, g, b, a: 255 } } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ width: 22, height: 18, border: '1px solid #333', borderRadius: 2, padding: 0, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 7, color: 'var(--text-muted)' }}>{label as string}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {transition === 3 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>zoomScale</span>
                      <input type="number" defaultValue={Number(p.zoomScale ?? 1.2)} min={0} step={0.05}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 1.2
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, zoomScale: v, _zoomScale: v, _N$zoomScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    </div>
                  )}
                  {/* R1763: Sprite 전환 모드 — 상태별 UUID 표시 */}
                  {transition === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {(['normal', 'hover', 'pressed', 'disabled'] as const).map(state => {
                        const key = `${state}Sprite`
                        const sf = (p[key] ?? p[`_N$${key}`]) as Record<string,unknown> | null
                        const uuid = sf?.__uuid__ as string | undefined
                        return uuid ? (
                          <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 8, color: 'var(--text-muted)', minWidth: 44, whiteSpace: 'nowrap', flexShrink: 0 }}>{state}</span>
                            <span style={{ fontSize: 8, color: '#fb923c', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={uuid}>{uuid.slice(0, 12)}…</span>
                            <span title="UUID 복사" onClick={() => navigator.clipboard.writeText(uuid).catch(() => {})} style={{ fontSize: 8, cursor: 'pointer', color: '#555', flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#fb923c')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⎘</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={interactable}
                        onChange={ev => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, interactable: ev.target.checked, _interactable: ev.target.checked, _N$interactable: ev.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />interactable
                    </label>
                    {/* R2358: autoGrayEffect */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.autoGrayEffect ?? p._autoGrayEffect ?? p._N$autoGrayEffect ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoGrayEffect: e.target.checked, _autoGrayEffect: e.target.checked, _N$autoGrayEffect: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />autoGray
                    </label>
                  </div>
                  {/* R1807: normalColor 퀵 프리셋 */}
                  {transition === 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>normal:</span>
                      {([['white', {r:255,g:255,b:255}], ['gray', {r:180,g:180,b:180}], ['dark', {r:64,g:64,b:64}], ['red', {r:255,g:80,b:80}], ['green', {r:80,g:200,b:100}]] as const).map(([l, c]) => (
                        <span key={l} title={`normalColor = ${l}`}
                          onClick={() => {
                            const col = { ...c, a: 255 }
                            const updated = draft.components.map(comp2 => comp2 === comp ? { ...comp2, props: { ...comp2.props, normalColor: col, _normalColor: col, _N$normalColor: col } } : comp2)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 16, height: 14, background: `rgb(${c.r},${c.g},${c.b})`, border: '1px solid #555', borderRadius: 2, cursor: 'pointer', display: 'inline-block' }}
                        />
                      ))}
                    </div>
                  )}
                  {/* R1823: 상태색 CC 기본값 리셋 */}
                  {transition === 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>reset:</span>
                      <span title="CC 2.x 기본값으로 모든 상태색 리셋&#10;normal=white, hover=white, pressed=gray(200), disabled=gray(120,a=200)"
                        onClick={() => {
                          const defs = {
                            normalColor: { r: 255, g: 255, b: 255, a: 255 },
                            hoverColor: { r: 255, g: 255, b: 255, a: 255 },
                            pressedColor: { r: 200, g: 200, b: 200, a: 255 },
                            disabledColor: { r: 120, g: 120, b: 120, a: 200 },
                          }
                          const updated = draft.components.map(c2 => c2 === comp ? { ...c2, props: { ...c2.props,
                            normalColor: defs.normalColor, _normalColor: defs.normalColor, _N$normalColor: defs.normalColor,
                            hoverColor: defs.hoverColor, _hoverColor: defs.hoverColor, _N$hoverColor: defs.hoverColor,
                            pressedColor: defs.pressedColor, _pressedColor: defs.pressedColor, _N$pressedColor: defs.pressedColor,
                            disabledColor: defs.disabledColor, _disabledColor: defs.disabledColor, _N$disabledColor: defs.disabledColor,
                          } } : c2)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 5px', background: '#374151', border: '1px solid #555', borderRadius: 2, cursor: 'pointer', color: '#d1d5db' }}
                      >↺ defaults</span>
                    </div>
                  )}
                </div>
              )
            }
            if (comp.type === 'cc.Toggle') {
              const checked = !!(p.isChecked ?? false)
              const interactable = !!(p.interactable ?? true)
              return (
                // R1716: isChecked + interactable 편집
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2426/R2451: cc.Toggle enabled (BatchInspector R2195) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={ev => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: ev.target.checked, _enabled: ev.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>isChecked</span>
                    <input type="checkbox" checked={checked}
                      onChange={ev => {
                        // compat: _isChecked: e.target.checked, _N$isChecked: e.target.checked
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isChecked: ev.target.checked, _isChecked: ev.target.checked, _N$isChecked: ev.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />
                    <span style={{ fontSize: 9, color: checked ? '#4ade80' : '#888' }}>{checked ? '✓ checked' : '○ unchecked'}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={interactable}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, interactable: e.target.checked, _interactable: e.target.checked, _N$interactable: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />
                    <span style={{ color: interactable ? 'var(--text-muted)' : '#f85149' }}>interactable</span>
                  </label>
                </div>
              )
            }
            if (comp.type === 'cc.EditBox') {
              const str = String(p.string ?? '')
              const placeholder = String(p.placeholder ?? '')
              const maxLength = Number(p.maxLength ?? -1)
              // R1791: inputFlag
              const inputFlag = Number(p.inputFlag ?? p._inputFlag ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>string</span>
                    <input type="text" defaultValue={str}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value, _string: e.target.value, _N$string: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>placeholder</span>
                    <input type="text" defaultValue={placeholder}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholder: e.target.value, _placeholder: e.target.value, _N$placeholder: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 3, padding: '1px 4px', fontStyle: 'italic' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>maxLength</span>
                    <input type="number" defaultValue={maxLength} min={-1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxLength: parseInt(e.target.value) || -1, _maxLength: parseInt(e.target.value) || -1, _N$maxLength: parseInt(e.target.value) || -1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{maxLength < 0 ? '(unlimited)' : `≤${maxLength}`}</span>
                  </div>
                  {/* R1791: inputFlag 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>inputFlag</span>
                    {([['Any', 0], ['Passwd', 3], ['Email', 1], ['Phone', 4], ['Num', 5]] as const).map(([l, v]) => (
                      <span key={v} title={l}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inputFlag: v, _inputFlag: v, _N$inputFlag: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${inputFlag === v ? '#f59e0b' : 'var(--border)'}`, borderRadius: 2, color: inputFlag === v ? '#f59e0b' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  {/* R2388: returnType 버튼 (CC3.x) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>returnType</span>
                    {([['Default', 0], ['Done', 1], ['Send', 2], ['Search', 3], ['Go', 4], ['Next', 5]] as const).map(([l, v]) => {
                      const cur = Number(p.returnType ?? p._returnType ?? p._N$returnType ?? 0)
                      return (
                        <span key={v} title={l}
                          onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, returnType: v, _returnType: v, _N$returnType: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${cur === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R2386: placeholderFontSize 퀵 편집 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>phFontSize</span>
                    <input type="number" defaultValue={Number(p.placeholderFontSize ?? p._placeholderFontSize ?? p._N$placeholderFontSize ?? 20)} min={1} step={2}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={ev => { const v = Math.max(1, parseInt(ev.target.value) || 20); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontSize: v, _placeholderFontSize: v, _N$placeholderFontSize: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[12, 16, 20, 24, 32, 48].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontSize: v, _placeholderFontSize: v, _N$placeholderFontSize: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2380: fontColor + placeholderFontColor */}
                  {(() => {
                    const fc = p.fontColor ?? p._fontColor ?? p._N$fontColor as { r?: number; g?: number; b?: number } | undefined
                    const pfc = p.placeholderFontColor ?? p._placeholderFontColor ?? p._N$placeholderFontColor as { r?: number; g?: number; b?: number } | undefined
                    const fcHex = fc ? `#${((fc.r ?? 255) << 16 | (fc.g ?? 255) << 8 | (fc.b ?? 255)).toString(16).padStart(6, '0')}` : '#ffffff'
                    const pfcHex = pfc ? `#${((pfc.r ?? 128) << 16 | (pfc.g ?? 128) << 8 | (pfc.b ?? 128)).toString(16).padStart(6, '0')}` : '#808080'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>fontColor</span>
                        <input type="color" defaultValue={fcHex}
                          style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                          onChange={ev => { const n2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (n2 >> 16) & 255, g: (n2 >> 8) & 255, b: n2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } } : c); applyAndSave({ components: u }) }}
                          title="fontColor"
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>phColor</span>
                        <input type="color" defaultValue={pfcHex}
                          style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                          onChange={ev => { const n2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (n2 >> 16) & 255, g: (n2 >> 8) & 255, b: n2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, placeholderFontColor: col, _placeholderFontColor: col, _N$placeholderFontColor: col } } : c); applyAndSave({ components: u }) }}
                          title="placeholderFontColor"
                        />
                      </div>
                    )
                  })()}
                  {/* R2419: fontSize + inputMode (BatchInspector R1943/R2085) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>fontSize</span>
                    <input type="number" defaultValue={Number(p.fontSize ?? p._fontSize ?? p._N$fontSize ?? 20)} min={1} step={2}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={ev => { const v = Math.max(1, parseInt(ev.target.value) || 20); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[12, 16, 20, 24, 32, 40].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>inputMode</span>
                    {([['Any', 0], ['Num', 2], ['Dec', 5], ['1L', 6]] as const).map(([l, v]) => {
                      const cur = Number(p.inputMode ?? p._inputMode ?? p._N$inputMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inputMode: v, _inputMode: v, _N$inputMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                </div>
              )
            }
            // R1524: cc.Animation — 클립 드롭다운 + defaultClip 표시 / R1700: 클립 목록 + 이름 복사
            if (comp.type === 'cc.Slider') {
              const progress = Number(p.progress ?? p._N$progress ?? 0)
              const direction = Number(p.direction ?? p._N$direction ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2429: enabled (BatchInspector R2195) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>progress</span>
                    <input type="range" min={0} max={1} step={0.01} value={progress}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, progress: v, _progress: v, _N$progress: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Math.round(progress * 100)}%</span>
                  </div>
                  {/* R1765: progress 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 62 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(v => (
                      <span key={v}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, progress: v, _progress: v, _N$progress: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 3px', borderRadius: 2, border: `1px solid ${Math.abs(progress - v) < 0.01 ? '#58a6ff' : 'var(--border)'}`, color: Math.abs(progress - v) < 0.01 ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{Math.round(v * 100)}%</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>direction</span>
                    <select value={direction}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v, _direction: v, _N$direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Horizontal</option>
                      <option value={1}>Vertical</option>
                    </select>
                  </div>
                  {/* R1902: interactable */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.interactable ?? p._N$interactable ?? true)}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, interactable: e.target.checked, _interactable: e.target.checked, _N$interactable: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />
                    <span style={{ color: !!(p.interactable ?? p._N$interactable ?? true) ? 'var(--text-muted)' : '#f85149' }}>interactable</span>
                  </label>
                  {/* R2359: minValue / maxValue / step */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>range</span>
                    <input type="number" step={0.1}
                      defaultValue={Number(p.minValue ?? p._minValue ?? p._N$minValue ?? 0)}
                      key={`smn-${Number(p.minValue ?? p._minValue ?? 0)}`}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, minValue: v, _minValue: v, _N$minValue: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="minValue"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>~</span>
                    <input type="number" step={0.1}
                      defaultValue={Number(p.maxValue ?? p._maxValue ?? p._N$maxValue ?? 1)}
                      key={`smx-${Number(p.maxValue ?? p._maxValue ?? 1)}`}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxValue: v, _maxValue: v, _N$maxValue: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="maxValue"
                    />
                    {([[0,1],[0,10],[0,100],[-1,1]] as const).map(([mn, mx]) => (
                      <span key={`${mn}-${mx}`} title={`min=${mn} max=${mx}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, minValue: mn, maxValue: mx, _minValue: mn, _maxValue: mx, _N$minValue: mn, _N$maxValue: mx } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{mn}~{mx}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>step</span>
                    <input type="number" min={0} step={0.01}
                      defaultValue={Number(p.step ?? p._step ?? p._N$step ?? 0)}
                      key={`sst-${Number(p.step ?? p._step ?? 0)}`}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, step: v, _step: v, _N$step: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[0, 0.01, 0.05, 0.1, 0.5, 1].map(v => (
                      <span key={v} title={`step = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, step: v, _step: v, _N$step: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1562: cc.VideoPlayer — remoteURL/loop/muted/playbackRate Quick Edit
            return null
}
