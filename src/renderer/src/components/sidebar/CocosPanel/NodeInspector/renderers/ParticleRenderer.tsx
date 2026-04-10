import React from 'react'
import type { RendererProps } from './types'

/** cc.ParticleSystem, cc.ParticleSystem2D Quick Edit renderer */
function ParticleRendererInner({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.ParticleSystem' || comp.type === 'cc.ParticleSystem2D') {
              const duration = Number(p.duration ?? p._duration ?? p._N$duration ?? -1)
              const maxParticles = Number(p.maxParticles ?? p._maxParticles ?? p._N$maxParticles ?? 150)
              const emitRate = Number(p.emissionRate ?? p._emissionRate ?? p._N$emissionRate ?? 10)
              const startSize = Number(p.startSize ?? p._startSize ?? p._N$startSize ?? 50)
              const endSize = Number(p.endSize ?? p._endSize ?? p._N$endSize ?? 0)
              // R1844: lifespan / lifespanVar
              const lifespan = Number(p.life ?? p._life ?? p._N$life ?? 1)
              const lifespanVar = Number(p.lifeVar ?? p._lifeVar ?? p._N$lifeVar ?? 0)
              // R1845: gravity
              const grav = (p.gravity ?? p._gravity ?? p._N$gravity) as { x?: number; y?: number } | undefined
              const gravX = Number(grav?.x ?? 0)
              const gravY = Number(grav?.y ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2436: enabled (BatchInspector R2194) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked, _N$enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>duration</span>
                    <input type="number" defaultValue={duration} step={0.5}
                      onBlur={e => {
                        const v = e.target.value === '' || isNaN(parseFloat(e.target.value)) ? -1 : parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, duration: v, _duration: v, _N$duration: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{duration === -1 ? '(loop)' : 's'}</span>
                    {/* R1793: duration 퀵 프리셋 */}
                    {([-1, 0.5, 1, 2, 3] as const).map(v => (
                      <span key={v} title={v === -1 ? 'loop' : `${v}s`}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, duration: v, _duration: v, _N$duration: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${duration === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: duration === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v === -1 ? '∞' : v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>maxParticles</span>
                    <input type="number" defaultValue={maxParticles} min={1} step={10}
                      onBlur={e => {
                        const v = Math.max(1, parseInt(e.target.value) || 150)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxParticles: v, _maxParticles: v, _N$maxParticles: v, totalParticles: v, _totalParticles: v, _N$totalParticles: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 60, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1833: startSize / endSize */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>startSize</span>
                    <input type="number" defaultValue={startSize} key={`ss-${startSize}`} min={0} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startSize: v, _startSize: v, _N$startSize: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>end</span>
                    <input type="number" defaultValue={endSize} key={`es-${endSize}`} min={0} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endSize: v, _endSize: v, _N$endSize: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R2448: startSizeVar / endSizeVar (BatchInspector R2049) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>sizeVar</span>
                    <input type="number" defaultValue={Number(p.startSizeVar ?? p._startSizeVar ?? p._N$startSizeVar ?? 0)} min={0} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startSizeVar: v, _startSizeVar: v, _N$startSizeVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>end</span>
                    <input type="number" defaultValue={Number(p.endSizeVar ?? p._endSizeVar ?? p._N$endSizeVar ?? 0)} min={0} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endSizeVar: v, _endSizeVar: v, _N$endSizeVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1815: emitRate 퀵 프리셋 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>emitRate</span>
                    <input type="number" defaultValue={emitRate} min={0.1} step={5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 10
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, emissionRate: v, _emissionRate: v, _N$emissionRate: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[5, 10, 30, 50, 100, 200].map(v => (
                      <span key={v} title={`emitRate = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, emissionRate: v, _emissionRate: v, _N$emissionRate: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${emitRate === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: emitRate === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1845: gravity x/y */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>gravity</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>x</span>
                    <input type="number" defaultValue={gravX} key={`gx-${gravX}`} step={10}
                      onBlur={e => {
                        const x = parseFloat(e.target.value) || 0
                        const ng = { x, y: gravY }
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravity: ng, _gravity: ng, _N$gravity: ng } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>y</span>
                    <input type="number" defaultValue={gravY} key={`gy-${gravY}`} step={10}
                      onBlur={e => {
                        const y = parseFloat(e.target.value) || 0
                        const ng = { x: gravX, y }
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravity: ng, _gravity: ng, _N$gravity: ng } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1844: lifespan / lifespanVar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>lifespan</span>
                    <input type="number" defaultValue={lifespan} key={`lf-${lifespan}`} min={0} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, life: v, _life: v, _N$life: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>var</span>
                    <input type="number" defaultValue={lifespanVar} key={`lfv-${lifespanVar}`} min={0} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lifeVar: v, _lifeVar: v, _N$lifeVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>s</span>
                  </div>
                  {/* R1834: startColor / endColor — CC2.x only (CC3.x has its own section below) */}
                  {!is3x && (() => {
                    const sc = (p.startColor ?? p._startColor ?? p._N$startColor) as { r?: number; g?: number; b?: number } | undefined
                    const ec = (p.endColor ?? p._endColor ?? p._N$endColor) as { r?: number; g?: number; b?: number } | undefined
                    const sr = (sc as Record<string,number>|undefined)?.r ?? 255, sg = (sc as Record<string,number>|undefined)?.g ?? 255, sb = (sc as Record<string,number>|undefined)?.b ?? 255
                    const er = (ec as Record<string,number>|undefined)?.r ?? 255, eg = (ec as Record<string,number>|undefined)?.g ?? 0, eb = (ec as Record<string,number>|undefined)?.b ?? 0
                    const startHex = `#${sr.toString(16).padStart(2,'0')}${sg.toString(16).padStart(2,'0')}${sb.toString(16).padStart(2,'0')}`
                    const endHex = `#${er.toString(16).padStart(2,'0')}${eg.toString(16).padStart(2,'0')}${eb.toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>color S→E</span>
                        <input type="color" value={startHex}
                          onChange={e => {
                            const h = e.target.value; const r2 = parseInt(h.slice(1,3),16), g2 = parseInt(h.slice(3,5),16), b2 = parseInt(h.slice(5,7),16)
                            const col = { r: r2, g: g2, b: b2, a: 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startColor: col, _startColor: col, _N$startColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 24, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
                        <input type="color" value={endHex}
                          onChange={e => {
                            const h = e.target.value; const r2 = parseInt(h.slice(1,3),16), g2 = parseInt(h.slice(3,5),16), b2 = parseInt(h.slice(5,7),16)
                            const col = { r: r2, g: g2, b: b2, a: 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endColor: col, _endColor: col, _N$endColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 24, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1841/R1889: speed / speedVar */}
                  {(() => {
                    const speed = Number(p.speed ?? p._speed ?? p._N$speed ?? 180)
                    const speedVar = Number(p.speedVar ?? p._speedVar ?? p._N$speedVar ?? 50)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>speed</span>
                        <input type="number" defaultValue={speed} key={`spd-${speed}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speed: v, _speed: v, _N$speed: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>±var</span>
                        <input type="number" defaultValue={speedVar} key={`spdv-${speedVar}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedVar: v, _speedVar: v, _N$speedVar: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1907: startRadius / endRadius (radial mode) */}
                  {(() => {
                    const startRadius = Number(p.startRadius ?? p._startRadius ?? p._N$startRadius ?? 0)
                    const endRadius = Number(p.endRadius ?? p._endRadius ?? p._N$endRadius ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>startR</span>
                        <input type="number" defaultValue={startRadius} key={`sr-${startRadius}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startRadius: v, _startRadius: v, _N$startRadius: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>endR</span>
                        <input type="number" defaultValue={endRadius} key={`er-${endRadius}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endRadius: v, _endRadius: v, _N$endRadius: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2448: startRadiusVar / endRadiusVar (BatchInspector — Radius mode) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>startRVar</span>
                    <input type="number" defaultValue={Number(p.startRadiusVar ?? p._startRadiusVar ?? p._N$startRadiusVar ?? 0)} min={0} step={10}
                      onBlur={e => {
                        const v = Math.max(0, parseFloat(e.target.value) || 0)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startRadiusVar: v, _startRadiusVar: v, _N$startRadiusVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>endRVar</span>
                    <input type="number" defaultValue={Number(p.endRadiusVar ?? p._endRadiusVar ?? p._N$endRadiusVar ?? 0)} min={0} step={10}
                      onBlur={e => {
                        const v = Math.max(0, parseFloat(e.target.value) || 0)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endRadiusVar: v, _endRadiusVar: v, _N$endRadiusVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1905: radialAccel / tangentialAccel */}
                  {(() => {
                    const radialAccel = Number(p.radialAccel ?? p._radialAccel ?? p._N$radialAccel ?? 0)
                    const tangentialAccel = Number(p.tangentialAccel ?? p._tangentialAccel ?? p._N$tangentialAccel ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>radialAccel</span>
                        <input type="number" defaultValue={radialAccel} key={`ra-${radialAccel}`} step={10}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, radialAccel: v, _radialAccel: v, _N$radialAccel: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>tan</span>
                        <input type="number" defaultValue={tangentialAccel} key={`ta-${tangentialAccel}`} step={10}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tangentialAccel: v, _tangentialAccel: v, _N$tangentialAccel: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2448: radialAccelVar / tangentialAccelVar (BatchInspector R2050/R2051) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>rAccelVar</span>
                    <input type="number" defaultValue={Number(p.radialAccelVar ?? p._radialAccelVar ?? p._N$radialAccelVar ?? 0)} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, radialAccelVar: v, _radialAccelVar: v, _N$radialAccelVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>tanVar</span>
                    <input type="number" defaultValue={Number(p.tangentialAccelVar ?? p._tangentialAccelVar ?? p._N$tangentialAccelVar ?? 0)} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tangentialAccelVar: v, _tangentialAccelVar: v, _N$tangentialAccelVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1887: angle / angleVar */}
                  {(() => {
                    const angle = Number(p.angle ?? p._angle ?? p._N$angle ?? 90)
                    const angleVar = Number(p.angleVar ?? p._angleVar ?? p._N$angleVar ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>angle</span>
                        <input type="number" defaultValue={angle} key={`ang-${angle}`} step={1}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 90
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angle: v, _angle: v, _N$angle: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>°</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>±var</span>
                        <input type="number" defaultValue={angleVar} key={`angv-${angleVar}`} min={0} step={1}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angleVar: v, _angleVar: v, _N$angleVar: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1913: posVar x / y */}
                  {(() => {
                    const posVarRaw = p.posVar ?? p._posVar ?? p._N$posVar as Record<string,number> | undefined
                    const pvx = Number((posVarRaw as Record<string,number>|undefined)?.x ?? 0)
                    const pvy = Number((posVarRaw as Record<string,number>|undefined)?.y ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>posVar x</span>
                        <input type="number" defaultValue={pvx} key={`pvx-${pvx}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, posVar: { x: v, y: pvy }, _posVar: { x: v, y: pvy }, _N$posVar: { x: v, y: pvy } } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 14, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>y</span>
                        <input type="number" defaultValue={pvy} key={`pvy-${pvy}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, posVar: { x: pvx, y: v }, _posVar: { x: pvx, y: v }, _N$posVar: { x: pvx, y: v } } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1937: startSpin / startSpinVar */}
                  {(() => {
                    const startSpin = Number(p.startSpin ?? p._startSpin ?? p._N$startSpin ?? 0)
                    const startSpinVar = Number(p.startSpinVar ?? p._startSpinVar ?? p._N$startSpinVar ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>startSpin</span>
                        <input type="number" defaultValue={startSpin} key={`ss-${startSpin}`} step={10}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startSpin: v, _startSpin: v, _N$startSpin: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>var</span>
                        <input type="number" defaultValue={startSpinVar} key={`ssv-${startSpinVar}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startSpinVar: v, _startSpinVar: v, _N$startSpinVar: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1938: endSpin / endSpinVar */}
                  {(() => {
                    const endSpin = Number(p.endSpin ?? p._endSpin ?? p._N$endSpin ?? 0)
                    const endSpinVar = Number(p.endSpinVar ?? p._endSpinVar ?? p._N$endSpinVar ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>endSpin</span>
                        <input type="number" defaultValue={endSpin} key={`es-${endSpin}`} step={10}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endSpin: v, _endSpin: v, _N$endSpin: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>var</span>
                        <input type="number" defaultValue={endSpinVar} key={`esv-${endSpinVar}`} min={0} step={10}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endSpinVar: v, _endSpinVar: v, _N$endSpinVar: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2384: sourcePos x/y */}
                  {(() => {
                    const spRaw = p.sourcePos ?? p._sourcePos ?? p._N$sourcePos as Record<string,number> | undefined
                    const spx = Number((spRaw as Record<string,number>|undefined)?.x ?? 0)
                    const spy = Number((spRaw as Record<string,number>|undefined)?.y ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>sourcePos</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>x</span>
                        <input type="number" defaultValue={spx} key={`spx-${spx}`} step={10}
                          onBlur={e => {
                            const x = parseFloat(e.target.value) || 0
                            const np = { x, y: spy }
                            const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sourcePos: np, _sourcePos: np, _N$sourcePos: np } } : c)
                            applyAndSave({ components: u })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
                        <input type="number" defaultValue={spy} key={`spy-${spy}`} step={10}
                          onBlur={e => {
                            const y = parseFloat(e.target.value) || 0
                            const np = { x: spx, y }
                            const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sourcePos: np, _sourcePos: np, _N$sourcePos: np } } : c)
                            applyAndSave({ components: u })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        {[0, 50, 100, -50, -100].map(v => (
                          <span key={v} onClick={() => { const np = { x: v, y: spy }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sourcePos: np, _sourcePos: np, _N$sourcePos: np } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '1px 2px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                          >{v}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2382: simulationSpace + rotationIsDir */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>simSpace</span>
                    {([['World', 0], ['Local', 1]] as const).map(([l, v]) => (
                      <span key={v} title={`simulationSpace=${l}(${v})`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, simulationSpace: v, _simulationSpace: v, _N$simulationSpace: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${Number(p.simulationSpace ?? p._simulationSpace ?? p._N$simulationSpace ?? 0) === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: Number(p.simulationSpace ?? p._simulationSpace ?? p._N$simulationSpace ?? 0) === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginLeft: 8 }}>
                      <input type="checkbox" checked={!!(p.rotationIsDir ?? p._rotationIsDir ?? p._N$rotationIsDir ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, rotationIsDir: e.target.checked, _rotationIsDir: e.target.checked, _N$rotationIsDir: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      />rotIsDir
                    </label>
                  </div>
                  {/* R1924: startColor / startColorVar */}
                  {(() => {
                    const scRaw = (p.startColor ?? p._startColor ?? p._N$startColor) as { r?: number; g?: number; b?: number } | undefined
                    const scHex = `#${((scRaw?.r ?? 255)).toString(16).padStart(2,'0')}${((scRaw?.g ?? 255)).toString(16).padStart(2,'0')}${((scRaw?.b ?? 255)).toString(16).padStart(2,'0')}`
                    const ecRaw = (p.endColor ?? p._endColor ?? p._N$endColor) as { r?: number; g?: number; b?: number } | undefined
                    const ecHex = `#${((ecRaw?.r ?? 255)).toString(16).padStart(2,'0')}${((ecRaw?.g ?? 255)).toString(16).padStart(2,'0')}${((ecRaw?.b ?? 255)).toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>startColor</span>
                        <input type="color" value={scHex} key={`sc-${scHex}`}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const col = { r, g, b, a: scRaw?.a ?? 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startColor: col, _startColor: col, _N$startColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>end</span>
                        <input type="color" value={ecHex} key={`ec-${ecHex}`}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const col = { r, g, b, a: ecRaw?.a ?? 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endColor: col, _endColor: col, _N$endColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2448: startColorVar / endColorVar (BatchInspector PS color variation) */}
                  {(() => {
                    const scvRaw = (p.startColorVar ?? p._startColorVar ?? p._N$startColorVar) as { r?: number; g?: number; b?: number; a?: number } | undefined
                    const ecvRaw = (p.endColorVar ?? p._endColorVar ?? p._N$endColorVar) as { r?: number; g?: number; b?: number; a?: number } | undefined
                    const scvHex = `#${((scvRaw?.r ?? 0)).toString(16).padStart(2,'0')}${((scvRaw?.g ?? 0)).toString(16).padStart(2,'0')}${((scvRaw?.b ?? 0)).toString(16).padStart(2,'0')}`
                    const ecvHex = `#${((ecvRaw?.r ?? 0)).toString(16).padStart(2,'0')}${((ecvRaw?.g ?? 0)).toString(16).padStart(2,'0')}${((ecvRaw?.b ?? 0)).toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>colorVar S</span>
                        <input type="color" value={scvHex} key={`scv-${scvHex}`}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const col = { r, g, b, a: scvRaw?.a ?? 0 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startColorVar: col, _startColorVar: col, _N$startColorVar: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>E</span>
                        <input type="color" value={ecvHex} key={`ecv-${ecvHex}`}
                          onChange={e => {
                            const h = e.target.value
                            const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                            const col = { r, g, b, a: ecvRaw?.a ?? 0 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endColorVar: col, _endColorVar: col, _N$endColorVar: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                      </div>
                    )
                  })()}
                  {/* R2448: rotatePerS / rotatePerSVar (BatchInspector — Radius mode) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>rotPerS</span>
                    <input type="number" defaultValue={Number(p.rotatePerS ?? p._rotatePerS ?? p._N$rotatePerS ?? 0)} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, rotatePerS: v, _rotatePerS: v, _N$rotatePerS: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>var</span>
                    <input type="number" defaultValue={Number(p.rotatePerSVar ?? p._rotatePerSVar ?? p._N$rotatePerSVar ?? 0)} step={10}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, rotatePerSVar: v, _rotatePerSVar: v, _N$rotatePerSVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R2448: startRotation / startRotationVar + endRotation / endRotationVar (BatchInspector — Radius mode) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>startRot</span>
                    <input type="number" defaultValue={Number(p.startRotation ?? p._startRotation ?? p._N$startRotation ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startRotation: v, _startRotation: v, _N$startRotation: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>var</span>
                    <input type="number" defaultValue={Number(p.startRotationVar ?? p._startRotationVar ?? p._N$startRotationVar ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startRotationVar: v, _startRotationVar: v, _N$startRotationVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>endRot</span>
                    <input type="number" defaultValue={Number(p.endRotation ?? p._endRotation ?? p._N$endRotation ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endRotation: v, _endRotation: v, _N$endRotation: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 40, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>var</span>
                    <input type="number" defaultValue={Number(p.endRotationVar ?? p._endRotationVar ?? p._N$endRotationVar ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endRotationVar: v, _endRotationVar: v, _N$endRotationVar: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R2421: emitterMode + autoRemoveOnFinish (BatchInspector R1981/R1979) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>emitMode</span>
                    {([['Grav', 0], ['Rad', 1]] as const).map(([l, v]) => {
                      const cur = Number(p.emitterMode ?? p._emitterMode ?? p._N$emitterMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, emitterMode: v, _emitterMode: v, _N$emitterMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginLeft: 8 }}>
                      <input type="checkbox" checked={!!(p.autoRemoveOnFinish ?? p._autoRemoveOnFinish ?? p._N$autoRemoveOnFinish ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoRemoveOnFinish: e.target.checked, _autoRemoveOnFinish: e.target.checked, _N$autoRemoveOnFinish: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0 }}
                      />autoRm
                    </label>
                  </div>
                  {/* R2440: loop + positionType + blendMode (BatchInspector R1932/R1976/R1977) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>loop</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.loop ?? p._loop ?? p._N$loop ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0 }}
                      />on
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>posType</span>
                    {([['Free', 0], ['Rel', 1], ['Grp', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.positionType ?? p._positionType ?? p._N$positionType ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, positionType: v, _positionType: v, _N$positionType: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>blend</span>
                    {([['Norm', 770, 771], ['Add', 770, 1], ['Mul', 774, 771]] as [string, number, number][]).map(([l, src, dst]) => {
                      const curSrc = Number(p.srcBlendFactor ?? p._srcBlendFactor ?? p._N$srcBlendFactor ?? 770)
                      const curDst = Number(p.dstBlendFactor ?? p._dstBlendFactor ?? p._N$dstBlendFactor ?? 771)
                      const active = curSrc === src && curDst === dst
                      return (
                        <span key={l} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, srcBlendFactor: src, _srcBlendFactor: src, _N$srcBlendFactor: src, dstBlendFactor: dst, _dstBlendFactor: dst, _N$dstBlendFactor: dst } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${active ? '#4ade80' : 'var(--border)'}`, borderRadius: 2, color: active ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                </div>
              )
            }
            // R1564: cc.ScrollView — horizontal/vertical/inertia/elastic Quick Edit
            return null
}
export const ParticleRenderer = React.memo(ParticleRendererInner)
