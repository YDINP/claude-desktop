import { useState, useCallback, useEffect, useRef } from 'react'
import type { CCFileProjectInfo, CCSceneFile, CCSceneNode } from '../../../../shared/ipc-schema'

export interface CCFileProjectState {
  projectInfo: CCFileProjectInfo | null
  sceneFile: CCSceneFile | null
  loading: boolean
  error: string | null
}

/**
 * CC 파일 기반 프로젝트 훅 (Phase A)
 * WS Extension 없이 .fire/.scene 파일 직접 파싱
 */
export function useCCFileProject() {
  const [projectInfo, setProjectInfo] = useState<CCFileProjectInfo | null>(null)
  const [sceneFile, setSceneFile] = useState<CCSceneFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [externalChange, setExternalChange] = useState<{ path: string; timestamp: number } | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const sceneFileRef = useRef(sceneFile)
  sceneFileRef.current = sceneFile
  const projectInfoRef = useRef(projectInfo)
  projectInfoRef.current = projectInfo
  const suppressWatchRef = useRef(false)
  const undoStackRef = useRef<CCSceneNode[]>([])
  const redoStackRef = useRef<CCSceneNode[]>([])

  /** 폴더 선택 다이얼로그로 프로젝트 열기 */
  const openProject = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const info = await window.api.ccFileOpenProject?.()
      if (info?.detected) {
        setProjectInfo(info)
        setSceneFile(null)
      } else if (info !== null) {
        setError('Cocos Creator 프로젝트를 찾을 수 없습니다.')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // 로드된 씬 파일 외부 변경 감지 (다른 에디터에서 저장 시 — 자체 저장은 suppress)
  useEffect(() => {
    const unsub = window.api.onCCFileChanged?.((event) => {
      if (suppressWatchRef.current) { suppressWatchRef.current = false; return }
      const cur = sceneFileRef.current
      if (cur && event.path === cur.scenePath && event.type === 'change') {
        setExternalChange({ path: event.path, timestamp: event.timestamp })
      }
    })
    return () => unsub?.()
  }, [])

  // 씬 파일 로드 시 해당 파일 감시 등록
  useEffect(() => {
    if (!sceneFile?.scenePath) return
    window.api.ccFileWatch?.(sceneFile.scenePath)
    return () => { window.api.ccFileUnwatch?.(sceneFile.scenePath) }
  }, [sceneFile?.scenePath])

  /** 경로로 프로젝트 감지 (자동 감지용) */
  const detectProject = useCallback(async (projectPath: string) => {
    if (!projectPath) return
    setLoading(true)
    setError(null)
    try {
      const info = await window.api.ccFileDetect?.(projectPath)
      if (info?.detected) {
        setProjectInfo(info)
        setSceneFile(null)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  /** 씬 파일 파싱 → CCSceneFile */
  const loadScene = useCallback(
    async (scenePath: string) => {
      if (!projectInfo) return
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.ccFileReadScene?.(scenePath, projectInfo)
        if (!result) {
          setError('씬 파일 로드 실패')
        } else if ('error' in result) {
          setError(result.error)
        } else {
          setSceneFile(result)
        }
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    },
    [projectInfo]
  )

  /** 내부 저장 + 재로드 (히스토리 스택 없이) */
  const _saveRaw = useCallback(async (root: CCSceneNode): Promise<{ success: boolean; error?: string }> => {
    const sf = sceneFileRef.current
    const pi = projectInfoRef.current
    if (!sf) return { success: false, error: '씬 파일이 로드되지 않았습니다.' }
    try {
      suppressWatchRef.current = true
      const result = await window.api.ccFileSaveScene?.(sf, root)
      if (result?.success && pi) {
        const fresh = await window.api.ccFileReadScene?.(sf.scenePath, pi)
        if (fresh && !('error' in fresh)) setSceneFile(fresh)
      } else {
        suppressWatchRef.current = false
      }
      return result ?? { success: false, error: 'API 없음' }
    } catch (e) {
      suppressWatchRef.current = false
      return { success: false, error: String(e) }
    }
  }, [])

  /** 수정된 씬 트리를 파일에 저장 (undo 스냅샷 + 재로드) */
  const saveScene = useCallback(
    async (modifiedRoot: CCSceneNode): Promise<{ success: boolean; error?: string }> => {
      const sf = sceneFileRef.current
      if (!sf?.root) return { success: false, error: '씬 파일이 로드되지 않았습니다.' }
      // 현재 상태를 undo 스택에 push
      undoStackRef.current = [...undoStackRef.current.slice(-49), JSON.parse(JSON.stringify(sf.root))]
      redoStackRef.current = []
      setCanUndo(true)
      setCanRedo(false)
      return _saveRaw(modifiedRoot)
    },
    [_saveRaw]
  )

  /** Ctrl+Z — undo */
  const undo = useCallback(async () => {
    const prev = undoStackRef.current.pop()
    const sf = sceneFileRef.current
    if (!prev || !sf?.root) { setCanUndo(false); return }
    setCanUndo(undoStackRef.current.length > 0)
    redoStackRef.current = [...redoStackRef.current, JSON.parse(JSON.stringify(sf.root))]
    setCanRedo(true)
    return _saveRaw(prev)
  }, [_saveRaw])

  /** Ctrl+Y — redo */
  const redo = useCallback(async () => {
    const next = redoStackRef.current.pop()
    const sf = sceneFileRef.current
    if (!next || !sf?.root) { setCanRedo(false); return }
    setCanRedo(redoStackRef.current.length > 0)
    undoStackRef.current = [...undoStackRef.current, JSON.parse(JSON.stringify(sf.root))]
    setCanUndo(true)
    return _saveRaw(next)
  }, [_saveRaw])

  /** 저장 실패 시 .bak에서 복원 */
  const restoreBackup = useCallback(async () => {
    if (!sceneFile) return { success: false, error: '씬 파일이 로드되지 않았습니다.' }
    try {
      return await window.api.ccFileRestoreBackup?.(sceneFile.scenePath) ?? { success: false }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }, [sceneFile])

  const clearProject = useCallback(() => {
    setProjectInfo(null)
    setSceneFile(null)
    setError(null)
  }, [])

  return {
    projectInfo,
    sceneFile,
    loading,
    error,
    externalChange,
    canUndo,
    canRedo,
    openProject,
    detectProject,
    loadScene,
    saveScene,
    undo,
    redo,
    restoreBackup,
    clearProject,
  }
}
