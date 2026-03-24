/**
 * command-handlers.ts — 커스텀 슬래시 커맨드 IPC 핸들러
 *
 * 프로젝트 내 .md 커맨드 파일을 스캔하고 워크플로우 내용을 로드한다.
 * 스캔 대상:
 *   1. {projectRoot}/.claude/commands/*.md   (프로젝트 커맨드)
 *   2. {projectRoot}/.agents/workflows/*.md  (워크플로우)
 *   3. ~/.claude/commands/                   (글로벌 Claude Code 스킬)
 *      - 직접 .md 파일: ultrawork.md → /ultrawork
 *      - 서브폴더 skill.md: ultrawork/skill.md → /ultrawork
 */
import { ipcMain } from 'electron'
import { readdir, readFile, stat } from 'fs/promises'
import { join, basename, extname } from 'path'
import { homedir } from 'os'

interface WorkflowCommandMeta {
  cmd: string
  label: string
  description: string
  filePath: string
  source: 'commands' | 'workflows' | 'global-commands'
}

/**
 * .md 파일의 frontmatter에서 description을 추출한다.
 * ---
 * description: 여기에 설명
 * ---
 */
function extractDescription(content: string): string {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const fm = fmMatch[1]
    const descMatch = fm.match(/description:\s*(.+)/)
    if (descMatch) return descMatch[1].trim()
  }
  // frontmatter 없으면 첫 번째 # 제목 사용
  const headingMatch = content.match(/^#\s+(.+)/m)
  if (headingMatch) return headingMatch[1].trim()
  // 그것도 없으면 파일명 기반
  return ''
}

/**
 * 디렉토리 내 .md 파일을 스캔하여 커맨드 메타 목록 반환
 */
async function scanDir(dirPath: string, source: 'commands' | 'workflows'): Promise<WorkflowCommandMeta[]> {
  try {
    const dirStat = await stat(dirPath).catch(() => null)
    if (!dirStat?.isDirectory()) return []

    const entries = await readdir(dirPath)
    const results: WorkflowCommandMeta[] = []

    for (const entry of entries) {
      if (extname(entry) !== '.md') continue
      const filePath = join(dirPath, entry)
      const name = basename(entry, '.md')
      const cmd = name.toLowerCase().replace(/\s+/g, '-')

      try {
        const content = await readFile(filePath, 'utf-8')
        const description = extractDescription(content) || `${source}: ${name}`
        results.push({
          cmd,
          label: `/${cmd}`,
          description,
          filePath,
          source,
        })
      } catch {
        // 파일 읽기 실패 시 스킵
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * ~/.claude/commands/ 스캔:
 * - 직접 .md 파일 (ultrawork.md → /ultrawork)
 * - 서브폴더 내 skill.md (ultrawork/skill.md → /ultrawork, 폴더명 사용)
 * 동일 cmd는 직접 .md가 우선.
 */
async function scanGlobalCommands(): Promise<WorkflowCommandMeta[]> {
  const globalDir = join(homedir(), '.claude', 'commands')
  try {
    const dirStat = await stat(globalDir).catch(() => null)
    if (!dirStat?.isDirectory()) return []

    const entries = await readdir(globalDir, { withFileTypes: true })
    const results = new Map<string, WorkflowCommandMeta>()

    for (const entry of entries) {
      const entryPath = join(globalDir, entry.name)

      if (entry.isFile() && extname(entry.name) === '.md') {
        // 직접 .md 파일
        const cmd = basename(entry.name, '.md').toLowerCase().replace(/\s+/g, '-')
        try {
          const content = await readFile(entryPath, 'utf-8')
          const description = extractDescription(content) || `글로벌 커맨드: ${cmd}`
          results.set(cmd, { cmd, label: `/${cmd}`, description, filePath: entryPath, source: 'global-commands' })
        } catch { /* skip */ }
      } else if (entry.isDirectory()) {
        // 서브폴더: skill.md 또는 폴더명.md 탐색
        const cmd = entry.name.toLowerCase().replace(/\s+/g, '-')
        if (results.has(cmd)) continue // 직접 .md가 우선

        const candidates = ['skill.md', `${entry.name}.md`]
        for (const candidate of candidates) {
          const filePath = join(entryPath, candidate)
          try {
            const content = await readFile(filePath, 'utf-8')
            const description = extractDescription(content) || `글로벌 스킬: ${cmd}`
            results.set(cmd, { cmd, label: `/${cmd}`, description, filePath, source: 'global-commands' })
            break
          } catch { /* try next */ }
        }
      }
    }

    return [...results.values()]
  } catch {
    return []
  }
}

export function registerCommandHandlers(): void {
  /**
   * command:scan — 프로젝트 경로를 받아 사용 가능한 커맨드/워크플로우 목록 반환
   * 우선순위: 프로젝트 커맨드 > 워크플로우 > 글로벌 커맨드 (동일 cmd 시 앞이 우선)
   */
  ipcMain.handle(
    'command:scan',
    async (_, { projectPath }: { projectPath: string }): Promise<WorkflowCommandMeta[]> => {
      const [commands, workflows, globalCmds] = await Promise.all([
        scanDir(join(projectPath, '.claude', 'commands'), 'commands'),
        scanDir(join(projectPath, '.agents', 'workflows'), 'workflows'),
        scanGlobalCommands(),
      ])

      // 프로젝트 커맨드가 글로벌보다 우선 (중복 cmd 제거)
      const seen = new Set<string>()
      const merged: WorkflowCommandMeta[] = []
      for (const item of [...commands, ...workflows, ...globalCmds]) {
        if (!seen.has(item.cmd)) {
          seen.add(item.cmd)
          merged.push(item)
        }
      }
      return merged
    }
  )

  /**
   * command:loadWorkflow — .md 파일 내용을 읽어서 반환
   * $ARGUMENTS 플레이스홀더는 renderer에서 치환.
   */
  ipcMain.handle(
    'command:loadWorkflow',
    async (_, { filePath }: { filePath: string }): Promise<{ content: string; error?: string }> => {
      try {
        const content = await readFile(filePath, 'utf-8')
        return { content }
      } catch (e) {
        return { content: '', error: String(e) }
      }
    }
  )
}
