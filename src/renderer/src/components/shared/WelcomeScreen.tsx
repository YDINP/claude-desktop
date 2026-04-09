import { useState, useEffect } from 'react'
import { useUIStore } from '../../stores/ui-store'
import { t } from '../../utils/i18n'

interface RecentSession { id: string; title: string; cwd: string; updatedAt: number }

export function WelcomeScreen({ onOpenFolder, onOpenPath, onOpenSession }: {
  onOpenFolder?: () => void
  onOpenPath?: (p: string) => void
  onOpenSession?: (id: string, path: string) => void
}) {
  const setSettingsOpen = useUIStore(s => s.setSettingsOpen)
  const [recents, setRecents] = useState<string[]>([])
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [apiKeyMissing, setApiKeyMissing] = useState(false)

  useEffect(() => {
    window.api?.settingsGet().then((data: Record<string, unknown>) => {
      const stored = (data?.anthropicApiKey as string) ?? ''
      // 환경변수 여부는 main에서만 알 수 있으므로, 저장된 키가 없으면 경고
      setApiKeyMissing(!stored)
    }).catch(() => setApiKeyMissing(false))
    window.api?.getRecentProjects().then(setRecents)
    window.api?.sessionList().then(list => {
      const sessions = (list as unknown[])
        .filter((s): s is RecentSession =>
          s != null &&
          typeof (s as RecentSession).id === 'string' &&
          typeof (s as RecentSession).cwd === 'string' &&
          typeof (s as RecentSession).updatedAt === 'number'
        )
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
      {apiKeyMissing && (
        <div style={{
          background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.4)',
          borderRadius: 8, padding: '10px 16px', maxWidth: 480, width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600, color: '#e74c3c' }}>{t('welcome.apiKeyMissing', 'API 키 미설정')}</span>
            {' — '}Anthropic API 키가 없으면 Claude와 대화할 수 없습니다.{' '}
            환경변수 <code style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>ANTHROPIC_API_KEY</code>가 설정되어 있다면 정상 동작합니다.
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              padding: '5px 12px', background: 'var(--accent)', border: 'none',
              borderRadius: 4, color: '#fff', fontSize: 12, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {t('welcome.settingsInput', '설정에서 입력')}
          </button>
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Claude Desktop</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('welcome.subtitle', 'AI 코딩 어시스턴트')}</div>
      </div>

      <button
        onClick={() => onOpenFolder?.()}
        style={{
          padding: '10px 28px', background: 'var(--accent)', color: '#fff',
          borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        {t('welcome.openFolder', '폴더 열기')}
      </button>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', width: '100%', maxWidth: 720, justifyContent: 'center' }}>
        {recentSessions.length > 0 && (
          <div style={{ flex: 1, maxWidth: 340 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('welcome.recentSessions', '최근 대화')}
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
                    {s.title || t('welcome.defaultTitle', '대화')}
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
              {t('welcome.recentProjects', '최근 프로젝트')}
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
