import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function GraphicsSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R2221: 공통 cc.DirectionalLight/PointLight enabled (컴포넌트 레벨) 일괄 설정 (CC3.x) */}
      {(commonCompTypes.includes('cc.DirectionalLight') || commonCompTypes.includes('cc.PointLight')) && (() => {
        const applyLightEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.DirectionalLight' || c.type === 'cc.PointLight'),
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Light enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fde68a', width: 48, flexShrink: 0 }}>LightEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLightEnabled(v)} title={`Light enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2142: 공통 cc.DirectionalLight/cc.PointLight intensity 일괄 설정 */}
      {(commonCompTypes.includes('cc.DirectionalLight') || commonCompTypes.includes('cc.PointLight')) && (() => {
        const lightType = commonCompTypes.includes('cc.DirectionalLight') ? 'cc.DirectionalLight' : 'cc.PointLight'
        const applyLightIntensity = async (intensity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.DirectionalLight' || c.type === 'cc.PointLight'),
            c => ({ ...c, props: { ...c.props, intensity, _intensity: intensity } }),
            `${lightType} intensity=${intensity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>LightInt</span>
            {[0, 0.5, 1, 2, 3, 5].map(v => (
              <span key={v} onClick={() => applyLightIntensity(v)} title={`intensity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fbbf24', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2143: 공통 cc.DirectionalLight/cc.PointLight color 일괄 설정 */}
      {(commonCompTypes.includes('cc.DirectionalLight') || commonCompTypes.includes('cc.PointLight')) && (() => {
        const applyLightColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const color = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.DirectionalLight' || c.type === 'cc.PointLight'),
            c => ({ ...c, props: { ...c.props, color, _color: color } }),
            `Light color=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>LightCol</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyLightColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ffffff','#ffe4b5','#ffd700','#add8e6','#ffb6c1'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLightColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2144: 공통 cc.Graphics lineWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsLineWidth = async (lineWidth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, lineWidth, _lineWidth: lineWidth } }),
            `Graphics lineWidth=${lineWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxLnW</span>
            {[1, 2, 3, 5, 8, 10].map(v => (
              <span key={v} onClick={() => applyGraphicsLineWidth(v)} title={`lineWidth=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2145: 공통 cc.Graphics fillColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsFillColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const fillColor = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, fillColor, _fillColor: fillColor } }),
            `Graphics fillColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxFill</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyGraphicsFillColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ffffff','#000000','#ff0000','#00ff00','#0000ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyGraphicsFillColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2146: 공통 cc.Graphics strokeColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsStrokeColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const strokeColor = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, strokeColor, _strokeColor: strokeColor } }),
            `Graphics strokeColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxStrk</span>
            <input type="color" defaultValue="#000000"
              onChange={e => applyGraphicsStrokeColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#000000','#ffffff','#ff0000','#00ff00','#0000ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyGraphicsStrokeColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2171: 공통 cc.Graphics lineJoin 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsLineJoin = async (lineJoin: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, lineJoin, _lineJoin: lineJoin } }),
            `Graphics lineJoin=${['miter','round','bevel'][lineJoin] ?? lineJoin} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxJoin</span>
            {([['Miter', 0], ['Round', 1], ['Bevel', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyGraphicsLineJoin(v)} title={`lineJoin=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2172: 공통 cc.Graphics lineCap 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsLineCap = async (lineCap: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, lineCap, _lineCap: lineCap } }),
            `Graphics lineCap=${['butt','round','square'][lineCap] ?? lineCap} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxCap</span>
            {([['Butt', 0], ['Round', 1], ['Square', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyGraphicsLineCap(v)} title={`lineCap=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2175: 공통 cc.Graphics miterLimit 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsMiterLimit = async (miterLimit: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, miterLimit, _miterLimit: miterLimit } }),
            `Graphics miterLimit=${miterLimit} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxMitr</span>
            {[1, 2, 5, 10, 20, 50].map(v => (
              <span key={v} onClick={() => applyGraphicsMiterLimit(v)} title={`miterLimit=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2194: 공통 cc.Graphics enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGraphicsEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Graphics enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyGraphicsEnabled(v)} title={`Graphics enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2179: 공통 cc.Graphics fillOpacity + strokeOpacity 일괄 설정 */}
      {commonCompTypes.includes('cc.Graphics') && (() => {
        const applyGfxFillOpacity = async (fillOpacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, fillOpacity, _fillOpacity: fillOpacity } }),
            `Graphics fillOpacity=${fillOpacity} (${uuids.length}개)`,
          )
        }
        const applyGfxStrokeOpacity = async (strokeOpacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Graphics',
            c => ({ ...c, props: { ...c.props, strokeOpacity, _strokeOpacity: strokeOpacity } }),
            `Graphics strokeOpacity=${strokeOpacity} (${uuids.length}개)`,
          )
        }
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxFill%</span>
              {[0, 64, 128, 192, 255].map(v => (
                <span key={v} onClick={() => applyGfxFillOpacity(v)} title={`fillOpacity=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>GfxStrk%</span>
              {[0, 64, 128, 192, 255].map(v => (
                <span key={v} onClick={() => applyGfxStrokeOpacity(v)} title={`strokeOpacity=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
          </>
        )
      })()}
    </>
  )
}
