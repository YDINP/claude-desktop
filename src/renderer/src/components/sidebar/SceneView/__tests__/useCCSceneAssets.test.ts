/**
 * useCCSceneAssets — sprite/font 캐시 로직 테스트
 * window.api 모킹 후 renderHook으로 비동기 캐시 동작 검증
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCCSceneAssets } from '../useCCSceneAssets'
import type { FlatNode } from '../ccSceneTypes'
import type { CCSceneFile, CCSceneNode } from '@shared/ipc-schema'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSceneFile(assetsDir = '/project/assets'): CCSceneFile {
  return {
    path: '/project/assets/main.fire',
    nodes: [],
    projectInfo: {
      detected: true,
      version: '2x',
      assetsDir,
    },
  } as unknown as CCSceneFile
}

function makeNode(uuid: string, components: CCSceneNode['components'] = []): CCSceneNode {
  return {
    uuid, name: uuid, active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components,
    children: [],
  }
}

function makeFlatNode(uuid: string, components: CCSceneNode['components'] = []): FlatNode {
  return {
    node: makeNode(uuid, components),
    worldX: 0, worldY: 0,
    worldRotZ: 0, worldScaleX: 1, worldScaleY: 1,
    depth: 0, parentUuid: null,
    siblingIdx: 0, siblingTotal: 1,
    effectiveActive: true,
  }
}

function setupWindowApi(overrides: Partial<typeof window.api> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      ccFileResolveSprite: null,
      ccFileResolveTexture: null,
      ccFileResolveFont: null,
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

// ── Image mock ────────────────────────────────────────────────────────────────

class MockImage {
  naturalWidth = 64
  naturalHeight = 64
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''
  get src() { return this._src }
  set src(val: string) {
    this._src = val
    // Simulate async load
    setTimeout(() => this.onload?.(), 0)
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useCCSceneAssets', () => {
  const originalImage = global.Image

  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = MockImage as any
  })

  afterEach(() => {
    global.Image = originalImage
  })

  // ── sprite cache ──────────────────────────────────────────────────────────────

  describe('sprite caching', () => {
    it('does nothing when assetsDir is empty', () => {
      const sceneFile = makeSceneFile('')
      const resolveSprite = vi.fn()
      setupWindowApi({ ccFileResolveSprite: resolveSprite })

      const flatNodes = [makeFlatNode('n1', [{ type: 'cc.Sprite', props: { spriteFrame: { __uuid__: 'uuid-abc' } } }])]
      renderHook(() => useCCSceneAssets(sceneFile, flatNodes))

      expect(resolveSprite).not.toHaveBeenCalled()
    })

    it('calls ccFileResolveSprite for new sprite UUIDs', async () => {
      const resolveSprite = vi.fn().mockResolvedValue({
        dataUrl: 'data:image/png;base64,abc',
        borderLeft: 0, borderRight: 0, borderTop: 0, borderBottom: 0,
        frame: null,
      })
      setupWindowApi({ ccFileResolveSprite: resolveSprite })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Sprite', props: { spriteFrame: { __uuid__: 'sprite-uuid-1' } } }]),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => expect(resolveSprite).toHaveBeenCalledWith('sprite-uuid-1', '/project/assets'))
    })

    it('does not re-fetch already cached UUIDs', async () => {
      const resolveSprite = vi.fn().mockResolvedValue({
        dataUrl: 'data:image/png;base64,abc',
        borderLeft: 0, borderRight: 0, borderTop: 0, borderBottom: 0,
        frame: null,
      })
      setupWindowApi({ ccFileResolveSprite: resolveSprite })

      const comp = [{ type: 'cc.Sprite', props: { spriteFrame: { __uuid__: 'sprite-uuid-dup' } } }]
      const flatNodes = [makeFlatNode('n1', comp)]

      const { rerender } = renderHook(
        ({ nodes }) => useCCSceneAssets(makeSceneFile(), nodes),
        { initialProps: { nodes: flatNodes } }
      )

      await waitFor(() => expect(resolveSprite).toHaveBeenCalledOnce())

      // Rerender with same flatNodes — should NOT re-fetch
      await act(async () => rerender({ nodes: flatNodes }))

      // Still only 1 call
      expect(resolveSprite).toHaveBeenCalledOnce()
    })

    it('handles sprite types: cc.Sprite2D', async () => {
      const resolveSprite = vi.fn().mockResolvedValue({
        dataUrl: 'data:image/png;base64,x',
        borderLeft: 0, borderRight: 0, borderTop: 0, borderBottom: 0,
        frame: null,
      })
      setupWindowApi({ ccFileResolveSprite: resolveSprite })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Sprite2D', props: { spriteFrame: { __uuid__: 'uuid-2d' } } }]),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => expect(resolveSprite).toHaveBeenCalledWith('uuid-2d', '/project/assets'))
    })

    it('falls back to ccFileResolveTexture when ccFileResolveSprite is null', async () => {
      const resolveTexture = vi.fn().mockResolvedValue('data:image/png;base64,tex')
      setupWindowApi({ ccFileResolveSprite: null, ccFileResolveTexture: resolveTexture })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Sprite', props: { spriteFrame: { __uuid__: 'tex-uuid' } } }]),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => expect(resolveTexture).toHaveBeenCalledWith('tex-uuid', '/project/assets'))
    })

    it('removes UUID from cache when resolveSprite returns null', async () => {
      const resolveSprite = vi.fn().mockResolvedValue(null)
      setupWindowApi({ ccFileResolveSprite: resolveSprite })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Sprite', props: { spriteFrame: { __uuid__: 'missing-uuid' } } }]),
      ]
      const { result } = renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(
        () => {
          expect(resolveSprite).toHaveBeenCalled()
          expect(result.current.spriteCacheRef.current.has('missing-uuid')).toBe(false)
        },
        { timeout: 2000 }
      )
    })

    it('skips nodes with no spriteFrame UUID', () => {
      const resolveSprite = vi.fn()
      setupWindowApi({ ccFileResolveSprite: resolveSprite })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Sprite', props: { spriteFrame: null } }]),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      expect(resolveSprite).not.toHaveBeenCalled()
    })
  })

  // ── font cache ────────────────────────────────────────────────────────────────

  describe('font caching', () => {
    it('calls ccFileResolveFont for cc.Label with font UUID', async () => {
      const resolveFont = vi.fn().mockResolvedValue({ dataUrl: 'data:font/ttf;base64,abc', familyName: 'MyFont' })
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Label', props: { font: { __uuid__: 'font-uuid-1' } } }]),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => expect(resolveFont).toHaveBeenCalledWith('font-uuid-1', '/project/assets'))
    })

    it('resolves font via _font prop alias', async () => {
      const resolveFont = vi.fn().mockResolvedValue({ dataUrl: 'data:font/ttf;base64,x', familyName: 'F2' })
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Label', props: { _font: { __uuid__: 'font-alias-uuid' } } }]),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => expect(resolveFont).toHaveBeenCalledWith('font-alias-uuid', '/project/assets'))
    })

    it('resolves font via _N$file prop alias', async () => {
      const resolveFont = vi.fn().mockResolvedValue({ dataUrl: 'data:font/ttf;base64,z', familyName: 'F3' })
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Label', props: { _N$file: { __uuid__: 'font-nfile-uuid' } } }]),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => expect(resolveFont).toHaveBeenCalledWith('font-nfile-uuid', '/project/assets'))
    })

    it('supports cc.RichText font loading', async () => {
      const resolveFont = vi.fn().mockResolvedValue({ dataUrl: 'data:font/ttf;base64,rt', familyName: 'RT' })
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.RichText', props: { font: { __uuid__: 'rt-font-uuid' } } }]),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => expect(resolveFont).toHaveBeenCalledWith('rt-font-uuid', '/project/assets'))
    })

    it('deduplicates font UUIDs across multiple nodes', async () => {
      const resolveFont = vi.fn().mockResolvedValue({ dataUrl: 'data:font/ttf;base64,dup', familyName: 'Dup' })
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const comp = [{ type: 'cc.Label', props: { font: { __uuid__: 'shared-font' } } }]
      const flatNodes = [
        makeFlatNode('n1', comp),
        makeFlatNode('n2', comp),
      ]
      renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => expect(resolveFont).toHaveBeenCalledOnce())
    })

    it('stores font result in fontCacheRef', async () => {
      const resolveFont = vi.fn().mockResolvedValue({ dataUrl: 'data:font/ttf;base64,stored', familyName: 'Stored' })
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Label', props: { font: { __uuid__: 'store-uuid' } } }]),
      ]
      const { result } = renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => {
        const entry = result.current.fontCacheRef.current.get('store-uuid')
        return entry && entry.familyName === 'Stored'
      })

      expect(result.current.fontCacheRef.current.get('store-uuid')).toEqual({
        dataUrl: 'data:font/ttf;base64,stored',
        familyName: 'Stored',
      })
    })

    it('removes UUID from fontCache when resolveFont returns null', async () => {
      const resolveFont = vi.fn().mockResolvedValue(null)
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Label', props: { font: { __uuid__: 'no-font' } } }]),
      ]
      const { result } = renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(
        () => {
          expect(resolveFont).toHaveBeenCalled()
          expect(result.current.fontCacheRef.current.has('no-font')).toBe(false)
        },
        { timeout: 2000 }
      )
    })

    it('does nothing when assetsDir is absent', () => {
      const resolveFont = vi.fn()
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const sceneFile = { ...makeSceneFile(), projectInfo: { detected: false } } as unknown as CCSceneFile
      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Label', props: { font: { __uuid__: 'x' } } }]),
      ]
      renderHook(() => useCCSceneAssets(sceneFile, flatNodes))

      expect(resolveFont).not.toHaveBeenCalled()
    })

    it('increments fontCacheVer after successful font load', async () => {
      const resolveFont = vi.fn().mockResolvedValue({ dataUrl: 'data:font/ttf;base64,ver', familyName: 'V' })
      setupWindowApi({ ccFileResolveFont: resolveFont })

      const flatNodes = [
        makeFlatNode('n1', [{ type: 'cc.Label', props: { font: { __uuid__: 'ver-uuid' } } }]),
      ]
      const { result } = renderHook(() => useCCSceneAssets(makeSceneFile(), flatNodes))

      await waitFor(() => result.current.fontCacheVer > 0)
      expect(result.current.fontCacheVer).toBeGreaterThan(0)
    })
  })

  // ── no nodes ──────────────────────────────────────────────────────────────────

  describe('empty flatNodes', () => {
    it('makes no API calls when flatNodes is empty', () => {
      const resolveSprite = vi.fn()
      const resolveFont = vi.fn()
      setupWindowApi({ ccFileResolveSprite: resolveSprite, ccFileResolveFont: resolveFont })

      renderHook(() => useCCSceneAssets(makeSceneFile(), []))

      expect(resolveSprite).not.toHaveBeenCalled()
      expect(resolveFont).not.toHaveBeenCalled()
    })
  })
})
