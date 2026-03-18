import React, { useState, useRef, useEffect } from 'react'
import type { UseCCFileProjectUIReturn } from './useCCFileProjectUI'
import { BackupManager } from './BackupManager'
import type { CCSceneNode } from '@shared/ipc-schema'
import { validateScene } from '../cocos-utils'
import type { OptimizationSuggestion } from './types'

interface CocosMenuBarProps {
  ctx: UseCCFileProjectUIReturn
}

export function CocosMenuBar({ ctx }: CocosMenuBarProps) {
  const {
    sceneFile, projectInfo, projectSettings, showProjectSettings, setShowProjectSettings,
    recentSceneFiles, sceneThumbnails, loadScene, addRecentScene,
    ccCtxInject, setCcCtxInject,
    showValidationResults, setShowValidationResults,
    validationIssues, setValidationIssues,
    showSceneStats, setShowSceneStats,
    showBatchMenu, setShowBatchMenu,
    showDepsAnalysis, setShowDepsAnalysis,
    depsLoading, depsEntries, handleAnalyzeDeps,
    handleBatchFontSize, handleBatchRemoveInactive, handleBatchNormalizeName,
    batchToast,
    setOptimizationSuggestions, optimizationSuggestions,
    openProject, selectedScene, handleSceneChange,
    setShowNewSceneForm,
    canUndo, canRedo, undoCount, redoCount, undo, redo,
    saving, handleSave, setSaveMsg, saveMsg, handleRestore,
    sceneHistoryTimeline, showFullHistory, setShowFullHistory,
    setShowProjectWizard, setWizardStep, setWizardError,
    isFav, toggleFav,
  } = ctx

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (id: string) => setOpenMenu(v => v === id ? null : id)

  const menuItemStyle: React.CSSProperties = {
    position: 'relative', display: 'inline-flex', alignItems: 'center',
  }
  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', fontSize: 10, cursor: 'pointer', border: 'none',
    background: active ? 'rgba(88,166,255,0.15)' : 'transparent',
    color: active ? '#58a6ff' : 'var(--text-muted)',
    borderRadius: 3, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 3,
  })
  const dropStyle: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, zIndex: 9999,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 4, boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
    minWidth: 220, padding: '4px 0',
  }
  const dropItemStyle = (color?: string): React.CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'left',
    padding: '5px 12px', background: 'none', border: 'none',
    color: color ?? 'var(--text-primary)', cursor: 'pointer', fontSize: 10,
    whiteSpace: 'nowrap',
  })
  const sectionLabel: React.CSSProperties = {
    padding: '4px 12px 2px', fontSize: 9, color: 'var(--text-muted)',
    fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
  }

  if (!projectInfo?.detected) return null

  return (
    <div ref={barRef} style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '2px 6px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>

      {/* -- 파일 -- */}
      <div style={menuItemStyle}>
        <button style={btnStyle(openMenu === 'file')} onClick={() => toggle('file')}>
          {'📁'} 파일 <span style={{ fontSize: 8 }}>{'▾'}</span>
        </button>
        {openMenu === 'file' && (
          <div style={{ ...dropStyle, minWidth: 240 }}>
            {/* 다른 프로젝트 열기 */}
            <button
              style={dropItemStyle()}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              onClick={() => { openProject?.(); setOpenMenu(null) }}
            >📂 다른 프로젝트 열기</button>
            <div style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
            {/* 새 씬 만들기 */}
            <button
              style={dropItemStyle()}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              onClick={() => { setShowNewSceneForm?.(true); setOpenMenu(null) }}
            >✨ 새 씬 만들기</button>
            {/* 씬/프리팹 목록 */}
            {projectInfo?.scenes && projectInfo.scenes.filter((s: string) => !s.endsWith('.prefab')).length > 0 && (
              <>
                <div style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                <div style={sectionLabel}>씬 ({projectInfo.scenes.filter((s: string) => !s.endsWith('.prefab')).length})</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {projectInfo.scenes.filter((s: string) => !s.endsWith('.prefab')).map((s: string) => {
                    const isCurrent = selectedScene === s || sceneFile?.scenePath === s
                    return (
                      <button
                        key={s}
                        style={{ ...dropItemStyle(isCurrent ? '#4ade80' : undefined), display: 'flex', alignItems: 'center', gap: 6 }}
                        title={s}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        onClick={() => { handleSceneChange(s); setOpenMenu(null) }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.split(/[\\/]/).pop()}
                        </span>
                        {isCurrent && <span>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {projectInfo?.scenes && projectInfo.scenes.filter((s: string) => s.endsWith('.prefab')).length > 0 && (
              <>
                <div style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                <div style={sectionLabel}>프리팹 ({projectInfo.scenes.filter((s: string) => s.endsWith('.prefab')).length})</div>
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {projectInfo.scenes.filter((s: string) => s.endsWith('.prefab')).map((s: string) => {
                    const isCurrent = selectedScene === s || sceneFile?.scenePath === s
                    return (
                      <button
                        key={s}
                        style={{ ...dropItemStyle(isCurrent ? '#a78bfa' : '#a78bfa99'), display: 'flex', alignItems: 'center', gap: 6 }}
                        title={s}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        onClick={() => { handleSceneChange(s); setOpenMenu(null) }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.split(/[\\/]/).pop()}
                        </span>
                        {isCurrent && <span>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {/* 저장 섹션 */}
            {sceneFile?.root && (
              <>
                <div style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                <button
                  style={dropItemStyle(saving ? 'var(--text-muted)' : undefined)}
                  disabled={saving}
                  onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'rgba(88,166,255,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                  onClick={() => { handleSave(); setOpenMenu(null) }}
                >💾 저장 {saving ? '(저장 중...)' : ''}</button>
                <button
                  style={dropItemStyle()}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  onClick={async () => {
                    if (!sceneFile?.root) return
                    setOpenMenu(null)
                    const result = await window.api.ccFileSaveAs?.(sceneFile, sceneFile.root)
                    if (result?.success) setSaveMsg?.({ ok: true, text: `저장: ${result.savedPath?.split(/[\\/]/).pop()}` })
                    else if (!result?.canceled) setSaveMsg?.({ ok: false, text: result?.error ?? '저장 실패' })
                  }}
                >💾⬆ 다른 이름으로 저장</button>
                {saveMsg && (
                  <div style={{ padding: '3px 12px', fontSize: 9, color: saveMsg.ok ? '#4ade80' : '#f87171' }}>
                    {saveMsg.text}
                  </div>
                )}
                <div style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                <button
                  style={dropItemStyle(canUndo ? undefined : 'var(--text-muted)')}
                  disabled={!canUndo}
                  onMouseEnter={e => { if (canUndo) e.currentTarget.style.background = 'rgba(88,166,255,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                  onClick={() => { undo(); setOpenMenu(null) }}
                >↩ 실행 취소{undoCount ? ` (${undoCount})` : ''}</button>
                <button
                  style={dropItemStyle(canRedo ? undefined : 'var(--text-muted)')}
                  disabled={!canRedo}
                  onMouseEnter={e => { if (canRedo) e.currentTarget.style.background = 'rgba(88,166,255,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                  onClick={() => { redo(); setOpenMenu(null) }}
                >↪ 다시 실행{redoCount ? ` (${redoCount})` : ''}</button>
                <div style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                <button
                  style={dropItemStyle()}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  onClick={() => { handleRestore(); setOpenMenu(null) }}
                >🔙 .bak 백업 복원</button>
                {sceneFile?.scenePath && (
                  <>
                    <div style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                    <div style={{ padding: '0 4px' }}>
                      <BackupManager scenePath={sceneFile.scenePath} onRestored={() => loadScene(sceneFile.scenePath)} />
                    </div>
                  </>
                )}
                {sceneHistoryTimeline?.length > 0 && (
                  <>
                    <div style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                    <div style={{ padding: '4px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>저장 이력</span>
                        {sceneHistoryTimeline.length > 3 && (
                          <button
                            onClick={() => setShowFullHistory((v: boolean) => !v)}
                            style={{ fontSize: 8, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >{showFullHistory ? '접기' : `더 보기 (${sceneHistoryTimeline.length})`}</button>
                        )}
                      </div>
                      {(showFullHistory ? sceneHistoryTimeline : sceneHistoryTimeline.slice(0, 3)).map((entry: { timestamp: number; nodeCount: number; size: number; snapshotKey?: string }, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, padding: '2px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span style={{ color: 'var(--text-primary)', flexShrink: 0 }}>{entry.nodeCount}N</span>
                          <button
                            disabled={!entry.snapshotKey}
                            onClick={async () => {
                              if (!entry.snapshotKey || !sceneFile?.scenePath) return
                              const snap = localStorage.getItem(entry.snapshotKey)
                              if (!snap) { alert('스냅샷 없음'); return }
                              const timeStr = new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              if (!window.confirm(`${timeStr} 시점으로 복원?`)) return
                              try {
                                const res = await window.api.writeTextFile?.(sceneFile.scenePath, JSON.stringify(JSON.parse(snap), null, 2))
                                if (res && 'error' in res) { alert('복원 실패: ' + res.error); return }
                                loadScene(sceneFile.scenePath)
                                setOpenMenu(null)
                              } catch (e) { alert('오류: ' + String(e)) }
                            }}
                            style={{ marginLeft: 'auto', fontSize: 8, padding: '1px 4px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: entry.snapshotKey ? 'var(--accent)' : 'var(--text-muted)', cursor: entry.snapshotKey ? 'pointer' : 'default', opacity: entry.snapshotKey ? 1 : 0.4 }}
                          >복원</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* -- 씬 -- */}
      {sceneFile?.root && (
        <div style={menuItemStyle}>
          <button style={btnStyle(openMenu === 'scene')} onClick={() => toggle('scene')}>
            {'🎬'} 씬 <span style={{ fontSize: 8 }}>{'▾'}</span>
          </button>
          {openMenu === 'scene' && (
            <div style={dropStyle}>
              <div style={sectionLabel}>씬 분석</div>
              {/* 씬 검사 */}
              <button
                style={dropItemStyle()}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                onClick={() => {
                  const issues = validateScene(sceneFile.root)
                  setValidationIssues(issues)
                  setShowValidationResults(true)
                  // 최적화 제안
                  let totalN = 0, activeN = 0, maxD = 0
                  const compCounts: Record<string, number> = {}
                  function walkSugg(n: CCSceneNode, d: number) {
                    totalN++; if (n.active !== false) activeN++; if (d > maxD) maxD = d
                    for (const c of n.components) compCounts[c.type] = (compCounts[c.type] ?? 0) + 1
                    for (const ch of n.children) walkSugg(ch, d + 1)
                  }
                  walkSugg(sceneFile.root, 0)
                  const sug: OptimizationSuggestion[] = []
                  const dc = ['cc.Label','cc.Sprite','cc.RichText'].reduce((s,t) => s+(compCounts[t]??0), 0)
                  if (dc > 50) sug.push({ type: 'performance', severity: dc > 100 ? 'high' : 'medium', message: `Draw Call ${dc}개 — Sprite Atlas 권장` })
                  if (totalN > 500) sug.push({ type: 'memory', severity: 'medium', message: `노드 ${totalN}개 — 오브젝트 풀링 고려` })
                  if (maxD > 10) sug.push({ type: 'structure', severity: 'medium', message: `계층 깊이 ${maxD} — 구조 단순화 권장` })
                  setOptimizationSuggestions(sug)
                }}
              >{'🔍'} 씬 검사</button>
              {/* 씬 통계 */}
              <button
                style={dropItemStyle()}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                onClick={() => setShowSceneStats((v: boolean) => !v)}
              >{'📊'} 씬 통계 {showSceneStats ? '✓' : ''}</button>
            </div>
          )}
        </div>
      )}

      {/* -- 도구 -- */}
      {sceneFile?.root && (
        <div style={menuItemStyle}>
          <button style={btnStyle(openMenu === 'tools')} onClick={() => toggle('tools')}>
            {'🔧'} 도구 <span style={{ fontSize: 8 }}>{'▾'}</span>
          </button>
          {openMenu === 'tools' && (
            <div style={dropStyle}>
              <div style={sectionLabel}>일괄 처리</div>
              <button style={dropItemStyle()} onMouseEnter={e => (e.currentTarget.style.background='rgba(88,166,255,0.1)')} onMouseLeave={e => (e.currentTarget.style.background='')} onClick={handleBatchFontSize}>
                모든 Label 폰트 크기 통일
              </button>
              <button style={dropItemStyle('#f87171')} onMouseEnter={e => (e.currentTarget.style.background='rgba(248,81,73,0.1)')} onMouseLeave={e => (e.currentTarget.style.background='')} onClick={handleBatchRemoveInactive}>
                모든 비활성 노드 삭제
              </button>
              <button style={dropItemStyle()} onMouseEnter={e => (e.currentTarget.style.background='rgba(88,166,255,0.1)')} onMouseLeave={e => (e.currentTarget.style.background='')} onClick={handleBatchNormalizeName}>
                모든 노드 이름 정규화
              </button>
              <div style={{ margin: '4px 0', borderTop: '1px solid var(--border)' }} />
              <div style={sectionLabel}>의존성</div>
              <button
                style={dropItemStyle(depsLoading ? 'var(--text-muted)' : undefined)}
                disabled={depsLoading}
                onMouseEnter={e => { if (!depsLoading) (e.currentTarget.style.background='rgba(88,166,255,0.1)') }}
                onMouseLeave={e => (e.currentTarget.style.background='')}
                onClick={handleAnalyzeDeps}
              >
                {depsLoading ? '분석 중...' : '📦 의존성 분석'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* -- 최근 씬 -- */}
      {recentSceneFiles?.length > 0 && (
        <div style={menuItemStyle}>
          <button style={btnStyle(openMenu === 'recent')} onClick={() => toggle('recent')}>
            {'📂'} 최근 씬 <span style={{ fontSize: 8 }}>{'▾'}</span>
          </button>
          {openMenu === 'recent' && (
            <div style={{ ...dropStyle, minWidth: 260, maxHeight: 320, overflowY: 'auto' }}>
              <div style={sectionLabel}>최근 씬 ({recentSceneFiles.length})</div>
              {recentSceneFiles.map((p: string) => {
                const isCurrent = sceneFile?.scenePath === p
                const thumbKey = p.replace(/[\\/]/g, '_')
                const thumb = sceneThumbnails?.[thumbKey]
                const name = p.split(/[\\/]/).pop() ?? p
                return (
                  <button
                    key={p}
                    onClick={() => { loadScene(p); addRecentScene?.(p); setOpenMenu(null) }}
                    style={{
                      ...dropItemStyle(isCurrent ? '#4ade80' : undefined),
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                    title={p}
                    onMouseEnter={e => (e.currentTarget.style.background='rgba(88,166,255,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background='')}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: 28, height: 20, borderRadius: 2, flexShrink: 0, objectFit: 'cover', border: '1px solid var(--border)' }} />
                    ) : (
                      <span style={{ fontSize: 12, flexShrink: 0, width: 28, textAlign: 'center' }}>{'📄'}</span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</span>
                    {isCurrent && <span style={{ fontSize: 10, flexShrink: 0 }}>{'✓'}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* -- Claude -- */}
      {sceneFile && (
        <div style={menuItemStyle}>
          <button style={btnStyle(openMenu === 'claude')} onClick={() => toggle('claude')}>
            {'🤖'} Claude <span style={{ fontSize: 8 }}>{'▾'}</span>
          </button>
          {openMenu === 'claude' && (
            <div style={{ ...dropStyle, minWidth: 260, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Claude 컨텍스트 주입</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
                씬을 저장하거나 노드를 선택할 때 현재 씬 구조, 선택 노드 정보, 컴포넌트 목록을 Claude 대화 컨텍스트에 자동으로 주입합니다.
                이를 통해 Claude가 현재 씬 상태를 기반으로 도움을 제공할 수 있습니다.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: ccCtxInject ? '#4ade80' : 'var(--text-muted)', flex: 1 }}>
                  {ccCtxInject ? '활성화됨' : '비활성화됨'}
                </span>
                <button
                  onClick={() => { const v = !ccCtxInject; setCcCtxInject(v); localStorage.setItem('cc-ctx-inject', String(v)) }}
                  style={{
                    padding: '3px 10px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
                    background: ccCtxInject ? 'rgba(74,222,128,0.15)' : 'rgba(88,166,255,0.15)',
                    border: `1px solid ${ccCtxInject ? 'rgba(74,222,128,0.4)' : 'rgba(88,166,255,0.4)'}`,
                    color: ccCtxInject ? '#4ade80' : '#58a6ff',
                  }}
                >
                  {ccCtxInject ? 'OFF' : 'ON'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -- 프로젝트 -- */}
      <div style={menuItemStyle}>
        <button style={btnStyle(openMenu === 'project')} onClick={() => toggle('project')}>
          {'⚙'} 프로젝트 <span style={{ fontSize: 8 }}>{'▾'}</span>
        </button>
        {openMenu === 'project' && (
          <div style={{ ...dropStyle, minWidth: 280, padding: '8px 12px' }}>
            {/* 프로젝트 정보 */}
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>
              {projectInfo.name ?? '프로젝트'}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 8 }}>
              <div>
                <span style={{ color: '#888' }}>CC 버전</span>{' '}
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {projectInfo.version} ({projectInfo.creatorVersion})
                </span>
              </div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={projectInfo.projectPath}>
                <span style={{ color: '#888' }}>경로</span>{' '}
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 8 }}>
                  {projectInfo.projectPath}
                </span>
              </div>
              <div>
                <span style={{ color: '#888' }}>씬</span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>
                  {projectInfo.scenes?.filter((s: string) => !s.endsWith('.prefab')).length ?? 0}개
                </span>
                {(projectInfo.scenes?.filter((s: string) => s.endsWith('.prefab')).length ?? 0) > 0 && (
                  <span style={{ marginLeft: 8 }}>
                    <span style={{ color: '#888' }}>프리팹</span>{' '}
                    <span style={{ color: 'var(--text-primary)' }}>
                      {projectInfo.scenes?.filter((s: string) => s.endsWith('.prefab')).length}개
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* 프로젝트 설정 */}
            {projectSettings && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginBottom: 6, fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
                  프로젝트 설정
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#888', width: 64, flexShrink: 0 }}>디자인 해상도</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {projectSettings.designWidth} x {projectSettings.designHeight}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#888', width: 64, flexShrink: 0 }}>물리 엔진</span>
                    <span style={{ color: projectSettings.physicsEngine === 'none' ? 'var(--text-muted)' : 'var(--accent)', fontFamily: 'monospace' }}>
                      {projectSettings.physicsEngine || 'none'}
                    </span>
                  </div>
                  {projectSettings.buildTargets && projectSettings.buildTargets.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: '#888', width: 64, flexShrink: 0 }}>빌드 타겟</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {projectSettings.buildTargets.map((t: string) => (
                          <span key={t} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 8, background: 'rgba(96,165,250,0.15)', color: 'var(--accent)' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <div style={{ margin: '6px 0 2px', borderTop: '1px solid var(--border)' }} />
            <button
              style={dropItemStyle()}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              onClick={() => { setShowProjectWizard?.(true); setWizardStep?.(1); setWizardError?.(null); setOpenMenu(null) }}
            >🆕 새 프로젝트 만들기</button>
            <button
              style={dropItemStyle(isFav ? '#fbbf24' : undefined)}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              onClick={() => { toggleFav?.(); setOpenMenu(null) }}
            >{isFav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가'}</button>
          </div>
        )}
      </div>

    </div>
  )
}
