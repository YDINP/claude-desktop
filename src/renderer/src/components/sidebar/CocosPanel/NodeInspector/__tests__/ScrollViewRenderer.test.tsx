import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { ScrollViewRenderer } from '../renderers/ScrollViewRenderer'

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: {
      ccFileBuildUUIDMap: vi.fn().mockResolvedValue({}),
      ccFileResolveTexture: vi.fn().mockResolvedValue(null),
    },
    writable: true,
  })
})

function makeSceneFile(): CCSceneFile {
  return {
    projectInfo: { detected: true, version: '2x', assetsDir: '/fake/assets' },
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

function makeProps(comp: CCSceneComponent) {
  const draft = makeDraftNode([comp])
  return {
    comp,
    draft,
    applyAndSave: vi.fn(),
    saveScene: vi.fn().mockResolvedValue({ success: true }),
    sceneFile: makeSceneFile(),
    origIdx: 0,
    ci: 0,
    is3x: false,
  }
}

describe('ScrollViewRenderer — cc.ScrollView', () => {
  it('enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = { type: 'cc.ScrollView', props: {} }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('enabled=false 이면 unchecked', () => {
    const comp: CCSceneComponent = { type: 'cc.ScrollView', props: { enabled: false } }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
  })

  it('horizontal 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.ScrollView', props: { horizontal: true } }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    expect(screen.getByText('horizontal')).toBeTruthy()
  })

  it('vertical 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.ScrollView', props: { vertical: true } }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    expect(screen.getByText('vertical')).toBeTruthy()
  })

  it('inertia 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.ScrollView', props: { inertia: true } }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    expect(screen.getByText('inertia')).toBeTruthy()
  })

  it('elastic 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.ScrollView', props: {} }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    expect(screen.getByText('elastic')).toBeTruthy()
  })

  it('brake 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.ScrollView', props: { brake: 0.75 } }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    expect(screen.getByText('brake')).toBeTruthy()
  })

  it('horizontal=true 이면 해당 체크박스가 checked', () => {
    const comp: CCSceneComponent = { type: 'cc.ScrollView', props: { horizontal: true } }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    // enabled(0), horizontal(1), vertical(2), inertia(3), elastic(4), bounce(5)
    const hCheckbox = checkboxes.find((_, i) => i === 1)
    expect(hCheckbox?.checked).toBe(true)
  })

  it('inertia=false 이면 해당 체크박스가 unchecked', () => {
    const comp: CCSceneComponent = {
      type: 'cc.ScrollView',
      props: { inertia: false, horizontal: false, vertical: false, elastic: false },
    }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    // inertia checkbox
    const inertiaCheckbox = checkboxes.find((cb, i) => i === 3)
    expect(inertiaCheckbox?.checked).toBe(false)
  })
})

describe('ScrollViewRenderer — cc.PageView', () => {
  it('enabled 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.PageView', props: {} }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes.length).toBeGreaterThan(0)
  })

  it('direction 셀렉트가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.PageView', props: { direction: 0 } }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    expect(screen.getByText('direction')).toBeTruthy()
  })

  it('slideDur 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.PageView', props: {} }
    render(<ScrollViewRenderer {...makeProps(comp)} />)
    expect(screen.getByText('slideDur')).toBeTruthy()
  })
})
