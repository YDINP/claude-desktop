import React from 'react'
import type { RendererProps } from './types'

/** cc.BoxCollider, cc.BoxCollider2D, cc.CircleCollider, cc.CircleCollider2D, cc.PolygonCollider, cc.PolygonCollider2D, cc.RigidBody, cc.RigidBody2D Quick Edit renderer */
export function PhysicsRenderer({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.BoxCollider' || comp.type === 'cc.BoxCollider2D') {
              const off = p.offset as { x?: number; y?: number } | undefined
              const sz = p.size as { width?: number; height?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2439: enabled (BatchInspector R2218) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset X</label>
                      <input type="number" defaultValue={Number(off?.x ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), x: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset Y</label>
                      <input type="number" defaultValue={Number(off?.y ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), y: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>width</label>
                      <input type="number" min={0} defaultValue={Number(sz?.width ?? 100)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newSz = { ...(sz ?? {}), width: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, size: newSz, _size: newSz, _N$size: newSz } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>height</label>
                      <input type="number" min={0} defaultValue={Number(sz?.height ?? 100)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newSz = { ...(sz ?? {}), height: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, size: newSz, _size: newSz, _N$size: newSz } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <input type="checkbox" checked={!!(p.sensor ?? false)}
                      onChange={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sensor: ev.target.checked, _sensor: ev.target.checked, _N$sensor: ev.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }} />
                    sensor
                  </label>
                  {/* R1849: friction / restitution */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 2 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>friction</label>
                      <input type="number" defaultValue={Number(p.friction ?? 0.2)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, friction: v, _friction: v, _N$friction: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>restitution</label>
                      <input type="number" defaultValue={Number(p.restitution ?? 0)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, restitution: v, _restitution: v, _N$restitution: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    {/* R2367: density */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>density</label>
                      <input type="number" defaultValue={Number(p.density ?? p._density ?? 1)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, density: v, _density: v, _N$density: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                  </div>
                  {/* R2391: category + mask */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>category</label>
                    <input type="number" defaultValue={Number(p.category ?? p._category ?? p._N$category ?? 1)} min={0} step={1}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, category: v, _category: v, _N$category: v } } : c); applyAndSave({ components: u }) }}
                    />
                    <label style={{ fontSize: 10, width: 30, flexShrink: 0 }}>mask</label>
                    <input type="number" defaultValue={Number(p.mask ?? p._mask ?? p._N$mask ?? -1)} step={1}
                      style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || -1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mask: v, _mask: v, _N$mask: v } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {/* R2401: tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>tag</label>
                    <input type="number" defaultValue={Number(p.tag ?? p._tag ?? 0)} min={0} step={1}
                      style={{ width: 44, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v, _N$tag: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[0,1,2,3,4].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v, _N$tag: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.CircleCollider' || comp.type === 'cc.CircleCollider2D') {
              const off = p.offset as { x?: number; y?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2439: enabled (BatchInspector R2220) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset X</label>
                      <input type="number" defaultValue={Number(off?.x ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), x: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset Y</label>
                      <input type="number" defaultValue={Number(off?.y ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), y: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>radius</label>
                      <input type="number" min={0} defaultValue={Number(p.radius ?? 50)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, radius: v, _radius: v, _N$radius: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <input type="checkbox" checked={!!(p.sensor ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sensor: ev.target.checked, _sensor: ev.target.checked, _N$sensor: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        sensor
                      </label>
                    </div>
                  </div>
                  {/* R1850: friction / restitution */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 2 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>friction</label>
                      <input type="number" defaultValue={Number(p.friction ?? 0.2)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, friction: v, _friction: v, _N$friction: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>restitution</label>
                      <input type="number" defaultValue={Number(p.restitution ?? 0)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, restitution: v, _restitution: v, _N$restitution: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    {/* R2367: density */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>density</label>
                      <input type="number" defaultValue={Number(p.density ?? p._density ?? 1)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, density: v, _density: v, _N$density: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                  </div>
                  {/* R2391: category + mask */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>category</label>
                    <input type="number" defaultValue={Number(p.category ?? p._category ?? p._N$category ?? 1)} min={0} step={1}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, category: v, _category: v, _N$category: v } } : c); applyAndSave({ components: u }) }}
                    />
                    <label style={{ fontSize: 10, width: 30, flexShrink: 0 }}>mask</label>
                    <input type="number" defaultValue={Number(p.mask ?? p._mask ?? p._N$mask ?? -1)} step={1}
                      style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || -1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mask: v, _mask: v, _N$mask: v } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {/* R2401: tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>tag</label>
                    <input type="number" defaultValue={Number(p.tag ?? p._tag ?? 0)} min={0} step={1}
                      style={{ width: 44, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v, _N$tag: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[0,1,2,3,4].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v, _N$tag: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1870: cc.PolygonCollider — sensor / friction / restitution 편집
            if (comp.type === 'cc.PolygonCollider' || comp.type === 'cc.PolygonCollider2D') {
              const off = p.offset as { x?: number; y?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2439: enabled (BatchInspector R2220) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset X</label>
                      <input type="number" defaultValue={Number(off?.x ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), x: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>offset Y</label>
                      <input type="number" defaultValue={Number(off?.y ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const newOff = { ...(off ?? {}), y: Number(ev.target.value) }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginBottom: 4 }}>
                    <input type="checkbox" checked={!!(p.sensor ?? false)}
                      onChange={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sensor: ev.target.checked, _sensor: ev.target.checked, _N$sensor: ev.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }} />
                    sensor
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>friction</label>
                      <input type="number" defaultValue={Number(p.friction ?? 0.2)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, friction: v, _friction: v, _N$friction: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>restitution</label>
                      <input type="number" defaultValue={Number(p.restitution ?? 0)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, restitution: v, _restitution: v, _N$restitution: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    {/* R2367: density */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>density</label>
                      <input type="number" defaultValue={Number(p.density ?? p._density ?? 1)} min={0} step={0.1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = parseFloat(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, density: v, _density: v, _N$density: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                  </div>
                  {/* R2368: PolygonCollider threshold */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 11, flexShrink: 0, width: 60 }}>threshold</label>
                    <input type="number" defaultValue={Number(p.threshold ?? p._threshold ?? 1)} min={0} step={0.5}
                      style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseFloat(ev.target.value) ?? 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, threshold: v, _threshold: v, _N$threshold: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[0.5, 1, 2, 5].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, threshold: v, _threshold: v, _N$threshold: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2391: category + mask */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>category</label>
                    <input type="number" defaultValue={Number(p.category ?? p._category ?? p._N$category ?? 1)} min={0} step={1}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, category: v, _category: v, _N$category: v } } : c); applyAndSave({ components: u }) }}
                    />
                    <label style={{ fontSize: 10, width: 30, flexShrink: 0 }}>mask</label>
                    <input type="number" defaultValue={Number(p.mask ?? p._mask ?? p._N$mask ?? -1)} step={1}
                      style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || -1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mask: v, _mask: v, _N$mask: v } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {/* R2401: tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 10, width: 50, flexShrink: 0 }}>tag</label>
                    <input type="number" defaultValue={Number(p.tag ?? p._tag ?? 0)} min={0} step={1}
                      style={{ width: 44, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onBlur={ev => { const v = parseInt(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v, _N$tag: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[0,1,2,3,4].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, tag: v, _tag: v, _N$tag: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1551: cc.RigidBody — 물리 강체 Quick Edit
            if (comp.type === 'cc.RigidBody' || comp.type === 'cc.RigidBody2D') {
              const rbTypes = ['DYNAMIC', 'STATIC', 'KINEMATIC']
              const rbType = Number(p.type ?? 0)
              const mass = Number(p.mass ?? 1)
              const linearDamping = Number(p.linearDamping ?? 0)
              const angularDamping = Number(p.angularDamping ?? 0)
              const gravityScale = Number(p.gravityScale ?? 1)
              const fixedRotation = !!(p.fixedRotation ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2438: enabled (BatchInspector R2217) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>type</span>
                    <select defaultValue={rbType}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: parseInt(e.target.value), _type: parseInt(e.target.value), _N$type: parseInt(e.target.value) } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      {rbTypes.map((t, i) => <option key={i} value={i}>{t}</option>)}
                    </select>
                  </div>
                  {/* R1843: type 퀵 버튼 */}
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}></span>
                    {rbTypes.map((t, v) => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: v, _type: v, _N$type: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${rbType === v ? '#34d399' : 'var(--border)'}`, color: rbType === v ? '#34d399' : 'var(--text-muted)', background: 'var(--bg-primary)' }}
                      >{t[0]}{t.slice(1,3).toLowerCase()}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>mass</span>
                    <input type="number" defaultValue={mass} min={0} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mass: parseFloat(e.target.value) || 1, _mass: parseFloat(e.target.value) || 1, _N$mass: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>gravityScale</span>
                    <input type="number" defaultValue={gravityScale} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravityScale: parseFloat(e.target.value) || 1, _gravityScale: parseFloat(e.target.value) || 1, _N$gravityScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1817: gravityScale 퀵 프리셋 */}
                    {([0, 0.5, 1, 2] as const).map(v => (
                      <span key={v} title={`gravityScale = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, gravityScale: v, _gravityScale: v, _N$gravityScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${gravityScale === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: gravityScale === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>linearDamp</span>
                    <input type="number" defaultValue={linearDamping} min={0} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearDamping: parseFloat(e.target.value) || 0, _linearDamping: parseFloat(e.target.value) || 0, _N$linearDamping: parseFloat(e.target.value) || 0 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1829: linearDamping 퀵 프리셋 */}
                    {([0, 0.1, 0.5, 1, 5] as const).map(v => (
                      <span key={v} title={`linearDamping = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearDamping: v, _linearDamping: v, _N$linearDamping: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${linearDamping === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: linearDamping === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1830: angularDamping 편집 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>angularDamp</span>
                    <input type="number" defaultValue={angularDamping} min={0} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angularDamping: parseFloat(e.target.value) || 0, _angularDamping: parseFloat(e.target.value) || 0, _N$angularDamping: parseFloat(e.target.value) || 0 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {([0, 0.1, 1, 5] as const).map(v => (
                      <span key={v} title={`angularDamping = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angularDamping: v, _angularDamping: v, _N$angularDamping: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${angularDamping === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: angularDamping === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2390: group + rotationOffset */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>group</span>
                    <input type="number" defaultValue={Number(p.group ?? p._group ?? p._N$group ?? 0)} step={1} min={0}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={e => { const v = parseInt(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, group: v, _group: v, _N$group: v } } : c); applyAndSave({ components: u }) }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>rotOff</span>
                    <input type="number" defaultValue={Number(p.rotationOffset ?? p._rotationOffset ?? p._N$rotationOffset ?? 0)} step={1}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, rotationOffset: v, _rotationOffset: v, _N$rotationOffset: v } } : c); applyAndSave({ components: u }) }}
                      title="rotationOffset"
                    />
                  </div>
                  {/* R2366: fixedRotation + bullet + allowSleep */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={fixedRotation}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fixedRotation: e.target.checked, _fixedRotation: e.target.checked, _N$fixedRotation: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#58a6ff' }}
                      />fixedRot
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.bullet ?? p._bullet ?? p._N$bullet ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bullet: e.target.checked, _bullet: e.target.checked, _N$bullet: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#58a6ff' }}
                      />bullet
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.allowSleep ?? p._allowSleep ?? p._N$allowSleep ?? true)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, allowSleep: e.target.checked, _allowSleep: e.target.checked, _N$allowSleep: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#58a6ff' }}
                      />allowSleep
                    </label>
                  </div>
                  {/* R2403: linearVelocity + angularVelocity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>linVel x</span>
                    <input type="number" defaultValue={Number((p.linearVelocity ?? p._linearVelocity ?? p._N$linearVelocity as { x?: number } | undefined)?.x ?? 0)} step={1}
                      onBlur={e => { const x = parseFloat(e.target.value) || 0; const y = Number((p.linearVelocity as { y?: number } | undefined)?.y ?? 0); const vel = { x, y }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearVelocity: vel, _linearVelocity: vel, _N$linearVelocity: vel } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="linearVelocity.x"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>y</span>
                    <input type="number" defaultValue={Number((p.linearVelocity ?? p._linearVelocity ?? p._N$linearVelocity as { y?: number } | undefined)?.y ?? 0)} step={1}
                      onBlur={e => { const y = parseFloat(e.target.value) || 0; const x = Number((p.linearVelocity as { x?: number } | undefined)?.x ?? 0); const vel = { x, y }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearVelocity: vel, _linearVelocity: vel, _N$linearVelocity: vel } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="linearVelocity.y"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>angVel</span>
                    <input type="number" defaultValue={Number(p.angularVelocity ?? p._angularVelocity ?? 0)} step={1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angularVelocity: v, _angularVelocity: v, _N$angularVelocity: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="angularVelocity"
                    />
                  </div>
                  {/* R2400: linearVelocityLimit + angularVelocityLimit */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>linVelLim</span>
                    <input type="number" defaultValue={Number(p.linearVelocityLimit ?? p._linearVelocityLimit ?? p._N$linearVelocityLimit ?? 0)} min={0} step={1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, linearVelocityLimit: v, _linearVelocityLimit: v, _N$linearVelocityLimit: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="linearVelocityLimit (0=무제한)"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6 }}>angVelLim</span>
                    <input type="number" defaultValue={Number(p.angularVelocityLimit ?? p._angularVelocityLimit ?? p._N$angularVelocityLimit ?? 0)} min={0} step={1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, angularVelocityLimit: v, _angularVelocityLimit: v, _N$angularVelocityLimit: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="angularVelocityLimit (0=무제한)"
                    />
                  </div>
                  {/* R2411: enabledContactListener (BatchInspector R2009) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', marginTop: 2 }}>
                    <input type="checkbox" checked={!!(p.enabledContactListener ?? p._enabledContactListener ?? p._N$enabledContactListener ?? false)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabledContactListener: e.target.checked, _enabledContactListener: e.target.checked, _N$enabledContactListener: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0, accentColor: '#f472b6' }}
                    />contactListener
                  </label>
                  {/* R2422: awake + sleepThreshold (BatchInspector R1975/R1997) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.awake ?? p._awake ?? p._N$awake ?? true)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, awake: e.target.checked, _awake: e.target.checked, _N$awake: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#fb923c' }}
                      />awake
                    </label>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>sleepThres</span>
                    <input type="number" defaultValue={Number(p.sleepThreshold ?? p._sleepThreshold ?? p._N$sleepThreshold ?? 0.01)} min={0} step={0.001}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0.01; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sleepThreshold: v, _sleepThreshold: v, _N$sleepThreshold: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="sleepThreshold"
                    />
                    {([0.005, 0.01, 0.02, 0.05] as const).map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sleepThreshold: v, _sleepThreshold: v, _N$sleepThreshold: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(Number(p.sleepThreshold ?? p._sleepThreshold ?? 0.01) - v) < 0.001 ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(Number(p.sleepThreshold ?? p._sleepThreshold ?? 0.01) - v) < 0.001 ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1549: dragonBones.ArmatureDisplay — DragonBones Quick Edit
            return null
}
