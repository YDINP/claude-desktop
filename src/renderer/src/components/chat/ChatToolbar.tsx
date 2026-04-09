import React, { memo } from 'react'
import { t } from '../../utils/i18n'

// ── System Prompt Editor ─────────────────────────────────────────────────────
export const SystemPromptEditor = memo(function SystemPromptEditor({
  customSystemPrompt, setCustomSystemPrompt, onClose,
}: {
  customSystemPrompt: string
  setCustomSystemPrompt: (v: string) => void
  onClose: () => void
}) {
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '8px',
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('chat.systemPromptLabel', '커스텀 시스템 프롬프트')}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: customSystemPrompt.length > 1800 ? '#f87171' : 'var(--text-muted)' }}>
            {customSystemPrompt.length} / 2000
          </span>
          {customSystemPrompt && (
            <button onClick={() => setCustomSystemPrompt('')} style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
          )}
        </div>
      </div>
      <textarea
        value={customSystemPrompt}
        onChange={e => setCustomSystemPrompt(e.target.value.slice(0, 2000))}
        placeholder={t('settings.globalPrompt.placeholder', 'Claude에게 항상 전달할 전역 지침을 입력하세요...')}
        rows={3}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          color: 'var(--text-primary)',
          fontSize: 11,
          padding: '4px 8px',
          resize: 'vertical',
          fontFamily: 'inherit',
          outline: 'none',
          minHeight: 48,
          maxHeight: 160,
        }}
      />
      <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4 }}>
        {t('chat.systemPromptVars', '지원 변수: {{date}}(YYYY-MM-DD), {{time}}(HH:MM), {{project}}(프로젝트명), {{model}}(모델명), {{day}}(요일)')}
      </div>
    </div>
  )
})

// ── Session Summary Panel ────────────────────────────────────────────────────
export const SessionSummaryPanel = memo(function SessionSummaryPanel({
  summaryLoading, summaryText, onRegenerate, onClose,
}: {
  summaryLoading: boolean
  summaryText: string
  onRegenerate: () => void
  onClose: () => void
}) {
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      borderLeft: '4px solid var(--accent)',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: summaryLoading ? 'none' : '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{t('chat.sessionSummaryTitle', '📝 세션 요약')}</span>
        <button
          onClick={onRegenerate}
          disabled={summaryLoading}
          title={t('chat.regenerate', '🔄 재생성')}
          style={{
            background: 'none', border: 'none',
            color: summaryLoading ? 'var(--text-muted)' : 'var(--accent)',
            fontSize: 11, cursor: summaryLoading ? 'default' : 'pointer', padding: '1px 6px',
          }}
        >{t('chat.regenerate', '🔄 재생성')}</button>
        <button
          onClick={onClose}
          title={t('common.close', '닫기')}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)',
            fontSize: 14, cursor: 'pointer', padding: '1px 6px', marginLeft: 'auto', lineHeight: 1,
          }}
        >×</button>
      </div>
      <div style={{
        padding: '12px 16px',
        fontSize: 13,
        lineHeight: 1.6,
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {summaryLoading ? t('chat.summaryLoading', '요약 생성 중...') : summaryText}
      </div>
    </div>
  )
})

// ── Chat Search Bar ─────────────────────────────────────────────────────────
export const ChatSearchBar = memo(function ChatSearchBar({
  searchQuery, matchCount, safeMatchIdx, isSearchPending,
  searchInputRef, onSearchChange, onSearchPrev, onSearchNext, onSearchKeyDown, onClose,
}: {
  searchQuery: string
  matchCount: number
  safeMatchIdx: number
  isSearchPending: boolean
  searchInputRef: React.RefObject<HTMLInputElement>
  onSearchChange: (v: string) => void
  onSearchPrev: () => void
  onSearchNext: () => void
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onClose: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <input
        ref={searchInputRef}
        placeholder={t('chat.searchPlaceholder', '대화 검색...')}
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        onKeyDown={onSearchKeyDown}
        style={{
          flex: 1,
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '3px 8px',
          fontSize: 12,
          outline: 'none',
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 72, textAlign: 'center' }}>
        {matchCount > 0 ? t('chat.searchMatchCount', '{idx} / {n}개 매칭').replace('{idx}', String(safeMatchIdx + 1)).replace('{n}', String(matchCount)) : (searchQuery ? t('chat.searchNoMatch', '0개 매칭') : '')}
        {isSearchPending && searchQuery && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>...</span>
        )}
      </span>
      <button onClick={onSearchPrev} disabled={matchCount === 0} title={t('chat.searchPrev', '이전 (Shift+Enter)')} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontSize: 13, cursor: matchCount > 0 ? 'pointer' : 'default', padding: '2px 4px',
      }}>▲</button>
      <button onClick={onSearchNext} disabled={matchCount === 0} title={t('chat.searchNext', '다음 (Enter)')} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontSize: 13, cursor: matchCount > 0 ? 'pointer' : 'default', padding: '2px 4px',
      }}>▼</button>
      <button onClick={onClose} title={t('chat.close', '닫기') + ' (Esc)'} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontSize: 14, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
      }}>×</button>
    </div>
  )
})
