/**
 * transform plugin 순수 로직 테스트
 * TransformPlugin 컴포넌트 내부 로직을 순수 함수로 재현하여 검증
 */
import { describe, it, expect } from 'vitest'
import type { CCSceneNode } from '../../../../../../shared/ipc-schema'

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return {
    uuid,
    name: uuid,
    active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [],
    children: [],
    ...overrides,
  }
}

// ── Z-Order 이동 로직 (moveZOrder 내부 patch 함수 재현) ─────────────────────

type ZDir = 'up' | 'down' | 'top' | 'bottom'

function applyZOrder(
  node: CCSceneNode,
  uuidSet: Set<string>,
  dir: ZDir
): CCSceneNode {
  const children = node.children.map(c => applyZOrder(c, uuidSet, dir))
  const selIdx = children.map((c, i) => uuidSet.has(c.uuid) ? i : -1).filter(i => i >= 0)
  if (selIdx.length === 0) return { ...node, children }
  const moved = [...children]
  if (dir === 'top') {
    const sel = selIdx.map(i => moved[i])
    const rest = moved.filter((_, i) => !selIdx.includes(i))
    return { ...node, children: [...rest, ...sel] }
  } else if (dir === 'bottom') {
    const sel = selIdx.map(i => moved[i])
    const rest = moved.filter((_, i) => !selIdx.includes(i))
    return { ...node, children: [...sel, ...rest] }
  } else if (dir === 'up') {
    for (let k = selIdx.length - 1; k >= 0; k--) {
      const i = selIdx[k]
      if (i < moved.length - 1 && !uuidSet.has(moved[i + 1].uuid)) {
        ;[moved[i], moved[i + 1]] = [moved[i + 1], moved[i]]
      }
    }
    return { ...node, children: moved }
  } else {
    for (let k = 0; k < selIdx.length; k++) {
      const i = selIdx[k]
      if (i > 0 && !uuidSet.has(moved[i - 1].uuid)) {
        ;[moved[i], moved[i - 1]] = [moved[i - 1], moved[i]]
      }
    }
    return { ...node, children: moved }
  }
}

// ── 앵커 보정 로직 (applyAnchor 내부 보정 재현) ───────────────────────────

function applyAnchorPatch(
  node: CCSceneNode,
  ax: number,
  ay: number,
  compensate: boolean
): CCSceneNode {
  if (compensate && node.size) {
    const oldAx = node.anchor?.x ?? 0.5
    const oldAy = node.anchor?.y ?? 0.5
    const w = (node.size as { x: number; y: number }).x
    const h = (node.size as { x: number; y: number }).y
    const pos = node.position as { x: number; y: number; z?: number }
    const dx = (ax - oldAx) * w
    const dy = (ay - oldAy) * h
    return { ...node, anchor: { x: ax, y: ay }, position: { ...pos, x: pos.x + dx, y: pos.y + dy } }
  }
  return { ...node, anchor: { x: ax, y: ay } }
}

// ── 회전 정규화 로직 (applyNormRot 재현) ────────────────────────────────────

function normalizeRotation(node: CCSceneNode): CCSceneNode {
  if (typeof node.rotation === 'number') {
    return { ...node, rotation: ((node.rotation % 360) + 360) % 360 }
  }
  const r = node.rotation as { x: number; y: number; z: number }
  return { ...node, rotation: { ...r, z: ((r.z % 360) + 360) % 360 } }
}

// ── 그리드 스냅 로직 (applyGridSnap 재현) ───────────────────────────────────

function applyGridSnap(node: CCSceneNode, gridSize: number): CCSceneNode {
  const p = node.position as { x: number; y: number; z?: number }
  return {
    ...node,
    position: { ...p, x: Math.round(p.x / gridSize) * gridSize, y: Math.round(p.y / gridSize) * gridSize },
  }
}

// ── Flip 로직 (doFlip 재현) ──────────────────────────────────────────────────

function applyFlip(node: CCSceneNode, axis: 'x' | 'y'): CCSceneNode {
  const sc = node.scale as { x: number; y: number; z?: number }
  const newScale = axis === 'x' ? { ...sc, x: -sc.x } : { ...sc, y: -sc.y }
  return { ...node, scale: newScale }
}

// ── 정수화 로직 (applyInt 재현) ──────────────────────────────────────────────

