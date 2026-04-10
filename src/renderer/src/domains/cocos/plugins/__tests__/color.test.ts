import { describe, it, expect } from 'vitest'

// color.tsx의 순수 로직 함수들을 인라인으로 복제하여 테스트
// (color.tsx는 React 컴포넌트이므로 로직만 분리)

// ── parseHex ──────────────────────────────────────────────────
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
  return null
}

// ── hslToRgb (R2626 무지개 색상) ─────────────────────────────
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return {
    r: Math.round(hue2rgb(h + 1 / 3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1 / 3) * 255),
  }
}

// ── clamp (R2743 밝기 조절) ───────────────────────────────────
function clamp(v: number): number {
  return Math.max(0, Math.min(255, v))
}

// ── colorBlend (R2676) ────────────────────────────────────────
function colorBlend(
  src: { r: number; g: number; b: number; a: number },
  target: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number; a: number } {
  return {
    r: Math.round(src.r + (target.r - src.r) * t),
    g: Math.round(src.g + (target.g - src.g) * t),
    b: Math.round(src.b + (target.b - src.b) * t),
    a: src.a,
  }
}

// ── opacityGradient (R2525) ───────────────────────────────────
function opacityGradient(from: number, to: number, idx: number, total: number): number {
  const t = total > 1 ? idx / (total - 1) : 0
  return Math.max(0, Math.min(255, Math.round(from + (to - from) * t)))
}

// ── colorInvert (R2677) ───────────────────────────────────────
function colorInvert(c: { r: number; g: number; b: number; a: number }) {
  return { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b, a: c.a }
}

// ── colorDelta (R2704) ────────────────────────────────────────
function applyColorDelta(
  c: { r: number; g: number; b: number; a: number },
  dr: number, dg: number, db: number, da: number
) {
  return {
    r: Math.min(255, Math.max(0, c.r + dr)),
    g: Math.min(255, Math.max(0, c.g + dg)),
    b: Math.min(255, Math.max(0, c.b + db)),
    a: Math.min(255, Math.max(0, (c.a ?? 255) + da)),
  }
}

// ─────────────────────────────────────────────────────────────

