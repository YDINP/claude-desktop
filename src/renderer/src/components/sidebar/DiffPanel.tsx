import { useState, useMemo, useCallback } from 'react'
import { t } from '../../utils/i18n'

// --- diff 통계 ---
interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

function getLineChanges(original: string, modified: string): DiffStats {
  const origLines = original.split('\n')
  const modLines = modified.split('\n')
  const origSet = new Set(origLines)
  const modSet = new Set(modLines)

  const added = modLines.filter(l => !origSet.has(l)).length
  const removed = origLines.filter(l => !modSet.has(l)).length
  const unchanged = origLines.filter(l => modSet.has(l)).length

  return { added, removed, unchanged }
}

// --- diff 히스토리 ---
const DIFF_HISTORY_KEY = 'claude-diff-history'

interface DiffHistoryEntry {
  id: string
  originalPath: string
  modifiedPath: string
  timestamp: number
  stats: DiffStats
}

function loadHistory(): DiffHistoryEntry[] {
  try {
    const raw = localStorage.getItem(DIFF_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(entries: DiffHistoryEntry[]) {
  localStorage.setItem(DIFF_HISTORY_KEY, JSON.stringify(entries.slice(0, 20)))
}

// --- 언어 오버라이드 옵션 ---
const LANG_OPTIONS = [
  { value: '', label: '자동 감지' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Bash' },
  { value: 'plaintext', label: 'Plain Text' },
]

function detectLang(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', html: 'html', css: 'css', py: 'python', sh: 'bash',
  }
  return map[ext] ?? 'plaintext'
}

// --- 컴포넌트 ---
export function DiffPanel() {
  const [originalPath, setOriginalPath] = useState('')
  const [modifiedPath, setModifiedPath] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [modifiedContent, setModifiedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // diff 요약 복사
  const [diffCopied, setDiffCopied] = useState(false)

  // 언어 오버라이드
  const [langOverride, setLangOverride] = useState('')

  // 히스토리
  const [diffHistory, setDiffHistory] = useState<DiffHistoryEntry[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)

  // diff 통계
  const diffStats = useMemo<DiffStats | null>(() => {
    if (!originalContent && !modifiedContent) return null
    return getLineChanges(originalContent, modifiedContent)
  }, [originalContent, modifiedContent])

  const activeLang = langOverride || (originalPath ? detectLang(originalPath) : 'plaintext')

  // 원본/수정 경로 교체
  const handleSwap = useCallback(() => {
    setOriginalPath(prev => {
      const oldModified = modifiedPath
      setModifiedPath(prev)
      return oldModified
    })
    setOriginalContent(prev => {
      const oldModified = modifiedContent
      setModifiedContent(prev)
      return oldModified
    })
  }, [modifiedPath, modifiedContent])

  const loadFiles = useCallback(async () => {
    if (!originalPath.trim() || !modifiedPath.trim()) {
      setError('원본과 수정 파일 경로를 모두 입력하세요')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [origRes, modRes] = await Promise.all([
        window.api.readFile(originalPath.trim()),
        window.api.readFile(modifiedPath.trim()),
      ])
      setOriginalContent(origRes)
      setModifiedContent(modRes)

      const stats = getLineChanges(origRes, modRes)
      const entry: DiffHistoryEntry = {
        id: `diff-${Date.now()}`,
        originalPath: originalPath.trim(),
        modifiedPath: modifiedPath.trim(),
        timestamp: Date.now(),
        stats,
      }
      const updated = [entry, ...diffHistory.filter(h => h.originalPath !== entry.originalPath || h.modifiedPath !== entry.modifiedPath)].slice(0, 20)
      setDiffHistory(updated)
      saveHistory(updated)
    } catch (err) {
      setError(`파일 읽기 실패: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [originalPath, modifiedPath, diffHistory])

  // diff 요약 복사
  const copyDiffSummary = useCallback(() => {
    if (!diffStats) return
    const summary = [
      `--- diff 요약 ---`,
      `원본: ${originalPath}`,
      `수정: ${modifiedPath}`,
      `언어: ${activeLang}`,
      `추가: +${diffStats.added}줄`,
      `삭제: -${diffStats.removed}줄`,
      `변경 없음: ${diffStats.unchanged}줄`,
    ].join('\n')
    navigator.clipboard.writeText(summary).then(() => {
      setDiffCopied(true)
      setTimeout(() => setDiffCopied(false), 1500)
    })
  }, [diffStats, originalPath, modifiedPath, activeLang])

  const restoreFromHistory = useCallback((entry: DiffHistoryEntry) => {
    setOriginalPath(entry.originalPath)
    setModifiedPath(entry.modifiedPath)
    setShowHistory(false)
  }, [])

  const diffLines = useMemo(() => {
    if (!originalContent && !modifiedContent) return []
    const origLines = originalContent.split('\n')
    const modLines = modifiedContent.split('\n')
    const maxLen = Math.max(origLines.length, modLines.length)
    const result: Array<{ type: 'added' | 'removed' | 'unchanged'; line: string; lineNum: number }> = []

    const origSet = new Set(origLines)
    const modSet = new Set(modLines)

    for (let i = 0; i < maxLen; i++) {
      const orig = origLines[i]
      const mod = modLines[i]

      if (orig === mod) {
        result.push({ type: 'unchanged', line: orig ?? '', lineNum: i + 1 })
      } else {
        if (orig !== undefined && !modSet.has(orig)) {
          result.push({ type: 'removed', line: orig, lineNum: i + 1 })
        }
        if (mod !== undefined && !origSet.has(mod)) {
          result.push({ type: 'added', line: mod, lineNum: i + 1 })
        }
      }
    }
    return result
  }, [originalContent, modifiedContent])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* 헤더 */}
      <div className="panel-header" style={{ padding: '8px 10px', gap: 6, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{t('diff.title')}</span>
        <button
          onClick={() => setShowHistory(v => !v)}
          title="최근 비교 히스토리"
          style={{
            background: showHistory ? 'var(--accent-dim)' : 'none',
            border: `1px solid ${showHistory ? 'var(--accent)' : 'transparent'}`,
            borderRadius: 4, cursor: 'pointer', fontSize: 10, padding: '1px 5px',
            color: showHistory ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          히스토리 {diffHistory.length > 0 && `(${diffHistory.length})`}
        </button>
      </div>

      {/* 히스토리 패널 */}
      {showHistory && (
        <div style={{ borderBottom: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto', flexShrink: 0 }}>
          {diffHistory.length === 0 ? (
            <div className="panel-empty">
              {t('diff.noHistory')}
            </div>
          ) : diffHistory.map(entry => (
            <div
              key={entry.id}
              onClick={() => restoreFromHistory(entry)}
              style={{
                padding: '6px 10px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 10,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ color: 'var(--text-primary)', marginBottom: 2 }}>
                {entry.originalPath.split(/[\\/]/).pop()} ↔ {entry.modifiedPath.split(/[\\/]/).pop()}
              </div>
              <div style={{ color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                <span style={{ color: '#4ade80' }}>+{entry.stats.added}</span>
                <span style={{ color: '#f87171' }}>-{entry.stats.removed}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {new Date(entry.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 입력 영역 */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <input
            value={originalPath}
            onChange={e => setOriginalPath(e.target.value)}
            placeholder={t('diff.originalPath')}
            style={{
              flex: 1, padding: '4px 8px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 4,
              color: 'var(--text-primary)', fontSize: 11, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {/* 원본/수정 경로 교체 버튼 */}
          <button
            onClick={handleSwap}
            title="원본/수정 경로 교체"
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 4, cursor: 'pointer', padding: '3px 6px',
              color: 'var(--text-muted)', fontSize: 12, flexShrink: 0,
            }}
          >
            ⇄
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <input
            value={modifiedPath}
            onChange={e => setModifiedPath(e.target.value)}
            placeholder={t('diff.modifiedPath')}
            style={{
              flex: 1, padding: '4px 8px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 4,
              color: 'var(--text-primary)', fontSize: 11, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* 언어 오버라이드 select */}
          <select
            value={langOverride}
            onChange={e => setLangOverride(e.target.value)}
            title="언어 오버라이드"
            style={{
              flex: 1, padding: '4px 6px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 4,
              color: 'var(--text-primary)', fontSize: 11, outline: 'none',
            }}
          >
            {LANG_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={loadFiles}
            disabled={loading}
            style={{
              padding: '4px 12px', background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 4, fontSize: 11,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? t('diff.comparing') : t('diff.compare')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '6px 10px', background: '#dc262610', color: '#f87171', fontSize: 11, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* diff 통계 + 요약 복사 */}
      {diffStats && (
        <div style={{
          padding: '6px 10px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, flexShrink: 0,
        }}>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>+{diffStats.added} added</span>
          <span style={{ color: '#f87171', fontWeight: 600 }}>-{diffStats.removed} removed</span>
          <span style={{ color: 'var(--text-muted)' }}>{diffStats.unchanged} unchanged</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({activeLang})</span>
          <button
            onClick={copyDiffSummary}
            title="diff 요약 복사"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 11, padding: '0 4px',
              color: diffCopied ? '#4ade80' : 'var(--text-muted)',
            }}
          >
            {diffCopied ? '✓ 복사됨' : '📋 diff 요약 복사'}
          </button>
        </div>
      )}

      {/* diff 결과 */}
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: 11 }}>
        {diffLines.length === 0 && !error && (
          <div className="panel-empty" style={{ padding: 20 }}>
            {t('diff.placeholder')}
          </div>
        )}
        {diffLines.map((dl, i) => (
          <div
            key={i}
            style={{
              padding: '1px 10px',
              background:
                dl.type === 'added' ? '#4ade8015' :
                dl.type === 'removed' ? '#f8717115' :
                'transparent',
              color:
                dl.type === 'added' ? '#4ade80' :
                dl.type === 'removed' ? '#f87171' :
                'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            <span style={{ display: 'inline-block', width: 32, color: 'var(--text-muted)', textAlign: 'right', marginRight: 8, userSelect: 'none' }}>
              {dl.lineNum}
            </span>
            <span style={{ marginRight: 6, fontWeight: 600 }}>
              {dl.type === 'added' ? '+' : dl.type === 'removed' ? '-' : ' '}
            </span>
            {dl.line}
          </div>
        ))}
      </div>
    </div>
  )
}
