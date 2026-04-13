/**
 * CCFileSceneView — 뷰포트 컬링 순수 함수 테스트
 * isNodeVisibleInViewport: 화면 내/외 판단 로직
 */
import { describe, it, expect } from 'vitest'
import { isNodeVisibleInViewport, VIEWPORT_CULL_MARGIN } from '../ccSceneTypes'

// 기본 뷰 (zoom=1, offset 없음, 뷰포트 800×600)
const DEFAULT_VP = { zoom: 1, offsetX: 0, offsetY: 0, vpW: 800, vpH: 600 }

function visible(
  svgX: number,
  svgY: number,
  w: number,
  h: number,
  anchorX = 0.5,
  anchorY = 0.5,
  vp = DEFAULT_VP,
  margin = VIEWPORT_CULL_MARGIN,
): boolean {
  return isNodeVisibleInViewport(svgX, svgY, w, h, anchorX, anchorY, vp.zoom, vp.offsetX, vp.offsetY, vp.vpW, vp.vpH, margin)
}

// ── 화면 내 노드 → 렌더링 ──────────────────────────────────────────────────────

describe('isNodeVisibleInViewport — 화면 내 노드', () => {
  it('화면 중앙 노드는 visible=true', () => {
    // anchor=0.5,0.5, 100×100 노드, SVG pos = (400, 300) = 뷰포트 중앙
    expect(visible(400, 300, 100, 100)).toBe(true)
  })

  it('화면 좌상단 코너 근처 노드', () => {
    // 좌상단: svgPos=(0,0), 100×100, anchor=0.5 → screenL=-50, screenT=-50 → margin=100이면 OK
    expect(visible(0, 0, 100, 100)).toBe(true)
  })

  it('화면 우하단 코너 근처 노드', () => {
    // 우하단: svgPos=(800,600), 100×100, anchor=0.5 → screenR=850, screenB=650 → 뷰포트+margin 이내
    expect(visible(800, 600, 100, 100)).toBe(true)
  })

  it('zoom=2일 때 중앙 노드', () => {
    const vp = { zoom: 2, offsetX: 0, offsetY: 0, vpW: 800, vpH: 600 }
    expect(visible(200, 150, 100, 100, 0.5, 0.5, vp)).toBe(true)
  })

  it('offset 이동 시 이전에 밖이었던 노드가 화면 안으로 들어옴', () => {
    // offset이 없으면 svgPos=(-200, 0) → 화면 밖, offset=+400이면 화면 안
    const vpOff = { zoom: 1, offsetX: 400, offsetY: 0, vpW: 800, vpH: 600 }
    expect(visible(-200, 300, 100, 100, 0.5, 0.5, vpOff)).toBe(true)
  })
})

// ── 화면 밖 노드 → null (컬링) ────────────────────────────────────────────────

describe('isNodeVisibleInViewport — 화면 밖 노드', () => {
  it('완전히 왼쪽 밖 — screenR < -MARGIN', () => {
    // svgPos.x=0, w=50, anchor=0.5 → screenL=-25, screenR=25 → OK
    // svgPos.x=-300, w=50 → screenL=-325, screenR=-275 → screenR < -100 → culled
    expect(visible(-300, 300, 50, 50)).toBe(false)
  })

  it('완전히 오른쪽 밖 — screenL > vpW + MARGIN', () => {
    // svgPos.x=1100, w=50, anchor=0.5 → screenL=1075 > 800+100=900 → culled
    expect(visible(1100, 300, 50, 50)).toBe(false)
  })

  it('완전히 위쪽 밖 — screenB < -MARGIN', () => {
    // svgPos.y=-300, h=50 → screenT=-325, screenB=-275 → culled
    expect(visible(400, -300, 50, 50)).toBe(false)
  })

  it('완전히 아래쪽 밖 — screenT > vpH + MARGIN', () => {
    // svgPos.y=900, h=50, anchor → screenT=875 > 600+100=700 → culled
    expect(visible(400, 900, 50, 50)).toBe(false)
  })

  it('zoom=0.5으로 축소 시 멀리 있는 노드는 여전히 컬링', () => {
    const vp = { zoom: 0.5, offsetX: 0, offsetY: 0, vpW: 800, vpH: 600 }
    // svgPos.x=3000 → screenL = (3000 - 50*0.5)*0.5 = 1487.5 > 800+100 → culled
    expect(visible(3000, 300, 100, 100, 0.5, 0.5, vp)).toBe(false)
  })
})

// ── margin 100px 내 → 렌더링 ──────────────────────────────────────────────────

describe('isNodeVisibleInViewport — margin=100px 경계', () => {
  it('screenR = -99 (margin=100 내) → visible', () => {
    // anchor=0, w=1: screenL = svgX*1+0, screenR = screenL+1
    // screenR=-99 → screenL=-100 → svgX=-100 (anchor=0이면 screenL=svgX)
    // anchor=0: screenL = (svgX - w*0)*1 = svgX, screenR = svgX+w
    // screenR = -99 → svgX + 1 = -99 → svgX = -100
    expect(visible(-100, 300, 1, 1, 0, 0)).toBe(true)
  })

  it('screenR = -101 (margin=100 밖) → culled', () => {
    // screenR = -101 → svgX + 1 = -101 → svgX = -102
    expect(visible(-102, 300, 1, 1, 0, 0)).toBe(false)
  })

  it('screenL = vpW + 99 (margin=100 내) → visible', () => {
    // anchor=0, w=1: screenL = svgX, screenR = svgX+1
    // screenL = 899 → svgX = 899 < 800+100=900 → visible
    expect(visible(899, 300, 1, 1, 0, 0)).toBe(true)
  })

  it('screenL = vpW + 101 (margin=100 밖) → culled', () => {
    // screenL = 901 > 900 → culled
    expect(visible(901, 300, 1, 1, 0, 0)).toBe(false)
  })

  it('커스텀 margin=0이면 경계가 엄격해짐', () => {
    // screenR=0이면 visible=false (margin=0: screenR < 0)
    // anchor=0, w=1, svgX=-1 → screenL=-1, screenR=0 → !(0 < 0) = true (경계는 포함)
    expect(visible(-1, 300, 1, 1, 0, 0, DEFAULT_VP, 0)).toBe(true)
    // svgX=-2 → screenR=-1 < 0 → culled
    expect(visible(-2, 300, 1, 1, 0, 0, DEFAULT_VP, 0)).toBe(false)
  })
})

// ── anchor 다양한 값 ──────────────────────────────────────────────────────────

describe('isNodeVisibleInViewport — anchor 영향', () => {
  it('anchor=0 (좌하단 기준) — 위치 계산 올바름', () => {
    // anchor=(0,0): screenL = svgX - w*0 = svgX, screenT = svgY - h*1 = svgY-h
    // svgX=50, w=100, anchor=0: screenL=50, screenR=150 → visible
    expect(visible(50, 300, 100, 100, 0, 0)).toBe(true)
  })

  it('anchor=1 (우상단 기준) — 위치 계산 올바름', () => {
    // anchor=(1,1): screenL = svgX - w*1 = svgX-w
    // svgX=800, w=100, anchor=1: screenL=700, screenR=800 → visible
    expect(visible(800, 300, 100, 100, 1, 1)).toBe(true)
  })
})
