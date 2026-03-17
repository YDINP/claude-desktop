import React, { useState } from 'react'
import type { CCFileProjectUIProps } from './types'

type ProjectInfo = NonNullable<CCFileProjectUIProps['fileProject']['projectInfo']>

const CC_EDITOR_PATHS: Record<string, string> = {
  '2.4.13': 'C:/ProgramData/cocos/editors/Creator/2.4.13/CocosCreator.exe',
  '2.4.5': 'C:/ProgramData/cocos/editors/Creator/2.4.5/CocosCreator.exe',
  '3.6.1': 'C:/ProgramData/cocos/editors/Creator/3.6.1/CocosCreator.exe',
  '3.7.1': 'C:/ProgramData/cocos/editors/Creator/3.7.1/CocosCreator.exe',
  '3.8.2': 'C:/ProgramData/cocos/editors/Creator/3.8.2/CocosCreator.exe',
  '3.8.6': 'C:/ProgramData/cocos/editors/Creator/3.8.6/CocosCreator.exe',
}

interface BuildTabProps {
  projectInfo: ProjectInfo
}

export function BuildTabContent({ projectInfo }: BuildTabProps) {
  const [buildPlatform, setBuildPlatform] = useState<'web-mobile' | 'web-desktop' | 'android' | 'ios'>('web-mobile')
  const [buildRunning, setBuildRunning] = useState(false)
  const [buildResult, setBuildResult] = useState<{ ok: boolean; msg: string } | null>(null)

  return (
    <div style={{ padding: 12, fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.8 }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>CC 빌드 트리거</div>
      {/* 프로젝트 경로 */}
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
        프로젝트: {projectInfo.projectPath ?? '(경로 미감지)'}
      </div>
      {/* CC 버전 */}
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8 }}>
        CC 버전: {projectInfo.version ?? 'auto-detect'}
      </div>
      {/* 플랫폼 선택 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 50, flexShrink: 0 }}>플랫폼</span>
        <select
          value={buildPlatform}
          onChange={e => setBuildPlatform(e.target.value as typeof buildPlatform)}
          style={{
            flex: 1, fontSize: 10, background: 'var(--bg-primary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 3, padding: '3px 6px',
          }}
        >
          <option value="web-mobile">web-mobile</option>
          <option value="web-desktop">web-desktop</option>
          <option value="android">android</option>
          <option value="ios">ios</option>
        </select>
      </div>
      {/* 빌드 경로 */}
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8 }}>
        출력 경로: {projectInfo.projectPath ? projectInfo.projectPath.replace(/\\/g, '/') + '/build/' + buildPlatform : '(미설정)'}
      </div>
      {/* 빌드 버튼 */}
      <button
        disabled={buildRunning || !projectInfo.projectPath}
        onClick={async () => {
          // R2312: window.api.shellExec으로 CocosCreator CLI 빌드 실제 실행 (백그라운드)
          setBuildRunning(true)
          setBuildResult(null)
          const version = projectInfo.version ?? '2.4.13'
          const editorPath = CC_EDITOR_PATHS[version] ?? CC_EDITOR_PATHS['2.4.13']
          const projPath = (projectInfo.projectPath ?? '').replace(/\//g, '\\')
          const editorWinPath = editorPath.replace(/\//g, '\\')
          const isCC3 = version.startsWith('3')
          const flagAndPath = isCC3
            ? `--project "${projPath}" --build "platform=${buildPlatform}"`
            : `--path "${projPath}" --build "platform=${buildPlatform}"`
          // start /B: 백그라운드 실행 (블로킹 없이 즉시 반환)
          const startCmd = `start /B "" "${editorWinPath}" ${flagAndPath}`
          try {
            const res = await window.api.shellExec?.(startCmd)
            setBuildRunning(false)
            if (res && !res.ok && res.output) {
              setBuildResult({ ok: false, msg: res.output.slice(0, 300) })
            } else {
              setBuildResult({ ok: true, msg: `빌드 시작됨 (${buildPlatform}) — CocosCreator가 백그라운드에서 빌드 중입니다.` })
            }
          } catch (e) {
            setBuildRunning(false)
            setBuildResult({ ok: false, msg: String(e) })
          }
        }}
        style={{
          width: '100%', padding: '6px 0', fontSize: 11, fontWeight: 600, cursor: buildRunning ? 'wait' : 'pointer',
          background: buildRunning ? 'var(--border)' : 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 4, opacity: buildRunning ? 0.6 : 1,
        }}
      >
        {buildRunning ? '빌드 중...' : '🔨 빌드 실행'}
      </button>
      {/* 빌드 결과 */}
      {buildResult && (
        <div style={{
          marginTop: 8, padding: '6px 8px', borderRadius: 4, fontSize: 10,
          background: buildResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: buildResult.ok ? 'var(--success)' : 'var(--error)',
          border: `1px solid ${buildResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          {buildResult.ok ? '✅' : '❌'} {buildResult.msg}
        </div>
      )}
      {/* CLI 명령 미리보기 */}
      <div style={{ marginTop: 12, padding: '6px 8px', borderRadius: 4, background: 'var(--bg-primary)', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
        {(() => {
          const version = projectInfo.version ?? '2.4.13'
          const editorPath = CC_EDITOR_PATHS[version] ?? CC_EDITOR_PATHS['2.4.13']
          const projPath = (projectInfo.projectPath ?? '').replace(/\\/g, '/')
          const isCC3 = version.startsWith('3')
          return isCC3
            ? `"${editorPath}" --project "${projPath}" --build "platform=${buildPlatform}"`
            : `"${editorPath}" --path "${projPath}" --build "platform=${buildPlatform}"`
        })()}
      </div>
    </div>
  )
}
