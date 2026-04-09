/**
 * @vitest-environment node
 *
 * cc-version-detector.ts — detectCCVersion 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// ── fs mock ───────────────────────────────────────────────────────────────────

vi.mock('fs', () => {
  const existsSync = vi.fn()
  const readFileSync = vi.fn()
  const readdirSync = vi.fn(() => [])
  return {
    default: { existsSync, readFileSync, readdirSync },
    existsSync,
    readFileSync,
    readdirSync,
  }
})

import fs from 'fs'
import { detectCCVersion } from '../cc-version-detector'

const mockExistsSync = vi.mocked(fs.existsSync)
const mockReadFileSync = vi.mocked(fs.readFileSync)
const mockReaddirSync = vi.mocked(fs.readdirSync)

// ── path helpers (cross-platform) ─────────────────────────────────────────────

// path.resolve로 정규화된 실제 경로를 사용한다
const ROOT_INPUT = 'C:/projects/MyGame'
const ROOT = path.resolve(ROOT_INPUT)
const ASSETS = path.join(ROOT, 'assets')
const PROJECT_JSON = path.join(ROOT, 'project.json')
const PACKAGE_JSON = path.join(ROOT, 'package.json')
const SETTINGS_PATH = path.join(ROOT, 'settings', 'project-setting.json')

/** 특정 경로만 존재하도록 existsSync 설정 */
function existsOnly(...paths: string[]) {
  mockExistsSync.mockImplementation((p: unknown) => paths.includes(p as string))
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockReaddirSync.mockReturnValue([])
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('detectCCVersion', () => {
  describe('빈/잘못된 입력', () => {
    it('빈 문자열이면 detected: false를 반환한다', () => {
      expect(detectCCVersion('')).toEqual({ detected: false })
    })

    it('존재하지 않는 경로면 detected: false를 반환한다', () => {
      mockExistsSync.mockReturnValue(false)
      expect(detectCCVersion(ROOT_INPUT)).toEqual({ detected: false })
    })

    it('assets 폴더가 없으면 detected: false를 반환한다', () => {
      // root만 존재, assets 없음
      mockExistsSync.mockImplementation((p: unknown) => p === ROOT)
      expect(detectCCVersion(ROOT_INPUT)).toEqual({ detected: false })
    })
  })

  describe('CC 2.x 감지 — project.json', () => {
    it('project.json 존재 시 version: 2x를 감지한다', () => {
      existsOnly(ROOT, ASSETS, PROJECT_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'MyGame',
        engine: { version: '2.4.13' },
      }))

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.detected).toBe(true)
      expect(result.version).toBe('2x')
      expect(result.creatorVersion).toBe('2.4.13')
      expect(result.name).toBe('MyGame')
      expect(result.projectPath).toBe(ROOT)
      expect(result.port).toBe(9090)
    })

    it('project.json에 engine.version 없으면 packages.cocos-creator.version을 사용한다', () => {
      existsOnly(ROOT, ASSETS, PROJECT_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'MyGame',
        packages: { 'cocos-creator': { version: '2.4.5' } },
      }))

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.creatorVersion).toBe('2.4.5')
    })

    it('project.json에 버전 정보 없으면 creatorVersion: 2.x 폴백', () => {
      existsOnly(ROOT, ASSETS, PROJECT_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'NoVersion' }))

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.version).toBe('2x')
      expect(result.creatorVersion).toBe('2.x')
    })

    it('project.json 파싱 실패해도 2x로 감지한다', () => {
      existsOnly(ROOT, ASSETS, PROJECT_JSON)
      mockReadFileSync.mockImplementation(() => { throw new Error('read error') })

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.detected).toBe(true)
      expect(result.version).toBe('2x')
    })

    it('assetsDir가 결과에 포함된다', () => {
      existsOnly(ROOT, ASSETS, PROJECT_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({}))

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.assetsDir).toBe(ASSETS)
    })

    it('.fire 씬 파일을 scenes에 포함한다', () => {
      existsOnly(ROOT, ASSETS, PROJECT_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({}))

      const fireEntry = {
        name: 'game.fire',
        isDirectory: () => false,
        isFile: () => true,
      } as unknown as fs.Dirent

      mockReaddirSync.mockReturnValue([fireEntry] as unknown as fs.Dirent[])

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.scenes).toContain(path.join(ASSETS, 'game.fire'))
    })
  })

  describe('CC 3.x 감지 — package.json', () => {
    it('package.json creator.version 존재 시 version: 3x를 감지한다', () => {
      existsOnly(ROOT, ASSETS, PACKAGE_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'Game3x',
        creator: { version: '3.8.6' },
      }))

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.detected).toBe(true)
      expect(result.version).toBe('3x')
      expect(result.creatorVersion).toBe('3.8.6')
      expect(result.name).toBe('Game3x')
      expect(result.port).toBe(9091)
    })

    it('package.json에 creator.version 없으면 settings 폴백 없을 때 detected: false', () => {
      existsOnly(ROOT, ASSETS, PACKAGE_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'NotCreator' }))

      const result = detectCCVersion(ROOT_INPUT)
      expect(result.detected).toBe(false)
    })

    it('.scene 씬 파일을 scenes에 포함한다', () => {
      existsOnly(ROOT, ASSETS, PACKAGE_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'Game3x',
        creator: { version: '3.8.6' },
      }))

      const sceneEntry = {
        name: 'main.scene',
        isDirectory: () => false,
        isFile: () => true,
      } as unknown as fs.Dirent

      mockReaddirSync.mockReturnValue([sceneEntry] as unknown as fs.Dirent[])

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.scenes).toContain(path.join(ASSETS, 'main.scene'))
    })
  })

  describe('CC 3.x 감지 — settings/project-setting.json 폴백', () => {
    it('settings/project-setting.json 존재 시 version: 3x 폴백 감지', () => {
      existsOnly(ROOT, ASSETS, SETTINGS_PATH)

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.detected).toBe(true)
      expect(result.version).toBe('3x')
      expect(result.creatorVersion).toBe('3.x')
      expect(result.port).toBe(9091)
    })

    it('settings 폴백에서 projectPath와 assetsDir가 올바르게 설정된다', () => {
      existsOnly(ROOT, ASSETS, SETTINGS_PATH)

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.projectPath).toBe(ROOT)
      expect(result.assetsDir).toBe(ASSETS)
    })
  })

  describe('우선순위', () => {
    it('project.json이 있으면 package.json보다 우선한다', () => {
      existsOnly(ROOT, ASSETS, PROJECT_JSON, PACKAGE_JSON)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        name: 'PriorityTest',
        engine: { version: '2.4.3' },
      }))

      const result = detectCCVersion(ROOT_INPUT)

      expect(result.version).toBe('2x')
    })
  })
})
