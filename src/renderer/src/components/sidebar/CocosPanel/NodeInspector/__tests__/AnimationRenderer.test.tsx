import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { AnimationRenderer } from '../renderers/AnimationRenderer'

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

// ── cc.Animation ──────────────────────────────────────────────────────────────

describe('AnimationRenderer — cc.Animation', () => {
  const clips = [{ name: 'idle' }, { name: 'run' }, { name: 'jump' }]

  it('_resolvedClips가 있으면 클립 수가 표시된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips, _defaultClipName: 'idle' },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    expect(screen.getByText('3 clips')).toBeTruthy()
  })

  it('_resolvedClips가 없으면 null 렌더링(빈 컨테이너)', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: {},
    }
    const { container } = render(<AnimationRenderer {...makeProps(comp)} />)
    expect(container.firstChild).toBeNull()
  })

  it('enabled 체크박스가 기본 true', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(true)
  })

  it('enabled=false 이면 unchecked', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips, enabled: false },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
  })

  it('클립 이름 목록이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips, _defaultClipName: 'idle' },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    // non-default clips render once as plain text in the span
    const runEls = screen.getAllByText(/run/)
    expect(runEls.length).toBeGreaterThan(0)
    const jumpEls = screen.getAllByText(/jump/)
    expect(jumpEls.length).toBeGreaterThan(0)
  })

  it('defaultClip에 ★ 표시가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips, _defaultClipName: 'run' },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    // ★ run appears in select option text and in clip list span
    const els = screen.getAllByText(/★ run/)
    expect(els.length).toBeGreaterThan(0)
  })

  it('playOnLoad 체크박스가 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips, playOnLoad: false },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    expect(screen.getByText('playOnLoad')).toBeTruthy()
  })

  it('playOnLoad=true 이면 checked', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips, playOnLoad: true },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const playOnLoadCb = checkboxes.find(cb => cb.checked && checkboxes.indexOf(cb) > 0)
    expect(playOnLoadCb).toBeTruthy()
  })

  it('sample 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips, sample: 60 },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    expect(screen.getByText('sample')).toBeTruthy()
  })

  it('wrapMode 버튼이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    expect(screen.getByText('wrapMode')).toBeTruthy()
    // preset buttons
    expect(screen.getByText('Loop')).toBeTruthy()
  })

  it('"default" 레이블이 렌더링된다', () => {
    const comp: CCSceneComponent = {
      type: 'cc.Animation',
      props: { _resolvedClips: clips, _defaultClipName: 'idle' },
    }
    render(<AnimationRenderer {...makeProps(comp)} />)
    expect(screen.getByText('default')).toBeTruthy()
  })
})
