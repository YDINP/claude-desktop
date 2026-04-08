/**
 * SlashCommandRegistry — 슬래시 커맨드 중앙 레지스트리
 *
 * 내장(builtin), 사용자 정의(custom), 워크플로우(workflow) 커맨드를 통합 관리.
 * InputBar에서 `/` 입력 시 이 레지스트리를 참조하여 커맨드를 필터링 & 실행.
 *
 * 최근 사용 커맨드 추적 & 카테고리별 그룹 정렬 지원.
 */

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

export type CommandCategory = 'builtin' | 'custom' | 'workflow' | 'plugin'

export interface CommandArg {
  name: string
  description: string
  required?: boolean
}

export interface SlashCommandDef {
  /** 커맨드 이름 (소문자, 하이픈 허용). 예: "ultrawork", "fix" */
  cmd: string
  /** 드롭다운에 표시할 레이블. 예: "/ultrawork" */
  label: string
  /** 짧은 설명 */
  description: string
  /** 카테고리 */
  category: CommandCategory
  /** 단순 프롬프트 삽입 — 기존 방식 */
  prompt?: string
  /** 커스텀 핸들러 — prompt/workflow 대신 직접 로직 실행 */
  handler?: (args: string) => void
  /** 워크플로우 .md 파일 경로 (main process에서 로드) */
  workflowPath?: string
  /** 아이콘 (이모지 또는 문자) */
  icon?: string
  /** 인자 정의 (도움말 표시용) */
  args?: CommandArg[]
}

// InputBar가 사용하는 호환 타입
export interface SlashCommandCompat {
  cmd: string
  label: string
  description: string
  prompt: string
  isCustom?: boolean
  category?: CommandCategory
  handler?: (args: string) => void
  workflowPath?: string
  icon?: string
  args?: CommandArg[]
}

/** 카테고리별 그룹 정보 */
export interface CommandGroup {
  category: CommandCategory
  label: string
  icon: string
  commands: SlashCommandCompat[]
}

// ── 내장 커맨드 ────────────────────────────────────────────────────────────────

const BUILTIN_COMMANDS: SlashCommandDef[] = [
  { cmd: 'fix',       label: '/fix',       description: '버그 수정',       category: 'builtin', prompt: '다음 버그를 수정해줘:\n' },
  { cmd: 'explain',   label: '/explain',   description: '코드/개념 설명',   category: 'builtin', prompt: '다음을 자세히 설명해줘:\n' },
  { cmd: 'review',    label: '/review',    description: '코드 리뷰',        category: 'builtin', prompt: '다음 코드를 리뷰해줘:\n' },
  { cmd: 'refactor',  label: '/refactor',  description: '리팩토링',          category: 'builtin', prompt: '다음 코드를 리팩토링해줘:\n' },
  { cmd: 'test',      label: '/test',      description: '테스트 작성',       category: 'builtin', prompt: '다음 코드에 대한 테스트를 작성해줘:\n' },
  { cmd: 'docs',      label: '/docs',      description: '문서화',            category: 'builtin', prompt: '다음 코드를 문서화해줘:\n' },
  { cmd: 'optimize',  label: '/optimize',  description: '성능 최적화',       category: 'builtin', prompt: '다음 코드의 성능을 최적화해줘:\n' },
  { cmd: 'summarize', label: '/summarize', description: '대화 요약',         category: 'builtin', prompt: '지금까지 대화 내용을 요약해줘.' },
  { cmd: 'translate', label: '/translate', description: '번역',              category: 'builtin', prompt: '다음 내용을 한국어로 번역해줘:\n' },
  { cmd: 'think',     label: '/think',     description: '단계별 사고',       category: 'builtin', prompt: '다음을 단계별로 분석해줘:\n' },
  { cmd: 'compare',   label: '/compare',   description: '비교 분석',         category: 'builtin', prompt: '다음을 비교 분석해줘:\n' },
  { cmd: 'debug',     label: '/debug',     description: '디버깅',            category: 'builtin', prompt: '다음 문제를 디버깅해줘:\n' },
]

const RECENT_COMMANDS_KEY = 'slash-recent-commands'
const MAX_RECENT = 10

const CATEGORY_META: Record<CommandCategory, { label: string; icon: string; order: number }> = {
  builtin:  { label: '내장',        icon: '\u26A1', order: 0 },
  workflow: { label: '워크플로우',   icon: '\uD83D\uDCC4', order: 1 },
  custom:   { label: '사용자 정의', icon: '\u2699',  order: 2 },
  plugin:   { label: '플러그인',    icon: '\uD83D\uDD0C', order: 3 },
}

