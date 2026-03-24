import React from 'react'
import type { RendererProps } from './types'

/** cc.Canvas, cc.Widget, cc.ProgressBar, cc.UIOpacity, cc.UITransform, cc.Mask Quick Edit renderer */
export function UIRenderer({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.Canvas') {
              const dr = (p._N$designResolution ?? p._designResolution ?? p.designResolution ?? {}) as { width?: number; height?: number }
              const fw = !!(p._N$fitWidth ?? p.fitWidth ?? false)
              const fh = !!(p._N$fitHeight ?? p.fitHeight ?? true)
              return (
                <div key={ci} style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2444: enabled (BatchInspector R2113) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>resolution</span>
                    <input type="number" defaultValue={dr.width ?? 960} min={1}
                      onBlur={e => {
                        const w = parseInt(e.target.value) || (dr.width ?? 960)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _N$designResolution: { ...dr, width: w }, _designResolution: { ...dr, width: w } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>×</span>
                    <input type="number" defaultValue={dr.height ?? 640} min={1}
                      onBlur={e => {
                        const h = parseInt(e.target.value) || (dr.height ?? 640)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _N$designResolution: { ...dr, height: h }, _designResolution: { ...dr, height: h } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={fw}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fitWidth: e.target.checked, _fitWidth: e.target.checked, _N$fitWidth: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />fitWidth
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={fh}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fitHeight: e.target.checked, _fitHeight: e.target.checked, _N$fitHeight: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />fitHeight
                    </label>
                  </div>
                  {/* R1832: resolutionPolicy 퀵 선택 */}
                  {(() => {
                    const rp = Number(p.resolutionPolicy ?? p._N$resolutionPolicy ?? -1)
                    const opts: [string, number][] = [['SHOW_ALL', 0], ['NO_BORDER', 1], ['EXACT_FIT', 2], ['FIX_H', 3], ['FIX_W', 4]]
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>policy</span>
                        {opts.map(([l, v]) => (
                          <span key={v} title={`resolutionPolicy = ${l} (${v})`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resolutionPolicy: v, _resolutionPolicy: v, _N$resolutionPolicy: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 7, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${rp === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: rp === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                          >{l}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2387: resizeWithBrowserSize 토글 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.resizeWithBrowserSize ?? p._resizeWithBrowserSize ?? p._N$resizeWithBrowserSize ?? false)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resizeWithBrowserSize: e.target.checked, _resizeWithBrowserSize: e.target.checked, _N$resizeWithBrowserSize: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />resizeWithBrowserSize
                  </label>
                </div>
              )
            }
            // R1582: cc.Widget — align flags + offsets Quick Edit
            if (comp.type === 'cc.Widget') {
              const isTop = !!(p.isAlignTop ?? false)
              const isBottom = !!(p.isAlignBottom ?? false)
              const isLeft = !!(p.isAlignLeft ?? false)
              const isRight = !!(p.isAlignRight ?? false)
              const isHCenter = !!(p.isAlignHorizontalCenter ?? false)
              const isVCenter = !!(p.isAlignVerticalCenter ?? false)
              const alignMode = Number(p.alignMode ?? 1)
              const edges = [
                ['top', isTop, 'isAlignTop', 'top'],
                ['bottom', isBottom, 'isAlignBottom', 'bottom'],
                ['left', isLeft, 'isAlignLeft', 'left'],
                ['right', isRight, 'isAlignRight', 'right'],
              ] as const
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2434: enabled (BatchInspector R2172) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R1675: Widget 정렬 시각 다이어그램 */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                    <svg width={56} height={56} style={{ overflow: 'visible' }}>
                      {/* 외부 경계 (부모) */}
                      <rect x={0} y={0} width={56} height={56} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                      {/* 내부 노드 */}
                      <rect x={12} y={12} width={32} height={32} fill="rgba(88,166,255,0.08)" stroke="rgba(88,166,255,0.3)" strokeWidth={1} />
                      {/* 상단 연결선 */}
                      {isTop && <line x1={28} y1={0} x2={28} y2={12} stroke="#58a6ff" strokeWidth={2} />}
                      {isTop && <rect x={22} y={0} width={12} height={4} fill="#58a6ff" rx={1} />}
                      {/* 하단 연결선 */}
                      {isBottom && <line x1={28} y1={44} x2={28} y2={56} stroke="#58a6ff" strokeWidth={2} />}
                      {isBottom && <rect x={22} y={52} width={12} height={4} fill="#58a6ff" rx={1} />}
                      {/* 좌측 연결선 */}
                      {isLeft && <line x1={0} y1={28} x2={12} y2={28} stroke="#58a6ff" strokeWidth={2} />}
                      {isLeft && <rect x={0} y={22} width={4} height={12} fill="#58a6ff" rx={1} />}
                      {/* 우측 연결선 */}
                      {isRight && <line x1={44} y1={28} x2={56} y2={28} stroke="#58a6ff" strokeWidth={2} />}
                      {isRight && <rect x={52} y={22} width={4} height={12} fill="#58a6ff" rx={1} />}
                      {/* 가로 중앙선 */}
                      {isHCenter && <line x1={0} y1={28} x2={56} y2={28} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2" />}
                      {/* 세로 중앙선 */}
                      {isVCenter && <line x1={28} y1={0} x2={28} y2={56} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2" />}
                    </svg>
                  </div>
                  {edges.map(([label, isActive, flag, offsetKey]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', width: 50, flexShrink: 0 }}>
                        <input type="checkbox" checked={isActive}
                          onChange={e => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [flag]: e.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }}
                        />{label}
                      </label>
                      {isActive && (
                        <input type="number" defaultValue={Number(p[offsetKey] ?? 0)} step={1}
                          onBlur={ev => {
                            const v = parseFloat(ev.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [offsetKey]: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      )}
                    </div>
                  ))}
                  {/* R2354: isAlignHorizontalCenter / isAlignVerticalCenter 편집 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={isHCenter}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isAlignHorizontalCenter: e.target.checked, _isAlignHorizontalCenter: e.target.checked, _N$isAlignHorizontalCenter: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />H-center
                    </label>
                    {isHCenter && (
                      <input type="number" defaultValue={Number(p.horizontalCenter ?? p._N$horizontalCenter ?? 0)} step={1}
                        onBlur={ev => {
                          const v = parseFloat(ev.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalCenter: v, _horizontalCenter: v, _N$horizontalCenter: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={isVCenter}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isAlignVerticalCenter: e.target.checked, _isAlignVerticalCenter: e.target.checked, _N$isAlignVerticalCenter: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />V-center
                    </label>
                    {isVCenter && (
                      <input type="number" defaultValue={Number(p.verticalCenter ?? p._N$verticalCenter ?? 0)} step={1}
                        onBlur={ev => {
                          const v = parseFloat(ev.target.value) || 0
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, verticalCenter: v, _verticalCenter: v, _N$verticalCenter: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 50, whiteSpace: 'nowrap', flexShrink: 0 }}>mode</span>
                    <select value={alignMode}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, alignMode: v, _alignMode: v, _N$alignMode: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Once</option>
                      <option value={1}>Always</option>
                      <option value={2}>Editor</option>
                    </select>
                  </div>
                  {/* R2362: isAbs* 전환 버튼 (절대px / %) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 50, whiteSpace: 'nowrap', flexShrink: 0 }}>unit</span>
                    <span title="모든 isAbs* = true (절대 px)"
                      onClick={() => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props,
                          isAbsTop: true, _isAbsTop: true, _N$isAbsTop: true,
                          isAbsBottom: true, _isAbsBottom: true, _N$isAbsBottom: true,
                          isAbsLeft: true, _isAbsLeft: true, _N$isAbsLeft: true,
                          isAbsRight: true, _isAbsRight: true, _N$isAbsRight: true,
                          isAbsHorizontalCenter: true, _isAbsHorizontalCenter: true, _N$isAbsHorizontalCenter: true,
                          isAbsVerticalCenter: true, _isAbsVerticalCenter: true, _N$isAbsVerticalCenter: true,
                        } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#60a5fa', userSelect: 'none' }}>px</span>
                    <span title="모든 isAbs* = false (%)"
                      onClick={() => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props,
                          isAbsTop: false, _isAbsTop: false, _N$isAbsTop: false,
                          isAbsBottom: false, _isAbsBottom: false, _N$isAbsBottom: false,
                          isAbsLeft: false, _isAbsLeft: false, _N$isAbsLeft: false,
                          isAbsRight: false, _isAbsRight: false, _N$isAbsRight: false,
                          isAbsHorizontalCenter: false, _isAbsHorizontalCenter: false, _N$isAbsHorizontalCenter: false,
                          isAbsVerticalCenter: false, _isAbsVerticalCenter: false, _N$isAbsVerticalCenter: false,
                        } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}>%</span>
                  </div>
                  {/* R2411: alignMode (BatchInspector R2043) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>alignMode</span>
                    {([['Once', 0], ['Resize', 1], ['Always', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.alignMode ?? p._alignMode ?? p._N$alignMode ?? 1)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, alignMode: v, _alignMode: v, _N$alignMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R1753: Widget 프리셋 버튼 (Stretch / Center / None) */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    {[
                      { label: '⊞ Stretch', title: '4방향 모두 0 stretch', patch: { isAlignTop: true, isAlignBottom: true, isAlignLeft: true, isAlignRight: true, isAlignHorizontalCenter: false, isAlignVerticalCenter: false, top: 0, bottom: 0, left: 0, right: 0 } },
                      { label: '⊕ Center', title: '가로/세로 중앙 정렬', patch: { isAlignTop: false, isAlignBottom: false, isAlignLeft: false, isAlignRight: false, isAlignHorizontalCenter: true, isAlignVerticalCenter: true } },
                      { label: '✕ None', title: '정렬 해제', patch: { isAlignTop: false, isAlignBottom: false, isAlignLeft: false, isAlignRight: false, isAlignHorizontalCenter: false, isAlignVerticalCenter: false } },
                    ].map(({ label, title, patch }) => (
                      <span key={label} title={title}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, ...patch } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >{label}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1581: cc.Button — transition 타입 + state 색상 미리보기
            if (comp.type === 'cc.ProgressBar') {
              const progress = Number(p.progress ?? 0)
              // R1727: reverse + totalLength
              const reverse = !!(p.reverse ?? p._N$reverse ?? false)
              const totalLength = Number(p.totalLength ?? p._N$totalLength ?? 100)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2431: enabled (BatchInspector R2197) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>progress</span>
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
                  {/* R1770: ProgressBar progress 퀵 프리셋 */}
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
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>totalLen</span>
                    <input type="number" defaultValue={totalLength} min={0} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 100
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, totalLength: v, _totalLength: v, _N$totalLength: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 60, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={reverse}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, reverse: e.target.checked, _reverse: e.target.checked, _N$reverse: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />reverse
                    </label>
                  </div>
                  {/* R2356: ProgressBar mode 퀵 편집 (H/V/Filled) */}
                  {(() => {
                    const pbMode = Number(p.mode ?? p._mode ?? p._N$mode ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>mode</span>
                        {([['H', 0], ['V', 1], ['Fill', 2]] as const).map(([l, v]) => (
                          <span key={v} title={`mode=${l}(${v})`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, mode: v, _mode: v, _N$mode: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 8, padding: '0 5px', cursor: 'pointer', border: `1px solid ${pbMode === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: pbMode === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                          >{l}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2357: ProgressBar startWidth 퀵 편집 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>startW</span>
                    <input type="number" min={0} step={1}
                      defaultValue={Number(p.startWidth ?? p._startWidth ?? p._N$startWidth ?? 0)}
                      key={`sw-${Number(p.startWidth ?? p._startWidth ?? p._N$startWidth ?? 0)}`}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startWidth: v, _startWidth: v, _N$startWidth: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[0, 1, 5, 10, 20, 50].map(v => (
                      <span key={v} title={`startWidth=${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startWidth: v, _startWidth: v, _N$startWidth: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.UIOpacity') {
              const uiOpacity = Number(p.opacity ?? 255)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2437: enabled (BatchInspector R2217) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>opacity</span>
                    <input type="range" min={0} max={255} step={1} value={uiOpacity}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, opacity: v, _opacity: v, _N$opacity: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{uiOpacity}</span>
                  </div>
                  {/* R1794: UIOpacity 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 62 }}>
                    {([0, 64, 128, 192, 255] as const).map(v => (
                      <span key={v} title={`opacity = ${v} (${Math.round(v/255*100)}%)`}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, opacity: v, _opacity: v, _N$opacity: v } } : c); applyAndSave({ components: updated }) }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${uiOpacity === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: uiOpacity === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{Math.round(v/255*100)}%</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R2383: cc.UITransform — priority + anchorPoint 퀵 편집 (CC3.x)
            if (comp.type === 'cc.UITransform') {
              const priority = Number(p.priority ?? p._priority ?? 0)
              const apRaw = p.anchorPoint ?? p._anchorPoint as { x?: number; y?: number } | undefined
              const apx = Number((apRaw as Record<string,number>|undefined)?.x ?? 0.5)
              const apy = Number((apRaw as Record<string,number>|undefined)?.y ?? 0.5)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* priority */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>priority</span>
                    <input type="number" defaultValue={priority} step={1}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, priority: v, _priority: v } } : c)
                        applyAndSave({ components: u })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[-1, 0, 1, 2, 5, 10].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, priority: v, _priority: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${priority === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: priority === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* anchorPoint */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>anchor</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>x</span>
                    <input type="number" defaultValue={apx} min={0} max={1} step={0.1}
                      onBlur={e => {
                        const x = parseFloat(e.target.value) || 0; const ap = { x, y: apy }
                        const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, anchorPoint: ap, _anchorPoint: ap } } : c)
                        applyAndSave({ components: u })
                      }}
                      style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
                    <input type="number" defaultValue={apy} min={0} max={1} step={0.1}
                      onBlur={e => {
                        const y = parseFloat(e.target.value) || 0; const ap = { x: apx, y }
                        const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, anchorPoint: ap, _anchorPoint: ap } } : c)
                        applyAndSave({ components: u })
                      }}
                      style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {[['TL',[0,1]],['TC',[0.5,1]],['TR',[1,1]],['CL',[0,0.5]],['CC',[0.5,0.5]],['CR',[1,0.5]],['BL',[0,0]],['BC',[0.5,0]],['BR',[1,0]]].map(([l,v]) => (
                      <span key={l as string} title={`anchor=(${(v as number[])[0]},${(v as number[])[1]})`}
                        onClick={() => { const ap = { x: (v as number[])[0], y: (v as number[])[1] }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, anchorPoint: ap, _anchorPoint: ap } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 7, padding: '1px 2px', cursor: 'pointer', border: `1px solid ${Math.abs(apx-(v as number[])[0])<0.01&&Math.abs(apy-(v as number[])[1])<0.01 ? '#38bdf8' : 'var(--border)'}`, borderRadius: 2, color: Math.abs(apx-(v as number[])[0])<0.01&&Math.abs(apy-(v as number[])[1])<0.01 ? '#38bdf8' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R1572: cc.Mask — type/inverted/alphaThreshold Quick Edit
            if (comp.type === 'cc.Mask') {
              const maskType = Number(p._type ?? p.type ?? 0)
              const inverted = !!(p._inverted ?? p.inverted ?? false)
              const alphaThreshold = Number(p._alphaThreshold ?? p.alphaThreshold ?? 0)
              const maskEnabled = !!(p.enabled ?? p._enabled ?? true)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2425: enabled (BatchInspector R2193) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={maskEnabled}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>type</span>
                    <select value={maskType}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _type: v, type: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>Rect</option>
                      <option value={1}>Ellipse</option>
                      <option value={2}>Image Stencil</option>
                    </select>
                  </div>
                  {maskType === 2 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>alphaThresh</span>
                      <input type="range" min={0} max={1} step={0.01} value={alphaThreshold}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _alphaThreshold: v, alphaThreshold: v, _N$alphaThreshold: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{alphaThreshold.toFixed(2)}</span>
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={inverted}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, inverted: e.target.checked, _inverted: e.target.checked, _N$inverted: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />inverted
                  </label>
                </div>
              )
            }
            // R1569: cc.PageView — direction/scrollThreshold/autoPageTurningThreshold Quick Edit
            return null
}
