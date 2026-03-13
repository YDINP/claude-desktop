import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { SceneTreePanel } from './SceneTreePanel'
import { NodePropertyPanel } from './NodePropertyPanel'
import { AssetBrowserPanel } from './AssetBrowserPanel'
import { useProject } from '../../stores/project-store'
import { useCCFileProject } from '../../hooks/useCCFileProject'
import { CCFileSceneView } from './SceneView/CCFileSceneView'
import type { CCNode, CCSceneNode, CCSceneFile } from '../../../../shared/ipc-schema'

export function CocosPanel({ defaultPort, onPortChange, onConnectedChange }: {
  defaultPort?: number
  onPortChange?: (port: number) => void
  onConnectedChange?: (connected: boolean) => void
} = {}) {
  const { currentPath } = useProject()
  const [mode, setMode] = useState<'ws' | 'file'>('ws')
  const fileProject = useCCFileProject()
  const [selectedFileNode, setSelectedFileNode] = useState<CCSceneNode | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [port, setPort] = useState(defaultPort ?? 9090)
  const [selectedNode, setSelectedNode] = useState<CCNode | null>(null)
  const [showAssets, setShowAssets] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedProject, setDetectedProject] = useState<{ name: string; version: string; creatorVersion?: string } | null>(null)
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null)
  const [pathCopied, setPathCopied] = useState(false)
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [uptime, setUptime] = useState<string>('')
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const portRef = useRef(port)
  portRef.current = port

  // 포트 로드 (마운트 시) — defaultPort 우선, 없으면 저장값
  useEffect(() => {
    if (defaultPort) { setPort(defaultPort); return }
    window.api.ccGetPort?.().then(p => { if (p) setPort(p) }).catch(() => {})
  }, [])

  // 프로젝트 자동 감지
  useEffect(() => {
    if (!currentPath) return
    window.api.ccDetectProject?.(currentPath).then(info => {
      if (info?.detected && info.version && info.port) {
        setDetectedProject({ name: info.name || 'CC Project', version: info.version, creatorVersion: info.creatorVersion })
        setPort(info.port)
        onPortChange?.(info.port)
        window.api.ccSetPort?.(info.port).catch(() => {})
      }
    }).catch(() => {})
  }, [currentPath])

  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setReconnectCountdown(3)
    countdownRef.current = setInterval(() => {
      setReconnectCountdown(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(countdownRef.current!)
          countdownRef.current = null
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleConnect = useCallback(async () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setReconnectCountdown(null)
    setConnecting(true)
    setError(null)
    const currentPort = portRef.current
    try {
      const ok = await window.api.ccConnect?.(currentPort)
      setConnected(!!ok)
      if (mountedRef.current) onConnectedChange?.(!!ok)
      if (ok) {
        setConnectedAt(Date.now())
        window.api.ccSetPort?.(currentPort).catch(() => {})
        onPortChange?.(currentPort)
      } else {
        setError('CC Extension에 연결할 수 없습니다. Extension이 실행 중인지 확인하세요.')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    handleConnect()
    const unsub = window.api.onCCEvent?.((event) => {
      if (cancelled) return
      if ((event as any)._ccPort !== undefined && (event as any)._ccPort !== portRef.current) return
      if (event.type === 'node:select' && event.uuids?.[0]) {
        window.api.ccGetNode?.(portRef.current, event.uuids[0]).then(n => { if (!cancelled) setSelectedNode(n) }).catch(() => {})
      }
      // node:deselect — 마지막 선택 노드를 유지 (패널을 지우지 않음)
    })
    const unsubStatus = window.api.onCCStatusChange?.((s) => {
      if (cancelled) return
      if (s.port !== undefined && s.port !== portRef.current) return
      setConnected(s.connected)
      if (s.connected) setConnectedAt(Date.now())
      else setConnectedAt(null)
      if (!cancelled) onConnectedChange?.(s.connected)
      if (!s.connected) startCountdown()
    })
    return () => {
      cancelled = true
      if (countdownRef.current) clearInterval(countdownRef.current)
      unsub?.()
      unsubStatus?.()
    }
  }, [])

  // 연결 유지 시간 업데이트
  useEffect(() => {
    if (!connected || !connectedAt) { setUptime(''); return }
    const update = () => {
      const sec = Math.floor((Date.now() - connectedAt) / 1000)
      if (sec < 60) setUptime(`${sec}s`)
      else if (sec < 3600) setUptime(`${Math.floor(sec / 60)}m`)
      else setUptime(`${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`)
    }
    update()
    const t = setInterval(update, 10000)
    return () => clearInterval(t)
  }, [connected, connectedAt])

  const extName = detectedProject?.version === '3x' ? 'cc-ws-extension-3x' : 'cc-ws-extension-2x'
  const extPort = detectedProject?.version === '3x' ? 9091 : 9090
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [opening, setOpening] = useState(false)

  const handleOpenEditor = useCallback(async () => {
    if (!currentPath || !detectedProject) return
    setOpening(true)
    try {
      await window.api.ccOpenEditor?.(currentPath, detectedProject.version, detectedProject.creatorVersion)
    } finally {
      setOpening(false)
    }
  }, [currentPath, detectedProject])

  const handleInstall = useCallback(async () => {
    if (!currentPath || !detectedProject) return
    setInstalling(true)
    setInstallMsg(null)
    try {
      const result = await window.api.ccInstallExtension?.(currentPath, detectedProject.version)
      setInstallMsg({ ok: !!result?.success, text: result?.message ?? '알 수 없는 오류' })
    } catch (e) {
      setInstallMsg({ ok: false, text: String(e) })
    } finally {
      setInstalling(false)
    }
  }, [currentPath, detectedProject])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* 헤더 */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🎮 Cocos Creator</span>
          {/* 모드 토글 */}
          {(['ws', 'file'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              title={m === 'ws' ? 'WS Extension 연결 모드' : '파일 직접 편집 모드 (Extension 불필요)'}
              style={{
                padding: '1px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: mode === m ? 'var(--accent)' : 'none',
                color: mode === m ? '#fff' : 'var(--text-muted)',
              }}>
              {m === 'ws' ? 'WS' : '파일'}
            </button>
          ))}
          {mode === 'ws' && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 10,
              background: connected ? 'rgba(63,185,80,0.15)' : reconnectCountdown !== null ? 'rgba(255,165,0,0.15)' : 'rgba(248,81,73,0.15)',
              color: connected ? 'var(--success, #3fb950)' : reconnectCountdown !== null ? '#ffa500' : 'var(--error, #f85149)',
            }}>
              {connected ? `연결됨${uptime ? ` ${uptime}` : ''}` : reconnectCountdown !== null ? `재연결 ${reconnectCountdown}s` : '연결 안됨'}
            </span>
          )}
          {detectedProject && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {detectedProject.creatorVersion ?? detectedProject.version}
            </span>
          )}
          {detectedProject && currentPath && (
            <>
              <button
                onClick={handleOpenEditor}
                disabled={opening}
                title="Cocos Creator 열기"
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 4,
                  color: 'var(--text-muted)', fontSize: 10, padding: '1px 5px', cursor: opening ? 'not-allowed' : 'pointer',
                  opacity: opening ? 0.5 : 1,
                }}
              >
                {opening ? '...' : '▶ CC 열기'}
              </button>
              <button
                onClick={handleInstall}
                disabled={installing}
                title="Extension 업데이트 (재설치)"
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 4,
                  color: 'var(--text-muted)', fontSize: 10, padding: '1px 5px', cursor: installing ? 'not-allowed' : 'pointer',
                  opacity: installing ? 0.5 : 1,
                }}
              >
                {installing ? '...' : '↺ 업데이트'}
              </button>
            </>
          )}
        </div>
        {detectedProject && (
          <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={currentPath ?? ''}>
              📁 {detectedProject.name}
            </span>
            {currentPath && (
              <button
                onClick={() => { navigator.clipboard.writeText(currentPath).then(() => { setPathCopied(true); setTimeout(() => setPathCopied(false), 1500) }) }}
                title="프로젝트 경로 복사"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '0 2px', color: pathCopied ? '#4caf50' : 'var(--text-muted)', flexShrink: 0 }}
              >{pathCopied ? '✓' : '📋'}</button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="number"
            value={port}
            onChange={e => setPort(Number(e.target.value))}
            style={{
              width: 70, background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 11,
            }}
            placeholder="포트"
          />
          {([9090, 9091] as const).map(p => (
            <button key={p} onClick={() => setPort(p)} title={p === 9090 ? 'CC 2.x' : 'CC 3.x'}
              style={{ padding: '2px 4px', fontSize: 9, borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: port === p ? 'var(--accent)' : 'none', color: port === p ? '#fff' : 'var(--text-muted)', flexShrink: 0 }}>
              {p}
            </button>
          ))}
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{
              flex: 1, padding: '3px 0', background: 'var(--accent)', color: '#fff',
              borderRadius: 4, fontSize: 11, cursor: connecting ? 'not-allowed' : 'pointer',
              opacity: connecting ? 0.7 : 1,
            }}
          >
            {connecting ? '연결 중...' : connected ? '재연결' : reconnectCountdown !== null ? '지금 재연결' : '연결'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--error, #f85149)', lineHeight: 1.4 }}>
            {error}
          </div>
        )}
      </div>

      {/* 파일 직접 편집 모드 */}
      {mode === 'file' && (
        <CCFileProjectUI
          fileProject={fileProject}
          selectedNode={selectedFileNode}
          onSelectNode={setSelectedFileNode}
        />
      )}

      {/* WS 연결 모드 본문 */}
      {mode === 'ws' && connected ? (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <SceneTreePanel port={port} onSelectNode={(node) => {
            window.api.ccGetNode?.(port, node.uuid)
              .then(n => setSelectedNode((n as CCNode) ?? node))
              .catch(() => setSelectedNode(node))
          }} />
          {selectedNode && (
            <NodePropertyPanel port={port} node={selectedNode} onUpdate={() => {}} />
          )}
          {/* 에셋 브라우저 섹션 구분선 */}
          <div
            onClick={() => setShowAssets(v => !v)}
            style={{
              padding: '4px 8px',
              borderTop: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
              background: showAssets ? 'var(--bg-secondary)' : 'transparent',
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{showAssets ? '▾' : '▸'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>에셋 브라우저</span>
          </div>
          {showAssets && (
            <div style={{ height: 200, borderTop: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
              <AssetBrowserPanel connected={connected} port={port} />
            </div>
          )}
        </div>
      ) : mode === 'ws' ? (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 10, fontWeight: 600, color: 'var(--text-primary)' }}>Extension 설치</div>
          <div style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: 10 }}>
            <strong>Extension:</strong>{' '}
            <code style={{ color: 'var(--accent)' }}>{extName}</code>
            {' '}(포트 {extPort})
          </div>
          {detectedProject && currentPath ? (
            <>
              <button
                onClick={handleInstall}
                disabled={installing}
                style={{
                  width: '100%', padding: '6px 0', marginBottom: 8,
                  background: installing ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: installing ? 'var(--text-muted)' : '#fff',
                  borderRadius: 4, fontSize: 11, cursor: installing ? 'not-allowed' : 'pointer',
                }}
              >
                {installing ? '설치 중...' : '⚡ 자동 설치'}
              </button>
              {installMsg && (
                <div style={{
                  marginBottom: 8, padding: '6px 8px', borderRadius: 4, fontSize: 10, lineHeight: 1.5,
                  background: installMsg.ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                  color: installMsg.ok ? 'var(--success, #3fb950)' : 'var(--error, #f85149)',
                }}>
                  {installMsg.text}
                  {installMsg.ok && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>CC를 재시작 후 연결하세요.</div>}
                </div>
              )}
            </>
          ) : (
            <div style={{ marginBottom: 8, fontSize: 10, color: 'var(--warning, #d29922)' }}>
              CC 프로젝트 폴더를 열면 자동 설치 버튼이 활성화됩니다.
            </div>
          )}
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)' }}>수동 설치 방법</summary>
            <ol style={{ paddingLeft: 16, margin: '6px 0 0', fontSize: 10 }}>
              <li>CC 프로젝트의 <code style={{ background: 'var(--bg-tertiary)', padding: '1px 3px', borderRadius: 2 }}>{detectedProject?.version === '3x' ? 'extensions/' : 'packages/'}</code> 폴더에 <code style={{ background: 'var(--bg-tertiary)', padding: '1px 3px', borderRadius: 2 }}>{extName}</code> 복사</li>
              <li>Extension 폴더 내 <code style={{ background: 'var(--bg-tertiary)', padding: '1px 3px', borderRadius: 2 }}>npm install</code></li>
              <li>Cocos Creator 재시작</li>
              <li>연결 버튼 클릭</li>
            </ol>
          </details>
        </div>
      ) : null}
    </div>
  )
}

