import { useState, useEffect } from 'react'

// R1434: 에셋 썸네일 미리보기 팝업
export function AssetThumbnailPopup({ path: filePath, anchorX, anchorY }: { path: string; anchorX: number; anchorY: number }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setSrc(null)
    window.api.readFileBase64(filePath).then(b64 => {
      if (cancelled) return
      if (!b64) { setLoadError(true); setLoading(false); return }
      const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : ext === 'bmp' ? 'image/bmp' : 'image/png'
      setSrc(`data:${mime};base64,${b64}`)
      setFileSize(Math.round((b64.length * 3 / 4) / 1024))
      setLoading(false)
    }).catch(() => { if (!cancelled) { setLoadError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [filePath])

  // 팝업 위치: 커서 우측, 화면 가장자리 넘지 않도록
  const popupW = 140
  const popupH = 160
  const left = anchorX + popupW > window.innerWidth ? anchorX - popupW - 8 : anchorX + 12
  const top = anchorY + popupH > window.innerHeight ? window.innerHeight - popupH - 8 : anchorY

  return (
    <div style={{
      position: 'fixed', left, top, width: popupW, zIndex: 9999,
      background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)', padding: 6, pointerEvents: 'none',
    }}>
      <div style={{ width: 128, height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden' }}>
        {loading && <span style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>...</span>}
        {loadError && <span style={{ fontSize: 24 }}>📄</span>}
        {src && <img src={src} alt={fileName} style={{ maxWidth: 128, maxHeight: 128, objectFit: 'contain' }} />}
      </div>
      <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
      {fileSize != null && <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{fileSize} KB</div>}
    </div>
  )
}
