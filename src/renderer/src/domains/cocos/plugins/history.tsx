/**
 * R2729 — 편집 이력 플러그인
 */
import React, { useState, useEffect } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import type { BatchPluginProps } from './types'
import { t } from '../../../utils/i18n'

const HISTORY_KEY = 'cc-batch-edit-history'
const MAX_HISTORY = 20
const DISPLAY_COUNT = 10

type HistoryEntry = { uuid: string; name: string; timestamp: number; op: string }

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return t('batch.history.s_label', '방금 전')
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

function findNodeByUuid(root: CCSceneNode, uuid: string): CCSceneNode | null {
  if (root.uuid === uuid) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeByUuid(child, uuid)
      if (found) return found
    }
  }
  return null
}

export function HistoryPlugin({ nodes, sceneFile, onSelectNode }: BatchPluginProps): JSX.Element {
  const [autoRecord, setAutoRecord] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)

  // autoRecord: nodes 변경 시 자동 기록
  useEffect(() => {
    if (!autoRecord || nodes.length === 0) return
    const now = Date.now()
    const newEntries = nodes.map<HistoryEntry>(n => ({
      uuid: n.uuid,
      name: n.name ?? n.uuid,
      timestamp: now,
      op: t('batch.history.s_auto', '자동'),
    }))
    setHistory(prev => {
      const updated = [...newEntries, ...prev].slice(0, MAX_HISTORY)
      saveHistory(updated)
      return updated
    })
    return () => {}
  }, [autoRecord, nodes])

  function handleManualRecord(): void {
    if (nodes.length === 0) return
    const now = Date.now()
    const newEntries = nodes.map<HistoryEntry>(n => ({
      uuid: n.uuid,
      name: n.name ?? n.uuid,
      timestamp: now,
      op: t('batch.history.s_label2', '수동'),
    }))
    setHistory(prev => {
      const updated = [...newEntries, ...prev].slice(0, MAX_HISTORY)
      saveHistory(updated)
      return updated
    })
  }

  function handleClear(): void {
    saveHistory([])
    setHistory([])
  }

  function handleEntryClick(entry: HistoryEntry): void {
    const node = findNodeByUuid(sceneFile.root, entry.uuid)
    onSelectNode(node)
  }

  const displayed = history.slice(0, DISPLAY_COUNT)

  const rowS: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '2px 4px', cursor: 'pointer', borderRadius: 2,
    borderBottom: '1px solid var(--border)',
  }
  const btnS: React.CSSProperties = {
    fontSize: 9, padding: '1px 6px', cursor: 'pointer',
    border: '1px solid var(--border)', borderRadius: 2,
    color: 'var(--text-primary)', userSelect: 'none',
  }

  return (
    <div style={{ fontSize: 9, color: 'var(--text-primary)' }}>
      {/* 컨트롤 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRecord}
            onChange={e => setAutoRecord(e.target.checked)}
            style={{ width: 10, height: 10 }}
          />
          <span>{t('batch.history.j_auto_record', '자동 기록')}</span>
        </label>
        <button style={btnS} onClick={handleManualRecord} disabled={nodes.length === 0}>
          {t('batch.history.j_record_now', '지금 기록')}
        </button>
        <button
          style={{ ...btnS, color: 'var(--text-muted)', marginLeft: 'auto' }}
          onClick={handleClear}
        >
          {t('batch.history.j_clear_all', '전체 삭제')}
        </button>
      </div>

      {/* 이력 목록 */}
      {displayed.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>{t('batch.history.j_history_none', '이력 없음')}</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 2 }}>
          {displayed.map((entry, i) => (
            <div
              key={`${entry.uuid}-${entry.timestamp}-${i}`}
              style={rowS}
              onClick={() => handleEntryClick(entry)}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLDivElement).style.background = ''
              }}
            >
              <span
                style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {entry.name}
              </span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                {relativeTime(entry.timestamp)}
              </span>
              <span
                style={{
                  color: 'var(--accent)', flexShrink: 0,
                  fontSize: 8, padding: '0 3px',
                  border: '1px solid rgba(var(--accent-rgb),0.3)', borderRadius: 2,
                }}
              >
                {entry.op}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