function applyIntegerize(node: CCSceneNode): CCSceneNode {
  const pos = node.position as { x: number; y: number; z?: number }
  const sz = node.size as { x: number; y: number } | undefined
  return {
    ...node,
    position: { ...pos, x: Math.round(pos.x), y: Math.round(pos.y) },
    ...(sz ? { size: { x: Math.round(sz.x), y: Math.round(sz.y) } } : {}),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Z-Order 이동 (applyZOrder)', () => {
  it('top: 선택 노드를 마지막(최상위)으로 이동한다', () => {
    const a = makeNode('a')
    const b = makeNode('b')
    const c = makeNode('c')
    const root = makeNode('root', { children: [a, b, c] })

    const result = applyZOrder(root, new Set(['a']), 'top')
    const names = result.children.map(n => n.uuid)
    expect(names).toEqual(['b', 'c', 'a'])
  })

  it('bottom: 선택 노드를 첫번째(최하위)로 이동한다', () => {
    const a = makeNode('a')
    const b = makeNode('b')
    const c = makeNode('c')
    const root = makeNode('root', { children: [a, b, c] })

    const result = applyZOrder(root, new Set(['c']), 'bottom')
    const names = result.children.map(n => n.uuid)
    expect(names).toEqual(['c', 'a', 'b'])
  })

  it('up: 선택 노드를 한 칸 위로 이동한다', () => {
    const a = makeNode('a')
    const b = makeNode('b')
    const c = makeNode('c')
    const root = makeNode('root', { children: [a, b, c] })

    const result = applyZOrder(root, new Set(['b']), 'up')
    const names = result.children.map(n => n.uuid)
    expect(names).toEqual(['a', 'c', 'b'])
  })

  it('down: 선택 노드를 한 칸 아래로 이동한다', () => {
    const a = makeNode('a')
    const b = makeNode('b')
    const c = makeNode('c')
    const root = makeNode('root', { children: [a, b, c] })

    const result = applyZOrder(root, new Set(['b']), 'down')
    const names = result.children.map(n => n.uuid)
    expect(names).toEqual(['b', 'a', 'c'])
  })

  it('up: 이미 최상위이면 이동하지 않는다', () => {
    const a = makeNode('a')
    const b = makeNode('b')
    const root = makeNode('root', { children: [a, b] })

    const result = applyZOrder(root, new Set(['b']), 'up')
    const names = result.children.map(n => n.uuid)
    expect(names).toEqual(['a', 'b'])
  })

  it('down: 이미 최하위이면 이동하지 않는다', () => {
    const a = makeNode('a')
    const b = makeNode('b')
    const root = makeNode('root', { children: [a, b] })

    const result = applyZOrder(root, new Set(['a']), 'down')
    const names = result.children.map(n => n.uuid)
    expect(names).toEqual(['a', 'b'])
  })

  it('top: 여러 노드 선택 시 순서 유지하면서 최상위로 이동', () => {
    const a = makeNode('a'), b = makeNode('b'), c = makeNode('c'), d = makeNode('d')
    const root = makeNode('root', { children: [a, b, c, d] })

    const result = applyZOrder(root, new Set(['a', 'c']), 'top')
    const names = result.children.map(n => n.uuid)
    // 비선택(b,d) 먼저, 선택(a,c) 뒤
    expect(names).toEqual(['b', 'd', 'a', 'c'])
  })

  it('선택 노드가 없으면 children 순서 변경 없음', () => {
    const a = makeNode('a'), b = makeNode('b')
    const root = makeNode('root', { children: [a, b] })

    const result = applyZOrder(root, new Set(['x']), 'top')
    expect(result.children.map(n => n.uuid)).toEqual(['a', 'b'])
  })
})

describe('앵커 보정 (applyAnchorPatch)', () => {
  it('보정 ON: 앵커 이동 시 position이 보정된다', () => {
    const node = makeNode('n', {
      position: { x: 0, y: 0, z: 0 },
      anchor: { x: 0.5, y: 0.5 },
      size: { x: 200, y: 100 },
    })

    // 0.5 → 0.0: dx = (0 - 0.5) * 200 = -100, dy = (0 - 0.5) * 100 = -50
    const result = applyAnchorPatch(node, 0, 0, true)
    expect(result.anchor).toEqual({ x: 0, y: 0 })
    expect((result.position as { x: number; y: number }).x).toBeCloseTo(-100)
    expect((result.position as { x: number; y: number }).y).toBeCloseTo(-50)
  })

  it('보정 OFF: 앵커만 변경, position 불변', () => {
    const node = makeNode('n', {
      position: { x: 50, y: 30, z: 0 },
      anchor: { x: 0.5, y: 0.5 },
      size: { x: 200, y: 100 },
    })

    const result = applyAnchorPatch(node, 1, 1, false)
    expect(result.anchor).toEqual({ x: 1, y: 1 })
    expect((result.position as { x: number; y: number }).x).toBe(50)
    expect((result.position as { x: number; y: number }).y).toBe(30)
  })

  it('보정 ON: 앵커를 원래와 같은 값으로 설정하면 position 불변', () => {
    const node = makeNode('n', {
      position: { x: 10, y: 20, z: 0 },
      anchor: { x: 0.5, y: 0.5 },
      size: { x: 100, y: 100 },
    })

    const result = applyAnchorPatch(node, 0.5, 0.5, true)
    expect((result.position as { x: number; y: number }).x).toBe(10)
    expect((result.position as { x: number; y: number }).y).toBe(20)
  })
})

