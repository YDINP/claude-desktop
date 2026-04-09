import { describe, it, expect } from 'vitest'
import type { SceneNode } from '../types'
import {
  getRulerTicks,
  buildHeatmap,
  slotKey,
  CC_LAYER_NAMES,
  CANVAS_PRESETS,
  COLOR_TAG_PALETTE,
  LABEL_COLORS,
  DEFAULT_PRESETS,
  DEFAULT_TEMPLATES,
  PNG_BG_COLORS,
  VP_KEY,
  NT_KEY,
  VB_KEY,
} from '../sceneViewConstants'

// ── slotKey ────────────────────────────────────────────────────

describe('slotKey', () => {
  it('슬롯 번호가 키에 포함된다', () => {
    expect(slotKey(1)).toBe('claude-desktop-scene-layout-1')
    expect(slotKey(0)).toBe('claude-desktop-scene-layout-0')
    expect(slotKey(99)).toBe('claude-desktop-scene-layout-99')
  })

  it('다른 슬롯은 서로 다른 키를 반환한다', () => {
    expect(slotKey(1)).not.toBe(slotKey(2))
  })
})

// ── getRulerTicks ──────────────────────────────────────────────

describe('getRulerTicks', () => {
  const view = { zoom: 1, offsetX: 0, offsetY: 0 }

  it('svgSize=1이면 pos 범위 바깥 틱은 제외된다', () => {
    // svgSize=0일 때 경계(pos=0)가 포함될 수 있으므로, 실제 동작을 검증
    const ticks = getRulerTicks('h', 1, view)
    for (const t of ticks) {
      expect(t.pos).toBeGreaterThanOrEqual(0)
      expect(t.pos).toBeLessThanOrEqual(1)
    }
  })

  it('가로 축 틱이 반환된다', () => {
    const ticks = getRulerTicks('h', 500, view)
    expect(ticks.length).toBeGreaterThan(0)
  })

  it('세로 축 틱이 반환된다', () => {
    const ticks = getRulerTicks('v', 500, view)
    expect(ticks.length).toBeGreaterThan(0)
  })

  it('모든 틱의 pos는 0 이상 svgSize 이하이다', () => {
    const svgSize = 800
    const ticks = getRulerTicks('h', svgSize, view)
    for (const t of ticks) {
      expect(t.pos).toBeGreaterThanOrEqual(0)
      expect(t.pos).toBeLessThanOrEqual(svgSize)
    }
  })

  it('메이저 틱에는 label이 있다', () => {
    const ticks = getRulerTicks('h', 500, view)
    const major = ticks.filter(t => t.isMajor)
    expect(major.length).toBeGreaterThan(0)
    for (const t of major) {
      expect(t.label).not.toBeNull()
    }
  })

  it('마이너 틱은 label이 null이다', () => {
    const ticks = getRulerTicks('h', 500, view)
    const minor = ticks.filter(t => !t.isMajor)
    for (const t of minor) {
      expect(t.label).toBeNull()
    }
  })

  it('zoom이 크면 틱 간격이 세밀해진다', () => {
    const ticksZoom1 = getRulerTicks('h', 500, { zoom: 1, offsetX: 0, offsetY: 0 })
    const ticksZoom4 = getRulerTicks('h', 500, { zoom: 4, offsetX: 0, offsetY: 0 })
    // 확대 시 더 많은 틱이 보인다
    expect(ticksZoom4.length).toBeGreaterThan(ticksZoom1.length)
  })

  it('offsetX 이동 시 label 값이 달라진다', () => {
    const ticksCenter = getRulerTicks('h', 500, { zoom: 1, offsetX: 0, offsetY: 0 })
    const ticksShifted = getRulerTicks('h', 500, { zoom: 1, offsetX: 200, offsetY: 0 })
    const labelsCenter = ticksCenter.filter(t => t.label).map(t => t.label)
    const labelsShifted = ticksShifted.filter(t => t.label).map(t => t.label)
    expect(labelsCenter).not.toEqual(labelsShifted)
  })
})

// ── buildHeatmap ───────────────────────────────────────────────

