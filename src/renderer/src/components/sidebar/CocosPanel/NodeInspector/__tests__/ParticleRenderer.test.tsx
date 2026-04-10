import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { ParticleRenderer } from '../renderers/ParticleRenderer'

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

describe('ParticleRenderer — cc.ParticleSystem', () => {
  it('enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = { type: 'cc.ParticleSystem', props: {} }
    render(<ParticleRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('enabled=false 이면 unchecked', () => {
    const comp: CCSceneComponent = { type: 'cc.ParticleSystem', props: { enabled: false } }
    render(<ParticleRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
  })

  it('duration 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.ParticleSystem', props: { duration: -1 } }
    render(<ParticleRenderer {...makeProps(comp)} />)
    expect(screen.getByText('duration')).toBeTruthy()
  })

  it('duration=-1이면 "(loop)" 표시', () => {
    const comp: CCSceneComponent = { type: 'cc.ParticleSystem', props: { duration: -1 } }
    render(<ParticleRenderer {...makeProps(comp)} />)
    expect(screen.getByText('(loop)')).toBeTruthy()
  })

  it('maxParticles 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.ParticleSystem',
      props: { maxParticles: 200 },
    }
    render(<ParticleRenderer {...makeProps(comp)} />)
    expect(screen.getByText('maxParticles')).toBeTruthy()
  })

  it('startSize 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.ParticleSystem',
      props: { startSize: 50 },
    }
    render(<ParticleRenderer {...makeProps(comp)} />)
    expect(screen.getByText('startSize')).toBeTruthy()
  })

  it('emitRate 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.ParticleSystem',
      props: { emissionRate: 10 },
    }
    render(<ParticleRenderer {...makeProps(comp)} />)
    expect(screen.getByText('emitRate')).toBeTruthy()
  })

  it('gravity 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.ParticleSystem',
      props: { gravity: { x: 0, y: -200 } },
    }
    render(<ParticleRenderer {...makeProps(comp)} />)
    expect(screen.getByText('gravity')).toBeTruthy()
  })

  it('lifespan 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.ParticleSystem', props: { life: 1 } }
    render(<ParticleRenderer {...makeProps(comp)} />)
    expect(screen.getByText('lifespan')).toBeTruthy()
  })

  it('cc.ParticleSystem2D도 동일하게 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.ParticleSystem2D', props: {} }
    render(<ParticleRenderer {...makeProps(comp)} />)
    expect(screen.getByText('duration')).toBeTruthy()
  })
})
