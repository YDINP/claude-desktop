import React from 'react'
import { t } from '../../utils/i18n'

function getShortcuts(): [string, string][] {
  return [
    ['Ctrl+K', t('shortcuts.openPalette', '커맨드 팔레트 열기')],
    ['Ctrl+N', t('shortcuts.newSession', '새 세션 시작')],
    ['Ctrl+P', t('shortcuts.openPalette', '커맨드 팔레트 열기')],
    ['Ctrl+F', t('shortcuts.chatSearch', '채팅 검색 토글')],
    ['Ctrl+B', t('shortcuts.bookmarksToggle', '즐겨찾기 뷰 토글')],
    ['Ctrl+W', t('shortcuts.viewToggle', '뷰 모드 전환 (컴팩트/와이드)')],
    ['Escape', t('shortcuts.closeSearch', '검색 닫기 / 스트리밍 중지')],
    ['?', t('shortcuts.help', '단축키 도움말')],
  ]
}

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const shortcuts = getShortcuts()
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '20px 28px',
          minWidth: 300,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('status.shortcuts', '키보드 단축키')}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>
        {shortcuts.map(([key, desc]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <kbd style={{
              background: 'var(--bg-input, var(--bg-primary))',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
              minWidth: 80,
              textAlign: 'center',
              flexShrink: 0,
            }}>{key}</kbd>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
