import React, { useState } from 'react'
import type { ComponentSectionProps } from './component-shared'
import { t } from '../../../utils/i18n'

export function SpriteSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  const [batchSolidColor, setBatchSolidColor] = useState<string>('#ffffff')
  return (
    <>
      {/* R1886: 공통 cc.ProgressBar totalLength 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBLength = async (totalLength: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, totalLength, _totalLength: totalLength, _N$totalLength: totalLength } }),
            `ProgressBar totalLength=${totalLength} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBlen</span>
            {([50, 100, 200, 300, 500] as const).map(v => (
              <span key={v} title={`totalLength = ${v}`}
                onClick={() => applyPBLength(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2197: 공통 cc.ProgressBar enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `ProgressBar enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyPBEnabled(v)} title={`ProgressBar enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1771: 공통 cc.ProgressBar progress 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Progress</span>
          <input type="range" min={0} max={1} step={0.01} defaultValue={0}
            onMouseUp={async e => {
              const prog = parseFloat((e.target as HTMLInputElement).value)
              if (!sceneFile.root) return
              await patchComponents(
                c => c.type === 'cc.ProgressBar',
                c => ({ ...c, props: { ...c.props, progress: prog, _progress: prog, _N$progress: prog } }),
                `progress ${Math.round(prog * 100)}% (${uuids.length}개)`,
              )
            }}
            style={{ flex: 1 }}
          />
        </div>
      )}
      {/* R1853: 공통 cc.ProgressBar reverse 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBReverse = async (reverse: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, reverse, _reverse: reverse, _N$reverse: reverse } }),
            `ProgressBar reverse=${reverse} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBrev</span>
            <span onClick={() => applyPBReverse(true)} title="reverse ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>rev✓</span>
            <span onClick={() => applyPBReverse(false)} title="reverse OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>rev✗</span>
          </div>
        )
      })()}
      {/* R1987: 공통 cc.ProgressBar mode 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBMode = async (mode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, mode, _mode: mode, _N$mode: mode } }),
            `P B Mode`,
          )
          const names = ['Horiz', 'Vert', 'Filled']
          setBatchMsg(`✓ ProgressBar mode=${names[mode] ?? mode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBmode</span>
            {([['H', 0], ['V', 1], ['Fill', 2]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applyPBMode(v)} title={`mode=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2173: 공통 cc.ProgressBar startWidth 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBStartWidth = async (startWidth: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, startWidth, _startWidth: startWidth, _N$startWidth: startWidth } }),
            `ProgressBar startWidth=${startWidth} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>PBstW</span>
            {[0, 1, 5, 10, 20, 50].map(v => (
              <span key={v} onClick={() => applyPBStartWidth(v)} title={`startWidth=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2063: 공통 cc.ProgressBar totalLength 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBTotalLength = async (totalLength: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, totalLength, _totalLength: totalLength, _N$totalLength: totalLength } }),
            `ProgressBar totalLength=${totalLength} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBtotal</span>
            {[100, 200, 300, 400, 500].map(v => (
              <span key={v} title={`totalLength = ${v}`}
                onClick={() => applyPBTotalLength(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1906: 공통 cc.ProgressBar progress 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBProgress = async (progress: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, progress, _progress: progress, _N$progress: progress } }),
            `P B Progress`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBprog</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`progress = ${v}`}
                onClick={() => applyPBProgress(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1916: 공통 cc.ProgressBar reverse 일괄 설정 */}
      {commonCompTypes.includes('cc.ProgressBar') && (() => {
        const applyPBReverse = async (reverse: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.ProgressBar',
            c => ({ ...c, props: { ...c.props, reverse, _reverse: reverse, _N$reverse: reverse } }),
            `ProgressBar reverse=${reverse} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>PBrev</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`reverse = ${v}`}
                onClick={() => applyPBReverse(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v ? 'rev✓' : 'rev✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1862: 공통 cc.Sprite type 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySpriteType = async (type: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, type, _type: type } }),
            `Spr Type`,
          )
          const names = ['Simple','Sliced','Tiled','Filled']
          setBatchMsg(`✓ Sprite type=${names[type]} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>Spr type</span>
            {(['Simple','Sliced','Tiled','Filled'] as const).map((l, v) => (
              <span key={v} title={`Sprite type = ${l}`}
                onClick={() => applySpriteType(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1882: 공통 cc.Sprite sizeMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySpriteSizeMode = async (sizeMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, sizeMode, _sizeMode: sizeMode } }),
            `Sprite Size Mode`,
          )
          const names = ['Custom', 'Trimmed', 'Raw']
          setBatchMsg(`✓ Sprite sizeMode=${names[sizeMode] ?? sizeMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprSize</span>
            {(['Custom', 'Trimmed', 'Raw'] as const).map((l, v) => (
              <span key={v} title={`sizeMode = ${l}`}
                onClick={() => applySpriteSizeMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1891: 공통 cc.Sprite flipX/flipY 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprFlip = async (axis: 'X' | 'Y', value: boolean) => {
          if (!sceneFile.root) return
          const key = `flip${axis}`
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, [key]: value, [`_${key}`]: value, [`_N$${key}`]: value } }),
            `Spr Flip`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprFlip</span>
            {(['X', 'Y'] as const).map(axis => (
              <React.Fragment key={axis}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>flip{axis}:</span>
                {([true, false] as const).map(v => (
                  <span key={String(v)} title={`flip${axis}=${v}`}
                    onClick={() => applySprFlip(axis, v)}
                    style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
                  >{v ? '✓' : '✗'}</span>
                ))}
              </React.Fragment>
            ))}
          </div>
        )
      })()}
      {/* R1899: 공통 cc.Sprite grayscale 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprGray = async (grayscale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, grayscale, _grayscale: grayscale, _N$grayscale: grayscale } }),
            `Spr Gray`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprGray</span>
            <span onClick={() => applySprGray(true)} title="grayscale ON" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>gray✓</span>
            <span onClick={() => applySprGray(false)} title="grayscale OFF" style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>gray✗</span>
          </div>
        )
      })()}
      {/* R2215: 공통 cc.Sprite _color 일괄 설정 (CC3.x 컴포넌트 레벨 색상) */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteClr = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const colorObj = { r, g, b, a: 255 }
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, _color: colorObj } }),
            `Sprite _color=${hex} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprClr</span>
            {(['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff8800', '#888888'] as const).map(c => (
              <span key={c} title={c} onClick={() => applySpriteClr(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        )
      })()}
      {/* R2190: 공통 cc.Sprite enabled (컴포넌트 레벨) 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Sprite enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SpComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpriteEnabled(v)} title={`Sprite enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2216: 공통 cc.Sprite _useGrayscale 일괄 설정 (CC3.x) */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpUseGray = async (useGrayscale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, _useGrayscale: useGrayscale } }),
            `Sprite _useGrayscale=${useGrayscale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SpUseGy</span>
            {([['ugray✓', true], ['ugray✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpUseGray(v)} title={`_useGrayscale=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2183: 공통 cc.Sprite packable 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpritePackable = async (packable: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, packable, _packable: packable } }),
            `Sprite packable=${packable} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SpPack</span>
            {([['pack✓', true], ['pack✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applySpritePackable(v)} title={`packable=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2177: 공통 cc.Sprite meshType 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteMeshType = async (meshType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, meshType, _meshType: meshType } }),
            `Sprite meshType=${['NORMAL','POLYGON'][meshType] ?? meshType} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SpMesh</span>
            {([['NORMAL', 0], ['POLY', 1]] as const).map(([l, v]) => (
              <span key={v} onClick={() => applySpriteMeshType(v)} title={`meshType=${l}(${v})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2113: 공통 cc.Sprite trim 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySpriteTrim = async (trim: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, trim, _trim: trim } }),
            `Sprite trim=${trim} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#f472b6', width: 48, flexShrink: 0 }}>SprTrim</span>
            <span onClick={() => applySpriteTrim(true)} title="trim ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f472b6', userSelect: 'none' }}>trim✓</span>
            <span onClick={() => applySpriteTrim(false)} title="trim OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>trim✗</span>
          </div>
        )
      })()}
      {/* R2206: 공통 cc.Sprite blendMode(srcBlendFactor/dstBlendFactor) 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpBlend = async (src: number, dst: number, label: string) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, srcBlendFactor: src, dstBlendFactor: dst, _srcBlendFactor: src, _dstBlendFactor: dst, _N$srcBlendFactor: src, _N$dstBlendFactor: dst } }),
            `Sprite blend=${label} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#34d399', width: 48, flexShrink: 0 }}>SpBlend</span>
            {([['Norm', 770, 771], ['Add', 1, 1], ['Mul', 774, 771], ['Scr', 1, 771]] as [string, number, number][]).map(([l, s, d]) => (
              <span key={l} onClick={() => applySpBlend(s, d, l)} title={`src=${s},dst=${d}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#34d399', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2072: 공통 cc.Sprite fillType 일괄 설정 (Filled 타입) */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprFillType = async (fillType: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, fillType, _fillType: fillType } }),
            `Sprite fillType=${fillType} (${uuids.length}개)`,
          )
        }
        // 0=Horizontal, 1=Vertical, 2=Radial
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>SprFT</span>
            {([0, 1, 2] as const).map((v, i) => (
              <span key={v} title={`fillType = ${v} (${['H','V','Rad'][i]})`}
                onClick={() => applySprFillType(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}
              >{['H','V','Rad'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R1923: 공통 cc.Sprite fillRange 일괄 설정 (Filled 타입) */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applyFillRange = async (fillRange: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, fillRange, _fillRange: fillRange } }),
            `Sprite fillRange ${fillRange} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>FillRng</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`fillRange = ${v}`}
                onClick={() => applyFillRange(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R1933: 공통 cc.Sprite fillStart 일괄 설정 (Filled 타입) */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applyFillStart = async (fillStart: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, fillStart, _fillStart: fillStart } }),
            `Sprite fillStart ${fillStart} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>FillSt</span>
            {([0, 0.25, 0.5, 0.75, 1] as const).map(v => (
              <span key={v} title={`fillStart = ${v}`}
                onClick={() => applyFillStart(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}
              >{Math.round(v * 100)}%</span>
            ))}
          </div>
        )
      })()}
      {/* R2170: 공통 cc.Sprite fillCenter 일괄 설정 (Filled 타입) */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySpriteFillCenter = async (x: number, y: number) => {
          if (!sceneFile.root) return
          const fillCenter = { x, y }
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, fillCenter, _fillCenter: fillCenter } }),
            `Sprite fillCenter=(${x},${y}) (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>FillCtr</span>
            {([[0.5,0.5,'C'],[0,0,'BL'],[1,0,'BR'],[0,1,'TL'],[1,1,'TR']] as const).map(([x,y,l]) => (
              <span key={l} onClick={() => applySpriteFillCenter(x, y)} title={`fillCenter=(${x},${y})`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1954: 공통 cc.Sprite grayscale 일괄 설정 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applySprGray = async (grayscale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, grayscale, _grayscale: grayscale } }),
            `Sprite grayscale=${grayscale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>SprGray</span>
            <span onClick={() => applySprGray(true)} title="grayscale ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>gray✓</span>
            <span onClick={() => applySprGray(false)} title="grayscale OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>gray✗</span>
          </div>
        )
      })()}
      {/* R2007: 공통 cc.Sprite isTrimmedMode 일괄 설정 */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySprTrimmed = async (isTrimmedMode: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, isTrimmedMode, _isTrimmedMode: isTrimmedMode } }),
            `Sprite isTrimmed=${isTrimmedMode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprTrim</span>
            <span onClick={() => applySprTrimmed(true)} title="isTrimmedMode ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>trm✓</span>
            <span onClick={() => applySprTrimmed(false)} title="isTrimmedMode OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>trm✗</span>
          </div>
        )
      })()}
      {/* R2225: 공통 cc.Sprite _isTrimmedMode 숫자 선택 (CC3.x: 0=Trim, 1=Raw, 2=Polygon) */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteTrimMode = async (mode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, _isTrimmedMode: mode } }),
            `Sprite _isTrimmedMode=${mode} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SpTrimM</span>
            {([['Trim(0)', 0], ['Raw(1)', 1], ['Poly(2)', 2]] as [string, number][]).map(([label, mode]) => (
              <span key={mode} onClick={() => applySpriteTrimMode(mode)} title={`_isTrimmedMode=${mode}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2226: 공통 cc.Sprite capInsets 균등 9-slice 일괄 설정 (CC2.x/CC3.x) */}
      {(commonCompTypes.includes('cc.Sprite') || commonCompTypes.includes('cc.Sprite2D')) && (() => {
        const applySpriteCap = async (inset: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, insetTop: inset, _insetTop: inset, _N$insetTop: inset, insetBottom: inset, _insetBottom: inset, _N$insetBottom: inset, insetLeft: inset, _insetLeft: inset, _N$insetLeft: inset, insetRight: inset, _insetRight: inset, _N$insetRight: inset } }),
            `Sprite capInset=${inset} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprInst</span>
            {[0, 1, 2, 4, 8, 16].map(v => (
              <span key={v} onClick={() => applySpriteCap(v)} title={`capInset=${v} (all 4 insets)`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2706: 공통 cc.Sprite 단색 사각형 일괄 교체 */}
      {commonCompTypes.includes('cc.Sprite') && (() => {
        const applyBatchSolidColor = async () => {
          if (!sceneFile.root) return
          const m = batchSolidColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
          if (!m) return
          const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16)
          await patchComponents(
            c => (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D'),
            c => ({ ...c, props: { ...c.props, spriteFrame: null, _spriteFrame: null, color: { r, g, b, a: 255 }, _color: { r, g, b, a: 255 } } }),
            `단색 Sprite (${batchSolidColor}) 적용 (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4ade80', width: 48, flexShrink: 0 }}>SprSolid</span>
            <input type="color" value={batchSolidColor} onChange={e => setBatchSolidColor(e.target.value)}
              style={{ width: 32, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('batch.c_sprite.j_solid', '단색')}</span>
            <span onClick={applyBatchSolidColor}
              style={{ fontSize: 9, padding: '1px 6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', cursor: 'pointer', userSelect: 'none' }}>
              {t('batch.c_sprite.j_apply2', '적용')}
            </span>
          </div>
        )
      })()}
    </>
  )
}
