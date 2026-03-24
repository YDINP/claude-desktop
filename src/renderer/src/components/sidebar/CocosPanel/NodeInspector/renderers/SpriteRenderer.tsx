import React from 'react'
import type { RendererProps } from './types'
import { SpriteThumb } from '../constants'

const BLEND_FACTOR: Record<number, string> = {
  0: 'ZERO',
  1: 'ONE',
  512: 'DST_ALPHA',
  513: 'ONE_MINUS_DST_ALPHA',
  770: 'SRC_ALPHA',
  771: 'ONE_MINUS_SRC_ALPHA',
  772: 'DST_COLOR',
  773: 'ONE_MINUS_DST_COLOR',
  776: 'SRC_ALPHA_SATURATE',
  32769: 'CONSTANT_COLOR',
  32770: 'ONE_MINUS_CONSTANT_COLOR',
  32771: 'CONSTANT_ALPHA',
  32772: 'ONE_MINUS_CONSTANT_ALPHA',
}

/** cc.Graphics, cc.Sprite, cc.Sprite2D, cc.VideoPlayer, cc.WebView, cc.TiledMap, cc.TiledLayer Quick Edit renderer */
export function SpriteRenderer({ comp, draft, applyAndSave, sceneFile, origIdx, ci, is3x }: RendererProps): React.ReactElement | null {
            const p = comp.props
            if (comp.type === 'cc.Graphics') {
              const toHex = (c: { r?: number; g?: number; b?: number } | undefined) => {
                if (!c) return '#ffffff'
                return `#${[(c.r ?? 255), (c.g ?? 255), (c.b ?? 255)].map(v => v.toString(16).padStart(2, '0')).join('')}`
              }
              const fromHex = (hex: string, a = 255) => {
                const n = parseInt(hex.replace('#', ''), 16)
                return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a }
              }
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2434: enabled (BatchInspector R2194) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>lineWidth</label>
                      <input type="number" min={0} defaultValue={Number(p.lineWidth ?? 1)}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => {
                          const v = Number(ev.target.value)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineWidth: v, _lineWidth: v, _N$lineWidth: v } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div />
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>fillColor</label>
                      <input type="color" value={toHex(p.fillColor as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                        onChange={ev => {
                          const col = fromHex(ev.target.value, 255)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillColor: col, _fillColor: col, _N$fillColor: col } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>strokeColor</label>
                      <input type="color" value={toHex(p.strokeColor as { r?: number; g?: number; b?: number } | undefined)}
                        style={{ width: '100%', height: 22, border: '1px solid #444', borderRadius: 3, cursor: 'pointer' }}
                        onChange={ev => {
                          const col = fromHex(ev.target.value, 255)
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, strokeColor: col, _strokeColor: col, _N$strokeColor: col } } : c)
                          applyAndSave({ components: updated })
                        }} />
                    </div>
                  </div>
                  {/* R2373: lineJoin / lineCap / miterLimit / fillOpacity / strokeOpacity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 36, whiteSpace: 'nowrap', flexShrink: 0 }}>join</span>
                    {(['miter', 'round', 'bevel'] as const).map(v => (
                      <span key={v} title={`lineJoin=${v}`}
                        role="button" tabIndex={0}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineJoin: v, _lineJoin: v } } : c); applyAndSave({ components: u }) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineJoin: v, _lineJoin: v } } : c); applyAndSave({ components: u }) } }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${(p.lineJoin ?? 'miter') === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: (p.lineJoin ?? 'miter') === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }}>cap</span>
                    {(['butt', 'round', 'square'] as const).map(v => (
                      <span key={v} title={`lineCap=${v}`}
                        role="button" tabIndex={0}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineCap: v, _lineCap: v } } : c); applyAndSave({ components: u }) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, lineCap: v, _lineCap: v } } : c); applyAndSave({ components: u }) } }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${(p.lineCap ?? 'butt') === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: (p.lineCap ?? 'butt') === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10 }}>miterLmt</label>
                      <input type="number" defaultValue={Number(p.miterLimit ?? 10)} min={1} step={1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = Number(ev.target.value); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, miterLimit: v, _miterLimit: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10 }}>fillOpa</label>
                      <input type="number" defaultValue={Number(p.fillOpacity ?? p._fillOpacity ?? 255)} min={0} max={255} step={1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = Number(ev.target.value); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillOpacity: v, _fillOpacity: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10 }}>strokeOpa</label>
                      <input type="number" defaultValue={Number(p.strokeOpacity ?? p._strokeOpacity ?? 255)} min={0} max={255} step={1}
                        style={{ width: '100%', background: '#1e1e1e', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '2px 4px' }}
                        onBlur={ev => { const v = Number(ev.target.value); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, strokeOpacity: v, _strokeOpacity: v } } : c); applyAndSave({ components: u }) }}
                      />
                    </div>
                  </div>
                </div>
              )
            }
            // R1589: cc.Sprite / cc.Sprite2D Quick Edit
            if (comp.type === 'cc.Sprite' || comp.type === 'cc.Sprite2D') {
              const SPRITE_TYPE = ['Simple', 'Sliced', 'Tiled', 'Filled']
              const SIZE_MODE = ['Custom', 'Trimmed', 'Raw']
              // R1696: spriteFrame uuid 추출
              const sfRaw = p._spriteFrame ?? p.spriteFrame
              const sfUuid = (sfRaw as Record<string,unknown> | null)?.__uuid__ as string | undefined
              const spriteTypeVal = Number(p.type ?? p._type ?? 0)
              const sizeModeVal = Number(p.sizeMode ?? p._sizeMode ?? 1)
              return (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{comp.type}</div>
                  {/* R2433: enabled (BatchInspector R2190) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R1696: spriteFrame uuid 표시 + 복사 버튼 */}
                  {sfUuid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      {/* R2335: 텍스처 썸네일 미리보기 */}
                      <SpriteThumb sfUuid={sfUuid} assetsDir={sceneFile.projectInfo.assetsDir ?? ''} />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>sf uuid</span>
                      <span
                        style={{ fontSize: 8, color: '#4ade80', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'copy', border: '1px dashed transparent', borderRadius: 3, padding: '1px 3px', transition: 'border-color 0.1s, background 0.1s' }}
                        title={`${sfUuid}\n에셋을 여기에 드롭하여 spriteFrame 변경`}
                        onDragOver={e => {
                          if (e.dataTransfer.types.includes('application/cc-asset')) {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'copy'
                            ;(e.currentTarget as HTMLElement).style.borderColor = '#4ade80'
                            ;(e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.12)'
                          }
                        }}
                        onDragLeave={e => {
                          ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                        }}
                        onDrop={e => {
                          e.preventDefault()
                          ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                          try {
                            const data = JSON.parse(e.dataTransfer.getData('application/cc-asset') || '{}')
                            if (data.uuid) {
                              const spriteKey = '_spriteFrame' in comp.props ? '_spriteFrame' : 'spriteFrame'
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [spriteKey]: { __uuid__: data.uuid } } } : c)
                              applyAndSave({ components: updated })
                            }
                          } catch {}
                        }}
                      >{sfUuid}</span>
                      <span
                        title="spriteFrame UUID 복사"
                        role="button" tabIndex={0}
                        onClick={() => navigator.clipboard.writeText(sfUuid).catch(() => {})}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigator.clipboard.writeText(sfUuid).catch(() => {}) } }}
                        style={{ fontSize: 9, cursor: 'pointer', color: '#666', flexShrink: 0, padding: '0 2px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#4ade80')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                      >⎘</span>
                    </div>
                  )}
                  {/* R1788: Sprite type/sizeMode 버튼 (applyAndSave) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 32, whiteSpace: 'nowrap', flexShrink: 0 }}>type</span>
                    {SPRITE_TYPE.map((l, i) => (
                      <span key={i} title={l}
                        role="button" tabIndex={0}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: i, _type: i, _N$type: i } } : c); applyAndSave({ components: updated }) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, type: i, _type: i, _N$type: i } } : c); applyAndSave({ components: updated }) } }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${spriteTypeVal === i ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: spriteTypeVal === i ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 32, whiteSpace: 'nowrap', flexShrink: 0 }}>size</span>
                    {SIZE_MODE.map((l, i) => (
                      <span key={i} title={l}
                        role="button" tabIndex={0}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sizeMode: i, _sizeMode: i, _N$sizeMode: i } } : c); applyAndSave({ components: updated }) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, sizeMode: i, _sizeMode: i, _N$sizeMode: i } } : c); applyAndSave({ components: updated }) } }}
                        style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${sizeModeVal === i ? '#58a6ff' : 'var(--border)'}`, borderRadius: 2, color: sizeModeVal === i ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                      >{l}</span>
                    ))}
                    {/* R2401: _isTrimmedMode CC3.x */}
                    {is3x && (() => {
                      const tm = Number(p._isTrimmedMode ?? 0)
                      return (
                        <>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 6, flexShrink: 0 }}>trim3:</span>
                          {([['T', 0], ['R', 1], ['P', 2]] as const).map(([l, v]) => (
                            <span key={v} title={['Trim','Raw','Polygon'][v]}
                              role="button" tabIndex={0}
                              onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _isTrimmedMode: v } } : c); applyAndSave({ components: u }) }}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _isTrimmedMode: v } } : c); applyAndSave({ components: u }) } }}
                              style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${tm === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: tm === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                            >{l}</span>
                          ))}
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <input type="checkbox" checked={!!(p.trim ?? true)}
                        onChange={ev => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, trim: ev.target.checked, _trim: ev.target.checked, _N$trim: ev.target.checked } } : c); applyAndSave({ components: updated }) }} />
                      trim
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <input type="checkbox" checked={!!(p.grayscale ?? false)}
                        onChange={ev => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, grayscale: ev.target.checked, _grayscale: ev.target.checked, _N$grayscale: ev.target.checked } } : c); applyAndSave({ components: updated }) }} />
                      grayscale
                    </label>
                  </div>
                  {/* R2402: _color CC3.x 컴포넌트 레벨 색상 */}
                  {is3x && (() => {
                    const colRaw = p._color as { r?: number; g?: number; b?: number; a?: number } | undefined
                    const toHex = (c: typeof colRaw) => `#${[(c?.r ?? 255),(c?.g ?? 255),(c?.b ?? 255)].map(v => v.toString(16).padStart(2,'0')).join('')}`
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 32, whiteSpace: 'nowrap', flexShrink: 0 }}>color</span>
                        <input type="color" value={toHex(colRaw)}
                          onChange={e => { const n2 = parseInt(e.target.value.slice(1), 16); const col = { r: (n2>>16)&255, g: (n2>>8)&255, b: n2&255, a: colRaw?.a ?? 255 }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _color: col } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 36, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                          title="Sprite _color (CC3.x)"
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>α</span>
                        <input type="number" defaultValue={colRaw?.a ?? 255} min={0} max={255} step={1}
                          onBlur={e => { const a = Math.max(0, Math.min(255, parseInt(e.target.value) || 255)); const col = { ...(colRaw ?? { r: 255, g: 255, b: 255 }), a }; const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _color: col } } : c); applyAndSave({ components: u }) }}
                          style={{ width: 36, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                        />
                      </div>
                    )
                  })()}
                  {/* R1865: srcBlendFactor / dstBlendFactor 퀵 버튼 */}
                  {(() => {
                    const curSrc = Number(p.srcBlendFactor ?? p._srcBlendFactor ?? 770)
                    const curDst = Number(p.dstBlendFactor ?? p._dstBlendFactor ?? 771)
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 32, whiteSpace: 'nowrap', flexShrink: 0 }}>blend</span>
                          {([['Normal', 770, 771], ['Add', 770, 1], ['Mul', 774, 771]] as [string, number, number][]).map(([l, src, dst]) => {
                            const active = curSrc === src && curDst === dst
                            return (
                              <span key={l} title={`src=${BLEND_FACTOR[src] ?? src} dst=${BLEND_FACTOR[dst] ?? dst}`}
                                role="button" tabIndex={0}
                                onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, srcBlendFactor: src, _srcBlendFactor: src, _N$srcBlendFactor: src, dstBlendFactor: dst, _dstBlendFactor: dst, _N$dstBlendFactor: dst } } : c); applyAndSave({ components: updated }) }}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, srcBlendFactor: src, _srcBlendFactor: src, _N$srcBlendFactor: src, dstBlendFactor: dst, _dstBlendFactor: dst, _N$dstBlendFactor: dst } } : c); applyAndSave({ components: updated }) } }}
                                style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: `1px solid ${active ? '#4ade80' : 'var(--border)'}`, borderRadius: 2, color: active ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
                              >{l}</span>
                            )
                          })}
                        </div>
                        <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2, paddingLeft: 35 }}>
                          src: <span style={{ color: '#ccc' }}>{BLEND_FACTOR[curSrc] ?? curSrc}</span>
                          {'  '}dst: <span style={{ color: '#ccc' }}>{BLEND_FACTOR[curDst] ?? curDst}</span>
                        </div>
                      </>
                    )
                  })()}
                  {/* R1827: 색조(hue) 슬라이더 — 노드 tint 색상 H 조정 */}
                  {(() => {
                    const c = draft.color ?? { r: 255, g: 255, b: 255, a: 255 }
                    const r1 = c.r/255, g1 = c.g/255, b1 = c.b/255
                    const max = Math.max(r1,g1,b1), min = Math.min(r1,g1,b1), d = max - min
                    const l = (max+min)/2
                    const s = d === 0 ? 0 : d / (1 - Math.abs(2*l - 1))
                    let h = 0
                    if (d !== 0) {
                      if (max === r1) h = ((g1-b1)/d + 6) % 6
                      else if (max === g1) h = (b1-r1)/d + 2
                      else h = (r1-g1)/d + 4
                      h = h/6*360
                    }
                    const curHue = Math.round(h)
                    const applyHue = (hDeg: number) => {
                      const hN = hDeg/360, q = l < 0.5 ? l*(1+s) : l+s-l*s, p2 = 2*l-q
                      const hue2rgb = (p3: number, q3: number, t: number) => {
                        if (t<0) t+=1; if (t>1) t-=1
                        if (t<1/6) return p3+(q3-p3)*6*t
                        if (t<1/2) return q3
                        if (t<2/3) return p3+(q3-p3)*(2/3-t)*6
                        return p3
                      }
                      const nr = Math.round(hue2rgb(p2,q,hN+1/3)*255)
                      const ng = Math.round(hue2rgb(p2,q,hN)*255)
                      const nb = Math.round(hue2rgb(p2,q,hN-1/3)*255)
                      applyAndSave({ color: { r: nr, g: ng, b: nb, a: c.a } })
                    }
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 32, whiteSpace: 'nowrap', flexShrink: 0 }}>hue</span>
                        <input type="range" min={0} max={359} step={1} value={curHue}
                          onChange={e => applyHue(parseInt(e.target.value))}
                          style={{ flex: 1,
                            background: `linear-gradient(to right,hsl(0,${s*100}%,${l*100}%),hsl(60,${s*100}%,${l*100}%),hsl(120,${s*100}%,${l*100}%),hsl(180,${s*100}%,${l*100}%),hsl(240,${s*100}%,${l*100}%),hsl(300,${s*100}%,${l*100}%),hsl(360,${s*100}%,${l*100}%))`,
                            height: 6, borderRadius: 3, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>{curHue}°</span>
                      </div>
                    )
                  })()}
                  {/* R1711/R1810: Filled 타입 — fillType/fillStart/fillRange applyAndSave 교체 */}
                  {Number(p.type ?? 0) === 3 && (
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>fillType</span>
                        <select value={Number(p.fillType ?? 0)}
                          onChange={ev => {
                            const v = parseInt(ev.target.value)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillType: v, _fillType: v, _N$fillType: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ flex: 1, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                        >
                          <option value={0}>Horizontal</option>
                          <option value={1}>Vertical</option>
                          <option value={2}>Radial</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>fillStart</span>
                        <input type="range" min={0} max={1} step={0.01} value={Number(p.fillStart ?? 0)}
                          onChange={ev => {
                            const v = parseFloat(ev.target.value)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillStart: v, _fillStart: v, _N$fillStart: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Number(p.fillStart ?? 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 56 }}>fillRange</span>
                        <input type="range" min={0} max={1} step={0.01} value={Number(p.fillRange ?? 1)}
                          onChange={ev => {
                            const v = parseFloat(ev.target.value)
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillRange: v, _fillRange: v, _N$fillRange: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          style={{ flex: 1 }} />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{Number(p.fillRange ?? 1).toFixed(2)}</span>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!(p.fillCenter ?? false)}
                          onChange={ev => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fillCenter: ev.target.checked, _fillCenter: ev.target.checked, _N$fillCenter: ev.target.checked } } : c)
                            applyAndSave({ components: updated })
                          }} />
                        fillCenter
                      </label>
                    </div>
                  )}
                  {/* R2363: packable + meshType */}
                  {/* R2400: _useGrayscale (CC3.x) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.packable ?? p._packable ?? true)}
                        onChange={e => {
                          const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, packable: e.target.checked, _packable: e.target.checked, _N$packable: e.target.checked } } : c)
                          applyAndSave({ components: updated })
                        }}
                      />packable
                    </label>
                    {is3x && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!(p._useGrayscale ?? false)}
                          onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, _useGrayscale: e.target.checked } } : c); applyAndSave({ components: u }) }}
                          style={{ margin: 0, accentColor: '#818cf8' }}
                        />grayscale
                      </label>
                    )}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>mesh:</span>
                    {([['Reg', 0], ['Poly', 1]] as const).map(([l, v]) => {
                      const cur = Number(p.meshType ?? p._meshType ?? 0)
                      return (
                        <span key={v} title={`meshType=${l}(${v})`}
                          role="button" tabIndex={0}
                          onClick={() => {
                            const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, meshType: v, _meshType: v, _N$meshType: v } } : c)
                            applyAndSave({ components: updated })
                          }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, meshType: v, _meshType: v, _N$meshType: v } } : c); applyAndSave({ components: updated }) } }}
                          style={{ fontSize: 8, padding: '0 4px', cursor: 'pointer', border: `1px solid ${cur === v ? '#4ade80' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  {/* R1890: flipX / flipY */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 32, whiteSpace: 'nowrap', flexShrink: 0 }}>flip</span>
                    {(['X', 'Y'] as const).map(axis => {
                      const key = `flip${axis}`
                      const val = !!(p[key] ?? p[`_${key}`] ?? false)
                      return (
                        <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                          <input type="checkbox" checked={val}
                            onChange={e => {
                              const v = e.target.checked
                              const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, [key]: v, [`_${key}`]: v, [`_N$${key}`]: v } } : c)
                              applyAndSave({ components: updated })
                            }}
                          />flip{axis}
                        </label>
                      )
                    })}
                  </div>
                  {/* R1918: capInsets (Sliced 타입 전용) */}
                  {(() => {
                    const sprType = Number(p.type ?? p._type ?? 0)
                    if (sprType !== 1) return null
                    const ci = p.insetTop !== undefined
                      ? { t: Number(p.insetTop ?? 0), b: Number(p.insetBottom ?? 0), l: Number(p.insetLeft ?? 0), r: Number(p.insetRight ?? 0) }
                      : (() => {
                          const raw = (p.capInsets ?? p._capInsets ?? p._N$capInsets) as Record<string,number> | undefined
                          return { t: Number(raw?.y ?? raw?.top ?? 0), b: Number(raw?.height ?? raw?.bottom ?? 0), l: Number(raw?.x ?? raw?.left ?? 0), r: Number(raw?.width ?? raw?.right ?? 0) }
                        })()
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 32, whiteSpace: 'nowrap', flexShrink: 0 }}>inset</span>
                        {(['t', 'b', 'l', 'r'] as const).map(side => (
                          <label key={side} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{side}</span>
                            <input type="number" defaultValue={ci[side]} key={`cap-${side}-${ci[side]}`} min={0} step={1}
                              onBlur={e => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0)
                                const newCi = { ...ci, [side]: v }
                                const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, insetTop: newCi.t, _insetTop: newCi.t, _N$insetTop: newCi.t, insetBottom: newCi.b, _insetBottom: newCi.b, _N$insetBottom: newCi.b, insetLeft: newCi.l, _insetLeft: newCi.l, _N$insetLeft: newCi.l, insetRight: newCi.r, _insetRight: newCi.r, _N$insetRight: newCi.r } } : c)
                                applyAndSave({ components: updated })
                              }}
                              style={{ width: 34, fontSize: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                            />
                          </label>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )
            }
            // R1588/R1811: cc.LabelOutline / cc.LabelShadow Quick Edit (applyAndSave)
            if (comp.type === 'cc.VideoPlayer') {
              const url = String(p.remoteURL ?? p._N$remoteURL ?? '')
              const loop = !!(p.loop ?? p._N$loop ?? false)
              const muted = !!(p.muted ?? p._N$muted ?? false)
              const playbackRate = Number(p.playbackRate ?? p._N$playbackRate ?? 1)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2435: enabled (BatchInspector R2196) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  {/* R2414: resourceType (BatchInspector R2046) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>resType</span>
                    {([['Local', 0], ['Remote', 1]] as const).map(([l, v]) => {
                      const cur = Number(p.resourceType ?? p._resourceType ?? p._N$resourceType ?? 0)
                      return (
                        <span key={v}
                          role="button" tabIndex={0}
                          onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resourceType: v, _resourceType: v, _N$resourceType: v } } : c); applyAndSave({ components: u }) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, resourceType: v, _resourceType: v, _N$resourceType: v } } : c); applyAndSave({ components: u }) } }}
                          style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: `1px solid ${cur === v ? '#60a5fa' : 'var(--border)'}`, borderRadius: 2, color: cur === v ? '#60a5fa' : 'var(--text-muted)', userSelect: 'none' }}
                        >{l}</span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>remoteURL</span>
                    <input type="text" defaultValue={url}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, remoteURL: e.target.value, _remoteURL: e.target.value, _N$remoteURL: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>playbackRate</span>
                    <input type="number" defaultValue={playbackRate} min={0} max={4} step={0.25}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 1
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playbackRate: v, _playbackRate: v, _N$playbackRate: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 48, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                    {/* R1806: playbackRate 퀵 프리셋 */}
                    {([0.5, 1, 1.5, 2] as const).map(v => (
                      <span key={v} title={`×${v}`}
                        role="button" tabIndex={0}
                        onClick={() => { const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playbackRate: v, _playbackRate: v, _N$playbackRate: v } } : c); applyAndSave({ components: updated }) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, playbackRate: v, _playbackRate: v, _N$playbackRate: v } } : c); applyAndSave({ components: updated }) } }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: `1px solid ${playbackRate === v ? '#a78bfa' : 'var(--border)'}`, borderRadius: 2, color: playbackRate === v ? '#a78bfa' : 'var(--text-muted)', userSelect: 'none' }}
                      >×{v}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={loop}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, loop: e.target.checked, _loop: e.target.checked, _N$loop: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={muted}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, muted: e.target.checked, _muted: e.target.checked, _N$muted: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> muted
                    </label>
                    {/* R2376: keepAspectRatio + fullScreenEnabled */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.keepAspectRatio ?? p._keepAspectRatio ?? p._N$keepAspectRatio ?? true)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, keepAspectRatio: e.target.checked, _keepAspectRatio: e.target.checked, _N$keepAspectRatio: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> ratio
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(p.fullScreenEnabled ?? p._fullScreenEnabled ?? p._N$fullScreenEnabled ?? false)}
                        onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, fullScreenEnabled: e.target.checked, _fullScreenEnabled: e.target.checked, _N$fullScreenEnabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      /> fullscr
                    </label>
                  </div>
                  {/* R2376: volume */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>volume</span>
                    <input type="range" min={0} max={1} step={0.05} defaultValue={Number(p.volume ?? p._volume ?? p._N$volume ?? 1)}
                      onMouseUp={e => { const v = parseFloat((e.target as HTMLInputElement).value); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: v, _volume: v, _N$volume: v } } : c); applyAndSave({ components: u }) }}
                      style={{ flex: 1 }}
                      title="volume (0~1)"
                    />
                    {[0, 0.5, 1].map(v => (
                      <span key={v}
                        role="button" tabIndex={0}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: v, _volume: v, _N$volume: v } } : c); applyAndSave({ components: u }) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, volume: v, _volume: v, _N$volume: v } } : c); applyAndSave({ components: u }) } }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                  {/* R2399: startTime 입력 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>startTime</span>
                    <input type="number" min={0} step={0.5} defaultValue={Number(p.startTime ?? p._startTime ?? p._N$startTime ?? 0)}
                      onBlur={e => { const v = Math.max(0, parseFloat(e.target.value) || 0); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startTime: v, _startTime: v, _N$startTime: v } } : c); applyAndSave({ components: u }) }}
                      style={{ width: 52, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                      title="startTime (초)"
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>s</span>
                    {[0, 5, 10, 30].map(v => (
                      <span key={v}
                        role="button" tabIndex={0}
                        onClick={() => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startTime: v, _startTime: v, _N$startTime: v } } : c); applyAndSave({ components: u }) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, startTime: v, _startTime: v, _N$startTime: v } } : c); applyAndSave({ components: u }) } }}
                        style={{ fontSize: 8, padding: '1px 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                      >{v}</span>
                    ))}
                  </div>
                </div>
              )
            }
            // R2341: cc.WebView url/visibleWithMouse
            if (comp.type === 'cc.WebView') {
              const url = String(p.url ?? p._url ?? p._N$url ?? '')
              const visibleWithMouse = !!(p.visibleWithMouse ?? p._N$visibleWithMouse ?? false)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2435: enabled (BatchInspector R2220) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>url</span>
                    <input type="text" defaultValue={url} key={`wv-url-${url}`} placeholder="https://..."
                      onBlur={e => {
                        const v = e.target.value.trim()
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, url: v, _url: v, _N$url: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={visibleWithMouse}
                      onChange={e => {
                        const v = e.target.checked
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, visibleWithMouse: v, _N$visibleWithMouse: v } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#58a6ff' }}
                    />visibleWithMouse
                  </label>
                </div>
              )
            }
            // R1568: cc.Camera — depth/zoomRatio Quick Edit
            if (comp.type === 'cc.TiledMap') {
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    tmxFile: <span style={{ color: '#58a6ff' }}>{typeof p.tmxFile === 'object' && p.tmxFile ? JSON.stringify(p.tmxFile).slice(0, 40) : String(p.tmxFile ?? '(없음)')}</span>
                  </div>
                </div>
              )
            }
            if (comp.type === 'cc.TiledLayer') {
              const layerName = String(p.layerName ?? '')
              const visible = !!(p.visible ?? true)
              const layerOpacity = Number(p.opacity ?? 1)
              return (
                <div style={{ padding: '2px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* R2441: enabled (BatchInspector R2222) */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(p.enabled ?? p._enabled ?? true)}
                      onChange={e => { const u = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, enabled: e.target.checked, _enabled: e.target.checked } } : c); applyAndSave({ components: u }) }}
                      style={{ margin: 0 }}
                    />enabled
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>layerName</span>
                    <input type="text" defaultValue={layerName}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, layerName: e.target.value, _layerName: e.target.value, _N$layerName: e.target.value } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ flex: 1, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 56, whiteSpace: 'nowrap', flexShrink: 0 }}>opacity</span>
                    <input type="number" defaultValue={layerOpacity} min={0} max={1} step={0.1}
                      onBlur={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, opacity: parseFloat(e.target.value) || 1, _opacity: parseFloat(e.target.value) || 1, _N$opacity: parseFloat(e.target.value) || 1 } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={visible}
                      onChange={e => {
                        const updated = draft.components.map(c => c === comp ? { ...c, props: { ...c.props, visible: e.target.checked, _visible: e.target.checked, _N$visible: e.target.checked } } : c)
                        applyAndSave({ components: updated })
                      }}
                      style={{ margin: 0, accentColor: '#4ade80' }}
                    />visible
                  </label>
                </div>
              )
            }
            // R1591/R1813: cc.BoxCollider/BoxCollider2D + cc.CircleCollider/CircleCollider2D Quick Edit (applyAndSave)
            return null
}
