import { useState, useEffect, useCallback, useRef } from 'react'
import type { CCNode } from '../../../../../shared/ipc-schema'
import type { SceneNode } from './types'
import { flattenTree } from './utils'

interface UseSceneSyncReturn {
  nodeMap: Map<string, SceneNode>
  rootUuid: string | null
  loading: boolean
  refresh: () => Promise<void>
  updateNode: (uuid: string, partial: Partial<SceneNode>) => void
}

export function useSceneSync(connected: boolean, port = 9091): UseSceneSyncReturn {
  const [nodeMap, setNodeMap] = useState<Map<string, SceneNode>>(new Map())
  const [rootUuid, setRootUuid] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    try {
      const tree: CCNode | undefined = await window.api.ccGetTree?.(port)
      if (!tree) return
      const map = new Map<string, SceneNode>()
      flattenTree(tree, null, map)
      setNodeMap(map)
      setRootUuid(tree.uuid)
    } catch (e) {
      console.error('[useSceneSync] refresh failed:', e)
    } finally {
      setLoading(false)
    }
  }, [connected, port])

  // 로컬 낙관적 업데이트 (드래그 중 즉시 반영)
  const updateNode = useCallback((uuid: string, partial: Partial<SceneNode>) => {
    setNodeMap(prev => {
      const next = new Map(prev)
      const node = next.get(uuid)
      if (node) next.set(uuid, { ...node, ...partial })
      return next
    })
  }, [])

  useEffect(() => {
    if (!connected) return
    refresh()

    const unsub = window.api.onCCEvent?.((event) => {
      if (event.type === 'scene:ready' || event.type === 'scene:saved') {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null
          refresh()
        }, 500)
      }
    })

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      unsub?.()
    }
  }, [connected, refresh])

  return { nodeMap, rootUuid, loading, refresh, updateNode }
}
