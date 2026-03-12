import { useState, useRef } from 'react'

interface WebPreviewPanelProps {
  defaultUrl?: string
  onUrlChange?: (url: string) => void
}

export function WebPreviewPanel({ defaultUrl = '', onUrlChange }: WebPreviewPanelProps) {
  const [url, setUrl] = useState(defaultUrl)
  const [inputUrl, setInputUrl] = useState(defaultUrl)
  const [loading, setLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleLoad = () => setLoading(false)
  const handleNavigate = () => {
    setLoading(true)
    setUrl(inputUrl)
    onUrlChange?.(inputUrl)
  }
  const handleRefresh = () => {
    setLoading(true)
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
        padding: '6px 10px 4px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>웹 프리뷰</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleRefresh}
            disabled={!url}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
            title="새로고침"
          >↺</button>
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
          onClick={handleNavigate}
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
          <iframe
            ref={iframeRef}
            src={url}
            onLoad={handleLoad}
            style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
            title="CC Web Preview"
            sandbox="allow-scripts allow-same-origin"
          />
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
                setInputUrl(u); setUrl(u); setLoading(true); onUrlChange?.(u)
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
