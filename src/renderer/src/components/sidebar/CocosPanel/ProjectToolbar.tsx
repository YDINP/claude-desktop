import React from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { validateScene } from '../cocos-utils'
import { BoolToggle } from './utils'
import { BackupManager } from './BackupManager'
import type { UseCCFileProjectUIReturn, DepEntry } from './useCCFileProjectUI'
import type { OptimizationSuggestion } from './types'

interface ProjectToolbarProps {
  ctx: UseCCFileProjectUIReturn
}

export function ProjectToolbarSection({ ctx }: ProjectToolbarProps) {
  const {
    projectInfo, sceneFile, loading, error,
    canUndo, canRedo, undoCount, redoCount,
    loadScene, saveScene, undo, redo,
    selectedScene, handleSceneChange,
    saveMsg, setSaveMsg, saving, handleSave,
    sceneThumbnails,
    recentSceneFiles, addRecentScene,
    ccCtxInject, setCcCtxInject,
    handleRestore,
    validationIssues, setValidationIssues,
    showValidationResults, setShowValidationResults,
    optimizationSuggestions, setOptimizationSuggestions,
    showSceneStats, setShowSceneStats,
    showBatchMenu, setShowBatchMenu,
    batchToast,
    handleBatchFontSize, handleBatchRemoveInactive, handleBatchNormalizeName,
    showDepsAnalysis, setShowDepsAnalysis,
    depsLoading, depsEntries, handleAnalyzeDeps,
    sceneHistoryTimeline, showFullHistory, setShowFullHistory,
  } = ctx

  return (
    <>
        {/* ISSUE-011: 씬/프리팹 별도 드롭다운 */}
        {projectInfo?.scenes && projectInfo.scenes.filter(s => !s.endsWith('.prefab')).length > 0 && (
          <select
            value={selectedScene.endsWith('.prefab') ? '' : selectedScene}
            onChange={e => handleSceneChange(e.target.value)}
            style={{
              width: '100%', marginTop: 6, padding: '3px 6px', fontSize: 10,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4,
            }}
          >
            <option value="">씬 선택...</option>
            {projectInfo.scenes.filter(s => !s.endsWith('.prefab')).map(s => (
              <option key={s} value={s}>{s.split(/[\\/]/).pop()}</option>
            ))}
          </select>
        )}
        {projectInfo?.scenes && projectInfo.scenes.filter(s => s.endsWith('.prefab')).length > 0 && (
          <select
            value={selectedScene.endsWith('.prefab') ? selectedScene : ''}
            onChange={e => handleSceneChange(e.target.value)}
            style={{
              width: '100%', marginTop: 4, padding: '3px 6px', fontSize: 10,
              background: 'var(--bg-input)', color: '#a78bfa',
              border: '1px solid rgba(167,139,250,0.3)', borderRadius: 4,
            }}
          >
            <option value="" style={{ color: 'var(--text-primary)' }}>프리팹 선택...</option>
            {projectInfo.scenes.filter(s => s.endsWith('.prefab')).map(s => (
              <option key={s} value={s}>{s.split(/[\\/]/).pop()}</option>
            ))}
          </select>
        )}

        {/* R1366+R1370+R1466: 최근 씬 파일 목록 (최대 8개, 현재 씬 체크 표시, 썸네일) */}
        {recentSceneFiles.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>최근 씬</div>
            {recentSceneFiles.map(p => {
              const isCurrent = sceneFile?.scenePath === p
              const thumbKey = p.replace(/[\\/]/g, '_')
              const thumb = sceneThumbnails[thumbKey]
              return (
                <div
                  key={p}
                  onClick={() => { loadScene(p); addRecentScene(p) }}
                  style={{ fontSize: 11, cursor: 'pointer', color: isCurrent ? 'var(--success)' : 'var(--accent)', padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
                  title={p}
                >
                  {/* R1466: 씬 썸네일 (80x60 base64) */}
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: 24, height: 18, borderRadius: 2, flexShrink: 0, objectFit: 'cover', border: '1px solid var(--border)' }} />
                  ) : (
                    <span style={{ fontSize: 10, flexShrink: 0, width: 24, textAlign: 'center' }}>{'\uD83D\uDCC4'}</span>
                  )}
                  {isCurrent && <span style={{ fontSize: 10, flexShrink: 0 }}>{'✓'}</span>}
                  <span>{p.split(/[\\/]/).pop()}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* R1376: Claude 컨텍스트 주입 토글 */}
        {sceneFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '3px 0' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>Claude 컨텍스트 주입</span>
            <BoolToggle value={ccCtxInject} onChange={v => { setCcCtxInject(v); localStorage.setItem('cc-ctx-inject', String(v)) }} />
          </div>
        )}

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

        {/* R1418: 씬 유효성 검사 버튼 */}
        {sceneFile?.root && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => {
                const issues = validateScene(sceneFile.root)
                setValidationIssues(issues)
                setShowValidationResults(true)
                // R1441: 최적화 제안 생성
                let totalN = 0, activeN = 0, maxD = 0
                const compCounts: Record<string, number> = {}
                function walk(n: CCSceneNode, d: number) {
                  totalN++; if (n.active) activeN++; if (d > maxD) maxD = d
                  for (const c of n.components) compCounts[c.type] = (compCounts[c.type] ?? 0) + 1
                  for (const ch of n.children) walk(ch, d + 1)
                }
                walk(sceneFile.root, 0)
                const dcTypes = ['cc.Label', 'cc.Sprite', 'cc.Sprite2D', 'cc.RichText', 'cc.Graphics']
                const dc = dcTypes.reduce((s, t) => s + (compCounts[t] ?? 0), 0)
                const sug: OptimizationSuggestion[] = []
                if (dc > 50) sug.push({ type: 'performance', severity: dc > 100 ? 'high' : 'medium', message: `Draw Call이 ${dc}개입니다. Sprite Atlas 사용 권장` })
                if (totalN > 500) sug.push({ type: 'memory', severity: totalN > 1000 ? 'high' : 'medium', message: `노드가 너무 많습니다 (${totalN}개). 오브젝트 풀링 고려` })
                if (maxD > 10) sug.push({ type: 'structure', severity: maxD > 20 ? 'high' : 'medium', message: `씬 계층이 깊습니다 (최대 ${maxD}). 구조 단순화 권장` })
                const inact = totalN - activeN; const ratio = totalN > 0 ? inact / totalN : 0
                if (ratio > 0.3) sug.push({ type: 'memory', severity: ratio > 0.5 ? 'high' : 'medium', message: `비활성 노드 비율이 높습니다 (${Math.round(ratio * 100)}%). 불필요한 노드 정리 권장` })
                setOptimizationSuggestions(sug)
              }}
              style={{
                width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: 'pointer', background: 'none',
                border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >
              {'\uD83D\uDD0D'} 씬 검사
            </button>
            {showValidationResults && (
              <div style={{ marginTop: 4, maxHeight: 160, overflowY: 'auto', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                {validationIssues.length === 0 ? (
                  <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--success, #3fb950)' }}>
                    {'\u2705'} 문제 없음
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{validationIssues.filter(i => i.level === 'error').length} 오류 / {validationIssues.filter(i => i.level === 'warning').length} 경고</span>
                      <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowValidationResults(false)}>x</span>
                    </div>
                    {validationIssues.map((issue, i) => (
                      <div key={i} style={{
                        padding: '3px 8px', fontSize: 9, borderBottom: '1px solid rgba(255,255,255,0.04)',
                        color: issue.level === 'error' ? 'var(--error, #f85149)' : '#fbbf24',
                        display: 'flex', alignItems: 'flex-start', gap: 4,
                      }}>
                        <span style={{ flexShrink: 0 }}>{issue.level === 'error' ? '\uD83D\uDD34' : '\uD83D\uDFE1'}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={issue.message}>{issue.message}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* R1441: 최적화 제안 표시 */}
        {showValidationResults && optimizationSuggestions.length > 0 && (
          <div style={{ marginTop: 4, borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
              {'\uD83D\uDCA1'} 최적화 제안 ({optimizationSuggestions.length})
            </div>
            {optimizationSuggestions.map((s, i) => (
              <div key={i} style={{
                padding: '3px 8px', fontSize: 9, borderBottom: '1px solid rgba(255,255,255,0.04)',
                color: s.severity === 'high' ? '#f87171' : s.severity === 'medium' ? '#fbbf24' : '#94a3b8',
                display: 'flex', alignItems: 'flex-start', gap: 4,
              }}>
                <span style={{ flexShrink: 0, fontSize: 8, padding: '1px 3px', borderRadius: 2, background: s.type === 'performance' ? 'rgba(239,68,68,0.15)' : s.type === 'memory' ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.15)', color: s.type === 'performance' ? '#fca5a5' : s.type === 'memory' ? '#fde68a' : '#93c5fd' }}>
                  {s.type === 'performance' ? 'PERF' : s.type === 'memory' ? 'MEM' : 'STRUCT'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.message}>{s.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* R1684: 씬 컴포넌트 통계 */}
        {sceneFile?.root && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => setShowSceneStats(v => !v)}
              style={{ width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3, cursor: 'pointer', background: showSceneStats ? 'rgba(88,166,255,0.1)' : 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >📊 씬 통계</button>
            {showSceneStats && (() => {
              const counts: Record<string, number> = {}
              let total = 0, active = 0
              function walkStats(n: CCSceneNode) {
                total++; if (n.active !== false) active++
                n.components.forEach(c => { counts[c.type] = (counts[c.type] ?? 0) + 1 })
                n.children.forEach(walkStats)
              }
              walkStats(sceneFile.root)
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15)
              const maxCount = sorted[0]?.[1] ?? 1
              const totalComps = Object.values(counts).reduce((s, v) => s + v, 0)
              // R2344: 컴포넌트 타입별 색상 (바 시각화)
              const barColor = (type: string) => {
                if (type.startsWith('cc.Label') || type.startsWith('cc.RichText')) return '#58a6ff'
                if (type.startsWith('cc.Sprite')) return '#4ade80'
                if (type.startsWith('cc.Button') || type.startsWith('cc.Toggle') || type.startsWith('cc.Slider')) return '#fb923c'
                if (type.startsWith('cc.Layout') || type.startsWith('cc.Widget')) return '#a78bfa'
                if (type.startsWith('cc.Animation') || type.startsWith('sp.') || type.startsWith('dragonBones.')) return '#f472b6'
                if (type.startsWith('cc.AudioSource')) return '#facc15'
                if (type.startsWith('cc.ScrollView') || type.startsWith('cc.PageView')) return '#34d399'
                if (type.startsWith('cc.RigidBody') || type.startsWith('cc.BoxCollider') || type.startsWith('cc.CircleCollider')) return '#f87171'
                return '#94a3b8'
              }
              return (
                <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', fontSize: 9 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>노드: <span style={{ color: '#c9d1d9' }}>{total}</span> (활성 {active}) · 컴포넌트 <span style={{ color: '#c9d1d9' }}>{totalComps}</span></span>
                    <span style={{ cursor: 'pointer', color: '#555' }} onClick={() => setShowSceneStats(false)}>✕</span>
                  </div>
                  {sorted.map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: 88, flexShrink: 0 }} title={type}>{type.includes('.') ? type.split('.').pop() : type}</span>
                      {/* R2344: 인라인 바 시각화 */}
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 2, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(count / maxCount * 100)}%`, height: '100%', background: barColor(type), borderRadius: 2, transition: 'width 0.2s' }} />
                      </div>
                      <span style={{ color: barColor(type), flexShrink: 0, width: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* R1454: 씬 일괄 처리 */}
        {sceneFile?.root && (
          <div style={{ marginTop: 4, position: 'relative' }}>
            <button
              onClick={() => setShowBatchMenu(v => !v)}
              style={{
                width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: 'pointer', background: showBatchMenu ? 'rgba(96,165,250,0.15)' : 'none',
                border: '1px solid var(--border)', color: showBatchMenu ? '#93c5fd' : 'var(--text-muted)',
              }}
            >
              {'\uD83D\uDD27'} 일괄 처리
            </button>
            {showBatchMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}>
                <button
                  onClick={handleBatchFontSize}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >모든 Label 폰트 크기 통일</button>
                <button
                  onClick={handleBatchRemoveInactive}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,81,73,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >모든 비활성 노드 삭제</button>
                <button
                  onClick={handleBatchNormalizeName}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >모든 노드 이름 정규화</button>
              </div>
            )}
            {batchToast && (
              <div style={{
                position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
                padding: '3px 10px', borderRadius: 4, background: 'rgba(96,165,250,0.9)',
                color: '#fff', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                pointerEvents: 'none', zIndex: 999,
              }}>{batchToast}</div>
            )}
          </div>
        )}

        {/* R1448: 씬 의존성 분석 */}
        {sceneFile?.root && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={handleAnalyzeDeps}
              disabled={depsLoading}
              style={{
                width: '100%', padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: depsLoading ? 'wait' : 'pointer', background: 'none',
                border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >
              {depsLoading ? '분석 중...' : '\uD83D\uDCE6 의존성 분석'}
            </button>
            {showDepsAnalysis && (
              <div style={{ marginTop: 4, maxHeight: 200, overflowY: 'auto', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{depsEntries.length} 에셋 참조 ({depsEntries.filter(d => d.missing).length} 누락)</span>
                  <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowDepsAnalysis(false)}>x</span>
                </div>
                {(() => {
                  // R1448: 타입별 그룹화
                  const TYPE_LABELS: Record<string, string> = { image: '\uD83D\uDDBC 이미지', font: '\uD83D\uDD24 폰트', audio: '\uD83D\uDD0A 오디오', script: '\uD83D\uDCDC 스크립트', unknown: '\u2753 기타' }
                  const groups: Record<string, DepEntry[]> = {}
                  for (const d of depsEntries) {
                    const group = d.missing ? 'missing' : (d.type in TYPE_LABELS ? d.type : 'unknown')
                    if (!groups[group]) groups[group] = []
                    groups[group].push(d)
                  }
                  return (
                    <>
                      {groups['missing'] && groups['missing'].length > 0 && (
                        <div>
                          <div style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, color: '#f87171', background: 'rgba(248,81,73,0.1)' }}>
                            {'\u274C'} 누락 ({groups['missing'].length})
                          </div>
                          {groups['missing'].map(d => (
                            <div key={d.uuid} style={{ padding: '2px 8px', fontSize: 9, color: '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.uuid}>
                              {d.uuid.slice(0, 12)}...
                            </div>
                          ))}
                        </div>
                      )}
                      {Object.entries(groups).filter(([k]) => k !== 'missing').map(([type, items]) => (
                        <div key={type}>
                          <div style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)' }}>
                            {TYPE_LABELS[type] ?? type} ({items.length})
                          </div>
                          {items.slice(0, 20).map(d => (
                            <div key={d.uuid} style={{ padding: '2px 8px', fontSize: 9, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.path}>
                              {d.path || d.uuid.slice(0, 12)}
                            </div>
                          ))}
                          {items.length > 20 && (
                            <div style={{ padding: '2px 8px', fontSize: 8, color: 'var(--text-muted)' }}>...+{items.length - 20}</div>
                          )}
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )}

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
