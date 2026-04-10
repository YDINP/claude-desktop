import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { LayoutRenderer } from '../renderers/LayoutRenderer'

vi.mock('../../../../../utils/i18n', () => ({
  t: (_key: string, fallback?: string) => fallback ?? _key,
}))

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

function makeProps(props: Record<string, unknown>) {
  const comp: CCSceneComponent = { type: 'cc.Layout', props }
  const draft = makeNode([comp])
  return {
    comp, draft,
    applyAndSave: vi.fn(),
    sceneFile: makeSceneFile(),
    origIdx: 0, ci: 0, is3x: false,
  }
}

// ── 기본 렌더링 ────────────────────────────────────────────────────────────────

describe('LayoutRenderer — 기본 렌더링', () => {
  it('cc.Layout — enabled 체크박스가 기본 true', () => {
    const { container } = render(<LayoutRenderer {...makeProps({})} />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>
    // 첫 번째 체크박스가 enabled
    expect(checkboxes[0].checked).toBe(true)
  })

  it('cc.Layout — enabled=false 이면 unchecked', () => {
    const { container } = render(<LayoutRenderer {...makeProps({ enabled: false })} />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>
    expect(checkboxes[0].checked).toBe(false)
  })

  it('cc.Layout — "enabled" 텍스트가 존재한다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    expect(screen.getByText('enabled')).toBeTruthy()
  })

  it('cc.Layout — "space" 레이블이 존재한다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    expect(screen.getByText('space')).toBeTruthy()
  })

  it('cc.Layout — "pad" 레이블이 존재한다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    expect(screen.getByText('pad')).toBeTruthy()
  })

  it('cc.Layout — "align" 레이블이 존재한다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    expect(screen.getByText('align')).toBeTruthy()
  })

  it('cc.Layout — "wrapMode" 레이블이 존재한다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    expect(screen.getByText('wrapMode')).toBeTruthy()
  })

  it('cc.Layout — "affectedByScale" 체크박스가 렌더링된다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    expect(screen.getByText('affectedByScale')).toBeTruthy()
  })

  it('cc.Layout 아닌 타입이면 null 반환', () => {
    const comp: CCSceneComponent = { type: 'cc.Sprite', props: {} }
    const draft = makeNode([comp])
    const { container } = render(
      <LayoutRenderer comp={comp} draft={draft} applyAndSave={vi.fn()}
        sceneFile={makeSceneFile()} origIdx={0} ci={0} is3x={false} />
    )
    expect(container.firstChild).toBeNull()
  })
})

// ── layoutType 선택 ────────────────────────────────────────────────────────────

