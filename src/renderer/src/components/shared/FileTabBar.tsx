import { t } from '../../utils/i18n'

type MainTab = string

export function FileTabBar({ tabs, active, onSelect, onClose, dirtyTabs }: {
  tabs: MainTab[]
  active: MainTab
  onSelect: (t: MainTab) => void
  onClose: (t: MainTab) => void
  dirtyTabs?: Set<string>
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      height: 28,
      overflowX: 'auto',
    }}>
      {tabs.map(tab => {
        const isActive = tab === active
        const label = tab === 'chat' ? t('tab.home', '🏠 홈')
          : tab === 'scene' ? t('tab.scene', '⬡ 씬뷰')
          : tab === 'preview' ? t('tab.preview', '🌐 프리뷰')
          : (tab.split(/[\\/]/).pop() ?? tab)
        return (
          <div
            key={tab}
            onClick={() => onSelect(tab)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 12px', flexShrink: 0,
              fontSize: 12, cursor: 'pointer', userSelect: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-primary)' : 'transparent',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              maxWidth: 160,
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
            {dirtyTabs?.has(tab) && (
              <span style={{ color: 'var(--accent)', fontSize: 8, flexShrink: 0 }}>●</span>
            )}
            {tab !== 'chat' && tab !== 'scene' && tab !== 'preview' && (
              <span
                onClick={e => { e.stopPropagation(); onClose(tab) }}
                style={{ opacity: 0.4, fontSize: 14, lineHeight: 1, padding: '0 1px', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
              >×</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
