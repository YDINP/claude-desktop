import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { NodeRenderer } from '../NodeRenderer'
import type { SceneNode, ViewTransform } from '../types'

// cocosToSvg / getComponentIcon are real implementations — no mock needed

function makeNode(override: Partial<SceneNode> = {}): SceneNode {
  return {
    uuid: 'node-uuid',
    name: 'TestNode',
    active: true,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    anchorX: 0.5,
    anchorY: 0.5,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    parentUuid: null,
    childUuids: [],
    components: [],
    ...override,
  }
}

function makeView(zoom: number): ViewTransform {
  return { offsetX: 0, offsetY: 0, zoom, scale: zoom } as ViewTransform & { scale: number }
}

const defaultHandlers = {
  onMouseDown: vi.fn(),
  onMouseEnter: vi.fn(),
  onMouseLeave: vi.fn(),
}

// ── LOD 렌더링 ──────────────────────────────────────────────────────────────

describe('NodeRenderer — LOD 렌더링', () => {
  it('zoom >= 0.4 → lod=0, rect 렌더링됨', () => {
    const { container } = render(
      <svg>
        <NodeRenderer
          node={makeNode()}
          view={makeView(1.0)}
          selected={false}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
  })

  it('zoom 0.2~0.4 → lod=1, 아이콘/라벨 없음', () => {
    const node = makeNode({
      name: 'MyLabel',
      components: [{ type: 'cc.Label', props: {} }],
    })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={node}
          view={makeView(0.3)}
          selected={false}
          hovered={false}
          showLabel
          {...defaultHandlers}
        />
      </svg>
    )
    // lod=1 → label text not rendered (only lod===0 shows label)
    const texts = container.querySelectorAll('text')
    // no label text should exist for lod=1
    const textContents = Array.from(texts).map(t => t.textContent ?? '')
    expect(textContents.some(t => t.includes('MyLabel'))).toBe(false)
  })

  it('zoom < 0.2 AND node pixel size < 2px AND not selected AND not hovered → null', () => {
    // pixel size = width * scaleX * zoom = 1 * 1 * 0.1 = 0.1 < 2
    const tinyNode = makeNode({ width: 1, height: 1 })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={tinyNode}
          view={makeView(0.1)}
          selected={false}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    // null → no <g> rendered inside svg
    expect(container.querySelector('g')).toBeNull()
  })

  it('zoom < 0.2 AND selected → NOT null (선택 노드는 스킵하지 않음)', () => {
    const tinyNode = makeNode({ width: 1, height: 1 })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={tinyNode}
          view={makeView(0.1)}
          selected={true}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    expect(container.querySelector('g')).not.toBeNull()
  })

  it('zoom < 0.2 AND hovered → NOT null', () => {
    const tinyNode = makeNode({ width: 1, height: 1 })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={tinyNode}
          view={makeView(0.1)}
          selected={false}
          hovered={true}
          {...defaultHandlers}
        />
      </svg>
    )
    expect(container.querySelector('g')).not.toBeNull()
  })

  it('zoom < 0.2 AND node pixel size >= 2px → NOT null', () => {
    // pixel size = 100 * 1 * 0.19 = 19 >= 2
    const bigNode = makeNode({ width: 100, height: 100 })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={bigNode}
          view={makeView(0.19)}
          selected={false}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    expect(container.querySelector('g')).not.toBeNull()
  })
})

// ── 기본 rect 렌더링 ─────────────────────────────────────────────────────────

