import chokidar from 'chokidar'
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
 * chokidar v4 기반, awaitWriteFinish로 저장 중 중복 이벤트 방지
 */
export class CCFileWatcher {
  private watcher: FSWatcher | null = null
  private callbacks = new Set<ChangeCallback>()
  private watchedPaths = new Set<string>()

  /**
   * 씬 파일 또는 디렉토리 감시 시작
   * @param paths 감시할 파일/디렉토리 경로 목록
   */
  watch(paths: string | string[]) {
    const list = Array.isArray(paths) ? paths : [paths]
    const newPaths = list.filter(p => !this.watchedPaths.has(p))
    if (newPaths.length === 0) return

    newPaths.forEach(p => this.watchedPaths.add(p))

    if (this.watcher) {
      this.watcher.add(newPaths)
      return
    }

    this.watcher = chokidar.watch(newPaths, {
      persistent: true,
      ignoreInitial: true,
      // Windows에서 안정적인 감지를 위해 awaitWriteFinish 사용
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
      // .fire/.scene/.prefab 만 감시
      ignored: (filePath: string) => {
        if (typeof filePath !== 'string') return false
        const lower = filePath.toLowerCase()
        // 디렉토리는 통과
        if (!lower.includes('.')) return false
        return !lower.endsWith('.fire') && !lower.endsWith('.scene') && !lower.endsWith('.prefab')
      },
    })

    this.watcher
      .on('change', (p: string) => this.emit({ type: 'change', path: p, timestamp: Date.now() }))
      .on('add', (p: string) => this.emit({ type: 'add', path: p, timestamp: Date.now() }))
      .on('unlink', (p: string) => this.emit({ type: 'unlink', path: p, timestamp: Date.now() }))
      .on('error', (err: unknown) => console.error('[cc-file-watcher]', err))
  }

  /**
   * 특정 경로 감시 해제
   */
  unwatch(paths: string | string[]) {
    const list = Array.isArray(paths) ? paths : [paths]
    list.forEach(p => this.watchedPaths.delete(p))
    this.watcher?.unwatch(list)
  }

  /**
   * 모든 감시 중지 및 리소스 해제
   */
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
