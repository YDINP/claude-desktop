import React from 'react'
import { useSceneViewCtx } from './SceneViewContext'

/**
 * 스냅샷 기록 / diff / Before-After / JSON 뷰어 / 공유 / 임포트 등의 보조 툴바.
 * SceneViewPanel에서 추출됨 (Context로 상태 공유)
 */
export function SceneViewSnapshotBar() {
  const ctx = useSceneViewCtx()
  const {
    nodeMap, rootUuid, view,
    takeSnapshot, handleTakeSnapshot,
    diffModeR1381, setDiffModeR1381, changedUuids,
    beforeAfterMode, setBeforeAfterMode, setSliderX,
    showJsonViewer, setShowJsonViewer,
    shareUrl, setShareUrl, shareLoading, setShareLoading,
    showImportModal, setShowImportModal, setImportJson, setImportError,
    showCenterGuide, setShowCenterGuide,
    snapThreshold, setSnapThreshold,
    blockInactiveClick, setBlockInactiveClick,
    nodeAccessCount, setNodeAccessCount,
    snapshots, snapshotOpen, setSnapshotOpen,
  } = ctx

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 10 }}>
      <button
        onClick={takeSnapshot}
        style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, color: '#93c5fd', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        스냅샷
      </button>
      {/* R1381: 씬 diff 뷰어 토글 */}
      <button
        onClick={() => setDiffModeR1381(v => !v)}
        title={diffModeR1381 ? '씬 diff 뷰어 끄기' : '변경된 노드 주황 테두리 강조'}
        style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          background: diffModeR1381 ? 'rgba(251,146,60,0.25)' : 'rgba(255,255,255,0.06)',
          border: diffModeR1381 ? '1px solid rgba(251,146,60,0.5)' : '1px solid rgba(255,255,255,0.15)',
          color: diffModeR1381 ? '#fb923c' : '#cbd5e1',
        }}
      >
        diff {changedUuids.size > 0 ? `(${changedUuids.size})` : ''}
      </button>
      {/* R1431: Before/After 슬라이더 비교 토글 */}
      <button
        onClick={() => { setBeforeAfterMode(v => !v); if (!beforeAfterMode) setSliderX(0.5) }}
        title={beforeAfterMode ? 'Before/After 비교 끄기' : 'Before/After 슬라이더 비교'}
        style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          background: beforeAfterMode ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.06)',
          border: beforeAfterMode ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.15)',
          color: beforeAfterMode ? '#c084fc' : '#cbd5e1',
        }}
      >
        B/A
      </button>
      {/* R1435: 씬 JSON 뷰어 토글 */}
      <button
        onClick={() => setShowJsonViewer(v => !v)}
        title={showJsonViewer ? '씬 JSON 뷰어 닫기' : '씬 JSON 뷰어 열기'}
        style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          background: showJsonViewer ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.06)',
          border: showJsonViewer ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.15)',
          color: showJsonViewer ? '#60a5fa' : '#cbd5e1', fontFamily: 'monospace',
        }}
      >
        {'{ }'}
      </button>
      {/* R1438: 씬 공유 링크 */}
      <button
        onClick={async () => {
          setShareLoading(true)
          try {
            const data = Array.from(nodeMap.values()).map(n => ({ name: n.name, uuid: n.uuid, x: Math.round(n.x), y: Math.round(n.y), width: Math.round(n.width), height: Math.round(n.height), rotation: n.rotation, active: n.active, components: n.components }))
            const sceneJson = JSON.stringify({ nodeCount: nodeMap.size, rootUuid, nodes: data }, null, 2)
            const result = await window.api.ccFileServeScene?.(sceneJson)
            if (result?.success && result.url) {
              await navigator.clipboard.writeText(result.url)
              setShareUrl(result.url)
              setTimeout(() => setShareUrl(null), 5000)
            }
          } catch { /* ignore */ }
          setShareLoading(false)
        }}
        disabled={shareLoading || nodeMap.size === 0}
        title={shareUrl ? `공유 URL: ${shareUrl}` : '씬 로컬 HTTP 공유 (60초, 클립보드 복사)'}
        style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          background: shareUrl ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)',
          border: shareUrl ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.15)',
          color: shareUrl ? '#4ade80' : '#cbd5e1',
          opacity: shareLoading || nodeMap.size === 0 ? 0.5 : 1,
        }}
      >
        {shareLoading ? '...' : shareUrl ? '\u2713 복사됨' : '\uD83D\uDD17'}
      </button>
      {/* R1440: 씬 JSON 임포트 버튼 */}
      <button
        onClick={() => { setShowImportModal(true); setImportJson(''); setImportError(null) }}
        title="외부 씬 JSON 붙여넣기로 노드 임포트"
        style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          background: showImportModal ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)',
          border: showImportModal ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.15)',
          color: showImportModal ? '#4ade80' : '#cbd5e1',
        }}
      >
        {'\uD83D\uDCE5'} 임포트
      </button>
      {/* R1442: Center Guide 토글 */}
      <button
        onClick={() => setShowCenterGuide(v => !v)}
        title={showCenterGuide ? '씬 중앙선 숨기기' : '씬 중앙선 표시 (0,0 기준)'}
        style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          background: showCenterGuide ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.06)',
          border: showCenterGuide ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.15)',
          color: showCenterGuide ? '#60a5fa' : '#cbd5e1',
        }}
      >
        {'\u271A'}
      </button>
      {/* R1442: 스냅 거리 임계값 설정 */}
      <select
        value={snapThreshold}
        onChange={e => setSnapThreshold(Number(e.target.value))}
        title={`정렬 스냅 거리: ${snapThreshold}px`}
        style={{
          fontSize: 9, padding: '2px 4px', borderRadius: 3, cursor: 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#cbd5e1',
        }}
      >
        {[4, 8, 12, 16].map(v => (
          <option key={v} value={v}>{v}px</option>
        ))}
      </select>
      {/* R1428: 비활성 노드 클릭 방지 토글 */}
      <button
        onClick={() => setBlockInactiveClick(v => !v)}
        title={blockInactiveClick ? '비활성 노드 클릭 허용' : '비활성 노드 클릭 방지'}
        style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          background: blockInactiveClick ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
          border: blockInactiveClick ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.15)',
          color: blockInactiveClick ? '#fca5a5' : '#cbd5e1',
        }}
      >
        {blockInactiveClick ? '비활성 차단' : '비활성 허용'}
      </button>
      {/* 접근 횟수 초기화 버튼 (R702) */}
      {Object.keys(nodeAccessCount).length > 0 && (
        <button
          onClick={() => setNodeAccessCount({})}
          style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, color: '#fca5a5', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          접근 횟수 초기화
        </button>
      )}
      {snapshots.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setSnapshotOpen(v => !v)}
            style={{ fontSize: 11, padding: '2px 8px', background: snapshotOpen ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#cbd5e1', cursor: 'pointer' }}
          >
            기록 ({snapshots.length}) {'\u25BE'}
          </button>
          {snapshotOpen && (
            <div
              style={{ position: 'absolute', top: '100%', left: 0, marginTop: 2, background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, minWidth: 220, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
            >
              {snapshots.map((s) => (
                <div
                  key={s.timestamp}
                  onClick={() => { console.log('restore snapshot:', s.label); setSnapshotOpen(false) }}
                  style={{ padding: '6px 12px', fontSize: 11, color: '#cbd5e1', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(96,165,250,0.15)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                >
                  {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
