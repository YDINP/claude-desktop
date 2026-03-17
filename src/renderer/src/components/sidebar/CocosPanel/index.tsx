import React, { useState } from 'react'
import { useCCFileProject } from '../../../hooks/useCCFileProject'
import type { CCSceneNode } from '@shared/ipc-schema'
import { GroupPanel } from './SceneTree'
import { CCFileAssetBrowser } from './AssetBrowser'
import { BuildTabContent } from './BuildTab'
import { SceneTabContent } from './SceneTab'
import { ProjectHeaderSection } from './ProjectHeader'
import { useCCFileProjectUI } from './useCCFileProjectUI'
import type { CCFileProjectUIProps } from './types'

export function CocosPanel() {
  const fileProject = useCCFileProject()
  const [selectedNode, setSelectedNode] = useState<CCSceneNode | null>(null)
  return (
    <CCFileProjectUI
      fileProject={fileProject}
      selectedNode={selectedNode}
      onSelectNode={setSelectedNode}
    />
  )
}

function CCFileProjectUI(props: CCFileProjectUIProps) {
  const { selectedNode, onSelectNode } = props
  const ctx = useCCFileProjectUI(props)
  const {
    projectInfo, sceneFile, loading, loadScene, saveScene,
    mainTab, setMainTab,
    recentFiles, addRecent, addRecentScene,
    handleSceneChange, handleRenameInView, handleTreeToggleActive,
  } = ctx

  return (
    <div
      style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
      onDrop={e => {
        e.preventDefault(); e.stopPropagation()
        const file = e.dataTransfer.files[0]
        if (!file) return
        const filePath = (file as File & { path?: string }).path
        if (!filePath) return
        if (/\.(fire|scene|prefab)$/i.test(filePath)) { loadScene(filePath); addRecent(filePath); addRecentScene(filePath) }
      }}
    >
      <ProjectHeaderSection ctx={ctx} selectedNode={selectedNode} onSelectNode={onSelectNode} />


      {/* 씬/에셋 탭 바 */}
      {projectInfo?.detected && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['scene', 'groups', 'assets', 'build'] as const).map(t => (
            <button key={t} onClick={() => setMainTab(t)}
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, border: 'none', cursor: 'pointer',
                background: mainTab === t ? 'var(--bg-primary)' : 'transparent',
                color: mainTab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: mainTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: mainTab === t ? 600 : 400,
              }}
            >{t === 'scene' ? '🎬 씬' : t === 'groups' ? '📦 그룹' : t === 'assets' ? '📁 에셋' : '🔨 빌드'}</button>
          ))}
        </div>
      )}


      {/* 씬 파싱 결과 — SceneView + TreeView + Inspector */}
      {mainTab === 'scene' && sceneFile?.root && (
        <SceneTabContent ctx={ctx} selectedNode={selectedNode} onSelectNode={onSelectNode} />
      )}


      {/* 그룹 탭 */}
      {mainTab === 'groups' && sceneFile?.root && (
        <GroupPanel
          root={sceneFile.root}
          selectedNode={selectedNode}
          onSelectNode={onSelectNode}
          onRenameGroup={handleRenameInView}
          onToggleGroupActive={handleTreeToggleActive}
        />
      )}
      {mainTab === 'groups' && !sceneFile?.root && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>씬을 먼저 로드하세요.</div>
      )}

      {/* 에셋 탭 */}
      {mainTab === 'assets' && projectInfo?.detected && (
        projectInfo.assetsDir
          ? <CCFileAssetBrowser assetsDir={projectInfo.assetsDir} sceneFile={sceneFile ?? undefined} saveScene={saveScene} onSelectNode={onSelectNode} />
          : <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>assetsDir를 감지할 수 없습니다.</div>
      )}

      {/* R1406: 빌드 탭 */}
      {mainTab === 'build' && projectInfo?.detected && (
        <BuildTabContent projectInfo={projectInfo} />
      )}
      {mainTab === 'build' && !projectInfo?.detected && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>프로젝트를 먼저 열어주세요.</div>
      )}

      {/* 안내 (프로젝트 미선택) */}
      {!projectInfo?.detected && !loading && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>파일 직접 편집 모드</div>
          <div>CC Extension 없이 .fire / .scene 파일을 직접 파싱·편집합니다.</div>
          <div style={{ marginTop: 6, fontSize: 10 }}>
            • CC 2.x (.fire) / CC 3.x (.scene) 모두 지원<br />
            • 에디터 미실행 상태에서도 씬 트리 조회 가능<br />
            • 저장 시 원본 파일 직접 수정 (자동 백업)
          </div>
          {recentFiles.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>최근 파일</div>
              {recentFiles.map(f => (
                <div
                  key={f}
                  onClick={() => handleSceneChange(f)}
                  title={f}
                  style={{
                    fontSize: 10, padding: '3px 6px', borderRadius: 3, cursor: 'pointer',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--accent)', marginBottom: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {f.split(/[\\/]/).pop()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
