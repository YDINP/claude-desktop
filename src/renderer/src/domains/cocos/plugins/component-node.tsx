import React from 'react'
import type { ComponentSectionProps } from './component-shared'

export function NodeSection({ uuids, uuidSet, sceneFile, saveScene, patchNodes, patchComponents, patchOrdered, commonCompTypes, setBatchMsg }: ComponentSectionProps) {
  return (
    <>
      {/* R2163: 노드 _tag 일괄 설정 (CC2.x 노드 태그) */}
      {(() => {
        const applyNodeTag = async (tag: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _tag: tag }), `_tag=${tag} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Tag</span>
            {[0, 1, 2, 3, 10, 100].map(v => (
              <span key={v} onClick={() => applyNodeTag(v)} title={`_tag=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2174: 노드 _group 일괄 설정 (CC2.x 레이어/물리 그룹) */}
      {(() => {
        const applyNodeGroup = async (group: string) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _group: group }), `_group="${group}" (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodeGrp</span>
            {(['default', 'wall', 'ground', 'player', 'enemy', 'trigger'].map(g => (
              <span key={g} onClick={() => applyNodeGroup(g)} title={`_group="${g}"`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{g}</span>
            )))}
          </div>
        )
      })()}
      {/* R2161: 노드 _zIndex 일괄 설정 (CC2.x z-order) */}
      {(() => {
        const applyZIndex = async (zIndex: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _zIndex: zIndex }), `_zIndex=${zIndex} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>zIdx</span>
            {[0, 1, 2, 5, 10, -1].map(v => (
              <span key={v} onClick={() => applyZIndex(v)} title={`_zIndex=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2184: 노드 cascadeColorEnabled 일괄 설정 (CC2.x) */}
      {(() => {
        const applyNodeCascadeColor = async (cascadeColorEnabled: boolean) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, cascadeColorEnabled }), `cascadeColorEnabled=${cascadeColorEnabled} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CscCol</span>
            {([['col✓', true], ['col✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyNodeCascadeColor(v)} title={`cascadeColorEnabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2183: 노드 cascadeOpacityEnabled 일괄 설정 (CC2.x) */}
      {(() => {
        const applyNodeCascadeOpacity = async (cascadeOpacityEnabled: boolean) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, cascadeOpacityEnabled }), `cascadeOpacity=${cascadeOpacityEnabled} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>CscOp</span>
            {([['cas✓', true], ['cas✗', false]] as const).map(([l, v]) => (
              <span key={String(v)} onClick={() => applyNodeCascadeOpacity(v)} title={`cascadeOpacityEnabled=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{l}</span>
            ))}
          </div>
        )
      })()}
      {/* R2166: 노드 _skewX 일괄 설정 (CC2.x) */}
      {(() => {
        const applySkewX = async (skewX: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _skewX: skewX }), `_skewX=${skewX} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>skewX</span>
            {[0, 10, 20, 30, 45, -10].map(v => (
              <span key={v} onClick={() => applySkewX(v)} title={`_skewX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2166: 노드 _skewY 일괄 설정 (CC2.x) */}
      {(() => {
        const applySkewY = async (skewY: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _skewY: skewY }), `_skewY=${skewY} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>skewY</span>
            {[0, 10, 20, 30, 45, -10].map(v => (
              <span key={v} onClick={() => applySkewY(v)} title={`_skewY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2214: 노드 _rotationX 일괄 설정 (CC2.x 3D 회전) */}
      {(() => {
        const applyNodeRotX = async (rotationX: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _rotationX: rotationX }), `_rotationX=${rotationX} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodRX</span>
            {[0, 30, 45, 60, 90, 180, -90].map(v => (
              <span key={v} onClick={() => applyNodeRotX(v)} title={`_rotationX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2214: 노드 _rotationY 일괄 설정 (CC2.x 3D 회전) */}
      {(() => {
        const applyNodeRotY = async (rotationY: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, _rotationY: rotationY }), `_rotationY=${rotationY} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodRY</span>
            {[0, 30, 45, 60, 90, 180, -90].map(v => (
              <span key={v} onClick={() => applyNodeRotY(v)} title={`_rotationY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2006: 노드 rotation 일괄 설정 */}
      {(() => {
        const applyNodeRotation = async (deg: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            return { ...n, rotation: { x: 0, y: 0, z: deg } }
          }, `rotation=${deg}° (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Rot</span>
            {[0, 45, 90, 180, -90, -45].map(v => (
              <span key={v} onClick={() => applyNodeRotation(v)} title={`rotation=${v}°`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}°</span>
            ))}
          </div>
        )
      })()}
      {/* R2003: 노드 scale 일괄 설정 */}
      {(() => {
        const applyNodeScale = async (s: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, scale: { x: s, y: s, z: s } }), `scale=${s} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Scale</span>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
              <span key={v} onClick={() => applyNodeScale(v)} title={`scale=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}x</span>
            ))}
          </div>
        )
      })()}
      {/* R2202: 노드 scaleX 일괄 설정 (플립/비균등 스케일) */}
      {(() => {
        const applyNodeScaleX = async (sx: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, scale: { ...(n.scale || { x: 1, y: 1, z: 1 }), x: sx } }), `scaleX=${sx} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodSX</span>
            {[-1, 0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
              <span key={v} onClick={() => applyNodeScaleX(v)} title={`scaleX=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2202: 노드 scaleY 일괄 설정 (플립/비균등 스케일) */}
      {(() => {
        const applyNodeScaleY = async (sy: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, scale: { ...(n.scale || { x: 1, y: 1, z: 1 }), y: sy } }), `scaleY=${sy} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodSY</span>
            {[-1, 0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
              <span key={v} onClick={() => applyNodeScaleY(v)} title={`scaleY=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2,
                  border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R1996: 노드 color(tint) 일괄 설정 */}
      {(() => {
        const applyNodeTint = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          await patchNodes(n => ({ ...n, color: { r, g, b, a: n.color?.a ?? 255 } }), `node tint=${hex} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>Tint</span>
            <input type="color" defaultValue="#ffffff"
              style={{ width: 20, height: 16, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 2, background: 'none' }}
              onChange={e => applyNodeTint(e.target.value)} />
            {['#ffffff','#ff0000','#00ff00','#0000ff','#ffff00'].map(c => (
              <span key={c} onClick={() => applyNodeTint(c)} title={c}
                style={{ width: 12, height: 12, borderRadius: 2, background: c, cursor: 'pointer', border: '1px solid var(--border)', flexShrink: 0 }} />
            ))}
          </div>
        )
      })()}
      {/* R1993: 노드 layer 일괄 설정 (CC3.x) */}
      {(() => {
        const applyNodeLayer = async (layer: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, layer }), `Node Layer`)
          const names: Record<number, string> = { 2: 'Dflt', 32: 'UI', 33554432: 'UI2D' }
          setBatchMsg(`✓ layer=${names[layer] ?? layer} (${uuids.length}개)`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodeLay</span>
            <span onClick={() => applyNodeLayer(2)} title="DEFAULT(1<<1=2)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>Dflt</span>
            <span onClick={() => applyNodeLayer(32)} title="UI(1<<5=32)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>UI</span>
            <span onClick={() => applyNodeLayer(33554432)} title="UI_2D(1<<25=33554432)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#94a3b8', userSelect: 'none' }}>UI2D</span>
          </div>
        )
      })()}
      {/* R2053: 노드 opacity preset 일괄 설정 */}
      {(() => {
        const applyNodeOpacity = async (opacity: number) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, opacity }), `opacity=${opacity} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>NodeOpa</span>
            {[0, 64, 128, 192, 255].map(v => (
              <span key={v} onClick={() => applyNodeOpacity(v)} title={`opacity=${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 4px', borderRadius: 2, border: '1px solid var(--border)', color: '#fb923c', userSelect: 'none' }}>{v}</span>
            ))}
          </div>
        )
      })()}
      {/* R2131: 노드 color preset 일괄 설정 */}
      {(() => {
        const applyNodeColor = async (hex: string) => {
          if (!sceneFile.root) return
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
          const color = { r, g, b, a: 255 }
          await patchNodes(n => ({ ...n, color }), `node color=${hex} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#fb923c', width: 48, flexShrink: 0 }}>NodeClr</span>
            <input type="color" defaultValue="#ffffff"
              onChange={e => applyNodeColor(e.target.value)}
              style={{ width: 28, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer' }}
            />
            {(['#ffffff','#000000','#ff0000','#00ff00','#0000ff','#ffff00'] as const).map(c => (
              <span key={c} title={c} onClick={() => applyNodeColor(c)}
                style={{ width: 14, height: 14, borderRadius: 2, background: c, border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}
      {/* R1983: 노드 active/inactive 일괄 설정 */}
      {(() => {
        const applyNodeActive = async (active: boolean) => {
          if (!sceneFile.root) return
          await patchNodes(n => ({ ...n, active }), `node active=${active} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>NodeAct</span>
            <span onClick={() => applyNodeActive(true)} title="active ON"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#4ade80', userSelect: 'none' }}>act✓</span>
            <span onClick={() => applyNodeActive(false)} title="active OFF"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid var(--border)', color: '#f85149', userSelect: 'none' }}>act✗</span>
          </div>
        )
      })()}
    </>
  )
}
