import { net } from 'electron'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export function openaiChat(
  model: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  onChunk: (text: string) => void,
  onDone: (full: string) => void,
  onError: (err: string) => void,
  signal: AbortSignal,
): void {
  const body = JSON.stringify({ model, messages, stream: true })
  const req = net.request({ method: 'POST', url: OPENAI_API_URL })

  if (signal.aborted) {
    req.abort()
    return
  }

  const onAbort = () => req.abort()
  signal.addEventListener('abort', onAbort)
  req.setHeader('Content-Type', 'application/json')
  req.setHeader('Authorization', `Bearer ${apiKey}`)

  let buffer = ''
  let accumulated = ''
  let doneFired = false

  const cleanup = () => {
    signal.removeEventListener('abort', onAbort)
  }

  req.on('response', (res) => {
    res.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          if (!doneFired) {
            doneFired = true
            cleanup()
            onDone(accumulated)
          }
          return
        }
        try {
          const obj = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
          const content = obj.choices?.[0]?.delta?.content
          if (content) {
            accumulated += content
            onChunk(content)
          }
        } catch { /* ignore parse errors */ }
      }
    })
    res.on('end', () => {
      if (!doneFired) {
        doneFired = true
        cleanup()
        onDone(accumulated)
      }
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
