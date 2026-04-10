import React from 'react'
import type { ComponentSectionProps } from './component-shared'
import { t } from '../../../utils/i18n'

export function UiSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R2172: 공통 cc.Widget enabled 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Widget enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>WgtEn</span>
            {([['enabled✓', true], ['enabled✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyWidgetEnabled(v)} title={`Widget enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2178: 공통 cc.UITransform priority 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.UITransform') && (() => {
        const applyUITransPriority = async (priority: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.UITransform',
            c => ({ ...c, props: { ...c.props, priority, _priority: priority } }),
            `UITransform priority=${priority} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>UITPri</span>
            {[0, 1, 2, 5, 10, 100].map(v => (
              <span key={v} onClick={() => applyUITransPriority(v)} title={`priority=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2222: 공통 cc.UITransform _anchorPoint 프리셋 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.UITransform') && (() => {
        const applyUITransAnchor = async (ax: number, ay: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const _anchorPoint = { x: ax, y: ay }
            const components = n.components.map(c => c.type === 'cc.UITransform' ? { ...c, props: { ...c.props, _anchorPoint } } : c)
            return { ...n, components }
          }, `UITransform anchorPoint=(${ax},${ay}) (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>UITAnc</span>
            {([['C', 0.5, 0.5], ['TL', 0, 1], ['TR', 1, 1], ['BL', 0, 0], ['BR', 1, 0], ['TC', 0.5, 1], ['BC', 0.5, 0]] as [string, number, number][]).map(([l, ax, ay]) => (
              <span key={l} onClick={() => applyUITransAnchor(ax, ay)} title={`anchorPoint=(${ax},${ay})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1895: 공통 cc.UIOpacity opacity 일괄 설정 */}
      {commonCompTypes.includes('cc.UIOpacity') && (() => {
        const applyUIOpacity = async (opacity: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.UIOpacity',
            c => ({ ...c, props: { ...c.props, opacity, _opacity: opacity } }),
            `U I Opacity`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>UIOpacity</span>
            {([0, 64, 128, 192, 255] as const).map(v => (
              <span key={v} title={`opacity = ${v}`}
                onClick={() => applyUIOpacity(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2217: 공통 cc.UIOpacity enabled (컴포넌트 레벨) 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.UIOpacity') && (() => {
        const applyUIOpacityEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.UIOpacity',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `UIOpacity enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>UIOpEn</span>
            {([['on✓', true], ['off✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyUIOpacityEnabled(v)} title={`UIOpacity enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: v ? '#4ade80' : '#f85149', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2195: 공통 cc.Toggle enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Toggle') && (() => {
        const applyToggleEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Toggle',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Toggle enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TGLComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyToggleEnabled(v)} title={`Toggle enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1764: 공통 cc.Toggle isChecked 일괄 설정 */}
      {commonCompTypes.includes('cc.Toggle') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>Toggle</span>
          {(['checked', 'unchecked'] as const).map(v => (
            <span key={v}
              title={`모두 ${v}`}
              onClick={async () => {
                if (!sceneFile.root) return
                const checked = v === 'checked'
                await patchComponents(
                  c => c.type === 'cc.Toggle',
                  c => ({ ...c, props: { ...c.props, isChecked: checked, _isChecked: checked, _N$isChecked: checked } }),
                  `Toggle ${v} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: v === 'checked' ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
            >{v === 'checked' ? t('batch.c_ui.s_check', '✓ 체크') : t('batch.c_ui.s_unlock', '○ 해제')}</span>
          ))}
        </div>
      )}
      {/* R2106: 공통 cc.Toggle isChecked 일괄 설정 */}
      {commonCompTypes.includes('cc.Toggle') && (() => {
        const applyToggleCheck = async (isChecked: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Toggle',
            c => ({ ...c, props: { ...c.props, isChecked, _isChecked: isChecked } }),
            `Toggle isChecked=${isChecked} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TogChk</span>
            <span onClick={() => applyToggleCheck(true)} title="isChecked ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>chk✓</span>
            <span onClick={() => applyToggleCheck(false)} title="isChecked OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>chk✗</span>
          </div>
        )
      })()}
      {/* R1900: 공통 cc.Toggle interactable 일괄 설정 */}
      {commonCompTypes.includes('cc.Toggle') && (() => {
        const applyToggleInteract = async (interactable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Toggle',
            c => ({ ...c, props: { ...c.props, interactable, _interactable: interactable, _N$interactable: interactable } }),
            `Toggle Interact`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TogInter</span>
            <span onClick={() => applyToggleInteract(true)} title="interactable ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>inter✓</span>
            <span onClick={() => applyToggleInteract(false)} title="interactable OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>inter✗</span>
          </div>
        )
      })()}
      {/* R2199: 공통 cc.ToggleContainer enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.ToggleContainer') && (() => {
        const applyTCEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ToggleContainer',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `ToggleContainer enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>TCComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyTCEnabled(v)} title={`ToggleContainer enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2182: 공통 cc.ToggleContainer autoCheckToggle 일괄 설정 */}
      {commonCompTypes.includes('cc.ToggleContainer') && (() => {
        const applyTCAutoCheck = async (autoCheckToggle: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ToggleContainer',
            c => ({ ...c, props: { ...c.props, autoCheckToggle, _autoCheckToggle: autoCheckToggle } }),
            `ToggleContainer autoCheckToggle=${autoCheckToggle} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>TCauto</span>
            {([['auto✓', true], ['auto✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyTCAutoCheck(v)} title={`autoCheckToggle=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2132: 공통 cc.ToggleContainer allowSwitchOff 일괄 설정 */}
      {commonCompTypes.includes('cc.ToggleContainer') && (() => {
        const applyTCAllowSwitchOff = async (allowSwitchOff: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ToggleContainer',
            c => ({ ...c, props: { ...c.props, allowSwitchOff, _allowSwitchOff: allowSwitchOff } }),
            `ToggleContainer allowSwitchOff=${allowSwitchOff} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>TCswOff</span>
            <span onClick={() => applyTCAllowSwitchOff(true)} title="allowSwitchOff ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>sw✓</span>
            <span onClick={() => applyTCAllowSwitchOff(false)} title="allowSwitchOff OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>sw✗</span>
          </div>
        )
      })()}
      {/* R1908: 공통 cc.EditBox inputMode 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditBoxMode = async (inputMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, inputMode, _inputMode: inputMode } }),
            `Edit Box Mode`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>EBmode</span>
            {([['Any', 0], ['Num', 2], ['Email', 1], ['1Line', 6]] as [string,number][]).map(([l, v]) => (
              <span key={v} title={`inputMode = ${l}`}
                onClick={() => applyEditBoxMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1915: 공통 cc.EditBox maxLength 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditBoxMax = async (maxLength: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, maxLength, _maxLength: maxLength } }),
            `EditBox maxLength ${maxLength} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>EBmax</span>
            {([0, 8, 16, 32, 64, 128] as const).map(v => (
              <span key={v} title={`maxLength = ${v === 0 ? '∞' : v}`}
                onClick={() => applyEditBoxMax(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{v === 0 ? '∞' : v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1943: 공통 cc.EditBox fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditBoxFontSize = async (fontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, fontSize, _fontSize: fontSize, _N$fontSize: fontSize } }),
            `EditBox fontSize=${fontSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBfont</span>
            {([16, 20, 24, 28, 32] as const).map(v => (
              <span key={v} title={`EditBox fontSize = ${v}`}
                onClick={() => applyEditBoxFontSize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2198: 공통 cc.EditBox enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditBoxEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `EditBox enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>EBComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyEditBoxEnabled(v)} title={`EditBox enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2086: 공통 cc.EditBox inputFlag 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditInputFlag = async (inputFlag: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, inputFlag, _inputFlag: inputFlag, _N$inputFlag: inputFlag } }),
            `EditBox inputFlag=${inputFlag} (${uuids.length}개)`,
          )
        }
        // 0=Default, 1=InitialCapsFWord, 2=InitialCapsSentence, 3=InitialCapsAllChars, 4=Sensitive
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBflg</span>
            {([0, 1, 4] as const).map((v, i) => (
              <span key={v} title={`inputFlag = ${v} (${['Def','Init','Sens'][i]})`}
                onClick={() => applyEditInputFlag(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{['Def','Init','Sens'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2208: 공통 cc.EditBox placeholderFontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEBPlaceholderFS = async (placeholderFontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, placeholderFontSize, _placeholderFontSize: placeholderFontSize, _N$placeholderFontSize: placeholderFontSize } }),
            `EditBox placeholderFontSize=${placeholderFontSize} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>EBphFS</span>
            {[12, 14, 16, 18, 20, 24, 28].map(v => (
              <span key={v} onClick={() => applyEBPlaceholderFS(v)} title={`placeholderFontSize=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2208: 공통 cc.EditBox fontColor 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEBFontColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorObj = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, fontColor: colorObj, _fontColor: colorObj, _N$fontColor: colorObj } }),
            `EditBox fontColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>EBfColor</span>
            {(['#ffffff', '#000000', '#cccccc', '#888888', '#ff0000', '#00ff00', '#0000ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyEBFontColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block', flexShrink: 0 }} />
            ))}
          </div>
        )
      })()}
      {/* R2177: 공통 cc.EditBox lineCount 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditLineCount = async (lineCount: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, lineCount, _lineCount: lineCount, _N$lineCount: lineCount } }),
            `EditBox lineCount=${lineCount} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>EBlines</span>
            {[1, 2, 3, 5, 10, 0].map(v => (
              <span key={v} onClick={() => applyEditLineCount(v)} title={`lineCount=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2105: 공통 cc.EditBox maxLength 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditMaxLen = async (maxLength: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, maxLength, _maxLength: maxLength } }),
            `EditBox maxLength=${maxLength} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EditMax</span>
            {[0, 10, 20, 50, 100, 200].map(v => (
              <span key={v} onClick={() => applyEditMaxLen(v)} title={`maxLength=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2110: 공통 cc.EditBox tabIndex 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditTabIndex = async (tabIndex: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, tabIndex, _tabIndex: tabIndex } }),
            `EditBox tabIndex=${tabIndex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EditTab</span>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <span key={v} onClick={() => applyEditTabIndex(v)} title={`tabIndex=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2085: 공통 cc.EditBox inputMode 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditInputMode = async (inputMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, inputMode, _inputMode: inputMode, _N$inputMode: inputMode } }),
            `EditBox inputMode=${inputMode} (${uuids.length}개)`,
          )
        }
        // 0=Any, 1=EmailAddr, 2=Numeric, 3=PhoneNum, 4=URL, 5=Decimal, 6=SingleLine
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBinM</span>
            {([0, 2, 5, 6] as const).map((v, i) => (
              <span key={v} title={`inputMode = ${v} (${['Any','Num','Dec','1L'][i]})`}
                onClick={() => applyEditInputMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{['Any','Num','Dec','1L'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R1986: 공통 cc.EditBox returnType 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEditReturnType = async (returnType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, returnType, _returnType: returnType, _N$returnType: returnType } }),
            `Edit Return Type`,
          )
          const names = ['Dflt', 'Done', 'Send', 'Srch', 'Go', 'Next']
          setBatchMsg(`✓ EditBox returnType=${names[returnType] ?? returnType} (${uuids.length}개)`) // R2238: _returnType CC3.x
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBret</span>
            {([['Dflt', 0], ['Done', 1], ['Send', 2], ['Go', 4]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyEditReturnType(v)} title={`returnType=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
