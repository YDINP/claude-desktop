/**
 * distribution plugin 순수 로직 테스트
 * DistributionPlugin 컴포넌트 내부 분배 계산 로직을 순수 함수로 재현하여 검증
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

// ── 선형 보간 유틸 ────────────────────────────────────────────────────────────

function lerp(from: number, to: number, idx: number, total: number): number {
  const t = total > 1 ? idx / (total - 1) : 0
  return from + (to - from) * t
}

// ── 균등 분배 계산 (R2604, R2605, R2613, R2618, R2619 등 patchOrdered 패턴) ──

function distributeLinear(
  nodes: CCSceneNode[],
  from: number,
  to: number,
  apply: (node: CCSceneNode, value: number) => CCSceneNode
): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const v = Math.round(lerp(from, to, idx, nodes.length))
    return apply(n, v)
  })
}

// ── rotation 균등 분배 (R2604) ────────────────────────────────────────────────

function distributeRotation(nodes: CCSceneNode[], from: number, to: number): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const deg = Math.round(lerp(from, to, idx, nodes.length))
    return { ...n, rotation: { ...n.rotation, z: deg } }
  })
}

// ── scale 균등 분배 (R2605) ───────────────────────────────────────────────────

function distributeScale(nodes: CCSceneNode[], from: number, to: number): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const sv = Math.round((lerp(from, to, idx, nodes.length)) * 1000) / 1000
    const sc = n.scale as { x: number; y: number; z?: number }
    return { ...n, scale: { ...sc, x: sv, y: sv } }
  })
}

// ── size W 균등 분배 (R2613) ──────────────────────────────────────────────────

function distributeSizeW(nodes: CCSceneNode[], from: number, to: number): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const newW = Math.round(lerp(from, to, idx, nodes.length))
    const sz = n.size as { x: number; y: number }
    return { ...n, size: { ...sz, x: newW } }
  })
}

// ── size H 균등 분배 (R2614) ──────────────────────────────────────────────────

function distributeSizeH(nodes: CCSceneNode[], from: number, to: number): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const newH = Math.round(lerp(from, to, idx, nodes.length))
    const sz = n.size as { x: number; y: number }
    return { ...n, size: { ...sz, y: newH } }
  })
}

// ── pos X 균등 분배 (R2618) ───────────────────────────────────────────────────

function distributePosX(nodes: CCSceneNode[], from: number, to: number): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const newX = Math.round(lerp(from, to, idx, nodes.length))
    const p = n.position as { x: number; y: number; z?: number }
    return { ...n, position: { ...p, x: newX } }
  })
}

// ── pos Y 균등 분배 (R2619) ───────────────────────────────────────────────────

function distributePosY(nodes: CCSceneNode[], from: number, to: number): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const newY = Math.round(lerp(from, to, idx, nodes.length))
    const p = n.position as { x: number; y: number; z?: number }
    return { ...n, position: { ...p, y: newY } }
  })
}

// ── 원형 배치 좌표 계산 (R2479) ───────────────────────────────────────────────

function calcCirclePositions(count: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return {
      x: Math.round(radius * Math.cos(angle)),
      y: Math.round(radius * Math.sin(angle)),
    }
  })
}

// ── 격자 배치 좌표 계산 (R2481) ───────────────────────────────────────────────

function calcGridPositions(
  count: number,
  cols: number,
  gapX: number,
  gapY: number
): { x: number; y: number }[] {
  const c = Math.max(1, cols)
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / c)
    return {
      x: (i % c) * gapX,
      y: row === 0 ? 0 : -(row * gapY),
    }
  })
}

// ── anchor X/Y 균등 분배 (R2628) ──────────────────────────────────────────────

function distributeAnchorX(nodes: CCSceneNode[], from: number, to: number): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const ax = parseFloat(lerp(from, to, idx, nodes.length).toFixed(3))
    return { ...n, anchor: { x: ax, y: n.anchor?.y ?? 0.5 } }
  })
}

function distributeAnchorY(nodes: CCSceneNode[], from: number, to: number): CCSceneNode[] {
  return nodes.map((n, idx) => {
    const ay = parseFloat(lerp(from, to, idx, nodes.length).toFixed(3))
    return { ...n, anchor: { x: n.anchor?.x ?? 0.5, y: ay } }
  })
}

// ── 균등 분배 (R1722) — X/Y축 ─────────────────────────────────────────────────

function distributeEvenlyX(nodes: CCSceneNode[]): CCSceneNode[] {
  const sorted = [...nodes].sort((a, b) => {
    return (a.position as { x: number }).x - (b.position as { x: number }).x
  })
  const minX = (sorted[0].position as { x: number }).x
  const maxX = (sorted[sorted.length - 1].position as { x: number }).x
  const step = (maxX - minX) / (sorted.length - 1)
  const posMap = new Map(sorted.map((n, i) => [n.uuid, minX + step * i]))
  return nodes.map(n => {
    const newX = posMap.get(n.uuid)!
    const p = n.position as { x: number; y: number; z?: number }
    return { ...n, position: { ...p, x: Math.round(newX) } }
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('선형 보간 (lerp)', () => {
  it('3개 노드 0→100 → 0, 50, 100', () => {
    const vals = [0, 1, 2].map(i => Math.round(lerp(0, 100, i, 3)))
    expect(vals).toEqual([0, 50, 100])
  })

  it('total=1이면 from 반환', () => {
    expect(Math.round(lerp(10, 90, 0, 1))).toBe(10)
  })

  it('from === to이면 모두 같은 값', () => {
    const vals = [0, 1, 2].map(i => lerp(50, 50, i, 3))
    expect(vals).toEqual([50, 50, 50])
  })
})

describe('rotation 균등 분배 (R2604)', () => {
  it('0°→360° 3개 → 0, 180, 360', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const result = distributeRotation(nodes, 0, 360)
    expect(result.map(n => n.rotation.z)).toEqual([0, 180, 360])
  })

  it('2개 노드: 첫번째=from, 마지막=to', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const result = distributeRotation(nodes, -90, 90)
    expect(result[0].rotation.z).toBe(-90)
    expect(result[1].rotation.z).toBe(90)
  })

  it('다른 rotation 축(x,y)은 변경하지 않음', () => {
    const nodes = [makeNode('a', { rotation: { x: 10, y: 20, z: 0 } })]
    const result = distributeRotation(nodes, 45, 45)
    expect(result[0].rotation.x).toBe(10)
    expect(result[0].rotation.y).toBe(20)
  })
})

describe('scale 균등 분배 (R2605)', () => {
  it('1→2 3개 노드 → 1, 1.5, 2', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const result = distributeScale(nodes, 1, 2)
    expect(result[0].scale).toMatchObject({ x: 1, y: 1 })
    expect(result[1].scale).toMatchObject({ x: 1.5, y: 1.5 })
    expect(result[2].scale).toMatchObject({ x: 2, y: 2 })
  })

  it('scale x와 y가 동일하게 설정됨', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const result = distributeScale(nodes, 0.5, 1.5)
    result.forEach(n => {
      const sc = n.scale as { x: number; y: number }
      expect(sc.x).toBe(sc.y)
    })
  })
})

describe('size W 균등 분배 (R2613)', () => {
  it('50→200 4개 → 50, 100, 150, 200', () => {
    const nodes = Array.from({ length: 4 }, (_, i) => makeNode(`n${i}`))
    const result = distributeSizeW(nodes, 50, 200)
    expect(result.map(n => (n.size as { x: number }).x)).toEqual([50, 100, 150, 200])
  })

  it('size.y는 변경하지 않음', () => {
    const nodes = [makeNode('a', { size: { x: 100, y: 200 } })]
    const result = distributeSizeW(nodes, 300, 300)
    expect((result[0].size as { y: number }).y).toBe(200)
  })
})

describe('size H 균등 분배 (R2614)', () => {
  it('50→150 3개 → 50, 100, 150', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const result = distributeSizeH(nodes, 50, 150)
    expect(result.map(n => (n.size as { y: number }).y)).toEqual([50, 100, 150])
  })

  it('size.x는 변경하지 않음', () => {
    const nodes = [makeNode('a', { size: { x: 80, y: 100 } })]
    const result = distributeSizeH(nodes, 200, 200)
    expect((result[0].size as { x: number }).x).toBe(80)
  })
})

describe('pos X 균등 분배 (R2618)', () => {
  it('-100→100 3개 → -100, 0, 100', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const result = distributePosX(nodes, -100, 100)
    expect(result.map(n => (n.position as { x: number }).x)).toEqual([-100, 0, 100])
  })

  it('y, z는 변경하지 않음', () => {
    const nodes = [makeNode('a', { position: { x: 0, y: 50, z: 10 } })]
    const result = distributePosX(nodes, 200, 200)
    const p = result[0].position as { y: number; z?: number }
    expect(p.y).toBe(50)
    expect(p.z).toBe(10)
  })
})

describe('pos Y 균등 분배 (R2619)', () => {
  it('-200→200 5개 균등 분배', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => makeNode(`n${i}`))
    const result = distributePosY(nodes, -200, 200)
    expect(result.map(n => (n.position as { y: number }).y)).toEqual([-200, -100, 0, 100, 200])
  })
})

describe('원형 배치 좌표 계산 (R2479)', () => {
  it('4개 반지름 100 → 상하좌우 배치', () => {
    const positions = calcCirclePositions(4, 100)
    // 시작각 -π/2 (위)
    expect(positions[0]).toMatchObject({ x: 0, y: -100 })  // 위
    expect(positions[1]).toMatchObject({ x: 100, y: 0 })   // 오른쪽
    expect(positions[2]).toMatchObject({ x: 0, y: 100 })   // 아래
    expect(positions[3]).toMatchObject({ x: -100, y: 0 })  // 왼쪽
  })

  it('개수만큼 포지션 반환', () => {
    expect(calcCirclePositions(6, 100)).toHaveLength(6)
  })

  it('반지름이 커지면 좌표도 비례하여 커짐', () => {
    const r100 = calcCirclePositions(1, 100)
    const r200 = calcCirclePositions(1, 200)
    // 첫번째 요소: angle = -π/2, cos(-π/2)≈0, sin(-π/2)=-1
    expect(Math.abs(r200[0].y)).toBeGreaterThan(Math.abs(r100[0].y))
  })
})

describe('격자 배치 좌표 계산 (R2481)', () => {
  it('3열 gapX=100 gapY=100: 6개 노드', () => {
    const positions = calcGridPositions(6, 3, 100, 100)
    expect(positions[0]).toEqual({ x: 0, y: 0 })
    expect(positions[1]).toEqual({ x: 100, y: 0 })
    expect(positions[2]).toEqual({ x: 200, y: 0 })
    expect(positions[3]).toEqual({ x: 0, y: -100 })
    expect(positions[4]).toEqual({ x: 100, y: -100 })
    expect(positions[5]).toEqual({ x: 200, y: -100 })
  })

  it('1열: 모두 x=0, y 감소', () => {
    const positions = calcGridPositions(3, 1, 100, 50)
    expect(positions.map(p => p.x)).toEqual([0, 0, 0])
    expect(positions.map(p => p.y)).toEqual([0, -50, -100])
  })

  it('cols=0이면 1열로 처리', () => {
    const positions = calcGridPositions(2, 0, 100, 100)
    expect(positions[0].x).toBe(0)
    expect(positions[1].x).toBe(0)
  })

  it('개수만큼 포지션 반환', () => {
    expect(calcGridPositions(8, 4, 120, 120)).toHaveLength(8)
  })
})

describe('anchor X 균등 분배 (R2628)', () => {
  it('0→1 3개 → 0, 0.5, 1', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const result = distributeAnchorX(nodes, 0, 1)
    expect(result.map(n => n.anchor?.x)).toEqual([0, 0.5, 1])
  })

  it('anchor.y는 변경하지 않음', () => {
    const nodes = [makeNode('a', { anchor: { x: 0.5, y: 0.3 } })]
    const result = distributeAnchorX(nodes, 1, 1)
    expect(result[0].anchor?.y).toBe(0.3)
  })
})

describe('anchor Y 균등 분배 (R2628)', () => {
  it('0→1 2개 → 0, 1', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const result = distributeAnchorY(nodes, 0, 1)
    expect(result[0].anchor?.y).toBe(0)
    expect(result[1].anchor?.y).toBe(1)
  })

  it('anchor.x는 변경하지 않음', () => {
    const nodes = [makeNode('a', { anchor: { x: 0.7, y: 0.5 } })]
    const result = distributeAnchorY(nodes, 0.2, 0.2)
    expect(result[0].anchor?.x).toBe(0.7)
  })
})

describe('균등 분배 X (R1722)', () => {
  it('3개 노드: 첫/끝 고정, 가운데 중간값', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 0, z: 0 } }),
      makeNode('c', { position: { x: 200, y: 0, z: 0 } }),
      makeNode('b', { position: { x: 100, y: 0, z: 0 } }),
    ]
    const result = distributeEvenlyX(nodes)
    const xs = result.map(n => (n.position as { x: number }).x).sort((a, b) => a - b)
    expect(xs).toEqual([0, 100, 200])
  })

  it('이미 균등하면 변경 없음', () => {
    const nodes = [
      makeNode('a', { position: { x: 0, y: 5, z: 0 } }),
      makeNode('b', { position: { x: 50, y: 5, z: 0 } }),
      makeNode('c', { position: { x: 100, y: 5, z: 0 } }),
    ]
    const result = distributeEvenlyX(nodes)
    const xs = result.map(n => (n.position as { x: number }).x)
    expect(xs).toEqual([0, 50, 100])
  })
})
