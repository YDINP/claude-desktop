import { useState, useEffect } from 'react'
import type { SceneNode } from './types'

// 헥스 변환 헬퍼
const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')

// 개별 수치 입력 필드
export function NumInput({
  label,
  value,
  decimals = 0,
  prop,
  uuid,
  onSave,
}: {
  label: string
  value: number
  decimals?: number
  prop: string
  uuid: string
  onSave: (uuid: string, prop: string, value: number) => void
}) {
  const fmt = (v: number) =>
    decimals > 0 ? String(parseFloat(v.toFixed(decimals))) : String(Math.round(v))

  const [draft, setDraft] = useState(fmt(value))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(fmt(value))
  }, [value, dirty])

  const commit = () => {
    const num = parseFloat(draft)
    if (!isNaN(num) && num !== value) {
      onSave(uuid, prop, num)
    }
    setDirty(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
      <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, letterSpacing: '0.2px' }}>{label}</span>
      <input
        value={draft}
        onChange={e => { setDraft(e.target.value); setDirty(true) }}
        onFocus={() => setDirty(true)}
        onBlur={() => { commit() }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setDraft(fmt(value)); setDirty(false); (e.target as HTMLInputElement).blur() }
        }}
        style={{
          flex: 1, background: 'var(--bg-input)',
          color: dirty ? 'var(--warning)' : 'var(--text-primary)',
          border: dirty ? '1px solid var(--warning)' : '1px solid var(--border)',
          borderRadius: 3, padding: '2px 5px', fontSize: 10, outline: 'none', transition: 'border-color 0.1s',
        }}
      />
    </div>
  )
}

// 섹션 헤더
export function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', padding: '5px 0 2px', borderTop: '1px solid var(--border)', marginTop: 3, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
      {label}
    </div>
  )
}

interface CompInspectorProps {
  node: SceneNode
  onUpdate: (uuid: string, prop: string, value: number | boolean) => void
  trackUpdate: (uuid: string, key: string, value: number | boolean) => void
}

