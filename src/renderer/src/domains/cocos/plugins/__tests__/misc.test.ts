/**
 * misc plugin 순수 로직 테스트
 * MiscPlugin 컴포넌트 내부 선택/정렬/분배 로직을 순수 함수로 재현하여 검증
 */
import { describe, it, expect } from 'vitest'
import type { CCSceneNode } from '../../../../../../shared/ipc-schema'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return {
    uuid,
    name: uuid,
    active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
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

// ── 2노드 거리/dx/dy 계산 (R2336) ────────────────────────────────────────────

function calcDistance(a: CCSceneNode, b: CCSceneNode) {
  const pa = a.position as { x: number; y: number }
  const pb = b.position as { x: number; y: number }
  const dx = Math.round((pb.x - pa.x) * 10) / 10
  const dy = Math.round((pb.y - pa.y) * 10) / 10
  const dist = Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10
  return { dx, dy, dist }
}

// ── 바운딩박스 통계 (R2499) ───────────────────────────────────────────────────

function calcBoundingBox(nodes: CCSceneNode[]) {
  const xs = nodes.map(n => (n.position as { x?: number }).x ?? 0)
  const ys = nodes.map(n => (n.position as { y?: number }).y ?? 0)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  return {
    cx: Math.round((minX + maxX) / 2),
    cy: Math.round((minY + maxY) / 2),
    spanX: Math.round(maxX - minX),
    spanY: Math.round(maxY - minY),
  }
}

// ── 정렬 로직 (R2503 applyAlign) ─────────────────────────────────────────────

function applyAlign(
  nodes: CCSceneNode[],
  axis: 'x' | 'y',
  mode: 'min' | 'max' | 'center' | 'distrib'
): CCSceneNode[] {
  const vals = nodes.map(n => ((n.position as Record<string, number>)[axis] ?? 0))
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const avgV = vals.reduce((a, b) => a + b, 0) / vals.length
  const sorted = [...nodes].sort((a, b) => {
    return ((a.position as Record<string, number>)[axis] ?? 0) - ((b.position as Record<string, number>)[axis] ?? 0)
  })
  const targetMap = new Map<string, number>()
  if (mode === 'min') nodes.forEach(n => targetMap.set(n.uuid, minV))
  else if (mode === 'max') nodes.forEach(n => targetMap.set(n.uuid, maxV))
  else if (mode === 'center') nodes.forEach(n => targetMap.set(n.uuid, avgV))
  else if (mode === 'distrib') {
    sorted.forEach((n, i) => {
      const t = sorted.length === 1 ? minV : minV + (maxV - minV) * i / (sorted.length - 1)
      targetMap.set(n.uuid, t)
    })
  }
  return nodes.map(n => {
    const pos = { ...(n.position as object) } as Record<string, number>
    pos[axis] = Math.round(targetMap.get(n.uuid)!)
    return { ...n, position: pos as CCSceneNode['position'] }
  })
}

// ── 균등 배분 (R2348) ─────────────────────────────────────────────────────────

function distributeEvenly(nodes: CCSceneNode[], axis: 'x' | 'y'): CCSceneNode[] {
  const sorted = [...nodes].sort((a, b) => {
    const pa = a.position as { x: number; y: number }
    const pb = b.position as { x: number; y: number }
    return pa[axis] - pb[axis]
  })
  const first = (sorted[0].position as { x: number; y: number })[axis]
  const last = (sorted[sorted.length - 1].position as { x: number; y: number })[axis]
  const step = (last - first) / (sorted.length - 1)
  const posMap = new Map<string, number>()
  sorted.forEach((n, i) => posMap.set(n.uuid, first + step * i))
  return nodes.map(n => {
    const newVal = posMap.get(n.uuid)!
    const pos = n.position as { x: number; y: number; z?: number }
    return { ...n, position: { ...pos, [axis]: Math.round(newVal) } }
  })
}

// ── scale flip 반전 (R2575) ───────────────────────────────────────────────────

function applyFlip(node: CCSceneNode, axis: 'x' | 'y'): CCSceneNode {
  const sc = node.scale as { x: number; y: number; z?: number }
  return { ...node, scale: { ...sc, [axis]: -(sc[axis] ?? 1) } }
}

// ── 위치 대칭 이동 (R2587) ────────────────────────────────────────────────────

function applyMirror(nodes: CCSceneNode[], axis: 'x' | 'y'): CCSceneNode[] {
  const xs = nodes.map(n => (n.position as { x: number }).x)
  const ys = nodes.map(n => (n.position as { y: number }).y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const center = axis === 'x' ? cx : cy
  return nodes.map(n => {
    const pos = n.position as { x: number; y: number; z?: number }
    return { ...n, position: { ...pos, [axis]: 2 * center - pos[axis] } }
  })
}

// ── 위치 역전 (R2561) ─────────────────────────────────────────────────────────

function applyReverse(nodes: CCSceneNode[], axis: 'x' | 'y'): CCSceneNode[] {
  const sorted = [...nodes].sort((a, b) => {
    const pa = a.position as { x: number; y: number }
    const pb = b.position as { x: number; y: number }
    return pa[axis] - pb[axis]
  })
  const positions = sorted.map(n => (n.position as { x: number; y: number })[axis])
  const newPosMap = new Map<string, number>()
  sorted.forEach((n, i) => newPosMap.set(n.uuid, positions[positions.length - 1 - i]))
  return nodes.map(n => {
    const np = newPosMap.get(n.uuid)!
    const pos = n.position as { x: number; y: number; z?: number }
    return { ...n, position: { ...pos, [axis]: np } }
  })
}

// ── 위치 교환 (R2531 / R2589) ─────────────────────────────────────────────────

function swapPositions(a: CCSceneNode, b: CCSceneNode): [CCSceneNode, CCSceneNode] {
  const posA = { ...(a.position as object) }
  const posB = { ...(b.position as object) }
  return [
    { ...a, position: posB as CCSceneNode['position'] },
    { ...b, position: posA as CCSceneNode['position'] },
  ]
}

// ── 가장자리 정렬 (R2533) — size/anchor 고려 ──────────────────────────────────

type AlnMode = 'L' | 'R' | 'T' | 'B' | 'CX' | 'CY'

function applyEdgeAlign(nodes: CCSceneNode[], mode: AlnMode): CCSceneNode[] {
  const bounds = nodes.map(n => {
    const pos = n.position as { x: number; y: number }
    const w = n.size?.x ?? 0, h = n.size?.y ?? 0
    const ax = n.anchor?.x ?? 0.5, ay = n.anchor?.y ?? 0.5
    return { uuid: n.uuid, L: pos.x - w * ax, R: pos.x + w * (1 - ax), T: pos.y + h * (1 - ay), B: pos.y - h * ay, ax, ay, w, h }
  })
  const minL = Math.min(...bounds.map(b => b.L))
  const maxR = Math.max(...bounds.map(b => b.R))
  const maxT = Math.max(...bounds.map(b => b.T))
  const minB = Math.min(...bounds.map(b => b.B))
  const midX = (minL + maxR) / 2
  const midY = (minB + maxT) / 2

  const newPosMap = new Map<string, { x: number; y: number }>()
  for (const b of bounds) {
    const n = nodes.find(n => n.uuid === b.uuid)!
    const pos = n.position as { x: number; y: number }
    let nx = pos.x, ny = pos.y
    if (mode === 'L') nx = minL + b.w * b.ax
    else if (mode === 'R') nx = maxR - b.w * (1 - b.ax)
    else if (mode === 'T') ny = maxT - b.h * (1 - b.ay)
    else if (mode === 'B') ny = minB + b.h * b.ay
    else if (mode === 'CX') nx = midX
    else if (mode === 'CY') ny = midY
    newPosMap.set(b.uuid, { x: Math.round(nx), y: Math.round(ny) })
  }
  return nodes.map(n => {
    const np = newPosMap.get(n.uuid)!
    const pos = n.position as { x: number; y: number; z?: number }
    return { ...n, position: { ...pos, x: np.x, y: np.y } }
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('2노드 거리/dx/dy 계산 (R2336)', () => {
  it('기본 거리 계산', () => {
    const a = makeNode('a', { position: { x: 0, y: 0, z: 0 } })
    const b = makeNode('b', { position: { x: 3, y: 4, z: 0 } })
    const { dx, dy, dist } = calcDistance(a, b)
    expect(dx).toBe(3)
    expect(dy).toBe(4)
    expect(dist).toBe(5)
  })

  it('같은 위치이면 dx=0, dy=0, dist=0', () => {
    const a = makeNode('a', { position: { x: 50, y: 30, z: 0 } })
    const b = makeNode('b', { position: { x: 50, y: 30, z: 0 } })
    const { dx, dy, dist } = calcDistance(a, b)
    expect(dx).toBe(0)
    expect(dy).toBe(0)
    expect(dist).toBe(0)
  })

  it('음수 방향 delta', () => {
    const a = makeNode('a', { position: { x: 10, y: 10, z: 0 } })
    const b = makeNode('b', { position: { x: 0, y: 0, z: 0 } })
    const { dx, dy } = calcDistance(a, b)
    expect(dx).toBe(-10)
    expect(dy).toBe(-10)
  })
})

describe('바운딩박스 통계 (R2499)', () => {
  it('center와 span 계산', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 100, y: 0, z: 0 } }),
      makeNode('c', { position: { x: 50, y: 100, z: 0 } }),
    ]
    const { cx, cy, spanX, spanY } = calcBoundingBox(nodes)
    expect(cx).toBe(50)
    expect(cy).toBe(50)
    expect(spanX).toBe(100)
    expect(spanY).toBe(100)
  })

  it('모두 같은 위치이면 span=0', () => {
    const nodes = [
      makeNode('a', { position: { x: 30, y: 30, z: 0 } }),
      makeNode('b', { position: { x: 30, y: 30, z: 0 } }),
      makeNode('c', { position: { x: 30, y: 30, z: 0 } }),
    ]
    const { spanX, spanY } = calcBoundingBox(nodes)
    expect(spanX).toBe(0)
    expect(spanY).toBe(0)
  })
})

