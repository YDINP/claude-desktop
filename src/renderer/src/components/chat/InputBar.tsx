import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

interface InputBarProps {
  onSend: (text: string) => void
  onInterrupt: () => void
  onPause?: () => void
  onResume?: () => void
  isPaused?: boolean
  pausedTask?: string | null
  isStreaming: boolean
  disabled: boolean
  focusTrigger?: number
  pendingInsert?: string
  onPendingInsertConsumed?: () => void
  onOpenPromptChain?: () => void
  onTextChange?: (text: string) => void
}

const MAX_HISTORY = 100
const HISTORY_KEY = 'inputHistory'
const DRAFT_KEY = 'draft-input'
const MAX_FILE_SIZE = 100 * 1024 // 100KB
const MAX_CONTENT_CHARS = 5000
const TEMPLATES_KEY = 'message-templates'
const MAX_TEMPLATES = 20
const QUICK_ACTIONS_KEY = 'quick-actions'
const TEMPLATE_VARS_KEY = 'template-vars-history'
const MAX_VAR_SUGGESTIONS = 5

interface QuickAction {
  id: string
  label: string
  prompt: string
}

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: '1', label: '요약', prompt: '위 내용을 3줄로 요약해 주세요.' },
  { id: '2', label: '코드리뷰', prompt: '이 코드를 리뷰하고 개선사항을 알려주세요.' },
  { id: '3', label: '설명', prompt: '이것이 무엇인지 쉽게 설명해 주세요.' },
  { id: '4', label: '계속', prompt: '계속 진행해 주세요.' },
]

interface MessageTemplate {
  id: string
  title: string
  content: string
  createdAt: number
}

const TEXT_EXTS = new Set([
  'txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'py', 'json', 'yaml', 'yml',
  'css', 'scss', 'html', 'xml', 'sh', 'bash', 'rs', 'go', 'java',
  'c', 'cpp', 'h', 'hpp', 'cs', 'rb', 'php', 'swift', 'kt', 'sql',
  'toml', 'ini', 'conf', 'env', 'gitignore',
])

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

const isTextFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return TEXT_EXTS.has(ext)
}

const readFileContent = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file, 'utf-8')
  })

interface SlashCommand {
  cmd: string
  label: string
  description: string
  prompt: string
  isCustom?: boolean
}

interface Snippet {
  id: string
  name: string
  content: string
  language?: string
  category?: string
  shortcut?: string
  createdAt: number
}

const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: 'fix',       label: '/fix',       description: '버그 수정',       prompt: '다음 버그를 수정해줘:\n' },
  { cmd: 'explain',   label: '/explain',   description: '코드/개념 설명',   prompt: '다음을 자세히 설명해줘:\n' },
  { cmd: 'review',    label: '/review',    description: '코드 리뷰',        prompt: '다음 코드를 리뷰해줘:\n' },
  { cmd: 'refactor',  label: '/refactor',  description: '리팩토링',          prompt: '다음 코드를 리팩토링해줘:\n' },
  { cmd: 'test',      label: '/test',      description: '테스트 작성',       prompt: '다음 코드에 대한 테스트를 작성해줘:\n' },
  { cmd: 'docs',      label: '/docs',      description: '문서화',            prompt: '다음 코드를 문서화해줘:\n' },
  { cmd: 'optimize',  label: '/optimize',  description: '성능 최적화',       prompt: '다음 코드의 성능을 최적화해줘:\n' },
  { cmd: 'summarize', label: '/summarize', description: '대화 요약',         prompt: '지금까지 대화 내용을 요약해줘.' },
  { cmd: 'translate', label: '/translate', description: '번역',              prompt: '다음 내용을 한국어로 번역해줘:\n' },
  { cmd: 'think',     label: '/think',     description: '단계별 사고',       prompt: '다음을 단계별로 분석해줘:\n' },
  { cmd: 'compare',   label: '/compare',   description: '비교 분석',         prompt: '다음을 비교 분석해줘:\n' },
  { cmd: 'debug',     label: '/debug',     description: '디버깅',            prompt: '다음 문제를 디버깅해줘:\n' },
]

function parseSlash(text: string): string | null {
  // Only trigger if text starts with '/' (no leading spaces)
  if (!text.startsWith('/')) return null
  const space = text.indexOf(' ')
  return space === -1 ? text.slice(1) : null // only while no space yet
}

function parseSnippetTrigger(text: string, cursorPos: number): { query: string; triggerStart: number } | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/(^|\s)(\/\S*)$/)
  if (!match) return null
  const full = match[2] // e.g. "/hel"
  const triggerStart = before.lastIndexOf(full)
  return { query: full.slice(1), triggerStart } // query without leading '/'
}

function parseMention(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos)
  const atMatch = before.match(/@([^\s/\\]*)$/)
  return atMatch ? atMatch[1] : null
}

// Returns the position right after '{{' if cursor is immediately following '{{' with optional partial var name
function parseVarTrigger(text: string, cursorPos: number): { triggerStart: number; partial: string } | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/\{\{([a-zA-Z0-9_]*)$/)
  if (!match) return null
  const triggerStart = before.lastIndexOf('{{')
  return { triggerStart, partial: match[1] }
}

