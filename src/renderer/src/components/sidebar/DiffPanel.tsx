import { useState } from 'react'

type DiffLine = {
  type: 'same' | 'add' | 'remove'
  content: string
  leftNum?: number
  rightNum?: number
}

function computeDiff(aLines: string[], bLines: string[]): DiffLine[] {
  const n = aLines.length
  const m = bLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (aLines[i - 1] === bLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.push({ type: 'same', content: aLines[i - 1], leftNum: i, rightNum: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', content: bLines[j - 1], rightNum: j })
      j--
    } else {
      result.push({ type: 'remove', content: aLines[i - 1], leftNum: i })
      i--
    }
  }
  return result.reverse()
}

export function DiffPanel() {
  const [leftPath, setLeftPath] = useState('')
  const [rightPath, setRightPath] = useState('')
  const [diffLines, setDiffLines] = useState<DiffLine[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCompare() {
    if (!leftPath.trim() || !rightPath.trim()) return
    setLoading(true)
    setError(null)
    setDiffLines(null)
    try {
      const [leftContent, rightContent] = await Promise.all([
        window.api.readFile(leftPath.trim()),
        window.api.readFile(rightPath.trim()),
      ])
      const aLines = leftContent.split('\n')
      const bLines = rightContent.split('\n')
      setDiffLines(computeDiff(aLines, bLines))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const identical = diffLines !== null && diffLines.every(l => l.type === 'same')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      {/* Header */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, flexShrink: 0 }}>
        파일 비교
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexShrink: 0 }}>
        <input
          value={leftPath}
          onChange={e => setLeftPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCompare()}
          placeholder="왼쪽 파일 경로..."
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '3px 6px',
            fontSize: 11,
            outline: 'none',
            fontFamily: 'monospace',
            minWidth: 0,
          }}
        />
        <input
          value={rightPath}
          onChange={e => setRightPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCompare()}
          placeholder="오른쪽 파일 경로..."
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '3px 6px',
            fontSize: 11,
            outline: 'none',
            fontFamily: 'monospace',
            minWidth: 0,
          }}
        />
        <button
          onClick={handleCompare}
          disabled={loading || !leftPath.trim() || !rightPath.trim()}
          style={{
            padding: '3px 10px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 500,
            flexShrink: 0,
            opacity: loading || !leftPath.trim() || !rightPath.trim() ? 0.5 : 1,
            cursor: loading || !leftPath.trim() || !rightPath.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? '...' : '비교'}
        </button>
      </div>

      {/* Diff output */}
      <div style={{ flex: 1, overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        {error && (
          <div style={{ padding: 8, color: '#f88', fontSize: 11, fontFamily: 'monospace' }}>
            오류: {error}
          </div>
        )}
        {identical && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            ✅ 파일이 동일합니다
          </div>
        )}
        {diffLines !== null && !identical && (
          <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {diffLines.map((line, idx) => {
              const bg =
                line.type === 'remove' ? 'rgba(255,0,0,0.15)' :
                line.type === 'add' ? 'rgba(0,255,0,0.1)' :
                'transparent'
              const textColor =
                line.type === 'remove' ? '#f88' :
                line.type === 'add' ? '#8f8' :
                '#ccc'
              const prefix =
                line.type === 'remove' ? '-' :
                line.type === 'add' ? '+' :
                ' '
              const lineNum =
                line.type === 'remove' ? line.leftNum :
                line.type === 'add' ? line.rightNum :
                line.leftNum

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    background: bg,
                    color: textColor,
                    whiteSpace: 'pre',
                    lineHeight: '1.4',
                  }}
                >
                  <span style={{
                    width: '3ch',
                    textAlign: 'right',
                    color: '#666',
                    borderRight: '1px solid #333',
                    paddingRight: 4,
                    marginRight: 4,
                    flexShrink: 0,
                    userSelect: 'none',
                  }}>
                    {lineNum ?? ''}
                  </span>
                  <span style={{ marginRight: 4, flexShrink: 0, userSelect: 'none' }}>{prefix}</span>
                  <span style={{ overflow: 'hidden' }}>{line.content}</span>
                </div>
              )
            })}
          </div>
        )}
        {diffLines === null && !loading && !error && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            두 파일 경로를 입력하고 비교 버튼을 누르세요
          </div>
        )}
      </div>
    </div>
  )
}
