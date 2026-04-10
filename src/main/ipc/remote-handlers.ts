import { ipcMain, app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import * as os from 'os'

interface SshConfigHost {
  alias: string
  hostname: string
  user: string
  port: number
  identityFile?: string
}

interface SavedHost {
  id: string
  label: string
  hostname: string
  user: string
  port: number
  identityFile?: string
}

function parseSshConfig(content: string): SshConfigHost[] {
  const hosts: SshConfigHost[] = []
  let current: Partial<SshConfigHost> | null = null

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const spaceIdx = line.indexOf(' ')
    if (spaceIdx === -1) continue

    const key = line.slice(0, spaceIdx).toLowerCase()
    const value = line.slice(spaceIdx + 1).trim()

    if (key === 'host') {
      if (current?.alias && current.alias !== '*') {
        hosts.push({
          alias: current.alias,
          hostname: current.hostname ?? current.alias,
          user: current.user ?? 'root',
          port: current.port ?? 22,
          identityFile: current.identityFile,
        })
      }
      current = { alias: value }
    } else if (current) {
      if (key === 'hostname') current.hostname = value
      else if (key === 'user') current.user = value
      else if (key === 'port') current.port = parseInt(value) || 22
      else if (key === 'identityfile') current.identityFile = value
    }
  }

  if (current?.alias && current.alias !== '*') {
    hosts.push({
      alias: current.alias,
      hostname: current.hostname ?? current.alias,
      user: current.user ?? 'root',
      port: current.port ?? 22,
      identityFile: current.identityFile,
    })
  }

  return hosts
}

async function getSavedHostsPath(): Promise<string> {
  const userData = app.getPath('userData')
  return join(userData, 'saved-hosts.json')
}

async function readSavedHosts(): Promise<SavedHost[]> {
  try {
    const filePath = await getSavedHostsPath()
    if (!existsSync(filePath)) return []
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as SavedHost[]
  } catch {
    return []
  }
}

async function writeSavedHosts(hosts: SavedHost[]): Promise<void> {
  const filePath = await getSavedHostsPath()
  const dir = join(filePath, '..')
  await mkdir(dir, { recursive: true })
  await writeFile(filePath, JSON.stringify(hosts, null, 2), 'utf-8')
}

export function registerRemoteHandlers(): void {
  ipcMain.handle('remote:listHosts', async (): Promise<SshConfigHost[]> => {
    try {
      const configPath = join(os.homedir(), '.ssh', 'config')
      if (!existsSync(configPath)) return []
      const content = await readFile(configPath, 'utf-8')
      return parseSshConfig(content)
    } catch {
      return []
    }
  })

  ipcMain.handle('remote:getSavedHosts', async (): Promise<SavedHost[]> => {
    return readSavedHosts()
  })

  ipcMain.handle('remote:saveHost', async (_, host: SavedHost): Promise<SavedHost[]> => {
    const hosts = await readSavedHosts()
    const idx = hosts.findIndex(h => h.id === host.id)
    if (idx >= 0) {
      hosts[idx] = host
    } else {
      hosts.unshift(host)
    }
    await writeSavedHosts(hosts)
    return hosts
  })

  ipcMain.handle('remote:removeHost', async (_, { id }: { id: string }): Promise<SavedHost[]> => {
    const hosts = await readSavedHosts()
    const updated = hosts.filter(h => h.id !== id)
    await writeSavedHosts(updated)
    return updated
  })
}
