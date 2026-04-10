import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { GenericPropertyEditor } from '../GenericPropertyEditor'

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: {
      ccFileResolveTexture: vi.fn().mockResolvedValue(null),
    },
    writable: true,
  })
})

// ── helpers ────────────────────────────────────────────────────────────────────

function makeNode(components: CCSceneComponent[] = []): CCSceneNode {
  return {
    uuid: 'n1', name: 'N', active: true,
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 }, opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components, children: [],
  }
}

function makeSceneFile(): CCSceneFile {
  return {
    projectInfo: { detected: true, version: '2x', assetsDir: '/fake' },
    scenePath: '/fake/scene.fire',
    root: makeNode(),
  }
}

interface MakeGpeOptions {
  compType?: string
  props?: Record<string, unknown>
  propSearch?: string
  favProps?: Set<string>
  collapsedComps?: Set<string>
  typeMatchedComps?: Array<{ comp: CCSceneComponent; origIdx: number }> | null
}

function makeGpeProps(opts: MakeGpeOptions = {}) {
  const {
    compType = 'cc.AudioSource',
    props = {},
    propSearch = '',
    favProps = new Set<string>(),
    collapsedComps = new Set<string>(),
    typeMatchedComps = null,
  } = opts
  const comp: CCSceneComponent = { type: compType, props }
  const draft = makeNode([comp])
  const origSnapRef = { current: draft } as React.MutableRefObject<CCSceneNode | null>
  return {
    comp, draft,
    applyAndSave: vi.fn(),
    origIdx: 0, ci: 0,
    propSearch,
    setPropSearch: vi.fn(),
    favProps,
    toggleFavProp: vi.fn(),
    expandedArrayProps: new Set<string>(),
    setExpandedArrayProps: vi.fn() as React.Dispatch<React.SetStateAction<Set<string>>>,
    origSnapRef,
    collapsedComps,
    typeMatchedComps,
  }
}

// ── COMP_SKIP 로직 ─────────────────────────────────────────────────────────────

describe('GenericPropertyEditor — COMP_SKIP', () => {
  it('cc.Label: "fontSize"는 COMP_SKIP으로 필터링되어 렌더링되지 않는다', () => {
    const p = makeGpeProps({ compType: 'cc.Label', props: { fontSize: 24, extraProp: 'hello' } })
    render(<GenericPropertyEditor {...p} />)
    // extraProp은 표시, fontSize는 COMP_SKIP
    expect(screen.getByText('extraProp')).toBeTruthy()
    expect(screen.queryByText('fontSize')).toBeNull()
  })

  it('cc.Sprite: "spriteFrame"은 COMP_SKIP으로 필터링되어 렌더링되지 않는다', () => {
    const p = makeGpeProps({ compType: 'cc.Sprite', props: { spriteFrame: null, myCustom: 1 } })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.queryByText('spriteFrame')).toBeNull()
  })

  it('cc.Button: "interactable"은 COMP_SKIP으로 필터링된다', () => {
    const p = makeGpeProps({ compType: 'cc.Button', props: { interactable: true, otherProp: 42 } })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.queryByText('interactable')).toBeNull()
    expect(screen.getByText('otherProp')).toBeTruthy()
  })

  it('HIDDEN: "enabled"는 항상 숨겨진다', () => {
    const p = makeGpeProps({ props: { enabled: true, visible: true } })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.queryByText('enabled')).toBeNull()
  })

  it('HIDDEN: "id"는 항상 숨겨진다', () => {
    // cc.Unknown에서 COMP_SKIP 없음, myProp은 표시됨
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { id: 'abc123', myProp: 0.8 } })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.queryByText('id')).toBeNull()
    expect(screen.getByText('myProp')).toBeTruthy()
  })

  it('HIDDEN: "objFlags"는 항상 숨겨진다', () => {
    const p = makeGpeProps({ props: { objFlags: 0, pitch: 1 } })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.queryByText('objFlags')).toBeNull()
  })
})

// ── prop 렌더링 ────────────────────────────────────────────────────────────────

