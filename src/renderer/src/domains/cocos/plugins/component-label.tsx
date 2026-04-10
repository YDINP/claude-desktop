import React, { useState } from 'react'
import type { ComponentSectionProps } from './component-shared'
import { mkBtnS, mkNiS } from './component-shared'
import { t } from '../../../utils/i18n'

export function LabelSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  const [customFontSize, setCustomFontSize] = useState<number>(24)
  const [labelFontColor, setLabelFontColor] = useState<string>('#ffffff')
  return (
    <>
      {/* R1749: 공통 cc.Label fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label fs</span>
          <input type="number" min={1} max={200} placeholder="fontSize"
            style={{ width: 56, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={async e => {
              const fs = parseInt(e.target.value)
              if (isNaN(fs) || fs <= 0 || !sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.Label',
                c => ({ ...c, props: { ...c.props, fontSize: fs, _fontSize: fs, _N$fontSize: fs } }),
                `Label fontSize ${fs} (${uuids.length}개)`,
              )
            }}
          />
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
        </div>
      )}
      {/* R1792: 공통 cc.Label lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label lh</span>
          <input type="number" min={0} placeholder="lineHeight (0=auto)"
            style={{ width: 56, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={async e => {
              const lh = parseInt(e.target.value)
              if (isNaN(lh) || !sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.Label',
                c => ({ ...c, props: { ...c.props, lineHeight: lh, _lineHeight: lh, _N$lineHeight: lh } }),
                `Label lineHeight ${lh} (${uuids.length}개)`,
              )
            }}
          />
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>px</span>
        </div>
      )}
      {/* R1804: 공통 cc.Label wrapText 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label wrap</span>
          {(['✓ wrap', '✕ wrap'] as const).map(label => (
            <span key={label}
              title={`enableWrapText 모두 ${label.startsWith('✓') ? t('batch.c_label.s_on', '활성') : t('batch.c_label.s_off', '비활성')}`}
              onClick={async () => {
                if (!sceneFile.root) return
                const val = label.startsWith('✓')
                await patchComponents(
                  c => c.type === 'cc.Label',
                  c => ({ ...c, props: { ...c.props, enableWrapText: val, _enableWrapText: val, _N$enableWrapText: val } }),
                  `wrap ${val} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid var(--border)', color: label.startsWith('✓') ? '#4ade80' : 'var(--text-muted)', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R1802: 공통 cc.Label bold/italic 일괄 토글 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>{t('batch.c_label.j_label_style', 'Label 스타일')}</span>
          {([
            { label: 'B', key: 'isBold', title: t('batch.c_label.s_bold_batch_set', 'Bold 일괄 설정') },
            { label: 'I', key: 'isItalic', title: t('batch.c_label.s_italic_batch_set', 'Italic 일괄 설정') },
            { label: 'U', key: 'isUnderline', title: t('batch.c_label.s_underline_batch_set', 'Underline 일괄 설정') },
          ] as const).map(({ label, key, title }) => (
            <React.Fragment key={key}>
              {(['on', 'off'] as const).map(v => (
                <span key={v}
                  title={`${title} → ${v}`}
                  onClick={async () => {
                    if (!sceneFile.root) return
                    const val = v === 'on'
                    await patchComponents(
                      c => c.type === 'cc.Label',
                      c => ({ ...c, props: { ...c.props, [key]: val, [`_${key}`]: val, [`_N$${key}`]: val } }),
                      `${key} ${v} (${uuids.length}개)`,
                    )
                  }}
                  style={{ fontSize: v === 'on' ? 9 : 7, fontWeight: label === 'B' ? 700 : 400, fontStyle: label === 'I' ? 'italic' : 'normal', textDecoration: label === 'U' ? 'underline' : 'none', cursor: 'pointer', padding: '1px 3px', borderRadius: 2, border: `1px solid ${v === 'on' ? 'rgba(88,166,255,0.4)' : 'var(--border)'}`, color: v === 'on' ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                >{label}{v === 'on' ? '✓' : '✕'}</span>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
      {/* R1800: 공통 cc.Label vAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label vAlgn</span>
          {([['T', 0], ['M', 1], ['B', 2]] as const).map(([l, v]) => (
            <span key={v} title={`vAlign = ${l}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Label',
                  c => ({ ...c, props: { ...c.props, verticalAlign: v, _verticalAlign: v, _N$verticalAlign: v } }),
                  `vAlign ${l} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 8px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1799: 공통 cc.Label hAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label algn</span>
          {([['L', 0], ['C', 1], ['R', 2]] as const).map(([l, v]) => (
            <span key={v} title={`hAlign = ${l}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Label',
                  c => ({ ...c, props: { ...c.props, horizontalAlign: v, _horizontalAlign: v, _N$horizontalAlign: v } }),
                  `hAlign ${l} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 9, cursor: 'pointer', padding: '1px 8px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1854: 공통 cc.Label bold/italic 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelStyle = async (key: 'isBold' | 'isItalic' | 'isUnderline', value: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, [key]: value, [`_${key}`]: value, [`_N$${key}`]: value } }),
            `Label ${key}=${value} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label sty</span>
            {(['isBold','isItalic','isUnderline'] as const).map(key => {
              const short = key === 'isBold' ? 'B' : key === 'isItalic' ? 'I' : 'U'
              return (
                <React.Fragment key={key}>
                  <span onClick={() => applyLabelStyle(key, true)} title={`${key} ON`}
                    style={{ fontSize: 9, fontWeight: key==='isBold'?700:400, fontStyle: key==='isItalic'?'italic':'normal', textDecoration: key==='isUnderline'?'underline':'none', cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
                  >{short}✓</span>
                  <span onClick={() => applyLabelStyle(key, false)} title={`${key} OFF`}
                    style={{ fontSize: 9, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
                  >{short}✗</span>
                </React.Fragment>
              )
            })}
          </div>
        )
      })()}
      {/* R1797: 공통 cc.Label overflow 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label ovf</span>
          {([['None', 0], ['Clamp', 1], ['Shrink', 2], ['ResH', 3]] as const).map(([l, v]) => (
            <span key={v} title={`overflow = ${l}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Label',
                  c => ({ ...c, props: { ...c.props, overflow: v, _overflow: v, _N$overflow: v } }),
                  `overflow ${l} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1855: 공통 cc.Label lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelLH = async (lh: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, lineHeight: lh, _lineHeight: lh, _N$lineHeight: lh } }),
            `Label lineH ${lh} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label lnH</span>
            {([0, 20, 24, 32, 40, 48] as const).map(v => (
              <span key={v} title={v === 0 ? t('batch.c_label.s_lineheight_0_auto', 'lineHeight=0 (자동)') : `lineHeight=${v}`}
                onClick={() => applyLabelLH(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v === 0 ? 'auto' : v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1927: 공통 cc.Label enableWrapText 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyWrapText = async (enableWrapText: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, enableWrapText, _enableWrapText: enableWrapText, _N$enableWrapText: enableWrapText } }),
            `Label wrap=${enableWrapText} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblWrap</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`enableWrapText = ${v}`}
                onClick={() => applyWrapText(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v ? 'wrap✓' : 'wrap✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1868: 공통 cc.Label spacingX 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelSpX = async (sx: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, spacingX: sx, _spacingX: sx, _N$spacingX: sx } }),
            `Label spacingX ${sx} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>Label spX</span>
            {([-2, -1, 0, 1, 2, 4, 8] as const).map(v => (
              <span key={v} title={`spacingX=${v}`}
                onClick={() => applyLabelSpX(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1978: 공통 cc.Label bold/italic 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelBold = async (isBold: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, isBold, _isBold: isBold, _N$isBold: isBold } }),
            `Label bold=${isBold} (${uuids.length}개)`,
          )
        }
        const applyLabelItalic = async (isItalic: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, isItalic, _isItalic: isItalic, _N$isItalic: isItalic } }),
            `Label italic=${isItalic} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>LbStyle</span>
            <span onClick={() => applyLabelBold(true)} title="bold ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none', fontWeight: 'bold' }}>B✓</span>
            <span onClick={() => applyLabelBold(false)} title="bold OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>B✗</span>
            <span onClick={() => applyLabelItalic(true)} title="italic ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none', fontStyle: 'italic' }}>I✓</span>
            <span onClick={() => applyLabelItalic(false)} title="italic OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>I✗</span>
          </div>
        )
      })()}
      {/* R1992: 공통 cc.Label strikethrough 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelStrike = async (isStrike: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, isStrike, _isStrike: isStrike, _N$isStrike: isStrike } }),
            `Label strike=${isStrike} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>LbStrike</span>
            <span onClick={() => applyLabelStrike(true)} title="strikethrough ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none', textDecoration: 'line-through' }}>S✓</span>
            <span onClick={() => applyLabelStrike(false)} title="strikethrough OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>S✗</span>
          </div>
        )
      })()}
      {/* R1985: 공통 cc.Label underline 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelUnderline = async (isUnderline: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, isUnderline, _isUnderline: isUnderline, _N$isUnderline: isUnderline } }),
            `Label underline=${isUnderline} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>LbUnder</span>
            <span onClick={() => applyLabelUnderline(true)} title="underline ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none', textDecoration: 'underline' }}>U✓</span>
            <span onClick={() => applyLabelUnderline(false)} title="underline OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>U✗</span>
          </div>
        )
      })()}
      {/* R2215: 공통 cc.Label _underlineHeight 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelULHeight = async (underlineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, underlineHeight, _underlineHeight: underlineHeight } }),
            `Label underlineHeight=${underlineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblULH</span>
            {[1, 2, 3, 4, 5, 6, 8].map(v => (
              <span key={v} onClick={() => applyLabelULHeight(v)} title={`underlineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2216: 공통 cc.Label _spacingX 일괄 설정 (CC3.x 문자 간격) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelSpacingX = async (spacingX: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, spacingX, _spacingX: spacingX } }),
            `Label spacingX=${spacingX} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblSpX</span>
            {[0, 1, 2, 3, 4, 5, 8, 10].map(v => (
              <span key={v} onClick={() => applyLabelSpacingX(v)} title={`_spacingX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2225: 공통 cc.Label charSpacing 일괄 설정 (CC2.x/CC3.x 문자 간격) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelCharSpacing = async (charSpacing: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, charSpacing, _charSpacing: charSpacing, _N$charSpacing: charSpacing } }),
            `Label charSpacing=${charSpacing} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblChSp</span>
            {[0, 1, 2, 3, 4, 5, 8].map(v => (
              <span key={v} onClick={() => applyLabelCharSpacing(v)} title={`charSpacing=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1955: 공통 cc.Label color 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const col = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, color: col, _color: col, _N$color: col } }),
            `Label color (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LbColor</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyLabelColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            {(['#ffffff','#000000','#ff4444','#ffff00','#44ff44'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R2034: 공통 cc.Label verticalAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelVAlign = async (verticalAlign: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, verticalAlign, _verticalAlign: verticalAlign, _N$verticalAlign: verticalAlign } }),
            `Label V Align`,
          )
          const names = ['T','C','B']
          setBatchMsg(`✓ Label vAlign=${names[verticalAlign]??verticalAlign} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblVA</span>
            {([['T',0],['C',1],['B',2]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyLabelVAlign(v)} title={`verticalAlign=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2019: 공통 cc.Label horizontalAlign 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelHAlign = async (horizontalAlign: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, horizontalAlign, _horizontalAlign: horizontalAlign, _N$horizontalAlign: horizontalAlign } }),
            `Label H Align`,
          )
          const names = ['L','C','R']
          setBatchMsg(`✓ Label hAlign=${names[horizontalAlign]??horizontalAlign} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblHA</span>
            {([['L',0],['C',1],['R',2]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyLabelHAlign(v)} title={`horizontalAlign=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2018: 공통 cc.Label overflow 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelOverflow = async (overflow: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, overflow, _overflow: overflow, _N$overflow: overflow } }),
            `Label Overflow`,
          )
          const names = ['None','Clamp','Shrink','Resize']
          setBatchMsg(`✓ Label overflow=${names[overflow]??overflow} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblOvfl</span>
            {([['None',0],['Clamp',1],['Shrink',2],['Rsz',3]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyLabelOverflow(v)} title={`overflow=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2064: 공통 cc.Label fontFamily preset 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelFontFamily = async (fontFamily: string) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, fontFamily, _fontFamily: fontFamily, _N$fontFamily: fontFamily } }),
            `Label fontFamily=${fontFamily} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblFont</span>
            {['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia'].map(f => (
              <span key={f} title={`fontFamily = ${f}`}
                onClick={() => applyLabelFontFamily(f)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}
              >{f.split(' ')[0]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2017: 공통 cc.Label lineHeight 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelLineHeight = async (lineHeight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, lineHeight, _lineHeight: lineHeight, _N$lineHeight: lineHeight } }),
            `Label lineHeight=${lineHeight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblLH</span>
            {[0, 20, 30, 40, 60, 80].map(v => (
              <span key={v} onClick={() => applyLabelLineHeight(v)} title={`lineHeight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2102: 공통 cc.Label spacingY 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelSpacingY = async (spacingY: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, spacingY, _spacingY: spacingY, _N$spacingY: spacingY } }),
            `Label spacingY=${spacingY} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>LblSpY</span>
            {[0, 2, 5, 10, 20, 30].map(v => (
              <span key={v} onClick={() => applyLabelSpacingY(v)} title={`spacingY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1951: 공통 cc.Label fontSize 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelFontSize = async (fontSize: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, fontSize, _fontSize: fontSize, _N$fontSize: fontSize } }),
            `Label fontSize=${fontSize} (${uuids.length}개)`,
          )
        }
        // R2712: 프리셋 확장 + 커스텀 입력
        const niSFont = mkNiS(50)
        const btnSApply = mkBtnS('#3b82f6', { fontSize: 8, padding: '1px 6px' })
        return (
          <div style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LbFont</span>
              {([12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72] as const).map(v => (
                <span key={v} title={`Label fontSize = ${v}`}
                  onClick={() => applyLabelFontSize(v)}
                  style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
                >{v}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
              <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }} />
              <input type="number" min={1} max={200} value={customFontSize}
                onChange={e => setCustomFontSize(Math.max(1, Math.min(200, Number(e.target.value))))}
                style={niSFont}
                onKeyDown={e => e.key === 'Enter' && applyLabelFontSize(customFontSize)}
              />
              <span onClick={() => applyLabelFontSize(customFontSize)} style={btnSApply}>{t('batch.c_label.j_apply', '적용')}</span>
            </div>
          </div>
        )
      })()}
      {/* R1940: 공통 cc.Label overflow 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelOverflow = async (overflow: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, overflow, _overflow: overflow, _N$overflow: overflow } }),
            `Label Overflow`,
          )
          const names: Record<number,string> = { 0:'None', 1:'Clamp', 2:'Shrink', 3:'Resize' }
          setBatchMsg(`✓ Label overflow=${names[overflow]??overflow} (${uuids.length}개)`) // R2238: _overflow CC3.x
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LbOvflw</span>
            {([['None',0],['Clamp',1],['Shrink',2],['Rsz',3]] as const).map(([l, v]) => (
              <span key={v} title={`overflow = ${l}`}
                onClick={() => applyLabelOverflow(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1925: 공통 cc.Label cacheMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyCacheMode = async (cacheMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, cacheMode, _cacheMode: cacheMode, _N$cacheMode: cacheMode } }),
            `Cache Mode`,
          )
          const names = ['None', 'Bitmap', 'Char']
          setBatchMsg(`✓ Label cacheMode=${names[cacheMode] ?? cacheMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblCache</span>
            {([['None',0],['Bitmap',1],['Char',2]] as [string,number][]).map(([l,v]) => (
              <span key={v} title={`cacheMode = ${l}`}
                onClick={() => applyCacheMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2165: 공통 cc.Label isSystemFontUsed 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelSysFont = async (isSystemFontUsed: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, isSystemFontUsed, _isSystemFontUsed: isSystemFontUsed, _N$isSystemFontUsed: isSystemFontUsed } }),
            `Label isSystemFontUsed=${isSystemFontUsed} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblSys</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`isSystemFontUsed = ${v}`}
                onClick={() => applyLabelSysFont(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}
              >{v ? 'sys✓' : 'sys✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2173: 공통 cc.Label platformFont 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelPlatFont = async (platformFont: string) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, platformFont, _platformFont: platformFont, _N$platformFont: platformFont } }),
            `Label platformFont="${platformFont}" (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>PlatFont</span>
            {(['', 'Arial', 'sans-serif', 'serif', 'monospace'] as const).map(f => (
              <span key={f || 'default'} onClick={() => applyLabelPlatFont(f)} title={`platformFont="${f || t('batch.c_label.s_label', '(기본)')}"`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{f || 'def'}</span>
            ))}
          </div>
        )
      })()}
      {/* R2191: 공통 cc.Label enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Label enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelEnabled(v)} title={`Label enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2205: 공통 cc.Label enableOutline 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelEnableOutline = async (enableOutline: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, enableOutline, _enableOutline: enableOutline } }),
            `Label enableOutline=${enableOutline} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblOtln</span>
            {([['otln✓', true], ['otln✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelEnableOutline(v)} title={`enableOutline=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2210: 공통 cc.Label outlineWidth 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelOW = async (outlineWidth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, outlineWidth, _outlineWidth: outlineWidth } }),
            `Label outlineWidth=${outlineWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblOW</span>
            {[1, 2, 3, 4, 5, 6, 8].map(v => (
              <span key={v} onClick={() => applyLabelOW(v)} title={`Label outlineWidth=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2210: 공통 cc.Label outlineColor 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelOutlineClr = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const outlineColor = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, outlineColor, _outlineColor: outlineColor } }),
            `Label outlineColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblOC</span>
            {(['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelOutlineClr(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2721: cc.Label/RichText 폰트 색상 일괄 설정 */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelFontColor = async () => {
          if (!sceneFile.root) return
          const hex = labelFontColor
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorObj = { r, g, b, a: 255 }
          await patchNodes(n => {
            const updComps = n.components.map(c => {
            if (c.type !== 'cc.Label' && c.type !== 'cc.RichText') return c
            // CC2.x: color prop as {r,g,b,a}; CC3.x: fontColor as hex string
            return { ...c, props: { ...c.props, color: colorObj, _color: colorObj, fontColor: hex, _fontColor: hex } }
            })
            return { ...n, components: updComps}
          }, `Label fontColor=${hex} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>{t('batch.c_label.j_font_r2721', '폰트색 (R2721)')}</span>
            <input type="color" value={labelFontColor}
              onChange={e => setLabelFontColor(e.target.value)}
              style={{ width: 28, height: 18, padding: 0, border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', background: 'none' }}
              title={t('batch.c_label.t_label_richtext_font_color_select', 'Label/RichText 폰트 색상 선택')} />
            <span onClick={applyLabelFontColor}
              title={`선택된 ${uuids.length}개 노드 Label fontColor → ${labelFontColor} (R2721)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#58a6ff', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >{t('batch.c_label.j_apply', '적용')}</span>
          </div>
        )
      })()}
      {/* R2205: 공통 cc.Label enableShadow 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelEnableShadow = async (enableShadow: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, enableShadow, _enableShadow: enableShadow } }),
            `Label enableShadow=${enableShadow} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblShdw</span>
            {([['shdw✓', true], ['shdw✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelEnableShadow(v)} title={`enableShadow=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2211: 공통 cc.Label shadowColor 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelShadowClr = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const shadowColor = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, shadowColor, _shadowColor: shadowColor } }),
            `Label shadowColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblShdC</span>
            {(['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff', '#0000ff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelShadowClr(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2211: 공통 cc.Label shadowBlur 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelShadowBlu = async (shadowBlur: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, shadowBlur, _shadowBlur: shadowBlur } }),
            `Label shadowBlur=${shadowBlur} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblShdB</span>
            {[0, 1, 2, 3, 5, 8, 12].map(v => (
              <span key={v} onClick={() => applyLabelShadowBlu(v)} title={`Label shadowBlur=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2212: 공통 cc.Label shadowOffset 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelShdOff = async (x: number, y: number) => {
          if (!sceneFile.root) return
          const shadowOffset = { x, y }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, shadowOffset, _shadowOffset: shadowOffset } }),
            `Label shadowOffset=(${x},${y}) (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblShdO</span>
            {([[1,1],[2,2],[3,3],[2,1],[1,2],[0,2]] as [number,number][]).map(([x,y]) => (
              <span key={`${x}-${y}`} onClick={() => applyLabelShdOff(x, y)} title={`shadowOffset=(${x},${y})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{x},{y}</span>
            ))}
          </div>
        )
      })()}
      {/* R2212: 공통 cc.EditBox placeholderFontColor 일괄 설정 */}
      {commonCompTypes.includes('cc.EditBox') && (() => {
        const applyEBPlaceholderClr = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorObj = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.EditBox',
            c => ({ ...c, props: { ...c.props, placeholderFontColor: colorObj, _placeholderFontColor: colorObj, _N$placeholderFontColor: colorObj } }),
            `EditBox placeholderFontColor=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>EBphClr</span>
            {(['#ffffff', '#cccccc', '#999999', '#666666', '#333333', '#000000', '#aaaaaa'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyEBPlaceholderClr(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2184: 공통 cc.Label enableGradient 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelGradient = async (enableGradient: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, enableGradient, _enableGradient: enableGradient } }),
            `Label enableGradient=${enableGradient} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblGrad</span>
            {([['grad✓', true], ['grad✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelGradient(v)} title={`enableGradient=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2213: 공통 cc.Label colorTop 일괄 설정 (CC3.x 그라디언트) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelColorTop = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorTop = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, colorTop, _colorTop: colorTop } }),
            `Label colorTop=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblClrT</span>
            {(['#ffffff', '#ffff00', '#ff8800', '#ff0000', '#00ff00', '#0088ff', '#000000'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelColorTop(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2213: 공통 cc.Label colorBottom 일괄 설정 (CC3.x 그라디언트) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelColorBot = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorBottom = { r, g, b, a: 255 }
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, colorBottom, _colorBottom: colorBottom } }),
            `Label colorBottom=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblClrB</span>
            {(['#000000', '#333333', '#0000ff', '#ff0000', '#00ff00', '#ffff00', '#ffffff'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyLabelColorBot(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2181: 공통 cc.Label enableDashLine 일괄 설정 (CC3.x) */}
      {commonCompTypes.includes('cc.Label') && (() => {
        const applyLabelDashLine = async (enableDashLine: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => ({ ...c, props: { ...c.props, enableDashLine, _enableDashLine: enableDashLine } }),
            `Label enableDashLine=${enableDashLine} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#58a6ff', width: 48, flexShrink: 0 }}>LblDash</span>
            {([['dash✓', true], ['dash✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLabelDashLine(v)} title={`enableDashLine=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#58a6ff', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
