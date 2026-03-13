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
  const sceneFileRef = useRef(sceneFile)
  sceneFileRef.current = sceneFile

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

  // 로드된 씬 파일 외부 변경 감지 (다른 에디터에서 저장 시)
  useEffect(() => {
    const unsub = window.api.onCCFileChanged?.((event) => {
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

  /** 수정된 씬 트리를 파일에 저장 */
  const saveScene = useCallback(
    async (modifiedRoot: CCSceneNode): Promise<{ success: boolean; error?: string }> => {
      if (!sceneFile) return { success: false, error: '씬 파일이 로드되지 않았습니다.' }
      try {
        const result = await window.api.ccFileSaveScene?.(sceneFile, modifiedRoot)
        return result ?? { success: false, error: 'API 없음' }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },
    [sceneFile]
  )

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
    openProject,
    detectProject,
    loadScene,
    saveScene,
    restoreBackup,
    clearProject,
  }
}
