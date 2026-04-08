import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function LayoutWidgetSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R1821: 공통 cc.Layout type 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Layout</span>
          {([['None', 0], ['H', 1], ['V', 2], ['Grid', 3]] as const).map(([l, v]) => (
            <span key={v} title={`layout type = ${l}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Layout',
                  c => ({ ...c, props: { ...c.props, type: v, layoutType: v, _type: v, _layoutType: v, _N$type: v, _N$layoutType: v } }),
                  `Layout type ${l} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
            >{l}</span>
          ))}
        </div>
      )}
      {/* R1959: 공통 cc.Layout childAlignment 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutChildAlign = async (childAlignment: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, childAlignment, _childAlignment: childAlignment } }),
            `Layout Child Align`,
          )
          const names: Record<number,string> = { 0:'None', 1:'LT', 2:'CT', 3:'RT', 4:'LC', 5:'C', 6:'RC', 7:'LB', 8:'CB', 9:'RB' }
          setBatchMsg(`✓ Layout align=${names[childAlignment]??childAlignment} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LyAlign</span>
            {([[1,'LT'],[5,'C'],[9,'RB'],[4,'LC'],[6,'RC']] as const).map(([v,l]) => (
              <span key={v} title={`childAlignment = ${l}`}
                onClick={() => applyLayoutChildAlign(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1972: 공통 cc.Layout horizontalDirection 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutHorDir = async (horizontalDirection: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, horizontalDirection, _horizontalDirection: horizontalDirection } }),
            `Layout horDir=${horizontalDirection===0?'L':'R'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LyHorDir</span>
            <span onClick={() => applyLayoutHorDir(0)} title="LEFT_TO_RIGHT"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>→L</span>
            <span onClick={() => applyLayoutHorDir(1)} title="RIGHT_TO_LEFT"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>←R</span>
          </div>
        )
      })()}
      {/* R1973: 공통 cc.Layout verticalDirection 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutVerDir = async (verticalDirection: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, verticalDirection, _verticalDirection: verticalDirection } }),
            `Layout verDir=${verticalDirection===0?'T':'B'} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LyVerDir</span>
            <span onClick={() => applyLayoutVerDir(0)} title="TOP_TO_BOTTOM"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>↓T</span>
            <span onClick={() => applyLayoutVerDir(1)} title="BOTTOM_TO_TOP"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>↑B</span>
          </div>
        )
      })()}
      {/* R2197: 공통 cc.Layout enabled (컴포넌트 레벨) 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutEnabled = async (enabled: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, enabled, _enabled: enabled } }),
            `Layout enabled=${enabled} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LyComp</span>
            {([['comp✓', true], ['comp✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyLayoutEnabled(v)} title={`Layout enabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2024: 공통 cc.Layout paddingRight 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPadRight = async (paddingRight: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, paddingRight, _paddingRight: paddingRight, _N$paddingRight: paddingRight } }),
            `Layout paddingRight=${paddingRight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LpadR</span>
            {[0, 5, 10, 20, 30, 50].map(v => (
              <span key={v} onClick={() => applyLayoutPadRight(v)} title={`paddingRight=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2023: 공통 cc.Layout paddingLeft 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPadLeft = async (paddingLeft: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, paddingLeft, _paddingLeft: paddingLeft, _N$paddingLeft: paddingLeft } }),
            `Layout paddingLeft=${paddingLeft} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LpadL</span>
            {[0, 5, 10, 20, 30, 50].map(v => (
              <span key={v} onClick={() => applyLayoutPadLeft(v)} title={`paddingLeft=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2022: 공통 cc.Layout paddingBottom 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPadBot = async (paddingBottom: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, paddingBottom, _paddingBottom: paddingBottom, _N$paddingBottom: paddingBottom } }),
            `Layout paddingBottom=${paddingBottom} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LpadB</span>
            {[0, 5, 10, 20, 30, 50].map(v => (
              <span key={v} onClick={() => applyLayoutPadBot(v)} title={`paddingBottom=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2021: 공통 cc.Layout paddingTop 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPadTop = async (paddingTop: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, paddingTop, _paddingTop: paddingTop, _N$paddingTop: paddingTop } }),
            `Layout paddingTop=${paddingTop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LpadT</span>
            {[0, 5, 10, 20, 30, 50].map(v => (
              <span key={v} onClick={() => applyLayoutPadTop(v)} title={`paddingTop=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1878: 공통 cc.Layout padding 일괄 설정 (uniform) */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPad = async (pad: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad, _paddingLeft: pad, _paddingRight: pad, _paddingTop: pad, _paddingBottom: pad, _N$paddingLeft: pad, _N$paddingRight: pad, _N$paddingTop: pad, _N$paddingBottom: pad } }),
            `Layout padding=${pad} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lpad</span>
            {([0, 4, 8, 12, 16, 24] as const).map(v => (
              <span key={v} title={`padding = ${v} (all sides)`}
                onClick={() => applyLayoutPad(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2041: 공통 cc.Layout spacingY 일괄 설정 (individual) */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutSpacingY = async (spacingY: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, spacingY, _spacingY: spacingY, _N$spacingY: spacingY } }),
            `Layout spacingY=${spacingY} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LspY</span>
            {[0, 2, 5, 10, 20, 30].map(v => (
              <span key={v} onClick={() => applyLayoutSpacingY(v)} title={`spacingY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2080: 공통 cc.Layout resizeMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutResizeMode = async (resizeMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, resizeMode, _resizeMode: resizeMode, _N$resizeMode: resizeMode } }),
            `Layout resizeMode=${resizeMode} (${uuids.length}개)`,
          )
        }
        // 0=NONE, 1=CONTAINER, 2=CHILDREN
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LresM</span>
            {([0, 1, 2] as const).map((v, i) => (
              <span key={v} title={`resizeMode = ${v} (${['None','Cont','Chld'][i]})`}
                onClick={() => applyLayoutResizeMode(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{['None','Cont','Chld'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2224: 공통 cc.Layout padding 사방향 프리셋 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutPad = async (pt: number, pb: number, pl: number, pr: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, paddingTop: pt, _paddingTop: pt, _N$paddingTop: pt, paddingBottom: pb, _paddingBottom: pb, _N$paddingBottom: pb, paddingLeft: pl, _paddingLeft: pl, _N$paddingLeft: pl, paddingRight: pr, _paddingRight: pr, _N$paddingRight: pr } }),
            `Layout padding=${pt}/${pb}/${pl}/${pr} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#86efac', width: 48, flexShrink: 0 }}>LayoutPad</span>
            {([['0', 0,0,0,0], ['4', 4,4,4,4], ['8', 8,8,8,8], ['12', 12,12,12,12], ['16', 16,16,16,16], ['20', 20,20,20,20]] as const).map(([l, pt, pb, pl, pr]) => (
              <span key={String(l)} onClick={() => applyLayoutPad(pt, pb, pl, pr)} title={`padding=${l}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#86efac', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2140: 공통 cc.Layout autoWrap 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutAutoWrap = async (autoWrap: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, autoWrap, _autoWrap: autoWrap } }),
            `Layout autoWrap=${autoWrap} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LAutoWrp</span>
            <span onClick={() => applyLayoutAutoWrap(true)} title="autoWrap ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>wrap✓</span>
            <span onClick={() => applyLayoutAutoWrap(false)} title="autoWrap OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>wrap✗</span>
          </div>
        )
      })()}
      {/* R2112: 공통 cc.Layout affectedByScale 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutAffected = async (affectedByScale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, affectedByScale, _affectedByScale: affectedByScale } }),
            `Layout affectedByScale=${affectedByScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LScaleAff</span>
            <span onClick={() => applyLayoutAffected(true)} title="affectedByScale ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>aff✓</span>
            <span onClick={() => applyLayoutAffected(false)} title="affectedByScale OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>aff✗</span>
          </div>
        )
      })()}
      {/* R2079: 공통 cc.Layout constraint 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutConstraint = async (constraint: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, constraint, _constraint: constraint, _N$constraint: constraint } }),
            `Layout constraint=${constraint} (${uuids.length}개)`,
          )
        }
        // 0=NONE, 1=FIXED_ROW, 2=FIXED_COL
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lconst</span>
            {([0, 1, 2] as const).map((v, i) => (
              <span key={v} title={`constraint = ${v} (${['None','FixRow','FixCol'][i]})`}
                onClick={() => applyLayoutConstraint(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{['None','FRow','FCol'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2163: 공통 cc.Layout constraintNum 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyConstraintNum = async (constraintNum: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, constraintNum, _constraintNum: constraintNum, _N$constraintNum: constraintNum } }),
            `Layout constraintNum=${constraintNum} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LconN</span>
            {[1, 2, 3, 4, 5, 6].map(v => (
              <span key={v} onClick={() => applyConstraintNum(v)} title={`constraintNum=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2078: 공통 cc.Layout startAxis 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutStartAxis = async (startAxis: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, startAxis, _startAxis: startAxis, _N$startAxis: startAxis } }),
            `Layout startAxis=${startAxis} (${uuids.length}개)`,
          )
        }
        // 0=HORIZONTAL, 1=VERTICAL
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LaxisX</span>
            {([0, 1] as const).map((v, i) => (
              <span key={v} title={`startAxis = ${v} (${['H','V'][i]})`}
                onClick={() => applyLayoutStartAxis(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{['H','V'][i]}</span>
            ))}
          </div>
        )
      })()}
      {/* R2068: 공통 cc.Layout cellSize 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutCell = async (size: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            const cellSize = { width: size, height: size }
            const components = n.components.map(c => c.type === 'cc.Layout' ? { ...c, props: { ...c.props, cellSize, _cellSize: cellSize, _N$cellSize: cellSize } } : c)
            return { ...n, components }
          }, `Layout cellSize=${size}x${size} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LcellS</span>
            {[40, 60, 80, 100, 120, 160].map(v => (
              <span key={v} title={`cellSize = ${v}x${v}`}
                onClick={() => applyLayoutCell(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2040: 공통 cc.Layout spacingX 일괄 설정 (individual) */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutSpacingX = async (spacingX: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, spacingX, _spacingX: spacingX, _N$spacingX: spacingX } }),
            `Layout spacingX=${spacingX} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LspX</span>
            {[0, 2, 5, 10, 20, 30].map(v => (
              <span key={v} onClick={() => applyLayoutSpacingX(v)} title={`spacingX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1879: 공통 cc.Layout spacingX/Y 일괄 설정 (uniform) */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutSpacing = async (sp: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, spacingX: sp, spacingY: sp, _spacingX: sp, _spacingY: sp, _N$spacingX: sp, _N$spacingY: sp } }),
            `Layout spacing=${sp} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lspacing</span>
            {([0, 2, 4, 8, 12, 16] as const).map(v => (
              <span key={v} title={`spacingX/Y = ${v}`}
                onClick={() => applyLayoutSpacing(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1894: 공통 cc.Layout resizeMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutResize = async (resizeMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, resizeMode, _resizeMode: resizeMode, _N$resizeMode: resizeMode } }),
            `Layout Resize`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lresize</span>
            {(['None', 'Container', 'Children'] as const).map((l, v) => (
              <span key={v} title={`resizeMode = ${l}`}
                onClick={() => applyLayoutResize(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R1934: 공통 cc.Layout affectedByScale 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutScale = async (affectedByScale: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, affectedByScale, _affectedByScale: affectedByScale } }),
            `Layout affectedByScale=${affectedByScale} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Lscale</span>
            {([true, false] as const).map(v => (
              <span key={String(v)} title={`affectedByScale = ${v}`}
                onClick={() => applyLayoutScale(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
              >{v ? 'sc✓' : 'sc✗'}</span>
            ))}
          </div>
        )
      })()}
      {/* R1822: 공통 cc.Widget alignment 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>Widget</span>
          {([
            { label: '⊞ Stretch', patch: { isAlignTop: true, isAlignBottom: true, isAlignLeft: true, isAlignRight: true, isAlignHorizontalCenter: false, isAlignVerticalCenter: false, top: 0, bottom: 0, left: 0, right: 0 } },
            { label: '⊕ Center', patch: { isAlignTop: false, isAlignBottom: false, isAlignLeft: false, isAlignRight: false, isAlignHorizontalCenter: true, isAlignVerticalCenter: true } },
            { label: '✕ None', patch: { isAlignTop: false, isAlignBottom: false, isAlignLeft: false, isAlignRight: false, isAlignHorizontalCenter: false, isAlignVerticalCenter: false } },
          ]).map(({ label, patch }) => (
            <span key={label}
              title={`Widget ${label}`}
              onClick={async () => {
                if (!sceneFile.root) return
                await patchComponents(
                  c => c.type === 'cc.Widget',
                  c => ({ ...c, props: { ...c.props, ...patch } }),
                  `Widget ${label} (${uuids.length}개)`,
                )
              }}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}
            >{label}</span>
          ))}
        </div>
      )}
      {/* R2057: 공통 cc.Layout wrapMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Layout') && (() => {
        const applyLayoutWrap = async (wrapMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Layout',
            c => ({ ...c, props: { ...c.props, wrapMode, _wrapMode: wrapMode, _N$wrapMode: wrapMode } }),
            `Layout Wrap`,
          )
          const names = ['NoWrap','Wrap','SingleLine']
          setBatchMsg(`✓ Layout wrapMode=${names[wrapMode]??wrapMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>LwrapM</span>
            {([['NoWrap',0],['Wrap',1],['1Line',2]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyLayoutWrap(v)} title={`wrapMode=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R2169: 공통 cc.Widget isAbs* 플래그 일괄 설정 (절대값/% 전환) */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAbs = async (isAbs: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, isAbsTop: isAbs, _isAbsTop: isAbs, _N$isAbsTop: isAbs, isAbsBottom: isAbs, _isAbsBottom: isAbs, _N$isAbsBottom: isAbs, isAbsLeft: isAbs, _isAbsLeft: isAbs, _N$isAbsLeft: isAbs, isAbsRight: isAbs, _isAbsRight: isAbs, _N$isAbsRight: isAbs, isAbsHorizontalCenter: isAbs, _isAbsHorizontalCenter: isAbs, _N$isAbsHorizontalCenter: isAbs, isAbsVerticalCenter: isAbs, _isAbsVerticalCenter: isAbs, _N$isAbsVerticalCenter: isAbs, } }),
            `Widget isAbs*=${isAbs} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtAbs</span>
            <span onClick={() => applyWidgetIsAbs(true)} title="isAbs* 모두 true (절대px)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>px✓</span>
            <span onClick={() => applyWidgetIsAbs(false)} title="isAbs* 모두 false (%)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>%✗</span>
          </div>
        )
      })()}
      {/* R2101: 공통 cc.Widget verticalCenter 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetVCenter = async (verticalCenter: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, verticalCenter, _verticalCenter: verticalCenter, _N$verticalCenter: verticalCenter } }),
            `Widget verticalCenter=${verticalCenter} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtVC</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`verticalCenter = ${v}`}
                onClick={() => applyWidgetVCenter(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2100: 공통 cc.Widget horizontalCenter 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetHCenter = async (horizontalCenter: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, horizontalCenter, _horizontalCenter: horizontalCenter, _N$horizontalCenter: horizontalCenter } }),
            `Widget horizontalCenter=${horizontalCenter} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtHC</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`horizontalCenter = ${v}`}
                onClick={() => applyWidgetHCenter(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2099: 공통 cc.Widget right 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetRight = async (right: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, right, _right: right, _N$right: right } }),
            `Widget right=${right} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtRgt</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`right = ${v}`}
                onClick={() => applyWidgetRight(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2098: 공통 cc.Widget left 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetLeft = async (left: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, left, _left: left, _N$left: left } }),
            `Widget left=${left} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtLeft</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`left = ${v}`}
                onClick={() => applyWidgetLeft(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2097: 공통 cc.Widget bottom 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetBot = async (bottom: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, bottom, _bottom: bottom, _N$bottom: bottom } }),
            `Widget bottom=${bottom} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtBot</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`bottom = ${v}`}
                onClick={() => applyWidgetBot(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2125: 공통 cc.Widget isAlignRight 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignRight = async (isAlignRight: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, isAlignRight, _isAlignRight: isAlignRight } }),
            `Widget isAlignRight=${isAlignRight} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WARight</span>
            <span onClick={() => applyWidgetIsAlignRight(true)} title="isAlignRight ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>R✓</span>
            <span onClick={() => applyWidgetIsAlignRight(false)} title="isAlignRight OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>R✗</span>
          </div>
        )
      })()}
      {/* R2127: 공통 cc.Widget isAlignVerticalCenter 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignVCenter = async (isAlignVerticalCenter: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, isAlignVerticalCenter, _isAlignVerticalCenter: isAlignVerticalCenter, _N$isAlignVerticalCenter: isAlignVerticalCenter } }),
            `Widget isAlignVerticalCenter=${isAlignVerticalCenter} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WAVCtr</span>
            <span onClick={() => applyWidgetIsAlignVCenter(true)} title="isAlignVerticalCenter ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>VC✓</span>
            <span onClick={() => applyWidgetIsAlignVCenter(false)} title="isAlignVerticalCenter OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>VC✗</span>
          </div>
        )
      })()}
      {/* R2126: 공통 cc.Widget isAlignHorizontalCenter 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignHCenter = async (isAlignHorizontalCenter: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, isAlignHorizontalCenter, _isAlignHorizontalCenter: isAlignHorizontalCenter, _N$isAlignHorizontalCenter: isAlignHorizontalCenter } }),
            `Widget isAlignHorizontalCenter=${isAlignHorizontalCenter} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WAHCtr</span>
            <span onClick={() => applyWidgetIsAlignHCenter(true)} title="isAlignHorizontalCenter ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>HC✓</span>
            <span onClick={() => applyWidgetIsAlignHCenter(false)} title="isAlignHorizontalCenter OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>HC✗</span>
          </div>
        )
      })()}
      {/* R2124: 공통 cc.Widget isAlignLeft 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignLeft = async (isAlignLeft: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, isAlignLeft, _isAlignLeft: isAlignLeft } }),
            `Widget isAlignLeft=${isAlignLeft} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WALeft</span>
            <span onClick={() => applyWidgetIsAlignLeft(true)} title="isAlignLeft ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>L✓</span>
            <span onClick={() => applyWidgetIsAlignLeft(false)} title="isAlignLeft OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>L✗</span>
          </div>
        )
      })()}
      {/* R2123: 공통 cc.Widget isAlignBottom 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignBot = async (isAlignBottom: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, isAlignBottom, _isAlignBottom: isAlignBottom } }),
            `Widget isAlignBottom=${isAlignBottom} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WABot</span>
            <span onClick={() => applyWidgetIsAlignBot(true)} title="isAlignBottom ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>B✓</span>
            <span onClick={() => applyWidgetIsAlignBot(false)} title="isAlignBottom OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>B✗</span>
          </div>
        )
      })()}
      {/* R2122: 공통 cc.Widget isAlignTop 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetIsAlignTop = async (isAlignTop: boolean) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, isAlignTop, _isAlignTop: isAlignTop } }),
            `Widget isAlignTop=${isAlignTop} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WATop</span>
            <span onClick={() => applyWidgetIsAlignTop(true)} title="isAlignTop ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>T✓</span>
            <span onClick={() => applyWidgetIsAlignTop(false)} title="isAlignTop OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: 'var(--text-muted)', userSelect: 'none' }}>T✗</span>
          </div>
        )
      })()}
      {/* R2096: 공통 cc.Widget top 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetTop = async (top: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, top, _top: top, _N$top: top } }),
            `Widget top=${top} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WgtTop</span>
            {[0, 10, 20, 30, 50, 100].map(v => (
              <span key={v} title={`top = ${v}`}
                onClick={() => applyWidgetTop(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}
              >{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2043: 공통 cc.Widget alignMode 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetAlignMode = async (alignMode: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, alignMode, _alignMode: alignMode, _N$alignMode: alignMode } }),
            `Widget Align Mode`,
          )
          const names = ['Once','OnResize','Always']
          setBatchMsg(`✓ Widget alignMode=${names[alignMode]??alignMode} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#60a5fa', width: 48, flexShrink: 0 }}>WidgAM</span>
            {([['Once',0],['Resize',1],['Always',2]] as [string,number][]).map(([label,v]) => (
              <span key={v} onClick={() => applyWidgetAlignMode(v)} title={`alignMode=${label}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#60a5fa', userSelect: 'none' }}>{label}</span>
            ))}
          </div>
        )
      })()}
      {/* R1974: 공통 cc.Widget margin(top/bottom/left/right) 일괄 설정 */}
      {commonCompTypes.includes('cc.Widget') && (() => {
        const applyWidgetMargin = async (v: number) => {
          if (!sceneFile.root) return
          await patchComponents(
            c => c.type === 'cc.Widget',
            c => ({ ...c, props: { ...c.props, top: v, _top: v, bottom: v, _bottom: v, left: v, _left: v, right: v, _right: v, _N$top: v, _N$bottom: v, _N$left: v, _N$right: v } }),
            `Widget margin=${v} (${uuids.length}개)`,
          )
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', width: 48, flexShrink: 0 }}>WgMargin</span>
            {[0, 10, 20, 50, 100].map(v => (
              <span key={v} onClick={() => applyWidgetMargin(v)}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#a78bfa', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
    </>
  )
}
