import React from 'react'
import { BackupManager } from './BackupManager'
import type { UseCCFileProjectUIReturn } from './useCCFileProjectUI'

interface ProjectToolbarProps {
  ctx: UseCCFileProjectUIReturn
}

export function ProjectToolbarSection({ ctx }: ProjectToolbarProps) {
  const {
    projectInfo, sceneFile, loading, error,
    canUndo, canRedo, undoCount, redoCount,
    loadScene, saveScene, undo, redo,
    saveMsg, setSaveMsg, saving, handleSave,
    handleRestore,
    sceneHistoryTimeline, showFullHistory, setShowFullHistory,
  } = ctx

  return (
    <>
        {/* 저장 / undo/redo / 백업 복원 버튼 */}
        {sceneFile?.root && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              title="씬 파일 저장 (.bak 자동 백업)"
              style={{
                flex: 1, padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: saving ? 'not-allowed' : 'pointer',
                background: 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중...' : '💾 저장'}
            </button>
            {/* R2327: 다른 이름으로 저장 */}
            <button
              onClick={async () => {
                if (!sceneFile?.root) return
                const result = await window.api.ccFileSaveAs?.(sceneFile, sceneFile.root)
                if (result?.success) setSaveMsg({ ok: true, text: `저장: ${result.savedPath?.split(/[\\/]/).pop()}` })
                else if (!result?.canceled) setSaveMsg({ ok: false, text: result?.error ?? '저장 실패' })
              }}
              title="다른 이름으로 저장 (Save As)"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >💾⬆</button>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3,
                cursor: canUndo ? 'pointer' : 'not-allowed',
                background: 'none', border: '1px solid var(--border)',
                color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: canUndo ? 1 : 0.4,
              }}
            >
              {/* R2321: undo 카운터 */}
              ↩{undoCount && undoCount > 0 ? <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.7 }}>{undoCount}</span> : null}
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Y)"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3,
                cursor: canRedo ? 'pointer' : 'not-allowed',
                background: 'none', border: '1px solid var(--border)',
                color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: canRedo ? 1 : 0.4,
              }}
            >
              {/* R2321: redo 카운터 */}
              ↪{redoCount && redoCount > 0 ? <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.7 }}>{redoCount}</span> : null}
            </button>
            <button
              onClick={handleRestore}
              title=".bak 백업 파일에서 복원"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >
              .bak
            </button>
          </div>
        )}
        {saveMsg && (
          <div style={{
            marginTop: 4, fontSize: 10, padding: '3px 6px', borderRadius: 3,
            background: saveMsg.ok ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
            color: saveMsg.ok ? 'var(--success, #3fb950)' : 'var(--error, #f85149)',
          }}>
            {saveMsg.text}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--error, #f85149)', lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        {/* R1423: 백업 파일 관리 섹션 */}
        {sceneFile?.scenePath && <BackupManager scenePath={sceneFile.scenePath} onRestored={() => loadScene(sceneFile.scenePath)} />}

        {/* R1414: 씬 저장 이력 타임라인 */}
        {sceneHistoryTimeline.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>저장 이력</span>
              {sceneHistoryTimeline.length > 5 && (
                <button
                  onClick={() => setShowFullHistory(v => !v)}
                  style={{ fontSize: 8, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >{showFullHistory ? '접기' : `더 보기 (${sceneHistoryTimeline.length})`}</button>
              )}
            </div>
            {(showFullHistory ? sceneHistoryTimeline : sceneHistoryTimeline.slice(0, 5)).map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, padding: '1px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span style={{ color: 'var(--text-primary)', flexShrink: 0 }}>{entry.nodeCount}N</span>
                <span style={{ color: '#555', fontSize: 8 }}>{(entry.size / 1024).toFixed(1)}KB</span>
                <button
                  disabled={!entry.snapshotKey}
                  title={entry.snapshotKey ? '이 시점으로 씬 복원' : '스냅샷 없음 (이전 방식 저장됨)'}
                  onClick={async () => {
                    if (!entry.snapshotKey || !sceneFile?.scenePath) return
                    const snap = localStorage.getItem(entry.snapshotKey)
                    if (!snap) { alert('스냅샷 데이터가 없습니다.'); return }
                    const timeStr = new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    if (!window.confirm(`${timeStr} 시점으로 씬을 복원하시겠습니까?\n현재 저장되지 않은 변경사항이 손실됩니다.`)) return
                    try {
                      const formatted = JSON.stringify(JSON.parse(snap), null, 2)
                      const res = await window.api.writeTextFile?.(sceneFile.scenePath, formatted)
                      if (res && 'error' in res) { alert('복원 실패: ' + res.error); return }
                      loadScene(sceneFile.scenePath)
                    } catch (e) { alert('복원 오류: ' + String(e)) }
                  }}
                  style={{ marginLeft: 'auto', fontSize: 8, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: entry.snapshotKey ? 'var(--accent)' : 'var(--text-muted)', cursor: entry.snapshotKey ? 'pointer' : 'default', opacity: entry.snapshotKey ? 1 : 0.4 }}
                >복원</button>
              </div>
            ))}
          </div>
        )}
    </>
  )
}
