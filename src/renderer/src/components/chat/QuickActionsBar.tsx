import React, { useState, useCallback } from 'react'

interface QuickAction {
  id: string
  label: string
  prompt: string
}

const QUICK_ACTIONS_KEY = 'quick-actions'

interface QuickActionsBarProps {
  quickActions: QuickAction[]
  setQuickActions: (actions: QuickAction[]) => void
  onQuickAction: (prompt: string) => void
}

export function QuickActionsBar({ quickActions, setQuickActions, onQuickAction }: QuickActionsBarProps) {
  const [editingAction, setEditingAction] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editPrompt, setEditPrompt] = useState('')

  const saveQuickActionEdit = useCallback(() => {
    if (!editingAction) return
    const updated = quickActions.map(a => a.id === editingAction ? { ...a, label: editLabel, prompt: editPrompt } : a)
    setQuickActions(updated)
    localStorage.setItem(QUICK_ACTIONS_KEY, JSON.stringify(updated))
    setEditingAction(null)
  }, [editingAction, editLabel, editPrompt, quickActions, setQuickActions])

  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 0 4px', flexWrap: 'wrap' }}>
      {quickActions.map(action => (
        <div key={action.id} style={{ position: 'relative' }}>
          {editingAction === action.id ? (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, zIndex: 100,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 6, padding: 8, width: 220,
            }}>
              <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                placeholder="레이블"
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: 4,
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 3, padding: '3px 6px', color: 'var(--text-primary)', fontSize: 11 }} />
              <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
                placeholder="프롬프트"
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: 4,
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 3, padding: '3px 6px', color: 'var(--text-primary)', fontSize: 11,
                  resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingAction(null)}
                  style={{ fontSize: 10, padding: '2px 8px', background: 'none',
                    border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                    color: 'var(--text-muted)' }}>취소</button>
                <button onClick={saveQuickActionEdit}
                  style={{ fontSize: 10, padding: '2px 8px',
                    background: 'var(--accent)', border: 'none', borderRadius: 3,
                    cursor: 'pointer', color: 'white' }}>저장</button>
              </div>
            </div>
          ) : null}
          <button
            onClick={() => onQuickAction(action.prompt)}
            onContextMenu={e => {
              e.preventDefault()
              setEditLabel(action.label)
              setEditPrompt(action.prompt)
              setEditingAction(action.id)
            }}
            title={`${action.prompt}\n(우클릭: 편집)`}
            style={{
              fontSize: 10, padding: '2px 8px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 10, cursor: 'pointer', color: 'var(--text-muted)',
              transition: 'all 0.1s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            {action.label}
          </button>
        </div>
      ))}
    </div>
  )
}

interface MessageTemplate {
  id: string
  title: string
  content: string
  createdAt: number
}

const MAX_TEMPLATES = 20

interface TemplatePanelProps {
  text: string
  templates: MessageTemplate[]
  onSaveTemplates: (templates: MessageTemplate[]) => void
  onInsertTemplate: (tpl: MessageTemplate) => void
  onClose: () => void
}

export function TemplatePanel({ text, templates, onSaveTemplates, onInsertTemplate, onClose }: TemplatePanelProps) {
  const [templateSearch, setTemplateSearch] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  const handleSaveTemplate = () => {
    const title = newTemplateName.trim()
    if (!title || !text.trim()) return
    if (templates.length >= MAX_TEMPLATES) return
    const newTemplate: MessageTemplate = {
      id: `tpl-${Date.now()}`,
      title,
      content: text.trim(),
      createdAt: Date.now(),
    }
    onSaveTemplates([newTemplate, ...templates])
    setNewTemplateName('')
    setSavingTemplate(false)
  }

  const handleDeleteTemplate = (id: string) => {
    onSaveTemplates(templates.filter(t => t.id !== id))
  }

  const filteredTemplates = templateSearch.trim()
    ? templates.filter(t =>
        t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.content.toLowerCase().includes(templateSearch.toLowerCase())
      )
    : templates

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: 8,
      marginBottom: 4,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, flex: 1 }}>📋 템플릿</span>
        {savingTemplate ? (
          <input
            autoFocus
            value={newTemplateName}
            onChange={e => setNewTemplateName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleSaveTemplate() }
              if (e.key === 'Escape') { setSavingTemplate(false); setNewTemplateName('') }
            }}
            placeholder="템플릿 제목..."
            style={{
              fontSize: 12,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-light)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              padding: '3px 6px',
              flex: 1,
              outline: 'none',
            }}
          />
        ) : null}
        {savingTemplate ? (
          <>
            <button
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim() || !text.trim()}
              style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
            >
              저장
            </button>
            <button
              onClick={() => { setSavingTemplate(false); setNewTemplateName('') }}
              style={{ fontSize: 11, background: 'none', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', padding: '3px 6px' }}
            >
              취소
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { if (text.trim()) setSavingTemplate(true) }}
              disabled={!text.trim() || templates.length >= MAX_TEMPLATES}
              title={templates.length >= MAX_TEMPLATES ? '최대 20개' : '현재 입력 저장'}
              style={{
                fontSize: 11,
                background: 'none',
                color: text.trim() && templates.length < MAX_TEMPLATES ? 'var(--accent)' : 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 8px',
                cursor: text.trim() && templates.length < MAX_TEMPLATES ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              + 현재 입력 저장
            </button>
            <button
              onClick={onClose}
              style={{ fontSize: 13, background: 'none', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
            >
              ×
            </button>
          </>
        )}
      </div>
      {/* Search */}
      <input
        value={templateSearch}
        onChange={e => setTemplateSearch(e.target.value)}
        placeholder="검색..."
        style={{
          width: '100%',
          fontSize: 12,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--text-primary)',
          padding: '4px 8px',
          marginBottom: 4,
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {/* Template list */}
      {filteredTemplates.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 2px' }}>
          {templates.length === 0 ? '저장된 템플릿이 없습니다.' : '검색 결과 없음'}
        </div>
      ) : (
        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
          {filteredTemplates.map(tpl => (
            <div
              key={tpl.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 6px',
                borderRadius: 4,
                cursor: 'default',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>💬</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tpl.title}
              </span>
              <button
                onClick={() => onInsertTemplate(tpl)}
                style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}
              >
                삽입
              </button>
              <button
                onClick={() => handleDeleteTemplate(tpl.id)}
                style={{ fontSize: 13, background: 'none', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
