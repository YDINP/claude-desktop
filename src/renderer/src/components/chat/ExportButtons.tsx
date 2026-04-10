import React, { useState, useCallback } from 'react'
import type { ChatMessage } from '../../domains/chat/domain'
import { t } from '../../utils/i18n'

export function ExportConversationButton({ messages }: { messages: ChatMessage[] }) {
  if (!messages.length) return null
  const handleExport = async () => {
    const md = messages.map(m => `## ${m.role === 'user' ? 'You' : 'Claude'}\n\n${m.text}`).join('\n\n---\n\n')
    const title = messages.find(m => m.role === 'user')?.text.slice(0, 30).replace(/[^\w\s가-힣]/g, '').trim() ?? 'conversation'
    await window.api.saveFile(md, `${title}.md`)
  }
  return (
    <button onClick={handleExport} title={t('export.saveFile', '대화를 파일로 저장')} style={{
      background: 'none', border: 'none', color: 'var(--text-muted)',
      fontSize: 11, cursor: 'pointer', padding: '2px 6px',
    }}>
      {t('export.saveBtn', '💾 내보내기')}
    </button>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function generateChatHtml(messages: ChatMessage[], sessionName?: string): string {
  const rows = messages.map(m => `
    <div class="message ${m.role}">
      <div class="meta">${m.role === 'user' ? 'You' : 'Claude'}${m.timestamp ? ' · ' + new Date(m.timestamp).toLocaleString('ko-KR') : ''}</div>
      <div class="text">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div>
    </div>`).join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(sessionName ?? 'Chat Export')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; background: #1e1e2e; color: #cdd6f4; padding: 0 20px; }
  h1 { color: #89b4fa; font-size: 18px; margin-bottom: 24px; }
  .message { padding: 16px; border-bottom: 1px solid #313244; }
  .message.user { background: #262637; border-radius: 6px; margin: 8px 0; }
  .meta { font-size: 11px; font-weight: 600; color: #89b4fa; text-transform: uppercase; margin-bottom: 8px; }
  .message.assistant .meta { color: #a6e3a1; }
  .text { font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
<h1>${escapeHtml(sessionName ?? 'Chat Export')}</h1>
${rows}
</body>
</html>`
}

export function ExportHtmlButton({ messages, sessionName }: { messages: ChatMessage[]; sessionName?: string }) {
  if (!messages.length) return null
  const handleExport = async () => {
    const filePath = await window.api.showSaveDialog({
      defaultPath: `${sessionName ?? 'chat'}.html`,
      filters: [{ name: 'HTML Files', extensions: ['html'] }],
    })
    if (!filePath) return
    const html = generateChatHtml(messages, sessionName)
    await window.api.exportHtml(filePath, html)
  }
  return (
    <button onClick={handleExport} title={t('export.html', 'HTML로 내보내기')} style={{
      background: 'none', border: 'none', color: 'var(--text-muted)',
      cursor: 'pointer', fontSize: 12, padding: '2px 6px',
    }}>
      ⬇ HTML
    </button>
  )
}

export function ExportPdfButton({ messages, sessionId }: { messages: ChatMessage[]; sessionId: string | null }) {
  const [exporting, setExporting] = useState(false)
  if (!messages.length || !sessionId) return null
  const handleExport = async () => {
    setExporting(true)
    try {
      await window.api.sessionExportPdf(sessionId)
    } finally {
      setExporting(false)
    }
  }
  return (
    <button onClick={handleExport} disabled={exporting} title={t('export.pdf', 'PDF로 내보내기')} style={{
      background: 'none', border: 'none', color: exporting ? 'var(--text-muted)' : 'var(--text-muted)',
      cursor: exporting ? 'default' : 'pointer', fontSize: 12, padding: '2px 6px',
    }}>
      {exporting ? '...' : '⬇ PDF'}
    </button>
  )
}

export function CopyConversationButton({ messages }: { messages: ChatMessage[] }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    if (!messages.length) return
    const md = messages.map(m => `**${m.role === 'user' ? 'You' : 'Claude'}**\n\n${m.text}`).join('\n\n---\n\n')
    navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [messages])
  if (!messages.length) return null
  return (
    <button
      onClick={copy}
      title={t('export.copyAll', '대화 전체 복사 (Markdown)')}
      style={{
        background: 'none', border: 'none',
        color: copied ? 'var(--success)' : 'var(--text-muted)',
        fontSize: 11, cursor: 'pointer', padding: '2px 6px',
        marginRight: 'auto',
      }}
    >
      {copied ? t('export.copied', '✓ 복사됨') : t('export.copy', '📋 대화 복사')}
    </button>
  )
}
