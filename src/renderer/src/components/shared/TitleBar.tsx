export function TitleBar({ onOpenFolder, onOpenPalette, theme, onToggleTheme, sidebarCollapsed, onToggleSidebar, onOpenSettings, hqMode, onToggleHQ }: {
  onOpenFolder: () => void
  onOpenPalette?: () => void
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  onOpenSettings?: () => void
  hqMode?: boolean
  onToggleHQ?: () => void
}) {
  return (
    <div style={{
      height: 'var(--titlebar-height)',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 12,
      paddingRight: 12,
      gap: 8,
      WebkitAppRegion: 'drag',
      flexShrink: 0,
      userSelect: 'none',
    } as React.CSSProperties}>
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          title={`사이드바 ${sidebarCollapsed ? '열기' : '닫기'} (Ctrl+B)`}
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'transparent',
            color: sidebarCollapsed ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 14,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
          } as React.CSSProperties}
        >
          ☰
        </button>
      )}

      <button
        onClick={onOpenFolder}
        style={{
          WebkitAppRegion: 'no-drag',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
        } as React.CSSProperties}
      >
        Open Folder
      </button>

      {/* Command palette trigger */}
      {onOpenPalette && (
        <button
          onClick={onOpenPalette}
          title="커맨드 팔레트 (Ctrl+P)"
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            fontSize: 11,
            padding: '2px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            minWidth: 160,
          } as React.CSSProperties}
        >
          <span style={{ opacity: 0.5 }}>🔍</span>
          <span style={{ flex: 1, textAlign: 'left' }}>검색...</span>
          <span style={{ fontSize: 10, opacity: 0.4, fontFamily: 'monospace' }}>Ctrl+P</span>
        </button>
      )}

      <div style={{ flex: 1 }} />

      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          title="설정 (Ctrl+,)"
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '2px 6px',
          } as React.CSSProperties}
        >
          {'⚙'}
        </button>
      )}

      {onToggleHQ && (
        <button
          onClick={onToggleHQ}
          title={hqMode ? '기본 모드로 전환 (Ctrl+Shift+H)' : 'HQ Mode 전환 (Ctrl+Shift+H)'}
          style={{
            WebkitAppRegion: 'no-drag',
            background: hqMode ? 'rgba(0,152,255,0.2)' : 'transparent',
            color: hqMode ? '#0098ff' : 'var(--text-muted)',
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: hqMode ? '1px solid rgba(0,152,255,0.4)' : '1px solid var(--border)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.5px',
          } as React.CSSProperties}
        >
          ⬡ HQ
        </button>
      )}

      {onToggleTheme && (
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 14,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
          } as React.CSSProperties}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      )}
    </div>
  )
}
