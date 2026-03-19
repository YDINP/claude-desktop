import React, { useState } from 'react'
import { useCCFileProject } from '../../../hooks/useCCFileProject'
import type { CCSceneNode } from '@shared/ipc-schema'
import { SceneTabContent } from './SceneTab'
import { ProjectHeaderSection } from './ProjectHeader'
import { useCCFileProjectUI } from './useCCFileProjectUI'
import type { CCFileProjectUIProps } from './types'
import { CocosMenuBar } from './CocosMenuBar'

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
    projectInfo, sceneFile, loading, loadScene,
    recentFiles, addRecent, addRecentScene,
    handleSceneChange,
  } = ctx

  return (
    <div
      style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
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

      {projectInfo?.detected && <CocosMenuBar ctx={ctx} />}

      {/* 씬 파싱 결과 — SceneView + TreeView + Inspector */}
      {sceneFile?.root && (
        <SceneTabContent ctx={ctx} selectedNode={selectedNode} onSelectNode={onSelectNode} />
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
