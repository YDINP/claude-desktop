/**
 * Overflow:SHRINK 라벨 fontSize 축소 비율 계산 검증
 *
 * CCFileSceneView.tsx 인라인 로직:
 *   const charWidthRatio = isKorean ? 0.9 : 0.6
 *   const estimatedW = str.length * rawFs * charWidthRatio
 *   if (estimatedW > w) {
 *     fs = Math.max(rawFs * (w / estimatedW), 6)
 *   }
 *
 * 이 파일은 위 로직을 순수 함수로 추출하여 독립 검증한다.
 */
import { describe, it, expect } from 'vitest'

// ── 추출된 순수 함수 ────────────────────────────────────────────────────────────

/**
 * Overflow:SHRINK(overflow===2) 모드에서 bounding box 너비에 맞게 fontSize를 축소한다.
 * @param rawFs  원본 fontSize (px), 이미 clamp(8~200) 적용된 값
 * @param str    렌더링할 텍스트
 * @param w      bounding box 너비 (px), 0이면 축소 안 함
 * @param overflow  0=NONE, 1=CLAMP, 2=SHRINK, 3=RESIZE_HEIGHT
 * @returns 최종 fontSize (최소 6px)
 */
function computeShrinkFontSize(rawFs: number, str: string, w: number, overflow: number): number {
  if (overflow !== 2 || w <= 0) return rawFs
  const isKorean = /[\uAC00-\uD7A3]/.test(str)
  const charWidthRatio = isKorean ? 0.9 : 0.6
  const estimatedW = str.length * rawFs * charWidthRatio
  if (estimatedW > w) {
    return Math.max(rawFs * (w / estimatedW), 6)
  }
  return rawFs
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('computeShrinkFontSize (Overflow:SHRINK 로직)', () => {

  describe('overflow !== 2: 축소 없음', () => {
    it('overflow=0 (NONE): rawFs 그대로 반환', () => {
      expect(computeShrinkFontSize(32, 'Hello World', 100, 0)).toBe(32)
    })

    it('overflow=1 (CLAMP): rawFs 그대로 반환', () => {
      expect(computeShrinkFontSize(24, 'Hello', 50, 1)).toBe(24)
    })

    it('overflow=3 (RESIZE_HEIGHT): rawFs 그대로 반환', () => {
      expect(computeShrinkFontSize(20, 'Test', 80, 3)).toBe(20)
    })
  })

  describe('w <= 0: 축소 없음', () => {
    it('w=0: rawFs 그대로 반환', () => {
      expect(computeShrinkFontSize(32, 'Hello', 0, 2)).toBe(32)
    })

    it('w<0 (음수): rawFs 그대로 반환', () => {
      expect(computeShrinkFontSize(32, 'Hello', -10, 2)).toBe(32)
    })
  })

  describe('overflow=2, 텍스트가 w 안에 들어갈 때: 축소 없음', () => {
    it('Latin 텍스트가 충분히 짧을 때 rawFs 유지', () => {
      // "Hi" (2chars), rawFs=20, ratio=0.6 → estimatedW = 2*20*0.6 = 24
      // w=100 → estimatedW(24) < w(100) → no shrink
      expect(computeShrinkFontSize(20, 'Hi', 100, 2)).toBe(20)
    })

    it('한글 텍스트가 충분히 짧을 때 rawFs 유지', () => {
      // "가나" (2chars), rawFs=20, ratio=0.9 → estimatedW = 2*20*0.9 = 36
      // w=200 → no shrink
      expect(computeShrinkFontSize(20, '가나', 200, 2)).toBe(20)
    })
  })

  describe('overflow=2, 텍스트 축소 필요', () => {
    it('Latin 텍스트 축소: 비율이 정확히 계산됨', () => {
      // "Hello" (5chars), rawFs=30, ratio=0.6 → estimatedW = 5*30*0.6 = 90
      // w=45 → estimatedW(90) > w(45) → fs = 30 * (45/90) = 15
      const result = computeShrinkFontSize(30, 'Hello', 45, 2)
      expect(result).toBeCloseTo(15)
    })

    it('한글 텍스트 축소: charWidthRatio=0.9 적용', () => {
      // "가나다라마" (5chars), rawFs=40, ratio=0.9 → estimatedW = 5*40*0.9 = 180
      // w=90 → fs = 40 * (90/180) = 20
      const result = computeShrinkFontSize(40, '가나다라마', 90, 2)
      expect(result).toBeCloseTo(20)
    })

    it('축소 결과가 최소 6px을 보장함', () => {
      // 매우 긴 텍스트, 매우 좁은 w → fs가 6 미만이 될 경우 6으로 클램프
      const longText = 'A'.repeat(1000)
      const result = computeShrinkFontSize(32, longText, 10, 2)
      expect(result).toBe(6)
    })

    it('rawFs=8 (최소 허용값), 텍스트 초과 시 축소됨', () => {
      // "ABCDE" (5chars), rawFs=8, ratio=0.6 → estimatedW = 5*8*0.6 = 24
      // w=12 → fs = 8 * (12/24) = 4 → clamped to 6
      const result = computeShrinkFontSize(8, 'ABCDE', 12, 2)
      expect(result).toBe(6)
    })

    it('rawFs=200 (최대 허용값), 짧은 텍스트 + 좁은 w', () => {
      // "AB" (2chars), rawFs=200, ratio=0.6 → estimatedW = 2*200*0.6 = 240
      // w=120 → fs = 200 * (120/240) = 100
      const result = computeShrinkFontSize(200, 'AB', 120, 2)
      expect(result).toBeCloseTo(100)
    })

    it('w가 estimatedW와 정확히 같을 때: 축소 없음 (경계값)', () => {
      // "AB" (2chars), rawFs=20, ratio=0.6 → estimatedW = 2*20*0.6 = 24
      // w=24 → estimatedW(24) === w(24) → no shrink (not >)
      expect(computeShrinkFontSize(20, 'AB', 24, 2)).toBe(20)
    })

    it('한글+Latin 혼합 텍스트: 한글 포함 시 ratio=0.9', () => {
      // "가A" (2chars), rawFs=20, isKorean=true → ratio=0.9 → estimatedW = 2*20*0.9 = 36
      // w=18 → fs = 20 * (18/36) = 10
      const result = computeShrinkFontSize(20, '가A', 18, 2)
      expect(result).toBeCloseTo(10)
    })
  })

  describe('빈 문자열 처리', () => {
    it('빈 문자열: estimatedW=0 → 축소 없음', () => {
      // str.length = 0 → estimatedW = 0 → not > w → rawFs 반환
      expect(computeShrinkFontSize(24, '', 100, 2)).toBe(24)
    })
  })

  describe('단일 문자', () => {
    it('단일 Latin 문자가 w 초과 시 축소', () => {
      // "A" (1char), rawFs=100, ratio=0.6 → estimatedW = 60 > w=30 → fs = 100 * (30/60) = 50
      const result = computeShrinkFontSize(100, 'A', 30, 2)
      expect(result).toBeCloseTo(50)
    })

    it('단일 한글 문자가 w 초과 시 축소', () => {
      // "가" (1char), rawFs=100, ratio=0.9 → estimatedW = 90 > w=45 → fs = 100 * (45/90) = 50
      const result = computeShrinkFontSize(100, '가', 45, 2)
      expect(result).toBeCloseTo(50)
    })
  })
})
