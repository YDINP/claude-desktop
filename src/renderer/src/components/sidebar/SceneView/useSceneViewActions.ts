import { useCallback } from 'react'
import type { SceneNode, ClipboardEntry } from './types'
import { cocosToSvg } from './utils'
import { PNG_BG_COLORS } from './sceneViewConstants'

interface ActionDeps {
  nodeMap: Map<string, SceneNode>
  selectedUuid: string | null
  selectedUuids: Set<string>
  rootUuid: string | null
  port: number
  DESIGN_W: number
  DESIGN_H: number
  clipboard: ClipboardEntry[]
  svgRef: React.RefObject<SVGSVGElement>
  pngExportScale: 1 | 2 | 4
  pngExportBg: 'dark' | 'light' | 'transparent'

  setSelectedUuid: (uuid: string | null) => void
  setSelectedUuidsReplace: (s: Set<string>) => void
  setClipboard: (v: ClipboardEntry[]) => void
  setCopiedNode: (v: SceneNode | null) => void
  setScreenshotDone: (v: boolean) => void

  updateNode: (uuid: string, partial: Partial<SceneNode>) => void
  refresh: () => Promise<void>
}

export function useSceneViewActions(deps: ActionDeps) {
  const {
    nodeMap, selectedUuid, selectedUuids, rootUuid, port,
    DESIGN_W, DESIGN_H, clipboard, svgRef, pngExportScale, pngExportBg,
    setSelectedUuid, setSelectedUuidsReplace, setClipboard, setCopiedNode, setScreenshotDone,
    updateNode, refresh,
  } = deps

  // ── deep clone ────────────────────────────────────────────
  const deepCloneNode = useCallback((node: SceneNode, offset = 20): SceneNode => {
    const newUuid = node.uuid + '-clone-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
    const clonedChildren = node.childUuids.map(cid => {
      const child = nodeMap.get(cid)
      return child ? deepCloneNode(child, 0).uuid : cid
    })
    return {
      ...node, uuid: newUuid, name: node.name + '_Copy',
      x: (node.x ?? 0) + offset, y: (node.y ?? 0) + offset, childUuids: clonedChildren,
    }
  }, [nodeMap])

  // ── copy / paste ──────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const uuids = selectedUuids.size > 0 ? selectedUuids : (selectedUuid ? new Set([selectedUuid]) : new Set<string>())
    const copied: ClipboardEntry[] = []
    uuids.forEach(uuid => {
      const n = nodeMap.get(uuid)
      if (n) copied.push({ uuid: n.uuid, name: n.name, x: n.x ?? 0, y: n.y ?? 0 })
    })
    if (copied.length > 0) {
      setClipboard(copied)
      const primaryUuid = [...uuids][0]
      const primaryNode = primaryUuid ? nodeMap.get(primaryUuid) ?? null : null
      setCopiedNode(primaryNode ? { ...primaryNode } : null)
    }
  }, [selectedUuids, selectedUuid, nodeMap])

  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return
    const newNodes: SceneNode[] = []
    clipboard.forEach(entry => {
      const orig = nodeMap.get(entry.uuid)
      if (orig) {
        const cloned = deepCloneNode(orig, 20)
        newNodes.push(cloned)
        const registerChildren = (parentNode: SceneNode) => {
          parentNode.childUuids.forEach(cid => {
            const child = nodeMap.get(cid)
            if (child) {
              const clonedChild = deepCloneNode(child, 0)
              updateNode(clonedChild.uuid, clonedChild)
              registerChildren(clonedChild)
            }
          })
        }
        registerChildren(orig)
      }
    })
    if (newNodes.length > 0) newNodes.forEach(n => updateNode(n.uuid, n))
  }, [clipboard, nodeMap, updateNode, deepCloneNode])

  const handleDuplicate = useCallback(() => {
    const uuids = selectedUuids.size > 0 ? [...selectedUuids] : (selectedUuid ? [selectedUuid] : [])
    uuids.forEach((uuid) => {
      const orig = nodeMap.get(uuid)
      if (!orig) return
      const cloned = deepCloneNode(orig, 20)
      updateNode(cloned.uuid, cloned)
    })
  }, [selectedUuids, selectedUuid, nodeMap, updateNode, deepCloneNode])

  // ── 그룹화 / 해제 ────────────────────────────────────────
  const handleGroup = useCallback(() => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(u => nodeMap.get(u)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return
    const parentUuids = new Set(nodes.map(n => n.parentUuid))
    const commonParentUuid = parentUuids.size === 1 ? [...parentUuids][0] : rootUuid
    if (!commonParentUuid) return
    const parent = nodeMap.get(commonParentUuid)
    if (!parent) return
    const xs = nodes.map(n => n.x ?? 0); const ys = nodes.map(n => n.y ?? 0)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const groupUuid = 'group-' + Date.now()
    const childUuids = nodes.map(n => n.uuid)
    updateNode(groupUuid, {
      uuid: groupUuid, name: 'Group', active: true,
      x: cx, y: cy, width: 0, height: 0,
      anchorX: 0.5, anchorY: 0.5, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1,
      color: { r: 255, g: 255, b: 255, a: 255 },
      parentUuid: commonParentUuid, childUuids, components: [],
    })
    const newParentChildren = parent.childUuids.filter(u => !selectedUuids.has(u)).concat(groupUuid)
    updateNode(commonParentUuid, { childUuids: newParentChildren })
    nodes.forEach(n => updateNode(n.uuid, { parentUuid: groupUuid }))
    setSelectedUuid(groupUuid)
    setSelectedUuidsReplace(new Set([groupUuid]))
  }, [selectedUuids, nodeMap, rootUuid, updateNode])

  const handleUngroup = useCallback(() => {
    if (!selectedUuid) return
    const group = nodeMap.get(selectedUuid)
    if (!group || group.childUuids.length === 0) return
    const grandParentUuid = group.parentUuid
    if (!grandParentUuid) return
    const grandParent = nodeMap.get(grandParentUuid)
    if (!grandParent) return
    const newGrandChildren = grandParent.childUuids.filter(u => u !== selectedUuid).concat(group.childUuids)
    updateNode(grandParentUuid, { childUuids: newGrandChildren })
    group.childUuids.forEach(u => updateNode(u, { parentUuid: grandParentUuid }))
    updateNode(selectedUuid, { active: false, childUuids: [] })
    setSelectedUuidsReplace(new Set(group.childUuids))
    setSelectedUuid(group.childUuids[0] ?? null)
  }, [selectedUuid, nodeMap, updateNode])

  // ── CRUD ──────────────────────────────────────────────────
  const handleCreateNode = useCallback(async () => {
    try { await window.api.ccCreateNode?.(port, 'NewNode', selectedUuid ?? undefined); refresh() }
    catch (e) { console.error('[SceneView] createNode failed:', e) }
  }, [port, selectedUuid, refresh])

  const handleDeleteNode = useCallback(async () => {
    if (!selectedUuid) return
    try { await window.api.ccDeleteNode?.(port, selectedUuid); setSelectedUuid(null); refresh() }
    catch (e) { console.error('[SceneView] deleteNode failed:', e) }
  }, [port, selectedUuid, refresh])

  // ── z-order ───────────────────────────────────────────────
  const handleZOrder = useCallback(async (direction: 'front' | 'back' | 'up' | 'down') => {
    if (selectedUuids.size !== 1) return
    const uuid = [...selectedUuids][0]
    try { await window.api.ccSetZOrder?.(port, uuid, direction); refresh() }
    catch (e) { console.error('[SceneView] zorder failed:', e) }
  }, [selectedUuids, port, refresh])

  // ── 정렬 ─────────────────────────────────────────────────
  const handleAlign = useCallback(async (direction: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return
    const positions: Record<string, { x: number; y: number }> = {}
    if (direction === 'left') {
      const minLeft = Math.min(...nodes.map(n => n.x - n.width * (n.anchorX ?? 0.5)))
      for (const n of nodes) positions[n.uuid] = { x: minLeft + n.width * (n.anchorX ?? 0.5), y: n.y }
    } else if (direction === 'right') {
      const maxRight = Math.max(...nodes.map(n => n.x + n.width * (1 - (n.anchorX ?? 0.5))))
      for (const n of nodes) positions[n.uuid] = { x: maxRight - n.width * (1 - (n.anchorX ?? 0.5)), y: n.y }
    } else if (direction === 'centerH') {
      const minLeft = Math.min(...nodes.map(n => n.x - n.width * (n.anchorX ?? 0.5)))
      const maxRight = Math.max(...nodes.map(n => n.x + n.width * (1 - (n.anchorX ?? 0.5))))
      const bboxCx = (minLeft + maxRight) / 2
      for (const n of nodes) positions[n.uuid] = { x: bboxCx, y: n.y }
    } else if (direction === 'top') {
      const maxTop = Math.max(...nodes.map(n => n.y + n.height * (1 - (n.anchorY ?? 0.5))))
      for (const n of nodes) positions[n.uuid] = { x: n.x, y: maxTop - n.height * (1 - (n.anchorY ?? 0.5)) }
    } else if (direction === 'bottom') {
      const minBottom = Math.min(...nodes.map(n => n.y - n.height * (n.anchorY ?? 0.5)))
      for (const n of nodes) positions[n.uuid] = { x: n.x, y: minBottom + n.height * (n.anchorY ?? 0.5) }
    } else if (direction === 'centerV') {
      const maxTop = Math.max(...nodes.map(n => n.y + n.height * (1 - (n.anchorY ?? 0.5))))
      const minBottom = Math.min(...nodes.map(n => n.y - n.height * (n.anchorY ?? 0.5)))
      const bboxCy = (minBottom + maxTop) / 2
      for (const n of nodes) positions[n.uuid] = { x: n.x, y: bboxCy }
    }
    for (const [uid, { x, y }] of Object.entries(positions)) {
      updateNode(uid, { x, y })
      try { await window.api.ccSetProperty?.(port, uid, 'x', x); await window.api.ccSetProperty?.(port, uid, 'y', y) }
      catch (e) { console.error('[SceneView] align failed:', e) }
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  // ── 분배/레이아웃 — 크기 맞추기(W/H/both) ────────────────────
  const handleMatchSize = useCallback(async (dim: 'W' | 'H' | 'both') => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return
    const ref = nodes[0]
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i]
      if (dim === 'W' || dim === 'both') { updateNode(n.uuid, { width: ref.width }); try { await window.api.ccSetProperty?.(port, n.uuid, 'width', ref.width) } catch (_) {} }
      if (dim === 'H' || dim === 'both') { updateNode(n.uuid, { height: ref.height }); try { await window.api.ccSetProperty?.(port, n.uuid, 'height', ref.height) } catch (_) {} }
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  const handleDistribute = useCallback(async (axis: 'H' | 'V') => {
    if (selectedUuids.size < 3) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 3) return
    if (axis === 'H') {
      const sorted = [...nodes].sort((a, b) => a.x - b.x)
      const step = (sorted[sorted.length - 1].x - sorted[0].x) / (sorted.length - 1)
      for (let i = 1; i < sorted.length - 1; i++) {
        const newX = sorted[0].x + step * i
        updateNode(sorted[i].uuid, { x: newX })
        try { await window.api.ccSetProperty?.(port, sorted[i].uuid, 'x', newX) } catch (_) {}
      }
    } else {
      const sorted = [...nodes].sort((a, b) => a.y - b.y)
      const step = (sorted[sorted.length - 1].y - sorted[0].y) / (sorted.length - 1)
      for (let i = 1; i < sorted.length - 1; i++) {
        const newY = sorted[0].y + step * i
        updateNode(sorted[i].uuid, { y: newY })
        try { await window.api.ccSetProperty?.(port, sorted[i].uuid, 'y', newY) } catch (_) {}
      }
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  const handleGridLayout = useCallback(async (gridGap = 20) => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return
    const cols = Math.ceil(Math.sqrt(nodes.length))
    const startX = Math.min(...nodes.map(n => n.x - n.width * (n.anchorX ?? 0.5)))
    const startY = Math.max(...nodes.map(n => n.y + n.height * (1 - (n.anchorY ?? 0.5))))
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]; const col = i % cols; const row = Math.floor(i / cols)
      const newX = startX + col * (n.width + gridGap) + n.width * (n.anchorX ?? 0.5)
      const newY = startY - row * (n.height + gridGap) - n.height * (1 - (n.anchorY ?? 0.5))
      updateNode(n.uuid, { x: newX, y: newY })
      try { await window.api.ccSetProperty?.(port, n.uuid, 'x', newX); await window.api.ccSetProperty?.(port, n.uuid, 'y', newY) }
      catch (e) { console.error('[SceneView] gridLayout failed:', e) }
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  const handleDistributeHEqual = useCallback(async () => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return
    const sorted = [...nodes].sort((a, b) => a.x - b.x)
    const step = nodes.length > 1 ? (sorted[sorted.length - 1].x - sorted[0].x) / (nodes.length - 1) : 0
    for (let i = 0; i < sorted.length; i++) {
      const newX = sorted[0].x + step * i
      updateNode(sorted[i].uuid, { x: newX })
      try { await window.api.ccSetProperty?.(port, sorted[i].uuid, 'x', newX) } catch (_) {}
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  const handleDistributeVEqual = useCallback(async () => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return
    const sorted = [...nodes].sort((a, b) => a.y - b.y)
    const step = nodes.length > 1 ? (sorted[sorted.length - 1].y - sorted[0].y) / (nodes.length - 1) : 0
    for (let i = 0; i < sorted.length; i++) {
      const newY = sorted[0].y + step * i
      updateNode(sorted[i].uuid, { y: newY })
      try { await window.api.ccSetProperty?.(port, sorted[i].uuid, 'y', newY) } catch (_) {}
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  const handleCircularLayout = useCallback(async () => {
    if (selectedUuids.size < 2) return
    const nodes = [...selectedUuids].map(uid => nodeMap.get(uid)).filter(Boolean) as SceneNode[]
    if (nodes.length < 2) return
    const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length
    const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length
    const radius = Math.max(80, nodes.length * 30)
    const angleStep = (2 * Math.PI) / nodes.length
    for (let i = 0; i < nodes.length; i++) {
      const angle = angleStep * i - Math.PI / 2
      const newX = cx + radius * Math.cos(angle); const newY = cy + radius * Math.sin(angle)
      updateNode(nodes[i].uuid, { x: newX, y: newY })
      try { await window.api.ccSetProperty?.(port, nodes[i].uuid, 'x', newX); await window.api.ccSetProperty?.(port, nodes[i].uuid, 'y', newY) } catch (_) {}
    }
  }, [selectedUuids, nodeMap, port, updateNode])

  // ── SVG 내보내기 ──────────────────────────────────────────
  const handleExportSvg = useCallback(() => {
    if (!svgRef.current) return
    const ns = 'http://www.w3.org/2000/svg'
    const exportSvg = document.createElementNS(ns, 'svg')
    exportSvg.setAttribute('xmlns', ns)
    exportSvg.setAttribute('width', String(DESIGN_W))
    exportSvg.setAttribute('height', String(DESIGN_H))
    exportSvg.setAttribute('viewBox', `${-DESIGN_W / 2} ${-DESIGN_H / 2} ${DESIGN_W} ${DESIGN_H}`)
    const bg = document.createElementNS(ns, 'rect')
    bg.setAttribute('x', String(-DESIGN_W / 2)); bg.setAttribute('y', String(-DESIGN_H / 2))
    bg.setAttribute('width', String(DESIGN_W)); bg.setAttribute('height', String(DESIGN_H))
    bg.setAttribute('fill', '#1a1a2e')
    exportSvg.appendChild(bg)
    nodeMap.forEach(n => {
      if (!n.active) return
      const rect = document.createElementNS(ns, 'rect')
      const hw = n.width / 2; const hh = n.height / 2
      const cx = n.x - DESIGN_W / 2; const cy = -(n.y - DESIGN_H / 2)
      rect.setAttribute('x', String(cx - hw)); rect.setAttribute('y', String(cy - hh))
      rect.setAttribute('width', String(n.width)); rect.setAttribute('height', String(n.height))
      const r = n.color.r; const g = n.color.g; const b = n.color.b; const a = (n.color.a / 255).toFixed(2)
      rect.setAttribute('fill', `rgba(${r},${g},${b},${a})`)
      rect.setAttribute('stroke', 'rgba(96,165,250,0.3)'); rect.setAttribute('stroke-width', '0.5')
      exportSvg.appendChild(rect)
      if (n.name) {
        const text = document.createElementNS(ns, 'text')
        text.setAttribute('x', String(cx)); text.setAttribute('y', String(cy + 4))
        text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '10')
        text.setAttribute('fill', 'rgba(255,255,255,0.6)'); text.setAttribute('font-family', 'sans-serif')
        text.textContent = n.name
        exportSvg.appendChild(text)
      }
    })
    const blob = new Blob([new XMLSerializer().serializeToString(exportSvg)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'scene.svg'; a.click()
    URL.revokeObjectURL(url)
  }, [svgRef, nodeMap, DESIGN_W, DESIGN_H])

  // ── PNG 내보내기 ──────────────────────────────────────────
  const handleExportPng = useCallback(async () => {
    if (!svgRef.current) return
    const scale = pngExportScale
    const bgFill = PNG_BG_COLORS[pngExportBg] ?? '#1a1a2e'
    const ns = 'http://www.w3.org/2000/svg'
    const exportSvg = document.createElementNS(ns, 'svg')
    exportSvg.setAttribute('xmlns', ns)
    exportSvg.setAttribute('width', String(DESIGN_W * scale))
    exportSvg.setAttribute('height', String(DESIGN_H * scale))
    exportSvg.setAttribute('viewBox', `${-DESIGN_W / 2} ${-DESIGN_H / 2} ${DESIGN_W} ${DESIGN_H}`)
    if (bgFill !== 'transparent') {
      const bg = document.createElementNS(ns, 'rect')
      bg.setAttribute('x', String(-DESIGN_W / 2)); bg.setAttribute('y', String(-DESIGN_H / 2))
      bg.setAttribute('width', String(DESIGN_W)); bg.setAttribute('height', String(DESIGN_H))
      bg.setAttribute('fill', bgFill)
      exportSvg.appendChild(bg)
    }
    nodeMap.forEach(n => {
      if (!n.active) return
      const rect = document.createElementNS(ns, 'rect')
      const hw = n.width / 2; const hh = n.height / 2
      const cx = n.x - DESIGN_W / 2; const cy = -(n.y - DESIGN_H / 2)
      rect.setAttribute('x', String(cx - hw)); rect.setAttribute('y', String(cy - hh))
      rect.setAttribute('width', String(n.width)); rect.setAttribute('height', String(n.height))
      const r = n.color.r; const g2 = n.color.g; const b = n.color.b; const a = (n.color.a / 255).toFixed(2)
      rect.setAttribute('fill', `rgba(${r},${g2},${b},${a})`)
      rect.setAttribute('stroke', 'rgba(96,165,250,0.3)'); rect.setAttribute('stroke-width', '0.5')
      exportSvg.appendChild(rect)
      if (n.name) {
        const text = document.createElementNS(ns, 'text')
        text.setAttribute('x', String(cx)); text.setAttribute('y', String(cy + 4))
        text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '10')
        text.setAttribute('fill', 'rgba(255,255,255,0.6)'); text.setAttribute('font-family', 'sans-serif')
        text.textContent = n.name
        exportSvg.appendChild(text)
      }
    })
    const svgStr = new XMLSerializer().serializeToString(exportSvg)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = DESIGN_W * scale; canvas.height = DESIGN_H * scale
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, DESIGN_W * scale, DESIGN_H * scale)
      URL.revokeObjectURL(svgUrl)
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `scene-${ts}.png`; a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = svgUrl
  }, [svgRef, nodeMap, DESIGN_W, DESIGN_H, pngExportScale, pngExportBg])

  // ── 스크린샷 ──────────────────────────────────────────────
  const handleScreenshot = useCallback(async () => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svgStr = new XMLSerializer().serializeToString(svgEl)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = svgEl.clientWidth || DESIGN_W
      canvas.height = svgEl.clientHeight || DESIGN_H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(svgUrl)
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `scene-${ts}.png`; a.click()
        URL.revokeObjectURL(url)
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]) } catch {}
        setScreenshotDone(true)
        setTimeout(() => setScreenshotDone(false), 1500)
      }, 'image/png')
    }
    img.src = svgUrl
  }, [svgRef, DESIGN_W, DESIGN_H])

  return {
    deepCloneNode,
    handleCopy, handlePaste, handleDuplicate,
    handleGroup, handleUngroup,
    handleCreateNode, handleDeleteNode,
    handleZOrder, handleAlign,
    handleMatchSize, handleDistribute, handleGridLayout,
    handleDistributeHEqual, handleDistributeVEqual, handleCircularLayout,
    handleExportSvg, handleExportPng, handleScreenshot,
  }
}
