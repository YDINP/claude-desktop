import React from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import type { UseCCFileProjectUIReturn } from './useCCFileProjectUI'
import { ProjectToolbarSection } from './ProjectToolbar'

interface ProjectHeaderProps {
  ctx: UseCCFileProjectUIReturn
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
}

export function ProjectHeaderSection({ ctx, selectedNode, onSelectNode }: ProjectHeaderProps) {
  const {
    projectInfo, sceneFile, loading, error, externalChange,
    conflictInfo, openProject, detectProject, loadScene, forceOverwrite,
    favProjects, isFav, toggleFav,
    showProjectSettings, setShowProjectSettings, projectSettings,
    bannerHidden, setBannerHidden,
    autoReload, setAutoReload,
    showNewSceneForm, setShowNewSceneForm,
    newSceneName, setNewSceneName,
    newSceneTemplate, setNewSceneTemplate,
    handleCreateScene,
    showProjectWizard, setShowProjectWizard,
    wizardStep, setWizardStep,
    wizardProjectName, setWizardProjectName,
    wizardSavePath, setWizardSavePath,
    wizardCCVersion, setWizardCCVersion,
    wizardTemplate, setWizardTemplate,
    wizardCreating, wizardError, setWizardError,
    handleCreateProject,
    globalSearchOpen, setGlobalSearchOpen,
    globalSearchQuery, setGlobalSearchQuery,
    globalSearchResults, setGlobalSearchResults,
    globalSearchInputRef,
    globalSearchCompFilter, setGlobalSearchCompFilter,
    filteredGlobalResults, runGlobalSearch,
    expandToNode, multiSelectedUuids, setMultiSelectedUuids,
  } = ctx

  return (
    <>
      {/* R1430: 전역 노드 검색 오버레이 */}
      {globalSearchOpen && (
        <div style={{
          position: 'relative', zIndex: 50, borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary, #0d0d1a)', padding: '4px 8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, flexShrink: 0 }}>🔍</span>
            <input
              ref={globalSearchInputRef}
              value={globalSearchQuery}
              onChange={e => runGlobalSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setGlobalSearchOpen(false); setGlobalSearchQuery(''); setGlobalSearchResults([]) }
              }}
              placeholder="노드 이름 / 컴포넌트 / UUID(#) / 텍스트(text:) 검색... (Esc 닫기)"
              style={{
                flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', borderRadius: 3, padding: '3px 6px', fontSize: 10, boxSizing: 'border-box',
              }}
            />
            <span
              onClick={() => { setGlobalSearchOpen(false); setGlobalSearchQuery(''); setGlobalSearchResults([]) }}
              style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}
            >x</span>
          </div>
          {globalSearchResults.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {/* R1734: 컴포넌트 타입 필터 */}
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                {['', 'cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Layout', 'cc.ScrollView'].map(ct => (
                  <span
                    key={ct || 'all'}
                    onClick={() => setGlobalSearchCompFilter(ct)}
                    style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${globalSearchCompFilter === ct ? '#58a6ff' : 'var(--border)'}`, background: globalSearchCompFilter === ct ? 'rgba(88,166,255,0.15)' : 'transparent', color: globalSearchCompFilter === ct ? '#58a6ff' : 'var(--text-muted)', userSelect: 'none' }}
                  >{ct ? ct.replace('cc.', '') : '전체'}</span>
                ))}
              </div>
              {/* R1719: 검색 결과 "모두 선택" 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{filteredGlobalResults.length}개 결과{globalSearchCompFilter ? ` (${globalSearchCompFilter.replace('cc.', '')} 필터)` : ''}</span>
                <span
                  title="검색 결과 노드 모두 선택 (다중 선택)"
                  onClick={() => {
                    const uuids = filteredGlobalResults.map(r => r.node.uuid)
                    if (uuids.length > 0) {
                      onSelectNode(filteredGlobalResults[0].node)
                      setMultiSelectedUuids(uuids)
                    }
                  }}
                  style={{ fontSize: 9, cursor: 'pointer', color: '#58a6ff', padding: '1px 5px', border: '1px solid rgba(88,166,255,0.4)', borderRadius: 3 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >모두 선택</span>
              </div>
            <div style={{
              maxHeight: 200, overflowY: 'auto',
              borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)',
            }}>
              {filteredGlobalResults.map(({ node: n, path }) => (
                <div
                  key={n.uuid}
                  onClick={() => {
                    onSelectNode(n)
                    // R2455: 계층 트리 자동 펼치기 (reveal in hierarchy)
                    expandToNode(n.uuid)
                    // R1481: SceneView 자동 포커스
                    window.dispatchEvent(new CustomEvent('cc-focus-node', { detail: { uuid: n.uuid } }))
                    setGlobalSearchOpen(false)
                    setGlobalSearchQuery('')
                    setGlobalSearchResults([])
                  }}
                  style={{
                    padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text-primary)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span style={{ fontSize: 10, flexShrink: 0 }}>
                    {n.components.length > 0 ? n.components[0].type.replace('cc.', '')[0] : '□'}
                  </span>
                  <span style={{ fontWeight: 500, flexShrink: 0 }}>{n.name || '(unnamed)'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {path}
                  </span>
                  {n.components.length > 0 && (
                    <span style={{ fontSize: 8, color: 'var(--accent)', flexShrink: 0 }}>
                      {n.components.map(c => c.type.replace('cc.', '')).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
            </div>
          )}
          {globalSearchQuery && globalSearchResults.length === 0 && (
            <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-muted)', padding: '2px 4px' }}>
              검색 결과 없음
            </div>
          )}
        </div>
      )}

      {/* 외부 파일 변경 감지 배너 (R1389: 5초 자동 숨김 / R2458: 자동 리로드 토글) */}
      {externalChange && sceneFile && !bannerHidden && (
        <div style={{
          padding: '5px 10px', background: '#2d1a00', borderBottom: '1px solid #ff9944',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#ff9944', flex: 1 }}>
            파일이 외부에서 수정됨
          </span>
          <label style={{ fontSize: 9, color: '#ff9944', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={autoReload} onChange={e => {
              const v = e.target.checked
              setAutoReload(v)
              try { localStorage.setItem('cc-auto-reload', String(v)) } catch {}
            }} style={{ cursor: 'pointer' }} />
            자동
          </label>
          <button
            onClick={() => loadScene(sceneFile.scenePath)}
            style={{
              padding: '2px 6px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
              background: '#ff9944', color: '#000', border: 'none',
            }}
          >
            다시 로드
          </button>
          <button
            onClick={() => setBannerHidden(true)}
            style={{
              padding: '0 4px', fontSize: 11, borderRadius: 2, cursor: 'pointer',
              background: 'none', color: '#ff9944', border: 'none', lineHeight: 1,
            }}
            title="닫기"
          >
            x
          </button>
        </div>
      )}

      {/* R1437: 충돌 감지 다이얼로그 */}
      {conflictInfo && (
        <div style={{
          padding: '6px 10px', background: '#2d0a0a', borderBottom: '1px solid #ef4444',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#ef4444', flex: 1 }}>
            파일이 외부에서 변경됨. 덮어쓸까요?
          </span>
          <button
            onClick={() => forceOverwrite()}
            style={{
              padding: '2px 6px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
              background: '#ef4444', color: '#fff', border: 'none',
            }}
          >
            덮어쓰기
          </button>
          <button
            onClick={() => sceneFile && loadScene(sceneFile.scenePath)}
            style={{
              padding: '2px 6px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
              background: 'none', color: '#ef4444', border: '1px solid #ef4444',
            }}
          >
            다시 로드
          </button>
        </div>
      )}

      {/* 프로젝트 열기 섹션 */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <button
            onClick={openProject}
            disabled={loading}
            style={{
              flex: 1, padding: '4px 8px', background: 'var(--accent)', color: '#fff',
              borderRadius: 4, fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '로드 중...' : projectInfo?.detected ? '📂 다른 프로젝트 열기' : '📂 CC 프로젝트 열기'}
          </button>
          {/* R2317/ISSUE-011: 즐겨찾기 토글 버튼 */}
          <button
            title={isFav ? '즐겨찾기 해제' : (projectInfo?.projectPath ? '즐겨찾기 추가' : '')}
            onClick={() => { if (projectInfo?.projectPath) toggleFav() }}
            disabled={!projectInfo?.projectPath}
            style={{ padding: '4px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, cursor: projectInfo?.projectPath ? 'pointer' : 'default', color: isFav ? '#fbbf24' : 'var(--text-muted)', opacity: projectInfo?.projectPath ? 1 : 0.4 }}
          >{isFav ? '★' : '☆'}</button>
          {/* R1461: 새 프로젝트 생성 마법사 */}
          <button
            onClick={() => { setShowProjectWizard(true); setWizardStep(1); setWizardError(null) }}
            style={{
              padding: '4px 8px', background: 'rgba(96,165,250,0.12)', color: 'var(--accent)',
              border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, fontSize: 10,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {'🆕'} 새 프로젝트
          </button>
        </div>

        {/* ISSUE-011: 즐겨찾기 프로젝트 탭 바 — 클릭 시 해당 프로젝트 전환 + 마지막 씬 자동 로드 */}
        {favProjects.length > 0 && (
          <div style={{ display: 'flex', gap: 0, marginTop: 6, marginBottom: 4, overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            {favProjects.map(path => {
              const isActive = projectInfo?.projectPath === path
              const label = path.split(/[\\/]/).pop() ?? path
              return (
                <button key={path}
                  onClick={() => { if (!isActive) detectProject?.(path) }}
                  title={path}
                  style={{
                    padding: '4px 10px', fontSize: 10, border: 'none', cursor: isActive ? 'default' : 'pointer',
                    background: isActive ? 'var(--bg-primary)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'color 0.15s, border-bottom 0.15s',
                  }}
                >{label}</button>
              )
            })}
          </div>
        )}

        {/* 감지된 프로젝트 정보 */}
        {projectInfo?.detected && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>
              {projectInfo.name}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                CC {projectInfo.version} ({projectInfo.creatorVersion})
              </span>
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={projectInfo.projectPath}>
              {projectInfo.projectPath}
            </div>
            <div style={{ marginTop: 2 }}>
              씬 파일: <strong>{(projectInfo.scenes?.filter(s => !s.endsWith('.prefab'))?.length ?? 0)}개</strong>
              {(projectInfo.scenes?.filter(s => s.endsWith('.prefab'))?.length ?? 0) > 0 && (
                <span style={{ marginLeft: 6 }}>프리팹: <strong>{projectInfo.scenes?.filter(s => s.endsWith('.prefab'))?.length}개</strong></span>
              )}
            </div>
          </div>
        )}

        {/* R1390: 프로젝트 설정 뷰어 */}
        {projectInfo?.detected && (
          <div style={{ marginTop: 6 }}>
            <div
              onClick={() => setShowProjectSettings(v => !v)}
              style={{
                fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 0', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 9, transform: showProjectSettings ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>{'>'}</span>
              <span>{'⚙'} 프로젝트 설정</span>
            </div>
            {showProjectSettings && projectSettings && (
              <div style={{
                fontSize: 9, color: 'var(--text-muted)', padding: '4px 6px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 4, marginTop: 2,
                border: '1px solid var(--border)', lineHeight: 1.8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 64, flexShrink: 0 }}>디자인 해상도</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
                    {projectSettings.designWidth} x {projectSettings.designHeight}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 64, flexShrink: 0 }}>물리 엔진</span>
                  <span style={{
                    color: projectSettings.physicsEngine === 'none' ? 'var(--text-muted)' : 'var(--accent)',
                    fontFamily: 'monospace',
                  }}>
                    {projectSettings.physicsEngine || 'none'}
                  </span>
                </div>
                {projectSettings.buildTargets && projectSettings.buildTargets.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <span style={{ width: 64, flexShrink: 0 }}>빌드 타겟</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {projectSettings.buildTargets.map(t => (
                        <span key={t} style={{
                          fontSize: 8, padding: '1px 5px', borderRadius: 8,
                          background: 'rgba(96,165,250,0.15)', color: 'var(--accent)',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 64, flexShrink: 0 }}>CC 버전</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {projectInfo.version} ({projectInfo.creatorVersion})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* R1459: 씬 메타데이터 표시 */}
        {sceneFile && (() => {
          const meta = sceneFile._sceneMeta as { version?: string; canvasSize?: { width: number; height: number }; nodeCount?: number; scriptUuids?: string[]; textureUuids?: string[]; audioUuids?: string[]; hasPhysics?: boolean; hasTween?: boolean; hasAnimation?: boolean } | undefined
          if (!meta) return null
          return (
            <div style={{
              fontSize: 9, color: 'var(--text-muted)', padding: '4px 6px', marginTop: 4,
              background: 'rgba(255,255,255,0.03)', borderRadius: 4,
              border: '1px solid var(--border)', lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-primary)', marginBottom: 2 }}>{'📊'} 씬 메타</div>
              <div>노드: <b>{meta.nodeCount ?? 0}</b></div>
              <div>캔버스: {meta.canvasSize?.width}x{meta.canvasSize?.height}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {meta.hasPhysics && <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Physics</span>}
                {meta.hasAnimation && <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 8, background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>Animation</span>}
                {meta.hasTween && <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 8, background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Tween</span>}
              </div>
              {(meta.scriptUuids?.length ?? 0) > 0 && <div>스크립트: {meta.scriptUuids?.length}개</div>}
              {(meta.textureUuids?.length ?? 0) > 0 && <div>텍스처: {meta.textureUuids?.length}개</div>}
              {(meta.audioUuids?.length ?? 0) > 0 && <div>오디오: {meta.audioUuids?.length}개</div>}
            </div>
          )
        })()}

        {/* R1394: 새 씬 만들기 버튼 + 인라인 폼 */}
        {projectInfo?.detected && (
          <div style={{ marginTop: 6 }}>
            {!showNewSceneForm ? (
              <button
                onClick={() => setShowNewSceneForm(true)}
                style={{
                  padding: '3px 8px', fontSize: 10, cursor: 'pointer',
                  background: 'rgba(96,165,250,0.12)', color: 'var(--accent)',
                  border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 12, lineHeight: 1 }}>+</span> 새 씬 만들기
              </button>
            ) : (
              <div style={{
                padding: '6px 8px', background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)', borderRadius: 4,
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <input
                  value={newSceneName}
                  onChange={e => setNewSceneName(e.target.value)}
                  placeholder="씬 이름"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateScene(); if (e.key === 'Escape') setShowNewSceneForm(false) }}
                  autoFocus
                  style={{
                    padding: '3px 6px', fontSize: 10,
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 3,
                  }}
                />
                <div style={{ display: 'flex', gap: 4, fontSize: 9 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <input type="radio" name="scnTpl" checked={newSceneTemplate === 'empty'} onChange={() => setNewSceneTemplate('empty')} style={{ margin: 0 }} />
                    빈 씬
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <input type="radio" name="scnTpl" checked={newSceneTemplate === 'canvas'} onChange={() => setNewSceneTemplate('canvas')} style={{ margin: 0 }} />
                    Canvas 포함
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={handleCreateScene}
                    disabled={!newSceneName.trim()}
                    style={{
                      flex: 1, padding: '3px 6px', fontSize: 10, cursor: 'pointer',
                      background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 3,
                      opacity: newSceneName.trim() ? 1 : 0.5,
                    }}
                  >생성</button>
                  <button
                    onClick={() => setShowNewSceneForm(false)}
                    style={{
                      padding: '3px 6px', fontSize: 10, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: 3,
                    }}
                  >취소</button>
                </div>
              </div>
            )}
          </div>
        )}

        <ProjectToolbarSection ctx={ctx} />
      </div>
    </>
  )
}
