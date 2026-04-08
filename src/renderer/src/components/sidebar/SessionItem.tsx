import React from 'react'
import { TagDot } from './TagDot'
import { TAG_COLORS, type TagColor, type SessionMeta, type SessionStats, formatTime, formatRelativeTime, formatCharCount } from './sessionUtils'

export interface SessionItemProps {
  session: SessionMeta
  depth?: number
  isActive: boolean
  isSelected: boolean
  selectionMode: boolean
  mergeMode: boolean
  mergeTargets: Set<string>
  hoveredSession: string | null
  sessionStats: Record<string, SessionStats>
  sessionNotes: Record<string, string>
  noteOpenId: string | null
  noteText: string
  noteSaving: boolean
  renamingId: string | null
  renameValue: string
  menuOpenId: string | null
  exportedId: string | null
  inlineTagInput: string | null
  inlineTagValue: string
  dragId: string | null
  dragOverId: string | null
  archivedSessions: Set<string>
  tagColors: Record<string, string>
  filterCustomTags: Set<string>
  filterCustomTag: string | null
  forkChildren: SessionMeta[]
  menuRef: React.RefObject<HTMLDivElement>
  inlineTagRef: React.RefObject<HTMLInputElement>

  onSelect: (id: string) => void
  onMergeToggle: (id: string) => void
  onSelectionToggle: (id: string) => void
  onSessionMouseEnter: (id: string) => void
  onSessionMouseLeave: () => void
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDragLeave: () => void
  onDrop: (targetId: string) => void
  onDragEnd: () => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  onSetSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void
  onSetRenameValue: (v: string) => void
  onCommitRename: (id: string) => void
  onSetRenamingId: (id: string | null) => void
  onStartRename: (e: React.MouseEvent, s: SessionMeta) => void
  onToggleFilterCustomTag: (tag: string) => void
  onRemoveTag: (sessionId: string, tag: string) => void
  onColorPickerTag: (tag: string, x: number, y: number) => void
  onDuplicateSession: (id: string) => void
  onToggleArchive: (id: string) => void
  onHandlePin: (e: React.MouseEvent, s: SessionMeta) => void
  onSetMenuOpenId: (id: string | null) => void
  onMenuStartRename: (e: React.MouseEvent, s: SessionMeta) => void
  onMenuDuplicate: (e: React.MouseEvent, s: SessionMeta) => void
  onMenuMerge: (e: React.MouseEvent, s: SessionMeta) => void
  onMenuNote: (e: React.MouseEvent, id: string) => void
  onMenuTagPicker: (e: React.MouseEvent, id: string) => void
  onMenuToggleLock: (id: string, locked: boolean) => void
  onMenuExportMarkdown: (e: React.MouseEvent, id: string) => void
  onMenuExportJson: (e: React.MouseEvent, id: string) => void
  onMenuDelete: (e: React.MouseEvent, id: string) => void
  onNoteOpenId: (id: string | null) => void
  onSetNoteText: (v: string) => void
  onNoteSave: (id: string) => void
  onSetInlineTagInput: (id: string | null) => void
  onSetInlineTagValue: (v: string) => void
  onCommitInlineTag: (id: string) => void

  renderSessionItem: (s: SessionMeta, depth: number) => React.ReactNode
}