describe('color plugin — parseHex', () => {
  it('#ffffff → {r:255, g:255, b:255}', () => {
    expect(parseHex('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('#000000 → {r:0, g:0, b:0}', () => {
    expect(parseHex('#000000')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('#ff0000 → {r:255, g:0, b:0}', () => {
    expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('대문자도 파싱된다', () => {
    expect(parseHex('#FF8800')).toEqual({ r: 255, g: 136, b: 0 })
  })

  it('잘못된 형식은 null 반환', () => {
    expect(parseHex('ffffff')).toBeNull()
    expect(parseHex('#gggggg')).toBeNull()
    expect(parseHex('#fff')).toBeNull()
    expect(parseHex('')).toBeNull()
  })
})

describe('color plugin — hslToRgb (R2626)', () => {
  it('빨강 hsl(0, 1, 0.5) → {r:255, g:0, b:0}', () => {
    const rgb = hslToRgb(0, 1, 0.5)
    expect(rgb.r).toBe(255)
    expect(rgb.g).toBe(0)
    expect(rgb.b).toBe(0)
  })

  it('초록 hsl(1/3, 1, 0.5) → {r:0, g:255, b:0}', () => {
    const rgb = hslToRgb(1 / 3, 1, 0.5)
    expect(rgb.r).toBe(0)
    expect(rgb.g).toBe(255)
    expect(rgb.b).toBe(0)
  })

  it('파랑 hsl(2/3, 1, 0.5) → {r:0, g:0, b:255}', () => {
    const rgb = hslToRgb(2 / 3, 1, 0.5)
    expect(rgb.r).toBe(0)
    expect(rgb.g).toBe(0)
    expect(rgb.b).toBe(255)
  })

  it('흰색 hsl(0, 0, 1) → {r:255, g:255, b:255}', () => {
    const rgb = hslToRgb(0, 0, 1)
    expect(rgb.r).toBe(255)
    expect(rgb.g).toBe(255)
    expect(rgb.b).toBe(255)
  })

  it('검정 hsl(0, 0, 0) → {r:0, g:0, b:0}', () => {
    const rgb = hslToRgb(0, 0, 0)
    expect(rgb.r).toBe(0)
    expect(rgb.g).toBe(0)
    expect(rgb.b).toBe(0)
  })

  it('r/g/b 값은 0~255 범위를 유지한다', () => {
    for (let h = 0; h < 1; h += 0.1) {
      const rgb = hslToRgb(h, 1, 0.6)
      expect(rgb.r).toBeGreaterThanOrEqual(0)
      expect(rgb.r).toBeLessThanOrEqual(255)
      expect(rgb.g).toBeGreaterThanOrEqual(0)
      expect(rgb.g).toBeLessThanOrEqual(255)
      expect(rgb.b).toBeGreaterThanOrEqual(0)
      expect(rgb.b).toBeLessThanOrEqual(255)
    }
  })
})

describe('color plugin — clamp (R2743)', () => {
  it('0~255 범위 내 값은 그대로', () => {
    expect(clamp(0)).toBe(0)
    expect(clamp(128)).toBe(128)
    expect(clamp(255)).toBe(255)
  })

  it('255 초과는 255로 클램프', () => {
    expect(clamp(256)).toBe(255)
    expect(clamp(300)).toBe(255)
  })

  it('0 미만은 0으로 클램프', () => {
    expect(clamp(-1)).toBe(0)
    expect(clamp(-100)).toBe(0)
  })
})

describe('color plugin — colorBlend (R2676)', () => {
  it('t=0이면 원본 색상 유지', () => {
    const src = { r: 100, g: 150, b: 200, a: 255 }
    const result = colorBlend(src, { r: 0, g: 0, b: 0 }, 0)
    expect(result.r).toBe(100)
    expect(result.g).toBe(150)
    expect(result.b).toBe(200)
  })

  it('t=1이면 목표 색상으로 완전 변경', () => {
    const src = { r: 255, g: 0, b: 0, a: 200 }
    const result = colorBlend(src, { r: 0, g: 255, b: 0 }, 1)
    expect(result.r).toBe(0)
    expect(result.g).toBe(255)
    expect(result.b).toBe(0)
    expect(result.a).toBe(200)  // alpha 보존
  })

  it('t=0.5이면 중간값', () => {
    const src = { r: 0, g: 0, b: 0, a: 255 }
    const result = colorBlend(src, { r: 200, g: 100, b: 0 }, 0.5)
    expect(result.r).toBe(100)
    expect(result.g).toBe(50)
    expect(result.b).toBe(0)
  })

  it('alpha는 src에서 보존된다', () => {
    const src = { r: 255, g: 255, b: 255, a: 128 }
    const result = colorBlend(src, { r: 0, g: 0, b: 0 }, 0.5)
    expect(result.a).toBe(128)
  })
})

describe('color plugin — opacityGradient (R2525)', () => {
  it('단일 노드(total=1)이면 항상 from 값', () => {
    expect(opacityGradient(255, 0, 0, 1)).toBe(255)
  })

  it('첫 번째 노드(idx=0)는 from 값', () => {
    expect(opacityGradient(255, 0, 0, 5)).toBe(255)
  })

  it('마지막 노드(idx=total-1)는 to 값', () => {
    expect(opacityGradient(255, 0, 4, 5)).toBe(0)
  })

  it('중간 노드는 선형 보간값', () => {
    // from=0, to=200, total=5
    // idx=2 → t=2/4=0.5 → 0 + (200-0)*0.5 = 100
    expect(opacityGradient(0, 200, 2, 5)).toBe(100)
  })

  it('결과는 0~255 범위를 벗어나지 않는다', () => {
    expect(opacityGradient(-100, 300, 0, 3)).toBeGreaterThanOrEqual(0)
    expect(opacityGradient(-100, 300, 2, 3)).toBeLessThanOrEqual(255)
  })
})

describe('color plugin — colorInvert (R2677)', () => {
  it('흰색 반전 → 검정', () => {
    expect(colorInvert({ r: 255, g: 255, b: 255, a: 255 })).toEqual({ r: 0, g: 0, b: 0, a: 255 })
  })

  it('검정 반전 → 흰색', () => {
    expect(colorInvert({ r: 0, g: 0, b: 0, a: 255 })).toEqual({ r: 255, g: 255, b: 255, a: 255 })
  })

  it('alpha는 보존된다', () => {
    const result = colorInvert({ r: 100, g: 150, b: 200, a: 128 })
    expect(result.a).toBe(128)
    expect(result.r).toBe(155)
    expect(result.g).toBe(105)
    expect(result.b).toBe(55)
  })
})

describe('color plugin — applyColorDelta (R2704)', () => {
  it('모든 채널에 양수 오프셋 적용', () => {
    const result = applyColorDelta({ r: 100, g: 100, b: 100, a: 255 }, 30, 20, 10, 0)
    expect(result.r).toBe(130)
    expect(result.g).toBe(120)
    expect(result.b).toBe(110)
  })

  it('255 초과는 255로 클램프', () => {
    const result = applyColorDelta({ r: 250, g: 250, b: 250, a: 255 }, 30, 30, 30, 0)
    expect(result.r).toBe(255)
    expect(result.g).toBe(255)
    expect(result.b).toBe(255)
  })

  it('0 미만은 0으로 클램프', () => {
    const result = applyColorDelta({ r: 10, g: 10, b: 10, a: 255 }, -30, -30, -30, 0)
    expect(result.r).toBe(0)
    expect(result.g).toBe(0)
    expect(result.b).toBe(0)
  })

  it('알파 채널도 오프셋 적용', () => {
    const result = applyColorDelta({ r: 0, g: 0, b: 0, a: 100 }, 0, 0, 0, 50)
    expect(result.a).toBe(150)
  })
})
