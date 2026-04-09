import type { FSWatcher } from 'chokidar'

export type CCFileChangeType = 'change' | 'add' | 'unlink'

export interface CCFileChangeEvent {
  type: CCFileChangeType
  path: string
  timestamp: number
}

// R1389: 부분 업데이트 이벤트
export interface CCScenePartialUpdate {
  changedUuids: string[]
  fullReload: boolean
  path: string
  timestamp: number
}

type ChangeCallback = (event: CCFileChangeEvent) => void
type PartialUpdateCallback = (update: CCScenePartialUpdate) => void

/**
 * CC 씬 파일 감시 (Phase B + R1389 부분 업데이트)
 * chokidar v5 (ESM-only) — 동적 import()로 CJS 환경 호환
 */
export class CCFileWatcher {
  private watcher: FSWatcher | null = null
  private callbacks = new Set<ChangeCallback>()
  private partialUpdateCallbacks = new Set<PartialUpdateCallback>()
  private watchedPaths = new Set<string>()
  private pendingPaths: string[] = []
  private initializing = false
  // R2313: ISSUE-004 — race condition 방지용 초기화 Promise
  private _initPromise: Promise<void> | null = null
  // R1389: debounce 300ms
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  // R1389: 이전 파일 내용 캐시 (diff용)
  private fileContentCache = new Map<string, string>()

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
      // R2313: ISSUE-004 — 초기화 중이면 pendingPaths에 추가하고 진행 중인 Promise 반환
      this.pendingPaths.push(...newPaths)
      return this._initPromise ?? undefined
    }

    this.initializing = true
    this._initPromise = (async () => {
      try {
        const { default: chokidar } = await import('chokidar')
        const allPaths = [...newPaths, ...this.pendingPaths]
        this.pendingPaths = []

        this.watcher = chokidar.watch(allPaths, {
          persistent: true,
          ignoreInitial: true,
          // R2313: ISSUE-003 — chokidar v5는 awaitWriteFinish boolean만 지원
          // (chokidar v3의 stabilityThreshold: 100ms 대체)
          awaitWriteFinish: true,
          ignored: (filePath: string) => {
            if (typeof filePath !== 'string') return false
            const lower = filePath.toLowerCase()
            if (!lower.includes('.')) return false
            return !lower.endsWith('.fire') && !lower.endsWith('.scene') && !lower.endsWith('.prefab')
          },
        })

        this.watcher
          .on('change', (p: string) => this.debouncedChange(p))
          .on('add', (p: string) => this.emit({ type: 'add', path: p, timestamp: Date.now() }))
          .on('unlink', (p: string) => this.emit({ type: 'unlink', path: p, timestamp: Date.now() }))
          .on('error', (err: unknown) => console.error('[cc-file-watcher]', err))
      } finally {
        this.initializing = false
        this._initPromise = null
      }
    })()
    return this._initPromise
  }

  // R1389: 300ms debounce change 이벤트
  private debouncedChange(path: string) {
    const existing = this.debounceTimers.get(path)
    if (existing) clearTimeout(existing)
    this.debounceTimers.set(path, setTimeout(() => {
      this.debounceTimers.delete(path)
      this.emit({ type: 'change', path, timestamp: Date.now() })
      this.emitPartialUpdate(path)
    }, 300))
  }

  // R1389: 파일 diff 기반 부분 업데이트 이벤트 전송
  private async emitPartialUpdate(path: string) {
    try {
      const { readFileSync } = await import('fs')
      const newContent = readFileSync(path, 'utf-8')
      const oldContent = this.fileContentCache.get(path)
      // 캐시 크기 제한 (50개 초과 시 가장 오래된 항목 제거)
      if (!this.fileContentCache.has(path) && this.fileContentCache.size >= 50) {
        const oldest = this.fileContentCache.keys().next().value
        if (oldest !== undefined) this.fileContentCache.delete(oldest)
      }
      this.fileContentCache.set(path, newContent)

      if (!oldContent) {
        // 캐시 없으면 전체 리로드
        this.emitPartial({ changedUuids: [], fullReload: true, path, timestamp: Date.now() })
        return
      }

      // JSON 파싱 시도 → UUID diff
      try {
        const oldArr = JSON.parse(oldContent) as Array<{ _id?: string; __id__?: string }>
        const newArr = JSON.parse(newContent) as Array<{ _id?: string; __id__?: string }>
        const changedUuids: string[] = []

        if (Array.isArray(oldArr) && Array.isArray(newArr)) {
          const maxLen = Math.max(oldArr.length, newArr.length)
          for (let i = 0; i < maxLen; i++) {
            const oldItem = oldArr[i]
            const newItem = newArr[i]
            if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
              const uuid = (newItem ?? oldItem)?._id ?? (newItem ?? oldItem)?.__id__
              if (uuid) changedUuids.push(uuid)
            }
          }
          this.emitPartial({ changedUuids, fullReload: changedUuids.length === 0, path, timestamp: Date.now() })
        } else {
          this.emitPartial({ changedUuids: [], fullReload: true, path, timestamp: Date.now() })
        }
      } catch {
        this.emitPartial({ changedUuids: [], fullReload: true, path, timestamp: Date.now() })
      }
    } catch {
      this.emitPartial({ changedUuids: [], fullReload: true, path, timestamp: Date.now() })
    }
  }

  /** 파일 내용 캐시 초기화 (씬 로드 시 호출) */
  cacheFileContent(path: string, content: string) {
    this.fileContentCache.set(path, content)
  }

  unwatch(paths: string | string[]) {
    const list = Array.isArray(paths) ? paths : [paths]
    list.forEach(p => { this.watchedPaths.delete(p); this.fileContentCache.delete(p) })
    this.watcher?.unwatch(list)
  }

  async close() {
    for (const timer of this.debounceTimers.values()) clearTimeout(timer)
    this.debounceTimers.clear()
    this.fileContentCache.clear()
    await this.watcher?.close()
    this.watcher = null
    this.watchedPaths.clear()
    this.callbacks.clear()
    this.partialUpdateCallbacks.clear()
  }

  onChange(cb: ChangeCallback) {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  // R1389: 부분 업데이트 콜백 등록
  onPartialUpdate(cb: PartialUpdateCallback) {
    this.partialUpdateCallbacks.add(cb)
    return () => this.partialUpdateCallbacks.delete(cb)
  }

  private emit(event: CCFileChangeEvent) {
    for (const cb of this.callbacks) cb(event)
  }

  private emitPartial(update: CCScenePartialUpdate) {
    for (const cb of this.partialUpdateCallbacks) cb(update)
  }

  get watchedCount() { return this.watchedPaths.size }
}

// 싱글톤 인스턴스 (main process)
export const ccFileWatcher = new CCFileWatcher()
