import React from 'react'
import type { RendererProps } from './types'

/** cc.Animation, cc.SkeletalAnimation, dragonBones.ArmatureDisplay, sp.Skeleton Quick Edit renderer */
export function AnimationRenderer({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.Animation') {
              const clips = (p._resolvedClips as Array<{ name: string }> | undefined) ?? []
              const defaultClipName = p._defaultClipName as string | undefined
              if (clips.length === 0) return null
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2435: enabled (BatchInspector R2191) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>default</span>
                    <select
                      defaultValue={defaultClipName ?? clips[0]?.name}
                      title="R1524: 클립 목록 (read-only)"
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      {clips.map(c => (
                        <option key={c.name} value={c.name}>{c.name === defaultClipName ? `★ ${c.name}` : c.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* R2375: sample + speed */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>sample</span>
                    <input type="number" defaultValue={Number(p.sample ?? p._sample ?? 60)} min={1} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || 60; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sample: v, _sample: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="sample rate"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>speed</span>
                    <input type="number" defaultValue={Number(p.speed ?? p._speed ?? 1)} min={0} step={0.1}
                      onBlur={e => { const v = parseFloat(e.target.value) ?? 1; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speed: v, _speed: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="playback speed"
                    />
                  </div>
                  {/* R2417: wrapMode (BatchInspector R1984) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>wrapMode</span>
                    {([['Dflt', 0], ['Norm', 1], ['Loop', 2], ['Ping', 3], ['Clamp', 4]] as const).map(([l, v]) => {
                      const cur = Number(p.wrapMode ?? p._wrapMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, wrapMode: v, _wrapMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R2389: playOnLoad 체크박스 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.playOnLoad ?? p._playOnLoad ?? p._N$playOnLoad ?? false)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked, _N$playOnLoad: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />playOnLoad
                  </label>
                  {/* R1700: 클립 목록 + 이름 복사 */}
                  <div style={{ paddingLeft: 62 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{clips.length} clips</span>
                      <span
                        title="모든 클립명 복사"
                        onClick={() => navigator.clipboard.writeText(clips.map(c => c.name).join(', ')).catch(() => {})}
                        style={{ fontSize: 8, cursor: 'pointer', color: '#666', padding: '0 3px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f472b6')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                      >⎘ all</span>
                    </div>
                    {clips.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 1 }}>
                        <span style={{ fontSize: 8, color: c.name === defaultClipName ? '#f472b6' : 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name === defaultClipName ? '★ ' : ''}{c.name}
                        </span>
                        <span
                          title={`"${c.name}" 복사`}
                          onClick={() => navigator.clipboard.writeText(c.name).catch(() => {})}
                          style={{ fontSize: 8, cursor: 'pointer', color: '#555', flexShrink: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f472b6')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                        >⎘</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            // R1562: cc.Slider — progress + direction Quick Edit
            if (comp.type === 'cc.SkeletalAnimation') {
              const speedRatio = Number(p.speedRatio ?? 1)
              const playOnLoad = !!(p.playOnLoad ?? false)
              const defaultClipName = String(p.defaultClipName ?? '')
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2437: enabled (BatchInspector R2221) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {defaultClipName && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      defaultClip: <span style={{ color: '#58a6ff' }}>{defaultClipName}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>speedRatio</span>
                    <input type="number" defaultValue={speedRatio} min={0} step={0.1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedRatio: v, _speedRatio: v, _N$speedRatio: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1814: speedRatio 퀵 프리셋 */}
                    {([0.5, 1, 1.5, 2] as const).map(v => (
                      <span key={v} title={`speedRatio = ×${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, speedRatio: v, _speedRatio: v, _N$speedRatio: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${speedRatio === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: speedRatio === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >×{v}</span>
                    ))}
                  </div>
                  {/* R2408: wrapMode + loop + defaultCachingMode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>wrapMode</span>
                    {([['Dflt', 1], ['Norm', 2], ['Loop', 3], ['Ping', 4], ['Rev', 8]] as const).map(([l, v]) => {
                      const cur = Number(p.wrapMode ?? p._wrapMode ?? p._N$wrapMode ?? 2)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, wrapMode: v, _wrapMode: v, _N$wrapMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.loop ?? p._loop ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#a78bfa' }}
                      />loop
                    </label>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>cache:</span>
                    {([['RT', 0], ['Sh', 1], ['Pr', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.defaultCachingMode ?? p._defaultCachingMode ?? 0)
                      return (
                        <span key={v} title={['Realtime', 'Shared', 'Private'][v]}
                          onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, defaultCachingMode: v, _defaultCachingMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={playOnLoad}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked, _N$playOnLoad: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />playOnLoad
                  </label>
                </div>
              )
            }
            // R1576: cc.DirectionalLight / cc.PointLight — intensity/color Quick Edit
            if (comp.type === 'dragonBones.ArmatureDisplay') {
              const armatureName = String(p.armatureName ?? '')
              const animationName = String(p.animationName ?? '')
              const timeScale = Number(p.timeScale ?? 1)
              const loop = !!(p.loop ?? true)
              const playTimes = Number(p.playTimes ?? 0)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2436: enabled (BatchInspector R2201) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>armature</span>
                    <input type="text" defaultValue={armatureName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, armatureName: e.target.value, _armatureName: e.target.value, _N$armatureName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>animation</span>
                    <input type="text" defaultValue={animationName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, animationName: e.target.value, _animationName: e.target.value, _N$animationName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  {/* R1819: timeScale 퀵 프리셋 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>timeScale</span>
                    <input type="number" defaultValue={timeScale} step={0.1} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: parseFloat(e.target.value) || 1, _timeScale: parseFloat(e.target.value) || 1, _N$timeScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {([0.5, 1, 1.5, 2] as const).map(v => (
                      <span key={v} title={`timeScale = ×${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: v, _timeScale: v, _N$timeScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${timeScale === v ? '#f472b6' : 'var(--border)'}`, borderRadius: 2, color: timeScale === v ? '#f472b6' : 'var(--text-muted)', userSelect: 'none' }}
                      >×{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>playTimes</span>
                    <input type="number" defaultValue={playTimes} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playTimes: parseInt(e.target.value) || 0, _playTimes: parseInt(e.target.value) || 0, _N$playTimes: parseInt(e.target.value) || 0 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{playTimes === 0 ? '(loop∞)' : `×${playTimes}`}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#4ade80' }}
                      />loop
                    </label>
                    {/* R2423: playOnLoad (BatchInspector R1930) */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.playOnLoad ?? p._playOnLoad ?? p._N$playOnLoad ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playOnLoad: e.target.checked, _playOnLoad: e.target.checked, _N$playOnLoad: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#60a5fa' }}
                      />playOnLoad
                    </label>
                    {/* R2397: debugBones + enableBatch */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.debugBones ?? p._debugBones ?? p._N$debugBones ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, debugBones: e.target.checked, _debugBones: e.target.checked, _N$debugBones: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#fbbf24' }}
                      />debugBones
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.enableBatch ?? p._enableBatch ?? p._N$enableBatch ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableBatch: e.target.checked, _enableBatch: e.target.checked, _N$enableBatch: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#34d399' }}
                      />batch
                    </label>
                  </div>
                  {/* R2406: blendMode (BatchInspector R2188) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>blendMode</span>
                    {([['NORM', 0], ['ADD', 10], ['MULT', 12]] as const).map(([l, v]) => {
                      const cur = Number(p.blendMode ?? p._blendMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, blendMode: v, _blendMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#c084fc' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#c084fc' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                </div>
              )
            }
            // R1546: sp.Skeleton — Spine 애니메이션 Quick Edit
            if (comp.type === 'sp.Skeleton') {
              const defaultSkin = String(p.defaultSkin ?? 'default')
              const defaultAnimation = String(p.defaultAnimation ?? '')
              const timeScale = Number(p.timeScale ?? 1)
              const loop = !!(p.loop ?? true)
              const paused = !!(p.paused ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2436: enabled (BatchInspector R2201) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>skin</span>
                    <input type="text" defaultValue={defaultSkin}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, defaultSkin: e.target.value, _defaultSkin: e.target.value, _N$defaultSkin: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>animation</span>
                    <input type="text" defaultValue={defaultAnimation}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, defaultAnimation: e.target.value, _defaultAnimation: e.target.value, _N$defaultAnimation: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>timeScale</span>
                    <input type="number" defaultValue={timeScale} step={0.1} min={0}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: parseFloat(e.target.value) || 1, _timeScale: parseFloat(e.target.value) || 1, _N$timeScale: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1818: timeScale 퀵 프리셋 */}
                    {([0.5, 1, 1.5, 2] as const).map(v => (
                      <span key={v} title={`timeScale = ×${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, timeScale: v, _timeScale: v, _N$timeScale: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${timeScale === v ? '#f472b6' : 'var(--border)'}`, borderRadius: 2, color: timeScale === v ? '#f472b6' : 'var(--text-muted)', userSelect: 'none' }}
                      >×{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#4ade80' }}
                      />loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={paused}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, paused: e.target.checked, _paused: e.target.checked, _N$paused: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#f87171' }}
                      />paused
                    </label>
                    {/* R1826: premultipliedAlpha */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.premultipliedAlpha ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, premultipliedAlpha: e.target.checked, _premultipliedAlpha: e.target.checked, _N$premultipliedAlpha: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0 }}
                      />pma
                    </label>
                    {/* R2396: useTint */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.useTint ?? p._useTint ?? p._N$useTint ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, useTint: e.target.checked, _useTint: e.target.checked, _N$useTint: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#818cf8' }}
                      />tint
                    </label>
                  </div>
                  {/* R1826: debug 옵션 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.debugSlots ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, debugSlots: e.target.checked, _debugSlots: e.target.checked, _N$debugSlots: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#fbbf24' }}
                      />debugSlots
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.debugBones ?? false)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, debugBones: e.target.checked, _debugBones: e.target.checked, _N$debugBones: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ margin: 0, accentColor: '#fbbf24' }}
                      />debugBones
                    </label>
                    {/* R2407: enableBatch (BatchInspector R2188) */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.enableBatch ?? p._enableBatch ?? p._N$enableBatch ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableBatch: e.target.checked, _enableBatch: e.target.checked, _N$enableBatch: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0, accentColor: '#34d399' }}
                      />batch
                    </label>
                  </div>
                </div>
              )
            }
            // R2416: cc.BlockInputEvents — enabled 퀵 편집
            return null
}