// ── CC 파일 모드 UI ──────────────────────────────────────────────────────────

interface CCFileProjectUIProps {
  fileProject: {
    projectInfo: import('../../../../shared/ipc-schema').CCFileProjectInfo | null
    sceneFile: import('../../../../shared/ipc-schema').CCSceneFile | null
    loading: boolean
    error: string | null
    openProject: () => Promise<void>
    loadScene: (scenePath: string) => Promise<void>
    saveScene: (root: import('../../../../shared/ipc-schema').CCSceneNode) => Promise<{ success: boolean; error?: string }>
    restoreBackup: () => Promise<{ success: boolean; error?: string }>
  }
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
}

function CCFileProjectUI({ fileProject, selectedNode, onSelectNode }: CCFileProjectUIProps) {
  const { projectInfo, sceneFile, loading, error, openProject, loadScene, saveScene, restoreBackup } = fileProject
  const [selectedScene, setSelectedScene] = useState<string>('')
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSceneChange = useCallback(async (path: string) => {
    setSelectedScene(path)
    if (path) await loadScene(path)
  }, [loadScene])

  const handleSave = useCallback(async () => {
    if (!sceneFile?.root) return
    setSaving(true)
    setSaveMsg(null)
    const result = await saveScene(sceneFile.root)
    setSaving(false)
    setSaveMsg(result.success
      ? { ok: true, text: '저장 완료' }
      : { ok: false, text: result.error ?? '저장 실패' }
    )
    setTimeout(() => setSaveMsg(null), 3000)
  }, [sceneFile, saveScene])

  const handleRestore = useCallback(async () => {
    if (!sceneFile) return
    const result = await restoreBackup()
    setSaveMsg(result.success
      ? { ok: true, text: '백업 복원 완료' }
      : { ok: false, text: result.error ?? '복원 실패' }
    )
    setTimeout(() => setSaveMsg(null), 3000)
  }, [sceneFile, restoreBackup])

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
        </div>

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
              📁 {projectInfo.projectPath}
            </div>
            <div style={{ marginTop: 2 }}>
              씬 파일: <strong>{projectInfo.scenes?.length ?? 0}개</strong>
            </div>
          </div>
        )}

        {/* 씬 선택 드롭다운 */}
        {projectInfo?.scenes && projectInfo.scenes.length > 0 && (
          <select
            value={selectedScene}
            onChange={e => handleSceneChange(e.target.value)}
            style={{
              width: '100%', marginTop: 6, padding: '3px 6px', fontSize: 10,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4,
            }}
          >
            <option value="">씬 파일 선택...</option>
            {projectInfo.scenes.map(s => (
              <option key={s} value={s}>
                {s.split(/[\\/]/).pop()}
              </option>
            ))}
          </select>
        )}

        {/* 저장 / 백업 복원 버튼 */}
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
            <button
              onClick={handleRestore}
              title=".bak 백업 파일에서 복원"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >
              ↩ 복원
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
      </div>

      {/* 씬 파싱 결과 — SceneView + TreeView + Inspector */}
      {sceneFile?.root && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* SVG 씬 뷰 */}
          <div style={{ height: 240, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            <CCFileSceneView
              sceneFile={sceneFile}
              selectedUuid={selectedNode?.uuid ?? null}
              onSelect={uuid => {
                if (!uuid) { onSelectNode(null); return }
                const findNode = (n: CCSceneNode): CCSceneNode | null => {
                  if (n.uuid === uuid) return n
                  for (const c of n.children) { const f = findNode(c); if (f) return f }
                  return null
                }
                onSelectNode(findNode(sceneFile.root))
              }}
            />
          </div>
          {/* 씬 트리 */}
          <div style={{ flex: selectedNode ? 0 : 1, overflow: 'auto', maxHeight: selectedNode ? 180 : undefined }}>
            <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)' }}>
              씬: {sceneFile.scenePath.split(/[\\/]/).pop()}
            </div>
            <CCFileSceneTree
              node={sceneFile.root}
              depth={0}
              selected={selectedNode}
              onSelect={onSelectNode}
            />
          </div>
          {/* 노드 인스펙터 */}
          {selectedNode && (
            <CCFileNodeInspector
              node={selectedNode}
              sceneFile={sceneFile}
              saveScene={saveScene}
              onUpdate={onSelectNode}
            />
          )}
        </div>
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
        </div>
      )}
    </div>
  )
}

