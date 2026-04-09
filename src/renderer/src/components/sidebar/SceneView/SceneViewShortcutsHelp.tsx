import React from 'react'

/**
 * 단축키 도움말 오버레이 (? 키 토글)
 * SceneViewPanel에서 추출 — 순수 프레젠테이션 컴포넌트
 */
interface SceneViewShortcutsHelpProps {
  show: boolean
  onClose: () => void
}

const SHORTCUT_ENTRIES: [string, string][] = [
  ['V', '선택 도구'],
  ['W', '이동 도구'],
  ['F', '화면 맞추기'],
  ['G', '선택 노드 포커스'],
  ['Ctrl+Z', '실행 취소'],
  ['Ctrl+Y', '다시 실행'],
  ['Ctrl+A', '전체 선택'],
  ['Ctrl+Shift+A', '선택 반전 (비선택 ↔ 선택)'],
  ['Ctrl+C', '복사'],
  ['Ctrl+V', '붙여넣기'],
  ['Ctrl+D', '복제 (클립보드 유지)'],
  ['Escape', '선택 해제 (드래그/리사이즈 중: 취소 복원)'],
  ['Shift+리사이즈', '비례 리사이즈 (코너 핸들)'],
  ['↑↓←→', '선택 노드 1px 이동'],
  ['Shift+↑↓←→', '선택 노드 10px 이동'],
  ['Alt+↑/↓', '부모/첫 자식 노드 선택'],
  ['Ctrl+←/→', '회전 1° (Shift: 10°)'],
  ['M', '미니맵 토글'],
  ['R', '눈금자 토글'],
  ['N', '새 노드 생성'],
  ['Tab/Shift+Tab', '다음/이전 형제 노드 선택'],
  ['Ctrl+G', '선택 노드 그룹화'],
  ['Ctrl+Shift+G', '그룹 해제 (자식 노드 상위로)'],
  ['Ctrl+]', '앞으로 (z-order +1)'],
  ['Ctrl+[', '뒤로 (z-order -1)'],
  ['Del/Backspace', '선택 노드 삭제'],
  ['H', '선택 노드 숨기기/보이기 토글'],
  ['Alt+H', '좌우 반전 (scaleX 부호 반전)'],
  ['Alt+V', '상하 반전 (scaleY 부호 반전)'],
  ['Alt+L', '선택 노드 잠금/해제'],
  ['Alt+1~9', '색상 레이블 지정 (Alt+0: 초기화)'],
  ['Alt+[ / Alt+]', '선택 노드 투명도 -10 / +10'],
  ['I', '씬 통계 오버레이 (노드수/컴포넌트 분포)'],
  ['Shift+I', '선택 노드 상세 정보 오버레이'],
  ['P', '부모 노드 선택'],
  ['?', '단축키 도움말 토글'],
]

export function SceneViewShortcutsHelp({ show, onClose }: SceneViewShortcutsHelpProps) {
  if (!show) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '12px 16px',
          fontSize: 10,
          color: 'var(--text-primary)',
          minWidth: 200,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 11 }}>단축키 도움말</div>
        {SHORTCUT_ENTRIES.map(([key, desc]) => (
          <div key={key} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', color: 'var(--accent)', minWidth: 60, flexShrink: 0 }}>{key}</span>
            <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>클릭하거나 ? 키로 닫기</div>
      </div>
    </div>
  )
}