describe('NodeRenderer — 기본 rect', () => {
  it('rect가 하나 이상 렌더링된다', () => {
    const { container } = render(
      <svg>
        <NodeRenderer
          node={makeNode()}
          view={makeView(1)}
          selected={false}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    expect(container.querySelector('rect')).not.toBeNull()
  })

  it('lod=2 (zoom < 0.2, 큰 노드) → rect fill은 none', () => {
    const bigNode = makeNode({ width: 200, height: 200 })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={bigNode}
          view={makeView(0.1)}
          selected={false}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    const mainRect = container.querySelector('rect')
    // lod=2 → fill='none'
    expect(mainRect?.getAttribute('fill')).toBe('none')
  })

  it('선택 시 8개 리사이즈 핸들이 렌더링된다', () => {
    const { container } = render(
      <svg>
        <NodeRenderer
          node={makeNode()}
          view={makeView(1)}
          selected={true}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    const rects = container.querySelectorAll('rect')
    // main rect + 8 handles >= 9
    expect(rects.length).toBeGreaterThanOrEqual(9)
  })

  it('앵커 포인트 circle이 선택 시 렌더링된다', () => {
    const { container } = render(
      <svg>
        <NodeRenderer
          node={makeNode()}
          view={makeView(1)}
          selected={true}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    expect(container.querySelector('circle')).not.toBeNull()
  })

  it('비활성 노드 → strokeDasharray 4 3 (점선)', () => {
    const inactiveNode = makeNode({ active: false })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={inactiveNode}
          view={makeView(1)}
          selected={false}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    const mainRect = container.querySelector('rect')
    expect(mainRect?.getAttribute('stroke-dasharray')).toBe('4 3')
  })
})

// ── Sprite / Label 컴포넌트 표시 조건 ────────────────────────────────────────

describe('NodeRenderer — Sprite/Label 렌더링', () => {
  it('cc.Label 컴포넌트 있으면 lod=0에서 아이콘 오버레이 렌더링', () => {
    const node = makeNode({
      width: 80,
      height: 40,
      components: [{ type: 'cc.Label', props: {} }],
    })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={node}
          view={makeView(1)}
          selected={false}
          hovered={false}
          showLabel
          {...defaultHandlers}
        />
      </svg>
    )
    // lod=0 + icon 있으면 icon overlay text 렌더링됨
    const texts = container.querySelectorAll('text')
    expect(texts.length).toBeGreaterThan(0)
  })

  it('cc.Sprite 컴포넌트 있으면 lod=0에서 아이콘 렌더링', () => {
    const node = makeNode({
      width: 80,
      height: 40,
      components: [{ type: 'cc.Sprite', props: {} }],
    })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={node}
          view={makeView(1)}
          selected={false}
          hovered={false}
          {...defaultHandlers}
        />
      </svg>
    )
    const texts = container.querySelectorAll('text')
    expect(texts.length).toBeGreaterThan(0)
  })

  it('컴포넌트 없으면 아이콘 오버레이 없음 (text 없음 또는 최소)', () => {
    const node = makeNode({ width: 80, height: 40, components: [] })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={node}
          view={makeView(1)}
          selected={false}
          hovered={false}
          showLabel={false}
          {...defaultHandlers}
        />
      </svg>
    )
    // No label, no icons → no text elements
    const texts = container.querySelectorAll('text')
    expect(texts.length).toBe(0)
  })

  it('showLabel=true + lod=0 + 충분한 크기 → 노드 이름 텍스트 렌더링', () => {
    const node = makeNode({ name: 'MySprite', width: 80, height: 40, components: [] })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={node}
          view={makeView(1)}
          selected={false}
          hovered={false}
          showLabel={true}
          {...defaultHandlers}
        />
      </svg>
    )
    const texts = Array.from(container.querySelectorAll('text'))
    expect(texts.some(t => (t.textContent ?? '').includes('MySprite'))).toBe(true)
  })

  it('12자 초과 이름은 잘려서 … 포함', () => {
    const node = makeNode({ name: 'VeryLongNodeNameHere', width: 80, height: 40, components: [] })
    const { container } = render(
      <svg>
        <NodeRenderer
          node={node}
          view={makeView(1)}
          selected={false}
          hovered={false}
          showLabel={true}
          {...defaultHandlers}
        />
      </svg>
    )
    const texts = Array.from(container.querySelectorAll('text'))
    // Should contain ellipsis or truncated version
    const hasEllipsis = texts.some(t => (t.textContent ?? '').includes('\u2026'))
    expect(hasEllipsis).toBe(true)
  })
})

// ── heatmapIntensity 오버레이 ─────────────────────────────────────────────────

describe('NodeRenderer — heatmapIntensity', () => {
  it('heatmapIntensity > 0 → 추가 rect 렌더링됨', () => {
    const { container: c1 } = render(
      <svg>
        <NodeRenderer node={makeNode()} view={makeView(1)} selected={false} hovered={false}
          heatmapIntensity={0.5} {...defaultHandlers} />
      </svg>
    )
    const { container: c2 } = render(
      <svg>
        <NodeRenderer node={makeNode()} view={makeView(1)} selected={false} hovered={false}
          heatmapIntensity={undefined} {...defaultHandlers} />
      </svg>
    )
    expect(c1.querySelectorAll('rect').length).toBeGreaterThan(c2.querySelectorAll('rect').length)
  })

  it('heatmapIntensity=0 → 히트맵 rect 없음', () => {
    const { container: c1 } = render(
      <svg>
        <NodeRenderer node={makeNode()} view={makeView(1)} selected={false} hovered={false}
          heatmapIntensity={0} {...defaultHandlers} />
      </svg>
    )
    const { container: c2 } = render(
      <svg>
        <NodeRenderer node={makeNode()} view={makeView(1)} selected={false} hovered={false}
          heatmapIntensity={undefined} {...defaultHandlers} />
      </svg>
    )
    expect(c1.querySelectorAll('rect').length).toBe(c2.querySelectorAll('rect').length)
  })
})

// ── multiSelected 하이라이트 ──────────────────────────────────────────────────

describe('NodeRenderer — multiSelected', () => {
  it('multiSelected=true AND selected=false → 추가 rect 렌더링', () => {
    const { container: cm } = render(
      <svg>
        <NodeRenderer node={makeNode()} view={makeView(1)} selected={false} hovered={false}
          multiSelected={true} {...defaultHandlers} />
      </svg>
    )
    const { container: cn } = render(
      <svg>
        <NodeRenderer node={makeNode()} view={makeView(1)} selected={false} hovered={false}
          multiSelected={false} {...defaultHandlers} />
      </svg>
    )
    expect(cm.querySelectorAll('rect').length).toBeGreaterThan(cn.querySelectorAll('rect').length)
  })
})
