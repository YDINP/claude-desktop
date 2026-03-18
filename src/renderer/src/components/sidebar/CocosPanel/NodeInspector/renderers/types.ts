import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'

export interface RendererProps {
  comp: CCSceneNode['components'][number]
  draft: CCSceneNode
  applyAndSave: (patch: Partial<CCSceneNode>) => void
  sceneFile: CCSceneFile
  origIdx: number
  ci: number
  is3x: boolean
}

/** Save scene helper for ScrollView content patching */
export interface RendererPropsWithSave extends RendererProps {
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
}
