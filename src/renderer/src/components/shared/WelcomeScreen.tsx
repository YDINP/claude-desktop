import { useState, useEffect } from 'react'

interface RecentSession { id: string; title: string; cwd: string; updatedAt: number }

export function WelcomeScreen({ onOpenFolder, onOpenPath, onOpenSession }: {
  onOpenFolder?: () => void
  onOpenPath?: (p: string) => void
  onOpenSession?: (id: string, path: string) => void
}) {
  const [recents, setRecents] = useState<string[]>([])
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  useEffect(() => {
    window.api?.getRecentProjects().then(setRecents)
    window.api?.sessionList().then(list => {
      const sessions = (list as RecentSession[])
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 4)
      setRecentSessions(sessions)
    })
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: 'var(--bg-primary)', gap: 32,
    } as React.CSSProperties}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Claude Desktop</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>AI 코딩 어시스턴트</div>
      </div>

      <button
        onClick={() => onOpenFolder?.()}
        style={{
          padding: '10px 28px', background: 'var(--accent)', color: '#fff',
          borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        폴더 열기
      </button>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', width: '100%', maxWidth: 720, justifyContent: 'center' }}>
        {recentSessions.length > 0 && (
          <div style={{ flex: 1, maxWidth: 340 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              최근 대화
            </div>
            {recentSessions.map(s => (
              <div
                key={s.id}
                onClick={() => onOpenSession?.(s.id, s.cwd)}
                style={{
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  WebkitAppRegion: 'no-drag',
                } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ opacity: 0.5 }}>💬</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {s.title || '대화'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.cwd.split(/[\\/]/).slice(-2).join('/')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {recents.length > 0 && (
          <div style={{ flex: 1, maxWidth: 340 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              최근 프로젝트
            </div>
            {recents.slice(0, 6).map(p => (
              <div
                key={p}
                onClick={() => onOpenPath?.(p)}
                style={{
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  WebkitAppRegion: 'no-drag',
                } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ opacity: 0.5 }}>⬡</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.split(/[\\/]/).pop()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
