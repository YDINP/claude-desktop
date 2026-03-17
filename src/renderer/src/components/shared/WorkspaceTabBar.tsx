import { useState } from 'react'

export interface WorkspaceItem {
  id: string
  path: string
}

export function WorkspaceTabBar({ workspaces, activeId, workspaceNames, onSelect, onClose, onAdd, onRename }: {
  workspaces: WorkspaceItem[]
  activeId: string
  workspaceNames: Record<string, string>
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
}) {
  const [tabMenu, setTabMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const [renamingTab, setRenamingTab] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const getTabName = (id: string) => {
    const ws = workspaces.find(w => w.id === id)
    return workspaceNames[id] ?? (ws ? (ws.path.split(/[\\/]/).pop() ?? ws.path) : id)
  }

  const applyRename = (id: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed) onRename(id, trimmed)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      height: 28,
      overflowX: 'auto',
    }}>
      {workspaces.map(ws => {
        const name = getTabName(ws.id)
        const isActive = ws.id === activeId
        const isRenaming = renamingTab === ws.id
        return (
          <div
            key={ws.id}
            onClick={() => onSelect(ws.id)}
            onContextMenu={e => { e.preventDefault(); setTabMenu({ tabId: ws.id, x: e.clientX, y: e.clientY }) }}
            title={ws.path}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0 10px', flexShrink: 0,
              fontSize: 12, cursor: 'pointer', userSelect: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-primary)' : 'transparent',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span style={{ fontSize: 10, opacity: 0.7 }}>⬡</span>
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => { applyRename(renamingTab!, renameValue); setRenamingTab(null) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { applyRename(renamingTab!, renameValue); setRenamingTab(null) }
                  if (e.key === 'Escape') setRenamingTab(null)
                  e.stopPropagation()
                }}
                onClick={e => e.stopPropagation()}
                style={{ width: 80, background: 'var(--bg-primary)', color: 'inherit', border: '1px solid var(--accent)', borderRadius: 3, padding: '1px 4px', fontSize: 12 }}
              />
            ) : (
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
            )}
            {workspaces.length > 1 && (
              <span
                onClick={e => { e.stopPropagation(); onClose(ws.id) }}
                style={{ opacity: 0.4, fontSize: 14, lineHeight: 1, padding: '0 1px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
              >×</span>
            )}
          </div>
        )
      })}
      <div
        onClick={onAdd}
        title="Open folder in new workspace"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, flexShrink: 0, cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 16,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
      >+</div>

      {tabMenu && (
        <div
          style={{
            position: 'fixed', top: tabMenu.y, left: tabMenu.x, zIndex: 9999,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onMouseLeave={() => setTabMenu(null)}
        >
          {[
            {
              label: '이름 변경',
              action: () => { setRenamingTab(tabMenu.tabId); setRenameValue(getTabName(tabMenu.tabId)); setTabMenu(null) },
            },
            {
              label: '탭 닫기',
              action: () => { onClose(tabMenu.tabId); setTabMenu(null) },
            },
            {
              label: '새 탭',
              action: () => { onAdd(); setTabMenu(null) },
            },
          ].map(item => (
            <div
              key={item.label}
              onClick={item.action}
              style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, #2a2a2a)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
