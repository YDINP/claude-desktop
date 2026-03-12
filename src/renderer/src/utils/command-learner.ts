const CMD_HISTORY_KEY = 'terminalCmdHistory'
const MAX_HISTORY = 200

interface CmdStat {
  cmd: string
  count: number
  lastUsed: number
}

export function recordCommand(cmd: string) {
  const trimmed = cmd.trim().replace(/\n$/, '')
  if (!trimmed || trimmed.length < 2) return

  try {
    const raw = localStorage.getItem(CMD_HISTORY_KEY)
    const stats: CmdStat[] = raw ? JSON.parse(raw) : []
    const existing = stats.find(s => s.cmd === trimmed)
    if (existing) {
      existing.count++
      existing.lastUsed = Date.now()
    } else {
      stats.push({ cmd: trimmed, count: 1, lastUsed: Date.now() })
    }
    const trimmed_stats = stats
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_HISTORY)
    localStorage.setItem(CMD_HISTORY_KEY, JSON.stringify(trimmed_stats))
  } catch {}
}

export function getTopCommands(n = 5): string[] {
  try {
    const raw = localStorage.getItem(CMD_HISTORY_KEY)
    if (!raw) return []
    const stats: CmdStat[] = JSON.parse(raw)
    return stats
      .sort((a, b) => b.count - a.count)
      .slice(0, n)
      .map(s => s.cmd)
  } catch {
    return []
  }
}
