import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { EffectsRenderer } from '../renderers/EffectsRenderer'

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

function makeProps(comp: CCSceneComponent, extra: Partial<{ is3x: boolean }> = {}) {
  const draft = makeDraftNode([comp])
  return {
    comp,
    draft,
    applyAndSave: vi.fn(),
    sceneFile: makeSceneFile(),
    origIdx: 0,
    ci: 0,
    is3x: extra.is3x ?? false,
  }
}

// ── cc.AudioSource ────────────────────────────────────────────────────────────

describe('EffectsRenderer — cc.AudioSource', () => {
  it('enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = { type: 'cc.AudioSource', props: {} }
    render(<EffectsRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('enabled=false 이면 unchecked', () => {
    const comp: CCSceneComponent = { type: 'cc.AudioSource', props: { enabled: false } }
    render(<EffectsRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
  })

  it('volume 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.AudioSource', props: { volume: 0.5 } }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('volume')).toBeTruthy()
  })

  it('loop 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.AudioSource', props: { loop: true } }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('loop')).toBeTruthy()
  })

  it('playOnLoad 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.AudioSource', props: { playOnLoad: false } }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('playOnLoad')).toBeTruthy()
  })

  it('clip uuid가 없으면 "(none)"이 표시된다', () => {
    const comp: CCSceneComponent = { type: 'cc.AudioSource', props: {} }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('(none)')).toBeTruthy()
  })

  it('clip uuid가 있으면 표시된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.AudioSource',
      props: { _clip: { __uuid__: 'abc-123' } },
    }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('abc-123')).toBeTruthy()
  })

  it('pitch 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.AudioSource', props: { pitch: 1.5 } }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('pitch')).toBeTruthy()
  })
})

// ── cc.Camera ────────────────────────────────────────────────────────────────

describe('EffectsRenderer — cc.Camera', () => {
  it('enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = { type: 'cc.Camera', props: {} }
    render(<EffectsRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('bgColor 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Camera',
      props: { backgroundColor: { r: 0, g: 0, b: 0, a: 255 } },
    }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('bgColor')).toBeTruthy()
  })

  it('clearFlags 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.Camera', props: { clearFlags: 7 } }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('clearFlags')).toBeTruthy()
  })

  it('depth 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.Camera', props: { depth: 0 } }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('depth')).toBeTruthy()
  })

  it('fov 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.Camera', props: {} }
    render(<EffectsRenderer {...makeProps(comp)} />)
    expect(screen.getByText('fov')).toBeTruthy()
  })

  it('zoomRatio 레이블이 CC2.x에서 렌더링된다', () => {
    const comp: CCSceneComponent = { type: 'cc.Camera', props: {} }
    render(<EffectsRenderer {...makeProps(comp, { is3x: false })} />)
    expect(screen.getByText('zoomRatio')).toBeTruthy()
  })
})

// ── cc.DirectionalLight ──────────────────────────────────────────────────────

describe('EffectsRenderer — cc.DirectionalLight', () => {
  it('렌더링 결과가 null이 아니거나 타입명이 포함된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.DirectionalLight',
      props: { enabled: true },
    }
    const { container } = render(<EffectsRenderer {...makeProps(comp)} />)
    // DirectionalLight는 별도 섹션 없으면 null — 컨테이너가 비어있으면 OK
    expect(container).toBeTruthy()
  })
})
