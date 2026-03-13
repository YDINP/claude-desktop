import { useState, useRef, memo, useMemo, useEffect, useCallback, useDeferredValue, lazy, Suspense } from 'react'
import React from 'react'
import type { ChatMessage } from '../../stores/chat-store'
import { ToolUseIndicator } from './ToolUseIndicator'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
const MermaidBlock = lazy(() => import('./MermaidBlock').then(m => ({ default: m.MermaidBlock })))
import { clipboardStore } from '../../utils/clipboard-store'
import { ThinkingPanel } from './ThinkingPanel'

const RUNNABLE_LANGS = ['bash', 'sh', 'shell', 'zsh', 'fish', 'cmd', 'powershell', 'ps1']

function shortModelName(model: string): string {
  if (model.includes('opus-4')) return 'Opus 4'
  if (model.includes('sonnet-4')) return 'Sonnet 4'
  if (model.includes('haiku-4')) return 'Haiku 4'
  if (model.includes('3-5-sonnet')) return 'Sonnet 3.5'
  if (model.includes('3-5-haiku')) return 'Haiku 3.5'
  return model.slice(0, 12)
}

const FILE_PATH_REGEX = /([A-Za-z]:[\\\/][^\s"'`<>|?*\n,;]+|\/(?:[a-zA-Z0-9._\-]+\/)+[a-zA-Z0-9._\-]+)/g

function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ background: 'rgba(255,200,0,0.35)', color: 'inherit', borderRadius: 2 }}>
        {part}
      </mark>
    ) : part
  )
}

