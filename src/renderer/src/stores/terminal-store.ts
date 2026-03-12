// Shared singleton to track the currently active terminal tab ID
// TerminalPanel writes to this; ChatPanel reads from it for "Run in Terminal"

let _activeTerminalId: string | null = null

export function setActiveTerminalId(id: string | null): void {
  _activeTerminalId = id
}

export function getActiveTerminalId(): string | null {
  return _activeTerminalId
}