describe('회전 정규화 (normalizeRotation)', () => {
  it('number 타입: 음수 → 0~360 범위로 정규화', () => {
    const node = makeNode('n', { rotation: -90 })
    const result = normalizeRotation(node)
    expect(result.rotation).toBe(270)
  })

  it('number 타입: 360 초과 → 0~360 범위로 정규화', () => {
    const node = makeNode('n', { rotation: 450 })
    const result = normalizeRotation(node)
    expect(result.rotation).toBe(90)
  })

  it('number 타입: 0 → 0', () => {
    const node = makeNode('n', { rotation: 0 })
    const result = normalizeRotation(node)
    expect(result.rotation).toBe(0)
  })

  it('object 타입 (3x): z 값 정규화', () => {
    const node = makeNode('n', { rotation: { x: 0, y: 0, z: -270 } })
    const result = normalizeRotation(node)
    expect((result.rotation as { z: number }).z).toBe(90)
  })

  it('number 타입: -360 → 0', () => {
    const node = makeNode('n', { rotation: -360 })
    const result = normalizeRotation(node)
    expect(result.rotation).toBe(0)
  })
})

describe('그리드 스냅 (applyGridSnap)', () => {
  it('8px 그리드에 스냅된다', () => {
    const node = makeNode('n', { position: { x: 13, y: 22, z: 0 } })
    const result = applyGridSnap(node, 8)
    expect((result.position as { x: number; y: number }).x).toBe(16)
    expect((result.position as { x: number; y: number }).y).toBe(24)
  })

  it('이미 그리드에 맞으면 변경 없음', () => {
    const node = makeNode('n', { position: { x: 32, y: 64, z: 0 } })
    const result = applyGridSnap(node, 8)
    expect((result.position as { x: number; y: number }).x).toBe(32)
    expect((result.position as { x: number; y: number }).y).toBe(64)
  })

  it('음수 위치도 올바르게 스냅한다', () => {
    const node = makeNode('n', { position: { x: -13, y: -22, z: 0 } })
    const result = applyGridSnap(node, 8)
    expect((result.position as { x: number; y: number }).x).toBe(-16)
    expect((result.position as { x: number; y: number }).y).toBe(-24)
  })
})

describe('Flip 반전 (applyFlip)', () => {
  it('X 반전: scale.x 부호가 반전된다', () => {
    const node = makeNode('n', { scale: { x: 2, y: 3, z: 1 } })
    const result = applyFlip(node, 'x')
    expect((result.scale as { x: number; y: number }).x).toBe(-2)
    expect((result.scale as { x: number; y: number }).y).toBe(3)
  })

  it('Y 반전: scale.y 부호가 반전된다', () => {
    const node = makeNode('n', { scale: { x: 2, y: 3, z: 1 } })
    const result = applyFlip(node, 'y')
    expect((result.scale as { x: number; y: number }).y).toBe(-3)
    expect((result.scale as { x: number; y: number }).x).toBe(2)
  })

  it('이미 반전된 상태에서 X 반전하면 원래 값으로 복원된다', () => {
    const node = makeNode('n', { scale: { x: -1, y: 1, z: 1 } })
    const result = applyFlip(node, 'x')
    expect((result.scale as { x: number; y: number }).x).toBe(1)
  })
})

describe('정수화 (applyIntegerize)', () => {
  it('position과 size가 정수로 반올림된다', () => {
    const node = makeNode('n', {
      position: { x: 10.7, y: -3.4, z: 0 },
      size: { x: 99.9, y: 100.1 },
    })
    const result = applyIntegerize(node)
    expect((result.position as { x: number; y: number }).x).toBe(11)
    expect((result.position as { x: number; y: number }).y).toBe(-3)
    expect((result.size as { x: number; y: number }).x).toBe(100)
    expect((result.size as { x: number; y: number }).y).toBe(100)
  })

  it('이미 정수이면 변경 없음', () => {
    const node = makeNode('n', {
      position: { x: 10, y: 20, z: 0 },
      size: { x: 100, y: 200 },
    })
    const result = applyIntegerize(node)
    expect((result.position as { x: number; y: number }).x).toBe(10)
    expect((result.size as { x: number; y: number }).y).toBe(200)
  })
})
