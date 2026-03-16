/**
 * Build & dependency verification checks
 * Extracted from qa.ts sections 1-2 (TypeScript, import) + section 102 (deps)
 */
import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { LogFn } from './check-rounds'

export function runBuildChecks(root: string, log: LogFn): void {
  // ── 1. TypeScript 컴파일 ───────────────────────────────────
  console.log('\n## 1. TypeScript 컴파일 검사')
  try {
    execSync('npx tsc --noEmit', { cwd: root, stdio: 'pipe' })
    log('pass', 'TypeScript', 'tsc --noEmit 오류 없음')
  } catch (e: unknown) {
    const output = (e as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? ''
    const lines = output.split('\n').filter(Boolean)
    for (const line of lines.slice(0, 20)) {
      const match = line.match(/^(.+)\((\d+),\d+\): error TS\d+: (.+)$/)
      if (match) log('critical', 'TypeScript', match[3], match[1], parseInt(match[2]))
      else if (line.trim()) log('critical', 'TypeScript', line)
    }
  }

  // ── 2. import 패턴 검사 ──────────────────────────────────
  console.log('\n## 2. import 패턴 검사')
  let srcFiles: string[] = []
  try {
    srcFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', { cwd: root })
      .toString().trim().split('\n').filter(Boolean)
  } catch {
    log('warning', 'Import', 'src 디렉터리 탐색 실패')
  }

  for (const file of srcFiles) {
    const content = readFileSync(join(root, file), 'utf-8')
    if (content.includes('window.api.cc') && !content.includes('CCNode') && content.includes(': CCNode')) {
      log('warning', 'Import', 'CCNode 타입 사용하지만 import 없을 수 있음', file)
    }
    if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
      log('warning', 'Memory', 'addEventListener without removeEventListener', file)
    }
  }

  if (srcFiles.length > 0) {
    log('pass', 'Import', `${srcFiles.length}개 소스 파일 검사 완료`)
  }

  // ── 종속성 검사 ──────────────────────────────────────────
  console.log('\n## 종속성 검사')

  // package.json
  try {
    const pkgJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
    log('pass', 'Deps', `package.json 파싱 성공 (name: ${pkgJson.name ?? 'unknown'})`)
  } catch {
    log('critical', 'Deps', 'package.json 파싱 실패')
  }

  // preload expose vs type declaration
  const preloadPath = join(root, 'src/preload/index.ts')
  const windowDtsPath = join(root, 'src/renderer/src/env.d.ts')
  const windowDtsAltPath = join(root, 'src/renderer/src/window.d.ts')
  if (existsSync(preloadPath)) {
    const preloadSrc = readFileSync(preloadPath, 'utf-8')
    const dtsPath = existsSync(windowDtsPath) ? windowDtsPath : existsSync(windowDtsAltPath) ? windowDtsAltPath : null
    const exposedMethods = [...preloadSrc.matchAll(/(\w+):\s*(?:async\s*)?\([^)]*\)\s*=>/g)].map(m => m[1])
    if (dtsPath) {
      const windowDts = readFileSync(dtsPath, 'utf-8')
      for (const method of exposedMethods.slice(0, 5)) {
        if (!windowDts.includes(method)) {
          log('warning', 'Deps', `preload 메서드 '${method}' 타입 선언 누락 가능성`, dtsPath.replace(root + '/', ''))
        }
      }
      log('pass', 'Deps', `preload expose 메서드 ${exposedMethods.length}개 확인`)
    } else {
      log('warning', 'Deps', 'env.d.ts / window.d.ts 없음 — 타입 선언 누락 가능성')
    }
  } else {
    log('warning', 'Deps', 'src/preload/index.ts 없음')
  }

  // IPC handler count
  const routerPath = join(root, 'src/main/ipc/router.ts')
  const mainIndexPath = join(root, 'src/main/index.ts')
  {
    const routerHandles = existsSync(routerPath)
      ? (readFileSync(routerPath, 'utf-8').match(/ipcMain\.handle/g) ?? []).length
      : 0
    const mainHandles = existsSync(mainIndexPath)
      ? (readFileSync(mainIndexPath, 'utf-8').match(/ipcMain\.handle/g) ?? []).length
      : 0
    const handleCount = routerHandles + mainHandles
    if (handleCount < 5) log('warning', 'Deps', `ipcMain.handle 수 너무 적음: ${handleCount}`)
    else log('pass', 'Deps', `ipcMain.handle 등록: ${handleCount}개 이상`)
  }

  // Critical deps
  const criticalDeps = ['electron', 'react', 'react-dom']
  for (const dep of criticalDeps) {
    if (!existsSync(join(root, 'node_modules', dep))) log('critical', 'Deps', `핵심 의존성 누락: ${dep}`)
    else log('pass', 'Deps', `의존성 설치됨: ${dep}`)
  }

  // tsconfig
  if (!existsSync(join(root, 'tsconfig.json')) && !existsSync(join(root, 'tsconfig.node.json'))) {
    log('warning', 'Deps', 'tsconfig 파일 없음')
  } else {
    log('pass', 'Deps', 'tsconfig 존재')
  }
}
