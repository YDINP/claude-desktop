/**
 * component plugin 순수 로직 테스트
 * ComponentPlugin 내부 로직을 순수 함수로 재현하여 검증
 */
import { describe, it, expect } from 'vitest'
import type { CCSceneNode } from '../../../../../../shared/ipc-schema'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, componentTypes: string[] = [], children: CCSceneNode[] = []): CCSceneNode {
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
    components: componentTypes.map(type => ({ type, props: {} })),
    children,
  }
}

function makeRoot(children: CCSceneNode[]): CCSceneNode {
  return makeNode('root', [], children)
}

// ── commonCompTypes 계산 로직 (ComponentPlugin useMemo 재현) ──────────────────
// 선택된 노드들(uuidSet)이 공통으로 가진 컴포넌트 타입만 반환

function calcCommonCompTypes(root: CCSceneNode, uuidSet: Set<string>): string[] {
  const nodeArr: CCSceneNode[] = []
  function collectC(n: CCSceneNode) {
    if (uuidSet.has(n.uuid)) nodeArr.push(n)
    n.children.forEach(collectC)
  }
  collectC(root)
  if (nodeArr.length < 2) return []
  const allTypes = nodeArr.map(n => new Set(n.components.map(c => c.type)))
  return [...allTypes[0]].filter(t => allTypes.every(s => s.has(t)))
}

// ── 컴포넌트 타입 필터 로직 ───────────────────────────────────────────────────
// 특정 타입을 가진 노드만 걸러내는 필터 (일괄 제거 전 필터링에 활용)

function filterNodesByCompType(root: CCSceneNode, uuidSet: Set<string>, compType: string): CCSceneNode[] {
  const result: CCSceneNode[] = []
  function collect(n: CCSceneNode) {
    if (uuidSet.has(n.uuid) && n.components.some(c => c.type === compType)) {
      result.push(n)
    }
    n.children.forEach(collect)
  }
  collect(root)
  return result
}

// ── 컴포넌트 일괄 추가 로직 ──────────────────────────────────────────────────

function addComponentToNodes(nodes: CCSceneNode[], compType: string): CCSceneNode[] {
  return nodes.map(n => {
    if (n.components.some(c => c.type === compType)) return n  // 이미 있으면 스킵
    return { ...n, components: [...n.components, { type: compType, props: {} }] }
  })
}

// ── 컴포넌트 일괄 제거 로직 ──────────────────────────────────────────────────

