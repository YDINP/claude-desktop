import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { PhysicsRenderer } from '../renderers/PhysicsRenderer'

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
    sceneFile: makeSceneFile(),
    origIdx: 0,
    ci: 0,
    is3x: false,
  }
}

// ── cc.RigidBody ──────────────────────────────────────────────────────────────

describe('PhysicsRenderer — cc.RigidBody', () => {
  it('type 셀렉트가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.RigidBody', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('type')).toBeTruthy()
  })

  it('enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = { type: 'cc.RigidBody', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('enabled=false 이면 unchecked', () => {
    const comp: CCSceneComponent = { type: 'cc.RigidBody', props: { enabled: false } }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
  })

  it('mass 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.RigidBody', props: { mass: 2 } }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('mass')).toBeTruthy()
  })

  it('gravityScale 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.RigidBody', props: { gravityScale: 1 } }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('gravityScale')).toBeTruthy()
  })

  it('fixedRot 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.RigidBody', props: { fixedRotation: false } }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('fixedRot')).toBeTruthy()
  })

  it('DYNAMIC/STATIC/KINEMATIC 타입 버튼이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.RigidBody', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('DYNAMIC')).toBeTruthy()
    expect(screen.getByText('STATIC')).toBeTruthy()
    expect(screen.getByText('KINEMATIC')).toBeTruthy()
  })

  it('cc.RigidBody2D도 mass 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.RigidBody2D', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('mass')).toBeTruthy()
  })
})

// ── cc.BoxCollider ────────────────────────────────────────────────────────────

describe('PhysicsRenderer — cc.BoxCollider', () => {
  it('타입명이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.BoxCollider', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('cc.BoxCollider')).toBeTruthy()
  })

  it('enabled 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.BoxCollider', props: { enabled: true } }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('offset X 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.BoxCollider',
      props: { offset: { x: 0, y: 0 } },
    }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('offset X')).toBeTruthy()
  })

  it('width / height 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.BoxCollider', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('width')).toBeTruthy()
    expect(screen.getByText('height')).toBeTruthy()
  })

  it('sensor 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.BoxCollider', props: { sensor: false } }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('sensor')).toBeTruthy()
  })

  it('friction 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.BoxCollider', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('friction')).toBeTruthy()
  })

  it('restitution 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.BoxCollider', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('restitution')).toBeTruthy()
  })

  it('cc.BoxCollider2D도 동일하게 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.BoxCollider2D', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('cc.BoxCollider2D')).toBeTruthy()
  })
})

// ── cc.CircleCollider ─────────────────────────────────────────────────────────

describe('PhysicsRenderer — cc.CircleCollider', () => {
  it('타입명이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.CircleCollider', props: {} }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('cc.CircleCollider')).toBeTruthy()
  })

  it('radius 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.CircleCollider', props: { radius: 50 } }
    render(<PhysicsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('radius')).toBeTruthy()
  })
})
