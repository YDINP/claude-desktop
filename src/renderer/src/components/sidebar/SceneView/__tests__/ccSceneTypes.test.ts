import { describe, it, expect } from 'vitest'
import {
  sceneViewKey,
  ALIGN_SNAP_THRESHOLD,
  RESOLUTION_PRESETS,
  UUID_RE,
  type FlatNode,
} from '../ccSceneTypes'

// ── sceneViewKey ───────────────────────────────────────────────

describe('sceneViewKey', () => {
  it('prefix sv-view2-로 시작한다', () => {
    expect(sceneViewKey('any/path.fire')).toMatch(/^sv-view2-/)
  })

  it('경로의 특수문자가 언더스코어로 치환된다', () => {
    const key = sceneViewKey('C:/Projects/MyGame/assets/scene.fire')
    // prefix 제거 후 suffix 부분만 검사
    const suffix = key.replace(/^sv-view2-/, '')
    expect(suffix).not.toMatch(/[:/.]/)
  })

  it('최대 80자 suffix로 잘린다 (prefix 포함 시 길이 확인)', () => {
    const longPath = 'a'.repeat(200) + '.fire'
    const key = sceneViewKey(longPath)
    // prefix 'sv-view2-' (9자) + suffix 최대 80자
    expect(key.length).toBeLessThanOrEqual(9 + 80)
  })

  it('같은 경로는 항상 같은 키를 반환한다', () => {
    const path = 'C:/Game/scene/main.fire'
    expect(sceneViewKey(path)).toBe(sceneViewKey(path))
  })

  it('다른 경로는 다른 키를 반환한다 (충분히 다를 때)', () => {
    const k1 = sceneViewKey('assets/scenes/level1.fire')
    const k2 = sceneViewKey('assets/scenes/level2.fire')
    expect(k1).not.toBe(k2)
  })

  it('빈 경로도 처리된다', () => {
    const key = sceneViewKey('')
    expect(key).toBe('sv-view2-')
  })
})

// ── ALIGN_SNAP_THRESHOLD ───────────────────────────────────────

describe('ALIGN_SNAP_THRESHOLD', () => {
  it('양의 정수이다', () => {
    expect(typeof ALIGN_SNAP_THRESHOLD).toBe('number')
    expect(ALIGN_SNAP_THRESHOLD).toBeGreaterThan(0)
  })

  it('값은 6이다', () => {
    expect(ALIGN_SNAP_THRESHOLD).toBe(6)
  })
})

// ── RESOLUTION_PRESETS ─────────────────────────────────────────

describe('RESOLUTION_PRESETS', () => {
  it('최소 7개 프리셋이 있다', () => {
    expect(RESOLUTION_PRESETS.length).toBeGreaterThanOrEqual(7)
  })

  it('각 프리셋에는 label, w, h가 있다', () => {
    for (const p of RESOLUTION_PRESETS) {
      expect(p).toHaveProperty('label')
      expect(typeof p.w).toBe('number')
      expect(typeof p.h).toBe('number')
      expect(p.w).toBeGreaterThan(0)
      expect(p.h).toBeGreaterThan(0)
    }
  })

  it('960×640 (CC2 기본) 프리셋이 있다', () => {
    const found = RESOLUTION_PRESETS.find(p => p.w === 960 && p.h === 640)
    expect(found).toBeDefined()
  })

  it('1920×1080 FHD 프리셋이 있다', () => {
    const found = RESOLUTION_PRESETS.find(p => p.w === 1920 && p.h === 1080)
    expect(found).toBeDefined()
  })
})

// ── UUID_RE ────────────────────────────────────────────────────

describe('UUID_RE', () => {
  it('14자리 hex 문자열에 매칭된다', () => {
    expect(UUID_RE.test('abcdef01234567')).toBe(true)
  })

  it('32자리 hex 문자열에 매칭된다', () => {
    // 정규식은 14~36자 hex에 매칭 — 32자도 범위 내
    expect(UUID_RE.test('550e8400e29b41d4a716446655440000')).toBe(true) // 32자
    expect(UUID_RE.test('abcdef0123456789abcdef0123456789abcd')).toBe(true) // 36자
  })

  it('대문자가 포함되면 매칭 안 된다', () => {
    expect(UUID_RE.test('ABCDEF01234567')).toBe(false)
  })

  it('13자리는 매칭 안 된다 (최소 14자)', () => {
    expect(UUID_RE.test('abcdef0123456')).toBe(false)
  })

  it('37자리는 매칭 안 된다 (최대 36자)', () => {
    expect(UUID_RE.test('abcdef0123456789abcdef0123456789abcde')).toBe(false)
  })

  it('hex 이외 문자가 포함되면 매칭 안 된다', () => {
    expect(UUID_RE.test('abcdef-123456')).toBe(false)
    expect(UUID_RE.test('gggggggggggggg')).toBe(false)
  })
})

// ── FlatNode world 필드 ────────────────────────────────────────

describe('FlatNode 인터페이스 — world 필드 존재 확인', () => {
  it('FlatNode 타입에 worldRotZ 필드가 있다', () => {
    // 타입 레벨 검증: FlatNode 객체를 구성해 world 필드가 있음을 확인
    const node = {
      uuid: 'test',
      name: 'TestNode',
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
      _rawIndex: 0,
    }
    const flatNode: FlatNode = {
      node,
      worldX: 10,
      worldY: 20,
      worldRotZ: 45,
      worldScaleX: 2,
      worldScaleY: 3,
      depth: 1,
      parentUuid: null,
      siblingIdx: 0,
      siblingTotal: 1,
      effectiveActive: true,
    }
    expect(flatNode.worldRotZ).toBe(45)
    expect(flatNode.worldScaleX).toBe(2)
    expect(flatNode.worldScaleY).toBe(3)
  })

  it('FlatNode worldX/worldY는 로컬 포지션과 다를 수 있다', () => {
    const node = {
      uuid: 'child',
      name: 'Child',
      active: true,
      position: { x: 50, y: 50, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      size: { x: 100, y: 100 },
      anchor: { x: 0.5, y: 0.5 },
      opacity: 255,
      color: { r: 255, g: 255, b: 255, a: 255 },
      components: [],
      children: [],
      _rawIndex: 1,
    }
    const flatNode: FlatNode = {
      node,
      worldX: 150,   // 부모 위치 100 + 로컬 50
      worldY: 200,
      worldRotZ: 0,
      worldScaleX: 1,
      worldScaleY: 1,
      depth: 2,
      parentUuid: 'parent',
      siblingIdx: 0,
      siblingTotal: 3,
      effectiveActive: true,
    }
    // worldX는 로컬 포지션 x(50)와 다를 수 있음
    expect(flatNode.worldX).not.toBe(flatNode.node.position.x)
    expect(flatNode.worldX).toBe(150)
  })

  it('FlatNode depth는 0 이상이다', () => {
    const node = {
      uuid: 'root',
      name: 'Root',
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
      _rawIndex: 0,
    }
    const flatNodeRoot: FlatNode = {
      node, worldX: 0, worldY: 0, worldRotZ: 0,
      worldScaleX: 1, worldScaleY: 1,
      depth: 0, parentUuid: null,
      siblingIdx: 0, siblingTotal: 1, effectiveActive: true,
    }
    expect(flatNodeRoot.depth).toBeGreaterThanOrEqual(0)
  })
})
