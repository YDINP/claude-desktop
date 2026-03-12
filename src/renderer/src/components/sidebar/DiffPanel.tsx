import { useEffect, useRef, useState } from 'react'
import '../../utils/monaco-setup'
import { DiffEditor } from '@monaco-editor/react'
import type * as MonacoType from 'monaco-editor'

function getLangFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
    cs: 'csharp', html: 'html', css: 'css', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', sh: 'shell', bash: 'shell', xml: 'xml',
    sql: 'sql', php: 'php', rb: 'ruby', kt: 'kotlin', swift: 'swift',
  }
  return map[ext] ?? 'plaintext'
}

const DIFF_HISTORY_KEY = 'diff-history'
type DiffPair = { left: string; right: string }

function loadDiffHistory(): DiffPair[] {
  try { return JSON.parse(localStorage.getItem(DIFF_HISTORY_KEY) ?? '[]') } catch { return [] }
}
function saveDiffHistory(pairs: DiffPair[]) {
  localStorage.setItem(DIFF_HISTORY_KEY, JSON.stringify(pairs.slice(0, 8)))
}

export function DiffPanel() {
  const [leftPath, setLeftPath] = useState('')
  const [rightPath, setRightPath] = useState('')
  const [leftContent, setLeftContent] = useState<string | null>(null)
  const [rightContent, setRightContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sideBySide, setSideBySide] = useState(true)
  const editorRef = useRef<MonacoType.editor.IStandaloneDiffEditor | null>(null)
  const [diffHistory, setDiffHistory] = useState<DiffPair[]>(loadDiffHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [diffStats, setDiffStats] = useState<{ added: number; removed: number } | null>(null)
  const [langOverride, setLangOverride] = useState('')

  useEffect(() => {
    if (leftContent === null || rightContent === null || leftContent === rightContent) {
      setDiffStats(null)
      return
    }
    const timer = setTimeout(() => {
      const changes = editorRef.current?.getLineChanges() ?? []
      const added = changes.reduce((s, c) => s + (c.modifiedEndLineNumber > 0 ? c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1 : 0), 0)
      const removed = changes.reduce((s, c) => s + (c.originalEndLineNumber > 0 ? c.originalEndLineNumber - c.originalStartLineNumber + 1 : 0), 0)
      setDiffStats({ added, removed })
    }, 400)
    return () => clearTimeout(timer)
  }, [leftContent, rightContent])

  async function handleCompare() {
    if (!leftPath.trim() || !rightPath.trim()) return
    setLoading(true)
    setError(null)
    try {
      const [left, right] = await Promise.all([
        window.api.readFile(leftPath.trim()),
        window.api.readFile(rightPath.trim()),
      ])
      setLeftContent(left)
      setRightContent(right)
      // Save to history
      const pair: DiffPair = { left: leftPath.trim(), right: rightPath.trim() }
      const next = [pair, ...diffHistory.filter(p => p.left !== pair.left || p.right !== pair.right)]
      saveDiffHistory(next)
      setDiffHistory(next)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSwap = () => {
    setLeftPath(rightPath)
    setRightPath(leftPath)
    setLeftContent(rightContent)
    setRightContent(leftContent)
  }

  const lang = langOverride || getLangFromPath(rightPath || leftPath)
  const identical = leftContent !== null && rightContent !== null && leftContent === rightContent

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        padding: '8px 8px 4px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>파일 비교</span>
        {diffHistory.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowHistory(h => !h)}
              title="최근 비교 목록"
              style={{ background: showHistory ? 'var(--accent)' : 'none', border: `1px solid ${showHistory ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', color: showHistory ? '#fff' : 'var(--text-muted)', fontSize: 9, padding: '1px 5px' }}
            >
              🕐 {diffHistory.length}
            </button>
            {showHistory && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, zIndex: 50, minWidth: 240, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                {diffHistory.map((p, i) => {
                  const lname = p.left.split(/[/\\]/).pop() ?? p.left
                  const rname = p.right.split(/[/\\]/).pop() ?? p.right
                  return (
                    <div key={i} onClick={() => { setLeftPath(p.left); setRightPath(p.right); setShowHistory(false) }}
                      style={{ padding: '5px 8px', cursor: 'pointer', fontSize: 10, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>{lname}</span>
                      <span style={{ color: 'var(--accent)', margin: '0 4px' }}>↔</span>
                      <span style={{ color: 'var(--text-muted)' }}>{rname}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 8px 6px', flexShrink: 0 }}>
        <input
          value={leftPath}
          onChange={e => setLeftPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCompare()}
          placeholder="원본 파일 경로..."
          style={{
            flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 4,
            padding: '3px 6px', fontSize: 11, outline: 'none',
            fontFamily: 'monospace', minWidth: 0,
          }}
        />
        <input
          value={rightPath}
          onChange={e => setRightPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCompare()}
          placeholder="수정 파일 경로..."
          style={{
            flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 4,
            padding: '3px 6px', fontSize: 11, outline: 'none',
            fontFamily: 'monospace', minWidth: 0,
          }}
        />
        <select
          value={langOverride}
          onChange={e => setLangOverride(e.target.value)}
          title="언어 오버라이드"
          style={{ padding: '3px 4px', background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, flexShrink: 0, cursor: 'pointer' }}
        >
          <option value="">자동</option>
          {['typescript', 'javascript', 'python', 'json', 'html', 'css', 'markdown', 'shell', 'sql', 'plaintext'].map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button
          onClick={handleSwap}
          title="원본/수정 경로 교체"
          style={{
            padding: '3px 6px', background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)', border: '1px solid var(--border)',
            borderRadius: 4, fontSize: 11, cursor: 'pointer', flexShrink: 0,
          }}
        >⇄</button>
        <button
          onClick={() => setSideBySide(p => !p)}
          title={sideBySide ? '인라인 뷰로 전환' : '나란히 뷰로 전환'}
          style={{
            padding: '3px 8px', background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)', border: '1px solid var(--border)',
            borderRadius: 4, fontSize: 10, cursor: 'pointer', flexShrink: 0,
          }}
        >
          {sideBySide ? '⇔' : '↕'}
        </button>
        <button
          onClick={handleCompare}
          disabled={loading || !leftPath.trim() || !rightPath.trim()}
          style={{
            padding: '3px 10px', background: 'var(--accent)', color: '#fff',
            borderRadius: 4, fontSize: 11, fontWeight: 500, flexShrink: 0,
            border: 'none',
            opacity: loading || !leftPath.trim() || !rightPath.trim() ? 0.5 : 1,
            cursor: loading || !leftPath.trim() || !rightPath.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? '...' : '비교'}
        </button>
      </div>

      {/* Diff output */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
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
        {diffStats && !identical && (
          <div style={{ padding: '3px 10px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, fontSize: 10, flexShrink: 0 }}>
            <span style={{ color: '#4caf50' }}>▲ {diffStats.added} 추가</span>
            <span style={{ color: '#f44336' }}>▼ {diffStats.removed} 삭제</span>
          </div>
        )}
        {leftContent !== null && rightContent !== null && !identical && (
          <DiffEditor
            original={leftContent}
            modified={rightContent}
            language={lang}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: sideBySide,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              automaticLayout: true,
            }}
            onMount={(editor) => { editorRef.current = editor }}
          />
        )}
        {leftContent === null && !loading && !error && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            두 파일 경로를 입력하고 비교 버튼을 누르세요
          </div>
        )}
      </div>
    </div>
  )
}
