/**
 * filter plugin 순수 로직 테스트
 * FilterPlugin 컴포넌트 내부 타입 필터 로직을 순수 함수로 재현하여 검증
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

function makeComp(type: string) {
  return { type, props: {} }
}

// ── FILTER_TYPES 정의 (filter.tsx에서 복제) ───────────────────────────────────

const FILTER_TYPES = [
  { label: 'Sprite', types: ['cc.Sprite', 'Sprite'] },
  { label: 'Label', types: ['cc.Label', 'Label', 'cc.RichText'] },
  { label: 'Button', types: ['cc.Button', 'Button'] },
  { label: 'Toggle', types: ['cc.Toggle', 'Toggle'] },
  { label: 'Layout', types: ['cc.Layout', 'Layout'] },
  { label: 'ScrollView', types: ['cc.ScrollView', 'ScrollView'] },
  { label: 'Skeleton', types: ['sp.Skeleton'] },
  { label: 'Animation', types: ['cc.Animation', 'Animation', 'cc.AnimationState'] },
  { label: 'Canvas', types: ['cc.Canvas', 'Canvas'] },
  { label: 'Widget', types: ['cc.Widget', 'Widget'] },
] as const

// ── typeCounts 계산 로직 (FilterPlugin useMemo 재현) ──────────────────────────

function calcTypeCounts(nodes: CCSceneNode[]): Map<string, number> {
  const counts = new Map<string, number>()
  nodes.forEach(node => {
    node.components.forEach(c => {
      FILTER_TYPES.forEach(ft => {
        if ((ft.types as readonly string[]).includes(c.type)) {
          counts.set(ft.label, (counts.get(ft.label) ?? 0) + 1)
        }
      })
    })
  })
  return counts
}

// ── applyFilter 로직 (FilterPlugin applyFilter 재현) ──────────────────────────

function applyFilter(nodes: CCSceneNode[], filterTypes: readonly string[]): string[] {
  const typeSet = new Set(filterTypes)
  const filtered = nodes.filter(node =>
    node.components.some(c => typeSet.has(c.type))
  )
  return filtered.map(n => n.uuid)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('typeCounts 계산', () => {
  it('Sprite 컴포넌트를 가진 노드 수 집계', () => {
    const nodes = [
      makeNode('a', { components: [makeComp('cc.Sprite')] }),
      makeNode('b', { components: [makeComp('cc.Label')] }),
      makeNode('c', { components: [makeComp('Sprite')] }),
    ]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Sprite')).toBe(2)
    expect(counts.get('Label')).toBe(1)
  })

  it('컴포넌트가 없으면 counts 비어 있음', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const counts = calcTypeCounts(nodes)
    expect(counts.size).toBe(0)
  })

  it('인식하지 못하는 컴포넌트 타입은 무시', () => {
    const nodes = [makeNode('a', { components: [makeComp('custom.MyComp')] })]
    const counts = calcTypeCounts(nodes)
    expect(counts.size).toBe(0)
  })

  it('노드 하나에 여러 컴포넌트 — 각각 집계', () => {
    const nodes = [
      makeNode('a', {
        components: [makeComp('cc.Sprite'), makeComp('cc.Button')],
      }),
    ]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Sprite')).toBe(1)
    expect(counts.get('Button')).toBe(1)
  })

  it('cc.RichText는 Label 그룹으로 집계', () => {
    const nodes = [makeNode('a', { components: [makeComp('cc.RichText')] })]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Label')).toBe(1)
  })

  it('sp.Skeleton은 Skeleton 그룹으로 집계', () => {
    const nodes = [makeNode('a', { components: [makeComp('sp.Skeleton')] })]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Skeleton')).toBe(1)
  })

  it('여러 노드에 걸쳐 같은 타입 누적', () => {
    const nodes = [
      makeNode('a', { components: [makeComp('cc.Label')] }),
      makeNode('b', { components: [makeComp('Label')] }),
      makeNode('c', { components: [makeComp('cc.Label')] }),
    ]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Label')).toBe(3)
  })
})

describe('applyFilter — 타입 기반 노드 필터', () => {
  it('Sprite 타입으로 필터하면 해당 노드만 반환', () => {
    const nodes = [
      makeNode('a', { components: [makeComp('cc.Sprite')] }),
      makeNode('b', { components: [makeComp('cc.Label')] }),
      makeNode('c', { components: [makeComp('Sprite')] }),
    ]
    const result = applyFilter(nodes, ['cc.Sprite', 'Sprite'])
    expect(result).toContain('a')
    expect(result).toContain('c')
    expect(result).not.toContain('b')
  })

  it('일치하는 노드 없으면 빈 배열', () => {
    const nodes = [
      makeNode('a', { components: [makeComp('cc.Label')] }),
    ]
    const result = applyFilter(nodes, ['cc.Sprite', 'Sprite'])
    expect(result).toHaveLength(0)
  })

  it('컴포넌트 없는 노드는 제외', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const result = applyFilter(nodes, ['cc.Sprite'])
    expect(result).toHaveLength(0)
  })

  it('노드가 여러 컴포넌트를 가져도 하나만 일치하면 포함', () => {
    const nodes = [
      makeNode('a', { components: [makeComp('cc.UITransform'), makeComp('cc.Button')] }),
    ]
    const result = applyFilter(nodes, ['cc.Button', 'Button'])
    expect(result).toContain('a')
  })

  it('정확히 일치하는 타입만 통과 (부분 문자열 아님)', () => {
    const nodes = [
      makeNode('a', { components: [makeComp('cc.Sprite2D')] }),
    ]
    // 'cc.Sprite2D'는 FILTER_TYPES의 Sprite 그룹에 없음
    const result = applyFilter(nodes, ['cc.Sprite', 'Sprite'])
    expect(result).toHaveLength(0)
  })
})

describe('FilterPlugin 표시 조건', () => {
  it('nodes < 2이면 표시하지 않음 (hasAny 무관)', () => {
    const nodes = [makeNode('a', { components: [makeComp('cc.Sprite')] })]
    // nodes.length < 2 → null 반환 조건
    expect(nodes.length < 2).toBe(true)
  })

  it('typeCounts 비어 있으면 hasAny=false', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const counts = calcTypeCounts(nodes)
    expect(counts.size === 0).toBe(true)
  })

  it('count가 0인 타입은 버튼 미표시 (count===0 조건)', () => {
    const nodes = [
      makeNode('a', { components: [makeComp('cc.Label')] }),
      makeNode('b', { components: [makeComp('cc.Label')] }),
    ]
    const counts = calcTypeCounts(nodes)
    // Sprite 개수는 0이므로 미표시 대상
    expect(counts.get('Sprite') ?? 0).toBe(0)
    // Label 개수는 2이므로 표시 대상
    expect(counts.get('Label')).toBe(2)
  })
})

describe('FILTER_TYPES 타입 매핑 검증', () => {
  it('cc.Widget → Widget 그룹', () => {
    const nodes = [makeNode('a', { components: [makeComp('cc.Widget')] })]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Widget')).toBe(1)
  })

  it('cc.Animation → Animation 그룹', () => {
    const nodes = [makeNode('a', { components: [makeComp('cc.Animation')] })]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Animation')).toBe(1)
  })

  it('cc.AnimationState → Animation 그룹', () => {
    const nodes = [makeNode('a', { components: [makeComp('cc.AnimationState')] })]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Animation')).toBe(1)
  })

  it('cc.Canvas → Canvas 그룹', () => {
    const nodes = [makeNode('a', { components: [makeComp('cc.Canvas')] })]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('Canvas')).toBe(1)
  })

  it('cc.ScrollView → ScrollView 그룹', () => {
    const nodes = [makeNode('a', { components: [makeComp('cc.ScrollView')] })]
    const counts = calcTypeCounts(nodes)
    expect(counts.get('ScrollView')).toBe(1)
  })
})