describe('buildHeatmap', () => {
  function makeNode(x: number, y: number): SceneNode {
    return {
      uuid: `${x}-${y}`,
      name: 'n',
      active: true,
      x,
      y,
      width: 100,
      height: 100,
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
    }
  }

  it('노드가 없으면 빈 맵을 반환한다', () => {
    expect(buildHeatmap([], 100).size).toBe(0)
  })

  it('같은 셀에 있는 노드는 카운트가 누적된다', () => {
    const nodes = [makeNode(0, 0), makeNode(50, 50), makeNode(99, 99)]
    const map = buildHeatmap(nodes, 100)
    expect(map.get('0,0')).toBe(3)
  })

  it('서로 다른 셀의 노드는 별도 키로 저장된다', () => {
    const nodes = [makeNode(0, 0), makeNode(100, 0)]
    const map = buildHeatmap(nodes, 100)
    expect(map.get('0,0')).toBe(1)
    expect(map.get('1,0')).toBe(1)
    expect(map.size).toBe(2)
  })

  it('음수 좌표도 처리된다', () => {
    const nodes = [makeNode(-150, -250)]
    const map = buildHeatmap(nodes, 100)
    expect(map.get('-2,-3')).toBe(1)
  })

  it('cellSize가 달라지면 그룹이 달라진다', () => {
    const nodes = [makeNode(0, 0), makeNode(50, 0)]
    const map50 = buildHeatmap(nodes, 50)
    const map100 = buildHeatmap(nodes, 100)
    expect(map50.size).toBe(2)
    expect(map100.size).toBe(1)
  })
})

// ── 상수 값 검증 ───────────────────────────────────────────────

describe('CC_LAYER_NAMES', () => {
  it('레이어 1은 DEFAULT이다', () => {
    expect(CC_LAYER_NAMES[1]).toBe('DEFAULT')
  })

  it('레이어 64는 PROFILER이다', () => {
    expect(CC_LAYER_NAMES[64]).toBe('PROFILER')
  })
})

describe('CANVAS_PRESETS', () => {
  it('최소 6개 프리셋이 있다', () => {
    expect(CANVAS_PRESETS.length).toBeGreaterThanOrEqual(6)
  })

  it('각 프리셋에는 label, w, h가 있다', () => {
    for (const p of CANVAS_PRESETS) {
      expect(p).toHaveProperty('label')
      expect(p).toHaveProperty('w')
      expect(p).toHaveProperty('h')
    }
  })
})

describe('COLOR_TAG_PALETTE', () => {
  it('7개의 색상이 있다', () => {
    expect(COLOR_TAG_PALETTE).toHaveLength(7)
  })

  it('hex 색상 형식이다', () => {
    for (const c of COLOR_TAG_PALETTE) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('LABEL_COLORS', () => {
  it('"0"은 undefined이다', () => {
    expect(LABEL_COLORS['0']).toBeUndefined()
  })

  it('"1"부터 "9"까지 색상이 있다', () => {
    for (let i = 1; i <= 9; i++) {
      expect(LABEL_COLORS[String(i)]).toBeDefined()
    }
  })
})

describe('DEFAULT_PRESETS', () => {
  it('1:1, 2:1 프리셋이 있다', () => {
    const names = DEFAULT_PRESETS.map(p => p.name)
    expect(names).toContain('1:1')
    expect(names).toContain('2:1')
  })
})

describe('DEFAULT_TEMPLATES', () => {
  it('빈 노드 템플릿이 있다', () => {
    expect(DEFAULT_TEMPLATES.some(t => t.name === '빈 노드')).toBe(true)
  })

  it('UI 버튼 템플릿이 있다', () => {
    expect(DEFAULT_TEMPLATES.some(t => t.name === 'UI 버튼')).toBe(true)
  })
})

describe('PNG_BG_COLORS', () => {
  it('dark, light, transparent 키가 있다', () => {
    expect(PNG_BG_COLORS).toHaveProperty('dark')
    expect(PNG_BG_COLORS).toHaveProperty('light')
    expect(PNG_BG_COLORS).toHaveProperty('transparent')
  })

  it('transparent 값은 "transparent"이다', () => {
    expect(PNG_BG_COLORS['transparent']).toBe('transparent')
  })
})

describe('localStorage 키 상수', () => {
  it('VP_KEY, NT_KEY, VB_KEY가 문자열이다', () => {
    expect(typeof VP_KEY).toBe('string')
    expect(typeof NT_KEY).toBe('string')
    expect(typeof VB_KEY).toBe('string')
  })

  it('세 키가 모두 다르다', () => {
    const keys = new Set([VP_KEY, NT_KEY, VB_KEY])
    expect(keys.size).toBe(3)
  })
})
