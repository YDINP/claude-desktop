/**
 * useKeyboardShortcuts — 키보드 단축키 훅 단위 테스트
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { useKeyboardShortcuts, type UseKeyboardShortcutsProps } from '../useKeyboardShortcuts'

// ── helpers ────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, children: CCSceneNode[] = []): CCSceneNode {
  return {
    uuid, name: uuid, active: true,
    position: { x: 10, y: 20, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [], children,
  }
}

function makeSceneFile(root: CCSceneNode): CCSceneFile {
  return {
    scenePath: '/test/scene.fire',
    projectInfo: { version: '2x', projectPath: '/test', detected: true },
    root,
    _raw: [],
    scriptNames: {},
  }
}

const rootNode = makeNode('root', [
  makeNode('child1', [makeNode('grandchild1')]),
  makeNode('child2'),
])

function makeProps(overrides: Partial<UseKeyboardShortcutsProps> = {}): UseKeyboardShortcutsProps {
  const parentMap = new Map<string, string>([
    ['child1', 'root'],
    ['child2', 'root'],
    ['grandchild1', 'child1'],
  ])
  const nodeMap = new Map<string, CCSceneNode>([
    ['root', rootNode],
    ['child1', rootNode.children[0]],
    ['child2', rootNode.children[1]],
    ['grandchild1', rootNode.children[0].children[0]],
  ])
  return {
    sceneFile: makeSceneFile(rootNode),
    saveScene: vi.fn().mockResolvedValue({ success: true }),
    canUndo: true,
    canRedo: true,
    undo: vi.fn().mockResolvedValue({ success: true }),
    redo: vi.fn().mockResolvedValue({ success: true }),
    selectedNode: null,
    onSelectNode: vi.fn(),
    handleSave: vi.fn(),
    nodeOps: {
      handleTreeDelete: vi.fn(),
      handleTreeDuplicate: vi.fn(),
      setGlobalSearchOpen: vi.fn(),
      globalSearchOpen: false,
      setGlobalSearchQuery: vi.fn(),
      setGlobalSearchResults: vi.fn(),
      globalSearchInputRef: { current: null },
    },
    setMultiSelectedUuids: vi.fn(),
    parentMap,
    nodeMap,
    clipboardRef: { current: null },
    nodeBookmarks: {},
    setNodeBookmarks: vi.fn(),
    setJsonCopiedName: vi.fn(),
    ...overrides,
  }
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key, bubbles: true, cancelable: true,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    ...opts,
  })
  window.dispatchEvent(event)
  return event
}

// ── Ctrl+S ─────────────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — Ctrl+S', () => {
  it('Ctrl+S 입력 시 handleSave 호출', () => {
    const props = makeProps()
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('s', { ctrlKey: true })
    expect(props.handleSave).toHaveBeenCalledOnce()
  })

  it('sceneFile null이면 Ctrl+S 무반응', () => {
    const props = makeProps({ sceneFile: null })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('s', { ctrlKey: true })
    expect(props.handleSave).not.toHaveBeenCalled()
  })
})

// ── Ctrl+Z / Ctrl+Y ────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — undo/redo', () => {
  it('Ctrl+Z 입력 시 undo 호출', () => {
    const props = makeProps()
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('z', { ctrlKey: true })
    expect(props.undo).toHaveBeenCalledOnce()
  })

  it('canUndo=false 이면 Ctrl+Z 무반응', () => {
    const props = makeProps({ canUndo: false })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('z', { ctrlKey: true })
    expect(props.undo).not.toHaveBeenCalled()
  })

  it('Ctrl+Y 입력 시 redo 호출', () => {
    const props = makeProps()
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('y', { ctrlKey: true })
    expect(props.redo).toHaveBeenCalledOnce()
  })

  it('canRedo=false 이면 Ctrl+Y 무반응', () => {
    const props = makeProps({ canRedo: false })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('y', { ctrlKey: true })
    expect(props.redo).not.toHaveBeenCalled()
  })
})

// ── Escape ─────────────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — Escape (R1658)', () => {
  it('Escape + 자식 노드 선택 시 부모 노드로 이동', () => {
    const onSelectNode = vi.fn()
    const props = makeProps({
      selectedNode: rootNode.children[0], // child1
      onSelectNode,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('Escape')
    // child1의 부모는 root
    expect(onSelectNode).toHaveBeenCalledWith(rootNode)
  })

  it('Escape + 루트 노드 선택 시 선택 해제', () => {
    const onSelectNode = vi.fn()
    const props = makeProps({
      selectedNode: rootNode,
      onSelectNode,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('Escape')
    expect(onSelectNode).toHaveBeenCalledWith(null)
  })

  it('Escape + 선택 없으면 null로 onSelectNode 호출', () => {
    const onSelectNode = vi.fn()
    const props = makeProps({ selectedNode: null, onSelectNode })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('Escape')
    expect(onSelectNode).toHaveBeenCalledWith(null)
  })
})

// ── Delete ─────────────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — Delete', () => {
  it('Delete + 자식 노드 선택 시 handleTreeDelete 호출', () => {
    const props = makeProps({ selectedNode: rootNode.children[0] })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('Delete')
    expect(props.nodeOps.handleTreeDelete).toHaveBeenCalledWith('child1')
  })

  it('루트 노드 선택 시 Delete 무반응 (루트 보호)', () => {
    const props = makeProps({ selectedNode: rootNode })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('Delete')
    expect(props.nodeOps.handleTreeDelete).not.toHaveBeenCalled()
  })

  it('선택 없으면 Delete 무반응', () => {
    const props = makeProps({ selectedNode: null })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('Delete')
    expect(props.nodeOps.handleTreeDelete).not.toHaveBeenCalled()
  })
})

// ── Ctrl+D ─────────────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — Ctrl+D', () => {
  it('Ctrl+D + 노드 선택 시 handleTreeDuplicate 호출', () => {
    const props = makeProps({ selectedNode: rootNode.children[0] })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('d', { ctrlKey: true })
    expect(props.nodeOps.handleTreeDuplicate).toHaveBeenCalledWith('child1')
  })

  it('노드 선택 없으면 Ctrl+D 무반응', () => {
    const props = makeProps({ selectedNode: null })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('d', { ctrlKey: true })
    expect(props.nodeOps.handleTreeDuplicate).not.toHaveBeenCalled()
  })
})

// ── Ctrl+A (R1688) ─────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — Ctrl+A 전체 선택 (R1688)', () => {
  it('Ctrl+A 입력 시 모든 하위 노드 uuid로 setMultiSelectedUuids 호출', () => {
    const setMultiSelectedUuids = vi.fn()
    const props = makeProps({ setMultiSelectedUuids })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('a', { ctrlKey: true })
    expect(setMultiSelectedUuids).toHaveBeenCalledOnce()
    const uuids = setMultiSelectedUuids.mock.calls[0][0] as string[]
    expect(uuids).toContain('child1')
    expect(uuids).toContain('child2')
    expect(uuids).toContain('grandchild1')
  })
})

// ── Arrow keys (위치 이동) ─────────────────────────────────────────────────────

describe('useKeyboardShortcuts — Arrow 위치 이동', () => {
  it('ArrowRight + 노드 선택 시 saveScene 호출 (x+1)', () => {
    const props = makeProps({ selectedNode: rootNode.children[0] })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('ArrowRight')
    expect(props.saveScene).toHaveBeenCalledOnce()
    const newRoot = (props.saveScene as ReturnType<typeof vi.fn>).mock.calls[0][0] as CCSceneNode
    const moved = newRoot.children.find(c => c.uuid === 'child1')!
    expect((moved.position as { x: number }).x).toBe(11) // 10 + 1
  })

  it('ArrowLeft + 노드 선택 시 x-1', () => {
    const props = makeProps({ selectedNode: rootNode.children[0] })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('ArrowLeft')
    expect(props.saveScene).toHaveBeenCalledOnce()
    const newRoot = (props.saveScene as ReturnType<typeof vi.fn>).mock.calls[0][0] as CCSceneNode
    const moved = newRoot.children.find(c => c.uuid === 'child1')!
    expect((moved.position as { x: number }).x).toBe(9) // 10 - 1
  })

  it('ArrowUp + 노드 선택 시 y+1 (CC 좌표계)', () => {
    const props = makeProps({ selectedNode: rootNode.children[0] })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('ArrowUp')
    expect(props.saveScene).toHaveBeenCalledOnce()
    const newRoot = (props.saveScene as ReturnType<typeof vi.fn>).mock.calls[0][0] as CCSceneNode
    const moved = newRoot.children.find(c => c.uuid === 'child1')!
    expect((moved.position as { y: number }).y).toBe(21) // 20 + 1
  })

  it('ArrowDown + 노드 선택 시 y-1', () => {
    const props = makeProps({ selectedNode: rootNode.children[0] })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('ArrowDown')
    expect(props.saveScene).toHaveBeenCalledOnce()
    const newRoot = (props.saveScene as ReturnType<typeof vi.fn>).mock.calls[0][0] as CCSceneNode
    const moved = newRoot.children.find(c => c.uuid === 'child1')!
    expect((moved.position as { y: number }).y).toBe(19) // 20 - 1
  })

  it('Shift+ArrowRight + 노드 선택 시 x+10 (10배 이동)', () => {
    const props = makeProps({ selectedNode: rootNode.children[0] })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('ArrowRight', { shiftKey: true })
    expect(props.saveScene).toHaveBeenCalledOnce()
    const newRoot = (props.saveScene as ReturnType<typeof vi.fn>).mock.calls[0][0] as CCSceneNode
    const moved = newRoot.children.find(c => c.uuid === 'child1')!
    expect((moved.position as { x: number }).x).toBe(20) // 10 + 10
  })

  it('노드 선택 없으면 Arrow 무반응', () => {
    const props = makeProps({ selectedNode: null })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('ArrowRight')
    expect(props.saveScene).not.toHaveBeenCalled()
  })
})

// ── [ / ] 형제 순환 (R1657) ───────────────────────────────────────────────────

describe('useKeyboardShortcuts — [ / ] 형제 순환 (R1657)', () => {
  it('] 키 입력 시 다음 형제 노드로 이동', () => {
    const onSelectNode = vi.fn()
    const props = makeProps({
      selectedNode: rootNode.children[0], // child1 (index 0)
      onSelectNode,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey(']')
    // child1 → child2
    expect(onSelectNode).toHaveBeenCalledWith(rootNode.children[1])
  })

  it('[ 키 입력 시 이전 형제 노드로 이동', () => {
    const onSelectNode = vi.fn()
    const props = makeProps({
      selectedNode: rootNode.children[1], // child2 (index 1)
      onSelectNode,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('[')
    // child2 → child1
    expect(onSelectNode).toHaveBeenCalledWith(rootNode.children[0])
  })

  it('마지막 형제에서 ] 키 → 첫 번째 형제로 순환', () => {
    const onSelectNode = vi.fn()
    const props = makeProps({
      selectedNode: rootNode.children[1], // child2 (last)
      onSelectNode,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey(']')
    // child2 → child1 (wrap around)
    expect(onSelectNode).toHaveBeenCalledWith(rootNode.children[0])
  })
})

// ── Ctrl+F (R1430) ────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — Ctrl+F 검색 (R1430)', () => {
  it('Ctrl+F 입력 시 setGlobalSearchOpen(true) 호출', () => {
    const props = makeProps()
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('f', { ctrlKey: true })
    expect(props.nodeOps.setGlobalSearchOpen).toHaveBeenCalledWith(true)
  })

  it('Escape + globalSearchOpen=true 이면 검색 닫기', () => {
    const props = makeProps({
      nodeOps: {
        ...makeProps().nodeOps,
        globalSearchOpen: true,
        setGlobalSearchOpen: vi.fn(),
        setGlobalSearchQuery: vi.fn(),
        setGlobalSearchResults: vi.fn(),
      },
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('Escape')
    expect(props.nodeOps.setGlobalSearchOpen).toHaveBeenCalledWith(false)
    expect(props.nodeOps.setGlobalSearchQuery).toHaveBeenCalledWith('')
  })
})

// ── Ctrl+1-9 북마크 (R1672) ───────────────────────────────────────────────────

describe('useKeyboardShortcuts — 북마크 (R1672)', () => {
  it('Ctrl+1 + 노드 선택 시 setNodeBookmarks 호출', () => {
    const setNodeBookmarks = vi.fn()
    const props = makeProps({
      selectedNode: rootNode.children[0],
      setNodeBookmarks,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('1', { ctrlKey: true })
    expect(setNodeBookmarks).toHaveBeenCalledOnce()
    // updater 함수로 호출됨
    const updater = setNodeBookmarks.mock.calls[0][0] as (prev: Record<string, string>) => Record<string, string>
    const result = updater({})
    expect(result['1']).toBe('child1')
  })

  it('북마크 있는 키 누르면 해당 노드로 이동', () => {
    const onSelectNode = vi.fn()
    const props = makeProps({
      nodeBookmarks: { '2': 'child2' },
      onSelectNode,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('2')
    expect(onSelectNode).toHaveBeenCalledWith(rootNode.children[1])
  })

  it('북마크 없는 키 누르면 무반응', () => {
    const onSelectNode = vi.fn()
    const props = makeProps({ nodeBookmarks: {}, onSelectNode })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('5')
    expect(onSelectNode).not.toHaveBeenCalled()
  })
})

// ── Ctrl+C / Ctrl+V 클립보드 ──────────────────────────────────────────────────

describe('useKeyboardShortcuts — Ctrl+C 클립보드', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('Ctrl+C + 선택 노드 있으면 clipboardRef에 노드 저장', () => {
    const clipboardRef = { current: null as CCSceneNode | null }
    const props = makeProps({
      selectedNode: rootNode.children[0],
      clipboardRef,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('c', { ctrlKey: true })
    expect(clipboardRef.current).toBe(rootNode.children[0])
  })

  it('Ctrl+C + 선택 없으면 clipboardRef 변경 없음', () => {
    const clipboardRef = { current: null as CCSceneNode | null }
    const props = makeProps({ selectedNode: null, clipboardRef })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('c', { ctrlKey: true })
    expect(clipboardRef.current).toBeNull()
  })

  it('Ctrl+Shift+C 입력 시 setJsonCopiedName 호출', () => {
    const setJsonCopiedName = vi.fn()
    const props = makeProps({
      selectedNode: rootNode.children[0],
      setJsonCopiedName,
    })
    renderHook(() => useKeyboardShortcuts(props))
    fireKey('c', { ctrlKey: true, shiftKey: true })
    expect(setJsonCopiedName).toHaveBeenCalledWith(expect.any(String))
  })
})

// ── 언마운트 시 이벤트 제거 ────────────────────────────────────────────────────

describe('useKeyboardShortcuts — 정리', () => {
  it('훅 언마운트 시 keydown 이벤트 리스너가 제거된다', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const props = makeProps()
    const { unmount } = renderHook(() => useKeyboardShortcuts(props))
    const addCount = addSpy.mock.calls.filter(c => c[0] === 'keydown').length
    unmount()
    const removeCount = removeSpy.mock.calls.filter(c => c[0] === 'keydown').length
    expect(removeCount).toBeGreaterThanOrEqual(addCount)
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
