import { net } from 'electron'

const OLLAMA_BASE = 'http://localhost:11434'

export async function ollamaListModels(): Promise<string[]> {
  return new Promise((resolve) => {
    const req = net.request({ method: 'GET', url: `${OLLAMA_BASE}/api/tags` })
    let data = ''
    req.on('response', (res) => {
      res.on('data', (chunk) => { data += chunk.toString() })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as { models?: Array<{ name: string }> }
          resolve((parsed.models ?? []).map(m => m.name))
        } catch {
          resolve([])
        }
      })
    })
    req.on('error', () => resolve([]))
    req.end()
  })
}

export function ollamaChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
  signal: AbortSignal,
): void {
  const body = JSON.stringify({ model, messages, stream: true })
  const req = net.request({ method: 'POST', url: `${OLLAMA_BASE}/api/chat` })

  if (signal.aborted) {
    req.abort()
    return
  }

  const onAbort = () => req.abort()
  signal.addEventListener('abort', onAbort)
  req.setHeader('Content-Type', 'application/json')

  let buffer = ''
  let accumulated = ''

  const cleanup = () => {
    signal.removeEventListener('abort', onAbort)
  }

  req.on('response', (res) => {
    res.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
          if (obj.message?.content) {
            accumulated += obj.message.content
            onChunk(obj.message.content)
          }
          if (obj.done) {
            cleanup()
            onDone(accumulated)
          }
        } catch { /* ignore parse errors */ }
      }
    })
    res.on('end', () => {
      cleanup()
      onDone(accumulated)
    })
    res.on('error', (e) => {
      cleanup()
      onError(String(e))
    })
  })
  req.on('error', (e) => {
    cleanup()
    onError(String(e))
  })
  req.write(body)
  req.end()
}
