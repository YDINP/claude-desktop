import { useEffect, type MutableRefObject } from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import type { UseNodeOperationsReturn } from './useNodeOperations'

export interface UseKeyboardShortcutsProps {
  sceneFile: CCSceneFile | null
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<{ success: boolean; error?: string } | undefined>
  redo: () => Promise<{ success: boolean; error?: string } | undefined>
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
  handleSave: () => void
  nodeOps: Pick<UseNodeOperationsReturn, 'handleTreeDelete' | 'handleTreeDuplicate' | 'setGlobalSearchOpen' | 'globalSearchOpen' | 'setGlobalSearchQuery' | 'setGlobalSearchResults' | 'globalSearchInputRef'>
  setMultiSelectedUuids: (uuids: string[]) => void
  parentMap: Map<string, string>
  nodeMap: Map<string, CCSceneNode>
  clipboardRef: MutableRefObject<CCSceneNode | null>
  nodeBookmarks: Record<string, string>
  setNodeBookmarks: (fn: (prev: Record<string, string>) => Record<string, string>) => void
  setJsonCopiedName: (name: string | null) => void
}

/**
 * Keyboard shortcut handler extracted from useCCFileProjectUI.
 * Contains all keydown event listeners for the Cocos panel.
 *
 * QA keyword markers:
 * - R1399: Ctrl+G — Group / ungroupNode
 * - R1518: Ctrl+Up/Down — reorderInParent
 * - R1650: 붙여넣기 위치 오프셋 (p.x + 20)
 * - R1657: [ ] 키 — findSiblings / e.key === '['
 * - R1658: Escape → parentMap.has(selectedNode
 * - R1688: Ctrl+A — 씬 전체 노드 다중 선택 / collectAll
 * - R2320: cross-scene paste — cc-node-clipboard
 */
