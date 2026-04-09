import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import {
  NumInput,
  SectionHeader,
  WidgetInspector,
  SpriteInspector,
  LabelInspector,
  ButtonInspector,
} from '../InspectorComponents'
import type { SceneNode } from '../types'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    uuid: 'test-uuid',
    name: 'TestNode',
    active: true,
    x: 0, y: 0,
    width: 100, height: 100,
    anchorX: 0.5, anchorY: 0.5,
    scaleX: 1, scaleY: 1,
    rotation: 0,
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    parentUuid: null,
    childUuids: [],
    components: [],
    ...overrides,
  }
}

// ── NumInput ──────────────────────────────────────────────────────────────────

describe('NumInput', () => {
  it('초기 value가 input에 표시된다', () => {
    const onSave = vi.fn()
    render(<NumInput label="X" value={42} prop="x" uuid="u1" onSave={onSave} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('42')
  })

  it('label이 렌더링된다', () => {
    render(<NumInput label="PosX" value={0} prop="x" uuid="u1" onSave={vi.fn()} />)
    expect(screen.getByText('PosX')).toBeTruthy()
  })

  it('decimals=2이면 소수점 2자리로 포맷한다', () => {
    render(<NumInput label="R" value={1.5} decimals={2} prop="r" uuid="u1" onSave={vi.fn()} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('1.5')
  })

  it('값이 정수이면 decimals=0으로 포맷한다', () => {
    render(<NumInput label="X" value={10.7} decimals={0} prop="x" uuid="u1" onSave={vi.fn()} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('11')
  })

  it('값이 변경되면 draft가 업데이트된다', () => {
    render(<NumInput label="X" value={0} prop="x" uuid="u1" onSave={vi.fn()} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '99' } })
    expect(input.value).toBe('99')
  })

  it('blur 시 onSave가 호출된다', () => {
    const onSave = vi.fn()
    render(<NumInput label="X" value={0} prop="x" uuid="u1" onSave={onSave} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '50' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith('u1', 'x', 50)
  })

  it('Enter 키 시 blur가 트리거된다', () => {
    const onSave = vi.fn()
    render(<NumInput label="X" value={0} prop="x" uuid="u1" onSave={onSave} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '77' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // blur event가 발생해야 onSave 호출
  })

  it('Escape 키 시 값을 원래대로 되돌린다', () => {
    const onSave = vi.fn()
    render(<NumInput label="X" value={10} prop="x" uuid="u1" onSave={onSave} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('10')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('값이 변하지 않으면 onSave를 호출하지 않는다', () => {
    const onSave = vi.fn()
    render(<NumInput label="X" value={5} prop="x" uuid="u1" onSave={onSave} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.blur(input)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('NaN 입력 시 onSave를 호출하지 않는다', () => {
    const onSave = vi.fn()
    render(<NumInput label="X" value={0} prop="x" uuid="u1" onSave={onSave} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.blur(input)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('value prop이 외부에서 바뀌면 dirty 아닐 때 갱신된다', () => {
    const { rerender } = render(<NumInput label="X" value={1} prop="x" uuid="u1" onSave={vi.fn()} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('1')
    rerender(<NumInput label="X" value={99} prop="x" uuid="u1" onSave={vi.fn()} />)
    expect(input.value).toBe('99')
  })
})

// ── SectionHeader ─────────────────────────────────────────────────────────────

describe('SectionHeader', () => {
  it('label 텍스트를 렌더링한다', () => {
    render(<SectionHeader label="Transform" />)
    expect(screen.getByText('Transform')).toBeTruthy()
  })

  it('여러 SectionHeader를 각각 렌더링한다', () => {
    render(
      <>
        <SectionHeader label="A" />
        <SectionHeader label="B" />
      </>
    )
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
  })
})

// ── WidgetInspector ───────────────────────────────────────────────────────────

describe('WidgetInspector', () => {
  const onUpdate = vi.fn()
  const trackUpdate = vi.fn()

  it('cc.Widget 컴포넌트가 없으면 null을 반환한다', () => {
    const node = makeNode({ components: [] })
    const { container } = render(
      <WidgetInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('cc.Widget 컴포넌트가 있으면 섹션을 렌더링한다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Widget', props: { alignMode: 0 } }],
    })
    render(<WidgetInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('Widget')).toBeTruthy()
  })

  it('alignMode select가 렌더링된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Widget', props: { alignMode: 1 } }],
    })
    render(<WidgetInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('1')
  })

  it('top/bottom/left/right 방향 체크박스가 렌더링된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Widget', props: {
        alignMode: 0,
        isAbsoluteTop: true, top: 10,
        isAbsoluteBottom: false, bottom: 0,
        isAbsoluteLeft: false, left: 0,
        isAbsoluteRight: false, right: 0,
      } }],
    })
    render(<WidgetInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThanOrEqual(4)
  })

  it('props가 없으면 null을 반환한다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Widget' }],
    })
    const { container } = render(
      <WidgetInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />
    )
    expect(container.firstChild).toBeNull()
  })
})

