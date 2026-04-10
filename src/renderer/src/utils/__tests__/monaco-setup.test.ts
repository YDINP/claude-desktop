import { describe, it, expect, vi } from 'vitest'

// monaco-setup.ts는 모듈 로드 시 self.MonacoEnvironment와 loader.config를 설정하는
// side-effect 전용 파일이다. 직접 import 시 ?worker와 monaco를 mock해야 한다.

vi.mock('@monaco-editor/react', () => ({
  loader: { config: vi.fn() },
}))

vi.mock('monaco-editor', () => ({
  default: {},
}))

vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({
  default: class EditorWorker {},
}))

vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({
  default: class JsonWorker {},
}))

vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({
  default: class TsWorker {},
}))

vi.mock('monaco-editor/esm/vs/language/css/css.worker?worker', () => ({
  default: class CssWorker {},
}))

vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({
  default: class HtmlWorker {},
}))

// 모듈을 한 번 import해서 side-effect 실행
await import('../monaco-setup')

type MonacoEnv = { getWorker: (_: string, label: string) => { constructor: { name: string } } }
const env = () => (self as unknown as Record<string, unknown>).MonacoEnvironment as MonacoEnv

describe('monaco-setup', () => {
  it('모듈 로드 후 self.MonacoEnvironment가 설정된다', () => {
    expect(env()).toBeDefined()
  })

  it('loader.config가 monaco 인스턴스로 호출된다', async () => {
    const { loader } = await import('@monaco-editor/react')
    expect(loader.config).toHaveBeenCalled()
  })

  it('getWorker — json label → JsonWorker 반환', () => {
    const worker = env().getWorker('', 'json')
    expect(worker.constructor.name).toBe('JsonWorker')
  })

  it('getWorker — typescript label → TsWorker 반환', () => {
    const worker = env().getWorker('', 'typescript')
    expect(worker.constructor.name).toBe('TsWorker')
  })

  it('getWorker — javascript label → TsWorker 반환', () => {
    const worker = env().getWorker('', 'javascript')
    expect(worker.constructor.name).toBe('TsWorker')
  })

  it('getWorker — css label → CssWorker 반환', () => {
    const worker = env().getWorker('', 'css')
    expect(worker.constructor.name).toBe('CssWorker')
  })

  it('getWorker — scss label → CssWorker 반환', () => {
    const worker = env().getWorker('', 'scss')
    expect(worker.constructor.name).toBe('CssWorker')
  })

  it('getWorker — less label → CssWorker 반환', () => {
    const worker = env().getWorker('', 'less')
    expect(worker.constructor.name).toBe('CssWorker')
  })

  it('getWorker — html label → HtmlWorker 반환', () => {
    const worker = env().getWorker('', 'html')
    expect(worker.constructor.name).toBe('HtmlWorker')
  })

  it('getWorker — handlebars label → HtmlWorker 반환', () => {
    const worker = env().getWorker('', 'handlebars')
    expect(worker.constructor.name).toBe('HtmlWorker')
  })

  it('getWorker — 알 수 없는 label → EditorWorker 반환', () => {
    const worker = env().getWorker('', 'unknown')
    expect(worker.constructor.name).toBe('EditorWorker')
  })
})
