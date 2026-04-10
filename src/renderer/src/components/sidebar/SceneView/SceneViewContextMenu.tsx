import React from 'react'
import type { SceneNode } from './types'
import { useSceneViewCtx } from './SceneViewContext'
import { NT_KEY } from './sceneViewConstants'

/**
 * SVG 우클릭 컨텍스트 메뉴 + 노드 태그 입력 모달 + 색상 태그 피커
 * SceneViewPanel에서 추출됨 (Context로 상태 공유)
 */
export function SceneViewContextMenu() {
  const ctx = useSceneViewCtx()
  const {
    svgContextMenu, setSvgContextMenu,
    nodeMap, selectedUuid, setSelectedUuid, selectedUuids, setSelectedUuids,
    bookmarkedUuids, setBookmarkedUuids,
    updateNode, handlePaste, handleDuplicate, handleDeleteNode,
    setClipboard, setCopiedNode,
    nodeTags, setNodeTags, setNodeTagDraft, setNodeTagInput, nodeTagInput, nodeTagDraft,
    animPlayingUuid, handleAnimPreviewStart, handleAnimPreviewStop, handleAiAnalyze,
    nodeTemplates, setNodeTemplates,
    showColorTagPicker, setShowColorTagPicker,
    nodeColorTags, setNodeColorTags, nodeColors, setNodeColors,
  } = ctx

  return (
    <>
      {/* SVG 우클릭 컨텍스트 메뉴 */}
      {svgContextMenu && (() => {
        const ctxUuid = svgContextMenu.uuid
        const ctxNode = ctxUuid ? nodeMap.get(ctxUuid) : null
        const close = () => setSvgContextMenu(null)
        const menuStyle: React.CSSProperties = {
          display: 'block', width: '100%', textAlign: 'left',
          padding: '5px 12px', background: 'none', border: 'none',
          color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11,
          whiteSpace: 'nowrap',
        }
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={close} onContextMenu={e => { e.preventDefault(); close() }} />
            <div style={{
              position: 'fixed', left: svgContextMenu.x, top: svgContextMenu.y,
              zIndex: 1000, background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: 150, fontSize: 11,
            }}>
              {ctxNode && (
                <div style={{ padding: '3px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  {ctxNode.name}
                </div>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => { setSelectedUuid(ctxUuid!); setSelectedUuids(new Set([ctxUuid!])); close() }}>선택</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  setSelectedUuid(ctxUuid!)
                  setSelectedUuids(new Set([ctxUuid!]))
                  const n = nodeMap.get(ctxUuid!)
                  if (n) {
                    setClipboard([{ uuid: n.uuid, name: n.name, x: n.x ?? 0, y: n.y ?? 0 }])
                    setCopiedNode(n)
                  }
                  close()
                }}>복사</button>
              )}
              <button style={menuStyle} onClick={() => { handlePaste(); close() }}>붙여넣기</button>
              {ctxNode && (
                <button style={menuStyle} onClick={() => { handleDuplicate(); close() }}>복제</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  updateNode(ctxUuid!, { visible: ctxNode.visible === false ? true : false })
                  close()
                }}>{ctxNode.visible === false ? '\uD83D\uDC41 보이기' : '\uD83D\uDC41 숨기기'}</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  updateNode(ctxUuid!, { locked: !ctxNode.locked })
                  close()
                }}>{ctxNode.locked ? '\uD83D\uDD13 잠금 해제' : '\uD83D\uDD12 잠금'}</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  setBookmarkedUuids(prev => {
                    const next = new Set(prev)
                    if (next.has(ctxUuid!)) next.delete(ctxUuid!)
                    else next.add(ctxUuid!)
                    return next
                  })
                  close()
                }}>{bookmarkedUuids.has(ctxUuid!) ? '\u2605 즐겨찾기 해제' : '\u2606 즐겨찾기 추가'}</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  navigator.clipboard?.writeText(ctxUuid!)
                  close()
                }}>{'\uD83D\uDCCB'} UUID 복사</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  const pathParts: string[] = []
                  let cur: SceneNode | undefined = ctxNode
                  while (cur) { pathParts.unshift(cur.name); cur = cur.parentUuid ? nodeMap.get(cur.parentUuid) : undefined }
                  navigator.clipboard?.writeText(pathParts.join('/'))
                  close()
                }}>{'\uD83D\uDCCB'} 경로 복사</button>
              )}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  const existing = nodeTags[ctxUuid!] ?? []
                  setNodeTagDraft(existing.join(', '))
                  setNodeTagInput(ctxUuid!)
                  close()
                }}>{'\uD83C\uDFF7'} 태그 편집</button>
              )}
              {/* R1464: 애니메이션 프리뷰 */}
              {ctxNode && (() => {
                const hasAnim = ctxNode.components.some(c =>
                  c.type === 'cc.Tween' || c.type === 'cc.TweenSystem' ||
                  c.type === 'cc.Animation' || c.type === 'cc.AnimationComponent' ||
                  c.type === 'cc.SkeletalAnimation'
                )
                if (!hasAnim) return null
                const isPlaying = animPlayingUuid === ctxUuid
                return isPlaying ? (
                  <button style={menuStyle} onClick={() => { handleAnimPreviewStop(); close() }}>{'\u25A0'} 애니 정지</button>
                ) : (
                  <button style={menuStyle} onClick={() => {
                    const comp = ctxNode.components.find(c =>
                      c.type === 'cc.Animation' || c.type === 'cc.AnimationComponent' ||
                      c.type === 'cc.Tween' || c.type === 'cc.TweenSystem'
                    )
                    const dur = (comp?.props as Record<string, unknown> | undefined)?.duration as number | undefined
                    handleAnimPreviewStart(ctxUuid!, dur ? dur * 1000 : 1000)
                    close()
                  }}>{'\u25B6'} 애니 프리뷰</button>
                )
              })()}
              {/* R1468: AI 분석 요청 */}
              {ctxNode && (
                <button style={menuStyle} onClick={() => { handleAiAnalyze(ctxUuid!); close() }}>{'\uD83E\uDD16'} AI 분석</button>
              )}
              {/* R1452: 템플릿으로 저장 */}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  const name = prompt('템플릿 이름:')
                  if (!name?.trim()) { close(); return }
                  const n = nodeMap.get(ctxUuid!)
                  if (!n) { close(); return }
                  const tmplNode = {
                    uuid: '', name: n.name, active: n.active,
                    position: { x: n.x, y: n.y, z: 0 }, rotation: n.rotation,
                    scale: { x: n.scaleX, y: n.scaleY, z: 1 }, size: { x: n.width, y: n.height },
                    anchor: { x: n.anchorX, y: n.anchorY }, opacity: n.opacity, color: n.color,
                    components: n.components, children: [],
                  }
                  setNodeTemplates(prev => {
                    const next = [{ name: name.trim(), node: tmplNode }, ...prev].slice(0, 10)
                    localStorage.setItem(NT_KEY, JSON.stringify(next))
                    return next
                  })
                  close()
                }}>{'\uD83D\uDCCC'} 템플릿으로 저장</button>
              )}
              {/* R1407: 색상 태그 */}
              {ctxNode && (
                <button style={menuStyle} onClick={() => {
                  setShowColorTagPicker({ uuid: ctxUuid!, x: svgContextMenu!.x + 160, y: svgContextMenu!.y })
                  close()
                }}>{'\uD83C\uDFA8'} 색상 태그</button>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
              {ctxNode && (
                <button style={{ ...menuStyle, color: 'var(--error)' }} onClick={() => {
                  close()
                  handleDeleteNode()
                }}>삭제</button>
              )}
            </div>
          </>
        )
      })()}

      {/* 노드 태그 입력 모달 */}
      {nodeTagInput && (() => {
        const addNodeTag = () => {
          const tags = nodeTagDraft.split(',').map(t => t.trim()).filter(Boolean)
          setNodeTags(prev => {
            const next = { ...prev, [nodeTagInput]: tags }
            if (tags.length === 0) delete next[nodeTagInput]
            localStorage.setItem('node-tags', JSON.stringify(next))
            return next
          })
          setNodeTagInput(null)
          setNodeTagDraft('')
        }
        const nodeName = nodeMap.get(nodeTagInput)?.name ?? nodeTagInput
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1999, background: 'rgba(0,0,0,0.4)' }}
              onClick={() => { setNodeTagInput(null); setNodeTagDraft('') }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 2000, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '16px 20px', minWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                태그 편집 — {nodeName}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                쉼표로 구분하여 여러 태그 입력 (예: ui, button, important)
              </div>
              <input
                autoFocus
                value={nodeTagDraft}
                onChange={e => setNodeTagDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addNodeTag()
                  if (e.key === 'Escape') { setNodeTagInput(null); setNodeTagDraft('') }
                }}
                placeholder="태그 입력..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '5px 8px', fontSize: 11,
                  color: 'var(--text-primary)', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setNodeTagInput(null); setNodeTagDraft('') }}
                  style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  취소
                </button>
                <button onClick={addNodeTag}
                  style={{ fontSize: 11, padding: '4px 10px', background: '#7c3aed', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
                  저장
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {/* R1407: 색상 태그 피커 */}
      {showColorTagPicker && (() => {
        const closeTag = () => setShowColorTagPicker(null)
        const currentColor = nodeColorTags[showColorTagPicker.uuid]
        const COLOR_TAG_PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1999 }} onClick={closeTag} />
            <div style={{
              position: 'fixed', left: showColorTagPicker.x, top: showColorTagPicker.y,
              zIndex: 2000, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>색상 태그</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {COLOR_TAG_PALETTE.map(c => (
                  <span
                    key={c}
                    onClick={() => {
                      setNodeColorTags(prev => ({ ...prev, [showColorTagPicker.uuid]: c }))
                      setNodeColors(prev => { const next = { ...prev, [showColorTagPicker.uuid]: c }; localStorage.setItem('node-colors', JSON.stringify(next)); return next })
                      closeTag()
                    }}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: currentColor === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: currentColor === c ? '0 0 4px rgba(255,255,255,0.4)' : 'none',
                    }}
                  />
                ))}
                {/* 태그 제거 */}
                <span
                  onClick={() => {
                    setNodeColorTags(prev => { const next = { ...prev }; delete next[showColorTagPicker.uuid]; return next })
                    setNodeColors(prev => { const next = { ...prev }; delete next[showColorTagPicker.uuid]; localStorage.setItem('node-colors', JSON.stringify(next)); return next })
                    closeTag()
                  }}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                    border: '1px dashed var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: 'var(--text-muted)',
                  }}
                  title="색상 제거"
                >x</span>
              </div>
            </div>
          </>
        )
      })()}

      {/* R1440: 씬 JSON 임포트 모달 */}
      {ctx.showImportModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => ctx.setShowImportModal(false)}>
          <div
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 16, width: 400, maxHeight: '70vh',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {'\uD83D\uDCE5'} 씬 JSON 임포트
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
              CCSceneNode JSON을 붙여넣으세요. UUID 충돌 시 자동 재생성됩니다.
            </div>
            <textarea
              value={ctx.importJson}
              onChange={e => { ctx.setImportJson(e.target.value); ctx.setImportError(null) }}
              placeholder='{"uuid":"...","name":"Node","active":true,...}'
              style={{
                width: '100%', height: 160, fontSize: 10, fontFamily: 'monospace',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: ctx.importError ? '1px solid var(--error, #f85149)' : '1px solid var(--border)',
                borderRadius: 4, padding: 8, resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            {ctx.importError && (
              <div style={{ fontSize: 9, color: 'var(--error, #f85149)', marginTop: 4 }}>{ctx.importError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                onClick={() => ctx.setShowImportModal(false)}
                style={{
                  fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                }}
              >취소</button>
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(ctx.importJson)
                    if (!parsed || typeof parsed !== 'object') throw new Error('JSON 객체가 아닙니다')
                    const node = parsed as Record<string, unknown>
                    if (typeof node.name !== 'string' && typeof node.uuid !== 'string') {
                      throw new Error('유효한 CCSceneNode가 아닙니다 (name/uuid 필수)')
                    }
                    const existingUuids = new Set<string>()
                    nodeMap.forEach((_, uuid) => existingUuids.add(uuid))
                    function regenerateUuids(obj: Record<string, unknown>): void {
                      if (typeof obj.uuid === 'string' && existingUuids.has(obj.uuid)) {
                        obj.uuid = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                      }
                      if (Array.isArray(obj.children)) {
                        for (const child of obj.children) {
                          if (child && typeof child === 'object') regenerateUuids(child as Record<string, unknown>)
                        }
                      }
                    }
                    regenerateUuids(node)
                    const uuid = (node.uuid as string) ?? `import-${Date.now()}`
                    const name = (node.name as string) ?? 'Imported'
                    const pos = (node.position as { x?: number; y?: number }) ?? {}
                    const size = (node.size as { x?: number; y?: number; width?: number; height?: number }) ?? {}
                    const w = size.width ?? size.x ?? 100
                    const h = size.height ?? size.y ?? 100
                    updateNode(uuid, {
                      name,
                      x: pos.x ?? 0,
                      y: pos.y ?? 0,
                      width: typeof w === 'number' ? w : 100,
                      height: typeof h === 'number' ? h : 100,
                      active: (node.active as boolean) ?? true,
                    })
                    setSelectedUuid(uuid)
                    setSelectedUuids(new Set([uuid]))
                    ctx.setShowImportModal(false)
                    ctx.setImportJson('')
                  } catch (err: unknown) {
                    ctx.setImportError((err as Error).message ?? 'JSON 파싱 실패')
                  }
                }}
                disabled={!ctx.importJson.trim()}
                style={{
                  fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  background: 'var(--accent)', border: 'none', color: '#fff',
                  opacity: ctx.importJson.trim() ? 1 : 0.5,
                }}
              >임포트</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
