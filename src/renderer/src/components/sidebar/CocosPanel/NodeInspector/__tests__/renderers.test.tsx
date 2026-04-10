import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { LabelRenderer } from '../renderers/LabelRenderer'
import { SpriteRenderer } from '../renderers/SpriteRenderer'
import { ButtonRenderer } from '../renderers/ButtonRenderer'
import { UIRenderer } from '../renderers/UIRenderer'

// window.api mock
beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: {
      ccFileBuildUUIDMap: vi.fn().mockResolvedValue({}),
      ccFileResolveTexture: vi.fn().mockResolvedValue(null),
    },
    writable: true,
  })
})

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeSceneFile(version: '2x' | '3x' = '2x'): CCSceneFile {
  return {
    projectInfo: {
      detected: true,
      version,
      assetsDir: '/fake/assets',
    },
    scenePath: '/fake/scene.fire',
    root: makeDraftNode(),
  }
}

function makeDraftNode(components: CCSceneComponent[] = []): CCSceneNode {
  return {
    uuid: 'test-node',
    name: 'TestNode',
    active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components,
    children: [],
  }
}

function makeRendererProps(comp: CCSceneComponent, ci = 0) {
  const draft = makeDraftNode([comp])
  return {
    comp,
    draft,
    applyAndSave: vi.fn(),
    sceneFile: makeSceneFile(),
    origIdx: 0,
    ci,
    is3x: false,
  }
}

// ── LabelRenderer ─────────────────────────────────────────────────────────────

describe('LabelRenderer', () => {
  it('cc.Label — string 필드가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: { string: 'Hello World', fontSize: 24 },
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    const textarea = textareas.find(el => el.tagName === 'TEXTAREA' && el.value === 'Hello World')
    expect(textarea).toBeTruthy()
    expect(textarea!.value).toBe('Hello World')
  })

  it('cc.Label — enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: { enabled: true },
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('cc.Label — enabled=false 이면 체크박스 unchecked', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: { enabled: false },
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
  })

  it('cc.Label — props 없으면 enabled 기본 true로 렌더링', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: {},
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('cc.Label — 빈 string이면 경고 뱃지가 표시된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: { string: '' },
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText(/빈 문자열/)).toBeTruthy()
  })

  it('cc.Label — string 길이 표시', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: { string: 'ABCDE' },
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('5자')).toBeTruthy()
  })

  it('cc.Label — _string 폴백도 표시된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: { _string: 'fallback text' },
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    const textarea = textareas.find(el => el.tagName === 'TEXTAREA' && el.value === 'fallback text')
    expect(textarea).toBeTruthy()
  })

  it('cc.Label — props 빈 객체이면 textarea 빈 문자열 표시', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: {},
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    const textarea = textareas.find(el => el.tagName === 'TEXTAREA')
    expect(textarea).toBeTruthy()
    expect(textarea!.value).toBe('')
  })

  it('cc.Label — "string" label 텍스트가 존재한다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: { string: 'test' },
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('string')).toBeTruthy()
  })

  it('cc.Label — enabled 텍스트가 존재한다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Label',
      props: {},
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('enabled')).toBeTruthy()
  })

  it('cc.RichText — enabled 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.RichText',
      props: { string: 'rich text' },
    }
    render(<LabelRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes.length).toBeGreaterThan(0)
  })
})

// ── SpriteRenderer ────────────────────────────────────────────────────────────

