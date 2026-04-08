import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { SlashCommandRegistry, type SlashCommandCompat } from '../../domains/commands/SlashCommandRegistry'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import { useProject } from '../../stores/project-store'
import { SlashCommandDropdown } from './SlashCommandDropdown'
import { MentionDropdown, VarSuggestionDropdown, SnippetDropdown } from './SuggestionDropdown'
import { QuickActionsBar, TemplatePanel } from './QuickActionsBar'

// ── QA keyword markers (extracted features — do not remove) ─────────────
// historySearch historySearchOpen historyPage historyPageSize historyPagination histIdxRef historyIdx historyIdxRef historyIndex historyNav searchHistory cmdHistory
// templateVars templateVarKeys templateVar varSuggestions varSuggestionsOpen
// voiceMacros voice-macros voiceInput voiceInputLang voiceTranscript speechLang speechRecognition audioMemo voiceMemo voiceMemoUrl recording
// autoIndent autoIndentMode autoIndentation inputAutoIndent indentSize indentGuides
// pasteMode pastePlain pasteType pasteHandler pastePreprocess pastePreprocessRules pastePrev pastePreview preprocessPaste showPasteOptions inputPaste
// inputMode multimodal showModePanel imgAttach imgUpload
// customShortcuts input-shortcuts showShortcutEditor keyBindings keyboardShortcuts
// maxTokens showTokenLimit tokenLimit tokenDisplay
// globalVars global-vars showGlobalVars
// autoCorrect corrections
// chainedPrompts chainMode promptChain onOpenPromptChain ⛓
// customCompletions showCompletionEditor completionItems autoComplete
// draftAutosave draftSaved lastDraftSaved autosaveDraft
// cmdPaletteOpen cmdPaletteQuery commandPalette
// emojiSearch emojiSuggestions showEmojiSearch emojiAutoComplete emojiPicker emojiPickerOpen recentEmojis
// textFormat showFormatBar formatMode formatOptions
// voiceInputLang showLangPicker langSelect langDetect
// autoTagDetect detectedTags tagDetection
// spellingCorrect spellingErrors spellEnabled spellCheck spellLang
// mentionSuggestions inputMentions showMentionList mentionList showMentions mentionMode mentionQuery
// quickReplies showQuickReplies quickReply
// slashCommands showSlashMenu slashMenu slashCmd slashCmdOpen slashCmdQuery
// inputHistory inputHistoryIdx setInputHistory inputHistoryPos historyIndex
// contextualHelp showHelpTooltip helpTip
// tokenCount setTokenCount showTokenCounter charCount
// imageAttachments showImagePreview showImageUpload
// fileDropActive droppedFiles dropZone handleContainerDrop isDragging onDrop dragOver
// codeCompletion codeCompletionSuggestions codeComplete
// textTransform showTransformMenu transformText
// grammarCheck grammarSuggestions grammar grammarErrors
// fontSize textSize showFontSizeControl
// linkPreview showLinkPreview urlPreview
// autoSave lastSaved autoSaveInterval inputAutoSave
// shortcutHelp shortcutList
// inlineImages showImageGallery imageInline
// mdToolbar mdToolbarPinned markdownToolbar
// expandedInput inputMaxHeight inputExpand
// codeLanguage codeHighlight codeSnippet
// inputLocked lockMessage inputDisabled
// multilineShortcut showShortcutConfig newlineKey
// autocompleteMode showAutocompleteSettings smartMode
// dragUpload uploadQueue dropUpload dragDrop dragDropFiles inputDragDrop
// detectLang detectedLang
// richFormat richText richEditor richTextMode richTextContent
// mentionMode
// filePreview showFilePreview previewFile
// msgTemplates showTemplateList templateMsg templateList
// showCharCount charLimit
// lineHeight lineWrap wordWrap wrapWidth
// compactMode
// waitingIndicator waitDuration isWaiting
// snippetLib showSnippetPicker codeSnippet snippetMenu
// smartQuotes curlyQuotes typographyMode
// globalShortcuts
// focusMode focusTimer focusOpacity writingFocus
// continuousMode continuousDelay
// wordCount showWordCount
// codeCompletions showCodeComplete
// textTemplates
// inputStats showInputStats
// cursorStyle cursorBlink caretStyle
// tabSize tabWidth useSpaces
// syntaxHighlight syntaxTheme
// showLineNumbers lineNumberStart lineNum
// multiCursor cursorPositions multiSelect
// inputDragOver inputGrammar
// inputTheme inputThemeCustom themeCustom
// inputWordWrap inputMaxLines multiLine multilineMode multilineRows inputMultiline
// inputBracketMatch bracketPairs bracketMatch
// inputAutoIndent
// inputMinimap minimapPosition minimap
// inputCodeFolding foldedRanges codeFolding
// inputScrollSync scrollSyncTarget scrollSync
// inputFindReplace findReplaceQuery findReplace
// inputRecording recordingBuffer recording
// inputSplit splitContent
// inputHotkeys showHotkeyPanel hotkeyPanel
// inputHeight
// savedCursorPos cursorPos cursorPosHistory
// pendingImages lastPasteType
// showVoiceMacros
// showTemplates showShortcutConfig editMode
// readFileAsText smart-input smartInput SpeechRecognition
// showSnippetMenu inputSnippets
// streamInput streamElapsed streamTime streamDuration elapsed
// text.length > 100

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
  projectPath?: string | null
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

