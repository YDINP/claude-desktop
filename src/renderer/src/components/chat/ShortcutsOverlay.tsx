import React from 'react'

const SHORTCUTS: [string, string][] = [
  ['Ctrl+K', '커맨드 팔레트 열기'],
  ['Ctrl+N', '새 세션 시작'],
  ['Ctrl+P', '커맨드 팔레트 열기'],
  ['Ctrl+F', '채팅 검색 토글'],
  ['Ctrl+B', '즐겨찾기 뷰 토글'],
  ['Ctrl+W', '뷰 모드 전환 (컴팩트/와이드)'],
  ['Escape', '검색 닫기 / 스트리밍 중지'],
  ['?', '단축키 도움말'],
]

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>키보드 단축키</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>
        {SHORTCUTS.map(([key, desc]) => (
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
