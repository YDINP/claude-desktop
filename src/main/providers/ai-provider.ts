export interface AIMessage {
  role: string
  content: string
}

export interface AIProvider {
  readonly id: string
  readonly prefix: string
  chat(
    model: string,
    messages: AIMessage[],
    onChunk: (text: string) => void,
    onDone: (full: string) => void,
    onError: (err: string) => void,
    signal: AbortSignal,
  ): void
  listModels?(): Promise<string[]>
}
