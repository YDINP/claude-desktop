import { useState, useCallback } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { PROP_HISTORY_KEY, STYLE_PRESETS_KEY, FAV_PROPS_KEY } from './constants'

// Round 611
export type PropHistoryEntry = {
  id: string
  propKey: string
  nodeName: string
  oldValue: unknown
  newValue: unknown
  ts: number
}

// Round 631
export type StylePreset = {
  id: string
  name: string
  position: CCSceneNode['position']
  rotation: CCSceneNode['rotation']
  scale: CCSceneNode['scale']
  size: CCSceneNode['size']
  anchor: CCSceneNode['anchor']
  opacity: number
}

export interface NodePresetsState {
  // node presets (R673)
  nodePresets: Array<{ name: string; props: Record<string, unknown> }>
  setNodePresets: React.Dispatch<React.SetStateAction<Array<{ name: string; props: Record<string, unknown> }>>>
  nodePresetOpen: boolean
  setNodePresetOpen: React.Dispatch<React.SetStateAction<boolean>>
  nodePresetCategories: Record<string, string[]>
  setNodePresetCategories: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  selectedPresetCategory: string
  setSelectedPresetCategory: React.Dispatch<React.SetStateAction<string>>
  saveNodePreset: () => void
  deleteNodePreset: (idx: number, e: React.MouseEvent) => void

  // favorites (R691)
  favoriteNodes: Array<{ uuid: string; name: string }>
  setFavoriteNodes: React.Dispatch<React.SetStateAction<Array<{ uuid: string; name: string }>>>
  favoritesOpen: boolean
  setFavoritesOpen: React.Dispatch<React.SetStateAction<boolean>>
  favoriteTags: string[]
  setFavoriteTags: React.Dispatch<React.SetStateAction<string[]>>
  showFavTags: boolean
  setShowFavTags: React.Dispatch<React.SetStateAction<boolean>>
  toggleFavoriteNode: () => void

  // prop history (Round 611)
  propHistory: PropHistoryEntry[]
  setPropHistory: React.Dispatch<React.SetStateAction<PropHistoryEntry[]>>
  historyOpen: boolean
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>

  // style presets (Round 631)
  stylePresets: StylePreset[]
  setStylePresets: React.Dispatch<React.SetStateAction<StylePreset[]>>
  presetDropdownOpen: boolean
  setPresetDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>
  saveStylePreset: () => void
  deleteStylePreset: (id: string, e: React.MouseEvent) => void

  // fav props
  favProps: Set<string>
  toggleFavProp: (compType: string, propKey: string) => void
  showFavPropsOnly: boolean
  setShowFavPropsOnly: React.Dispatch<React.SetStateAction<boolean>>
}

interface UseNodePresetsProps {
  nodeUuid: string
  nodeName: string
  draft: CCSceneNode
}

export function useNodePresets({ nodeUuid, nodeName, draft }: UseNodePresetsProps): NodePresetsState {
  // node presets
  const [nodePresets, setNodePresets] = useState<Array<{ name: string; props: Record<string, unknown> }>>(() => {
    try { return JSON.parse(localStorage.getItem('node-presets') ?? '[]') } catch { return [] }
  })
  const [nodePresetOpen, setNodePresetOpen] = useState(false)
  const [nodePresetCategories, setNodePresetCategories] = useState<Record<string, string[]>>({})
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<string>('all')

  const saveNodePreset = useCallback(() => {
    const rawName = window.prompt('프리셋 이름', `${draft.name}-${Date.now()}`)
    if (rawName === null) return
    const name = rawName.trim() || `${draft.name}-${Date.now()}`
    const props: Record<string, unknown> = {
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
      active: draft.active,
      color: draft.color,
    }
    setNodePresets(prev => {
      const next = [{ name, props }, ...prev].slice(0, 20)
      localStorage.setItem('node-presets', JSON.stringify(next))
      return next
    })
  }, [draft])

  const deleteNodePreset = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setNodePresets(prev => {
      const next = prev.filter((_, i) => i !== idx)
      localStorage.setItem('node-presets', JSON.stringify(next))
      return next
    })
  }, [])

  // favorites
  const [favoriteNodes, setFavoriteNodes] = useState<Array<{ uuid: string; name: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('favorite-nodes') ?? '[]') } catch { return [] }
  })
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [favoriteTags, setFavoriteTags] = useState<string[]>(() => JSON.parse(localStorage.getItem('fav-tags') ?? '[]'))
  const [showFavTags, setShowFavTags] = useState(false)

  const toggleFavoriteNode = useCallback(() => {
    setFavoriteNodes(prev => {
      const exists = prev.some(f => f.uuid === nodeUuid)
      const next = exists
        ? prev.filter(f => f.uuid !== nodeUuid)
        : [...prev, { uuid: nodeUuid, name: nodeName }]
      localStorage.setItem('favorite-nodes', JSON.stringify(next))
      return next
    })
  }, [nodeUuid, nodeName])

  // prop history (Round 611)
  const [propHistory, setPropHistory] = useState<PropHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(PROP_HISTORY_KEY) ?? '[]') }
    catch { return [] }
  })
  const [historyOpen, setHistoryOpen] = useState(false)

  // style presets (Round 631)
  const [stylePresets, setStylePresets] = useState<StylePreset[]>(() => {
    try { return JSON.parse(localStorage.getItem(STYLE_PRESETS_KEY) ?? '[]') }
    catch { return [] }
  })
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false)

  const saveStylePreset = useCallback(() => {
    const rawName = window.prompt('프리셋 이름', `${draft.name}-${Date.now()}`)
    if (rawName === null) return
    const name = rawName.trim() || `${draft.name}-${Date.now()}`
    const preset: StylePreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
    }
    setStylePresets(prev => {
      const next = [preset, ...prev].slice(0, 10)
      localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next))
      return next
    })
  }, [draft])

  const deleteStylePreset = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setStylePresets(prev => {
      const next = prev.filter(p => p.id !== id)
      localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // fav props
  const [favProps, setFavProps] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_PROPS_KEY) ?? '[]')) }
    catch { return new Set() }
  })
  const toggleFavProp = useCallback((compType: string, propKey: string) => {
    const id = `${compType}:${propKey}`
    setFavProps(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(FAV_PROPS_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])
  const [showFavPropsOnly, setShowFavPropsOnly] = useState(false)

  return {
    nodePresets, setNodePresets, nodePresetOpen, setNodePresetOpen,
    nodePresetCategories, setNodePresetCategories,
    selectedPresetCategory, setSelectedPresetCategory,
    saveNodePreset, deleteNodePreset,
    favoriteNodes, setFavoriteNodes, favoritesOpen, setFavoritesOpen,
    favoriteTags, setFavoriteTags, showFavTags, setShowFavTags,
    toggleFavoriteNode,
    propHistory, setPropHistory, historyOpen, setHistoryOpen,
    stylePresets, setStylePresets, presetDropdownOpen, setPresetDropdownOpen,
    saveStylePreset, deleteStylePreset,
    favProps, toggleFavProp, showFavPropsOnly, setShowFavPropsOnly,
  }
}
