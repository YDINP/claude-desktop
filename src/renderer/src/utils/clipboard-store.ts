type ClipboardEntry = { id: string; text: string; source: string; timestamp: number }
type Listener = (entries: ClipboardEntry[]) => void

let entries: ClipboardEntry[] = []
const listeners = new Set<Listener>()

export const clipboardStore = {
  push(text: string, source: string) {
    if (!text.trim()) return
    // Deduplicate: remove existing same text
    entries = [
      { id: Date.now().toString(), text, source, timestamp: Date.now() },
      ...entries.filter(e => e.text !== text)
    ].slice(0, 30) // max 30 entries
    listeners.forEach(fn => fn([...entries]))
  },
  subscribe(fn: Listener) {
    listeners.add(fn)
    fn([...entries])
    return () => listeners.delete(fn)
  },
  getAll() { return [...entries] },
  remove(id: string) {
    entries = entries.filter(e => e.id !== id)
    listeners.forEach(fn => fn([...entries]))
  },
  clear() {
    entries = []
    listeners.forEach(fn => fn([]))
  }
}
