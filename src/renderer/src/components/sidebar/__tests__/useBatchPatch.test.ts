import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBatchPatch } from '../hooks/useBatchPatch'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, children: CCSceneNode[] = []): CCSceneNode {
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
    children,
  }
}

function makeSceneFile(root: CCSceneNode): CCSceneFile {
  return {
    scenePath: '/test/scene.fire',
    projectInfo: { version: '2x', projectPath: '/test' },
    root,
    _raw: [],
  }
}

describe('useBatchPatch', () => {
  let saveScene: ReturnType<typeof vi.fn>
  let setBatchMsg: ReturnType<typeof vi.fn>

  beforeEach(() => {
    saveScene = vi.fn().mockResolvedValue({ success: true })
    setBatchMsg = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  function setup(uuids: string[], root: CCSceneNode) {
    const sceneFile = makeSceneFile(root)
    const uuidSet = new Set(uuids)
    return renderHook(() =>
      useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })
    )
  }

  // ── patchNodes ─────────────────────────────────────────────────────────────

  describe('patchNodes', () => {
    it('uuidSet에 포함된 노드에만 patcher를 적용한다', async () => {
      const root = makeNode('root', [
        makeNode('target'),
        makeNode('other'),
      ])
      const { result } = setup(['target'], root)

      await act(async () => {
        await result.current.patchNodes(
          n => ({ ...n, opacity: 100 }),
          '테스트'
        )
      })

      expect(saveScene).toHaveBeenCalledOnce()
      const savedRoot: CCSceneNode = saveScene.mock.calls[0][0]
      const target = savedRoot.children.find(c => c.uuid === 'target')!
      const other = savedRoot.children.find(c => c.uuid === 'other')!
      expect(target.opacity).toBe(100)
      expect(other.opacity).toBe(255)
    })

    it('saveScene이 호출된다', async () => {
      const root = makeNode('root', [makeNode('a')])
      const { result } = setup(['a'], root)

      await act(async () => {
        await result.current.patchNodes(n => n, 'label')
      })

      expect(saveScene).toHaveBeenCalledOnce()
    })

    it('setBatchMsg가 성공 메시지로 호출된다', async () => {
      const root = makeNode('root', [makeNode('a')])
      const { result } = setup(['a'], root)

      await act(async () => {
        await result.current.patchNodes(n => n, '적용')
      })

      expect(setBatchMsg).toHaveBeenCalledWith('✓ 적용')
    })

    it('2초 후 setBatchMsg(null)이 호출된다', async () => {
      const root = makeNode('root', [makeNode('a')])
      const { result } = setup(['a'], root)

      await act(async () => {
        await result.current.patchNodes(n => n, 'label')
      })

      act(() => { vi.advanceTimersByTime(2000) })
      expect(setBatchMsg).toHaveBeenLastCalledWith(null)
    })

    it('root가 없으면 saveScene을 호출하지 않는다', async () => {
      const sceneFile: CCSceneFile = {
        scenePath: '/test/scene.fire',
        projectInfo: { version: '2x', projectPath: '/test' },
        root: null as unknown as CCSceneNode,
        _raw: [],
      }
      const { result } = renderHook(() =>
        useBatchPatch({
          sceneFile,
          saveScene,
          uuidSet: new Set(['a']),
          uuids: ['a'],
          setBatchMsg,
        })
      )

      await act(async () => {
        await result.current.patchNodes(n => n, 'label')
      })

      expect(saveScene).not.toHaveBeenCalled()
    })

    it('중첩 트리에서도 올바르게 walk한다', async () => {
      const deep = makeNode('deep')
      const mid = makeNode('mid', [deep])
      const root = makeNode('root', [mid])
      const { result } = setup(['deep'], root)

      await act(async () => {
        await result.current.patchNodes(n => ({ ...n, opacity: 50 }), 'deep patch')
      })

      const savedRoot: CCSceneNode = saveScene.mock.calls[0][0]
      const midNode = savedRoot.children[0]
      const deepNode = midNode.children[0]
      expect(deepNode.opacity).toBe(50)
      expect(midNode.opacity).toBe(255)
    })

    it('연속 호출 시 타이머가 리셋된다', async () => {
      const root = makeNode('root', [makeNode('a')])
      const { result } = setup(['a'], root)

      await act(async () => {
        await result.current.patchNodes(n => n, '첫번째')
      })
      act(() => { vi.advanceTimersByTime(1000) })

      await act(async () => {
        await result.current.patchNodes(n => n, '두번째')
      })
      act(() => { vi.advanceTimersByTime(1000) })

      // 아직 null 호출 안 됨 (2초 미경과)
      expect(setBatchMsg).not.toHaveBeenLastCalledWith(null)

      act(() => { vi.advanceTimersByTime(1000) })
      expect(setBatchMsg).toHaveBeenLastCalledWith(null)
    })
  })

  // ── patchComponents ────────────────────────────────────────────────────────

  describe('patchComponents', () => {
    function makeNodeWithComp(uuid: string, comp: CCSceneComponent): CCSceneNode {
      const n = makeNode(uuid)
      return { ...n, components: [comp] }
    }

    it('매칭 컴포넌트에만 patcher를 적용한다', async () => {
      const comp: CCSceneComponent = { type: 'cc.Label', props: { fontSize: 24 } }
      const root = makeNode('root', [makeNodeWithComp('target', comp)])
      const { result } = setup(['target'], root)

      await act(async () => {
        await result.current.patchComponents(
          c => c.type === 'cc.Label',
          c => ({ ...c, props: { ...c.props, fontSize: 48 } }),
          '폰트 크기'
        )
      })

      const savedRoot: CCSceneNode = saveScene.mock.calls[0][0]
      const target = savedRoot.children[0]
      expect(target.components[0].props?.fontSize).toBe(48)
    })

    it('uuidSet에 없는 노드는 컴포넌트를 수정하지 않는다', async () => {
      const comp: CCSceneComponent = { type: 'cc.Label', props: { fontSize: 24 } }
      const root = makeNode('root', [makeNodeWithComp('other', comp)])
      const { result } = setup(['notInSet'], root)

      await act(async () => {
        await result.current.patchComponents(
          c => c.type === 'cc.Label',
          c => ({ ...c, props: { ...c.props, fontSize: 99 } }),
          '수정'
        )
      })

      const savedRoot: CCSceneNode = saveScene.mock.calls[0][0]
      const other = savedRoot.children[0]
      expect(other.components[0].props?.fontSize).toBe(24)
    })

    it('매칭하지 않는 타입의 컴포넌트는 변경하지 않는다', async () => {
      const comp: CCSceneComponent = { type: 'cc.Sprite', props: { alpha: 1 } }
      const root = makeNode('root', [{ ...makeNode('target'), components: [comp] }])
      const { result } = setup(['target'], root)

      await act(async () => {
        await result.current.patchComponents(
          c => c.type === 'cc.Label',
          c => ({ ...c, props: { ...c.props, fontSize: 99 } }),
          '수정'
        )
      })

      const savedRoot: CCSceneNode = saveScene.mock.calls[0][0]
      expect(savedRoot.children[0].components[0].type).toBe('cc.Sprite')
    })

    it('setBatchMsg가 성공 메시지로 호출된다', async () => {
      const root = makeNode('root', [makeNode('a')])
      const { result } = setup(['a'], root)

      await act(async () => {
        await result.current.patchComponents(() => false, c => c, '컴포넌트 적용')
      })

      expect(setBatchMsg).toHaveBeenCalledWith('✓ 컴포넌트 적용')
    })
  })

  // ── patchOrdered ──────────────────────────────────────────────────────────

  describe('patchOrdered', () => {
    it('선택된 노드에 인덱스 기반 패치를 적용한다', async () => {
      const nodes = ['a', 'b', 'c'].map(u => makeNode(u))
      const root = makeNode('root', nodes)
      const { result } = setup(['a', 'b', 'c'], root)

      const opacities: number[] = []
      await act(async () => {
        await result.current.patchOrdered(
          (n, idx, total) => ({ ...n, opacity: Math.round((idx / (total - 1)) * 255) }),
          '그라데이션'
        )
      })

      const savedRoot: CCSceneNode = saveScene.mock.calls[0][0]
      expect(savedRoot.children[0].opacity).toBe(0)   // idx=0
      expect(savedRoot.children[2].opacity).toBe(255) // idx=2
    })

    it('선택 노드가 0개이면 saveScene을 호출하지 않는다', async () => {
      const root = makeNode('root', [makeNode('a')])
      const { result } = setup([], root)

      await act(async () => {
        await result.current.patchOrdered((n) => n, '빈 선택')
      })

      expect(saveScene).not.toHaveBeenCalled()
    })

    it('sorter가 있으면 정렬 후 인덱스를 할당한다', async () => {
      const nodeA = { ...makeNode('a'), position: { x: 300, y: 0, z: 0 } }
      const nodeB = { ...makeNode('b'), position: { x: 100, y: 0, z: 0 } }
      const root = makeNode('root', [nodeA, nodeB])
      const { result } = setup(['a', 'b'], root)

      const idxMap: Record<string, number> = {}
      await act(async () => {
        await result.current.patchOrdered(
          (n, idx) => { idxMap[n.uuid] = idx; return n },
          '정렬 패치',
          (a, b) => a.position.x - b.position.x // x 오름차순
        )
      })

      // b(x=100)가 idx=0, a(x=300)가 idx=1
      expect(idxMap['b']).toBe(0)
      expect(idxMap['a']).toBe(1)
    })

    it('setBatchMsg가 성공 메시지로 호출된다', async () => {
      const root = makeNode('root', [makeNode('a')])
      const { result } = setup(['a'], root)

      await act(async () => {
        await result.current.patchOrdered((n) => n, '순서 적용')
      })

      expect(setBatchMsg).toHaveBeenCalledWith('✓ 순서 적용')
    })
  })

  // ── uuids 반환 ─────────────────────────────────────────────────────────────

  it('uuids 배열을 그대로 반환한다', () => {
    const root = makeNode('root')
    const uuids = ['x', 'y', 'z']
    const sceneFile = makeSceneFile(root)
    const { result } = renderHook(() =>
      useBatchPatch({ sceneFile, saveScene, uuidSet: new Set(uuids), uuids, setBatchMsg })
    )
    expect(result.current.uuids).toEqual(uuids)
  })
})
