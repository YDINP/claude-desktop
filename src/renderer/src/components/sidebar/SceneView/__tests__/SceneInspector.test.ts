import { describe, it, expect } from 'vitest'

// SceneInspector 내 alpha clamp 로직 (line 800)
// onChange={e => onColorUpdate?.(node.uuid, { a: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })}
function clampAlpha(raw: string): number {
  return Math.max(0, Math.min(255, parseInt(raw) || 0))
}

// SceneInspector 내 toHex 헬퍼 (line 34)
// const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
function toHex(v: number): string {
  return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
}

describe('SceneInspector — alpha clamp', () => {
  it('정상 범위(0-255) 입력은 그대로 반환한다', () => {
    expect(clampAlpha('0')).toBe(0)
    expect(clampAlpha('128')).toBe(128)
    expect(clampAlpha('255')).toBe(255)
  })

  it('255 초과 입력은 255로 클램핑한다', () => {
    expect(clampAlpha('256')).toBe(255)
    expect(clampAlpha('999')).toBe(255)
  })

  it('0 미만 입력은 0으로 클램핑한다', () => {
    expect(clampAlpha('-1')).toBe(0)
    expect(clampAlpha('-100')).toBe(0)
  })

  it('NaN/빈 문자열 입력은 0을 반환한다', () => {
    expect(clampAlpha('')).toBe(0)
    expect(clampAlpha('abc')).toBe(0)
  })
})

describe('SceneInspector — toHex clamp', () => {
  it('정상 범위 값을 2자리 16진수로 변환한다', () => {
    expect(toHex(0)).toBe('00')
    expect(toHex(255)).toBe('ff')
    expect(toHex(16)).toBe('10')
  })

  it('255 초과 값은 ff로 클램핑한다', () => {
    expect(toHex(256)).toBe('ff')
    expect(toHex(300)).toBe('ff')
  })

  it('0 미만 값은 00으로 클램핑한다', () => {
    expect(toHex(-1)).toBe('00')
  })

  it('소수점 값은 반올림 후 변환한다', () => {
    expect(toHex(15.7)).toBe('10')
    expect(toHex(15.4)).toBe('0f')
  })
})