describe('정렬 (R2503)', () => {
  it('min: 모두 최솟값 x로 정렬', () => {
    const nodes = [
      makeNode('a', { position: { x: 10, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 50, y: 0, z: 0 } }),
      makeNode('c', { position: { x: 30, y: 0, z: 0 } }),
    ]
    const result = applyAlign(nodes, 'x', 'min')
    expect(result.every(n => (n.position as { x: number }).x === 10)).toBe(true)
  })

  it('max: 모두 최댓값 x로 정렬', () => {
    const nodes = [
      makeNode('a', { position: { x: 10, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 50, y: 0, z: 0 } }),
    ]
    const result = applyAlign(nodes, 'x', 'max')
    expect(result.every(n => (n.position as { x: number }).x === 50)).toBe(true)
  })

  it('center: 평균값으로 정렬', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 100, y: 0, z: 0 } }),
    ]
    const result = applyAlign(nodes, 'x', 'center')
    expect(result.every(n => (n.position as { x: number }).x === 50)).toBe(true)
  })

  it('distrib: 균등 간격으로 배분', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 } }),
      makeNode('c', { position: { x: 100, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 90, y: 0, z: 0 } }),
    ]
    const result = applyAlign(nodes, 'x', 'distrib')
    const xs = result.map(n => (n.position as { x: number }).x).sort((a, b) => a - b)
    expect(xs).toEqual([0, 50, 100])
  })
})

