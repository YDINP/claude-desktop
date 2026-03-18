import React, { useState, useEffect, useCallback } from 'react'

export function BackupManager({ scenePath, onRestored }: { scenePath: string; onRestored: () => void }) {
  const [bakFiles, setBakFiles] = useState<Array<{ name: string; path: string; size: number; mtime: number }>>([])
  const [showBakSection, setShowBakSection] = useState(false)
  const [maxBackups, setMaxBackups] = useState(() => {
    try { return parseInt(localStorage.getItem('bak-max-count') ?? '5') } catch { return 5 }
  })
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  const refreshBaks = useCallback(async () => {
    try {
      const files = await window.api.ccFileListBakFiles(scenePath)
      setBakFiles(files)
    } catch { setBakFiles([]) }
  }, [scenePath])

  useEffect(() => {
    if (showBakSection) refreshBaks()
  }, [showBakSection, refreshBaks])

  useEffect(() => {
    try { localStorage.setItem('bak-max-count', String(maxBackups)) } catch { /* ignore */ }
  }, [maxBackups])

  const handleRestore = useCallback(async (bakPath: string) => {
    try {
      const result = await window.api.ccFileRestoreFromBak(bakPath, scenePath)
      if (result.success) { onRestored(); refreshBaks() }
    } catch { /* ignore */ }
  }, [scenePath, onRestored, refreshBaks])

  const handleDeleteAll = useCallback(async () => {
    try {
      await window.api.ccFileDeleteAllBakFiles(scenePath)
      setBakFiles([])
      setConfirmDeleteAll(false)
    } catch { /* ignore */ }
  }, [scenePath])

  return (
    <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => setShowBakSection(v => !v)}
          style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >{showBakSection ? '▾' : '▸'} 백업 파일 ({bakFiles.length})</button>
        {showBakSection && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>max</span>
            <select
              value={maxBackups}
              onChange={e => setMaxBackups(Number(e.target.value))}
              style={{ fontSize: 8, background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 2, padding: '0 2px' }}
            >
              {[3, 5, 10, 20].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}
      </div>
      {showBakSection && (
        <div style={{ marginTop: 4 }}>
          {bakFiles.length === 0 && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px 0' }}>백업 파일이 없습니다</div>
          )}
          {bakFiles.map((bak, i) => (
            <div key={bak.path} style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 0',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {new Date(bak.mtime).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ color: '#555', fontSize: 8 }}>{(bak.size / 1024).toFixed(1)}KB</span>
              <button
                onClick={() => handleRestore(bak.path)}
                style={{ marginLeft: 'auto', fontSize: 8, padding: '1px 5px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 2, color: 'var(--accent)', cursor: 'pointer' }}
              >복원</button>
            </div>
          ))}
          {bakFiles.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
              {confirmDeleteAll ? (
                <>
                  <span style={{ fontSize: 8, color: '#f87171' }}>전체 삭제?</span>
                  <button onClick={handleDeleteAll} style={{ fontSize: 8, padding: '1px 5px', background: 'rgba(248,81,73,0.2)', border: '1px solid #f85149', borderRadius: 2, color: '#f85149', cursor: 'pointer' }}>확인</button>
                  <button onClick={() => setConfirmDeleteAll(false)} style={{ fontSize: 8, padding: '1px 5px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                </>
              ) : (
                <button onClick={() => setConfirmDeleteAll(true)} style={{ fontSize: 8, padding: '1px 5px', background: 'none', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer' }}>모두 삭제</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
