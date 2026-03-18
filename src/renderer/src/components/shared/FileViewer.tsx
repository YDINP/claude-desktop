import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
import '../../utils/monaco-setup'
import Editor from '@monaco-editor/react'
import type * as MonacoType from 'monaco-editor'

interface FileViewerProps {
  path: string
  cwd?: string
  onClose?: () => void
  onSplitView?: (path: string) => void
  onAskAI?: (prompt: string) => void
  onDirtyChange?: (dirty: boolean) => void
}

type BlameEntry = { hash: string; author: string; date: string; lineNo: number }

function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
    cs: 'csharp', html: 'html', css: 'css', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', sh: 'shell', bash: 'shell', xml: 'xml',
    sql: 'sql', php: 'php', rb: 'ruby', kt: 'kotlin', swift: 'swift',
    toml: 'ini', vue: 'html', svelte: 'html',
  }
  return map[ext] ?? 'plaintext'
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])

export function FileViewer({ path, cwd, onClose, onSplitView, onAskAI, onDirtyChange }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(13)
  const [imgScale, setImgScale] = useState(1)
  const [fitMode, setFitMode] = useState(true)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isDirty, setIsDirty] = useState(false)
  const [splitPreview, setSplitPreview] = useState(false)

  // Git blame state
  const [showBlame, setShowBlame] = useState(false)
  const [blameData, setBlameData] = useState<BlameEntry[]>([])
  const [blameLoading, setBlameLoading] = useState(false)

  // Monaco editor ref
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null)

  // Inline AI assistant state
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [aiInput, setAiInput] = useState('')

  const filename = path.split(/[\\/]/).pop() ?? path
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const isMarkdown = ext === 'md'
  const isImage = IMAGE_EXT.has(ext)

  const imgSrc = isImage ? `local://localhost?path=${encodeURIComponent(path)}` : null

  useEffect(() => {
    setImgScale(1)
    setFitMode(true)
    setError(null)
    if (!isImage) {
      setContent(null)
      window.api.readFile(path).then(setContent).catch(() => setError('파일을 읽을 수 없습니다'))
    }
  }, [path])

  // Reset edit state when file changes
  useEffect(() => {
    setIsEditing(false)
    setSaveStatus('idle')
    setSplitPreview(false)
    setShowBlame(false)
    setBlameData([])
    setIsDirty(false); onDirtyChange?.(false)
  }, [path])

  const handleSave = async () => {
    setSaveStatus('saving')
    const result = await window.api.writeTextFile(path, editContent)
    if (result.ok) {
      setSaveStatus('saved')
      setContent(editContent)
      setIsDirty(false); onDirtyChange?.(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
    }
  }

  const handleToggleBlame = async () => {
    if (showBlame) { setShowBlame(false); return }
    if (!cwd || !path) return
    setBlameLoading(true)
    const data = await window.api.gitBlame(cwd, path)
    setBlameData(data)
    setShowBlame(true)
    setBlameLoading(false)
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      if (isImage) {
        setFitMode(false)
        setImgScale(prev => Math.min(5, Math.max(0.25, prev * (e.deltaY < 0 ? 1.1 : 0.9))))
      } else {
        setFontSize(prev => Math.min(32, Math.max(8, prev + (e.deltaY < 0 ? 1 : -1))))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const jumpToLine = (lineNum: number) => {
    editorRef.current?.revealLineInCenter(lineNum)
    editorRef.current?.setPosition({ lineNumber: lineNum, column: 1 })
  }

  // Reset splitPreview when leaving edit mode
  useEffect(() => {
    if (!isEditing) {
      setSplitPreview(false)
    }
  }, [isEditing])

  const blameVisible = showBlame && blameData.length > 0 && !isEditing && !isImage

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        gap: 6,
      }}
        title={path}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {path}
        </span>
        {content !== null && !isImage && !isEditing && (
          <button
            onClick={() => editorRef.current?.getAction('editor.action.gotoLine')?.run()}
            title="라인으로 이동 (Ctrl+G)"
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', fontSize: 11, padding: '2px 6px', cursor: 'pointer', flexShrink: 0 }}
          >
            :줄
          </button>
        )}
        {!isImage && (
          isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                미리보기
              </button>
              {isMarkdown && (
                <button
                  onClick={() => setSplitPreview(p => !p)}
                  title={splitPreview ? '분할 뷰 닫기' : '분할 뷰 열기'}
                  style={{
                    background: splitPreview ? 'var(--accent)' : 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: splitPreview ? '#fff' : 'var(--text-muted)',
                    fontSize: 11,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  분할 뷰
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                style={{
                  background: saveStatus === 'saved' ? '#1a6b2a' : saveStatus === 'error' ? '#6b1a1a' : 'var(--accent)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  padding: '2px 8px',
                  cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: saveStatus === 'saving' ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                {saveStatus === 'saving' ? '저장 중...' : saveStatus === 'saved' ? '저장됨' : saveStatus === 'error' ? '오류' : '저장'}
              </button>
            </>
          ) : (
            <button
              onClick={() => { setEditContent(content ?? ''); setIsEditing(true) }}
              title="편집 모드"
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-muted)',
                fontSize: 11,
                padding: '2px 8px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ✏ 편집
            </button>
          )
        )}
        {cwd && !isEditing && !isImage && (
          <button
            onClick={handleToggleBlame}
            title="Git Blame"
            style={{
              background: showBlame ? 'var(--accent)' : 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: showBlame ? '#fff' : 'var(--text-muted)',
              fontSize: 11,
              padding: '2px 8px',
              cursor: blameLoading ? 'wait' : 'pointer',
              flexShrink: 0,
              opacity: blameLoading ? 0.6 : 1,
            }}
          >
            ⚖ Blame
          </button>
        )}
        {onSplitView && !isEditing && (
          <button
            onClick={() => onSplitView(path)}
            title="분할 뷰에서 열기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 6px', flexShrink: 0 }}
          >
            ⧉
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            title="닫기"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 6px', flexShrink: 0 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      {/* Split view (edit + markdown preview) */}
      {isEditing && isMarkdown && splitPreview && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* 편집 영역 */}
          <div style={{ flex: 1, overflow: 'hidden', borderRight: '1px solid var(--border)', position: 'relative' }}>
            <textarea
              value={editContent}
              onChange={e => { setEditContent(e.target.value); setSaveStatus('idle'); setIsDirty(true); onDirtyChange?.(true) }}
              onKeyDown={e => {
                if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave() }
                if (e.key === 'Escape') { setIsEditing(false) }
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: 'none',
                outline: 'none',
                padding: 16,
                fontSize: `${fontSize}px`,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
                resize: 'none',
                boxSizing: 'border-box',
              }}
              spellCheck={false}
            />
          </div>
          {/* 미리보기 영역 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', background: 'var(--bg-primary)' }}>
            <div style={{ fontSize, lineHeight: 1.7, color: 'var(--text-primary)', maxWidth: 720 }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        onClick={e => { e.preventDefault(); if (href) window.api.openExternal(href) }}
                        style={{ color: 'var(--accent)', cursor: 'pointer' }}
                      >
                        {children}
                      </a>
                    )
                  },
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const inline = !match
                    if (inline) return <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em' }} {...props}>{children}</code>
                    return (
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div">
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  }
                }}
              >
                {editContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Main content area — flex row when blame is visible */}
      <div
        style={{
          flex: isEditing && isMarkdown && splitPreview ? 0 : 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          ...(isEditing && isMarkdown && splitPreview ? { display: 'none' } : {}),
        }}
      >
        {/* Git blame gutter */}
        {blameVisible && (
          <div style={{
            flexShrink: 0,
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            borderRight: '1px solid var(--border)',
            lineHeight: '1.4em',
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--bg-secondary)',
          }}>
            {blameData.map(b => (
              <div key={b.lineNo} style={{ padding: '0 8px', whiteSpace: 'nowrap' }} title={`${b.author} · ${b.date}`}>
                <span style={{ color: 'var(--accent)', marginRight: 4 }}>{b.hash}</span>
                <span>{b.author.slice(0, 10).padEnd(10)} {b.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* File content */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflow: 'auto',
            minWidth: 0,
            minHeight: 0,
            padding: isMarkdown && !isEditing ? '16px 24px' : 0,
            display: isImage ? 'flex' : undefined,
            alignItems: isImage ? 'center' : undefined,
            justifyContent: isImage ? 'center' : undefined,
            position: 'relative',
          }}
        >
          {/* Edit mode — Monaco Editor */}
          {isEditing && !isImage && (
            <Editor
              height="100%"
              language={getLang(filename)}
              value={editContent}
              onChange={(val) => { setEditContent(val ?? ''); setSaveStatus('idle'); setIsDirty(true); onDirtyChange?.(true) }}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                wordWrap: 'on',
                fontSize,
                lineNumbers: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
              onMount={(editor, monacoInstance) => {
                editorRef.current = editor
                editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, handleSave)
                editor.onDidChangeCursorSelection(() => {
                  const sel = editor.getSelection()
                  if (sel && !sel.isEmpty()) {
                    const text = editor.getModel()?.getValueInRange(sel) ?? ''
                    if (text.trim().length > 0) setSelectedCode(text)
                    else setSelectedCode(null)
                  } else {
                    setSelectedCode(null)
                  }
                })
              }}
            />
          )}

          {isImage && imgSrc && !error && (
            <>
              {/* Zoom control overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {(
                  [
                    {
                      label: '−',
                      title: '축소 (25%)',
                      onClick: () => { setFitMode(false); setImgScale(prev => Math.max(0.25, parseFloat((prev - 0.25).toFixed(2)))) },
                    },
                    {
                      label: `${fitMode ? 'fit' : `${Math.round(imgScale * 100)}%`}`,
                      title: '100%로 리셋',
                      onClick: () => { setFitMode(false); setImgScale(1) },
                    },
                    {
                      label: '+',
                      title: '확대 (25%)',
                      onClick: () => { setFitMode(false); setImgScale(prev => Math.min(5, parseFloat((prev + 0.25).toFixed(2)))) },
                    },
                    {
                      label: '맞추기',
                      title: '화면에 맞추기',
                      onClick: () => setFitMode(f => !f),
                      active: fitMode,
                    },
                  ] as { label: string; title: string; onClick: () => void; active?: boolean }[]
                ).map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    title={btn.title}
                    style={{
                      background: btn.active ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <img
                src={imgSrc}
                alt={filename}
                onError={() => setError('이미지를 불러올 수 없습니다')}
                style={{
                  maxWidth: fitMode ? '100%' : 'none',
                  maxHeight: fitMode ? '100%' : 'none',
                  width: !fitMode ? `${imgScale * 100}%` : undefined,
                  objectFit: fitMode ? 'contain' : undefined,
                  display: 'block',
                  userSelect: 'none',
                }}
              />
            </>
          )}
          {error && (
            <div style={{ padding: 16, color: 'var(--error)', fontSize: 12 }}>{error}</div>
          )}
          {content === null && !error && !isImage && (
            <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
          )}
          {content !== null && !error && isMarkdown && !content.startsWith('[File too large') && (
            <div style={{ fontSize, lineHeight: 1.7, color: 'var(--text-primary)', maxWidth: 720 }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        onClick={e => { e.preventDefault(); if (href) window.api.openExternal(href) }}
                        style={{ color: 'var(--accent)', cursor: 'pointer' }}
                      >
                        {children}
                      </a>
                    )
                  },
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const inline = !match
                    if (inline) return <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em' }} {...props}>{children}</code>
                    return (
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div">
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
          {content !== null && !error && content.startsWith('[File too large') && (
            <div style={{ padding: 16, color: 'var(--error)', fontSize: 12 }}>{content}</div>
          )}
          {content !== null && !error && !isMarkdown && !content.startsWith('[File too large') && (
            <Editor
              height="100%"
              language={getLang(filename)}
              value={content}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: true },
                wordWrap: 'on',
                fontSize,
                lineNumbers: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                renderLineHighlight: 'gutter',
              }}
              onMount={(editor) => {
                editorRef.current = editor
                editor.onDidChangeCursorSelection(() => {
                  const sel = editor.getSelection()
                  if (sel && !sel.isEmpty()) {
                    const text = editor.getModel()?.getValueInRange(sel) ?? ''
                    if (text.trim().length > 0) setSelectedCode(text)
                    else setSelectedCode(null)
                  } else {
                    setSelectedCode(null)
                  }
                })
              }}
            />
          )}
        </div>
      </div>

      {/* Inline AI assistant panel */}
      {selectedCode && onAskAI && (
        <div style={{
          flexShrink: 0,
          background: '#0a0a1a',
          borderTop: '1px solid rgba(0,152,255,0.25)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
        }}>
          <span style={{ color: '#0098ff', flexShrink: 0 }}>⚡</span>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {selectedCode.split('\n').length}줄 선택
          </span>
          <button
            onClick={() => {
              onAskAI(`이 코드를 설명해줘:\n\n\`\`\`${getLang(filename)}\n${selectedCode}\n\`\`\``)
            }}
            style={{
              background: 'rgba(0,152,255,0.12)',
              border: '1px solid rgba(0,152,255,0.3)',
              borderRadius: 4, color: '#0098ff',
              fontSize: 11, padding: '2px 8px', cursor: 'pointer', flexShrink: 0,
            }}
          >
            설명
          </button>
          <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0 }}>
            <input
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && aiInput.trim()) {
                  onAskAI(`이 코드를 수정해줘:\n${aiInput}\n\n\`\`\`${getLang(filename)}\n${selectedCode}\n\`\`\``)
                  setAiInput('')
                }
              }}
              placeholder="수정 요청 입력 후 Enter..."
              style={{
                flex: 1, minWidth: 0,
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text-primary)',
                fontSize: 11, padding: '2px 8px', outline: 'none',
              }}
            />
            <button
              onClick={() => {
                if (!aiInput.trim()) return
                onAskAI(`이 코드를 수정해줘:\n${aiInput}\n\n\`\`\`${getLang(filename)}\n${selectedCode}\n\`\`\``)
                setAiInput('')
              }}
              disabled={!aiInput.trim()}
              style={{
                background: aiInput.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: 'none', borderRadius: 4, color: aiInput.trim() ? '#fff' : 'var(--text-muted)',
                fontSize: 11, padding: '2px 8px', cursor: aiInput.trim() ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              수정
            </button>
          </div>
          <button
            onClick={() => setSelectedCode(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px', flexShrink: 0 }}
          >✕</button>
        </div>
      )}
    </div>
  )
}