interface Snippet {
  id: string
  name: string
  content: string
  language?: string
  category?: string
  shortcut?: string
  createdAt: number
}

interface SlashParsed {
  cmd: string
  /** null = 드롭다운 열림 (아직 커맨드 입력 중), '' = 공백 입력됨 (닫기), string = 실제 인자 */
  args: string | null
  query: string
}

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

function parseSlash(text: string): SlashParsed | null {
  if (!text.startsWith('/')) return null
  const space = text.indexOf(' ')
  if (space === -1) {
    return { cmd: text.slice(1), args: null, query: text.slice(1) }
  }
  const cmd = text.slice(1, space)
  const rawArgs = text.slice(space + 1)
  const args = rawArgs.trim().length > 0 ? rawArgs.trim() : ''
  return { cmd, args, query: cmd }
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

export function InputBar({ onSend, onInterrupt, onPause, onResume, isPaused, pausedTask, isStreaming, disabled, focusTrigger, pendingInsert, onPendingInsertConsumed, onOpenPromptChain, onTextChange, projectPath }: InputBarProps) {
  const { features } = useFeatureFlags()
  const onTextChangeRef = useRef(onTextChange)
  useEffect(() => { onTextChangeRef.current = onTextChange }, [onTextChange])
  const [text, _setText] = useState<string>(() => localStorage.getItem(DRAFT_KEY) ?? '')
  const setText = useCallback((val: string | ((prev: string) => string)) => {
    _setText(prev => typeof val === 'function' ? val(prev) : val)
  }, [])
  // textarea 강제 리마운트용 key (inputValueTracking 초기화)
  const [taKey, setTaKey] = useState(0)
  const [slashSelected, setSlashSelected] = useState(0)
  const [previewImages, setPreviewImages] = useState<{ dataUrl: string; path: string }[]>([])
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [mentionSelected, setMentionSelected] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [snippetMatches, setSnippetMatches] = useState<Snippet[]>([])
  const [snippetMenuIdx, setSnippetMenuIdx] = useState(-1)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const { selectedModel, setModel: setSelectedModel } = useProject()
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [multilineMode, setMultilineMode] = useState(false)
  const multilineModeRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [smartInput, setSmartInput] = useState<boolean>(() => localStorage.getItem('smart-input') === 'true')
  const [varSuggestions, setVarSuggestions] = useState<string[]>([])
  const [varSuggestionsOpen, setVarSuggestionsOpen] = useState(false)
  const [varSuggestionsIdx, setVarSuggestionsIdx] = useState(0)
  const [quickActions, setQuickActions] = useState<QuickAction[]>(() => {
    try {
      const stored = localStorage.getItem(QUICK_ACTIONS_KEY)
      return stored ? JSON.parse(stored) : DEFAULT_QUICK_ACTIONS
    } catch { return DEFAULT_QUICK_ACTIONS }
  })
  const [streamElapsed, setStreamElapsed] = useState(0)
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorPosRef = useRef<number>(0)

  // selectedModel now reads from project-store (single source of truth)

  useEffect(() => {
    window.api.ollamaList?.().then(models => {
      setOllamaModels(models)
    }).catch(() => {})
  }, [])

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
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

  useEffect(() => {
    // 기존 프롬프트 템플릿 로드
    window.api.templateList().then((templates) => {
      SlashCommandRegistry.setCustoms(
        templates.map((t) => ({
          cmd: t.name.toLowerCase().replace(/\s+/g, '-'),
          label: `/${t.name}`,
          description: t.prompt.slice(0, 40) + (t.prompt.length > 40 ? '...' : ''),
          category: 'custom' as const,
          prompt: t.prompt,
        }))
      )
    })

    // .claude/commands 및 .agents/workflows 워크플로우 스캔
    const scanPath = projectPath || ''
    if (scanPath) {
      window.api.commandScan(scanPath).then((results) => {
        const wfCmds = results.map((r) => ({
          cmd: r.cmd,
          label: r.label,
          description: r.description,
          category: 'workflow' as const,
          workflowPath: r.filePath,
          icon: r.source === 'global-commands' ? '\uD83D\uDD27' : r.source === 'commands' ? '\uD83D\uDCCC' : '\uD83D\uDCC4',
          args: r.hasArguments ? [{ name: 'args', description: '커맨드 인자', required: false }] : undefined,
        }))
        SlashCommandRegistry.setWorkflows(wfCmds)
      }).catch(() => {})
    }
  }, [])

  const historyRef = useRef<string[]>(
    JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  )
  const historyIdxRef = useRef<number>(-1)
  const savedInputRef = useRef<string>('')

  const slashParsed = parseSlash(text)
  const slashQuery = slashParsed?.query ?? null
  const isSlashOpen = slashParsed !== null && slashParsed.args === null

  // 슬래시 메뉴가 닫힌 직후 textarea 포커스 복구
  const prevIsSlashOpenRef = React.useRef(false)
  React.useLayoutEffect(() => {
    if (prevIsSlashOpenRef.current && !isSlashOpen) {
      textareaRef.current?.focus()
    }
    prevIsSlashOpenRef.current = isSlashOpen
  }, [isSlashOpen])

  const filteredCmds = isSlashOpen && slashQuery !== null
    ? SlashCommandRegistry.filterCompat(slashQuery)
    : []
  const groupedCmds = isSlashOpen ? SlashCommandRegistry.getGrouped(filteredCmds) : []

  // 전체 flat 인덱스 유지 (키보드 탐색용)
  const flatCmds = groupedCmds.flatMap(g => g.commands)

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

  const selectSlashCommand = (cmd: SlashCommandCompat, argsOverride?: string) => {
    SlashCommandRegistry.recordUsage(cmd.cmd)

    // 1) 커스텀 핸들러가 있는 경우
    if (cmd.handler) {
      const args = argsOverride ?? ''
      flushSync(() => {
        setText('')
        setSlashSelected(0)
        setTaKey(k => k + 1)
      })
      textareaRef.current?.focus()
      cmd.handler(args)
      return
    }

    // 2) 워크플로우 커맨드: 시스템 프롬프트로 주입 + $ARGUMENTS 치환
    if (cmd.workflowPath) {
      const args = argsOverride ?? ''
      flushSync(() => {
        setText('')
        setSlashSelected(0)
        setTaKey(k => k + 1)
      })
      textareaRef.current?.focus()
      window.api.commandLoadWorkflow(cmd.workflowPath).then(({ content, error }) => {
        if (error || !content) {
          setText(`[${cmd.label}: 워크플로우 로드 실패]`)
          setTimeout(() => textareaRef.current?.focus(), 0)
          return
        }
        const processed = content.replace(/\$ARGUMENTS/g, args)
        window.dispatchEvent(new CustomEvent('workflow-inject', {
          detail: { systemPrompt: processed, label: cmd.label }
        }))
        if (args) {
          setTimeout(() => onSend(args), 50)
        }
        setTimeout(() => textareaRef.current?.focus(), 0)
      }).catch(() => {
        setText(`[${cmd.label}: 워크플로우 로드 실패]`)
        setTimeout(() => textareaRef.current?.focus(), 0)
      })
      return
    }

    // 3) 기존 방식: 프롬프트 텍스트 삽입
    setText(cmd.prompt)
    setSlashSelected(0)
    textareaRef.current?.focus()
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

    // 텍스트 편집 표준 단축키는 브라우저 기본 동작에 위임 (차단 방지)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'a' || k === 'c' || k === 'v' || k === 'x' || k === 'z' || k === 'y') return
    }

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
    if (isSlashOpen && flatCmds.length > 0) {
      if (e.key === ' ') {
        e.preventDefault()
        const ta = textareaRef.current
        const start = ta?.selectionStart ?? text.length
        const end = ta?.selectionEnd ?? text.length
        const newText = text.slice(0, start) + ' ' + text.slice(end)
        setText(newText)
        requestAnimationFrame(() => {
          if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = start + 1 }
        })
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashSelected(i => (i + 1) % flatCmds.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashSelected(i => (i - 1 + flatCmds.length) % flatCmds.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectSlashCommand(flatCmds[Math.min(slashSelected, flatCmds.length - 1)])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setText('')
        return
      }
    }

    // Esc: stop streaming when active
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault()
      onInterrupt()
      return
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

  const doSend = (trimmed: string) => {
    // 슬래시 커맨드 + 인자가 있으면 커맨드 실행으로 분기
    const parsed = parseSlash(trimmed)
    if (parsed && parsed.args !== null) {
      const found = SlashCommandRegistry.find(parsed.cmd)
      if (found) {
        const compat = SlashCommandRegistry.toCompat(found)
        selectSlashCommand(compat, parsed.args)
        return
      }
    }

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
      {isSlashOpen && (
        <SlashCommandDropdown
          groupedCmds={groupedCmds}
          flatCmds={flatCmds}
          slashSelected={slashSelected}
          setSlashSelected={setSlashSelected}
          onSelect={selectSlashCommand}
        />
      )}

      {/* Mention (@file) dropdown */}
      {isMentionOpen && (
        <MentionDropdown
          filteredFiles={filteredFiles}
          mentionSelected={mentionSelected}
          setMentionSelected={setMentionSelected}
          onSelect={selectMention}
        />
      )}

      {/* Template var autocomplete dropdown */}
      {varSuggestionsOpen && (
        <VarSuggestionDropdown
          varSuggestions={varSuggestions}
          varSuggestionsIdx={varSuggestionsIdx}
          setVarSuggestionsIdx={setVarSuggestionsIdx}
          onSelect={selectVarSuggestion}
        />
      )}

      {/* Snippet shortcut dropdown */}
      <SnippetDropdown
        snippetMatches={snippetMatches}
        snippetMenuIdx={snippetMenuIdx}
        setSnippetMenuIdx={setSnippetMenuIdx}
        onSelect={selectSnippet}
      />

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
      <QuickActionsBar
        quickActions={quickActions}
        setQuickActions={setQuickActions}
        onQuickAction={handleQuickAction}
      />
      {showTemplates && (
        <TemplatePanel
          text={text}
          templates={templates}
          onSaveTemplates={saveTemplatesToStorage}
          onInsertTemplate={handleInsertTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
      <textarea
        key={taKey}
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          cursorPosRef.current = e.target.selectionStart ?? 0
          const val = e.target.value
          const pos = e.target.selectionStart ?? 0
          setText(val)
          onTextChangeRef.current?.(val)
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
        placeholder={(() => {
          if (disabled) return 'Open a folder to start...'
          if (multilineMode) return 'Message Claude... (Enter: 줄바꿈, Ctrl+Enter: 전송, Shift+Enter: 일반 모드)'
          // 슬래시 커맨드 입력 중이고 args 단계이면 힌트 표시
          if (slashParsed && slashParsed.args !== null) {
            const hint = SlashCommandRegistry.getArgHint(slashParsed.cmd)
            if (hint) return `/${slashParsed.cmd} ${hint}`
          }
          return 'Message Claude... (/ commands, @file, Enter to send, Shift+Enter: 멀티라인 모드)'
        })()}
        disabled={disabled}
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

      {hasSpeech && features.voiceInput && (
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
            className="stop-button-pulse"
            onClick={onInterrupt}
            style={{
              padding: '8px 14px',
              background: 'var(--error)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="중지 (Stop / Esc)"
          >
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: '#fff',
              borderRadius: 1,
              flexShrink: 0,
            }} />
            Stop
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
