import { useState, useRef, useMemo } from 'react'

interface WebPreviewPanelProps {
  defaultUrl?: string
  onUrlChange?: (url: string) => void
}

export function WebPreviewPanel({ defaultUrl = '', onUrlChange }: WebPreviewPanelProps) {
  const [url, setUrl] = useState(defaultUrl)
  const [inputUrl, setInputUrl] = useState(defaultUrl)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>(defaultUrl ? [defaultUrl] : [])
  const [histIdx, setHistIdx] = useState(defaultUrl ? 0 : -1)
  const [urlCopied, setUrlCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [zoom, setZoom] = useState(1.0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
  const zoomIn = () => setZoom(z => { const next = ZOOM_STEPS.find(s => s > z); return next ?? z })
  const zoomOut = () => setZoom(z => { const arr = [...ZOOM_STEPS].reverse(); const next = arr.find(s => s < z); return next ?? z })

  const uniqueHistory = useMemo(() => {
    const seen = new Set<string>()
    return [...history].reverse().filter(u => seen.has(u) ? false : (seen.add(u), true))
  }, [history])

  const navigate = (target: string) => {
    if (!target) return
    setLoading(true)
    setUrl(target)
    setInputUrl(target)
    onUrlChange?.(target)
    setHistory(h => {
      const trimmed = h.slice(0, histIdx + 1)
      const next = [...trimmed, target]
      setHistIdx(next.length - 1)
      return next
    })
  }

  const handleLoad = () => setLoading(false)
  const handleNavigate = () => navigate(inputUrl)
  const handleRefresh = () => {
    setLoading(true)
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src
  }
  const handleBack = () => {
    const prev = history[histIdx - 1]
    if (!prev) return
    setHistIdx(i => i - 1)
    setLoading(true)
    setUrl(prev)
    setInputUrl(prev)
    onUrlChange?.(prev)
  }
  const handleForward = () => {
    const next = history[histIdx + 1]
    if (!next) return
    setHistIdx(i => i + 1)
    setLoading(true)
    setUrl(next)
    setInputUrl(next)
    onUrlChange?.(next)
  }

  const canBack = histIdx > 0
  const canForward = histIdx < history.length - 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
        padding: '6px 10px 4px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>웹 프리뷰</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleBack} disabled={!canBack}
            title="뒤로"
            style={{ background: 'none', border: 'none', cursor: canBack ? 'pointer' : 'default', color: canBack ? 'var(--text-muted)' : 'var(--border)', fontSize: 13 }}>←</button>
          <button onClick={handleForward} disabled={!canForward}
            title="앞으로"
            style={{ background: 'none', border: 'none', cursor: canForward ? 'pointer' : 'default', color: canForward ? 'var(--text-muted)' : 'var(--border)', fontSize: 13 }}>→</button>
          {url && (
            <button
              onClick={() => navigator.clipboard.writeText(url).then(() => { setUrlCopied(true); setTimeout(() => setUrlCopied(false), 1500) })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: urlCopied ? '#4caf50' : 'var(--text-muted)', fontSize: 11 }}
              title="URL 복사"
            >{urlCopied ? '✓' : '📋'}</button>
          )}
          {url && (
            <button
              onClick={() => window.open(url, '_blank')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}
              title="외부 브라우저에서 열기"
            >↗</button>
          )}
          <button
            onClick={handleRefresh}
            disabled={!url}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
            title="새로고침"
          >↺</button>
          {uniqueHistory.length > 1 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowHistory(h => !h)}
                title="방문 기록"
                style={{ background: showHistory ? 'var(--accent)' : 'none', border: `1px solid ${showHistory ? 'var(--accent)' : 'transparent'}`, borderRadius: 3, cursor: 'pointer', color: showHistory ? '#fff' : 'var(--text-muted)', fontSize: 9, padding: '1px 4px' }}
              >🕐{uniqueHistory.length}</button>
              {showHistory && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, zIndex: 50, minWidth: 220, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  {uniqueHistory.map((u, i) => (
                    <div key={i} onClick={() => { navigate(u); setShowHistory(false) }}
                      title={u}
                      style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 10, color: u === url ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{u}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={zoomOut} title="축소" disabled={zoom <= ZOOM_STEPS[0]}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: zoom <= ZOOM_STEPS[0] ? 'var(--border)' : 'var(--text-muted)', fontSize: 11 }}>−</button>
          <button onClick={() => setZoom(1.0)} title={`줌 ${Math.round(zoom * 100)}% (클릭: 초기화)`}
            style={{ background: zoom !== 1.0 ? 'var(--accent-dim)' : 'none', border: 'none', cursor: 'pointer', color: zoom !== 1.0 ? 'var(--accent)' : 'var(--text-muted)', fontSize: 9, padding: '1px 3px', borderRadius: 3 }}>
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn} title="확대" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1] ? 'var(--border)' : 'var(--text-muted)', fontSize: 11 }}>+</button>
          <button
            onClick={() => setUrl('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}
            title="닫기"
          >✕</button>
        </div>
      </div>

      {/* URL 입력 */}
      <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNavigate()}
          placeholder="http://localhost:7456 또는 file://..."
          style={{
            flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 10,
          }}
        />
        <button
          onClick={() => navigate(inputUrl)}
          disabled={!inputUrl}
          style={{
            padding: '3px 8px', background: 'var(--accent)', color: '#fff',
            borderRadius: 4, fontSize: 10, cursor: 'pointer',
          }}
        >이동</button>
      </div>

      {/* iframe 영역 */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--bg-secondary)', zIndex: 1,
            fontSize: 11, color: 'var(--text-muted)',
          }}>
            로딩 중...
          </div>
        )}
        {url ? (
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            <iframe
              ref={iframeRef}
              src={url}
              onLoad={handleLoad}
              style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, border: 'none', background: '#000', transform: `scale(${zoom})`, transformOrigin: '0 0' }}
              title="CC Web Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 11, gap: 8,
          }}>
            <div>CC 웹빌드 URL을 입력하세요</div>
            <div style={{ fontSize: 10 }}>
              기본값: <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 2 }}>
                http://localhost:7456
              </code>
            </div>
            <button
              onClick={() => {
                const u = 'http://localhost:7456'
                navigate(u)
              }}
              style={{
                marginTop: 4, padding: '4px 12px', background: 'var(--accent)', color: '#fff',
                borderRadius: 4, fontSize: 11, cursor: 'pointer',
              }}
            >기본 URL로 열기</button>
          </div>
        )}
      </div>
    </div>
  )
}
