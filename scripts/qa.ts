#!/usr/bin/env npx tsx
/**
 * Claude Desktop — Round QA Automation Script
 * 실행: npx tsx scripts/qa.ts [--round=N] [--fix]
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const args = process.argv.slice(2)
const roundNum = args.find(a => a.startsWith('--round='))?.split('=')[1] ?? 'latest'
const autoFix = args.includes('--fix')

interface QAResult {
  category: string
  level: 'critical' | 'warning' | 'pass'
  file?: string
  line?: number
  message: string
}

const results: QAResult[] = []

function log(level: QAResult['level'], category: string, message: string, file?: string, line?: number) {
  results.push({ category, level, file, line, message })
  const icon = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '✅'
  const loc = file ? ` [${file}${line ? ':' + line : ''}]` : ''
  console.log(`${icon} [${category}]${loc} ${message}`)
}

// ── 1. TypeScript 컴파일 ───────────────────────────────────
console.log('\n## 1. TypeScript 컴파일 검사')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe' })
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
  srcFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean)
} catch {
  log('warning', 'Import', 'src 디렉터리 탐색 실패')
}

for (const file of srcFiles) {
  const content = readFileSync(join(ROOT, file), 'utf-8')
  // window.api.cc* 사용하는 파일에서 CCNode 타입 import 확인
  if (content.includes('window.api.cc') && !content.includes('CCNode') && content.includes(': CCNode')) {
    log('warning', 'Import', 'CCNode 타입 사용하지만 import 없을 수 있음', file)
  }
  // useEffect cleanup 패턴
  if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
    log('warning', 'Memory', 'addEventListener without removeEventListener', file)
  }
}

if (srcFiles.length > 0) {
  log('pass', 'Import', `${srcFiles.length}개 소스 파일 검사 완료`)
}

// ── 3. CC 관련 파일 검사 ──────────────────────────────────
console.log('\n## 3. CC 통합 파일 검사')
const ccBridgePath = join(ROOT, 'src/main/cc/cc-bridge.ts')
if (existsSync(ccBridgePath)) {
  const content = readFileSync(ccBridgePath, 'utf-8')
  if (!content.includes('scheduleReconnect') || !content.includes('reconnectTimer')) {
    log('warning', 'CC-Bridge', '자동 재연결 로직 확인 필요', 'src/main/cc/cc-bridge.ts')
  } else {
    log('pass', 'CC-Bridge', '자동 재연결 로직 존재')
  }
  // disconnect 메서드 안에 reconnectTimer clearTimeout이 있는지 확인
  const disconnectBlock = content.match(/disconnect\s*\(\)[^}]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s)?.[1] ?? ''
  if (!disconnectBlock.includes('reconnectTimer') || !disconnectBlock.includes('clearTimeout')) {
    log('warning', 'CC-Bridge', 'disconnect 메서드 reconnect 취소 확인 필요', 'src/main/cc/cc-bridge.ts')
  }
} else {
  log('warning', 'CC-Bridge', 'cc-bridge.ts 파일 없음')
}

// ── 4. Sidebar 중복 탭 검사 ──────────────────────────────
console.log('\n## 4. Sidebar 탭 중복 검사')
const sidebarPath = join(ROOT, 'src/renderer/src/components/sidebar/Sidebar.tsx')
if (existsSync(sidebarPath)) {
  const content = readFileSync(sidebarPath, 'utf-8')
  const cocosMatches = (content.match(/id: 'cocos'/g) ?? []).length
  if (cocosMatches > 1) {
    log('critical', 'Sidebar', `cocos 탭 중복 등록: ${cocosMatches}회`, 'Sidebar.tsx')
  } else if (cocosMatches === 1) {
    log('pass', 'Sidebar', 'cocos 탭 정상 등록')
  } else {
    log('warning', 'Sidebar', 'cocos 탭 미등록', 'Sidebar.tsx')
  }
} else {
  log('warning', 'Sidebar', 'Sidebar.tsx 파일 없음')
}

// ── 5. IPC 핸들러 중복 검사 ──────────────────────────────
console.log('\n## 5. IPC 핸들러 중복 검사')
const routerFiles = ['src/main/ipc/router.ts', 'src/main/index.ts']
for (const rf of routerFiles) {
  const fp = join(ROOT, rf)
  if (!existsSync(fp)) continue
  const content = readFileSync(fp, 'utf-8')
  // import 문 제외하고 실제 호출만 카운트
  const callMatches = content.match(/^\s*registerCCHandlers\s*\(/gm) ?? []
  const ccHandlerCalls = callMatches.length
  if (ccHandlerCalls > 1) {
    log('critical', 'IPC', `registerCCHandlers 중복 호출: ${ccHandlerCalls}회`, rf)
  } else if (ccHandlerCalls === 1) {
    log('pass', 'IPC', 'registerCCHandlers 정상 등록', rf)
  } else {
    // index.ts는 router를 통해 간접 호출 — 정상
    if (rf === 'src/main/ipc/router.ts') {
      log('warning', 'IPC', `registerCCHandlers 미등록`, rf)
    }
  }
}

// ── 리포트 ───────────────────────────────────────────────
console.log('\n## QA 결과 요약')
const criticals = results.filter(r => r.level === 'critical')
const warnings = results.filter(r => r.level === 'warning')
const passes = results.filter(r => r.level === 'pass')

console.log(`🔴 Critical: ${criticals.length}`)
console.log(`🟡 Warning:  ${warnings.length}`)
console.log(`✅ Pass:     ${passes.length}`)

// 결과 파일 저장
const reportPath = join(ROOT, `qa-report-round${roundNum}.md`)
const report = [
  `# QA Report — Round ${roundNum}`,
  `> ${new Date().toISOString()}`,
  '',
  '## Critical',
  criticals.length ? criticals.map(r => `- [${r.file ?? ''}] ${r.message}`).join('\n') : '_없음_',
  '',
  '## Warning',
  warnings.length ? warnings.map(r => `- [${r.file ?? ''}] ${r.message}`).join('\n') : '_없음_',
  '',
  '## Pass',
  passes.length ? passes.map(r => `- ${r.message}`).join('\n') : '_없음_',
].join('\n')

writeFileSync(reportPath, report)
console.log(`\n리포트 저장: ${reportPath}`)

if (criticals.length > 0) {
  process.exit(1)
}
