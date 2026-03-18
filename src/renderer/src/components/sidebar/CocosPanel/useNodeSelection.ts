import { useState, useCallback, useMemo } from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'

export interface UseNodeSelectionProps {
  sceneFile: CCSceneFile | null
  nodeColors: Record<string, string>
}

export function useNodeSelection({ sceneFile, nodeColors: externalNodeColors }: UseNodeSelectionProps) {
  const FAV_KEY = 'scene-tree-favorites'
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-tree-favorites') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleFavorite = useCallback((uuid: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])
  const [lockedUuids, setLockedUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-locked') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleLocked = useCallback((uuid: string) => {
    setLockedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('scene-locked', JSON.stringify([...next]))
      return next
    })
  }, [])
  const [nodeColors, setNodeColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('node-colors') ?? '{}') } catch { return {} }
  })
  // R2474: 핀 노드 — 빠른 선택을 위한 노드 고정 목록 (localStorage 영속화)
  const [pinnedNodes, setPinnedNodes] = useState<Array<{ uuid: string; name: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('cc-pinned-nodes') ?? '[]') } catch { return [] }
  })
  const togglePinNode = useCallback((uuid: string, name: string) => {
    setPinnedNodes(prev => {
      const exists = prev.some(p => p.uuid === uuid)
      const next = exists ? prev.filter(p => p.uuid !== uuid) : [...prev, { uuid, name }]
      localStorage.setItem('cc-pinned-nodes', JSON.stringify(next))
      return next
    })
  }, [])
  // R2488: 복제 오프셋
  const [dupeOffsetX, setDupeOffsetX] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem('cc-dupe-offset') ?? '[20,20]')[0] } catch { return 20 }
  })
  const [dupeOffsetY, setDupeOffsetY] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem('cc-dupe-offset') ?? '[20,20]')[1] } catch { return 20 }
  })
  const saveDupeOffset = (x: number, y: number) => {
    setDupeOffsetX(x); setDupeOffsetY(y)
    localStorage.setItem('cc-dupe-offset', JSON.stringify([x, y]))
  }
  // R1184: node filters
  const [nodeFilters, setNodeFilters] = useState<string[]>([])
  const [showNodeFilters, setShowNodeFilters] = useState(false)
  // R1715: 색상 태그 필터
  const [colorTagFilter, setColorTagFilter] = useState<string | null>(null)
  // R1664: 씬 트리 이름 하이라이트
  const [treeHighlightQuery, setTreeHighlightQuery] = useState('')
  // R1516: 다중 선택 노드 공통 속성 배치 편집
  const [multiSelectedUuids, setMultiSelectedUuids] = useState<string[]>([])
  // nodeHistory state (R1595)
  const [nodeHistory, setNodeHistory] = useState<string[]>([])

  const handleNodeColorChange = useCallback((uuid: string, color: string | null) => {
    setNodeColors(prev => {
      const next = { ...prev }
      if (color === null) delete next[uuid]
      else next[uuid] = color
      localStorage.setItem('node-colors', JSON.stringify(next))
      return next
    })
  }, [])

  // R1654: 컴포넌트 필터 적용 트리
  const filteredRoot = useMemo(() => {
    if (!sceneFile?.root) return null
    if (nodeFilters.length === 0 && !colorTagFilter) return sceneFile.root
    function keep(n: CCSceneNode): CCSceneNode | null {
      // R1667: 정확 일치 OR custom 타입 부분 문자열 매칭
      const compMatch = nodeFilters.length === 0 || n.components.some(c => nodeFilters.some(f => c.type === f || c.type.toLowerCase().includes(f.toLowerCase())))
      // R1715: 색상 태그 필터
      const colorMatch = !colorTagFilter || nodeColors[n.uuid] === colorTagFilter
      const filteredChildren = n.children.map(keep).filter(Boolean) as CCSceneNode[]
      if (!(compMatch && colorMatch) && filteredChildren.length === 0) return null
      return { ...n, children: filteredChildren }
    }
    const result = keep(sceneFile.root)
    return result ?? { ...sceneFile.root, children: [] }
  }, [sceneFile?.root, nodeFilters, colorTagFilter, nodeColors])

  return {
    favorites, toggleFavorite,
    lockedUuids, setLockedUuids, toggleLocked,
    nodeColors, handleNodeColorChange,
    pinnedNodes, togglePinNode,
    dupeOffsetX, dupeOffsetY, saveDupeOffset,
    nodeFilters, setNodeFilters, showNodeFilters, setShowNodeFilters,
    colorTagFilter, setColorTagFilter,
    treeHighlightQuery, setTreeHighlightQuery,
    multiSelectedUuids, setMultiSelectedUuids,
    nodeHistory, setNodeHistory,
    filteredRoot,
  }
}

export type UseNodeSelectionReturn = ReturnType<typeof useNodeSelection>