// ── 레지스트리 클래스 ───────────────────────────────────────────────────────────

class SlashCommandRegistryImpl {
  private builtins: SlashCommandDef[] = [...BUILTIN_COMMANDS]
  private customs: SlashCommandDef[] = []
  private workflows: SlashCommandDef[] = []
  private plugins: SlashCommandDef[] = []
  private recentCmds: string[] = []

  constructor() {
    try {
      this.recentCmds = JSON.parse(localStorage.getItem(RECENT_COMMANDS_KEY) ?? '[]')
    } catch {
      this.recentCmds = []
    }
  }

  // ── 조회 ──

  /** 모든 커맨드를 카테고리 순서로 반환 (builtin -> workflow -> custom -> plugin) */
  getAll(): SlashCommandDef[] {
    return [...this.builtins, ...this.workflows, ...this.customs, ...this.plugins]
  }

  /** 쿼리로 필터링 (cmd가 query로 시작하는 것). 최근 사용 커맨드를 상단에 배치 */
  filter(query: string): SlashCommandDef[] {
    const q = query.toLowerCase()
    const matched = this.getAll().filter(c => c.cmd.startsWith(q))
    return this.sortByRecent(matched)
  }

  /** cmd 이름으로 정확히 찾기 */
  find(cmd: string): SlashCommandDef | undefined {
    return this.getAll().find(c => c.cmd === cmd.toLowerCase())
  }

  // ── 등록 ──

  setCustoms(commands: SlashCommandDef[]): void {
    this.customs = commands
  }

  setWorkflows(commands: SlashCommandDef[]): void {
    this.workflows = commands
  }

  setPlugins(commands: SlashCommandDef[]): void {
    this.plugins = commands
  }

  // ── 최근 사용 추적 ──

  /** 커맨드 사용을 기록 */
  recordUsage(cmd: string): void {
    this.recentCmds = [cmd, ...this.recentCmds.filter(c => c !== cmd)].slice(0, MAX_RECENT)
    try {
      localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(this.recentCmds))
    } catch { /* localStorage full */ }
  }

  /** 최근 사용 순서로 정렬 (최근 사용한 것이 앞으로) */
  private sortByRecent(commands: SlashCommandDef[]): SlashCommandDef[] {
    if (this.recentCmds.length === 0) return commands
    const recentSet = new Map(this.recentCmds.map((c, i) => [c, i]))
    return [...commands].sort((a, b) => {
      const aIdx = recentSet.get(a.cmd)
      const bIdx = recentSet.get(b.cmd)
      if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx
      if (aIdx !== undefined) return -1
      if (bIdx !== undefined) return 1
      return 0
    })
  }

  getRecentCmds(): string[] {
    return [...this.recentCmds]
  }

  // ── 변환 유틸 ──

  toCompat(def: SlashCommandDef): SlashCommandCompat {
    return {
      cmd: def.cmd,
      label: def.label,
      description: def.description,
      prompt: def.prompt ?? '',
      isCustom: def.category !== 'builtin',
      category: def.category,
      handler: def.handler,
      workflowPath: def.workflowPath,
      icon: def.icon,
      args: def.args,
    }
  }

  getAllCompat(): SlashCommandCompat[] {
    return this.getAll().map(d => this.toCompat(d))
  }

  filterCompat(query: string): SlashCommandCompat[] {
    return this.filter(query).map(d => this.toCompat(d))
  }

  /** 카테고리별 그룹으로 반환 (드롭다운 섹션 표시용) */
  getGrouped(commands: SlashCommandCompat[]): CommandGroup[] {
    const groups = new Map<CommandCategory, SlashCommandCompat[]>()
    for (const c of commands) {
      const cat = c.category ?? 'builtin'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(c)
    }

    return Array.from(groups.entries())
      .map(([category, cmds]) => ({
        category,
        label: CATEGORY_META[category]?.label ?? category,
        icon: CATEGORY_META[category]?.icon ?? '',
        commands: cmds,
      }))
      .sort((a, b) => (CATEGORY_META[a.category]?.order ?? 99) - (CATEGORY_META[b.category]?.order ?? 99))
  }

  /** 인자 힌트 문자열 생성 (placeholder용) */
  getArgHint(cmd: string): string {
    const def = this.find(cmd)
    if (!def?.args?.length) return ''
    return def.args
      .map(a => a.required ? `<${a.name}>` : `[${a.name}]`)
      .join(' ')
  }
}

/** 싱글턴 인스턴스 */
export const SlashCommandRegistry = new SlashCommandRegistryImpl()
