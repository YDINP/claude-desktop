import React, { useState } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import type { ComponentSectionProps } from './component-shared'
import { mkBtnS, mkNiS } from './component-shared'

export function Cc3xTailSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg, onMultiSelectChange }: ComponentSectionProps) {
  const [batchScaleX, setBatchScaleX] = useState<string>('')
  const [batchScaleY, setBatchScaleY] = useState<string>('')
  const [scaleLinked, setScaleLinked] = useState(false)
  const [batchAnchorCompensate, setBatchAnchorCompensate] = useState(true)
  const [batchAnchor, setBatchAnchor] = useState<{ x: number; y: number } | null>(null)
  const [fixedSizeW, setFixedSizeW] = useState<number>(100)
  const [fixedSizeH, setFixedSizeH] = useState<number>(100)
  const [fixedSizeApplyW, setFixedSizeApplyW] = useState<boolean>(true)
  const [fixedSizeApplyH, setFixedSizeApplyH] = useState<boolean>(true)
  const [scaleMulInput, setScaleMulInput] = useState<string>('2')
  const [sizeMulInput, setSizeMulInput] = useState<string>('2')
  const [batchLayer, setBatchLayer] = useState<string>('')
  const [condActivePattern, setCondActivePattern] = useState<string>('')
  const [condActiveValue, setCondActiveValue] = useState<'active' | 'inactive'>('active')
  const [batchActive, setBatchActive] = useState<'active' | 'inactive' | ''>('')
  const [batchAddComp, setBatchAddComp] = useState<string>('')
  const [genericCompType, setGenericCompType] = useState<string>('')
  const [genericPropName, setGenericPropName] = useState<string>('')
  const [genericPropVal, setGenericPropVal] = useState<string>('')
  return (
    <>
      {/* R2232: 공통 cc.RigidBody _gravityScale 일괄 설정 (CC3.x) */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBGravScale3 = async (gravityScale: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, gravityScale, _gravityScale: gravityScale } }),
            `RigidBody _gravityScale=${gravityScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBGrv3</span>
            {[0, 0.5, 1, 2, 5, 10].map(v => (
              <span key={v} onClick={() => applyRBGravScale3(v)} title={`_gravityScale=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2232: 공통 cc.Scrollbar _autoHideTime 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Scrollbar') && (() => {
        const applySBAutoHideTime3 = async (autoHideTime: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Scrollbar',
            c => ({ ...c, props: { ...c.props, autoHideTime, _autoHideTime: autoHideTime, _N$autoHideTime: autoHideTime } }),
            `Scrollbar _autoHideTime=${autoHideTime} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>SBHideT3</span>
            {[0, 0.5, 1, 2, 3].map(v => (
              <span key={v} onClick={() => applySBAutoHideTime3(v)} title={`_autoHideTime=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2233: 공통 cc.PageView _bounceEnabled 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.PageView') && (() => {
        const applyPVBounce3 = async (v: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.PageView',
            c => ({ ...c, props: { ...c.props, bounceEnabled: v, _bounceEnabled: v, _N$bounceEnabled: v } }),
            `PageView _bounceEnabled=${v} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PVbnc3</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} onClick={() => applyPVBounce3(v)} title={`_bounceEnabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v ? '✓' : '✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2233: 공통 cc.ToggleContainer _allowSwitchOff 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.ToggleContainer') && (() => {
        const applyTCAllowSwitch3 = async (allowSwitchOff: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ToggleContainer',
            c => ({ ...c, props: { ...c.props, allowSwitchOff, _allowSwitchOff: allowSwitchOff } }),
            `ToggleContainer _allowSwitchOff=${allowSwitchOff} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TCswitch3</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} onClick={() => applyTCAllowSwitch3(v)} title={`_allowSwitchOff=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v ? '✓' : '✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2234: 공통 cc.RichText _overflow 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.RichText') && (() => {
        const applyRTOverflow3 = async (overflow: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.RichText',
            c => ({ ...c, props: { ...c.props, overflow, _overflow: overflow, _N$overflow: overflow } }),
            `RichText _overflow=${overflow} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#67e8f9', width: 48, flexShrink: 0 }}>RTOvfl3</span>
            {([['None', 0], ['Clamp', 1], ['Shrink', 2], ['Rsz', 3]] as [string, number][]).map(([l, v]) => (
              <span key={v} onClick={() => applyRTOverflow3(v)} title={`_overflow=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#67e8f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2234: 공통 cc.Canvas _fitWidth/_fitHeight 동시 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Canvas') && (() => {
        const applyCanvasFit3 = async (fitWidth: boolean, fitHeight: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Canvas',
            c => ({ ...c, props: { ...c.props, fitWidth, _fitWidth: fitWidth, fitHeight, _fitHeight: fitHeight } }),
            `Canvas _fitWidth=${fitWidth} _fitHeight=${fitHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fde68a', width: 48, flexShrink: 0 }}>CanFit3</span>
            <span onClick={() => applyCanvasFit3(true, false)} title="_fitWidth=true _fitHeight=false"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fde68a', userSelect: 'none' }}>W✓H✗</span>
            <span onClick={() => applyCanvasFit3(false, true)} title="_fitWidth=false _fitHeight=true"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fde68a', userSelect: 'none' }}>W✗H✓</span>
            <span onClick={() => applyCanvasFit3(true, true)} title="_fitWidth=true _fitHeight=true"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fde68a', userSelect: 'none' }}>W✓H✓</span>
            <span onClick={() => applyCanvasFit3(false, false)} title="_fitWidth=false _fitHeight=false"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>W✗H✗</span>
          </div>
        )
      })()}
      {/* R2229: 공통 cc.Slider _direction 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderDir3 = async (direction: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, direction, _direction: direction, _N$direction: direction } }),
            `Slider _direction=${direction === 0 ? 'H' : 'V'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SldrDir3</span>
            <span onClick={() => applySliderDir3(0)} title="_direction=Horizontal"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>H→</span>
            <span onClick={() => applySliderDir3(1)} title="_direction=Vertical"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>V↓</span>
          </div>
        )
      })()}
      {/* R2229: 공통 cc.Slider _interactable 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Slider') && (() => {
        const applySliderInteract3 = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Slider',
            c => ({ ...c, props: { ...c.props, interactable, _interactable: interactable, _N$interactable: interactable } }),
            `Slider _interactable=${interactable} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SldrInt3</span>
            <span onClick={() => applySliderInteract3(true)} title="Slider _interactable ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>int✓</span>
            <span onClick={() => applySliderInteract3(false)} title="Slider _interactable OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>int✗</span>
          </div>
        )
      })()}
      {/* R2230: 공통 cc.EditBox _returnType 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditRetType3 = async (returnType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, returnType, _returnType: returnType, _N$returnType: returnType } }),
            `Edit Ret Type3`,
          )
          const names = ['Dflt', 'Done', 'Send', 'Srch', 'Go', 'Next']
          setBatchMsg(`✓ EditBox _returnType=${names[returnType] ?? returnType} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBret3</span>
            {([['Dflt', 0], ['Done', 1], ['Send', 2], ['Go', 4]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyEditRetType3(v)} title={`_returnType=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2230: 공통 cc.Animation _playOnLoad 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Animation') && (() => {
        const applyAnimPOL3 = async (playOnLoad: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Animation',
            c => ({ ...c, props: { ...c.props, playOnLoad, _playOnLoad: playOnLoad } }),
            `Animation _playOnLoad=${playOnLoad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fbbf24', width: 48, flexShrink: 0 }}>AnimPOL3</span>
            <span onClick={() => applyAnimPOL3(true)} title="Animation _playOnLoad ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#fbbf24', userSelect: 'none' }}>pol✓</span>
            <span onClick={() => applyAnimPOL3(false)} title="Animation _playOnLoad OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>pol✗</span>
          </div>
        )
      })()}
      {/* R2231: 공통 cc.TiledLayer _opacity 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.TiledLayer') && (() => {
        const applyTiledLayerOpa3 = async (opacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.TiledLayer',
            c => ({ ...c, props: { ...c.props, opacity, _opacity: opacity } }),
            `TiledLayer _opacity=${opacity} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>TLOpa3</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <span key={v} onClick={() => applyTiledLayerOpa3(v)} title={`_opacity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2231: 공통 cc.RigidBody _type 일괄 설정 (CC3.x) */}
      {(commonCompTypes.includes('cc.RigidBody') || commonCompTypes.includes('cc.RigidBody2D')) && (() => {
        const applyRBType3 = async (type: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.RigidBody' || c.type === 'cc.RigidBody2D'),
            c => ({ ...c, props: { ...c.props, type, _type: type } }),
            `RigidBody _type=${['Dynamic','Static','Kinematic'][type] ?? type} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f87171', width: 48, flexShrink: 0 }}>RBtype3</span>
            {(['Dyn', 'Sta', 'Kin'] as const).map((l, v) => (
              <span key={v} title={`RigidBody _type=${['Dynamic','Static','Kinematic'][v]}`}
                onClick={() => applyRBType3(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#f87171', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2228: 공통 cc.Toggle _interactable 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Toggle') && (() => {
        const applyToggleInteract3 = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Toggle',
            c => ({ ...c, props: { ...c.props, interactable, _interactable: interactable } }),
            `Toggle _interactable=${interactable} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TogInt3</span>
            <span onClick={() => applyToggleInteract3(true)} title="Toggle _interactable ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>int✓</span>
            <span onClick={() => applyToggleInteract3(false)} title="Toggle _interactable OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>int✗</span>
          </div>
        )
      })()}
      {/* R2228: 공통 cc.ProgressBar _reverse 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBReverse3 = async (reverse: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, reverse, _reverse: reverse, _N$reverse: reverse } }),
            `ProgressBar _reverse=${reverse} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBRev3</span>
            <span onClick={() => applyPBReverse3(true)} title="ProgressBar _reverse ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>rev✓</span>
            <span onClick={() => applyPBReverse3(false)} title="ProgressBar _reverse OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>rev✗</span>
          </div>
        )
      })()}
      {/* R2227: 공통 cc.Button _zoomScale 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnZoom3 = async (zoom: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, zoomScale: zoom, _zoomScale: zoom } }),
            `Button _zoomScale=${zoom} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnZm3</span>
            {([0.9, 1.0, 1.1, 1.2, 1.3, 1.5] as const).map(v => (
              <span key={v} title={`_zoomScale=${v}`}
                onClick={() => applyBtnZoom3(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2227: 공통 cc.ScrollView _brake 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.ScrollView') && (() => {
        const applySVBrake3 = async (brake: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ScrollView',
            c => ({ ...c, props: { ...c.props, brake, _brake: brake, _N$brake: brake } }),
            `ScrollView _brake=${brake} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SVBrk3</span>
            {([0, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`_brake=${v}`}
                onClick={() => applySVBrake3(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2226: 공통 cc.AudioSource _volume 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioVol3 = async (volume: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, volume, _volume: volume } }),
            `AudioSource _volume=${Math.round(volume * 100)}% (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASVol3</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`_volume=${Math.round(v * 100)}%`}
                onClick={() => applyAudioVol3(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}>{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1867: 공통 cc.Sprite blendFactor 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprBlend = async (src: number, dst: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, srcBlendFactor: src, _srcBlendFactor: src, dstBlendFactor: dst, _dstBlendFactor: dst } }),
            `Spr Blend`,
          )
          const names: Record<string, string> = {'770/771': 'Normal', '770/1': 'Add', '774/771': 'Mul'}
          setBatchMsg(`✓ Sprite blend=${names[`${src}/${dst}`] ?? `${src}/${dst}`} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprBlend</span>
            {([['Normal', 770, 771], ['Add', 770, 1], ['Mul', 774, 771]] as [string, number, number][]).map(([l, src, dst]) => (
              <span key={l} title={`srcBlend=${src} dstBlend=${dst}`}
                onClick={() => applySprBlend(src, dst)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1760: 공통 cc.Sprite tint 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>Sprite 색</span>
          <input type="color" defaultValue="#ffffff"
            onChange={async e => {
              const hex = e.target.value
              if (!sceneFile.root) return
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              await patchComponents(
                c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
                c => ({ ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 } } }),
                `Sprite tint (${uuids.length}개)`,
              )
            }}
            style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
            title="cc.Sprite tint 색상 일괄 설정"
          />
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>tint</span>
        </div>
      )}
      {/* R1803: 공통 cc.Sprite grayscale 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>Sprite gray</span>
          {(['✓ gray', '○ gray'] as const).map(label => (
            <span key={label}
              title={`grayscale 모두 ${label.startsWith('✓') ? '활성' : '비활성'}`}
              onClick={async () => {
                if (!sceneFile.root) return
                const val = label.startsWith('✓')
                await patchComponents(
                  c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
                  c => ({ ...c, props: { ...c.props, grayscale: val, _grayscale: val, _N$grayscale: val } }),
                  `grayscale ${val} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: label.startsWith('✓') ? '#94a3b8' : 'var(--text-muted)', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R1801: 공통 cc.Sprite type 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>Sprite typ</span>
          {([['Smp', 0], ['Slc', 1], ['Til', 2], ['Fil', 3]] as const).map(([l, v]) => (
            <span key={v} title={['Simple', 'Sliced', 'Tiled', 'Filled'][v]}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
                  c => ({ ...c, props: { ...c.props, type: v, _type: v, _N$type: v } }),
                  `Sprite type ${['Simple','Sliced','Tiled','Filled'][v]} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#4ade80')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1762: 공통 cc.Label fontFamily 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label 폰트</span>
          <input type="text" placeholder="fontFamily (빈칸=기본)"
            style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={async e => {
              const ff = e.target.value.trim()
              if (!sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.Label',
                c => ({ ...c, props: { ...c.props, fontFamily: ff, _fontFamily: ff, _N$fontFamily: ff } }),
                `fontFamily "${ff}" (${uuids.length}개)`,
              )
            }}
          />
        </div>
      )}
      {/* R1758: 공통 cc.Label 텍스트 색상 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label 색</span>
          <input type="color" defaultValue="#ffffff"
            onChange={async e => {
              const hex = e.target.value
              if (!sceneFile.root) return
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              await patchComponents(
                c => c.type === 'cc.Label',
                c => ({ ...c, props: { ...c.props, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 } } }),
                `Label 색상 (${uuids.length}개)`,
              )
            }}
            style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
            title="cc.Label 텍스트 색상 일괄 설정"
          />
        </div>
      )}
      {/* R1750: 레이어 일괄 설정 (CC3.x) */}
      {sceneFile.projectInfo?.version === '3x' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>Layer</span>
          <select
            value={batchLayer}
            onChange={async e => {
              const val = e.target.value
              setBatchLayer(val)
              if (!val || !sceneFile.root) return
              const layer = parseInt(val)
              await patchNodes(n => ({ ...n, layer }), `Layer ${layer} (${uuids.length}개)`)
              setBatchLayer('')
            }}
            style={{ flex: 1, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px' }}
          >
            <option value="">(변경 안 함)</option>
            {([[1, 'DEFAULT'], [2, 'IGNORE_RAYCAST'], [16, 'UI_3D'], [524288, 'UI_2D'], [1073741824, 'ALL']] as [number, string][]).map(([v, n]) => (
              <option key={v} value={v}>{n} ({v})</option>
            ))}
          </select>
        </div>
      )}
      {/* Active 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48 }}>Active</span>
        {(['active', 'inactive', ''] as const).map(v => (
          <button
            key={v || 'none'}
            onClick={() => setBatchActive(v)}
            style={{
              fontSize: 9, padding: '1px 6px', cursor: 'pointer', borderRadius: 3,
              background: batchActive === v ? (v === 'active' ? 'rgba(74,222,128,0.25)' : v === 'inactive' ? 'rgba(248,81,73,0.2)' : 'rgba(255,255,255,0.1)') : 'transparent',
              border: batchActive === v ? `1px solid ${v === 'active' ? '#4ade80' : v === 'inactive' ? '#f85149' : '#666'}` : '1px solid transparent',
              color: v === 'active' ? '#4ade80' : v === 'inactive' ? '#f85149' : 'var(--text-muted)',
            }}
          >{v === '' ? '(변경 안 함)' : v === 'active' ? '활성화' : '비활성화'}</button>
        ))}
        {/* R2602: active 반전 */}
        <button
          title={`선택 ${uuids.length}개 노드 active 개별 반전 (R2602)`}
          onClick={async () => {
            if (!sceneFile.root) return
            await patchNodes(n => {
              return { ...n, active: !n.active}
            }, `active 반전 (${uuids.length}개)`)
          }}
          style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', borderRadius: 3, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', background: 'none' }}
        >반전</button>
        {/* R2622: active 교차 패턴 — 홀수 인덱스: 활성, 짝수: 비활성 */}
        {uuids.length >= 2 && (
          <button
            title={`선택 ${uuids.length}개 노드 active 교차 패턴 설정 (홀수=on, 짝수=off) (R2622)`}
            onClick={async () => {
              if (!sceneFile.root) return
              await patchOrdered((n, idx) => {
                return { ...n, active: idx % 2 === 0 }
              }, `active 교차 (${uuids.length}개)`)
            }}
            style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', borderRadius: 3, border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', background: 'none' }}
          >교차</button>
        )}
      </div>
      {/* R2714: 조건부 active 토글 */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, flexWrap: 'wrap', paddingLeft: 52, marginBottom: 4 }}>
        <input
          placeholder="이름 패턴 또는 /regex/"
          value={condActivePattern}
          onChange={e => setCondActivePattern(e.target.value)}
          style={{ ...mkNiS(120), flex: 1 }}
        />
        <button onClick={() => setCondActiveValue('active')}
          style={mkBtnS(condActiveValue === 'active' ? '#22c55e' : '#374151')}>ON</button>
        <button onClick={() => setCondActiveValue('inactive')}
          style={mkBtnS(condActiveValue === 'inactive' ? '#ef4444' : '#374151')}>OFF</button>
        <button
          onClick={async () => {
            if (!condActivePattern.trim() || !sceneFile.root || uuids.length === 0) return
            let re: RegExp
            try {
              const m = condActivePattern.match(/^\/(.+)\/([gi]*)$/)
              re = m ? new RegExp(m[1], m[2] || 'i') : new RegExp(condActivePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            } catch { setBatchMsg('❌ 정규식 오류'); return }
            const targetVal = condActiveValue === 'active'
            let count = 0
            function patch(n: CCSceneNode): CCSceneNode {
              const ch = n.children.map(patch)
              if (!uuidSet.has(n.uuid)) return { ...n, children: ch }
              if (re.test(n.name ?? '')) { count++; return { ...n, active: targetVal, children: ch } }
              return { ...n, children: ch }
            }
            const newRoot = patch(sceneFile.root)
            if (count === 0) { setBatchMsg('⚠ 매칭 없음'); setTimeout(() => setBatchMsg(null), 2000); return }
            await saveScene(newRoot)
            setBatchMsg(`✓ 조건부 ${condActiveValue} ${count}개`)
            setTimeout(() => setBatchMsg(null), 2000)
          }}
          disabled={!condActivePattern.trim()}
        >적용</button>
      </div>
      {/* R2548: 선택 노드 중 cc.Label/cc.RichText 있는 것들에 텍스트 일괄 적용 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const hasLabelNode = uuids.some(u => {
          let found = false
          function find(n: CCSceneNode) { if (n.uuid === u) { found = n.components.some(c => c.type === 'cc.Label' || c.type === 'cc.RichText'); return }; n.children.forEach(find) }
          find(sceneFile.root!)
          return found
        })
        if (!hasLabelNode) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>레이블 (R2548)</span>
            <input
              placeholder="텍스트 일괄 적용 (Enter)"
              title="선택 노드 중 cc.Label/cc.RichText에 텍스트 일괄 입력 — Enter로 저장 (R2548)"
              style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: 120 }}
              onKeyDown={async e => {
                if (e.key !== 'Enter' || !sceneFile.root) return
                const text = (e.target as HTMLInputElement).value
                await patchNodes(n => {
                  const comps = n.components.map(c => {
                  if (c.type === 'cc.Label') return { ...c, props: { ...c.props, string: text } }
                  if (c.type === 'cc.RichText') return { ...c, props: { ...c.props, string: text } }
                  return c
                  })
                  return { ...n, components: comps}
                }, `레이블 텍스트 (R2548)`)
                ;(e.target as HTMLInputElement).value = ''
              }}
            />
          </div>
        )
      })()}
      {/* R2627: cc.Label 텍스트 일련번호 추가 — 선택 Label 노드에 1,2,3... 순번 붙이기 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const hasLabelNode = uuids.some(u => {
          let found = false
          function find(n: CCSceneNode) { if (n.uuid === u) { found = n.components.some(c => c.type === 'cc.Label'); return }; n.children.forEach(find) }
          find(sceneFile.root!)
          return found
        })
        if (!hasLabelNode) return null
        const applyLabelSerial = async (mode: 'append' | 'replace') => {
          if (!sceneFile.root) return
          await patchOrdered((n, idx) => {
            const hasLabel = n.components.some(c => c.type === 'cc.Label')
            if (!hasLabel) return n
            const num = idx + 1
            const comps = n.components.map(c => {
              if (c.type !== 'cc.Label') return c
              const cur = (c.props?.string as string | undefined) ?? ''
              const newStr = mode === 'append' ? `${cur}${num}` : String(num)
              return { ...c, props: { ...c.props, string: newStr } }
            })
            return { ...n, components: comps }
          }, `Label 순번 (${uuids.length}개)`)
        }
        const bs: React.CSSProperties = { fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#67e8f9', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>L순번 (R2627)</span>
            <span onClick={() => applyLabelSerial('append')} title="Label 텍스트 뒤에 순번 추가 (R2627)" style={bs}>+번호</span>
            <span onClick={() => applyLabelSerial('replace')} title="Label 텍스트를 순번으로 교체 (R2627)" style={{ ...bs, color: '#f9a8d4' }}>번호만</span>
          </div>
        )
      })()}
      {/* R2467: 컴포넌트 일괄 추가 */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>컴포넌트 일괄 추가</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {(['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.ScrollView', 'cc.Layout', 'cc.Widget', 'cc.Animation', 'cc.AudioSource', 'cc.UIOpacity', 'cc.Mask'] as const).map(ct => (
            <span
              key={ct}
              title={`선택 ${uuids.length}개 노드에 ${ct} 추가 (R2467)`}
              onClick={async () => {
                if (!sceneFile.root) return
                function patchAddComp(n: CCSceneNode): CCSceneNode {
                  const children = n.children.map(patchAddComp)
                  if (!uuidSet.has(n.uuid)) return { ...n, children }
                  if (n.components.some(c => c.type === ct)) return { ...n, children }
                  return { ...n, components: [...n.components, { type: ct, props: {} }], children }
                }
                const result = await saveScene(patchAddComp(sceneFile.root))
                setBatchMsg(result.success ? `✓ ${ct.split('.').pop()} 추가 (${uuids.length}개)` : `✗ 오류`)
                setTimeout(() => setBatchMsg(null), 2000)
              }}
              style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#4ade80')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >{ct.split('.').pop()}</span>
          ))}
        </div>
      </div>
      {/* R2491: 범용 컴포넌트 prop 일괄 편집 */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>⚙ 범용 prop 편집</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <input placeholder="cc.Label" value={genericCompType} onChange={e => setGenericCompType(e.target.value)}
            style={{ width: 68, fontSize: 9, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            title="컴포넌트 타입 (R2491)" />
          <input placeholder="prop명" value={genericPropName} onChange={e => setGenericPropName(e.target.value)}
            style={{ width: 60, fontSize: 9, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            title="prop 이름 (R2491)" />
          <input placeholder="값" value={genericPropVal} onChange={e => setGenericPropVal(e.target.value)}
            style={{ width: 52, fontSize: 9, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            title="설정할 값 (숫자/true/false/문자열) (R2491)" />
          <button
            onClick={async () => {
              if (!sceneFile.root || !genericCompType.trim() || !genericPropName.trim()) return
              const rawVal = genericPropVal
              let parsed: unknown = rawVal
              if (rawVal === 'true') parsed = true
              else if (rawVal === 'false') parsed = false
              else if (rawVal !== '' && !isNaN(Number(rawVal))) parsed = Number(rawVal)
              function patchGeneric(node: CCSceneNode): CCSceneNode {
                const children = node.children.map(patchGeneric)
                if (!uuidSet.has(node.uuid)) return { ...node, children }
                const comps = node.components.map(c => {
                  if (c.type !== genericCompType.trim()) return c
                  return { ...c, props: { ...c.props, [genericPropName.trim()]: parsed } }
                })
                return { ...node, components: comps, children }
              }
              const result = await saveScene(patchGeneric(sceneFile.root))
              setBatchMsg(result.success ? `✓ ${genericCompType}.${genericPropName}=${rawVal} (${uuids.length}개)` : `✗ 오류`)
              setTimeout(() => setBatchMsg(null), 2500)
            }}
            style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,191,36,0.5)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
            title={`${genericCompType}.${genericPropName} = ${genericPropVal} (R2491)`}
          >적용</button>
        </div>
      </div>
    </>
  )
}
