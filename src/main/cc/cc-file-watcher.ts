import type { FSWatcher } from 'chokidar'

export type CCFileChangeType = 'change' | 'add' | 'unlink'

export interface CCFileChangeEvent {
  type: CCFileChangeType
  path: string
  timestamp: number
}

type ChangeCallback = (event: CCFileChangeEvent) => void

/**
 * CC 씬 파일 감시 (Phase B)
 * chokidar v5 (ESM-only) — 동적 import()로 CJS 환경 호환
 */
export class CCFileWatcher {
  private watcher: FSWatcher | null = null
  private callbacks = new Set<ChangeCallback>()
  private watchedPaths = new Set<string>()
  private pendingPaths: string[] = []
  private initializing = false

  /**
   * 씬 파일 또는 디렉토리 감시 시작
   */
  async watch(paths: string | string[]) {
    const list = Array.isArray(paths) ? paths : [paths]
    const newPaths = list.filter(p => !this.watchedPaths.has(p))
    if (newPaths.length === 0) return

    newPaths.forEach(p => this.watchedPaths.add(p))

    if (this.watcher) {
      this.watcher.add(newPaths)
      return
    }

    if (this.initializing) {
      this.pendingPaths.push(...newPaths)
      return
    }

    this.initializing = true
    try {
      const { default: chokidar } = await import('chokidar')
      const allPaths = [...newPaths, ...this.pendingPaths]
      this.pendingPaths = []

      this.watcher = chokidar.watch(allPaths, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
        ignored: (filePath: string) => {
          if (typeof filePath !== 'string') return false
          const lower = filePath.toLowerCase()
          if (!lower.includes('.')) return false
          return !lower.endsWith('.fire') && !lower.endsWith('.scene') && !lower.endsWith('.prefab')
        },
      })

      this.watcher
        .on('change', (p: string) => this.emit({ type: 'change', path: p, timestamp: Date.now() }))
        .on('add', (p: string) => this.emit({ type: 'add', path: p, timestamp: Date.now() }))
        .on('unlink', (p: string) => this.emit({ type: 'unlink', path: p, timestamp: Date.now() }))
        .on('error', (err: unknown) => console.error('[cc-file-watcher]', err))
    } finally {
      this.initializing = false
    }
  }

  unwatch(paths: string | string[]) {
    const list = Array.isArray(paths) ? paths : [paths]
    list.forEach(p => this.watchedPaths.delete(p))
    this.watcher?.unwatch(list)
  }

  async close() {
    await this.watcher?.close()
    this.watcher = null
    this.watchedPaths.clear()
    this.callbacks.clear()
  }

  onChange(cb: ChangeCallback) {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  private emit(event: CCFileChangeEvent) {
    for (const cb of this.callbacks) cb(event)
  }

  get watchedCount() { return this.watchedPaths.size }
}

// 싱글톤 인스턴스 (main process)
export const ccFileWatcher = new CCFileWatcher()
