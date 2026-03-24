import React, { useMemo } from 'react'
import type { RendererPropsWithSave } from './types'
import type { CCSceneNode } from '@shared/ipc-schema'

function findContentNode(n: CCSceneNode): CCSceneNode | null {
  for (const ch of n.children) {
    if (ch.name.toLowerCase() === 'content') return ch
    const found = findContentNode(ch)
    if (found) return found
  }
  return null
}

/** cc.PageView, cc.PageViewIndicator, cc.ScrollView, cc.Scrollbar Quick Edit renderer */
export function ScrollViewRenderer({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x, saveScene }: RendererPropsWithSave): React.ReactElement | null {
  const contentNode = useMemo(() => comp.type === 'cc.ScrollView' ? findContentNode(draft) : null, [comp.type, draft])
            const p = comp.props
            if (comp.type === 'cc.PageView') {
              const direction = Number(p.direction ?? p._direction ?? p._N$direction ?? 0)
              const scrollThreshold = Number(p.scrollThreshold ?? p._scrollThreshold ?? p._N$scrollThreshold ?? 0.5)
              const autoThreshold = Number(p.autoPageTurningThreshold ?? p._autoPageTurningThreshold ?? p._N$autoPageTurningThreshold ?? 0.3)
              // R1847: slideDuration
              const slideDuration = Number(p.slideDuration ?? p._slideDuration ?? p._N$slideDuration ?? 0.3)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2435: enabled (BatchInspector R2200) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked, _N$enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>direction</span>
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
                  {/* R1847: slideDuration */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>slideDur</span>
                    <input type="number" defaultValue={slideDuration} key={`sd-${slideDuration}`} min={0} step={0.05}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0.3
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, slideDuration: v, _slideDuration: v, _N$slideDuration: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>s</span>
                    {([0.1, 0.2, 0.3, 0.5] as const).map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, slideDuration: v, _slideDuration: v, _N$slideDuration: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${slideDuration === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: slideDuration === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {[['scrollThreshold', scrollThreshold], ['autoTurning', autoThreshold]].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>{label as string}</span>
                      <input type="range" min={0} max={1} step={0.05} value={val as number}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          const k = label === 'scrollThreshold' ? 'scrollThreshold' : 'autoPageTurningThreshold'
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [k]: v, [`_${k}`]: v, [`_N$${k}`]: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{(val as number).toFixed(2)}</span>
                    </div>
                  ))}
                  {/* R2377: pageTurningSpeed + effectType + autoPlay */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>turnSpd</span>
                    <input type="number" defaultValue={Number(p.pageTurningSpeed ?? p._pageTurningSpeed ?? p._N$pageTurningSpeed ?? 0.3)} min={0} step={0.05}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0.3; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pageTurningSpeed: v, _pageTurningSpeed: v, _N$pageTurningSpeed: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="pageTurningSpeed"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>effect</span>
                    {([['NONE', 0], ['SCROLL', 1], ['FADE', 2]] as const).map(([l, v]) => (
                      <span key={v} title={`effectType=${l}(${v})`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, effectType: v, _effectType: v, _N$effectType: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${Number(p.effectType ?? p._effectType ?? p._N$effectType ?? 0) === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: Number(p.effectType ?? p._effectType ?? p._N$effectType ?? 0) === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginLeft: 8 }}>
                      <input type="checkbox" checked={!!(p.autoPlay ?? p._autoPlay ?? p._N$autoPlay ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoPlay: e.target.checked, _autoPlay: e.target.checked, _N$autoPlay: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> autoPlay
                    </label>
                  </div>
                  {/* R1901: autoPageTurningInterval (0=비활성) */}
                  {(() => {
                    const interval = Number(p.autoPageTurningInterval ?? p._autoPageTurningInterval ?? p._N$autoPageTurningInterval ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>autoPT sec</span>
                        <input type="number" defaultValue={interval} key={`apt-${interval}`} min={0} step={0.5}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoPageTurningInterval: v, _autoPageTurningInterval: v, _N$autoPageTurningInterval: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>s (0=off)</span>
                        {([0, 1, 2, 3, 5] as const).map(v => (
                          <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoPageTurningInterval: v, _autoPageTurningInterval: v, _N$autoPageTurningInterval: v } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${interval === v ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: interval === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                          >{v === 0 ? 'off' : v}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2402: pageTurningEventTiming + speedAmplifier */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>evtTiming</span>
                    {([['Start', 0], ['End', 1]] as const).map(([l, v]) => {
                      const cur = Number(p.pageTurningEventTiming ?? p._pageTurningEventTiming ?? p._N$pageTurningEventTiming ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pageTurningEventTiming: v, _pageTurningEventTiming: v, _N$pageTurningEventTiming: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>speedAmp</span>
                    <input type="number" defaultValue={Number(p.speedAmplifier ?? p._speedAmplifier ?? p._N$speedAmplifier ?? 1)} min={0} step={0.1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedAmplifier: v, _speedAmplifier: v, _N$speedAmplifier: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="speedAmplifier"
                    />
                  </div>
                  {/* R2415: bounceEnabled (BatchInspector R1936) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.bounceEnabled ?? p._bounceEnabled ?? p._N$bounceEnabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceEnabled: e.target.checked, _bounceEnabled: e.target.checked, _N$bounceEnabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0, accentColor: '#34d399' }}
                    />bounceEnabled
                  </label>
                </div>
              )
            }
            // R2349: cc.PageViewIndicator — direction/spacingX/spacingY Quick Edit
            if (comp.type === 'cc.PageViewIndicator') {
              const direction = Number(p.direction ?? p._direction ?? p._N$direction ?? 0)
              const spacingX = Number(p.spacingX ?? p._spacingX ?? p._N$spacingX ?? 0)
              const spacingY = Number(p.spacingY ?? p._spacingY ?? p._N$spacingY ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked, _N$enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>direction</span>
                    {[['H', 0], ['V', 1]].map(([label, v]) => (
                      <span key={v} onClick={() => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v, _direction: v, _N$direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                        style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${direction === v ? '#34d399' : 'var(--border)'}`, color: direction === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{label}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>spacingX</span>
                    <input type="number" defaultValue={spacingX} key={`pvix-${spacingX}`} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingX: v, _spacingX: v, _N$spacingX: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>spacingY</span>
                    <input type="number" defaultValue={spacingY} key={`pviy-${spacingY}`} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingY: v, _spacingY: v, _N$spacingY: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                </div>
              )
            }
            // R2340: cc.ScrollView — horizontal/vertical/inertia/elastic/brake Quick Edit
            if (comp.type === 'cc.ScrollView') {
              const horizontal = !!(p.horizontal ?? p._horizontal ?? p._N$horizontal ?? false)
              const vertical = !!(p.vertical ?? p._vertical ?? p._N$vertical ?? true)
              const inertia = !!(p.inertia ?? p._inertia ?? p._N$inertia ?? true)
              const elastic = !!(p.elastic ?? p._elastic ?? p._N$elastic ?? true)
              const brake = Number(p.brake ?? p._brake ?? p._N$brake ?? 0.75)
              // R1740: content 자식 노드 찾기 (useMemo로 컴포넌트 상단에서 계산됨)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2438: enabled (BatchInspector R2193) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked, _N$enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      ['horizontal', horizontal, 'horizontal'],
                      ['vertical', vertical, 'vertical'],
                      ['inertia', inertia, 'inertia'],
                      ['elastic', elastic, 'elastic'],
                      /* R2450: bounce (BatchInspector R2065 — CC3.x) */
                      ['bounce', !!(p.bounce ?? p._bounce ?? p._N$bounce ?? false), 'bounce'],
                    ].map(([label, val, key]) => (
                      <label key={key as string} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={val as boolean}
                          onChange={e => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key as string]: e.target.checked, [`_${key as string}`]: e.target.checked, [`_N$${key as string}`]: e.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }}
                        />{label as string}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>brake</span>
                    <input type="range" min={0} max={1} step={0.05} value={brake}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, brake: v, _brake: v, _N$brake: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{brake.toFixed(2)}</span>
                  </div>
                  {/* R1784: brake 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 60 }}>
                    {[0, 0.5, 0.75, 1].map(v => (
                      <span key={v} title={`brake = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, brake: v, _brake: v, _N$brake: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(brake - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(brake - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1831: elasticDuration 편집 */}
                  {(() => {
                    const ed = Number(p.elasticDuration ?? p._elasticDuration ?? p._N$elasticDuration ?? 0.2)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>elasticDur</span>
                        <input type="number" defaultValue={ed} key={`ed-${ed}`} min={0} max={2} step={0.05}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0.2)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, elasticDuration: v, _elasticDuration: v, _N$elasticDuration: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        {([0, 0.1, 0.2, 0.5, 1] as const).map(v => (
                          <span key={v} title={`elasticDuration = ${v}s`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, elasticDuration: v, _elasticDuration: v, _N$elasticDuration: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${Math.abs(ed - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(ed - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                          >{v}s</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2379: bounceTime + mouseWheelScrollSensitivity + hideScrollBar */}
                  {/* R2424: bounceDuration (CC2.x, BatchInspector R1949) */}
                  {(() => {
                    const bounceTime = Number(p.bounceTime ?? p._bounceTime ?? p._N$bounceTime ?? 1)
                    const bounceDuration = Number(p.bounceDuration ?? p._bounceDuration ?? p._N$bounceDuration ?? 0.2)
                    const mwSens = Number(p.mouseWheelScrollSensitivity ?? p._mouseWheelScrollSensitivity ?? p._N$mouseWheelScrollSensitivity ?? 3.5)
                    const hideBar = !!(p.hideScrollBar ?? p._hideScrollBar ?? p._N$hideScrollBar ?? false)
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>bounceT</span>
                          <input type="number" defaultValue={bounceTime} key={`bt-${bounceTime}`} min={0} step={0.1}
                            onBlur={e => { const v = Math.max(0, parseFloat(e.target.value) || 1); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceTime: v, _bounceTime: v, _N$bounceTime: v } } : c); applyAndSave({ components: u }) }}
                            style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                            title="bounceTime (CC3.x)"
                          />
                          {[0.1, 0.3, 0.5, 1].map(v => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceTime: v, _bounceTime: v, _N$bounceTime: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(bounceTime - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(bounceTime - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                            >{v}s</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>bounceDur</span>
                          <input type="number" defaultValue={bounceDuration} key={`bd-${bounceDuration}`} min={0} step={0.05}
                            onBlur={e => { const v = Math.max(0, parseFloat(e.target.value) || 0.2); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceDuration: v, _bounceDuration: v, _N$bounceDuration: v } } : c); applyAndSave({ components: u }) }}
                            style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                            title="bounceDuration (CC2.x)"
                          />
                          {[0.1, 0.2, 0.4, 0.8].map(v => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, bounceDuration: v, _bounceDuration: v, _N$bounceDuration: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(bounceDuration - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(bounceDuration - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                            >{v}s</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>mwSens</span>
                          <input type="number" defaultValue={mwSens} key={`mws-${mwSens}`} min={0} step={0.5}
                            onBlur={e => { const v = parseFloat(e.target.value) || 3.5; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mouseWheelScrollSensitivity: v, _mouseWheelScrollSensitivity: v, _N$mouseWheelScrollSensitivity: v } } : c); applyAndSave({ components: u }) }}
                            style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                            title="mouseWheelScrollSensitivity"
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginLeft: 8 }}>
                            <input type="checkbox" checked={hideBar}
                              onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, hideScrollBar: e.target.checked, _hideScrollBar: e.target.checked, _N$hideScrollBar: e.target.checked } } : c); applyAndSave({ components: u }) }}
                            />hideBar
                          </label>
                        </div>
                      </>
                    )
                  })()}
                  {/* R2360: pagingEnabled + cancelInnerEvents + scrollDuration */}
                  {(() => {
                    const paging = !!(p.pagingEnabled ?? p._pagingEnabled ?? p._N$pagingEnabled ?? false)
                    const cancelInner = !!(p.cancelInnerEvents ?? p._cancelInnerEvents ?? p._N$cancelInnerEvents ?? true)
                    const scrollDur = Number(p.scrollDuration ?? p._scrollDuration ?? p._N$scrollDuration ?? 0.2)
                    return (
                      <>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                            <input type="checkbox" checked={paging}
                              onChange={e => {
                                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pagingEnabled: e.target.checked, _pagingEnabled: e.target.checked, _N$pagingEnabled: e.target.checked } } : c)
                                applyAndSave({ components: updated })
                              }}
                            />paging
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                            <input type="checkbox" checked={cancelInner}
                              onChange={e => {
                                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cancelInnerEvents: e.target.checked, _cancelInnerEvents: e.target.checked, _N$cancelInnerEvents: e.target.checked } } : c)
                                applyAndSave({ components: updated })
                              }}
                            />cancelInner
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>scrollDur</span>
                          <input type="number" min={0} step={0.05} defaultValue={scrollDur} key={`sd-${scrollDur}`}
                            onBlur={e => {
                              const v = Math.max(0, parseFloat(e.target.value) || 0.2)
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, scrollDuration: v, _scrollDuration: v, _N$scrollDuration: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          />
                          {[0, 0.1, 0.2, 0.5, 1].map(v => (
                            <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, scrollDuration: v, _scrollDuration: v, _N$scrollDuration: v } } : c); applyAndSave({ components: u }) }}
                              style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(scrollDur - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(scrollDur - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                            >{v}s</span>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                  {/* R2413: speedAmplifier (BatchInspector R1980) */}
                  {(() => {
                    const speed = Number(p.speedAmplifier ?? p._speedAmplifier ?? p._N$speedAmplifier ?? 1)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>speedAmp</span>
                        <input type="number" defaultValue={speed} key={`sa-${speed}`} min={0} step={0.1}
                          onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedAmplifier: v, _speedAmplifier: v, _N$speedAmplifier: v } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="speedAmplifier"
                        />
                        {([0.5, 1, 1.5, 2, 3] as const).map(v => (
                          <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedAmplifier: v, _speedAmplifier: v, _N$speedAmplifier: v } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(speed - v) < 0.01 ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(speed - v) < 0.01 ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                          >{v}x</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R1740: content 자식 노드 크기 퀵 편집 */}
                  {contentNode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 3 }}>
                      <span style={{ fontSize: 9, color: '#34d399', flexShrink: 0 }}>content</span>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>W</span>
                      <input type="number" defaultValue={Math.round(contentNode.size.x)}
                        key={`sv-cw-${contentNode.uuid}`}
                        onBlur={e => {
                          const v = parseFloat(e.target.value)
                          if (isNaN(v) || !sceneFile?.root) return
                          function patchContent(n: CCSceneNode): CCSceneNode {
                            if (n.uuid === contentNode!.uuid) return { ...n, size: { ...n.size, x: v } }
                            return { ...n, children: n.children.map(patchContent) }
                          }
                          saveScene(patchContent(sceneFile.root)).catch(err => console.error('[ScrollView] save failed', err))
                        }}
                        style={{ width: 50, fontSize: 9, padding: '1px 3px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                      />
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>H</span>
                      <input type="number" defaultValue={Math.round(contentNode.size.y)}
                        key={`sv-ch-${contentNode.uuid}`}
                        onBlur={e => {
                          const v = parseFloat(e.target.value)
                          if (isNaN(v) || !sceneFile?.root) return
                          function patchContent(n: CCSceneNode): CCSceneNode {
                            if (n.uuid === contentNode!.uuid) return { ...n, size: { ...n.size, y: v } }
                            return { ...n, children: n.children.map(patchContent) }
                          }
                          saveScene(patchContent(sceneFile.root)).catch(err => console.error('[ScrollView] save failed', err))
                        }}
                        style={{ width: 50, fontSize: 9, padding: '1px 3px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 2 }}
                      />
                    </div>
                  )}
                </div>
              )
            }
            // R2342: cc.Scrollbar — direction/enableAutoHide/autoHideTime Quick Edit
            if (comp.type === 'cc.Scrollbar') {
              const direction = Number(p.direction ?? p._direction ?? p._N$direction ?? 1)
              const enableAutoHide = !!(p.enableAutoHide ?? p._enableAutoHide ?? p._N$enableAutoHide ?? false)
              const autoHideTime = Number(p.autoHideTime ?? p._autoHideTime ?? p._N$autoHideTime ?? 1)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2430: enabled (BatchInspector R2198) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked, _N$enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>direction</span>
                    {[['H', 0], ['V', 1]].map(([label, v]) => (
                      <span key={v} onClick={() => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, direction: v, _direction: v, _N$direction: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                        style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${direction === v ? '#34d399' : 'var(--border)'}`, color: direction === v ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                      >{label}</span>
                    ))}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={enableAutoHide}
                      onChange={e => {
                        const v = e.target.checked
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableAutoHide: v, _enableAutoHide: v, _N$enableAutoHide: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#58a6ff' }}
                    />enableAutoHide
                  </label>
                  {enableAutoHide && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>autoHideTime</span>
                      <input type="number" defaultValue={autoHideTime} key={`sb-aht-${autoHideTime}`} min={0} step={0.1}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 1
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, autoHideTime: v, _autoHideTime: v, _N$autoHideTime: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>s</span>
                    </div>
                  )}
                </div>
              )
            }
            // R1556: cc.TiledMap / cc.TiledLayer Quick Edit
            return null
}
