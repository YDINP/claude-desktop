import fs from 'fs'
import path from 'path'

export interface ProjectContext {
  name: string
  type: string        // 'nextjs' | 'electron' | 'cocos' | 'react' | 'node' | 'unknown'
  description: string
  keyFiles: string[]  // 주요 파일 목록 (최대 20개)
  techStack: string[] // 감지된 기술 스택
  summary: string     // Claude에게 주입할 요약 문자열
}

export async function analyzeProject(rootPath: string): Promise<ProjectContext> {
  const name = path.basename(rootPath)
  const keyFiles: string[] = []
  const techStack: string[] = []
  let type = 'unknown'
  let description = ''

  // package.json 분석
  const pkgPath = path.join(rootPath, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      description = pkg.description || ''
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      if (deps['electron']) { type = 'electron'; techStack.push('Electron') }
      if (deps['react']) techStack.push('React')
      if (deps['next']) { type = 'nextjs'; techStack.push('Next.js') }
      if (deps['typescript'] || deps['ts-node']) techStack.push('TypeScript')
      if (deps['vite']) techStack.push('Vite')
      keyFiles.push('package.json')
    } catch { /* ignore parse errors */ }
  }

  // Cocos Creator 감지
  if (
    fs.existsSync(path.join(rootPath, 'assets')) &&
    (fs.existsSync(path.join(rootPath, 'project.json')) || fs.existsSync(path.join(rootPath, 'settings')))
  ) {
    type = 'cocos'
    techStack.push('Cocos Creator')
  }

  // README 있으면 첫 5줄 읽기
  const readmePath = ['README.md', 'readme.md', 'README.txt']
    .map(r => path.join(rootPath, r))
    .find(p => fs.existsSync(p))
  if (readmePath) {
    try {
      const lines = fs.readFileSync(readmePath, 'utf-8').split('\n').slice(0, 5).join('\n')
      if (!description) description = lines.replace(/^#+\s*/, '').trim()
    } catch { /* ignore */ }
  }

  // 주요 파일 탐색 (src/, app/, lib/, scripts/ 최상위만)
  const srcDirs = ['src', 'app', 'lib', 'scripts']
  for (const dir of srcDirs) {
    const dirPath = path.join(rootPath, dir)
    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath).slice(0, 10)
        files.forEach(f => keyFiles.push(`${dir}/${f}`))
      } catch { /* ignore */ }
    }
  }

  const summary = `프로젝트: ${name}
타입: ${type} (${techStack.join(', ') || '알 수 없음'})
${description ? `설명: ${description}` : ''}
주요 구조: ${keyFiles.slice(0, 10).join(', ')}`.trim()

  return { name, type, description, keyFiles: keyFiles.slice(0, 20), techStack, summary }
}
