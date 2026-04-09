import { useCallback, useState } from 'react'
import { t } from '../../utils/i18n'

export interface ChangedFile {
  path: string
  op: 'write' | 'edit'
  ts: number
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function opColor(op: ChangedFile['op']): string {
  return op === 'write' ? 'var(--success)' : 'var(--warning)'
}

function opLabel(op: ChangedFile['op']): string {
  return op === 'write' ? 'W' : 'E'
}

interface ChangedFilesPanelProps {
  files: ChangedFile[]
  onFileClick: (path: string) => void
  onClear: () => void
}

export function ChangedFilesPanel({ files, onFileClick, onClear }: ChangedFilesPanelProps) {
  const [sortAsc, setSortAsc] = useState(false)
  const [opFilter, setOpFilter] = useState<'write' | 'edit' | null>(null)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const handleClick = useCallback((path: string) => {
    onFileClick(path)
  }, [onFileClick])

  if (files.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        <div style={{ marginBottom: 6 }}>{t('changes.empty', '변경된 파일 없음')}</div>
        <div style={{ fontSize: 11 }}>{t('changes.emptyHint', 'Claude가 파일을 수정하면 여기에 표시됩니다')}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '5px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {files.length}개
          {' '}
          <button
            onClick={() => setOpFilter(f => f === 'write' ? null : 'write')}
            title="Write 필터"
            style={{ background: opFilter === 'write' ? 'var(--success)' : 'none', color: opFilter === 'write' ? '#fff' : 'var(--success)', fontFamily: 'monospace', fontSize: 10, border: `1px solid var(--success)`, borderRadius: 3, padding: '0 4px', cursor: 'pointer', lineHeight: '15px' }}
          >W:{files.filter(f => f.op === 'write').length}</button>
          <button
            onClick={() => setOpFilter(f => f === 'edit' ? null : 'edit')}
            title="Edit 필터"
            style={{ background: opFilter === 'edit' ? 'var(--warning)' : 'none', color: opFilter === 'edit' ? '#fff' : 'var(--warning)', fontFamily: 'monospace', fontSize: 10, border: `1px solid var(--warning)`, borderRadius: 3, padding: '0 4px', cursor: 'pointer', lineHeight: '15px' }}
          >E:{files.filter(f => f.op === 'edit').length}</button>
        </span>
        <button
          onClick={() => setSortAsc(v => !v)}
          title={sortAsc ? '오래된 순 (클릭: 최신 순)' : '최신 순 (클릭: 오래된 순)'}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: 10,
            cursor: 'pointer', padding: '1px 4px', borderRadius: 3,
          }}
        >
          {sortAsc ? '↑' : '↓'}
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(files.map(f => f.path).join('\n')).then(() => { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1500) }) }}
          title="전체 경로 복사"
          style={{ background: 'none', border: 'none', color: copiedAll ? '#4caf50' : 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: '1px 4px', borderRadius: 3 }}
        >
          {copiedAll ? '✓' : '📋'}
        </button>
        <button
          onClick={onClear}
          title="목록 지우기"
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: 11,
            cursor: 'pointer', padding: '1px 4px', borderRadius: 3,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          {t('changes.clear', '지우기')}
        </button>
      </div>

      {/* File list (newest first) */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {(sortAsc ? [...files] : [...files].reverse()).filter(f => !opFilter || f.op === opFilter).map((f, i) => (
          <div key={`${f.path}-${f.ts}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
            <div
              onClick={() => handleClick(f.path)}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 7,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {/* Op badge */}
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: opColor(f.op),
                border: `1px solid ${opColor(f.op)}`,
                borderRadius: 3,
                padding: '0 3px',
                lineHeight: '14px',
                flexShrink: 0,
                marginTop: 2,
                fontFamily: 'var(--font-mono)',
              }}>
                {opLabel(f.op)}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {fileName(f.path)}
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: 1,
                }}>
                  {f.path}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  {formatTime(f.ts)}
                </div>
              </div>

              <button
                onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(f.path); setCopiedPath(f.path); setTimeout(() => setCopiedPath(p => p === f.path ? null : p), 1500) }}
                title="경로 복사"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedPath === f.path ? 'var(--success, #4ade80)' : 'var(--text-muted)', fontSize: 11, padding: '2px 3px', flexShrink: 0 }}
              >
                {copiedPath === f.path ? '✓' : '📋'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
