#!/usr/bin/env npx tsx
/**
 * Claude Desktop — Round QA Automation Script (Refactored)
 * 실행: npx tsx scripts/qa.ts [--round=N] [--fix]
 *
 * 구조:
 *   qa.ts            ← orchestrator (이 파일)
 *   qa-checks/
 *     check-rounds.ts ← 선언적 RoundCheck[] 테이블 + 실행 엔진
 *     check-build.ts  ← tsc, import, 종속성 검증
 *     check-ipc.ts    ← IPC 채널 매핑 + 런타임 안전성 검증
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import { runBuildChecks } from './qa-checks/check-build'
import { runIpcChecks } from './qa-checks/check-ipc'
import { runRoundChecks } from './qa-checks/check-rounds'
import { runRuntimeChecks } from './qa-checks/check-runtime'
import type { LogFn } from './qa-checks/check-rounds'

const ROOT = join(__dirname, '..')
const args = process.argv.slice(2)
const roundNum = args.find(a => a.startsWith('--round='))?.split('=')[1] ?? 'latest'

interface QAResult {
  category: string
  level: 'critical' | 'warning' | 'pass'
  file?: string
  line?: number
  message: string
}

const results: QAResult[] = []

const log: LogFn = (level, category, message, file?, line?) => {
  results.push({ category, level, file, line, message })
  const icon = level === 'critical' ? '\u{1F534}' : level === 'warning' ? '\u{1F7E1}' : '\u{2705}'
  const loc = file ? ` [${file}${line ? ':' + line : ''}]` : ''
  console.log(`${icon} [${category}]${loc} ${message}`)
}

// ── 1. Build & Dependency Checks ─────────────────────────
runBuildChecks(ROOT, log)

// ── 2. IPC & Runtime Safety Checks ───────────────────────
runIpcChecks(ROOT, log)

// ── 3. Runtime Safety Checks (TDZ, hooks, tests) ────────
runRuntimeChecks(ROOT, log)

// ── 4. Round Feature Checks (declarative table) ─────────
runRoundChecks(ROOT, log)

// ── Report ───────────────────────────────────────────────
console.log('\n## QA 결과 요약')
const criticals = results.filter(r => r.level === 'critical')
const warnings = results.filter(r => r.level === 'warning')
const passes = results.filter(r => r.level === 'pass')

console.log(`\u{1F534} Critical: ${criticals.length}`)
console.log(`\u{1F7E1} Warning:  ${warnings.length}`)
console.log(`\u{2705} Pass:     ${passes.length}`)

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
