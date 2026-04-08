import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function RichTextSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R2223: 공통 cc.RichText lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRTLineHeight = async (lineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, lineHeight, _lineHeight: lineHeight, _N$lineHeight: lineHeight } }),
            `RichText lineHeight=${lineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>RTLineH</span>
            {[20, 24, 28, 32, 36, 40, 48].map(v => (
              <span key={v} onClick={() => applyRTLineHeight(v)} title={`lineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1888: 공통 cc.RichText maxWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichMaxW = async (w: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, maxWidth: w, _maxWidth: w, _N$maxWidth: w } }),
            `Rich Max W`,
          ) // R2252: _maxWidth CC3.x
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Rich maxW</span>
            {([0, 100, 200, 300, 400, 600] as const).map(v => (
              <span key={v} title={v === 0 ? 'maxWidth=0 (무제한)' : `maxWidth=${v}`}
                onClick={() => applyRichMaxW(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v === 0 ? '∞' : v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1903: 공통 cc.RichText fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichFS = async (fontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, fontSize, _fontSize: fontSize, _N$fontSize: fontSize } }),
            `Rich F S`,
          ) // R2252: _fontSize CC3.x
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Rich fs</span>
            {([16, 20, 24, 28, 32, 40] as const).map(v => (
              <span key={v} title={`fontSize = ${v}`}
                onClick={() => applyRichFS(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1929: 공통 cc.RichText horizontalAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichAlign = async (horizontalAlign: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, horizontalAlign, _horizontalAlign: horizontalAlign, _N$horizontalAlign: horizontalAlign } }),
            `Rich Align`,
          )
          const names = ['L', 'C', 'R']
          setBatchMsg(`✓ RichText align=${names[horizontalAlign] ?? horizontalAlign} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>RichAlgn</span>
            {([['L',0],['C',1],['R',2]] as [string,number][]).map(([l,v]) => (
              <span key={v} title={`horizontalAlign = ${l}`}
                onClick={() => applyRichAlign(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1956: 공통 cc.RichText fontColor 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichFontColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, fontColor: col, _fontColor: col, _N$fontColor: col } }),
            `RichText fontColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>RTcolor</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyRichFontColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#000000','#ff4444','#ffff44'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyRichFontColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2192: 공통 cc.RichText enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichTextEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `RichText enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>RTComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyRichTextEnabled(v)} title={`RichText enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2182: 공통 cc.RichText imageLineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichImgLineH = async (imageLineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, imageLineHeight, _imageLineHeight: imageLineHeight, _N$imageLineHeight: imageLineHeight } }),
            `RichText imageLineHeight=${imageLineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>RTImgLH</span>
            {[20, 24, 28, 32, 40, 48].map(v => (
              <span key={v} onClick={() => applyRichImgLineH(v)} title={`imageLineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1942: 공통 cc.RichText lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichLineH = async (lineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, lineHeight, _lineHeight: lineHeight, _N$lineHeight: lineHeight } }),
            `RichText lineH=${lineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>RTlineH</span>
            {([20, 24, 28, 32, 40] as const).map(v => (
              <span key={v} title={`lineHeight = ${v}`}
                onClick={() => applyRichLineH(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2010: 공통 cc.RichText verticalAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichVAlign = async (verticalAlign: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, verticalAlign, _verticalAlign: verticalAlign, _N$verticalAlign: verticalAlign } }),
            `Rich V Align`,
          )
          const names = ['Top', 'Ctr', 'Bot']
          setBatchMsg(`✓ RichText vAlign=${names[verticalAlign] ?? verticalAlign} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>RTvAlign</span>
            {([['Top', 0], ['Ctr', 1], ['Bot', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyRichVAlign(v)} title={`verticalAlign=${l}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2066: 공통 cc.RichText fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichFontSize = async (fontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, fontSize, _fontSize: fontSize, _N$fontSize: fontSize } }),
            `RichText fontSize=${fontSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>RichFS</span>
            {[12, 16, 20, 24, 32, 40].map(v => (
              <span key={v} title={`fontSize = ${v}`}
                onClick={() => applyRichFontSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2141: 공통 cc.RichText overflow 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichOverflow = async (overflow: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, overflow, _overflow: overflow, _N$overflow: overflow } }),
            `RichText overflow=${overflow} (${uuids.length}개)`,
          )
        }
        const labels = ['None', 'Clamp', 'Shrink', 'Resize']
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>RichOvfl</span>
            {[0, 1, 2, 3].map(v => (
              <span key={v} onClick={() => applyRichOverflow(v)} title={`overflow=${labels[v]}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{labels[v]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2035: 공통 cc.RichText lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichLineH = async (lineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, lineHeight, _lineHeight: lineHeight, _N$lineHeight: lineHeight } }),
            `RichText lineHeight=${lineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>RichLH</span>
            {[0, 20, 30, 40, 60, 80].map(v => (
              <span key={v} onClick={() => applyRichLineH(v)} title={`lineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2164: 공통 cc.RichText handleTouchEvent 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichTouch = async (handleTouchEvent: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, handleTouchEvent, _handleTouchEvent: handleTouchEvent } }),
            `RichText handleTouchEvent=${handleTouchEvent} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>RTtouch</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`handleTouchEvent = ${v}`}
                onClick={() => applyRichTouch(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}
              >{v ? 'touch✓' : 'touch✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1982: 공통 cc.RichText maxWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRichMaxWidth = async (maxWidth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, maxWidth, _maxWidth: maxWidth, _N$maxWidth: maxWidth } }),
            `RichText maxWidth=${maxWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>RTmaxW</span>
            {[0, 200, 400, 600, 800].map(v => (
              <span key={v} onClick={() => applyRichMaxWidth(v)} title={`maxWidth=${v} (0=无限)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v || '∞'}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