/** 파싱된 CCSceneNode 트리 렌더링 */
function CCFileSceneTree({
  node, depth, selected, onSelect,
}: {
  node: CCSceneNode
  depth: number
  selected: CCSceneNode | null
  onSelect: (n: CCSceneNode | null) => void
}) {
  const [collapsed, setCollapsed] = useState(depth > 2)
  const hasChildren = node.children.length > 0
  const isSelected = selected?.uuid === node.uuid

  return (
    <div>
      <div
        onClick={() => onSelect(isSelected ? null : node)}
        style={{
          display: 'flex', alignItems: 'center', gap: 2,
          padding: `2px 6px 2px ${8 + depth * 14}px`,
          cursor: 'pointer', fontSize: 11,
          background: isSelected ? 'var(--accent-subtle, rgba(88,166,255,0.1))' : 'transparent',
          color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
          userSelect: 'none',
        }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setCollapsed(c => !c) }}
            style={{ fontSize: 9, width: 12, textAlign: 'center', flexShrink: 0 }}
          >
            {collapsed ? '▸' : '▾'}
          </span>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {node.name || '(unnamed)'}
        </span>
        {node.components.length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
            {node.components.map(c => c.type.replace('cc.', '')).join(',')}
          </span>
        )}
      </div>
      {!collapsed && hasChildren && node.children.map(child => (
        <CCFileSceneTree
          key={child.uuid}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

/** CCSceneNode 프로퍼티 인스펙터 — 노드 선택 시 표시 */
function CCFileNodeInspector({
  node, sceneFile, saveScene, onUpdate,
}: {
  node: CCSceneNode
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onUpdate: (n: CCSceneNode | null) => void
}) {
  // 편집 중인 로컬 상태 (노드 변경 시 초기화)
  const [draft, setDraft] = useState<CCSceneNode>(() => ({ ...node }))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // 노드 교체 시 draft 초기화
  useMemo(() => { setDraft({ ...node }) }, [node.uuid])

  const rotation = typeof draft.rotation === 'number' ? draft.rotation : (draft.rotation as { z: number }).z ?? 0

  // 노드 값 패치 후 씬 저장
  const applyAndSave = useCallback(async (patch: Partial<CCSceneNode>) => {
    if (!sceneFile.root) return
    const updated = { ...draft, ...patch }
    setDraft(updated)

    // sceneFile.root에서 uuid 찾아 교체
    function replaceNode(n: CCSceneNode): CCSceneNode {
      if (n.uuid === updated.uuid) return updated
      return { ...n, children: n.children.map(replaceNode) }
    }
    const newRoot = replaceNode(sceneFile.root)

    setSaving(true)
    const result = await saveScene(newRoot)
    setSaving(false)
    if (result.success) {
      setMsg({ ok: true, text: '저장됨' })
      onUpdate(updated)
    } else {
      setMsg({ ok: false, text: result.error ?? '저장 실패' })
    }
    setTimeout(() => setMsg(null), 2000)
  }, [draft, sceneFile, saveScene, onUpdate])

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 1,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
      <span style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        onBlur={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
        }}
      />
    </div>
  )

  return (
    <div style={{
      flexShrink: 0, borderTop: '1px solid var(--border)',
      padding: '6px 10px', background: 'var(--bg-secondary, #0d0d1a)', maxHeight: 280, overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{draft.name || '(unnamed)'}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>저장 중...</span>}
          {msg && <span style={{ fontSize: 9, color: msg.ok ? '#4ade80' : '#f85149' }}>{msg.text}</span>}
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={e => applyAndSave({ active: e.target.checked })}
              style={{ margin: 0 }}
            />
            활성
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>위치</div>
          {numInput('X', draft.position.x, v => applyAndSave({ position: { ...draft.position, x: v } }))}
          {numInput('Y', draft.position.y, v => applyAndSave({ position: { ...draft.position, y: v } }))}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', margin: '5px 0 3px', fontWeight: 600 }}>회전</div>
          {numInput('Z°', rotation, v => {
            const r = typeof draft.rotation === 'number' ? v : { ...(draft.rotation as object), z: v } as CCSceneNode['rotation']
            applyAndSave({ rotation: r })
          })}
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>크기</div>
          {numInput('W', draft.size.x, v => applyAndSave({ size: { ...draft.size, x: v } }))}
          {numInput('H', draft.size.y, v => applyAndSave({ size: { ...draft.size, y: v } }))}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', margin: '5px 0 3px', fontWeight: 600 }}>스케일</div>
          {numInput('X', draft.scale.x, v => applyAndSave({ scale: { ...draft.scale, x: v } }), 0.01)}
          {numInput('Y', draft.scale.y, v => applyAndSave({ scale: { ...draft.scale, y: v } }), 0.01)}
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>앵커 / 불투명도</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 6px' }}>
          {numInput('aX', draft.anchor.x, v => applyAndSave({ anchor: { ...draft.anchor, x: v } }), 0.01)}
          {numInput('aY', draft.anchor.y, v => applyAndSave({ anchor: { ...draft.anchor, y: v } }), 0.01)}
          {numInput('α', draft.opacity, v => applyAndSave({ opacity: Math.min(255, Math.max(0, Math.round(v))) }))}
        </div>
      </div>
    </div>
  )
}
