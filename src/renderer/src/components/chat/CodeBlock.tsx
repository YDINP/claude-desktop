import { useState, memo, lazy, Suspense } from 'react'
import React from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php'
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby'
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin'
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift'
import { clipboardStore } from '../../utils/clipboard-store'

SyntaxHighlighter.registerLanguage('javascript', js)
SyntaxHighlighter.registerLanguage('jsx', js)
SyntaxHighlighter.registerLanguage('typescript', ts)
SyntaxHighlighter.registerLanguage('tsx', ts)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('go', go)
SyntaxHighlighter.registerLanguage('java', java)
SyntaxHighlighter.registerLanguage('c', c)
SyntaxHighlighter.registerLanguage('cpp', cpp)
SyntaxHighlighter.registerLanguage('csharp', csharp)
SyntaxHighlighter.registerLanguage('html', markup)
SyntaxHighlighter.registerLanguage('xml', markup)
SyntaxHighlighter.registerLanguage('markup', markup)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('markdown', markdown)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('php', php)
SyntaxHighlighter.registerLanguage('ruby', ruby)
SyntaxHighlighter.registerLanguage('kotlin', kotlin)
SyntaxHighlighter.registerLanguage('swift', swift)

const MermaidBlock = lazy(() => import('./MermaidBlock').then(m => ({ default: m.MermaidBlock })))

export const RUNNABLE_LANGS = ['bash', 'sh', 'shell', 'zsh', 'fish', 'cmd', 'powershell', 'ps1']

// ── Diff rendering utilities ──────────────────────────────────────────────

type DiffLineType = 'add' | 'remove' | 'hunk' | 'normal'

function parseDiffLine(line: string): { type: DiffLineType; content: string } {
  if (line.startsWith('+')) return { type: 'add', content: line }
  if (line.startsWith('-')) return { type: 'remove', content: line }
  if (line.startsWith('@@')) return { type: 'hunk', content: line }
  return { type: 'normal', content: line }
}

export function isDiffContent(language: string, code: string): boolean {
  if (language === 'diff') return true
  const lines = code.split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) return false
  const diffLines = lines.filter(l => l.startsWith('+') || l.startsWith('-') || l.startsWith('@@'))
  return diffLines.length / lines.length >= 0.5
}

const DIFF_LINE_STYLES: Record<DiffLineType, React.CSSProperties> = {
  add:    { background: 'rgba(0,255,0,0.1)', color: '#4ade80', display: 'block', width: '100%' },
  remove: { background: 'rgba(255,0,0,0.1)', color: '#f87171', display: 'block', width: '100%' },
  hunk:   { color: '#60a5fa', fontStyle: 'italic', display: 'block', width: '100%' },
  normal: { display: 'block', width: '100%' },
}

