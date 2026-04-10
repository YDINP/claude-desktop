import React from 'react'
import type { RendererProps } from './types'
import { t } from '../../../../../utils/i18n'

/** cc.AudioSource, cc.Camera, cc.DirectionalLight, cc.PointLight, cc.SpotLight, cc.MotionStreak, cc.ParticleSystem, cc.ParticleSystem2D, cc.BlockInputEvents Quick Edit renderer */
function EffectsRendererInner({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.AudioSource') {
              const volume = Number(p.volume ?? 1)
              const loop = !!(p.loop ?? false)
              const playOnLoad = !!(p.playOnLoad ?? false)
              // R1864: pitch (CC3.x)
              const pitch = Number(p.pitch ?? p._pitch ?? 1)
              // R1701: 오디오 클립 uuid 추출
              const clipRaw = p._clip ?? p.clip
              const clipUuid = (clipRaw as Record<string,unknown> | null)?.__uuid__ as string | undefined
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2434: enabled (BatchInspector R2196) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R1701: 오디오 클립 uuid 표시 + 복사 / R_CLIP_DROP: 드래그 드롭으로 클립 교체 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>clip</span>
                    <span
                      title={clipUuid ? `${clipUuid}\n${t('effects.clipDrag')}` : t('effects.clipEmpty')}
                      style={{ fontSize: 8, color: clipUuid ? '#facc15' : 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, border: '1px dashed transparent', borderRadius: 3, padding: '1px 3px', cursor: 'copy', background: 'rgba(255,255,255,0.04)' }}
                      onDragOver={e => {
                        if (e.dataTransfer.types.includes('application/cc-asset')) {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'copy';
                          (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff';
                          (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.12)'
                        }
                      }}
                      onDragLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                        try {
                          const data = JSON.parse(e.dataTransfer.getData('application/cc-asset') || '{}')
                          if (data.uuid) {
                            const clipRef = { __uuid__: data.uuid }
                            applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, clip: clipRef, _clip: clipRef, _N$clip: clipRef } } : c
                              )
                            })
                          }
                        } catch {}
                      }}
                    >{clipUuid ?? '(none)'}</span>
                    {clipUuid && (
                      <span
                        title={t('effects.clipCopy')}
                        onClick={() => navigator.clipboard.writeText(clipUuid).catch(() => {})}
                        style={{ fontSize: 9, cursor: 'pointer', color: '#555', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#facc15')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                      >⎘</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>volume</span>
                    <input type="range" min={0} max={1} step={0.01} value={volume}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: parseFloat(e.target.value), _volume: parseFloat(e.target.value), _N$volume: parseFloat(e.target.value) } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
                  </div>
                  {/* R1785: volume 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 60 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(v => (
                      <span key={v} title={`volume = ${Math.round(v * 100)}%`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: v, _volume: v, _N$volume: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(volume - v) < 0.01 ? '#facc15' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(volume - v) < 0.01 ? '#facc15' : 'var(--text-muted)', userSelect: 'none' }}
                      >{Math.round(v * 100)}%</span>
                    ))}
                  </div>
                  {/* R1864: pitch 슬라이더 (CC3.x) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>pitch</span>
                    <input type="range" min={0.5} max={2} step={0.05} value={pitch}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pitch: v, _pitch: v, _N$pitch: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{pitch.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 60 }}>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
                      <span key={v} title={`pitch = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, pitch: v, _pitch: v, _N$pitch: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Math.abs(pitch - v) < 0.01 ? '#facc15' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(pitch - v) < 0.01 ? '#facc15' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={playOnLoad}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked, _N$playOnLoad: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> playOnLoad
                    </label>
                    {/* R2361: preload */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.preload ?? p._preload ?? p._N$preload ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, preload: e.target.checked, _preload: e.target.checked, _N$preload: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> preload
                    </label>
                  </div>
                  {/* R2361: startTime + endTime */}
                  {(() => {
                    const startTime = Number(p.startTime ?? p._startTime ?? p._N$startTime ?? 0)
                    const endTime = Number(p.endTime ?? p._endTime ?? p._N$endTime ?? -1)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>time</span>
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>start</span>
                        <input type="number" min={0} step={0.1} defaultValue={startTime} key={`ast-${startTime}`}
                          onBlur={e => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startTime: v, _startTime: v, _N$startTime: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>end</span>
                        <input type="number" step={0.1} defaultValue={endTime} key={`aet-${endTime}`}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || -1
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, endTime: v, _endTime: v, _N$endTime: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="-1 = 끝까지"
                        />
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{endTime < 0 ? '∞' : endTime + 's'}</span>
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1790/R1892: cc.Camera — clearFlags + backgroundColor 편집
            if (comp.type === 'cc.Camera') {
              const bg = p.backgroundColor as { r?: number; g?: number; b?: number; a?: number } | undefined
              const bgHex = `#${((bg?.r ?? 0)).toString(16).padStart(2,'0')}${((bg?.g ?? 0)).toString(16).padStart(2,'0')}${((bg?.b ?? 0)).toString(16).padStart(2,'0')}`
              const depth = Number(p.depth ?? p._depth ?? 0)
              const clearFlags = Number(p.clearFlags ?? p._clearFlags ?? 7)
              const fov = Number(p.fov ?? p._fov ?? 60)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2438: enabled (BatchInspector R2199) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>bgColor</span>
                    <input type="color" value={bgHex}
                      onChange={e => {
                        const h = e.target.value
                        const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
                        const col = { r, g, b, a: bg?.a ?? 255 }
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, backgroundColor: col, _backgroundColor: col, _N$backgroundColor: col } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>clearFlags</span>
                    {([['None',0],['Depth',2],['Color+D',7],['All',15]] as [string,number][]).map(([l,v]) => (
                      <span key={v} title={`clearFlags=${v}`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearFlags: v, _clearFlags: v, _N$clearFlags: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${clearFlags === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: clearFlags === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>depth</span>
                    <input type="number" defaultValue={depth} step={1} key={`cdepth-${depth}`}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, depth: v, _depth: v, _N$depth: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1919: fov */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>fov</span>
                    <input type="number" defaultValue={fov} min={1} max={179} step={5} key={`cfov-${fov}`}
                      onBlur={e => {
                        const v = Math.min(179, Math.max(1, parseFloat(e.target.value) || 60))
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fov: v, _fov: v, _N$fov: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>°</span>
                  </div>
                  {/* R2365/R2442: CC3.x orthoHeight/near/far (dead block 2 props 통합) */}
                  {is3x && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>orthoH</span>
                        <input type="number" min={1} step={10}
                          defaultValue={Number(p.orthoHeight ?? p._orthoHeight ?? 540)}
                          key={`oh-${Number(p.orthoHeight ?? 540)}`}
                          onBlur={e => {
                            const v = Math.max(1, parseFloat(e.target.value) || 540)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, orthoHeight: v, _orthoHeight: v, _N$orthoHeight: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: '#93c5fd', borderRadius: 3, padding: '1px 4px' }}
                        />
                        {[360, 540, 720, 1080].map(v => (
                          <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, orthoHeight: v, _orthoHeight: v, _N$orthoHeight: v } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}>{v}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>near/far</span>
                        <input type="number" step={0.1}
                          defaultValue={Number(p.near ?? p._near ?? 1)}
                          key={`cn-${Number(p.near ?? 1)}`}
                          onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, near: v, _near: v, _N$near: v } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="near"
                        />
                        <input type="number" step={10}
                          defaultValue={Number(p.far ?? p._far ?? 4096)}
                          key={`cf-${Number(p.far ?? 4096)}`}
                          onBlur={e => { const v = parseFloat(e.target.value) || 4096; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, far: v, _far: v, _N$far: v } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 56, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="far"
                        />
                      </div>
                    </>
                  )}
                  {/* R2442: CC2.x zoomRatio */}
                  {!is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>zoomRatio</span>
                      <input type="number" defaultValue={Number(p.zoomRatio ?? p._zoomRatio ?? 1)} min={0.01} step={0.1}
                        onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, zoomRatio: v, _zoomRatio: v } } : c); applyAndSave({ components: u }) }}
                        style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        title="zoomRatio (CC2.x)"
                      />
                    </div>
                  )}
                  {/* R2412/R2449: clearDepth cc.Camera (BatchInspector R2187) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>clearDepth</span>
                    <input type="number" defaultValue={Number(p.clearDepth ?? p._clearDepth ?? 1)} min={0} max={1} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearDepth: v, _clearDepth: v, _N$clearDepth: v } } : c)
                        applyAndSave({ components: u })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[0, 0.5, 1].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, clearDepth: v, _clearDepth: v, _N$clearDepth: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2449: ortho toggle (BatchInspector R2058) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>ortho</span>
                    {([['ort✓', true], ['ort✗', false]] as const).map(([l, v]) => {
                      const cur = !!(p.ortho ?? p._ortho ?? false)
                      return (
                        <span key={l} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, ortho: v, _ortho: v, _N$ortho: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R2412/R2449: cullingMask (BatchInspector R1989) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>cullingMask</span>
                    {([['All', -1], ['None', 0], ['Dflt', 1]] as [string, number][]).map(([l, v]) => (
                      <span key={l} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cullingMask: v, _cullingMask: v, _N$cullingMask: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  {/* R2405: targetDisplay */}
                  {!is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>targetDisp</span>
                      <input type="number" defaultValue={Number(p.targetDisplay ?? p._targetDisplay ?? p._N$targetDisplay ?? 0)} min={0} step={1}
                        onBlur={e => { const v = parseInt(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, targetDisplay: v, _targetDisplay: v, _N$targetDisplay: v } } : c); applyAndSave({ components: u }) }}
                        style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        title="targetDisplay (Camera)"
                      />
                      {[0, 1, 2, 3].map(v => (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, targetDisplay: v, _targetDisplay: v, _N$targetDisplay: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                        >{v}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            // R1579: cc.DirectionalLight/PointLight Quick Edit
            if (comp.type === 'cc.DirectionalLight' || comp.type === 'cc.PointLight') {
              const intensity = Number(p.intensity ?? p._intensity ?? p._N$intensity ?? 1)
              const lightColor = p.color as { r?: number; g?: number; b?: number } | undefined
              const hexColor = lightColor
                ? `#${(lightColor.r ?? 255).toString(16).padStart(2, '0')}${(lightColor.g ?? 255).toString(16).padStart(2, '0')}${(lightColor.b ?? 255).toString(16).padStart(2, '0')}`
                : '#ffffff'
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2441: enabled (BatchInspector R2221) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>intensity</span>
                    <input type="range" min={0} max={5} step={0.1} value={intensity}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, intensity: v, _intensity: v, _N$intensity: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{intensity.toFixed(1)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>color</span>
                    <input type="color" value={hexColor}
                      onChange={e => {
                        const hex = e.target.value
                        const r = parseInt(hex.slice(1, 3), 16)
                        const g = parseInt(hex.slice(3, 5), 16)
                        const b = parseInt(hex.slice(5, 7), 16)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 }, _N$color: { r, g, b, a: 255 } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 28, height: 18, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{hexColor}</span>
                  </div>
                </div>
              )
            }
            // R1573: cc.SpotLight Quick Edit
            if (comp.type === 'cc.SpotLight') {
              const intensity = Number(p.intensity ?? p._intensity ?? p._N$intensity ?? 1800)
              const range = Number(p.range ?? 1)
              const spotAngle = Number(p.spotAngle ?? 30)
              const lightColor = p.color as { r?: number; g?: number; b?: number } | undefined
              const hexColor = lightColor
                ? `#${(lightColor.r ?? 255).toString(16).padStart(2, '0')}${(lightColor.g ?? 255).toString(16).padStart(2, '0')}${(lightColor.b ?? 255).toString(16).padStart(2, '0')}`
                : '#ffffff'
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2443: enabled */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 64, whiteSpace: 'nowrap', flexShrink: 0 }}>intensity</span>
                    <input type="number" defaultValue={intensity} key={`si-${intensity}`} min={0} step={100}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, intensity: v, _intensity: v, _N$intensity: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 64, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 64, whiteSpace: 'nowrap', flexShrink: 0 }}>range</span>
                    <input type="number" defaultValue={range} key={`sr-${range}`} min={0} step={0.5}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, range: v, _range: v, _N$range: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 64, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 64, whiteSpace: 'nowrap', flexShrink: 0 }}>spotAngle</span>
                    <input type="number" defaultValue={spotAngle} key={`sa-${spotAngle}`} min={0} max={180} step={5}
                      onBlur={e => {
                        const v = Math.max(0, Math.min(180, parseFloat(e.target.value) || 30))
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spotAngle: v, _spotAngle: v, _N$spotAngle: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 64, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>°</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 64, whiteSpace: 'nowrap', flexShrink: 0 }}>color</span>
                    <input type="color" value={hexColor}
                      onChange={e => {
                        const hex = e.target.value
                        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 }, _N$color: { r, g, b, a: 255 } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 28, height: 18, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{hexColor}</span>
                  </div>
                </div>
              )
            }
            // R1848: cc.MotionStreak — fade/minSeg/stroke/color 편집
            if (comp.type === 'cc.MotionStreak') {
              const fade = Number(p.fade ?? p._fade ?? p._N$fade ?? 0.5)
              const minSeg = Number(p.minSeg ?? p._minSeg ?? p._N$minSeg ?? 1)
              const stroke = Number(p.stroke ?? p._stroke ?? p._N$stroke ?? 64)
              const fastMode = !!(p.fastMode ?? false)
              const mc = (p.color ?? p._color ?? p._N$color) as { r?: number; g?: number; b?: number } | undefined
              const mr = (mc as Record<string,number>|undefined)?.r ?? 255
              const mg = (mc as Record<string,number>|undefined)?.g ?? 255
              const mb = (mc as Record<string,number>|undefined)?.b ?? 255
              const mHex = `#${mr.toString(16).padStart(2,'0')}${mg.toString(16).padStart(2,'0')}${mb.toString(16).padStart(2,'0')}`
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2436: enabled (BatchInspector R2200) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>fade</span>
                    <input type="number" defaultValue={fade} key={`mfade-${fade}`} min={0} max={10} step={0.1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0.5; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fade: v, _fade: v, _N$fade: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>s</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>minSeg</span>
                    <input type="number" defaultValue={minSeg} key={`mseg-${minSeg}`} min={0} step={1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, minSeg: v, _minSeg: v, _N$minSeg: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>stroke</span>
                    <input type="number" defaultValue={stroke} key={`mstk-${stroke}`} min={0} step={4}
                      onBlur={e => { const v = parseFloat(e.target.value) || 64; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, stroke: v, _stroke: v, _N$stroke: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>color</span>
                    <input type="color" value={mHex}
                      onChange={e => { const h = e.target.value; const r2 = parseInt(h.slice(1,3),16), g2 = parseInt(h.slice(3,5),16), b2 = parseInt(h.slice(5,7),16); const col = { r: r2, g: g2, b: b2, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 24, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>fastMode</span>
                    <input type="checkbox" checked={fastMode}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fastMode: e.target.checked, _fastMode: e.target.checked, _N$fastMode: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />
                  </div>
                  {/* R2374: timeToLive / speedThreshold */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 60, whiteSpace: 'nowrap', flexShrink: 0 }}>TTL</span>
                    <input type="number" defaultValue={Number(p.timeToLive ?? p._timeToLive ?? 1)} min={0} step={0.1}
                      onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeToLive: v, _timeToLive: v, _N$timeToLive: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="timeToLive (초)"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>spdThr</span>
                    <input type="number" defaultValue={Number(p.speedThreshold ?? p._speedThreshold ?? p._N$speedThreshold ?? 1)} min={0} step={0.5}
                      onBlur={e => { const v = parseFloat(e.target.value) || 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedThreshold: v, _speedThreshold: v, _N$speedThreshold: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="speedThreshold"
                    />
                  </div>
                </div>
              )
            }
            // R2416: cc.BlockInputEvents — enabled 퀵 편집
            if (comp.type === 'cc.BlockInputEvents') {
              const enabled = !!(p.enabled ?? p._enabled ?? true)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enabled}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled (입력 이벤트 차단)
                  </label>
                </div>
              )
            }
            return null
}
export const EffectsRenderer = React.memo(EffectsRendererInner)
