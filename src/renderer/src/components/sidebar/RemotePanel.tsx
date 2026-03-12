import { useEffect, useState } from 'react'

interface SshHost {
  alias: string
  hostname: string
  user: string
  port: number
  identityFile?: string
}

interface SavedHost {
  id: string
  label: string
  hostname: string
  user: string
  port: number
  identityFile?: string
}

type ToastType = 'info' | 'error'

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: type === 'error' ? 'var(--error, #ef4444)' : 'var(--accent)',
      color: '#fff', padding: '8px 16px', borderRadius: 6, fontSize: 12,
      zIndex: 9999, maxWidth: 320, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      {message}
    </div>
  )
}

export function RemotePanel() {
  const [sshHosts, setSshHosts] = useState<SshHost[]>([])
  const [savedHosts, setSavedHosts] = useState<SavedHost[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const [form, setForm] = useState({ label: '', hostname: '', user: '', port: '22' })

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type })
  }

  useEffect(() => {
    window.api.listSshHosts().then(setSshHosts).catch(() => setSshHosts([]))
    window.api.getSavedRemoteHosts().then(setSavedHosts).catch(() => setSavedHosts([]))
  }, [])

  const handleConnect = async (user: string, hostname: string, port: number) => {
    const portPart = port !== 22 ? ` -p ${port}` : ''
    const cmd = `ssh${portPart} ${user}@${hostname}`
    try {
      await navigator.clipboard.writeText(cmd)
      showToast(`SSH 명령어가 클립보드에 복사되었습니다: ${cmd}`)
    } catch {
      showToast('클립보드 복사에 실패했습니다.', 'error')
    }
  }

  const resetForm = () => {
    setForm({ label: '', hostname: '', user: '', port: '22' })
    setEditingId(null)
    setShowAddForm(false)
  }

  const handleSave = async () => {
    const { label, hostname, user, port } = form
    if (!hostname.trim() || !user.trim()) {
      showToast('호스트와 사용자를 입력해주세요.', 'error')
      return
    }
    const host: SavedHost = {
      id: editingId ?? `host-${Date.now()}`,
      label: label.trim() || `${user}@${hostname}`,
      hostname: hostname.trim(),
      user: user.trim(),
      port: parseInt(port) || 22,
    }
    const updated = await window.api.saveRemoteHost(host)
    setSavedHosts(updated)
    showToast(editingId ? '호스트가 수정되었습니다.' : '호스트가 저장되었습니다.')
    resetForm()
  }

  const handleEdit = (h: SavedHost) => {
    setForm({ label: h.label, hostname: h.hostname, user: h.user, port: String(h.port) })
    setEditingId(h.id)
    setShowAddForm(true)
  }

  const handleRemove = async (id: string) => {
    const updated = await window.api.removeRemoteHost(id)
    setSavedHosts(updated)
    showToast('호스트가 삭제되었습니다.')
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '6px 8px 4px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary, var(--bg-primary))',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    borderBottom: '1px solid var(--border)',
    gap: 6,
  }

  const hostInfoStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
  }

  const connectBtn: React.CSSProperties = {
    flexShrink: 0,
    padding: '3px 8px',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
  }

  const iconBtn: React.CSSProperties = {
    flexShrink: 0,
    padding: '3px 6px',
    background: 'transparent',
    color: 'var(--text-muted)',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  const isEmpty = sshHosts.length === 0 && savedHosts.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>원격 접속</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>SSH 원격 워크스페이스</div>
      </div>

      {/* SSH Config hosts */}
      {sshHosts.length > 0 && (
        <>
          <div style={labelStyle}>~/.ssh/config 호스트</div>
          {sshHosts.map((h) => (
            <div key={h.alias} style={rowStyle}>
              <div style={hostInfoStyle}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.alias}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.user}@{h.hostname}{h.port !== 22 ? `:${h.port}` : ''}
                </div>
              </div>
              <button style={connectBtn} onClick={() => handleConnect(h.user, h.hostname, h.port)}>
                연결
              </button>
            </div>
          ))}
        </>
      )}

      {/* Saved hosts */}
      {savedHosts.length > 0 && (
        <>
          <div style={labelStyle}>저장된 호스트</div>
          {savedHosts.map((h) => (
            <div key={h.id} style={rowStyle}>
              <div style={hostInfoStyle}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.user}@{h.hostname}{h.port !== 22 ? `:${h.port}` : ''}
                </div>
              </div>
              <button style={connectBtn} onClick={() => handleConnect(h.user, h.hostname, h.port)}>
                연결
              </button>
              <button style={iconBtn} onClick={() => handleEdit(h)} title="편집">✏️</button>
              <button style={{ ...iconBtn, color: 'var(--error, #ef4444)' }} onClick={() => handleRemove(h.id)} title="삭제">×</button>
            </div>
          ))}
        </>
      )}

      {/* Empty state */}
      {isEmpty && !showAddForm && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🖥️</div>
          <div>SSH 호스트가 없습니다.</div>
          <div style={{ marginTop: 4, fontSize: 11 }}>
            ~/.ssh/config에 Host를 추가하거나<br />아래 버튼으로 직접 추가하세요.
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {showAddForm && (
        <div style={{ padding: 8, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary, var(--bg-primary))' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {editingId ? '호스트 편집' : '호스트 추가'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              style={inputStyle}
              placeholder="레이블 (선택)"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            />
            <input
              style={inputStyle}
              placeholder="호스트 (필수)"
              value={form.hostname}
              onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))}
            />
            <input
              style={inputStyle}
              placeholder="사용자 (필수)"
              value={form.user}
              onChange={e => setForm(f => ({ ...f, user: e.target.value }))}
            />
            <input
              style={{ ...inputStyle, width: 80 }}
              placeholder="포트"
              value={form.port}
              onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <button
                style={{ flex: 1, padding: '4px 0', background: 'var(--accent)', color: '#fff', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                onClick={handleSave}
              >
                저장
              </button>
              <button
                style={{ flex: 1, padding: '4px 0', background: 'var(--bg-hover)', color: 'var(--text-muted)', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                onClick={resetForm}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showAddForm && (
        <div style={{ padding: 8, flexShrink: 0 }}>
          <button
            style={{
              width: '100%', padding: '6px 0',
              background: 'var(--bg-hover)', color: 'var(--text-primary)',
              borderRadius: 4, fontSize: 12, cursor: 'pointer',
              border: '1px dashed var(--border)',
            }}
            onClick={() => setShowAddForm(true)}
          >
            + 호스트 추가
          </button>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
