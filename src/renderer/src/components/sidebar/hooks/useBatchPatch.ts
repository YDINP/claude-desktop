import { useCallback, useEffect, useRef } from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'

type NodePatcher = (node: CCSceneNode) => CCSceneNode

interface UseBatchPatchOptions {
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  uuidSet: Set<string>
  uuids: string[]
  setBatchMsg: (msg: string | null) => void
}

/**
 * CCFileBatchInspector 내 applyXxx 함수들의 공통 3단계 패턴을 추상화.
 *
 * 1) walk — uuidSet에 매칭되는 노드에만 patcher 적용
 * 2) saveScene — 패치된 root로 저장
 * 3) setBatchMsg — 결과 메시지 표시 후 2초 뒤 자동 해제
 */
export function useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg }: UseBatchPatchOptions) {
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleMsgClear = (ms = 2000) => {
    if (msgTimerRef.current !== null) clearTimeout(msgTimerRef.current)
    msgTimerRef.current = setTimeout(() => { setBatchMsg(null); msgTimerRef.current = null }, ms)
  }
  useEffect(() => () => { if (msgTimerRef.current !== null) clearTimeout(msgTimerRef.current) }, [])

  /** Type A: 노드 프로퍼티 직접 패치 */
  const patchNodes = useCallback(
    async (patcher: NodePatcher, label: string) => {
      if (!sceneFile.root) return
      function walk(n: CCSceneNode): CCSceneNode {
        const children = n.children.map(walk)
        if (!uuidSet.has(n.uuid)) return { ...n, children }
        return { ...patcher(n), children }
      }
      await saveScene(walk(sceneFile.root))
      setBatchMsg(`✓ ${label}`)
      scheduleMsgClear()
    },
    [sceneFile, saveScene, uuidSet, setBatchMsg],
  )

  /** Type B: 컴포넌트 프로퍼티 패치 */
  const patchComponents = useCallback(
    async (
      compMatcher: (c: CCSceneComponent) => boolean,
      compPatcher: (c: CCSceneComponent) => CCSceneComponent,
      label: string,
    ) => {
      if (!sceneFile.root) return
      function walk(n: CCSceneNode): CCSceneNode {
        const children = n.children.map(walk)
        if (!uuidSet.has(n.uuid)) return { ...n, children }
        const components = n.components.map(c => compMatcher(c) ? compPatcher(c) : c)
        return { ...n, components, children }
      }
      await saveScene(walk(sceneFile.root))
      setBatchMsg(`✓ ${label}`)
      scheduleMsgClear()
    },
    [sceneFile, saveScene, uuidSet, setBatchMsg],
  )

  /** Type C: 선택 노드를 순서대로 수집 후 인덱스 기반 패치 (그라데이션 등) */
  const patchOrdered = useCallback(
    async (
      orderedPatcher: (node: CCSceneNode, index: number, total: number) => CCSceneNode,
      label: string,
      sorter?: (a: CCSceneNode, b: CCSceneNode) => number,
    ) => {
      if (!sceneFile.root) return
      const selNodes: CCSceneNode[] = []
      function collect(n: CCSceneNode) { if (uuidSet.has(n.uuid)) selNodes.push(n); n.children.forEach(collect) }
      collect(sceneFile.root)
      if (selNodes.length === 0) return
      const ordered = sorter ? [...selNodes].sort(sorter) : selNodes
      const total = ordered.length
      const uuidToIdx = new Map(ordered.map((n, i) => [n.uuid, i]))
      function walk(n: CCSceneNode): CCSceneNode {
        const children = n.children.map(walk)
        const idx = uuidToIdx.get(n.uuid)
        if (idx === undefined) return { ...n, children }
        return { ...orderedPatcher(n, idx, total), children }
      }
      await saveScene(walk(sceneFile.root))
      setBatchMsg(`✓ ${label}`)
      scheduleMsgClear()
    },
    [sceneFile, saveScene, uuidSet, setBatchMsg],
  )

  return { patchNodes, patchComponents, patchOrdered, uuids }
}
