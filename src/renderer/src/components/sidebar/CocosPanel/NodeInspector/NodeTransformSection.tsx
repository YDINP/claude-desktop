import React from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import type { useNodeInspector } from './useNodeInspector'

interface NodeTransformSectionProps {
  ctx: ReturnType<typeof useNodeInspector>
  is3x: boolean
}

export function NodeTransformSection({ ctx, is3x }: NodeTransformSectionProps) {
  const {
    origSnapRef, draft, collapsed, secHeader, applyAndSave, numInput, rotation,
    transformClipboard, transformClipFilled, setTransformClipFilled,
    posClipboard, posClipFilled, setPosClipFilled,
    sizeClipboard, sizeClipFilled, setSizeClipFilled,
    colorClipboard, colorClipFilled, setColorClipFilled,
    rotClipboard, rotClipFilled, setRotClipFilled,
    scaleClipboard, scaleClipFilled, setScaleClipFilled,
    opacityClipboard, opacityClipFilled, setOpacityClipFilled,
    anchorCompensate, setAnchorCompensate, worldPos,
    lockScale, setLockScale, lockSize, setLockSize,
    showPct, setShowPct,
    tintHexInput, setTintHexInput, tintHexFocused, setTintHexFocused,
    zOrderInfo,
  } = ctx
  return (
    <>
      {secHeader('transform', '위치 / 크기 / 회전', (() => {
        const os = origSnapRef.current
        if (!os) return false
        const curPos = draft.position as { x?: number; y?: number }
        const osPos = os.position as { x?: number; y?: number }
        return Math.abs((curPos?.x ?? 0) - (osPos?.x ?? 0)) > 0.05 ||
          Math.abs((curPos?.y ?? 0) - (osPos?.y ?? 0)) > 0.05 ||
          Math.abs((draft.size?.x ?? 0) - (os.size?.x ?? 0)) > 0.05 ||
          Math.abs((draft.size?.y ?? 0) - (os.size?.y ?? 0)) > 0.05 ||
          Math.abs((draft.opacity ?? 255) - (os.opacity ?? 255)) > 0.5
      })())}
      {!collapsed['transform'] && (
        <>
        {/* R1617: 트랜스폼 복사/붙여넣기 버튼 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
          <span
            title="트랜스폼 복사 (위치·크기·회전·스케일)"
            onClick={() => { transformClipboard.current = { position: draft.position, rotation: draft.rotation, scale: draft.scale, size: draft.size }; setTransformClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >T↑복사</span>
          <span
            title={transformClipFilled ? '트랜스폼 붙여넣기 (위치·크기·회전·스케일)' : '복사된 트랜스폼 없음'}
            onClick={() => { if (transformClipboard.current) applyAndSave({ position: transformClipboard.current.position, rotation: transformClipboard.current.rotation, scale: transformClipboard.current.scale, size: transformClipboard.current.size }) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: transformClipFilled ? 'pointer' : 'default', color: transformClipFilled ? '#58a6ff' : '#333', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => { if (transformClipFilled) e.currentTarget.style.color = '#7fc6ff' }} onMouseLeave={e => { e.currentTarget.style.color = transformClipFilled ? '#58a6ff' : '#333' }}
          >T↓붙여넣기</span>
          {/* R2552: 위치 전용 복사/붙여넣기 */}
          <span
            title="위치(position) 복사 — 다른 노드에 붙여넣기 가능 (R2552)"
            onClick={() => { const pos = draft.position as { x: number; y: number }; posClipboard.current = { x: pos.x, y: pos.y }; setPosClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >P↑</span>
          <span
            title={posClipFilled ? `위치 붙여넣기 (${posClipboard.current?.x}, ${posClipboard.current?.y}) — R2552` : '복사된 위치 없음'}
            onClick={() => { if (posClipboard.current) { const pos = draft.position as { x: number; y: number; z?: number }; applyAndSave({ position: { ...pos, x: posClipboard.current.x, y: posClipboard.current.y } }) } }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: posClipFilled ? 'pointer' : 'default', color: posClipFilled ? '#4ade80' : '#333', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => { if (posClipFilled) e.currentTarget.style.color = '#86efac' }} onMouseLeave={e => { e.currentTarget.style.color = posClipFilled ? '#4ade80' : '#333' }}
          >P↓</span>
          {/* R2571: 전체 픽셀 반올림 버튼 */}
          <span
            title="위치/크기/스케일 전체를 정수 픽셀로 반올림 (R2571)"
            onClick={() => {
              const pos = draft.position as { x: number; y: number; z?: number }
              const sz = draft.size as { x: number; y: number } | undefined
              applyAndSave({
                position: { ...pos, x: Math.round(pos.x), y: Math.round(pos.y) },
                ...(sz ? { size: { x: Math.round(sz.x), y: Math.round(sz.y) } } : {}),
                scale: { x: Math.round(draft.scale.x * 100) / 100, y: Math.round(draft.scale.y * 100) / 100, z: draft.scale.z ?? 1 },
              })
            }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#64748b', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')} onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >⌊⌉All</span>
          {/* R2553: 크기 전용 복사/붙여넣기 */}
          <span
            title="크기(size) 복사 — 다른 노드에 붙여넣기 가능 (R2553)"
            onClick={() => { const sz = draft.size as { x: number; y: number } | undefined; sizeClipboard.current = { w: sz?.x ?? 0, h: sz?.y ?? 0 }; setSizeClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >S↑</span>
          <span
            title={sizeClipFilled ? `크기 붙여넣기 (${sizeClipboard.current?.w}×${sizeClipboard.current?.h}) — R2553` : '복사된 크기 없음'}
            onClick={() => { if (sizeClipboard.current) applyAndSave({ size: { x: sizeClipboard.current.w, y: sizeClipboard.current.h } }) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: sizeClipFilled ? 'pointer' : 'default', color: sizeClipFilled ? '#f472b6' : '#333', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => { if (sizeClipFilled) e.currentTarget.style.color = '#f9a8d4' }} onMouseLeave={e => { e.currentTarget.style.color = sizeClipFilled ? '#f472b6' : '#333' }}
          >S↓</span>
          {/* R1635: 세션 시작 상태로 트랜스폼 원복 */}
          {origSnapRef.current && (() => {
            const os = origSnapRef.current!
            const curPos = draft.position as { x?: number; y?: number }
            const osPos = os.position as { x?: number; y?: number }
            const changed = Math.abs((curPos?.x ?? 0) - (osPos?.x ?? 0)) > 0.05 ||
              Math.abs((curPos?.y ?? 0) - (osPos?.y ?? 0)) > 0.05 ||
              Math.abs((draft.size?.x ?? 0) - (os.size?.x ?? 0)) > 0.05 ||
              Math.abs((draft.size?.y ?? 0) - (os.size?.y ?? 0)) > 0.05
            if (!changed) return null
            return (
              <span
                title="선택 시 원래값으로 트랜스폼 복원"
                onClick={() => applyAndSave({ position: os.position, rotation: os.rotation, scale: os.scale, size: os.size })}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(255,153,68,0.4)', cursor: 'pointer', color: '#ff9944', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffb366')} onMouseLeave={e => (e.currentTarget.style.color = '#ff9944')}
              >T↩원복</span>
            )
          })()}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              위치
              <span title="위치 리셋 (0,0)" onClick={() => applyAndSave({ position: { ...draft.position, x: 0, y: 0 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
              {/* R1592: 위치 정수 반올림 버튼 */}
              <span title="위치 정수 반올림 (Round to integer)" onClick={() => applyAndSave({ position: { ...draft.position, x: Math.round(draft.position.x), y: Math.round(draft.position.y) } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⌊⌉</span>
              {/* R1682: 위치 복사 버튼 */}
              <span title="위치 클립보드 복사 (x, y)" onClick={() => navigator.clipboard.writeText(`${Math.round(draft.position.x)}, ${Math.round(draft.position.y)}`).catch(() => {})} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⎘</span>
              {/* R1670: % 토글 */}
              {zOrderInfo?.parentSize && <span title="부모 크기 기준 % 표시 토글" onClick={() => setShowPct(v => !v)} style={{ cursor: 'pointer', color: showPct ? '#58a6ff' : '#555', fontSize: 8, padding: '0 2px', border: `1px solid ${showPct ? '#58a6ff44' : 'transparent'}`, borderRadius: 2 }}>%</span>}
            </div>
            {numInput('X', draft.position.x, v => applyAndSave({ position: { ...draft.position, x: v } }))}
            {numInput('Y', draft.position.y, v => applyAndSave({ position: { ...draft.position, y: v } }))}
            {/* R1739: 위치 스텝 버튼 */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
              {([-10, -1, 1, 10] as const).map(d => (
                <span key={`px${d}`} title={`X ${d > 0 ? '+' : ''}${d}`}
                  onClick={() => applyAndSave({ position: { ...draft.position, x: draft.position.x + d } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >X{d > 0 ? '+' : ''}{d}</span>
              ))}
              {([-10, -1, 1, 10] as const).map(d => (
                <span key={`py${d}`} title={`Y ${d > 0 ? '+' : ''}${d}`}
                  onClick={() => applyAndSave({ position: { ...draft.position, y: draft.position.y + d } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >Y{d > 0 ? '+' : ''}{d}</span>
              ))}
              {/* R1752: 위치 원점 리셋 */}
              <span title="위치 원점 (0, 0) 리셋"
                onClick={() => applyAndSave({ position: { ...draft.position, x: 0, y: 0 } })}
                style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#58a6ff', userSelect: 'none', whiteSpace: 'nowrap' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#79c0ff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#58a6ff')}
              >(0,0)</span>
              {/* R1766: 스냅 그리드 / R1779: ×1 정수화 포함 */}
              {([1, 8, 16] as const).map(g => (
                <span key={`snap${g}`} title={g === 1 ? '위치 정수화 (소수점 제거)' : `위치 ×${g} 그리드 스냅`}
                  onClick={() => applyAndSave({ position: { ...draft.position, x: Math.round(draft.position.x / g) * g, y: Math.round(draft.position.y / g) * g } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
                >{g === 1 ? '⊹int' : `⊹${g}`}</span>
              ))}
            </div>
            {/* R1670: % 표시 */}
            {showPct && zOrderInfo?.parentSize && (() => {
              const pw = zOrderInfo.parentSize!.x, ph = zOrderInfo.parentSize!.y
              if (!pw || !ph) return null
              return (
                <div style={{ fontSize: 8, color: '#58a6ff', lineHeight: 1.5, marginTop: 1 }}>
                  x:{((draft.position.x / pw) * 100).toFixed(1)}% y:{((draft.position.y / ph) * 100).toFixed(1)}%
                </div>
              )
            })()}
            {/* R1656: 부모 기준 정렬 버튼 */}
            {zOrderInfo?.parentSize?.x && zOrderInfo?.parentSize?.y && (() => {
              const pw = zOrderInfo.parentSize!.x, ph = zOrderInfo.parentSize!.y
              const nw = draft.size?.x ?? 0, nh = draft.size?.y ?? 0
              const ax = draft.anchor?.x ?? 0.5, ay = draft.anchor?.y ?? 0.5
              const btns: { label: string; title: string; x?: number; y?: number }[] = [
                { label: '←', title: '부모 좌측 정렬', x: -pw / 2 + nw * ax },
                { label: '⊕', title: '부모 중앙 정렬', x: nw * (ax - 0.5), y: nh * (ay - 0.5) },
                { label: '→', title: '부모 우측 정렬', x: pw / 2 - nw * (1 - ax) },
                { label: '↑', title: '부모 상단 정렬', y: ph / 2 - nh * (1 - ay) },
                { label: '↓', title: '부모 하단 정렬', y: -ph / 2 + nh * ay },
              ]
              return (
                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                  {btns.map(b => (
                    <span key={b.label} title={b.title} onClick={() => {
                      const upd: Partial<CCSceneNode> = {}
                      if (b.x !== undefined) upd.position = { ...draft.position, x: Math.round(b.x * 10) / 10 }
                      if (b.y !== undefined) upd.position = { ...(upd.position ?? draft.position), y: Math.round(b.y * 10) / 10 }
                      applyAndSave(upd)
                    }} style={{ fontSize: 9, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >{b.label}</span>
                  ))}
                </div>
              )
            })()}
            {/* R1484: World Transform 표시 */}
            {worldPos && (
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }} title="씬 내 절대 좌표 (부모 누산)">
                <span style={{ color: '#555' }}>W </span>
                <span>{worldPos.x.toFixed(1)}, {worldPos.y.toFixed(1)}</span>
              </div>
            )}
            <div style={{ fontSize: 9, color: 'var(--text-muted)', margin: '5px 0 3px', display: 'flex', alignItems: 'center', gap: 4 }}>
              회전
              <span title="회전 리셋 (0°)" onClick={() => applyAndSave({ rotation: typeof draft.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
              {/* R1653: 회전 부호 반전 버튼 */}
              <span title="회전 부호 반전 (±)" onClick={() => { const r = typeof draft.rotation === 'number' ? -draft.rotation : { ...(draft.rotation as object), z: -(draft.rotation as {z?:number}).z! } as CCSceneNode['rotation']; applyAndSave({ rotation: r }) }} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>±</span>
              {/* R1775: 회전 정규화 버튼 (-180~180) */}
              {Math.abs(rotation) > 180 && (
                <span title={`회전 정규화: ${rotation}° → ${((((rotation % 360) + 540) % 360) - 180).toFixed(1)}°`}
                  onClick={() => {
                    const norm = ((rotation % 360) + 540) % 360 - 180
                    const r = typeof draft.rotation === 'number' ? norm : { ...(draft.rotation as object), z: norm } as CCSceneNode['rotation']
                    applyAndSave({ rotation: r })
                  }}
                  style={{ cursor: 'pointer', color: '#f87171', fontSize: 8, padding: '0 2px', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 2 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fca5a5')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#f87171')}
                >normalize</span>
              )}
              {/* R2563: 회전 클립보드 복사/붙여넣기 */}
              <span
                title="회전 복사 — 다른 노드에 붙여넣기 가능 (R2563)"
                onClick={() => { rotClipboard.current = rotation; setRotClipFilled(true) }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#a78bfa', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')} onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
              >R↑</span>
              <span
                title={rotClipFilled && rotClipboard.current !== null ? `회전 붙여넣기 (${rotClipboard.current}°) — R2563` : '복사된 회전 없음'}
                onClick={() => { if (rotClipboard.current !== null) { const r = typeof draft.rotation === 'number' ? rotClipboard.current : { ...(draft.rotation as object), z: rotClipboard.current } as CCSceneNode['rotation']; applyAndSave({ rotation: r }) } }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: rotClipFilled ? 'pointer' : 'default', color: rotClipFilled ? '#a78bfa' : '#333', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => { if (rotClipFilled) e.currentTarget.style.color = '#c4b5fd' }} onMouseLeave={e => { e.currentTarget.style.color = rotClipFilled ? '#a78bfa' : '#333' }}
              >R↓</span>
            </div>
            {numInput('Z°', rotation, v => {
              const r = typeof draft.rotation === 'number' ? v : { ...(draft.rotation as object), z: v } as CCSceneNode['rotation']
              applyAndSave({ rotation: r })
            })}
            {/* R1732: 회전 스텝 버튼 ±15°/±90° */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
              {([-90, -15, 15, 90] as const).map(delta => (
                <span
                  key={delta}
                  title={`회전 ${delta > 0 ? '+' : ''}${delta}°`}
                  onClick={() => {
                    const r = typeof draft.rotation === 'number' ? (rotation + delta) : { ...(draft.rotation as object), z: rotation + delta } as CCSceneNode['rotation']
                    applyAndSave({ rotation: r })
                  }}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >{delta > 0 ? '+' : ''}{delta}°</span>
              ))}
              {/* R2333: 회전 0° 리셋 */}
              {Math.abs(rotation) > 0.01 && (
                <span title="회전 0°으로 리셋"
                  onClick={() => {
                    const r = typeof draft.rotation === 'number' ? 0 : { ...(draft.rotation as object), z: 0 } as CCSceneNode['rotation']
                    applyAndSave({ rotation: r })
                  }}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#34d399', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#6ee7b7')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#34d399')}
                >0°</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              크기
              {/* R1592: 크기 정수 반올림 버튼 */}
              <span title="크기 정수 반올림 (Round to integer)" onClick={() => applyAndSave({ size: { x: Math.round(draft.size.x), y: Math.round(draft.size.y) } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⌊⌉</span>
              {/* R1682: 크기 복사 버튼 */}
              <span title="크기 클립보드 복사 (w × h)" onClick={() => navigator.clipboard.writeText(`${Math.round(draft.size.x)} × ${Math.round(draft.size.y)}`).catch(() => {})} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⎘</span>
              {/* R1652: 부모 크기에 맞추기 버튼 */}
              {zOrderInfo?.parentSize?.x && zOrderInfo?.parentSize?.y && (
                <span title={`부모 크기에 맞추기 (${Math.round(zOrderInfo.parentSize.x)}×${Math.round(zOrderInfo.parentSize.y)})`} onClick={() => applyAndSave({ size: { x: zOrderInfo.parentSize!.x, y: zOrderInfo.parentSize!.y } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>⊞↑</span>
              )}
              {/* R1593: 크기 비율 잠금 버튼 */}
              <span
                title={lockSize ? '크기 비율 잠금 해제' : '크기 W/H 비율 잠금'}
                onClick={() => setLockSize(v => !v)}
                style={{ cursor: 'pointer', fontSize: 9, color: lockSize ? '#58a6ff' : '#555' }}
                onMouseEnter={e => (e.currentTarget.style.color = lockSize ? '#7fc6ff' : '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = lockSize ? '#58a6ff' : '#555')}
              >{lockSize ? '🔒' : '🔓'}</span>
            </div>
            {numInput('W', draft.size.x, v => {
              const ratio = draft.size.x !== 0 ? v / draft.size.x : 1
              applyAndSave({ size: lockSize ? { x: v, y: draft.size.y * ratio } : { ...draft.size, x: v } })
            })}
            {numInput('H', draft.size.y, v => {
              const ratio = draft.size.y !== 0 ? v / draft.size.y : 1
              applyAndSave({ size: lockSize ? { x: draft.size.x * ratio, y: v } : { ...draft.size, y: v } })
            })}
            {/* R1741: 크기 스텝 버튼 */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
              {([-10, -1, 1, 10] as const).map(d => (
                <span key={`sw${d}`} title={`W ${d > 0 ? '+' : ''}${d}`}
                  onClick={() => {
                    const nw = draft.size.x + d
                    const ratio = draft.size.x !== 0 ? nw / draft.size.x : 1
                    applyAndSave({ size: lockSize ? { x: nw, y: draft.size.y * ratio } : { ...draft.size, x: nw } })
                  }}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >W{d > 0 ? '+' : ''}{d}</span>
              ))}
              {([-10, -1, 1, 10] as const).map(d => (
                <span key={`sh${d}`} title={`H ${d > 0 ? '+' : ''}${d}`}
                  onClick={() => {
                    const nh = draft.size.y + d
                    const ratio = draft.size.y !== 0 ? nh / draft.size.y : 1
                    applyAndSave({ size: lockSize ? { x: draft.size.x * ratio, y: nh } : { ...draft.size, y: nh } })
                  }}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >H{d > 0 ? '+' : ''}{d}</span>
              ))}
            </div>
            {/* R1744: 크기 배율 버튼 ×0.5/×2 / R1779: int 정수화 */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
              {([0.5, 2] as const).map(mult => (
                <span key={mult} title={`크기 ×${mult}`}
                  onClick={() => applyAndSave({ size: { x: draft.size.x * mult, y: lockSize ? draft.size.y * mult : draft.size.y * mult } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >×{mult}</span>
              ))}
              <span title="크기 정수화 (소수점 제거)"
                onClick={() => applyAndSave({ size: { x: Math.round(draft.size.x), y: Math.round(draft.size.y) } })}
                style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
              >int</span>
            </div>
            {/* R1670: 크기 % 표시 */}
            {showPct && zOrderInfo?.parentSize && (() => {
              const pw = zOrderInfo.parentSize!.x, ph = zOrderInfo.parentSize!.y
              if (!pw || !ph) return null
              return (
                <div style={{ fontSize: 8, color: '#58a6ff', lineHeight: 1.5, marginTop: 1 }}>
                  w:{((draft.size.x / pw) * 100).toFixed(1)}% h:{((draft.size.y / ph) * 100).toFixed(1)}%
                </div>
              )
            })()}
            <div style={{ fontSize: 9, color: 'var(--text-muted)', margin: '5px 0 3px', display: 'flex', alignItems: 'center', gap: 4 }}>
              스케일
              <span title="스케일 리셋 (1,1)" onClick={() => applyAndSave({ scale: { x: 1, y: 1, z: draft.scale.z ?? 1 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
              <span
                title={lockScale ? '비율 잠금 해제' : '비율 잠금'}
                onClick={() => setLockScale(l => !l)}
                style={{ cursor: 'pointer', fontSize: 9, color: lockScale ? '#58a6ff' : '#555' }}
                onMouseEnter={e => (e.currentTarget.style.color = lockScale ? '#7fc6ff' : '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = lockScale ? '#58a6ff' : '#555')}
              >{lockScale ? '🔒' : '🔓'}</span>
              {/* R1645: X/Y 반전 버튼 */}
              <span title="X 반전 (scaleX 부호 반전)" onClick={() => applyAndSave({ scale: { ...draft.scale, x: -draft.scale.x } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↔</span>
              <span title="Y 반전 (scaleY 부호 반전)" onClick={() => applyAndSave({ scale: { ...draft.scale, y: -draft.scale.y } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↕</span>
              {/* R1686: 균등 스케일 (X=Y=평균) */}
              {draft.scale.x !== draft.scale.y && (
                <span title={`균등 스케일 X=Y (평균: ${((draft.scale.x + draft.scale.y) / 2).toFixed(2)})`} onClick={() => { const avg = (draft.scale.x + draft.scale.y) / 2; applyAndSave({ scale: { ...draft.scale, x: avg, y: avg } }) }} style={{ cursor: 'pointer', color: '#fbbf24', fontSize: 8, padding: '0 2px', borderRadius: 2 }} onMouseEnter={e => (e.currentTarget.style.color = '#fde68a')} onMouseLeave={e => (e.currentTarget.style.color = '#fbbf24')}>⊟</span>
              )}
              {/* R2564: 스케일 클립보드 복사/붙여넣기 */}
              <span
                title="스케일(X,Y) 복사 — 다른 노드에 붙여넣기 가능 (R2564)"
                onClick={() => { scaleClipboard.current = { x: draft.scale.x, y: draft.scale.y }; setScaleClipFilled(true) }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#34d399', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#6ee7b7')} onMouseLeave={e => (e.currentTarget.style.color = '#34d399')}
              >Sc↑</span>
              <span
                title={scaleClipFilled && scaleClipboard.current ? `스케일 붙여넣기 (${scaleClipboard.current.x}, ${scaleClipboard.current.y}) — R2564` : '복사된 스케일 없음'}
                onClick={() => { if (scaleClipboard.current) applyAndSave({ scale: { ...draft.scale, x: scaleClipboard.current.x, y: scaleClipboard.current.y } }) }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: scaleClipFilled ? 'pointer' : 'default', color: scaleClipFilled ? '#34d399' : '#333', background: 'none', userSelect: 'none' }}
                onMouseEnter={e => { if (scaleClipFilled) e.currentTarget.style.color = '#6ee7b7' }} onMouseLeave={e => { e.currentTarget.style.color = scaleClipFilled ? '#34d399' : '#333' }}
              >Sc↓</span>
            </div>
            {numInput('X', draft.scale.x, v => {
              const ratio = draft.scale.x !== 0 ? v / draft.scale.x : 1
              applyAndSave({ scale: lockScale ? { x: v, y: draft.scale.y * ratio, z: draft.scale.z ?? 1 } : { ...draft.scale, x: v } })
            }, 0.01)}
            {numInput('Y', draft.scale.y, v => {
              const ratio = draft.scale.y !== 0 ? v / draft.scale.y : 1
              applyAndSave({ scale: lockScale ? { x: draft.scale.x * ratio, y: v, z: draft.scale.z ?? 1 } : { ...draft.scale, y: v } })
            }, 0.01)}
            {/* R1733: 스케일 스텝 버튼 ×0.5/×2 / R1782: int 정수화 */}
            <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
              {([0.5, 2] as const).map(mult => (
                <span
                  key={mult}
                  title={`스케일 ×${mult}`}
                  onClick={() => applyAndSave({ scale: { x: draft.scale.x * mult, y: draft.scale.y * mult, z: draft.scale.z ?? 1 } })}
                  style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', userSelect: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >×{mult}</span>
              ))}
              <span title="스케일 정수화 (소수점 제거)"
                onClick={() => applyAndSave({ scale: { x: Math.round(draft.scale.x), y: Math.round(draft.scale.y), z: Math.round(draft.scale.z ?? 1) } })}
                style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#a78bfa', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
              >int</span>
              {/* R2333: 스케일 1:1 리셋 */}
              <span title="스케일 1:1 리셋 (X=1, Y=1)"
                onClick={() => applyAndSave({ scale: { x: 1, y: 1, z: 1 } })}
                style={{ fontSize: 8, padding: '0 3px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 2, color: '#34d399', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#6ee7b7')}
                onMouseLeave={e => (e.currentTarget.style.color = '#34d399')}
              >1:1</span>
            </div>
          </div>
        </div>
        </>
      )}

      {secHeader('anchor', '앵커 / 불투명도', (() => {
        const os = origSnapRef.current
        if (!os) return false
        return Math.abs((draft.opacity ?? 255) - (os.opacity ?? 255)) > 0.5
      })())}
      {!collapsed['anchor'] && (
      <div>
        {/* R2554: 앵커 변경 시 position 자동 보정 토글 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, cursor: 'pointer', fontSize: 9, color: anchorCompensate ? '#34d399' : 'var(--text-muted)' }}>
          <input type="checkbox" checked={anchorCompensate} onChange={e => setAnchorCompensate(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#34d399' }} />
          앵커 변경 시 위치 자동 보정 (R2554)
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {numInput('aX', draft.anchor.x, v => applyAndSave({ anchor: { ...draft.anchor, x: v } }), 0.01)}
            {numInput('aY', draft.anchor.y, v => applyAndSave({ anchor: { ...draft.anchor, y: v } }), 0.01)}
          </div>
          {/* R1671: 앵커 9-point 프리셋 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 16px)', gap: 2, flexShrink: 0 }}>
            {([0, 1, 0.5, 1, 1, 1, 0, 0.5, 0.5, 0.5, 1, 0.5, 0, 0, 0.5, 0, 1, 0] as number[]).reduce<Array<[number,number]>>((acc, _, i, arr) => i % 2 === 0 ? [...acc, [arr[i], arr[i+1]]] : acc, []).map(([ax, ay]) => {
              const isActive = Math.abs((draft.anchor.x ?? 0.5) - ax) < 0.01 && Math.abs((draft.anchor.y ?? 0.5) - ay) < 0.01
              const labels: Record<string, string> = {
                '0,1': '↖', '0.5,1': '↑', '1,1': '↗',
                '0,0.5': '←', '0.5,0.5': '⊕', '1,0.5': '→',
                '0,0': '↙', '0.5,0': '↓', '1,0': '↘',
              }
              const label = labels[`${ax},${ay}`] ?? '·'
              return (
                <span
                  key={`${ax}-${ay}`}
                  title={`앵커 (${ax}, ${ay})`}
                  onClick={() => {
                    // R2554: anchorCompensate ON이면 position 자동 보정
                    if (anchorCompensate) {
                      const oldAx = draft.anchor?.x ?? 0.5, oldAy = draft.anchor?.y ?? 0.5
                      const w = draft.size?.x ?? 0, h = draft.size?.y ?? 0
                      const pos = draft.position as { x: number; y: number; z?: number }
                      const newPosX = pos.x + (oldAx - ax) * w
                      const newPosY = pos.y + (oldAy - ay) * h
                      applyAndSave({ anchor: { x: ax, y: ay }, position: { ...pos, x: newPosX, y: newPosY } })
                    } else {
                      applyAndSave({ anchor: { x: ax, y: ay } })
                    }
                  }}
                  style={{
                    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, cursor: 'pointer', borderRadius: 2, userSelect: 'none',
                    background: isActive ? 'rgba(88,166,255,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? '#58a6ff' : 'var(--border)'}`,
                    color: isActive ? '#58a6ff' : 'var(--text-muted)',
                  }}
                >{label}</span>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ minWidth: 38, whiteSpace: 'nowrap', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>α (불투명)</span>
          <input
            type="range"
            min={0}
            max={255}
            step={1}
            value={draft.opacity ?? 255}
            onChange={e => applyAndSave({ opacity: Number(e.target.value) })}
            style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
          <span style={{ width: 36, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
            {Math.round(((draft.opacity ?? 255) / 255) * 100)}%
          </span>
          {/* R2574: 불투명도 클립보드 o↑/o↓ */}
          <span
            title={`불투명도 복사 (${draft.opacity ?? 255}) — R2574`}
            onClick={() => { opacityClipboard.current = draft.opacity ?? 255; setOpacityClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#94a3b8', background: 'none', userSelect: 'none', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#cbd5e1' }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
          >o↑</span>
          <span
            title={opacityClipFilled && opacityClipboard.current !== null ? `불투명도 붙여넣기 (${opacityClipboard.current}) — R2574` : '복사된 불투명도 없음'}
            onClick={() => { if (opacityClipboard.current !== null) applyAndSave({ opacity: opacityClipboard.current }) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: opacityClipFilled ? 'pointer' : 'default', color: opacityClipFilled ? '#94a3b8' : '#333', background: 'none', userSelect: 'none', flexShrink: 0 }}
            onMouseEnter={e => { if (opacityClipFilled) e.currentTarget.style.color = '#cbd5e1' }} onMouseLeave={e => { e.currentTarget.style.color = opacityClipFilled ? '#94a3b8' : '#333' }}
          >o↓</span>
        </div>
        {/* R1647: opacity 빠른 프리셋 */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 4, marginTop: 2 }}>
          {([0, 64, 128, 191, 255] as const).map(v => (
            <span
              key={v}
              onClick={() => applyAndSave({ opacity: v })}
              title={`opacity ${Math.round(v / 255 * 100)}%`}
              style={{ fontSize: 8, padding: '0 3px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border)', color: Math.abs((draft.opacity ?? 255) - v) < 2 ? '#58a6ff' : 'var(--text-muted)', background: Math.abs((draft.opacity ?? 255) - v) < 2 ? 'rgba(88,166,255,0.12)' : 'none', userSelect: 'none' }}
            >{Math.round(v / 255 * 100)}%</span>
          ))}
        </div>
        {/* R1609: 노드 색상(tint) 피커 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ minWidth: 38, whiteSpace: 'nowrap', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>tint</span>
          <input
            type="color"
            value={(() => {
              const c = draft.color ?? { r: 255, g: 255, b: 255 }
              return `#${(c.r ?? 255).toString(16).padStart(2,'0')}${(c.g ?? 255).toString(16).padStart(2,'0')}${(c.b ?? 255).toString(16).padStart(2,'0')}`
            })()}
            onChange={e => {
              const hex = e.target.value
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
              applyAndSave({ color: { r, g, b, a: draft.color?.a ?? 255 } })
            }}
            title="노드 색상 tint (흰색=기본)"
            style={{ width: 26, height: 18, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', flexShrink: 0 }}
          />
          {/* R2518: hex 텍스트 직접 입력 */}
          {(() => {
            const c = draft.color ?? { r: 255, g: 255, b: 255 }
            const currentHex = `#${(c.r ?? 255).toString(16).padStart(2,'0')}${(c.g ?? 255).toString(16).padStart(2,'0')}${(c.b ?? 255).toString(16).padStart(2,'0')}`
            const displayVal = tintHexFocused ? tintHexInput : currentHex
            return (
              <input
                type="text" value={displayVal} maxLength={7}
                title="hex 코드 직접 입력 (예: #ff0000) (R2518)"
                onFocus={() => { setTintHexFocused(true); setTintHexInput(currentHex) }}
                onBlur={() => {
                  setTintHexFocused(false)
                  const m = tintHexInput.match(/^#?([0-9a-f]{6})$/i)
                  if (m) {
                    const hex = m[1]
                    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
                    applyAndSave({ color: { r, g, b, a: c.a ?? 255 } })
                  }
                }}
                onChange={e => setTintHexInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const m = tintHexInput.match(/^#?([0-9a-f]{6})$/i)
                    if (m) { const hex = m[1]; const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16); applyAndSave({ color: { r, g, b, a: c.a ?? 255 } }) }
                    e.currentTarget.blur()
                  }
                }}
                style={{ width: 52, fontSize: 8, padding: '1px 2px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}
              />
            )
          })()}
          {((draft.color?.r ?? 255) !== 255 || (draft.color?.g ?? 255) !== 255 || (draft.color?.b ?? 255) !== 255) && (
            <span
              title="tint 초기화 (흰색)"
              onClick={() => applyAndSave({ color: { r: 255, g: 255, b: 255, a: draft.color?.a ?? 255 } })}
              style={{ fontSize: 9, color: '#555', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >↺</span>
          )}
          {/* R2562: 색상 클립보드 복사/붙여넣기 */}
          <span
            title="색상(tint) 복사 — 다른 노드에 붙여넣기 가능 (R2562)"
            onClick={() => { const c = draft.color ?? { r: 255, g: 255, b: 255 }; colorClipboard.current = { r: c.r ?? 255, g: c.g ?? 255, b: c.b ?? 255 }; setColorClipFilled(true) }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', color: '#fb923c', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fdba74')} onMouseLeave={e => (e.currentTarget.style.color = '#fb923c')}
          >C↑</span>
          <span
            title={colorClipFilled && colorClipboard.current ? `색상 붙여넣기 (#${colorClipboard.current.r.toString(16).padStart(2,'0')}${colorClipboard.current.g.toString(16).padStart(2,'0')}${colorClipboard.current.b.toString(16).padStart(2,'0')}) — R2562` : '복사된 색상 없음'}
            onClick={() => { if (colorClipboard.current) { const cc = colorClipboard.current; applyAndSave({ color: { r: cc.r, g: cc.g, b: cc.b, a: draft.color?.a ?? 255 } }) } }}
            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', cursor: colorClipFilled ? 'pointer' : 'default', color: colorClipFilled ? '#fb923c' : '#333', background: 'none', userSelect: 'none' }}
            onMouseEnter={e => { if (colorClipFilled) e.currentTarget.style.color = '#fdba74' }} onMouseLeave={e => { e.currentTarget.style.color = colorClipFilled ? '#fb923c' : '#333' }}
          >C↓</span>
          {/* R1631: 빠른 tint 색상 프리셋 */}
          {([{ r:255,g:0,b:0 },{ r:255,g:128,b:0 },{ r:255,g:255,b:0 },{ r:0,g:255,b:0 },{ r:0,g:128,b:255 },{ r:128,g:0,b:255 },{ r:0,g:0,b:0 }] as const).map(c => (
            <div
              key={`${c.r}${c.g}${c.b}`}
              onClick={() => applyAndSave({ color: { r: c.r, g: c.g, b: c.b, a: draft.color?.a ?? 255 } })}
              title={`tint #${c.r.toString(16).padStart(2,'0')}${c.g.toString(16).padStart(2,'0')}${c.b.toString(16).padStart(2,'0')}`}
              style={{ width: 10, height: 10, borderRadius: 2, cursor: 'pointer', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)', background: `rgb(${c.r},${c.g},${c.b})` }}
            />
          ))}
        </div>
      </div>
      )}

      {/* R1479: Layer 필드 편집 (CC2.x _layer / CC3.x layer — 둘 다 지원) */}
      {draft.layer != null && (() => {
        const layerOptions3x: [number, string][] = [
          [1, 'DEFAULT'], [2, 'IGNORE_RAYCAST'], [4, 'GIZMOS'], [8, 'EDITOR'],
          [16, 'UI_3D'], [32, 'SCENE_GIZMO'], [64, 'PROFILER'],
          [524288, 'UI_2D'], [1073741824, 'ALL'],
        ]
        const layerOptions2x: [number, string][] = [
          [0, 'NONE'], [1, 'DEFAULT'], [2, 'IGNORE_RAYCAST'], [4, 'GIZMOS'],
          [8, 'EDITOR'], [16, 'UI'], [32, 'SCENE_GIZMO'], [33554432, '기본(0x2000000)'],
        ]
        const layerOptions = is3x ? layerOptions3x : layerOptions2x
        const isKnown = layerOptions.some(([v]) => v === draft.layer)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ minWidth: 38, whiteSpace: 'nowrap', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>layer</span>
            <select
              value={isKnown ? draft.layer : 'custom'}
              onChange={e => { if (e.target.value !== 'custom') applyAndSave({ layer: Number(e.target.value) }) }}
              style={{
                flex: 1, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px',
              }}
            >
              {layerOptions.map(([v, n]) => <option key={v} value={v}>{n} ({v})</option>)}
              {!isKnown && <option value="custom">0x{draft.layer.toString(16)}</option>}
            </select>
            <input
              type="number"
              value={draft.layer}
              onChange={e => applyAndSave({ layer: parseInt(e.target.value) || 0 })}
              style={{ width: 60, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
              title="레이어 비트마스크 직접 입력"
            />
          </div>
        )
      })()}

      {/* R2343: 노드 tag 편집 (CC2.x _tag → normalized tag) */}
      {draft.tag != null && draft.tag !== 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 26, whiteSpace: 'nowrap', flexShrink: 0 }}>tag</span>
          <input type="number" defaultValue={draft.tag ?? 0}
            key={`tag-${draft.tag}`}
            onBlur={e => applyAndSave({ tag: parseInt(e.target.value) || 0 })}
            style={{ width: 54, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fbbf24', borderRadius: 3, padding: '1px 3px' }}
            title="노드 태그 (CC2.x _tag) — 0은 기본값으로 숨김"
          />
          <span style={{ fontSize: 8, color: '#555' }}>_tag</span>
        </div>
      )}

      {/* R2393: cascadeOpacityEnabled + cascadeColorEnabled (CC2.x 노드 레벨) */}
      {!is3x && (
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox"
              checked={!!(draft.cascadeOpacityEnabled ?? (draft as Record<string,unknown>)._cascadeOpacityEnabled ?? true)}
              onChange={e => applyAndSave({ cascadeOpacityEnabled: e.target.checked } as Partial<CCSceneNode>)}
            />cascadeOpacity
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox"
              checked={!!(draft.cascadeColorEnabled ?? (draft as Record<string,unknown>)._cascadeColorEnabled ?? false)}
              onChange={e => applyAndSave({ cascadeColorEnabled: e.target.checked } as Partial<CCSceneNode>)}
            />cascadeColor
          </label>
        </div>
      )}
      {/* R2394: skewX / skewY (CC2.x 노드 레벨) */}
      {!is3x && (() => {
        const sx = Number((draft as Record<string,unknown>)._skewX ?? (draft as Record<string,unknown>).skewX ?? 0)
        const sy = Number((draft as Record<string,unknown>)._skewY ?? (draft as Record<string,unknown>).skewY ?? 0)
        if (sx === 0 && sy === 0) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 26, whiteSpace: 'nowrap', flexShrink: 0 }}>skew</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>x</span>
            <input type="number" defaultValue={sx} key={`skx-${sx}`} step={1}
              onBlur={e => applyAndSave({ _skewX: parseFloat(e.target.value) || 0 } as Partial<CCSceneNode>)}
              style={{ width: 44, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fbbf24', borderRadius: 3, padding: '1px 3px' }}
            />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
            <input type="number" defaultValue={sy} key={`sky-${sy}`} step={1}
              onBlur={e => applyAndSave({ _skewY: parseFloat(e.target.value) || 0 } as Partial<CCSceneNode>)}
              style={{ width: 44, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fbbf24', borderRadius: 3, padding: '1px 3px' }}
            />
          </div>
        )
      })()}
      {/* R2395: _rotationX / _rotationY (CC2.x 3D 회전) */}
      {!is3x && (() => {
        const rx = Number((draft as Record<string,unknown>)._rotationX ?? (draft as Record<string,unknown>).rotationX ?? 0)
        const ry = Number((draft as Record<string,unknown>)._rotationY ?? (draft as Record<string,unknown>).rotationY ?? 0)
        if (rx === 0 && ry === 0) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 26, whiteSpace: 'nowrap', flexShrink: 0 }}>rot3</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>x</span>
            <input type="number" defaultValue={rx} key={`rx-${rx}`} step={1}
              onBlur={e => applyAndSave({ _rotationX: parseFloat(e.target.value) || 0 } as Partial<CCSceneNode>)}
              style={{ width: 44, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fb923c', borderRadius: 3, padding: '1px 3px' }}
            />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>y</span>
            <input type="number" defaultValue={ry} key={`ry-${ry}`} step={1}
              onBlur={e => applyAndSave({ _rotationY: parseFloat(e.target.value) || 0 } as Partial<CCSceneNode>)}
              style={{ width: 44, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: '#fb923c', borderRadius: 3, padding: '1px 3px' }}
            />
          </div>
        )
      })()}

      {/* R1646: 색상 변경 인디케이터 */}
      {secHeader('color', '색상', (() => {
        const os = origSnapRef.current
        if (!os) return false
        const oc = os.color ?? { r: 255, g: 255, b: 255, a: 255 }
        const dc = draft.color
        return Math.abs((dc.r) - (oc.r ?? 255)) > 0 ||
          Math.abs((dc.g) - (oc.g ?? 255)) > 0 ||
          Math.abs((dc.b) - (oc.b ?? 255)) > 0 ||
          Math.abs((dc.a) - (oc.a ?? 255)) > 0
      })())}
      {!collapsed['color'] && (
      <div style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="color"
            value={`#${[draft.color.r, draft.color.g, draft.color.b].map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('')}`}
            onChange={e => {
              const hex = e.target.value.slice(1)
              const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
              applyAndSave({ color: { r, g, b, a: draft.color.a } })
            }}
            style={{ width: 28, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'none' }}
          />
          {numInput('A', draft.color.a, v => applyAndSave({ color: { ...draft.color, a: Math.min(255,Math.max(0,Math.round(v))) } }))}
        </div>
      </div>
      )}

      {/* R1532: Tag / Layer 편집 */}
      {(draft.tag != null || draft.layer != null) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {draft.tag != null && (
            <>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 24 }}>Tag</span>
              <input
                type="number"
                value={draft.tag}
                onChange={e => applyAndSave({ tag: parseInt(e.target.value) || 0 })}
                style={{ width: 54, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
              />
            </>
          )}
          {draft.layer != null && (
            <>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 30 }}>Layer</span>
              <input
                type="number"
                value={draft.layer}
                onChange={e => applyAndSave({ layer: parseInt(e.target.value) || 0 })}
                style={{ width: 66, fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 4px' }}
              />
              {/* R1774: 레이어 이름 배지 */}
              {(() => {
                const layerNames: Record<number, string> = { 1: 'DEFAULT', 2: 'IGNORE_RAYCAST', 4: 'TERRAIN', 8: 'ENVIRONMENT', 16: 'UI_3D', 512: 'SCENE_GIZMO', 1024: 'EDITOR', 524288: 'UI_2D', 1073741824: 'ALL' }
                const name = layerNames[draft.layer!]
                return name ? <span style={{ fontSize: 8, color: '#a78bfa', padding: '1px 3px', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 2 }}>{name}</span> : null
              })()}
            </>
          )}
        </div>
      )}
    </>
  )
}
