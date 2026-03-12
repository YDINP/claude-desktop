import { useCallback, useState } from 'react'
import type React from 'react'

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

function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) return <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--text-muted)' }}>변경사항 없음 (unstaged)</div>
  return (
    <pre style={{ margin: 0, padding: '4px 12px 8px', fontSize: 11, lineHeight: 1.5, overflowX: 'auto', background: '#0d0d17', maxHeight: 200, overflowY: 'auto' }}>
      {diff.split('\n').map((line, i) => {
        const color = line.startsWith('+') ? '#4ade80' : line.startsWith('-') ? '#f87171' : line.startsWith('@@') ? '#94a3b8' : 'var(--text-secondary)'
        return <span key={i} style={{ display: 'block', color }}>{line}</span>
      })}
    </pre>
  )
}

interface ChangedFilesPanelProps {
  files: ChangedFile[]
  onFileClick: (path: string) => void
  onClear: () => void
  onRemoveFile?: (path: string) => void
  rootPath?: string
}

export function ChangedFilesPanel({ files, onFileClick, onClear, onRemoveFile, rootPath }: ChangedFilesPanelProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<Record<string, string>>({})
  const [restoringFiles, setRestoringFiles] = useState<Set<string>>(new Set())

  const handleClick = useCallback((path: string) => {
    onFileClick(path)
  }, [onFileClick])

  const handleRestore = useCallback(async (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation()
    const name = fileName(filePath)
    if (!window.confirm(`"${name}" 파일을 마지막 커밋 상태로 복원할까요? 변경 사항이 사라집니다.`)) return
    if (!rootPath) return
    setRestoringFiles(prev => new Set(prev).add(filePath))
    try {
      const result = await window.api.gitRestoreFile(rootPath, filePath)
      if (result.success) {
        setDiffs(prev => { const next = { ...prev }; delete next[filePath]; return next })
        if (expandedFile === filePath) setExpandedFile(null)
        onRemoveFile?.(filePath)
      } else {
        alert(`복원 실패: ${result.error}`)
      }
    } finally {
      setRestoringFiles(prev => { const next = new Set(prev); next.delete(filePath); return next })
    }
  }, [rootPath, expandedFile, onRemoveFile])

  const handleToggleDiff = useCallback(async (path: string) => {
    if (expandedFile === path) {
      setExpandedFile(null)
      return
    }
    setExpandedFile(path)
    if (!(path in diffs) && rootPath) {
      const result = await window.api.gitDiff(rootPath, path)
      setDiffs(prev => ({ ...prev, [path]: result.diff }))
    }
  }, [expandedFile, diffs, rootPath])

  if (files.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        <div style={{ marginBottom: 6 }}>변경된 파일 없음</div>
        <div style={{ fontSize: 11 }}>Claude가 파일을 수정하면 여기에 표시됩니다</div>
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
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {files.length}개 변경
          {' '}
          <span style={{ color: 'var(--success)', fontFamily: 'monospace' }}>W:{files.filter(f => f.op === 'write').length}</span>
          {' '}
          <span style={{ color: 'var(--warning)', fontFamily: 'monospace' }}>E:{files.filter(f => f.op === 'edit').length}</span>
        </span>
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
          지우기
        </button>
      </div>

      {/* File list (newest first) */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {[...files].reverse().map((f, i) => (
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

              {rootPath && (
                <>
                  <button
                    onClick={e => handleRestore(e, f.path)}
                    title="마지막 커밋으로 복원"
                    disabled={restoringFiles.has(f.path)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f44336' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                  >
                    ↩
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleDiff(f.path) }}
                    title="diff 보기"
                    style={{
                      background: 'none', border: 'none',
                      color: expandedFile === f.path ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: 10, cursor: 'pointer', padding: '1px 3px', flexShrink: 0,
                    }}
                  >
                    {expandedFile === f.path ? '▲' : '▼'}
                  </button>
                </>
              )}
            </div>
            {expandedFile === f.path && (
              <DiffView diff={diffs[f.path] ?? ''} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