describe('GenericPropertyEditor — prop 렌더링', () => {
  it('number 타입 prop은 number input으로 렌더링된다', () => {
    // cc.Unknown 타입은 COMP_SKIP 없음 — customNum은 number로 렌더링
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { customNum: 0.8 } })
    const { container } = render(<GenericPropertyEditor {...p} />)
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('boolean 타입 prop은 BoolToggle(체크박스 토글)로 렌더링된다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { myFlag: true } })
    const { container } = render(<GenericPropertyEditor {...p} />)
    // BoolToggle은 opacity:0 checkbox + span으로 구성
    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>
    expect(checkboxes.length).toBeGreaterThan(0)
  })

  it('string 타입 prop은 textarea로 렌더링된다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { tag: 'player' } })
    const { container } = render(<GenericPropertyEditor {...p} />)
    const textareas = container.querySelectorAll('textarea') as NodeListOf<HTMLTextAreaElement>
    expect(textareas.length).toBeGreaterThan(0)
  })

  it('__uuid__ 객체 prop은 단축 UUID로 렌더링된다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { myClip: { __uuid__: 'abcdef1234567890' } } })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.getByText('abcdef12…')).toBeTruthy()
  })

  it('__id__ 객체 prop은 ref[N] 형태로 렌더링된다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { myRef: { __id__: 5 } } })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.getByText('ref[5]')).toBeTruthy()
  })

  it('색상 객체 {r,g,b}는 color picker로 렌더링된다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { fillColor: { r: 255, g: 128, b: 0 } } })
    const { container } = render(<GenericPropertyEditor {...p} />)
    const colorInputs = container.querySelectorAll('input[type="color"]') as NodeListOf<HTMLInputElement>
    expect(colorInputs.length).toBeGreaterThan(0)
  })

  it('색상 {r,g,b,a}는 alpha 슬라이더도 렌더링된다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { tint: { r: 255, g: 255, b: 255, a: 128 } } })
    const { container } = render(<GenericPropertyEditor {...p} />)
    const ranges = container.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>
    expect(ranges.length).toBeGreaterThan(0)
  })

  it('prop이 3개 이상이면 Filter input이 렌더링된다', () => {
    // cc.Unknown은 COMP_SKIP 없음
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { a: 1, b: 2, c: 3 } })
    render(<GenericPropertyEditor {...p} />)
    const filterInput = screen.getByPlaceholderText('Filter properties...')
    expect(filterInput).toBeTruthy()
  })

  it('prop이 2개이면 Filter input이 렌더링되지 않는다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { a: 1, b: 2 } })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.queryByPlaceholderText('Filter properties...')).toBeNull()
  })
})

// ── propSearch 필터 ────────────────────────────────────────────────────────────

describe('GenericPropertyEditor — propSearch 필터', () => {
  it('propSearch 매칭 시 해당 prop만 표시된다', () => {
    // cc.Unknown: COMP_SKIP 없음, 모든 prop 표시
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { myVolume: 0.5, myLoop: false, myPitch: 1.0 }, propSearch: 'vol' })
    render(<GenericPropertyEditor {...p} />)
    // propSearch='vol'이면 myVolume만 매칭, myLoop 미표시
    // 하이라이트 처리로 텍스트가 분리되므로 prop-row 클래스로 확인
    const rows = document.querySelectorAll('.prop-row')
    expect(rows.length).toBe(1) // myVolume 하나만 표시
    expect(rows[0].textContent).toContain('myVolume')
  })

  it('propSearch 대소문자 무시 매칭', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { MyVolume: 0.5, myLoop: false }, propSearch: 'volume' })
    render(<GenericPropertyEditor {...p} />)
    // 하이라이트 처리로 span이 분리됨 — row 텍스트로 확인
    const rows = document.querySelectorAll('.prop-row')
    expect(rows.length).toBe(1) // MyVolume만 매칭
    expect(rows[0].textContent).toContain('MyVolume')
  })

  it('propSearch가 빈 문자열이면 전체 prop 표시', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { alpha: 0.5, beta: false, gamma: 1.0 }, propSearch: '' })
    render(<GenericPropertyEditor {...p} />)
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
    expect(screen.getByText('gamma')).toBeTruthy()
  })
})

// ── collapsedComps ─────────────────────────────────────────────────────────────

describe('GenericPropertyEditor — collapsedComps', () => {
  it('컴포넌트가 collapsed이면 null 반환 (typeMatchedComps=null)', () => {
    const p = makeGpeProps({
      compType: 'cc.AudioSource',
      props: { volume: 0.5 },
      collapsedComps: new Set(['cc.AudioSource']),
      typeMatchedComps: null,
    })
    const { container } = render(<GenericPropertyEditor {...p} />)
    expect(container.firstChild).toBeNull()
  })

  it('typeMatchedComps가 있으면 collapsed 무시하고 렌더링', () => {
    // cc.AudioSource의 COMP_SKIP에 없는 prop 사용
    const comp: CCSceneComponent = { type: 'cc.AudioSource', props: { customPitchMultiplier: 1.2 } }
    const draft = makeNode([comp])
    const p = {
      comp, draft,
      applyAndSave: vi.fn(),
      origIdx: 0, ci: 0,
      propSearch: '',
      setPropSearch: vi.fn(),
      favProps: new Set<string>(),
      toggleFavProp: vi.fn(),
      expandedArrayProps: new Set<string>(),
      setExpandedArrayProps: vi.fn() as React.Dispatch<React.SetStateAction<Set<string>>>,
      origSnapRef: { current: draft } as React.MutableRefObject<CCSceneNode | null>,
      collapsedComps: new Set(['cc.AudioSource']),
      typeMatchedComps: [{ comp, origIdx: 0 }],
    }
    render(<GenericPropertyEditor {...p} />)
    expect(screen.getByText('customPitchMultiplier')).toBeTruthy()
  })
})

