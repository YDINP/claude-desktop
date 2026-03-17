import { useState, useEffect, useCallback, useRef } from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'

export interface UseHierarchyPanelProps {
  sceneFile: CCSceneFile | null
  selectedNode: CCSceneNode | null
}

export function useHierarchyPanel({ sceneFile, selectedNode }: UseHierarchyPanelProps) {
  const [hideInactive, setHideInactive] = useState(false)
  const [collapsedUuids, setCollapsedUuids] = useState<Set<string>>(() => new Set())
  const expandAll = useCallback(() => setCollapsedUuids(new Set()), [])
  // R2455: 특정 노드까지의 경로 모두 펼치기 (검색 결과 클릭 시 reveal in hierarchy)
  const expandToNode = useCallback((targetUuid: string) => {
    if (!sceneFile?.root) return
    const ancestors = new Set<string>()
    function findAncestors(n: CCSceneNode, path: string[]): boolean {
      if (n.uuid === targetUuid) { path.forEach(u => ancestors.add(u)); return true }
      for (const c of n.children) {
        if (findAncestors(c, [...path, n.uuid])) return true
      }
      return false
    }
    findAncestors(sceneFile.root, [])
    setCollapsedUuids(prev => { const next = new Set(prev); ancestors.forEach(u => next.delete(u)); return next })
  }, [sceneFile?.root])
  // R1655: 깊이 N까지 펼치기
  const collapseToDepth = useCallback((maxDepth: number) => {
    if (!sceneFile?.root) return
    const uuids = new Set<string>()
    function walk(n: CCSceneNode, depth: number) {
      if (depth >= maxDepth && n.children.length > 0) { uuids.add(n.uuid) }
      else { n.children.forEach(c => walk(c, depth + 1)) }
    }
    walk(sceneFile.root, 0)
    setCollapsedUuids(uuids)
  }, [sceneFile?.root])
  const collapseAll = useCallback(() => {
    if (!sceneFile?.root) return
    const uuids = new Set<string>()
    function collectParents(n: CCSceneNode) {
      if (n.children.length > 0) { uuids.add(n.uuid); n.children.forEach(collectParents) }
    }
    collectParents(sceneFile.root)
    setCollapsedUuids(uuids)
  }, [sceneFile?.root])
  // R1707: 씬 경로별 collapsed 상태 localStorage 저장/복원
  const collapsedPersistKey = sceneFile?.scenePath ? `tree-collapsed:${sceneFile.scenePath}` : null
  useEffect(() => {
    if (!collapsedPersistKey) return
    try {
      const saved = localStorage.getItem(collapsedPersistKey)
      if (saved) setCollapsedUuids(new Set(JSON.parse(saved) as string[]))
      else setCollapsedUuids(new Set())
    } catch { setCollapsedUuids(new Set()) }
  }, [collapsedPersistKey])
  useEffect(() => {
    if (!collapsedPersistKey) return
    try { localStorage.setItem(collapsedPersistKey, JSON.stringify([...collapsedUuids])) } catch {}
  }, [collapsedPersistKey, collapsedUuids])
  // R1644: 선택 노드 트리 자동 스크롤 + R2497: 조상 노드 자동 펼치기 (씬뷰 클릭 포함)
  useEffect(() => {
    if (!selectedNode) return
    expandToNode(selectedNode.uuid)
    requestAnimationFrame(() => {
      const el = document.getElementById(`tree-node-${selectedNode.uuid}`)
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [selectedNode?.uuid])
  const [sceneViewHeight, setSceneViewHeight] = useState(240)
  // R1470: Cocos 에디터 레이아웃 — 계층 패널 너비 (좌우 분할)
  const [hierarchyWidth, setHierarchyWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('cc-hierarchy-width') ?? '160') } catch { return 160 }
  })
  const hDividerDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const dividerDragRef = useRef<{ startY: number; startH: number } | null>(null)

  return {
    hideInactive, setHideInactive,
    collapsedUuids, setCollapsedUuids,
    expandAll, expandToNode, collapseToDepth, collapseAll,
    sceneViewHeight, setSceneViewHeight,
    hierarchyWidth, setHierarchyWidth,
    hDividerDragRef, dividerDragRef,
  }
}

export type UseHierarchyPanelReturn = ReturnType<typeof useHierarchyPanel>