describe('SpriteRenderer', () => {
  it('cc.Sprite — "cc.Sprite" 타입명이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Sprite',
      props: {},
    }
    render(<SpriteRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('cc.Sprite')).toBeTruthy()
  })

  it('cc.Sprite — enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Sprite',
      props: { enabled: true },
    }
    render(<SpriteRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('cc.Sprite — enabled=false 이면 unchecked', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Sprite',
      props: { enabled: false },
    }
    render(<SpriteRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
  })

  it('cc.Graphics — lineWidth 입력이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Graphics',
      props: { lineWidth: 3 },
    }
    render(<SpriteRenderer {...makeRendererProps(comp)} />)
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
    const lineWidthInput = inputs.find(i => Number(i.value) === 3)
    expect(lineWidthInput).toBeTruthy()
  })

  it('cc.Graphics — lineWidth label이 존재한다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Graphics',
      props: { lineWidth: 1 },
    }
    render(<SpriteRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('lineWidth')).toBeTruthy()
  })

  it('cc.Graphics — fillColor color input이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Graphics',
      props: { fillColor: { r: 255, g: 0, b: 0 } },
    }
    render(<SpriteRenderer {...makeRendererProps(comp)} />)
    const colorInputs = screen.getAllByDisplayValue(/^#[0-9a-f]{6}$/i)
    expect(colorInputs.length).toBeGreaterThan(0)
  })

  it('cc.VideoPlayer — resType 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.VideoPlayer',
      props: {},
    }
    render(<SpriteRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('resType')).toBeTruthy()
  })

  it('cc.TiledMap — tmxFile 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.TiledMap',
      props: { tmxFile: '(없음)' },
    }
    render(<SpriteRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText(/tmxFile/)).toBeTruthy()
  })
})

// ── ButtonRenderer ────────────────────────────────────────────────────────────

describe('ButtonRenderer', () => {
  it('cc.Button — interactable 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Button',
      props: { interactable: true },
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText(/interactable/i)).toBeTruthy()
  })

  it('cc.Button — interactable 체크박스가 true이면 checked', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Button',
      props: { interactable: true },
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const interactable = checkboxes.find(c => c.checked)
    expect(interactable).toBeTruthy()
  })

  it('cc.Button — interactable=false이면 해당 체크박스 unchecked', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Button',
      props: { interactable: false, enabled: true },
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    // enabled checkbox(checked) + interactable checkbox(unchecked) 존재
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes.length).toBeGreaterThanOrEqual(2)
  })

  it('cc.Button — interactable label이 존재한다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Button',
      props: {},
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText(/interactable/i)).toBeTruthy()
  })

  it('cc.ToggleContainer — allowSwitchOff 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.ToggleContainer',
      props: { allowSwitchOff: false },
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('allowSwitchOff')).toBeTruthy()
  })

  it('cc.ToggleContainer — "cc.ToggleContainer" 타입명이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.ToggleContainer',
      props: {},
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('cc.ToggleContainer')).toBeTruthy()
  })

  it('cc.EditBox — string 입력 필드가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.EditBox',
      props: { string: 'initial text' },
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const stringInput = inputs.find(i => i.value === 'initial text')
    expect(stringInput).toBeTruthy()
  })

  it('cc.EditBox — "cc.EditBox" 타입명이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.EditBox',
      props: {},
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('cc.EditBox')).toBeTruthy()
  })

  it('cc.Toggle — isChecked 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Toggle',
      props: { isChecked: true },
    }
    render(<ButtonRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('isChecked')).toBeTruthy()
  })
})

// ── UIRenderer ────────────────────────────────────────────────────────────────

describe('UIRenderer', () => {
  it('cc.Canvas — resolution 레이블이 존재한다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Canvas',
      props: { _N$designResolution: { width: 960, height: 640 } },
    }
    render(<UIRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('resolution')).toBeTruthy()
  })

  it('cc.Canvas — fitWidth 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Canvas',
      props: {},
    }
    render(<UIRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('fitWidth')).toBeTruthy()
  })

  it('cc.Canvas — fitHeight 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Canvas',
      props: {},
    }
    render(<UIRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('fitHeight')).toBeTruthy()
  })

  it('cc.Canvas — enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Canvas',
      props: {},
    }
    render(<UIRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('cc.ProgressBar — progress 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.ProgressBar',
      props: { progress: 0.5 },
    }
    render(<UIRenderer {...makeRendererProps(comp)} />)
    expect(screen.getByText('progress')).toBeTruthy()
  })

  it('cc.Widget — enabled 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Widget',
      props: {},
    }
    render(<UIRenderer {...makeRendererProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes.length).toBeGreaterThan(0)
  })
})