describe('균등 배분 (R2348)', () => {
  it('3개 X 균등 배분: 첫/끝 고정, 가운데 중간값', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 80, y: 0, z: 0 } }),
      makeNode('c', { position: { x: 200, y: 0, z: 0 } }),
    ]
    const result = distributeEvenly(nodes, 'x')
    const xs = result.map(n => (n.position as { x: number }).x)
    expect(xs).toContain(0)
    expect(xs).toContain(100)
    expect(xs).toContain(200)
  })

  it('Y 균등 배분', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: -100, z: 0 } }),
      makeNode('b', { position: { x: 0, y: 50, z: 0 } }),
      makeNode('c', { position: { x: 0, y: 100, z: 0 } }),
    ]
    const result = distributeEvenly(nodes, 'y')
    const ys = result.map(n => (n.position as { y: number }).y).sort((a, b) => a - b)
    expect(ys[0]).toBe(-100)
    expect(ys[2]).toBe(100)
    // 가운데는 균등 간격
    expect(ys[1]).toBe(0)
  })
})

describe('scale flip 반전 (R2575)', () => {
  it('X 반전: scale.x 부호 반전', () => {
    const node = makeNode('a', { scale: { x: 2, y: 3, z: 1 } })
    const result = applyFlip(node, 'x')
    expect((result.scale as { x: number }).x).toBe(-2)
    expect((result.scale as { y: number }).y).toBe(3)
  })

  it('Y 반전: scale.y 부호 반전', () => {
    const node = makeNode('a', { scale: { x: 2, y: 3, z: 1 } })
    const result = applyFlip(node, 'y')
    expect((result.scale as { y: number }).y).toBe(-3)
    expect((result.scale as { x: number }).x).toBe(2)
  })

  it('두 번 반전하면 원래 값으로 복원', () => {
    const node = makeNode('a', { scale: { x: 1.5, y: 1, z: 1 } })
    const r1 = applyFlip(node, 'x')
    const r2 = applyFlip(r1, 'x')
    expect((r2.scale as { x: number }).x).toBe(1.5)
  })
})