describe('LayoutRenderer — layoutType', () => {
  it('layoutType=0 이면 None 선택', () => {
    render(<LayoutRenderer {...makeProps({ type: 0 })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[0].value).toBe('0')
  })

  it('layoutType=1 이면 Horizontal 선택', () => {
    render(<LayoutRenderer {...makeProps({ type: 1 })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[0].value).toBe('1')
  })

  it('layoutType=2 이면 Vertical 선택', () => {
    render(<LayoutRenderer {...makeProps({ type: 2 })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[0].value).toBe('2')
  })

  it('layoutType=3 이면 Grid 선택', () => {
    render(<LayoutRenderer {...makeProps({ type: 3 })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[0].value).toBe('3')
  })

  it('_N$type 폴백으로 layoutType 읽기', () => {
    render(<LayoutRenderer {...makeProps({ _N$type: 2 })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[0].value).toBe('2')
  })
})

// ── resizeMode 선택 ────────────────────────────────────────────────────────────

describe('LayoutRenderer — resizeMode', () => {
  it('resizeMode=0 이면 None 선택', () => {
    render(<LayoutRenderer {...makeProps({ resizeMode: 0 })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[1].value).toBe('0')
  })

  it('resizeMode=1 이면 Children 선택', () => {
    render(<LayoutRenderer {...makeProps({ resizeMode: 1 })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[1].value).toBe('1')
  })

  it('resizeMode=2 이면 Container 선택', () => {
    render(<LayoutRenderer {...makeProps({ resizeMode: 2 })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects[1].value).toBe('2')
  })
})

// ── spacingX / spacingY 입력 ───────────────────────────────────────────────────

describe('LayoutRenderer — spacing inputs', () => {
  it('spacingX=5 이면 X 입력 기본값 5', () => {
    const { container } = render(<LayoutRenderer {...makeProps({ spacingX: 5, spacingY: 0 })} />)
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    // spacing row: 첫 두 number input (X, Y)
    expect(Number(inputs[0].defaultValue)).toBe(5)
  })

  it('spacingY=10 이면 Y 입력 기본값 10', () => {
    const { container } = render(<LayoutRenderer {...makeProps({ spacingX: 0, spacingY: 10 })} />)
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    expect(Number(inputs[1].defaultValue)).toBe(10)
  })
})

// ── padding 입력 ───────────────────────────────────────────────────────────────

describe('LayoutRenderer — padding inputs', () => {
  it('paddingLeft=8 이면 L 입력 기본값 8', () => {
    const { container } = render(<LayoutRenderer {...makeProps({ paddingLeft: 8 })} />)
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    // spacing(2) + padding(4) — 인덱스 2가 paddingLeft
    expect(Number(inputs[2].defaultValue)).toBe(8)
  })

  it('paddingTop=15 이면 T 입력 기본값 15', () => {
    const { container } = render(<LayoutRenderer {...makeProps({ paddingTop: 15 })} />)
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    // index 4 = paddingTop (L, R, T, B 순서)
    expect(Number(inputs[4].defaultValue)).toBe(15)
  })

  it('_N$paddingLeft 폴백으로 paddingLeft 읽기', () => {
    const { container } = render(<LayoutRenderer {...makeProps({ _N$paddingLeft: 12 })} />)
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
    expect(Number(inputs[2].defaultValue)).toBe(12)
  })
})

// ── spacing 프리셋 ─────────────────────────────────────────────────────────────

describe('LayoutRenderer — spacing 프리셋 버튼', () => {
  it('프리셋 버튼 0, 5, 10, 20이 렌더링된다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    // 프리셋 버튼은 title="spacing X/Y = N" 형태
    const btn0 = screen.getByTitle('spacing X/Y = 0')
    const btn5 = screen.getByTitle('spacing X/Y = 5')
    const btn10 = screen.getByTitle('spacing X/Y = 10')
    const btn20 = screen.getByTitle('spacing X/Y = 20')
    expect(btn0).toBeTruthy()
    expect(btn5).toBeTruthy()
    expect(btn10).toBeTruthy()
    expect(btn20).toBeTruthy()
  })

  it('프리셋 버튼 클릭 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const comp: CCSceneComponent = { type: 'cc.Layout', props: { spacingX: 0, spacingY: 0 } }
    const draft = makeNode([comp])
    render(
      <LayoutRenderer comp={comp} draft={draft} applyAndSave={applyAndSave}
        sceneFile={makeSceneFile()} origIdx={0} ci={0} is3x={false} />
    )
    fireEvent.click(screen.getByTitle('spacing X/Y = 10'))
    expect(applyAndSave).toHaveBeenCalledOnce()
    const arg = applyAndSave.mock.calls[0][0]
    expect(arg.components[0].props.spacingX).toBe(10)
    expect(arg.components[0].props.spacingY).toBe(10)
  })
})

// ── padding 프리셋 ─────────────────────────────────────────────────────────────

describe('LayoutRenderer — padding 프리셋 버튼', () => {
  it('프리셋 버튼 0, 5, 10, 20이 렌더링된다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    expect(screen.getByTitle('padding 전체 = 0')).toBeTruthy()
    expect(screen.getByTitle('padding 전체 = 5')).toBeTruthy()
    expect(screen.getByTitle('padding 전체 = 10')).toBeTruthy()
    expect(screen.getByTitle('padding 전체 = 20')).toBeTruthy()
  })

  it('padding 프리셋 20 클릭 시 모든 padding이 20으로 설정', () => {
    const applyAndSave = vi.fn()
    const comp: CCSceneComponent = { type: 'cc.Layout', props: { paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 } }
    const draft = makeNode([comp])
    render(
      <LayoutRenderer comp={comp} draft={draft} applyAndSave={applyAndSave}
        sceneFile={makeSceneFile()} origIdx={0} ci={0} is3x={false} />
    )
    fireEvent.click(screen.getByTitle('padding 전체 = 20'))
    expect(applyAndSave).toHaveBeenCalledOnce()
    const props = applyAndSave.mock.calls[0][0].components[0].props
    expect(props.paddingLeft).toBe(20)
    expect(props.paddingRight).toBe(20)
    expect(props.paddingTop).toBe(20)
    expect(props.paddingBottom).toBe(20)
  })
})

// ── Grid 전용 UI ───────────────────────────────────────────────────────────────

describe('LayoutRenderer — Grid 전용 UI', () => {
  it('layoutType=3 이면 constraint 버튼들이 표시된다', () => {
    render(<LayoutRenderer {...makeProps({ type: 3 })} />)
    // constraint 버튼은 "Row"와 "Col"로 구분 (None은 select option과 중복)
    expect(screen.getByText('Row')).toBeTruthy()
    expect(screen.getByText('Col')).toBeTruthy()
  })

  it('layoutType=3 이면 "cell" 레이블이 표시된다', () => {
    render(<LayoutRenderer {...makeProps({ type: 3 })} />)
    expect(screen.getByText('cell')).toBeTruthy()
  })

  it('layoutType=3 이면 autoWrap 체크박스가 표시된다', () => {
    render(<LayoutRenderer {...makeProps({ type: 3 })} />)
    expect(screen.getByText('autoWrap')).toBeTruthy()
  })

  it('layoutType=3 이면 startAxis 버튼들이 표시된다', () => {
    render(<LayoutRenderer {...makeProps({ type: 3 })} />)
    expect(screen.getByText('H→')).toBeTruthy()
    expect(screen.getByText('V↓')).toBeTruthy()
  })

  it('layoutType=3 이면 constr 레이블이 표시된다', () => {
    render(<LayoutRenderer {...makeProps({ type: 3 })} />)
    expect(screen.getByText('constr')).toBeTruthy()
  })

  it('layoutType=0 이면 constraint 버튼이 없다', () => {
    render(<LayoutRenderer {...makeProps({ type: 0 })} />)
    expect(screen.queryByText('constr')).toBeNull()
  })

  it('layoutType=0 이면 cell 레이블이 없다', () => {
    render(<LayoutRenderer {...makeProps({ type: 0 })} />)
    expect(screen.queryByText('cell')).toBeNull()
  })
})

// ── direction 버튼 (H/V) ───────────────────────────────────────────────────────

describe('LayoutRenderer — direction 버튼', () => {
  it('layoutType=1(Horizontal) 이면 H/V direction 버튼이 표시된다', () => {
    render(<LayoutRenderer {...makeProps({ type: 1 })} />)
    expect(screen.getByText('L→R')).toBeTruthy()
    expect(screen.getByText('R→L')).toBeTruthy()
    expect(screen.getByText('B→T')).toBeTruthy()
    expect(screen.getByText('T→B')).toBeTruthy()
  })

  it('layoutType=0 이면 direction 버튼이 없다', () => {
    render(<LayoutRenderer {...makeProps({ type: 0 })} />)
    expect(screen.queryByText('L→R')).toBeNull()
  })
})

// ── childAlignment ─────────────────────────────────────────────────────────────

describe('LayoutRenderer — childAlignment', () => {
  it('align 버튼 "None", "C", "RB" 등이 표시된다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    // 테이블: 0→None,5→C,9→RB,...
    const aligns = ['None', 'LT', 'C', 'RB', 'LC', 'RC']
    for (const a of aligns) {
      expect(screen.getByTitle(new RegExp(`childAlignment = ${a}`))).toBeTruthy()
    }
  })
})

// ── enabled 변경 시 applyAndSave ───────────────────────────────────────────────

describe('LayoutRenderer — enabled 변경', () => {
  it('enabled 체크박스 변경 시 applyAndSave 호출', () => {
    const applyAndSave = vi.fn()
    const comp: CCSceneComponent = { type: 'cc.Layout', props: { enabled: true } }
    const draft = makeNode([comp])
    render(
      <LayoutRenderer comp={comp} draft={draft} applyAndSave={applyAndSave}
        sceneFile={makeSceneFile()} origIdx={0} ci={0} is3x={false} />
    )
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    fireEvent.click(checkboxes[0])
    expect(applyAndSave).toHaveBeenCalledOnce()
  })
})

// ── layoutType 변경 ────────────────────────────────────────────────────────────

describe('LayoutRenderer — layoutType 변경', () => {
  it('layoutType select 변경 시 applyAndSave 호출 with 새 layoutType', () => {
    const applyAndSave = vi.fn()
    const comp: CCSceneComponent = { type: 'cc.Layout', props: { type: 0 } }
    const draft = makeNode([comp])
    render(
      <LayoutRenderer comp={comp} draft={draft} applyAndSave={applyAndSave}
        sceneFile={makeSceneFile()} origIdx={0} ci={0} is3x={false} />
    )
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    fireEvent.change(selects[0], { target: { value: '2' } })
    expect(applyAndSave).toHaveBeenCalledOnce()
    const props = applyAndSave.mock.calls[0][0].components[0].props
    expect(props.type).toBe(2)
    expect(props._N$type).toBe(2)
  })
})

// ── wrapMode 버튼 ──────────────────────────────────────────────────────────────

describe('LayoutRenderer — wrapMode', () => {
  it('wrapMode 버튼 NoWrap/Wrap/1Line이 표시된다', () => {
    render(<LayoutRenderer {...makeProps({})} />)
    expect(screen.getByText('NoWrap')).toBeTruthy()
    expect(screen.getByText('Wrap')).toBeTruthy()
    expect(screen.getByText('1Line')).toBeTruthy()
  })
})