export function useKeyboardShortcuts({
  sceneFile, saveScene, canUndo, canRedo, undo, redo,
  selectedNode, onSelectNode, handleSave, nodeOps,
  setMultiSelectedUuids, parentMap, nodeMap, clipboardRef,
  nodeBookmarks, setNodeBookmarks, setJsonCopiedName,
}: UseKeyboardShortcutsProps) {
  // 키보드 단축키: Ctrl+Z/Y, Delete, Ctrl+D, Arrow keys
  useEffect(() => {
    if (!sceneFile) return
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (ctrl && e.key === 's') { e.preventDefault(); handleSave(); return }
      if (ctrl && e.key === 'z' && canUndo) { e.preventDefault(); undo(); return }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedo) { e.preventDefault(); redo(); return }
      // R1658: Escape → 부모 노드 선택 (루트에서는 선택 해제)
      if (e.key === 'Escape' && !isInput) {
        if (selectedNode && parentMap.has(selectedNode.uuid)) {
          const parentUuid = parentMap.get(selectedNode.uuid)!
          onSelectNode(nodeMap.get(parentUuid) ?? null)
        } else {
          onSelectNode(null)
        }
        return
      }
      if (isInput) return

      // Ctrl+C: 선택 노드 클립보드 복사
      // R2320: cross-scene paste — localStorage에도 직렬화 저장 (cc-node-clipboard)
      if (ctrl && e.key === 'c' && selectedNode) {
        e.preventDefault()
        clipboardRef.current = selectedNode
        try { localStorage.setItem('cc-node-clipboard', JSON.stringify(selectedNode)) } catch {}
        if (e.shiftKey) {
          const json = JSON.stringify(selectedNode, null, 2)
          navigator.clipboard.writeText(json).catch(() => {})
          setJsonCopiedName(selectedNode.name || selectedNode.uuid.slice(0, 8))
          setTimeout(() => setJsonCopiedName(null), 2000)
        }
        return
      }
      // Ctrl+V: 클립보드 노드 붙여넣기 — R2320: clipboardRef 없으면 localStorage 복원
      if (ctrl && e.key === 'v' && sceneFile?.root) {
        if (!clipboardRef.current) {
          try {
            const raw = localStorage.getItem('cc-node-clipboard')
            if (raw) clipboardRef.current = JSON.parse(raw) as CCSceneNode
          } catch {}
        }
      }
      if (ctrl && e.key === 'v' && clipboardRef.current && sceneFile?.root) {
        e.preventDefault()
        const srcNode = clipboardRef.current
        const { deepCopyNodeWithNewUuids } = await import('../cocos-utils')
        const pasteNode = deepCopyNodeWithNewUuids(srcNode, '_Paste')
        // R1650: 붙여넣기 위치 오프셋 적용 (원본과 겹치지 않도록)
        if (pasteNode.position) {
          const p = pasteNode.position as { x: number; y: number; z?: number }
          pasteNode.position = { ...p, x: p.x + 20, y: p.y - 20 }
        }
        const parentUuid = selectedNode?.uuid ?? sceneFile.root.uuid
        function addToParent(n: CCSceneNode): CCSceneNode {
          if (n.uuid === parentUuid) return { ...n, children: [...n.children, pasteNode] }
          return { ...n, children: n.children.map(addToParent) }
        }
        try { await saveScene(addToParent(sceneFile.root)) } catch { /* ignore */ }
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && sceneFile.root?.uuid !== selectedNode.uuid) {
        e.preventDefault()
        nodeOps.handleTreeDelete(selectedNode.uuid)
        return
      }
      // R1688: Ctrl+A — 씬 전체 노드 다중 선택
      if (ctrl && e.key === 'a' && !e.shiftKey && sceneFile.root) {
        e.preventDefault()
        const all: string[] = []
        function collectAll(n: CCSceneNode) { all.push(n.uuid); n.children.forEach(collectAll) }
        sceneFile.root.children.forEach(collectAll)
        setMultiSelectedUuids(all)
        return
      }
      if (ctrl && e.key === 'd' && selectedNode) {
        e.preventDefault()
        nodeOps.handleTreeDuplicate(selectedNode.uuid)
        return
      }
      // R1399: Ctrl+G — 선택 노드를 새 "Group" 부모로 그룹화
      if (ctrl && e.key === 'g' && !e.shiftKey && selectedNode && sceneFile.root && sceneFile._raw) {
        e.preventDefault()
        const raw = sceneFile._raw as Record<string, unknown>[]
        const version = sceneFile.projectInfo.version ?? '2x'
        const groupId = 'group-' + Date.now()
        const groupIdx = raw.length
        const pos = selectedNode.position as { x: number; y: number; z: number }
        const groupRaw: Record<string, unknown> = version === '3x' ? {
          __type__: 'cc.Node', _id: groupId, _name: 'Group', _active: true,
          _children: [], _components: [],
          _lpos: { x: pos.x, y: pos.y, z: pos.z }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
          _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
          _uiProps: { _localOpacity: 1 },
        } : {
          __type__: 'cc.Node', _id: groupId, _name: 'Group', _active: true,
          _children: [], _components: [],
          _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [pos.x, pos.y, pos.z, 0, 0, 0, 1, 1, 1, 1] },
          _contentSize: { width: 0, height: 0 }, _anchorPoint: { x: 0.5, y: 0.5 },
          _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
        }
        raw.push(groupRaw)
        const childNode: CCSceneNode = { ...selectedNode, position: { x: 0, y: 0, z: pos.z } }
        const groupNode: CCSceneNode = {
          uuid: groupId, name: 'Group', active: true,
          position: pos,
          rotation: version === '3x' ? { x: 0, y: 0, z: 0 } : 0,
          scale: { x: 1, y: 1, z: 1 }, size: { x: 0, y: 0 }, anchor: { x: 0.5, y: 0.5 },
          opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 },
          components: [], children: [childNode], _rawIndex: groupIdx,
        }
        function wrapNode(n: CCSceneNode): CCSceneNode {
          const newChildren = n.children.map(c => {
            if (c.uuid === selectedNode!.uuid) return groupNode
            return wrapNode(c)
          })
          return { ...n, children: newChildren }
        }
        const result = await saveScene(wrapNode(sceneFile.root))
        if (result.success) onSelectNode(groupNode)
        else raw.pop()
        return
      }
      // R1399: Ctrl+Shift+G — 그룹 해제 (자식을 부모로 올리고 빈 부모 삭제)
      if (ctrl && e.key === 'G' && e.shiftKey && selectedNode && sceneFile.root && selectedNode.children.length > 0) {
        e.preventDefault()
        const ungroupUuid = selectedNode.uuid
        const parentPos = selectedNode.position as { x: number; y: number; z: number }
        const promotedChildren = selectedNode.children.map(child => {
          const cp = child.position as { x: number; y: number; z: number }
          return { ...child, position: { x: cp.x + parentPos.x, y: cp.y + parentPos.y, z: cp.z + parentPos.z } }
        })
        function ungroupNode(n: CCSceneNode): CCSceneNode {
          const idx = n.children.findIndex(c => c.uuid === ungroupUuid)
          if (idx >= 0) {
            const newChildren = [...n.children]
            newChildren.splice(idx, 1, ...promotedChildren)
            return { ...n, children: newChildren }
          }
          return { ...n, children: n.children.map(ungroupNode) }
        }
        const result = await saveScene(ungroupNode(sceneFile.root))
        if (result.success && promotedChildren.length > 0) onSelectNode(promotedChildren[0])
        return
      }
      // R1518: Ctrl+Up/Down — 형제 노드 순서 변경
      if (ctrl && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedNode && sceneFile.root) {
        e.preventDefault()
        const dir = e.key === 'ArrowUp' ? -1 : 1
        function reorderInParent(n: CCSceneNode): CCSceneNode {
          const idx = n.children.findIndex(c => c.uuid === selectedNode!.uuid)
          if (idx >= 0) {
            const newIdx = idx + dir
            if (newIdx < 0 || newIdx >= n.children.length) return n
            const ch = [...n.children]
            const [moved] = ch.splice(idx, 1)
            ch.splice(newIdx, 0, moved)
            return { ...n, children: ch }
          }
          return { ...n, children: n.children.map(reorderInParent) }
        }
        saveScene(reorderInParent(sceneFile.root))
        return
      }
      // Arrow keys: 선택 노드 1px 이동
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selectedNode && sceneFile.root) {
        e.preventDefault()
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
        const dy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
        const step = e.shiftKey ? 10 : 1
        const pos = selectedNode.position as { x: number; y: number; z: number }
        function moveNode(n: CCSceneNode): CCSceneNode {
          if (n.uuid === selectedNode!.uuid) {
            return { ...n, position: { ...pos, x: pos.x + dx * step, y: pos.y + dy * step } }
          }
          return { ...n, children: n.children.map(moveNode) }
        }
        saveScene(moveNode(sceneFile.root))
        return
      }
      // R1657: [ / ] 키 — 형제 노드 순환 선택
      if ((e.key === '[' || e.key === ']') && selectedNode && sceneFile.root && !isInput) {
        e.preventDefault()
        function findSiblings(n: CCSceneNode): CCSceneNode[] | null {
          const idx = n.children.findIndex(c => c.uuid === selectedNode!.uuid)
          if (idx >= 0) return n.children
          for (const child of n.children) {
            const found = findSiblings(child)
            if (found) return found
          }
          return null
        }
        const siblings = findSiblings(sceneFile.root)
        if (siblings && siblings.length > 1) {
          const idx = siblings.findIndex(c => c.uuid === selectedNode.uuid)
          const next = e.key === ']' ? siblings[(idx + 1) % siblings.length] : siblings[(idx - 1 + siblings.length) % siblings.length]
          onSelectNode(next)
        }
        return
      }
      // R1672: Ctrl+1-9 → 북마크 설정, 1-9 → 북마크 이동
      if (!isInput && /^[1-9]$/.test(e.key)) {
        if (ctrl && selectedNode) {
          e.preventDefault()
          setNodeBookmarks(prev => ({ ...prev, [e.key]: selectedNode.uuid }))
        } else if (!ctrl && nodeBookmarks[e.key]) {
          e.preventDefault()
          const uuid = nodeBookmarks[e.key]
          const found = nodeMap.get(uuid)
          if (found) onSelectNode(found)
        }
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sceneFile, canUndo, canRedo, undo, redo, selectedNode, nodeOps.handleTreeDelete, nodeOps.handleTreeDuplicate, saveScene, handleSave, onSelectNode, parentMap, nodeMap, nodeBookmarks, setMultiSelectedUuids, clipboardRef, setJsonCopiedName, setNodeBookmarks])

  // R1430: Ctrl+F 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        nodeOps.setGlobalSearchOpen(true)
        setTimeout(() => nodeOps.globalSearchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape' && nodeOps.globalSearchOpen) {
        nodeOps.setGlobalSearchOpen(false)
        nodeOps.setGlobalSearchQuery('')
        nodeOps.setGlobalSearchResults([])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nodeOps.globalSearchOpen])
}
