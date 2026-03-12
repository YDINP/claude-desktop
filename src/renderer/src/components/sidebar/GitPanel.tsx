import { useState, useEffect, useCallback } from 'react'

interface GitBranch {
  name: string
  upstream: string
  isCurrent: boolean
  isRemote: boolean
}

interface GitFile {
  path: string
  status: string
  staged: boolean
  unstaged: boolean
}

interface GitCommit {
  hash?: string
  short?: string
  subject?: string
  author?: string
  date?: string
}

function statusColor(s: string): string {
  if (s.includes('M')) return '#f59e0b'
  if (s.includes('A')) return '#22c55e'
  if (s.includes('D')) return '#ef4444'
  if (s.includes('?')) return '#94a3b8'
  return 'var(--text-secondary)'
}

export function GitPanel({ rootPath }: { rootPath: string }) {
  const [files, setFiles] = useState<GitFile[]>([])
  const [branch, setBranch] = useState('')
  const [lastCommit, setLastCommit] = useState('')
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [diffPopup, setDiffPopup] = useState<{ filePath: string; diff: string; staged: boolean } | null>(null)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [showBranches, setShowBranches] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [branchError, setBranchError] = useState('')
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchResult, setBranchResult] = useState<string | null>(null)
  const [stashes, setStashes] = useState<{ ref: string; message: string; date: string }[]>([])
  const [showStash, setShowStash] = useState(false)
  const [stashMsg, setStashMsg] = useState('')
  const [stashLoading, setStashLoading] = useState(false)
  const [stashError, setStashError] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [commitDiff, setCommitDiff] = useState<string>('')
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [quickActionResult, setQuickActionResult] = useState<string | null>(null)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagMsg, setNewTagMsg] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = await window.api.gitStatusFull(rootPath)
      if (status.error) { setError(status.error); return }
      setFiles(status.files)
      setBranch(status.branch)
      setLastCommit(status.lastCommit)
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  useEffect(() => { refresh() }, [refresh])

  const loadLog = async () => {
    const result = await window.api.gitLog(rootPath, 20)
    setCommits(result.commits)
    setShowLog(true)
  }

  useEffect(() => {
    if (!logOpen) return
    window.api.gitLog(rootPath, 20).then(result => setCommits(result.commits))
  }, [logOpen, rootPath])

  const handleCommitClick = async (hash: string) => {
    if (selectedCommit === hash) { setSelectedCommit(null); setCommitDiff(''); return }
    setSelectedCommit(hash)
    const diff = await window.api.gitShow(rootPath, hash)
    setCommitDiff(diff)
  }

  const loadBranches = async () => {
    const { branches: b } = await window.api.gitBranches(rootPath)
    setBranches(b)
  }

  const toggleBranches = async () => {
    if (!showBranches) await loadBranches()
    setShowBranches(v => !v)
    setBranchError('')
    setNewBranchName('')
  }

  const handleCheckout = async (branchName: string) => {
    setBranchLoading(true)
    setBranchError('')
    try {
      const result = await window.api.gitCheckout(rootPath, branchName)
      if (!result.success) { setBranchError(result.error ?? '체크아웃 실패'); return }
      await refresh()
      await loadBranches()
    } finally {
      setBranchLoading(false)
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return
    setBranchLoading(true)
    setBranchError('')
    try {
      const result = await window.api.gitCreateBranch(rootPath, newBranchName.trim())
      if (!result.success) { setBranchError(result.error ?? '브랜치 생성 실패'); return }
      setNewBranchName('')
      showBranchResult('\u2705 브랜치 생성됨')
      await refresh()
      await loadBranches()
    } finally {
      setBranchLoading(false)
    }
  }

  const showBranchResult = (msg: string) => {
    setBranchResult(msg)
    setTimeout(() => setBranchResult(null), 3000)
  }

  const handleDeleteBranch = async (name: string) => {
    if (!window.confirm(`브랜치 "${name}"를 삭제할까요?`)) return
    setBranchLoading(true)
    setBranchError('')
    try {
      const result = await window.api.gitDeleteBranch(rootPath, name, false)
      if (!result.success) {
        if (result.error?.includes('not fully merged')) {
          if (!window.confirm('완전히 병합되지 않은 브랜치입니다. 강제 삭제할까요?')) return
          const forced = await window.api.gitDeleteBranch(rootPath, name, true)
          if (!forced.success) { setBranchError(forced.error ?? '강제 삭제 실패'); return }
        } else {
          setBranchError(result.error ?? '삭제 실패'); return
        }
      }
      showBranchResult('\u2705 브랜치 삭제됨')
      await loadBranches()
    } finally {
      setBranchLoading(false)
    }
  }

  const loadStashes = async () => {
    const { entries } = await window.api.gitStashList(rootPath)
    setStashes(entries)
  }

  const toggleStash = async () => {
    if (!showStash) await loadStashes()
    setShowStash(v => !v)
    setStashError('')
  }

  const handleStashPush = async () => {
    setStashLoading(true)
    setStashError('')
    try {
      const result = await window.api.gitStashPush(rootPath, stashMsg || undefined)
      if (!result.success) { setStashError(result.error ?? 'Stash 실패'); return }
      setStashMsg('')
      await loadStashes()
      await refresh()
    } finally {
      setStashLoading(false)
    }
  }

  const handleStashPop = async (ref: string) => {
    setStashLoading(true)
    setStashError('')
    try {
      const result = await window.api.gitStashPop(rootPath, ref)
      if (!result.success) { setStashError(result.error ?? 'Pop 실패'); return }
      await loadStashes()
      await refresh()
    } finally {
      setStashLoading(false)
    }
  }

  const handleStashDrop = async (ref: string) => {
    setStashLoading(true)
    setStashError('')
    try {
      const result = await window.api.gitStashDrop(rootPath, ref)
      if (!result.success) { setStashError(result.error ?? 'Drop 실패'); return }
      await loadStashes()
    } finally {
      setStashLoading(false)
    }
  }

  const handleFileClick = async (filePath: string, staged: boolean) => {
    const { diff } = await window.api.gitFileDiff(rootPath, filePath, staged)
    setDiffPopup({ filePath, diff, staged })
  }

  const handleStage = async (f: GitFile) => {
    if (f.staged) {
      await window.api.gitUnstage(rootPath, f.path)
    } else {
      await window.api.gitStage(rootPath, f.path)
    }
    await refresh()
  }

  const handleAiCommit = async () => {
    setAiLoading(true)
    try {
      const { message } = await window.api.gitGenerateCommitMessage(rootPath)
      if (message) setCommitMsg(message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    const stagedFiles = files.filter(f => f.staged)
    if (stagedFiles.length === 0) { setError('스테이징된 파일이 없습니다'); return }
    const result = await window.api.gitCommit(rootPath, commitMsg)
    if (result.error) { setError(result.error); return }
    setCommitMsg('')
    await refresh()
  }

  const showQuickResult = (msg: string) => {
    setQuickActionResult(msg)
    setTimeout(() => setQuickActionResult(null), 3000)
  }

  const handleFetch = async () => {
    const r = await window.api.gitFetch(rootPath)
    showQuickResult(r.success ? '\u2705 fetch 완료' : `\u274C ${r.error}`)
    if (r.success) refresh()
  }

  const handleUndoCommit = async () => {
    if (!window.confirm('마지막 커밋을 취소할까요? (변경사항은 staged 상태로 유지)')) return
    const r = await window.api.gitUndoLastCommit(rootPath)
    showQuickResult(r.success ? '\u2705 마지막 커밋 취소됨' : `\u274C ${r.error}`)
    if (r.success) refresh()
  }

  const handleClean = async () => {
    if (!window.confirm('추적되지 않는 파일을 모두 삭제할까요?')) return
    const r = await window.api.gitCleanUntracked(rootPath)
    showQuickResult(r.success ? '\u2705 정리 완료' : `\u274C ${r.error}`)
    if (r.success) refresh()
  }

  useEffect(() => {
    if (!tagsOpen || !rootPath) return
    window.api.gitListTags(rootPath).then(setTags)
  }, [tagsOpen, rootPath])

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    const r = await window.api.gitCreateTag(rootPath, newTagName.trim(), newTagMsg.trim() || undefined)
    if (r.success) {
      setTags(t => [newTagName.trim(), ...t])
      setNewTagName('')
      setNewTagMsg('')
    } else alert(r.error)
  }

  const handleDeleteTag = async (name: string) => {
    if (!window.confirm(`태그 "${name}"를 삭제할까요?`)) return
    const r = await window.api.gitDeleteTag(rootPath, name)
    if (r.success) setTags(t => t.filter(x => x !== name))
    else alert(r.error)
  }

  const stagedFiles = files.filter(f => f.staged)
  const unstagedFiles = files.filter(f => !f.staged)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* Header */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={toggleBranches}
          title="브랜치 관리"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{'\u2387'} {branch || '(no branch)'}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{showBranches ? '\u25B4' : '\u25BE'}</span>
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={loadLog} title="커밋 로그" style={btnStyle}>{'\uD83D\uDCCB'}</button>
          <button onClick={refresh} title="새로고침" disabled={loading} style={btnStyle}>{'\u21BA'}</button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--error)', background: 'rgba(239,68,68,0.1)' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>{'\u00D7'}</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Branch panel */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            onClick={toggleBranches}
            style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <span>{'\uD83C\uDF3F'} 브랜치 {branches.length > 0 ? `(${branches.filter(b => !b.isRemote).length})` : ''}</span>
            <span>{showBranches ? '\u25B4' : '\u25BE'}</span>
          </div>
          {showBranches && (
            <>
              {branchError && (
                <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--error)', background: 'rgba(239,68,68,0.1)' }}>
                  {branchError}
                  <button onClick={() => setBranchError('')} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>{'\u00D7'}</button>
                </div>
              )}
              {branches.filter(b => !b.isRemote).length === 0 && (
                <div style={{ padding: '4px 8px 4px 12px', fontSize: 11, color: 'var(--text-muted)' }}>로컬 브랜치 없음</div>
              )}
              {branches.filter(b => !b.isRemote).map(b => (
                <div
                  key={b.name}
                  style={{
                    padding: '4px 8px 4px 12px',
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: b.isCurrent ? 'rgba(var(--accent-rgb, 99,102,241), 0.1)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!b.isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!b.isCurrent) (e.currentTarget as HTMLElement).style.background = b.isCurrent ? 'rgba(var(--accent-rgb, 99,102,241), 0.1)' : 'transparent' }}
                >
                  <span style={{ fontSize: 10, color: b.isCurrent ? 'var(--accent)' : 'var(--text-muted)', width: 10, flexShrink: 0 }}>
                    {b.isCurrent ? '*' : ''}
                  </span>
                  <span
                    onClick={() => !b.isCurrent && !branchLoading && handleCheckout(b.name)}
                    style={{ fontSize: 11, color: b.isCurrent ? 'var(--accent)' : 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: b.isCurrent ? 'default' : 'pointer' }}
                    title={b.isCurrent ? '현재 브랜치' : `체크아웃: ${b.name}`}
                  >
                    {b.name}{b.isCurrent ? ' (현재)' : ''}
                  </span>
                  {!b.isCurrent && (
                    <button
                      onClick={() => handleDeleteBranch(b.name)}
                      disabled={branchLoading}
                      title="브랜치 삭제"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: branchLoading ? 'not-allowed' : 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0 }}
                    >{'\u00D7'}</button>
                  )}
                </div>
              ))}
              {branches.some(b => b.isRemote) && (
                <>
                  <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', marginTop: 2 }}>
                    리모트
                  </div>
                  {branches.filter(b => b.isRemote).map(b => (
                    <div
                      key={b.name}
                      style={{
                        padding: '3px 8px 3px 12px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.name.replace(/^remotes\//, '')}
                      </span>
                    </div>
                  ))}
                </>
              )}
              <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
                <input
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch() }}
                  placeholder="새 브랜치 이름..."
                  style={{
                    flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px',
                    fontSize: 11, fontFamily: 'var(--font-ui)',
                  }}
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim() || branchLoading}
                  title="브랜치 생성 후 전환"
                  style={{
                    background: newBranchName.trim() && !branchLoading ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: newBranchName.trim() && !branchLoading ? '#fff' : 'var(--text-muted)',
                    border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: newBranchName.trim() && !branchLoading ? 'pointer' : 'not-allowed',
                  }}
                >
                  +
                </button>
              </div>
              {branchResult && (
                <div style={{ padding: '2px 8px 4px', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {branchResult}
                </div>
              )}
            </>
          )}
        </div>

        {/* Commit log */}
        {showLog && (
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>커밋 로그</span>
              <button onClick={() => setShowLog(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>{'\u00D7'}</button>
            </div>
            {commits.map((c, i) => (
              <div key={i} style={{ padding: '3px 8px 3px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'monospace', flexShrink: 0 }}>{c.hash}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.author} {'\u00B7'} {c.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stash panel */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            onClick={toggleStash}
            style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <span>Stash {stashes.length > 0 ? `(${stashes.length})` : ''}</span>
            <span>{showStash ? '\u25B4' : '\u25BE'}</span>
          </div>
          {showStash && (
            <>
              {stashError && (
                <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--error)', background: 'rgba(239,68,68,0.1)' }}>
                  {stashError}
                  <button onClick={() => setStashError('')} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>{'\u00D7'}</button>
                </div>
              )}
              {stashes.length === 0 && (
                <div style={{ padding: '4px 8px 4px 12px', fontSize: 11, color: 'var(--text-muted)' }}>stash 없음</div>
              )}
              {stashes.map(s => (
                <div key={s.ref} style={{ padding: '3px 8px 3px 12px', display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${s.ref}: ${s.message}`}>
                    <span style={{ fontSize: 10, color: 'var(--accent)', marginRight: 4 }}>{s.ref}</span>
                    {s.message}
                  </span>
                  <button
                    onClick={() => handleStashPop(s.ref)}
                    disabled={stashLoading}
                    title="적용 (pop)"
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: stashLoading ? 'not-allowed' : 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0 }}
                  >{'\u2191'}</button>
                  <button
                    onClick={() => handleStashDrop(s.ref)}
                    disabled={stashLoading}
                    title="삭제 (drop)"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: stashLoading ? 'not-allowed' : 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0 }}
                  >{'\u00D7'}</button>
                </div>
              ))}
              <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
                <input
                  value={stashMsg}
                  onChange={e => setStashMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStashPush() }}
                  placeholder="Stash 메모 (선택)"
                  style={{
                    flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px',
                    fontSize: 11, fontFamily: 'var(--font-ui)',
                  }}
                />
                <button
                  onClick={handleStashPush}
                  disabled={stashLoading}
                  title="현재 변경사항 stash"
                  style={{
                    background: stashLoading ? 'var(--bg-tertiary)' : 'var(--accent)',
                    color: stashLoading ? 'var(--text-muted)' : '#fff',
                    border: 'none', borderRadius: 4, padding: '3px 7px', fontSize: 11,
                    cursor: stashLoading ? 'not-allowed' : 'pointer', flexShrink: 0,
                  }}
                >
                  {'\uD83D\uDCE6'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            onClick={() => setQuickActionsOpen(v => !v)}
            style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <span>빠른 작업</span>
            <span>{quickActionsOpen ? '\u25B4' : '\u25BE'}</span>
          </div>
          {quickActionsOpen && (
            <div style={{ padding: '4px 8px 6px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={handleFetch}
                  title="git fetch --all"
                  style={{ flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 2px', fontSize: 11, cursor: 'pointer' }}
                >
                  {'\uD83D\uDD04'} Fetch
                </button>
                <button
                  onClick={handleUndoCommit}
                  title="git reset --soft HEAD~1"
                  style={{ flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 2px', fontSize: 11, cursor: 'pointer' }}
                >
                  {'\u21A9'} 커밋 취소
                </button>
                <button
                  onClick={handleClean}
                  title="git clean -fd"
                  style={{ flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 2px', fontSize: 11, cursor: 'pointer' }}
                >
                  {'\uD83E\uDDF9'} 파일 삭제
                </button>
              </div>
              {quickActionResult && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)', padding: '2px 4px' }}>
                  {quickActionResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Commit history */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            onClick={() => setLogOpen(v => !v)}
            style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <span>커밋 히스토리</span>
            <span>{logOpen ? '\u25B4' : '\u25BE'}</span>
          </div>
          {logOpen && (
            <>
              {commits.length === 0 && (
                <div style={{ padding: '4px 8px 4px 12px', fontSize: 11, color: 'var(--text-muted)' }}>커밋 없음</div>
              )}
              {commits.map(c => (
                <div key={c.hash ?? c.subject}>
                  <div
                    onClick={() => c.hash && handleCommitClick(c.hash)}
                    style={{
                      padding: '4px 8px 4px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      background: selectedCommit === c.hash ? 'rgba(var(--accent-rgb, 99,102,241), 0.1)' : 'transparent',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = selectedCommit === c.hash ? 'rgba(var(--accent-rgb, 99,102,241), 0.1)' : 'var(--bg-hover)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selectedCommit === c.hash ? 'rgba(var(--accent-rgb, 99,102,241), 0.1)' : 'transparent' }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'monospace', flexShrink: 0 }}>{c.short ?? c.hash?.slice(0, 7)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.author} {'\u00B7'} {c.date}</div>
                  </div>
                  {selectedCommit === c.hash && commitDiff && (
                    <div style={{ borderBottom: '1px solid var(--border)', overflowX: 'auto', maxHeight: 300, overflowY: 'auto', background: 'var(--bg-secondary)' }}>
                      {commitDiff.split('\n').map((line, i) => (
                        <div key={i} style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          lineHeight: 1.4,
                          color: line.startsWith('+') && !line.startsWith('+++') ? '#4ec9b0'
                               : line.startsWith('-') && !line.startsWith('---') ? '#f14c4c'
                               : line.startsWith('@@') ? 'var(--accent)'
                               : 'var(--text-muted)',
                          whiteSpace: 'pre',
                          padding: '0 8px',
                        }}>
                          {line || ' '}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Tags */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            onClick={() => setTagsOpen(v => !v)}
            style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <span>{'\uD83C\uDFF7'} 태그 {tags.length > 0 ? `(${tags.length})` : ''}</span>
            <span>{tagsOpen ? '\u25B4' : '\u25BE'}</span>
          </div>
          {tagsOpen && (
            <>
              {tags.length === 0 && (
                <div style={{ padding: '4px 8px 4px 12px', fontSize: 11, color: 'var(--text-muted)' }}>태그 없음</div>
              )}
              {tags.map(tag => (
                <div key={tag} style={{ padding: '3px 8px 3px 12px', display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{'\uD83C\uDFF7'}</span>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
                  <button
                    onClick={() => handleDeleteTag(tag)}
                    title="태그 삭제"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0 }}
                  >{'\u00D7'}</button>
                </div>
              ))}
              <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateTag() }}
                  placeholder="태그 이름..."
                  style={{
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px',
                    fontSize: 11, fontFamily: 'var(--font-ui)',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    value={newTagMsg}
                    onChange={e => setNewTagMsg(e.target.value)}
                    placeholder="메시지 (선택, annotated 태그)"
                    style={{
                      flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
                      border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px',
                      fontSize: 11, fontFamily: 'var(--font-ui)',
                    }}
                  />
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
                    title="태그 생성"
                    style={{
                      background: newTagName.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: newTagName.trim() ? '#fff' : 'var(--text-muted)',
                      border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11,
                      cursor: newTagName.trim() ? 'pointer' : 'not-allowed', flexShrink: 0,
                    }}
                  >+</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Staged files */}
        {stagedFiles.length > 0 && (
          <div>
            <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>
              스테이징됨 ({stagedFiles.length})
            </div>
            {stagedFiles.map(f => (
              <FileRow key={f.path} file={f} onToggle={() => handleStage(f)} onFileClick={() => handleFileClick(f.path, true)} />
            ))}
          </div>
        )}

        {/* Unstaged files */}
        {unstagedFiles.length > 0 && (
          <div>
            <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', marginTop: stagedFiles.length > 0 ? 4 : 0 }}>
              변경사항 ({unstagedFiles.length})
            </div>
            {unstagedFiles.map(f => (
              <FileRow key={f.path} file={f} onToggle={() => handleStage(f)} onFileClick={() => handleFileClick(f.path, false)} />
            ))}
          </div>
        )}

        {files.length === 0 && !loading && !error && (
          <div style={{ padding: '16px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            변경사항 없음
          </div>
        )}
      </div>

      {/* Diff popup */}
      {diffPopup && (
        <div style={{
          position: 'fixed',
          top: '10%', left: '20%', right: '20%',
          maxHeight: '70vh',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {diffPopup.filePath} ({diffPopup.staged ? 'staged' : 'unstaged'})
            </span>
            <button onClick={() => setDiffPopup(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <div style={{ overflow: 'auto', flex: 1, padding: 8 }}>
            {diffPopup.diff ? diffPopup.diff.split('\n').map((line, i) => (
              <div key={i} style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.4,
                color: line.startsWith('+') && !line.startsWith('+++') ? '#4ec9b0'
                     : line.startsWith('-') && !line.startsWith('---') ? '#f14c4c'
                     : line.startsWith('@@') ? 'var(--accent)'
                     : 'var(--text-muted)',
                whiteSpace: 'pre',
              }}>
                {line || ' '}
              </div>
            )) : (
              <div style={{ padding: 12, fontSize: 11, color: 'var(--text-muted)' }}>diff 없음</div>
            )}
          </div>
        </div>
      )}

      {/* Commit input */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        {lastCommit && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            최근: {lastCommit}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <textarea
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            placeholder="커밋 메시지..."
            rows={2}
            style={{
              width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px',
              fontSize: 11, resize: 'none', fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
              paddingRight: 36,
            }}
            onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleCommit() }}
          />
          {commitMsg.length > 0 && (
            <span style={{
              position: 'absolute', bottom: 4, left: 6,
              fontSize: 9, pointerEvents: 'none',
              color: commitMsg.split('\n')[0].length > 72 ? '#f87171' : commitMsg.split('\n')[0].length > 60 ? '#fbbf24' : 'var(--text-muted)',
            }}>
              {commitMsg.split('\n')[0].length}/72
            </span>
          )}
          <button
            onClick={handleAiCommit}
            disabled={aiLoading || stagedFiles.length === 0}
            title="AI 커밋 메시지 생성"
            style={{
              position: 'absolute', right: 4, top: 4,
              background: 'none', border: 'none', cursor: aiLoading || stagedFiles.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 13, padding: '1px 3px', color: aiLoading ? 'var(--text-muted)' : 'var(--accent)',
              opacity: stagedFiles.length === 0 ? 0.4 : 1,
            }}
          >
            {aiLoading ? '…' : '\u2728'}
          </button>
        </div>
        <button
          onClick={handleCommit}
          disabled={!commitMsg.trim() || stagedFiles.length === 0}
          style={{
            marginTop: 4, width: '100%', padding: '4px',
            background: commitMsg.trim() && stagedFiles.length > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: commitMsg.trim() && stagedFiles.length > 0 ? '#fff' : 'var(--text-muted)',
            border: 'none', borderRadius: 4, fontSize: 12, cursor: commitMsg.trim() && stagedFiles.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          커밋 ({stagedFiles.length})
        </button>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px',
}

function FileRow({ file, onToggle, onFileClick }: { file: GitFile; onToggle: () => void; onFileClick: () => void }) {
  const name = file.path.split('/').pop() ?? file.path
  const s = file.status.trim()
  return (
    <div
      style={{
        padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <span style={{ fontSize: 10, color: statusColor(s), fontFamily: 'monospace', flexShrink: 0, width: 14 }}>{s[0]}</span>
      <span
        onClick={onFileClick}
        style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer' }}
        title={`diff 보기: ${file.path}`}
      >{name}</span>
      <span
        onClick={onToggle}
        style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, cursor: 'pointer', padding: '0 2px' }}
        title={`${file.staged ? '스테이지 해제' : '스테이지'}: ${file.path}`}
      >{file.staged ? '\u2212' : '+'}</span>
    </div>
  )
}
