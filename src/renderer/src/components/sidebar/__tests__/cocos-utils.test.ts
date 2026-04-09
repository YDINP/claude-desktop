import { describe, it, expect } from 'vitest'
import type { CCSceneNode } from '@shared/ipc-schema'
import { validateScene, extractPrefabEntries, deepCopyNodeWithNewUuids } from '../cocos-utils'

// -----------------------------------------------------------------------
// 헬퍼
// -----------------------------------------------------------------------

function makeNode(override: Partial<CCSceneNode> & { uuid: string; name: string }): CCSceneNode {
  return {
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
    ...override,
  }
}

const canvasNode = (uuid: string) =>
  makeNode({ uuid, name: 'Canvas', components: [{ type: 'cc.Canvas', props: {} }] })

// -----------------------------------------------------------------------
// validateScene
// -----------------------------------------------------------------------

describe('validateScene', () => {
  it('정상 씬 — 이슈 없음', () => {
    const root = makeNode({ uuid: 'root', name: 'Scene', children: [canvasNode('c1')] })
    expect(validateScene(root)).toHaveLength(0)
  })

  it('UUID 중복 → error 이슈 반환', () => {
    const child1 = makeNode({ uuid: 'dup', name: 'A' })
    const child2 = makeNode({ uuid: 'dup', name: 'B' })
    const root = makeNode({ uuid: 'root', name: 'Scene', children: [canvasNode('cv'), child1, child2] })
    const issues = validateScene(root)
    const err = issues.filter(i => i.level === 'error')
    expect(err.length).toBeGreaterThan(0)
    expect(err[0].message).toMatch('UUID 중복')
  })

  it('이름 빈 노드 → warning', () => {
    const empty = makeNode({ uuid: 'e1', name: '' })
    const root = makeNode({ uuid: 'root', name: 'Scene', children: [canvasNode('cv'), empty] })
    const issues = validateScene(root)
    expect(issues.some(i => i.message.includes('이름 빈 노드'))).toBe(true)
  })

  it('Canvas 없는 씬(자식 있음) → warning', () => {
    const root = makeNode({ uuid: 'root', name: 'Scene', children: [makeNode({ uuid: 'n1', name: 'Node' })] })
    const issues = validateScene(root)
    expect(issues.some(i => i.message.includes('Canvas'))).toBe(true)
  })

  it('자식 없는 루트 → Canvas 경고 없음', () => {
    const root = makeNode({ uuid: 'root', name: 'Scene' })
    const issues = validateScene(root)
    expect(issues.some(i => i.message.includes('Canvas'))).toBe(false)
  })

  it('비활성 부모 아래 활성 자식 → warning', () => {
    const child = makeNode({ uuid: 'child', name: 'Child', active: true })
    const parent = makeNode({ uuid: 'parent', name: 'Parent', active: false, children: [child] })
    const root = makeNode({ uuid: 'root', name: 'Scene', children: [canvasNode('cv'), parent] })
    const issues = validateScene(root)
    expect(issues.some(i => i.message.includes('비활성 부모'))).toBe(true)
  })

  it('깊이 > 8 → warning', () => {
    // depth 9짜리 노드 생성 (walk는 root를 depth=0으로 시작)
    let deep = makeNode({ uuid: 'deep9', name: 'Deep9' })
    for (let i = 8; i >= 1; i--) {
      deep = makeNode({ uuid: `d${i}`, name: `D${i}`, children: [deep] })
    }
    const root = makeNode({ uuid: 'root', name: 'Scene', children: [canvasNode('cv'), deep] })
    const issues = validateScene(root)
    expect(issues.some(i => i.message.includes('계층 깊이'))).toBe(true)
  })
})

// -----------------------------------------------------------------------
// extractPrefabEntries
// -----------------------------------------------------------------------

