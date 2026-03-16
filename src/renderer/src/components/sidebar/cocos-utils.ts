import type { CCSceneNode } from '@shared/ipc-schema'

// R1418: 씬 유효성 검사 (Lint)
export interface ValidationIssue {
  level: 'error' | 'warning'
  message: string
  nodeUuid?: string
  nodeName?: string
}

/**
 * Validates a Cocos Creator scene for common issues
 * - UUID duplicates
 * - Empty node names
 * - Inactive parents with active children
 * - Deep hierarchy (> 8 levels)
 * - Missing Canvas component (CC 2.x)
 */
export function validateScene(root: CCSceneNode): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seenUuids = new Map<string, string>() // uuid → name
  let hasCanvas = false

  function walk(node: CCSceneNode, depth: number, parentActive: boolean): void {
    // UUID 중복 체크
    if (seenUuids.has(node.uuid)) {
      issues.push({ level: 'error', message: `UUID 중복: "${node.name}" 와 "${seenUuids.get(node.uuid)}" (${node.uuid.slice(0, 8)}...)`, nodeUuid: node.uuid, nodeName: node.name })
    } else {
      seenUuids.set(node.uuid, node.name)
    }

    // 이름 빈 노드
    if (node.name === '') {
      issues.push({ level: 'warning', message: `이름 빈 노드 (uuid: ${node.uuid.slice(0, 8)}...)`, nodeUuid: node.uuid, nodeName: '(empty)' })
    }

    // Canvas 감지
    if (node.components.some(c => c.type === 'cc.Canvas')) hasCanvas = true

    // 비활성 부모 아래 활성 자식
    if (!parentActive && node.active) {
      issues.push({ level: 'warning', message: `비활성 부모 아래 활성 자식: "${node.name}"`, nodeUuid: node.uuid, nodeName: node.name })
    }

    // 깊이 경고
    if (depth > 8) {
      issues.push({ level: 'warning', message: `계층 깊이 ${depth}: "${node.name}" (8 초과)`, nodeUuid: node.uuid, nodeName: node.name })
    }

    for (const child of node.children) {
      walk(child, depth + 1, node.active)
    }
  }

  walk(root, 0, true)

  // Canvas 없는 씬 경고 (루트가 Scene인 경우)
  if (!hasCanvas && root.children.length > 0) {
    issues.push({ level: 'warning', message: 'Canvas 컴포넌트가 없는 씬 (CC 2.x에서 UI가 표시되지 않을 수 있음)' })
  }

  return issues
}

/**
 * R2463: 선택 노드 서브트리를 prefab raw 배열로 변환
 * Extracts a node and its entire subtree from a raw CC file array
 * Returns a new raw array formatted as a Prefab with remapped references
 */
export function extractPrefabEntries(raw: unknown[], rootRawIdx: number): unknown[] {
  const rawArr = raw as Record<string, unknown>[]
  const collected: number[] = []
  const seen = new Set<number>()

  function collectDfs(idx: number) {
    if (idx < 0 || idx >= rawArr.length || seen.has(idx)) return
    seen.add(idx)
    collected.push(idx)
    const e = rawArr[idx]
    // components 먼저 수집
    const comps = e._components as { __id__: number }[] | undefined
    comps?.forEach(c => { if (typeof c.__id__ === 'number') collectDfs(c.__id__) })
    // children 수집
    const children = e._children as { __id__: number }[] | undefined
    children?.forEach(c => { if (typeof c.__id__ === 'number') collectDfs(c.__id__) })
  }
  collectDfs(rootRawIdx)

  // oldIdx → newIdx 매핑 (0=cc.Prefab, 1=root, ...)
  const oldToNew = new Map<number, number>()
  collected.forEach((oldIdx, i) => oldToNew.set(oldIdx, i + 1))

  // __id__ 재매핑 (deep)
  function remapRefs(v: unknown, isRoot: boolean): unknown {
    if (Array.isArray(v)) return v.map(el => remapRefs(el, false))
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      if ('__id__' in obj && typeof obj.__id__ === 'number') {
        const mapped = oldToNew.get(obj.__id__)
        return mapped != null ? { __id__: mapped } : { __id__: obj.__id__ }
      }
      const result: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(obj)) {
        result[k] = (isRoot && k === '_parent') ? null : remapRefs(val, false)
      }
      return result
    }
    return v
  }

  const prefabHeader = {
    __type__: 'cc.Prefab', _name: '', _objFlags: 0,
    data: { __id__: 1 }, optimizationPolicy: 0, asyncLoadAssets: false, readonly: false,
  }
  const nodeEntries = collected.map((oldIdx, i) =>
    remapRefs(JSON.parse(JSON.stringify(rawArr[oldIdx])), i === 0) as unknown
  )
  return [prefabHeader, ...nodeEntries]
}

/**
 * R1476: 노드 딥복사 + UUID 자동 재생성 (재귀, crypto.randomUUID)
 * Creates a deep copy of a CCSceneNode with new UUIDs and optional name suffix
 */
export function deepCopyNodeWithNewUuids(node: CCSceneNode, suffix = '_Copy'): CCSceneNode {
  const genUuid = () => (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  function deepCopy(n: CCSceneNode, isToplevel: boolean): CCSceneNode {
    return {
      ...n,
      uuid: genUuid(),
      name: isToplevel ? n.name + suffix : n.name,
      // R2460: _rawIndex 초기화 — 복제 노드의 컴포넌트는 새 raw 엔트리로 생성 (R2459 _components 동기화와 충돌 방지)
      components: n.components.map(c => ({ ...c, props: { ...c.props }, _rawIndex: undefined })),
      children: n.children.map(c => deepCopy(c, false)),
      _rawIndex: undefined,
    }
  }
  return deepCopy(node, true)
}
