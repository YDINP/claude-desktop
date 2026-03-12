import { useState, useEffect, useCallback, useRef } from 'react'
import { SceneTreePanel } from './SceneTreePanel'
import { NodePropertyPanel } from './NodePropertyPanel'
import { useProject } from '../../stores/project-store'
import type { CCNode } from '../../../../shared/ipc-schema'

export function CocosPanel() {
  const { currentPath } = useProject()
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [port, setPort] = useState(9090)
  const [selectedNode, setSelectedNode] = useState<CCNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detectedProject, setDetectedProject] = useState<{ name: string; version: string } | null>(null)
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 포트 로드 (마운트 시)
  useEffect(() => {
    window.api.ccGetPort?.().then(p => { if (p) setPort(p) }).catch(() => {})
  }, [])

  // 프로젝트 자동 감지
  useEffect(() => {
    if (!currentPath) return
    window.api.ccDetectProject?.(currentPath).then(info => {
      if (info?.detected && info.version && info.port) {
        setDetectedProject({ name: info.name || 'CC Project', version: info.version })
        setPort(info.port)
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
    try {
      const ok = await window.api.ccConnect?.(port)
      setConnected(!!ok)
      if (ok) {
        window.api.ccSetPort?.(port).catch(() => {})
      } else {
        setError('CC Extension에 연결할 수 없습니다. Extension이 실행 중인지 확인하세요.')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(false)
    }
  }, [port])

  useEffect(() => {
    let cancelled = false
    handleConnect()
    const unsub = window.api.onCCEvent?.((event) => {
      if (cancelled) return
      if (event.type === 'node:select' && event.uuids?.[0]) {
        window.api.ccGetNode?.(event.uuids[0]).then(n => { if (!cancelled) setSelectedNode(n) }).catch(() => {})
      } else if (event.type === 'node:deselect') {
        setSelectedNode(null)
      }
    })
    const unsubStatus = window.api.onCCStatusChange?.((s) => {
      if (cancelled) return
      setConnected(s.connected)
      if (!s.connected) startCountdown()
    })
    return () => {
      cancelled = true
      if (countdownRef.current) clearInterval(countdownRef.current)
      unsub?.()
      unsubStatus?.()
    }
  }, [handleConnect, startCountdown])

  const extName = detectedProject?.version === '3x' ? 'cc-ws-extension-3x' : 'cc-ws-extension-2x'
  const extPort = detectedProject?.version === '3x' ? 9091 : 9090

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* 헤더 */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🎮 Cocos Creator</span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 10,
            background: connected ? 'rgba(63,185,80,0.15)' : reconnectCountdown !== null ? 'rgba(255,165,0,0.15)' : 'rgba(248,81,73,0.15)',
            color: connected ? 'var(--success, #3fb950)' : reconnectCountdown !== null ? '#ffa500' : 'var(--error, #f85149)',
          }}>
            {connected ? '연결됨' : reconnectCountdown !== null ? `재연결 ${reconnectCountdown}s` : '연결 안됨'}
          </span>
          {detectedProject && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {detectedProject.version}
            </span>
          )}
        </div>
        {detectedProject && (
          <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📁 {detectedProject.name}
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

      {/* 본문 */}
      {connected ? (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <SceneTreePanel onSelectNode={setSelectedNode} />
          {selectedNode && (
            <NodePropertyPanel node={selectedNode} onUpdate={() => {}} />
          )}
        </div>
      ) : (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 10, fontWeight: 600, color: 'var(--text-primary)' }}>Extension 설치 안내</div>
          <div style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: 10 }}>
            <strong>Extension 이름:</strong>{' '}
            <code style={{ color: 'var(--accent)' }}>{extName}</code>
            {' '}(포트 {extPort})
          </div>
          <ol style={{ paddingLeft: 16, margin: 0 }}>
            <li>
              CC 프로젝트의{' '}
              <code style={{ fontSize: 10, background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 2 }}>
                {detectedProject?.version === '3x' ? 'extensions/' : 'packages/'}
              </code>{' '}
              폴더에{' '}
              <code style={{ fontSize: 10, background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 2 }}>
                {extName}
              </code>{' '}
              복사
            </li>
            <li>
              Extension 폴더 내{' '}
              <code style={{ fontSize: 10, background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 2 }}>npm install</code>
            </li>
            <li>Cocos Creator 재시작</li>
            <li>연결 버튼 클릭</li>
          </ol>
        </div>
      )}
    </div>
  )
}
