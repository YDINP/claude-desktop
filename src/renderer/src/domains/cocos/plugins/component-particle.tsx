import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function ParticleSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R2194: 공통 cc.ParticleSystem enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `ParticleSystem enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#aee', width: 48, flexShrink: 0 }}>PSComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyParticleEnabled(v)} title={`ParticleSystem enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#aee', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2201: 공통 sp.Skeleton enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `sp.Skeleton enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpineEnabled(v)} title={`sp.Skeleton enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2188: 공통 sp.Skeleton enableBatch 일괄 설정 */}
      {commonCompTypes.includes('sp.Skeleton') && (() => {
        const applySpineEnableBatch = async (enableBatch: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'sp.Skeleton',
            c => ({ ...c, props: { ...c.props, enableBatch, _enableBatch: enableBatch, _N$enableBatch: enableBatch } }),
            `Spine enableBatch=${enableBatch} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SpBatch</span>
            {([['batch✓', true], ['batch✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpineEnableBatch(v)} title={`enableBatch=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2189: 공통 cc.ParticleSystem sourcePos.x 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticlePosX = async (x: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, sourcePos: { ...(c.props.sourcePos || { x: 0, y: 0 }), x }, _sourcePos: { ...(c.props._sourcePos || { x: 0, y: 0 }), x } } }),
            `ParticleSystem sourcePos.x=${x} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#aee', width: 48, flexShrink: 0 }}>PSposX</span>
            {[0, 50, 100, 200, 300, 500].map(v => (
              <span key={v} onClick={() => applyParticlePosX(v)} title={`sourcePos.x=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#aee', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2189: 공통 cc.ParticleSystem sourcePos.y 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticlePosY = async (y: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, sourcePos: { ...(c.props.sourcePos || { x: 0, y: 0 }), y }, _sourcePos: { ...(c.props._sourcePos || { x: 0, y: 0 }), y } } }),
            `ParticleSystem sourcePos.y=${y} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#aee', width: 48, flexShrink: 0 }}>PSposY</span>
            {[0, 50, 100, 200, 300, 500].map(v => (
              <span key={v} onClick={() => applyParticlePosY(v)} title={`sourcePos.y=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#aee', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1932: 공통 cc.ParticleSystem loop 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleLoop = async (loop: boolean) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            // loop is achieved by setting duration = -1 or duration = positive
            const dur = loop ? -1 : 1
            const components = n.components.map(c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D') ? { ...c, props: { ...c.props, duration: dur, _duration: dur, _N$duration: dur } } : c)
            return { ...n, components }
          }, `ParticleSystem loop=${loop} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Ploop</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={v ? 'loop (duration=-1)' : 'once (duration=1)'}
                onClick={() => applyParticleLoop(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v ? 'loop' : 'once'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1981: 공통 cc.ParticleSystem emitterMode 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEmitterMode = async (emitterMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, emitterMode, _emitterMode: emitterMode, _N$emitterMode: emitterMode } }),
            `P S Emitter Mode`,
          )
          const names = ['Gravity', 'Radius']
          setBatchMsg(`✓ PS emitterMode=${names[emitterMode] ?? emitterMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSemit</span>
            <span onClick={() => applyPSEmitterMode(0)} title="emitterMode=GRAVITY"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Grav</span>
            <span onClick={() => applyPSEmitterMode(1)} title="emitterMode=RADIUS"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Rad</span>
          </div>
        )
      })()}
      {/* R1979: 공통 cc.ParticleSystem autoRemoveOnFinish 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSAutoRemove = async (autoRemoveOnFinish: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, autoRemoveOnFinish, _autoRemoveOnFinish: autoRemoveOnFinish } }),
            `PS autoRemove=${autoRemoveOnFinish} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSautorm</span>
            <span onClick={() => applyPSAutoRemove(true)} title="autoRemoveOnFinish ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>rm✓</span>
            <span onClick={() => applyPSAutoRemove(false)} title="autoRemoveOnFinish OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>rm✗</span>
          </div>
        )
      })()}
      {/* R1977: 공통 cc.ParticleSystem srcBlendFactor/dstBlendFactor 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSBlend = async (src: number, dst: number, label: string) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, srcBlendFactor: src, dstBlendFactor: dst, _srcBlendFactor: src, _dstBlendFactor: dst, _N$srcBlendFactor: src, _N$dstBlendFactor: dst } }),
            `PS blend=${label} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSblend</span>
            <span onClick={() => applyPSBlend(770, 771, 'Add')} title="src=ONE(770) dst=ONE_MINUS_SRC_ALPHA(771)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Add</span>
            <span onClick={() => applyPSBlend(770, 1)} title="src=ONE(770) dst=ONE(1) — Additive"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Addv</span>
            <span onClick={() => applyPSBlend(774, 771, 'Norm')} title="src=SRC_ALPHA(774) dst=ONE_MINUS_SRC_ALPHA(771) — Normal"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Norm</span>
          </div>
        )
      })()}
      {/* R1976: 공통 cc.ParticleSystem positionType 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSPosType = async (positionType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, positionType, _positionType: positionType, _N$positionType: positionType } }),
            `P S Pos Type`,
          )
          const names = ['Free', 'Relative', 'Group']
          setBatchMsg(`✓ PS positionType=${names[positionType] ?? positionType} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSposType</span>
            {([['Free', 0], ['Rel', 1], ['Grp', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyPSPosType(v)} title={`positionType=${l}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1846: 공통 cc.ParticleSystem startSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleSize = async (startSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startSize, _startSize: startSize, _N$startSize: startSize } }),
            `Particle startSize ${startSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Psize</span>
            {([10, 20, 50, 80, 100] as const).map(v => (
              <span key={v} title={`startSize = ${v}`}
                onClick={() => applyParticleSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1837: 공통 cc.ParticleSystem emitRate 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleRate = async (rate: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, emissionRate: rate, _emissionRate: rate, _N$emissionRate: rate } }),
            `Particle emitRate ${rate} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Particle</span>
            {([5, 10, 30, 50, 100] as const).map(v => (
              <span key={v} title={`emitRate = ${v}`}
                onClick={() => applyParticleRate(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1874: 공통 cc.ParticleSystem maxParticles 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleMax = async (max: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, maxParticles: max, _maxParticles: max, _N$maxParticles: max, totalParticles: max, _totalParticles: max, _N$totalParticles: max } }),
            `Particle maxParticles ${max} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PmaxN</span>
            {([10, 30, 50, 100, 200, 500] as const).map(v => (
              <span key={v} title={`maxParticles = ${v}`}
                onClick={() => applyParticleMax(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1873: 공통 cc.ParticleSystem duration 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleDur = async (dur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, duration: dur, _duration: dur, _N$duration: dur } }),
            `Particle duration ${dur < 0 ? '∞' : `${dur}s`} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Pdur</span>
            {([[-1,'∞'], [1,'1s'], [2,'2s'], [5,'5s'], [10,'10s']] as [number, string][]).map(([v, l]) => (
              <span key={v} title={`duration = ${v < 0 ? '무한' : `${v}s`}`}
                onClick={() => applyParticleDur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1893: 공통 cc.ParticleSystem speed 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleSpeed = async (speed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, speed, _speed: speed, _N$speed: speed } }),
            `Particle Speed`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Pspeed</span>
            {([30, 60, 100, 180, 300, 500] as const).map(v => (
              <span key={v} title={`speed = ${v}`}
                onClick={() => applyParticleSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2008: 공통 cc.ParticleSystem angleVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSAngleVar = async (angleVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, angleVar, _angleVar: angleVar, _N$angleVar: angleVar } }),
            `PS angleVar=${angleVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSangV</span>
            {[0, 15, 30, 45, 90, 180].map(v => (
              <span key={v} onClick={() => applyPSAngleVar(v)} title={`angleVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R1896: 공통 cc.ParticleSystem angle 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleAngle = async (angle: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, angle, _angle: angle, _N$angle: angle } }),
            `Particle Angle`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Pangle</span>
            {([0, 45, 90, 135, 180, 270] as const).map(v => (
              <span key={v} title={`angle = ${v}°`}
                onClick={() => applyParticleAngle(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R1914: 공통 cc.ParticleSystem maxParticles 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyMaxParticles = async (maxParticles: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, maxParticles, _maxParticles: maxParticles, _N$maxParticles: maxParticles } }),
            `ParticleSystem maxParticles ${maxParticles} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>maxPart</span>
            {([50, 100, 150, 200, 300, 500] as const).map(v => (
              <span key={v} title={`maxParticles = ${v}`}
                onClick={() => applyMaxParticles(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1950: 공통 cc.ParticleSystem emissionRate 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleEmission = async (emissionRate: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, emissionRate, _emissionRate: emissionRate, _N$emissionRate: emissionRate } }),
            `ParticleSystem emissionRate=${emissionRate} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSemit</span>
            {([5, 10, 20, 30, 50] as const).map(v => (
              <span key={v} title={`emissionRate = ${v}`}
                onClick={() => applyParticleEmission(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2033: 공통 cc.ParticleSystem angle 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSAngle = async (angle: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, angle, _angle: angle, _N$angle: angle } }),
            `PS angle=${angle}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSangle</span>
            {[0, 45, 90, 135, 180, 270].map(v => (
              <span key={v} onClick={() => applyPSAngle(v)} title={`angle=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2032: 공통 cc.ParticleSystem endSpin 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndSpin = async (endSpin: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endSpin, _endSpin: endSpin, _N$endSpin: endSpin } }),
            `PS endSpin=${endSpin}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendSpin</span>
            {[0, 45, 90, 180, 270, 360].map(v => (
              <span key={v} onClick={() => applyPSEndSpin(v)} title={`endSpin=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2049: 공통 cc.ParticleSystem endSizeVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndSizeVar = async (endSizeVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endSizeVar, _endSizeVar: endSizeVar, _N$endSizeVar: endSizeVar } }),
            `PS endSizeVar=${endSizeVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendSzV</span>
            {[0, 2, 5, 10, 20, 50].map(v => (
              <span key={v} onClick={() => applyPSEndSizeVar(v)} title={`endSizeVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2048: 공통 cc.ParticleSystem endSpinVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndSpinVar = async (endSpinVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endSpinVar, _endSpinVar: endSpinVar, _N$endSpinVar: endSpinVar } }),
            `PS endSpinVar=${endSpinVar}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendSpV</span>
            {[0, 15, 30, 45, 90, 180].map(v => (
              <span key={v} onClick={() => applyPSEndSpinVar(v)} title={`endSpinVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2047: 공통 cc.ParticleSystem startSpinVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartSpinVar = async (startSpinVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startSpinVar, _startSpinVar: startSpinVar, _N$startSpinVar: startSpinVar } }),
            `PS startSpinVar=${startSpinVar}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstSpV</span>
            {[0, 15, 30, 45, 90, 180].map(v => (
              <span key={v} onClick={() => applyPSStartSpinVar(v)} title={`startSpinVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2031: 공통 cc.ParticleSystem startSpin 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartSpin = async (startSpin: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startSpin, _startSpin: startSpin, _N$startSpin: startSpin } }),
            `PS startSpin=${startSpin}° (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstSpin</span>
            {[0, 45, 90, 180, 270, 360].map(v => (
              <span key={v} onClick={() => applyPSStartSpin(v)} title={`startSpin=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2051: 공통 cc.ParticleSystem tangentialAccelVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSTangAccelVar = async (tangentialAccelVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, tangentialAccelVar, _tangentialAccelVar: tangentialAccelVar, _N$tangentialAccelVar: tangentialAccelVar } }),
            `PS tangentialAccelVar=${tangentialAccelVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PStAccV</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSTangAccelVar(v)} title={`tangentialAccelVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2030: 공통 cc.ParticleSystem tangentialAccel 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSTangAccel = async (tangentialAccel: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, tangentialAccel, _tangentialAccel: tangentialAccel, _N$tangentialAccel: tangentialAccel } }),
            `PS tangentialAccel=${tangentialAccel} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PStAccel</span>
            {[-100, -50, 0, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSTangAccel(v)} title={`tangentialAccel=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2050: 공통 cc.ParticleSystem radialAccelVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRadialAccelVar = async (radialAccelVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, radialAccelVar, _radialAccelVar: radialAccelVar, _N$radialAccelVar: radialAccelVar } }),
            `PS radialAccelVar=${radialAccelVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrAccV</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSRadialAccelVar(v)} title={`radialAccelVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2029: 공통 cc.ParticleSystem radialAccel 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRadialAccel = async (radialAccel: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, radialAccel, _radialAccel: radialAccel, _N$radialAccel: radialAccel } }),
            `PS radialAccel=${radialAccel} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrAccel</span>
            {[-100, -50, 0, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSRadialAccel(v)} title={`radialAccel=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2028: 공통 cc.ParticleSystem speed 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSSpeed = async (speed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, speed, _speed: speed, _N$speed: speed } }),
            `PS speed=${speed} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSspd</span>
            {[0, 50, 100, 200, 300, 500].map(v => (
              <span key={v} onClick={() => applyPSSpeed(v)} title={`speed=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2027: 공통 cc.ParticleSystem duration 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSDuration = async (duration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, duration, _duration: duration, _N$duration: duration } }),
            `P S Duration`,
          )
          const label = duration === -1 ? '∞' : `${duration}s`
          setBatchMsg(`✓ PS duration=${label} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSDur</span>
            {([['∞',-1],['1s',1],['2s',2],['5s',5],['10s',10]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyPSDuration(v)} title={`duration=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2026: 공통 cc.ParticleSystem totalParticles 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSTotalPart = async (totalParticles: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, totalParticles, _totalParticles: totalParticles, _N$totalParticles: totalParticles } }),
            `PS totalParticles=${totalParticles} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PStotal</span>
            {[10, 25, 50, 100, 200, 500].map(v => (
              <span key={v} onClick={() => applyPSTotalPart(v)} title={`totalParticles=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2168: 공통 cc.ParticleSystem simulationSpace 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSSimSpace = async (simulationSpace: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, simulationSpace, _simulationSpace: simulationSpace, _N$simulationSpace: simulationSpace } }),
            `PS simulationSpace=${simulationSpace === 0 ? 'World' : 'Local'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSsim</span>
            <span onClick={() => applyPSSimSpace(0)} title="simulationSpace=World(0)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>World</span>
            <span onClick={() => applyPSSimSpace(1)} title="simulationSpace=Local(1)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>Local</span>
          </div>
        )
      })()}
      {/* R2062: 공통 cc.ParticleSystem rotationIsDir 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRotIsDir = async (rotationIsDir: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, rotationIsDir, _rotationIsDir: rotationIsDir, _N$rotationIsDir: rotationIsDir } }),
            `PS rotationIsDir=${rotationIsDir} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrotDir</span>
            {([['dir✓',true],['dir✗',false]] as [string,boolean][]).map(([label,v]) => (
              <span key={label} onClick={() => applyPSRotIsDir(v)} title={`rotationIsDir=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2147: 공통 cc.ParticleSystem endRadiusVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndRadiusVar = async (endRadiusVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endRadiusVar, _endRadiusVar: endRadiusVar, _N$endRadiusVar: endRadiusVar } }),
            `PS endRadiusVar=${endRadiusVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendRdV</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSEndRadiusVar(v)} title={`endRadiusVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2061: 공통 cc.ParticleSystem startRadiusVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartRadiusVar = async (startRadiusVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startRadiusVar, _startRadiusVar: startRadiusVar, _N$startRadiusVar: startRadiusVar } }),
            `PS startRadiusVar=${startRadiusVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstRadV</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSStartRadiusVar(v)} title={`startRadiusVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2060: 공통 cc.ParticleSystem endRadius 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndRadius = async (endRadius: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endRadius, _endRadius: endRadius, _N$endRadius: endRadius } }),
            `PS endRadius=${endRadius} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendRad</span>
            {[0, 50, 100, 150, 200, 300].map(v => (
              <span key={v} onClick={() => applyPSEndRadius(v)} title={`endRadius=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2059: 공통 cc.ParticleSystem startRadius 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartRadius = async (startRadius: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startRadius, _startRadius: startRadius, _N$startRadius: startRadius } }),
            `PS startRadius=${startRadius} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstRad</span>
            {[0, 50, 100, 150, 200, 300].map(v => (
              <span key={v} onClick={() => applyPSStartRadius(v)} title={`startRadius=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2016: 공통 cc.ParticleSystem rotatePerSVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRotPerSVar = async (rotatePerSVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, rotatePerSVar, _rotatePerSVar: rotatePerSVar, _N$rotatePerSVar: rotatePerSVar } }),
            `PS rotatePerSVar=${rotatePerSVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrPSVar</span>
            {[0, 15, 30, 45, 90].map(v => (
              <span key={v} onClick={() => applyPSRotPerSVar(v)} title={`rotatePerSVar=${v}°/s`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2015: 공통 cc.ParticleSystem rotatePerS 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSRotPerS = async (rotatePerS: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, rotatePerS, _rotatePerS: rotatePerS, _N$rotatePerS: rotatePerS } }),
            `PS rotatePerS=${rotatePerS} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSrotPS</span>
            {[0, 45, 90, 180, 360].map(v => (
              <span key={v} onClick={() => applyPSRotPerS(v)} title={`rotatePerS=${v}°/s`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2121: 공통 cc.ParticleSystem endRotationVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndRotVar = async (endRotationVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endRotationVar, _endRotationVar: endRotationVar } }),
            `PS endRotationVar=${endRotationVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSeRtV</span>
            {[0, 30, 60, 90, 180, 360].map(v => (
              <span key={v} onClick={() => applyPSEndRotVar(v)} title={`endRotationVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2120: 공통 cc.ParticleSystem startRotationVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartRotVar = async (startRotationVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startRotationVar, _startRotationVar: startRotationVar } }),
            `PS startRotationVar=${startRotationVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSsRtV</span>
            {[0, 30, 60, 90, 180, 360].map(v => (
              <span key={v} onClick={() => applyPSStartRotVar(v)} title={`startRotationVar=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2119: 공통 cc.ParticleSystem endRotation 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndRot = async (endRotation: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endRotation, _endRotation: endRotation } }),
            `PS endRotation=${endRotation} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendRt</span>
            {[0, 45, 90, 180, 270, 360].map(v => (
              <span key={v} onClick={() => applyPSEndRot(v)} title={`endRotation=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2118: 공통 cc.ParticleSystem startRotation 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartRot = async (startRotation: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startRotation, _startRotation: startRotation } }),
            `PS startRotation=${startRotation} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstRot</span>
            {[0, 45, 90, 180, 270, 360].map(v => (
              <span key={v} onClick={() => applyPSStartRot(v)} title={`startRotation=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2054: 공통 cc.ParticleSystem posVar (spread) 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSPosVar = async (v: number) => {
          if (!sceneFile.root) return
          const posVar = { x: v, y: v }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, posVar, _posVar: posVar, _N$posVar: posVar } }),
            `PS posVar=(${v},${v}) (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSposVar</span>
            {[0, 10, 25, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSPosVar(v)} title={`posVar=(${v},${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2117: 공통 cc.ParticleSystem gravity.y 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSGravY = async (gy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const updComps = n.components.map(c => {
            if (c.type !== 'cc.ParticleSystem') return c
            const grav = (c.props?.gravity as { x?: number; y?: number } | undefined) ?? {}
            const newGrav = { x: grav.x ?? 0, y: gy }; return { ...c, props: { ...c.props, gravity: newGrav, _gravity: newGrav, _N$gravity: newGrav } }
            })
            return { ...n, components: updComps}
          }, `PS gravity.y=${gy} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSgravY</span>
            {[-300, -200, -100, 0, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSGravY(v)} title={`gravity.y=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2055: 공통 cc.ParticleSystem gravity.x 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSGravityX = async (gx: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const comp = n.components.find(c => c.type === 'cc.ParticleSystem')
            const prevGy = (comp?.props?.gravity as {x:number,y:number}|undefined)?.y ?? 0
            const grav = { x: gx, y: prevGy }
            const components = n.components.map(c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D') ? { ...c, props: { ...c.props, gravity: grav, _gravity: grav, _N$gravity: grav } } : c)
            return { ...n, components }
          }, `PS gravity.x=${gx} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSgravX</span>
            {[-200, -100, 0, 100, 200].map(v => (
              <span key={v} onClick={() => applyPSGravityX(v)} title={`gravity.x=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2002: 공통 cc.ParticleSystem gravity 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSGravity = async (gy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const grav = { x: 0, y: gy }
            const components = n.components.map(c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D') ? { ...c, props: { ...c.props, gravity: grav, _gravity: grav, _N$gravity: grav } } : c)
            return { ...n, components }
          }, `PS gravity.y=${gy} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSgrav</span>
            {[0, -100, -200, -500, 100].map(v => (
              <span key={v} onClick={() => applyPSGravity(v)} title={`gravity.y=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2081: 공통 cc.ParticleSystem life 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSLife = async (life: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, life, _life: life, _N$life: life } }),
            `PS life=${life} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSlife</span>
            {[0.5, 1, 1.5, 2, 3, 5].map(v => (
              <span key={v} title={`life = ${v}s`}
                onClick={() => applyPSLife(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2001: 공통 cc.ParticleSystem lifeVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSLifeVar = async (lifeVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, lifeVar, _lifeVar: lifeVar, _N$lifeVar: lifeVar } }),
            `PS lifeVar=${lifeVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSlifeV</span>
            {[0, 0.25, 0.5, 1, 2].map(v => (
              <span key={v} onClick={() => applyPSLifeVar(v)} title={`lifeVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1999: 공통 cc.ParticleSystem speedVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSSpeedVar = async (speedVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, speedVar, _speedVar: speedVar, _N$speedVar: speedVar } }),
            `PS speedVar=${speedVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSspdVar</span>
            {[0, 10, 25, 50, 100].map(v => (
              <span key={v} onClick={() => applyPSSpeedVar(v)} title={`speedVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2074: 공통 cc.ParticleSystem endSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndSize = async (endSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endSize, _endSize: endSize, _N$endSize: endSize } }),
            `PS endSize=${endSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSendSz</span>
            {[0, 10, 20, 30, 50, 80].map(v => (
              <span key={v} title={`endSize = ${v}`}
                onClick={() => applyPSEndSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2073: 공통 cc.ParticleSystem startSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartSize = async (startSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startSize, _startSize: startSize, _N$startSize: startSize } }),
            `PS startSize=${startSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSstSz</span>
            {[10, 20, 30, 50, 80, 100].map(v => (
              <span key={v} title={`startSize = ${v}`}
                onClick={() => applyPSStartSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1998: 공통 cc.ParticleSystem startSizeVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartSizeVar = async (startSizeVar: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startSizeVar, _startSizeVar: startSizeVar, _N$startSizeVar: startSizeVar } }),
            `PS startSizeVar=${startSizeVar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PSszVar</span>
            {[0, 2, 5, 10, 20].map(v => (
              <span key={v} onClick={() => applyPSStartSizeVar(v)} title={`startSizeVar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1957: 공통 cc.ParticleSystem startSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleStartSize = async (startSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startSize, _startSize: startSize, _N$startSize: startSize } }),
            `ParticleSystem startSize=${startSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSsize</span>
            {([5, 10, 20, 30, 50] as const).map(v => (
              <span key={v} title={`startSize = ${v}`}
                onClick={() => applyParticleStartSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1958: 공통 cc.ParticleSystem life 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleLife = async (life: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, life, _life: life, _N$life: life } }),
            `ParticleSystem life=${life}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSlife</span>
            {([0.5, 1, 2, 3, 5] as const).map(v => (
              <span key={v} title={`life = ${v}s`}
                onClick={() => applyParticleLife(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R1961: 공통 cc.ParticleSystem endSize 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleEndSize = async (endSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endSize, _endSize: endSize, _N$endSize: endSize } }),
            `ParticleSystem endSize=${endSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSendSz</span>
            {([0, 5, 10, 20, 30] as const).map(v => (
              <span key={v} title={`endSize = ${v}`}
                onClick={() => applyParticleEndSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1969: 공통 cc.ParticleSystem startColor 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleStartColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startColor: col, _startColor: col, _N$startColor: col } }),
            `ParticleSystem startColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSstCol</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyParticleStartColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#ff4444','#ffff44','#44ff44','#4444ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyParticleStartColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1970: 공통 cc.ParticleSystem endColor 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyParticleEndColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 0 }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endColor: col, _endColor: col, _N$endColor: col } }),
            `ParticleSystem endColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSendCol</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyParticleEndColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#ff4444','#ffff44','#44ff44','#000000'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyParticleEndColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2148: 공통 cc.ParticleSystem startColorVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSStartColorVar = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const startColorVar = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, startColorVar, _startColorVar: startColorVar, _N$startColorVar: startColorVar } }),
            `PS startColorVar (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSstColV</span>
            <input type="color" defaultValue="#000000"
              onChange={e => applyPSStartColorVar(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#000000','#ffffff','#808080','#ff0000','#00ff00'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyPSStartColorVar(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2149: 공통 cc.ParticleSystem endColorVar 일괄 설정 */}
      {(commonCompTypes.includes('cc.ParticleSystem') || commonCompTypes.includes('cc.ParticleSystem2D')) && (() => {
        const applyPSEndColorVar = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const endColorVar = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.ParticleSystem' || c.type === 'cc.ParticleSystem2D'),
            c => ({ ...c, props: { ...c.props, endColorVar, _endColorVar: endColorVar, _N$endColorVar: endColorVar } }),
            `PS endColorVar (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>PSendColV</span>
            <input type="color" defaultValue="#000000"
              onChange={e => applyPSEndColorVar(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#000000','#ffffff','#808080','#ff0000','#00ff00'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyPSEndColorVar(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
    </>
  )
}
