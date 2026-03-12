import { useEffect, useRef, useCallback } from 'react'
import { useSceneStore } from './sceneViewStore'
import type { SceneNode } from './sceneTypes'

interface UseSyncOptions {
  port: number
  enabled: boolean        // connected === true 일 때만 활성화
  pollInterval?: number   // ms, default 2000
}

/** API 응답 → SceneNode 정규화 */
function normalizeNode(raw: any, parentUuid: string | null): SceneNode {
  return {
    uuid: raw.uuid,
    name: raw.name ?? '',
    active: raw.active ?? true,
    position: { x: raw.x ?? 0, y: raw.y ?? 0 },
    size: { w: raw.width ?? 100, h: raw.height ?? 100 },
    anchor: { x: raw.anchorX ?? 0.5, y: raw.anchorY ?? 0.5 },
    scale: { x: raw.scaleX ?? 1, y: raw.scaleY ?? 1 },
    rotation: raw.rotation ?? 0,
    opacity: raw.opacity ?? 255,
    color: raw.color ?? '#ffffff',
    components: raw.components ?? [],
    parentUuid,
    childUuids: (raw.children ?? []).map((c: any) => c.uuid),
    _dirty: false,
    _worldPos: { x: raw.x ?? 0, y: raw.y ?? 0 },
    _worldRot: raw.rotation ?? 0,
    _worldScaleX: raw.scaleX ?? 1,
    _worldScaleY: raw.scaleY ?? 1,
  }
}

/** 트리를 순회하며 월드 좌표 계산 */
function computeWorldTransforms(
  nodes: Record<string, SceneNode>,
  rootUuids: string[]
): void {
  function traverse(uuid: string, parentWorld: { x: number; y: number; rot: number; sx: number; sy: number }) {
    const n = nodes[uuid]
    if (!n) return
    n._worldPos = {
      x: parentWorld.x + n.position.x * parentWorld.sx,
      y: parentWorld.y + n.position.y * parentWorld.sy,
    }
    n._worldRot = parentWorld.rot + n.rotation
    n._worldScaleX = parentWorld.sx * n.scale.x
    n._worldScaleY = parentWorld.sy * n.scale.y
    for (const childUuid of n.childUuids) {
      traverse(childUuid, {
        x: n._worldPos.x,
        y: n._worldPos.y,
        rot: n._worldRot,
        sx: n._worldScaleX,
        sy: n._worldScaleY,
      })
    }
  }
  for (const uuid of rootUuids) {
    traverse(uuid, { x: 0, y: 0, rot: 0, sx: 1, sy: 1 })
  }
}

/** 트리 배열을 Record로 flatten */
function flattenTree(
  nodes: any[],
  parentUuid: string | null,
  out: Record<string, SceneNode>
): void {
  for (const raw of nodes) {
    const node = normalizeNode(raw, parentUuid)
    out[node.uuid] = node
    if (raw.children?.length) {
      flattenTree(raw.children, node.uuid, out)
    }
  }
}

export function useSceneSync({ port, enabled, pollInterval = 2000 }: UseSyncOptions) {
  const { setNodes, setSyncError, selectNode, setCanvas } = useSceneStore()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchScene = useCallback(async () => {
    if (!mountedRef.current || !enabled) return
    try {
      const base = `http://localhost:${port}`
      const res = await fetch(`${base}/scene/tree`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // flatten + 월드 좌표 계산
      const nodeMap: Record<string, SceneNode> = {}
      const roots: any[] = Array.isArray(data) ? data : data.children ?? [data]
      flattenTree(roots, null, nodeMap)
      const rootUuids = roots.map((r: any) => r.uuid)
      computeWorldTransforms(nodeMap, rootUuids)

      if (!mountedRef.current) return
      setNodes(nodeMap, rootUuids)

      // canvas info (Track A에서 추가된 엔드포인트)
      try {
        const cr = await fetch(`${base}/canvas`)
        if (cr.ok) {
          const ci = await cr.json()
          if (mountedRef.current) setCanvas(ci)
        }
      } catch { /* 미구현 버전 무시 */ }

    } catch (e) {
      if (mountedRef.current) setSyncError(String(e))
    }
  }, [port, enabled, setNodes, setSyncError, setCanvas])

  // 폴링 루프
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const loop = async () => {
      while (!cancelled && mountedRef.current) {
        await fetchScene()
        await new Promise(r => setTimeout(r, pollInterval))
      }
    }
    loop()

    // WS 이벤트: node:select → 스토어 selectNode
    const unsub = window.api.onCCEvent?.((event) => {
      if (cancelled) return
      if (event.type === 'node:select' && event.uuids?.[0]) {
        selectNode(event.uuids[0])
      }
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [enabled, port, fetchScene, selectNode, pollInterval])
}
