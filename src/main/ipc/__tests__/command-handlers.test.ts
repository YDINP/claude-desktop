/**
 * @vitest-environment node
 *
 * command-handlers.ts — commandScan / commandLoadWorkflow / hasArguments 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import { homedir } from 'os'

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const { ipcHandlers, mockIpcMain, mockStat, mockReaddir, mockReadFile } = vi.hoisted(() => {
  const ipcHandlers = new Map<string, Function>()
  const mockIpcMain = {
    handle: vi.fn((ch: string, fn: Function) => ipcHandlers.set(ch, fn)),
  }
  const mockStat = vi.fn()
  const mockReaddir = vi.fn()
  const mockReadFile = vi.fn()

  return { ipcHandlers, mockIpcMain, mockStat, mockReaddir, mockReadFile }
})

vi.mock('electron', () => ({ ipcMain: mockIpcMain }))
vi.mock('fs/promises', () => ({
  stat: mockStat,
  readdir: mockReaddir,
  readFile: mockReadFile,
}))

import { registerCommandHandlers } from '../command-handlers'

// ── helpers ───────────────────────────────────────────────────────────────────

/** stat이 존재하는 디렉토리처럼 동작하게 설정 */
function statAsDir() {
  return { isDirectory: () => true }
}

/** stat이 파일처럼 동작하게 설정 */
function statAsFile() {
  return { isDirectory: () => false }
}

/** readdir이 파일 항목(이름 배열)을 반환하도록 설정 */
function readdirFiles(names: string[]) {
  return names
}

