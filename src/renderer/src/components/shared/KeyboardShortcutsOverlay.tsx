import { useEffect, useRef } from 'react'

function trapFocus(container: HTMLElement, e: React.KeyboardEvent) {
  if (e.key !== 'Tab') return
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}

const SHORTCUTS = [
  { key: 'Ctrl+P', desc: '커맨드 팔레트 열기 (설정/Git/검색/북마크 등)' },
  { key: 'Ctrl+K / Ctrl+N', desc: '새 채팅 시작' },
  { key: 'Ctrl+B', desc: '사이드바 토글' },
  { key: 'Ctrl+T', desc: '터미널 토글' },
  { key: 'Ctrl+Shift+F', desc: '포커스 모드 (사이드바·터미널 숨김)' },
  { key: 'Ctrl+F', desc: '터미널 검색' },
  { key: 'Ctrl+W', desc: '현재 탭 닫기' },
  { key: 'Ctrl+Tab', desc: '다음 탭으로 이동' },
  { key: 'Ctrl+Shift+Tab', desc: '이전 탭으로 이동' },
  { key: 'Ctrl+Alt+←/→', desc: '워크스페이스 탭 전환' },
  { key: 'Ctrl+Shift+W', desc: '현재 워크스페이스 탭 닫기' },
  { key: '/', desc: '슬래시 명령어 목록' },
  { key: 'Enter', desc: '메시지 전송' },
  { key: 'Shift+Enter', desc: '줄바꿈' },
  { key: '↑/↓', desc: '입력 히스토리 탐색' },
  { key: '@파일명', desc: '파일 멘션 자동완성' },
  { key: 'Ctrl+1', desc: 'Claude Opus 4.6으로 전환' },
  { key: 'Ctrl+2', desc: 'Claude Sonnet 4.6으로 전환' },
  { key: 'Ctrl+3', desc: 'Claude Haiku 4.5으로 전환' },
  { key: 'Ctrl+H', desc: 'FileViewer 찾기/바꾸기' },
  { key: 'Ctrl+±', desc: '채팅 폰트 크기 조절' },
  { key: 'Ctrl+0', desc: '채팅 폰트 크기 초기화' },
  { key: 'Ctrl+Enter', desc: '세션 노트 저장 (노트 편집 중)' },
  { key: 'Ctrl+,', desc: '설정 열기' },
  { key: 'Ctrl+?', desc: '단축키 도움말' },
  { key: 'F12', desc: 'DevTools 토글' },
]

export function KeyboardShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setTimeout(() => containerRef.current?.querySelector<HTMLElement>('button')?.focus(), 50)
  }, [open])

  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="키보드 단축키"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (containerRef.current) trapFocus(containerRef.current, e) }}
        style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 24, width: 400, maxHeight: '80vh', overflow: 'auto',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
          키보드 단축키
        </div>
        {SHORTCUTS.map(s => (
          <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4, color: 'var(--accent)' }}>
              {s.key}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</span>
          </div>
        ))}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button onClick={onClose} style={{ background: 'var(--accent)', color: '#fff', padding: '6px 20px', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
