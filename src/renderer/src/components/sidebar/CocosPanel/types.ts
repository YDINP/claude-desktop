import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'

// Round 635: Inspector Transform 복사/붙여넣기
export type TransformSnapshot = {
  position: CCSceneNode['position']
  rotation: CCSceneNode['rotation']
  scale: CCSceneNode['scale']
  size: CCSceneNode['size']
  anchor: CCSceneNode['anchor']
  opacity: number
}
export let transformClipboard: TransformSnapshot | null = null
export function setTransformClipboard(v: TransformSnapshot | null) { transformClipboard = v }

// R1441: 최적화 제안 인터페이스
export interface OptimizationSuggestion {
  type: 'performance' | 'memory' | 'structure'
  severity: 'high' | 'medium' | 'low'
  message: string
  affectedUuids?: string[]
}

export interface CCFileProjectUIProps {
  fileProject: {
    projectInfo: import('@shared/ipc-schema').CCFileProjectInfo | null
    sceneFile: CCSceneFile | null
    loading: boolean
    error: string | null
    externalChange: { path: string; timestamp: number } | null
    canUndo: boolean
    canRedo: boolean
    undoCount?: number  // R2321
    redoCount?: number  // R2321
    openProject: () => Promise<void>
    detectProject?: (path: string) => Promise<void>
    loadScene: (scenePath: string) => Promise<void>
    saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
    undo: () => Promise<{ success: boolean; error?: string } | undefined>
    redo: () => Promise<{ success: boolean; error?: string } | undefined>
    restoreBackup: () => Promise<{ success: boolean; error?: string }>
    conflictInfo: { root: CCSceneNode } | null  // R1437
    forceOverwrite: () => Promise<{ success: boolean; error?: string }>  // R1437
  }
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
}