// R1368: cc.Widget 속성 편집
export function WidgetInspector({ node, onUpdate }: CompInspectorProps) {
  const widgetComp = node.components.find(c => c.type === 'cc.Widget')
  if (!widgetComp?.props) return null
  const wp = widgetComp.props as Record<string, unknown>
  const alignMode = (wp.alignMode as number) ?? 0
  const alignModeLabels = ['ONCE', 'ON_WINDOW_RESIZE', 'ALWAYS']
  return (
    <>
      <SectionHeader label="Widget" />
      <div style={{ fontSize: 9, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>alignMode</span>
          <select
            value={alignMode}
            onChange={e => {
              const val = parseInt(e.target.value)
              const newComps = node.components.map(c =>
                c.type === 'cc.Widget' ? { ...c, props: { ...c.props, alignMode: val } } : c
              )
              onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
            }}
            style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
          >
            {alignModeLabels.map((label, i) => (
              <option key={i} value={i}>{i} — {label}</option>
            ))}
          </select>
        </div>
        {(['top', 'bottom', 'left', 'right'] as const).map(side => {
          const boolKey = `isAbsolute${side.charAt(0).toUpperCase()}${side.slice(1)}` as string
          const isAbs = (wp[boolKey] as boolean) ?? false
          const val = (wp[side] as number) ?? 0
          return (
            <div key={side} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 2, width: 48, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={isAbs}
                  onChange={e => {
                    const newComps = node.components.map(c =>
                      c.type === 'cc.Widget' ? { ...c, props: { ...c.props, [boolKey]: e.target.checked } } : c
                    )
                    onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                  }}
                  style={{ width: 10, height: 10, accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{side}</span>
              </label>
              <NumInput label="" value={val} decimals={1} uuid={node.uuid} prop={`widget.${side}`}
                onSave={(_uuid, _prop, v) => {
                  const newComps = node.components.map(c =>
                    c.type === 'cc.Widget' ? { ...c, props: { ...c.props, [side]: v } } : c
                  )
                  onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
                }}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

// R1374: cc.Sprite 에셋 피커
export function SpriteInspector({ node, onUpdate }: CompInspectorProps) {
  const spriteComp = node.components.find(c => c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D')
  if (!spriteComp) return null
  const sfUuid = (spriteComp.props?.spriteFrame as { __uuid__?: string })?.__uuid__ ?? '(없음)'
  const sfDisplay = sfUuid.length > 16 ? sfUuid.slice(0, 8) + '...' + sfUuid.slice(-6) : sfUuid
  return (
    <>
      <SectionHeader label="Sprite" />
      <div style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>SF</span>
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 8, color: 'var(--text-primary)' }}
          title={sfUuid}
        >{sfDisplay}</span>
        <button
          onClick={async () => {
            const paths = await window.api.openFileDialog?.({
              title: '스프라이트 이미지 선택',
              filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
            })
            if (paths && paths.length > 0) {
              const fileName = paths[0].replace(/\\/g, '/').split('/').pop() ?? paths[0]
              const newComps = node.components.map(c =>
                (c.type === 'cc.Sprite' || c.type === 'cc.Sprite2D')
                  ? { ...c, props: { ...c.props, _selectedFile: paths[0], spriteFrame: { __uuid__: `placeholder:${fileName}` } } }
                  : c
              )
              onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
            }
          }}
          title="이미지 파일 선택 (에셋 피커)"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 3, color: 'var(--accent)', cursor: 'pointer', fontSize: 9, padding: '1px 5px', flexShrink: 0 }}
        >📁</button>
      </div>
      {(spriteComp.props as Record<string, unknown>)?._selectedFile && (
        <div style={{ fontSize: 8, color: 'var(--success)', padding: '1px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={String((spriteComp.props as Record<string, unknown>)._selectedFile)}>
          → {String((spriteComp.props as Record<string, unknown>)._selectedFile).replace(/\\/g, '/').split('/').pop()}
        </div>
      )}
    </>
  )
}

// R1417: cc.Label 폰트 속성 표시
export function LabelInspector({ node }: CompInspectorProps) {
  const labelComp = node.components.find(c => c.type === 'cc.Label')
  if (!labelComp?.props) return null
  const lp = labelComp.props as Record<string, unknown>
  const overflowLabels = ['NONE', 'CLAMP', 'SHRINK', 'RESIZE_HEIGHT']
  const overflowVal = (lp.overflow as number) ?? 0
  return (
    <>
      <SectionHeader label="Label (Font)" />
      <div style={{ fontSize: 9, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>font</span>
          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 8, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lp.isSystemFontUsed ? (String(lp.fontFamily) || 'Arial') : (lp.font ? 'BMFont' : '(없음)')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>sysFont</span>
          <span style={{ fontSize: 8, color: lp.isSystemFontUsed ? 'var(--success)' : 'var(--text-muted)' }}>
            {lp.isSystemFontUsed ? 'YES' : 'NO'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
            <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>spX</span>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'var(--text-primary)' }}>{lp.spacingX ?? 0}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
            <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>spY</span>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'var(--text-primary)' }}>{lp.spacingY ?? 0}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>overflow</span>
          <span style={{ fontSize: 8, color: 'var(--accent)', fontFamily: 'monospace' }}>
            {overflowVal} ({overflowLabels[overflowVal] ?? '?'})
          </span>
        </div>
      </div>
    </>
  )
}

// R1420: cc.Button 컴포넌트 속성 편집
export function ButtonInspector({ node, onUpdate }: CompInspectorProps) {
  const btnComp = node.components.find(c => c.type === 'cc.Button')
  if (!btnComp?.props) return null
  const bp = btnComp.props as Record<string, unknown>
  const interactable = (bp.interactable as boolean) ?? true
  const enableAutoGrayEffect = (bp.enableAutoGrayEffect as boolean) ?? false
  const transition = (bp.transition as number) ?? 0
  const transitionLabels = ['NONE', 'COLOR', 'SPRITE', 'SCALE']
  const duration = (bp.duration as number) ?? 0.1
  const onBtnPropChange = (key: string, value: number | boolean) => {
    const newComps = node.components.map(c =>
      c.type === 'cc.Button' ? { ...c, props: { ...c.props, [key]: value } } : c
    )
    onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
  }
  const readColor = (key: string): string | null => {
    const c = bp[key] as { r?: number; g?: number; b?: number; a?: number } | undefined
    if (!c) return null
    return `#${toHex(c.r ?? 255)}${toHex(c.g ?? 255)}${toHex(c.b ?? 255)}`
  }
  return (
    <>
      <SectionHeader label="Button" />
      <div style={{ fontSize: 9, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>interact</span>
          <input type="checkbox" checked={interactable}
            onChange={e => onBtnPropChange('interactable', e.target.checked)}
            style={{ width: 12, height: 12, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          <span style={{ fontSize: 8, color: interactable ? 'var(--success)' : 'var(--text-muted)' }}>{interactable ? 'ON' : 'OFF'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>autoGray</span>
          <input type="checkbox" checked={enableAutoGrayEffect}
            onChange={e => onBtnPropChange('enableAutoGrayEffect', e.target.checked)}
            style={{ width: 12, height: 12, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          <span style={{ fontSize: 8, color: enableAutoGrayEffect ? 'var(--success)' : 'var(--text-muted)' }}>{enableAutoGrayEffect ? 'ON' : 'OFF'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>transition</span>
          <select value={transition}
            onChange={e => onBtnPropChange('transition', parseInt(e.target.value))}
            style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
          >
            {transitionLabels.map((label, i) => (
              <option key={i} value={i}>{i} — {label}</option>
            ))}
          </select>
        </div>
        <NumInput label="duration" value={duration} decimals={2} uuid={node.uuid} prop="button.duration"
          onSave={(_u, _p, v) => onBtnPropChange('duration', v)} />
        {transition === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 6px', marginTop: 2 }}>
            {(['normalColor', 'pressedColor', 'hoverColor', 'disabledColor'] as const).map(ck => {
              const hex = readColor(ck)
              return (
                <div key={ck} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0, fontSize: 8 }}>{ck.replace('Color', '')}</span>
                  {hex ? (
                    <div style={{ width: 14, height: 14, borderRadius: 2, background: hex, border: '1px solid var(--border)', flexShrink: 0 }} title={hex} />
                  ) : (
                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>-</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// R1425: cc.ProgressBar / cc.Slider 속성 편집
export function ProgressBarInspector({ node, onUpdate }: CompInspectorProps) {
  const pbComp = node.components.find(c => c.type === 'cc.ProgressBar' || c.type === 'cc.Slider')
  if (!pbComp?.props) return null
  const pp = pbComp.props as Record<string, unknown>
  const isSlider = pbComp.type === 'cc.Slider'
  const progress = (pp.progress as number) ?? (pp.value as number) ?? 0
  const totalLength = (pp.totalLength as number) ?? 0
  const reverse = (pp.reverse as boolean) ?? false
  const onPbPropChange = (key: string, value: number | boolean) => {
    const newComps = node.components.map(c =>
      (c.type === 'cc.ProgressBar' || c.type === 'cc.Slider') ? { ...c, props: { ...c.props, [key]: value } } : c
    )
    onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
  }
  return (
    <>
      <SectionHeader label={isSlider ? 'Slider' : 'ProgressBar'} />
      <div style={{ fontSize: 9, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>{isSlider ? 'value' : 'progress'}</span>
          <input type="range" min={0} max={1} step={0.01} value={progress}
            onChange={e => onPbPropChange(isSlider ? 'value' : 'progress', parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 8, color: 'var(--accent)', width: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{progress.toFixed(2)}</span>
        </div>
        {!isSlider && (
          <NumInput label="totalLen" value={totalLength} uuid={node.uuid} prop="progressbar.totalLength"
            onSave={(_u, _p, v) => onPbPropChange('totalLength', v)} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>reverse</span>
          <input type="checkbox" checked={reverse}
            onChange={e => onPbPropChange('reverse', e.target.checked)}
            style={{ width: 12, height: 12, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          <span style={{ fontSize: 8, color: reverse ? 'var(--success)' : 'var(--text-muted)' }}>{reverse ? 'ON' : 'OFF'}</span>
        </div>
      </div>
    </>
  )
}

// R1375: cc.Layout 컴포넌트 속성 편집
export function LayoutInspector({ node, onUpdate }: CompInspectorProps) {
  const layoutComp = node.components.find(c => c.type === 'cc.Layout')
  if (!layoutComp?.props) return null
  const lp = layoutComp.props as Record<string, unknown>
  const layoutType = (lp.type as number) ?? 0
  const resizeMode = (lp.resizeMode as number) ?? 0
  const layoutTypeLabels = ['NONE', 'HORIZONTAL', 'VERTICAL', 'GRID']
  const resizeModeLabels = ['NONE', 'CHILDREN', 'CONTAINER']
  const onLayoutPropChange = (key: string, value: number) => {
    const newComps = node.components.map(c =>
      c.type === 'cc.Layout' ? { ...c, props: { ...c.props, [key]: value } } : c
    )
    onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
  }
  return (
    <>
      <SectionHeader label="Layout" />
      <div style={{ fontSize: 9, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>type</span>
          <select value={layoutType}
            onChange={e => onLayoutPropChange('type', parseInt(e.target.value))}
            style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
          >
            {layoutTypeLabels.map((label, i) => (
              <option key={i} value={i}>{i} — {label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          <NumInput label="padT" value={(lp.paddingTop as number) ?? 0} uuid={node.uuid} prop="layout.paddingTop"
            onSave={(_u, _p, v) => onLayoutPropChange('paddingTop', v)} />
          <NumInput label="padB" value={(lp.paddingBottom as number) ?? 0} uuid={node.uuid} prop="layout.paddingBottom"
            onSave={(_u, _p, v) => onLayoutPropChange('paddingBottom', v)} />
          <NumInput label="padL" value={(lp.paddingLeft as number) ?? 0} uuid={node.uuid} prop="layout.paddingLeft"
            onSave={(_u, _p, v) => onLayoutPropChange('paddingLeft', v)} />
          <NumInput label="padR" value={(lp.paddingRight as number) ?? 0} uuid={node.uuid} prop="layout.paddingRight"
            onSave={(_u, _p, v) => onLayoutPropChange('paddingRight', v)} />
        </div>
        {(layoutType === 1 || layoutType === 2 || layoutType === 3) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px', marginTop: 2 }}>
            <NumInput label="spX" value={(lp.spacingX as number) ?? 0} uuid={node.uuid} prop="layout.spacingX"
              onSave={(_u, _p, v) => onLayoutPropChange('spacingX', v)} />
            <NumInput label="spY" value={(lp.spacingY as number) ?? 0} uuid={node.uuid} prop="layout.spacingY"
              onSave={(_u, _p, v) => onLayoutPropChange('spacingY', v)} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <span style={{ width: 48, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>resize</span>
          <select value={resizeMode}
            onChange={e => onLayoutPropChange('resizeMode', parseInt(e.target.value))}
            style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
          >
            {resizeModeLabels.map((label, i) => (
              <option key={i} value={i}>{i} — {label}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}

// R1384+R1429: cc.Animation 타임라인 미리보기
export function AnimationInspector({ node }: CompInspectorProps) {
  const animComp = node.components.find(c => c.type === 'cc.Animation')
  if (!animComp?.props) return null
  const ap = animComp.props as Record<string, unknown>
  const defaultClip = ap.defaultClip as { __uuid__?: string } | undefined
  const defaultClipUuid = defaultClip?.__uuid__ ?? ''
  const clipsRaw = (ap.clips ?? ap._clips ?? []) as Array<{ __uuid__?: string; duration?: number; name?: string; _name?: string; wrapMode?: number; _duration?: number } | null>
  const clips = clipsRaw.filter((c): c is { __uuid__: string; duration?: number; name?: string; _name?: string; wrapMode?: number; _duration?: number } => !!c && !!c.__uuid__)
  const clipCount = clips.length
  const playOnLoad = (ap.playOnLoad as boolean) ?? (ap._playOnAwake as boolean) ?? false
  const clipDurations = clips.map(c => (c.duration ?? c._duration ?? 0) as number)
  const maxDuration = Math.max(...clipDurations, 0.001)
  return (
    <>
      <SectionHeader label="Animation" />
      <div style={{ fontSize: 9, padding: '2px 0' }}>
        {defaultClipUuid && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>default</span>
            <span style={{ fontFamily: 'monospace', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent)' }}
              title={defaultClipUuid}>
              {defaultClipUuid.length > 16 ? defaultClipUuid.slice(0, 8) + '...' + defaultClipUuid.slice(-6) : defaultClipUuid}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-muted)' }}>clips</span>
          <span style={{ fontSize: 8, padding: '0 5px', borderRadius: 8, background: 'rgba(96,165,250,0.15)', color: 'var(--accent)' }}>{clipCount} clips</span>
          {playOnLoad && <span style={{ fontSize: 7, color: '#4ade80' }}>autoPlay</span>}
        </div>
        {clips.map((clip, i) => {
          const dur = clipDurations[i]
          const barW = maxDuration > 0 ? (dur / maxDuration) * 100 : 0
          const clipName = (clip.name ?? clip._name ?? clip.__uuid__.slice(0, 8)) as string
          const isLoop = (clip.wrapMode ?? 0) === 2
          return (
            <div key={i} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 8, flexShrink: 0, width: 14 }}>#{i}</span>
                <span style={{ fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', flex: 1 }}
                  title={clip.__uuid__}>{clipName}</span>
                <span style={{ fontSize: 7, color: 'var(--accent)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{dur.toFixed(2)}s</span>
                {isLoop && <span title="Loop" style={{ fontSize: 9, flexShrink: 0 }}>🔁</span>}
              </div>
              <div style={{ marginLeft: 18, marginTop: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: `${barW}%`, height: '100%', background: 'linear-gradient(90deg, rgba(96,165,250,0.5), rgba(96,165,250,0.3))', borderRadius: 3 }} />
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button disabled style={{ flex: 1, padding: '2px 0', fontSize: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'default', opacity: 0.5 }} title="재생 기능 미구현 (placeholder)">▶</button>
          <button disabled style={{ flex: 1, padding: '2px 0', fontSize: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'default', opacity: 0.5 }} title="정지 기능 미구현 (placeholder)">■</button>
        </div>
      </div>
    </>
  )
}

// R1429: cc.Tween 속성 읽기전용 표시
export function TweenInspector({ node }: CompInspectorProps) {
  const tweenComp = node.components.find(c => c.type === 'cc.Tween' || c.type === 'cc.tween')
  if (!tweenComp?.props) return null
  const tp = tweenComp.props as Record<string, unknown>
  const duration = (tp.duration as number) ?? (tp._duration as number) ?? 0
  const delay = (tp.delay as number) ?? (tp._delay as number) ?? 0
  const easing = (tp.easing as string) ?? (tp._easing as string) ?? 'linear'
  return (
    <>
      <SectionHeader label="Tween" />
      <div style={{ fontSize: 9, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>duration</span>
          <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{duration.toFixed(2)}s</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>delay</span>
          <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{delay.toFixed(2)}s</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ width: 48, color: 'var(--text-muted)', flexShrink: 0 }}>easing</span>
          <span style={{ color: 'var(--accent)' }}>{easing}</span>
        </div>
      </div>
    </>
  )
}

// R1387: cc.AudioSource 속성 편집
export function AudioSourceInspector({ node, onUpdate }: CompInspectorProps) {
  const audioComp = node.components.find(c => c.type === 'cc.AudioSource')
  if (!audioComp?.props) return null
  const ap = audioComp.props as Record<string, unknown>
  const clipUuid = (ap.clip as { __uuid__?: string })?.__uuid__ ?? (ap._clip as { __uuid__?: string })?.__uuid__ ?? ''
  const clipDisplay = clipUuid.length > 16 ? clipUuid.slice(0, 8) + '...' + clipUuid.slice(-6) : clipUuid || '(없음)'
  const volume = (ap.volume as number) ?? (ap._volume as number) ?? 1
  const loop = (ap.loop as boolean) ?? (ap._loop as boolean) ?? false
  const playOnLoad = (ap.playOnLoad as boolean) ?? (ap._playOnAwake as boolean) ?? false
  const preload = (ap.preload as number) ?? 0
  const preloadLabels = ['NONE', 'METADATA', 'AUTO']
  const onAudioPropChange = (key: string, value: number | boolean) => {
    const newComps = node.components.map(c =>
      c.type === 'cc.AudioSource' ? { ...c, props: { ...c.props, [key]: value } } : c
    )
    onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
  }
  return (
    <>
      <SectionHeader label="AudioSource" />
      <div style={{ fontSize: 9, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48 }}>clip</span>
          <span style={{ fontFamily: 'monospace', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}
            title={clipUuid}>{clipDisplay}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48, fontSize: 9 }}>volume</span>
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e => onAudioPropChange('volume', parseFloat(e.target.value))}
            style={{ flex: 1, height: 4, accentColor: 'var(--accent)', cursor: 'pointer', minWidth: 0 }}
          />
          <span style={{ fontSize: 8, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{volume.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48, fontSize: 9 }}>loop</span>
          <input type="checkbox" checked={loop}
            onChange={e => onAudioPropChange('loop', e.target.checked)}
            style={{ width: 12, height: 12, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 8, color: loop ? 'var(--success)' : 'var(--text-muted)' }}>{loop ? 'ON' : 'OFF'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48, fontSize: 9 }}>playOnLoad</span>
          <input type="checkbox" checked={playOnLoad}
            onChange={e => onAudioPropChange('playOnLoad', e.target.checked)}
            style={{ width: 12, height: 12, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 8, color: playOnLoad ? 'var(--success)' : 'var(--text-muted)' }}>{playOnLoad ? 'ON' : 'OFF'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 48, fontSize: 9 }}>preload</span>
          <select value={preload}
            onChange={e => onAudioPropChange('preload', parseInt(e.target.value))}
            style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 3px' }}
          >
            {preloadLabels.map((label, i) => (
              <option key={i} value={i}>{i} — {label}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}

// R1372: 컴포넌트 추가 드롭다운
export function AddComponentDropdown({ node, onUpdate }: CompInspectorProps) {
  const ADDABLE_COMPONENTS = ['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Layout', 'cc.Widget', 'cc.Animation', 'cc.AudioSource']
  const existingTypes = new Set(node.components.map(c => c.type))
  return (
    <div style={{ marginTop: 4, paddingTop: 3, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
      <select
        id="add-comp-select"
        style={{ flex: 1, fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 4px' }}
      >
        {ADDABLE_COMPONENTS.map(ct => (
          <option key={ct} value={ct} disabled={existingTypes.has(ct)}>
            {ct.split('.').pop()}{existingTypes.has(ct) ? ' (있음)' : ''}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          const sel = (document.getElementById('add-comp-select') as HTMLSelectElement)?.value
          if (!sel || existingTypes.has(sel)) return
          const newComps = [...node.components, { type: sel, props: {} }]
          onUpdate(node.uuid, 'components' as string, newComps as unknown as number)
        }}
        disabled={ADDABLE_COMPONENTS.every(ct => existingTypes.has(ct))}
        style={{
          fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
          background: 'var(--accent-dim)', color: 'var(--accent)',
          border: '1px solid var(--accent)', opacity: ADDABLE_COMPONENTS.every(ct => existingTypes.has(ct)) ? 0.4 : 1,
        }}
      >
        + 추가
      </button>
    </div>
  )
}
