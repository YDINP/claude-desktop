/**
 * SlashCommandRegistry — 슬래시 커맨드 중앙 레지스트리
 *
 * 내장(builtin), 사용자 정의(custom), 워크플로우(workflow) 커맨드를 통합 관리.
 * InputBar에서 `/` 입력 시 이 레지스트리를 참조하여 커맨드를 필터링 & 실행.
 */

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

export type CommandCategory = 'builtin' | 'custom' | 'workflow'

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
  /** 워크플로우 .md 파일 경로 (main process에서 로드) */
  workflowPath?: string
  /** 아이콘 (이모지 또는 문자) */
  icon?: string
  /** 인자 정의 (도움말 표시용) */
  args?: CommandArg[]
}

// InputBar가 사용하는 기존 SlashCommand 인터페이스와의 호환을 위한 타입
export interface SlashCommandCompat {
  cmd: string
  label: string
  description: string
  prompt: string
  isCustom?: boolean
  /** 확장 필드 */
  category?: CommandCategory
  workflowPath?: string
  icon?: string
  args?: CommandArg[]
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

// ── 레지스트리 클래스 ───────────────────────────────────────────────────────────

class SlashCommandRegistryImpl {
  private builtins: SlashCommandDef[] = [...BUILTIN_COMMANDS]
  private customs: SlashCommandDef[] = []
  private workflows: SlashCommandDef[] = []

  // ── 조회 ──

  /** 모든 커맨드를 카테고리 순서로 반환 (builtin → workflow → custom) */
  getAll(): SlashCommandDef[] {
    return [...this.builtins, ...this.workflows, ...this.customs]
  }

  /** 쿼리로 필터링 (cmd가 query로 시작하는 것) */
  filter(query: string): SlashCommandDef[] {
    const q = query.toLowerCase()
    return this.getAll().filter(c => c.cmd.startsWith(q))
  }

  /** cmd 이름으로 정확히 찾기 */
  find(cmd: string): SlashCommandDef | undefined {
    return this.getAll().find(c => c.cmd === cmd.toLowerCase())
  }

  // ── 등록 ──

  /** 사용자 정의 커맨드 일괄 세팅 (프롬프트 템플릿에서 변환) */
  setCustoms(commands: SlashCommandDef[]): void {
    this.customs = commands
  }

  /** 워크플로우 커맨드 일괄 세팅 (main process 스캔 결과) */
  setWorkflows(commands: SlashCommandDef[]): void {
    this.workflows = commands
  }

  // ── 변환 유틸 ──

  /** SlashCommandDef → InputBar 호환 SlashCommandCompat 변환 */
  toCompat(def: SlashCommandDef): SlashCommandCompat {
    return {
      cmd: def.cmd,
      label: def.label,
      description: def.description,
      // workflow는 prompt가 없으므로 placeholder 생성
      prompt: def.prompt ?? '',
      isCustom: def.category !== 'builtin',
      category: def.category,
      workflowPath: def.workflowPath,
      icon: def.icon,
      args: def.args,
    }
  }

  /** 모든 커맨드를 compat 형식으로 반환 */
  getAllCompat(): SlashCommandCompat[] {
    return this.getAll().map(d => this.toCompat(d))
  }

  /** 필터링 결과를 compat 형식으로 반환 */
  filterCompat(query: string): SlashCommandCompat[] {
    return this.filter(query).map(d => this.toCompat(d))
  }
}

/** 싱글턴 인스턴스 */
export const SlashCommandRegistry = new SlashCommandRegistryImpl()
