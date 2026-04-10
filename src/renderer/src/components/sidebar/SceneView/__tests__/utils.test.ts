import { describe, it, expect } from 'vitest'
import type { CCNode } from '@shared/ipc-schema'
import {
  cocosToSvg,
  svgToCocos,
  getComponentIcon,
  flattenTree,
  getRenderOrder,
  COMP_ICONS,
} from '../utils'

// ── 헬퍼 ──────────────────────────────────────────────────────

function makeCCNode(override: Partial<CCNode> & { uuid: string; name: string }): CCNode {
  return {
    active: true,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    anchor: { x: 0.5, y: 0.5 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    children: [],
    components: [],
    ...override,
  }
}

// ── cocosToSvg ────────────────────────────────────────────────

describe('cocosToSvg', () => {
  it('원점(0,0)은 화면 중앙으로 변환된다', () => {
    const { sx, sy } = cocosToSvg(0, 0, 960, 640)
    expect(sx).toBe(480)
    expect(sy).toBe(320)
  })

  it('오른쪽(+x) Cocos → SVG x 증가', () => {
    const { sx } = cocosToSvg(100, 0, 960, 640)
    const { sx: sx0 } = cocosToSvg(0, 0, 960, 640)
    expect(sx).toBeGreaterThan(sx0)
  })

  it('위쪽(+y) Cocos → SVG y 감소 (Y축 반전)', () => {
    const { sy } = cocosToSvg(0, 100, 960, 640)
    const { sy: sy0 } = cocosToSvg(0, 0, 960, 640)
    expect(sy).toBeLessThan(sy0)
  })

  it('sx = designWidth/2 + cx', () => {
    const { sx } = cocosToSvg(123, 0, 960, 640)
    expect(sx).toBe(480 + 123)
  })

  it('sy = designHeight/2 - cy', () => {
    const { sy } = cocosToSvg(0, -50, 960, 640)
    expect(sy).toBe(320 + 50)
  })

  it('다른 해상도에서도 중앙이 designWidth/2, designHeight/2이다', () => {
    const { sx, sy } = cocosToSvg(0, 0, 1280, 720)
    expect(sx).toBe(640)
    expect(sy).toBe(360)
  })
})

// ── svgToCocos ────────────────────────────────────────────────

describe('svgToCocos', () => {
  const view = { offsetX: 0, offsetY: 0, zoom: 1 }
  const W = 960
  const H = 640

  it('SVG 중앙 → Cocos 원점(0,0)', () => {
    const { cx, cy } = svgToCocos(480, 320, view, W, H)
    expect(cx).toBeCloseTo(0)
    expect(cy).toBeCloseTo(0)
  })

  it('cocosToSvg의 역함수이다', () => {
    const origCx = 150
    const origCy = -80
    const { sx, sy } = cocosToSvg(origCx, origCy, W, H)
    const { cx, cy } = svgToCocos(sx, sy, view, W, H)
    expect(cx).toBeCloseTo(origCx)
    expect(cy).toBeCloseTo(origCy)
  })

  it('zoom=2일 때 올바르게 역변환된다', () => {
    const zoomedView = { offsetX: 0, offsetY: 0, zoom: 2 }
    const { sx, sy } = cocosToSvg(100, 50, W, H)
    // SVG pos with zoom = sceneCoord * zoom + offset
    const svgXZoomed = (W / 2 + 100) * 2 + 0
    const svgYZoomed = (H / 2 - 50) * 2 + 0
    const { cx, cy } = svgToCocos(svgXZoomed, svgYZoomed, zoomedView, W, H)
    expect(cx).toBeCloseTo(100)
    expect(cy).toBeCloseTo(50)
  })

  it('offset 이동이 적용된다', () => {
    const shiftedView = { offsetX: 100, offsetY: 50, zoom: 1 }
    // SVG 중앙(480,320) + offset(100,50) = (580, 370)에서 Cocos 원점
    const { cx, cy } = svgToCocos(580, 370, shiftedView, W, H)
    expect(cx).toBeCloseTo(0)
    expect(cy).toBeCloseTo(0)
  })
})

// ── getComponentIcon ───────────────────────────────────────────

describe('getComponentIcon', () => {
  it('컴포넌트 없으면 빈 문자열 반환', () => {
    expect(getComponentIcon([])).toBe('')
  })

  it('cc.Label → T', () => {
    expect(getComponentIcon([{ type: 'cc.Label' }])).toBe('T')
  })

  it('cc.RichText → T', () => {
    expect(getComponentIcon([{ type: 'cc.RichText' }])).toBe('T')
  })

  it('cc.Button → ⏹', () => {
    expect(getComponentIcon([{ type: 'cc.Button' }])).toBe('⏹')
  })

  it('cc.Canvas → 🎨', () => {
    expect(getComponentIcon([{ type: 'cc.Canvas' }])).toBe('🎨')
  })

  it('cc.Sprite → 🖼', () => {
    expect(getComponentIcon([{ type: 'cc.Sprite' }])).toBe('🖼')
  })

  it('cc.Layout → ⊞', () => {
    expect(getComponentIcon([{ type: 'cc.Layout' }])).toBe('⊞')
  })

  it('cc.ScrollView → ↕', () => {
    expect(getComponentIcon([{ type: 'cc.ScrollView' }])).toBe('↕')
  })

  it('cc.EditBox → E', () => {
    expect(getComponentIcon([{ type: 'cc.EditBox' }])).toBe('E')
  })

  it('cc.Camera → C', () => {
    expect(getComponentIcon([{ type: 'cc.Camera' }])).toBe('C')
  })

  it('cc.ProgressBar → P', () => {
    expect(getComponentIcon([{ type: 'cc.ProgressBar' }])).toBe('P')
  })

  it('cc.Toggle → G', () => {
    expect(getComponentIcon([{ type: 'cc.Toggle' }])).toBe('G')
  })

  it('cc.ParticleSystem → P', () => {
    expect(getComponentIcon([{ type: 'cc.ParticleSystem' }])).toBe('P')
  })

  it('cc.DirectionalLight → L', () => {
    expect(getComponentIcon([{ type: 'cc.DirectionalLight' }])).toBe('L')
  })

  it('cc.AudioSource → ♪', () => {
    expect(getComponentIcon([{ type: 'cc.AudioSource' }])).toBe('♪')
  })

  it('cc.RigidBody → ⬡', () => {
    expect(getComponentIcon([{ type: 'cc.RigidBody' }])).toBe('⬡')
  })

  it('첫 번째 매칭 컴포넌트를 우선 반환한다', () => {
    // Button이 앞에 있으면 ⏹ 반환
    expect(getComponentIcon([{ type: 'cc.Button' }, { type: 'cc.Sprite' }])).toBe('⏹')
  })

  it('커스텀 컴포넌트 — Button 포함 → ⏹', () => {
    expect(getComponentIcon([{ type: 'MyButtonComponent' }])).toBe('⏹')
  })

  it('커스텀 컴포넌트 — Label 포함 → T', () => {
    expect(getComponentIcon([{ type: 'CustomLabelRenderer' }])).toBe('T')
  })

  it('커스텀 컴포넌트 — Sprite 포함 → 🖼', () => {
    expect(getComponentIcon([{ type: 'BGSprite' }])).toBe('🖼')
  })

  it('알 수 없는 컴포넌트 → 빈 문자열', () => {
    expect(getComponentIcon([{ type: 'cc.Unknown' }])).toBe('')
  })
})

// ── COMP_ICONS 상수 ────────────────────────────────────────────

describe('COMP_ICONS', () => {
  it('필수 컴포넌트 타입이 있다', () => {
    const required = ['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Canvas', 'cc.Layout']
    for (const t of required) {
      expect(COMP_ICONS).toHaveProperty(t)
    }
  })
})

// ── flattenTree ───────────────────────────────────────────────

describe('flattenTree', () => {
  it('단일 노드가 맵에 저장된다', () => {
    const root = makeCCNode({ uuid: 'root', name: 'Root' })
    const map = new Map()
    flattenTree(root, null, map)
    expect(map.has('root')).toBe(true)
    expect(map.get('root').name).toBe('Root')
  })

  it('parentUuid가 올바르게 설정된다', () => {
    const child = makeCCNode({ uuid: 'child', name: 'Child' })
    const root = makeCCNode({ uuid: 'root', name: 'Root', children: [child] })
    const map = new Map()
    flattenTree(root, null, map)
    expect(map.get('root').parentUuid).toBeNull()
    expect(map.get('child').parentUuid).toBe('root')
  })

  it('자식 UUID가 childUuids 배열에 저장된다', () => {
    const c1 = makeCCNode({ uuid: 'c1', name: 'C1' })
    const c2 = makeCCNode({ uuid: 'c2', name: 'C2' })
    const root = makeCCNode({ uuid: 'root', name: 'Root', children: [c1, c2] })
    const map = new Map()
    flattenTree(root, null, map)
    expect(map.get('root').childUuids).toEqual(['c1', 'c2'])
  })

  it('worldX/worldY가 누적된다', () => {
    const child = makeCCNode({ uuid: 'child', name: 'Child', position: { x: 50, y: 30 } })
    const root = makeCCNode({ uuid: 'root', name: 'Root', position: { x: 100, y: 200 }, children: [child] })
    const map = new Map()
    flattenTree(root, null, map)
    const childNode = map.get('child')
    expect(childNode.worldX).toBe(150) // 100 + 50
    expect(childNode.worldY).toBe(230) // 200 + 30
  })

  it('로컬 x/y는 worldX/worldY와 다르다 (부모 offset 있을 때)', () => {
    const child = makeCCNode({ uuid: 'child', name: 'Child', position: { x: 10, y: 20 } })
    const root = makeCCNode({ uuid: 'root', name: 'Root', position: { x: 100, y: 0 }, children: [child] })
    const map = new Map()
    flattenTree(root, null, map)
    const sn = map.get('child')
    expect(sn.x).toBe(10) // 로컬 x
    expect(sn.worldX).toBe(110) // 누적 world
  })

  it('트리 전체가 평탄화된다', () => {
    const gc = makeCCNode({ uuid: 'gc', name: 'GC' })
    const child = makeCCNode({ uuid: 'child', name: 'Child', children: [gc] })
    const root = makeCCNode({ uuid: 'root', name: 'Root', children: [child] })
    const map = new Map()
    flattenTree(root, null, map)
    expect(map.size).toBe(3)
    expect(map.has('gc')).toBe(true)
  })
})

// ── getRenderOrder ────────────────────────────────────────────

describe('getRenderOrder', () => {
  it('단일 노드 → 자기 자신만 반환', () => {
    const map = new Map()
    map.set('root', { childUuids: [] })
    expect(getRenderOrder('root', map)).toEqual(['root'])
  })

  it('부모 → 자식 순서로 DFS 반환', () => {
    const map = new Map()
    map.set('root', { childUuids: ['a', 'b'] })
    map.set('a', { childUuids: ['a1'] })
    map.set('a1', { childUuids: [] })
    map.set('b', { childUuids: [] })
    expect(getRenderOrder('root', map)).toEqual(['root', 'a', 'a1', 'b'])
  })

  it('존재하지 않는 rootUuid → 빈 배열에 uuid만 추가 후 탐색 종료', () => {
    const map = new Map()
    const result = getRenderOrder('ghost', map)
    expect(result).toEqual(['ghost'])
  })

  it('자식 UUID가 맵에 없어도 크래시하지 않는다', () => {
    const map = new Map()
    map.set('root', { childUuids: ['missing'] })
    // missing은 맵에 없음 — dfs 내 early return
    expect(() => getRenderOrder('root', map)).not.toThrow()
    expect(getRenderOrder('root', map)).toEqual(['root', 'missing'])
  })
})
