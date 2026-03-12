import { useState, useEffect, useCallback } from 'react'
import { SceneTreePanel } from './SceneTreePanel'
import { NodePropertyPanel } from './NodePropertyPanel'
import type { CCNode } from '../../../../shared/ipc-schema'

export function CocosPanel() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [port, setPort] = useState(9090)
  const [selectedNode, setSelectedNode] = useState<CCNode | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const ok = await window.api.ccConnect?.(port)
      setConnected(!!ok)
      if (!ok) setError('CC Extension에 연결할 수 없습니다. Extension이 실행 중인지 확인하세요.')
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(false)
    }
  }, [port])

  useEffect(() => {
    handleConnect()
    const unsub = window.api.onCCEvent?.((event) => {
      if (event.type === 'node:select' && event.uuids?.[0]) {
        window.api.ccGetNode?.(event.uuids[0]).then(setSelectedNode).catch(() => {})
      } else if (event.type === 'node:deselect') {
        setSelectedNode(null)
      }
    })
    const unsubStatus = window.api.onCCStatusChange?.((s) => setConnected(s.connected))
    return () => { unsub?.(); unsubStatus?.() }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* 헤더 — 연결 상태 */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Cocos Creator</span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 10,
            background: connected ? 'rgba(38,166,65,0.15)' : 'rgba(255,100,100,0.15)',
            color: connected ? 'var(--success, #26a641)' : 'var(--error, #f85149)',
          }}>
            {connected ? '연결됨' : '연결 안됨'}
          </span>
        </div>
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
            {connecting ? '연결 중...' : connected ? '재연결' : '연결'}
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
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>설치 안내</div>
          <ol style={{ paddingLeft: 16, margin: 0 }}>
            <li>CC 프로젝트의 packages/ (2.x) 또는 extensions/ (3.x) 폴더에{' '}
              <code style={{ fontSize: 10, background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 2 }}>
                cc-ws-extension-2x
              </code>{' '}복사
            </li>
            <li>폴더 내{' '}
              <code style={{ fontSize: 10, background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 2 }}>
                npm install
              </code>
            </li>
            <li>Cocos Creator 재시작</li>
            <li>연결 버튼 클릭</li>
          </ol>
        </div>
      )}
    </div>
  )
}