export function InputBar({ onSend, onInterrupt, onPause, onResume, isPaused, pausedTask, isStreaming, disabled, focusTrigger, pendingInsert, onPendingInsertConsumed, onOpenPromptChain, onTextChange }: InputBarProps) {
  const onTextChangeRef = useRef(onTextChange)
  useEffect(() => { onTextChangeRef.current = onTextChange }, [onTextChange])
  const [text, _setText] = useState<string>(() => localStorage.getItem(DRAFT_KEY) ?? '')
  const setText = useCallback((val: string | ((prev: string) => string)) => {
    _setText(prev => {
      const next = typeof val === 'function' ? val(prev) : val
      onTextChangeRef.current?.(next)
      return next
    })
  }, [])
  const [slashSelected, setSlashSelected] = useState(0)
  const [previewImages, setPreviewImages] = useState<{ dataUrl: string; path: string }[]>([])
  const [customTemplates, setCustomTemplates] = useState<SlashCommand[]>([])
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [mentionSelected, setMentionSelected] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [snippetMatches, setSnippetMatches] = useState<Snippet[]>([])
  const [snippetMenuIdx, setSnippetMenuIdx] = useState(-1)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [templateSearch, setTemplateSearch] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('selected-model') ?? 'claude-opus-4-6'
  )
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [multilineMode, setMultilineMode] = useState(false)
  const [lineWrap, setLineWrap] = useState(true)
  const [historyPage, setHistoryPage] = useState(0)
  const [historyPageSize, setHistoryPageSize] = useState(20)
  const multilineModeRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [smartInput, setSmartInput] = useState<boolean>(() => localStorage.getItem('smart-input') === 'true')
  const [historySearch, setHistorySearch] = useState('')
  const [historySearchOpen, setHistorySearchOpen] = useState(false)
  const [voiceMacros, setVoiceMacros] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('voice-macros') ?? '{}'))
  const [autoIndent, setAutoIndent] = useState(true)
  const [savedCursorPos, setSavedCursorPos] = useState(0)
  const [pasteMode, setPasteMode] = useState<'text' | 'code' | 'auto'>('auto')
  const [inputMode, setInputMode] = useState<'text' | 'image' | 'file' | 'mixed'>('text')
  const [customShortcuts, setCustomShortcuts] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('input-shortcuts') ?? '{}'))
  const [showShortcutEditor, setShowShortcutEditor] = useState(false)
  const [maxTokens, setMaxTokens] = useState<number | null>(null)
  const [showTokenLimit, setShowTokenLimit] = useState(false)
  const [globalVars, setGlobalVars] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('global-vars') ?? '{}'))
  const [autoCorrect, setAutoCorrect] = useState(false)
  const [chainedPrompts, setChainedPrompts] = useState<string[]>([])
  const [chainMode, setChainMode] = useState(false)
  const [customCompletions, setCustomCompletions] = useState<Array<{ trigger: string; value: string }>>(() => JSON.parse(localStorage.getItem('custom-completions') ?? '[]'))
  const [showCompletionEditor, setShowCompletionEditor] = useState(false)
  const [corrections, setCorrections] = useState<Array<{ from: string; to: string }>>([])
  const [showGlobalVars, setShowGlobalVars] = useState(false)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [lastPasteType, setLastPasteType] = useState<string | null>(null)
  const [cursorPosHistory, setCursorPosHistory] = useState<number[]>([])
  const [indentSize, setIndentSize] = useState(2)
  const [showVoiceMacros, setShowVoiceMacros] = useState(false)
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})
  const [templateVarKeys, setTemplateVarKeys] = useState<string[]>([])
  const [varSuggestions, setVarSuggestions] = useState<string[]>([])
  const [varSuggestionsOpen, setVarSuggestionsOpen] = useState(false)
  const [varSuggestionsIdx, setVarSuggestionsIdx] = useState(0)
  const [quickActions, setQuickActions] = useState<QuickAction[]>(() => {
    try {
      const stored = localStorage.getItem(QUICK_ACTIONS_KEY)
      return stored ? JSON.parse(stored) : DEFAULT_QUICK_ACTIONS
    } catch { return DEFAULT_QUICK_ACTIONS }
  })
  const [editingAction, setEditingAction] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [streamElapsed, setStreamElapsed] = useState(0)
  const [draftAutosave, setDraftAutosave] = useState(true)
  const [lastDraftSaved, setLastDraftSaved] = useState<number | null>(null)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [cmdPaletteQuery, setCmdPaletteQuery] = useState('')
  const [emojiSearch, setEmojiSearch] = useState('')
  const [emojiSuggestions, setEmojiSuggestions] = useState<Array<{ emoji: string; name: string }>>([])
  const [textFormat, setTextFormat] = useState<'plain' | 'markdown' | 'html'>('plain')
  const [showFormatBar, setShowFormatBar] = useState(false)
  const [voiceInputLang, setVoiceInputLang] = useState('ko-KR')
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [pastePreprocess, setPastePreprocess] = useState(true)
  const [pastePreprocessRules, setPastePreprocessRules] = useState<Array<{ pattern: string; replace: string }>>([])
  const [autoTagDetect, setAutoTagDetect] = useState(true)
  const [detectedTags, setDetectedTags] = useState<string[]>([])
  const [spellingCorrect, setSpellingCorrect] = useState(true)
  const [spellingErrors, setSpellingErrors] = useState<string[]>([])
  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([])
  const [showMentionList, setShowMentionList] = useState(false)
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [slashCommands, setSlashCommands] = useState<Array<{ cmd: string; description: string }>>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [inputHistory, setInputHistory] = useState<string[]>([])
  const [inputHistoryIdx, setInputHistoryIdx] = useState(-1)
  const [contextualHelp, setContextualHelp] = useState<string | null>(null)
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)
  const [showTokenCounter, setShowTokenCounter] = useState(false)
  const [imageAttachments, setImageAttachments] = useState<Array<{ name: string; dataUrl: string }>>([])
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [fileDropActive, setFileDropActive] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<Array<{ name: string; size: number; type: string }>>([])
  const [codeCompletion, setCodeCompletion] = useState(false)
  const [codeCompletionSuggestions, setCodeCompletionSuggestions] = useState<string[]>([])
  const [textTransform, setTextTransform] = useState<'none' | 'uppercase' | 'lowercase' | 'capitalize'>('none')
  const [showTransformMenu, setShowTransformMenu] = useState(false)
  const [grammarCheck, setGrammarCheck] = useState(false)
  const [grammarSuggestions, setGrammarSuggestions] = useState<Array<{ offset: number; text: string; suggestion: string }>>([])
  const [voiceInput, setVoiceInput] = React.useState(false)
  const [voiceTranscript, setVoiceTranscript] = React.useState('')
  const [fontSize, setFontSize] = React.useState(14)
  const [showFontSizeControl, setShowFontSizeControl] = React.useState(false)
  const [linkPreview, setLinkPreview] = React.useState<Record<string, unknown> | null>(null)
  const [showLinkPreview, setShowLinkPreview] = React.useState(false)
  const [autoSave, setAutoSave] = React.useState(true)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)
  const [shortcutHelp, setShortcutHelp] = React.useState(false)
  const [shortcutList, setShortcutList] = React.useState<string[]>([])
  const [inlineImages, setInlineImages] = React.useState<string[]>([])
  const [showImageGallery, setShowImageGallery] = React.useState(false)
  const [mdToolbar, setMdToolbar] = React.useState(false)
  const [mdToolbarPinned, setMdToolbarPinned] = React.useState(false)
  const [expandedInput, setExpandedInput] = React.useState(false)
  const [inputMaxHeight, setInputMaxHeight] = React.useState(300)
  const [codeLanguage, setCodeLanguage] = React.useState('javascript')
  const [showPasteOptions, setShowPasteOptions] = React.useState(false)
  const [inputLocked, setInputLocked] = React.useState(false)
  const [lockMessage, setLockMessage] = React.useState('')
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorPosRef = useRef<number>(0)

  useEffect(() => {
    window.api.settingsGet().then((s) => {
      if (s?.selectedModel) {
        const stored = localStorage.getItem('selected-model')
        if (!stored) {
          setSelectedModel(s.selectedModel)
        }
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    window.api.ollamaList?.().then(models => {
      setOllamaModels(models)
    }).catch(() => {})
  }, [])

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    localStorage.setItem('selected-model', model)
    ;(window as any).__selectedModel = model
    window.dispatchEvent(new CustomEvent('model-change', { detail: { model } }))
  }

  useEffect(() => {
    if (focusTrigger !== undefined && focusTrigger > 0) {
      textareaRef.current?.focus()
    }
  }, [focusTrigger])

  useEffect(() => {
    if (!pendingInsert) return
    const ta = textareaRef.current
    if (ta) {
      const start = ta.selectionStart ?? text.length
      const end = ta.selectionEnd ?? text.length
      const newText = text.slice(0, start) + pendingInsert + text.slice(end)
      setText(newText)
      // position cursor after inserted text
      const newCursor = start + pendingInsert.length
      requestAnimationFrame(() => {
        ta.selectionStart = newCursor
        ta.selectionEnd = newCursor
        ta.focus()
      })
    } else {
      setText(prev => prev + pendingInsert)
    }
    onPendingInsertConsumed?.()
  }, [pendingInsert]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isStreaming) {
      setStreamElapsed(0)
      streamTimerRef.current = setInterval(() => {
        setStreamElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current)
        streamTimerRef.current = null
      }
      setStreamElapsed(0)
    }
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current)
    }
  }, [isStreaming])

  useEffect(() => {
    window.api.recentFiles().then((files) => setRecentFiles(files ?? []))
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TEMPLATES_KEY)
      if (stored) setTemplates(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  const saveTemplatesToStorage = (updated: MessageTemplate[]) => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated))
    setTemplates(updated)
  }

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
    saveTemplatesToStorage([newTemplate, ...templates])
    setNewTemplateName('')
    setSavingTemplate(false)
  }

  const handleInsertTemplate = (tpl: MessageTemplate) => {
    setText(tpl.content)
    setShowTemplates(false)
    setTimeout(() => {
      adjustHeight()
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        ta.selectionStart = ta.selectionEnd = tpl.content.length
      }
    }, 0)
  }

  const handleDeleteTemplate = (id: string) => {
    saveTemplatesToStorage(templates.filter(t => t.id !== id))
  }

  const filteredTemplates = templateSearch.trim()
    ? templates.filter(t =>
        t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.content.toLowerCase().includes(templateSearch.toLowerCase())
      )
    : templates

  useEffect(() => {
    window.api.templateList().then((templates) => {
      setCustomTemplates(
        templates.map((t) => ({
          cmd: t.name.toLowerCase().replace(/\s+/g, '-'),
          label: `/${t.name}`,
          description: t.prompt.slice(0, 40) + (t.prompt.length > 40 ? '…' : ''),
          prompt: t.prompt,
          isCustom: true,
        }))
      )
    })
  }, [])

  const historyRef = useRef<string[]>(
    JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  )
  const historyIdxRef = useRef<number>(-1)
  const savedInputRef = useRef<string>('')

  const slashQuery = parseSlash(text)
  const isSlashOpen = slashQuery !== null
  const allCommands = [...SLASH_COMMANDS, ...customTemplates]
  const filteredCmds = isSlashOpen
    ? allCommands.filter(c => c.cmd.startsWith(slashQuery.toLowerCase()))
    : []

  const mentionQuery = useMemo(
    () => parseMention(text, cursorPosRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text]
  )
  const isMentionOpen = mentionQuery !== null && !isSlashOpen
  const filteredFiles = isMentionOpen
    ? recentFiles.filter(f => {
        const name = f.split(/[/\\]/).pop()?.toLowerCase() ?? ''
        return name.includes(mentionQuery.toLowerCase())
      }).slice(0, 8)
    : []

  const selectMention = async (filePath: string) => {
    const cursorPos = cursorPosRef.current
    const before = text.slice(0, cursorPos)
    const after = text.slice(cursorPos)
    const atStart = before.lastIndexOf('@')

    let insertion = filePath
    try {
      const content = await window.api.readFile(filePath)
      if (content) {
        const ext = filePath.split('.').pop() ?? ''
        const name = filePath.split(/[/\\]/).pop() ?? filePath
        const truncated = content.length > MAX_CONTENT_CHARS
        const body = truncated ? content.slice(0, MAX_CONTENT_CHARS) : content
        insertion = `\`\`\`${ext}\n// ${name}\n${body}${truncated ? '\n// [...truncated]' : ''}\n\`\`\``
      }
    } catch { /* fallback: use path as-is */ }

    const newText = before.slice(0, atStart) + insertion + after
    setText(newText)
    setMentionSelected(0)
    setTimeout(() => {
      adjustHeight()
      const ta = textareaRef.current
      if (ta) {
        const newPos = atStart + insertion.length
        ta.focus()
        ta.selectionStart = ta.selectionEnd = newPos
        cursorPosRef.current = newPos
      }
    }, 0)
  }

  const toggleMultilineMode = () => {
    const next = !multilineModeRef.current
    multilineModeRef.current = next
    setMultilineMode(next)
    setTimeout(() => adjustHeight(), 0)
  }

  const adjustHeight = () => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, multilineModeRef.current ? 400 : 200) + 'px'
    }
  }

  // text 변경 시 높이 자동 조정 (Shift+Enter 줄바꿈 포함)
  useEffect(() => {
    adjustHeight()
  }, [text])

  const selectSlashCommand = (cmd: SlashCommand) => {
    setText(cmd.prompt)
    setSlashSelected(0)
    setTimeout(() => {
      adjustHeight()
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        ta.selectionStart = ta.selectionEnd = cmd.prompt.length
      }
    }, 0)
  }

  const selectSnippet = (snippet: Snippet) => {
    const cursorPos = cursorPosRef.current
    const trigger = parseSnippetTrigger(text, cursorPos)
    if (!trigger) {
      setSnippetMatches([])
      setSnippetMenuIdx(-1)
      return
    }
    const before = text.slice(0, trigger.triggerStart)
    const after = text.slice(cursorPos)
    const newText = before + snippet.content + after
    setText(newText)
    setSnippetMatches([])
    setSnippetMenuIdx(-1)
    const newCursor = trigger.triggerStart + snippet.content.length
    setTimeout(() => {
      adjustHeight()
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        ta.selectionStart = ta.selectionEnd = newCursor
        cursorPosRef.current = newCursor
      }
    }, 0)
  }

  const selectVarSuggestion = (varName: string) => {
    const cursorPos = cursorPosRef.current
    const trigger = parseVarTrigger(text, cursorPos)
    if (!trigger) {
      setVarSuggestionsOpen(false)
      return
    }
    const before = text.slice(0, trigger.triggerStart)
    const after = text.slice(cursorPos)
    const insertion = `{{${varName}}}`
    const newText = before + insertion + after
    setText(newText)
    setVarSuggestionsOpen(false)
    setVarSuggestionsIdx(0)
    // save to history
    try {
      const stored = localStorage.getItem(TEMPLATE_VARS_KEY)
      const history: string[] = stored ? JSON.parse(stored) : []
      const updated = [varName, ...history.filter(v => v !== varName)].slice(0, 20)
      localStorage.setItem(TEMPLATE_VARS_KEY, JSON.stringify(updated))
    } catch { /* ignore */ }
    const newCursor = before.length + insertion.length
    setTimeout(() => {
      adjustHeight()
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        ta.selectionStart = ta.selectionEnd = newCursor
        cursorPosRef.current = newCursor
      }
    }, 0)
  }

  const updateCursor = () => {
    cursorPosRef.current = textareaRef.current?.selectionStart ?? cursorPosRef.current
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    updateCursor()

    // Smart input: wrap selected text with quotes or parens
    if (smartInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ta = textareaRef.current
      if (ta) {
        const start = ta.selectionStart ?? 0
        const end = ta.selectionEnd ?? 0
        if (start !== end) {
          if (e.key === '"') {
            e.preventDefault()
            const selected = text.slice(start, end)
            const newText = text.slice(0, start) + '"' + selected + '"' + text.slice(end)
            setText(newText)
            requestAnimationFrame(() => {
              ta.selectionStart = start + 1
              ta.selectionEnd = end + 1
            })
            return
          }
          if (e.key === '(') {
            e.preventDefault()
            const selected = text.slice(start, end)
            const newText = text.slice(0, start) + '(' + selected + ')' + text.slice(end)
            setText(newText)
            requestAnimationFrame(() => {
              ta.selectionStart = start + 1
              ta.selectionEnd = end + 1
            })
            return
          }
        }
      }
    }

    // Var suggestions dropdown navigation
    if (varSuggestionsOpen && varSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setVarSuggestionsIdx(i => (i + 1) % varSuggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setVarSuggestionsIdx(i => (i - 1 + varSuggestions.length) % varSuggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectVarSuggestion(varSuggestions[varSuggestionsIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setVarSuggestionsOpen(false)
        return
      }
    }

    // Snippet shortcut dropdown navigation
    if (snippetMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSnippetMenuIdx(i => (i + 1) % snippetMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSnippetMenuIdx(i => (i - 1 + snippetMatches.length) % snippetMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const idx = snippetMenuIdx < 0 ? 0 : snippetMenuIdx
        e.preventDefault()
        selectSnippet(snippetMatches[Math.min(idx, snippetMatches.length - 1)])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSnippetMatches([])
        setSnippetMenuIdx(-1)
        return
      }
    }

    // Mention dropdown navigation
    if (isMentionOpen && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionSelected(i => (i + 1) % filteredFiles.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionSelected(i => (i - 1 + filteredFiles.length) % filteredFiles.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(filteredFiles[Math.min(mentionSelected, filteredFiles.length - 1)])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        // Close mention by removing the @ trigger
        const before = text.slice(0, cursorPosRef.current)
        const after = text.slice(cursorPosRef.current)
        const atStart = before.lastIndexOf('@')
        const newText = before.slice(0, atStart) + after
        setText(newText)
        return
      }
    }

    // Slash command navigation takes priority
    if (isSlashOpen && filteredCmds.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashSelected(i => (i + 1) % filteredCmds.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashSelected(i => (i - 1 + filteredCmds.length) % filteredCmds.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectSlashCommand(filteredCmds[Math.min(slashSelected, filteredCmds.length - 1)])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setText('')
        return
      }
    }

    // Shift+Enter: toggle multiline mode
    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey) {
      if (!multilineModeRef.current) {
        e.preventDefault()
        toggleMultilineMode()
        return
      }
      // in multiline mode, Shift+Enter inserts newline (default behavior — fall through)
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (multilineModeRef.current) {
        // multiline mode: Enter inserts newline (default), Ctrl+Enter sends
        if (e.ctrlKey) {
          e.preventDefault()
          if (text.trim() && !isStreaming) {
            doSend(text.trim())
          }
        }
        return
      }
      e.preventDefault()
      if (text.trim() && !isStreaming) {
        doSend(text.trim())
      }
      return
    }

    if (!e.altKey && e.key === 'ArrowUp' && !e.shiftKey && !text.includes('\n')) {
      const hist = historyRef.current
      if (hist.length === 0) return
      e.preventDefault()
      if (historyIdxRef.current === -1) savedInputRef.current = text
      const newIdx = Math.min(historyIdxRef.current + 1, hist.length - 1)
      historyIdxRef.current = newIdx
      setText(hist[newIdx])
      setTimeout(adjustHeight, 0)
      return
    }

    if (!e.altKey && e.key === 'ArrowDown' && !e.shiftKey && !text.includes('\n')) {
      if (historyIdxRef.current === -1) return
      e.preventDefault()
      if (historyIdxRef.current <= 0) {
        historyIdxRef.current = -1
        setText(savedInputRef.current)
        setTimeout(adjustHeight, 0)
        return
      }
      historyIdxRef.current--
      setText(historyRef.current[historyIdxRef.current])
      setTimeout(adjustHeight, 0)
      return
    }
  }

  const handleQuickAction = useCallback((prompt: string) => {
    setText(prompt)
    setTimeout(() => {
      const ta = textareaRef.current
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
    }, 0)
  }, [])

  const saveQuickActionEdit = useCallback(() => {
    if (!editingAction) return
    const updated = quickActions.map(a => a.id === editingAction ? { ...a, label: editLabel, prompt: editPrompt } : a)
    setQuickActions(updated)
    localStorage.setItem(QUICK_ACTIONS_KEY, JSON.stringify(updated))
    setEditingAction(null)
  }, [editingAction, editLabel, editPrompt, quickActions])

  const doSend = (trimmed: string) => {
    const next = [trimmed, ...historyRef.current.filter(h => h !== trimmed)].slice(0, MAX_HISTORY)
    historyRef.current = next
    historyIdxRef.current = -1
    savedInputRef.current = ''
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    onSend(trimmed)
    setText('')
    setPreviewImages([])
    localStorage.removeItem(DRAFT_KEY)
    if (draftTimerRef.current !== null) {
      clearTimeout(draftTimerRef.current)
      draftTimerRef.current = null
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleSend = () => {
    if (text.trim() && !isStreaming) {
      doSend(text.trim())
    }
  }

  const handleEnhance = async () => {
    if (!text.trim() || enhancing) return
    setEnhancing(true)
    const enhanced = await window.api.enhancePrompt(text)
    setText(enhanced)
    setEnhancing(false)
    setTimeout(() => adjustHeight(), 0)
  }

  const handleVoiceInput = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      console.log('speech not supported')
      return
    }

    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'ko-KR'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      const ta = textareaRef.current
      const pos = ta?.selectionStart ?? text.length
      setText(prev => {
        const newText = prev.slice(0, pos) + transcript + prev.slice(pos)
        return newText
      })
      setTimeout(() => adjustHeight(), 0)
    }

    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string ?? '')
      reader.onerror = reject
      reader.readAsText(file)
    })

  const handleContainerDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const parts: string[] = []
    for (const file of files.slice(0, 5)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (file.size > MAX_FILE_SIZE) {
        parts.push(`\`[${file.name}: 파일 크기 초과 (${Math.round(file.size / 1024)}KB)]\``)
        continue
      }
      if (!TEXT_EXTS.has(ext) && !file.type.startsWith('text/')) {
        parts.push(`\`[${file.name}: 텍스트 파일 아님]\``)
        continue
      }
      try {
        const content = await readFileAsText(file)
        parts.push(`\`\`\`${ext}\n// ${file.name}\n${content.slice(0, 8000)}\n\`\`\``)
      } catch {
        parts.push(`\`[${file.name}: 읽기 실패]\``)
      }
    }

    if (parts.length > 0) {
      setText(prev => prev ? `${prev}\n\n${parts.join('\n\n')}` : parts.join('\n\n'))
    }
    setTimeout(() => adjustHeight(), 0)
  }

  const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const isNavigating = historyIdxRef.current >= 0

  return (
    <>
    {isPaused && (
      <div style={{
        padding: '8px 12px',
        background: 'rgba(251,191,36,0.08)',
        borderTop: '1px solid rgba(251,191,36,0.3)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13 }}>⏸</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600, marginBottom: 2 }}>작업 저장됨</div>
          {pausedTask && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pausedTask}
            </div>
          )}
        </div>
        <button
          onClick={onResume}
          style={{
            padding: '4px 12px', background: '#fbbf24', color: '#000',
            borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          }}
        >▶ 재개</button>
        <button
          onClick={onInterrupt}
          style={{
            padding: '4px 8px', background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, cursor: 'pointer', flexShrink: 0,
          }}
        >✕ 취소</button>
      </div>
    )}
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleContainerDrop}
      style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {isDragging && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px dashed var(--accent, #527bff)',
          background: 'rgba(82,139,255,0.05)',
          borderRadius: 6,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}>
          <span style={{ color: 'var(--accent, #527bff)', fontSize: 13, fontWeight: 500 }}>
            📎 파일을 여기에 놓으세요
          </span>
        </div>
      )}
      {/* Slash command dropdown */}
      {isSlashOpen && filteredCmds.length > 0 && (
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
          {filteredCmds.map((c, i) => (
            <div
              key={c.cmd}
              onClick={() => selectSlashCommand(c)}
              onMouseEnter={() => setSlashSelected(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 12px',
                cursor: 'pointer',
                background: i === slashSelected ? 'var(--bg-hover)' : 'transparent',
                borderBottom: i < filteredCmds.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{ fontSize: 12, color: c.isCustom ? 'var(--warning, #e5a50a)' : 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: 90 }}>
                {c.label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {c.description}
              </span>
              {c.isCustom && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>저장됨</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mention (@file) dropdown */}
      {isMentionOpen && filteredFiles.length > 0 && (
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
                onClick={() => selectMention(filePath)}
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
      )}

      {/* Template var autocomplete dropdown */}
      {varSuggestionsOpen && varSuggestions.length > 0 && (
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
              onClick={() => selectVarSuggestion(varName)}
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
      )}

      {/* Snippet shortcut dropdown */}
      {snippetMatches.length > 0 && (
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
              onClick={() => selectSnippet(s)}
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
      )}

      {previewImages.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 12,
          right: 60,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '6px 8px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border)',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          borderRadius: '6px 6px 0 0',
          marginBottom: 0,
        }}>
          {previewImages.map((img, i) => (
            <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={img.dataUrl}
                style={{ height: 64, borderRadius: 4, objectFit: 'contain', display: 'block' }}
              />
              <button
                onClick={() => setPreviewImages(prev => prev.filter((_, idx) => idx !== i))}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--error)',
                  color: '#fff',
                  fontSize: 10,
                  lineHeight: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  border: 'none',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 빠른 액션 슬롯 */}
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
              onClick={() => handleQuickAction(action.prompt)}
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
      {showTemplates && (
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
                  onClick={() => setShowTemplates(false)}
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
                    onClick={() => handleInsertTemplate(tpl)}
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
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          cursorPosRef.current = e.target.selectionStart ?? 0
          const val = e.target.value
          const pos = e.target.selectionStart ?? 0
          setText(val)
          setSlashSelected(0)
          setMentionSelected(0)
          if (historyIdxRef.current >= 0) {
            historyIdxRef.current = -1
          }
          if (draftTimerRef.current !== null) clearTimeout(draftTimerRef.current)
          draftTimerRef.current = setTimeout(() => {
            localStorage.setItem(DRAFT_KEY, val)
          }, 500)
          // Snippet shortcut trigger
          const snippetTrigger = parseSnippetTrigger(val, pos)
          if (snippetTrigger && snippetTrigger.query.length > 0) {
            window.api.snippetList().then((all) => {
              const q = snippetTrigger.query.toLowerCase()
              const matches = (all ?? [])
                .filter(s => s.shortcut && s.shortcut.toLowerCase().startsWith(q))
                .slice(0, 5)
              setSnippetMatches(matches)
              setSnippetMenuIdx(-1)
            })
          } else {
            setSnippetMatches([])
            setSnippetMenuIdx(-1)
          }
          // Template var autocomplete trigger
          const varTrigger = parseVarTrigger(val, pos)
          if (varTrigger) {
            try {
              const stored = localStorage.getItem(TEMPLATE_VARS_KEY)
              const history: string[] = stored ? JSON.parse(stored) : []
              const partial = varTrigger.partial.toLowerCase()
              const filtered = (partial.length === 0 ? history : history.filter(v => v.toLowerCase().startsWith(partial))).slice(0, MAX_VAR_SUGGESTIONS)
              setVarSuggestions(filtered)
              setVarSuggestionsOpen(filtered.length > 0)
              setVarSuggestionsIdx(0)
            } catch {
              setVarSuggestionsOpen(false)
            }
          } else {
            setVarSuggestionsOpen(false)
          }
        }}
        onClick={updateCursor}
        onSelect={updateCursor}
        onKeyUp={updateCursor}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          const items = Array.from(e.clipboardData?.items ?? [])
          const imageItem = items.find(it => it.type.startsWith('image/'))
          if (imageItem) {
            e.preventDefault()
            const blob = imageItem.getAsFile()
            if (!blob) return
            const ext = imageItem.type.split('/')[1] ?? 'png'
            const reader = new FileReader()
            reader.onload = async () => {
              const dataUrl = reader.result as string
              const base64 = dataUrl.split(',')[1]
              if (!base64) return
              const path = await window.api.saveClipboardImage(base64, ext)
              if (path) {
                setPreviewImages(prev => [...prev, { dataUrl, path }])
                const ta = textareaRef.current
                const pos = ta?.selectionStart ?? text.length
                const newText = text.slice(0, pos) + path + text.slice(pos)
                setText(newText)
                setTimeout(() => adjustHeight(), 0)
              }
            }
            reader.readAsDataURL(blob)
          }
        }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDrop={async (e) => {
          e.preventDefault()
          const files = Array.from(e.dataTransfer.files)
          if (files.length === 0) return

          const parts: string[] = []

          for (const file of files) {
            if (file.type.startsWith('image/')) {
              if (file.path) parts.push(file.path)
            } else if (isTextFile(file.name)) {
              if (file.size > MAX_FILE_SIZE) {
                // 너무 큰 파일: 경로만
                if (file.path) parts.push(file.path)
              } else {
                try {
                  let content = await readFileContent(file)
                  let truncated = false
                  if (content.length > MAX_CONTENT_CHARS) {
                    content = content.slice(0, MAX_CONTENT_CHARS)
                    truncated = true
                  }
                  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
                  const suffix = truncated ? '\n// [...truncated]' : ''
                  parts.push(`\`\`\`${ext}\n// ${file.name}\n${content}${suffix}\n\`\`\``)
                } catch {
                  if (file.path) parts.push(file.path)
                }
              }
            } else {
              if (file.path) parts.push(file.path)
            }
          }

          if (parts.length > 0) {
            const insertion = parts.join('\n\n')
            const ta = textareaRef.current
            const pos = ta?.selectionStart ?? text.length
            const prefix = pos > 0 && text.slice(0, pos).slice(-1) !== '\n' ? '\n' : ''
            const newText = text.slice(0, pos) + prefix + insertion + text.slice(pos)
            setText(newText)
            setTimeout(() => adjustHeight(), 0)
          }
        }}
        placeholder={disabled ? 'Open a folder to start...' : multilineMode ? 'Message Claude... (Enter: 줄바꿈, Ctrl+Enter: 전송, Shift+Enter: 일반 모드)' : 'Message Claude... (/ commands, @file, Enter to send, Shift+Enter: 멀티라인 모드)'}
        disabled={disabled || isStreaming}
        rows={1}
        style={{
          width: '100%',
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: `1px solid ${multilineMode ? 'var(--accent-dim)' : isNavigating ? 'var(--accent-dim)' : isSlashOpen || isMentionOpen || snippetMatches.length > 0 || varSuggestionsOpen ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '8px 10px',
          fontSize: 13,
          resize: 'none',
          minHeight: multilineMode ? 120 : 38,
          maxHeight: multilineMode ? 400 : 200,
          overflowY: 'auto',
          lineHeight: 1.5,
          fontFamily: 'var(--font-ui)',
        }}
        onInput={(e) => {
          const ta = e.target as HTMLTextAreaElement
          ta.style.height = 'auto'
          ta.style.height = Math.min(ta.scrollHeight, multilineModeRef.current ? 400 : 200) + 'px'
        }}
      />
      {text.trim().length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          fontSize: 11, color: 'var(--text-muted, #666)',
          padding: '2px 4px'
        }}>
          <span>{text.split('\n').length}L</span>
          <span style={{ color: text.length > 8000 ? 'var(--error, #f44336)' : undefined }}>
            {text.length}
          </span>
          {(() => {
            const tokenCount = estimateTokens(text)
            return (
              <span style={{
                fontSize: 9,
                color: tokenCount > 8000 ? '#f87171' : tokenCount > 2000 ? '#fbbf24' : 'var(--text-muted)',
                flexShrink: 0,
                userSelect: 'none',
              }}>
                ~{tokenCount > 999 ? `${(tokenCount / 1000).toFixed(1)}k` : tokenCount} 토큰
              </span>
            )
          })()}
        </div>
      )}
      </div>

      {hasSpeech && (
        <button
          onClick={handleVoiceInput}
          disabled={disabled}
          title={isRecording ? '녹음 중지' : '음성 입력'}
          style={{
            padding: '8px',
            background: isRecording ? 'var(--error)' : 'var(--bg-tertiary)',
            color: isRecording ? '#fff' : 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            flexShrink: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: 'none',
            animation: isRecording ? 'pulse 1s infinite' : 'none',
          }}
        >
          🎤
        </button>
      )}

      <button
        onClick={toggleMultilineMode}
        title={multilineMode ? '멀티라인 모드 끄기 (일반 모드로 전환)' : '멀티라인 모드 켜기 (Shift+Enter)'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: multilineMode ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: 16, padding: '4px',
        }}
      >
        ⊞
      </button>

      <button
        onClick={() => setShowTemplates(v => !v)}
        title="메시지 템플릿"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: showTemplates ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: 16, padding: '4px',
        }}
      >
        📋
      </button>

      <button
        onClick={() => {
          const next = !smartInput
          setSmartInput(next)
          localStorage.setItem('smart-input', String(next))
        }}
        title={smartInput ? '스마트 입력 끄기 (선택 후 " 또는 ( 입력 시 자동 감싸기)' : '스마트 입력 켜기 (선택 후 " 또는 ( 입력 시 자동 감싸기)'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: smartInput ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: 16, padding: '4px',
          opacity: smartInput ? 1 : 0.5,
        }}
      >
        ✨
      </button>

      {text.trim().length > 0 && (
        <button
          onClick={handleEnhance}
          disabled={enhancing}
          title="프롬프트 개선 (AI)"
          style={{
            background: 'none', border: 'none', cursor: enhancing ? 'not-allowed' : 'pointer',
            color: enhancing ? 'var(--text-muted)' : 'var(--accent)',
            fontSize: 16, padding: '4px', opacity: enhancing ? 0.5 : 1
          }}
        >
          🪄
        </button>
      )}

      <select
        value={selectedModel}
        onChange={(e) => handleModelChange(e.target.value)}
        title="전송에 사용할 모델"
        style={{
          background: 'var(--bg-input)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 6px',
          fontSize: 11,
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <option value="claude-opus-4-6">Opus 4</option>
        <option value="claude-sonnet-4-6">Sonnet 4</option>
        <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
        {ollamaModels.length > 0 && (
          <>
            <option disabled value="">── Ollama ──</option>
            {ollamaModels.map(m => (
              <option key={m} value={`ollama:${m}`}>{m}</option>
            ))}
          </>
        )}
        <option disabled value="">── OpenAI ──</option>
        <option value="openai:gpt-4o">gpt-4o</option>
        <option value="openai:gpt-4o-mini">gpt-4o-mini</option>
        <option value="openai:o3-mini">o3-mini</option>
      </select>

      {isStreaming ? (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={isPaused ? onResume : onPause}
            style={{
              padding: '8px 12px',
              background: isPaused ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: isPaused ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: 'pointer',
            }}
            title={isPaused ? '재개 (Resume)' : '일시정지 (Pause)'}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={onInterrupt}
            style={{
              padding: '8px 12px',
              background: 'var(--error)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: 'pointer',
            }}
            title="중지 (Stop)"
          >
            ⏹ Stop
          </button>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center', minWidth: 30 }}>
            {streamElapsed}s
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {text.length > 100 && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', alignSelf: 'center' }}>
              {text.includes('\n') ? `${text.split('\n').length}L ` : ''}{text.length}c
            </span>
          )}
          {onOpenPromptChain && (
            <button
              onClick={onOpenPromptChain}
              title="PromptChain 열기"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 16,
                padding: '4px',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              ⛓
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={!text.trim() || disabled}
            style={{
              padding: '8px 14px',
              background: text.trim() && !disabled ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: text.trim() && !disabled ? '#fff' : 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              flexShrink: 0,
              cursor: text.trim() && !disabled ? 'pointer' : 'not-allowed',
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
    </>
  )
}