function DiffView({ codeString }: { codeString: string }) {
  const lines = codeString.split('\n')
  const addCount = lines.filter(l => l.startsWith('+')).length
  const removeCount = lines.filter(l => l.startsWith('-')).length

  return (
    <div style={{ margin: '0', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
      {/* Stats header */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '3px 12px',
        background: '#1e1e2e',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 10,
      }}>
        <span style={{ color: '#4ade80' }}>+{addCount}</span>
        <span style={{ color: '#f87171' }}>-{removeCount}</span>
      </div>
      {/* Diff lines */}
      <pre style={{
        background: '#1e1e2e',
        padding: '10px 0',
        margin: 0,
        fontSize: 12,
        fontFamily: 'var(--font-mono, monospace)',
        overflowX: 'auto',
        lineHeight: 1.5,
      }}>
        {lines.map((line, i) => {
          const { type, content } = parseDiffLine(line)
          return (
            <div key={i} style={{ ...DIFF_LINE_STYLES[type], padding: '0 12px', minHeight: '1.5em' }}>
              {content}
            </div>
          )
        })}
      </pre>
    </div>
  )
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

export const CodeBlock = memo(function CodeBlock({
  language,
  codeString,
  onRunInTerminal,
  onRunCode,
  onQuickAction,
}: {
  language: string
  codeString: string
  onRunInTerminal?: (code: string) => void
  onRunCode?: (code: string) => void
  onQuickAction?: (action: 'explain' | 'optimize' | 'fix', code: string, language: string) => void
}) {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null)
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
  const [terminalRunning, setTerminalRunning] = useState(false)

  const effectiveRunInTerminal = onRunCode ?? onRunInTerminal

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString)
    clipboardStore.push(codeString, `code:${language}`)
    setCopiedBlock(language)
    setTimeout(() => setCopiedBlock(null), 2000)
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

  const handleRunInTerminal = () => {
    if (!effectiveRunInTerminal) return
    effectiveRunInTerminal(codeString)
    setTerminalRunning(true)
    setTimeout(() => setTerminalRunning(false), 500)
  }

  const isRunnable = effectiveRunInTerminal && RUNNABLE_LANGS.includes(language.toLowerCase())
  const isShellExecable = RUNNABLE_LANGS.includes(language.toLowerCase())
  const isJsRunnable = JS_LANGS.includes(language.toLowerCase()) && codeString.length < 1000
  const isDocable = DOC_LANGS.includes(language.toLowerCase())

  const hasOutput = runOutput !== null
  const isDiff = isDiffContent(language, codeString)

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
        padding: '4px 8px 4px 12px',
        fontSize: 11,
        gap: 4,
      }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'lowercase', flex: 1 }}>
          {language || 'text'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, marginRight: 4 }}>
          {codeString.split('\n').length} lines
        </span>
        {/* Header action buttons */}
        {isRunnable && (
          <button
            onClick={handleRunInTerminal}
            title="터미널에서 실행"
            style={{
              background: '#1e3a2e',
              color: '#4ade80',
              border: 'none',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: 11,
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >
            {terminalRunning ? '⟳' : '▶ 터미널'}
          </button>
        )}
        {isShellExecable && (
          <button
            onClick={handleShellExec}
            title="인라인 실행 (shell:exec)"
            style={{
              background: shellResult ? (shellResult.ok ? '#1a3a2e' : '#3a1a1a') : '#1e2a1e',
              color: shellResult ? (shellResult.ok ? '#86efac' : '#f87171') : '#4ade80',
              border: 'none',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: 11,
              cursor: shellRunning ? 'not-allowed' : 'pointer',
              lineHeight: 1.4,
            }}
          >
            {shellRunning ? '⟳' : '▶'}
          </button>
        )}
        {isJsRunnable && !isRunnable && !isShellExecable && (
          <button
            onClick={handleRunJs}
            title="브라우저 샌드박스에서 JS 실행"
            style={{
              background: '#1e2a3e',
              color: '#7ec8a0',
              border: 'none',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: 11,
              cursor: 'pointer',
              lineHeight: 1.4,
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
              background: docCode ? '#1a2a3e' : '#3a3a4a',
              color: docCode ? '#4a90e2' : '#aaa',
              border: 'none',
              borderRadius: 3,
              padding: '2px 6px',
              fontSize: 11,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              lineHeight: 1.4,
            }}
          >
            {docLoading ? '...' : docCode ? '✕' : '📝'}
          </button>
        )}
        <button
          onClick={handleExplain}
          title={explanation ? '설명 닫기' : 'AI 코드 설명'}
          style={{
            background: explanation ? '#2a3a5e' : '#3a3a4a',
            color: explanation ? '#60a5fa' : '#aaa',
            border: 'none',
            borderRadius: 3,
            padding: '2px 6px',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
            lineHeight: 1.4,
          }}
        >
          {explainLoading ? '...' : explanation ? '✕' : '💡'}
        </button>
        <button
          onClick={handleCopy}
          title="코드 복사"
          style={{
            background: copiedBlock ? '#2d5a27' : '#3a3a4a',
            color: copiedBlock ? '#7ec87a' : '#aaa',
            border: 'none',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
            lineHeight: 1.4,
          }}
        >
          {copiedBlock ? '✓' : '📋'}
        </button>
      </div>
      {isDiff ? (
        <DiffView codeString={codeString} />
      ) : (
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
      )}
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

export function makeMdComponents(
  onRunInTerminal: (code: string) => void,
  onQuickAction?: (action: 'explain' | 'optimize' | 'fix', code: string, language: string) => void,
  onOpenFile?: (path: string) => void,
  onImageClick?: (src: string, alt?: string) => void,
  highlightQuery?: string
) {
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

  function linkifyPaths(text: string, onOpenFileFn: (path: string) => void): React.ReactNode[] {
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
          onClick={() => onOpenFileFn(path)}
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

  function InlineImage({
    src,
    alt,
    filename,
    onImgClick,
  }: {
    src: string
    alt?: string
    filename: string
    onImgClick?: (src: string, alt?: string) => void
  }) {
    const [error, setError] = React.useState(false)
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
          onClick={() => onImgClick?.(src, alt)}
          onError={() => setError(true)}
          style={{
            maxWidth: '100%',
            maxHeight: 300,
            borderRadius: 6,
            cursor: onImgClick ? 'zoom-in' : 'default',
            display: 'block',
          }}
        />
        <span style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 2 }}>
          {filename}
        </span>
      </span>
    )
  }

  return {
    img({ src, alt }: { src?: string; alt?: string }) {
      if (!src) return null
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
          onImgClick={onImageClick}
        />
      )
    },
    p({ children }: { children?: React.ReactNode }) {
      if (!onOpenFile && !highlightQuery) return <p>{children}</p>
      const processed = React.Children.map(children, child => {
        if (typeof child !== 'string') return child
        if (onOpenFile) {
          const linked = linkifyPaths(child, onOpenFile)
          return highlightQuery ? React.Children.map(linked, c =>
            typeof c === 'string' ? highlightMatches(c, highlightQuery) : c
          ) : linked
        }
        return highlightMatches(child, highlightQuery!)
      })
      return <p>{processed}</p>
    },
    li({ children }: { children?: React.ReactNode }) {
      if (!onOpenFile && !highlightQuery) return <li>{children}</li>
      const processed = React.Children.map(children, child => {
        if (typeof child !== 'string') return child
        if (onOpenFile) {
          const linked = linkifyPaths(child, onOpenFile)
          return highlightQuery ? React.Children.map(linked, c =>
            typeof c === 'string' ? highlightMatches(c, highlightQuery) : c
          ) : linked
        }
        return highlightMatches(child, highlightQuery!)
      })
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
      // No language specified but content looks like a diff → render as diff
      if (!match && codeString.includes('\n') && isDiffContent('', codeString)) {
        return <CodeBlock language="diff" codeString={codeString} onRunInTerminal={onRunInTerminal} onQuickAction={onQuickAction} />
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
