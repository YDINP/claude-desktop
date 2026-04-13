/**
 * Runtime safety checks — TDZ, React hooks rules, vitest, console.log, duplicate imports
 * 정적 분석으로 런타임 에러를 사전 탐지
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import type { LogFn } from './check-rounds'

export function runRuntimeChecks(root: string, log: LogFn): void {
  console.log('\n## Runtime Safety 검사')

  const srcFiles = getSrcFiles(root)

  // ── 1. TDZ (Temporal Dead Zone) 감지 ─────────────────────
  // useCallback/useMemo 클로저 본문은 제외 — 직접 인자 전달만 TDZ 위험
  console.log('  → TDZ 감지...')
  let tdzCount = 0
  for (const file of srcFiles) {
    if (file.includes('__tests__') || file.includes('.test.')) continue
    const content = readFileSync(join(root, file), 'utf-8')
    const lines = content.split('\n')

    // 1단계: 모든 const/let 선언 위치 수집
    const varDecls = new Map<string, number>() // varName → lineNum
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // const [foo, setFoo] = useState(...)
      const stateMatch = line.match(/const\s+\[(\w+),\s*(\w+)\]\s*=\s*useState/)
      if (stateMatch) { varDecls.set(stateMatch[1], i); varDecls.set(stateMatch[2], i) }
      // const foo = useRef(...)
      const refMatch = line.match(/const\s+(\w+)\s*=\s*useRef/)
      if (refMatch) varDecls.set(refMatch[1], i)
      // const foo = useState(...)  (단일 변수)
      const singleMatch = line.match(/const\s+(\w+)\s*=\s*(?:useState|useRef|useMemo|useCallback)/)
      if (singleMatch) varDecls.set(singleMatch[1], i)
    }

    // 2단계: 커스텀 훅 호출에서 직접 인자(객체 리터럴 최상위)로 전달된 변수 확인
    // 패턴: useXxx({ ..., varName, ... }) — 객체 shorthand 프로퍼티
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // useXxxHook({ 로 시작하는 호출 (useCallback/useMemo/useRef/useState 제외 — 이들은 클로저)
      const hookCallMatch = line.match(/=\s*(use(?!Callback|Memo|Ref|State|Effect|Context|Reducer|LayoutEffect|ImperativeHandle|DebugValue)\w+)\s*\(\s*\{/)
      if (!hookCallMatch) continue

      const hookName = hookCallMatch[1]
      // 훅 인자 객체 블록 추출 (최상위 {} 만)
      let braces = 0, started = false, argBlock = ''
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        for (const ch of lines[j]) {
          if (ch === '{') { braces++; started = true }
          if (started && braces > 0) argBlock += ch
          if (ch === '}') { braces--; if (started && braces === 0) break }
        }
        if (started && braces === 0) break
      }

      // 객체에서 참조되는 변수명 추출:
      // 1. shorthand: { varName, ... }
      // 2. key: value: { key: varName, ... }
      const referencedVars = new Set<string>()

      // shorthand 패턴
      for (const m of argBlock.matchAll(/(?:^|[,{])\s*(\w+)\s*(?=[,}])/gm)) {
        if (m[1]) referencedVars.add(m[1])
      }
      // key: value 패턴 (value가 단독 identifier인 경우)
      for (const m of argBlock.matchAll(/\w+\s*:\s*(\w+)\s*(?=[,}])/gm)) {
        if (m[1] && !['true', 'false', 'null', 'undefined', 'void'].includes(m[1])) {
          referencedVars.add(m[1])
        }
      }

      for (const varName of referencedVars) {
        const declLine = varDecls.get(varName)
        if (declLine !== undefined && declLine > i) {
          log('critical', 'TDZ', `'${varName}' used in ${hookName}() at line ${i + 1} but declared at line ${declLine + 1}`, file, i + 1)
          tdzCount++
        }
      }
    }
  }
  if (tdzCount === 0) log('pass', 'TDZ', `TDZ 위험 0건 (${srcFiles.length}개 파일 검사)`)

  // ── 2. React Hooks 규칙 위반 감지 ──────────────────────────
  console.log('  → React Hooks 규칙 검사...')
  let hooksViolation = 0
  for (const file of srcFiles) {
    if (file.includes('__tests__') || file.includes('.test.')) continue
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue
    const content = readFileSync(join(root, file), 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      // 조건문 바로 다음에 훅 호출 (같은 줄)
      if (line.match(/if\s*\([^)]*\)\s+use[A-Z]\w*\s*\(/) && !line.includes('//')) {
        log('warning', 'Hooks', `조건부 훅 호출: ${line.slice(0, 80)}`, file, i + 1)
        hooksViolation++
      }
    }
  }
  if (hooksViolation === 0) log('pass', 'Hooks', `React Hooks 규칙 위반 0건`)

  // ── 3. vitest 실행 ─────────────────────────────────────────
  console.log('  → vitest 실행...')
  try {
    const result = execSync('npx vitest run 2>&1', {
      cwd: root, stdio: 'pipe', timeout: 180000,
    }).toString()
    const passMatch = result.match(/Tests\s+(\d+)\s+passed/)
    const fileMatch = result.match(/Test Files\s+(\d+)\s+passed/)
    const failMatch = result.match(/(\d+)\s+failed/)
    if (failMatch && parseInt(failMatch[1]) > 0) {
      log('critical', 'Test', `vitest ${failMatch[1]}개 실패 (${passMatch?.[1] ?? '?'} pass)`)
    } else if (passMatch) {
      log('pass', 'Test', `vitest ${passMatch[1]} 테스트 통과 (${fileMatch?.[1] ?? '?'} 파일)`)
    } else {
      log('pass', 'Test', 'vitest 실행 완료')
    }
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer }
    const output = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '')
    const failMatch = output.match(/(\d+)\s+failed/)
    const passMatch = output.match(/(\d+)\s+passed/)
    if (failMatch && parseInt(failMatch[1]) > 0) {
      log('critical', 'Test', `vitest ${failMatch[1]}개 실패 (${passMatch?.[1] ?? '?'} pass)`)
    } else if (passMatch) {
      log('pass', 'Test', `vitest ${passMatch[1]} 테스트 통과`)
    } else {
      log('warning', 'Test', `vitest 실행 결과 불명`)
    }
  }

  // ── 4. console.log 잔존 검사 ───────────────────────────────
  console.log('  → console.log 잔존 검사...')
  let consoleLogCount = 0
  for (const file of srcFiles) {
    if (file.includes('__tests__') || file.includes('.test.')) continue
    const content = readFileSync(join(root, file), 'utf-8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('console.log(') && !lines[i].trim().startsWith('//')) {
        consoleLogCount++
        if (consoleLogCount <= 3) log('warning', 'Console', `console.log 잔존`, file, i + 1)
      }
    }
  }
  if (consoleLogCount === 0) log('pass', 'Console', 'console.log 잔존 0건')
  else if (consoleLogCount > 3) log('warning', 'Console', `console.log 총 ${consoleLogCount}건 잔존`)

  // ── 5. 중복 import 검사 ────────────────────────────────────
  console.log('  → 중복 import 검사...')
  let dupImportCount = 0
  for (const file of srcFiles) {
    if (file.includes('__tests__') || file.includes('.test.')) continue
    const content = readFileSync(join(root, file), 'utf-8')
    const imports = [...content.matchAll(/^import\s.*from\s+['"]([^'"]+)['"]/gm)].map(m => m[1])
    const seen = new Set<string>()
    for (const imp of imports) {
      if (seen.has(imp)) {
        dupImportCount++
        if (dupImportCount <= 3) log('warning', 'Import', `중복 import: '${imp}'`, file)
      }
      seen.add(imp)
    }
  }
  if (dupImportCount === 0) log('pass', 'Import', '중복 import 0건')
  else if (dupImportCount > 3) log('warning', 'Import', `중복 import 총 ${dupImportCount}건`)
}

function getSrcFiles(root: string): string[] {
  try {
    return execSync('find src -name "*.ts" -o -name "*.tsx"', { cwd: root })
      .toString().trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}
