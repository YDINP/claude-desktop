import React, { useState, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'

export function ColorPlugin({ nodes, sceneFile, saveScene }: BatchPluginProps) {
  const uuids = nodes.map(n => n.uuid)
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes, patchOrdered } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  const [opGradFrom, setOpGradFrom] = useState<number>(255)
  const [opGradTo, setOpGradTo] = useState<number>(0)
  const [colorGradFrom, setColorGradFrom] = useState<string>('#ffffff')
  const [colorGradTo, setColorGradTo] = useState<string>('#ff0000')
  const [colorBlendTarget, setColorBlendTarget] = useState<string>('#ff0000')
  const [colorBlendAmount, setColorBlendAmount] = useState<number>(50)
  const [colorDeltaR, setColorDeltaR] = useState<number>(0)
  const [colorDeltaG, setColorDeltaG] = useState<number>(0)
  const [colorDeltaB, setColorDeltaB] = useState<number>(0)
  const [colorDeltaA, setColorDeltaA] = useState<number>(0)
  const [opacityMult, setOpacityMult] = useState<number>(80)
  const [opacityFixed, setOpacityFixed] = useState<number>(255)

  const mkBtnS = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontSize: 9, padding: '1px 5px', cursor: 'pointer',
    border: '1px solid var(--border)', borderRadius: 2,
    color, userSelect: 'none', ...extra,
  })
  const mkNiS = (w: number, padding = '1px 3px'): React.CSSProperties => ({
    width: w, fontSize: 9, padding, border: '1px solid var(--border)',
    borderRadius: 2, background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', textAlign: 'center',
  })

  return (
    <div>
      {batchMsg && <div style={{ fontSize: 9, color: '#4ade80', marginBottom: 4 }}>{batchMsg}</div>}

      {/* R2525: 오파시티 그라디언트 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyOpGrad = () => patchOrdered((n, idx, total) => {
          const t = total > 1 ? idx / (total - 1) : 0
          const op = Math.round(opGradFrom + (opGradTo - opGradFrom) * t)
          return { ...n, opacity: Math.max(0, Math.min(255, op)) }
        }, `오파시티 그라디언트 ${opGradFrom}→${opGradTo} (${uuids.length}개)`)
        const niS = mkNiS(36)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>불투명도 (R2525)</span>
            <input type="number" value={opGradFrom} min={0} max={255} onChange={e => setOpGradFrom(Math.max(0, Math.min(255, parseInt(e.target.value) || 0)))} style={niS} title="시작 opacity (0-255)" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="number" value={opGradTo} min={0} max={255} onChange={e => setOpGradTo(Math.max(0, Math.min(255, parseInt(e.target.value) || 0)))} style={niS} title="끝 opacity (0-255)" />
            <span onClick={applyOpGrad}
              title={`선택된 ${uuids.length}개 노드에 opacity ${opGradFrom}→${opGradTo} 선형 그라디언트 적용 (R2525)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#c084fc', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#c084fc')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >그라디언트</span>
          </div>
        )
      })()}

      {/* R2621: opacity 스냅 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const applyOpSnap = (step: number) => patchNodes(n => {
          const cur = n.opacity ?? 255
          const snapped = Math.max(0, Math.min(255, Math.round(cur / step) * step))
          return { ...n, opacity: snapped }
        }, `opacity 스냅 ${step} (${uuids.length}개)`)
        const btnS = mkBtnS('#c084fc')
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>op스냅 (R2621)</span>
            {[64, 128, 192, 255].map(step => (
              <span key={step} onClick={() => applyOpSnap(step)}
                title={`opacity를 ${step} 배수로 반올림 (R2621)`}
                style={btnS}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#c084fc')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >{step}</span>
            ))}
          </div>
        )
      })()}

      {/* R2596: 색상(tint) 그라디언트 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyColorGrad = () => {
          const parseHex = (hex: string) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) })
          const from = parseHex(colorGradFrom)
          const to = parseHex(colorGradTo)
          return patchOrdered((n, idx, total) => {
            const t = total > 1 ? idx / (total - 1) : 0
            return { ...n, color: { r: Math.round(from.r + (to.r - from.r) * t), g: Math.round(from.g + (to.g - from.g) * t), b: Math.round(from.b + (to.b - from.b) * t), a: (n.color?.a ?? 255) } }
          }, `색상 그라디언트 ${colorGradFrom}→${colorGradTo} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>색상 (R2596)</span>
            <input type="color" value={colorGradFrom} onChange={e => setColorGradFrom(e.target.value)} style={{ width: 26, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }} title="시작 색상" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input type="color" value={colorGradTo} onChange={e => setColorGradTo(e.target.value)} style={{ width: 26, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }} title="끝 색상" />
            <span onClick={applyColorGrad}
              title={`선택된 ${uuids.length}개 노드에 tint 색상 ${colorGradFrom}→${colorGradTo} 선형 그라디언트 적용 (R2596)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#f472b6', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f472b6')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >색상그라디언트</span>
          </div>
        )
      })()}

      {/* R2631: 선택 노드 색상 팔레트 */}
      {sceneFile.root && uuids.length >= 1 && (() => {
        const colorMap = new Map<string, { r: number; g: number; b: number; a: number }>()
        function collect(n: CCSceneNode) {
          if (uuidSet.has(n.uuid) && n.color) {
            const key = `${n.color.r},${n.color.g},${n.color.b}`
            if (!colorMap.has(key)) colorMap.set(key, { ...n.color })
          }
          n.children.forEach(collect)
        }
        collect(sceneFile.root!)
        if (colorMap.size === 0) return null
        const colors = [...colorMap.entries()].slice(0, 12)
        const applyColor = async (r: number, g: number, b: number, a: number) => {
          await patchNodes(n => ({ ...n, color: { r, g, b, a: n.color?.a ?? a } }), `색상 적용 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>팔레트 (R2631)</span>
            {colors.map(([key, c]) => (
              <div key={key}
                onClick={() => applyColor(c.r, c.g, c.b, c.a)}
                title={`rgb(${c.r},${c.g},${c.b}) — 클릭하여 선택 노드에 적용 (R2631)`}
                style={{ width: 16, height: 16, borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: `rgb(${c.r},${c.g},${c.b})`, flexShrink: 0 }}
              />
            ))}
          </div>
        )
      })()}

      {/* R2626: 무지개 색상 분배 */}
      {sceneFile.root && uuids.length >= 2 && (() => {
        const applyRainbow = () => {
          function hslToRgb(h: number, s: number, l: number) {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s
            const p = 2 * l - q
            const hue2rgb = (t: number) => {
              if (t < 0) t += 1; if (t > 1) t -= 1
              if (t < 1 / 6) return p + (q - p) * 6 * t
              if (t < 1 / 2) return q
              if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
              return p
            }
            return { r: Math.round(hue2rgb(h + 1 / 3) * 255), g: Math.round(hue2rgb(h) * 255), b: Math.round(hue2rgb(h - 1 / 3) * 255) }
          }
          return patchOrdered((n, idx, total) => {
            const hue = idx / total
            const rgb = hslToRgb(hue, 1, 0.6)
            return { ...n, color: { ...rgb, a: n.color?.a ?? 255 } }
          }, `무지개 색상 (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>무지개 (R2626)</span>
            <span onClick={applyRainbow}
              title={`선택된 ${uuids.length}개 노드에 HSL 균등 색조 무지개 분배 적용 (R2626)`}
              style={{ fontSize: 9, padding: '1px 8px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, background: 'linear-gradient(to right, #f87171, #fb923c, #facc15, #4ade80, #60a5fa, #a78bfa, #f472b6)', color: '#fff', userSelect: 'none', fontWeight: 600 }}
            >적용</span>
          </div>
        )
      })()}

      {/* R2657: opacity 255 일괄 리셋 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>op리셋 (R2657)</span>
            <span onClick={() => patchNodes(n => ({ ...n, opacity: 255 }), `opacity 255 리셋 (${uuids.length}개)`)}
              title="선택 노드 opacity를 255(불투명)으로 리셋 (R2657)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }}>op=255</span>
          </div>
        )
      })()}

      {/* R2678: opacity 배수 곱하기 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyOpacityMult = () => {
          const mult = Math.max(0, Math.min(200, opacityMult)) / 100
          return patchNodes(n => {
            const op = Math.max(0, Math.min(255, Math.round((n.opacity ?? 255) * mult)))
            return { ...n, opacity: op }
          }, `opacity ×${opacityMult}% (${uuids.length}개)`)
        }
        const niS = mkNiS(36)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>op배수 (R2678)</span>
            <input type="number" value={opacityMult} min={0} max={200} step={10} onChange={e => setOpacityMult(parseInt(e.target.value) || 0)} style={niS} title="opacity 배수 (%)" />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>%</span>
            <span onClick={applyOpacityMult}
              title={`opacity × ${opacityMult}% (R2678)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#c084fc', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#c084fc')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >적용</span>
          </div>
        )
      })()}

      {/* R2702: opacity 고정값 일괄 설정 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyOpacityFixed = async () => {
          await patchNodes(n => ({ ...n, opacity: Math.max(0, Math.min(255, opacityFixed)) }), `opacity 고정값 ${opacityFixed} (${uuids.length}개)`)
        }
        const niS = mkNiS(45)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>op고정 (R2702)</span>
            <input type="number" min={0} max={255} value={opacityFixed} onChange={e => setOpacityFixed(Number(e.target.value))} style={niS} />
            {[0, 64, 128, 192, 255].map(v => (
              <span key={v} onClick={() => setOpacityFixed(v)} title={`opacity = ${v}`}
                style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: `1px solid ${v === opacityFixed ? '#4a9d6f' : 'var(--border)'}`, color: v === opacityFixed ? '#4a9d6f' : '#94a3b8', userSelect: 'none' }}>{v}</span>
            ))}
            <span onClick={applyOpacityFixed}
              title={`선택 노드 opacity = ${opacityFixed} (R2702)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid rgba(42,74,106,0.6)', color: '#2a4a6a', userSelect: 'none' }}>적용</span>
          </div>
        )
      })()}

      {/* R2656: 색상 흰색 일괄 리셋 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>color리셋 (R2656)</span>
            <span onClick={() => patchNodes(n => ({ ...n, color: { r: 255, g: 255, b: 255, a: n.color?.a ?? 255 } }), `color 흰색 리셋 (${uuids.length}개)`)}
              title="선택 노드 color를 흰색(255,255,255)으로 리셋 (R2656)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid rgba(255,255,255,0.3)', color: '#e2e8f0', userSelect: 'none', background: 'rgba(255,255,255,0.05)' }}>흰색</span>
          </div>
        )
      })()}

      {/* R2693: 랜덤 색상 일괄 적용 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>색상 (R2693)</span>
            <span onClick={() => patchNodes(n => ({ ...n, color: { r: Math.round(Math.random() * 255), g: Math.round(Math.random() * 255), b: Math.round(Math.random() * 255), a: n.color?.a ?? 255 } }), `랜덤 색상 (${uuids.length}개)`)}
              title="각 노드에 랜덤 RGB 색상 적용 (R2693)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid rgba(251,113,133,0.4)', color: '#fb7185', userSelect: 'none' }}>랜덤</span>
          </div>
        )
      })()}

      {/* R2677: 색상 반전 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>color반전 (R2677)</span>
            <span onClick={() => patchNodes(n => {
              const c = n.color ?? { r: 255, g: 255, b: 255, a: 255 }
              return { ...n, color: { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b, a: c.a } }
            }, `color 반전 (${uuids.length}개)`)}
              title="색상 반전 (255-r, 255-g, 255-b) (R2677)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 6px', borderRadius: 2, border: '1px solid rgba(244,114,182,0.4)', color: '#f472b6', userSelect: 'none' }}>반전</span>
          </div>
        )
      })()}

      {/* R2676: 색상 블렌드 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyColorBlend = async () => {
          const hex = colorBlendTarget.replace('#', '')
          const tr = parseInt(hex.slice(0, 2), 16)
          const tg = parseInt(hex.slice(2, 4), 16)
          const tb = parseInt(hex.slice(4, 6), 16)
          const t = Math.max(0, Math.min(100, colorBlendAmount)) / 100
          await patchNodes(n => {
            const c = n.color ?? { r: 255, g: 255, b: 255, a: 255 }
            return { ...n, color: { r: Math.round(c.r + (tr - c.r) * t), g: Math.round(c.g + (tg - c.g) * t), b: Math.round(c.b + (tb - c.b) * t), a: c.a } }
          }, `color 블렌드 ${colorBlendAmount}% → ${colorBlendTarget} (${uuids.length}개)`)
        }
        const niS = mkNiS(36)
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>color블렌드 (R2676)</span>
            <input type="color" value={colorBlendTarget} onChange={e => setColorBlendTarget(e.target.value)} style={{ width: 22, height: 18, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 2, background: 'none' }} title="목표 색상" />
            <input type="number" value={colorBlendAmount} min={0} max={100} step={10} onChange={e => setColorBlendAmount(parseInt(e.target.value) || 0)} style={niS} title="블렌드 비율 (%)" />
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>%</span>
            <span onClick={applyColorBlend}
              title={`현재 색상을 ${colorBlendTarget}으로 ${colorBlendAmount}% 블렌드 (R2676)`}
              style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#f472b6', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f472b6')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >블렌드</span>
          </div>
        )
      })()}

      {/* R2704: 색상 채널 오프셋 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyColorDelta = async () => {
          await patchNodes(n => {
            const c = n.color ?? { r: 255, g: 255, b: 255, a: 255 }
            return { ...n, color: { r: Math.min(255, Math.max(0, c.r + colorDeltaR)), g: Math.min(255, Math.max(0, c.g + colorDeltaG)), b: Math.min(255, Math.max(0, c.b + colorDeltaB)), a: Math.min(255, Math.max(0, (c.a ?? 255) + colorDeltaA)) } }
          }, `ΔColor R${colorDeltaR} G${colorDeltaG} B${colorDeltaB} A${colorDeltaA} (${uuids.length}개)`)
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>색상오프셋 (R2704)</span>
            <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 150 }}>
              {([['R', colorDeltaR, setColorDeltaR], ['G', colorDeltaG, setColorDeltaG], ['B', colorDeltaB, setColorDeltaB], ['A', colorDeltaA, setColorDeltaA]] as const).map(([label, val, setter]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 9 }}>Δ{label}</span>
                  <input type="number" min={-255} max={255} value={val}
                    onChange={e => setter(Number(e.target.value))}
                    style={{ width: 35, fontSize: 9, padding: '1px 3px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'center' }} />
                </span>
              ))}
            </div>
            <span onClick={() => { setColorDeltaR(30); setColorDeltaG(30); setColorDeltaB(30) }} style={mkBtnS('#3a5a3a')} title="R/G/B +30">+밝게</span>
            <span onClick={() => { setColorDeltaR(-30); setColorDeltaG(-30); setColorDeltaB(-30) }} style={mkBtnS('#3a3a5a')} title="R/G/B -30">-어둡게</span>
            <span onClick={() => { setColorDeltaR(0); setColorDeltaG(0); setColorDeltaB(0); setColorDeltaA(0) }} style={mkBtnS('#555')} title="모든 델타 0으로 리셋">리셋</span>
            <span onClick={applyColorDelta} style={mkBtnS('#2a4a6a')} title={`선택된 ${uuids.length}개 노드 색상 채널 오프셋 적용 (R2704)`}>적용</span>
          </div>
        )
      })()}
    </div>
  )
}
