import fs from 'fs'
import path from 'path'

export type CCMajorVersion = '2x' | '3x'

export interface CCFileProjectInfo {
  detected: boolean
  version?: CCMajorVersion
  creatorVersion?: string   // e.g. "2.4.13" or "3.8.6"
  name?: string
  projectPath?: string
  assetsDir?: string        // absolute path to assets folder
  scenes?: string[]         // absolute paths to .fire/.scene files
  port?: number             // legacy WS port (backward compat)
}

/**
 * CC 프로젝트 버전 감지 (파일 기반)
 * 1. project.json 존재 → CC 2.x
 * 2. package.json creator.version 존재 → CC 3.x
 * 3. settings/project-setting.json fallback → CC 3.x
 */
export function detectCCVersion(rootPath: string): CCFileProjectInfo {
  if (!rootPath) return { detected: false }

  let normalizedRoot: string
  try {
    normalizedRoot = path.resolve(rootPath)
  } catch {
    return { detected: false }
  }

  if (!fs.existsSync(normalizedRoot)) return { detected: false }

  const assetsDir = path.join(normalizedRoot, 'assets')
  if (!fs.existsSync(assetsDir)) return { detected: false }

  // ── CC 2.x: project.json at root ────────────────────────────────────────────
  const project2xPath = path.join(normalizedRoot, 'project.json')
  if (fs.existsSync(project2xPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(project2xPath, 'utf-8'))
      const creatorVersion =
        (pkg?.engine?.version as string | undefined) ||
        (pkg?.packages?.['cocos-creator']?.version as string | undefined)
      const scenes = findSceneFiles(assetsDir, '.fire')
      return {
        detected: true,
        version: '2x',
        creatorVersion: creatorVersion || '2.x',
        name: (pkg.name as string | undefined) || path.basename(normalizedRoot),
        projectPath: normalizedRoot,
        assetsDir,
        scenes,
        port: 9090,
      }
    } catch {
      return {
        detected: true,
        version: '2x',
        creatorVersion: '2.x',
        name: path.basename(normalizedRoot),
        projectPath: normalizedRoot,
        assetsDir,
        scenes: findSceneFiles(assetsDir, '.fire'),
        port: 9090,
      }
    }
  }

  // ── CC 3.x: package.json with creator.version ────────────────────────────────
  const pkgJsonPath = path.join(normalizedRoot, 'package.json')
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
      const creatorVersion = pkg?.creator?.version as string | undefined
      if (creatorVersion) {
        const scenes = findSceneFiles(assetsDir, '.scene')
        return {
          detected: true,
          version: '3x',
          creatorVersion,
          name: (pkg.name as string | undefined) || path.basename(normalizedRoot),
          projectPath: normalizedRoot,
          assetsDir,
          scenes,
          port: 9091,
        }
      }
    } catch { /* ignore */ }
  }

  // ── CC 3.x: settings/project-setting.json fallback ───────────────────────────
  const has3xSettings = fs.existsSync(path.join(normalizedRoot, 'settings', 'project-setting.json'))
  if (has3xSettings) {
    const scenes = findSceneFiles(assetsDir, '.scene')
    return {
      detected: true,
      version: '3x',
      creatorVersion: '3.x',
      name: path.basename(normalizedRoot),
      projectPath: normalizedRoot,
      assetsDir,
      scenes,
      port: 9091,
    }
  }

  return { detected: false }
}

/** assets 폴더에서 씬/프리팹 파일 목록 재귀 탐색 (최대 50개) */
// R2452 ISSUE-011: .fire/.scene 모두 스캔 (버전 오감지 시 씬 누락 방지)
function findSceneFiles(assetsDir: string, _ext: string): string[] {
  const scenes: string[] = []
  const prefabs: string[] = []
  try { walkDir(assetsDir, ['.fire', '.scene'], scenes) } catch { /* ignore */ }
  try { walkDir(assetsDir, ['.prefab'], prefabs) } catch { /* ignore */ }
  return [...scenes, ...prefabs]
}

function walkDir(dir: string, exts: string[], results: string[]) {
  if (results.length >= 50) return
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (results.length >= 50) break
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      walkDir(full, exts, results)
    } else if (e.isFile() && exts.some(ext => e.name.endsWith(ext))) {
      results.push(full)
    }
  }
}
