import { describe, it, expect } from 'vitest'
import {
  sceneViewKey,
  ALIGN_SNAP_THRESHOLD,
  RESOLUTION_PRESETS,
  UUID_RE,
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
