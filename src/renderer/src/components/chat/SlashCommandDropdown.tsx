import React from 'react'
import { SlashCommandRegistry, type SlashCommandCompat } from '../../domains/commands/SlashCommandRegistry'

interface SlashCommandDropdownProps {
  groupedCmds: ReturnType<typeof SlashCommandRegistry.getGrouped>
  flatCmds: SlashCommandCompat[]
  slashSelected: number
  setSlashSelected: (idx: number) => void
  onSelect: (cmd: SlashCommandCompat) => void
}

export function SlashCommandDropdown({
  groupedCmds,
  flatCmds,
  slashSelected,
  setSlashSelected,
  onSelect,
}: SlashCommandDropdownProps) {
  if (flatCmds.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: 12,
      right: 60,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      marginBottom: 4,
      overflow: 'hidden',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
      zIndex: 100,
      maxHeight: 360,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '4px 10px 2px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', userSelect: 'none', flexShrink: 0 }}>
        ↑↓ 탐색 · Enter/Tab 선택 · Space 인자 입력 · Esc 닫기
      </div>
      <div role="listbox" aria-label="슬래시 커맨드" style={{ overflowY: 'auto', flex: 1 }}>
      {(() => {
        let flatIdx = 0
        return groupedCmds.map((group) => (
          <div key={group.category}>
            {groupedCmds.length > 1 && (
              <div style={{
                padding: '4px 12px 2px',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-tertiary, var(--bg-secondary))',
                borderBottom: '1px solid var(--border)',
                userSelect: 'none',
                letterSpacing: 0.5,
              }}>
                {group.icon} {group.label}
              </div>
            )}
            {group.commands.map((c) => {
              const idx = flatIdx++
              const isRecent = SlashCommandRegistry.getRecentCmds().includes(c.cmd)
              const categoryColor = c.category === 'workflow' ? '#a78bfa'
                : c.category === 'plugin' ? '#4ade80'
                : c.category === 'custom' ? 'var(--warning, #e5a50a)'
                : 'var(--accent)'
              return (
                <div
                  key={`${c.category ?? 'builtin'}-${c.cmd}`}
                  role="option"
                  aria-selected={idx === slashSelected}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => onSelect(c)}
                  onMouseEnter={() => setSlashSelected(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    background: idx === slashSelected ? 'var(--bg-hover)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: 11, marginRight: 2, flexShrink: 0 }}>
                    {c.icon || (c.category === 'workflow' ? '\uD83D\uDCC4' : c.category === 'plugin' ? '\uD83D\uDD0C' : c.category === 'custom' ? '\u2699' : '\u26A1')}
                  </span>
                  <span style={{ fontSize: 12, color: categoryColor, fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: 90 }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description}
                  </span>
                  {c.args && c.args.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                      {c.args.map(a => a.required ? `<${a.name}>` : `[${a.name}]`).join(' ')}
                    </span>
                  )}
                  {isRecent && (
                    <span style={{ fontSize: 9, color: 'var(--accent)', opacity: 0.5, marginLeft: 'auto' }}>recent</span>
                  )}
                </div>
              )
            })}
          </div>
        ))
      })()}
      </div>
    </div>
  )
}