describe('위치 대칭 이동 (R2587)', () => {
  it('X축 대칭: 바운딩박스 중심 기준 좌우 반전', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 100, y: 0, z: 0 } }),
    ]
    const result = applyMirror(nodes, 'x')
    const xs = result.map(n => (n.position as { x: number }).x).sort((a, b) => a - b)
    expect(xs).toEqual([0, 100]) // 대칭이므로 위치 값은 교환됨
  })

  it('Y축 대칭: 상하 반전', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: -50, z: 0 } }),
      makeNode('b', { position: { x: 0, y: 50, z: 0 } }),
    ]
    const result = applyMirror(nodes, 'y')
    const aY = (result.find(n => n.uuid === 'a')!.position as { y: number }).y
    const bY = (result.find(n => n.uuid === 'b')!.position as { y: number }).y
    expect(aY).toBe(50)
    expect(bY).toBe(-50)
  })

  it('중심 기준으로 대칭: 중심값은 불변', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 200, y: 0, z: 0 } }),
    ]
    const result = applyMirror(nodes, 'x')
    // 중심 = 100, a(0→200), b(200→0)
    const aX = (result.find(n => n.uuid === 'a')!.position as { x: number }).x
    const bX = (result.find(n => n.uuid === 'b')!.position as { x: number }).x
    expect(aX).toBe(200)
    expect(bX).toBe(0)
  })
})

describe('위치 역전 (R2561)', () => {
  it('X축 순서 뒤집기', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 50, y: 0, z: 0 } }),
      makeNode('c', { position: { x: 100, y: 0, z: 0 } }),
    ]
    const result = applyReverse(nodes, 'x')
    const aX = (result.find(n => n.uuid === 'a')!.position as { x: number }).x
    const cX = (result.find(n => n.uuid === 'c')!.position as { x: number }).x
    // a↔c 위치 교환
    expect(aX).toBe(100)
    expect(cX).toBe(0)
  })

  it('2개 노드 역전: 완전 교환', () => {
    const nodes = [
      makeNode('a', { position: { x: 10, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 90, y: 0, z: 0 } }),
    ]
    const result = applyReverse(nodes, 'x')
    const aX = (result.find(n => n.uuid === 'a')!.position as { x: number }).x
    const bX = (result.find(n => n.uuid === 'b')!.position as { x: number }).x
    expect(aX).toBe(90)
    expect(bX).toBe(10)
  })
})

describe('위치 교환 (R2531 / R2589)', () => {
  it('두 노드의 position이 교환됨', () => {
    const a = makeNode('a', { position: { x: 10, y: 20, z: 0 } })
    const b = makeNode('b', { position: { x: 100, y: 200, z: 0 } })
    const [newA, newB] = swapPositions(a, b)
    expect((newA.position as { x: number }).x).toBe(100)
    expect((newA.position as { y: number }).y).toBe(200)
    expect((newB.position as { x: number }).x).toBe(10)
    expect((newB.position as { y: number }).y).toBe(20)
  })

  it('교환 후 재교환하면 원래 값 복원', () => {
    const a = makeNode('a', { position: { x: 30, y: 40, z: 0 } })
    const b = makeNode('b', { position: { x: 70, y: 80, z: 0 } })
    const [swapped1, swapped2] = swapPositions(a, b)
    const [restored1, restored2] = swapPositions(swapped1, swapped2)
    expect((restored1.position as { x: number }).x).toBe(30)
    expect((restored2.position as { x: number }).x).toBe(70)
  })
})

describe('가장자리 정렬 (R2533)', () => {
  it('L: 가장 왼쪽 edge에 맞춤', () => {
    const nodes = [
      makeNode('a', { position: { x: 50, y: 0, z: 0 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 } }),
      makeNode('b', { position: { x: 150, y: 0, z: 0 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 } }),
    ]
    const result = applyEdgeAlign(nodes, 'L')
    // a의 left edge = 50 - 100*0.5 = 0, b의 left edge = 150 - 50 = 100
    // minL = 0, a 정렬 후 pos.x = 0 + 100*0.5 = 50 (불변)
    // b 정렬 후 pos.x = 0 + 100*0.5 = 50
    const bX = (result.find(n => n.uuid === 'b')!.position as { x: number }).x
    expect(bX).toBe(50)
  })

  it('CX: 수평 중앙에 모음', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 } }),
      makeNode('b', { position: { x: 200, y: 0, z: 0 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 } }),
    ]
    const result = applyEdgeAlign(nodes, 'CX')
    // midX = (minL+maxR)/2, minL=-50, maxR=250, midX=100
    const xs = result.map(n => (n.position as { x: number }).x)
    expect(xs[0]).toBe(100)
    expect(xs[1]).toBe(100)
  })
})
