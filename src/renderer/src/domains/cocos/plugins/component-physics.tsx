import React from 'react'
import type { ComponentSectionProps } from './component-shared'
import { t } from '../../../utils/i18n'

export function PhysicsSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R1881: 공통 cc.RigidBody type 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBType = async (type: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, type, _type: type, _N$type: type } }),
            `R B Type`,
          )
          const names = ['Dynamic', 'Static', 'Kinematic']
          setBatchMsg(`✓ RigidBody type=${names[type] ?? type} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBtype</span>
            {(['Dyn', 'Sta', 'Kin'] as const).map((l, v) => (
              <span key={v} title={`RigidBody type = ${['Dynamic','Static','Kinematic'][v]}`}
                onClick={() => applyRBType(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1871: 공통 cc.RigidBody mass 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBMass = async (mass: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, mass, _mass: mass, _N$mass: mass } }),
            `RigidBody mass ${mass} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RB mass</span>
            {([0.1, 0.5, 1, 2, 5, 10] as const).map(v => (
              <span key={v} title={`mass = ${v}`}
                onClick={() => applyRBMass(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1857: 공통 cc.RigidBody gravityScale 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBGravScale = async (gs: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, gravityScale: gs, _gravityScale: gs, _N$gravityScale: gs } }),
            `RigidBody gravityScale ${gs} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>gravSc</span>
            {([0, 0.5, 1, 2] as const).map(v => (
              <span key={v} title={`gravityScale = ${v}`}
                onClick={() => applyRBGravScale(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1851: 공통 cc.RigidBody fixedRotation 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBFixRot = async (fixedRotation: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, fixedRotation, _fixedRotation: fixedRotation, _N$fixedRotation: fixedRotation } }),
            `RigidBody fixedRotation=${fixedRotation} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>fixRot</span>
            <span onClick={() => applyRBFixRot(true)} title="fixedRotation = true" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>lock✓</span>
            <span onClick={() => applyRBFixRot(false)} title="fixedRotation = false" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>lock✗</span>
          </div>
        )
      })()}
      {/* R1824: 공통 cc.RigidBody linearDamping 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBDamp = async (linearDamping: number) => {
          if (!sceneFile.root || isNaN(linearDamping)) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, linearDamping, _linearDamping: linearDamping, _N$linearDamping: linearDamping } }),
            `RigidBody linearDamping ${linearDamping} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>RB damp</span>
            {([0, 0.1, 0.5, 1, 5] as const).map(v => (
              <span key={v} title={`linearDamping = ${v}`}
                onClick={() => applyRBDamp(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
            <input type="number" placeholder="?" step={0.1} min={0}
              style={{ width: 36, fontSize: 8, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text)', padding: '1px 3px' }}
              onKeyDown={e => { if (e.key === 'Enter') { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) { applyRBDamp(v);(e.target as HTMLInputElement).value = '' } } }}
              onBlur={e => { if (e.target.value) { applyRBDamp(parseFloat(e.target.value)); e.target.value = '' } }}
              title={t('batch.c_physics.t_lineardamping_enter', 'linearDamping 직접 입력 후 Enter')}
            />
          </div>
        )
      })()}
      {/* R1898: 공통 cc.RigidBody angularDamping 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyAngularDamp = async (angularDamping: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, angularDamping, _angularDamping: angularDamping, _N$angularDamping: angularDamping } }),
            `Angular Damp`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>RB angD</span>
            {([0, 0.1, 0.5, 1, 5] as const).map(v => (
              <span key={v} title={`angularDamping = ${v}`}
                onClick={() => applyAngularDamp(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1917: 공통 cc.RigidBody bullet 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBBullet = async (bullet: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, bullet, _bullet: bullet, _N$bullet: bullet } }),
            `RigidBody bullet=${bullet} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBbullet</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`bullet = ${v}`}
                onClick={() => applyRBBullet(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'blt✓' : 'blt✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1922: 공통 cc.RigidBody allowSleep 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBSleep = async (allowSleep: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, allowSleep, _allowSleep: allowSleep, _N$allowSleep: allowSleep } }),
            `RigidBody allowSleep=${allowSleep} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBsleep</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`allowSleep = ${v}`}
                onClick={() => applyRBSleep(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v ? 'slp✓' : 'slp✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1939: 공통 cc.RigidBody linearVelocity 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBLinearVel = async (x: number, y: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const vel = { x, y }
            const components = n.components.map(c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D') ? { ...c, props: { ...c.props, linearVelocity: vel, _linearVelocity: vel, _N$linearVelocity: vel } } : c)
            return { ...n, components }
          }, `RigidBody vel=(${x},${y}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBvel</span>
            {([0, 1, 5, 10] as const).map(v => (
              <span key={v} title={`linearVelocity = {x:0,y:${v}}`}
                onClick={() => applyRBLinearVel(0, v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >↑{v}</span>
            ))}
            <span title="stop" onClick={() => applyRBLinearVel(0, 0)}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>■</span>
          </div>
        )
      })()}
      {/* R1953: 공통 cc.RigidBody angularVelocity 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBAngVel = async (angularVelocity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, angularVelocity, _angularVelocity: angularVelocity } }),
            `RigidBody angVel=${angularVelocity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBangVel</span>
            {([-90, -45, 0, 45, 90] as const).map(v => (
              <span key={v} title={`angularVelocity = ${v}`}
                onClick={() => applyRBAngVel(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1968: 공통 cc.RigidBody fixedRotation 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBFixedRot = async (fixedRotation: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, fixedRotation, _fixedRotation: fixedRotation } }),
            `RigidBody fixedRotation=${fixedRotation} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBfxRot</span>
            <span onClick={() => applyRBFixedRot(true)} title="fixedRotation ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>fix✓</span>
            <span onClick={() => applyRBFixedRot(false)} title="fixedRotation OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>fix✗</span>
          </div>
        )
      })()}
      {/* R2070: 공통 cc.RigidBody angularDamping 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBAngDamp = async (angularDamping: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, angularDamping, _angularDamping: angularDamping, _N$angularDamping: angularDamping } }),
            `RigidBody angularDamping=${angularDamping} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBangD</span>
            {[0, 0.1, 0.5, 1, 2, 5].map(v => (
              <span key={v} title={`angularDamping = ${v}`}
                onClick={() => applyRBAngDamp(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2069: 공통 cc.RigidBody linearDamping 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBLinearDamp = async (linearDamping: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, linearDamping, _linearDamping: linearDamping, _N$linearDamping: linearDamping } }),
            `RigidBody linearDamping=${linearDamping} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBlinD</span>
            {[0, 0.1, 0.5, 1, 2, 5].map(v => (
              <span key={v} title={`linearDamping = ${v}`}
                onClick={() => applyRBLinearDamp(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2217: 공통 cc.RigidBody enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `RigidBody enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyRBEnabled(v)} title={`RigidBody enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2009: 공통 cc.RigidBody enabledContactListener 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBContactListener = async (enabledContactListener: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, enabledContactListener, _enabledContactListener: enabledContactListener, _N$enabledContactListener: enabledContactListener } }),
            `RigidBody contactListener=${enabledContactListener} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBcont</span>
            <span onClick={() => applyRBContactListener(true)} title="enabledContactListener ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>cb✓</span>
            <span onClick={() => applyRBContactListener(false)} title="enabledContactListener OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>cb✗</span>
          </div>
        )
      })()}
      {/* R1975: 공통 cc.RigidBody awake 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBAwake = async (awake: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, awake, _awake: awake, _N$awake: awake } }),
            `RigidBody awake=${awake} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBawake</span>
            <span onClick={() => applyRBAwake(true)} title="awake ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>awk✓</span>
            <span onClick={() => applyRBAwake(false)} title="awake OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>awk✗</span>
          </div>
        )
      })()}
      {/* R1997: 공통 cc.RigidBody sleepThreshold 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBSleepThresh = async (sleepThreshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, sleepThreshold, _sleepThreshold: sleepThreshold, _N$sleepThreshold: sleepThreshold } }),
            `RigidBody sleepThreshold=${sleepThreshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBsleep</span>
            {[0.005, 0.01, 0.05, 0.1, 0.5].map(v => (
              <span key={v} onClick={() => applyRBSleepThresh(v)} title={`sleepThreshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2129: 공통 cc.RigidBody angularVelocityLimit 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBAngVelLim = async (angularVelocityLimit: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, angularVelocityLimit, _angularVelocityLimit: angularVelocityLimit } }),
            `RigidBody angularVelocityLimit=${angularVelocityLimit} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBangV</span>
            {[0, 1, 5, 10, 50, 100].map(v => (
              <span key={v} onClick={() => applyRBAngVelLim(v)} title={`angularVelocityLimit=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2128: 공통 cc.RigidBody linearVelocityLimit 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBLinVelLim = async (linearVelocityLimit: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, linearVelocityLimit, _linearVelocityLimit: linearVelocityLimit } }),
            `RigidBody linearVelocityLimit=${linearVelocityLimit} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBlinV</span>
            {[0, 1, 5, 10, 50, 100].map(v => (
              <span key={v} onClick={() => applyRBLinVelLim(v)} title={`linearVelocityLimit=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2161: 공통 cc.RigidBody group 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBGroup = async (group: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, group, _group: group } }),
            `RigidBody group=${group} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBGrp</span>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <span key={v} onClick={() => applyRBGroup(v)} title={`group=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2170: 공통 cc.RigidBody rotationOffset 일괄 설정 */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBRotOffset = async (rotationOffset: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, rotationOffset, _rotationOffset: rotationOffset } }),
            `RigidBody rotationOffset=${rotationOffset} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBrotOff</span>
            {[0, 30, 45, 90, 180, -90].map(v => (
              <span key={v} onClick={() => applyRBRotOffset(v)} title={`rotationOffset=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2176: 공통 Collider category 일괄 설정 */}
      {(commonCompTypes.some(t => ['cc.BoxCollider','cc.BoxCollider2D','cc.CircleCollider','cc.CircleCollider2D','cc.PolygonCollider','cc.PolygonCollider2D'].includes(t))) && (() => {
        const COLLIDER_TYPES_176 = ['cc.BoxCollider','cc.BoxCollider2D','cc.CircleCollider','cc.CircleCollider2D','cc.PolygonCollider','cc.PolygonCollider2D']
        const applyColliderCategory = async (category: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => COLLIDER_TYPES_176.includes(c.type),
            c => ({ ...c, props: { ...c.props, category, _category: category } }),
            `Collider category=${category} (${uuids.length}개)`,
          )
        }
        const applyColliderMask = async (mask: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => COLLIDER_TYPES_176.includes(c.type),
            c => ({ ...c, props: { ...c.props, mask, _mask: mask } }),
            `Collider mask=${mask} (${uuids.length}개)`,
          )
        }
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>ColCat</span>
              {[0, 1, 2, 4, 8, -1].map(v => (
                <span key={v} onClick={() => applyColliderCategory(v)} title={`category=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>ColMask</span>
              {[0, 1, 2, 4, 8, -1].map(v => (
                <span key={v} onClick={() => applyColliderMask(v)} title={`mask=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
          </>
        )
      })()}
      {/* R2162: 공통 cc.BoxCollider/CircleCollider/PolygonCollider tag 일괄 설정 */}
      {(commonCompTypes.some(t => ['cc.BoxCollider','cc.BoxCollider2D','cc.CircleCollider','cc.CircleCollider2D','cc.PolygonCollider','cc.PolygonCollider2D'].includes(t))) && (() => {
        const COLLIDER_TYPES = ['cc.BoxCollider','cc.BoxCollider2D','cc.CircleCollider','cc.CircleCollider2D','cc.PolygonCollider','cc.PolygonCollider2D']
        const applyColliderTag = async (tag: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => COLLIDER_TYPES.includes(c.type),
            c => ({ ...c, props: { ...c.props, tag, _tag: tag } }),
            `Collider tag=${tag} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>ColTag</span>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <span key={v} onClick={() => applyColliderTag(v)} title={`collider tag=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2193: 공통 cc.Mask enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Mask') && (() => {
        const applyMaskEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Mask',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Mask enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>MskComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyMaskEnabled(v)} title={`Mask enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1863: 공통 cc.Mask type 일괄 설정 */}
      {commonCompTypes.includes('cc.Mask') && (() => {
        const applyMaskType = async (type: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Mask',
            c => ({ ...c, props: { ...c.props, type, _type: type, _N$type: type } }),
            `Mask Type`,
          )
          const names = ['Rect','Ellipse','Image']
          setBatchMsg(`✓ Mask type=${names[type] ?? type} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>MaskType</span>
            {(['Rect','Ellipse','Image'] as const).map((l, v) => (
              <span key={v} title={`Mask type = ${l}`}
                onClick={() => applyMaskType(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1852: 공통 cc.Mask inverted 일괄 설정 */}
      {commonCompTypes.includes('cc.Mask') && (() => {
        const applyMaskInvert = async (inverted: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Mask',
            c => ({ ...c, props: { ...c.props, inverted, _inverted: inverted, _N$inverted: inverted } }),
            `Mask inverted=${inverted} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Mask</span>
            <span onClick={() => applyMaskInvert(true)} title="inverted ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>inv✓</span>
            <span onClick={() => applyMaskInvert(false)} title="inverted OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>inv✗</span>
          </div>
        )
      })()}
      {/* R1988: 공통 cc.Mask alphaThreshold 일괄 설정 */}
      {commonCompTypes.includes('cc.Mask') && (() => {
        const applyMaskAlpha = async (alphaThreshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Mask',
            c => ({ ...c, props: { ...c.props, alphaThreshold, _alphaThreshold: alphaThreshold, _N$alphaThreshold: alphaThreshold } }),
            `Mask alphaThreshold=${alphaThreshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>MaskAlph</span>
            {[0, 0.1, 0.3, 0.5, 1].map(v => (
              <span key={v} onClick={() => applyMaskAlpha(v)} title={`alphaThreshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1872: 공통 cc.BoxCollider/CircleCollider sensor 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D') || commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const hasBox = commonCompTypes.some(t => t === 'cc.BoxCollider' || t === 'cc.BoxCollider2D')
        const hasCircle = commonCompTypes.some(t => t === 'cc.CircleCollider' || t === 'cc.CircleCollider2D')
        const colliderTypes = [
          ...(hasBox ? ['cc.BoxCollider', 'cc.BoxCollider2D'] : []),
          ...(hasCircle ? ['cc.CircleCollider', 'cc.CircleCollider2D'] : []),
        ]
        const applyColliderSensor = async (sensor: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => colliderTypes.includes(c.type),
            c => ({ ...c, props: { ...c.props, sensor, _sensor: sensor, _N$sensor: sensor } }),
            `Collider sensor=${sensor} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>Sensor</span>
            <span onClick={() => applyColliderSensor(true)} title="sensor ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>ON✓</span>
            <span onClick={() => applyColliderSensor(false)} title="sensor OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>OFF✗</span>
          </div>
        )
      })()}
      {/* R2039: 공통 cc.CircleCollider offset 일괄 설정 */}
      {commonCompTypes.includes('cc.CircleCollider') && (() => {
        const applyCircleOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => c.type === 'cc.CircleCollider' ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `CircleCollider offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CircOff</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0]] as [string,number,number][]).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyCircleOffset(ox, oy)} title={`offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R1995: 공통 cc.CircleCollider radius 일괄 설정 */}
      {(commonCompTypes.includes('cc.CircleCollider') || commonCompTypes.includes('cc.CircleCollider2D')) && (() => {
        const applyCircleRadius = async (radius: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.CircleCollider' || c.type === 'cc.CircleCollider2D'),
            c => ({ ...c, props: { ...c.props, radius, _radius: radius, _N$radius: radius } }),
            `CircleCollider radius=${radius} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>CirRad</span>
            {[25, 50, 75, 100, 150].map(v => (
              <span key={v} onClick={() => applyCircleRadius(v)} title={`radius=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2038: 공통 cc.BoxCollider offset 일괄 설정 */}
      {commonCompTypes.includes('cc.BoxCollider') && (() => {
        const applyBoxOffset = async (ox: number, oy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const offset = { x: ox, y: oy }
            const components = n.components.map(c => c.type === 'cc.BoxCollider' ? { ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } } : c)
            return { ...n, components }
          }, `BoxCollider offset=(${ox},${oy}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>BoxOff</span>
            {([['0,0',0,0],['0,10',0,10],['0,-10',0,-10],['10,0',10,0],['reset',0,0]] as [string,number,number][]).slice(0,4).map(([label,ox,oy]) => (
              <span key={label} onClick={() => applyBoxOffset(ox, oy)} title={`offset=(${ox},${oy})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R1994: 공통 cc.BoxCollider size 일괄 설정 */}
      {(commonCompTypes.includes('cc.BoxCollider') || commonCompTypes.includes('cc.BoxCollider2D')) && (() => {
        const boxType = commonCompTypes.includes('cc.BoxCollider') ? 'cc.BoxCollider' : 'cc.BoxCollider2D'
        const applyBoxSize = async (w: number, h: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.BoxCollider' || c.type === 'cc.BoxCollider2D'),
            c => ({ ...c, props: { ...c.props, size: { width: w, height: h }, _size: { width: w, height: h }, _N$size: { width: w, height: h } } }),
            `BoxCollider size=${w}×${h} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>BoxSize</span>
            {([[50,50],[100,100],[200,100],[100,200]] as const).map(([w, h]) => (
              <span key={`${w}x${h}`} onClick={() => applyBoxSize(w, h)} title={`size=${w}×${h}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{w}×{h}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
