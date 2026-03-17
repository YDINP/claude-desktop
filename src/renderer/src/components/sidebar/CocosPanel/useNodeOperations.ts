import { useState, useCallback, useRef, useMemo } from 'react'
import type { CCSceneNode, CCSceneFile, CCFileProjectInfo } from '@shared/ipc-schema'
import { deepCopyNodeWithNewUuids, extractPrefabEntries } from '../cocos-utils'

export interface UseNodeOperationsProps {
  sceneFile: CCSceneFile | null
  projectInfo: CCFileProjectInfo | null
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  loadScene: (scenePath: string) => Promise<void>
  detectProject?: (path: string) => Promise<void>
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
  dupeOffsetX: number
  dupeOffsetY: number
  setSaveMsg: (msg: { ok: boolean; text: string } | null) => void
}

export function useNodeOperations({
  sceneFile, projectInfo, saveScene, loadScene, detectProject,
  selectedNode, onSelectNode, dupeOffsetX, dupeOffsetY, setSaveMsg,
}: UseNodeOperationsProps) {
  // R1729: cc.Label Find & Replace 상태
  const [showLabelReplace, setShowLabelReplace] = useState(false)
  const [labelFindText, setLabelFindText] = useState('')
  const [labelReplaceText, setLabelReplaceText] = useState('')

  // R1430: 전역 노드 검색 상태
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<Array<{ node: CCSceneNode; path: string }>>([])
  const globalSearchInputRef = useRef<HTMLInputElement>(null)
  // R1734: 검색 결과 컴포넌트 타입 필터
  const [globalSearchCompFilter, setGlobalSearchCompFilter] = useState('')

  // R1514: 프리팹 인스턴스화
  const [prefabPickerOpen, setPrefabPickerOpen] = useState(false)
  const [insertingPrefab, setInsertingPrefab] = useState(false)

  const patchNodes = useCallback(
    async (patcher: (n: CCSceneNode) => CCSceneNode, _label?: string) => {
      if (!sceneFile?.root) return
      function walk(n: CCSceneNode): CCSceneNode {
        return { ...patcher(n), children: n.children.map(walk) }
      }
      await saveScene(walk(sceneFile.root))
    },
    [sceneFile, saveScene]
  )

  const handleNodeMove = useCallback(async (uuid: string, x: number, y: number) => {
    await patchNodes(n => n.uuid === uuid ? { ...n, position: { ...n.position, x, y } } : n, 'position')
  }, [patchNodes])

  const handleNodeResize = useCallback(async (uuid: string, w: number, h: number) => {
    await patchNodes(n => n.uuid === uuid ? { ...n, size: { x: Math.round(w), y: Math.round(h) } } : n, 'size')
  }, [patchNodes])

  const handleNodeRotate = useCallback(async (uuid: string, angle: number) => {
    const rounded = Math.round(angle * 10) / 10
    await patchNodes(n => {
      if (n.uuid !== uuid) return n
      const rot = typeof n.rotation === 'number' ? rounded : { ...(n.rotation as object), z: rounded }
      return { ...n, rotation: rot }
    }, 'rotation')
  }, [patchNodes])

  // R2476: 씬뷰 HUD opacity 인라인 편집
  const handleNodeOpacity = useCallback(async (uuid: string, opacity: number) => {
    await patchNodes(n => n.uuid === uuid ? { ...n, opacity } : n, 'opacity')
  }, [patchNodes])

  // R1506: 앵커 포인트 드래그 편집 (SceneView ◇ 핸들)
  const handleAnchorMove = useCallback(async (uuid: string, ax: number, ay: number) => {
    const clamped = { x: Math.max(0, Math.min(1, Math.round(ax * 100) / 100)), y: Math.max(0, Math.min(1, Math.round(ay * 100) / 100)) }
    await patchNodes(n => n.uuid === uuid ? { ...n, anchor: clamped } : n, 'anchor')
  }, [patchNodes])

  const handleMultiMove = useCallback(async (moves: Array<{ uuid: string; x: number; y: number }>) => {
    if (!sceneFile?.root) return
    function updateAll(n: CCSceneNode): CCSceneNode {
      const m = moves.find(mv => mv.uuid === n.uuid)
      if (m) return { ...n, position: { ...n.position, x: m.x, y: m.y } }
      return { ...n, children: n.children.map(updateAll) }
    }
    await saveScene(updateAll(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1483: 다중 선택 일괄 삭제
  const handleMultiDelete = useCallback(async (uuids: string[]) => {
    if (!sceneFile?.root) return
    const uuidSet = new Set(uuids)
    // 루트 노드 보호
    uuidSet.delete(sceneFile.root.uuid)
    if (uuidSet.size === 0) return
    function removeNodes(n: CCSceneNode): CCSceneNode {
      return { ...n, children: n.children.filter(c => !uuidSet.has(c.uuid)).map(removeNodes) }
    }
    await saveScene(removeNodes(sceneFile.root))
    onSelectNode(null)
  }, [sceneFile, saveScene, onSelectNode])

  // R1491: Label 텍스트 인라인 편집 (SceneView 더블클릭)
  const handleLabelEdit = useCallback(async (uuid: string, text: string) => {
    if (!sceneFile?.root) return
    function patchLabel(n: CCSceneNode): CCSceneNode {
      if (n.uuid !== uuid) return { ...n, children: n.children.map(patchLabel) }
      const labelComp = n.components.find(c => c.type === 'cc.Label' || c.type === 'Label' || c.type === 'cc.RichText')
      if (!labelComp) return n
      const propKey = ('_string' in labelComp.props) ? '_string' : 'string'
      return {
        ...n,
        components: n.components.map(c =>
          c === labelComp ? { ...c, props: { ...c.props, [propKey]: text } } : c
        ),
      }
    }
    await saveScene(patchLabel(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1729: 매칭 cc.Label 목록
  const labelReplaceMatches = useMemo(() => {
    if (!showLabelReplace || !labelFindText.trim() || !sceneFile?.root) return []
    const matches: Array<{ node: CCSceneNode; current: string }> = []
    function walk(n: CCSceneNode) {
      const labelComp = n.components.find(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
      if (labelComp) {
        const p = labelComp.props as Record<string, unknown>
        const str = String(p._string ?? p.string ?? '')
        if (str.includes(labelFindText)) matches.push({ node: n, current: str })
      }
      n.children.forEach(walk)
    }
    walk(sceneFile.root)
    return matches
  }, [showLabelReplace, labelFindText, sceneFile])

  // R1729: cc.Label 전체 교체
  const handleLabelReplaceAll = useCallback(async () => {
    if (!sceneFile?.root || !labelFindText.trim() || labelReplaceMatches.length === 0) return
    const uuidSet = new Set(labelReplaceMatches.map(m => m.node.uuid))
    function patchAll(n: CCSceneNode): CCSceneNode {
      const children = n.children.map(patchAll)
      if (!uuidSet.has(n.uuid)) return { ...n, children }
      const updatedComps = n.components.map(c => {
        if (c.type !== 'cc.Label' && c.type !== 'cc.RichText') return c
        const p = c.props as Record<string, unknown>
        const propKey = '_string' in p ? '_string' : 'string'
        const current = String(p[propKey] ?? '')
        const replaced = current.split(labelFindText).join(labelReplaceText)
        return { ...c, props: { ...c.props, [propKey]: replaced } }
      })
      return { ...n, components: updatedComps, children }
    }
    await saveScene(patchAll(sceneFile.root))
    setLabelFindText('')
    setLabelReplaceText('')
  }, [sceneFile, saveScene, labelFindText, labelReplaceText, labelReplaceMatches])

  // R1504: 새 노드 추가 (SceneView "+" 버튼 또는 Ctrl+N)
  const handleAddNode = useCallback(async (parentUuid: string | null, pos?: { x: number; y: number }) => {
    if (!sceneFile?.root) return
    const version = projectInfo?.version ?? '2x'
    const newUuid = version === '3x'
      ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14))
      : Math.random().toString(36).slice(2, 14)
    const newNode: CCSceneNode = {
      uuid: newUuid,
      name: 'NewNode',
      active: true,
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0, z: 0 },
      rotation: 0,
      scale: { x: 1, y: 1, z: 1 },
      size: { x: 100, y: 100 },
      anchor: { x: 0.5, y: 0.5 },
      opacity: 255,
      color: { r: 255, g: 255, b: 255, a: 255 },
      components: [],
      children: [],
      // _rawIndex undefined → cc-file-saver normalizeTree가 자동 생성
    }
    const targetParentUuid = parentUuid ?? sceneFile.root.uuid
    function insertInto(n: CCSceneNode): CCSceneNode {
      if (n.uuid === targetParentUuid) return { ...n, children: [...n.children, newNode] }
      return { ...n, children: n.children.map(insertInto) }
    }
    const result = await saveScene(insertInto(sceneFile.root))
    if (result?.success !== false) {
      // 추가된 노드를 선택
      const findAdded = (root: CCSceneNode): CCSceneNode | null => {
        if (root.uuid === newUuid) return root
        for (const c of root.children) { const f = findAdded(c); if (f) return f }
        return null
      }
      // sceneFile이 갱신된 후 선택 — 약간 지연 후 처리
      setTimeout(() => {
        if (sceneFile?.root) {
          const added = findAdded(sceneFile.root)
          if (added) onSelectNode(added)
        }
      }, 100)
    }
  }, [sceneFile, saveScene, projectInfo, onSelectNode])

  // R1567: Ctrl+↑↓ — 형제 순서 변경
  const handleReorder = useCallback(async (uuid: string, direction: 1 | -1) => {
    if (!sceneFile?.root) return
    function reorder(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === uuid)
      if (idx !== -1) {
        const newIdx = idx - direction  // direction=1(위) → idx 감소
        if (newIdx < 0 || newIdx >= n.children.length) return n
        const arr = [...n.children]
        const [item] = arr.splice(idx, 1)
        arr.splice(newIdx, 0, item)
        return { ...n, children: arr }
      }
      return { ...n, children: n.children.map(reorder) }
    }
    await saveScene(reorder(sceneFile.root))
  }, [sceneFile, saveScene])

  // R2549: 형제 순서 맨 앞/뒤 이동
  const handleReorderExtreme = useCallback(async (uuid: string, to: 'first' | 'last') => {
    if (!sceneFile?.root) return
    function reorderEx(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === uuid)
      if (idx !== -1) {
        const arr = [...n.children]
        const [item] = arr.splice(idx, 1)
        if (to === 'first') arr.unshift(item)
        else arr.push(item)
        return { ...n, children: arr }
      }
      return { ...n, children: n.children.map(reorderEx) }
    }
    await saveScene(reorderEx(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1736: 자식 알파벳순 정렬
  const handleSortChildren = useCallback(async (uuid: string) => {
    if (!sceneFile?.root) return
    function sort(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) return { ...n, children: [...n.children].sort((a, b) => a.name.localeCompare(b.name)).map(sort) }
      return { ...n, children: n.children.map(sort) }
    }
    await saveScene(sort(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1565: H — 선택 노드 active 토글
  const handleToggleActive = useCallback(async (uuid: string) => {
    await patchNodes(n => n.uuid === uuid ? { ...n, active: !n.active } : n, 'active')
  }, [patchNodes])

  // R1563: Ctrl+D — 선택 노드 + 하위 트리 복제 (새 UUID 부여)
  const handleDuplicate = useCallback(async (uuid: string) => {
    if (!sceneFile?.root) return
    const is3x = projectInfo?.version === '3x'
    const genId = () => is3x
      ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14))
      : Math.random().toString(36).slice(2, 14)
    let isRoot = true
    function deepClone(n: CCSceneNode): CCSceneNode {
      // R2488: 최상위 복제 노드에만 offset 적용
      const applyOffset = isRoot; isRoot = false
      const pos = applyOffset && n.position ? { ...n.position, x: (n.position.x ?? 0) + dupeOffsetX, y: (n.position.y ?? 0) + dupeOffsetY } : n.position
      return { ...n, uuid: genId(), name: n.name + '_copy', position: pos, children: n.children.map(deepClone) }
    }
    // 원본 찾아서 부모 children에 clone 삽입 (원본 바로 다음)
    let clonedNode: CCSceneNode | null = null
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === uuid)
      if (idx !== -1) {
        const clone = deepClone(n.children[idx])
        clonedNode = clone
        const newChildren = [...n.children.slice(0, idx + 1), clone, ...n.children.slice(idx + 1)]
        return { ...n, children: newChildren }
      }
      return { ...n, children: n.children.map(insertAfter) }
    }
    const newRoot = insertAfter(sceneFile.root)
    if (!clonedNode) return
    const result = await saveScene(newRoot)
    if (result?.success !== false && clonedNode) {
      const c = clonedNode
      setTimeout(() => { onSelectNode(c) }, 100)
    }
  }, [sceneFile, saveScene, projectInfo, onSelectNode, dupeOffsetX, dupeOffsetY])

  // R2705: Alt+drag 복제 — 원본 uuid 위치에 deepCopy 삽입 후 x/y 이동
  const handleAltDrag = useCallback(async (uuid: string, x: number, y: number) => {
    if (!sceneFile?.root) return
    const is3x = projectInfo?.version === '3x'
    const genId = () => is3x
      ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14))
      : Math.random().toString(36).slice(2, 14)
    let isRoot = true
    function deepClone(n: CCSceneNode): CCSceneNode {
      const applyPos = isRoot; isRoot = false
      const position = applyPos ? { ...(n.position ?? { x: 0, y: 0, z: 0 }), x, y } : n.position
      return { ...n, uuid: genId(), name: n.name + '_copy', position, children: n.children.map(deepClone) }
    }
    let clonedNode: CCSceneNode | null = null
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === uuid)
      if (idx !== -1) {
        const clone = deepClone(n.children[idx])
        clonedNode = clone
        return { ...n, children: [...n.children.slice(0, idx + 1), clone, ...n.children.slice(idx + 1)] }
      }
      return { ...n, children: n.children.map(insertAfter) }
    }
    const newRoot = insertAfter(sceneFile.root)
    if (!clonedNode) return
    const result = await saveScene(newRoot)
    if (result?.success !== false && clonedNode) {
      const c = clonedNode
      setTimeout(() => { onSelectNode(c) }, 100)
    }
  }, [sceneFile, saveScene, projectInfo, onSelectNode])

  const handleReparent = useCallback(async (dragUuid: string, dropUuid: string) => {
    if (!sceneFile?.root || dragUuid === dropUuid || sceneFile.root.uuid === dragUuid) return
    // 사이클 방지: drop 대상이 drag 노드의 하위인지 확인
    function isDesc(n: CCSceneNode, target: string): boolean {
      if (n.uuid === target) return true
      return n.children.some(c => isDesc(c, target))
    }
    const findNode = (n: CCSceneNode): CCSceneNode | null => {
      if (n.uuid === dragUuid) return n
      for (const c of n.children) { const f = findNode(c); if (f) return f }
      return null
    }
    const dragged = findNode(sceneFile.root)
    if (!dragged || isDesc(dragged, dropUuid)) return

    let moved: CCSceneNode | null = null
    function remove(n: CCSceneNode): CCSceneNode {
      const ch = n.children.filter(c => { if (c.uuid === dragUuid) { moved = c; return false } return true })
      return { ...n, children: ch.map(remove) }
    }
    function insert(n: CCSceneNode): CCSceneNode {
      if (n.uuid === dropUuid) return { ...n, children: [...n.children, moved!] }
      return { ...n, children: n.children.map(insert) }
    }
    const reduced = remove(sceneFile.root)
    if (!moved) return
    await saveScene(insert(reduced))
  }, [sceneFile, saveScene])

  // R2466: 다중 선택 노드 그룹화
  const handleGroupNodes = useCallback(async (uuids: string[]) => {
    if (!sceneFile?.root || !sceneFile._raw || uuids.length < 2) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const version = sceneFile.projectInfo.version ?? '2x'
    const uuidSet = new Set(uuids)
    // 선택 노드 수집
    const collected: CCSceneNode[] = []
    function findSelected(n: CCSceneNode) {
      if (uuidSet.has(n.uuid)) collected.push(n)
      n.children.forEach(findSelected)
    }
    findSelected(sceneFile.root)
    if (collected.length === 0) return
    // 평균 위치 계산
    const avgX = Math.round(collected.reduce((s, n) => s + ((n.position as { x: number }).x ?? 0), 0) / collected.length)
    const avgY = Math.round(collected.reduce((s, n) => s + ((n.position as { y: number }).y ?? 0), 0) / collected.length)
    // 새 Group 노드 raw 엔트리
    const groupId = 'grp-' + Date.now()
    const groupIdx = raw.length
    raw.push(version === '3x' ? {
      __type__: 'cc.Node', _id: groupId, _name: 'Group', _active: true,
      _children: [], _components: [],
      _lpos: { x: avgX, y: avgY, z: 0 }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
    } : {
      __type__: 'cc.Node', _id: groupId, _name: 'Group', _active: true,
      _children: [], _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [avgX, avgY, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { width: 100, height: 100 }, _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
    })
    const groupNode: CCSceneNode = {
      uuid: groupId, name: 'Group', active: true,
      position: { x: avgX, y: avgY, z: 0 }, size: { x: 100, y: 100 },
      scale: { x: 1, y: 1, z: 1 }, anchor: { x: 0.5, y: 0.5 }, rotation: 0,
      opacity: 255, color: null, components: [], children: [], _rawIndex: groupIdx,
    }
    // 선택 노드를 트리에서 제거
    function removeSelected(n: CCSceneNode): CCSceneNode {
      const children = n.children.filter(c => !uuidSet.has(c.uuid))
      return { ...n, children: children.map(removeSelected) }
    }
    const reduced = removeSelected(sceneFile.root)
    // group 노드에 수집된 노드 추가 (위치를 group 기준 로컬 좌표로 변환)
    const groupWithChildren: CCSceneNode = {
      ...groupNode,
      children: collected.map(c => ({
        ...c,
        position: { x: ((c.position as { x: number }).x ?? 0) - avgX, y: ((c.position as { y: number }).y ?? 0) - avgY, z: 0 },
      })),
    }
    // root 직속 자식으로 group 노드 추가
    const newRoot = { ...reduced, children: [...reduced.children, groupWithChildren] }
    await saveScene(newRoot)
  }, [sceneFile, saveScene])

  // R1514: 프리팹 삽입 핸들러
  const handleInsertPrefab = useCallback(async (prefabPath: string) => {
    if (!sceneFile?.root || !projectInfo) return
    setInsertingPrefab(true)
    setPrefabPickerOpen(false)
    try {
      const result = await window.api.ccFileReadScene(prefabPath, projectInfo)
      if (!result || result.error || !result.root) {
        console.error('[R1514] 프리팹 로드 실패:', result?.error)
        return
      }
      const prefabRoot: CCSceneNode = result.root
      const instNode = deepCopyNodeWithNewUuids(prefabRoot, '')
      // 이름 중복 방지: 파일명 기반
      const prefabName = prefabPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.prefab$/i, '') ?? 'PrefabInst'
      const namedInst = { ...instNode, name: prefabName, _rawIndex: undefined }
      const targetUuid = selectedNode?.uuid ?? sceneFile.root.uuid
      function insertInto(n: CCSceneNode): CCSceneNode {
        if (n.uuid === targetUuid) return { ...n, children: [...n.children, namedInst] }
        return { ...n, children: n.children.map(insertInto) }
      }
      await saveScene(insertInto(sceneFile.root))
    } catch (e) {
      console.error('[R1514] 프리팹 삽입 오류:', e)
    } finally {
      setInsertingPrefab(false)
    }
  }, [sceneFile, projectInfo, selectedNode, saveScene])

  // 트리 컨텍스트 메뉴용 핸들러들
  const handleTreeAddChild = useCallback(async (parentUuid: string) => {
    if (!sceneFile?.root || !sceneFile._raw) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const version = sceneFile.projectInfo.version ?? '2x'
    const newId = 'ctx-' + Date.now()
    const newIdx = raw.length
    raw.push(version === '3x' ? {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
    } : {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
      _contentSize: { width: 100, height: 100 }, _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
    })
    const newNode: CCSceneNode = {
      uuid: newId, name: 'NewNode', active: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: version === '3x' ? { x: 0, y: 0, z: 0 } : 0,
      scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 },
      opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 },
      components: [], children: [], _rawIndex: newIdx,
    }
    function addChild(n: CCSceneNode): CCSceneNode {
      if (n.uuid === parentUuid) return { ...n, children: [...n.children, newNode] }
      return { ...n, children: n.children.map(addChild) }
    }
    try {
      const result = await saveScene(addChild(sceneFile.root))
      if (!result.success) raw.pop()
    } catch {
      raw.pop()
    }
  }, [sceneFile, saveScene])

  const handleTreeToggleActive = useCallback(async (nodeUuid: string) => {
    await patchNodes(n => n.uuid === nodeUuid ? { ...n, active: !n.active } : n, 'active')
  }, [patchNodes])

  const handleRenameInView = useCallback(async (nodeUuid: string, newName: string) => {
    if (!newName.trim()) return
    await patchNodes(n => n.uuid === nodeUuid ? { ...n, name: newName.trim() } : n, 'rename')
  }, [patchNodes])

  // R2463: 노드를 프리팹 파일로 저장
  const handleSaveAsPrefab = useCallback(async (uuid: string) => {
    if (!sceneFile?._raw || !projectInfo?.projectPath) return
    function findNode(n: CCSceneNode): CCSceneNode | null {
      if (n.uuid === uuid) return n
      for (const c of n.children) { const f = findNode(c); if (f) return f }
      return null
    }
    const node = findNode(sceneFile.root)
    if (!node || node._rawIndex == null) return
    const safeName = (node.name || 'Prefab').replace(/[<>:"/\\|?*]/g, '_')
    const prefabName = window.prompt('프리팹 파일 이름 (확장자 제외):', safeName)
    if (!prefabName?.trim()) return
    const prefabEntries = extractPrefabEntries(sceneFile._raw, node._rawIndex)
    const prefabJson = JSON.stringify(prefabEntries, null, 2)
    const sceneDir = sceneFile.scenePath.replace(/[\\/][^\\/]+$/, '').replace(/\\/g, '/')
    const prefabPath = `${sceneDir}/${prefabName.trim()}.prefab`
    const res = await window.api.writeTextFile?.(prefabPath, prefabJson)
    if (res && 'error' in res) { alert(`프리팹 저장 실패: ${(res as { error: string }).error}`); return }
    await detectProject?.(projectInfo.projectPath)
    setSaveMsg({ ok: true, text: `🧩 ${prefabName.trim()}.prefab 저장 완료` })
    setTimeout(() => setSaveMsg(null), 3000)
  }, [sceneFile, projectInfo, detectProject, setSaveMsg])

  const handleTreeDelete = useCallback(async (nodeUuid: string) => {
    if (!sceneFile?.root || sceneFile.root.uuid === nodeUuid) return
    function removeNode(n: CCSceneNode): CCSceneNode {
      return { ...n, children: n.children.filter(c => c.uuid !== nodeUuid).map(removeNode) }
    }
    await saveScene(removeNode(sceneFile.root))
    if (selectedNode?.uuid === nodeUuid) onSelectNode(null)
  }, [sceneFile, saveScene, selectedNode, onSelectNode])

  const handleTreeDuplicate = useCallback(async (nodeUuid: string) => {
    if (!sceneFile?.root) return
    const findNode = (n: CCSceneNode): CCSceneNode | null => {
      if (n.uuid === nodeUuid) return n
      for (const c of n.children) { const f = findNode(c); if (f) return f }
      return null
    }
    const orig = findNode(sceneFile.root)
    if (!orig) return
    // R1476: 딥복사 + UUID 자동 재생성 (자식 포함 모두 새 UUID)
    // R1533: 복제 시 position +20 offset (겹침 방지)
    const baseNode = deepCopyNodeWithNewUuids(orig, '_Copy')
    const origPos = orig.position as { x?: number; y?: number; z?: number } | undefined
    const dupNode = { ...baseNode, position: { ...(origPos ?? {}), x: (origPos?.x ?? 0) + 20, y: (origPos?.y ?? 0) - 20 } }
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === nodeUuid)
      if (idx >= 0) {
        const ch = [...n.children]
        ch.splice(idx + 1, 0, dupNode)
        return { ...n, children: ch }
      }
      return { ...n, children: n.children.map(insertAfter) }
    }
    await saveScene(insertAfter(sceneFile.root))
  }, [sceneFile, saveScene])

  // R1734: 컴포넌트 타입 필터 적용
  const filteredGlobalResults = useMemo(() => {
    if (!globalSearchCompFilter) return globalSearchResults
    return globalSearchResults.filter(r => r.node.components.some(c => c.type === globalSearchCompFilter))
  }, [globalSearchResults, globalSearchCompFilter])

  // R1430: 검색 실행
  const runGlobalSearch = useCallback((q: string) => {
    setGlobalSearchQuery(q)
    if (!q.trim() || !sceneFile?.root) { setGlobalSearchResults([]); return }
    const lq = q.toLowerCase()
    // R2325: UUID 검색 지원 — `#uuid-prefix` 또는 순수 hex+dash 패턴으로 UUID 부분 매칭
    const uuidQuery = q.startsWith('#') ? q.slice(1).toLowerCase() : (/^[0-9a-f\-]{6,}$/i.test(q) ? lq : null)
    // R2469: text: 또는 t: 접두어로 Label 텍스트 검색 모드
    const textQuery = q.startsWith('text:') ? q.slice(5).toLowerCase() : q.startsWith('t:') ? q.slice(2).toLowerCase() : null
    const found: Array<{ node: CCSceneNode; path: string }> = []
    function walk(n: CCSceneNode, parentPath: string): void {
      const currentPath = parentPath ? `${parentPath}/${n.name}` : n.name
      const nameMatch = !textQuery && n.name.toLowerCase().includes(lq)
      const compMatch = !textQuery && n.components.some(c => c.type.toLowerCase().includes(lq))
      const uuidMatch = !textQuery && (uuidQuery ? n.uuid.toLowerCase().startsWith(uuidQuery) || n.uuid.toLowerCase().includes(uuidQuery) : false)
      // R2469: Label/RichText 텍스트 내용 검색
      const effectiveTextQ = textQuery ?? lq
      const labelMatch = n.components.some(c => {
        if (!c.type.includes('Label') && !c.type.includes('Text')) return false
        const str = String(c.props.string ?? c.props['_N$string'] ?? c.props.text ?? '')
        return str.toLowerCase().includes(effectiveTextQ)
      })
      if (nameMatch || compMatch || uuidMatch || (textQuery ? labelMatch : false)) found.push({ node: n, path: currentPath })
      for (const child of n.children) walk(child, currentPath)
    }
    walk(sceneFile.root, '')
    setGlobalSearchResults(found.slice(0, 50))
  }, [sceneFile])

  return {
    // Label replace
    showLabelReplace, setShowLabelReplace,
    labelFindText, setLabelFindText,
    labelReplaceText, setLabelReplaceText,
    labelReplaceMatches,
    // Global search
    globalSearchOpen, setGlobalSearchOpen,
    globalSearchQuery, setGlobalSearchQuery,
    globalSearchResults, setGlobalSearchResults,
    globalSearchInputRef,
    globalSearchCompFilter, setGlobalSearchCompFilter,
    filteredGlobalResults,
    runGlobalSearch,
    // Prefab
    prefabPickerOpen, setPrefabPickerOpen,
    insertingPrefab, handleInsertPrefab,
    // Node operations
    patchNodes,
    handleNodeMove, handleNodeResize, handleNodeRotate,
    handleNodeOpacity, handleAnchorMove,
    handleMultiMove, handleMultiDelete,
    handleLabelEdit, handleLabelReplaceAll,
    handleAddNode, handleDuplicate, handleToggleActive,
    handleReorder, handleReorderExtreme, handleSortChildren,
    handleReparent, handleGroupNodes, handleAltDrag,
    // Tree context menu handlers
    handleTreeDelete, handleTreeDuplicate,
    handleTreeAddChild, handleTreeToggleActive,
    handleRenameInView, handleSaveAsPrefab,
  }
}

export type UseNodeOperationsReturn = ReturnType<typeof useNodeOperations>
