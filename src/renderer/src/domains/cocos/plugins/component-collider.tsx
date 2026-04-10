import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function ColliderSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R2095: 공통 cc.PolygonCollider restitution 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyRest = async (restitution: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => ({ ...c, props: { ...c.props, restitution, _restitution: restitution, _N$restitution: restitution } }),
            `PolygonCollider restitution=${restitution} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyRst</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`restitution = ${v}`}
                onClick={() => applyPolyRest(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2094: 공통 cc.PolygonCollider friction 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyFric = async (friction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => ({ ...c, props: { ...c.props, friction, _friction: friction, _N$friction: friction } }),
            `PolygonCollider friction=${friction} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyFrc</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`friction = ${v}`}
                onClick={() => applyPolyFric(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2093: 공통 cc.PolygonCollider density 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyDens = async (density: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => ({ ...c, props: { ...c.props, density, _density: density, _N$density: density } }),
            `PolygonCollider density=${density} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyDns</span>
            {[0.1, 0.5, 1, 2, 5, 10].map(v => (
              <span key={v} title={`density = ${v}`}
                onClick={() => applyPolyDens(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2218: 공통 cc.BoxCollider2D enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider2D') || commonCompTypes.includes('cc.BoxCollider')) && (() => {
        const applyBoxColliderEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider2D' || c.type === 'cc.BoxCollider'),
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `BoxCollider2D enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxCEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyBoxColliderEnabled(v)} title={`BoxCollider2D enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2218: 공통 cc.CircleCollider2D enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider2D') || commonCompTypes.includes('cc.CircleCollider')) && (() => {
        const applyCircleColliderEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider2D' || c.type === 'cc.CircleCollider'),
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `CircleCollider2D enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirCEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyCircleColliderEnabled(v)} title={`CircleCollider2D enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2220: 공통 cc.PolygonCollider2D enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyColliderEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `PolygonCollider2D enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyCEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyPolyColliderEnabled(v)} title={`PolygonCollider2D enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2156: 공통 cc.PolygonCollider offset 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D') ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `PolyCollider offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyOff</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0]] as [string,number,number][]).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyPolyOffset(ox, oy)} title={`offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2171: 공통 cc.PolygonCollider threshold 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyThreshold = async (threshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => ({ ...c, props: { ...c.props, threshold, _threshold: threshold, _N$threshold: threshold } }),
            `PolygonCollider threshold=${threshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolyThr</span>
            {[1, 2, 5, 10, 20].map(v => (
              <span key={v} onClick={() => applyPolyThreshold(v)} title={`threshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2160: 공통 cc.BoxCollider2D offset 일괄 설정 */}
      {commonCompTypes.includes('cc.BoxCollider2D') && (() => {
        const applyBoxOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => c.type === 'cc.BoxCollider2D' ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `BoxCollider2D offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Box2Off</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0]] as [string,number,number][]).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyBoxOffset(ox, oy)} title={`BoxCollider2D offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2160: 공통 cc.CircleCollider2D offset 일괄 설정 */}
      {commonCompTypes.includes('cc.CircleCollider2D') && (() => {
        const applyCircleOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => c.type === 'cc.CircleCollider2D' ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `CircleCollider2D offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Cir2Off</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0]] as [string,number,number][]).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyCircleOffset(ox, oy)} title={`CircleCollider2D offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2209: 공통 cc.BoxCollider2D size 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.BoxCollider2D') && (() => {
        const applyBoxCollSize = async (w: number, h: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const size = { width: w, height: h }
            const components = n.components.map(c => c.type === 'cc.BoxCollider2D' ? { ...c, props: { ...c.props, size, _size: size, _N$size: size } } : c)
            return { ...n, components }
          }, `BoxCollider2D size=(${w},${h}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Box2Sz</span>
            {([[50,50],[100,100],[150,150],[200,200],[100,50],[200,100]] as [number,number][]).map(([w,h]) => (
              <span key={`${w}x${h}`} onClick={() => applyBoxCollSize(w, h)} title={`BoxCollider2D size=(${w},${h})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{w}×{h}</span>
            ))}
          </div>
        )
      })()}
      {/* R2209: 공통 cc.CircleCollider2D radius 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.CircleCollider2D') && (() => {
        const applyCircleCollRadius = async (radius: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.CircleCollider2D',
            c => ({ ...c, props: { ...c.props, radius, _radius: radius, _N$radius: radius } }),
            `CircleCollider2D radius=${radius} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Cir2R</span>
            {[25, 50, 75, 100, 150, 200].map(v => (
              <span key={v} onClick={() => applyCircleCollRadius(v)} title={`CircleCollider2D radius=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2084: 공통 cc.PolygonCollider sensor 일괄 설정 */}
      {(commonCompTypes.includes('cc.PolygonCollider') || commonCompTypes.includes('cc.PolygonCollider2D')) && (() => {
        const applyPolyColliderSensor = async (sensor: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.PolygonCollider' || c.type === 'cc.PolygonCollider2D'),
            c => ({ ...c, props: { ...c.props, sensor, _sensor: sensor, _N$sensor: sensor } }),
            `PolygonCollider sensor=${sensor} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PolySens</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`sensor = ${v}`}
                onClick={() => applyPolyColliderSensor(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'sns✓' : 'sns✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2092: 공통 cc.CircleCollider restitution 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleRestitution = async (restitution: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => ({ ...c, props: { ...c.props, restitution, _restitution: restitution, _N$restitution: restitution } }),
            `CircleCollider restitution=${restitution} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirRest</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`restitution = ${v}`}
                onClick={() => applyCircleRestitution(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2090: 공통 cc.CircleCollider friction 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleFriction = async (friction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => ({ ...c, props: { ...c.props, friction, _friction: friction, _N$friction: friction } }),
            `CircleCollider friction=${friction} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirFric</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`friction = ${v}`}
                onClick={() => applyCircleFriction(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2088: 공통 cc.CircleCollider density 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleDensity = async (density: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => ({ ...c, props: { ...c.props, density, _density: density, _N$density: density } }),
            `CircleCollider density=${density} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirDens</span>
            {[0.1, 0.5, 1, 2, 5, 10].map(v => (
              <span key={v} title={`density = ${v}`}
                onClick={() => applyCircleDensity(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2083: 공통 cc.CircleCollider sensor 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleSensor = async (sensor: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => ({ ...c, props: { ...c.props, sensor, _sensor: sensor, _N$sensor: sensor } }),
            `CircleCollider sensor=${sensor} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirSens</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`sensor = ${v}`}
                onClick={() => applyCircleSensor(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'sns✓' : 'sns✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2091: 공통 cc.BoxCollider restitution 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const applyBoxRestitution = async (restitution: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => ({ ...c, props: { ...c.props, restitution, _restitution: restitution, _N$restitution: restitution } }),
            `BoxCollider restitution=${restitution} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxRest</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`restitution = ${v}`}
                onClick={() => applyBoxRestitution(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2089: 공통 cc.BoxCollider friction 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const applyBoxFriction = async (friction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => ({ ...c, props: { ...c.props, friction, _friction: friction, _N$friction: friction } }),
            `BoxCollider friction=${friction} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxFric</span>
            {[0, 0.1, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} title={`friction = ${v}`}
                onClick={() => applyBoxFriction(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2087: 공통 cc.BoxCollider density 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const applyBoxDensity = async (density: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => ({ ...c, props: { ...c.props, density, _density: density, _N$density: density } }),
            `BoxCollider density=${density} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxDens</span>
            {[0.1, 0.5, 1, 2, 5, 10].map(v => (
              <span key={v} title={`density = ${v}`}
                onClick={() => applyBoxDensity(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2082: 공통 cc.BoxCollider sensor 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const applyBoxSensor = async (sensor: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => ({ ...c, props: { ...c.props, sensor, _sensor: sensor, _N$sensor: sensor } }),
            `BoxCollider sensor=${sensor} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxSens</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`sensor = ${v}`}
                onClick={() => applyBoxSensor(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'sns✓' : 'sns✗'}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