function removeComponentFromNodes(nodes: CCSceneNode[], compType: string): CCSceneNode[] {
  return nodes.map(n => ({
    ...n,
    components: n.components.filter(c => c.type !== compType),
  }))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('commonCompTypes 계산', () => {
  it('선택 노드가 1개면 빈 배열 반환', () => {
    const root = makeRoot([makeNode('a', ['cc.Sprite'])])
    expect(calcCommonCompTypes(root, new Set(['a']))).toEqual([])
  })

  it('선택 노드가 0개면 빈 배열 반환', () => {
    const root = makeRoot([makeNode('a', ['cc.Sprite'])])
    expect(calcCommonCompTypes(root, new Set([]))).toEqual([])
  })

  it('2개 노드가 동일 컴포넌트 타입을 공유하면 그 타입 반환', () => {
    const root = makeRoot([
      makeNode('a', ['cc.Sprite', 'cc.Widget']),
      makeNode('b', ['cc.Sprite', 'cc.Button']),
    ])
    const result = calcCommonCompTypes(root, new Set(['a', 'b']))
    expect(result).toContain('cc.Sprite')
    expect(result).not.toContain('cc.Widget')
    expect(result).not.toContain('cc.Button')
  })

  it('공통 컴포넌트가 없으면 빈 배열 반환', () => {
    const root = makeRoot([
      makeNode('a', ['cc.Label']),
      makeNode('b', ['cc.Sprite']),
    ])
    expect(calcCommonCompTypes(root, new Set(['a', 'b']))).toEqual([])
  })

  it('3개 이상 노드 모두 공통 타입만 포함', () => {
    const root = makeRoot([
      makeNode('a', ['cc.Sprite', 'cc.Widget', 'cc.Button']),
      makeNode('b', ['cc.Sprite', 'cc.Widget']),
      makeNode('c', ['cc.Sprite']),
    ])
    const result = calcCommonCompTypes(root, new Set(['a', 'b', 'c']))
    expect(result).toEqual(['cc.Sprite'])
  })

  it('트리 깊은 곳의 노드도 탐색한다', () => {
    const grandchild = makeNode('gc', ['cc.Label'])
    const child = makeNode('child', ['cc.Label'], [grandchild])
    const root = makeRoot([child])
    const result = calcCommonCompTypes(root, new Set(['child', 'gc']))
    expect(result).toContain('cc.Label')
  })

  it('uuidSet에 없는 노드는 제외된다', () => {
    const root = makeRoot([
      makeNode('a', ['cc.Sprite']),
      makeNode('b', ['cc.Sprite', 'cc.Label']),
      makeNode('c', ['cc.Label']),  // 선택 안 됨
    ])
    // a, b 선택 → 공통: cc.Sprite
    const result = calcCommonCompTypes(root, new Set(['a', 'b']))
    expect(result).toContain('cc.Sprite')
    expect(result).not.toContain('cc.Label')
  })
})

describe('filterNodesByCompType — 컴포넌트 타입 필터', () => {
  it('해당 타입을 가진 노드만 반환한다', () => {
    const a = makeNode('a', ['cc.Sprite'])
    const b = makeNode('b', ['cc.Label'])
    const root = makeRoot([a, b])
    const result = filterNodesByCompType(root, new Set(['a', 'b']), 'cc.Sprite')
    expect(result).toHaveLength(1)
    expect(result[0].uuid).toBe('a')
  })

  it('일치하는 노드가 없으면 빈 배열', () => {
    const root = makeRoot([makeNode('a', ['cc.Label'])])
    expect(filterNodesByCompType(root, new Set(['a']), 'cc.Sprite')).toHaveLength(0)
  })

  it('uuidSet 외 노드는 타입이 일치해도 제외', () => {
    const root = makeRoot([
      makeNode('a', ['cc.Sprite']),
      makeNode('b', ['cc.Sprite']),
    ])
    const result = filterNodesByCompType(root, new Set(['a']), 'cc.Sprite')
    expect(result).toHaveLength(1)
    expect(result[0].uuid).toBe('a')
  })

  it('노드가 여러 컴포넌트를 가져도 하나만 일치하면 포함', () => {
    const node = makeNode('a', ['cc.UITransform', 'cc.Button', 'cc.Sprite'])
    const root = makeRoot([node])
    const result = filterNodesByCompType(root, new Set(['a']), 'cc.Button')
    expect(result).toHaveLength(1)
  })
})

describe('addComponentToNodes — 컴포넌트 일괄 추가', () => {
  it('컴포넌트를 추가한다', () => {
    const nodes = [makeNode('a', ['cc.Sprite'])]
    const result = addComponentToNodes(nodes, 'cc.Widget')
    expect(result[0].components).toHaveLength(2)
    expect(result[0].components.some(c => c.type === 'cc.Widget')).toBe(true)
  })

  it('이미 있는 컴포넌트는 중복 추가하지 않는다', () => {
    const nodes = [makeNode('a', ['cc.Sprite', 'cc.Widget'])]
    const result = addComponentToNodes(nodes, 'cc.Widget')
    expect(result[0].components).toHaveLength(2)
  })

  it('여러 노드에 일괄 추가된다', () => {
    const nodes = [makeNode('a', []), makeNode('b', ['cc.Label'])]
    const result = addComponentToNodes(nodes, 'cc.Sprite')
    expect(result[0].components.some(c => c.type === 'cc.Sprite')).toBe(true)
    expect(result[1].components.some(c => c.type === 'cc.Sprite')).toBe(true)
  })

  it('원본 노드를 직접 변이하지 않는다 (불변성)', () => {
    const nodes = [makeNode('a', ['cc.Sprite'])]
    const result = addComponentToNodes(nodes, 'cc.Widget')
    expect(nodes[0].components).toHaveLength(1)
    expect(result[0]).not.toBe(nodes[0])
  })
})

describe('removeComponentFromNodes — 컴포넌트 일괄 제거', () => {
  it('해당 타입의 컴포넌트를 제거한다', () => {
    const nodes = [makeNode('a', ['cc.Sprite', 'cc.Widget'])]
    const result = removeComponentFromNodes(nodes, 'cc.Widget')
    expect(result[0].components).toHaveLength(1)
    expect(result[0].components[0].type).toBe('cc.Sprite')
  })

  it('해당 타입이 없으면 변화 없음', () => {
    const nodes = [makeNode('a', ['cc.Sprite', 'cc.Label'])]
    const result = removeComponentFromNodes(nodes, 'cc.Widget')
    expect(result[0].components).toHaveLength(2)
  })

  it('여러 노드에서 일괄 제거된다', () => {
    const nodes = [
      makeNode('a', ['cc.Sprite', 'cc.Button']),
      makeNode('b', ['cc.Label', 'cc.Button']),
    ]
    const result = removeComponentFromNodes(nodes, 'cc.Button')
    expect(result[0].components.some(c => c.type === 'cc.Button')).toBe(false)
    expect(result[1].components.some(c => c.type === 'cc.Button')).toBe(false)
  })

  it('컴포넌트가 없는 노드에 제거해도 오류 없음', () => {
    const nodes = [makeNode('a', [])]
    const result = removeComponentFromNodes(nodes, 'cc.Sprite')
    expect(result[0].components).toHaveLength(0)
  })

  it('원본 노드를 직접 변이하지 않는다 (불변성)', () => {
    const nodes = [makeNode('a', ['cc.Sprite'])]
    removeComponentFromNodes(nodes, 'cc.Sprite')
    expect(nodes[0].components).toHaveLength(1)
  })
})
