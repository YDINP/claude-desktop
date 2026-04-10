import React from 'react'
import type { ComponentSectionProps } from './component-shared'
import { t } from '../../../utils/i18n'

export function ScrollViewSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R1859: 공통 cc.ScrollView horizontal/vertical/inertia 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollToggle = async (key: 'horizontal' | 'vertical' | 'inertia', value: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, [key]: value, [`_${key}`]: value, [`_N$${key}`]: value } }),
            `ScrollView ${key}=${value} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>ScrollV</span>
            <span onClick={() => applyScrollToggle('horizontal', true)} title="horizontal ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>H✓</span>
            <span onClick={() => applyScrollToggle('horizontal', false)} title="horizontal OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>H✗</span>
            <span onClick={() => applyScrollToggle('vertical', true)} title="vertical ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>V✓</span>
            <span onClick={() => applyScrollToggle('vertical', false)} title="vertical OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>V✗</span>
            <span onClick={() => applyScrollToggle('inertia', true)} title="inertia ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>iner✓</span>
            <span onClick={() => applyScrollToggle('inertia', false)} title="inertia OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>iner✗</span>
          </div>
        )
      })()}
      {/* R1876: 공통 cc.ScrollView brake 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollBrake = async (brake: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, brake, _brake: brake, _N$brake: brake } }),
            `ScrollView brake=${brake} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVbrake</span>
            {([0, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`brake = ${v}`}
                onClick={() => applyScrollBrake(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1935: 공통 cc.ScrollView elastic 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollElastic = async (elastic: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, elastic, _elastic: elastic, _N$elastic: elastic } }),
            `ScrollView elastic=${elastic} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVelast</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`elastic = ${v}`}
                onClick={() => applyScrollElastic(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v ? 'el✓' : 'el✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1928: 공통 cc.ScrollView elasticDuration 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyElasticDur = async (elasticDuration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, elasticDuration, _elasticDuration: elasticDuration, _N$elasticDuration: elasticDuration } }),
            `ScrollView elasticDuration=${elasticDuration} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVelast</span>
            {([0.1, 0.2, 0.3, 0.5, 1] as const).map(v => (
              <span key={v} title={`elasticDuration = ${v}s`}
                onClick={() => applyElasticDur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1949: 공통 cc.ScrollView bounceDuration 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVBounceDur = async (bounceDuration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, bounceDuration, _bounceDuration: bounceDuration, _N$bounceDuration: bounceDuration } }),
            `ScrollView bounceDur=${bounceDuration}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVbounce</span>
            {([0.1, 0.2, 0.3, 0.5, 1] as const).map(v => (
              <span key={v} title={`bounceDuration = ${v}s`}
                onClick={() => applySVBounceDur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2169: 공통 cc.ScrollView scrollDuration 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVScrollDur = async (scrollDuration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, scrollDuration, _scrollDuration: scrollDuration, _N$scrollDuration: scrollDuration } }),
            `ScrollView scrollDuration=${scrollDuration}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVsdur</span>
            {[0, 0.1, 0.3, 0.5, 1].map(v => (
              <span key={v} onClick={() => applySVScrollDur(v)} title={`scrollDuration=${v}s`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R2181: 공통 cc.ScrollView mouseWheelScrollSensitivity 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVMouseWheelSens = async (mouseWheelScrollSensitivity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, mouseWheelScrollSensitivity, _mouseWheelScrollSensitivity: mouseWheelScrollSensitivity, _N$mouseWheelScrollSensitivity: mouseWheelScrollSensitivity } }),
            `ScrollView mouseWheelSens=${mouseWheelScrollSensitivity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVwhl</span>
            {[0.5, 1, 2, 3, 5, 10].map(v => (
              <span key={v} onClick={() => applySVMouseWheelSens(v)} title={`mouseWheelScrollSensitivity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2193: 공통 cc.ScrollView enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `ScrollView enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySVEnabled(v)} title={`ScrollView enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2180: 공통 cc.ScrollView hideScrollBar 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVHideScrollBar = async (hideScrollBar: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, hideScrollBar, _hideScrollBar: hideScrollBar, _N$hideScrollBar: hideScrollBar } }),
            `ScrollView hideScrollBar=${hideScrollBar} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVhide</span>
            {([['hide✓', true], ['hide✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySVHideScrollBar(v)} title={`hideScrollBar=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2185: 공통 cc.ScrollBar enableAutoHide + autoHideTime 일괄 설정 */}
      {commonCompTypes.includes('cc.Scrollbar') && (() => {
        const applySBAutoHide = async (enableAutoHide: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => ({ ...c, props: { ...c.props, enableAutoHide, _enableAutoHide: enableAutoHide, _N$enableAutoHide: enableAutoHide } }),
            `Scrollbar enableAutoHide=${enableAutoHide} (${uuids.length}개)`,
          )
        }
        const applySBAutoHideTime = async (autoHideTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => ({ ...c, props: { ...c.props, autoHideTime, _autoHideTime: autoHideTime, _N$autoHideTime: autoHideTime } }),
            `Scrollbar autoHideTime=${autoHideTime} (${uuids.length}개)`,
          )
        }
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SBhide</span>
              {([['hide✓', true], ['hide✗', false]] as const).map(([l, v]) => (
                <span key={String(v)} onClick={() => applySBAutoHide(v)} title={`enableAutoHide=${v}`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SBhideT</span>
              {[0.5, 1, 2, 3, 5].map(v => (
                <span key={v} onClick={() => applySBAutoHideTime(v)} title={`autoHideTime=${v}s`}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
              ))}
            </div>
          </>
        )
      })()}
      {/* R2198: 공통 cc.Scrollbar enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Scrollbar') && (() => {
        const applyScrollbarEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Scrollbar enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SBComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyScrollbarEnabled(v)} title={`Scrollbar enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2186: 공통 cc.Scrollbar direction 일괄 설정 */}
      {commonCompTypes.includes('cc.Scrollbar') && (() => {
        const applySBDir = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => ({ ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } }),
            `Scrollbar direction=${direction === 0 ? 'H' : 'V'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SBdir</span>
            <span onClick={() => applySBDir(0)} title="direction=Horizontal"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>H→</span>
            <span onClick={() => applySBDir(1)} title="direction=Vertical"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>V↓</span>
          </div>
        )
      })()}
      {/* R2174: 공통 cc.ScrollView bounceTime 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVBounceTime = async (bounceTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, bounceTime, _bounceTime: bounceTime, _N$bounceTime: bounceTime } }),
            `ScrollView bounceTime=${bounceTime} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVbncT</span>
            {[0, 0.1, 0.2, 0.5, 1].map(v => (
              <span key={v} onClick={() => applySVBounceTime(v)} title={`bounceTime=${v}s`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2065: 공통 cc.ScrollView bounce 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollBounce = async (bounce: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, bounce, _bounce: bounce, _N$bounce: bounce } }),
            `ScrollView bounce=${bounce} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVbnce</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`bounce = ${v}`}
                onClick={() => applyScrollBounce(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v ? 'bnc✓' : 'bnc✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2104: 공통 cc.ScrollView inertia 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applyScrollInertia = async (inertia: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, inertia, _inertia: inertia } }),
            `ScrollView inertia=${inertia} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVInert</span>
            <span onClick={() => applyScrollInertia(true)} title="inertia ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>ine✓</span>
            <span onClick={() => applyScrollInertia(false)} title="inertia OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>ine✗</span>
          </div>
        )
      })()}
      {/* R2115: 공통 cc.ScrollView horizontal 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVHoriz = async (horizontal: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, horizontal, _horizontal: horizontal, _N$horizontal: horizontal } }),
            `ScrollView horizontal=${horizontal} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVHoriz</span>
            <span onClick={() => applySVHoriz(true)} title="horizontal ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>H✓</span>
            <span onClick={() => applySVHoriz(false)} title="horizontal OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>H✗</span>
          </div>
        )
      })()}
      {/* R2116: 공통 cc.ScrollView vertical 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVVert = async (vertical: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, vertical, _vertical: vertical, _N$vertical: vertical } }),
            `ScrollView vertical=${vertical} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVVert</span>
            <span onClick={() => applySVVert(true)} title="vertical ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>V✓</span>
            <span onClick={() => applySVVert(false)} title="vertical OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>V✗</span>
          </div>
        )
      })()}
      {/* R2168: 공통 cc.ScrollView cancelInnerEvents 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVCancelInner = async (cancelInnerEvents: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, cancelInnerEvents, _cancelInnerEvents: cancelInnerEvents, _N$cancelInnerEvents: cancelInnerEvents } }),
            `ScrollView cancelInnerEvents=${cancelInnerEvents} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>SVCancel</span>
            <span onClick={() => applySVCancelInner(true)} title="cancelInnerEvents ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>cin✓</span>
            <span onClick={() => applySVCancelInner(false)} title="cancelInnerEvents OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>cin✗</span>
          </div>
        )
      })()}
      {/* R2004: 공통 cc.ScrollView pagingEnabled 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVPaging = async (pagingEnabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, pagingEnabled, _pagingEnabled: pagingEnabled, _N$pagingEnabled: pagingEnabled } }),
            `ScrollView paging=${pagingEnabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVpaging</span>
            <span onClick={() => applySVPaging(true)} title="pagingEnabled ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>pg✓</span>
            <span onClick={() => applySVPaging(false)} title="pagingEnabled OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>pg✗</span>
          </div>
        )
      })()}
      {/* R1980: 공통 cc.ScrollView speedAmplifier 일괄 설정 */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVSpeed = async (speedAmplifier: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, speedAmplifier, _speedAmplifier: speedAmplifier, _N$speedAmplifier: speedAmplifier } }),
            `ScrollView speedAmplifier=${speedAmplifier} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVspeed</span>
            {([0.5, 1, 1.5, 2, 3] as const).map(v => (
              <span key={v} onClick={() => applySVSpeed(v)} title={`speedAmplifier = ${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R2077: 공통 cc.PageView pageTurningSpeed 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVTurnSpeed = async (pageTurningSpeed: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, pageTurningSpeed, _pageTurningSpeed: pageTurningSpeed, _N$pageTurningSpeed: pageTurningSpeed } }),
            `PageView pageTurningSpeed=${pageTurningSpeed} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>PVspd</span>
            {[0.1, 0.3, 0.5, 1, 1.5, 2].map(v => (
              <span key={v} title={`pageTurningSpeed = ${v}`}
                onClick={() => applyPVTurnSpeed(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2200: 공통 cc.PageView enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `PageView enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PVComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyPVEnabled(v)} title={`PageView enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2180: 공통 cc.PageView effectType 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVEffectType = async (effectType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, effectType, _effectType: effectType, _N$effectType: effectType } }),
            `PageView effectType=${['NONE','SCROLL','FADE'][effectType] ?? effectType} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PVeffect</span>
            {([['NONE', 0], ['SCROLL', 1], ['FADE', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyPVEffectType(v)} title={`effectType=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2067: 공통 cc.PageView direction 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPageViewDir = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } }),
            `PageView direction=${direction} (${uuids.length}개)`,
          )
        }
        // 0=Horizontal, 1=Vertical
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>PVdir</span>
            {([0, 1] as const).map((v, i) => (
              <span key={v} title={`direction = ${v} (${['Horizontal','Vertical'][i]})`}
                onClick={() => applyPageViewDir(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{['H','V'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R1936: 공통 cc.PageView bounceEnabled 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVBounce = async (v: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, bounceEnabled: v, _bounceEnabled: v, _N$bounceEnabled: v } }),
            `PageView bounce=${v} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVbounce</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`bounceEnabled = ${v}`}
                onClick={() => applyPVBounce(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v ? 'bnc✓' : 'bnc✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2111: 공통 cc.PageView autoPageTurningThreshold 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVAutoThresh = async (threshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, autoPageTurningThreshold: threshold, _autoPageTurningThreshold: threshold, _N$autoPageTurningThreshold: threshold } }),
            `PageView autoPageTurningThreshold=${threshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVAutoT</span>
            {[0.1, 0.2, 0.3, 0.5, 0.7, 1].map(v => (
              <span key={v} onClick={() => applyPVAutoThresh(v)} title={`autoPageTurningThreshold=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1967: 공통 cc.PageView scrollThreshold 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVScrollThresh = async (threshold: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, scrollThreshold: threshold, _scrollThreshold: threshold, _N$scrollThreshold: threshold } }),
            `PageView scrollThresh=${threshold} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVthresh</span>
            {([0.1, 0.2, 0.3, 0.5] as const).map(v => (
              <span key={v} title={`scrollThreshold = ${v}`}
                onClick={() => applyPVScrollThresh(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2206: 공통 cc.PageView autoPlay 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVAutoPlay = async (autoPlay: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, autoPlay, _autoPlay: autoPlay } }),
            `PageView autoPlay=${autoPlay} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PVauto</span>
            {([['auto✓', true], ['auto✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyPVAutoPlay(v)} title={`autoPlay=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1966: 공통 cc.PageView autoPageTurningInterval 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVAutoInterval = async (interval: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, autoPageTurningInterval: interval, _autoPageTurningInterval: interval, _N$autoPageTurningInterval: interval } }),
            `PageView autoInterval=${interval}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVauto</span>
            {([0, 1, 2, 3, 5] as const).map(v => (
              <span key={v} title={`autoPageTurningInterval = ${v}s`}
                onClick={() => applyPVAutoInterval(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R1991: 공통 cc.PageView pageTurningEventTiming 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVEventTiming = async (pageTurningEventTiming: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, pageTurningEventTiming, _pageTurningEventTiming: pageTurningEventTiming, _N$pageTurningEventTiming: pageTurningEventTiming } }),
            `PageView eventTiming=${pageTurningEventTiming} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVevTim</span>
            {([0, 0.1, 0.2, 0.3, 0.5, 1].map(v => (
              <span key={v} onClick={() => applyPVEventTiming(v)} title={`pageTurningEventTiming=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            )))}
          </div>
        )
      })()}
      {/* R1875: 공통 cc.PageView slideDuration 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVSlideDur = async (dur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, slideDuration: dur, _slideDuration: dur, _N$slideDuration: dur } }),
            `PageView slideDur ${dur}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PVslide</span>
            {([0.1, 0.2, 0.3, 0.5, 1] as const).map(v => (
              <span key={v} title={`slideDuration = ${v}s`}
                onClick={() => applyPVSlideDur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R1858: 공통 cc.PageView direction 일괄 설정 */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVDir = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } }),
            `PageView dir=${direction === 0 ? 'H' : 'V'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>PageView</span>
            <span onClick={() => applyPVDir(0)} title={t('batch.c_scrollview.t_dir_horizontal', '방향: Horizontal')} style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>H→</span>
            <span onClick={() => applyPVDir(1)} title={t('batch.c_scrollview.t_dir_vertical', '방향: Vertical')} style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>V↓</span>
          </div>
        )
      })()}
    </>
  )
}