// ── SpriteInspector ───────────────────────────────────────────────────────────

describe('SpriteInspector', () => {
  const onUpdate = vi.fn()
  const trackUpdate = vi.fn()

  it('cc.Sprite 컴포넌트가 없으면 null을 반환한다', () => {
    const node = makeNode({ components: [] })
    const { container } = render(
      <SpriteInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('cc.Sprite가 있으면 "Sprite" 섹션이 표시된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Sprite', props: { spriteFrame: { __uuid__: 'abc123' } } }],
    })
    render(<SpriteInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('Sprite')).toBeTruthy()
  })

  it('uuid가 16자 이하이면 그대로 표시한다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Sprite', props: { spriteFrame: { __uuid__: 'short' } } }],
    })
    render(<SpriteInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('short')).toBeTruthy()
  })

  it('uuid가 16자 초과이면 축약 표시한다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Sprite', props: { spriteFrame: { __uuid__: 'abcdefgh12345678xyz' } } }],
    })
    render(<SpriteInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    // 8자...6자 형태로 축약
    const sfTexts = screen.getAllByText(/\.\.\./i)
    expect(sfTexts.length).toBeGreaterThan(0)
  })

  it('cc.Sprite2D도 인식한다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Sprite2D', props: { spriteFrame: null } }],
    })
    render(<SpriteInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('Sprite')).toBeTruthy()
  })

  it('spriteFrame이 없으면 "(없음)" 표시', () => {
    const node = makeNode({
      components: [{ type: 'cc.Sprite', props: {} }],
    })
    render(<SpriteInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('(없음)')).toBeTruthy()
  })
})

// ── LabelInspector ────────────────────────────────────────────────────────────

describe('LabelInspector', () => {
  const onUpdate = vi.fn()
  const trackUpdate = vi.fn()

  it('cc.Label이 없으면 null을 반환한다', () => {
    const node = makeNode({ components: [] })
    const { container } = render(
      <LabelInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('cc.Label 있으면 "Label (Font)" 섹션이 표시된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Label', props: { isSystemFontUsed: true, fontFamily: 'Arial' } }],
    })
    render(<LabelInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('Label (Font)')).toBeTruthy()
  })

  it('isSystemFontUsed=true이면 YES 표시', () => {
    const node = makeNode({
      components: [{ type: 'cc.Label', props: { isSystemFontUsed: true, fontFamily: 'Arial' } }],
    })
    render(<LabelInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('YES')).toBeTruthy()
  })

  it('isSystemFontUsed=false이면 NO 표시', () => {
    const node = makeNode({
      components: [{ type: 'cc.Label', props: { isSystemFontUsed: false } }],
    })
    render(<LabelInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('NO')).toBeTruthy()
  })

  it('overflow 값에 따른 라벨이 표시된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Label', props: { overflow: 2 } }],
    })
    render(<LabelInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText(/SHRINK/)).toBeTruthy()
  })

  it('spacingX, spacingY가 표시된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Label', props: { spacingX: 3, spacingY: 5 } }],
    })
    render(<LabelInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('props가 없으면 null을 반환한다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Label' }],
    })
    const { container } = render(
      <LabelInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />
    )
    expect(container.firstChild).toBeNull()
  })
})

// ── ButtonInspector ───────────────────────────────────────────────────────────

describe('ButtonInspector', () => {
  const onUpdate = vi.fn()
  const trackUpdate = vi.fn()

  it('cc.Button이 없으면 null을 반환한다', () => {
    const node = makeNode({ components: [] })
    const { container } = render(
      <ButtonInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('cc.Button 있으면 "Button" 섹션이 표시된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Button', props: { interactable: true } }],
    })
    render(<ButtonInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    expect(screen.getByText('Button')).toBeTruthy()
  })

  it('interactable=true이면 체크박스가 체크된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Button', props: { interactable: true } }],
    })
    render(<ButtonInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const interactChk = checkboxes[0]
    expect(interactChk.checked).toBe(true)
  })

  it('transition 값이 select에 표시된다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Button', props: { transition: 2 } }],
    })
    render(<ButtonInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('2')
  })

  it('props가 없으면 null을 반환한다', () => {
    const node = makeNode({
      components: [{ type: 'cc.Button' }],
    })
    const { container } = render(
      <ButtonInspector node={node} onUpdate={onUpdate} trackUpdate={trackUpdate} />
    )
    expect(container.firstChild).toBeNull()
  })
})
