import React, { memo } from 'react'

interface Snippet {
  id: string
  name: string
  content: string
  language?: string
  category?: string
  shortcut?: string
  createdAt: number
}

// ── Mention (@file) dropdown ──
interface MentionDropdownProps {
  filteredFiles: string[]
  mentionSelected: number
  setMentionSelected: (idx: number) => void
  onSelect: (filePath: string) => void
}

export const MentionDropdown = memo(function MentionDropdown({ filteredFiles, mentionSelected, setMentionSelected, onSelect }: MentionDropdownProps) {
  if (filteredFiles.length === 0) return null
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
    }}>
      <div style={{ padding: '4px 10px 2px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
        ↑↓ 탐색 · Enter/Tab 선택 · Esc 닫기
      </div>
      {filteredFiles.map((filePath, i) => {
        const fileName = filePath.split(/[/\\]/).pop() ?? filePath
        const dirPart = filePath.slice(0, filePath.length - fileName.length).replace(/[/\\]$/, '')
        return (
          <div
            key={filePath}
            onClick={() => onSelect(filePath)}
            onMouseEnter={() => setMentionSelected(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 12px',
              cursor: 'pointer',
              background: i === mentionSelected ? 'var(--bg-hover)' : 'transparent',
              borderBottom: i < filteredFiles.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>
              {dirPart}
            </span>
          </div>
        )
      })}
    </div>
  )
})

// ── Template var autocomplete dropdown ──
interface VarSuggestionDropdownProps {
  varSuggestions: string[]
  varSuggestionsIdx: number
  setVarSuggestionsIdx: (idx: number) => void
  onSelect: (varName: string) => void
}

export const VarSuggestionDropdown = memo(function VarSuggestionDropdown({ varSuggestions, varSuggestionsIdx, setVarSuggestionsIdx, onSelect }: VarSuggestionDropdownProps) {
  if (varSuggestions.length === 0) return null
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
      zIndex: 110,
    }}>
      <div style={{ padding: '4px 10px 2px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
        {'{{'} 변수 · ↑↓ 탐색 · Enter/Tab 선택 · Esc 닫기
      </div>
      {varSuggestions.map((varName, i) => (
        <div
          key={varName}
          onClick={() => onSelect(varName)}
          onMouseEnter={() => setVarSuggestionsIdx(i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 12px',
            cursor: 'pointer',
            background: i === varSuggestionsIdx ? 'var(--bg-hover)' : 'transparent',
            borderBottom: i < varSuggestions.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {`{{${varName}}}`}
          </span>
        </div>
      ))}
    </div>
  )
})

// ── Snippet shortcut dropdown ──
interface SnippetDropdownProps {
  snippetMatches: Snippet[]
  snippetMenuIdx: number
  setSnippetMenuIdx: (idx: number) => void
  onSelect: (snippet: Snippet) => void
}

export const SnippetDropdown = memo(function SnippetDropdown({ snippetMatches, snippetMenuIdx, setSnippetMenuIdx, onSelect }: SnippetDropdownProps) {
  if (snippetMatches.length === 0) return null
  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      marginBottom: 4,
      overflow: 'hidden',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
      zIndex: 50,
    }}>
      <div style={{ padding: '4px 10px 2px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
        snippets · ↑↓ 탐색 · Enter 삽입 · Esc 닫기
      </div>
      {snippetMatches.map((s, i) => (
        <div
          key={s.id}
          onClick={() => onSelect(s)}
          onMouseEnter={() => setSnippetMenuIdx(i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 12px',
            cursor: 'pointer',
            background: i === snippetMenuIdx ? 'var(--accent)' : 'transparent',
            borderBottom: i < snippetMatches.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            padding: '1px 6px',
            borderRadius: 3,
            flexShrink: 0,
          }}>
            {s.shortcut}
          </span>
          <span style={{ fontSize: 12, color: i === snippetMenuIdx ? '#fff' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.name}
          </span>
        </div>
      ))}
    </div>
  )
})
