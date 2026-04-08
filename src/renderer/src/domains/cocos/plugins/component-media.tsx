import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function MediaSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R1795: 공통 cc.AudioSource loop/playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>Audio</span>
          {([
            { label: '✓ loop', key: 'loop', val: true },
            { label: '✕ loop', key: 'loop', val: false },
            { label: '▶ auto', key: 'playOnLoad', val: true },
            { label: '○ auto', key: 'playOnLoad', val: false },
          ] as const).map(({ label, key, val }) => (
            <span key={`${key}${val}`}
              title={`${key} = ${val} (모든 선택 노드)`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.AudioSource',
                  c => ({ ...c, props: { ...c.props, [key]: val, [`_${key}`]: val, [`_N$${key}`]: val } }),
                  `${key} ${val} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: val ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R1816: 공통 cc.Animation playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>Anim</span>
          {([
            { label: '▶ auto', key: 'playOnLoad', val: true },
            { label: '○ auto', key: 'playOnLoad', val: false },
          ] as const).map(({ label, key, val }) => (
            <span key={`${key}${val}`}
              title={`${key} = ${val}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Animation',
                  c => ({ ...c, props: { ...c.props, [key]: val, [`_${key}`]: val, [`_N$${key}`]: val } }),
                  `Animation ${key} ${val} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: val ? '#fbbf24' : 'var(--text-muted)', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R2191: 공통 cc.Animation enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Animation enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>AnimComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyAnimEnabled(v)} title={`Animation enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2186: 공통 cc.Animation sample 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimSample = async (sample: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => ({ ...c, props: { ...c.props, sample, _sample: sample, _N$sample: sample } }),
            `Animation sample=${sample} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>AnimSmp</span>
            {[24, 30, 48, 60, 120].map(v => (
              <span key={v} onClick={() => applyAnimSample(v)} title={`sample=${v}fps`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2052: 공통 cc.Animation speed 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimSpeed = async (speed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => ({ ...c, props: { ...c.props, speed, _speed: speed, _N$speed: speed } }),
            `Animation speed=${speed}x (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>AnimSpd</span>
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map(v => (
              <span key={v} onClick={() => applyAnimSpeed(v)} title={`speed=${v}x`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R1984: 공통 cc.Animation wrapMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimWrapMode = async (wrapMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => ({ ...c, props: { ...c.props, defaultClipSettings: { ...(c.props.defaultClipSettings as object ?? {}), wrapMode } } }),
            `Anim Wrap Mode`,
          )
          const names: Record<number, string> = { 0: 'Default', 1: 'Normal', 2: 'Loop', 3: 'PingPong', 4: 'Reverse', 5: 'LoopRev' }
          setBatchMsg(`✓ Anim wrapMode=${names[wrapMode] ?? wrapMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>AnimWrap</span>
            {([['Dflt', 0], ['Norm', 1], ['Loop', 2], ['Ping', 3]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyAnimWrapMode(v)} title={`wrapMode=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fbbf24', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2220: 공통 cc.WebView enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.WebView') && (() => {
        const applyWebViewEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.WebView',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `WebView enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>WVEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyWebViewEnabled(v)} title={`WebView enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2196: 공통 cc.VideoPlayer enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `VideoPlayer enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VPComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyVideoEnabled(v)} title={`VideoPlayer enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1842: 공통 cc.VideoPlayer loop/muted 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoToggle = async (key: 'loop' | 'muted', value: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, [key]: value, [`_${key}`]: value, [`_N$${key}`]: value } }),
            `VideoPlayer ${key}=${value} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>Video</span>
            <span onClick={() => applyVideoToggle('loop', true)} title="loop ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>loop✓</span>
            <span onClick={() => applyVideoToggle('loop', false)} title="loop OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>loop✗</span>
            <span onClick={() => applyVideoToggle('muted', true)} title="muted ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>mute✓</span>
            <span onClick={() => applyVideoToggle('muted', false)} title="muted OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>mute✗</span>
          </div>
        )
      })()}
      {/* R1877: 공통 cc.VideoPlayer playbackRate 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoPBRate = async (rate: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, playbackRate: rate, _playbackRate: rate, _N$playbackRate: rate } }),
            `VideoPlayer ×${rate} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VideoPB</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`playbackRate = ${v}`}
                onClick={() => applyVideoPBRate(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >×{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2005: 공통 cc.VideoPlayer fullScreenEnabled 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoFullscreen = async (fullScreenEnabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, fullScreenEnabled, _fullScreenEnabled: fullScreenEnabled, _N$fullScreenEnabled: fullScreenEnabled } }),
            `VideoPlayer fullscreen=${fullScreenEnabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VideoFS</span>
            <span onClick={() => applyVideoFullscreen(true)} title="fullScreenEnabled ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>fs✓</span>
            <span onClick={() => applyVideoFullscreen(false)} title="fullScreenEnabled OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>fs✗</span>
          </div>
        )
      })()}
      {/* R2075: 공통 cc.VideoPlayer volume 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoVol = async (volume: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, volume, _volume: volume, _N$volume: volume } }),
            `VideoPlayer volume=${volume} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VPvol</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <span key={v} title={`volume = ${v}`}
                onClick={() => applyVideoVol(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R2224: 공통 cc.VideoPlayer keepAspectRatio 토글 (CC3.x) */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoKeepAspect = async (keepAspectRatio: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, keepAspectRatio, _keepAspectRatio: keepAspectRatio } }),
            `VideoPlayer keepAspectRatio=${keepAspectRatio} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>VPAsp</span>
            {([['비율✓', true], ['비율✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyVideoKeepAspect(v)} title={`keepAspectRatio=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2103: 공통 cc.VideoPlayer muted 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoMuted = async (muted: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, muted, _muted: muted } }),
            `VideoPlayer muted=${muted} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VidMute</span>
            <span onClick={() => applyVideoMuted(true)} title="muted ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>mute✓</span>
            <span onClick={() => applyVideoMuted(false)} title="muted OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>mute✗</span>
          </div>
        )
      })()}
      {/* R2046: 공통 cc.VideoPlayer resourceType 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoResType = async (resourceType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, resourceType, _resourceType: resourceType, _N$resourceType: resourceType } }),
            `Video Res Type`,
          )
          const names = ['Local','Remote']
          setBatchMsg(`✓ VideoPlayer resourceType=${names[resourceType]??resourceType} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>VidResT</span>
            {([['Local',0],['Remote',1]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyVideoResType(v)} title={`resourceType=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2000: 공통 cc.VideoPlayer keepAspectRatio 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoKeepAspect = async (keepAspectRatio: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, keepAspectRatio, _keepAspectRatio: keepAspectRatio, _N$keepAspectRatio: keepAspectRatio } }),
            `VideoPlayer keepAspect=${keepAspectRatio} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VideoAR</span>
            <span onClick={() => applyVideoKeepAspect(true)} title="keepAspectRatio ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>ar✓</span>
            <span onClick={() => applyVideoKeepAspect(false)} title="keepAspectRatio OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>ar✗</span>
          </div>
        )
      })()}
      {/* R2165: 공통 cc.VideoPlayer startTime 일괄 설정 */}
      {commonCompTypes.includes('cc.VideoPlayer') && (() => {
        const applyVideoStart = async (startTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.VideoPlayer',
            c => ({ ...c, props: { ...c.props, startTime, _startTime: startTime, _N$startTime: startTime } }),
            `VideoPlayer startTime=${startTime}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>VidSt</span>
            {([0, 1, 2, 5, 10, 30] as const).map(v => (
              <span key={v} title={`startTime = ${v}s`}
                onClick={() => applyVideoStart(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2137: 공통 cc.MotionStreak fastMode 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSFastMode = async (fastMode: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, fastMode, _fastMode: fastMode } }),
            `MotionStreak fastMode=${fastMode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSFast</span>
            <span onClick={() => applyMSFastMode(true)} title="fastMode ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>fast✓</span>
            <span onClick={() => applyMSFastMode(false)} title="fastMode OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>fast✗</span>
          </div>
        )
      })()}
      {/* R2107: 공통 cc.MotionStreak color 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 }, _N$color: { r, g, b, a: 255 } } }),
            `MotionStreak color=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSColor</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyMSColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ffffff','#ffff00','#ff4444','#44aaff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyMSColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2076: 공통 cc.MotionStreak stroke 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSStroke = async (stroke: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, stroke, _stroke: stroke, _N$stroke: stroke } }),
            `MotionStreak stroke=${stroke} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSstroke</span>
            {[5, 10, 20, 30, 50, 80].map(v => (
              <span key={v} title={`stroke = ${v}`}
                onClick={() => applyMSStroke(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2071: 공통 cc.MotionStreak fade 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSFade = async (fade: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, fade, _fade: fade, _N$fade: fade } }),
            `MotionStreak fade=${fade} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSfade</span>
            {[0.1, 0.3, 0.5, 0.7, 1, 2].map(v => (
              <span key={v} title={`fade = ${v}`}
                onClick={() => applyMSFade(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2036: 공통 cc.MotionStreak minSeg 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSMinSeg = async (minSeg: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, minSeg, _minSeg: minSeg, _N$minSeg: minSeg } }),
            `MotionStreak minSeg=${minSeg} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSminSeg</span>
            {[1, 2, 5, 10, 20, 50].map(v => (
              <span key={v} onClick={() => applyMSMinSeg(v)} title={`minSeg=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2200: 공통 cc.MotionStreak enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `MotionStreak enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#c8a', width: 48, flexShrink: 0 }}>MSComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyMotionEnabled(v)} title={`MotionStreak enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#c8a', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2190: 공통 cc.MotionStreak timeToLive 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSTtl = async (time: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, timeToLive: time, _timeToLive: time } }),
            `MotionStreak timeToLive=${time} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#c8a', width: 48, flexShrink: 0 }}>MStlive</span>
            {[0.1, 0.2, 0.5, 1, 2, 3].map(v => (
              <span key={v} onClick={() => applyMSTtl(v)} title={`timeToLive=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#c8a', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2175: 공통 cc.MotionStreak speedThreshold 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMSSpeedThresh = async (speedThreshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, speedThreshold, _speedThreshold: speedThreshold, _N$speedThreshold: speedThreshold } }),
            `MotionStreak speedThreshold=${speedThreshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSspThr</span>
            {[1, 5, 10, 20, 50, 100].map(v => (
              <span key={v} onClick={() => applyMSSpeedThresh(v)} title={`speedThreshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1883: 공통 cc.MotionStreak stroke 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionStroke = async (stroke: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, stroke, _stroke: stroke, _N$stroke: stroke } }),
            `MotionStreak stroke=${stroke} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSstroke</span>
            {([8, 16, 32, 64, 128] as const).map(v => (
              <span key={v} title={`stroke = ${v}`}
                onClick={() => applyMotionStroke(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1880: 공통 cc.MotionStreak fade 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionFade = async (fade: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, fade, _fade: fade, _N$fade: fade } }),
            `MotionStreak fade=${fade} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSfade</span>
            {([0.1, 0.3, 0.5, 1, 2, 3] as const).map(v => (
              <span key={v} title={`fade = ${v}s`}
                onClick={() => applyMotionFade(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1926: 공통 cc.MotionStreak minSeg 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionSeg = async (minSeg: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, minSeg, _minSeg: minSeg, _N$minSeg: minSeg } }),
            `MotionStreak minSeg ${minSeg} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MSseg</span>
            {([1, 2, 5, 10, 20] as const).map(v => (
              <span key={v} title={`minSeg = ${v}`}
                onClick={() => applyMotionSeg(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1962: 공통 cc.MotionStreak color 일괄 설정 */}
      {commonCompTypes.includes('cc.MotionStreak') && (() => {
        const applyMotionColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.MotionStreak',
            c => ({ ...c, props: { ...c.props, color: col, _color: col, _N$color: col } }),
            `MotionStreak color (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>MScolor</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyMotionColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#ff4444','#44ff44','#4444ff','#ffff44'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyMotionColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1839: 공통 dragonBones.ArmatureDisplay timeScale 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBSpeed = async (timeScale: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => ({ ...c, props: { ...c.props, timeScale, _timeScale: timeScale, _N$timeScale: timeScale } }),
            `DragonBones ×${timeScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>DB</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`timeScale = ×${v}`}
                onClick={() => applyDBSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >×{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1930: 공통 dragonBones.ArmatureDisplay playOnLoad 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBPlayOnLoad = async (playOnLoad: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => ({ ...c, props: { ...c.props, playOnLoad, _playOnLoad: playOnLoad, _N$playOnLoad: playOnLoad } }),
            `DragonBones playOnLoad=${playOnLoad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>DBpol</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`playOnLoad = ${v}`}
                onClick={() => applyDBPlayOnLoad(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v ? 'pol✓' : 'pol✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2044: 공통 dragonBones.ArmatureDisplay playTimes 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBPlayTimes = async (playTimes: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => ({ ...c, props: { ...c.props, playTimes, _playTimes: playTimes, _N$playTimes: playTimes } }),
            `D B Play Times`,
          )
          const label = playTimes === -1 ? '∞' : `${playTimes}x`
          setBatchMsg(`✓ DB playTimes=${label} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>DBplay</span>
            {([['∞',-1],['1x',1],['2x',2],['3x',3],['5x',5]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyDBPlayTimes(v)} title={`playTimes=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2011: 공통 dragonBones.ArmatureDisplay loop 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => ({ ...c, props: { ...c.props, loop, _loop: loop, _N$loop: loop } }),
            `DragonBones loop=${loop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>DBloop</span>
            <span onClick={() => applyDBLoop(true)} title="loop ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>loop✓</span>
            <span onClick={() => applyDBLoop(false)} title="loop OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>loop✗</span>
          </div>
        )
      })()}
      {/* R2138: 공통 dragonBones.ArmatureDisplay debugBones 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBDebugBones = async (debugBones: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => ({ ...c, props: { ...c.props, debugBones, _debugBones: debugBones, _N$debugBones: debugBones } }),
            `DragonBones debugBones=${debugBones} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>DBDbgBn</span>
            <span onClick={() => applyDBDebugBones(true)} title="debugBones ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>bn✓</span>
            <span onClick={() => applyDBDebugBones(false)} title="debugBones OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>bn✗</span>
          </div>
        )
      })()}
      {/* R2201: 공통 dragonBones.ArmatureDisplay enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `dragonBones.ArmatureDisplay enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#c084fc', width: 48, flexShrink: 0 }}>DBComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyDBEnabled(v)} title={`dragonBones.ArmatureDisplay enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#c084fc', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2188: 공통 dragonBones.ArmatureDisplay blendMode 일괄 설정 */}
      {commonCompTypes.includes('dragonBones.ArmatureDisplay') && (() => {
        const applyDBBlendMode = async (blendMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'dragonBones.ArmatureDisplay',
            c => ({ ...c, props: { ...c.props, blendMode, _blendMode: blendMode } }),
            `DragonBones blendMode=${['NORM','ADD','MULT'][blendMode] ?? blendMode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#c084fc', width: 48, flexShrink: 0 }}>DBblend</span>
            {([['NORM', 0], ['ADD', 10], ['MULT', 12]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyDBBlendMode(v)} title={`blendMode=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#c084fc', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1838: 공통 sp.Skeleton timeScale 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineSpeed = async (timeScale: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, timeScale, _timeScale: timeScale, _N$timeScale: timeScale } }),
            `Spine ×${timeScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>Spine</span>
            {([0.5, 1, 1.5, 2] as const).map(v => (
              <span key={v} title={`timeScale = ×${v}`}
                onClick={() => applySpineSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >×{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1931: 공통 sp.Skeleton loop 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, loop, _loop: loop, _N$loop: loop } }),
            `Spine loop=${loop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>Spine lp</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`loop = ${v}`}
                onClick={() => applySpineLoop(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}
              >{v ? 'loop✓' : 'loop✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2037: 공통 sp.Skeleton timeScale 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineTimeScale = async (timeScale: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, timeScale, _timeScale: timeScale, _N$timeScale: timeScale } }),
            `Skeleton timeScale=${timeScale}x (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SpineTS</span>
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map(v => (
              <span key={v} onClick={() => applySpineTimeScale(v)} title={`timeScale=${v}x`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R1990: 공통 sp.Skeleton premultipliedAlpha 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpinePremult = async (premultipliedAlpha: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, premultipliedAlpha, _premultipliedAlpha: premultipliedAlpha, _N$premultipliedAlpha: premultipliedAlpha } }),
            `Spine premultAlpha=${premultipliedAlpha} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpPremult</span>
            <span onClick={() => applySpinePremult(true)} title="premultipliedAlpha ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>pre✓</span>
            <span onClick={() => applySpinePremult(false)} title="premultipliedAlpha OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>pre✗</span>
          </div>
        )
      })()}
      {/* R2139: 공통 sp.Skeleton paused 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpinePaused = async (paused: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, paused, _paused: paused, _N$paused: paused } }),
            `Spine paused=${paused} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpPaused</span>
            <span onClick={() => applySpinePaused(true)} title="paused ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>⏸✓</span>
            <span onClick={() => applySpinePaused(false)} title="paused OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>▶✓</span>
          </div>
        )
      })()}
      {/* R2136: 공통 sp.Skeleton debugBones 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineDebugBones = async (debugBones: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, debugBones, _debugBones: debugBones, _N$debugBones: debugBones } }),
            `Spine debugBones=${debugBones} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpDbgBn</span>
            <span onClick={() => applySpineDebugBones(true)} title="debugBones ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>bn✓</span>
            <span onClick={() => applySpineDebugBones(false)} title="debugBones OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>bn✗</span>
          </div>
        )
      })()}
      {/* R2135: 공통 sp.Skeleton debugSlots 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineDebugSlots = async (debugSlots: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, debugSlots, _debugSlots: debugSlots, _N$debugSlots: debugSlots } }),
            `Spine debugSlots=${debugSlots} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpDbgSl</span>
            <span onClick={() => applySpineDebugSlots(true)} title="debugSlots ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>dbg✓</span>
            <span onClick={() => applySpineDebugSlots(false)} title="debugSlots OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>dbg✗</span>
          </div>
        )
      })()}
      {/* R2134: 공통 sp.Skeleton useTint 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineUseTint = async (useTint: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, useTint, _useTint: useTint, _N$useTint: useTint } }),
            `Spine useTint=${useTint} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpTint</span>
            <span onClick={() => applySpineUseTint(true)} title="useTint ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>tint✓</span>
            <span onClick={() => applySpineUseTint(false)} title="useTint OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>tint✗</span>
          </div>
        )
      })()}
    </>
  )
}
