import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function ButtonSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R1884: 공통 cc.Button transition 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnTransition = async (transition: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, transition, _transition: transition } }),
            `Btn Transition`,
          )
          const names = ['None', 'Color', 'Sprite', 'Scale']
          setBatchMsg(`✓ Button transition=${names[transition] ?? transition} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnTrans</span>
            {(['None', 'Color', 'Sprite', 'Scale'] as const).map((l, v) => (
              <span key={v} title={`transition = ${l}`}
                onClick={() => applyBtnTransition(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1897: 공통 cc.Button zoomScale 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnZoom = async (zoom: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, zoomScale: zoom, _zoomScale: zoom, _N$zoomScale: zoom } }),
            `Btn Zoom`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnZoom</span>
            {([0.9, 1.0, 1.1, 1.2, 1.3, 1.5] as const).map(v => (
              <span key={v} title={`zoomScale = ${v}`}
                onClick={() => applyBtnZoom(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2020: 공통 cc.Button interactable 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnInteract = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, interactable, _interactable: interactable, _N$interactable: interactable } }),
            `Button interactable=${interactable} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>BtnIA</span>
            {([['ia✓',true],['ia✗',false]] as [string,boolean][]).map(([label,v]) => (
              <span key={label} onClick={() => applyBtnInteract(v)} title={`interactable=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2192: 공통 cc.Button enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyButtonEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Button enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#e879f9', width: 48, flexShrink: 0 }}>BtnComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyButtonEnabled(v)} title={`Button enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#e879f9', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2165: 공통 cc.Button autoGray 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnAutoGray = async (autoGrayEffect: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, autoGrayEffect, _autoGrayEffect: autoGrayEffect, _N$autoGrayEffect: autoGrayEffect } }),
            `Button autoGray=${autoGrayEffect} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>BtnGry</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`autoGrayEffect = ${v}`}
                onClick={() => applyBtnAutoGray(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v ? 'gray✓' : 'gray✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1945: 공통 cc.Button normalColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnNormalColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, normalColor: col, _normalColor: col, _N$normalColor: col } }),
            `Button normalColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnNorm</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyBtnNormalColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#cccccc','#ff9999','#99ccff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyBtnNormalColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1946: 공통 cc.Button pressedColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnPressedColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, pressedColor: col, _pressedColor: col, _N$pressedColor: col } }),
            `Button pressedColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnPress</span>
            <input type="color" defaultValue="#cccccc"
              onChange={e => applyBtnPressedColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#c8c8c8','#aaaaaa','#ff6666','#6699ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyBtnPressedColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1947: 공통 cc.Button disabledColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnDisabledColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 200 }
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, disabledColor: col, _disabledColor: col, _N$disabledColor: col } }),
            `Button disabledColor (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnDis</span>
            <input type="color" defaultValue="#787878"
              onChange={e => applyBtnDisabledColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#787878','#555555','#aaaaaa','#ffaaaa'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyBtnDisabledColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2130: 공통 cc.Button hoverColor 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnHoverColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, hoverColor: { r, g, b, a: 255 }, _hoverColor: { r, g, b, a: 255 }, _N$hoverColor: { r, g, b, a: 255 } } }),
            `Button hoverColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnHovC</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyBtnHoverColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ccddff','#aabbff','#ffffff','#dddddd'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyBtnHoverColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1948: 공통 cc.Button duration 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (() => {
        const applyBtnDuration = async (duration: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Button',
            c => ({ ...c, props: { ...c.props, duration, _duration: duration } }),
            `Button duration=${duration}s (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>BtnDur</span>
            {([0.1, 0.2, 0.3, 0.5, 1] as const).map(v => (
              <span key={v} title={`Button duration = ${v}s`}
                onClick={() => applyBtnDuration(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{v}s</span>
            ))}
          </div>
        )
      })()}
      {/* R1769: 공통 cc.Button interactable 일괄 설정 */}
      {commonCompTypes.includes('cc.Button') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>Button</span>
          {(['on', 'off'] as const).map(v => (
            <span key={v}
              title={`interactable 모두 ${v === 'on' ? '활성화' : '비활성화'}`}
              onClick={async () => {
                if (!sceneFile.root) return
                const interact = v === 'on'
                await patchComponents(
                  c => c.type === 'cc.Button',
                  c => ({ ...c, props: { ...c.props, interactable: interact, _interactable: interact, _N$interactable: interact } }),
                  `Button ${v === 'on' ? '활성' : '비활성'} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: v === 'on' ? '#4ade80' : '#f87171', userSelect: 'none' }}
            >{v === 'on' ? '✓ 활성' : '✕ 비활성'}</span>
          ))}
        </div>
      )}
      {/* R2196: 공통 cc.AudioSource enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (() => {
        const applyAudioEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.AudioSource',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `AudioSource enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>ASComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyAudioEnabled(v)} title={`AudioSource enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#facc15', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1761: 공통 cc.AudioSource volume 일괄 설정 */}
      {commonCompTypes.includes('cc.AudioSource') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#facc15', width: 48, flexShrink: 0 }}>Audio vol</span>
          <input type="range" min={0} max={1} step={0.01} defaultValue={1}
            onMouseUp={async e => {
              const vol = parseFloat((e.target as HTMLInputElement).value)
              if (!sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.AudioSource',
                c => ({ ...c, props: { ...c.props, volume: vol, _volume: vol, _N$volume: vol } }),
                `volume ${Math.round(vol * 100)}% (${uuids.length}개)`,
              )
            }}
            style={{ flex: 1 }}
          />
        </div>
      )}
      {/* R2219: 공통 cc.LabelOutline enabled (컴포넌트 레벨) 일괄 설정 (CC2.x) */}
      {commonCompTypes.includes('cc.LabelOutline') && (() => {
        const applyLabelOutlineEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelOutline',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `LabelOutline enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>OutEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelOutlineEnabled(v)} title={`LabelOutline enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2219: 공통 cc.LabelShadow enabled (컴포넌트 레벨) 일괄 설정 (CC2.x) */}
      {commonCompTypes.includes('cc.LabelShadow') && (() => {
        const applyLabelShadowEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelShadow',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `LabelShadow enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>ShdEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelShadowEnabled(v)} title={`LabelShadow enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1861: 공통 cc.LabelShadow blur 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelShadow') && (() => {
        const applyShadowBlur = async (blur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelShadow',
            c => ({ ...c, props: { ...c.props, blur, _blur: blur } }),
            `LabelShadow blur=${blur} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Shadow</span>
            {([0, 1, 2, 3, 5, 8] as const).map(v => (
              <span key={v} title={`shadow blur = ${v}`}
                onClick={() => applyShadowBlur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1860: 공통 cc.LabelOutline width 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelOutline') && (() => {
        const applyOutlineWidth = async (width: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelOutline',
            c => ({ ...c, props: { ...c.props, width, _width: width, _N$width: width } }),
            `LabelOutline w=${width} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Outline</span>
            {([0, 1, 2, 3, 4, 5] as const).map(v => (
              <span key={v} title={`outline width = ${v}`}
                onClick={() => applyOutlineWidth(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1909: 공통 cc.LabelOutline color 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelOutline') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>OL color</span>
          <input type="color" defaultValue="#000000"
            onChange={async e => {
              const hex = e.target.value
              if (!sceneFile.root) return
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              const col = { r, g, b, a: 255 }
              await patchComponents(
                c => c.type === 'cc.LabelOutline',
                c => ({ ...c, props: { ...c.props, color: col, _color: col, _N$color: col } }),
                `O L Color`,
              )
            }}
            style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
            title="cc.LabelOutline 색상 일괄 설정"
          />
        </div>
      )}
      {/* R1963: 공통 cc.LabelOutline width 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelOutline') && (() => {
        const applyLabelOutlineWidth = async (width: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelOutline',
            c => ({ ...c, props: { ...c.props, width, _width: width, _N$width: width } }),
            `LabelOutline width=${width} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>OLwidth</span>
            {([1, 2, 3, 4, 5] as const).map(v => (
              <span key={v} title={`LabelOutline width = ${v}`}
                onClick={() => applyLabelOutlineWidth(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1910: 공통 cc.LabelShadow color 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelShadow') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Shd clr</span>
          <input type="color" defaultValue="#000000"
            onChange={async e => {
              const hex = e.target.value
              if (!sceneFile.root) return
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              const col = { r, g, b, a: 255 }
              await patchComponents(
                c => c.type === 'cc.LabelShadow',
                c => ({ ...c, props: { ...c.props, color: col, _color: col, _N$color: col } }),
                `Shadow Color`,
              )
            }}
            style={{ width: 28, height: 22, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
            title="cc.LabelShadow 색상 일괄 설정"
          />
        </div>
      )}
      {/* R1964: 공통 cc.LabelShadow blur 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelShadow') && (() => {
        const applyLabelShadowBlur = async (blur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.LabelShadow',
            c => ({ ...c, props: { ...c.props, blur, _blur: blur, _N$blur: blur } }),
            `LabelShadow blur=${blur} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Shdblur</span>
            {([0, 1, 2, 3, 5] as const).map(v => (
              <span key={v} title={`LabelShadow blur = ${v}`}
                onClick={() => applyLabelShadowBlur(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1965: 공통 cc.LabelShadow offset 일괄 설정 */}
      {commonCompTypes.includes('cc.LabelShadow') && (() => {
        const applyLabelShadowOffset = async (x: number, y: number) => {
          if (!sceneFile.root) return
          const offset = { x, y }
          await patchComponents(
            c => c.type === 'cc.LabelShadow',
            c => ({ ...c, props: { ...c.props, offset, _offset: offset, _N$offset: offset } }),
            `LabelShadow offset=(${x},${y}) (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f59e0b', width: 48, flexShrink: 0 }}>Shdofs</span>
            {([[1,1],[2,2],[3,3],[0,1],[1,0]] as const).map(([x,y]) => (
              <span key={`${x}-${y}`} title={`offset=(${x},${y})`}
                onClick={() => applyLabelShadowOffset(x, y)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#f59e0b', userSelect: 'none' }}
              >{x},{y}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
