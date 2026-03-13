import { useState, useEffect, useCallback, useRef } from 'react'
import type { CCNode } from '../../../shared/ipc-schema'

export interface CCContext {
  connected: boolean
  port: number
  sceneTree: CCNode | null
  selectedNode: CCNode | null
  contextString: string
}

function nodeToContextString(node: CCNode, depth = 0): string {
  const indent = '  '.repeat(depth)
  const components = (node.components ?? []).map(c => c.type.replace('cc.', '')).join(', ')
  let line = `${indent}├── ${node.name ?? '?'}`
  if (components) line += ` [${components}]`
  if (node.position) line += ` (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`
  if (!node.active) line += ' [inactive]'
  const children = (node.children ?? []).map(c => nodeToContextString(c, depth + 1)).join('\n')
  return children ? `${line}\n${children}` : line
}

export function useCCContext(): CCContext {
  const [connected, setConnected] = useState(false)
  const [port, setPort] = useState(9090)
  const portRef = useRef(9090)
  const [sceneTree, setSceneTree] = useState<CCNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<CCNode | null>(null)

  const updatePort = useCallback((p: number) => {
    portRef.current = p
    setPort(p)
  }, [])

  const refreshTree = useCallback(async () => {
    try {
      const tree = await window.api.ccGetTree?.(portRef.current)
      setSceneTree((tree as CCNode) ?? null)
    } catch {}
  }, [])

  useEffect(() => {
    window.api.ccGetPort?.().then(p => {
      if (p) updatePort(p)
      window.api.ccStatus?.().then(s => {
        if (s?.connected) { setConnected(true); refreshTree() }
      }).catch(() => {})
    }).catch(() => {
      window.api.ccStatus?.().then(s => {
        if (s?.connected) { setConnected(true); refreshTree() }
      }).catch(() => {})
    })

    const unsubStatus = window.api.onCCStatusChange?.((s) => {
      setConnected(s.connected)
      if (s.connected) {
        window.api.ccGetPort?.().then(p => { if (p) updatePort(p) }).catch(() => {})
        refreshTree()
      } else { setSceneTree(null); setSelectedNode(null) }
    })

    const unsubEvent = window.api.onCCEvent?.((event) => {
      if (event.type === 'scene:ready' || event.type === 'scene:saved') refreshTree()
      if (event.type === 'node:select' && event.uuids?.[0]) {
        window.api.ccGetNode?.(portRef.current, event.uuids[0])
          .then(n => setSelectedNode((n as CCNode) ?? null))
          .catch(() => {})
      }
      if (event.type === 'node:deselect') setSelectedNode(null)
    })

    return () => { unsubStatus?.(); unsubEvent?.() }
  }, [refreshTree, updatePort])

  const ccActionGuide = connected ? `
## CC Scene Edit Actions
씬 노드를 수정하려면 \`\`\`cc-action 블록을 사용하세요:
\`\`\`cc-action
{"type":"moveNode","uuid":"<node-uuid>","x":<x>,"y":<y>}
\`\`\`
지원 액션: moveNode(x,y), setProperty(key,value), setActive(active), createNode(parentUuid,nodeName), deleteNode(uuid), refreshTree` : ''

  const contextString = connected && sceneTree
    ? [
        '## Current Cocos Creator Scene',
        `Scene Root: ${sceneTree.name}`,
        nodeToContextString(sceneTree),
        selectedNode
          ? `\nSelected Node: ${selectedNode.name} (uuid: ${selectedNode.uuid})${selectedNode.position ? `\n  position: (${Math.round(selectedNode.position.x)}, ${Math.round(selectedNode.position.y)})` : ''}${selectedNode.size ? `\n  size: ${Math.round(selectedNode.size.width)}x${Math.round(selectedNode.size.height)}` : ''}\n  opacity: ${selectedNode.opacity ?? 255}`
          : '',
        ccActionGuide,
      ].filter(Boolean).join('\n')
    : ''

  return { connected, port, sceneTree, selectedNode, contextString }
}
