import { useState, useEffect, useCallback } from 'react'
import type { CCNode } from '../../../shared/ipc-schema'

export interface CCContext {
  connected: boolean
  sceneTree: CCNode | null
  selectedNode: CCNode | null
  contextString: string
}

function nodeToContextString(node: CCNode, depth = 0): string {
  const indent = '  '.repeat(depth)
  const components = node.components.map(c => c.type.replace('cc.', '')).join(', ')
  let line = `${indent}├── ${node.name}`
  if (components) line += ` [${components}]`
  line += ` (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`
  if (!node.active) line += ' [inactive]'
  const children = node.children.map(c => nodeToContextString(c, depth + 1)).join('\n')
  return children ? `${line}\n${children}` : line
}

export function useCCContext(): CCContext {
  const [connected, setConnected] = useState(false)
  const [sceneTree, setSceneTree] = useState<CCNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<CCNode | null>(null)

  const refreshTree = useCallback(async () => {
    try {
      const tree = await window.api.ccGetTree?.()
      setSceneTree((tree as CCNode) ?? null)
    } catch {}
  }, [])

  useEffect(() => {
    window.api.ccStatus?.().then(s => {
      if (s?.connected) { setConnected(true); refreshTree() }
    }).catch(() => {})

    const unsubStatus = window.api.onCCStatusChange?.((s) => {
      setConnected(s.connected)
      if (s.connected) refreshTree()
      else { setSceneTree(null); setSelectedNode(null) }
    })

    const unsubEvent = window.api.onCCEvent?.((event) => {
      if (event.type === 'scene:ready' || event.type === 'scene:saved') refreshTree()
      if (event.type === 'node:select' && event.uuids?.[0]) {
        window.api.ccGetNode?.(event.uuids[0])
          .then(n => setSelectedNode((n as CCNode) ?? null))
          .catch(() => {})
      }
      if (event.type === 'node:deselect') setSelectedNode(null)
    })

    return () => { unsubStatus?.(); unsubEvent?.() }
  }, [refreshTree])

  const contextString = connected && sceneTree
    ? [
        '## Current Cocos Creator Scene',
        `Scene Root: ${sceneTree.name}`,
        nodeToContextString(sceneTree),
        selectedNode
          ? `\nSelected Node: ${selectedNode.name} (uuid: ${selectedNode.uuid})\n  position: (${Math.round(selectedNode.position.x)}, ${Math.round(selectedNode.position.y)})\n  size: ${Math.round(selectedNode.size.width)}x${Math.round(selectedNode.size.height)}\n  opacity: ${selectedNode.opacity}`
          : '',
      ].filter(Boolean).join('\n')
    : ''

  return { connected, sceneTree, selectedNode, contextString }
}
