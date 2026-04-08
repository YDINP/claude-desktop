import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function TilemapCanvasSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R2222: 공통 cc.TiledLayer enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.TiledLayer') && (() => {
        const applyTiledLayerEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.TiledLayer',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `TiledLayer enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#6ee7b7', width: 48, flexShrink: 0 }}>TileEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyTiledLayerEnabled(v)} title={`TiledLayer enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2150: 공통 cc.TiledLayer opacity 일괄 설정 */}
      {commonCompTypes.includes('cc.TiledLayer') && (() => {
        const applyTiledLayerOpacity = async (opacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.TiledLayer',
            c => ({ ...c, props: { ...c.props, opacity, _opacity: opacity, _N$opacity: opacity } }),
            `TiledLayer opacity=${opacity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>TLOpacity</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <span key={v} onClick={() => applyTiledLayerOpacity(v)} title={`opacity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2151: 공통 cc.TiledLayer visible 일괄 설정 */}
      {commonCompTypes.includes('cc.TiledLayer') && (() => {
        const applyTiledLayerVisible = async (visible: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.TiledLayer',
            c => ({ ...c, props: { ...c.props, visible, _visible: visible, _N$visible: visible } }),
            `TiledLayer visible=${visible} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>TLVisible</span>
            <span onClick={() => applyTiledLayerVisible(true)} title="visible ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>show✓</span>
            <span onClick={() => applyTiledLayerVisible(false)} title="visible OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>hide✗</span>
          </div>
        )
      })()}
      {/* R2207: 공통 cc.BlockInputEvents enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.BlockInputEvents') && (() => {
        const applyBIEEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.BlockInputEvents',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `BlockInputEvents enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>BIEComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyBIEEnabled(v)} title={`BlockInputEvents enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2207: 공통 cc.Canvas enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Canvas enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CvsComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyCanvasEnabled(v)} title={`Canvas enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2152: 공통 cc.Canvas fitWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasFitWidth = async (fitWidth: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => ({ ...c, props: { ...c.props, fitWidth, _fitWidth: fitWidth, _N$fitWidth: fitWidth } }),
            `Canvas fitWidth=${fitWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CVFitW</span>
            <span onClick={() => applyCanvasFitWidth(true)} title="fitWidth ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>fitW✓</span>
            <span onClick={() => applyCanvasFitWidth(false)} title="fitWidth OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>fitW✗</span>
          </div>
        )
      })()}
      {/* R2187: 공통 cc.Canvas resizeWithBrowserSize 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasResizeWithBrowser = async (resizeWithBrowserSize: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => ({ ...c, props: { ...c.props, resizeWithBrowserSize, _resizeWithBrowserSize: resizeWithBrowserSize, _N$resizeWithBrowserSize: resizeWithBrowserSize } }),
            `Canvas resizeWithBrowserSize=${resizeWithBrowserSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CanvRes</span>
            {([['rsz✓', true], ['rsz✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyCanvasResizeWithBrowser(v)} title={`resizeWithBrowserSize=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2153: 공통 cc.Canvas fitHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasFitHeight = async (fitHeight: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => ({ ...c, props: { ...c.props, fitHeight, _fitHeight: fitHeight, _N$fitHeight: fitHeight } }),
            `Canvas fitHeight=${fitHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CVFitH</span>
            <span onClick={() => applyCanvasFitHeight(true)} title="fitHeight ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>fitH✓</span>
            <span onClick={() => applyCanvasFitHeight(false)} title="fitHeight OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>fitH✗</span>
          </div>
        )
      })()}
      {/* R2154: 공통 cc.Canvas resolutionPolicy 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasResPolicy = async (resolutionPolicy: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => ({ ...c, props: { ...c.props, resolutionPolicy, _resolutionPolicy: resolutionPolicy, _N$resolutionPolicy: resolutionPolicy } }),
            `Canvas Res Policy`,
          )
          const labels = ['SHOW_ALL', 'NO_BORDER', 'EXACT_FIT', 'FIX_H', 'FIX_W']
          setBatchMsg(`✓ Canvas policy=${labels[resolutionPolicy] ?? resolutionPolicy} (${uuids.length}개)`) // R2255: _resolutionPolicy CC3.x
        }
        const opts: [string, number][] = [['SHOW_ALL', 0], ['NO_BORDER', 1], ['EXACT_FIT', 2], ['FIX_H', 3], ['FIX_W', 4]]
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CVPolicy</span>
            {opts.map(([l, v]) => (
              <span key={v} onClick={() => applyCanvasResPolicy(v)} title={`resolutionPolicy=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l.replace('_', '')}</span>
            ))}
          </div>
        )
      })()}
      {/* R2155: 공통 cc.Canvas designResolution 일괄 설정 */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const [drW, setDrW] = React.useState(960)
        const [drH, setDrH] = React.useState(640)
        const applyCanvasDesignRes = async (w: number, h: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const dr = { width: w, height: h }
            const components = n.components.map(c => c.type === 'cc.Canvas' ? { ...c, props: { ...c.props, _N$designResolution: dr, _designResolution: dr } } : c)
            return { ...n, components }
          }, `Canvas designRes=${w}×${h} (${uuids.length}개)`)
        }
        const presets: [string, number, number][] = [['960×640', 960, 640], ['1280×720', 1280, 720], ['1920×1080', 1920, 1080], ['375×667', 375, 667]]
        return (
          <div style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CVRes</span>
              <input type="number" value={drW} min={1} onChange={e => setDrW(parseInt(e.target.value) || 960)}
                style={{ width: 50, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>×</span>
              <input type="number" value={drH} min={1} onChange={e => setDrH(parseInt(e.target.value) || 640)}
                style={{ width: 50, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }} />
              <span onClick={() => applyCanvasDesignRes(drW, drH)} title={`designResolution=${drW}×${drH}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid #60a5fa', color: '#60a5fa', userSelect: 'none' }}>✓</span>
            </div>
            <div style={{ display: 'flex', gap: 3, paddingLeft: 52 }}>
              {presets.map(([l, w, h]) => (
                <span key={l} onClick={() => { setDrW(w); setDrH(h); applyCanvasDesignRes(w, h) }} title={`${w}×${h}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
              ))}
            </div>
          </div>
        )
      })()}
      {/* R1836: 공통 cc.SkeletalAnimation speedRatio 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkeletalSpeed = async (speedRatio: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => ({ ...c, props: { ...c.props, speedRatio, _speedRatio: speedRatio } }),
            `SkeletalAnim ×${speedRatio} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SkelAnim</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`speedRatio = ×${v}`}
                onClick={() => applySkeletalSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >×{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1885: 공통 cc.SkeletalAnimation playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkelPlayOnLoad = async (playOnLoad: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => ({ ...c, props: { ...c.props, playOnLoad, _playOnLoad: playOnLoad } }),
            `SkeletalAnim playOnLoad=${playOnLoad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SkelPOL</span>
            <span onClick={() => applySkelPlayOnLoad(true)} title="playOnLoad ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>play✓</span>
            <span onClick={() => applySkelPlayOnLoad(false)} title="playOnLoad OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>play✗</span>
          </div>
        )
      })()}
      {/* R2056: 공통 cc.SkeletalAnimation speed 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkelSpeed = async (speed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => ({ ...c, props: { ...c.props, speed, _speed: speed, _N$speed: speed } }),
            `SkeletalAnim speed=${speed}x (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SkelSpd</span>
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map(v => (
              <span key={v} onClick={() => applySkelSpeed(v)} title={`speed=${v}x`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R2045: 공통 cc.SkeletalAnimation wrapMode 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkelWrapMode = async (wrapMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => ({ ...c, props: { ...c.props, wrapMode, _wrapMode: wrapMode, _N$wrapMode: wrapMode } }),
            `Skel Wrap Mode`,
          )
          const names: Record<number,string> = {1:'Dflt',2:'Norm',3:'Loop',4:'PingPong',8:'Rev'}
          setBatchMsg(`✓ Skel wrapMode=${names[wrapMode]??wrapMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SkelWM</span>
            {([['Dflt',1],['Norm',2],['Loop',3],['Ping',4],['Rev',8]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applySkelWrapMode(v)} title={`wrapMode=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2012: 공통 cc.SkeletalAnimation loop 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkeletalLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => ({ ...c, props: { ...c.props, loop, _loop: loop } }),
            `SkeletalAnim loop=${loop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SkelLoop</span>
            <span onClick={() => applySkeletalLoop(true)} title="loop ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>loop✓</span>
            <span onClick={() => applySkeletalLoop(false)} title="loop OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>loop✗</span>
          </div>
        )
      })()}
      {/* R2221: 공통 cc.SkeletalAnimation enabled (컴포넌트 레벨) 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkeletalAnimEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `SkeletalAnimation enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>SkelEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySkeletalAnimEnabled(v)} title={`SkeletalAnimation enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2133: 공통 cc.SkeletalAnimation defaultCachingMode 일괄 설정 */}
      {commonCompTypes.includes('cc.SkeletalAnimation') && (() => {
        const applySkeletalCaching = async (defaultCachingMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.SkeletalAnimation',
            c => ({ ...c, props: { ...c.props, defaultCachingMode, _defaultCachingMode: defaultCachingMode } }),
            `SkeletalAnimation cachingMode=${defaultCachingMode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SkelCach</span>
            {([['Rltime',0],['Shared',1],['Private',2]] as [string,number][]).map(([l,v]) => (
              <span key={v} onClick={() => applySkeletalCaching(v)} title={`defaultCachingMode=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2195: 공통 cc.Slider enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Slider enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>SLDComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySliderEnabled(v)} title={`Slider enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1835: 공통 cc.Slider progress 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderProg = async (progress: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, progress, _progress: progress, _N$progress: progress } }),
            `Slider progress ${Math.round(progress * 100)}% (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>Slider</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`progress = ${Math.round(v * 100)}%`}
                onClick={() => applySliderProg(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1869: 공통 cc.Slider direction 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderDir = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } }),
            `Slider direction=${direction === 0 ? 'H' : 'V'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SliderDir</span>
            <span onClick={() => applySliderDir(0)} title="direction = Horizontal" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>H→</span>
            <span onClick={() => applySliderDir(1)} title="direction = Vertical" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>V↓</span>
          </div>
        )
      })()}
      {/* R1904: 공통 cc.Slider interactable 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderInteract = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, interactable, _interactable: interactable, _N$interactable: interactable } }),
            `Slider Interact`,
          ) // R2257: _interactable CC3.x
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SldrInter</span>
            <span onClick={() => applySliderInteract(true)} title="interactable ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>inter✓</span>
            <span onClick={() => applySliderInteract(false)} title="interactable OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>inter✗</span>
          </div>
        )
      })()}
      {/* R2042: 공통 cc.Slider value 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderVal = async (progress: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, progress, _progress: progress, _N$progress: progress } }),
            `Slider value=${progress} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SldrVal</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <span key={v} onClick={() => applySliderVal(v)} title={`progress=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1944: 공통 cc.Slider min/max 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderRange = async (min: number, max: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, minValue: min, maxValue: max, _minValue: min, _maxValue: max, _N$minValue: min, _N$maxValue: max } }),
            `Slider [${min}~${max}] (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SLrange</span>
            {([[0,1],[0,10],[0,100],[-1,1]] as const).map(([mn,mx]) => (
              <span key={`${mn}-${mx}`} title={`min=${mn} max=${mx}`}
                onClick={() => applySliderRange(mn, mx)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{mn}~{mx}</span>
            ))}
          </div>
        )
      })()}
      {/* R1960: 공통 cc.Slider step 일괄 설정 */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderStep = async (step: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, step, _step: step, _N$step: step } }),
            `Slider step=${step} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SLstep</span>
            {([0, 0.01, 0.05, 0.1, 0.5, 1] as const).map(v => (
              <span key={v} title={`step = ${v}`}
                onClick={() => applySliderStep(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
