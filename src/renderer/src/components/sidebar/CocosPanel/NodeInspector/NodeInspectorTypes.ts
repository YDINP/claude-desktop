import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'

/** Props passed to CCFileNodeInspector from parent */
export interface CCFileNodeInspectorProps {
  node: CCSceneNode
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onUpdate: (n: CCSceneNode | null) => void
  lockedUuids?: Set<string>
  onToggleLocked?: (uuid: string) => void
  onPulse?: (uuid: string) => void
  pinnedUuids?: Set<string>
  onTogglePin?: (uuid: string, name: string) => void
}

/** Shared controller interface for sub-components */
export interface NodeInspectorCtx {
  // Core data
  node: CCSceneNode
  draft: CCSceneNode
  sceneFile: CCSceneFile
  saving: boolean
  is3x: boolean

  // Core actions
  applyAndSave: (patch: Partial<CCSceneNode>) => void
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onUpdate: (n: CCSceneNode | null) => void

  // Section collapse
  collapsed: Record<string, boolean>
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  collapsedComps: Set<string>
  setCollapsedComps: React.Dispatch<React.SetStateAction<Set<string>>>

  // Refs
  origSnapRef: React.MutableRefObject<CCSceneNode | null>
  origSnapUuidRef: React.MutableRefObject<string | null>

  // Search & filter
  propSearch: string
  setPropSearch: React.Dispatch<React.SetStateAction<string>>
  showPropSearch: boolean
  setShowPropSearch: React.Dispatch<React.SetStateAction<boolean>>
  compFilter: string
  showFavPropsOnly: boolean
  favProps: Set<string>
  toggleFavProp: (compType: string, propKey: string) => void
  expandedArrayProps: Set<string>
  setExpandedArrayProps: React.Dispatch<React.SetStateAction<Set<string>>>

  // Node operations
  lockedUuids?: Set<string>
  onToggleLocked?: (uuid: string) => void
  onPulse?: (uuid: string) => void
  pinnedUuids?: Set<string>
  onTogglePin?: (uuid: string, name: string) => void
}