describe('extractPrefabEntries', () => {
  it('단일 노드 → prefab 헤더 + 노드 1개 = 총 2개 엔트리', () => {
    const raw = [
      { _name: 'Node', _components: [], _children: [] },
    ]
    const result = extractPrefabEntries(raw, 0)
    expect(result).toHaveLength(2)
    expect((result[0] as Record<string, unknown>).__type__).toBe('cc.Prefab')
  })

  it('루트 노드의 _parent는 null로 재매핑된다', () => {
    const raw = [
      { _name: 'Node', _parent: { __id__: 99 }, _components: [], _children: [] },
    ]
    const result = extractPrefabEntries(raw, 0)
    const nodeEntry = result[1] as Record<string, unknown>
    expect(nodeEntry._parent).toBeNull()
  })

  it('children __id__ 참조가 새 인덱스로 재매핑된다', () => {
    const raw = [
      { _name: 'Root', _components: [], _children: [{ __id__: 1 }] },
      { _name: 'Child', _parent: { __id__: 0 }, _components: [], _children: [] },
    ]
    const result = extractPrefabEntries(raw, 0)
    // Root(idx=1), Child(idx=2)
    expect(result).toHaveLength(3) // header + Root + Child
    const rootEntry = result[1] as Record<string, unknown>
    const children = rootEntry._children as { __id__: number }[]
    expect(children[0].__id__).toBe(2) // Child는 새 idx 2
  })
})

// -----------------------------------------------------------------------
// deepCopyNodeWithNewUuids
// -----------------------------------------------------------------------

describe('deepCopyNodeWithNewUuids', () => {
  it('최상위 노드 이름에 _Copy suffix가 붙는다', () => {
    const node = makeNode({ uuid: 'orig', name: 'Button' })
    const copy = deepCopyNodeWithNewUuids(node)
    expect(copy.name).toBe('Button_Copy')
  })

  it('커스텀 suffix 사용 가능', () => {
    const node = makeNode({ uuid: 'orig', name: 'Panel' })
    const copy = deepCopyNodeWithNewUuids(node, '_Clone')
    expect(copy.name).toBe('Panel_Clone')
  })

  it('UUID가 원본과 다르다', () => {
    const node = makeNode({ uuid: 'orig-uuid', name: 'Node' })
    const copy = deepCopyNodeWithNewUuids(node)
    expect(copy.uuid).not.toBe('orig-uuid')
  })

  it('자식 노드는 suffix가 붙지 않는다', () => {
    const child = makeNode({ uuid: 'child-uuid', name: 'Child' })
    const parent = makeNode({ uuid: 'parent-uuid', name: 'Parent', children: [child] })
    const copy = deepCopyNodeWithNewUuids(parent)
    expect(copy.children[0].name).toBe('Child')
  })

  it('자식 노드 UUID도 새로 생성된다', () => {
    const child = makeNode({ uuid: 'child-uuid', name: 'Child' })
    const parent = makeNode({ uuid: 'parent-uuid', name: 'Parent', children: [child] })
    const copy = deepCopyNodeWithNewUuids(parent)
    expect(copy.children[0].uuid).not.toBe('child-uuid')
  })

  it('원본과 복사본이 서로 다른 객체 (깊은 복사)', () => {
    const node = makeNode({ uuid: 'orig', name: 'Node', components: [{ type: 'cc.Label', props: { string: 'hi' } }] })
    const copy = deepCopyNodeWithNewUuids(node)
    copy.components[0].props = { string: 'changed' }
    expect((node.components[0].props as Record<string, unknown>).string).toBe('hi')
  })

  it('컴포넌트의 _rawIndex가 undefined로 초기화된다', () => {
    const node = makeNode({
      uuid: 'orig',
      name: 'Node',
      components: [{ type: 'cc.Sprite', props: {}, _rawIndex: 5 } as unknown as import('@shared/ipc-schema').CCSceneComponent],
    })
    const copy = deepCopyNodeWithNewUuids(node)
    expect((copy.components[0] as unknown as Record<string, unknown>)._rawIndex).toBeUndefined()
  })
})
