import { useState, useMemo, useCallback, useEffect } from 'react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'

// --- 상대 시간 ---
function fmtRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '방금'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`
  return `${Math.floor(diff / 86_400_000)}일 전`
}

// --- 타입 ---
interface SshHost {
  name: string
  host: string
  port?: number
  user?: string
}

interface SavedHost {
  savedId: string
  name: string
  host: string
  port: number
  user: string
  lastUsed: number
}

const SAVED_HOSTS_KEY = 'claude-remote-saved-hosts'

function loadSavedHosts(): SavedHost[] {
  try {
    const raw = localStorage.getItem(SAVED_HOSTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSavedHosts(hosts: SavedHost[]) {
  localStorage.setItem(SAVED_HOSTS_KEY, JSON.stringify(hosts))
}

function buildSshCmd(host: string, port: number, user: string): string {
  const portPart = port !== 22 ? ` -p ${port}` : ''
  return `ssh ${user}@${host}${portPart}`
}

// --- 컴포넌트 ---
export function RemotePanel() {
  const [sshHosts, setSshHosts] = useState<SshHost[]>([])
  const [savedHosts, setSavedHosts] = useState<SavedHost[]>(loadSavedHosts)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  // SSH 명령어 복사
  const { copiedKey: copiedHost, copy: copyClipCmd } = useCopyToClipboard()

  // 새 호스트 추가 폼
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHost, setNewHost] = useState('')
  const [newPort, setNewPort] = useState('22')
  const [newUser, setNewUser] = useState('')

  // SSH config 로드
  useEffect(() => {
    setLoading(true)
    window.api.listSshHosts?.()
      .then((hosts) => setSshHosts((hosts ?? []).map(h => ({ name: h.alias, host: h.hostname, port: h.port, user: h.user }))))
      .catch(() => setSshHosts([]))
      .finally(() => setLoading(false))
  }, [])

  // 호스트 검색 필터
  const filteredSsh = useMemo(() => {
    if (!query.trim()) return sshHosts
    const q = query.toLowerCase()
    return sshHosts.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.host.toLowerCase().includes(q) ||
      (h.user ?? '').toLowerCase().includes(q)
    )
  }, [sshHosts, query])

  const filteredSaved = useMemo(() => {
    if (!query.trim()) return savedHosts
    const q = query.toLowerCase()
    return savedHosts.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.host.toLowerCase().includes(q) ||
      h.user.toLowerCase().includes(q)
    )
  }, [savedHosts, query])

  // 최근 접속 순 정렬
  const sortedSaved = useMemo(() => {
    return [...filteredSaved].sort((a, b) => b.lastUsed - a.lastUsed)
  }, [filteredSaved])

  // SSH 명령어 복사
  const copyCmd = useCallback((hostId: string, cmd: string) => {
    copyClipCmd(cmd, hostId)
  }, [copyClipCmd])

  // 저장 호스트 접속 시 lastUsed 갱신
  const touchSaved = useCallback((savedId: string) => {
    setSavedHosts(prev => {
      const updated = prev.map(h => h.savedId === savedId ? { ...h, lastUsed: Date.now() } : h)
      persistSavedHosts(updated)
      return updated
    })
  }, [])

  // 새 호스트 저장
  const handleAddHost = useCallback(() => {
    if (!newName.trim() || !newHost.trim() || !newUser.trim()) return
    const host: SavedHost = {
      savedId: `saved-${Date.now()}`,
      name: newName.trim(),
      host: newHost.trim(),
      port: parseInt(newPort) || 22,
      user: newUser.trim(),
      lastUsed: Date.now(),
    }
    const updated = [host, ...savedHosts]
    setSavedHosts(updated)
    persistSavedHosts(updated)
    setNewName('')
    setNewHost('')
    setNewPort('22')
    setNewUser('')
    setShowAddForm(false)
  }, [newName, newHost, newPort, newUser, savedHosts])

  // 저장 호스트 삭제
  const removeSaved = useCallback((savedId: string) => {
    setSavedHosts(prev => {
      const updated = prev.filter(h => h.savedId !== savedId)
      persistSavedHosts(updated)
      return updated
    })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* 헤더 */}
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>원격 호스트</span>
        {/* 호스트 수 배지 */}
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 8,
          background: 'var(--bg-hover)', color: 'var(--text-muted)', fontWeight: 600,
        }}>
          {sshHosts.length + savedHosts.length}개
        </span>
        <button
          onClick={() => setShowAddForm(v => !v)}
          title="호스트 추가"
          style={{
            padding: '2px 8px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      {/* 호스트 검색 */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setQuery('')}
          placeholder="호스트 검색..."
          style={{
            width: '100%', padding: '4px 8px', boxSizing: 'border-box',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-primary)', fontSize: 11, outline: 'none',
          }}
        />
      </div>

      {/* 새 호스트 추가 폼 */}
      {showAddForm && (
        <div style={{
          padding: '8px 10px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 4,
          flexShrink: 0,
        }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="이름"
            style={{ padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 11, outline: 'none' }} />
          <input value={newHost} onChange={e => setNewHost(e.target.value)} placeholder="호스트 (예: 192.168.0.1)"
            style={{ padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 11, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="사용자"
              style={{ flex: 1, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 11, outline: 'none' }} />
            <input value={newPort} onChange={e => setNewPort(e.target.value)} placeholder="포트"
              style={{ width: 50, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 11, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleAddHost}
              disabled={!newName.trim() || !newHost.trim() || !newUser.trim()}
              style={{ flex: 1, padding: '3px 0', background: 'var(--accent)', color: '#fff', borderRadius: 3, fontSize: 10, opacity: (!newName.trim() || !newHost.trim() || !newUser.trim()) ? 0.5 : 1, cursor: 'pointer', border: 'none' }}>
              저장
            </button>
            <button onClick={() => setShowAddForm(false)}
              style={{ flex: 1, padding: '3px 0', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderRadius: 3, fontSize: 10, cursor: 'pointer', border: 'none' }}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* 호스트 목록 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
            SSH 설정 로딩 중...
          </div>
        )}

        {!loading && sshHosts.length === 0 && savedHosts.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
            등록된 호스트가 없습니다
          </div>
        )}

        {/* SSH Config 섹션 */}
        {filteredSsh.length > 0 && (
          <>
            <div style={{
              padding: '4px 10px', background: 'var(--bg-secondary)',
              fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              SSH Config ({filteredSsh.length})
            </div>
            {filteredSsh.map(host => {
              const hostId = `ssh-${host.name}`
              const cmd = buildSshCmd(host.host, host.port ?? 22, host.user ?? 'root')
              return (
                <div key={hostId} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ color: '#4ade80', fontSize: 8 }}>●</span>
                    <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {host.name}
                    </span>
                    {/* SSH 명령어 복사 */}
                    <button
                      onClick={() => copyCmd(hostId, cmd)}
                      title="SSH 명령어 복사"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '0 4px',
                        color: copiedHost === hostId ? '#4ade80' : 'var(--text-muted)',
                      }}
                    >
                      {copiedHost === hostId ? '✓' : '📋'}
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {host.user ?? 'root'}@{host.host}{host.port && host.port !== 22 ? `:${host.port}` : ''}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* 저장된 호스트 섹션 */}
        {sortedSaved.length > 0 && (
          <>
            <div style={{
              padding: '4px 10px', background: 'var(--bg-secondary)',
              fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              저장된 호스트 ({filteredSaved.length})
            </div>
            {sortedSaved.map(host => {
              const cmd = buildSshCmd(host.host, host.port, host.user)
              return (
                <div key={host.savedId} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ color: '#60a5fa', fontSize: 8 }}>●</span>
                    <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {host.name}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      {fmtRelative(host.lastUsed)}
                    </span>
                    {/* SSH 명령어 복사 */}
                    <button
                      onClick={() => { copyCmd(host.savedId, cmd); touchSaved(host.savedId) }}
                      title="SSH 명령어 복사"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '0 4px',
                        color: copiedHost === host.savedId ? '#4ade80' : 'var(--text-muted)',
                      }}
                    >
                      {copiedHost === host.savedId ? '✓' : '📋'}
                    </button>
                    <button
                      onClick={() => removeSaved(host.savedId)}
                      title="삭제"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '0 4px',
                        color: 'var(--error, #f87171)',
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {host.user}@{host.host}{host.port !== 22 ? `:${host.port}` : ''}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
