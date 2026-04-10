/**
 * useNodeOperations — 노드 조작 로직 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNodeOperations, type UseNodeOperationsProps } from '../useNodeOperations'
import type { CCSceneNode, CCSceneFile, CCFileProjectInfo } from '@shared/ipc-schema'

// ── helpers ────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, extra: Partial<CCSceneNode> = {}, children: CCSceneNode[] = []): CCSceneNode {
  return {
    uuid, name: uuid,
    active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [],
    children,
    ...extra,
  }
}

function makeScene(root: CCSceneNode): CCSceneFile {
  return {
    scenePath: '/test/scene.fire',
    projectInfo: { version: '2x', projectPath: '/test', detected: true },
    root,
    _raw: [{ __type__: 'cc.Node' }],
    scriptNames: {},
  }
}

function makeProps(overrides: Partial<UseNodeOperationsProps> = {}): UseNodeOperationsProps {
  const root = makeNode('root', {}, [makeNode('child1'), makeNode('child2')])
  const sceneFile = makeScene(root)
  return {
    sceneFile,
    projectInfo: { version: '2x', projectPath: '/test', detected: true },
    saveScene: vi.fn().mockResolvedValue({ success: true }),
    loadScene: vi.fn().mockResolvedValue(undefined),
    detectProject: vi.fn(),
    selectedNode: null,
    onSelectNode: vi.fn(),
    dupeOffsetX: 20,
    dupeOffsetY: -20,
    setSaveMsg: vi.fn(),
    ...overrides,
  }
}

// ── handleNodeMove ─────────────────────────────────────────────────────────────

describe('useNodeOperations — handleNodeMove', () => {
  it('지정 uuid 노드의 position(x,y) 변경 후 saveScene 호출', async () => {
    const root = makeNode('root', {}, [makeNode('mv', { position: { x: 0, y: 0, z: 0 } })])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeMove('mv', 50, 100))

    expect(saveScene).toHaveBeenCalledTimes(1)
    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const moved = saved.children.find(c => c.uuid === 'mv')
    expect(moved?.position).toEqual(expect.objectContaining({ x: 50, y: 100 }))
  })

  it('존재하지 않는 uuid — 기존 트리 그대로 저장', async () => {
    const root = makeNode('root', {}, [makeNode('child1')])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeMove('notexist', 10, 20))

    expect(saveScene).toHaveBeenCalled()
  })

  it('sceneFile=null이면 saveScene 미호출', async () => {
    const saveScene = vi.fn()
    const props = makeProps({ sceneFile: null, saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeMove('any', 0, 0))
    expect(saveScene).not.toHaveBeenCalled()
  })
})

// ── handleNodeResize ───────────────────────────────────────────────────────────

describe('useNodeOperations — handleNodeResize', () => {
  it('uuid 노드의 size를 변경', async () => {
    const root = makeNode('root', {}, [makeNode('sz', { size: { x: 100, y: 100 } })])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeResize('sz', 200, 150))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const resized = saved.children.find(c => c.uuid === 'sz')
    expect(resized?.size).toEqual({ x: 200, y: 150 })
  })

  it('소수점 반올림 적용', async () => {
    const root = makeNode('root', {}, [makeNode('sz2')])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeResize('sz2', 100.7, 50.3))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const resized = saved.children.find(c => c.uuid === 'sz2')
    expect(resized?.size).toEqual({ x: 101, y: 50 })
  })
})

// ── handleNodeRotate ───────────────────────────────────────────────────────────

describe('useNodeOperations — handleNodeRotate', () => {
  it('uuid 노드의 rotation.z를 변경', async () => {
    const root = makeNode('root', {}, [makeNode('rot', { rotation: { x: 0, y: 0, z: 0 } })])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeRotate('rot', 45))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const rotated = saved.children.find(c => c.uuid === 'rot')
    expect((rotated?.rotation as { z: number }).z).toBe(45)
  })

  it('rotation 소수 1자리 반올림', async () => {
    const root = makeNode('root', {}, [makeNode('rot2')])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeRotate('rot2', 45.15))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const rotated = saved.children.find(c => c.uuid === 'rot2')
    expect((rotated?.rotation as { z: number }).z).toBe(45.2)
  })
})

// ── handleNodeOpacity ──────────────────────────────────────────────────────────

describe('useNodeOperations — handleNodeOpacity', () => {
  it('uuid 노드의 opacity 변경', async () => {
    const root = makeNode('root', {}, [makeNode('op', { opacity: 255 })])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeOpacity('op', 128))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const node = saved.children.find(c => c.uuid === 'op')
    expect(node?.opacity).toBe(128)
  })

  it('opacity=0 설정 가능', async () => {
    const root = makeNode('root', {}, [makeNode('op2')])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleNodeOpacity('op2', 0))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const node = saved.children.find(c => c.uuid === 'op2')
    expect(node?.opacity).toBe(0)
  })
})

// ── handleMultiMove ────────────────────────────────────────────────────────────

describe('useNodeOperations — handleMultiMove', () => {
  it('여러 노드를 한 번에 이동', async () => {
    const c1 = makeNode('m1', { position: { x: 0, y: 0, z: 0 } })
    const c2 = makeNode('m2', { position: { x: 10, y: 10, z: 0 } })
    const root = makeNode('root', {}, [c1, c2])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleMultiMove([
      { uuid: 'm1', x: 5, y: 5 },
      { uuid: 'm2', x: 20, y: 20 },
    ]))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const moved1 = saved.children.find(c => c.uuid === 'm1')
    const moved2 = saved.children.find(c => c.uuid === 'm2')
    expect(moved1?.position).toEqual(expect.objectContaining({ x: 5, y: 5 }))
    expect(moved2?.position).toEqual(expect.objectContaining({ x: 20, y: 20 }))
  })

  it('sceneFile=null이면 saveScene 미호출', async () => {
    const saveScene = vi.fn()
    const props = makeProps({ sceneFile: null, saveScene })
    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleMultiMove([{ uuid: 'any', x: 0, y: 0 }]))
    expect(saveScene).not.toHaveBeenCalled()
  })
})

// ── handleMultiDelete ──────────────────────────────────────────────────────────

describe('useNodeOperations — handleMultiDelete', () => {
  it('지정 uuid 목록의 노드를 삭제', async () => {
    const c1 = makeNode('del1')
    const c2 = makeNode('del2')
    const c3 = makeNode('keep')
    const root = makeNode('root', {}, [c1, c2, c3])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const onSelectNode = vi.fn()
    const props = makeProps({ sceneFile: makeScene(root), saveScene, onSelectNode })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleMultiDelete(['del1', 'del2']))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    expect(saved.children.find(c => c.uuid === 'del1')).toBeUndefined()
    expect(saved.children.find(c => c.uuid === 'del2')).toBeUndefined()
    expect(saved.children.find(c => c.uuid === 'keep')).toBeDefined()
    expect(onSelectNode).toHaveBeenCalledWith(null)
  })

  it('루트 uuid는 삭제 보호됨', async () => {
    const root = makeNode('root', {}, [makeNode('child')])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleMultiDelete(['root', 'child']))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    // 루트는 보호: 'child'만 삭제됨, root는 존재
    expect(saved.uuid).toBe('root')
    expect(saved.children.find(c => c.uuid === 'child')).toBeUndefined()
  })
})

// ── handleToggleActive ─────────────────────────────────────────────────────────

describe('useNodeOperations — handleToggleActive', () => {
  it('active=true → false로 토글', async () => {
    const root = makeNode('root', {}, [makeNode('toggle', { active: true })])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleToggleActive('toggle'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const toggled = saved.children.find(c => c.uuid === 'toggle')
    expect(toggled?.active).toBe(false)
  })

  it('active=false → true로 토글', async () => {
    const root = makeNode('root', {}, [makeNode('toggle2', { active: false })])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleToggleActive('toggle2'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const toggled = saved.children.find(c => c.uuid === 'toggle2')
    expect(toggled?.active).toBe(true)
  })
})

// ── handleReorder ──────────────────────────────────────────────────────────────

describe('useNodeOperations — handleReorder', () => {
  it('direction=1 (위) — 인덱스 감소', async () => {
    const c1 = makeNode('n1')
    const c2 = makeNode('n2')
    const c3 = makeNode('n3')
    const root = makeNode('root', {}, [c1, c2, c3])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReorder('n2', 1))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    // n2 이동: [n1,n2,n3] → [n2,n1,n3] (direction=1 → newIdx = idx-1 = 0)
    expect(saved.children[0].uuid).toBe('n2')
    expect(saved.children[1].uuid).toBe('n1')
  })

  it('direction=-1 (아래) — 인덱스 증가', async () => {
    const c1 = makeNode('a1')
    const c2 = makeNode('a2')
    const c3 = makeNode('a3')
    const root = makeNode('root', {}, [c1, c2, c3])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReorder('a2', -1))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    // a2 이동: [a1,a2,a3] → [a1,a3,a2] (direction=-1 → newIdx = idx+1 = 2)
    expect(saved.children[1].uuid).toBe('a3')
    expect(saved.children[2].uuid).toBe('a2')
  })

  it('이미 첫 번째 — direction=1 무시', async () => {
    const c1 = makeNode('first')
    const c2 = makeNode('second')
    const root = makeNode('root', {}, [c1, c2])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReorder('first', 1))

    // newIdx = -1 → return n (변경 없음)
    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    expect(saved.children[0].uuid).toBe('first')
  })
})

// ── handleReorderExtreme ───────────────────────────────────────────────────────

describe('useNodeOperations — handleReorderExtreme', () => {
  it('to="first" — 맨 앞으로 이동', async () => {
    const c1 = makeNode('e1')
    const c2 = makeNode('e2')
    const c3 = makeNode('e3')
    const root = makeNode('root', {}, [c1, c2, c3])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReorderExtreme('e3', 'first'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    expect(saved.children[0].uuid).toBe('e3')
  })

  it('to="last" — 맨 뒤로 이동', async () => {
    const c1 = makeNode('f1')
    const c2 = makeNode('f2')
    const c3 = makeNode('f3')
    const root = makeNode('root', {}, [c1, c2, c3])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReorderExtreme('f1', 'last'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    expect(saved.children[2].uuid).toBe('f1')
  })
})

// ── handleSortChildren ─────────────────────────────────────────────────────────

describe('useNodeOperations — handleSortChildren', () => {
  it('알파벳순으로 자식 정렬', async () => {
    const c1 = makeNode('c_node', { name: 'Zebra' })
    const c2 = makeNode('a_node', { name: 'Apple' })
    const c3 = makeNode('b_node', { name: 'Mango' })
    const root = makeNode('root', {}, [c1, c2, c3])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleSortChildren('root'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    expect(saved.children[0].name).toBe('Apple')
    expect(saved.children[1].name).toBe('Mango')
    expect(saved.children[2].name).toBe('Zebra')
  })
})

// ── handleReparent ─────────────────────────────────────────────────────────────

describe('useNodeOperations — handleReparent', () => {
  it('드래그 노드를 다른 부모로 이동', async () => {
    const drag = makeNode('drag')
    const newParent = makeNode('newParent')
    const oldParent = makeNode('oldParent', {}, [drag])
    const root = makeNode('root', {}, [oldParent, newParent])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReparent('drag', 'newParent'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const op = saved.children.find(c => c.uuid === 'oldParent')
    const np = saved.children.find(c => c.uuid === 'newParent')
    expect(op?.children.find(c => c.uuid === 'drag')).toBeUndefined()
    expect(np?.children.find(c => c.uuid === 'drag')).toBeDefined()
  })

  it('자기 자신에게 reparent — 무시', async () => {
    const child = makeNode('self')
    const root = makeNode('root', {}, [child])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReparent('self', 'self'))
    expect(saveScene).not.toHaveBeenCalled()
  })

  it('루트 노드 이동 시도 — 무시', async () => {
    const root = makeNode('root', {}, [makeNode('child')])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReparent('root', 'child'))
    expect(saveScene).not.toHaveBeenCalled()
  })

  it('사이클 방지 — 하위 노드로 이동 시도 무시', async () => {
    const grandchild = makeNode('gc')
    const child = makeNode('ch', {}, [grandchild])
    const root = makeNode('root', {}, [child])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleReparent('ch', 'gc'))
    expect(saveScene).not.toHaveBeenCalled()
  })
})

// ── handleTreeDelete ───────────────────────────────────────────────────────────

describe('useNodeOperations — handleTreeDelete', () => {
  it('자식 노드 삭제', async () => {
    const child = makeNode('td1')
    const root = makeNode('root', {}, [child, makeNode('td2')])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const onSelectNode = vi.fn()
    const props = makeProps({ sceneFile: makeScene(root), saveScene, onSelectNode, selectedNode: child })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleTreeDelete('td1'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    expect(saved.children.find(c => c.uuid === 'td1')).toBeUndefined()
    expect(onSelectNode).toHaveBeenCalledWith(null)
  })

  it('루트 삭제 시도 — 무시', async () => {
    const root = makeNode('root')
    const saveScene = vi.fn()
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleTreeDelete('root'))
    expect(saveScene).not.toHaveBeenCalled()
  })
})

// ── handleRenameInView ─────────────────────────────────────────────────────────

describe('useNodeOperations — handleRenameInView', () => {
  it('빈 이름은 무시', async () => {
    const root = makeNode('root', {}, [makeNode('rn')])
    const saveScene = vi.fn()
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleRenameInView('rn', '   '))
    expect(saveScene).not.toHaveBeenCalled()
  })

  it('정상 이름 변경', async () => {
    const root = makeNode('root', {}, [makeNode('rn2', { name: 'OldName' })])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleRenameInView('rn2', 'NewName'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const renamed = saved.children.find(c => c.uuid === 'rn2')
    expect(renamed?.name).toBe('NewName')
  })
})

// ── runGlobalSearch ────────────────────────────────────────────────────────────

describe('useNodeOperations — runGlobalSearch', () => {
  it('이름으로 검색', () => {
    const c1 = makeNode('n1', { name: 'ButtonNode' })
    const c2 = makeNode('n2', { name: 'LabelNode' })
    const root = makeNode('root', {}, [c1, c2])
    const props = makeProps({ sceneFile: makeScene(root) })

    const { result } = renderHook(() => useNodeOperations(props))
    act(() => result.current.runGlobalSearch('Button'))
    expect(result.current.globalSearchResults).toHaveLength(1)
    expect(result.current.globalSearchResults[0].node.uuid).toBe('n1')
  })

  it('빈 쿼리 — 결과 초기화', () => {
    const root = makeNode('root', {}, [makeNode('c1')])
    const props = makeProps({ sceneFile: makeScene(root) })

    const { result } = renderHook(() => useNodeOperations(props))
    act(() => result.current.runGlobalSearch('c1'))
    act(() => result.current.runGlobalSearch(''))
    expect(result.current.globalSearchResults).toHaveLength(0)
  })

  it('대소문자 무시 검색', () => {
    const c1 = makeNode('n3', { name: 'PlayerSprite' })
    const root = makeNode('root', {}, [c1])
    const props = makeProps({ sceneFile: makeScene(root) })

    const { result } = renderHook(() => useNodeOperations(props))
    act(() => result.current.runGlobalSearch('player'))
    expect(result.current.globalSearchResults).toHaveLength(1)
  })

  it('uuid 검색 (#prefix)', () => {
    const c1 = makeNode('abc123', { name: 'TestNode' })
    const root = makeNode('root', {}, [c1])
    const props = makeProps({ sceneFile: makeScene(root) })

    const { result } = renderHook(() => useNodeOperations(props))
    act(() => result.current.runGlobalSearch('#abc123'))
    expect(result.current.globalSearchResults.some(r => r.node.uuid === 'abc123')).toBe(true)
  })

  it('최대 50개 결과 제한', () => {
    const children: CCSceneNode[] = []
    for (let i = 0; i < 100; i++) {
      children.push(makeNode(`n${i}`, { name: `Node${i}` }))
    }
    const root = makeNode('root', {}, children)
    const props = makeProps({ sceneFile: makeScene(root) })

    const { result } = renderHook(() => useNodeOperations(props))
    act(() => result.current.runGlobalSearch('Node'))
    expect(result.current.globalSearchResults.length).toBeLessThanOrEqual(50)
  })
})

// ── handleLabelEdit ────────────────────────────────────────────────────────────

describe('useNodeOperations — handleLabelEdit', () => {
  it('cc.Label 컴포넌트의 string 변경', async () => {
    const child = makeNode('lbl', {}, [])
    child.components = [{ type: 'cc.Label', props: { string: 'old text' }, _rawIndex: 0 }]
    const root = makeNode('root', {}, [child])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleLabelEdit('lbl', 'new text'))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const lblNode = saved.children.find(c => c.uuid === 'lbl')
    expect(lblNode?.components[0].props.string).toBe('new text')
  })

  it('Label 없는 노드 — 변경 없음', async () => {
    const child = makeNode('no-lbl')
    const root = makeNode('root', {}, [child])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleLabelEdit('no-lbl', 'text'))

    // saveScene은 호출됐지만 props 변경 없음
    expect(saveScene).toHaveBeenCalled()
  })
})

// ── handleAnchorMove ───────────────────────────────────────────────────────────

describe('useNodeOperations — handleAnchorMove', () => {
  it('앵커 변경 시 position도 보정됨', async () => {
    const child = makeNode('an', {
      anchor: { x: 0.5, y: 0.5 },
      size: { x: 100, y: 100 },
      position: { x: 0, y: 0, z: 0 },
    })
    const root = makeNode('root', {}, [child])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    // 앵커를 (0.5, 0.5) → (0, 0) 변경
    await act(() => result.current.handleAnchorMove('an', 0, 0))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const moved = saved.children.find(c => c.uuid === 'an')
    expect(moved?.anchor).toEqual({ x: 0, y: 0 })
    // position 보정: (0 - 0.5) * 100 = -50
    expect((moved?.position as { x: number; y: number }).x).toBeCloseTo(-50, 1)
  })

  it('앵커 0~1 범위 클램핑', async () => {
    const child = makeNode('an2', { anchor: { x: 0.5, y: 0.5 }, size: { x: 100, y: 100 }, position: { x: 0, y: 0, z: 0 } })
    const root = makeNode('root', {}, [child])
    const saveScene = vi.fn().mockResolvedValue({ success: true })
    const props = makeProps({ sceneFile: makeScene(root), saveScene })

    const { result } = renderHook(() => useNodeOperations(props))
    await act(() => result.current.handleAnchorMove('an2', 1.5, -0.5))

    const saved = saveScene.mock.calls[0][0] as CCSceneNode
    const moved = saved.children.find(c => c.uuid === 'an2')
    expect((moved?.anchor as { x: number; y: number }).x).toBe(1)
    expect((moved?.anchor as { x: number; y: number }).y).toBe(0)
  })
})