/** readdir이 DirEnt 배열을 반환하도록 설정 (withFileTypes: true) */
function readdirDirEnts(entries: { name: string; isFile: boolean; isDirectory: boolean }[]) {
  return entries.map(e => ({
    name: e.name,
    isFile: () => e.isFile,
    isDirectory: () => e.isDirectory,
  }))
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  registerCommandHandlers()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('command-handlers', () => {
  describe('command:scan — commandScan .md 파일 스캔', () => {
    it('.claude/commands 내 .md 파일을 커맨드로 스캔한다', async () => {
      const projectPath = '/project'
      const commandsDir = join(projectPath, '.claude', 'commands')

      // .claude/commands 디렉토리 존재
      // .agents/workflows 없음
      // ~/.claude/commands 없음
      mockStat.mockImplementation((p: string) => {
        if (p === commandsDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string) => {
        if (p === commandsDir) return Promise.resolve(readdirFiles(['deploy.md', 'build.md', 'readme.txt']))
        return Promise.resolve(readdirDirEnts([]))
      })

      mockReadFile.mockImplementation((p: string) => {
        if (p.endsWith('deploy.md')) return Promise.resolve('# Deploy\nDeploy the project')
        if (p.endsWith('build.md')) return Promise.resolve('---\ndescription: Build script\n---\nContent')
        return Promise.reject(new Error('not found'))
      })

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath })

      expect(result).toHaveLength(2)
      expect(result[0].cmd).toBe('deploy')
      expect(result[0].label).toBe('/deploy')
      expect(result[0].source).toBe('commands')
      // extractDescription: frontmatter 없으면 첫 번째 # 헤딩 사용 → "Deploy"
      expect(result[0].description).toBe('Deploy')

      expect(result[1].cmd).toBe('build')
      expect(result[1].description).toBe('Build script')
      // .txt 파일은 제외됨
    })

    it('.agents/workflows 내 .md 파일을 워크플로우로 스캔한다', async () => {
      const projectPath = '/project'
      const workflowsDir = join(projectPath, '.agents', 'workflows')

      mockStat.mockImplementation((p: string) => {
        if (p === workflowsDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string) => {
        if (p === workflowsDir) return Promise.resolve(readdirFiles(['release.md']))
        return Promise.resolve(readdirDirEnts([]))
      })

      mockReadFile.mockResolvedValue('# Release workflow')

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath })

      expect(result).toHaveLength(1)
      expect(result[0].cmd).toBe('release')
      expect(result[0].source).toBe('workflows')
    })

    it('프로젝트 커맨드가 글로벌 커맨드보다 우선한다 (동일 cmd)', async () => {
      const projectPath = '/project'
      const commandsDir = join(projectPath, '.claude', 'commands')
      const globalDir = join(homedir(), '.claude', 'commands')

      mockStat.mockImplementation((p: string) => {
        if (p === commandsDir || p === globalDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string, opts?: { withFileTypes?: boolean }) => {
        if (p === commandsDir) return Promise.resolve(readdirFiles(['deploy.md']))
        if (p === globalDir) {
          if (opts?.withFileTypes) return Promise.resolve(readdirDirEnts([{ name: 'deploy.md', isFile: true, isDirectory: false }]))
          return Promise.resolve(readdirFiles(['deploy.md']))
        }
        return Promise.resolve([])
      })

      mockReadFile.mockImplementation((p: string) => {
        if (p.includes(commandsDir)) return Promise.resolve('# Project deploy')
        return Promise.resolve('# Global deploy')
      })

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath })

      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('commands') // 프로젝트가 우선
    })

    it('디렉토리가 없으면 빈 배열을 반환한다', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'))
      mockReaddir.mockResolvedValue([])

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath: '/nonexistent' })

      expect(result).toEqual([])
    })

    it('cmd는 소문자이고 공백이 하이픈으로 변환된다', async () => {
      const projectPath = '/project'
      const commandsDir = join(projectPath, '.claude', 'commands')

      mockStat.mockImplementation((p: string) => {
        if (p === commandsDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string) => {
        if (p === commandsDir) return Promise.resolve(readdirFiles(['My Command.md']))
        return Promise.resolve(readdirDirEnts([]))
      })

      mockReadFile.mockResolvedValue('content')

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath })

      expect(result[0].cmd).toBe('my-command')
      expect(result[0].label).toBe('/my-command')
    })
  })

  describe('command:scan — hasArguments 감지', () => {
    it('$ARGUMENTS 포함 시 hasArguments가 true다', async () => {
      const projectPath = '/project'
      const commandsDir = join(projectPath, '.claude', 'commands')

      mockStat.mockImplementation((p: string) => {
        if (p === commandsDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string) => {
        if (p === commandsDir) return Promise.resolve(readdirFiles(['run.md']))
        return Promise.resolve(readdirDirEnts([]))
      })

      mockReadFile.mockResolvedValue('Run with $ARGUMENTS provided')

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath })

      expect(result[0].hasArguments).toBe(true)
    })

    it('$ARGUMENTS 없으면 hasArguments가 false다', async () => {
      const projectPath = '/project'
      const commandsDir = join(projectPath, '.claude', 'commands')

      mockStat.mockImplementation((p: string) => {
        if (p === commandsDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string) => {
        if (p === commandsDir) return Promise.resolve(readdirFiles(['simple.md']))
        return Promise.resolve(readdirDirEnts([]))
      })

      mockReadFile.mockResolvedValue('Simple command with no placeholders')

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath })

      expect(result[0].hasArguments).toBe(false)
    })
  })

  describe('command:loadWorkflow — 워크플로우 로드', () => {
    it('.md 파일 내용을 반환한다', async () => {
      const content = '# My Workflow\nDo something with $ARGUMENTS'
      mockReadFile.mockResolvedValue(content)

      const handler = ipcHandlers.get('command:loadWorkflow')!
      const result = await handler({}, { filePath: '/project/.agents/workflows/release.md' })

      expect(result.content).toBe(content)
      expect(result.error).toBeUndefined()
    })

    it('파일이 없으면 error를 포함한 결과를 반환한다', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'))

      const handler = ipcHandlers.get('command:loadWorkflow')!
      const result = await handler({}, { filePath: '/nonexistent.md' })

      expect(result.content).toBe('')
      expect(result.error).toContain('ENOENT')
    })

    it('빈 파일도 정상 반환한다', async () => {
      mockReadFile.mockResolvedValue('')

      const handler = ipcHandlers.get('command:loadWorkflow')!
      const result = await handler({}, { filePath: '/empty.md' })

      expect(result.content).toBe('')
      expect(result.error).toBeUndefined()
    })
  })

  describe('command:scan — 글로벌 커맨드 스캔', () => {
    it('~/.claude/commands/ 직접 .md 파일을 글로벌 커맨드로 스캔한다', async () => {
      const globalDir = join(homedir(), '.claude', 'commands')

      mockStat.mockImplementation((p: string) => {
        if (p === globalDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string, opts?: { withFileTypes?: boolean }) => {
        if (p === globalDir && opts?.withFileTypes) {
          return Promise.resolve(readdirDirEnts([
            { name: 'ultrawork.md', isFile: true, isDirectory: false },
          ]))
        }
        return Promise.resolve([])
      })

      mockReadFile.mockResolvedValue('# Ultrawork skill\n$ARGUMENTS')

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath: '/project' })

      expect(result).toHaveLength(1)
      expect(result[0].cmd).toBe('ultrawork')
      expect(result[0].source).toBe('global-commands')
      expect(result[0].hasArguments).toBe(true)
    })

    it('서브폴더 내 skill.md를 글로벌 스킬로 스캔한다', async () => {
      const globalDir = join(homedir(), '.claude', 'commands')
      const skillDir = join(globalDir, 'ralph-loop')
      const skillFile = join(skillDir, 'skill.md')

      mockStat.mockImplementation((p: string) => {
        if (p === globalDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string, opts?: { withFileTypes?: boolean }) => {
        if (p === globalDir && opts?.withFileTypes) {
          return Promise.resolve(readdirDirEnts([
            { name: 'ralph-loop', isFile: false, isDirectory: true },
          ]))
        }
        return Promise.resolve([])
      })

      mockReadFile.mockImplementation((p: string) => {
        if (p === skillFile) return Promise.resolve('# Ralph Loop skill')
        return Promise.reject(new Error('not found'))
      })

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath: '/project' })

      expect(result).toHaveLength(1)
      expect(result[0].cmd).toBe('ralph-loop')
      expect(result[0].source).toBe('global-commands')
    })

    it('직접 .md가 있으면 서브폴더 동명 스킬보다 우선한다', async () => {
      const globalDir = join(homedir(), '.claude', 'commands')
      const directFile = join(globalDir, 'ultrawork.md')
      const skillFile = join(globalDir, 'ultrawork', 'skill.md')

      mockStat.mockImplementation((p: string) => {
        if (p === globalDir) return Promise.resolve(statAsDir())
        return Promise.reject(new Error('not found'))
      })

      mockReaddir.mockImplementation((p: string, opts?: { withFileTypes?: boolean }) => {
        if (p === globalDir && opts?.withFileTypes) {
          return Promise.resolve(readdirDirEnts([
            { name: 'ultrawork.md', isFile: true, isDirectory: false },
            { name: 'ultrawork', isFile: false, isDirectory: true },
          ]))
        }
        return Promise.resolve([])
      })

      mockReadFile.mockImplementation((p: string) => {
        if (p === directFile) return Promise.resolve('# Direct ultrawork')
        if (p === skillFile) return Promise.resolve('# Subfolder ultrawork')
        return Promise.reject(new Error('not found'))
      })

      const handler = ipcHandlers.get('command:scan')!
      const result = await handler({}, { projectPath: '/project' })

      // 중복 제거 — 하나만 있어야 함
      const ultraworkResults = result.filter((r: { cmd: string }) => r.cmd === 'ultrawork')
      expect(ultraworkResults).toHaveLength(1)
      expect(mockReadFile).not.toHaveBeenCalledWith(skillFile, 'utf-8')
    })
  })
})
