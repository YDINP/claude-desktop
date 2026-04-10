/**
 * R2727: BatchInspector 액션 프리셋 저장/불러오기
 * 자주 쓰는 노드 속성 조합을 localStorage에 저장하고 선택 노드에 일괄 적용
 */
import React, { useState, useMemo, useCallback } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'
import { t } from '../../../utils/i18n'

const STORAGE_KEY = 'cc-batch-presets'

interface PresetActions {
  opacity?: number
  width?: number
  height?: number
  posX?: number
  posY?: number
  rotation?: number
  active?: boolean
  scaleX?: number
  scaleY?: number
}

interface ActionPreset {
  id: string
  name: string
  actions: PresetActions
}

function loadPresets(): ActionPreset[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function savePresetsToStorage(presets: ActionPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function PresetPlugin({ nodes, sceneFile, saveScene }: BatchPluginProps) {
  const uuids = useMemo(() => nodes.map(n => n.uuid), [nodes])
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  const [presets, setPresets] = useState<ActionPreset[]>(loadPresets)
  const [open, setOpen] = useState(false)

  // 새 프리셋 폼 상태
  const [presetName, setPresetName] = useState('')
  const [enOpacity, setEnOpacity] = useState(false); const [vOpacity, setVOpacity] = useState(128)
  const [enW, setEnW] = useState(false); const [vW, setVW] = useState(100)
  const [enH, setEnH] = useState(false); const [vH, setVH] = useState(100)
  const [enPosX, setEnPosX] = useState(false); const [vPosX, setVPosX] = useState(0)
  const [enPosY, setEnPosY] = useState(false); const [vPosY, setVPosY] = useState(0)
  const [enRot, setEnRot] = useState(false); const [vRot, setVRot] = useState(0)
  const [enActive, setEnActive] = useState(false); const [vActive, setVActive] = useState(true)
  const [enScaleX, setEnScaleX] = useState(false); const [vScaleX, setVScaleX] = useState(1)
  const [enScaleY, setEnScaleY] = useState(false); const [vScaleY, setVScaleY] = useState(1)

  const savePreset = useCallback(() => {
    const name = presetName.trim()
    if (!name) return
    const actions: PresetActions = {}
    if (enOpacity) actions.opacity = vOpacity
    if (enW) actions.width = vW
    if (enH) actions.height = vH
    if (enPosX) actions.posX = vPosX
    if (enPosY) actions.posY = vPosY
    if (enRot) actions.rotation = vRot
    if (enActive) actions.active = vActive
    if (enScaleX) actions.scaleX = vScaleX
    if (enScaleY) actions.scaleY = vScaleY
    if (Object.keys(actions).length === 0) return
    const newPreset: ActionPreset = { id: `p${Date.now()}`, name, actions }
    const updated = [...presets, newPreset]
    setPresets(updated)
    savePresetsToStorage(updated)
    setPresetName('')
    setBatchMsg(`✓ "${name}" 저장됨`)
    setTimeout(() => setBatchMsg(null), 2000)
  }, [presetName, presets, enOpacity, vOpacity, enW, vW, enH, vH, enPosX, vPosX, enPosY, vPosY, enRot, vRot, enActive, vActive, enScaleX, vScaleX, enScaleY, vScaleY])

  const deletePreset = useCallback((id: string) => {
    const updated = presets.filter(p => p.id !== id)
    setPresets(updated)
    savePresetsToStorage(updated)
  }, [presets])

  const applyPreset = useCallback(async (preset: ActionPreset) => {
    const { actions } = preset
    await patchNodes((n: CCSceneNode) => {
      const patched: CCSceneNode = { ...n }
      if (actions.opacity !== undefined) patched.opacity = actions.opacity
      if (actions.active !== undefined) patched.active = actions.active
      if (actions.rotation !== undefined) patched.rotation = { x: 0, y: 0, z: actions.rotation }
      if (actions.posX !== undefined || actions.posY !== undefined) {
        const pos = (patched.position ?? { x: 0, y: 0 }) as { x: number; y: number; z?: number }
        patched.position = { ...pos, ...(actions.posX !== undefined ? { x: actions.posX } : {}), ...(actions.posY !== undefined ? { y: actions.posY } : {}) }
      }
      if (actions.width !== undefined || actions.height !== undefined) {
        const sz = (patched.size ?? { width: 0, height: 0 }) as { width: number; height: number }
        patched.size = { ...sz, ...(actions.width !== undefined ? { width: actions.width } : {}), ...(actions.height !== undefined ? { height: actions.height } : {}) }
      }
      if (actions.scaleX !== undefined || actions.scaleY !== undefined) {
        const sc = (patched.scale ?? { x: 1, y: 1 }) as { x: number; y: number; z?: number }
        patched.scale = { ...sc, ...(actions.scaleX !== undefined ? { x: actions.scaleX } : {}), ...(actions.scaleY !== undefined ? { y: actions.scaleY } : {}) }
      }
      return patched
    }, `프리셋 "${preset.name}" 적용 (${uuids.length}개) — R2727`)
  }, [patchNodes, uuids.length])

  const captureFromNode = useCallback(() => {
    if (nodes.length === 0) return
    const n = nodes[0]
    setPresetName(`${n.name}-preset`)
    if (n.opacity !== undefined) { setEnOpacity(true); setVOpacity(n.opacity) }
    if (n.size?.x !== undefined) { setEnW(true); setVW(n.size.x) }
    if (n.size?.y !== undefined) { setEnH(true); setVH(n.size.y) }
    const pos = n.position as { x?: number; y?: number } | undefined
    if (pos?.x !== undefined) { setEnPosX(true); setVPosX(pos.x) }
    if (pos?.y !== undefined) { setEnPosY(true); setVPosY(pos.y) }
    if (n.rotation !== undefined) { setEnRot(true); setVRot(n.rotation.z ?? 0) }
    if (n.active !== undefined) { setEnActive(true); setVActive(n.active) }
    const sc = n.scale as { x?: number; y?: number } | undefined
    if (sc?.x !== undefined) { setEnScaleX(true); setVScaleX(sc.x) }
    if (sc?.y !== undefined) { setEnScaleY(true); setVScaleY(sc.y) }
  }, [nodes])

  const s9 =(extra?: React.CSSProperties): React.CSSProperties => ({ fontSize: 9, ...extra })
  const chk = (checked: boolean, onChange: () => void) => (
    <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 10, height: 10, cursor: 'pointer' }} />
  )
  const numIn = (val: number, onChange: (v: number) => void, w = 34, isFloat = false) => (
    <input type="number" value={val} step={isFloat ? 0.1 : 1}
      onChange={e => onChange(isFloat ? (parseFloat(e.target.value) || 0) : (parseInt(e.target.value) || 0))}
      style={{ width: w, fontSize: 9, padding: '0 2px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
  )

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, cursor: 'pointer', userSelect: 'none' }} onClick={() => setOpen(o => !o)}>
        <span style={s9({ color: '#a78bfa', flexShrink: 0 })}>{open ? '▾' : '▸'} {t('batch.preset.j_preset_r2727', '💾 프리셋 (R2727)')}</span>
        <span style={s9({ color: 'var(--text-muted)' })}>{presets.length > 0 ? `${presets.length}개 저장됨` : ''}</span>
      </div>

      {open && (
        <>
          {/* 저장된 프리셋 목록 */}
          {presets.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {presets.map(p => {
                const summary = Object.keys(p.actions).map(k => {
                  const v = p.actions[k as keyof PresetActions]
                  return `${k}=${typeof v === 'boolean' ? (v ? '✓' : '✗') : v}`
                }).join(', ')
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                    <span style={s9({ color: '#a78bfa', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 })} title={p.name}>{p.name}</span>
                    <span style={s9({ color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 8 })} title={summary}>{summary}</span>
                    <span onClick={() => applyPreset(p)} title={`"${p.name}" 적용`}
                      style={{ fontSize: 8, padding: '1px 5px', cursor: 'pointer', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 2, color: '#a78bfa', userSelect: 'none', flexShrink: 0, background: 'rgba(167,139,250,0.05)' }}>{t('batch.preset.j_apply', '적용')}</span>
                    <span onClick={() => deletePreset(p.id)} title={t('batch.preset.t_preset', '프리셋 삭제')}
                      style={{ fontSize: 8, padding: '1px 4px', cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 2, color: '#f87171', userSelect: 'none', flexShrink: 0 }}>✕</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 새 프리셋 폼 */}
          <div style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 3, padding: '4px 6px', marginBottom: 4 }}>
            {nodes.length >= 1 && (
              <div style={{ marginBottom: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <span onClick={captureFromNode}
                  title={`"${nodes[0]?.name}" 노드의 현재 속성으로 폼 채우기 (R2729)`}
                  style={{ fontSize: 8, padding: '1px 6px', cursor: 'pointer', border: '1px solid rgba(56,189,248,0.4)', borderRadius: 2, color: '#38bdf8', userSelect: 'none', background: 'rgba(56,189,248,0.05)' }}>
                  {t('batch.preset.j_capture_from_node', '📋 노드에서 캡처')}
                </span>
              </div>
            )}
            <div style={{ marginBottom: 3 }}>
              <input value={presetName} onChange={e => setPresetName(e.target.value)}
                placeholder={t('batch.preset.p_preset_name', '프리셋 이름')}
                style={{ width: '100%', fontSize: 9, padding: '1px 4px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {chk(enOpacity, () => setEnOpacity(v => !v))}
                <span style={s9({ color: 'var(--text-muted)', width: 36 })}>opacity</span>
                {enOpacity && numIn(vOpacity, setVOpacity, 38)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {chk(enRot, () => setEnRot(v => !v))}
                <span style={s9({ color: 'var(--text-muted)', width: 20 })}>rot</span>
                {enRot && numIn(vRot, setVRot, 38)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {chk(enW, () => setEnW(v => !v))}
                <span style={s9({ color: 'var(--text-muted)', width: 8 })}>W</span>
                {enW && numIn(vW, setVW, 38)}
                {enW && <><span style={s9({ color: 'var(--text-muted)' })}>×</span>{chk(enH, () => setEnH(v => !v))}<span style={s9({ color: 'var(--text-muted)', width: 8 })}>H</span>{enH && numIn(vH, setVH, 38)}</>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {chk(enActive, () => setEnActive(v => !v))}
                <span style={s9({ color: 'var(--text-muted)', width: 30 })}>active</span>
                {enActive && (
                  <select value={String(vActive)} onChange={e => setVActive(e.target.value === 'true')}
                    style={{ fontSize: 9, border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 2px' }}>
                    <option value="true">✓ ON</option>
                    <option value="false">✗ OFF</option>
                  </select>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {chk(enPosX, () => setEnPosX(v => !v))}
                <span style={s9({ color: 'var(--text-muted)', width: 20 })}>X</span>
                {enPosX && numIn(vPosX, setVPosX, 38)}
                {enPosX && <>{chk(enPosY, () => setEnPosY(v => !v))}<span style={s9({ color: 'var(--text-muted)', width: 8 })}>Y</span>{enPosY && numIn(vPosY, setVPosY, 38)}</>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {chk(enScaleX, () => setEnScaleX(v => !v))}
                <span style={s9({ color: 'var(--text-muted)', width: 20 })}>sX</span>
                {enScaleX && numIn(vScaleX, setVScaleX, 38, true)}
                {enScaleX && <>{chk(enScaleY, () => setEnScaleY(v => !v))}<span style={s9({ color: 'var(--text-muted)', width: 12 })}>sY</span>{enScaleY && numIn(vScaleY, setVScaleY, 38, true)}</>}
              </div>
            </div>
            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
              <span onClick={savePreset}
                style={{ fontSize: 9, padding: '2px 8px', cursor: 'pointer', border: '1px solid rgba(167,139,250,0.5)', borderRadius: 2, color: '#a78bfa', userSelect: 'none', background: 'rgba(167,139,250,0.08)' }}>
                {t('batch.preset.j_save', '💾 저장')}
              </span>
            </div>
          </div>
        </>
      )}

      {/* 결과 메시지 */}
      {batchMsg && (
        <div style={{ fontSize: 9, color: '#4ade80', marginBottom: 2 }}>{batchMsg}</div>
      )}
    </div>
  )
}