export const SessionItem = React.memo(function SessionItem(props: SessionItemProps) {
  const {
    session: s,
    depth = 0,
    isActive,
    isSelected,
    selectionMode,
    mergeMode,
    mergeTargets,
    hoveredSession,
    sessionStats: stats,
    sessionNotes,
    noteOpenId,
    noteText,
    noteSaving,
    renamingId,
    renameValue,
    menuOpenId,
    exportedId,
    inlineTagInput,
    inlineTagValue,
    dragId,
    dragOverId,
    archivedSessions,
    tagColors,
    filterCustomTags,
    filterCustomTag,
    forkChildren,
    menuRef,
    inlineTagRef,
  } = props

  const sessionTags = (s.tags ?? []).filter(t => TAG_COLORS.includes(t as TagColor)).slice(0, 3)
  const sessionCustomTags = (s.tags ?? []).filter(t => !TAG_COLORS.includes(t as TagColor)).slice(0, 2)

  return (
    <div key={s.id}>
    <div
      draggable={true}
      onContextMenu={(e) => { e.preventDefault(); props.onContextMenu(e, s.id) }}
      onDragStart={() => props.onDragStart(s.id)}
      onDragOver={(e) => { e.preventDefault(); props.onDragOver(e, s.id) }}
      onDragLeave={() => props.onDragLeave()}
      onDrop={() => props.onDrop(s.id)}
      onDragEnd={() => props.onDragEnd()}
      onClick={() => {
        if (mergeMode) {
          props.onMergeToggle(s.id)
        } else if (selectionMode) {
          props.onSelectionToggle(s.id)
        } else {
          props.onSelect(s.id)
        }
      }}
      className="session-item"
      style={{
        padding: `8px 12px 8px ${depth > 0 ? depth * 16 + 12 : 12}px`,
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        borderLeft: isActive ? '3px solid var(--accent)' : depth > 0 ? '3px solid rgba(0,152,255,0.3)' : '3px solid transparent',
        borderTop: dragOverId === s.id ? '2px solid var(--accent)' : '2px solid transparent',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        position: 'relative',
        background: isSelected ? 'var(--bg-hover)' : isActive ? 'var(--bg-hover)' : 'transparent',
        opacity: dragId === s.id ? 0.4 : 1,
      }}
      onMouseEnter={() => props.onSessionMouseEnter(s.id)}
      onMouseLeave={() => props.onSessionMouseLeave()}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            props.onSetSelectedIds(prev => {
              const next = new Set(prev)
              if (e.target.checked) next.add(s.id)
              else next.delete(s.id)
              return next
            })
          }}
          onClick={e => e.stopPropagation()}
          style={{ marginRight: 2, marginTop: 2, cursor: 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {renamingId === s.id ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => props.onSetRenameValue(e.target.value)}
            onBlur={() => props.onCommitRename(s.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); props.onCommitRename(s.id) }
              if (e.key === 'Escape') { props.onSetRenamingId(null) }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              padding: '1px 4px',
              fontSize: 12,
              outline: 'none',
            }}
          />
        ) : (
          <div
            onDoubleClick={(e) => { if (!s.locked) props.onStartRename(e, s) }}
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'text',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title={'\uB354\uBE14\uD074\uB9AD\uC73C\uB85C \uC774\uB984 \uBCC0\uACBD'}
          >
            {sessionTags.length > 0 && (
              <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
                {sessionTags.map((t, i) => <TagDot key={i} color={t} />)}
              </span>
            )}
            {sessionCustomTags.map(t => {
              const tagColor = tagColors[t]
              const isFiltered = filterCustomTags.has(t) || filterCustomTag === t
              return (
                <span
                  key={t}
                  onClick={e => { e.stopPropagation(); props.onToggleFilterCustomTag(t) }}
                  onContextMenu={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    props.onColorPickerTag(t, e.clientX, e.clientY)
                  }}
                  style={{
                    background: tagColor ? `${tagColor}33` : 'rgba(82,139,255,0.15)',
                    color: tagColor ?? '#7ca0ff',
                    borderRadius: 8, padding: '0px 5px', fontSize: 9, cursor: 'pointer',
                    border: isFiltered
                      ? `1px solid ${tagColor ?? '#7ca0ff'}`
                      : tagColor ? `1px solid ${tagColor}66` : '1px solid rgba(82,139,255,0.3)',
                    flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    outline: isFiltered ? `1px solid ${tagColor ?? '#7ca0ff'}44` : 'none',
                  }}
                >
                  {t}
                  <span
                    onClick={e => { e.stopPropagation(); props.onRemoveTag(s.id, t) }}
                    style={{ fontSize: 8, lineHeight: 1, opacity: 0.7, cursor: 'pointer', marginLeft: 1 }}
                    title="태그 삭제"
                  >
                    ✕
                  </span>
                </span>
              )
            })}
            {s.forkedFrom && (
              <span style={{ fontSize: 9, color: '#0098ff', flexShrink: 0, letterSpacing: 0 }}>⎇</span>
            )}
            {stats[s.id] && (() => {
              const st = stats[s.id]
              const totalChars = (st.estimatedTokens ?? 0) * 4
              return ((st.totalMessages ?? 0) >= 50 || totalChars >= 50000) ? (
                <span
                  style={{ fontSize: 10, flexShrink: 0, color: '#e5a020', lineHeight: 1 }}
                  title="긴 세션 — 컨텍스트 초과 위험"
                >⚠</span>
              ) : null
            })()}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title || 'Untitled'}
            </span>
          </div>
        )}
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 2,
          display: 'flex',
          gap: 8,
        }}>
          <span>{formatTime(s.updatedAt)}</span>
          <span>{s.messageCount} msg{s.messageCount !== 1 ? 's' : ''}</span>
        </div>
        {stats[s.id] && (isActive || hoveredSession === s.id) && (() => {
          const st = stats[s.id]
          const totalMsgs = st.totalMessages ?? 0
          const totalChars = (st.estimatedTokens ?? 0) * 4
          const bookmarkCount = 0
          const avgAiLen = (st.assistantMessages ?? 0) > 0
            ? Math.round(totalChars / (st.assistantMessages ?? 1) / 2)
            : 0
          const isHeavy = totalMsgs >= 50 || totalChars >= 50000
          const lastActivity = formatRelativeTime(st.updatedAt)

          const compactBadge = (text: string, color: string, title: string) => (
            <span
              title={title}
              style={{
                background: `${color}18`,
                color,
                borderRadius: 4,
                padding: '1px 4px',
                fontSize: 9,
                border: `1px solid ${color}30`,
                fontVariantNumeric: 'tabular-nums',
                cursor: 'default',
              }}
            >
              {text}
            </span>
          )

          const tooltipLines = [
            `메시지: ${totalMsgs}개 (사용자 ${st.userMessages ?? 0} / AI ${st.assistantMessages ?? 0})`,
            `총 글자: ${formatCharCount(totalChars)}자`,
            `예상 토큰: ~${((st.estimatedTokens ?? 0) / 1000).toFixed(1)}K`,
            avgAiLen > 0 ? `AI 평균 응답: ${formatCharCount(avgAiLen)}자` : '',
            lastActivity ? `마지막 활동: ${lastActivity}` : '',
            isHeavy ? '⚠ 긴 세션 — 컨텍스트 초과 위험' : '',
          ].filter(Boolean).join('\n')

          return (
            <div style={{
              marginTop: isActive ? 4 : 2,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              ...(isActive ? {
                padding: '3px 6px',
                background: 'rgba(0,152,255,0.06)',
                borderRadius: 4,
                border: '1px solid rgba(0,152,255,0.12)',
              } : {}),
            }}
            title={tooltipLines}
            >
              {compactBadge(`${totalMsgs} msg`, '#6b9fff', '메시지 수')}
              {totalChars > 0 && compactBadge(formatCharCount(totalChars) + '자', '#4caf82', '총 글자 수')}
              {bookmarkCount > 0 && compactBadge(`★${bookmarkCount}`, '#c9a227', '북마크 수')}
              {isActive && lastActivity && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)', alignSelf: 'center' }}>
                  {lastActivity}
                </span>
              )}
            </div>
          )
        })()}
        {sessionNotes[s.id] && noteOpenId !== s.id && (
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {sessionNotes[s.id].slice(0, 50)}{sessionNotes[s.id].length > 50 ? '…' : ''}
          </div>
        )}
      </div>
      {/* Duplicate button */}
      <button
        onClick={(e) => { e.stopPropagation(); props.onDuplicateSession(s.id) }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 13,
          padding: '0 2px',
          lineHeight: 1,
          flexShrink: 0,
          opacity: hoveredSession === s.id ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
        title="세션 복제"
      >
        ⧉
      </button>
      {/* Archive button */}
      <button
        onClick={(e) => { e.stopPropagation(); props.onToggleArchive(s.id) }}
        style={{
          background: 'none',
          border: 'none',
          color: archivedSessions.has(s.id) ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 13,
          padding: '0 2px',
          lineHeight: 1,
          flexShrink: 0,
          opacity: hoveredSession === s.id || archivedSessions.has(s.id) ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
        title={archivedSessions.has(s.id) ? '아카이브 해제' : '아카이브'}
      >
        {'\uD83D\uDCE6'}
      </button>
      {/* Pin button */}
      <button
        onClick={(e) => props.onHandlePin(e, s)}
        style={{
          background: 'none',
          border: 'none',
          color: s.pinned ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 13,
          padding: '0 2px',
          lineHeight: 1,
          flexShrink: 0,
          opacity: hoveredSession === s.id || s.pinned ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
        title={s.pinned ? '고정 해제' : '세션 고정'}
      >
        {'\uD83D\uDCCC'}
      </button>
      {/* More menu button */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); props.onSetMenuOpenId(menuOpenId === s.id ? null : s.id) }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 4px',
            lineHeight: 1,
            opacity: hoveredSession === s.id || menuOpenId === s.id ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
          title="더보기"
        >
          ⋯
        </button>
        {menuOpenId === s.id && (
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              zIndex: 100,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '4px 0',
              minWidth: 140,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {[
              {
                label: '이름 변경',
                icon: '✏️',
                action: (e: React.MouseEvent) => { props.onSetMenuOpenId(null); props.onMenuStartRename(e, s) },
                disabled: s.locked,
              },
              {
                label: '복제',
                icon: '📂',
                action: (e: React.MouseEvent) => { e.stopPropagation(); props.onSetMenuOpenId(null); props.onMenuDuplicate(e, s) },
                disabled: false,
              },
              {
                label: '병합...',
                icon: '⎇',
                action: (e: React.MouseEvent) => { e.stopPropagation(); props.onSetMenuOpenId(null); props.onMenuMerge(e, s) },
                disabled: false,
              },
              {
                label: '메모',
                icon: '📝',
                action: (e: React.MouseEvent) => { props.onSetMenuOpenId(null); props.onMenuNote(e, s.id) },
                disabled: false,
              },
              {
                label: '태그 설정',
                icon: '🏷',
                action: (e: React.MouseEvent) => { props.onSetMenuOpenId(null); props.onMenuTagPicker(e, s.id) },
                disabled: false,
              },
              {
                label: s.locked ? '잠금 해제' : '세션 잠금',
                icon: s.locked ? '🔓' : '🔒',
                action: (e: React.MouseEvent) => { e.stopPropagation(); props.onSetMenuOpenId(null); props.onMenuToggleLock(s.id, !s.locked) },
                disabled: false,
              },
              {
                label: 'MD 내보내기',
                icon: '📄',
                action: (e: React.MouseEvent) => { e.stopPropagation(); props.onSetMenuOpenId(null); props.onMenuExportMarkdown(e, s.id) },
                disabled: false,
              },
              {
                label: exportedId === s.id ? '✓' : 'JSON 내보내기',
                icon: exportedId === s.id ? '' : '📤',
                action: (e: React.MouseEvent) => { e.stopPropagation(); props.onSetMenuOpenId(null); props.onMenuExportJson(e, s.id) },
                disabled: false,
              },
              {
                label: '삭제',
                icon: '✕',
                action: (e: React.MouseEvent) => { props.onSetMenuOpenId(null); props.onMenuDelete(e, s.id) },
                disabled: s.locked,
                danger: true,
              },
            ].map(({ label, icon, action, disabled, danger }) => (
              <button
                key={label}
                onClick={action}
                disabled={disabled}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'default' : 'pointer',
                  fontSize: 12,
                  color: disabled ? 'var(--text-muted)' : danger ? 'var(--error)' : 'var(--text-primary)',
                  opacity: disabled ? 0.4 : 1,
                  gap: 8,
                }}
                onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
              >
                <span style={{ marginRight: 8 }}>{icon}</span>{label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    {noteOpenId === s.id && (
      <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <textarea
          autoFocus
          value={noteText}
          onChange={e => props.onSetNoteText(e.target.value)}
          placeholder="세션 메모 입력..."
          rows={3}
          maxLength={200}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 6px',
            fontSize: 11,
            resize: 'none',
            maxHeight: 80,
            fontFamily: 'var(--font-ui)',
            boxSizing: 'border-box',
            outline: 'none',
          }}
          onKeyDown={async (e) => {
            e.stopPropagation()
            if (e.key === 'Escape') props.onNoteOpenId(null)
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              await props.onNoteSave(s.id)
            }
          }}
        />
        <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
          <button
            onClick={e => { e.stopPropagation(); props.onNoteOpenId(null) }}
            style={{ fontSize: 10, padding: '2px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            취소
          </button>
          <button
            onClick={async (e) => { e.stopPropagation(); await props.onNoteSave(s.id) }}
            style={{ fontSize: 10, padding: '2px 6px', background: 'var(--accent)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer' }}
          >
            {noteSaving ? '...' : '저장'}
          </button>
        </div>
      </div>
    )}
    {/* Inline tag input */}
    {inlineTagInput === s.id && (
      <div
        style={{ padding: '4px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>🏷</span>
        <input
          ref={inlineTagRef}
          autoFocus
          value={inlineTagValue}
          onChange={e => props.onSetInlineTagValue(e.target.value)}
          onKeyDown={async e => {
            e.stopPropagation()
            if (e.key === 'Enter') { e.preventDefault(); await props.onCommitInlineTag(s.id) }
            if (e.key === 'Escape') { props.onSetInlineTagInput(null); props.onSetInlineTagValue('') }
          }}
          onBlur={() => { props.onSetInlineTagInput(null); props.onSetInlineTagValue('') }}
          placeholder="태그 입력 후 Enter..."
          style={{
            flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--accent)', borderRadius: 3, padding: '2px 6px',
            fontSize: 11, outline: 'none',
          }}
        />
      </div>
    )}
    {/* Fork children */}
    {depth < 10 && forkChildren.map(child => props.renderSessionItem(child, depth + 1))}
    </div>
  )
})