function linkifyPaths(text: string, onOpenFile: (path: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  const regex = new RegExp(FILE_PATH_REGEX.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const path = match[1]
    parts.push(
      <span
        key={match.index}
        onClick={() => onOpenFile(path)}
        title={`파일 열기: ${path}`}
        style={{
          color: 'var(--accent)',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9em',
        }}
      >
        {path}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function runInSandbox(code: string): { output: string[]; error?: string } {
  const logs: string[] = []
  const sandboxConsole = {
    log: (...args: any[]) => logs.push(args.map(String).join(' ')),
    error: (...args: any[]) => logs.push('Error: ' + args.map(String).join(' ')),
    warn: (...args: any[]) => logs.push('Warn: ' + args.map(String).join(' ')),
  }
  try {
    const fn = new Function('console', code)
    fn(sandboxConsole)
    return { output: logs }
  } catch (e) {
    return { output: logs, error: String(e) }
  }
}

const JS_LANGS = ['javascript', 'js']

const DOC_LANGS = ['ts', 'tsx', 'js', 'jsx', 'typescript', 'javascript', 'py', 'python', 'java', 'go', 'rust', 'cpp', 'c']

const CodeBlock = memo(function CodeBlock({
  language,
  codeString,
  onRunInTerminal,
  onQuickAction,
}: {
  language: string
  codeString: string
  onRunInTerminal?: (code: string) => void
  onQuickAction?: (action: 'explain' | 'optimize' | 'fix', code: string, language: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [runOutput, setRunOutput] = useState<string[] | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const [docCode, setDocCode] = useState<string | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docCopied, setDocCopied] = useState(false)
  const [shellResult, setShellResult] = useState<{ ok: boolean; output: string } | null>(null)
  const [shellRunning, setShellRunning] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString)
    clipboardStore.push(codeString, `code:${language}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleExplain = async () => {
    if (explainLoading) return
    if (explanation !== null) { setExplanation(null); return }
    setExplainLoading(true)
    try {
      const text = await window.api.explainCode(codeString, language)
      setExplanation(text)
    } catch (e) {
      console.error('explainCode failed', e)
    } finally {
      setExplainLoading(false)
    }
  }

  const handleGenerateDocs = async () => {
    if (docLoading) return
    if (docCode !== null) { setDocCode(null); return }
    setDocLoading(true)
    try {
      const result = await window.api.generateDocs({ code: codeString, lang: language })
      setDocCode(result)
    } catch (e) {
      console.error('generateDocs failed', e)
    } finally {
      setDocLoading(false)
    }
  }

  const handleDocCopy = () => {
    if (!docCode) return
    navigator.clipboard.writeText(docCode)
    setDocCopied(true)
    setTimeout(() => setDocCopied(false), 1500)
  }

  const handleRunJs = () => {
    const result = runInSandbox(codeString)
    setRunOutput(result.output.slice(0, 50))
    setRunError(result.error ?? null)
    setHasRun(true)
  }

  const handleShellExec = async () => {
    if (shellRunning) return
    setShellRunning(true)
    setShellResult(null)
    try {
      const res = await window.api.shellExec?.(codeString)
      setShellResult(res ?? { ok: false, output: 'shellExec not available' })
    } catch (e: any) {
      setShellResult({ ok: false, output: String(e) })
    } finally {
      setShellRunning(false)
    }
  }

  const isRunnable = onRunInTerminal && RUNNABLE_LANGS.includes(language.toLowerCase())
  const isShellExecable = RUNNABLE_LANGS.includes(language.toLowerCase())
  const isJsRunnable = JS_LANGS.includes(language.toLowerCase()) && codeString.length < 1000
  const isDocable = DOC_LANGS.includes(language.toLowerCase())
  // Button right positions (each slot is ~52px wide):
  // Copy: 8
  // 💡explain: 60
  // 📝docs: 112 (no run) / 164 (with run)
  // ▶shell:exec (inline): 60 (when isShellExecable, no JS/terminal btn)
  //                        or 60 always when isShellExecable
  // ▶terminal: 112 (when both isShellExecable + isRunnable)
  // JS run: 60 (when isJsRunnable only)
  const hasAnyRunBtn = isRunnable || isJsRunnable || isShellExecable
  const docBtnRight = hasAnyRunBtn ? (isRunnable && isShellExecable ? 216 : 164) : 112
  const explainRight = hasAnyRunBtn ? (isRunnable && isShellExecable ? 164 : 112) : 60
  // inline exec button: right 60
  // terminal button (if also present): right 112
  const shellExecBtnRight = 60
  const terminalBtnRight = isShellExecable ? 112 : 60
  const runBtnRight = 60

  const hasOutput = runOutput !== null

  return (
    <div
      style={{ position: 'relative', margin: '8px 0' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Code block header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border)',
        borderRadius: '4px 4px 0 0',
        padding: '4px 12px',
        fontSize: 11,
      }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'lowercase' }}>
          {language || 'text'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {codeString.split('\n').length} lines
        </span>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        showLineNumbers={codeString.split('\n').length > 3}
        lineNumberStyle={{ color: 'rgba(150,150,170,0.4)', fontSize: 10, minWidth: '2.5em', userSelect: 'none' }}
        customStyle={{
          background: '#1e1e2e',
          borderRadius: (explanation || hasOutput || docCode || shellResult) ? '0 0 0 0' : '0 0 4px 4px',
          padding: 12,
          fontSize: 12,
          margin: 0,
        }}
      >
        {codeString}
      </SyntaxHighlighter>
      {isShellExecable && (
        <button
          onClick={handleShellExec}
          title="인라인 실행 (shell:exec)"
          style={{
            position: 'absolute',
            top: 6,
            right: shellExecBtnRight,
            background: shellResult ? (shellResult.ok ? '#1a3a2e' : '#3a1a1a') : '#1e2a1e',
            color: shellResult ? (shellResult.ok ? '#86efac' : '#f87171') : '#4ade80',
            border: 'none',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 11,
            cursor: shellRunning ? 'not-allowed' : 'pointer',
          }}
        >
          {shellRunning ? '⟳' : '▶'}
        </button>
      )}
      {isRunnable && (
        <button
          onClick={() => onRunInTerminal!(codeString)}
          title="터미널에서 실행"
          style={{
            position: 'absolute',
            top: 6,
            right: terminalBtnRight,
            background: '#1e3a2e',
            color: '#4ade80',
            border: 'none',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          $ 터미널
        </button>
      )}
      {isJsRunnable && !isRunnable && !isShellExecable && (
        <button
          onClick={handleRunJs}
          title="브라우저 샌드박스에서 JS 실행"
          style={{
            position: 'absolute',
            top: 6,
            right: runBtnRight,
            background: hasRun ? '#1e2a3e' : '#1e2a3e',
            color: '#7ec8a0',
            border: 'none',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {hasRun ? '⟳ 재실행' : '▶ 실행'}
        </button>
      )}
      {isDocable && (
        <button
          onClick={handleGenerateDocs}
          title={docCode ? '문서화 닫기' : 'JSDoc/docstring 생성'}
          style={{
            position: 'absolute',
            top: 6,
            right: docBtnRight,
            background: docCode ? '#1a2a3e' : '#3a3a4a',
            color: docCode ? '#4a90e2' : '#aaa',
            border: 'none',
            borderRadius: 3,
            padding: '2px 6px',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {docLoading ? '...' : docCode ? '✕' : '📝'}
        </button>
      )}
      <button
        onClick={handleExplain}
        title={explanation ? '설명 닫기' : 'AI 코드 설명'}
        style={{
          position: 'absolute',
          top: 6,
          right: explainRight,
          background: explanation ? '#2a3a5e' : '#3a3a4a',
          color: explanation ? '#60a5fa' : '#aaa',
          border: 'none',
          borderRadius: 3,
          padding: '2px 6px',
          fontSize: 11,
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {explainLoading ? '...' : explanation ? '✕' : '💡'}
      </button>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: copied ? '#2d5a27' : '#3a3a4a',
          color: copied ? '#7ec87a' : '#aaa',
          border: 'none',
          borderRadius: 3,
          padding: '2px 8px',
          fontSize: 11,
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      {explanation && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border)',
          borderRadius: hasOutput ? 0 : '0 0 4px 4px',
          fontSize: 12,
          color: 'var(--text-secondary, var(--text-muted))',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {explanation}
        </div>
      )}
      {hasOutput && (
        <div style={{
          background: '#0d1117',
          borderTop: '1px solid #30363d',
          borderRadius: '0 0 4px 4px',
          fontFamily: 'monospace',
          fontSize: 12,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            borderBottom: '1px solid #21262d',
          }}>
            <span style={{ color: '#7ec8a0', fontWeight: 600 }}>▶ 출력</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#6e7681', fontSize: 10 }}>
                {runError ? '오류 발생' : `실행 완료 (${runOutput!.length}줄)`}
              </span>
              <button
                onClick={() => { setRunOutput(null); setRunError(null) }}
                title="출력 닫기"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6e7681',
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: '0 2px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ padding: '6px 10px', minHeight: 24 }}>
            {runOutput!.length === 0 && !runError && (
              <span style={{ color: '#6e7681' }}>(출력 없음)</span>
            )}
            {runOutput!.map((line, i) => (
              <div key={i} style={{ color: '#7ec8a0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
            ))}
            {runError && (
              <div style={{ color: '#f85149', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: runOutput!.length > 0 ? 4 : 0 }}>{runError}</div>
            )}
          </div>
        </div>
      )}
      {shellResult && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border)',
          borderRadius: docCode ? 0 : '0 0 4px 4px',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '3px 10px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ color: shellResult.ok ? '#86efac' : '#f87171', fontSize: 10, fontWeight: 600 }}>
              {shellResult.ok ? '▶ 실행 결과' : '▶ 오류'}
            </span>
            <button
              onClick={() => setShellResult(null)}
              title="닫기"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                padding: '0 2px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: '8px 10px',
            fontSize: 12,
            color: shellResult.ok ? '#86efac' : '#f87171',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            {shellResult.output || '(출력 없음)'}
          </pre>
        </div>
      )}
      {docCode && (
        <div style={{
          background: '#0d1a2d',
          borderTop: '1px solid #2a3a5e',
          borderLeft: '4px solid #4a90e2',
          borderRadius: '0 0 4px 4px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            borderBottom: '1px solid #1a2a3e',
          }}>
            <span style={{ color: '#4a90e2', fontWeight: 600, fontSize: 11 }}>📝 문서화된 코드</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={handleDocCopy}
                style={{
                  background: docCopied ? '#1a3a2e' : '#1a2a3e',
                  color: docCopied ? '#7ec87a' : '#4a90e2',
                  border: 'none',
                  borderRadius: 3,
                  padding: '1px 7px',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                {docCopied ? '복사됨' : '복사'}
              </button>
              <button
                onClick={() => setDocCode(null)}
                title="닫기"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4a5568',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 2px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>
          <pre style={{
            margin: 0,
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#c9d1d9',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowX: 'auto',
          }}>
            {docCode}
          </pre>
        </div>
      )}
      {isHovered && onQuickAction && (
        <div style={{
          position: 'absolute',
          bottom: (explanation || hasOutput || docCode) ? undefined : 6,
          top: (explanation || hasOutput || docCode) ? undefined : undefined,
          marginTop: (explanation || hasOutput || docCode) ? 4 : undefined,
          left: 8,
          display: 'flex',
          gap: 4,
        }}>
          {[
            { action: 'explain' as const, label: '설명', title: '이 코드 설명' },
            { action: 'optimize' as const, label: '최적화', title: '성능 최적화' },
            { action: 'fix' as const, label: '수정', title: '버그 수정' },
          ].map(({ action, label, title }) => (
            <button
              key={action}
              onClick={() => onQuickAction(action, codeString, language)}
              title={title}
              style={{
                background: '#2a2a3e',
                color: '#94a3b8',
                border: '1px solid #3a3a4e',
                borderRadius: 3,
                padding: '1px 7px',
                fontSize: 10,
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3a3a5e'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#2a2a3e'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

const IMAGE_TAG_REGEX = /<image\s+path="([^"]+)"\s*\/?>/g

function preprocessImageTags(text: string): string {
  return text.replace(IMAGE_TAG_REGEX, (_, path: string) => {
    const filename = path.split(/[/\\]/).pop() ?? 'image'
    const uri = 'file://' + path.replace(/\\/g, '/')
    return `![${filename}](${uri})`
  })
}

function renderUserTextWithImages(
  text: string,
  onImageClick?: (src: string, alt?: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /<image\s+path="([^"]+)"\s*\/?>/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
          {text.slice(last, match.index)}
        </span>
      )
    }
    const path = match[1]
    const filename = path.split(/[/\\]/).pop() ?? 'image'
    const uri = 'file://' + path.replace(/\\/g, '/')
    parts.push(
      <InlineImage key={key++} src={uri} filename={filename} onImageClick={onImageClick} />
    )
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push(
      <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
        {text.slice(last)}
      </span>
    )
  }
  return parts
}

function InlineImage({
  src,
  alt,
  filename,
  onImageClick,
}: {
  src: string
  alt?: string
  filename: string
  onImageClick?: (src: string, alt?: string) => void
}) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          background: 'var(--bg-secondary)',
          borderRadius: 4,
          fontSize: 11,
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
      >
        &#128248; {filename}
      </span>
    )
  }
  return (
    <span style={{ display: 'block', margin: '4px 0' }}>
      <img
        src={src}
        alt={alt ?? filename}
        onClick={() => onImageClick?.(src, alt)}
        onError={() => setError(true)}
        style={{
          maxWidth: '100%',
          maxHeight: 300,
          borderRadius: 6,
          cursor: onImageClick ? 'zoom-in' : 'default',
          display: 'block',
        }}
      />
      <span style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 2 }}>
        {filename}
      </span>
    </span>
  )
}

function makeMdComponents(
  onRunInTerminal: (code: string) => void,
  onQuickAction?: (action: 'explain' | 'optimize' | 'fix', code: string, language: string) => void,
  onOpenFile?: (path: string) => void,
  onImageClick?: (src: string, alt?: string) => void
) {
  return {
    img({ src, alt }: { src?: string; alt?: string }) {
      if (!src) return null
      // Normalize local paths: absolute Windows/Unix paths → file:// URI
      let resolvedSrc = src
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('file://')) {
        resolvedSrc = 'file://' + src.replace(/\\/g, '/')
      }
      const filename = src.split(/[/\\]/).pop() ?? src
      return (
        <InlineImage
          src={resolvedSrc}
          alt={alt}
          filename={filename}
          onImageClick={onImageClick}
        />
      )
    },
    p({ children }: { children?: React.ReactNode }) {
      if (!onOpenFile) return <p>{children}</p>
      const processed = React.Children.map(children, child =>
        typeof child === 'string' ? linkifyPaths(child, onOpenFile) : child
      )
      return <p>{processed}</p>
    },
    li({ children }: { children?: React.ReactNode }) {
      if (!onOpenFile) return <li>{children}</li>
      const processed = React.Children.map(children, child =>
        typeof child === 'string' ? linkifyPaths(child, onOpenFile) : child
      )
      return <li>{processed}</li>
    },
    a({ href, children }: { href?: string; children?: React.ReactNode }) {
      return (
        <a
          href={href}
          onClick={(e) => { e.preventDefault(); if (href) window.api.openExternal(href) }}
          style={{ color: 'var(--accent)', textDecoration: 'underline' }}
        >
          {children}
        </a>
      )
    },
    table({ children }: { children?: React.ReactNode }) {
      return (
        <div style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--chat-font-size, 13px)' }}>
            {children}
          </table>
        </div>
      )
    },
    th({ children }: { children?: React.ReactNode }) {
      return (
        <th style={{
          padding: '6px 12px', textAlign: 'left', fontWeight: 600,
          borderBottom: '2px solid var(--border)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
        }}>
          {children}
        </th>
      )
    },
    td({ children }: { children?: React.ReactNode }) {
      return (
        <td style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-secondary)',
        }}>
          {children}
        </td>
      )
    },
    tr({ children }: { children?: React.ReactNode }) {
      return <tr>{children}</tr>
    },
    code({ className, children, ...props }: { className?: string; children?: React.ReactNode; [key: string]: unknown }) {
      const match = /language-(\w+)/.exec(className || '')
      const codeString = String(children).replace(/\n$/, '')
      if (className?.includes('language-mermaid')) {
        return (
          <Suspense fallback={<div style={{ padding: 8, color: 'var(--text-muted)', fontSize: 12 }}>로딩 중...</div>}>
            <MermaidBlock code={codeString} />
          </Suspense>
        )
      }
      if (match) {
        return <CodeBlock language={match[1]} codeString={codeString} onRunInTerminal={onRunInTerminal} onQuickAction={onQuickAction} />
      }
      return (
        <code
          {...props}
          style={{
            background: '#2d2d30',
            padding: '2px 5px',
            borderRadius: 3,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          {children}
        </code>
      )
    },
  }
}

interface ContextMenu {
  x: number
  y: number
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢']

export const MessageBubble = memo(function MessageBubble({ msg, isLast, isStreaming, onRegenerate, isMatched, isCurrentMatch, highlightText, isSearchMatch, onRunInTerminal, onFork, onEditResend, onQuickAction, onBookmark, isBookmarked, onTogglePin, isPinned, onOpenFile, onReaction, onImageClick, onReplyTo, onSetNote, onPrevAlt, altIndex, altCount }: {
  msg: ChatMessage
  isLast?: boolean
  isStreaming?: boolean
  onRegenerate?: () => void
  onPrevAlt?: (index: number) => void
  altIndex?: number
  altCount?: number
  isMatched?: boolean
  isCurrentMatch?: boolean
  highlightText?: string
  isSearchMatch?: boolean
  onRunInTerminal?: (code: string) => void
  onFork?: () => void
  onEditResend?: (newText: string) => void
  onQuickAction?: (action: 'explain' | 'optimize' | 'fix', code: string, language: string) => void
  onBookmark?: () => void
  isBookmarked?: boolean
  onTogglePin?: () => void
  isPinned?: boolean
  onOpenFile?: (path: string) => void
  onReaction?: (emoji: string) => void
  onImageClick?: (src: string, alt?: string) => void
  onReplyTo?: () => void
  onSetNote?: (note: string) => void
}) {
  const isUser = msg.role === 'user'
  const isError = msg.isError === true
  const [isHovered, setIsHovered] = useState(false)
  const [msgCopied, setMsgCopied] = useState(false)
  const [mdCopied, setMdCopied] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [collapsed, setCollapsed] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState(msg.note ?? '')

  const [translation, setTranslation] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [showEditHistory, setShowEditHistory] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  const isLong = !isUser && msg.text.length > 2000
  const showCollapseToggle = isLong && !(isStreaming && isLast)

  const handleMsgCopy = () => {
    navigator.clipboard.writeText(msg.text)
    clipboardStore.push(msg.text, 'message')
    setMsgCopied(true)
    setTimeout(() => setMsgCopied(false), 1500)
  }

  const handleMdCopy = async () => {
    await navigator.clipboard.writeText(msg.text)
    clipboardStore.push(msg.text, 'message')
    setMdCopied(true)
    setTimeout(() => setMdCopied(false), 1500)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleDoubleClick = useCallback(() => {
    if (!onEditResend || isStreaming) return
    setEditText(msg.text)
    setIsEditing(true)
    setTimeout(() => {
      editTextareaRef.current?.focus()
      editTextareaRef.current?.select()
    }, 0)
  }, [onEditResend, isStreaming, msg.text])

  const handleTranslate = async () => {
    if (translating) return
    if (translation) { setShowTranslation(v => !v); return }
    setTranslating(true)
    try {
      const isKorean = /[가-힣]/.test(msg.text.slice(0, 100))
      const targetLang = isKorean ? 'English' : '한국어'
      const apiKey = localStorage.getItem('settings-anthropic-key') ?? ''
      if (!apiKey) { setTranslation('API 키 없음'); setShowTranslation(true); return }
      const body = JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: `Translate to ${targetLang}. Output translation only, no explanation:\n\n${msg.text.slice(0, 500)}` }]
      })
      const escapedBody = body.replace(/'/g, "'\\''")
      const res = await (window.api as any).shellExec?.(
        `curl -s https://api.anthropic.com/v1/messages -H "x-api-key: ${apiKey}" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d '${escapedBody}'`
      )
      if (res?.ok) {
        const parsed = JSON.parse(res.output)
        const translatedText = parsed?.content?.[0]?.text ?? '번역 실패'
        setTranslation(translatedText)
        setShowTranslation(true)
      } else {
        setTranslation('번역 실패: ' + (res?.output ?? ''))
        setShowTranslation(true)
      }
    } catch (e: any) {
      setTranslation('오류: ' + String(e))
      setShowTranslation(true)
    } finally {
      setTranslating(false)
    }
  }

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => closeContextMenu()
    window.addEventListener('click', handler)
    window.addEventListener('contextmenu', handler)
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('contextmenu', handler)
    }
  }, [contextMenu, closeContextMenu])

  const mdComponents = useMemo(
    () => makeMdComponents(onRunInTerminal ?? (() => {}), onQuickAction, onOpenFile, onImageClick),
    [onRunInTerminal, onQuickAction, onOpenFile, onImageClick]
  )

  // Defer markdown rendering for completed non-streaming messages to avoid
  // blocking the UI thread when many messages render simultaneously.
  const effectiveText = (altIndex !== undefined && msg.alternatives?.[altIndex]) ? msg.alternatives[altIndex] : msg.text
  const deferredText = useDeferredValue(effectiveText)
  const isStale = deferredText !== effectiveText
  // During streaming the last message uses pre (plain text), so deferral is irrelevant there.
  const displayText = (isStreaming && isLast) ? effectiveText : deferredText

  // Cache parsed markdown for completed messages — avoids re-parsing when
  // unrelated state (hover, context menu) triggers a re-render.
  const parsedRef = useRef<{ text: string; node: React.ReactNode } | null>(null)

  const processedDisplayText = useMemo(
    () => preprocessImageTags(displayText),
    [displayText]
  )

  const renderedMarkdown = useMemo(() => {
    if (msg.role !== 'assistant' || isStreaming) return null
    if (parsedRef.current?.text === processedDisplayText) return parsedRef.current.node
    const node = (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex as any]}
        components={mdComponents}
      >
        {processedDisplayText}
      </ReactMarkdown>
    )
    parsedRef.current = { text: processedDisplayText, node }
    return node
  }, [processedDisplayText, isStreaming, msg.role, mdComponents])

  const firstCodeBlock = useMemo(() => {
    if (isUser) return null
    const match = /```(?:\w+)?\n([\s\S]*?)```/.exec(msg.text)
    return match ? match[1] : null
  }, [msg.text, isUser])

  const timestamp = useMemo(
    () => msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : null,
    [msg.timestamp]
  )

  const msgStats = useMemo(() => {
    if (isUser) return null
    const text = msg.text || ''
    const charCount = text.length
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
    const readTimeSec = Math.round((wordCount / 200) * 60)
    const tokenEstimate = Math.round(wordCount * 1.3)
    const readTimeStr = readTimeSec >= 60
      ? `~${Math.round(readTimeSec / 60)}분 읽기`
      : `${readTimeSec}초 읽기`
    return { wordCount, charCount, readTimeSec, tokenEstimate, readTimeStr }
  }, [msg.text, isUser])

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
      style={{
        position: 'relative',
        padding: 'var(--msg-padding)',
        background: isCurrentMatch
          ? 'rgba(251,191,36,0.18)'
          : isMatched
          ? 'var(--warning-dim, rgba(251,191,36,0.07))'
          : isUser
          ? 'var(--bg-user, rgba(82,139,255,0.06))'
          : 'transparent',
        borderLeft: isCurrentMatch
          ? 'none'
          : isUser
          ? '3px solid var(--accent)'
          : '3px solid var(--success, #26a641)',
        paddingLeft: isCurrentMatch ? undefined : 28,
        borderBottom: '1px solid var(--border)',
        outline: isCurrentMatch ? '1px solid rgba(251,191,36,0.4)' : 'none',
        border: isSearchMatch && !isCurrentMatch ? '1px solid var(--accent)' : undefined,
        boxShadow: isSearchMatch && !isCurrentMatch ? '0 0 8px rgba(82,139,255,0.3)' : undefined,
        transition: 'background 0.15s',
      }}
    >
      {/* Context menu */}
      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            minWidth: 160,
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => { handleMsgCopy(); closeContextMenu() }}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            복사
          </div>
          {onFork && (
            <div
              onClick={() => { onFork(); closeContextMenu() }}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              ⎇ 여기서 분기
            </div>
          )}
          {!isUser && firstCodeBlock && (
            <div
              onClick={() => {
                navigator.clipboard.writeText(firstCodeBlock)
                closeContextMenu()
              }}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              코드 블록 복사
            </div>
          )}
        </div>
      )}

      {/* Permanent bookmark indicator */}
      {isBookmarked && (
        <span style={{
          position: 'absolute',
          top: 8,
          left: 4,
          fontSize: 10,
          color: '#fbbf24',
          pointerEvents: 'none',
        }}>★</span>
      )}

      {/* Hover actions */}
      {isHovered && !isEditing && (
        <div style={{ position: 'absolute', top: 8, right: 12, display: 'flex', gap: 4 }}>
          {onBookmark && (
            <button
              onClick={onBookmark}
              title={isBookmarked ? '북마크 해제' : '북마크'}
              style={{
                background: isBookmarked ? '#3d3a1a' : '#3a3a4a',
                color: isBookmarked ? '#fbbf24' : '#aaa',
                border: 'none',
                borderRadius: 3,
                padding: '2px 8px',
                fontSize: 11,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          )}
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              title={isPinned ? '핀 해제' : '핀 고정'}
              style={{
                background: isPinned ? '#2a3a4a' : '#3a3a4a',
                color: isPinned ? '#60a5fa' : '#aaa',
                border: 'none',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {isPinned ? '📍' : '📌'}
            </button>
          )}
          {isUser && onEditResend && !isStreaming && (
            <button
              onClick={() => { setEditText(msg.text); setIsEditing(true); setTimeout(() => { editTextareaRef.current?.focus(); editTextareaRef.current?.select() }, 0) }}
              title="편집"
              style={{
                background: '#3a3a4a', color: '#aaa',
                border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >&#9998; 편집</button>
          )}
          {isUser && onFork && (
            <button
              onClick={onFork}
              title="여기서 대화 분기"
              style={{
                background: '#3a3a4a', color: '#aaa',
                border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >&#8663; 분기</button>
          )}
          {!isUser && isLast && onRegenerate && (
            <button
              onClick={onRegenerate}
              title="응답 재생성"
              style={{
                background: '#3a3a4a', color: '#aaa',
                border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >&#8634; 재생성</button>
          )}
          {!isUser && isLast && (altCount ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <button
                onClick={() => onPrevAlt?.((altIndex ?? (altCount ?? 0)) - 1)}
                disabled={(altIndex ?? (altCount ?? 0)) <= 0}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 12, padding: '0 2px',
                  opacity: (altIndex ?? (altCount ?? 0)) <= 0 ? 0.3 : 1,
                }}
              >&#9664;</button>
              <span>{(altIndex ?? (altCount ?? 0)) + 1}/{(altCount ?? 0) + 1}</span>
              <button
                onClick={() => onPrevAlt?.(altIndex !== undefined ? altIndex + 1 : (altCount ?? 0))}
                disabled={altIndex === undefined || altIndex >= (altCount ?? 0)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 12, padding: '0 2px',
                  opacity: (altIndex === undefined || altIndex >= (altCount ?? 0)) ? 0.3 : 1,
                }}
              >&#9654;</button>
            </div>
          )}
          {!isUser && onReaction && REACTION_EMOJIS.map(emoji => {
            const count = msg.reactions?.filter(r => r === emoji).length ?? 0
            const active = (count > 0)
            return (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                title={`${emoji} 반응`}
                style={{
                  background: active
                    ? 'rgba(82,139,255,0.25)'
                    : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '2px 4px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                }}
              >
                {emoji}{count > 0 && <span style={{ fontSize: 10 }}>{count}</span>}
              </button>
            )
          })}
          {!isUser && (
            <button
              onClick={handleMdCopy}
              title="마크다운 복사"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: mdCopied ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13,
                padding: '2px 4px',
                borderRadius: 3,
              }}
            >
              {mdCopied ? '✓' : '📋'}
            </button>
          )}
          <button
            onClick={handleTranslate}
            title={showTranslation ? '번역 숨기기' : '번역'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              padding: '2px 4px',
              color: showTranslation ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
            }}
          >
            {translating ? '⟳' : '🌐'}
          </button>
          {onReplyTo && (
            <button
              onClick={onReplyTo}
              title="이 메시지에 인용 응답"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '2px 4px' }}
            >
              ↩
            </button>
          )}
          {onSetNote && (
            <button
              onClick={() => { setNoteText(msg.note ?? ''); setNoteOpen(o => !o) }}
              title="메모"
              style={{
                background: noteOpen ? '#2a2a1a' : '#3a3a4a',
                color: noteOpen ? '#f0c040' : '#aaa',
                border: 'none',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              🗒️
            </button>
          )}
          <button
            onClick={handleMsgCopy}
            title="메시지 복사"
            style={{
              background: msgCopied ? '#2d5a27' : '#3a3a4a',
              color: msgCopied ? '#7ec87a' : '#aaa',
              border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
            }}
          >
            {msgCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Role badge + timestamp */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: isUser ? 'var(--accent)' : 'var(--success)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {isUser ? 'You' : 'Claude'}
        </span>
        {!isUser && msg.model && (
          <span style={{
            fontSize: 10,
            background: 'rgba(82,139,255,0.15)',
            color: '#7a9fff',
            borderRadius: 4,
            padding: '1px 5px',
            marginLeft: 6,
            fontWeight: 400,
            letterSpacing: 0,
            textTransform: 'none',
          }}>
            {shortModelName(msg.model)}
          </span>
        )}
        {timestamp && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontWeight: 400,
              cursor: msgStats ? 'default' : undefined,
            }}
            title={msgStats
              ? `${msgStats.wordCount}단어 · ${msgStats.charCount}자 · ${msgStats.readTimeStr}`
              : undefined}
          >
            {timestamp}
          </span>
        )}
        {(() => {
          const approxTokens = Math.ceil((msg.text?.length ?? 0) / 3.5)
          if (approxTokens <= 0) return null
          return (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.7 }}>
              ~{approxTokens > 999 ? `${(approxTokens / 1000).toFixed(1)}k` : approxTokens}t
            </span>
          )
        })()}
        {msgStats && (msgStats.readTimeSec > 15 || msgStats.tokenEstimate > 100) && (
          <span style={{
            display: 'flex',
            gap: 8,
            fontSize: 10,
            color: '#555',
            fontWeight: 400,
          }}>
            {msgStats.readTimeSec > 15 && (
              <span>{msgStats.readTimeStr}</span>
            )}
            {msgStats.tokenEstimate > 100 && (
              <span>~{msgStats.tokenEstimate} 토큰</span>
            )}
          </span>
        )}
      </div>

      {/* Message text */}
      {isUser ? (
        isEditing ? (
          <div style={{ position: 'relative' }}>
            <textarea
              ref={editTextareaRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (editText.trim() && onEditResend) {
                    setIsEditing(false)
                    onEditResend(editText.trim())
                  }
                }
                if (e.key === 'Escape') {
                  setIsEditing(false)
                }
              }}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'none',
                fontFamily: 'var(--font-ui)',
                boxSizing: 'border-box',
                minHeight: 60,
                outline: 'none',
              }}
              rows={Math.max(3, editText.split('\n').length)}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsEditing(false)}
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', borderRadius: 3, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (editText.trim() && onEditResend) {
                    setIsEditing(false)
                    onEditResend(editText.trim())
                  }
                }}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                재전송 (Enter)
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Enter 재전송 &middot; Shift+Enter 줄바꿈 &middot; Esc 취소
            </div>
          </div>
        ) : (
          <div
            onDoubleClick={handleDoubleClick}
            style={{
              color: 'var(--text-primary)',
              fontSize: 'var(--chat-font-size, 13px)',
              lineHeight: 'var(--chat-line-height, 1.65)',
              wordBreak: 'break-word',
              fontFamily: 'var(--font-ui)',
              cursor: onEditResend && !isStreaming ? 'default' : undefined,
            }}
          >
            {/<image\s+path="[^"]+"\s*\/?>/.test(msg.text) ? (
              renderUserTextWithImages(msg.text, onImageClick)
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>
                {highlightText ? highlightMatches(msg.text, highlightText) : msg.text}
              </span>
            )}
          </div>
        )
      ) : (
        <div style={{
          color: 'var(--text-primary)',
          fontSize: 'var(--chat-font-size, 13px)',
          lineHeight: 'var(--chat-line-height, 1.65)',
          wordBreak: 'break-word',
          fontFamily: 'var(--font-ui)',
        }}>
          {msg.thinkingText && (
            <ThinkingPanel
              text={msg.thinkingText}
              isStreaming={!!(isStreaming && isLast)}
            />
          )}
          {isStreaming && isLast ? (
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--chat-font-size, 13px)',
              margin: 0,
            }}>
              {msg.text}
              {msg.text && <span className="streaming-cursor" />}
            </pre>
          ) : (showCollapseToggle && collapsed) ? (
            <div style={{ position: 'relative' }}>
              <div style={{
                maxHeight: 120,
                overflow: 'hidden',
                opacity: isStale ? 0.7 : 1,
                transition: 'opacity 0.1s',
              }}>
                {renderedMarkdown}
              </div>
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 40,
                background: 'linear-gradient(transparent, #1a1a1a)',
                pointerEvents: 'none',
              }} />
            </div>
          ) : (
            <div style={{ opacity: isStale ? 0.7 : 1, transition: 'opacity 0.1s' }}>
              {renderedMarkdown}
            </div>
          )}
          {showCollapseToggle && (
            <button
              onClick={() => setCollapsed(c => !c)}
              style={{
                display: 'block',
                margin: '4px auto',
                background: 'transparent',
                border: 'none',
                color: 'var(--accent, #527bff)',
                fontSize: 12,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              {collapsed ? '더 보기 ▼' : '접기 ▲'}
            </button>
          )}
        </div>
      )}

      {/* Edit history badge + diff panel */}
      {isUser && msg.editHistory && msg.editHistory.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <button
            onClick={() => setShowEditHistory(s => !s)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#888',
              fontSize: 11,
              padding: '1px 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            ✏️ 수정됨 ({msg.editHistory.length}회)
          </button>
          {showEditHistory && (
            <div style={{
              marginTop: 4,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderLeft: '3px solid #f0a040',
              borderRadius: 4,
              padding: '8px 10px',
            }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 600 }}>현재 버전</div>
              <div style={{
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                color: '#ccc',
                fontFamily: 'inherit',
                marginBottom: 8,
              }}>
                {msg.text}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 600 }}>이전 버전</div>
              <div style={{
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                color: '#999',
                fontFamily: 'inherit',
                background: '#111',
                border: '1px solid #2a2a2a',
                borderRadius: 3,
                padding: '6px 8px',
              }}>
                {msg.editHistory[msg.editHistory.length - 1]}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Translation */}
      {showTranslation && translation && (
        <div style={{
          marginTop: 8, padding: '6px 10px',
          background: 'var(--bg-secondary)', borderRadius: 4,
          fontSize: 12, color: 'rgba(255,255,255,0.7)',
          borderLeft: '2px solid var(--accent)'
        }}>
          {translation}
        </div>
      )}

      {/* Reactions */}
      {msg.reactions && msg.reactions.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {[...new Set(msg.reactions)].map(emoji => {
            const count = msg.reactions!.filter(r => r === emoji).length
            return (
              <button
                key={emoji}
                onClick={() => onReaction?.(emoji)}
                style={{
                  background: '#2a2a2a',
                  border: 'none',
                  borderRadius: 12,
                  padding: '2px 6px',
                  fontSize: 12,
                  color: '#aaa',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {emoji}<span>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Note indicator badge (always visible when note exists) */}
      {msg.note && !noteOpen && (
        <div
          onClick={() => { setNoteText(msg.note ?? ''); setNoteOpen(true) }}
          title={msg.note}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
            cursor: 'pointer',
            color: '#f0c040',
            fontSize: 11,
          }}
        >
          <span>📎</span>
          <span style={{ color: '#bba040', fontStyle: 'italic' }}>
            {msg.note.length > 30 ? msg.note.slice(0, 30) + '...' : msg.note}
          </span>
        </div>
      )}

      {/* Note editing panel */}
      {noteOpen && (
        <div style={{
          marginTop: 8,
          background: '#1a1a2a',
          border: '1px solid #334',
          borderLeft: '3px solid #f0c040',
          borderRadius: 4,
          padding: '8px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#f0c040' }}>🗒️ 메모</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => { onSetNote?.(noteText); setNoteOpen(false) }}
                style={{
                  background: '#2a3a2a',
                  color: '#7ec87a',
                  border: 'none',
                  borderRadius: 3,
                  padding: '1px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                저장
              </button>
              <button
                onClick={() => setNoteOpen(false)}
                style={{
                  background: 'none',
                  color: '#6e7681',
                  border: 'none',
                  borderRadius: 3,
                  padding: '1px 6px',
                  fontSize: 13,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="여기에 메모를 입력하세요..."
            rows={3}
            style={{
              width: '100%',
              background: '#12121e',
              color: '#ccc',
              border: '1px solid #334',
              borderRadius: 3,
              padding: '5px 7px',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Tool uses */}
      {msg.toolUses.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {msg.toolUses.map((t) => (
            <ToolUseIndicator key={t.id} tool={t} />
          ))}
        </div>
      )}

      {/* Error retry button */}
      {isError && onRegenerate && (
        <button
          onClick={onRegenerate}
          style={{
            marginTop: 8,
            background: 'var(--error, #f87171)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ↺ 재시도
        </button>
      )}
    </div>
  )
}, (prev, next) => {
  // isStreaming 변경 시 마지막 메시지는 반드시 re-render (pre → ReactMarkdown 전환)
  if (prev.isLast && prev.isStreaming !== next.isStreaming) return false
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.text === next.msg.text &&
    prev.msg.isError === next.msg.isError &&
    prev.msg.toolUses.length === next.msg.toolUses.length &&
    prev.msg.toolUses.every((t, i) => t.status === next.msg.toolUses[i]?.status && t.output === next.msg.toolUses[i]?.output) &&
    prev.isLast === next.isLast &&
    prev.isMatched === next.isMatched &&
    prev.isCurrentMatch === next.isCurrentMatch &&
    prev.highlightText === next.highlightText &&
    prev.isSearchMatch === next.isSearchMatch &&
    prev.onRunInTerminal === next.onRunInTerminal &&
    (prev.onFork === undefined) === (next.onFork === undefined) &&
    (prev.onEditResend === undefined) === (next.onEditResend === undefined) &&
    (prev.onQuickAction === undefined) === (next.onQuickAction === undefined) &&
    prev.isBookmarked === next.isBookmarked &&
    (prev.onBookmark === undefined) === (next.onBookmark === undefined) &&
    prev.isPinned === next.isPinned &&
    (prev.onTogglePin === undefined) === (next.onTogglePin === undefined) &&
    (prev.onOpenFile === undefined) === (next.onOpenFile === undefined) &&
    (prev.onReaction === undefined) === (next.onReaction === undefined) &&
    (prev.onImageClick === undefined) === (next.onImageClick === undefined) &&
    (prev.onReplyTo === undefined) === (next.onReplyTo === undefined) &&
    (prev.onSetNote === undefined) === (next.onSetNote === undefined) &&
    JSON.stringify(prev.msg.reactions) === JSON.stringify(next.msg.reactions) &&
    prev.msg.note === next.msg.note &&
    (prev.msg.editHistory?.length ?? 0) === (next.msg.editHistory?.length ?? 0) &&
    prev.msg.altIndex === next.msg.altIndex &&
    (prev.msg.alternatives?.length ?? 0) === (next.msg.alternatives?.length ?? 0)
  )
})
