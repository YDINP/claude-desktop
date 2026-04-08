import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function AudioCameraSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R2223: 공통 cc.AudioSource _pitch 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioPitch = async (pitch: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, pitch, _pitch: pitch } }),
            `AudioSource pitch=${pitch} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASPitch</span>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(v => (
              <span key={v} onClick={() => applyAudioPitch(v)} title={`_pitch=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2108: 공통 cc.AudioSource loop 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, loop, _loop: loop } }),
            `AudioSource loop=${loop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>AudLoop</span>
            <span onClick={() => applyAudioLoop(true)} title="loop ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>loop✓</span>
            <span onClick={() => applyAudioLoop(false)} title="loop OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>loop✗</span>
          </div>
        )
      })()}
      {/* R2109: 공통 cc.AudioSource playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioPlayOnLoad = async (playOnLoad: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, playOnLoad, _playOnLoad: playOnLoad } }),
            `AudioSource playOnLoad=${playOnLoad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>AudPOL</span>
            <span onClick={() => applyAudioPlayOnLoad(true)} title="playOnLoad ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>pol✓</span>
            <span onClick={() => applyAudioPlayOnLoad(false)} title="playOnLoad OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>pol✗</span>
          </div>
        )
      })()}
      {/* R1828: 공통 cc.AudioSource volume 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioVol = async (volume: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, volume, _volume: volume, _N$volume: volume } }),
            `AudioSource volume ${Math.round(volume * 100)}% (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>Audio</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`volume = ${Math.round(v * 100)}%`}
                onClick={() => applyAudioVol(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1866: 공통 cc.AudioSource pitch 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioPitch = async (pitch: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, pitch, _pitch: pitch } }),
            `AudioSource pitch ${pitch} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>Pitch</span>
            {([0.5, 0.75, 1, 1.25, 1.5, 2] as const).map(v => (
              <span key={v} title={`pitch = ${v}`}
                onClick={() => applyAudioPitch(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1911: 공통 cc.AudioSource preload 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioPreload = async (preload: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, preload, _preload: preload, _N$preload: preload } }),
            `AudioSource preload ${preload} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>AUpre</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`preload = ${v}`}
                onClick={() => applyAudioPreload(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{v ? 'pre✓' : 'pre✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1971: 공통 cc.AudioSource startTime 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioStart = async (startTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, startTime, _startTime: startTime, _N$startTime: startTime } }),
            `AudioSource startTime=${startTime}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASstart</span>
            {([0, 0.5, 1, 2, 5] as const).map(v => (
              <span key={v} title={`startTime = ${v}s`}
                onClick={() => applyAudioStart(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2164: 공통 cc.AudioSource endTime 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioEnd = async (endTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, endTime, _endTime: endTime, _N$endTime: endTime } }),
            `AudioSource endTime=${endTime < 0 ? '∞' : endTime + 's'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASend</span>
            {([-1, 0, 1, 2, 5, 10] as const).map(v => (
              <span key={v} title={`endTime = ${v < 0 ? '∞(no limit)' : v + 's'}`}
                onClick={() => applyAudioEnd(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}
              >{v < 0 ? '∞' : v + 's'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2199: 공통 cc.Camera enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCameraEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Camera enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>CamComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyCameraEnabled(v)} title={`Camera enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1912: 공통 cc.Camera depth 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamDepth = async (depth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, depth, _depth: depth } }),
            `Camera depth ${depth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>CamDepth</span>
            {([-2, -1, 0, 1, 2] as const).map(v => (
              <span key={v} title={`Camera depth = ${v}`}
                onClick={() => applyCamDepth(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1920: 공통 cc.Camera backgroundColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamBg = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, backgroundColor: col, _backgroundColor: col, _N$backgroundColor: col } }),
            `Camera bgColor ${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>CamBg</span>
            <input type="color" defaultValue="#000000"
              onChange={e => applyCamBg(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#000000','#ffffff','#ff0000','#0000ff'] as const).map(c => (
              <span key={c} title={c}
                onClick={() => applyCamBg(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer', border: '1px solid var(--border)', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1921: 공통 cc.Camera clearFlags 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamFlags = async (clearFlags: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, clearFlags, _clearFlags: clearFlags } }),
            `Camera clearFlags ${clearFlags} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>CamFlag</span>
            {([['None',0],['Depth',2],['C+D',7],['All',15]] as [string,number][]).map(([l,v]) => (
              <span key={v} title={`clearFlags = ${v}`}
                onClick={() => applyCamFlags(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1941: 공통 cc.Camera zoomRatio 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamZoom = async (zoomRatio: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, zoomRatio, _zoomRatio: zoomRatio } }),
            `Camera zoom=${zoomRatio} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#818cf8', width: 48, flexShrink: 0 }}>CamZoom</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`zoomRatio = ${v}`}
                onClick={() => applyCamZoom(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#818cf8', userSelect: 'none' }}
              >{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R1952: 공통 cc.Camera fov 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamFov = async (fov: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, fov, _fov: fov } }),
            `Camera fov=${fov}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#818cf8', width: 48, flexShrink: 0 }}>CamFov</span>
            {([45, 60, 75, 90, 120] as const).map(v => (
              <span key={v} title={`fov = ${v}°`}
                onClick={() => applyCamFov(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#818cf8', userSelect: 'none' }}
              >{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2187: 공통 cc.Camera clearDepth 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamClearDepth = async (clearDepth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, clearDepth, _clearDepth: clearDepth } }),
            `Camera clearDepth=${clearDepth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamDepth</span>
            {[0, 0.5, 1].map(v => (
              <span key={v} onClick={() => applyCamClearDepth(v)} title={`clearDepth=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2178: 공통 cc.Camera orthoHeight 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamOrthoHeight = async (orthoHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, orthoHeight, _orthoHeight: orthoHeight } }),
            `Camera orthoHeight=${orthoHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamOrtH</span>
            {[100, 200, 360, 480, 540, 720].map(v => (
              <span key={v} onClick={() => applyCamOrthoHeight(v)} title={`orthoHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2058: 공통 cc.Camera orthographic 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamOrtho = async (ortho: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, ortho, _ortho: ortho } }),
            `Camera ortho=${ortho} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamOrtho</span>
            {([['ort✓',true],['ort✗',false]] as [string,boolean][]).map(([label,v]) => (
              <span key={label} onClick={() => applyCamOrtho(v)} title={`orthographic=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R1989: 공통 cc.Camera cullingMask 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamCulling = async (cullingMask: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, cullingMask, _cullingMask: cullingMask } }),
            `Cam Culling`,
          )
          const labels: Record<number, string> = { [-1 >>> 0]: 'All', 0: 'None', 1: 'Dflt' }
          setBatchMsg(`✓ Camera cullingMask=${labels[cullingMask >>> 0] ?? cullingMask} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#818cf8', width: 48, flexShrink: 0 }}>CamCull</span>
            <span onClick={() => applyCamCulling(-1)} title="cullingMask=ALL(-1)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#818cf8', userSelect: 'none' }}>All</span>
            <span onClick={() => applyCamCulling(0)} title="cullingMask=NONE(0)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>None</span>
            <span onClick={() => applyCamCulling(1)} title="cullingMask=DEFAULT(1)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#818cf8', userSelect: 'none' }}>Dflt</span>
          </div>
        )
      })()}
      {/* R2114: 공통 cc.Camera targetDisplay 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamTargetDisplay = async (targetDisplay: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, targetDisplay, _targetDisplay: targetDisplay } }),
            `Camera targetDisplay=${targetDisplay} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>CamDisp</span>
            {[0, 1, 2, 3].map(v => (
              <span key={v} onClick={() => applyCamTargetDisplay(v)} title={`targetDisplay=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2167: 공통 cc.Camera near 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamNear = async (near: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, near, _near: near } }),
            `Camera near=${near} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamNear</span>
            {[0.001, 0.01, 0.1, 1].map(v => (
              <span key={v} onClick={() => applyCamNear(v)} title={`near=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2167: 공통 cc.Camera far 일괄 설정 */}
      {commonCompTypes.includes('cc.Camera') && (() => {
        const applyCamFar = async (far: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Camera',
            c => ({ ...c, props: { ...c.props, far, _far: far } }),
            `Camera far=${far} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>CamFar</span>
            {[100, 500, 1000, 2000, 10000].map(v => (
              <span key={v} onClick={() => applyCamFar(v)} title={`far=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