// ── 즐겨찾기 ────────────────────────────────────────────────────────────────────

describe('GenericPropertyEditor — 즐겨찾기', () => {
  it('즐겨찾기 prop은 맨 앞에 정렬된다', () => {
    const p = makeGpeProps({
      compType: 'cc.Unknown',
      props: { alpha: 0.5, beta: 1, gamma: 2 },
      favProps: new Set(['cc.Unknown:gamma']),
    })
    render(<GenericPropertyEditor {...p} />)
    // 즐겨찾기 prop-row들의 순서 확인 — gamma가 맨 앞
    const rows = document.querySelectorAll('.prop-row')
    expect(rows.length).toBeGreaterThanOrEqual(3)
    // 첫 번째 row에 gamma 텍스트가 포함되어야 함
    expect(rows[0].textContent).toContain('gamma')
  })

  it('즐겨찾기 버튼 클릭 시 toggleFavProp 호출', () => {
    const toggleFavProp = vi.fn()
    const p = { ...makeGpeProps({ compType: 'cc.Unknown', props: { customProp: 0.5 } }), toggleFavProp }
    const { container } = render(<GenericPropertyEditor {...p} />)
    const favBtn = container.querySelector('.prop-fav') as HTMLElement
    expect(favBtn).toBeTruthy()
    fireEvent.click(favBtn)
    expect(toggleFavProp).toHaveBeenCalledWith('cc.Unknown', 'customProp')
  })
})

// ── 편집 (number/bool/string) ──────────────────────────────────────────────────

describe('GenericPropertyEditor — 편집', () => {
  it('number input 변경 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const p = { ...makeGpeProps({ compType: 'cc.Unknown', props: { mySpeed: 5 } }), applyAndSave }
    const { container } = render(<GenericPropertyEditor {...p} />)
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    expect(inputs.length).toBeGreaterThan(0)
    fireEvent.blur(inputs[0], { target: { value: '10' } })
    expect(applyAndSave).toHaveBeenCalled()
  })

  it('boolean BoolToggle 변경 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const p = { ...makeGpeProps({ compType: 'cc.Unknown', props: { myFlag: false } }), applyAndSave }
    const { container } = render(<GenericPropertyEditor {...p} />)
    // BoolToggle은 label 클릭으로도 토글 가능
    const toggleLabel = container.querySelector('label') as HTMLLabelElement
    expect(toggleLabel).toBeTruthy()
    fireEvent.click(toggleLabel)
    expect(applyAndSave).toHaveBeenCalled()
  })

  it('string textarea blur 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const p = { ...makeGpeProps({ compType: 'cc.Unknown', props: { tag: 'player' } }), applyAndSave }
    const { container } = render(<GenericPropertyEditor {...p} />)
    const textareas = container.querySelectorAll('textarea') as NodeListOf<HTMLTextAreaElement>
    expect(textareas.length).toBeGreaterThan(0)
    fireEvent.blur(textareas[0], { target: { value: 'enemy' } })
    expect(applyAndSave).toHaveBeenCalled()
  })
})

// ── vec2/vec3 타입 ──────────────────────────────────────────────────────────────

describe('GenericPropertyEditor — vector prop', () => {
  it('cc.Vec2 타입 prop은 X/Y 두 input을 렌더링한다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { offset: { __type__: 'cc.Vec2', x: 10, y: 20 } } })
    const { container } = render(<GenericPropertyEditor {...p} />)
    const numInputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    expect(numInputs.length).toBeGreaterThanOrEqual(2)
  })

  it('cc.Vec3 타입 prop은 X/Y/Z 세 input을 렌더링한다', () => {
    const p = makeGpeProps({ compType: 'cc.Unknown', props: { velocity: { __type__: 'cc.Vec3', x: 1, y: 2, z: 3 } } })
    const { container } = render(<GenericPropertyEditor {...p} />)
    const numInputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    expect(numInputs.length).toBeGreaterThanOrEqual(3)
  })
})
