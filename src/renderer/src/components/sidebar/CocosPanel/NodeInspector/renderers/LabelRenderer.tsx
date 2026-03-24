import React, { useState, useRef, useEffect } from 'react'
import type { RendererProps } from './types'

/** cc.Label Quick Edit — extracted to satisfy Rules of Hooks */
function LabelQuickEdit({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement {
  const p = comp.props
  const str = String(p.string ?? p.String ?? p._string ?? '')
  const fs = Number(p.fontSize ?? p._fontSize ?? p._N$fontSize ?? 24)
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false)
  const [fontAssets, setFontAssets] = useState<Array<{ uuid: string; name: string }>>([])
  const fontDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fontDropdownOpen) return
    const assetsDir = sceneFile?.projectInfo?.assetsDir
    if (!assetsDir) return
    let cancelled = false
    void (window.api as unknown as { ccFileBuildUUIDMap: (d: string) => Promise<Record<string, { uuid: string; relPath: string; type: string }>> })
      .ccFileBuildUUIDMap(assetsDir)
      .then(map => {
        if (cancelled) return
        const fonts = Object.values(map)
          .filter(a => a.type === 'font')
          .map(a => ({ uuid: a.uuid, name: a.relPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? a.uuid }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setFontAssets(fonts)
      })
    return () => { cancelled = true }
  }, [fontDropdownOpen])

  useEffect(() => {
    if (!fontDropdownOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setFontDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [fontDropdownOpen])

  // R1714: 텍스트 색상
  const labelColorRaw = p.color as { r?: number; g?: number; b?: number } | undefined
  const lcR = labelColorRaw?.r ?? 255, lcG = labelColorRaw?.g ?? 255, lcB = labelColorRaw?.b ?? 255
  const lcHex = `#${lcR.toString(16).padStart(2,'0')}${lcG.toString(16).padStart(2,'0')}${lcB.toString(16).padStart(2,'0')}`
  // R1720: overflow + align
  const overflow = Number(p.overflow ?? p._overflow ?? p._N$overflow ?? 0)
  const hAlign = Number(p.horizontalAlign ?? p._horizontalAlign ?? p._N$horizontalAlign ?? 0)
  const vAlign = Number(p.verticalAlign ?? p._verticalAlign ?? p._N$verticalAlign ?? 1)
  // R1723: lineHeight
  const lineHeight = Number(p.lineHeight ?? p._lineHeight ?? p._N$lineHeight ?? 0)
  return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2432: enabled (BatchInspector R2191) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>string</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <textarea
                        key={str}
                        defaultValue={str}
                        rows={2}
                        onBlur={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value, _string: e.target.value, _N$string: e.target.value } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', resize: 'vertical' }}
                      />
                      {/* R1773: 텍스트 길이 배지 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
                        <span style={{ fontSize: 8, color: str.length === 0 ? '#f87171' : 'var(--text-muted)' }}>
                          {str.length === 0 ? '⚠ 빈 문자열' : `${str.length}자`}
                        </span>
                        {/* R1805: string 복사 버튼 */}
                        {str.length > 0 && (
                          <span title="텍스트 복사"
                            onClick={() => navigator.clipboard.writeText(str).catch(() => {})}
                            style={{ fontSize: 9, cursor: 'pointer', color: '#555', padding: '0 2px' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                          >⎘</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>fontSize</span>
                    <input type="number" key={fs} defaultValue={fs} min={1} max={200}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || fs
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1713: fontSize 빠른 조절 버튼 */}
                    {[-10, -1, +1, +10].map(d => (
                      <span key={d}
                        title={`fontSize ${d > 0 ? '+' : ''}${d}`}
                        onClick={() => {
                          const newFs = Math.max(1, fs + d)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: newFs, _fontSize: newFs, _N$fontSize: newFs } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, cursor: 'pointer', padding: '1px 3px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', flexShrink: 0 }}
                      >{d > 0 ? `+${d}` : d}</span>
                    ))}
                  </div>
                  {/* R1786: fontSize 표준 크기 프리셋 */}
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', paddingLeft: 54, marginTop: 1 }}>
                    {[12, 16, 20, 24, 32, 48, 72].map(v => (
                      <span key={v} title={`fontSize = ${v}`}
                        onClick={() => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${fs === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: fs === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R1714: 텍스트 색상 피커 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>textColor</span>
                    <input type="color" value={lcHex}
                      onChange={e => {
                        const h = e.target.value
                        const nr = parseInt(h.slice(1,3),16), ng = parseInt(h.slice(3,5),16), nb = parseInt(h.slice(5,7),16)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: { r: nr, g: ng, b: nb, a: 255 }, _color: { r: nr, g: ng, b: nb, a: 255 } } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{lcR},{lcG},{lcB}</span>
                  </div>
                  {/* R1723: lineHeight */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>lineH</span>
                    <input type="number" key={lineHeight} defaultValue={lineHeight} min={0} step={1}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineHeight: v, _lineHeight: v, _N$lineHeight: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      placeholder="0=자동"
                    />
                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
                    {/* R1787: lineHeight 퀵 프리셋 */}
                    {([0, fs, Math.round(fs * 1.2), Math.round(fs * 1.5), Math.round(fs * 2)] as const).map((v, i) => {
                      const labels = ['0', '×1', '×1.2', '×1.5', '×2']
                      return (
                        <span key={i} title={`lineHeight = ${v}`}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineHeight: v, _lineHeight: v, _N$lineHeight: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${lineHeight === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: lineHeight === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none', flexShrink: 0 }}
                        >{labels[i]}</span>
                      )
                    })}
                  </div>
                  {/* R2404: isSystemFontUsed + platformFont (CC2.x) */}
                  {!is3x && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!(p.isSystemFontUsed ?? p._isSystemFontUsed ?? p._N$isSystemFontUsed ?? false)}
                          onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isSystemFontUsed: e.target.checked, _isSystemFontUsed: e.target.checked, _N$isSystemFontUsed: e.target.checked } } : c); applyAndSave({ components: u }) }}
                          style={{ margin: 0, accentColor: '#a78bfa' }}
                        />sysFont
                      </label>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>platFont:</span>
                      {(['', 'system-ui', 'sans-serif', 'monospace'] as const).map(f => {
                        const cur = String(p.platformFont ?? p._platformFont ?? p._N$platformFont ?? '')
                        return (
                          <span key={f || 'def'} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, platformFont: f, _platformFont: f, _N$platformFont: f } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${cur === f ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === f ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                          >{f || 'def'}</span>
                        )
                      })}
                    </div>
                  )}
                  {/* R1757: fontFamily 입력 + 폰트 에셋 드롭다운 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative', flexWrap: 'wrap' }} ref={fontDropdownRef}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>fontFam</span>
                    <input type="text" key={String(p.fontFamily ?? p._fontFamily ?? p._N$fontFamily ?? '')} defaultValue={String(p.fontFamily ?? p._fontFamily ?? p._N$fontFamily ?? '')} placeholder="폰트 이름 (빈칸=기본)"
                      onBlur={e => {
                        const v = e.target.value.trim()
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontFamily: v, _fontFamily: v, _N$fontFamily: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    <button
                      title="프로젝트 폰트 에셋 선택"
                      onClick={() => setFontDropdownOpen(v => !v)}
                      style={{ fontSize: 9, padding: '1px 5px', background: fontDropdownOpen ? 'var(--accent)' : 'var(--bg-primary)', border: '1px solid var(--border)', color: fontDropdownOpen ? '#fff' : 'var(--text-muted)', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}
                    >F▾</button>
                    {/* 폰트 에셋 드롭존 */}
                    <span
                      style={{
                        fontSize: 8, padding: '1px 5px', borderRadius: 3, cursor: 'copy',
                        border: '1px dashed var(--border)', color: '#555',
                        transition: 'border-color 0.1s, background 0.1s',
                      }}
                      title="폰트 파일을 여기에 드롭"
                      onDragOver={e => {
                        if (e.dataTransfer.types.includes('application/cc-asset')) {
                          e.preventDefault()
                          e.stopPropagation()
                          e.dataTransfer.dropEffect = 'copy'
                          ;(e.currentTarget as HTMLElement).style.borderColor = '#58a6ff'
                          ;(e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.12)'
                        }
                      }}
                      onDragLeave={e => {
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                      }}
                      onDrop={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                        try {
                          const data = JSON.parse(e.dataTransfer.getData('application/cc-asset') || '{}')
                          if (data.uuid) {
                            const fontRef = { __uuid__: data.uuid }
                            applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, font: fontRef, _N$file: fontRef } } : c
                              )
                            })
                          }
                        } catch {}
                      }}
                    >
                      폰트드롭
                    </span>
                    {fontDropdownOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, zIndex: 9999,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 4, minWidth: 160, maxHeight: 200, overflowY: 'auto',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)', marginTop: 2,
                      }}>
                        {fontAssets.length === 0 && (
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '6px 8px' }}>로딩 중...</div>
                        )}
                        {fontAssets.map(fa => (
                          <div key={fa.uuid}
                            onClick={() => {
                              const fontRef = { __uuid__: fa.uuid }
                              const updated = draft.components.map(c => c === comp ? {
                                ...c, props: {
                                  ...c.props,
                                  font: fontRef, _font: fontRef, _N$font: fontRef,
                                  file: fontRef, _file: fontRef, _N$file: fontRef,
                                  isSystemFontUsed: false, _isSystemFontUsed: false, _N$isSystemFontUsed: false,
                                }
                              } : c)
                              applyAndSave({ components: updated })
                              setFontDropdownOpen(false)
                            }}
                            style={{ fontSize: 10, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >{fa.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* R1798: fontFamily 퀵 프리셋 */}
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', paddingLeft: 52 }}>
                    {(['', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New'] as const).map(ff => {
                      const curFf = String(p.fontFamily ?? p._fontFamily ?? p._N$fontFamily ?? '')
                      return (
                        <span key={ff} title={ff || '기본 (빈칸)'}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontFamily: ff, _fontFamily: ff, _N$fontFamily: ff } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${curFf === ff ? '#f59e0b' : 'var(--border)'}`, borderRadius: 2, color: curFf === ff ? '#f59e0b' : 'var(--text-muted)', userSelect: 'none', fontFamily: ff || 'inherit' }}
                        >{ff || 'default'}</span>
                      )
                    })}
                  </div>
                  {/* R2445: cacheMode (BatchInspector R1925) None/Bitmap/Char */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>cacheMode</span>
                    {([['None', 0], ['Bitmap', 1], ['Char', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.cacheMode ?? p._cacheMode ?? p._N$cacheMode ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, cacheMode: v, _cacheMode: v, _N$cacheMode: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R1720: overflow + hAlign + vAlign */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>overflow</span>
                    <select value={overflow}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, overflow: v, _overflow: v, _N$overflow: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                    >
                      <option value={0}>None</option>
                      <option value={1}>Clamp</option>
                      <option value={2}>Shrink</option>
                      <option value={3}>ResizeH</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>align</span>
                    <div style={{ display: 'flex', gap: 2, flex: 1, flexWrap: 'wrap' }}>
                      {(['L', 'C', 'R'] as const).map((lbl, i) => (
                        <span key={lbl}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalAlign: i, _horizontalAlign: i, _N$horizontalAlign: i } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 9, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: `1px solid ${hAlign === i ? '#58a6ff' : 'var(--border)'}`, color: hAlign === i ? '#58a6ff' : 'var(--text-muted)', background: hAlign === i ? 'rgba(88,166,255,0.1)' : 'transparent' }}
                        >{lbl}</span>
                      ))}
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', margin: '0 4px' }}>|</span>
                      {(['T', 'M', 'B'] as const).map((lbl, i) => (
                        <span key={lbl}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, verticalAlign: i, _verticalAlign: i, _N$verticalAlign: i } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 9, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: `1px solid ${vAlign === i ? '#58a6ff' : 'var(--border)'}`, color: vAlign === i ? '#58a6ff' : 'var(--text-muted)', background: vAlign === i ? 'rgba(88,166,255,0.1)' : 'transparent' }}
                        >{lbl}</span>
                      ))}
                    </div>
                  </div>
                  {/* R1789: enableWrapText 토글 + spacingX */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>wrap</span>
                    {(() => {
                      const wrapVal = !!(p.enableWrapText ?? p._enableWrapText ?? p._N$enableWrapText ?? true)
                      return (
                        <span title={wrapVal ? '줄바꿈 활성 (클릭시 해제)' : '줄바꿈 비활성 (클릭시 활성)'}
                          onClick={() => {
                            const nv = !wrapVal
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableWrapText: nv, _enableWrapText: nv, _N$enableWrapText: nv } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '1px 6px', cursor: 'pointer', border: `1px solid ${wrapVal ? '#4ade80' : 'var(--border)'}`, borderRadius: 2, color: wrapVal ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
                        >{wrapVal ? '✓ wrap' : '✕ wrap'}</span>
                      )
                    })()}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>spcX</span>
                    <input type="number" key={Number(p.spacingX ?? p._spacingX ?? p._N$spacingX ?? 0)} defaultValue={Number(p.spacingX ?? p._spacingX ?? p._N$spacingX ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingX: v, _spacingX: v, _N$spacingX: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R2364: spacingY */}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>Y</span>
                    <input type="number" key={Number(p.spacingY ?? p._spacingY ?? p._N$spacingY ?? 0)} defaultValue={Number(p.spacingY ?? p._spacingY ?? p._N$spacingY ?? 0)} step={1}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, spacingY: v, _spacingY: v, _N$spacingY: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 40, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="spacingY (R2364)"
                    />
                  </div>
                  {/* R1743: bold / italic / underline 토글 */}
                  {(() => {
                    const bold = !!(p.isBold ?? p._isBold ?? p._N$isBold ?? false)
                    const italic = !!(p.isItalic ?? p._isItalic ?? p._N$isItalic ?? false)
                    const underline = !!(p.isUnderline ?? p._isUnderline ?? p._N$isUnderline ?? false)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>style</span>
                        {[
                          { label: 'B', title: 'Bold', key: 'isBold', val: bold },
                          { label: 'I', title: 'Italic', key: 'isItalic', val: italic },
                          { label: 'U', title: 'Underline', key: 'isUnderline', val: underline },
                        ].map(({ label, title, key, val }) => (
                          <span key={key}
                            title={title}
                            onClick={() => {
                              const nv = !val
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key]: nv, [`_${key}`]: nv, [`_N$${key}`]: nv } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 10, fontWeight: label === 'B' ? 700 : 400, fontStyle: label === 'I' ? 'italic' : 'normal', textDecoration: label === 'U' ? 'underline' : 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: `1px solid ${val ? '#58a6ff' : 'var(--border)'}`, color: val ? '#58a6ff' : 'var(--text-muted)', background: val ? 'rgba(88,166,255,0.1)' : 'transparent', userSelect: 'none' }}
                          >{label}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R2350: underlineHeight (CC3.x) — isUnderline 활성 시 표시 */}
                  {!!(p.isUnderline ?? p._isUnderline ?? p._N$isUnderline ?? false) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>ulHeight</span>
                      <input type="number" defaultValue={Number(p.underlineHeight ?? p._underlineHeight ?? 2)} min={1} max={20} step={1}
                        key={`ulh-${Number(p.underlineHeight ?? p._underlineHeight ?? 2)}`}
                        onBlur={e => {
                          const v = parseInt(e.target.value) || 2
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, underlineHeight: v, _underlineHeight: v, _N$underlineHeight: v } } : c)
                          applyAndSave({ components: updated })
                        }}
                        style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: '#93c5fd', borderRadius: 3, padding: '1px 4px' }}
                        title="밑줄 두께 (CC3.x underlineHeight, 기본 2px)"
                      />
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
                      {[1, 2, 3, 4, 6].map(v => (
                        <span key={v} title={`underlineHeight = ${v}`}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, underlineHeight: v, _underlineHeight: v, _N$underlineHeight: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Number(p.underlineHeight ?? p._underlineHeight ?? 2) === v ? '#93c5fd' : 'var(--border)'}`, borderRadius: 2, color: Number(p.underlineHeight ?? p._underlineHeight ?? 2) === v ? '#93c5fd' : 'var(--text-muted)', userSelect: 'none' }}
                        >{v}</span>
                      ))}
                    </div>
                  )}
                  {/* R2351: cc.Label strikethrough + charSpacing */}
                  {(() => {
                    const isStrike = !!(p.isStrikethrough ?? p._isStrikethrough ?? p.isStrike ?? p._isStrike ?? p._N$isStrike ?? false)
                    const charSpacing = Number(p.charSpacing ?? p._charSpacing ?? p._N$charSpacing ?? 0)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          title={isStrike ? '취소선 해제' : '취소선 활성'}
                          onClick={() => {
                            const nv = !isStrike
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, isStrikethrough: nv, isStrike: nv, _isStrike: nv, _N$isStrike: nv } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 10, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: `1px solid ${isStrike ? '#f472b6' : 'var(--border)'}`, color: isStrike ? '#f472b6' : 'var(--text-muted)', background: isStrike ? 'rgba(244,114,182,0.1)' : 'transparent', textDecoration: 'line-through', userSelect: 'none' }}
                        >S</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>spcX</span>
                        <input type="number" defaultValue={charSpacing} step={1}
                          key={`cs-${charSpacing}`}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, charSpacing: v, _charSpacing: v, _N$charSpacing: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                          title="문자 간격 (charSpacing)"
                        />
                        {[-2, 0, 2, 4, 8].map(v => (
                          <span key={v} title={`charSpacing = ${v}`}
                            onClick={() => {
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, charSpacing: v, _charSpacing: v, _N$charSpacing: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                            style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${charSpacing === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: charSpacing === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                          >{v}</span>
                        ))}
                      </div>
                    )
                  })()}
                  {/* R1746: 텍스트 대소문자 변환 버튼 */}
                  {str && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>변환</span>
                      {[
                        { label: 'ABC', title: '모두 대문자', fn: (s: string) => s.toUpperCase() },
                        { label: 'abc', title: '모두 소문자', fn: (s: string) => s.toLowerCase() },
                        { label: 'Abc', title: '단어 첫 글자 대문자', fn: (s: string) => s.replace(/\b\w/g, c => c.toUpperCase()) },
                        /* R1759: trim */
                        { label: 'trim', title: '앞뒤 공백 제거', fn: (s: string) => s.trim() },
                      ].map(({ label, title, fn }) => (
                        <span key={label} title={title}
                          onClick={() => {
                            const newStr = fn(str)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: newStr, _string: newStr, _N$string: newStr } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ fontSize: 9, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >{label}</span>
                      ))}
                    </div>
                  )}
                  {/* R2372: CC3.x Label enableDashLine */}
                  {(() => {
                    const enableDashLine = !!(p.enableDashLine ?? p._enableDashLine ?? false)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>dashLine</span>
                        <span title={enableDashLine ? 'dashLine 비활성' : 'dashLine 활성'}
                          onClick={() => { const nv = !enableDashLine; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableDashLine: nv, _enableDashLine: nv, _N$enableDashLine: nv } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${enableDashLine ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: enableDashLine ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{enableDashLine ? 'ON' : 'OFF'}</span>
                      </div>
                    )
                  })()}
                  {/* R2371: CC3.x Label enableGradient + colorTop + colorBottom */}
                  {(() => {
                    const enableGradient = !!(p.enableGradient ?? p._enableGradient ?? false)
                    const ct = p.colorTop ?? p._colorTop as { r?: number; g?: number; b?: number } | undefined
                    const cb = p.colorBottom ?? p._colorBottom as { r?: number; g?: number; b?: number } | undefined
                    const ctHex = ct ? `#${((ct.r ?? 255) << 16 | (ct.g ?? 255) << 8 | (ct.b ?? 255)).toString(16).padStart(6, '0')}` : '#ffffff'
                    const cbHex = cb ? `#${((cb.r ?? 0) << 16 | (cb.g ?? 0) << 8 | (cb.b ?? 0)).toString(16).padStart(6, '0')}` : '#000000'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>gradient</span>
                        <span title={enableGradient ? 'gradient 비활성' : 'gradient 활성'}
                          onClick={() => { const nv = !enableGradient; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableGradient: nv, _enableGradient: nv, _N$enableGradient: nv } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${enableGradient ? '#34d399' : 'var(--border)'}`, borderRadius: 2, color: enableGradient ? '#34d399' : 'var(--text-muted)', userSelect: 'none' }}
                        >{enableGradient ? 'ON' : 'OFF'}</span>
                        {enableGradient && (<>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>top</span>
                          <input type="color" defaultValue={ctHex}
                            style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                            onChange={ev => { const c2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (c2 >> 16) & 255, g: (c2 >> 8) & 255, b: c2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, colorTop: col, _colorTop: col, _N$colorTop: col } } : c); applyAndSave({ components: u }) }}
                            title="colorTop"
                          />
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>bot</span>
                          <input type="color" defaultValue={cbHex}
                            style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                            onChange={ev => { const c2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (c2 >> 16) & 255, g: (c2 >> 8) & 255, b: c2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, colorBottom: col, _colorBottom: col, _N$colorBottom: col } } : c); applyAndSave({ components: u }) }}
                            title="colorBottom"
                          />
                        </>)}
                      </div>
                    )
                  })()}
                  {/* R2370: CC3.x Label enableShadow + shadowColor + shadowBlur */}
                  {/* R2385: + shadowOffset x/y */}
                  {(() => {
                    const enableShadow = !!(p.enableShadow ?? p._enableShadow ?? false)
                    const shadowBlur = Number(p.shadowBlur ?? p._shadowBlur ?? 2)
                    const sc = p.shadowColor ?? p._shadowColor as { r?: number; g?: number; b?: number } | undefined
                    const scHex = sc ? `#${((sc.r ?? 0) << 16 | (sc.g ?? 0) << 8 | (sc.b ?? 0)).toString(16).padStart(6, '0')}` : '#000000'
                    const soRaw = p.shadowOffset ?? p._shadowOffset as { x?: number; y?: number } | undefined
                    const sox = Number((soRaw as Record<string,number>|undefined)?.x ?? 2)
                    const soy = Number((soRaw as Record<string,number>|undefined)?.y ?? -2)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>shadow</span>
                          <span title={enableShadow ? 'shadow 비활성' : 'shadow 활성'}
                            onClick={() => { const nv = !enableShadow; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableShadow: nv, _enableShadow: nv, _N$enableShadow: nv } } : c); applyAndSave({ components: u }) }}
                            style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${enableShadow ? '#818cf8' : 'var(--border)'}`, borderRadius: 2, color: enableShadow ? '#818cf8' : 'var(--text-muted)', userSelect: 'none' }}
                          >{enableShadow ? 'ON' : 'OFF'}</span>
                          {enableShadow && (<>
                            <input type="number" defaultValue={shadowBlur} min={0} max={20} step={1}
                              style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                              onBlur={ev => { const v = parseInt(ev.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, shadowBlur: v, _shadowBlur: v, _N$shadowBlur: v } } : c); applyAndSave({ components: u }) }}
                              title="shadowBlur"
                            />
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>blur</span>
                            <input type="color" defaultValue={scHex}
                              style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                              onChange={ev => { const c2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (c2 >> 16) & 255, g: (c2 >> 8) & 255, b: c2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, shadowColor: col, _shadowColor: col, _N$shadowColor: col } } : c); applyAndSave({ components: u }) }}
                              title="shadowColor"
                            />
                          </>)}
                        </div>
                        {enableShadow && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 52 }}>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>offset x</span>
                            <input type="number" defaultValue={sox} step={1}
                              style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                              onBlur={ev => { const x = parseFloat(ev.target.value) || 0; const so = { x, y: soy }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, shadowOffset: so, _shadowOffset: so, _N$shadowOffset: so } } : c); applyAndSave({ components: u }) }}
                              title="shadowOffset.x"
                            />
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
                            <input type="number" defaultValue={soy} step={1}
                              style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                              onBlur={ev => { const y = parseFloat(ev.target.value) || 0; const so = { x: sox, y }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, shadowOffset: so, _shadowOffset: so, _N$shadowOffset: so } } : c); applyAndSave({ components: u }) }}
                              title="shadowOffset.y"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {/* R2369: CC3.x Label enableOutline + outlineWidth + outlineColor */}
                  {(() => {
                    const enableOutline = !!(p.enableOutline ?? p._enableOutline ?? false)
                    const outlineWidth = Number(p.outlineWidth ?? p._outlineWidth ?? 2)
                    const oc = p.outlineColor ?? p._outlineColor as { r?: number; g?: number; b?: number } | undefined
                    const ocHex = oc ? `#${((oc.r ?? 0) << 16 | (oc.g ?? 0) << 8 | (oc.b ?? 0)).toString(16).padStart(6, '0')}` : '#000000'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0 }}>outline</span>
                        <span title={enableOutline ? 'outline 비활성' : 'outline 활성'}
                          onClick={() => { const nv = !enableOutline; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enableOutline: nv, _enableOutline: nv, _N$enableOutline: nv } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${enableOutline ? '#f59e0b' : 'var(--border)'}`, borderRadius: 2, color: enableOutline ? '#f59e0b' : 'var(--text-muted)', userSelect: 'none' }}
                        >{enableOutline ? 'ON' : 'OFF'}</span>
                        {enableOutline && (<>
                          <input type="number" defaultValue={outlineWidth} min={1} max={20} step={1}
                            style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                            onBlur={ev => { const v = parseInt(ev.target.value) || 2; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, outlineWidth: v, _outlineWidth: v, _N$outlineWidth: v } } : c); applyAndSave({ components: u }) }}
                            title="outlineWidth"
                          />
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>px</span>
                          <input type="color" defaultValue={ocHex}
                            style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                            onChange={ev => { const c2 = parseInt(ev.target.value.slice(1), 16); const col = { r: (c2 >> 16) & 255, g: (c2 >> 8) & 255, b: c2 & 255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, outlineColor: col, _outlineColor: col, _N$outlineColor: col } } : c); applyAndSave({ components: u }) }}
                            title="outlineColor"
                          />
                        </>)}
                      </div>
                    )
                  })()}
                  {/* R1691: 멀티라인 텍스트 미리보기 */}
                  {(str.includes('\n') || str.includes('\\n')) && (() => {
                    const lines = str.replace(/\\n/g, '\n').split('\n')
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>미리보기</span>
                        <div style={{ flex: 1, background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 3, padding: '3px 5px', fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre', overflowX: 'auto', maxHeight: 60, overflowY: 'auto' }}>
                          {lines.map((line, i) => <div key={i}>{line || <span style={{ color: 'var(--text-muted)' }}>↵</span>}</div>)}
                        </div>
                      </div>
                    )
                  })()}
                </div>
  )
}

/** cc.LabelOutline, cc.LabelShadow, cc.RichText, cc.Label Quick Edit renderer */
export function LabelRenderer({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.LabelOutline' || comp.type === 'cc.LabelShadow') {
              const toHex = (c: { r?: number; g?: number; b?: number } | undefined) => {
                if (!c) return '#000000'
                const r = (c.r ?? 0).toString(16).padStart(2, '0')
                const g = (c.g ?? 0).toString(16).padStart(2, '0')
                const b = (c.b ?? 0).toString(16).padStart(2, '0')
                return `#${r}${g}${b}`
              }
              const fromHex = (hex: string) => {
                const n = parseInt(hex.replace('#', ''), 16)
                return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 }
              }
              const offObj = p.offset as { x?: number; y?: number } | undefined
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2437: enabled (BatchInspector R2219) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R1811: applyAndSave 교체 */}
                  {comp.type === 'cc.LabelOutline' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11 }}>width</label>
                      <input type="number" min={0} max={20} defaultValue={Number(p.width ?? p._width ?? 0)}
                        style={{ width: 60, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, width: v, _width: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                      <label style={{ fontSize: 11 }}>color</label>
                      <input type="color" value={toHex((p.color ?? p._color) as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: 36, height: 22, border: 'none', background: 'none', cursor: 'pointer' }}
                        onChange={ev => {
                          const col = { ...fromHex(ev.target.value), a: 255 }
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  )}
                  {comp.type === 'cc.LabelShadow' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>offsetX</label>
                        <input type="number" defaultValue={Number(offObj?.x ?? 2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onBlur={ev => {
                            const x = Number(ev.target.value)
                            const curOff = offObj ?? {}
                            const newOff = { ...curOff, x }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                            applyAndSave({ components: updated })
                          }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>offsetY</label>
                        <input type="number" defaultValue={Number(offObj?.y ?? -2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onBlur={ev => {
                            const y = Number(ev.target.value)
                            const curOff = offObj ?? {}
                            const newOff = { ...curOff, y }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, offset: newOff, _offset: newOff, _N$offset: newOff } } : c)
                            applyAndSave({ components: updated })
                          }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>blur</label>
                        <input type="number" min={0} max={20} defaultValue={Number(p.blur ?? p._blur ?? 2)}
                          style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                          onBlur={ev => {
                            const v = Number(ev.target.value)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, blur: v, _blur: v } } : c)
                            applyAndSave({ components: updated })
                          }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11 }}>color</label>
                        <input type="color" value={toHex((p.color ?? p._color) as { r?: number; g?: number; b?: number } | undefined)}
                          style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                          onChange={ev => {
                            const col = { ...fromHex(ev.target.value), a: 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col } } : c)
                            applyAndSave({ components: updated })
                          }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            // R1587/R1812: cc.Toggle / cc.ToggleContainer Quick Edit (applyAndSave)
            if (comp.type === 'cc.RichText') {
              const HALIGN = ['Left', 'Center', 'Right']
              const OVERFLOW = ['None', 'Clamp', 'Shrink', 'Resize']
              // R1767: RichText 마크업 → HTML 변환 (미리보기용)
              const richToHtml = (src: string) => src
                .replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/&lt;color=(#[0-9a-fA-F]{3,8})&gt;(.*?)&lt;\/color&gt;/gs, '<span style="color:$1">$2</span>')
                .replace(/&lt;size=(\d+)&gt;(.*?)&lt;\/size&gt;/gs, '<span style="font-size:$1px">$2</span>')
                .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gs, '<b>$1</b>')
                .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gs, '<i>$1</i>')
                .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gs, '<u>$1</u>')
                .replace(/\n/g, '<br/>')
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontWeight: 'bold' }}>{comp.type}</span>
                    {/* R2433: enabled (BatchInspector R2192) */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                        style={{ margin: 0 }}
                      />enabled
                    </label>
                    {/* R1767: 미리보기 토글 */}
                    <span title={showRichPreview ? '미리보기 숨기기' : '미리보기 표시'}
                      onClick={() => setShowRichPreview(v => !v)}
                      style={{ fontSize: 9, cursor: 'pointer', color: showRichPreview ? '#58a6ff' : '#556', padding: '0 3px', border: '1px solid var(--border)', borderRadius: 2 }}
                    >{showRichPreview ? '👁 미리보기' : '👁'}</span>
                  </div>
                  {showRichPreview && (
                    <div style={{ marginBottom: 4, padding: '4px 6px', background: '#111', border: '1px solid #333', borderRadius: 3, fontSize: 11, minHeight: 24, color: '#fff', lineHeight: 1.5, wordBreak: 'break-all' }}
                      dangerouslySetInnerHTML={{ __html: richToHtml(String(p.string ?? '')) }} />
                  )}
                  {/* R1808: string applyAndSave */}
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>내용 (HTML 태그 지원)</label>
                    <textarea
                      defaultValue={String(p.string ?? '')}
                      rows={3}
                      style={{ width: '100%', fontSize: 11, resize: 'vertical', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', boxSizing: 'border-box' }}
                      onBlur={ev => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: ev.target.value, _string: ev.target.value, _N$string: ev.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>fontSize</label>
                      <input type="number" defaultValue={Number(p.fontSize ?? 40)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                      {/* R1808: fontSize 프리셋 */}
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
                        {[12, 16, 20, 24, 32, 48].map(v => (
                          <span key={v} onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c)
                            applyAndSave({ components: updated })
                          }} style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: `1px solid ${Number(p.fontSize ?? 40) === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: Number(p.fontSize ?? 40) === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}>{v}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>lineHeight</label>
                      <input type="number" defaultValue={Number(p.lineHeight ?? 40)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineHeight: v, _lineHeight: v, _N$lineHeight: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>maxWidth (0=무제한)</label>
                      <input type="number" defaultValue={Number(p.maxWidth ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxWidth: v, _maxWidth: v, _N$maxWidth: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11 }}>horizontalAlign</label>
                      <select value={Number(p.horizontalAlign ?? 0)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onChange={ev => {
                          const v = parseInt(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalAlign: v, _horizontalAlign: v, _N$horizontalAlign: v } } : c)
                          applyAndSave({ components: updated })
                        }}>
                        {HALIGN.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>overflow</label>
                    <select value={Number(p.overflow ?? 0)}
                      style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      onChange={ev => {
                        const v = parseInt(ev.target.value)
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, overflow: v, _overflow: v, _N$overflow: v } } : c)
                        applyAndSave({ components: updated })
                      }}>
                      {OVERFLOW.map((l, i) => <option key={i} value={i}>{i} {l}</option>)}
                    </select>
                  </div>
                  {/* R2353: fontColor */}
                  {(() => {
                    const fc = p.fontColor ?? p._fontColor ?? p._N$fontColor as { r?: number; g?: number; b?: number } | undefined
                    const fcR = (fc as Record<string,number> | undefined)?.r ?? 0
                    const fcG = (fc as Record<string,number> | undefined)?.g ?? 0
                    const fcB = (fc as Record<string,number> | undefined)?.b ?? 0
                    const fcHex = `#${fcR.toString(16).padStart(2,'0')}${fcG.toString(16).padStart(2,'0')}${fcB.toString(16).padStart(2,'0')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <label style={{ fontSize: 11, flexShrink: 0 }}>fontColor</label>
                        <input type="color" value={fcHex}
                          onChange={e => {
                            const h = e.target.value
                            const nr = parseInt(h.slice(1,3),16), ng = parseInt(h.slice(3,5),16), nb = parseInt(h.slice(5,7),16)
                            const col = { r: nr, g: ng, b: nb, a: 255 }
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ width: 28, height: 22, border: '1px solid #444', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
                        />
                        <span style={{ fontSize: 9, color: '#ccc' }}>{fcR},{fcG},{fcB}</span>
                      </div>
                    )
                  })()}
                  {/* R2446: verticalAlign (BatchInspector R2010) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <label style={{ fontSize: 11, flexShrink: 0, marginRight: 4 }}>verticalAlign</label>
                    {([['Top', 0], ['Ctr', 1], ['Bot', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.verticalAlign ?? p._verticalAlign ?? p._N$verticalAlign ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, verticalAlign: v, _verticalAlign: v, _N$verticalAlign: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#fb923c' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#fb923c' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R2446: imageLineHeight (BatchInspector R2182) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <label style={{ fontSize: 11, flexShrink: 0, width: 80 }}>imgLineH</label>
                    <input type="number" defaultValue={Number(p.imageLineHeight ?? p._imageLineHeight ?? p._N$imageLineHeight ?? 40)} min={0} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || 40; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, imageLineHeight: v, _imageLineHeight: v, _N$imageLineHeight: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                      title="imageLineHeight"
                    />
                  </div>
                  {/* R2446: handleTouchEvent (BatchInspector R2164) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.handleTouchEvent ?? p._handleTouchEvent ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, handleTouchEvent: e.target.checked, _handleTouchEvent: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />handleTouchEvent
                  </label>
                </div>
              )
            }
            // R1755: cc.Canvas — 해상도 + fitWidth/fitHeight 퀵 편집
            if (comp.type === 'cc.Label') {
              return <LabelQuickEdit comp={comp} draft={draft} applyAndSave={applyAndSave} sceneFile={sceneFile} origIdx={origIdx} ci={ci} is3x={is3x} />
            }
            // R2420: cc.LabelOutline — width + color (BatchInspector R1860/R1909)
            if (comp.type === 'cc.LabelOutline') {
              const width = Number(p.width ?? p._width ?? p._N$width ?? 1)
              const colRaw = p.color ?? p._color ?? p._N$color as { r?: number; g?: number; b?: number } | undefined
              const toHex = (c: typeof colRaw) => `#${[(c?.r ?? 0),(c?.g ?? 0),(c?.b ?? 0)].map(v => v.toString(16).padStart(2,'0')).join('')}`
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>width</span>
                    <input type="number" defaultValue={width} min={0} step={1}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={ev => { const v = Math.max(0, parseInt(ev.target.value) || 0); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, width: v, _width: v, _N$width: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[1, 2, 3, 4, 5, 8].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, width: v, _width: v, _N$width: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>color</span>
                    <input type="color" value={toHex(colRaw as { r?: number; g?: number; b?: number } | undefined)}
                      onChange={e => { const n2 = parseInt(e.target.value.slice(1), 16); const col = { r: (n2>>16)&255, g: (n2>>8)&255, b: n2&255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 36, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                    />
                  </div>
                </div>
              )
            }
            // R2420: cc.LabelShadow — blur + color (BatchInspector R1861/R1910)
            if (comp.type === 'cc.LabelShadow') {
              const blur = Number(p.blur ?? p._blur ?? 2)
              const colRaw = p.color ?? p._color ?? p._N$color as { r?: number; g?: number; b?: number } | undefined
              const toHex = (c: typeof colRaw) => `#${[(c?.r ?? 0),(c?.g ?? 0),(c?.b ?? 0)].map(v => v.toString(16).padStart(2,'0')).join('')}`
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>blur</span>
                    <input type="number" defaultValue={blur} min={0} step={1}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      onBlur={ev => { const v = Math.max(0, parseInt(ev.target.value) || 0); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, blur: v, _blur: v } } : c); applyAndSave({ components: u }) }}
                    />
                    {[1, 2, 3, 5, 8].map(v => (
                      <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, blur: v, _blur: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>color</span>
                    <input type="color" value={toHex(colRaw as { r?: number; g?: number; b?: number } | undefined)}
                      onChange={e => { const n2 = parseInt(e.target.value.slice(1), 16); const col = { r: (n2>>16)&255, g: (n2>>8)&255, b: n2&255, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, color: col, _color: col, _N$color: col } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 36, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                    />
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.RichText') {
              const str = String(p.string ?? p.String ?? '')
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R1808: _N$string 포함 */}
                  <textarea
                    defaultValue={str}
                    rows={2}
                    onBlur={e => {
                      const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, string: e.target.value, _string: e.target.value, _N$string: e.target.value } } : c)
                      applyAndSave({ components: updated })
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', resize: 'vertical' }}
                  />
                  {/* R2381: lineHeight + overflow + handleTouchEvent */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>lineH</span>
                    <input type="number" defaultValue={Number(p.lineHeight ?? p._lineHeight ?? p._N$lineHeight ?? 40)} min={1} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || 40; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineHeight: v, _lineHeight: v, _N$lineHeight: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="lineHeight"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>overflow</span>
                    {([['Clamp', 0], ['Shrink', 1], ['Resize', 2], ['None', 3]] as const).map(([l, v]) => (
                      <span key={v} title={`overflow=${l}(${v})`}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, overflow: v, _overflow: v, _N$overflow: v } } : c); applyAndSave({ components: u }) }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${Number(p.overflow ?? p._N$overflow ?? 0) === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: Number(p.overflow ?? p._N$overflow ?? 0) === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  {/* R2392: imageLineHeight */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>imgLineH</span>
                    <input type="number" defaultValue={Number(p.imageLineHeight ?? p._imageLineHeight ?? p._N$imageLineHeight ?? 40)} min={0} step={1}
                      onBlur={e => { const v = parseInt(e.target.value) || 40; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, imageLineHeight: v, _imageLineHeight: v, _N$imageLineHeight: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="imageLineHeight"
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.handleTouchEvent ?? p._handleTouchEvent ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, handleTouchEvent: e.target.checked, _handleTouchEvent: e.target.checked } } : c); applyAndSave({ components: u }) }}
                    />handleTouchEvent
                  </label>
                  {/* R2418: horizontalAlign + fontSize + maxWidth + fontColor */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>hAlign</span>
                    {([['L', 0], ['C', 1], ['R', 2]] as const).map(([l, v]) => {
                      const cur = Number(p.horizontalAlign ?? p._horizontalAlign ?? p._N$horizontalAlign ?? 0)
                      return (
                        <span key={v} onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, horizontalAlign: v, _horizontalAlign: v, _N$horizontalAlign: v } } : c); applyAndSave({ components: u }) }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>fontSize</span>
                    <input type="number" defaultValue={Number(p.fontSize ?? p._fontSize ?? p._N$fontSize ?? 40)} min={1} step={2}
                      onBlur={e => { const v = parseInt(e.target.value) || 40; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontSize: v, _fontSize: v, _N$fontSize: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 44, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="fontSize"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>maxW</span>
                    <input type="number" defaultValue={Number(p.maxWidth ?? p._maxWidth ?? p._N$maxWidth ?? 0)} min={0} step={10}
                      onBlur={e => { const v = parseInt(e.target.value) || 0; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, maxWidth: v, _maxWidth: v, _N$maxWidth: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="maxWidth (0=unlimited)"
                    />
                  </div>
                  {(() => {
                    const fcRaw = p.fontColor ?? p._fontColor ?? p._N$fontColor as { r?: number; g?: number; b?: number } | undefined
                    const toHex = (c: typeof fcRaw) => `#${[(c?.r ?? 255),(c?.g ?? 255),(c?.b ?? 255)].map(v => v.toString(16).padStart(2,'0')).join('')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>fontColor</span>
                        <input type="color" value={toHex(fcRaw as { r?: number; g?: number; b?: number } | undefined)}
                          onChange={e => { const h = e.target.value; const r2 = parseInt(h.slice(1,3),16), g2 = parseInt(h.slice(3,5),16), b2 = parseInt(h.slice(5,7),16); const col = { r: r2, g: g2, b: b2, a: 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 36, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                          title="fontColor"
                        />
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1538: cc.EditBox — 텍스트/플레이스홀더/maxLength 편집
            return null
}
